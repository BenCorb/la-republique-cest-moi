/**
 * Projection publique de la partie (`PlayerView`, ARCHITECTURE.md §9).
 *
 * Seule source de données de l'interface. Elle ne contient que ce que le joueur
 * peut savoir : valeurs courantes, coûts et effets certains, fourchettes,
 * tendances rédigées, statut des producteurs. Jamais le PRNG, les probabilités,
 * les effets des choix d'événements ni leurs suites. Fonction pure : la calculer
 * n'avance pas le PRNG et ne modifie rien.
 */
import {
	INDICATOR_IDS,
	RESOURCE_IDS,
	type Content,
	type Effect,
	type ResourceAmount,
	type ResourceId
} from '../content/types.ts';
import {
	accelerationAlerts,
	ageAt,
	careerSummary,
	describePendingEvent,
	effectRange,
	formatTurn,
	previewPlan,
	renderTemplate,
	type ChoiceRecord,
	type EffectRange,
	type GameState,
	type HistoryEntry,
	type PeopleChange,
	type PlanStep,
	type CharactersRecord,
	displayName,
	type PoliticalChange,
	type Ballot,
	type DeadlinesRecord,
	type MandateEndReason,
	type StaffLeaveReason,
	activeMandates,
	activeStaff,
	countsTowardCumul,
	cumulatedMandates,
	type MandateInstance,
	campaignPoll,
	livingChildren,
	pollingCompetence,
	postUnlocked,
	staffTimeBonus,
	hashSeed,
	mainMandate,
	reservedTime,
	type WellbeingSource,
	type WorldRecord,
	type PlanPreview,
	type FamilyRecord,
	type StaffRecord
} from '../engine/index.ts';
import {
	GAUGE_NAMES,
	INDICATOR_NAMES,
	RESOURCE_NAMES,
	describeAxisPosition,
	describeCompetence,
	describePopularity,
	describeSupport,
	describeHealth,
	describeIndicator,
	describeStress,
	formatDelta,
	formatGaugeDelta,
	formatRange,
	formatResource,
	type GaugeDescription
} from './format.ts';

export interface ResourceView {
	readonly id: ResourceId;
	readonly name: string;
	readonly value: string;
	/** Variation prévue sur le trimestre (plan, charges et production). */
	readonly forecast: string;
}

export interface PlanStepView {
	readonly index: number;
	readonly kind: PlanStep['kind'];
	readonly label: string;
	readonly timeCost: number;
	readonly details: readonly string[];
	readonly issues: readonly string[];
	/** Achat : rappel que la production commence au trimestre suivant. */
	readonly note: string | null;
}

export interface PlanView {
	readonly steps: readonly PlanStepView[];
	readonly timeAvailable: number;
	/** Temps réservé par les mandats, déjà retiré du temps disponible. */
	readonly timeReserved: number;
	readonly timeUsed: number;
	readonly timeRemaining: number;
	readonly valid: boolean;
	readonly issues: readonly string[];
	readonly warnings: readonly string[];
	readonly changes: readonly { readonly name: string; readonly text: string }[];
	readonly stressAfter: GaugeDescription;
	readonly healthAfter: { readonly min: number; readonly max: number };
}

export interface CatalogItemView {
	readonly kind: PlanStep['kind'];
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly timeCost: number;
	readonly costs: readonly string[];
	readonly effects: readonly string[];
	/** Occurrences déjà dans le plan. */
	readonly planned: number;
	readonly addable: boolean;
	/** Raison pour laquelle l'élément ne peut pas être ajouté au plan. */
	readonly reason: string | null;
}

export interface UpgradeView extends CatalogItemView {
	readonly family: string;
	readonly treasury: string;
	readonly upkeep: readonly string[];
	readonly owned: number;
	readonly maxOwned: number;
}

export interface ProducerView {
	readonly instanceId: string;
	readonly upgradeId: string;
	readonly label: string;
	readonly status: 'active' | 'suspended' | 'pending';
	readonly statusLabel: string;
	readonly upkeep: readonly string[];
	readonly production: readonly string[];
}

/**
 * Éléments de l'organisation regroupés par type (« Militant bénévole × 4 ») :
 * effectifs, charges et production cumulées ce trimestre, départ planifiable.
 */
export interface OrganisationGroupView {
	readonly upgradeId: string;
	readonly label: string;
	/** Exemplaires possédés au début du trimestre. */
	readonly owned: number;
	readonly active: number;
	readonly pending: number;
	readonly suspended: number;
	/** Départs déjà prévus dans le plan. */
	readonly releasesPlanned: number;
	readonly upkeep: readonly string[];
	readonly production: readonly string[];
	/** Effets propres d'un départ (par exemple sur les militants). */
	readonly releaseEffects: readonly string[];
	/** Prochain départ possible : étape à ajouter au plan, ou motif du refus. */
	readonly release: { readonly step: PlanStep | null; readonly reason: string | null } | null;
}

export interface ChoiceView {
	readonly id: string;
	readonly label: string;
	readonly hints: readonly string[];
	readonly costs: readonly string[];
	readonly available: boolean;
	readonly reason: string | null;
}

/**
 * Avis d'un collaborateur sur une décision (GDD §6.3) : précis s'il est très
 * compétent, indicatif sinon, et parfois faux s'il est médiocre. Il ne porte que
 * sur des effets chiffrables, jamais sur les relations ni les traits cachés.
 */
export interface AdviceView {
	readonly adviser: string;
	readonly quality: 'precise' | 'fair' | 'poor';
	/** Lignes d'avis par identifiant de choix. */
	readonly choices: Readonly<Record<string, readonly string[]>>;
}

export interface DecisionView {
	readonly instanceId: string;
	readonly title: string;
	readonly text: string;
	readonly category: string;
	readonly choices: readonly ChoiceView[];
	readonly remaining: number;
	readonly advice: AdviceView | null;
}

export interface JournalLine {
	readonly kind:
		'step' | 'economy' | 'wellbeing' | 'world' | 'people' | 'career' | 'event' | 'decision' | 'end';
	readonly text: string;
}

export interface JournalTurnView {
	readonly key: string;
	readonly label: string;
	readonly lines: readonly JournalLine[];
}

export interface Alert {
	readonly level: 'danger' | 'warning' | 'info';
	readonly text: string;
}

export interface SummaryView {
	readonly title: string;
	readonly cause: string;
	readonly lines: readonly { readonly label: string; readonly value: string }[];
}

export interface IndicatorView {
	readonly id: string;
	readonly name: string;
	readonly gauge: GaugeDescription;
}

export interface PartyView {
	readonly id: string;
	readonly name: string;
	readonly acronym: string;
	readonly family: string;
	readonly description: string;
	/** Intentions de vote : part de la force du parti dans le total, en %. */
	readonly share: number;
	readonly leader: string;
	readonly positions: readonly string[];
	readonly governing: boolean;
	readonly member: boolean;
	/** Adhésion déjà prévue dans le plan. */
	readonly joinPlanned: boolean;
	readonly joinable: boolean;
	readonly joinReason: string | null;
}

export interface WorldView {
	readonly indicators: readonly IndicatorView[];
	/** Partis par intentions de vote décroissantes. */
	readonly parties: readonly PartyView[];
	readonly governingParty: string;
	/** Situation du joueur : « Sans étiquette » ou « Membre du … depuis … ». */
	readonly affiliation: string;
	readonly partyAcronym: string | null;
	/** Action de départ du parti, si le joueur est encarté. */
	readonly leave: {
		readonly actionId: string;
		readonly planned: boolean;
		readonly addable: boolean;
		readonly reason: string | null;
	} | null;
	/** Action d'adhésion (ciblée) du catalogue, si elle existe. */
	readonly joinActionId: string | null;
	readonly joinTimeCost: number;
	readonly joinCosts: readonly string[];
}

export interface PersonView {
	readonly id: string;
	readonly name: string;
	/** Rôle principal, d'après les étiquettes. */
	readonly role: string;
	readonly age: number;
	readonly status: string;
	readonly active: boolean;
	/** Tendance de l'attitude envers le joueur (jamais le chiffre). */
	readonly attitude: string;
	readonly attitudeTone: 'good' | 'neutral' | 'warning' | 'danger';
	readonly knownTraits: readonly { readonly label: string; readonly description: string }[];
	/** Traits encore inconnus du joueur (leur nombre seul est visible). */
	readonly unknownTraits: number;
	readonly metLabel: string;
	/** Souvenirs, du plus récent au plus ancien. */
	readonly memories: readonly { readonly dateLabel: string; readonly text: string }[];
}

export interface MandateView {
	readonly instanceId: string;
	readonly label: string;
	readonly since: string;
	/** Échéance du mandat, en clair. */
	readonly ends: string;
	readonly timePerTurn: number;
	readonly income: readonly string[];
	readonly stressPerTurn: number;
	readonly resignPlanned: boolean;
	readonly resignable: boolean;
	readonly resignReason: string | null;
	/**
	 * Mandat au sein duquel cette fonction s'exerce (la mairie au sein du conseil
	 * municipal) : elle ne compte pas à part dans le cumul. `null` sinon.
	 */
	readonly within: string | null;
}

export interface BallotView {
	readonly ballotId: string;
	readonly label: string;
	readonly dateLabel: string;
	readonly turnsLeft: number;
	readonly filing: string;
	readonly early: boolean;
	/** Le joueur exerce un mandat qui prend fin à ce scrutin. */
	readonly endsMandate: boolean;
	/** Mandat brigué en cas de victoire. */
	readonly stake: string;
	/** Candidature : déjà déposée (campagne en cours), prévue dans le plan, ou possible. */
	readonly campaign: CampaignView | null;
	readonly candidacyPlanned: boolean;
	readonly candidacyAddable: boolean;
	readonly candidacyReason: string | null;
}

export interface CampaignView {
	readonly campaignId: string;
	readonly label: string;
	readonly dateLabel: string;
	readonly declared: string;
	readonly investiture: string;
	readonly preparation: number;
	/** Adversaire principal nommé, son étiquette et l'historique des affrontements. */
	readonly opponent: string | null;
	/** Sondage : fourchette du score face à l'adversaire principal (en cours seulement). */
	readonly poll: { readonly min: number; readonly max: number } | null;
	readonly outcome: string | null;
}

export interface CareerView {
	/** Fonction principale (mandat de rang le plus élevé) ou « Sans mandat ». */
	readonly mainFunction: string;
	readonly mandates: readonly MandateView[];
	readonly reservedTime: number;
	readonly resignActionId: string | null;
	readonly maxMandates: number;
	/** Mandats comptés dans le cumul (une fonction exercée au sein d'un mandat n'y compte pas). */
	readonly cumulCount: number;
	readonly incompatibilities: readonly string[];
	readonly prerequisites: readonly string[];
	readonly calendar: readonly BallotView[];
	readonly results: readonly {
		readonly ballotId: string;
		readonly label: string;
		readonly dateLabel: string;
		readonly winner: string;
		readonly shares: string;
		readonly early: boolean;
	}[];
	readonly pastMandates: readonly { readonly label: string; readonly period: string }[];
	readonly declareActionId: string | null;
	/** Campagnes passées, de la plus récente à la plus ancienne. */
	readonly pastCampaigns: readonly CampaignView[];
}

export interface SupportGroupView {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly gauge: GaugeDescription;
	/** Part du groupe dans la popularité, en % (groupes électoraux). */
	readonly share: number | null;
}

export interface SupportsView {
	readonly popularity: GaugeDescription;
	readonly electoral: readonly SupportGroupView[];
	readonly influence: readonly SupportGroupView[];
}

export interface StaffPersonView {
	readonly characterId: string;
	readonly name: string;
	readonly age: number;
	readonly competence: GaugeDescription;
	readonly knownTraits: readonly string[];
	readonly unknownTraits: number;
}

export interface PostView {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly salary: string;
	readonly lockedReason: string | null;
	readonly occupant:
		| (StaffPersonView & {
				readonly since: string;
				readonly attitude: string;
				readonly attitudeTone: PersonView['attitudeTone'];
				readonly missions: readonly {
					readonly id: string;
					readonly label: string;
					readonly description: string;
					readonly active: boolean;
				}[];
				readonly producing: boolean;
				readonly dismissPlanned: boolean;
				readonly dismissable: boolean;
				readonly dismissReason: string | null;
		  })
		| null;
	readonly candidates: readonly (StaffPersonView & {
		readonly profile: string;
		readonly planned: boolean;
		readonly hireable: boolean;
		readonly reason: string | null;
	})[];
}

export interface EntourageView {
	readonly posts: readonly PostView[];
	readonly hireActionId: string | null;
	readonly dismissActionId: string | null;
	/** Temps rendu ce trimestre par les missions qui tiennent l'agenda. */
	readonly timeBonus: number;
	readonly former: readonly {
		readonly name: string;
		readonly post: string;
		readonly period: string;
	}[];
}

export interface PlayerView {
	readonly dateLabel: string;
	readonly age: number;
	readonly phase: GameState['phase'];
	readonly resources: readonly ResourceView[];
	readonly health: GaugeDescription;
	readonly stress: GaugeDescription;
	readonly plan: PlanView;
	readonly actions: readonly CatalogItemView[];
	readonly upgrades: readonly UpgradeView[];
	readonly producers: readonly ProducerView[];
	readonly organisation: readonly OrganisationGroupView[];
	readonly decision: DecisionView | null;
	readonly journal: readonly JournalTurnView[];
	readonly press: readonly {
		readonly key: string;
		readonly dateLabel: string;
		readonly title: string;
	}[];
	readonly alerts: readonly Alert[];
	readonly summary: SummaryView | null;
	readonly world: WorldView;
	/** Personnages rencontrés : actifs d'abord, puis par date de rencontre. */
	readonly people: readonly PersonView[];
	/** Profil du personnage : origine, profession et situation familiale. */
	readonly profile: {
		readonly origin: string;
		readonly profession: string;
		readonly family: string;
	};
	readonly career: CareerView;
	readonly supports: SupportsView;
	readonly entourage: EntourageView;
}

const FAMILY_LABELS: Readonly<Record<string, string>> = {
	organization: 'Organisation',
	communication: 'Communication',
	network: 'Réseau',
	personal: 'Vie personnelle'
};

const SOURCE_LABELS: { readonly [K in WellbeingSource]: string } = {
	workload: 'charge de travail',
	recovery: 'récupération',
	high_stress: 'stress élevé',
	calm: 'calme retrouvé',
	ageing: 'âge'
};

const CAUSE_LABELS = {
	health_failure: 'Épuisement : la santé a fini par céder.',
	natural_causes: 'Mort naturelle.'
} as const;

function amounts(list: readonly ResourceAmount[], sign: 1 | -1): string[] {
	return list.map(
		(amount) =>
			`${RESOURCE_NAMES[amount.resource]} ${formatDelta(amount.resource, sign * amount.amount)}`
	);
}

const PARTY_REFERENCE_LABELS: Readonly<Record<string, string>> = {
	governing: 'parti au gouvernement',
	player: 'votre parti',
	opposition: 'premier parti d’opposition',
	target: 'parti choisi'
};

function partyLabel(party: string | null, content: Content): string {
	if (party === null) return 'votre parti';
	return content.parties[party]?.name ?? PARTY_REFERENCE_LABELS[party] ?? party;
}

function describeEffect(range: EffectRange, content: Content): string {
	switch (range.kind) {
		case 'resource':
			return `${RESOURCE_NAMES[range.resource]} ${formatRange(range.resource, range.min, range.max)}`;
		case 'gauge':
			return `${GAUGE_NAMES[range.gauge]} ${formatGaugeDelta(range.min)}`;
		case 'indicator':
			return `${INDICATOR_NAMES[range.indicator]} ${formatGaugeDelta(range.value)}`;
		case 'support':
			return `Soutien : ${content.supportGroups[range.group]?.label ?? range.group} ${formatGaugeDelta(range.value)}`;
		case 'partyStrength':
			return `Intentions de vote (${partyLabel(range.party, content)}) ${formatGaugeDelta(range.value)}`;
		case 'affiliation':
			return range.change === 'join'
				? `Adhésion : ${partyLabel(range.party, content)}`
				: 'Départ de votre parti';
		case 'people':
			return 'Relation avec un personnage';
		case 'mandate':
			return range.change === 'grant'
				? `Mandat : ${content.mandates[range.mandate]?.label ?? range.mandate}`
				: range.mandate === 'target'
					? 'Fin du mandat choisi'
					: `Fin du mandat : ${content.mandates[range.mandate]?.label ?? range.mandate}`;
		case 'earlyElection':
			return `Élection anticipée : ${content.elections[range.election]?.label ?? range.election}`;
		case 'candidacy':
			return 'Candidature déposée';
		case 'family':
			return range.change === 'attitude'
				? `Famille ${range.value > 0 ? 'apaisée' : 'agacée'}`
				: 'Vie de famille';
		case 'staff':
			return range.change === 'hire'
				? 'Embauche'
				: range.change === 'dismiss'
					? 'Renvoi'
					: 'Départ d’un collaborateur';
		case 'release':
			return 'Départ de l’organisation';
		case 'preparation':
			return `Préparation de campagne + ${range.value}`;
	}
}

function politicsText(changes: readonly PoliticalChange[], content: Content): string {
	return changes
		.map((change) => {
			switch (change.kind) {
				case 'indicator':
					return `${INDICATOR_NAMES[change.indicator]} ${formatGaugeDelta(change.delta)}`;
				case 'partyStrength':
					return `${content.parties[change.partyId]?.acronym ?? change.partyId} ${formatGaugeDelta(change.delta)}`;
				case 'joined':
					return `adhésion au ${content.parties[change.partyId]?.name ?? change.partyId}`;
				case 'left':
					return `départ du ${content.parties[change.partyId]?.name ?? change.partyId}`;
				case 'support':
					return `${content.supportGroups[change.groupId]?.label ?? change.groupId} ${formatGaugeDelta(change.delta)}`;
				case 'mandateStarted':
					return `entrée en fonction : ${content.mandates[change.mandateId]?.label ?? change.mandateId}`;
				case 'mandateEnded':
					return `fin de mandat (${MANDATE_END_LABELS[change.reason]}) : ${content.mandates[change.mandateId]?.label ?? change.mandateId}`;
				case 'candidacy':
					return change.invested
						? 'candidature déposée avec l’investiture du parti'
						: 'candidature déposée sans investiture';
				case 'preparation':
					return `préparation de campagne + ${change.delta}`;
				case 'familyJoined':
					return change.relation === 'partner'
						? 'une nouvelle vie à deux'
						: 'une naissance dans la famille';
				case 'separated':
					return 'une séparation';
				case 'hired':
					return `embauche au poste « ${content.posts[change.postId]?.label ?? change.postId} »`;
				case 'staffLeft':
					return `départ du poste « ${content.posts[change.postId]?.label ?? change.postId} » (${STAFF_LEAVE_LABELS[change.reason]})`;
				case 'earlyElection':
					return `${content.elections[change.electionId]?.label ?? change.electionId} anticipées au ${formatTurn(change.turn)}`;
			}
		})
		.join(', ');
}

const STAFF_LEAVE_LABELS: { readonly [K in StaffLeaveReason]: string } = {
	resigned: 'démission',
	dismissed: 'renvoi',
	poached: 'débauchage',
	retired: 'retraite',
	died: 'décès'
};

const MANDATE_END_LABELS: { readonly [K in MandateEndReason]: string } = {
	term: 'fin du terme',
	resigned: 'démission',
	government_change: 'changement de gouvernement',
	replaced: 'remplacé par une fonction incompatible',
	removed: 'retrait'
};

/** Résultat d'un scrutin en une ligne : trois premières parts. */
function sharesText(ballot: Ballot, content: Content): string {
	return (ballot.shares ?? [])
		.slice(0, 3)
		.map(
			(share) => `${content.parties[share.partyId]?.acronym ?? share.partyId} ${share.percent} %`
		)
		.join(' · ');
}

function deadlineLines(
	record: DeadlinesRecord | null,
	state: GameState,
	content: Content
): JournalLine[] {
	if (!record) return [];
	const lines: JournalLine[] = [];
	const ended = politicsText(record.mandates, content);
	if (ended)
		lines.push({ kind: 'career', text: ended.charAt(0).toUpperCase() + ended.slice(1) + '.' });
	for (const result of record.campaigns) {
		const campaign = state.campaigns.find((entry) => entry.campaignId === result.campaignId);
		const label = content.elections[campaign?.electionId ?? '']?.label ?? 'Élection';
		const rival = result.opponentId ? state.characters[result.opponentId] : undefined;
		const against = rival ? ` face à ${displayName(rival)}` : '';
		lines.push({
			kind: 'career',
			text:
				result.status === 'won'
					? `${label} : vous l’emportez avec ${result.playerPercent} %${against}.`
					: result.status === 'lost'
						? `${label} : défaite avec ${result.playerPercent} %${against}. La notoriété progresse, la fatigue aussi.`
						: `${label} : candidature invalidée (${result.reason ?? 'conditions non remplies'}).`
		});
	}
	for (const result of record.ballots) {
		const ballot = state.ballots.find((entry) => entry.ballotId === result.ballotId);
		const label = content.elections[result.electionId]?.label ?? result.electionId;
		const winner = content.parties[result.winnerPartyId]?.name ?? result.winnerPartyId;
		const alternance =
			result.governingAfter !== result.governingBefore
				? ` Alternance : le ${content.parties[result.governingAfter]?.name ?? result.governingAfter} forme le gouvernement.`
				: '';
		lines.push({
			kind: 'career',
			text: `${label} : le ${winner} arrive en tête${ballot ? ` (${sharesText(ballot, content)})` : ''}.${alternance}`
		});
	}
	return lines;
}

/** Départs et successions des personnages déjà rencontrés (les dirigeants : voir le monde). */
function characterLines(record: CharactersRecord | null, state: GameState): JournalLine[] {
	if (!record) return [];
	const known = (id: string): boolean => Object.hasOwn(state.relationships, id);
	return record.departures.flatMap((departure) => {
		const character = state.characters[departure.characterId];
		if (!character || !known(character.id)) return [];
		const successor = record.arrivals.find((arrival) => arrival.successorOf === character.id);
		const successorName = successor ? state.characters[successor.characterId] : undefined;
		const what = departure.reason === 'death' ? 'Décès de' : 'Départ à la retraite de';
		return [
			{
				kind: 'people' as const,
				text: `${what} ${displayName(character)}.${successorName ? ` Relève : ${displayName(successorName)}.` : ''}`
			}
		];
	});
}

function peopleText(changes: readonly PeopleChange[], state: GameState, content: Content): string {
	return changes
		.flatMap((change) => {
			const character = state.characters[change.characterId];
			if (!character) return [];
			if (change.kind === 'revealed') {
				const trait = content.traits[change.traitId]?.label ?? change.traitId;
				return [`vous découvrez chez ${displayName(character)} : ${trait}`];
			}
			return [];
		})
		.join(', ');
}

function worldLines(record: WorldRecord | null, state: GameState, content: Content): JournalLine[] {
	if (!record) return [];
	return record.leaderChanges.map((change) => {
		const party = content.parties[change.partyId]?.name ?? change.partyId;
		const previous = state.characters[change.previousLeaderId]?.name ?? change.previousLeaderId;
		const leader = state.characters[change.leaderId]?.name ?? change.leaderId;
		const why =
			change.reason === 'retirement'
				? 'part à la retraite'
				: change.reason === 'death'
					? 'décède'
					: 'perd un vote interne';
		return {
			kind: 'world',
			text: `${party} : ${previous} ${why} ; ${leader} prend la tête du parti.`
		};
	});
}

function changesText(changes: readonly { resource: ResourceId; delta: number }[]): string {
	return changes
		.map(
			(change) => `${RESOURCE_NAMES[change.resource]} ${formatDelta(change.resource, change.delta)}`
		)
		.join(', ');
}

function gaugesText(gauges: readonly { gauge: keyof typeof GAUGE_NAMES; delta: number }[]): string {
	return gauges
		.map((change) => `${GAUGE_NAMES[change.gauge]} ${formatGaugeDelta(change.delta)}`)
		.join(', ');
}

function joinParts(...parts: string[]): string {
	return parts.filter((part) => part.length > 0).join(' ; ');
}

/** Disponibilité d'une étape supplémentaire, évaluée par la prévision du moteur. */
function addability(state: GameState, plan: readonly PlanStep[], step: PlanStep, content: Content) {
	if (state.phase !== 'planning')
		return { addable: false, reason: 'Aucune planification possible pour le moment.' };
	const preview = previewPlan(state, { steps: [...plan, step] }, content);
	const last = preview.steps.at(-1);
	const issue = last?.issues[0];
	return issue ? { addable: false, reason: issue.message } : { addable: true, reason: null };
}

function eventTitle(
	eventId: string,
	actors: Readonly<Record<string, string>>,
	state: GameState,
	content: Content
): string {
	const definition = content.events[eventId];
	return definition ? renderTemplate(definition.title, actors, content, state.characters) : eventId;
}

/** Libellé lisible de la cible d'une étape : parti, mandat exercé ou échéance électorale. */
function targetLabel(target: string, state: GameState, content: Content): string {
	if (Object.hasOwn(content.parties, target)) return content.parties[target]?.name ?? target;
	if (target.startsWith('upgrade.')) {
		// Exemplaire de l'organisation, encore possédé ou parti (retrouvé par son achat).
		const upgradeId =
			state.upgrades.find((upgrade) => upgrade.instanceId === target)?.upgradeId ??
			state.history
				.flatMap((entry) => (entry.type === 'turn.resolved' ? entry.steps : []))
				.find((step) => step.kind === 'purchase' && step.instanceId === target)?.id;
		const definition = upgradeId ? content.upgrades[upgradeId] : undefined;
		if (definition) return definition.ownedLabel ?? definition.label;
	}
	const mandate = state.mandates.find((entry) => entry.instanceId === target);
	if (mandate) return content.mandates[mandate.mandateId]?.label ?? mandate.mandateId;
	const ballot = state.ballots.find((entry) => entry.ballotId === target);
	if (ballot) {
		const label = content.elections[ballot.electionId]?.label ?? ballot.electionId;
		return `${label} du ${formatTurn(ballot.turn)}`;
	}
	return target;
}

/** Départs de collaborateurs et présélections à la frontière (P2-05). */
function staffLines(record: StaffRecord | null, state: GameState, content: Content): JournalLine[] {
	if (!record) return [];
	const post = (postId: string): string => content.posts[postId]?.label ?? postId;
	return [
		...record.departures.map((departure) => {
			const character = state.characters[departure.characterId];
			const name = character ? displayName(character) : departure.characterId;
			return {
				kind: 'people' as const,
				text: `${name} quitte le poste « ${post(departure.postId)} » (${STAFF_LEAVE_LABELS[departure.reason]}).`
			};
		}),
		...record.shortlisted.map((postId) => ({
			kind: 'career' as const,
			text: `Candidatures reçues pour le poste « ${post(postId)} ».`
		}))
	];
}

/** Famille à la frontière (P2-08) : héritage, veuvage, dépenses et disponibilité. */
function familyLines(record: FamilyRecord | null, state: GameState): JournalLine[] {
	if (!record) return [];
	const lines: JournalLine[] = [];
	if (record.inheritance > 0) {
		lines.push({
			kind: 'people',
			text: `Héritage familial — ${RESOURCE_NAMES.personalCashCents} ${formatDelta('personalCashCents', record.inheritance)}`
		});
	}
	if (record.widowed) {
		const partner = state.characters[record.widowed];
		lines.push({
			kind: 'people',
			text: `Deuil : ${partner ? displayName(partner) : 'votre partenaire'} n’est plus.`
		});
	}
	if (record.childCosts < 0) {
		lines.push({
			kind: 'economy',
			text: `Enfants à charge — ${RESOURCE_NAMES.personalCashCents} ${formatDelta('personalCashCents', record.childCosts)}`
		});
	}
	if (record.neglected) {
		lines.push({ kind: 'people', text: 'Votre famille se sent délaissée par votre agenda.' });
	}
	return lines;
}

function journalOfQuarter(entry: HistoryEntry, state: GameState, content: Content): JournalLine[] {
	const lines: JournalLine[] = [];
	for (const step of entry.steps) {
		const target = step.target ? ` : ${targetLabel(step.target, state, content)}` : '';
		const label =
			step.kind === 'action'
				? `${content.actions[step.id]?.label ?? step.id}${target}`
				: `Achat : ${content.upgrades[step.id]?.label ?? step.id}`;
		const effects = joinParts(
			changesText(step.changes),
			gaugesText(step.gauges),
			politicsText(step.politics, content)
		);
		lines.push({ kind: 'step', text: effects ? `${label} — ${effects}` : label });
	}
	for (const producer of entry.economy.producers) {
		const label = content.upgrades[producer.upgradeId]?.label ?? producer.upgradeId;
		lines.push({
			kind: 'economy',
			text:
				producer.status === 'suspended'
					? `${label} : charges impayées, production suspendue`
					: `${label} — ${changesText(producer.changes) || 'aucune variation'}`
		});
	}
	const byGauge = new Map<string, string[]>();
	for (const contribution of entry.wellbeing.contributions) {
		const name = GAUGE_NAMES[contribution.gauge];
		const list = byGauge.get(name) ?? [];
		list.push(`${formatGaugeDelta(contribution.delta)} (${SOURCE_LABELS[contribution.source]})`);
		byGauge.set(name, list);
	}
	for (const [name, parts] of byGauge)
		lines.push({ kind: 'wellbeing', text: `${name} ${parts.join(', ')}` });
	lines.push(...characterLines(entry.characters, state));
	lines.push(...worldLines(entry.world, state, content));
	lines.push(...deadlineLines(entry.deadlines, state, content));
	lines.push(...staffLines(entry.staff, state, content));
	lines.push(...familyLines(entry.family, state));
	if (entry.mandates.changes.length > 0) {
		lines.push({
			kind: 'economy',
			text: `Indemnités et moyens des mandats — ${changesText(entry.mandates.changes)}`
		});
	}
	for (const event of entry.events) {
		const title = eventTitle(event.eventId, event.actors, state, content);
		if (event.outcome === 'queued')
			lines.push({ kind: 'event', text: `${title} — décision attendue` });
		else if (event.outcome === 'applied') {
			const effects = joinParts(
				changesText(event.changes),
				gaugesText(event.gauges),
				politicsText(event.politics, content),
				peopleText(event.people, state, content)
			);
			lines.push({ kind: 'event', text: effects ? `${title} — ${effects}` : title });
		} else
			lines.push({ kind: 'event', text: `${title} — sans suite : ${event.reason ?? 'annulé'}` });
	}
	if (entry.wellbeing.deathCause) lines.push({ kind: 'end', text: 'Fin de carrière.' });
	if (lines.length === 0) lines.push({ kind: 'step', text: 'Trimestre calme : rien à signaler.' });
	return lines;
}

function journalOfChoice(entry: ChoiceRecord, state: GameState, content: Content): JournalLine[] {
	const definition = content.events[entry.eventId];
	const quarter = state.history.find(
		(candidate): candidate is HistoryEntry =>
			candidate.type === 'turn.resolved' &&
			candidate.events.some((event) => event.instanceId === entry.instanceId)
	);
	const actors =
		quarter?.events.find((event) => event.instanceId === entry.instanceId)?.actors ?? {};
	const render = (text: string): string => renderTemplate(text, actors, content, state.characters);
	const title = definition ? render(definition.title) : entry.eventId;
	const choice =
		definition?.blocking === true
			? definition.choices.find((candidate) => candidate.id === entry.choiceId)
			: undefined;
	const label = choice ? render(choice.label) : entry.choiceId;
	const effects = joinParts(
		changesText(entry.changes),
		gaugesText(entry.gauges),
		politicsText(entry.politics, content),
		peopleText(entry.people, state, content)
	);
	const lines: JournalLine[] = [
		{
			kind: 'decision',
			text: `Décision — ${title} : « ${label} »${effects ? ` (${effects})` : ''}`
		}
	];
	if (entry.deathCause) lines.push({ kind: 'end', text: 'Fin de carrière.' });
	return lines;
}

function buildJournal(state: GameState, content: Content): JournalTurnView[] {
	const groups = new Map<number, JournalLine[]>();
	const add = (turn: number, lines: JournalLine[]): void => {
		groups.set(turn, [...(groups.get(turn) ?? []), ...lines]);
	};
	for (const entry of state.history) {
		if (entry.type === 'turn.resolved') add(entry.turn, journalOfQuarter(entry, state, content));
		else add(entry.turn, journalOfChoice(entry, state, content));
	}
	return [...groups.entries()]
		.sort(([a], [b]) => b - a)
		.map(([turn, lines]) => ({ key: `t${turn}`, label: formatTurn(turn), lines }));
}

function buildPress(state: GameState, content: Content): PlayerView['press'] {
	const items: { key: string; dateLabel: string; title: string }[] = [];
	for (const entry of state.history) {
		if (entry.type !== 'turn.resolved') continue;
		for (const event of entry.events) {
			if (event.outcome === 'cancelled' || !event.instanceId) continue;
			items.push({
				key: event.instanceId,
				dateLabel: formatTurn(entry.turn + 1),
				title: eventTitle(event.eventId, event.actors, state, content)
			});
		}
	}
	return items.reverse().slice(0, 6);
}

/** Somme des montants par ressource, dans l'ordre des ressources. */
function sumAmounts(lists: readonly (readonly ResourceAmount[])[]): ResourceAmount[] {
	return RESOURCE_IDS.flatMap((resource) => {
		const amount = lists
			.flat()
			.filter((item) => item.resource === resource)
			.reduce((sum, item) => sum + item.amount, 0);
		return amount === 0 ? [] : [{ resource, amount }];
	});
}

/** Organisation regroupée par type d'amélioration, dans l'ordre du catalogue. */
function buildOrganisation(
	state: GameState,
	plan: readonly PlanStep[],
	preview: PlanPreview,
	content: Content
): OrganisationGroupView[] {
	const releaseActionId =
		content.actionIds.find((id) => content.actions[id]?.target === 'upgrade') ?? null;
	return content.upgradeIds.flatMap((upgradeId) => {
		const definition = content.upgrades[upgradeId]!;
		const owned = state.upgrades.filter((upgrade) => upgrade.upgradeId === upgradeId);
		const forecasts = preview.producers.filter((producer) => producer.upgradeId === upgradeId);
		const releasing = new Set(
			plan.flatMap((step) =>
				step.kind === 'action' && step.id === releaseActionId && step.target ? [step.target] : []
			)
		);
		const releasesPlanned = owned.filter((upgrade) => releasing.has(upgrade.instanceId)).length;
		if (owned.length === 0 && forecasts.length === 0) return [];

		// Le plus récent des exemplaires encore présents part en premier.
		const candidate = [...owned].reverse().find((upgrade) => !releasing.has(upgrade.instanceId));
		let release: OrganisationGroupView['release'] = null;
		if (releaseActionId && state.phase === 'planning' && owned.length > 0) {
			if (!candidate) {
				release = { step: null, reason: 'Tous les départs sont déjà prévus.' };
			} else {
				const step: PlanStep = {
					kind: 'action',
					id: releaseActionId,
					target: candidate.instanceId
				};
				const check = addability(state, plan, step, content);
				release = check.addable ? { step, reason: null } : { step: null, reason: check.reason };
			}
		}
		const count = (status: string): number =>
			forecasts.filter((producer) => producer.status === status).length;
		return [
			{
				upgradeId,
				label: definition.ownedLabel ?? definition.label,
				owned: owned.length,
				active: count('active'),
				pending: count('pending'),
				suspended: count('suspended'),
				releasesPlanned,
				upkeep: amounts(sumAmounts(forecasts.map((producer) => producer.upkeep)), -1),
				production: amounts(sumAmounts(forecasts.map((producer) => producer.production)), 1),
				releaseEffects: (definition.releaseEffects ?? []).map((effect) =>
					describeEffect(effectRange(effect), content)
				),
				release
			}
		];
	});
}

function buildSummary(state: GameState, content: Content): SummaryView | null {
	if (!state.end) return null;
	const summary = careerSummary(state);
	const born = formatTurn(state.player.birthTurn);
	return {
		title: `Fin de carrière à ${summary.age} ans`,
		cause: CAUSE_LABELS[state.end.cause],
		lines: [
			{ label: 'Né au', value: born },
			{
				label: 'Origine',
				value: content.origins[state.player.origin]?.label ?? state.player.origin
			},
			{
				label: 'Profession',
				value: content.professions[state.player.profession]?.label ?? state.player.profession
			},
			{ label: 'Décédé au', value: formatTurn(summary.lastTurn) },
			{ label: 'Âge', value: `${summary.age} ans` },
			{ label: 'Trimestres de carrière', value: String(summary.quartersPlayed) },
			...RESOURCE_IDS.map((id) => ({
				label: RESOURCE_NAMES[id],
				value: formatResource(id, summary.resources[id])
			})),
			{ label: 'Actions menées', value: String(summary.actionsPerformed) },
			{ label: 'Améliorations acquises', value: String(summary.upgradesOwned) },
			{ label: 'Événements vécus', value: String(summary.eventsExperienced) },
			{
				label: 'Catalogue',
				value: `${content.eventIds.length} événements possibles`
			}
		]
	};
}

function buildWorld(state: GameState, plan: readonly PlanStep[], content: Content): WorldView {
	const { world, player } = state;
	const total = content.partyIds.reduce(
		(sum, partyId) => sum + (world.parties[partyId]?.strength ?? 0),
		0
	);
	const joinActionId =
		content.actionIds.find((id) => content.actions[id]?.target === 'party') ?? null;
	const joinAction = joinActionId ? content.actions[joinActionId] : undefined;
	const leaveActionId =
		content.actionIds.find((id) =>
			content.actions[id]?.effects.some((effect) => effect.op === 'leaveParty')
		) ?? null;

	const parties: PartyView[] = content.partyIds.map((partyId) => {
		const definition = content.parties[partyId]!;
		const party = world.parties[partyId];
		const joinPlanned = plan.some(
			(step) => step.kind === 'action' && step.id === joinActionId && step.target === partyId
		);
		const join = joinActionId
			? addability(state, plan, { kind: 'action', id: joinActionId, target: partyId }, content)
			: { addable: false, reason: 'Aucune adhésion possible.' };
		return {
			id: partyId,
			name: definition.name,
			acronym: definition.acronym,
			family: definition.family,
			description: definition.description,
			share: total > 0 ? Math.round(((party?.strength ?? 0) * 100) / total) : 0,
			leader: state.characters[party?.leaderId ?? '']?.name ?? '—',
			positions: content.world.axes.map(
				(axis) =>
					`${axis.label} : ${describeAxisPosition(definition.positions[axis.id], axis.negativeLabel, axis.positiveLabel)}`
			),
			governing: partyId === world.governingPartyId,
			member: player.partyId === partyId,
			joinPlanned,
			joinable: join.addable,
			joinReason: join.reason
		};
	});
	parties.sort(
		(a, b) =>
			(world.parties[b.id]?.strength ?? 0) - (world.parties[a.id]?.strength ?? 0) ||
			content.partyIds.indexOf(a.id) - content.partyIds.indexOf(b.id)
	);

	const current = player.affiliations.at(-1);
	const memberParty = player.partyId ? content.parties[player.partyId] : undefined;
	const leave =
		player.partyId && leaveActionId
			? {
					actionId: leaveActionId,
					planned: plan.some((step) => step.kind === 'action' && step.id === leaveActionId),
					...(() => {
						const result = addability(state, plan, { kind: 'action', id: leaveActionId }, content);
						return { addable: result.addable, reason: result.reason };
					})()
				}
			: null;
	return {
		indicators: INDICATOR_IDS.map((id) => ({
			id,
			name: INDICATOR_NAMES[id],
			gauge: describeIndicator(id, world.indicators[id])
		})),
		parties,
		governingParty: content.parties[world.governingPartyId]?.name ?? world.governingPartyId,
		affiliation:
			memberParty && current
				? `Membre du ${memberParty.name} depuis le ${formatTurn(current.fromTurn)}`
				: 'Sans étiquette',
		partyAcronym: memberParty?.acronym ?? null,
		leave,
		joinActionId,
		joinTimeCost: joinAction?.timeCost ?? 0,
		joinCosts: joinAction ? amounts(joinAction.costs, -1) : []
	};
}

/** Lien familial d'un personnage généré (étiquette `kin`), sans accord de genre. */
const KIN_LABELS: Readonly<Record<string, string>> = {
	partner: 'Famille — vie commune',
	former_partner: 'Famille — ancienne relation',
	child: 'Famille — enfant',
	parent: 'Famille — parent',
	sibling: 'Famille — fratrie'
};

function roleOf(tags: readonly string[]): string {
	if (tags.includes('kin')) {
		const relation = tags.find((tag) => Object.hasOwn(KIN_LABELS, tag));
		return relation ? KIN_LABELS[relation]! : 'Famille';
	}
	if (tags.includes('staff')) return 'Entourage';
	return ROLE_LABELS[tags[0] ?? ''] ?? 'Connaissance';
}

const ROLE_LABELS: Readonly<Record<string, string>> = {
	medical: 'Santé',
	journalist: 'Presse',
	family: 'Famille',
	friend: 'Amitiés',
	business: 'Affaires',
	donor: 'Affaires',
	politician: 'Vie politique locale',
	rival: 'Vie politique locale',
	party_official: 'Parti',
	party_leader: 'Direction de parti',
	volunteer: 'Militants'
};

function describeAttitude(attitude: number): Pick<PersonView, 'attitude' | 'attitudeTone'> {
	if (attitude >= 40) return { attitude: 'Très favorable', attitudeTone: 'good' };
	if (attitude >= 10) return { attitude: 'Favorable', attitudeTone: 'good' };
	if (attitude > -10) return { attitude: 'Neutre', attitudeTone: 'neutral' };
	if (attitude > -40) return { attitude: 'Réservée', attitudeTone: 'warning' };
	return { attitude: 'Hostile', attitudeTone: 'danger' };
}

function buildPeople(state: GameState, content: Content): PersonView[] {
	const now = state.end ? state.end.turn : state.turn;
	const people = Object.entries(state.relationships).flatMap(([id, relationship]) => {
		const character = state.characters[id];
		// Les candidats non retenus ne sont que des CV : ils n'entrent pas dans vos relations.
		if (!character || character.tags.includes('candidate')) return [];
		const lastTurn = character.leftTurn ?? now;
		return [
			{
				metTurn: relationship.metTurn,
				view: {
					id,
					name: displayName(character),
					role: roleOf(character.tags),
					age: ageAt(character.birthTurn, lastTurn),
					status:
						character.status === 'active'
							? 'En activité'
							: character.status === 'retired'
								? `À la retraite depuis le ${formatTurn(lastTurn)}`
								: `Décès au ${formatTurn(lastTurn)}`,
					active: character.status === 'active',
					...describeAttitude(relationship.attitude),
					knownTraits: character.knownTraits.map((traitId) => ({
						label: content.traits[traitId]?.label ?? traitId,
						description: content.traits[traitId]?.description ?? ''
					})),
					unknownTraits: character.traits.length - character.knownTraits.length,
					metLabel: `Rencontre au ${formatTurn(relationship.metTurn)}`,
					memories: [...relationship.memories].reverse().map((memory) => ({
						dateLabel: formatTurn(memory.turn),
						text: memory.text
					}))
				} satisfies PersonView
			}
		];
	});
	// La famille d'abord, puis les personnages actifs, par date de rencontre.
	return people
		.sort(
			(a, b) =>
				Number(b.view.role.startsWith('Famille')) - Number(a.view.role.startsWith('Famille')) ||
				Number(b.view.active) - Number(a.view.active) ||
				a.metTurn - b.metTurn ||
				a.view.id.localeCompare(b.view.id)
		)
		.map((entry) => entry.view);
}

function buildCareer(state: GameState, plan: readonly PlanStep[], content: Content): CareerView {
	const label = (mandateId: string): string => content.mandates[mandateId]?.label ?? mandateId;
	const resignActionId =
		content.actionIds.find((id) => content.actions[id]?.target === 'mandate') ?? null;
	const declareActionId =
		content.actionIds.find((id) => content.actions[id]?.target === 'ballot') ?? null;
	const campaignView = (campaign: GameState['campaigns'][number]): CampaignView => {
		const ballot = state.ballots.find((entry) => entry.ballotId === campaign.ballotId);
		const rival = campaign.opponentId ? state.characters[campaign.opponentId] : undefined;
		const previous = rival
			? state.campaigns.filter(
					(other) =>
						other.opponentId === rival.id &&
						other.campaignId !== campaign.campaignId &&
						(other.status === 'won' || other.status === 'lost') &&
						other.declaredTurn < campaign.declaredTurn + (campaign.status === 'running' ? 1 : 0)
				)
			: [];
		const opponent = rival
			? `${displayName(rival)} (${rival.partyId ? (content.parties[rival.partyId]?.acronym ?? rival.partyId) : 'sans étiquette'})${
					previous.length > 0
						? ` — déjà affronté ${previous.length} fois : ${previous.filter((other) => other.status === 'won').length} victoire(s) pour vous`
						: ''
				}`
			: null;
		const outcome =
			campaign.status === 'won'
				? `Victoire avec ${campaign.playerPercent} %${rival ? ` face à ${displayName(rival)}` : ''}`
				: campaign.status === 'lost'
					? `Défaite avec ${campaign.playerPercent} %${rival ? ` face à ${displayName(rival)}` : ''} : la carrière continue`
					: campaign.status === 'disqualified'
						? `Candidature invalidée : ${campaign.reason ?? 'conditions non remplies'}`
						: null;
		return {
			campaignId: campaign.campaignId,
			label: content.elections[campaign.electionId]?.label ?? campaign.electionId,
			dateLabel: ballot ? formatTurn(ballot.turn) : '—',
			declared: `Candidature déclarée au ${formatTurn(campaign.declaredTurn)}`,
			investiture:
				campaign.partyId === null
					? 'Sans étiquette'
					: campaign.invested
						? `Investiture du ${content.parties[campaign.partyId]?.name ?? campaign.partyId}`
						: 'Sans investiture : l’appareil du parti ne vous soutient pas',
			preparation: campaign.preparation,
			opponent,
			poll:
				campaign.status === 'running'
					? campaignPoll(
							campaign,
							state.player,
							state.world,
							state.mandates,
							content,
							state.characters,
							state.campaigns,
							pollingCompetence(state.staff, state.characters, state.turn, content)
						)
					: null,
			outcome
		};
	};
	const scheduled = state.ballots
		.filter((ballot) => ballot.status === 'scheduled')
		.sort((a, b) => a.turn - b.turn);
	// Une fonction exercée au sein d'un mandat (la mairie) suit ce mandat dans la liste.
	const unsorted = activeMandates(state.mandates);
	const hostOf = (mandate: MandateInstance): string | null =>
		state.institutions.prerequisites[mandate.mandateId]?.[0] ?? null;
	const active = unsorted
		.filter((mandate) => hostOf(mandate) === null)
		.flatMap((host) => [host, ...unsorted.filter((mandate) => hostOf(mandate) === host.mandateId)]);
	active.push(...unsorted.filter((mandate) => !active.includes(mandate)));
	const main = mainMandate(state.mandates, content);
	return {
		mainFunction: main ? label(main.mandateId) : 'Sans mandat',
		mandates: active.map((mandate) => {
			const definition = content.mandates[mandate.mandateId];
			const election = definition?.election ? content.elections[definition.election] : undefined;
			const next = definition?.election
				? scheduled.find((ballot) => ballot.electionId === definition.election)
				: undefined;
			const resign = resignActionId
				? addability(
						state,
						plan,
						{ kind: 'action', id: resignActionId, target: mandate.instanceId },
						content
					)
				: { addable: false, reason: null };
			return {
				instanceId: mandate.instanceId,
				label: label(mandate.mandateId),
				since: formatTurn(mandate.startTurn),
				ends:
					election && next
						? `Terme : ${election.label.toLowerCase()} du ${formatTurn(next.turn)}`
						: 'Prend fin avec le gouvernement',
				timePerTurn: definition?.timePerTurn ?? 0,
				income: amounts(definition?.income ?? [], 1),
				stressPerTurn: definition?.stressPerTurn ?? 0,
				resignPlanned: plan.some(
					(step) =>
						step.kind === 'action' &&
						step.id === resignActionId &&
						step.target === mandate.instanceId
				),
				resignable: resign.addable,
				resignReason: resign.reason,
				within: countsTowardCumul(mandate.mandateId, state.institutions)
					? null
					: (state.institutions.prerequisites[mandate.mandateId] ?? []).map(label).join(', ')
			};
		}),
		reservedTime: reservedTime(state.mandates, content),
		resignActionId,
		maxMandates: state.institutions.maxMandates,
		cumulCount: cumulatedMandates(state.mandates, state.institutions).length,
		incompatibilities: state.institutions.incompatibilities.map(
			([left, right]) => `${label(left)} et ${label(right)}`
		),
		prerequisites: Object.entries(state.institutions.prerequisites).map(
			([mandateId, required]) => `${label(mandateId)} : ${required.map(label).join(', ')}`
		),
		calendar: scheduled.map((ballot) => {
			const definition = content.elections[ballot.electionId];
			const running = state.campaigns.find(
				(campaign) => campaign.status === 'running' && campaign.ballotId === ballot.ballotId
			);
			const declare =
				declareActionId && !running
					? addability(
							state,
							plan,
							{ kind: 'action', id: declareActionId, target: ballot.ballotId },
							content
						)
					: { addable: false, reason: null };
			return {
				stake: definition ? label(definition.grants) : '—',
				campaign: running ? campaignView(running) : null,
				candidacyPlanned: plan.some(
					(step) =>
						step.kind === 'action' && step.id === declareActionId && step.target === ballot.ballotId
				),
				candidacyAddable: declare.addable,
				candidacyReason: declare.reason,
				ballotId: ballot.ballotId,
				label: definition?.label ?? ballot.electionId,
				dateLabel: formatTurn(ballot.turn),
				turnsLeft: ballot.turn - state.turn,
				filing: `Candidatures closes au ${formatTurn(ballot.filingClosesTurn)}`,
				early: ballot.early,
				endsMandate: active.some(
					(mandate) => content.mandates[mandate.mandateId]?.election === ballot.electionId
				)
			};
		}),
		results: state.ballots
			.filter((ballot) => ballot.status === 'held')
			.slice(-6)
			.reverse()
			.map((ballot) => ({
				ballotId: ballot.ballotId,
				label: content.elections[ballot.electionId]?.label ?? ballot.electionId,
				dateLabel: formatTurn(ballot.turn),
				winner: content.parties[ballot.winnerPartyId ?? '']?.name ?? '—',
				shares: sharesText(ballot, content),
				early: ballot.early
			})),
		declareActionId,
		pastCampaigns: state.campaigns
			.filter((campaign) => campaign.status !== 'running')
			.map(campaignView)
			.reverse(),
		pastMandates: state.mandates
			.filter((mandate) => mandate.status === 'ended')
			.map((mandate) => ({
				label: label(mandate.mandateId),
				period: `${formatTurn(mandate.startTurn)} – ${formatTurn(mandate.endTurn ?? mandate.startTurn)} (${MANDATE_END_LABELS[mandate.endReason ?? 'term']})`
			}))
	};
}

function buildSupports(state: GameState, content: Content): SupportsView {
	const totalWeight = content.supportGroupIds.reduce(
		(total, id) => total + (content.supportGroups[id]?.weight ?? 0),
		0
	);
	const groups = content.supportGroupIds.flatMap((id) => {
		const group = content.supportGroups[id];
		if (!group) return [];
		return [
			{
				kind: group.kind,
				view: {
					id,
					label: group.label,
					description: group.description,
					gauge: describeSupport(state.player.supports[id] ?? 0),
					share:
						group.kind === 'electoral' && totalWeight > 0
							? Math.round((group.weight * 100) / totalWeight)
							: null
				}
			}
		];
	});
	return {
		popularity: describePopularity(state.player.popularity),
		electoral: groups.filter((group) => group.kind === 'electoral').map((group) => group.view),
		influence: groups.filter((group) => group.kind === 'influence').map((group) => group.view)
	};
}

function personOf(state: GameState, characterId: string, content: Content): StaffPersonView {
	const character = state.characters[characterId]!;
	return {
		characterId,
		name: displayName(character),
		age: ageAt(character.birthTurn, state.turn),
		competence: describeCompetence(character.competence),
		knownTraits: character.knownTraits.map((trait) => content.traits[trait]?.label ?? trait),
		unknownTraits: character.traits.length - character.knownTraits.length
	};
}

function buildEntourage(
	state: GameState,
	plan: readonly PlanStep[],
	content: Content
): EntourageView {
	const hireActionId =
		content.actionIds.find((id) => content.actions[id]?.target === 'candidate') ?? null;
	const dismissActionId =
		content.actionIds.find((id) => content.actions[id]?.target === 'staff') ?? null;
	const planned = (actionId: string | null, target: string): boolean =>
		actionId !== null &&
		plan.some((step) => step.kind === 'action' && step.id === actionId && step.target === target);
	const posts: PostView[] = content.postIds.map((postId) => {
		const post = content.posts[postId]!;
		const member = activeStaff(state.staff).find((entry) => entry.postId === postId);
		const unlocked = postUnlocked(postId, state, content);
		const occupant = member
			? (() => {
					const relationship = state.relationships[member.characterId];
					const dismiss = dismissActionId
						? addability(
								state,
								plan,
								{ kind: 'action', id: dismissActionId, target: member.characterId },
								content
							)
						: { addable: false, reason: null };
					return {
						...personOf(state, member.characterId, content),
						since: `En poste depuis le ${formatTurn(member.hiredTurn)}`,
						...describeAttitude(relationship?.attitude ?? 0),
						missions: post.missions.map((mission) => ({
							id: mission.id,
							label: mission.label,
							description: mission.description,
							active: mission.id === member.missionId
						})),
						producing: member.hiredTurn < state.turn,
						dismissPlanned: planned(dismissActionId, member.characterId),
						dismissable: dismiss.addable,
						dismissReason: dismiss.reason
					};
				})()
			: null;
		const candidates = member
			? []
			: (state.shortlists[postId] ?? []).flatMap((entry) => {
					const character = state.characters[entry.characterId];
					if (!character || character.status !== 'active') return [];
					const hire = hireActionId
						? addability(
								state,
								plan,
								{ kind: 'action', id: hireActionId, target: entry.characterId },
								content
							)
						: { addable: false, reason: null };
					return [
						{
							...personOf(state, entry.characterId, content),
							profile:
								content.candidateProfiles.find((profile) => profile.id === entry.profileId)
									?.label ?? '',
							planned: planned(hireActionId, entry.characterId),
							hireable: hire.addable,
							reason: hire.reason
						}
					];
				});
		return {
			id: postId,
			label: post.label,
			description: post.description,
			salary: `${formatResource('politicalBudgetCents', post.salaryCents)} par trimestre`,
			lockedReason: unlocked ? null : (post.unavailableReason ?? 'Poste pas encore accessible.'),
			occupant,
			candidates
		};
	});
	return {
		posts,
		hireActionId,
		dismissActionId,
		timeBonus: staffTimeBonus(state.staff, state.characters, state.turn, content),
		former: state.staff
			.filter((member) => member.status === 'left')
			.map((member) => ({
				name: displayName(state.characters[member.characterId]!),
				post: content.posts[member.postId]?.label ?? member.postId,
				period: `${formatTurn(member.hiredTurn)} – ${formatTurn(member.leftTurn ?? member.hiredTurn)} (${STAFF_LEAVE_LABELS[member.leaveReason ?? 'resigned']})`
			}))
			.reverse()
	};
}

/** Effets d'un choix que peut chiffrer un conseiller (ni relations, ni traits, ni carrière). */
function advisableRanges(effects: readonly Effect[]): EffectRange[] {
	return effects
		.map(effectRange)
		.filter((range) =>
			['resource', 'gauge', 'support', 'indicator', 'partyStrength'].includes(range.kind)
		);
}

function rangeDirection(range: EffectRange): number {
	switch (range.kind) {
		case 'resource':
		case 'gauge':
			return Math.sign(range.min + range.max);
		case 'support':
		case 'indicator':
		case 'partyStrength':
			return Math.sign(range.value);
		default:
			return 0;
	}
}

function rangeName(range: EffectRange, content: Content): string {
	switch (range.kind) {
		case 'resource':
			return RESOURCE_NAMES[range.resource];
		case 'gauge':
			return GAUGE_NAMES[range.gauge];
		case 'support':
			return `Soutien : ${content.supportGroups[range.group]?.label ?? range.group}`;
		case 'indicator':
			return INDICATOR_NAMES[range.indicator];
		case 'partyStrength':
			return `Intentions de vote (${partyLabel(range.party, content)})`;
		default:
			return '';
	}
}

function buildAdvice(
	state: GameState,
	instanceId: string,
	eventId: string,
	content: Content
): AdviceView | null {
	const definition = content.events[eventId];
	if (!definition?.blocking) return null;
	let best: { name: string; post: string; competence: number } | null = null;
	for (const member of activeStaff(state.staff)) {
		const post = content.posts[member.postId];
		const character = state.characters[member.characterId];
		if (!post || !character || !post.adviceCategories.includes(definition.category)) continue;
		if (!best || character.competence > best.competence) {
			best = { name: displayName(character), post: post.label, competence: character.competence };
		}
	}
	if (!best) return null;
	const balance = content.balance.entourage;
	const quality: AdviceView['quality'] =
		best.competence >= balance.preciseAdviceCompetence
			? 'precise'
			: best.competence >= balance.fairAdviceCompetence
				? 'fair'
				: 'poor';
	const choices: Record<string, string[]> = {};
	for (const choice of definition.choices) {
		choices[choice.id] = advisableRanges(choice.effects).map((range, index) => {
			if (quality === 'precise') return describeEffect(range, content);
			let direction = rangeDirection(range);
			// Un conseil médiocre se trompe parfois de sens, toujours de la même façon pour ce choix.
			if (quality === 'poor') {
				const roll = hashSeed(`${instanceId}:${choice.id}:${index}`) % 1000;
				if (roll < balance.poorAdviceErrorChance * 1000) direction = -direction;
			}
			return `${rangeName(range, content)} : ${direction > 0 ? 'en hausse' : direction < 0 ? 'en baisse' : 'stable'}`;
		});
	}
	return { adviser: `${best.name} (${best.post})`, quality, choices };
}

function describeFamily(state: GameState): string {
	const partner = state.player.family.partnerId ? 'en couple' : 'célibataire';
	const children = livingChildren(state.player, state.characters).length;
	return children === 0 ? partner : `${partner}, ${children} enfant${children > 1 ? 's' : ''}`;
}

/** Option de création : libellé, description et effets de départ lisibles. */
export interface ProfileOptionView {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly effects: readonly string[];
}

/** Choix proposés à la création d'un personnage (P2-08). */
/** Résumé groupé d'une série de trimestres simulés (DESIGN.md §5, P2-09). */
export interface SpanSummaryView {
	/** « du T1 2003 au T4 2005 ». */
	readonly period: string;
	readonly turns: number;
	/** Variations nettes : ressources, santé, stress, popularité. */
	readonly changes: readonly { readonly name: string; readonly text: string }[];
	/** Faits marquants : carrière, entourage, famille, décisions, fin. */
	readonly highlights: readonly string[];
	/** Faits marquants non affichés faute de place. */
	readonly moreHighlights: number;
	readonly events: number;
	readonly decisions: number;
	/** Journal détaillé de la période, du plus récent au plus ancien. */
	readonly quarters: readonly JournalTurnView[];
}

const HIGHLIGHT_KINDS: ReadonlySet<JournalLine['kind']> = new Set([
	'career',
	'people',
	'decision',
	'end'
]);
const MAX_HIGHLIGHTS = 8;

/**
 * Résume la période écoulée entre deux états d'une même partie (`to` dérive de
 * `from` par des transitions : le journal est un ajout pur). Aucune donnée
 * cachée : seulement ce que le journal et le tableau de bord montrent déjà.
 */
export function summarizeSpan(from: GameState, to: GameState, content: Content): SpanSummaryView {
	const entries = to.history.slice(from.history.length);
	const quarterEntries = entries.filter(
		(entry): entry is HistoryEntry => entry.type === 'turn.resolved'
	);
	const turns = quarterEntries.length;
	const lastTurn = quarterEntries.at(-1)?.turn ?? from.turn;
	const lines = entries.flatMap((entry) =>
		entry.type === 'turn.resolved'
			? journalOfQuarter(entry, to, content)
			: journalOfChoice(entry, to, content)
	);
	const highlights = lines
		.filter((line) => HIGHLIGHT_KINDS.has(line.kind))
		.map((line) => line.text);
	const gauge = (name: string, before: number, after: number) => ({
		name,
		text: formatGaugeDelta(after - before)
	});
	return {
		period:
			turns <= 1
				? `au ${formatTurn(from.turn)}`
				: `du ${formatTurn(from.turn)} au ${formatTurn(lastTurn)}`,
		turns,
		changes: [
			...RESOURCE_IDS.map((id) => ({
				name: RESOURCE_NAMES[id],
				text: formatDelta(id, to.resources[id] - from.resources[id])
			})),
			gauge('Santé', from.player.health, to.player.health),
			gauge('Stress', from.player.stress, to.player.stress),
			gauge('Popularité', from.player.popularity, to.player.popularity)
		],
		highlights: highlights.slice(0, MAX_HIGHLIGHTS),
		moreHighlights: Math.max(0, highlights.length - MAX_HIGHLIGHTS),
		events: quarterEntries.reduce(
			(sum, entry) => sum + entry.events.filter((event) => event.outcome !== 'cancelled').length,
			0
		),
		decisions: entries.filter((entry) => entry.type === 'event.resolved').length,
		quarters: buildJournal(to, content).filter((quarter) =>
			quarterEntries.some((entry) => quarter.key === `t${entry.turn}`)
		)
	};
}

export function creationOptions(content: Content): {
	readonly origins: readonly ProfileOptionView[];
	readonly professions: readonly ProfileOptionView[];
	readonly defaults: Content['defaultProfile'];
} {
	const option = (entry: {
		id: string;
		label: string;
		description: string;
		effects: readonly Effect[];
	}): ProfileOptionView => ({
		id: entry.id,
		label: entry.label,
		description: entry.description,
		effects: entry.effects.map((effect) => describeEffect(effectRange(effect), content))
	});
	return {
		origins: content.originIds.map((id) => option(content.origins[id]!)),
		professions: content.professionIds.map((id) => option(content.professions[id]!)),
		defaults: content.defaultProfile
	};
}

export function projectView(
	state: GameState,
	plan: readonly PlanStep[],
	content: Content
): PlayerView {
	const preview = previewPlan(state, { steps: plan }, content);
	const steps: PlanStepView[] = preview.steps.map((step) => {
		const upgrade = step.kind === 'purchase' && step.id ? content.upgrades[step.id] : undefined;
		const target = step.target ? ` : ${targetLabel(step.target, state, content)}` : '';
		return {
			index: step.index,
			kind: step.kind ?? 'action',
			label: `${step.label ?? step.id ?? 'Étape inconnue'}${step.label ? target : ''}`,
			timeCost: step.timeCost,
			details: [
				...amounts(step.costs, -1),
				...step.effects.map((range) =>
					describeEffect(
						range.kind === 'affiliation' && range.party === 'target'
							? { ...range, party: step.target }
							: range,
						content
					)
				)
			],
			issues: step.issues.map((issue) => issue.message),
			note: upgrade ? 'Actif à partir du trimestre prochain.' : null
		};
	});

	const planned = (kind: PlanStep['kind'], id: string): number =>
		plan.filter((step) => step.kind === kind && step.id === id).length;

	// Les actions ciblées se planifient depuis les écrans Monde politique et Carrière.
	const actions: CatalogItemView[] = content.actionIds.flatMap((id) => {
		const action = content.actions[id]!;
		if (action.target) return [];
		return {
			kind: 'action',
			id,
			label: action.label,
			description: action.description,
			timeCost: action.timeCost,
			costs: amounts(action.costs, -1),
			effects: action.effects.map((effect) => describeEffect(effectRange(effect), content)),
			planned: planned('action', id),
			...addability(state, plan, { kind: 'action', id }, content)
		} satisfies CatalogItemView;
	});

	const upgrades: UpgradeView[] = content.upgradeIds.map((id) => {
		const upgrade = content.upgrades[id]!;
		return {
			kind: 'purchase',
			id,
			label: upgrade.label,
			description: upgrade.description,
			family: FAMILY_LABELS[upgrade.family] ?? upgrade.family,
			treasury: RESOURCE_NAMES[upgrade.treasury],
			timeCost: upgrade.timeCost,
			costs: amounts(upgrade.price, -1),
			upkeep: amounts(upgrade.upkeep, -1),
			effects: amounts(upgrade.production, 1),
			owned: state.upgrades.filter((owned) => owned.upgradeId === id).length,
			maxOwned: upgrade.maxOwned,
			planned: planned('purchase', id),
			...addability(state, plan, { kind: 'purchase', id }, content)
		};
	});

	const producers: ProducerView[] = preview.producers.map((producer) => ({
		instanceId: producer.instanceId,
		upgradeId: producer.upgradeId,
		label:
			content.upgrades[producer.upgradeId]?.ownedLabel ??
			content.upgrades[producer.upgradeId]?.label ??
			producer.upgradeId,
		status: producer.status,
		statusLabel:
			producer.status === 'active'
				? 'Actif ce trimestre'
				: producer.status === 'pending'
					? 'Actif à partir du trimestre prochain'
					: 'Suspendu : charges non couvertes',
		upkeep: amounts(producer.upkeep, -1),
		production: amounts(producer.production, 1)
	}));

	const pending = describePendingEvent(state, content);
	const decision: DecisionView | null = pending
		? {
				instanceId: pending.instanceId,
				title: pending.title,
				text: pending.text,
				category: pending.category,
				remaining: pending.remaining,
				choices: pending.choices.map((choice) => ({
					id: choice.id,
					label: choice.label,
					hints: choice.hints,
					costs: amounts(choice.costs, -1),
					available: choice.available,
					reason: choice.reason
				})),
				advice: buildAdvice(state, pending.instanceId, pending.eventId, content)
			}
		: null;

	const health = describeHealth(state.player.health);
	const stress = describeStress(state.player.stress);
	const alerts: Alert[] = [];
	if (decision) alerts.push({ level: 'danger', text: `Décision attendue : ${decision.title}` });
	if (state.phase === 'planning') {
		for (const warning of preview.warnings)
			alerts.push({ level: 'warning', text: warning.message });
		// Alertes du moteur qui interrompent aussi l'accélération (P2-09) ; échéances et
		// santé sont présentées plus bas, de façon plus complète.
		for (const alert of accelerationAlerts(state, { steps: plan }, content)) {
			if (alert.kind === 'finance' || alert.id.startsWith('staff_left:')) {
				alerts.push({ level: 'warning', text: alert.message });
			} else if (alert.kind === 'career' || alert.kind === 'staff') {
				alerts.push({ level: 'info', text: alert.message });
			}
		}
	}
	const lead = content.balance.elections.alertLeadTurns;
	for (const ballot of state.ballots) {
		const left = ballot.turn - state.turn;
		if (ballot.status !== 'scheduled' || left < 0 || state.phase === 'ended') continue;
		const label = content.elections[ballot.electionId]?.label ?? ballot.electionId;
		const candidate = state.campaigns.some(
			(campaign) => campaign.status === 'running' && campaign.ballotId === ballot.ballotId
		);
		const filingLeft = ballot.filingClosesTurn - state.turn;
		// Les candidatures ferment avant le scrutin : l'alerte suit la plus proche des deux échéances.
		if (!candidate && filingLeft >= 0 && filingLeft <= lead) {
			alerts.push({
				level: 'info',
				text:
					filingLeft === 0
						? `${label} : dernier trimestre pour déposer une candidature.`
						: `${label} : candidatures closes au ${formatTurn(ballot.filingClosesTurn)}.`
			});
			continue;
		}
		if (left > lead) continue;
		alerts.push({
			level: 'info',
			text:
				left === 0
					? `${label} à la fin de ce trimestre.`
					: `${label} au ${formatTurn(ballot.turn)}, dans ${left} trimestre${left > 1 ? 's' : ''}.`
		});
	}
	if (health.tone === 'danger' || health.tone === 'warning') {
		alerts.push({
			level: health.tone,
			text: `Santé ${health.label.toLowerCase()} : pensez au repos.`
		});
	}

	return {
		dateLabel: formatTurn(state.end ? state.end.turn : state.turn),
		age: ageAt(state.player.birthTurn, state.end ? state.end.turn : state.turn),
		phase: state.phase,
		resources: RESOURCE_IDS.map((id) => ({
			id,
			name: RESOURCE_NAMES[id],
			value: formatResource(id, state.resources[id]),
			forecast: formatRange(id, preview.resourceChanges[id].min, preview.resourceChanges[id].max)
		})),
		health,
		stress,
		plan: {
			steps,
			timeAvailable: preview.timeAvailable,
			timeReserved: preview.timeReserved,
			timeUsed: preview.timeUsed,
			timeRemaining: preview.timeRemaining,
			valid: preview.valid,
			issues: preview.issues.filter((issue) => issue.index === null).map((issue) => issue.message),
			warnings: preview.warnings.map((warning) => warning.message),
			changes: RESOURCE_IDS.map((id) => ({
				name: RESOURCE_NAMES[id],
				text: formatRange(id, preview.resourceChanges[id].min, preview.resourceChanges[id].max)
			})),
			stressAfter: describeStress(preview.wellbeing.stress),
			healthAfter: preview.wellbeing.health
		},
		actions,
		upgrades,
		producers,
		organisation: buildOrganisation(state, plan, preview, content),
		decision,
		journal: buildJournal(state, content),
		press: buildPress(state, content),
		alerts,
		summary: buildSummary(state, content),
		world: buildWorld(state, plan, content),
		people: buildPeople(state, content),
		career: buildCareer(state, plan, content),
		supports: buildSupports(state, content),
		entourage: buildEntourage(state, plan, content),
		profile: {
			origin: content.origins[state.player.origin]?.label ?? state.player.origin,
			profession: content.professions[state.player.profession]?.label ?? state.player.profession,
			family: describeFamily(state)
		}
	};
}
