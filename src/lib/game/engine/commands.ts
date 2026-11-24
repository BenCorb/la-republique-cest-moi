/**
 * Commandes du moteur et résultats de transition (ARCHITECTURE.md §5).
 *
 * Les commandes sont des unions discriminées : valider un trimestre, choisir la
 * réponse à l'événement bloquant en tête de file.
 */
import type { PlanIssue } from './plan.ts';
import type { GameState, JournalEntry } from './state.ts';

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

export interface ChooseEventCommand {
	readonly type: 'chooseEvent';
	readonly instanceId: string;
	readonly choiceId: string;
}

export type GameCommand = CommitTurnCommand | ChooseEventCommand;

export type CommandErrorCode =
	| 'game_ended'
	| 'decision_pending'
	| 'invalid_phase'
	| 'unknown_command'
	| 'invalid_plan'
	| 'no_pending_decision'
	| 'unknown_event_instance'
	| 'not_next_event'
	| 'unknown_choice'
	| 'choice_unavailable';

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
	/** Entrées ajoutées au journal par cette transition. */
	readonly log: readonly JournalEntry[];
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

export function chooseEventCommand(instanceId: string, choiceId: string): ChooseEventCommand {
	return { type: 'chooseEvent', instanceId, choiceId };
}
