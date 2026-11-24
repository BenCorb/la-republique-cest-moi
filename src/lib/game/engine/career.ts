/**
 * Calendrier électoral et mandats (GDD §7, ARCHITECTURE.md §5.1 étape 5) — P2-02.
 *
 * - Calendrier : une échéance programmée par type d'élection ; après chaque
 *   scrutin, la suivante est fixée un cycle plus tard. Une élection anticipée
 *   annule l'échéance régulière (jamais un scrutin déjà tenu) et relance le cycle.
 * - Scrutin (fin du trimestre de l'échéance) : parts de voix tirées autour des
 *   forces des partis, avec un aléa borné ; une élection législative désigne le
 *   parti au gouvernement. Les mandats liés au type d'élection arrivent à terme
 *   (la candidature du joueur viendra avec P2-03).
 * - Mandats : chaque trimestre, temps réservé, revenus et stress ; règles du
 *   cumul (incompatibilités, prérequis, nombre maximal) lues dans l'état.
 * Les identifiants d'instance (`ballot.N`, `term.N`) sont des rangs de création,
 * sans compteur partagé : les autres identifiants d'instance ne bougent pas.
 */
import {
	GAUGE_MAX,
	GAUGE_MIN,
	type Content,
	type Effect,
	type ResourceAmount
} from '../content/types.ts';
import type { Turn } from './calendar.ts';
import { nextInt, type RngState } from './random.ts';
import type {
	Ballot,
	BallotShare,
	DeadlinesRecord,
	InstitutionsState,
	MandateEndReason,
	MandateInstance,
	PoliticalChange,
	WorldState
} from './state.ts';

export function ballotId(number: number): string {
	return `ballot.${number}`;
}

export function termId(number: number): string {
	return `term.${number}`;
}

function newBallot(
	ballots: readonly Ballot[],
	electionId: string,
	turn: Turn,
	early: boolean,
	content: Content
): Ballot {
	const definition = content.elections[electionId];
	if (!definition) throw new Error(`Élection inconnue : ${electionId}`);
	return {
		ballotId: ballotId(ballots.length + 1),
		electionId,
		turn,
		filingClosesTurn: turn - definition.filingLeadTurns,
		early,
		status: 'scheduled',
		shares: null,
		winnerPartyId: null,
		cancelReason: null
	};
}

/** Première échéance régulière de chaque type d'élection, au plus tôt au trimestre de départ. */
export function createCalendar(turn: Turn, content: Content): Ballot[] {
	const ballots: Ballot[] = [];
	for (const electionId of content.electionIds) {
		const definition = content.elections[electionId]!;
		let first = definition.firstTurn;
		while (first < turn) first += definition.cycleTurns;
		ballots.push(newBallot(ballots, electionId, first, false, content));
	}
	return ballots;
}

/** Prochaine échéance programmée d'un type d'élection. */
export function scheduledBallot(ballots: readonly Ballot[], electionId: string): Ballot | null {
	return (
		ballots.find((ballot) => ballot.electionId === electionId && ballot.status === 'scheduled') ??
		null
	);
}

// ---------------------------------------------------------------------------
// Mandats et cumul
// ---------------------------------------------------------------------------

export function activeMandates(mandates: readonly MandateInstance[]): MandateInstance[] {
	return mandates.filter((mandate) => mandate.status === 'active');
}

/** Temps réservé ce trimestre par les mandats en cours. */
export function reservedTime(mandates: readonly MandateInstance[], content: Content): number {
	return activeMandates(mandates).reduce(
		(total, mandate) => total + (content.mandates[mandate.mandateId]?.timePerTurn ?? 0),
		0
	);
}

/** Mandat en cours de rang le plus élevé (fonction principale), sinon `null`. */
export function mainMandate(
	mandates: readonly MandateInstance[],
	content: Content
): MandateInstance | null {
	let best: MandateInstance | null = null;
	for (const mandate of activeMandates(mandates)) {
		const rank = content.mandates[mandate.mandateId]?.rank ?? 0;
		if (!best || rank > (content.mandates[best.mandateId]?.rank ?? 0)) best = mandate;
	}
	return best;
}

function incompatible(institutions: InstitutionsState, left: string, right: string): boolean {
	return institutions.incompatibilities.some(
		([a, b]) => (a === left && b === right) || (a === right && b === left)
	);
}

/** Mandats en cours qui empêchent d'exercer `mandateId` (incompatibilités). */
export function conflictingMandates(
	mandateId: string,
	mandates: readonly MandateInstance[],
	institutions: InstitutionsState
): MandateInstance[] {
	return activeMandates(mandates).filter((mandate) =>
		incompatible(institutions, mandate.mandateId, mandateId)
	);
}

/**
 * Raison pour laquelle le joueur ne peut recevoir ce mandat, ou `null`, selon
 * les seules règles en vigueur dans l'état. Avec `replaceIncompatible`, les
 * mandats incompatibles sont réputés abandonnés. Sans contenu, les messages
 * citent les identifiants plutôt que les libellés.
 */
export function holdIssue(
	mandateId: string,
	mandates: readonly MandateInstance[],
	institutions: InstitutionsState,
	content: Content | null,
	replaceIncompatible = false
): string | null {
	const label = (id: string): string => content?.mandates[id]?.label ?? id;
	const active = activeMandates(mandates);
	if (active.some((mandate) => mandate.mandateId === mandateId)) {
		return `Vous exercez déjà : ${label(mandateId)}.`;
	}
	const missing = (institutions.prerequisites[mandateId] ?? []).find(
		(required) => !active.some((mandate) => mandate.mandateId === required)
	);
	if (missing) return `Il faut d’abord exercer : ${label(missing)}.`;
	const conflicts = conflictingMandates(mandateId, mandates, institutions);
	if (conflicts.length > 0 && !replaceIncompatible) {
		return `Incompatible avec : ${conflicts.map((mandate) => label(mandate.mandateId)).join(', ')}.`;
	}
	const remaining = active.length - (replaceIncompatible ? conflicts.length : 0);
	if (remaining + 1 > institutions.maxMandates) {
		return `Cumul limité à ${institutions.maxMandates} mandats.`;
	}
	return null;
}

function endMandates(
	mandates: readonly MandateInstance[],
	shouldEnd: (mandate: MandateInstance) => boolean,
	reason: MandateEndReason,
	turn: Turn
): { mandates: MandateInstance[]; changes: PoliticalChange[] } {
	const changes: PoliticalChange[] = [];
	const updated = mandates.map((mandate) => {
		if (mandate.status !== 'active' || !shouldEnd(mandate)) return mandate;
		changes.push({
			kind: 'mandateEnded',
			instanceId: mandate.instanceId,
			mandateId: mandate.mandateId,
			reason
		});
		return { ...mandate, status: 'ended' as const, endTurn: turn, endReason: reason };
	});
	return { mandates: updated, changes };
}

/** Effets de carrière (mandats et élections anticipées), déterministes. */
export type CareerEffect = Extract<
	Effect,
	{ op: 'grantMandate' | 'endMandate' | 'callEarlyElection' }
>;

export function isCareerEffect(effect: Effect): effect is CareerEffect {
	return (
		effect.op === 'grantMandate' || effect.op === 'endMandate' || effect.op === 'callEarlyElection'
	);
}

export interface CareerParts {
	readonly mandates: readonly MandateInstance[];
	readonly ballots: readonly Ballot[];
	readonly institutions: InstitutionsState;
}

/**
 * Applique un effet de carrière. Une attribution impossible (déjà exercé,
 * prérequis, incompatibilité sans remplacement, cumul) n'a aucun effet : les
 * choix concernés sont rendus indisponibles en amont (`careerEffectIssue`).
 * `target` est l'exemplaire de mandat choisi dans le plan.
 */
export function applyCareerEffect(
	effect: CareerEffect,
	parts: CareerParts,
	turn: Turn,
	target: string | null,
	content: Content
): { parts: CareerParts; changes: PoliticalChange[] } {
	switch (effect.op) {
		case 'grantMandate': {
			const replace = effect.replaceIncompatible === true;
			if (holdIssue(effect.mandate, parts.mandates, parts.institutions, content, replace)) {
				return { parts, changes: [] };
			}
			const ended = replace
				? endMandates(
						parts.mandates,
						(mandate) => incompatible(parts.institutions, mandate.mandateId, effect.mandate),
						'replaced',
						turn
					)
				: { mandates: [...parts.mandates], changes: [] };
			const instance: MandateInstance = {
				instanceId: termId(parts.mandates.length + 1),
				mandateId: effect.mandate,
				startTurn: turn,
				access: content.mandates[effect.mandate]?.election ? 'election' : 'nomination',
				status: 'active',
				endTurn: null,
				endReason: null
			};
			return {
				parts: { ...parts, mandates: [...ended.mandates, instance] },
				changes: [
					...ended.changes,
					{ kind: 'mandateStarted', instanceId: instance.instanceId, mandateId: effect.mandate }
				]
			};
		}
		case 'endMandate': {
			const matches = (mandate: MandateInstance): boolean =>
				effect.mandate === 'target'
					? mandate.instanceId === target
					: mandate.mandateId === effect.mandate;
			const ended = endMandates(
				parts.mandates,
				matches,
				effect.mandate === 'target' ? 'resigned' : 'removed',
				turn
			);
			// Qui perd un prérequis perd aussi le mandat qui en dépend (pas de maire sans siège).
			const dependants = endMandates(
				ended.mandates,
				(mandate) =>
					(parts.institutions.prerequisites[mandate.mandateId] ?? []).some(
						(required) =>
							!ended.mandates.some(
								(other) => other.status === 'active' && other.mandateId === required
							)
					),
				'removed',
				turn
			);
			return {
				parts: { ...parts, mandates: dependants.mandates },
				changes: [...ended.changes, ...dependants.changes]
			};
		}
		case 'callEarlyElection': {
			const definition = content.elections[effect.election];
			if (!definition) throw new Error(`Élection inconnue : ${effect.election}`);
			const regular = scheduledBallot(parts.ballots, effect.election);
			const early = turn + effect.delayTurns;
			// Une échéance régulière déjà plus proche n'est pas avancée.
			if (regular && regular.turn <= early) return { parts, changes: [] };
			const ballots = parts.ballots.map((ballot) =>
				ballot === regular
					? { ...ballot, status: 'cancelled' as const, cancelReason: 'Élection anticipée.' }
					: ballot
			);
			const ballot = newBallot(ballots, effect.election, early, true, content);
			return {
				parts: {
					...parts,
					ballots: [
						...ballots,
						{ ...ballot, filingClosesTurn: Math.max(turn, ballot.filingClosesTurn) }
					]
				},
				changes: [
					{
						kind: 'earlyElection',
						ballotId: ballot.ballotId,
						electionId: effect.election,
						turn: early
					}
				]
			};
		}
		default: {
			const unknown: never = effect;
			throw new Error(`Effet de carrière inconnu : ${JSON.stringify(unknown)}`);
		}
	}
}

/** Raison pour laquelle un effet de carrière d'un choix ne peut s'appliquer, ou `null`. */
export function careerEffectIssue(
	effect: Effect,
	parts: CareerParts,
	content: Content | null
): string | null {
	if (effect.op !== 'grantMandate') return null;
	return holdIssue(
		effect.mandate,
		parts.mandates,
		parts.institutions,
		content,
		effect.replaceIncompatible === true
	);
}

// ---------------------------------------------------------------------------
// Revenus des mandats (étape 3)
// ---------------------------------------------------------------------------

/** Revenus et stress du trimestre `turn` pour les mandats en cours depuis au moins ce trimestre. */
export function mandateIncome(
	mandates: readonly MandateInstance[],
	turn: Turn,
	content: Content
): { income: ResourceAmount[]; stress: number } {
	const totals = new Map<ResourceAmount['resource'], number>();
	let stress = 0;
	for (const mandate of activeMandates(mandates)) {
		if (mandate.startTurn > turn) continue;
		const definition = content.mandates[mandate.mandateId];
		if (!definition) continue;
		for (const amount of definition.income) {
			totals.set(amount.resource, (totals.get(amount.resource) ?? 0) + amount.amount);
		}
		stress += definition.stressPerTurn;
	}
	return {
		income: [...totals.entries()].map(([resource, amount]) => ({ resource, amount })),
		stress
	};
}

// ---------------------------------------------------------------------------
// Échéances (étape 5)
// ---------------------------------------------------------------------------

/** Répartit 100 points entre des poids positifs (plus forts restes, ordre stable). */
function percentages(weights: readonly { partyId: string; weight: number }[]): BallotShare[] {
	const total = weights.reduce((sum, entry) => sum + entry.weight, 0);
	const raw = weights.map((entry, index) => {
		const exact = (entry.weight * 100) / total;
		return { partyId: entry.partyId, floor: Math.floor(exact), rest: exact % 1, index };
	});
	let missing = 100 - raw.reduce((sum, entry) => sum + entry.floor, 0);
	const byRest = [...raw].sort((a, b) => b.rest - a.rest || a.index - b.index);
	const bonus = new Set<number>();
	for (const entry of byRest) {
		if (missing <= 0) break;
		bonus.add(entry.index);
		missing -= 1;
	}
	return raw
		.map((entry) => ({
			partyId: entry.partyId,
			percent: entry.floor + (bonus.has(entry.index) ? 1 : 0)
		}))
		.sort(
			(a, b) =>
				b.percent - a.percent ||
				raw.findIndex((r) => r.partyId === a.partyId) -
					raw.findIndex((r) => r.partyId === b.partyId)
		);
}

export interface FrontierDeadlines {
	readonly world: WorldState;
	readonly mandates: readonly MandateInstance[];
	readonly ballots: readonly Ballot[];
	readonly rng: RngState;
	readonly record: DeadlinesRecord;
}

/**
 * Échéances de la fin du trimestre `turn` (T), dans un ordre fixe : fins de
 * mandats liées aux scrutins du trimestre, puis scrutins dans l'ordre du
 * catalogue, puis programmation des échéances suivantes. Un changement de
 * gouvernement met fin aux mandats qui en dépendent.
 */
export function resolveDeadlines(
	world: WorldState,
	mandates: readonly MandateInstance[],
	ballots: readonly Ballot[],
	turn: Turn,
	rng: RngState,
	content: Content
): FrontierDeadlines {
	const due = content.electionIds.flatMap((electionId) => {
		const ballot = ballots.find(
			(entry) =>
				entry.electionId === electionId && entry.status === 'scheduled' && entry.turn === turn
		);
		return ballot ? [ballot] : [];
	});
	if (due.length === 0) {
		return { world, mandates, ballots, rng, record: { mandates: [], ballots: [] } };
	}

	const balance = content.balance.elections;
	const { minPartyStrength, maxPartyStrength } = content.balance.world;
	let currentWorld = world;
	let currentRng = rng;
	let currentBallots = [...ballots];
	const mandateChanges: PoliticalChange[] = [];

	// 1. Fins de mandats : un mandat arrive à terme au scrutin de son élection.
	const dueElections = new Set(due.map((ballot) => ballot.electionId));
	const terms = endMandates(
		mandates,
		(mandate) => dueElections.has(content.mandates[mandate.mandateId]?.election ?? ''),
		'term',
		turn
	);
	let currentMandates = terms.mandates;
	mandateChanges.push(...terms.changes);

	// 2. Scrutins.
	const ballotRecords: DeadlinesRecord['ballots'][number][] = [];
	for (const ballot of due) {
		const definition = content.elections[ballot.electionId]!;
		const weights = content.partyIds.map((partyId) => {
			const strength = currentWorld.parties[partyId]?.strength ?? minPartyStrength;
			let noise = 0;
			if (balance.voteVolatility > 0) {
				const draw = nextInt(currentRng, -balance.voteVolatility, balance.voteVolatility);
				currentRng = draw.rng;
				noise = draw.value;
			}
			return { partyId, weight: Math.max(1, strength + noise) };
		});
		const shares = percentages(weights);
		const winnerPartyId = shares[0]!.partyId;
		const governingBefore = currentWorld.governingPartyId;

		const parties = { ...currentWorld.parties };
		const shift = (partyId: string, delta: number): void => {
			const party = parties[partyId];
			if (!party || delta === 0) return;
			parties[partyId] = {
				...party,
				strength: Math.min(maxPartyStrength, Math.max(minPartyStrength, party.strength + delta))
			};
		};
		shift(winnerPartyId, balance.momentum);
		let governingAfter = governingBefore;
		let stability = currentWorld.indicators.stability;
		if (definition.decidesGovernment) {
			if (winnerPartyId !== governingBefore) {
				governingAfter = winnerPartyId;
				stability = Math.min(GAUGE_MAX, Math.max(GAUGE_MIN, balance.newGovernmentStability));
			}
		} else if (winnerPartyId !== governingBefore) {
			// Élection intermédiaire perdue : le gouvernement en paie le prix.
			shift(governingBefore, -balance.momentum);
		}
		currentWorld = {
			...currentWorld,
			parties,
			governingPartyId: governingAfter,
			indicators: { ...currentWorld.indicators, stability }
		};
		if (governingAfter !== governingBefore) {
			const fallen = endMandates(
				currentMandates,
				(mandate) => content.mandates[mandate.mandateId]?.endsWithGovernment === true,
				'government_change',
				turn
			);
			currentMandates = fallen.mandates;
			mandateChanges.push(...fallen.changes);
		}

		// Scrutin tenu, puis échéance suivante un cycle plus tard.
		currentBallots = currentBallots.map((entry) =>
			entry.ballotId === ballot.ballotId
				? { ...entry, status: 'held' as const, shares, winnerPartyId }
				: entry
		);
		currentBallots.push(
			newBallot(currentBallots, ballot.electionId, turn + definition.cycleTurns, false, content)
		);
		ballotRecords.push({
			ballotId: ballot.ballotId,
			electionId: ballot.electionId,
			winnerPartyId,
			governingBefore,
			governingAfter
		});
	}

	return {
		world: currentWorld,
		mandates: currentMandates,
		ballots: currentBallots,
		rng: currentRng,
		record: { mandates: mandateChanges, ballots: ballotRecords }
	};
}
