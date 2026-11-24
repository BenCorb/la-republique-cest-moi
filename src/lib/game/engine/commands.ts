/**
 * Commandes du moteur et résultats de transition (ARCHITECTURE.md §5).
 *
 * Les commandes sont des unions discriminées. Seule la validation d'un trimestre
 * existe ; `chooseEvent` arrive avec le moteur d'événements (P1-05).
 */
import type { PlanIssue } from './plan.ts';
import type { Turn } from './calendar.ts';
import type { GameState, HistoryEntry } from './state.ts';

/** Étape d'un plan trimestriel : une action ou l'achat d'une amélioration. */
export type PlanStep =
	| { readonly kind: 'action'; readonly id: string }
	| { readonly kind: 'purchase'; readonly id: string };

/** Plan d'un trimestre : étapes exécutées dans l'ordre annoncé. */
export interface TurnPlan {
	readonly steps: readonly PlanStep[];
}

export interface CommitTurnCommand {
	readonly type: 'commitTurn';
	readonly plan: TurnPlan;
}

export type GameCommand = CommitTurnCommand;

export type CommandErrorCode =
	'game_ended' | 'decision_pending' | 'invalid_phase' | 'unknown_command' | 'invalid_plan';

export interface CommandError {
	readonly code: CommandErrorCode;
	/** Message lisible en français, destiné à l'interface. */
	readonly message: string;
	/** Problèmes détaillés d'un plan refusé (`invalid_plan`), vide sinon. */
	readonly issues: readonly PlanIssue[];
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

export function commitTurn(plan: TurnPlan = { steps: [] }): CommitTurnCommand {
	return { type: 'commitTurn', plan };
}
