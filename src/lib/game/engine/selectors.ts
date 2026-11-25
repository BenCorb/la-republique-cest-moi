/**
 * Calculs dérivés purs (ARCHITECTURE.md §4.1) : jamais stockés dans l'état, ils
 * se recalculent depuis l'état et son journal.
 */
import type { Resources } from '../content/types.ts';
import { ageAt, type Turn } from './calendar.ts';
import type { DeathCause, GameState, HistoryEntry } from './state.ts';
import { divertedFunds } from './justice.ts';

/** Cause de fin de carrière : décès, ou prison ferme (P3-01). */
export type EndCause = DeathCause | 'prison';

/** Bilan minimal de carrière (enrichi par le bilan de fin, P1-08 puis V1). */
export interface CareerSummary {
	readonly ended: boolean;
	readonly cause: EndCause | null;
	/** Dossiers judiciaires ouverts au cours de la carrière, et condamnations définitives. */
	readonly cases: number;
	readonly convictions: number;
	/** Fonds détournés cumulés, en centimes (GDD §12). */
	readonly divertedCents: number;
	/** Trimestre de fin, ou trimestre courant si la carrière continue. */
	readonly lastTurn: Turn;
	readonly age: number;
	readonly quartersPlayed: number;
	readonly resources: Resources;
	readonly upgradesOwned: number;
	readonly actionsPerformed: number;
	readonly purchases: number;
	/** Trimestres où au moins un exemplaire a été suspendu faute de trésorerie. */
	readonly quartersWithSuspension: number;
	/** Événements vécus : informatifs appliqués et décisions prises. */
	readonly eventsExperienced: number;
}

export function careerSummary(state: GameState): CareerSummary {
	const lastTurn = state.end ? state.end.turn : state.turn;
	const quarters = state.history.filter(
		(entry): entry is HistoryEntry => entry.type === 'turn.resolved'
	);
	const steps = quarters.flatMap((entry) => entry.steps);
	const applied = quarters
		.flatMap((entry) => entry.events)
		.filter((event) => event.outcome === 'applied');
	const decisions = state.history.filter((entry) => entry.type === 'event.resolved');
	return {
		ended: state.end !== null,
		cause: state.end ? (state.end.reason === 'prison' ? 'prison' : state.end.cause) : null,
		cases: state.cases.filter((entry) => entry.defendantId === null).length,
		convictions: state.cases.filter(
			(entry) => entry.defendantId === null && entry.outcome === 'convicted'
		).length,
		divertedCents: divertedFunds(state.facts),
		lastTurn,
		age: ageAt(state.player.birthTurn, lastTurn),
		quartersPlayed: quarters.length,
		resources: state.resources,
		upgradesOwned: state.upgrades.length,
		actionsPerformed: steps.filter((step) => step.kind === 'action').length,
		purchases: steps.filter((step) => step.kind === 'purchase').length,
		quartersWithSuspension: quarters.filter((entry) =>
			entry.economy.producers.some((producer) => producer.status === 'suspended')
		).length,
		eventsExperienced: applied.length + decisions.length
	};
}
