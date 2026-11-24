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
	type ResourceAmount,
	type ResourceId,
	type Resources
} from '../content/types.ts';
import { ageAt, formatTurn, type Turn } from './calendar.ts';
import { addRelation, generatePerson, meet, sortedIds } from './characters.ts';
import { nextInt, type RngState } from './random.ts';
import type {
	Ballot,
	BallotShare,
	Campaign,
	Character,
	PeopleChange,
	PlayerState,
	Relationship,
	DeadlinesRecord,
	InstitutionsState,
	MandateEndReason,
	MandateInstance,
	PoliticalChange,
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
		cancelReason: null
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
	const remaining = active.length - (replaceIncompatible ? conflicts.length : 0);
	if (remaining + 1 > institutions.maxMandates) {
		return `Cumul limité à ${institutions.maxMandates} mandats.`;
	}
	return null;
}

function endMandates(
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
			'grantMandate' | 'endMandate' | 'callEarlyElection' | 'declareCandidacy' | 'prepareCampaign';
	}
>;

export function isCareerEffect(effect: Effect): effect is CareerEffect {
	return (
		effect.op === 'grantMandate' ||
		effect.op === 'endMandate' ||
		effect.op === 'callEarlyElection' ||
		effect.op === 'declareCandidacy' ||
		effect.op === 'prepareCampaign'
	);
}

export interface CareerParts {
	readonly mandates: readonly MandateInstance[];
	readonly ballots: readonly Ballot[];
	readonly campaigns: readonly Campaign[];
	readonly institutions: InstitutionsState;
}

export function runningCampaigns(campaigns: readonly Campaign[]): Campaign[] {
	return campaigns.filter((campaign) => campaign.status === 'running');
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
export function candidacyIssue(
	ballotIdValue: string,
	parts: CareerParts,
	player: PlayerState,
	turn: Turn,
	content: Content
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
	player: PlayerState
): { parts: CareerParts; changes: PoliticalChange[] } {
	switch (effect.op) {
		case 'declareCandidacy': {
			if (target === null || candidacyIssue(target, parts, player, turn, content)) {
				return { parts, changes: [] };
			}
			const ballot = parts.ballots.find((entry) => entry.ballotId === target)!;
			const apparatus = player.supports[content.balance.campaigns.apparatusGroup] ?? 0;
			const campaign: Campaign = {
				campaignId: campaignId(parts.campaigns.length + 1),
				ballotId: ballot.ballotId,
				electionId: ballot.electionId,
				declaredTurn: turn,
				partyId: player.partyId,
				invested:
					player.partyId !== null && apparatus >= content.balance.campaigns.investitureMinApparatus,
				preparation: 0,
				opponentId: null,
				status: 'running',
				playerPercent: null,
				reason: null
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
			if (holdIssue(effect.mandate, parts.mandates, parts.institutions, content, replace)) {
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
				endReason: null
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
	content: Content | null
): string | null {
	if (effect.op !== 'grantMandate') return null;
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
 * Score du joueur avant aléa : popularité, part du parti s'il est investi,
 * préparation plafonnée et prime du sortant. Les poids sont des pourcentages.
 */
export function campaignScore(
	campaign: Campaign,
	popularity: number,
	partyPercent: number,
	incumbent: boolean,
	content: Content
): number {
	const balance = content.balance.campaigns;
	return Math.round(
		(popularity * balance.popularityWeightPercent +
			(campaign.invested ? partyPercent * balance.partyWeightPercent : 0) +
			Math.min(campaign.preparation, balance.preparationCap) * balance.preparationWeightPercent) /
			100 +
			(incumbent ? balance.incumbentBonus : 0)
	);
}

function percentOf(player: number, rival: number): number {
	const left = Math.max(1, player);
	const right = Math.max(1, rival);
	return Math.round((left * 100) / (left + right));
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
	// Le sondage ne connaît de l'adversaire que ses traits connus du joueur.
	const rival = opponentStrength(campaign, characters, campaigns, content, true);
	const incumbent = activeMandates(mandates).some(
		(mandate) => mandate.mandateId === definition.grants
	);
	const score = campaignScore(
		campaign,
		player.popularity,
		partyPollShare(campaign.partyId, world, content),
		incumbent,
		content
	);
	// Un collaborateur qui sonde l'électorat resserre la fourchette selon sa compétence.
	const volatility = Math.round(
		content.balance.campaigns.volatility *
			(pollingCompetence === null ? 1 : Math.max(0.25, 1 - pollingCompetence / 150))
	);
	return {
		min: percentOf(score - volatility, rival + volatility),
		max: percentOf(score + volatility, rival - volatility)
	};
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

	// 0. Campagnes en cours : préparation passive et exposition (stress).
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
			record: { mandates: [], ballots: [], campaigns: [], people }
		};
	}

	const mandateChanges: PoliticalChange[] = [];
	const campaignRecords: DeadlinesRecord['campaigns'][number][] = [];

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

		// Candidature du joueur : revalidée au jour du scrutin, puis jugée.
		for (const campaign of runningCampaigns(career.campaigns)) {
			if (campaign.ballotId !== ballot.ballotId) continue;
			const issue = eligibilityIssue(ballot, career, content);
			let status: Exclude<Campaign['status'], 'running'>;
			let playerPercent: number | null = null;
			if (issue) {
				status = 'disqualified';
			} else {
				const partyPercent =
					shares.find((share) => share.partyId === campaign.partyId)?.percent ?? 0;
				let score = campaignScore(
					campaign,
					player.popularity,
					partyPercent,
					outgoing.has(definition.grants),
					content
				);
				let rival = opponentStrength(campaign, characters, career.campaigns, content);
				if (campaignBalance.volatility > 0) {
					const own = nextInt(currentRng, -campaignBalance.volatility, campaignBalance.volatility);
					const other = nextInt(own.rng, -campaignBalance.volatility, campaignBalance.volatility);
					currentRng = other.rng;
					score += own.value;
					rival += other.value;
				}
				playerPercent = percentOf(score, rival);
				status = playerPercent > 50 ? 'won' : 'lost';
			}
			if (status === 'won') {
				const grants = [definition.grants];
				if (definition.bonusGrant && (playerPercent ?? 0) >= definition.bonusGrant.minPercent) {
					grants.push(definition.bonusGrant.mandate);
				}
				for (const mandateId of grants) {
					const granted = applyCareerEffect(
						{ op: 'grantMandate', mandate: mandateId },
						career,
						turn,
						null,
						content,
						player
					);
					career = granted.parts;
					mandateChanges.push(...granted.changes);
				}
				resources.influence += campaignBalance.victoryInfluence;
			} else if (status === 'lost') {
				// Une défaite coûte, mais fait connaître : la carrière continue.
				resources.influence += campaignBalance.defeatInfluence;
				player = {
					...player,
					stress: Math.min(GAUGE_MAX, player.stress + campaignBalance.defeatStress)
				};
			}
			// La rivalité laisse des traces : attitude en baisse et souvenir daté.
			const opponent = campaign.opponentId ? characters[campaign.opponentId] : undefined;
			if (opponent && status !== 'disqualified') {
				const outcome = addRelation(
					relationships,
					opponent,
					campaignBalance.rivalryAttitude,
					`${definition.label} (${formatTurn(turn)}) : votre ${status === 'won' ? 'victoire' : 'défaite'}.`,
					turn + 1,
					content
				);
				relationships = outcome.relationships;
				people.push(...outcome.changes);
			}
			career = {
				...career,
				campaigns: career.campaigns.map((entry) =>
					entry.campaignId === campaign.campaignId
						? { ...entry, status, playerPercent, reason: issue }
						: entry
				)
			};
			campaignRecords.push({
				campaignId: campaign.campaignId,
				opponentId: campaign.opponentId,
				status,
				playerPercent,
				reason: issue
			});
		}

		// Scrutin tenu, puis échéance suivante un cycle plus tard.
		const held = career.ballots.map((entry) =>
			entry.ballotId === ballot.ballotId
				? { ...entry, status: 'held' as const, shares, winnerPartyId }
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
		record: { mandates: mandateChanges, ballots: ballotRecords, campaigns: campaignRecords, people }
	};
}
