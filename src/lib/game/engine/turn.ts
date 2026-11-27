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
 *      puis entourage et famille (départs, héritage, dépenses) .. P2-05, P2-08
 *      puis retour des soutiens vers leur référence ............. P2-07
 *   3 bis. revenus et stress des mandats ......................... P2-02
 *   3 ter. salaires et missions de l'entourage ................... P2-05
 *   5. échéances : fins de mandat, scrutins, calendrier ........... P2-02
 *      puis justice, patrimoine et promesses ...................... P3-01, P3-02, P3-04
 *      puis fil de presse (articles, relations des médias) ........ P3-03
 *      puis réformes institutionnelles (votes, entrée en vigueur) . P3-05
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
import { resolveSupports } from './supports.ts';
import { resolveExposure, resolveJustice } from './justice.ts';
import { comfortStress, revalueAssets } from './wealth.ts';
import { resolvePromises } from './promises.ts';
import { resolvePress } from './press.ts';
import { effectiveContent, resolveReforms } from './reforms.ts';
import { resolveActivists } from './activists.ts';
import { resolveStaffFrontier, resolveStaffProduction } from './staff.ts';
import { resolveFamily } from './family.ts';
import type {
	AssignMissionCommand,
	CommandError,
	CommitTurnCommand,
	GameCommand,
	TransitionResult
} from './commands.ts';
import { missionIssue } from './staff.ts';
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
	catalog: Content
): TransitionResult {
	const blocked = phaseError(state);
	if (blocked) return reject(state, blocked);
	// Règles en vigueur pendant T : le catalogue modifié par les niveaux institutionnels (P3-05).
	const content = effectiveContent(catalog, state.institutions.parameters);

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
	const economy = resolveEconomy(
		execution.resources,
		execution.upgrades,
		resolvedTurn,
		content,
		execution.player.lifestyle
	);
	// Train de vie impayé : retour au plus sobre (P3-02).
	const householdPlayer = economy.lifestyle.unpaid
		? { ...execution.player, lifestyle: content.wealth.defaultLifestyle }
		: execution.player;

	// 3 bis. Revenus et stress des mandats exercés pendant T (démissions du plan comprises).
	const mandates = mandateIncome(execution.career.mandates, resolvedTurn, content);
	const afterMandates: Record<ResourceId, number> = { ...economy.resources };
	for (const amount of mandates.income) afterMandates[amount.resource] += amount.amount;
	const stressed = applyGauge(householdPlayer.stress, mandates.stress);
	const mandateRecord = {
		changes: RESOURCE_IDS.flatMap((resource) => {
			const amount = mandates.income.find((entry) => entry.resource === resource)?.amount ?? 0;
			return amount === 0 ? [] : [{ resource, delta: amount }];
		}),
		stress: stressed.applied
	};

	// 3 ter. Salaires puis missions des collaborateurs embauchés avant T.
	const production = resolveStaffProduction(
		{
			resources: afterMandates,
			player: { ...householdPlayer, stress: stressed.value },
			world: execution.world,
			career: execution.career,
			entourage: execution.entourage
		},
		resolvedTurn,
		content
	);

	// 4. Stress, santé, vieillissement et décès à la frontière T/T+1. Le temps
	// réservé par les mandats (en début de trimestre) compte dans la charge.
	const wellbeing = resolveWellbeing(
		production.player,
		execution.timeUsed + reservedTime(state.mandates, content),
		resolvedTurn,
		execution.rng,
		content.balance.wellbeing,
		comfortStress(economy, content)
	);
	const nextTurn = resolvedTurn + 1;

	// 4 bis. Personnages puis monde (sauf décès) : ils évoluent même si le joueur ne fait rien.
	const people = wellbeing.record.deathCause
		? null
		: resolveCharacters(production.entourage.characters, nextTurn, wellbeing.rng, content);
	const world = people
		? resolveWorld(production.world, people.characters, nextTurn, people.rng, content)
		: null;

	// 4 bis (suite). Entourage : départs, puis présélections pour les postes vacants.
	const team = world
		? resolveStaffFrontier(
				{ ...production.entourage, characters: world.characters },
				{
					turn: nextTurn,
					player: wellbeing.player,
					resources: production.resources,
					upgrades: execution.upgrades,
					world: world.world,
					mandates: production.career.mandates,
					campaigns: production.career.campaigns,
					institutions: production.career.institutions,
					staff: production.entourage.staff,
					facts: state.facts,
					cases: state.cases,
					promises: production.career.promises
				},
				nextTurn,
				world.rng,
				content
			)
		: null;

	// 4 bis (fin). Famille : héritage, veuvage, enfants à charge, disponibilité.
	// Recherches échouées ou annulées : une part du prix revient au budget politique (P3-21).
	const teamResources = team
		? {
				...production.resources,
				politicalBudgetCents: production.resources.politicalBudgetCents + team.refundCents
			}
		: production.resources;
	const family = team
		? resolveFamily(
				{
					player: wellbeing.player,
					characters: team.entourage.characters,
					relationships: team.entourage.relationships
				},
				teamResources,
				execution.timeUsed + reservedTime(state.mandates, content),
				nextTurn,
				content
			)
		: null;

	// 4 ter. Soutiens : retour partiel vers leur référence (parti, mandats en cours).
	const supports = family
		? resolveSupports(
				family.parts.player,
				production.career.mandates,
				production.resources.influence,
				content
			)
		: null;

	// 4 quater. Exposition médiatique : retour vers la référence des fonctions exercées.
	const exposure = supports
		? resolveExposure(
				supports.player,
				production.career.mandates,
				production.career.campaigns,
				content
			)
		: null;

	// 5. Échéances de la fin de T : fins de mandat, scrutins, échéances suivantes.
	const deadlines =
		world && exposure && team && family
			? resolveDeadlines(
					{
						world: world.world,
						player: exposure.player,
						resources: family.resources,
						characters: family.parts.characters,
						relationships: family.parts.relationships,
						career: production.career
					},
					resolvedTurn,
					team.rng,
					content
				)
			: null;

	// 5 bis. Justice : étapes échues des dossiers, révélations, usure de la défense.
	const justice = deadlines
		? resolveJustice(
				{
					player: deadlines.player,
					resources: deadlines.resources,
					world: deadlines.world,
					career: deadlines.career,
					entourage: {
						...team!.entourage,
						characters: deadlines.characters,
						relationships: deadlines.relationships
					},
					facts: state.facts,
					cases: state.cases,
					rng: deadlines.rng
				},
				resolvedTurn,
				content
			)
		: null;
	const settled = justice?.parts ?? null;

	// 5 ter. Patrimoine : réévaluation des actifs (tendance, conjoncture, aléa).
	const wealth =
		settled && !justice!.end
			? revalueAssets(execution.upgrades, settled.world, resolvedTurn, settled.rng, content)
			: null;

	// 5 quater. Promesses : élus ou battus, échéances de réalisation, rappels en campagne.
	const pledges =
		settled && wealth
			? resolvePromises(
					{
						player: settled.player,
						resources: settled.resources,
						world: settled.world,
						career: settled.career,
						rng: wealth.rng
					},
					resolvedTurn,
					content,
					state.events.occurrences,
					state.events.scheduled
				)
			: null;

	// 5 quinquies. Fil de presse : articles du trimestre, retour des relations des médias.
	const press = pledges
		? resolvePress(
				{ player: pledges.parts.player, world: pledges.parts.world, rng: pledges.parts.rng },
				{
					turn: resolvedTurn,
					upgrades: wealth!.upgrades,
					mandates: pledges.parts.career.mandates,
					campaigns: pledges.parts.career.campaigns,
					ballots: pledges.parts.career.ballots,
					cases: settled!.cases,
					justice: justice!.record,
					promises: pledges.record
				},
				content
			)
		: null;

	// 5 sexies. Réformes institutionnelles : votes, réforme du gouvernement, entrée en vigueur.
	const reforms =
		pledges && press
			? resolveReforms(
					{
						player: press.parts.player,
						resources: pledges.parts.resources,
						world: press.parts.world,
						career: pledges.parts.career,
						rng: press.parts.rng
					},
					resolvedTurn,
					content
				)
			: null;

	// 5 septies. Base militante : arrivées, recrues d'un scrutin, départs, cotisations et frais.
	const activists = reforms
		? resolveActivists(
				reforms.parts.player,
				reforms.parts.resources,
				{
					turn: resolvedTurn,
					upgrades: wealth!.upgrades,
					mandates: reforms.parts.career.mandates,
					campaigns: reforms.parts.career.campaigns,
					deadlines: deadlines?.record ?? null
				},
				content
			)
		: null;

	// 6. Passage à T+1, puis suites dues et tirage des événements (sauf fin de carrière).
	const frontier =
		settled && pledges && reforms && activists
			? resolveEventFrontier(
					{
						turn: nextTurn,
						player: activists.player,
						resources: activists.resources,
						upgrades: wealth!.upgrades,
						rng: reforms.parts.rng,
						nextInstanceNumber: execution.nextInstanceNumber,
						events: {
							...state.events,
							scheduled: [
								...state.events.scheduled,
								...justice!.scheduled,
								...pledges.scheduled,
								...team!.scheduled,
								// Investiture refusée (P3-30) : renoncer ou se présenter en dissident, au début de T+1.
								...(deadlines?.record.investitures ?? [])
									.filter((entry) => !entry.granted)
									.map((entry) => ({
										eventId: content.balance.campaigns.investiture.refusedEvent,
										dueTurn: nextTurn,
										sourceInstanceId: entry.requestId,
										actors: {}
									})),
								// Second tour en attente (P3-29) : décision au début de T+1.
								...(deadlines?.record.runoffs ?? []).map((campaignIdValue) => ({
									eventId: content.balance.elections.contests.runoffEvent,
									dueTurn: nextTurn,
									sourceInstanceId: campaignIdValue,
									actors: {}
								}))
							]
						},
						world: reforms.parts.world,
						characters: settled.entourage.characters,
						relationships: settled.entourage.relationships,
						career: reforms.parts.career,
						staff: settled.entourage.staff,
						shortlists: settled.entourage.shortlists,
						facts: settled.facts,
						cases: settled.cases
					},
					content
				)
			: null;

	const finalPlayer = frontier?.player ?? settled?.player ?? wellbeing.player;
	const finalResources = frontier?.resources ?? settled?.resources ?? production.resources;
	const entry: HistoryEntry = {
		type: 'turn.resolved',
		turn: resolvedTurn,
		steps: execution.records,
		economy: {
			lifestyle: economy.lifestyle,
			producers: economyRecords(economy),
			changes: economy.changes
		},
		mandates: mandateRecord,
		family: family?.record ?? null,
		staff: {
			...production.record,
			departures: team?.record.departures ?? [],
			shortlisted: team?.record.shortlisted ?? [],
			counterLapsed: team?.record.counterLapsed ?? [],
			searches: team?.record.searches ?? [],
			raiseRequests: team?.record.raiseRequests ?? []
		},
		wellbeing: wellbeing.record,
		characters: people?.record ?? null,
		world: world?.record ?? null,
		supports: supports?.record ?? null,
		deadlines: deadlines?.record ?? null,
		exposure: exposure?.delta ?? null,
		justice: justice?.record ?? null,
		wealth: wealth?.record ?? null,
		promises: pledges?.record ?? null,
		press: press?.record ?? null,
		institutions: reforms?.record ?? null,
		activists: activists?.record ?? null,
		events: frontier?.records ?? [],
		snapshot: {
			...finalResources,
			popularity: finalPlayer.popularity,
			health: finalPlayer.health,
			stress: finalPlayer.stress,
			exposure: finalPlayer.exposure,
			activists: finalPlayer.activists
		}
	};

	// 7. Phase suivante.
	const end: EndState | null = wellbeing.record.deathCause
		? { turn: resolvedTurn, reason: 'death', cause: wellbeing.record.deathCause }
		: (justice?.end ??
			(frontier?.deathCause
				? { turn: nextTurn, reason: 'death', cause: frontier.deathCause }
				: null));
	const events = frontier?.events ?? { ...state.events, pending: [], scheduled: [] };
	return {
		ok: true,
		state: {
			...state,
			turn: nextTurn,
			phase: end ? 'ended' : events.pending.length > 0 ? 'decision' : 'planning',
			end,
			rng: frontier?.rng ?? wealth?.rng ?? settled?.rng ?? wellbeing.rng,
			player: finalPlayer,
			resources: finalResources,
			world: frontier?.world ?? settled?.world ?? production.world,
			characters:
				frontier?.characters ?? settled?.entourage.characters ?? production.entourage.characters,
			relationships:
				frontier?.relationships ??
				settled?.entourage.relationships ??
				production.entourage.relationships,
			staff: frontier?.staff ?? settled?.entourage.staff ?? production.entourage.staff,
			shortlists:
				frontier?.shortlists ?? settled?.entourage.shortlists ?? production.entourage.shortlists,
			searches:
				settled?.entourage.searches ?? team?.entourage.searches ?? production.entourage.searches,
			mandates: frontier?.career.mandates ?? settled?.career.mandates ?? production.career.mandates,
			ballots: frontier?.career.ballots ?? settled?.career.ballots ?? production.career.ballots,
			campaigns:
				frontier?.career.campaigns ?? settled?.career.campaigns ?? production.career.campaigns,
			institutions:
				frontier?.career.institutions ??
				settled?.career.institutions ??
				production.career.institutions,
			promises: frontier?.career.promises ?? settled?.career.promises ?? production.career.promises,
			investitures:
				frontier?.career.investitures ??
				settled?.career.investitures ??
				production.career.investitures,
			upgrades: wealth?.upgrades ?? execution.upgrades,
			facts: frontier?.facts ?? state.facts,
			cases: settled?.cases ?? state.cases,
			nextInstanceNumber: frontier?.nextInstanceNumber ?? execution.nextInstanceNumber,
			events,
			history: [...state.history, entry]
		},
		log: [entry]
	};
}

function assignMission(
	state: GameState,
	command: AssignMissionCommand,
	content: Content
): TransitionResult {
	const blocked = phaseError(state);
	if (blocked) return reject(state, blocked);
	const issue = missionIssue(state.staff, command.characterId, command.missionId, content);
	if (issue) return reject(state, { code: 'invalid_mission', message: issue, issues: [] });
	return {
		ok: true,
		state: {
			...state,
			staff: state.staff.map((member) =>
				member.status === 'active' && member.characterId === command.characterId
					? { ...member, missionId: command.missionId }
					: member
			)
		},
		log: []
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
		case 'assignMission':
			return assignMission(state, command, content);
		default:
			return reject(state, {
				code: 'unknown_command',
				message: `Commande inconnue : ${String((command as { type?: unknown }).type)}.`,
				issues: []
			});
	}
}
