/**
 * Transition d'état (ARCHITECTURE.md §5) : fonction pure, sans effet sur ses
 * arguments. Une commande rejetée renvoie l'état d'entrée inchangé, PRNG compris.
 *
 * Ordre de résolution d'un trimestre (§5.1) et tâches qui le complètent :
 *   1. validation de la phase et du plan ........................ P1-01, P1-02
 *   2. étapes du plan dans l'ordre (actions, achats) ............ P1-02, P1-03
 *   3. charges puis production des améliorations actives ........ P1-03
 *   4. stress, santé, vieillissement, décès ..................... P1-04
 *      puis vieillissement et départs des personnages ........... P2-04
 *      puis évolution autonome du monde (indicateurs, partis) ... P2-01
 *   3 bis. revenus et stress des mandats ......................... P2-02
 *   5. échéances : fins de mandat, scrutins, calendrier ........... P2-02
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
import { resolveCharacters } from './characters.ts';
import { mandateIncome, reservedTime, resolveDeadlines } from './career.ts';
import { applyGauge } from './effects.ts';
import { RESOURCE_IDS, type ResourceId } from '../content/types.ts';
import { resolveWorld } from './world.ts';
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

	// 3 bis. Revenus et stress des mandats exercés pendant T (démissions du plan comprises).
	const mandates = mandateIncome(execution.career.mandates, resolvedTurn, content);
	const afterMandates: Record<ResourceId, number> = { ...economy.resources };
	for (const amount of mandates.income) afterMandates[amount.resource] += amount.amount;
	const stressed = applyGauge(execution.player.stress, mandates.stress);
	const mandateRecord = {
		changes: RESOURCE_IDS.flatMap((resource) => {
			const amount = mandates.income.find((entry) => entry.resource === resource)?.amount ?? 0;
			return amount === 0 ? [] : [{ resource, delta: amount }];
		}),
		stress: stressed.applied
	};

	// 4. Stress, santé, vieillissement et décès à la frontière T/T+1. Le temps
	// réservé par les mandats (en début de trimestre) compte dans la charge.
	const wellbeing = resolveWellbeing(
		{ ...execution.player, stress: stressed.value },
		execution.timeUsed + reservedTime(state.mandates, content),
		resolvedTurn,
		execution.rng,
		content.balance.wellbeing
	);
	const nextTurn = resolvedTurn + 1;

	// 4 bis. Personnages puis monde (sauf décès) : ils évoluent même si le joueur ne fait rien.
	const people = wellbeing.record.deathCause
		? null
		: resolveCharacters(state.characters, nextTurn, wellbeing.rng, content);
	const world = people
		? resolveWorld(execution.world, people.characters, nextTurn, people.rng, content)
		: null;

	// 5. Échéances de la fin de T : fins de mandat, scrutins, échéances suivantes.
	const deadlines = world
		? resolveDeadlines(
				world.world,
				execution.career.mandates,
				execution.career.ballots,
				resolvedTurn,
				world.rng,
				content
			)
		: null;

	// 6. Passage à T+1, puis suites dues et tirage des événements (sauf décès en 4).
	const frontier = world
		? resolveEventFrontier(
				{
					turn: nextTurn,
					player: wellbeing.player,
					resources: afterMandates,
					upgrades: execution.upgrades,
					rng: deadlines!.rng,
					nextInstanceNumber: execution.nextInstanceNumber,
					events: state.events,
					world: deadlines!.world,
					characters: world.characters,
					relationships: state.relationships,
					career: {
						mandates: deadlines!.mandates,
						ballots: deadlines!.ballots,
						institutions: execution.career.institutions
					}
				},
				content
			)
		: null;

	const entry: HistoryEntry = {
		type: 'turn.resolved',
		turn: resolvedTurn,
		steps: execution.records,
		economy: { producers: economyRecords(economy), changes: economy.changes },
		mandates: mandateRecord,
		wellbeing: wellbeing.record,
		characters: people?.record ?? null,
		world: world?.record ?? null,
		deadlines: deadlines?.record ?? null,
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
			resources: frontier?.resources ?? afterMandates,
			world: frontier?.world ?? execution.world,
			characters: frontier?.characters ?? state.characters,
			relationships: frontier?.relationships ?? state.relationships,
			mandates: frontier?.career.mandates ?? execution.career.mandates,
			ballots: frontier?.career.ballots ?? execution.career.ballots,
			institutions: frontier?.career.institutions ?? execution.career.institutions,
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
