/**
 * Commandes du moteur et résultats de transition (ARCHITECTURE.md §5).
 *
 * Les commandes sont des unions discriminées. P1-01 ne définit que la validation
 * d'un trimestre ; `chooseEvent` arrive avec le moteur d'événements (P1-05).
 */
import type { Turn } from './calendar.ts';
import type { GameState, HistoryEntry } from './state.ts';

/** Action planifiée, référencée par l'identifiant d'une définition du catalogue (P1-02). */
export interface PlannedAction {
	readonly actionId: string;
}

export interface TurnPlan {
	readonly actions: readonly PlannedAction[];
}

export interface CommitTurnCommand {
	readonly type: 'commitTurn';
	readonly plan: TurnPlan;
}

export type GameCommand = CommitTurnCommand;

export type CommandErrorCode =
	| 'game_ended'
	| 'decision_pending'
	| 'invalid_phase'
	| 'unknown_command'
	| 'invalid_plan'
	| 'unknown_action';

export interface CommandError {
	readonly code: CommandErrorCode;
	/** Message lisible en français, destiné à l'interface. */
	readonly message: string;
}

export interface TransitionSuccess {
	readonly ok: true;
	readonly state: GameState;
	/** Trimestre résolu par cette transition. */
	readonly resolvedTurn: Turn;
	/** Entrées ajoutées au journal par cette transition. */
	readonly log: readonly HistoryEntry[];
}

export interface TransitionFailure {
	readonly ok: false;
	/** État d'entrée, inchangé (même référence). */
	readonly state: GameState;
	readonly error: CommandError;
}

export type TransitionResult = TransitionSuccess | TransitionFailure;

export function commitTurn(plan: TurnPlan = { actions: [] }): CommitTurnCommand {
	return { type: 'commitTurn', plan };
}
