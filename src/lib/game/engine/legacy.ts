/**
 * Bilan final (P3-08, GDD §12, DESIGN.md §6) : mesures du parcours, distinctions
 * narratives non exclusives et nécrologie adaptée à la cause de fin.
 *
 * Tout se recalcule depuis l'état final et son journal ; rien n'est stocké ni
 * transmis à la carrière suivante (pas de prestige, pas de méta-progression).
 * La nécrologie est choisie de façon déterministe depuis la seed, sans toucher
 * au PRNG de la partie.
 */
import type {
	Content,
	DistinctionDefinition,
	EndCauseId,
	LegacyCriterion,
	LegacyMetric,
	ObituaryDefinition
} from '../content/types.ts';
import { TURNS_PER_YEAR, type Turn } from './calendar.ts';
import { countsTowardCumul } from './career.ts';
import { ownedMedia } from './press.ts';
import { hashSeed } from './random.ts';
import { careerSummary } from './selectors.ts';
import type { GameState, MandateInstance } from './state.ts';

/** Seuil d'attitude d'un allié ou d'un ennemi déclaré. */
const RELATION_THRESHOLD = 40;

export type LegacyMetrics = Readonly<Record<LegacyMetric, number>>;

function lastTurnOf(state: GameState): Turn {
	return state.end ? state.end.turn : state.turn;
}

/** Fin d'exercice d'un mandat (exclue), bornée au dernier trimestre de la carrière. */
function endOf(mandate: MandateInstance, last: Turn): Turn {
	return mandate.endTurn ?? last + 1;
}

/** Mesures du parcours, de l'état final et du journal. */
export function legacyMetrics(state: GameState, content: Content): LegacyMetrics {
	const summary = careerSummary(state);
	const last = lastTurnOf(state);
	const mandates = state.mandates;
	const inOffice = new Set<Turn>();
	let peakCumul = 0;
	for (let turn = 0; turn <= last; turn += 1) {
		const active = mandates.filter(
			(mandate) => mandate.startTurn <= turn && turn < endOf(mandate, last)
		);
		if (active.length > 0) inOffice.add(turn);
		peakCumul = Math.max(
			peakCumul,
			active.filter((mandate) => countsTowardCumul(mandate.mandateId, state.institutions)).length
		);
	}
	const attitudes = Object.values(state.relationships).map((relation) => relation.attitude);
	return {
		age: summary.age,
		years: Math.floor(summary.quartersPlayed / TURNS_PER_YEAR),
		mandatesHeld: mandates.length,
		highestRank: Math.max(
			0,
			...mandates.map((mandate) => content.mandates[mandate.mandateId]?.rank ?? 0)
		),
		yearsInOffice: Math.floor(inOffice.size / TURNS_PER_YEAR),
		peakCumul,
		campaignsWon: state.campaigns.filter((campaign) => campaign.status === 'won').length,
		campaignsLost: state.campaigns.filter((campaign) => campaign.status === 'lost').length,
		partyChanges: state.player.affiliations.length,
		facts: state.facts.length,
		cases: summary.cases,
		convictions: summary.convictions,
		divertedCents: summary.divertedCents,
		netWorthCents: summary.netWorthCents,
		promisesKept: summary.promises.kept,
		promisesBroken: summary.promises.abandoned,
		mediaOwned: ownedMedia(state.upgrades, state.player.territory.regionId, content).size,
		reformsAdopted: state.institutions.reforms.filter(
			(reform) =>
				reform.origin === 'player' && (reform.status === 'scheduled' || reform.status === 'enacted')
		).length,
		children: state.player.family.childrenIds.length,
		allies: attitudes.filter((attitude) => attitude >= RELATION_THRESHOLD).length,
		enemies: attitudes.filter((attitude) => attitude <= -RELATION_THRESHOLD).length
	};
}

export function meetsCriteria(
	criteria: readonly LegacyCriterion[],
	metrics: LegacyMetrics
): boolean {
	return criteria.every(({ metric, cmp, value }) => {
		const actual = metrics[metric];
		return cmp === 'gte' ? actual >= value : cmp === 'lte' ? actual <= value : actual === value;
	});
}

/** Distinctions méritées, dans l'ordre du catalogue (aucune n'exclut les autres). */
export function distinctionsOf(state: GameState, content: Content): DistinctionDefinition[] {
	const metrics = legacyMetrics(state, content);
	return content.distinctions.filter((distinction) => meetsCriteria(distinction.criteria, metrics));
}

/** Cause de fin au sens du catalogue, `null` tant que la carrière continue. */
export function endCauseOf(state: GameState): EndCauseId | null {
	if (!state.end) return null;
	return state.end.reason === 'prison' ? 'prison' : state.end.cause;
}

/**
 * Spécificité d'une nécrologie : nombre de critères, plus un si elle est
 * propre à une seule cause de fin (« à la tâche » pour l'épuisement).
 */
function specificity(obituary: ObituaryDefinition): number {
	return obituary.criteria.length + (obituary.causes.length === 1 ? 1 : 0);
}

/**
 * Nécrologie : parmi celles de la cause de fin dont les critères sont remplis,
 * les plus spécifiques, départagées par la seed.
 */
export function obituaryOf(state: GameState, content: Content): ObituaryDefinition | null {
	const cause = endCauseOf(state);
	if (cause === null) return null;
	const metrics = legacyMetrics(state, content);
	const eligible = content.obituaries.filter(
		(obituary) => obituary.causes.includes(cause) && meetsCriteria(obituary.criteria, metrics)
	);
	const best = Math.max(0, ...eligible.map(specificity));
	const pool = eligible.filter((obituary) => specificity(obituary) === best);
	if (pool.length === 0) return null;
	return pool[hashSeed(`${state.rng.seed}:nécrologie`) % pool.length] ?? null;
}

/** Plus haute fonction exercée (libellé), `null` sans mandat. */
export function highestOffice(state: GameState, content: Content): string | null {
	const best = [...state.mandates].sort(
		(left, right) =>
			(content.mandates[right.mandateId]?.rank ?? 0) - (content.mandates[left.mandateId]?.rank ?? 0)
	)[0];
	return best ? (content.mandates[best.mandateId]?.label ?? best.mandateId) : null;
}
