/**
 * Registre des faits et jauges de la justice (P3-01, ARCHITECTURE.md §8.4).
 *
 * - Un acte douteux choisi dans un événement inscrit un fait daté au registre
 *   (`recordFact`) ; justice, presse et bilan s'appuient sur ce registre plutôt
 *   que sur des tirages indépendants.
 * - Le risque judiciaire est dérivé, jamais stocké : chaque fait récent y
 *   contribue selon sa gravité et l'implication du joueur, en décroissant
 *   jusqu'à la prescription ; l'exposition médiatique le majore. Il mesure une
 *   exposition aux enquêtes, pas une culpabilité, et n'entraîne jamais seul de
 *   condamnation.
 * - L'exposition médiatique est une jauge stockée : les effets la font varier,
 *   puis elle revient à chaque frontière vers une référence fixée par les
 *   fonctions exercées et les campagnes en cours.
 *
 * Toutes les valeurs sont des hypothèses de `justice.json`. Aucun aléa.
 */
import { GAUGE_MAX, GAUGE_MIN, type Content } from '../content/types.ts';
import type { Turn } from './calendar.ts';
import { activeMandates } from './career.ts';
import { clampGauge, type FactEffect } from './effects.ts';
import type { Campaign, Fact, GameState, MandateInstance, PlayerState } from './state.ts';

export function factInstanceId(rank: number): string {
	return `fact.${rank}`;
}

/**
 * Inscrit un fait. Les protagonistes sont les acteurs de l'événement pour les
 * rôles cités ; un rôle sans acteur (personnage parti) est simplement omis.
 */
export function createFact(
	effect: FactEffect,
	facts: readonly Fact[],
	actors: Readonly<Record<string, string>>,
	eventId: string,
	turn: Turn
): Fact {
	const authorId = effect.author === undefined ? null : (actors[effect.author] ?? null);
	return {
		factId: factInstanceId(facts.length + 1),
		offenseId: effect.offense,
		turn,
		severity: effect.severity,
		divertedCents: effect.divertedCents ?? 0,
		authorId,
		accompliceIds: (effect.accomplices ?? []).flatMap((role) => {
			const id = actors[role];
			return id === undefined || id === authorId ? [] : [id];
		}),
		eventId
	};
}

/** Part du fait dans le risque : 100 % auteur, `accompliceRiskPercent` complice. */
function involvementPercent(fact: Fact, content: Content): number {
	return fact.authorId === null ? 100 : content.justice.accompliceRiskPercent;
}

export interface RiskContribution {
	readonly factId: string;
	/** Points de risque apportés par ce fait, avant majoration par l'exposition. */
	readonly points: number;
}

export interface JudicialRisk {
	/** Risque judiciaire, entier de 0 à 100. */
	readonly value: number;
	/** Contributions des faits non prescrits, dans l'ordre du registre. */
	readonly contributions: readonly RiskContribution[];
	/** Majoration due à l'exposition médiatique, en points. */
	readonly exposureBonus: number;
}

/**
 * Risque judiciaire au trimestre `turn` : somme des contributions des faits,
 * chacune décroissant linéairement jusqu'à la prescription, puis majoration
 * proportionnelle à l'exposition, bornée à [0, 100].
 */
export function judicialRisk(
	facts: readonly Fact[],
	exposure: number,
	turn: Turn,
	content: Content
): JudicialRisk {
	const rules = content.justice;
	const contributions: RiskContribution[] = [];
	for (const fact of facts) {
		const remaining = rules.prescriptionTurns - (turn - fact.turn);
		if (remaining <= 0) continue;
		const points = Math.round(
			(fact.severity * rules.riskPerSeverity * involvementPercent(fact, content) * remaining) /
				(100 * rules.prescriptionTurns)
		);
		if (points > 0) contributions.push({ factId: fact.factId, points });
	}
	const base = contributions.reduce((sum, entry) => sum + entry.points, 0);
	const exposureBonus = Math.round(
		(base * rules.exposureRiskBonusPercent * exposure) / (100 * GAUGE_MAX)
	);
	return { value: clampGauge(base + exposureBonus), contributions, exposureBonus };
}

/** Risque judiciaire de l'état courant. */
export function currentJudicialRisk(
	state: Pick<GameState, 'facts' | 'player' | 'turn'>,
	content: Content
): JudicialRisk {
	return judicialRisk(state.facts, state.player.exposure, state.turn, content);
}

/** Fonds détournés cumulés par le joueur ou avec sa complicité (bilan, GDD §12). */
export function divertedFunds(facts: readonly Fact[]): number {
	return facts.reduce((sum, fact) => sum + fact.divertedCents, 0);
}

/**
 * Exposition de référence : base, plus la plus exposée des fonctions exercées,
 * plus un supplément pendant une campagne.
 */
export function referenceExposure(
	mandates: readonly MandateInstance[],
	campaigns: readonly Campaign[],
	content: Content
): number {
	const rules = content.justice;
	const office = Math.max(
		0,
		...activeMandates(mandates).map((mandate) => rules.mandateExposure[mandate.mandateId] ?? 0)
	);
	const campaigning = campaigns.some((campaign) => campaign.status === 'running')
		? rules.campaignExposure
		: 0;
	return Math.min(GAUGE_MAX, Math.max(GAUGE_MIN, rules.baseExposure + office + campaigning));
}

/**
 * Retour de l'exposition vers sa référence à la frontière : une part de l'écart,
 * arrondie vers le haut pour qu'un écart finisse toujours par se résorber.
 */
export function resolveExposure(
	player: PlayerState,
	mandates: readonly MandateInstance[],
	campaigns: readonly Campaign[],
	content: Content
): { readonly player: PlayerState; readonly delta: number } {
	const gap = referenceExposure(mandates, campaigns, content) - player.exposure;
	const step = Math.ceil((Math.abs(gap) * content.justice.exposureDriftPercent) / 100);
	const delta = Math.sign(gap) * Math.min(Math.abs(gap), step);
	return delta === 0
		? { player, delta: 0 }
		: { player: { ...player, exposure: clampGauge(player.exposure + delta) }, delta };
}
