/**
 * Transition d'état (ARCHITECTURE.md §5) : fonction pure, sans effet sur ses
 * arguments. Une commande rejetée renvoie l'état d'entrée inchangé, PRNG compris.
 *
 * Ordre de résolution d'un trimestre (§5.1) et tâches qui le complètent :
 *   1. validation de la phase et du plan ........................ P1-01, P1-02
 *   2. étapes du plan dans l'ordre (actions, achats) ............ P1-02, P1-03
 *   3. charges puis production des améliorations actives ........ P1-03
 *   4. stress, santé, vieillissement, décès ..................... P1-04
 *   5. échéances ................................................ alpha
 *   6. passage à T+1 (une seule fois), journal du trimestre T,
 *      suites dues et tirage des événements ......................... P1-01, P1-05
 *   7. phase `decision` si un choix bloquant attend, sinon `planning`  P1-01, P1-05
 *
 * Fin de partie : un décès à l'étape 4 clôt la carrière au trimestre T (`end.turn
 * = T`) ; aucun événement n'est tiré. Un décès causé par un événement de la
 * frontière est daté de T+1. Le compteur passe toujours à T+1 pour clore T, et
 * toute commande est ensuite refusée. `chooseEvent` est traité dans `events.ts`.
 */
import type { Content } from '../content/types.ts';
import { economyRecords, resolveEconomy } from './economy.ts';
import { chooseEvent, resolveEventFrontier } from './events.ts';
import { resolveWellbeing } from './health.ts';
import { executePlan, previewPlan } from './plan.ts';
import type { CommandError, CommitTurnCommand, GameCommand, TransitionResult } from './commands.ts';
import type { EndState, GameState, HistoryEntry } from './state.ts';

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

	// 2. Étapes dans l'ordre annoncé ; effets aléatoires tirés ici, achats en attente.
	const execution = executePlan(state, command.plan.steps, content);

	// 3. Charges puis production des améliorations acquises avant T.
	const resolvedTurn = state.turn;
	const economy = resolveEconomy(execution.resources, execution.upgrades, resolvedTurn, content);

	// 4. Stress, santé, vieillissement et décès à la frontière T/T+1.
	const wellbeing = resolveWellbeing(
		execution.player,
		execution.timeUsed,
		resolvedTurn,
		execution.rng,
		content.balance.wellbeing
	);
	const nextTurn = resolvedTurn + 1;

	// 6. Passage à T+1, puis suites dues et tirage des événements (sauf décès en 4).
	const frontier = wellbeing.record.deathCause
		? null
		: resolveEventFrontier(
				{
					turn: nextTurn,
					player: wellbeing.player,
					resources: economy.resources,
					upgrades: execution.upgrades,
					rng: wellbeing.rng,
					nextInstanceNumber: execution.nextInstanceNumber,
					events: state.events
				},
				content
			);

	const entry: HistoryEntry = {
		type: 'turn.resolved',
		turn: resolvedTurn,
		steps: execution.records,
		economy: { producers: economyRecords(economy), changes: economy.changes },
		wellbeing: wellbeing.record,
		events: frontier?.records ?? []
	};

	// 7. Phase suivante.
	const end: EndState | null = wellbeing.record.deathCause
		? { turn: resolvedTurn, reason: 'death', cause: wellbeing.record.deathCause }
		: frontier?.deathCause
			? { turn: nextTurn, reason: 'death', cause: frontier.deathCause }
			: null;
	const events = frontier?.events ?? { ...state.events, pending: [], scheduled: [] };
	return {
		ok: true,
		state: {
			...state,
			turn: nextTurn,
			phase: end ? 'ended' : events.pending.length > 0 ? 'decision' : 'planning',
			end,
			rng: frontier?.rng ?? wellbeing.rng,
			player: frontier?.player ?? wellbeing.player,
			resources: frontier?.resources ?? economy.resources,
			upgrades: execution.upgrades,
			nextInstanceNumber: frontier?.nextInstanceNumber ?? execution.nextInstanceNumber,
			events,
			history: [...state.history, entry]
		},
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
		case 'chooseEvent':
			return chooseEvent(state, command, content);
		default:
			return reject(state, {
				code: 'unknown_command',
				message: `Commande inconnue : ${String((command as { type?: unknown }).type)}.`,
				issues: []
			});
	}
}
