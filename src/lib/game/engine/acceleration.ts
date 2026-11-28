/**
 * Accélération du calendrier (ARCHITECTURE.md §5.2, P1-09 puis P2-09).
 *
 * Cette fonction ne possède aucune transition propre : elle répète exclusivement
 * `transition(state, commitTurn(plan), content)`. Entre deux trimestres, le plan
 * est reporté selon la même règle qu'un tour manuel (`carryOverPlan`) : seules
 * les actions épinglées restent, et celles devenues impossibles sont retirées
 * avec leur motif (P3-11), sans interrompre la boucle. Les alertes déjà
 * visibles au lancement sont considérées comme reconnues ; une alerte qui
 * apparaît ensuite interrompt la boucle (échéance électorale à préparer,
 * résultat, mandat, départ d'un collaborateur, budget, santé), tout comme une
 * décision, une fin de carrière, un plan mal formé ou un plan, non vide au
 * lancement, devenu entièrement vide (`empty_plan`).
 */
import type { Content } from '../content/types.ts';
import { formatTurn } from './calendar.ts';
import { candidacyIssue, runningCampaigns } from './career.ts';
import { commitTurn, type PlanStep, type TurnPlan } from './commands.ts';
import { carryOverPlan, previewPlan, prunePlan, type PlanIssue, type PlanRemoval } from './plan.ts';
import type { CaseEventKind, GameState, HistoryEntry, PoliticalChange } from './state.ts';
import { transition } from './turn.ts';

export type AccelerationStopReason =
	'limit_reached' | 'decision_pending' | 'alert' | 'game_ended' | 'invalid_plan' | 'empty_plan';

/**
 * Origine d'une alerte : prévision du plan, santé, échéance électorale,
 * carrière (résultat, mandat), entourage ou finances.
 */
export type AccelerationAlertKind =
	'plan' | 'health' | 'deadline' | 'career' | 'staff' | 'finance' | 'justice';

export interface AccelerationAlert {
	readonly id: string;
	readonly kind: AccelerationAlertKind;
	readonly message: string;
}

export interface AccelerationRequest {
	readonly plan: TurnPlan;
	readonly maxTurns: number;
}

export interface AccelerationResult {
	readonly state: GameState;
	readonly turnsAdvanced: number;
	readonly stopReason: AccelerationStopReason;
	readonly alerts: readonly AccelerationAlert[];
	readonly issues: readonly PlanIssue[];
	/** Plan reporté après le dernier trimestre simulé. */
	readonly plan: TurnPlan;
	/** Étapes non reconduites en cours de route (ponctuelles, achats). */
	readonly expired: readonly PlanStep[];
	/** Étapes retirées parce que devenues impossibles, avec leur motif (P3-11). */
	readonly removed: readonly PlanRemoval[];
}

/** Dernier trimestre résolu, s'il vient de l'être (le passage à `state.turn`). */
function lastQuarter(state: GameState): HistoryEntry | null {
	for (let index = state.history.length - 1; index >= 0; index -= 1) {
		const entry = state.history[index]!;
		if (entry.type === 'turn.resolved') return entry.turn === state.turn - 1 ? entry : null;
	}
	return null;
}

/** Variations politiques d'un trimestre : étapes, échéances et événements informatifs. */
function quarterPolitics(entry: HistoryEntry): PoliticalChange[] {
	return [
		...entry.steps.flatMap((step) => step.politics),
		...(entry.deadlines?.mandates ?? []),
		...(entry.justice?.politics ?? []),
		...entry.events.flatMap((event) => event.politics)
	];
}

/** Alertes de carrière et d'entourage issues du trimestre qui vient d'être résolu. */
function quarterAlerts(state: GameState, content: Content): AccelerationAlert[] {
	const entry = lastQuarter(state);
	if (!entry) return [];
	const alerts: AccelerationAlert[] = [];
	const electionLabel = (electionId: string): string =>
		content.elections[electionId]?.label ?? electionId;
	for (const outcome of entry.deadlines?.campaigns ?? []) {
		const campaign = state.campaigns.find((item) => item.campaignId === outcome.campaignId);
		const label = electionLabel(campaign?.electionId ?? outcome.campaignId);
		alerts.push({
			id: `result:${outcome.campaignId}`,
			kind: 'career',
			message:
				outcome.status === 'won'
					? `${label} : victoire, un nouveau mandat commence.`
					: outcome.status === 'lost'
						? `${label} : défaite${outcome.playerPercent === null ? '' : ` (${outcome.playerPercent} %)`}.`
						: `${label} : candidature invalidée${outcome.reason ? ` (${outcome.reason})` : ''}.`
		});
	}
	for (const change of quarterPolitics(entry)) {
		if (change.kind === 'mandateStarted') {
			const mandate = state.mandates.find((item) => item.instanceId === change.instanceId);
			if (mandate?.access !== 'nomination') continue; // élection : voir le résultat
			alerts.push({
				id: `mandate:${change.instanceId}`,
				kind: 'career',
				message: `Nomination : ${content.mandates[change.mandateId]?.label ?? change.mandateId}.`
			});
		} else if (change.kind === 'mandateEnded') {
			// Un mandat à son terme est déjà annoncé par le scrutin et son résultat (P3-09).
			if (change.reason === 'term') continue;
			alerts.push({
				id: `mandate_end:${change.instanceId}`,
				kind: 'career',
				message: `Fin de mandat : ${content.mandates[change.mandateId]?.label ?? change.mandateId}.`
			});
		} else if (change.kind === 'staffLeft') {
			alerts.push(staffLeftAlert(change.characterId, change.postId, state, content));
		} else if (change.kind === 'earlyElection') {
			alerts.push({
				id: `early:${change.ballotId}`,
				kind: 'deadline',
				message: `${electionLabel(change.electionId)} anticipées au ${formatTurn(change.turn)}.`
			});
		}
	}
	for (const departure of entry.staff?.departures ?? []) {
		alerts.push(staffLeftAlert(departure.characterId, departure.postId, state, content));
	}
	// Étapes des dossiers judiciaires (la révélation arrête déjà l'accélération par sa décision).
	for (const step of entry.justice?.cases ?? []) {
		if (step.kind === 'revealed') continue;
		alerts.push({
			id: `case:${step.caseId}:${step.kind}`,
			kind: 'justice',
			message: caseStepMessage(step.caseId, step.kind, state, content)
		});
	}
	// Recherches échues (P3-21) : résultat à examiner.
	for (const search of entry.staff?.searches ?? []) {
		const post = content.posts[search.postId]?.label ?? search.postId;
		alerts.push({
			id: `search:${search.postId}:${entry.turn}`,
			kind: 'staff',
			message:
				search.outcome === 'found'
					? `Recherche aboutie pour le poste « ${post} » : ${search.candidates.length} candidat${search.candidates.length > 1 ? 's' : ''} à examiner.`
					: search.outcome === 'failed'
						? `Recherche infructueuse pour le poste « ${post} ».`
						: `Recherche sans objet pour le poste « ${post} » : poste pourvu ou présélection complète.`
		});
	}
	for (const postId of entry.staff?.shortlisted ?? []) {
		alerts.push({
			id: `shortlist:${postId}:${entry.turn}`,
			kind: 'staff',
			message: `Candidatures reçues pour le poste « ${content.posts[postId]?.label ?? postId} ».`
		});
	}
	// Une même alerte peut venir de deux sources (départ par événement et à la frontière).
	return alerts.filter(
		(alert, index) => alerts.findIndex((other) => other.id === alert.id) === index
	);
}

const CASE_STEP_LABELS: { readonly [K in CaseEventKind]: string } = {
	revealed: 'révélé',
	dismissed: 'classé sans suite',
	indicted: 'mise en examen, procès à venir',
	appealed: 'condamnation en première instance, appel en cours',
	acquitted: 'relaxe',
	convicted: 'condamnation définitive'
};

/** Message d'une étape de dossier : infraction, personne poursuivie, étape. */
export function caseStepMessage(
	caseId: string,
	kind: CaseEventKind,
	state: GameState,
	content: Content
): string {
	const legalCase = state.cases.find((entry) => entry.caseId === caseId);
	const fact = state.facts.find((entry) => entry.factId === legalCase?.factId);
	const offense = content.offenses[fact?.offenseId ?? '']?.label ?? 'Affaire';
	const who =
		legalCase?.defendantId === null || legalCase === undefined
			? ''
			: ` (${state.characters[legalCase.defendantId]?.name ?? legalCase.defendantId})`;
	return `${offense}${who} : ${CASE_STEP_LABELS[kind]}.`;
}

function staffLeftAlert(
	characterId: string,
	postId: string,
	state: GameState,
	content: Content
): AccelerationAlert {
	const name = state.characters[characterId]?.name ?? characterId;
	return {
		id: `staff_left:${characterId}`,
		kind: 'staff',
		message: `${name} quitte le poste « ${content.posts[postId]?.label ?? postId} », désormais vacant.`
	};
}

/** Échéances électorales à préparer : candidature encore possible, campagne à son dernier trimestre. */
function deadlineAlerts(state: GameState, content: Content): AccelerationAlert[] {
	const lead = content.balance.elections.alertLeadTurns;
	const alerts: AccelerationAlert[] = [];
	const running = runningCampaigns(state.campaigns);
	for (const ballot of state.ballots) {
		if (ballot.status !== 'scheduled') continue;
		const label = content.elections[ballot.electionId]?.label ?? ballot.electionId;
		if (running.some((campaign) => campaign.ballotId === ballot.ballotId)) {
			if (ballot.turn === state.turn) {
				alerts.push({
					id: `vote:${ballot.ballotId}`,
					kind: 'deadline',
					message: `${label} : dernier trimestre de campagne avant le scrutin.`
				});
			}
			continue;
		}
		const filingLeft = ballot.filingClosesTurn - state.turn;
		if (filingLeft < 0 || filingLeft > lead) continue;
		if (candidacyIssue(ballot.ballotId, state, state.player, state.turn, content) !== null)
			continue;
		// Le rappel n'arrête l'accélération que pour un sortant (P3-09) ; le calendrier
		// de l'onglet Carrière montre les autres échéances.
		const outgoing = state.mandates.some(
			(mandate) =>
				mandate.status === 'active' &&
				content.mandates[mandate.mandateId]?.election === ballot.electionId
		);
		if (!outgoing) continue;
		alerts.push({
			id: `filing:${ballot.ballotId}`,
			kind: 'deadline',
			message:
				filingLeft === 0
					? `${label} : dernier trimestre pour déposer une candidature.`
					: `${label} : candidatures ouvertes jusqu’au ${formatTurn(ballot.filingClosesTurn)}.`
		});
	}
	return alerts;
}

/** Salaires de l'entourage que le budget politique ne couvre plus. */
function payrollAlert(state: GameState): AccelerationAlert[] {
	// Salaires convenus et primes encore dues (P3-20).
	const payroll = state.staff
		.filter((member) => member.status === 'active')
		.reduce((sum, member) => sum + member.salaryCents + member.bonusDueCents, 0);
	if (payroll === 0 || state.resources.politicalBudgetCents >= payroll) return [];
	return [
		{
			id: 'finances',
			kind: 'finance',
			message: 'Budget politique insuffisant pour payer l’entourage le trimestre prochain.'
		}
	];
}

/**
 * Alertes métier susceptibles d'interrompre une accélération, dans un ordre
 * stable : prévision du plan, santé, finances, carrière et entourage, échéances.
 */
export function accelerationAlerts(
	state: GameState,
	plan: TurnPlan,
	content: Content
): readonly AccelerationAlert[] {
	if (state.phase !== 'planning') return [];
	const preview = previewPlan(state, plan, content);
	// Une seule alerte « finances » (P3-09) : charges, salaires et train de vie impayés
	// forment un même épisode, au lieu d'arrêter l'accélération à chaque variante.
	const MONEY = new Set(['upkeep_at_risk', 'salary_unpaid', 'lifestyle_unpaid']);
	const alerts: AccelerationAlert[] = [];
	for (const warning of preview.warnings) {
		const money = MONEY.has(warning.code);
		if (money && alerts.some((alert) => alert.id === 'finances')) continue;
		alerts.push({
			id: money ? 'finances' : warning.code,
			kind: warning.code === 'stress_high' ? 'health' : 'plan',
			message: warning.message
		});
	}
	if (state.player.health < content.balance.wellbeing.fragileHealthThreshold) {
		alerts.push({
			id: 'health_fragile',
			kind: 'health',
			message: 'Santé critique : une intervention est recommandée.'
		});
	}
	if (!alerts.some((alert) => alert.id === 'finances')) alerts.push(...payrollAlert(state));
	alerts.push(...quarterAlerts(state, content));
	alerts.push(...deadlineAlerts(state, content));
	return alerts;
}

interface Progress {
	readonly state: GameState;
	readonly turnsAdvanced: number;
	readonly plan: TurnPlan;
	readonly expired: readonly PlanStep[];
	readonly removed: readonly PlanRemoval[];
}

function result(
	progress: Progress,
	stopReason: AccelerationStopReason,
	alerts: readonly AccelerationAlert[] = [],
	issues: readonly PlanIssue[] = []
): AccelerationResult {
	return { ...progress, stopReason, alerts, issues };
}

export function accelerate(
	state: GameState,
	request: AccelerationRequest,
	content: Content
): AccelerationResult {
	if (!Number.isSafeInteger(request.maxTurns) || request.maxTurns < 1) {
		throw new RangeError(`Nombre de trimestres invalide : ${request.maxTurns}`);
	}
	const initial: Progress = {
		state,
		turnsAdvanced: 0,
		plan: request.plan,
		expired: [],
		removed: []
	};
	if (state.phase === 'ended') return result(initial, 'game_ended');
	if (state.phase === 'decision') return result(initial, 'decision_pending');

	// Garde-fou : un plan non vide au lancement qui se vide arrête la boucle.
	const startedWithSteps = Array.isArray(request.plan.steps) && request.plan.steps.length > 0;
	const emptied = (plan: TurnPlan): boolean => startedWithSteps && plan.steps.length === 0;

	const pruned = prunePlan(state, request.plan, content);
	let progress: Progress = { ...initial, plan: pruned.plan, removed: pruned.removed };
	if (emptied(progress.plan)) return result(progress, 'empty_plan');
	let acknowledged = new Set(
		accelerationAlerts(state, progress.plan, content).map((alert) => alert.id)
	);

	while (progress.turnsAdvanced < request.maxTurns) {
		const preview = previewPlan(progress.state, progress.plan, content);
		if (!preview.valid) return result(progress, 'invalid_plan', [], preview.issues);

		const advanced = transition(progress.state, commitTurn(progress.plan), content);
		if (!advanced.ok) {
			if (advanced.error.code === 'invalid_plan') {
				return result(progress, 'invalid_plan', [], advanced.error.issues);
			}
			throw new Error(`Transition d’accélération refusée : ${advanced.error.code}`);
		}
		const carried = carryOverPlan(advanced.state, progress.plan, content);
		progress = {
			state: advanced.state,
			turnsAdvanced: progress.turnsAdvanced + 1,
			plan: carried.plan,
			expired: [...progress.expired, ...carried.expired],
			removed: [...progress.removed, ...carried.removed]
		};
		const current = progress.state;

		if (current.phase === 'ended') return result(progress, 'game_ended');
		if (current.phase === 'decision') return result(progress, 'decision_pending');

		const nextPreview = previewPlan(current, progress.plan, content);
		if (!nextPreview.valid) return result(progress, 'invalid_plan', [], nextPreview.issues);
		const activeAlerts = accelerationAlerts(current, progress.plan, content);
		const newAlerts = activeAlerts.filter((alert) => !acknowledged.has(alert.id));
		if (newAlerts.length > 0) return result(progress, 'alert', newAlerts);
		// Une alerte prime : elle explique souvent pourquoi le plan s'est vidé.
		if (emptied(progress.plan)) return result(progress, 'empty_plan');
		acknowledged = new Set(
			activeAlerts.filter((alert) => acknowledged.has(alert.id)).map((alert) => alert.id)
		);
	}

	return result(progress, 'limit_reached');
}
