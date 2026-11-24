/**
 * Transition d'état (ARCHITECTURE.md §5) : fonction pure, sans effet sur ses
 * arguments. Une commande rejetée renvoie l'état d'entrée inchangé, PRNG compris.
 *
 * Ordre de résolution d'un trimestre (§5.1). En P1-01, seules les étapes 1 et 6–7
 * existent ; les autres sont ajoutées par les tâches qui les introduisent :
 *   1. validation de la phase et du plan ........................ P1-01, P1-02
 *   2. actions planifiées, achats et recrutements ............... P1-02, P1-03
 *   3. production, revenus, charges ............................. P1-03
 *   4. stress, santé, vieillissement, fins ...................... P1-04
 *   5. échéances ................................................ alpha
 *   6. passage à T+1 (une seule fois) et journal du trimestre T . P1-01 ; événements P1-05
 *   7. phase `decision` si choix bloquant, sinon `planning` ..... P1-01 ; P1-05
 */
import type { CommandError, CommitTurnCommand, GameCommand, TransitionResult } from './commands.ts';
import type { GameState, HistoryEntry } from './state.ts';

function reject(state: GameState, error: CommandError): TransitionResult {
	return { ok: false, state, error };
}

function validateCommitTurn(state: GameState, command: CommitTurnCommand): CommandError | null {
	switch (state.phase) {
		case 'planning':
			break;
		case 'ended':
			return { code: 'game_ended', message: 'La carrière est terminée.' };
		case 'decision':
			return {
				code: 'decision_pending',
				message: 'Une décision doit être prise avant de passer au trimestre suivant.'
			};
		default:
			return { code: 'invalid_phase', message: 'La partie est dans une phase inconnue.' };
	}

	const actions: unknown = command.plan?.actions;
	if (!Array.isArray(actions)) {
		return { code: 'invalid_plan', message: 'Le plan du trimestre est mal formé.' };
	}
	// Aucun catalogue d'actions avant P1-02 : seul un plan vide est valide.
	if (actions.length > 0) {
		const actionId = (actions[0] as { actionId?: unknown } | null)?.actionId;
		return {
			code: 'unknown_action',
			message: `Action inconnue : ${typeof actionId === 'string' ? actionId : '(sans identifiant)'}.`
		};
	}
	return null;
}

function resolveCommitTurn(state: GameState): TransitionResult {
	const resolvedTurn = state.turn;
	const entry: HistoryEntry = { type: 'turn.resolved', turn: resolvedTurn };
	return {
		ok: true,
		state: {
			...state,
			turn: resolvedTurn + 1,
			phase: 'planning',
			history: [...state.history, entry]
		},
		resolvedTurn,
		log: [entry]
	};
}

export function transition(state: GameState, command: GameCommand): TransitionResult {
	switch (command.type) {
		case 'commitTurn': {
			const error = validateCommitTurn(state, command);
			return error ? reject(state, error) : resolveCommitTurn(state);
		}
		default:
			return reject(state, {
				code: 'unknown_command',
				message: `Commande inconnue : ${String((command as { type?: unknown }).type)}.`
			});
	}
}
