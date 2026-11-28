/**
 * Calendrier électoral et mandats (GDD §7, ARCHITECTURE.md §5.1 étape 5) — P2-02.
 *
 * - Calendrier : une échéance programmée par type d'élection ; après chaque
 *   scrutin, la suivante est fixée un cycle plus tard. Une élection anticipée
 *   annule l'échéance régulière (jamais un scrutin déjà tenu) et relance le cycle.
 * - Scrutin (fin du trimestre de l'échéance) : parts de voix tirées autour des
 *   forces des partis, avec un aléa borné ; une élection législative désigne le
 *   parti au gouvernement. Les mandats liés au type d'élection arrivent à terme
 *   (la candidature du joueur viendra avec P2-03).
 * - Mandats : chaque trimestre, temps réservé, revenus et stress ; règles du
 *   cumul (incompatibilités, prérequis, nombre maximal) lues dans l'état.
 * Les identifiants d'instance (`ballot.N`, `term.N`) sont des rangs de création,
 * sans compteur partagé : les autres identifiants d'instance ne bougent pas.
 */
import {
	GAUGE_MAX,
	GAUGE_MIN,
	type Content,
	type Effect,
	type ElectionDefinition,
	type ResourceAmount,
	type ResourceId,
	type Resources,
	type RunoffDecision
} from '../content/types.ts';
import { ageAt, formatTurn, type Turn } from './calendar.ts';
import { addRelation, generatePerson, meet, sortedIds } from './characters.ts';
import { hashSeed, nextInt, type RngState } from './random.ts';
import { localRivalModifier } from './territory.ts';
import { resolvePartyCareer } from './party.ts';
import {
	canMerge,
	colistierParty,
	colistierRank,
	contestDrafts,
	contestRules,
	effectiveSystem,
	listSystem,
	perMille,
	playerFinalPercent,
	playerFirstRoundPercent,
	playerHeadsWinner,
	playerSide,
	runFirstRound,
	runSecondRound,
	seatsFor,
	type PlayerEntry
} from './ballots.ts';
import type {
	Ballot,
	BallotReport,
	BallotShare,
	InvestitureRequest,
	AppointmentOffer,
	Campaign,
	CampaignStatus,
	Character,
	PeopleChange,
	PlayerState,
	Relationship,
	DeadlinesRecord,
	InstitutionsState,
	MandateEndReason,
	MandateInstance,
	PoliticalChange,
	PromiseRecord,
	WorldState
} from './state.ts';

export function ballotId(number: number): string {
	return `ballot.${number}`;
}

export function termId(number: number): string {
	return `term.${number}`;
}

export function campaignId(number: number): string {
	return `campaign.${number}`;
}

function newBallot(
	ballots: readonly Ballot[],
	electionId: string,
	turn: Turn,
	early: boolean,
	content: Content
): Ballot {
	const definition = content.elections[electionId];
	if (!definition) throw new Error(`Élection inconnue : ${electionId}`);
	return {
		ballotId: ballotId(ballots.length + 1),
		electionId,
		turn,
		filingClosesTurn: turn - definition.filingLeadTurns,
		early,
		status: 'scheduled',
		shares: null,
		winnerPartyId: null,
		cancelReason: null,
		report: null
	};
}

/** Première échéance régulière de chaque type d'élection, au plus tôt au trimestre de départ. */
export function createCalendar(turn: Turn, content: Content): Ballot[] {
	const ballots: Ballot[] = [];
	for (const electionId of content.electionIds) {
		const definition = content.elections[electionId]!;
		let first = definition.firstTurn;
		while (first < turn) first += definition.cycleTurns;
		ballots.push(newBallot(ballots, electionId, first, false, content));
	}
	return ballots;
}

/** Prochaine échéance programmée d'un type d'élection. */
export function scheduledBallot(ballots: readonly Ballot[], electionId: string): Ballot | null {
	return (
		ballots.find((ballot) => ballot.electionId === electionId && ballot.status === 'scheduled') ??
		null
	);
}

// ---------------------------------------------------------------------------
// Mandats et cumul
// ---------------------------------------------------------------------------

export function activeMandates(mandates: readonly MandateInstance[]): MandateInstance[] {
	return mandates.filter((mandate) => mandate.status === 'active');
}

/** Temps réservé ce trimestre par les mandats en cours. */
export function reservedTime(mandates: readonly MandateInstance[], content: Content): number {
	return activeMandates(mandates).reduce(
		(total, mandate) => total + (content.mandates[mandate.mandateId]?.timePerTurn ?? 0),
		0
	);
}

/** Mandat en cours de rang le plus élevé (fonction principale), sinon `null`. */
export function mainMandate(
	mandates: readonly MandateInstance[],
	content: Content
): MandateInstance | null {
	let best: MandateInstance | null = null;
	for (const mandate of activeMandates(mandates)) {
		const rank = content.mandates[mandate.mandateId]?.rank ?? 0;
		if (!best || rank > (content.mandates[best.mandateId]?.rank ?? 0)) best = mandate;
	}
	return best;
}

/**
 * Une fonction qui exige un autre mandat (prérequis) s'exerce au sein de ce
 * mandat : la mairie, élue par le conseil municipal parmi ses membres, ne
 * compte pas à part dans le cumul.
 */
export function countsTowardCumul(mandateId: string, institutions: InstitutionsState): boolean {
	return (institutions.prerequisites[mandateId] ?? []).length === 0;
}

/** Mandats en cours comptés dans le cumul. */
export function cumulatedMandates(
	mandates: readonly MandateInstance[],
	institutions: InstitutionsState
): MandateInstance[] {
	return activeMandates(mandates).filter((mandate) =>
		countsTowardCumul(mandate.mandateId, institutions)
	);
}

function incompatible(institutions: InstitutionsState, left: string, right: string): boolean {
	return institutions.incompatibilities.some(
		([a, b]) => (a === left && b === right) || (a === right && b === left)
	);
}

/** Mandats en cours qui empêchent d'exercer `mandateId` (incompatibilités). */
export function conflictingMandates(
	mandateId: string,
	mandates: readonly MandateInstance[],
	institutions: InstitutionsState
): MandateInstance[] {
	return activeMandates(mandates).filter((mandate) =>
		incompatible(institutions, mandate.mandateId, mandateId)
	);
}

/**
 * Raison pour laquelle le joueur ne peut recevoir ce mandat, ou `null`, selon
 * les seules règles en vigueur dans l'état. Avec `replaceIncompatible`, les
 * mandats incompatibles sont réputés abandonnés. Sans contenu, les messages
 * citent les identifiants plutôt que les libellés.
 */
export function holdIssue(
	mandateId: string,
	mandates: readonly MandateInstance[],
	institutions: InstitutionsState,
	content: Content | null,
	replaceIncompatible = false
): string | null {
	const label = (id: string): string => content?.mandates[id]?.label ?? id;
	const active = activeMandates(mandates);
	if (active.some((mandate) => mandate.mandateId === mandateId)) {
		return `Vous exercez déjà : ${label(mandateId)}.`;
	}
	const missing = (institutions.prerequisites[mandateId] ?? []).find(
		(required) => !active.some((mandate) => mandate.mandateId === required)
	);
	if (missing) return `Il faut d’abord exercer : ${label(missing)}.`;
	const conflicts = conflictingMandates(mandateId, mandates, institutions);
	if (conflicts.length > 0 && !replaceIncompatible) {
		return `Incompatible avec : ${conflicts.map((mandate) => label(mandate.mandateId)).join(', ')}.`;
	}
	const counted = (mandate: MandateInstance): boolean =>
		countsTowardCumul(mandate.mandateId, institutions);
	const remaining =
		cumulatedMandates(mandates, institutions).length -
		(replaceIncompatible ? conflicts.filter(counted).length : 0);
	if (countsTowardCumul(mandateId, institutions) && remaining + 1 > institutions.maxMandates) {
		return `Cumul limité à ${institutions.maxMandates} mandats.`;
	}
	return null;
}

export function endMandates(
	mandates: readonly MandateInstance[],
	shouldEnd: (mandate: MandateInstance) => boolean,
	reason: MandateEndReason,
	turn: Turn
): { mandates: MandateInstance[]; changes: PoliticalChange[] } {
	const changes: PoliticalChange[] = [];
	const updated = mandates.map((mandate) => {
		if (mandate.status !== 'active' || !shouldEnd(mandate)) return mandate;
		changes.push({
			kind: 'mandateEnded',
			instanceId: mandate.instanceId,
			mandateId: mandate.mandateId,
			reason
		});
		return { ...mandate, status: 'ended' as const, endTurn: turn, endReason: reason };
	});
	return { mandates: updated, changes };
}

/** Effets de carrière (mandats et élections anticipées), déterministes. */
export type CareerEffect = Extract<
	Effect,
	{
		op:
			| 'grantMandate'
			| 'endMandate'
			| 'callEarlyElection'
			| 'declareCandidacy'
			| 'prepareCampaign'
			| 'advanceCampaign'
			| 'requestInvestiture'
			| 'appointment';
	}
>;

export function isCareerEffect(effect: Effect): effect is CareerEffect {
	return (
		effect.op === 'grantMandate' ||
		effect.op === 'endMandate' ||
		effect.op === 'callEarlyElection' ||
		effect.op === 'declareCandidacy' ||
		effect.op === 'prepareCampaign' ||
		effect.op === 'advanceCampaign' ||
		effect.op === 'requestInvestiture' ||
		effect.op === 'appointment'
	);
}

export interface CareerParts {
	readonly mandates: readonly MandateInstance[];
	readonly ballots: readonly Ballot[];
	readonly campaigns: readonly Campaign[];
	readonly institutions: InstitutionsState;
	/** Registre des promesses, rattachées aux campagnes (P3-04). */
	readonly promises: readonly PromiseRecord[];
	/** Demandes d'investiture nationale (P3-30). */
	readonly investitures: readonly InvestitureRequest[];
	/** Proposition d'entrée au gouvernement en attente (P3-35). */
	readonly appointment: AppointmentOffer | null;
}

export function runningCampaigns(campaigns: readonly Campaign[]): Campaign[] {
	return campaigns.filter((campaign) => campaign.status === 'running');
}

/**
 * Raison pour laquelle aucune avance ne peut être versée à cette campagne
 * (P3-23), ou `null` : candidature en cours, une seule avance par campagne.
 */
export function advanceIssue(campaignIdValue: string, parts: CareerParts): string | null {
	const campaign = runningCampaigns(parts.campaigns).find(
		(entry) => entry.campaignId === campaignIdValue
	);
	if (!campaign) return 'choisissez une candidature en cours';
	if (campaign.advanceCents > 0) return 'une seule avance par campagne';
	return null;
}

/** Mandats encore en cours une fois passé le scrutin de cette élection (réélection possible). */
function mandatesAfterTerm(
	mandates: readonly MandateInstance[],
	electionId: string,
	content: Content | null
): MandateInstance[] {
	return activeMandates(mandates).filter(
		(mandate) => content?.mandates[mandate.mandateId]?.election !== electionId
	);
}

/**
 * Raison pour laquelle le joueur ne peut se présenter à cette échéance, ou
 * `null` : échéance programmée, candidatures encore ouvertes, pas déjà
 * candidat, âge au jour du scrutin, mandat exigé (grands électeurs) et règles
 * du cumul pour le mandat brigué (les mandats qui s'achèvent à ce scrutin sont
 * réputés libérés : un sortant peut se représenter).
 */
/** Le joueur est-il frappé d'inéligibilité au trimestre `turn` (P3-01) ? */
export function isIneligible(player: Pick<PlayerState, 'ineligibleUntil'>, turn: Turn): boolean {
	return player.ineligibleUntil !== null && turn < player.ineligibleUntil;
}

const INELIGIBLE = 'Vous êtes frappé d’inéligibilité par la justice.';

export function candidacyIssue(
	ballotIdValue: string,
	parts: CareerParts,
	player: PlayerState,
	turn: Turn,
	content: Content,
	role: 'head' | 'colistier' = 'head',
	viaInvestiture = false
): string | null {
	const ballot = parts.ballots.find((entry) => entry.ballotId === ballotIdValue);
	if (!ballot || ballot.status !== 'scheduled') return 'Aucune élection programmée à cette date.';
	const definition = content.elections[ballot.electionId];
	if (!definition) return `Élection inconnue : ${ballot.electionId}.`;
	if (turn > ballot.filingClosesTurn) return 'Les candidatures sont closes.';
	if (runningCampaigns(parts.campaigns).some((campaign) => campaign.ballotId === ballot.ballotId)) {
		return 'Vous êtes déjà candidat à cette élection.';
	}
	if (ageAt(player.birthTurn, ballot.turn) < definition.minAge) {
		return `Il faut avoir ${definition.minAge} ans le jour du scrutin.`;
	}
	if (isIneligible(player, ballot.turn)) return INELIGIBLE;
	// Pas de candidature sous étiquette sans l'accord du parti (P3-30).
	if (role === 'head' && definition.investiture && player.partyId !== null && !viaInvestiture) {
		return 'Encarté, demandez d’abord l’investiture de votre parti.';
	}
	if (role === 'colistier' && !listSystem(effectiveSystem(definition, player.territory, content))) {
		return 'Ce scrutin n’a pas de listes : seule une candidature personnelle est possible.';
	}
	return eligibilityIssue(ballot, parts, content);
}

/** Conditions revérifiées au jour du scrutin (mandats exigés et cumul), sans l'âge ni la clôture. */
function eligibilityIssue(ballot: Ballot, parts: CareerParts, content: Content): string | null {
	const definition = content.elections[ballot.electionId];
	if (!definition) return `Élection inconnue : ${ballot.electionId}.`;
	const remaining = mandatesAfterTerm(parts.mandates, ballot.electionId, content);
	if (
		definition.requiresAnyMandate.length > 0 &&
		!remaining.some((mandate) => definition.requiresAnyMandate.includes(mandate.mandateId))
	) {
		const labels = definition.requiresAnyMandate.map((id) => content.mandates[id]?.label ?? id);
		return `Il faut exercer l’un de ces mandats : ${labels.join(', ')}.`;
	}
	return holdIssue(definition.grants, remaining, parts.institutions, content);
}

/**
 * Applique un effet de carrière. Une attribution impossible (déjà exercé,
 * prérequis, incompatibilité sans remplacement, cumul) n'a aucun effet : les
 * choix concernés sont rendus indisponibles en amont (`careerEffectIssue`).
 * `target` est l'exemplaire de mandat choisi dans le plan.
 */
export function applyCareerEffect(
	effect: CareerEffect,
	parts: CareerParts,
	turn: Turn,
	target: string | null,
	content: Content,
	player: PlayerState,
	world: WorldState | null = null,
	influence = 0
): { parts: CareerParts; changes: PoliticalChange[] } {
	switch (effect.op) {
		case 'declareCandidacy': {
			const role = effect.role ?? 'head';
			if (target === null || candidacyIssue(target, parts, player, turn, content, role)) {
				return { parts, changes: [] };
			}
			const ballot = parts.ballots.find((entry) => entry.ballotId === target)!;
			const apparatus = player.supports[content.balance.campaigns.apparatusGroup] ?? 0;
			const definition = content.elections[ballot.electionId]!;
			const listPartyId =
				role !== 'colistier'
					? null
					: world
						? colistierParty(player, world, content)
						: (player.partyId ?? content.partyIds[0] ?? '');
			const campaign: Campaign = {
				campaignId: campaignId(parts.campaigns.length + 1),
				ballotId: ballot.ballotId,
				electionId: ballot.electionId,
				declaredTurn: turn,
				partyId: listPartyId ?? player.partyId,
				invested:
					role === 'colistier'
						? player.partyId !== null && player.partyId === listPartyId
						: player.partyId !== null &&
							apparatus >= content.balance.campaigns.investitureMinApparatus,
				preparation: 0,
				advanceCents: 0,
				opponentId: null,
				status: 'running',
				playerPercent: null,
				reason: null,
				role,
				listRank:
					listPartyId === null
						? 1
						: colistierRank(
								seatsFor(definition, player.territory, content),
								player,
								influence,
								listPartyId,
								content
							),
				resultTurn: null
			};
			return {
				parts: { ...parts, campaigns: [...parts.campaigns, campaign] },
				changes: [
					{
						kind: 'candidacy',
						campaignId: campaign.campaignId,
						ballotId: ballot.ballotId,
						invested: campaign.invested
					}
				]
			};
		}
		case 'appointment': {
			// Réponse à la proposition d'entrée au gouvernement (P3-35), une seule fois.
			const offer = parts.appointment;
			if (!offer) return { parts, changes: [] };
			const cleared = { ...parts, appointment: null };
			if (effect.decision === 'decline') {
				return {
					parts: cleared,
					changes: [
						{
							kind: 'appointment',
							mandateId: offer.mandateId,
							portfolio: offer.portfolio,
							status: 'declined'
						}
					]
				};
			}
			const granted = applyCareerEffect(
				{ op: 'grantMandate', mandate: offer.mandateId, replaceIncompatible: true },
				cleared,
				turn,
				null,
				content,
				player
			);
			const mandates = granted.parts.mandates.map((mandate, index) =>
				index === granted.parts.mandates.length - 1 &&
				granted.parts.mandates.length > cleared.mandates.length
					? { ...mandate, portfolio: offer.portfolio }
					: mandate
			);
			return {
				parts: { ...granted.parts, mandates },
				changes: [
					{
						kind: 'appointment',
						mandateId: offer.mandateId,
						portfolio: offer.portfolio,
						status: 'accepted'
					},
					...granted.changes
				]
			};
		}
		case 'requestInvestiture': {
			if (target === null || investitureIssue(target, parts, player, turn, content)) {
				return { parts, changes: [] };
			}
			const ballot = parts.ballots.find((entry) => entry.ballotId === target)!;
			const request: InvestitureRequest = {
				requestId: `investiture.${parts.investitures.length + 1}`,
				ballotId: ballot.ballotId,
				electionId: ballot.electionId,
				partyId: player.partyId!,
				requestedTurn: turn,
				status: 'pending',
				resolvedTurn: null,
				reasons: []
			};
			return {
				parts: { ...parts, investitures: [...parts.investitures, request] },
				changes: [
					{
						kind: 'investiture',
						requestId: request.requestId,
						ballotId: ballot.ballotId,
						status: 'pending'
					}
				]
			};
		}
		case 'advanceCampaign': {
			if (target === null || advanceIssue(target, parts)) return { parts, changes: [] };
			return {
				parts: {
					...parts,
					campaigns: parts.campaigns.map((campaign) =>
						campaign.campaignId === target
							? { ...campaign, advanceCents: campaign.advanceCents + effect.valueCents }
							: campaign
					)
				},
				changes: [{ kind: 'campaignAdvance', campaignId: target, cents: effect.valueCents }]
			};
		}
		case 'prepareCampaign': {
			if (runningCampaigns(parts.campaigns).length === 0) return { parts, changes: [] };
			return {
				parts: {
					...parts,
					campaigns: parts.campaigns.map((campaign) =>
						campaign.status === 'running'
							? { ...campaign, preparation: campaign.preparation + effect.value }
							: campaign
					)
				},
				changes: [{ kind: 'preparation', delta: effect.value }]
			};
		}
		case 'grantMandate': {
			const replace = effect.replaceIncompatible === true;
			if (
				isIneligible(player, turn) ||
				holdIssue(effect.mandate, parts.mandates, parts.institutions, content, replace)
			) {
				return { parts, changes: [] };
			}
			const ended = replace
				? endMandates(
						parts.mandates,
						(mandate) => incompatible(parts.institutions, mandate.mandateId, effect.mandate),
						'replaced',
						turn
					)
				: { mandates: [...parts.mandates], changes: [] };
			const instance: MandateInstance = {
				instanceId: termId(parts.mandates.length + 1),
				mandateId: effect.mandate,
				startTurn: turn,
				access: content.mandates[effect.mandate]?.election ? 'election' : 'nomination',
				status: 'active',
				endTurn: null,
				endReason: null,
				side: null,
				portfolio: null
			};
			return {
				parts: { ...parts, mandates: [...ended.mandates, instance] },
				changes: [
					...ended.changes,
					{ kind: 'mandateStarted', instanceId: instance.instanceId, mandateId: effect.mandate }
				]
			};
		}
		case 'endMandate': {
			const matches = (mandate: MandateInstance): boolean =>
				effect.mandate === 'target'
					? mandate.instanceId === target
					: mandate.mandateId === effect.mandate;
			const ended = endMandates(
				parts.mandates,
				matches,
				effect.mandate === 'target' ? 'resigned' : 'removed',
				turn
			);
			// Qui perd un prérequis perd aussi le mandat qui en dépend (pas de maire sans siège).
			const dependants = endMandates(
				ended.mandates,
				(mandate) =>
					(parts.institutions.prerequisites[mandate.mandateId] ?? []).some(
						(required) =>
							!ended.mandates.some(
								(other) => other.status === 'active' && other.mandateId === required
							)
					),
				'removed',
				turn
			);
			return {
				parts: { ...parts, mandates: dependants.mandates },
				changes: [...ended.changes, ...dependants.changes]
			};
		}
		case 'callEarlyElection': {
			const definition = content.elections[effect.election];
			if (!definition) throw new Error(`Élection inconnue : ${effect.election}`);
			const regular = scheduledBallot(parts.ballots, effect.election);
			const early = turn + effect.delayTurns;
			// Une échéance régulière déjà plus proche n'est pas avancée.
			if (regular && regular.turn <= early) return { parts, changes: [] };
			const ballots = parts.ballots.map((ballot) =>
				ballot === regular
					? { ...ballot, status: 'cancelled' as const, cancelReason: 'Élection anticipée.' }
					: ballot
			);
			const ballot = newBallot(ballots, effect.election, early, true, content);
			// Les candidatures en cours suivent l'échéance anticipée, préparation comprise.
			const campaigns = parts.campaigns.map((campaign) =>
				regular && campaign.status === 'running' && campaign.ballotId === regular.ballotId
					? { ...campaign, ballotId: ballot.ballotId }
					: campaign
			);
			return {
				parts: {
					...parts,
					campaigns,
					ballots: [
						...ballots,
						{ ...ballot, filingClosesTurn: Math.max(turn, ballot.filingClosesTurn) }
					]
				},
				changes: [
					{
						kind: 'earlyElection',
						ballotId: ballot.ballotId,
						electionId: effect.election,
						turn: early
					}
				]
			};
		}
		default: {
			const unknown: never = effect;
			throw new Error(`Effet de carrière inconnu : ${JSON.stringify(unknown)}`);
		}
	}
}

/** Raison pour laquelle un effet de carrière d'un choix ne peut s'appliquer, ou `null`. */
export function careerEffectIssue(
	effect: Effect,
	parts: CareerParts,
	content: Content | null,
	player: Pick<PlayerState, 'ineligibleUntil' | 'territory'> | null = null,
	turn: Turn = 0
): string | null {
	if (effect.op === 'appointment') {
		if (effect.decision === 'decline' || !parts.appointment) return null;
		if (player && isIneligible(player, turn)) return INELIGIBLE;
		return holdIssue(
			parts.appointment.mandateId,
			parts.mandates,
			parts.institutions,
			content,
			true
		);
	}
	if (effect.op === 'runoffDecision') {
		return content && player ? runoffIssue(effect.decision, null, parts, player, content) : null;
	}
	if (effect.op !== 'grantMandate') return null;
	if (player && isIneligible(player, turn)) return INELIGIBLE;
	return holdIssue(
		effect.mandate,
		parts.mandates,
		parts.institutions,
		content,
		effect.replaceIncompatible === true
	);
}

// ---------------------------------------------------------------------------
// Revenus des mandats (étape 3)
// ---------------------------------------------------------------------------

/** Revenus et stress du trimestre `turn` pour les mandats en cours depuis au moins ce trimestre. */
export function mandateIncome(
	mandates: readonly MandateInstance[],
	turn: Turn,
	content: Content
): { income: ResourceAmount[]; stress: number } {
	const totals = new Map<ResourceAmount['resource'], number>();
	let stress = 0;
	for (const mandate of activeMandates(mandates)) {
		if (mandate.startTurn > turn) continue;
		const definition = content.mandates[mandate.mandateId];
		if (!definition) continue;
		for (const amount of definition.income) {
			totals.set(amount.resource, (totals.get(amount.resource) ?? 0) + amount.amount);
		}
		stress += definition.stressPerTurn;
	}
	return {
		income: [...totals.entries()].map(([resource, amount]) => ({ resource, amount })),
		stress
	};
}

// ---------------------------------------------------------------------------
// Échéances (étape 5)
// ---------------------------------------------------------------------------

/** Répartit 100 points entre des poids positifs (plus forts restes, ordre stable). */
function percentages(weights: readonly { partyId: string; weight: number }[]): BallotShare[] {
	const total = weights.reduce((sum, entry) => sum + entry.weight, 0);
	const raw = weights.map((entry, index) => {
		const exact = (entry.weight * 100) / total;
		return { partyId: entry.partyId, floor: Math.floor(exact), rest: exact % 1, index };
	});
	let missing = 100 - raw.reduce((sum, entry) => sum + entry.floor, 0);
	const byRest = [...raw].sort((a, b) => b.rest - a.rest || a.index - b.index);
	const bonus = new Set<number>();
	for (const entry of byRest) {
		if (missing <= 0) break;
		bonus.add(entry.index);
		missing -= 1;
	}
	return raw
		.map((entry) => ({
			partyId: entry.partyId,
			percent: entry.floor + (bonus.has(entry.index) ? 1 : 0)
		}))
		.sort(
			(a, b) =>
				b.percent - a.percent ||
				raw.findIndex((r) => r.partyId === a.partyId) -
					raw.findIndex((r) => r.partyId === b.partyId)
		);
}

// ---------------------------------------------------------------------------
// Campagne et scrutin du joueur
// ---------------------------------------------------------------------------

/** Part du parti dans les intentions de vote actuelles (forces normalisées), en %. */
export function partyPollShare(
	partyId: string | null,
	world: WorldState,
	content: Content
): number {
	if (partyId === null) return 0;
	const total = content.partyIds.reduce((sum, id) => sum + (world.parties[id]?.strength ?? 0), 0);
	return total > 0 ? Math.round(((world.parties[partyId]?.strength ?? 0) * 100) / total) : 0;
}

/**
 * Mobilisation d'une campagne, de 0 à 100 % : militants personnels et, en cas
 * d'investiture, la part de la machine du parti, rapportés au besoin du scrutin.
 */
export function mobilizationPercent(
	campaign: Campaign,
	activists: number,
	content: Content
): number {
	const need = content.elections[campaign.electionId]?.mobilizationNeed ?? 0;
	if (need <= 0) return 100;
	const machine = campaign.invested
		? Math.floor((need * content.balance.activists.partyMachinePercent) / 100)
		: 0;
	return Math.min(100, Math.floor(((activists + machine) * 100) / need));
}

/** Pénalité de score d'une mobilisation incomplète (0 à `mobilizationWeight`). */
export function mobilizationPenalty(
	campaign: Campaign,
	activists: number,
	content: Content
): number {
	const missing = 100 - mobilizationPercent(campaign, activists, content);
	return Math.round((missing * content.balance.activists.mobilizationWeight) / 100);
}

/**
 * Score du joueur avant aléa : popularité, part du parti s'il est investi,
 * préparation plafonnée et prime du sortant, moins la pénalité de mobilisation
 * (P3-19). Les poids sont des pourcentages.
 */
export function campaignScore(
	campaign: Campaign,
	popularity: number,
	activists: number,
	partyPercent: number,
	incumbent: boolean,
	content: Content
): number {
	const balance = content.balance.campaigns;
	return (
		Math.round(
			(popularity * balance.popularityWeightPercent +
				(campaign.invested ? partyPercent * balance.partyWeightPercent : 0) +
				Math.min(campaign.preparation, balance.preparationCap) * balance.preparationWeightPercent) /
				100 +
				(incumbent ? balance.incumbentBonus : 0)
		) - mobilizationPenalty(campaign, activists, content)
	);
}

/**
 * Sondage publié : fourchette de score (en %) face à l'adversaire principal,
 * sans aléa ni information cachée. L'aléa du scrutin réel peut en sortir.
 */
// ---------------------------------------------------------------------------
// Adversaires nommés (P2-06)
// ---------------------------------------------------------------------------

/** Victoires passées de cet adversaire contre le joueur. */
export function rivalWins(opponentId: string, campaigns: readonly Campaign[]): number {
	return campaigns.filter(
		(campaign) => campaign.opponentId === opponentId && campaign.status === 'lost'
	).length;
}

/**
 * Score de l'adversaire avant aléa : force de base de l'élection, expérience
 * (victoires passées contre le joueur, plafonnées) et bonus de ses traits.
 * `knownOnly` limite les traits à ceux connus du joueur (sondage publié).
 */
export function opponentStrength(
	campaign: Campaign,
	characters: Readonly<Record<string, Character>>,
	campaigns: readonly Campaign[],
	content: Content,
	knownOnly = false
): number {
	const definition = content.elections[campaign.electionId];
	if (!definition) return 0;
	const opponent = campaign.opponentId ? characters[campaign.opponentId] : undefined;
	if (!opponent) return definition.rivalStrength;
	const balance = content.balance.campaigns;
	const experience =
		Math.min(balance.rivalExperienceCap, rivalWins(opponent.id, campaigns)) *
		balance.rivalExperienceBonus;
	const traits = (knownOnly ? opponent.knownTraits : opponent.traits).reduce(
		(total, trait) => total + (content.traits[trait]?.campaignBonus ?? 0),
		0
	);
	return definition.rivalStrength + experience + traits;
}

/** Un personnage peut-il affronter le joueur à cette échéance ? */
function canOppose(
	character: Character,
	ballot: Ballot,
	player: PlayerState,
	engaged: ReadonlySet<string>,
	content: Content
): boolean {
	const definition = content.elections[ballot.electionId];
	if (!definition || character.status !== 'active' || engaged.has(character.id)) return false;
	if (player.partyId !== null && character.partyId === player.partyId) return false;
	const age = ageAt(character.birthTurn, ballot.turn);
	return age >= definition.minAge && age <= content.balance.campaigns.opponentMaxAge;
}

/**
 * Attribue un adversaire à une campagne qui n'en a pas (ou plus) : d'abord
 * celui déjà affronté au même type d'élection s'il est toujours éligible
 * (rival récurrent), sinon un personnage portant l'étiquette `rival` tiré au
 * sort, sinon un nouveau personnage politique généré. Jamais un personnage
 * parti, retraité ou décédé.
 */
function assignOpponent(
	campaign: Campaign,
	career: CareerParts,
	characters: Readonly<Record<string, Character>>,
	player: PlayerState,
	world: WorldState,
	turn: Turn,
	rng: RngState,
	content: Content
): { opponentId: string; characters: Readonly<Record<string, Character>>; rng: RngState } {
	const ballot = career.ballots.find((entry) => entry.ballotId === campaign.ballotId);
	if (!ballot) throw new Error(`Échéance inconnue : ${campaign.ballotId}`);
	const engaged = new Set(
		runningCampaigns(career.campaigns).flatMap((other) =>
			other.campaignId !== campaign.campaignId && other.opponentId ? [other.opponentId] : []
		)
	);
	const fits = (id: string | null): boolean => {
		const character = id ? characters[id] : undefined;
		return character !== undefined && canOppose(character, ballot, player, engaged, content);
	};
	const previous = [...career.campaigns]
		.reverse()
		.find(
			(entry) =>
				entry.electionId === campaign.electionId &&
				entry.status !== 'running' &&
				entry.opponentId !== null
		);
	if (previous?.opponentId && fits(previous.opponentId)) {
		return { opponentId: previous.opponentId, characters, rng };
	}
	const rivals = sortedIds(characters).filter(
		(id) => characters[id]?.tags.includes('rival') === true && fits(id)
	);
	if (rivals.length > 0) {
		const draw = nextInt(rng, 0, rivals.length - 1);
		return { opponentId: rivals[draw.value]!, characters, rng: draw.rng };
	}
	const definition = content.elections[campaign.electionId]!;
	const partyId =
		[...content.partyIds]
			.filter((id) => id !== player.partyId)
			.sort(
				(left, right) =>
					(world.parties[right]?.strength ?? 0) - (world.parties[left]?.strength ?? 0)
			)[0] ?? null;
	// Âgé d'au moins l'âge requis dès aujourd'hui, et assez jeune pour rester éligible au scrutin.
	const minAge = Math.min(definition.minAge + 2, content.balance.campaigns.opponentMaxAge - 12);
	const maxAge = Math.max(minAge, Math.min(60, content.balance.campaigns.opponentMaxAge - 12));
	const generated = generatePerson(
		{
			tags: ['politician', 'rival'],
			epithet: null,
			renewal: null,
			partyId,
			minAge,
			maxAge,
			successorOf: null
		},
		turn,
		characters,
		rng,
		content
	);
	return {
		opponentId: generated.character.id,
		characters: { ...characters, [generated.character.id]: generated.character },
		rng: generated.rng
	};
}

export function campaignPoll(
	campaign: Campaign,
	player: PlayerState,
	world: WorldState,
	mandates: readonly MandateInstance[],
	content: Content,
	characters: Readonly<Record<string, Character>> = {},
	campaigns: readonly Campaign[] = [],
	pollingCompetence: number | null = null
): { readonly min: number; readonly max: number } {
	const definition = content.elections[campaign.electionId];
	if (!definition) return { min: 0, max: 0 };
	// Intentions de vote nationales actuelles, sans aléa ; de l'adversaire, le
	// sondage ne connaît que les traits connus du joueur.
	const shares: BallotShare[] = content.partyIds.map((partyId) => ({
		partyId,
		percent: partyPollShare(partyId, world, content)
	}));
	const incumbent = activeMandates(mandates).some(
		(mandate) => mandate.mandateId === definition.grants
	);
	const entry = playerEntry(
		campaign,
		shares,
		incumbent,
		{ player, career: { mandates, campaigns }, characters },
		content,
		true
	);
	const drafts = contestDrafts({ definition, shares, territory: player.territory, entry }, content);
	const mine = drafts.findIndex((draft) =>
		campaign.role === 'head' ? draft.player : !draft.player && draft.partyId === campaign.partyId
	);
	if (mine < 0) return { min: 0, max: 0 };
	// Un collaborateur qui sonde l'électorat resserre la fourchette selon sa compétence.
	const volatility = Math.round(
		content.balance.campaigns.volatility *
			(pollingCompetence === null ? 1 : Math.max(0.25, 1 - pollingCompetence / 150))
	);
	const share = (sign: 1 | -1): number => {
		const weights = drafts.map((draft, index) =>
			Math.max(1, draft.weight + (index === mine ? sign : -sign) * volatility)
		);
		return Math.round(perMille(weights)[mine]! / 10);
	};
	return { min: share(-1), max: share(1) };
}

/** Parties de l'état touchées par les échéances de fin de trimestre. */
export interface DeadlineParts {
	readonly world: WorldState;
	readonly player: PlayerState;
	readonly resources: Resources;
	readonly characters: Readonly<Record<string, Character>>;
	readonly relationships: Readonly<Record<string, Relationship>>;
	readonly career: CareerParts;
}

export interface FrontierDeadlines extends DeadlineParts {
	readonly rng: RngState;
	readonly record: DeadlinesRecord;
}

/**
 * Remboursement forfaitaire des frais de campagne après un scrutin : versé si la
 * candidature a été jugée (victoire, défaite ou retrait entre les tours) avec au
 * moins `refundMinPercent` des voix au premier tour ; jamais après une
 * invalidation, ni au colistier (la liste de son parti en a la charge).
 */
export function campaignRefund(
	definition: ElectionDefinition,
	status: CampaignStatus,
	firstRoundPercent: number | null,
	content: Content
): number {
	if (status !== 'won' && status !== 'lost' && status !== 'withdrawn') return 0;
	if (
		firstRoundPercent === null ||
		firstRoundPercent < content.balance.campaigns.refundMinPercent
	) {
		return 0;
	}
	return definition.campaignRefundCents ?? 0;
}

/**
 * Remboursement d'une candidature jugée, d'après son procès-verbal : premier
 * tour du joueur, rien pour un colistier (P3-29). Sert aussi au journal.
 */
export function campaignRefundFor(
	campaign: Campaign,
	status: CampaignStatus,
	ballots: readonly Ballot[],
	content: Content
): number {
	const definition = content.elections[campaign.electionId];
	const report = ballots.find((entry) => entry.ballotId === campaign.ballotId)?.report;
	if (!definition || !report || campaign.role === 'colistier') return 0;
	return campaignRefund(definition, status, playerFirstRoundPercent(report), content);
}

/**
 * Échéances de la fin du trimestre `turn` (T), dans un ordre fixe : préparation
 * passive et stress des campagnes en cours, fins de mandats liées aux scrutins
 * du trimestre, puis scrutins dans l'ordre du catalogue — parts des partis,
 * puis candidature du joueur revalidée et jugée —, puis échéances suivantes.
 * Un changement de gouvernement met fin aux mandats qui en dépendent. Une
 * défaite n'est jamais terminale.
 */
export function resolveDeadlines(
	parts: DeadlineParts,
	turn: Turn,
	rng: RngState,
	content: Content
): FrontierDeadlines {
	const balance = content.balance.elections;
	const campaignBalance = content.balance.campaigns;
	const { minPartyStrength, maxPartyStrength } = content.balance.world;
	let currentWorld = parts.world;
	let player = parts.player;
	const resources: Record<ResourceId, number> = { ...parts.resources };
	let career = parts.career;
	let characters = parts.characters;
	let relationships = parts.relationships;
	let currentRng = rng;
	const people: PeopleChange[] = [];

	// 0. Investitures demandées ce trimestre : décision unique et seedée (P3-30).
	const investiture = resolveInvestitures(
		career,
		player,
		resources.influence,
		turn,
		currentRng,
		content
	);
	career = investiture.career;
	currentRng = investiture.rng;
	const investitures = investiture.resolved;

	// 0 ter. Carrière partisane : promotion de cadre, congrès du parti (P3-34).
	const party = resolvePartyCareer(
		player,
		currentWorld,
		resources.influence,
		turn,
		currentRng,
		content
	);
	player = party.player;
	currentRng = party.rng;

	// 0 bis. Campagnes en cours : préparation passive et exposition (stress).
	const running = runningCampaigns(career.campaigns);
	if (running.length > 0) {
		career = {
			...career,
			campaigns: career.campaigns.map((campaign) =>
				campaign.status === 'running'
					? { ...campaign, preparation: campaign.preparation + campaignBalance.passivePreparation }
					: campaign
			)
		};
		player = {
			...player,
			stress: Math.min(GAUGE_MAX, player.stress + campaignBalance.stressPerTurn * running.length)
		};
	}

	// 0 bis. Adversaires : attribués ou remplacés si l'adversaire a quitté la vie publique.
	for (const campaign of runningCampaigns(career.campaigns)) {
		const current = campaign.opponentId ? characters[campaign.opponentId] : undefined;
		if (current && current.status === 'active') continue;
		const assigned = assignOpponent(
			campaign,
			career,
			characters,
			player,
			currentWorld,
			turn + 1,
			currentRng,
			content
		);
		characters = assigned.characters;
		currentRng = assigned.rng;
		career = {
			...career,
			campaigns: career.campaigns.map((entry) =>
				entry.campaignId === campaign.campaignId
					? { ...entry, opponentId: assigned.opponentId }
					: entry
			)
		};
		const met = meet(relationships, assigned.opponentId, turn + 1);
		relationships = met.relationships;
		if (met.change) people.push(met.change);
	}

	const due = content.electionIds.flatMap((electionId) => {
		const ballot = career.ballots.find(
			(entry) =>
				entry.electionId === electionId && entry.status === 'scheduled' && entry.turn === turn
		);
		return ballot ? [ballot] : [];
	});
	if (due.length === 0) {
		return {
			world: currentWorld,
			player,
			resources,
			career,
			characters,
			relationships,
			rng: currentRng,
			record: {
				mandates: [...investiture.changes, ...party.changes],
				ballots: [],
				campaigns: [],
				people,
				runoffs: [],
				investitures
			}
		};
	}

	const mandateChanges: PoliticalChange[] = [...investiture.changes, ...party.changes];
	const campaignRecords: DeadlinesRecord['campaigns'][number][] = [];
	const runoffs: string[] = [];

	// 1. Fins de mandats : un mandat arrive à terme au scrutin de son élection.
	const dueElections = new Set(due.map((ballot) => ballot.electionId));
	const outgoing = new Set(
		activeMandates(career.mandates)
			.filter((mandate) => dueElections.has(content.mandates[mandate.mandateId]?.election ?? ''))
			.map((mandate) => mandate.mandateId)
	);
	const terms = endMandates(
		career.mandates,
		(mandate) => dueElections.has(content.mandates[mandate.mandateId]?.election ?? ''),
		'term',
		turn
	);
	career = { ...career, mandates: terms.mandates };
	mandateChanges.push(...terms.changes);

	// 2. Scrutins.
	const ballotRecords: DeadlinesRecord['ballots'][number][] = [];
	for (const ballot of due) {
		const definition = content.elections[ballot.electionId]!;
		const weights = content.partyIds.map((partyId) => {
			const strength = currentWorld.parties[partyId]?.strength ?? minPartyStrength;
			let noise = 0;
			if (balance.voteVolatility > 0) {
				const draw = nextInt(currentRng, -balance.voteVolatility, balance.voteVolatility);
				currentRng = draw.rng;
				noise = draw.value;
			}
			return { partyId, weight: Math.max(1, strength + noise) };
		});
		const shares = percentages(weights);
		const winnerPartyId = shares[0]!.partyId;
		const governingBefore = currentWorld.governingPartyId;

		const parties = { ...currentWorld.parties };
		const shift = (partyId: string, delta: number): void => {
			const party = parties[partyId];
			if (!party || delta === 0) return;
			parties[partyId] = {
				...party,
				strength: Math.min(maxPartyStrength, Math.max(minPartyStrength, party.strength + delta))
			};
		};
		shift(winnerPartyId, balance.momentum);
		let governingAfter = governingBefore;
		let stability = currentWorld.indicators.stability;
		if (definition.decidesGovernment) {
			if (winnerPartyId !== governingBefore) {
				governingAfter = winnerPartyId;
				stability = Math.min(GAUGE_MAX, Math.max(GAUGE_MIN, balance.newGovernmentStability));
			}
		} else if (winnerPartyId !== governingBefore) {
			// Élection intermédiaire perdue : le gouvernement en paie le prix.
			shift(governingBefore, -balance.momentum);
		}
		currentWorld = {
			...currentWorld,
			parties,
			governingPartyId: governingAfter,
			indicators: { ...currentWorld.indicators, stability }
		};
		if (governingAfter !== governingBefore) {
			const fallen = endMandates(
				career.mandates,
				(mandate) => content.mandates[mandate.mandateId]?.endsWithGovernment === true,
				'government_change',
				turn
			);
			career = { ...career, mandates: fallen.mandates };
			mandateChanges.push(...fallen.changes);
		}

		// Procès-verbal du territoire du joueur (P3-29) : sa candidature,
		// revalidée au jour du scrutin, y figure ; sinon les seuls partis.
		const campaign =
			runningCampaigns(career.campaigns).find((entry) => entry.ballotId === ballot.ballotId) ??
			null;
		const issue = campaign
			? isIneligible(player, ballot.turn)
				? INELIGIBLE
				: eligibilityIssue(ballot, career, content)
			: null;
		const entry =
			campaign && !issue
				? playerEntry(
						campaign,
						shares,
						outgoing.has(definition.grants),
						{ player, career, characters },
						content
					)
				: null;
		const rules = contestRules(definition, player.territory, content);
		const contest = runFirstRound(
			{ definition, shares, territory: player.territory, entry },
			rules,
			currentRng,
			content
		);
		currentRng = contest.rng;
		const report = contest.report;
		if (campaign && report.stage === 'runoff_pending') {
			runoffs.push(campaign.campaignId);
		} else if (campaign) {
			const settled = settleCampaign(
				{ player, resources, career, characters, relationships },
				campaign,
				issue ? null : report,
				issue,
				turn,
				content
			);
			({ player, career, relationships } = settled.parts);
			Object.assign(resources, settled.parts.resources);
			mandateChanges.push(...settled.mandates);
			people.push(...settled.people);
			campaignRecords.push(settled.record);
		}

		// Scrutin tenu, puis échéance suivante un cycle plus tard.
		const held = career.ballots.map((entry) =>
			entry.ballotId === ballot.ballotId
				? { ...entry, status: 'held' as const, shares, winnerPartyId, report }
				: entry
		);
		career = {
			...career,
			ballots: [
				...held,
				newBallot(held, ballot.electionId, turn + definition.cycleTurns, false, content)
			]
		};
		ballotRecords.push({
			ballotId: ballot.ballotId,
			electionId: ballot.electionId,
			winnerPartyId,
			governingBefore,
			governingAfter
		});
	}

	return {
		world: currentWorld,
		player,
		resources,
		career,
		characters,
		relationships,
		rng: currentRng,
		record: {
			mandates: mandateChanges,
			ballots: ballotRecords,
			campaigns: campaignRecords,
			people,
			runoffs,
			investitures
		}
	};
}

// ---------------------------------------------------------------------------
// Procès-verbal et second tour (P3-29)
// ---------------------------------------------------------------------------

/** Mandats locaux comptés comme appui des grands électeurs (sénatoriales). */
function localMandates(mandates: readonly MandateInstance[], content: Content): number {
	return activeMandates(mandates).filter((mandate) => {
		const election = content.mandates[mandate.mandateId]?.election;
		const scope = election ? content.elections[election]?.scope : undefined;
		return scope === 'local' || scope === 'regional';
	}).length;
}

/**
 * Entrée du joueur au procès-verbal : score de campagne de la tête de liste
 * (prime des grands électeurs aux sénatoriales), ou renfort de la liste du
 * colistier par sa préparation ; adversaire nommé et sa force.
 */
export function playerEntry(
	campaign: Campaign,
	shares: readonly BallotShare[],
	incumbent: boolean,
	parts: {
		readonly player: PlayerState;
		readonly career: Pick<CareerParts, 'mandates' | 'campaigns'>;
		readonly characters: Readonly<Record<string, Character>>;
	},
	content: Content,
	knownOnly = false
): PlayerEntry {
	const definition = content.elections[campaign.electionId]!;
	const balance = content.balance.campaigns;
	const contests = content.balance.elections.contests;
	const partyPercent = shares.find((share) => share.partyId === campaign.partyId)?.percent ?? 0;
	const weight =
		campaign.role === 'colistier'
			? (Math.min(campaign.preparation, balance.preparationCap) *
					balance.preparationWeightPercent *
					contests.colistierPreparationPercent) /
				10000
			: campaignScore(
					campaign,
					parts.player.popularity,
					parts.player.activists,
					partyPercent,
					incumbent,
					content
				) +
				(definition.system === 'senate'
					? contests.grandElectorBonus * localMandates(parts.career.mandates, content)
					: 0);
	const opponent = campaign.opponentId ? parts.characters[campaign.opponentId] : undefined;
	return {
		campaign,
		weight,
		opponent: opponent
			? {
					id: opponent.id,
					partyId: opponent.partyId,
					weight:
						opponentStrength(
							campaign,
							parts.characters,
							parts.career.campaigns,
							content,
							knownOnly
						) + localRivalModifier(parts.player.territory, campaign.electionId, content)
				}
			: null
	};
}

/** Parties de l'état touchées par le jugement d'une candidature. */
export interface SettleParts {
	readonly player: PlayerState;
	readonly resources: Readonly<Record<ResourceId, number>>;
	readonly career: CareerParts;
	readonly characters: Readonly<Record<string, Character>>;
	readonly relationships: Readonly<Record<string, Relationship>>;
}

/**
 * Juge une candidature d'après le procès-verbal définitif (ou son
 * invalidation) : mandats (siège de majorité ou d'opposition, mairie pour la
 * tête de la liste victorieuse), influence, stress, remboursement forfaitaire,
 * avance personnelle et rivalité. `turn` est le trimestre du résultat.
 */
export function settleCampaign(
	parts: SettleParts,
	campaign: Campaign,
	report: BallotReport | null,
	issue: string | null,
	turn: Turn,
	content: Content
): {
	parts: SettleParts;
	mandates: PoliticalChange[];
	people: PeopleChange[];
	record: DeadlinesRecord['campaigns'][number];
} {
	const definition = content.elections[campaign.electionId]!;
	const balance = content.balance.campaigns;
	const ballotTurn =
		parts.career.ballots.find((entry) => entry.ballotId === campaign.ballotId)?.turn ?? turn;
	let { player, career, relationships } = parts;
	const resources: Record<ResourceId, number> = { ...parts.resources };
	const mandates: PoliticalChange[] = [];
	const people: PeopleChange[] = [];
	const own = report?.contestants.find((contestant) => contestant.player);
	const status: Exclude<CampaignStatus, 'running'> =
		issue !== null || report === null
			? 'disqualified'
			: own?.status === 'withdrawn'
				? 'withdrawn'
				: report.playerElected
					? 'won'
					: 'lost';
	const playerPercent = status === 'disqualified' ? null : playerFinalPercent(report!);
	const firstRound =
		status === 'disqualified' || campaign.role === 'colistier'
			? null
			: playerFirstRoundPercent(report!);
	if (status === 'won') {
		const side = playerSide(report!);
		const grants: { mandate: string; side: MandateInstance['side'] }[] = [
			{ mandate: definition.grants, side }
		];
		if (definition.headGrant && playerHeadsWinner(report!)) {
			grants.push({ mandate: definition.headGrant, side: null });
		}
		for (const grant of grants) {
			const granted = applyCareerEffect(
				{ op: 'grantMandate', mandate: grant.mandate },
				career,
				turn,
				null,
				content,
				player
			);
			career = {
				...granted.parts,
				mandates: granted.parts.mandates.map((mandate, index) =>
					index === granted.parts.mandates.length - 1 &&
					granted.parts.mandates.length > career.mandates.length
						? { ...mandate, side: grant.side }
						: mandate
				)
			};
			mandates.push(...granted.changes);
		}
		resources.influence += balance.victoryInfluence;
	} else if (status === 'lost' || status === 'withdrawn') {
		// Une défaite coûte, mais fait connaître : la carrière continue.
		resources.influence += balance.defeatInfluence;
		if (status === 'lost') {
			player = { ...player, stress: Math.min(GAUGE_MAX, player.stress + balance.defeatStress) };
		}
	}
	// Frais de campagne remboursés au forfait à partir d'un score minimal au premier tour.
	resources.politicalBudgetCents += campaignRefund(definition, status, firstRound, content);
	// La rivalité laisse des traces : attitude en baisse et souvenir daté.
	const opponent = campaign.opponentId ? parts.characters[campaign.opponentId] : undefined;
	if (opponent && status !== 'disqualified') {
		const outcome = addRelation(
			relationships,
			opponent,
			balance.rivalryAttitude,
			`${definition.label} (${formatTurn(ballotTurn)}) : votre ${status === 'won' ? 'victoire' : 'défaite'}.`,
			Math.max(turn, ballotTurn + 1),
			content
		);
		relationships = outcome.relationships;
		people.push(...outcome.changes);
	}
	career = {
		...career,
		campaigns: career.campaigns.map((entry) =>
			entry.campaignId === campaign.campaignId
				? { ...entry, status, playerPercent, reason: issue, resultTurn: turn }
				: entry
		)
	};
	// Avance personnelle (P3-23) : rendue à partir d'un score minimal, perdue sinon.
	const scored = playerPercent ?? 0;
	const repaid =
		campaign.advanceCents > 0 &&
		status !== 'disqualified' &&
		scored >= balance.advanceRepayMinPercent;
	if (repaid) resources.personalCashCents += campaign.advanceCents;
	return {
		parts: { player, resources, career, characters: parts.characters, relationships },
		mandates,
		people,
		record: {
			campaignId: campaign.campaignId,
			opponentId: campaign.opponentId,
			status,
			playerPercent,
			reason: issue,
			advance: campaign.advanceCents > 0 ? { cents: campaign.advanceCents, repaid } : null
		}
	};
}

/** Candidature dont le second tour attend la décision du joueur, la plus ancienne d'abord. */
export function pendingRunoff(
	parts: Pick<CareerParts, 'campaigns' | 'ballots'>
): { campaign: Campaign; ballot: Ballot; report: BallotReport } | null {
	for (const campaign of runningCampaigns(parts.campaigns)) {
		const ballot = parts.ballots.find((entry) => entry.ballotId === campaign.ballotId);
		if (ballot?.report?.stage === 'runoff_pending') {
			return { campaign, ballot, report: ballot.report };
		}
	}
	return null;
}

/** Raison pour laquelle cette décision d'entre-deux-tours est impossible, ou `null`. */
export function runoffIssue(
	decision: RunoffDecision,
	campaignIdValue: string | null,
	parts: Pick<CareerParts, 'campaigns' | 'ballots'>,
	player: Pick<PlayerState, 'territory'>,
	content: Content
): string | null {
	const pending = pendingRunoff(parts);
	if (!pending || (campaignIdValue !== null && pending.campaign.campaignId !== campaignIdValue)) {
		return 'Aucun second tour n’attend votre décision.';
	}
	const definition = content.elections[pending.campaign.electionId]!;
	const rules = contestRules(definition, player.territory, content);
	const own = pending.report.contestants.find((contestant) => contestant.player);
	if (decision === 'maintain' && own?.status !== 'qualified') {
		return rules.system === 'single'
			? 'Il faut 12,5 % des inscrits pour se maintenir.'
			: 'Il faut 10 % des suffrages pour se maintenir.';
	}
	if (decision === 'merge') {
		if (rules.mergePerMille <= 0) return 'Aucune fusion possible à ce scrutin.';
		if (!canMerge(pending.report, rules))
			return 'Il faut 5 % des suffrages et une liste qualifiée.';
	}
	return null;
}

/**
 * Second tour après la décision du joueur (choix de l'événement
 * d'entre-deux-tours) : procès-verbal définitif, puis jugement de la
 * candidature au trimestre courant. Sans second tour en attente, rien.
 */
export function resolveRunoff(
	parts: SettleParts,
	decision: RunoffDecision,
	campaignIdValue: string | null,
	turn: Turn,
	rng: RngState,
	content: Content
): { parts: SettleParts; rng: RngState; politics: PoliticalChange[]; people: PeopleChange[] } {
	if (runoffIssue(decision, campaignIdValue, parts.career, parts.player, content)) {
		return { parts, rng, politics: [], people: [] };
	}
	const pending = pendingRunoff(parts.career)!;
	const definition = content.elections[pending.campaign.electionId]!;
	const rules = contestRules(definition, parts.player.territory, content);
	const second = runSecondRound(pending.report, rules, decision, rng, content);
	const career: CareerParts = {
		...parts.career,
		ballots: parts.career.ballots.map((entry) =>
			entry.ballotId === pending.ballot.ballotId ? { ...entry, report: second.report } : entry
		)
	};
	const settled = settleCampaign(
		{ ...parts, career },
		pending.campaign,
		second.report,
		null,
		turn,
		content
	);
	return {
		parts: settled.parts,
		rng: second.rng,
		politics: [
			{
				kind: 'runoff',
				campaignId: pending.campaign.campaignId,
				decision,
				status: settled.record.status,
				playerPercent: settled.record.playerPercent
			},
			...settled.mandates
		],
		people: settled.people
	};
}

// ---------------------------------------------------------------------------
// Investiture nationale (P3-30)
// ---------------------------------------------------------------------------

/** Raison pour laquelle le joueur ne peut demander l'investiture à cette échéance, ou `null`. */
export function investitureIssue(
	ballotIdValue: string,
	parts: CareerParts,
	player: PlayerState,
	turn: Turn,
	content: Content
): string | null {
	const ballot = parts.ballots.find((entry) => entry.ballotId === ballotIdValue);
	const definition = ballot ? content.elections[ballot.electionId] : undefined;
	if (!ballot || !definition) return 'Aucune élection programmée à cette date.';
	if (!definition.investiture) return 'Ce scrutin ne passe pas par une investiture nationale.';
	if (player.partyId === null) return 'Il faut être membre d’un parti.';
	if (parts.investitures.some((request) => request.ballotId === ballot.ballotId)) {
		return 'L’investiture a déjà été demandée pour ce scrutin.';
	}
	return candidacyIssue(ballotIdValue, parts, player, turn, content, 'head', true);
}

/** Facteur observable de l'appréciation d'une investiture. */
export interface InvestitureFactor {
	readonly label: string;
	readonly favorable: boolean;
}

/**
 * Appréciation d'une demande d'investiture : seuls des facteurs observables
 * (appareil, influence, mandats, ancrage, popularité, candidat mieux placé)
 * et une appréciation qualitative sont montrés ; la chance reste interne.
 */
export function investitureAppraisal(
	ballotIdValue: string,
	player: PlayerState,
	influence: number,
	mandates: readonly MandateInstance[],
	content: Content
): { chancePercent: number; label: string; factors: InvestitureFactor[] } {
	const rules = content.balance.campaigns.investiture;
	const apparatus = player.supports[content.balance.campaigns.apparatusGroup] ?? 0;
	const held = activeMandates(mandates).length;
	const local = localMandates(mandates, content) > 0;
	const rival =
		hashSeed(`${ballotIdValue}:${player.partyId ?? ''}`) % 100 < rules.rivalChancePercent;
	const score =
		(apparatus * rules.apparatusPercent +
			Math.min(100, influence) * rules.influencePercent +
			player.popularity * rules.popularityPercent) /
			100 +
		Math.min(rules.mandateCap, held * rules.mandatePoints) +
		(local ? rules.localPoints : 0) -
		(rival ? rules.rivalPenalty : 0) +
		// Un cadre, et plus encore le chef, accèdent mieux aux investitures (P3-34).
		(player.partyCareer?.rank === 'leader'
			? content.balance.partyCareer.leaderInvestitureBonus
			: player.partyCareer?.rank === 'cadre'
				? content.balance.partyCareer.cadreInvestitureBonus
				: 0);
	const chancePercent = Math.round(
		Math.min(rules.maxChancePercent, Math.max(rules.minChancePercent, score))
	);
	const factors: InvestitureFactor[] = [
		apparatus >= 50
			? { label: 'l’appareil vous soutient', favorable: true }
			: apparatus < 25
				? { label: 'l’appareil vous connaît mal', favorable: false }
				: { label: 'l’appareil reste partagé', favorable: apparatus >= 35 },
		influence >= 60
			? { label: 'une influence reconnue', favorable: true }
			: { label: 'une influence encore modeste', favorable: false },
		held > 0
			? { label: `${held} mandat(s) exercé(s)`, favorable: true }
			: { label: 'aucun mandat exercé', favorable: false },
		local
			? { label: 'un ancrage local', favorable: true }
			: { label: 'pas d’ancrage local', favorable: false },
		player.popularity >= 45
			? { label: 'une popularité solide', favorable: true }
			: { label: 'une popularité fragile', favorable: false },
		...(rival ? [{ label: 'un candidat mieux placé brigue la place', favorable: false }] : []),
		...(player.partyCareer?.rank === 'leader'
			? [{ label: 'vous dirigez le parti', favorable: true }]
			: player.partyCareer?.rank === 'cadre'
				? [{ label: 'vous êtes cadre du parti', favorable: true }]
				: [])
	];
	const label =
		chancePercent >= rules.supportedFrom
			? 'Candidature soutenue'
			: chancePercent >= rules.disputedFrom
				? 'Investiture disputée'
				: 'Investiture peu probable';
	return { chancePercent, label, factors };
}

/** Candidature de tête créée par une investiture accordée ou une dissidence. */
function headCampaign(
	parts: CareerParts,
	ballot: Ballot,
	partyId: string,
	invested: boolean,
	turn: Turn
): Campaign {
	return {
		campaignId: campaignId(parts.campaigns.length + 1),
		ballotId: ballot.ballotId,
		electionId: ballot.electionId,
		declaredTurn: turn,
		partyId,
		invested,
		preparation: 0,
		advanceCents: 0,
		opponentId: null,
		status: 'running',
		playerPercent: null,
		reason: null,
		role: 'head',
		listRank: 1,
		resultTurn: null
	};
}

/**
 * Demandes en attente tranchées à la frontière (une seule fois, tirage seedé) :
 * accordée, la candidature investie est déposée ; refusée, les motifs
 * défavorables sont consignés et le choix suivra au trimestre suivant.
 */
function resolveInvestitures(
	career: CareerParts,
	player: PlayerState,
	influence: number,
	turn: Turn,
	rng: RngState,
	content: Content
): {
	career: CareerParts;
	rng: RngState;
	changes: PoliticalChange[];
	resolved: { requestId: string; granted: boolean }[];
} {
	let current = rng;
	let parts = career;
	const changes: PoliticalChange[] = [];
	const resolved: { requestId: string; granted: boolean }[] = [];
	for (const request of career.investitures) {
		if (request.status !== 'pending') continue;
		const ballot = parts.ballots.find((entry) => entry.ballotId === request.ballotId);
		const appraisal = investitureAppraisal(
			request.ballotId,
			player,
			influence,
			parts.mandates,
			content
		);
		const draw = nextInt(current, 1, 100);
		current = draw.rng;
		const open =
			ballot?.status === 'scheduled' &&
			player.partyId === request.partyId &&
			candidacyIssue(request.ballotId, parts, player, turn, content, 'head', true) === null;
		const granted = open && draw.value <= appraisal.chancePercent;
		const reasons = granted
			? []
			: open
				? appraisal.factors.filter((factor) => !factor.favorable).map((factor) => factor.label)
				: ['votre candidature n’est plus recevable'];
		const status: InvestitureRequest['status'] = granted ? 'granted' : 'refused';
		parts = {
			...parts,
			investitures: parts.investitures.map((entry) =>
				entry.requestId === request.requestId
					? { ...entry, status, resolvedTurn: turn, reasons }
					: entry
			)
		};
		changes.push({
			kind: 'investiture',
			requestId: request.requestId,
			ballotId: request.ballotId,
			status
		});
		if (granted && ballot) {
			const campaign = headCampaign(parts, ballot, request.partyId, true, request.requestedTurn);
			parts = { ...parts, campaigns: [...parts.campaigns, campaign] };
			changes.push({
				kind: 'candidacy',
				campaignId: campaign.campaignId,
				ballotId: ballot.ballotId,
				invested: true
			});
		}
		resolved.push({ requestId: request.requestId, granted });
	}
	return { career: parts, rng: current, changes, resolved };
}

/** Demande refusée qui attend la décision du joueur, la plus ancienne d'abord. */
export function refusedInvestiture(
	parts: Pick<CareerParts, 'investitures'>
): InvestitureRequest | null {
	return parts.investitures.find((request) => request.status === 'refused') ?? null;
}

/**
 * Décision après un refus : renoncer (l'appareil apprécie la discipline) ou se
 * présenter en dissident, sans étiquette ni moyens du parti (l'appareil s'en
 * détourne). Renvoie la variation d'appui de l'appareil à appliquer.
 */
export function decideInvestiture(
	parts: CareerParts,
	decision: 'dissident' | 'renounce',
	turn: Turn,
	content: Content
): { parts: CareerParts; changes: PoliticalChange[]; apparatusDelta: number } {
	const request = refusedInvestiture(parts);
	if (!request) return { parts, changes: [], apparatusDelta: 0 };
	const rules = content.balance.campaigns.investiture;
	const ballot = parts.ballots.find((entry) => entry.ballotId === request.ballotId);
	const dissident = decision === 'dissident' && ballot?.status === 'scheduled';
	const status: InvestitureRequest['status'] = dissident ? 'dissident' : 'renounced';
	let career: CareerParts = {
		...parts,
		investitures: parts.investitures.map((entry) =>
			entry.requestId === request.requestId ? { ...entry, status } : entry
		)
	};
	const changes: PoliticalChange[] = [
		{ kind: 'investiture', requestId: request.requestId, ballotId: request.ballotId, status }
	];
	if (dissident) {
		const campaign = headCampaign(career, ballot, request.partyId, false, turn);
		career = { ...career, campaigns: [...career.campaigns, campaign] };
		changes.push({
			kind: 'candidacy',
			campaignId: campaign.campaignId,
			ballotId: ballot.ballotId,
			invested: false
		});
	}
	return {
		parts: career,
		changes,
		apparatusDelta: dissident ? -rules.dissidentApparatus : Math.ceil(rules.dissidentApparatus / 3)
	};
}
