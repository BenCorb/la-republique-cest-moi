/**
 * Calculs dérivés purs (ARCHITECTURE.md §4.1) : jamais stockés dans l'état, ils
 * se recalculent depuis l'état et son journal.
 */
import type { Resources } from '../content/types.ts';
import { ageAt, type Turn } from './calendar.ts';
import type { DeathCause, GameState, HistoryEntry } from './state.ts';

/** Bilan minimal de carrière (enrichi par le bilan de fin, P1-08 puis V1). */
export interface CareerSummary {
	readonly ended: boolean;
	readonly cause: DeathCause | null;
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
		cause: state.end?.cause ?? null,
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
