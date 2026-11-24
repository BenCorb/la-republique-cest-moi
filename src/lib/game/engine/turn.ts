/**
 * Transition d'état (ARCHITECTURE.md §5) : fonction pure, sans effet sur ses
 * arguments. Une commande rejetée renvoie l'état d'entrée inchangé, PRNG compris.
 *
 * Ordre de résolution d'un trimestre (§5.1) et tâches qui le complètent :
 *   1. validation de la phase et du plan ........................ P1-01, P1-02
 *   2. actions planifiées dans l'ordre (coûts, effets) .......... P1-02 ; achats P1-03
 *   3. production, revenus, charges ............................. P1-03
 *   4. stress, santé, vieillissement, fins ...................... P1-04
 *   5. échéances ................................................ alpha
 *   6. passage à T+1 (une seule fois) et journal du trimestre T . P1-01 ; événements P1-05
 *   7. phase `decision` si choix bloquant, sinon `planning` ..... P1-01 ; P1-05
 */
import type { Content } from '../content/types.ts';
import { executePlan, previewPlan } from './actions.ts';
import type { CommandError, CommitTurnCommand, GameCommand, TransitionResult } from './commands.ts';
import type { GameState, HistoryEntry } from './state.ts';

function reject(state: GameState, error: CommandError): TransitionResult {
	return { ok: false, state, error };
}

function phaseError(state: GameState): CommandError | null {
	switch (state.phase) {
		case 'planning':
			return null;
		case 'ended':
			return { code: 'game_ended', message: 'La carrière est terminée.', issues: [] };
		case 'decision':
			return {
				code: 'decision_pending',
				message: 'Une décision doit être prise avant de passer au trimestre suivant.',
				issues: []
			};
		default:
			return {
				code: 'invalid_phase',
				message: 'La partie est dans une phase inconnue.',
				issues: []
			};
	}
}

function commitTurn(
	state: GameState,
	command: CommitTurnCommand,
	content: Content
): TransitionResult {
	const blocked = phaseError(state);
	if (blocked) return reject(state, blocked);

	// 1. Validation complète, identique à la prévision affichée au joueur.
	const preview = previewPlan(state, command.plan, content);
	if (!preview.valid) {
		return reject(state, {
			code: 'invalid_plan',
			message: 'Le plan du trimestre n’est pas valide.',
			issues: preview.issues
		});
	}

	// 2. Actions dans l'ordre annoncé ; les effets aléatoires sont tirés ici.
	const execution = executePlan(state.resources, state.rng, command.plan.actions, content);

	// 6–7. Passage à T+1 et journal du trimestre résolu.
	const resolvedTurn = state.turn;
	const entry: HistoryEntry = {
		type: 'turn.resolved',
		turn: resolvedTurn,
		actions: execution.records
	};
	return {
		ok: true,
		state: {
			...state,
			turn: resolvedTurn + 1,
			phase: 'planning',
			rng: execution.rng,
			resources: execution.resources,
			history: [...state.history, entry]
		},
		resolvedTurn,
		log: [entry]
	};
}

export function transition(
	state: GameState,
	command: GameCommand,
	content: Content
): TransitionResult {
	switch (command.type) {
		case 'commitTurn':
			return commitTurn(state, command, content);
		default:
			return reject(state, {
				code: 'unknown_command',
				message: `Commande inconnue : ${String((command as { type?: unknown }).type)}.`,
				issues: []
			});
	}
}
