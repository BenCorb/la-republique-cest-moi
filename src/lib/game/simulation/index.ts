/**
 * Simulateur automatique de carrières (ARCHITECTURE.md §11.1).
 *
 * Le simulateur orchestre exclusivement les commandes publiques du moteur. Les
 * politiques construisent leurs plans depuis le catalogue et la prévision, puis
 * choisissent les décisions depuis `PendingEventView`, qui n'expose aucun effet
 * caché. Elles ne lisent jamais le PRNG de la partie.
 */
import {
	INDICATOR_IDS,
	type Content,
	type IndicatorId,
	type ResourceId,
	type Resources
} from '../content/types.ts';
import {
	RULES_VERSION,
	accelerationAlerts,
	careerSummary,
	checkInvariants,
	chooseEventCommand,
	commitTurn,
	createGame,
	describePendingEvent,
	hashSeed,
	followsPlayer,
	payrollCents,
	activistTier,
	pressAudience,
	interviewIssue,
	distinctionsOf,
	divertedFunds,
	obituaryOf,
	ownedMedia,
	reformIssue,
	previewPlan,
	pledgeTarget,
	promiseIssue,
	transition,
	validateSeed,
	type EndCause,
	type EventChoiceView,
	type GameState,
	type PendingEventView,
	type PlanStep,
	type TurnPlan,
	eligibleRandomEvents,
	netWorth
} from '../engine/index.ts';

export const SIMULATION_REPORT_VERSION = 25;
export const SIMULATION_STRATEGIES = [
	'prudent',
	'ambitious',
	'patrimonial',
	'mixed',
	'random-valid'
] as const;

export type SimulationStrategy = (typeof SIMULATION_STRATEGIES)[number];
export type SimulationStrategyOption = SimulationStrategy | 'all';
export type SimulationRunStatus = 'ended' | 'capped' | 'error';

export interface SimulationConfig {
	readonly runs: number;
	readonly seed: string;
	readonly strategy: SimulationStrategyOption;
	readonly maxTurns: number;
}

export interface EventFrequency {
	readonly eventId: string;
	readonly count: number;
}

/** Parutions d'un même titre de presse au cours d'une carrière (P3-15). */
export interface HeadlineFrequency {
	readonly headlineId: string;
	readonly count: number;
}

export interface SimulationRun {
	readonly seed: string;
	readonly strategy: SimulationStrategy;
	readonly status: SimulationRunStatus;
	readonly turns: number;
	readonly endingAge: number;
	readonly endCause: EndCause | null;
	readonly decisions: number;
	readonly alertEpisodes: number;
	readonly significantInterventions: number;
	readonly resources: Resources;
	readonly health: number;
	readonly stress: number;
	readonly upgradesOwned: number;
	readonly actionsPerformed: number;
	readonly purchases: number;
	readonly quartersWithSuspension: number;
	readonly eventsExperienced: number;
	readonly eventOccurrences: readonly EventFrequency[];
	/** Événements vus plus de deux fois dans la carrière (scènes répétées, P3-15). */
	readonly repeatedEvents: number;
	/** Parutions de titres déjà parus dans la carrière, et titres parus (P3-15). */
	readonly repeatedHeadlines: number;
	readonly headlineOccurrences: readonly HeadlineFrequency[];
	/** Parti du joueur en fin de carrière (`null` : sans étiquette). */
	readonly finalParty: string | null;
	/** Nombre d'adhésions successives (changements de camp compris). */
	readonly affiliations: number;
	readonly quartersAffiliated: number;
	/** Changements de direction des partis au fil de la carrière. */
	readonly leaderChanges: number;
	/** Personnages rencontrés, départs (retraites et décès) et traits cachés révélés. */
	readonly charactersMet: number;
	readonly characterDepartures: number;
	readonly traitsRevealed: number;
	/** Mandats exercés au fil de la carrière et plus haute fonction (rang le plus élevé). */
	readonly mandatesHeld: number;
	readonly highestMandate: string | null;
	/** Scrutins tenus et alternances au gouvernement pendant la carrière. */
	readonly ballotsHeld: number;
	readonly governmentChanges: number;
	/** Candidatures déposées, victoires et défaites. */
	readonly campaigns: number;
	readonly campaignsWon: number;
	readonly campaignsLost: number;
	/** Candidatures et élections par type de scrutin (P3-29). */
	readonly campaignsByElection: Readonly<
		Record<string, { readonly ran: number; readonly won: number }>
	>;
	/** Scrutins du joueur tranchés au second tour (P3-29). */
	readonly runoffs: number;
	/**
	 * Part de la fortune consacrée aux débouchés politiques et de prestige
	 * (dons, avances, mécénat, fondation, médias), en % de cette dépense plus la
	 * valeur nette finale (P3-39).
	 */
	readonly fortuneSpentPercent: number;
	/** Événements ordinaires éligibles par trimestre, 10e centile (P3-24). */
	readonly eligibleEventsP10: number;
	/** Part des trimestres sous la cible de huit événements éligibles, en % (P3-24). */
	readonly quartersBelowEligibleTarget: number;
	/** Plus haut statut atteint dans un parti (P3-34). */
	readonly partyRankPeak: 'none' | 'member' | 'cadre' | 'leader';
	/** Adversaires différents affrontés et plus grand nombre d'affrontements avec le même. */
	readonly distinctOpponents: number;
	/** Profil de départ et famille en fin de carrière (P2-08). */
	readonly origin: string;
	/** Territoire d'origine (P3-16) : région et taille de la commune. */
	readonly region: string;
	readonly townSize: string;
	readonly engagement: string;
	readonly children: number;
	readonly separations: number;
	/** Promesses prises, tenues, partiellement tenues et abandonnées (P3-04). */
	readonly promisesMade: number;
	readonly promisesKept: number;
	readonly promisesPartial: number;
	readonly promisesAbandoned: number;
	/** Articles consacrés au joueur, dont critiques et favorables ; interviews ; média racheté (P3-03). */
	readonly articles: number;
	readonly criticalArticles: number;
	readonly favorableArticles: number;
	readonly interviews: number;
	readonly mediaOwned: number;
	/** Base militante en fin de carrière et au plus haut, palier le plus haut atteint (P3-19). */
	readonly activistsFinal: number;
	readonly activistsPeak: number;
	readonly activistTierPeak: string;
	/** Réformes proposées et adoptées par le joueur, réformes du gouvernement seul (P3-05). */
	readonly reformsProposed: number;
	readonly reformsAdopted: number;
	readonly governmentReforms: number;
	/** Bilan (P3-08) : nécrologie retenue et distinctions méritées. */
	readonly obituary: string | null;
	readonly distinctions: readonly string[];
	/** Collaborateurs recrutés et départs (démission, renvoi, débauchage…). */
	readonly staffHired: number;
	readonly staffDepartures: number;
	/** Recrutement (P3-20) : offres déclinées, masse salariale finale, compétence moyenne de l'équipe. */
	readonly hiresRefused: number;
	readonly payrollFinalCents: number;
	readonly teamCompetence: number;
	/** Recrutement II (P3-21) : recherches commandées, augmentations accordées, points gagnés en poste. */
	readonly searchesOrdered: number;
	readonly raisesGranted: number;
	readonly staffProgress: number;
	/**
	 * Montée en échelle (P3-23) : formats de don choisis, avances de campagne,
	 * argent personnel engagé en politique (avances rendues déduites) et sa part
	 * dans la fortune, coût moyen d'un point d'influence gagné par les actions au
	 * premier et au dernier tiers de la carrière, part des actions de début de
	 * partie parmi les actions du dernier tiers (en %).
	 */
	readonly donationsModest: number;
	readonly donationsSustained: number;
	readonly donationsMajor: number;
	readonly campaignAdvances: number;
	readonly personalSpentOnPoliticsCents: number;
	readonly wealthSpentPercent: number;
	readonly influenceCostEarlyCents: number | null;
	readonly influenceCostLateCents: number | null;
	readonly earlyActionsLateSharePercent: number;
	/** Justice (P3-01) : faits inscrits dont le joueur est auteur ou complice, dossiers le visant, condamnations. */
	readonly facts: number;
	readonly playerCases: number;
	readonly convictions: number;
	readonly divertedFundsCents: number;
	/** Démissions de mandat (garde-fou d'épuisement des politiques prudente et mixte). */
	readonly resignations: number;
	/** Durée active estimée en minutes (modèle provisoire `ACTIVE_TIME_MODEL`, à calibrer au playtest). */
	readonly estimatedActiveMinutes: number;
	readonly maxRivalEncounters: number;
	/** Popularité en fin de carrière et la plus haute atteinte. */
	readonly finalPopularity: number;
	readonly peakPopularity: number;
	/** Plus bas et plus haut atteints par chaque indicateur national. */
	readonly indicatorRanges: Readonly<
		Record<IndicatorId, { readonly min: number; readonly max: number }>
	>;
	readonly invariantViolations: readonly string[];
	readonly error: string | null;
}

export interface Distribution {
	readonly min: number;
	readonly p10: number;
	readonly median: number;
	readonly mean: number;
	readonly p90: number;
	readonly max: number;
}

export interface StrategySummary {
	readonly strategy: SimulationStrategy;
	readonly runs: number;
	readonly ended: number;
	readonly capped: number;
	readonly errors: number;
	readonly endCauses: Readonly<Record<string, number>>;
	readonly turns: Distribution;
	readonly endingAge: Distribution;
	readonly decisions: Distribution;
	readonly alertEpisodes: Distribution;
	readonly significantInterventions: Distribution;
	readonly quartersWithSuspension: Distribution;
	readonly upgradesOwned: Distribution;
	readonly quartersAffiliated: Distribution;
	readonly resources: { readonly [K in ResourceId]: Distribution };
	readonly estimatedActiveMinutes: Distribution;
	readonly staffHired: Distribution;
	readonly staffDepartures: Distribution;
	readonly promisesMade: Distribution;
	readonly promisesKept: Distribution;
	readonly facts: Distribution;
	readonly convictions: Distribution;
	readonly resignations: Distribution;
	readonly mandatesHeld: Distribution;
	readonly highestMandates: Readonly<Record<string, number>>;
}

export interface AggregateEventFrequency extends EventFrequency {
	readonly careers: number;
	readonly maxPerCareer: number;
}

export interface AggregateHeadlineFrequency extends HeadlineFrequency {
	readonly careers: number;
	readonly maxPerCareer: number;
}

/** Couverture du catalogue sur le lot (P3-15) : contenus jamais atteints et catégories. */
export interface ContentCoverage {
	/** Événements du catalogue jamais survenus (tirés ou suites). */
	readonly eventsNeverReached: readonly string[];
	readonly headlinesNeverUsed: readonly string[];
	/** Par catégorie : événements du catalogue, atteints, et occurrences totales. */
	readonly categories: Readonly<
		Record<
			string,
			{ readonly events: number; readonly reached: number; readonly occurrences: number }
		>
	>;
}

export interface ProblemSeed {
	readonly seed: string;
	readonly strategy: SimulationStrategy;
	readonly status: Exclude<SimulationRunStatus, 'ended'>;
	readonly error: string | null;
	readonly invariantViolations: readonly string[];
}

export interface SimulationAggregate {
	readonly runs: number;
	readonly ended: number;
	readonly capped: number;
	readonly errors: number;
	readonly invariantViolations: number;
	readonly turns: Distribution;
	readonly endingAge: Distribution;
	readonly decisions: Distribution;
	readonly alertEpisodes: Distribution;
	readonly significantInterventions: Distribution;
	readonly resources: { readonly [K in ResourceId]: Distribution };
	readonly endCauses: Readonly<Record<string, number>>;
	readonly leaderChanges: Distribution;
	readonly charactersMet: Distribution;
	readonly characterDepartures: Distribution;
	readonly traitsRevealed: Distribution;
	readonly mandatesHeld: Distribution;
	readonly governmentChanges: Distribution;
	readonly campaigns: Distribution;
	readonly campaignsWon: Distribution;
	readonly maxRivalEncounters: Distribution;
	readonly staffHired: Distribution;
	readonly estimatedActiveMinutes: Distribution;
	readonly finalPopularity: Distribution;
	readonly peakPopularity: Distribution;
	/** Plus haute fonction atteinte, `none` pour les carrières sans mandat. */
	readonly highestMandates: Readonly<Record<string, number>>;
	/** Parti en fin de carrière, `none` pour les carrières sans étiquette. */
	readonly finalParties: Readonly<Record<string, number>>;
	readonly indicatorExtremes: Readonly<
		Record<IndicatorId, { readonly min: number; readonly max: number }>
	>;
	readonly strategies: readonly StrategySummary[];
	readonly events: readonly AggregateEventFrequency[];
	/** Répétitions et couverture du contenu (P3-15). */
	readonly repeatedEvents: Distribution;
	readonly repeatedHeadlines: Distribution;
	readonly headlines: readonly AggregateHeadlineFrequency[];
	readonly coverage: ContentCoverage;
	readonly problemSeeds: readonly ProblemSeed[];
}

export interface SimulationReport {
	readonly reportVersion: typeof SIMULATION_REPORT_VERSION;
	readonly rulesVersion: string;
	readonly contentVersion: string;
	readonly config: SimulationConfig;
	/** Systèmes absents du prototype, donc volontairement non simulés (aucun depuis P3-04). */
	readonly unavailableMetrics: readonly string[];
	readonly aggregate: SimulationAggregate;
	readonly runs: readonly SimulationRun[];
}

const action = (id: string): PlanStep => ({ kind: 'action', id });
const purchase = (id: string): PlanStep => ({ kind: 'purchase', id });

/**
 * Choix d'un parti par politique, d'après les seules forces publiques : les
 * ambitieux rejoignent le parti le plus fort, les profils mixtes le parti au
 * gouvernement, l'aléatoire un parti tiré de la seed ; les prudents et les
 * patrimoniaux restent sans étiquette.
 */
function partyWish(
	strategy: SimulationStrategy,
	state: GameState,
	seed: string,
	content: Content
): PlanStep[] {
	const joinId = content.actionIds.find((id) => content.actions[id]?.target === 'party');
	if (state.player.partyId !== null) return partyCareerWish(strategy, state, content);
	if (!joinId) return [];
	let target: string | undefined;
	if (strategy === 'ambitious') {
		target = [...content.partyIds].sort(
			(left, right) =>
				(state.world.parties[right]?.strength ?? 0) - (state.world.parties[left]?.strength ?? 0)
		)[0];
	} else if (strategy === 'mixed') {
		target = state.world.governingPartyId;
	} else if (strategy === 'random-valid') {
		target = content.partyIds[hashSeed(`${seed}:parti`) % content.partyIds.length];
	}
	return target ? [{ kind: 'action', id: joinId, target }] : [];
}

/**
 * Carrière partisane (P3-34) : l'ambitieuse brigue la direction sur la ligne de
 * l'appareil et sollicite des ralliements, la mixte sur celle du rassemblement ;
 * chef, l'une et l'autre arbitrent les investitures. Les plans invalides
 * sont écartés par la prévision.
 */
function partyCareerWish(
	strategy: SimulationStrategy,
	state: GameState,
	content: Content
): PlanStep[] {
	const has = (id: string): boolean => Object.hasOwn(content.actions, id);
	const steps: string[] =
		strategy === 'ambitious'
			? ['party.bid_apparatus', 'party.rally', 'party.arbitrate']
			: strategy === 'mixed'
				? ['party.bid_unity', 'party.arbitrate']
				: [];
	const bidding = state.player.partyCareer?.bid !== null && state.player.partyCareer !== null;
	return steps
		.filter((id) => has(id) && !(bidding && id.startsWith('party.bid_')))
		.map((id): PlanStep => ({ kind: 'action', id }));
}

/**
 * Candidature par politique : les ambitieux et l'aléatoire visent toute
 * échéance ouverte, les profils mixtes les municipales et les législatives,
 * les prudents les seules municipales ; les patrimoniaux ne se présentent pas.
 */
const CANDIDACY_TARGETS: Readonly<Record<SimulationStrategy, readonly string[] | 'all'>> = {
	prudent: ['election.municipal'],
	ambitious: 'all',
	patrimonial: [],
	mixed: ['election.municipal', 'election.legislative'],
	'random-valid': 'all'
};

function candidacyWish(
	strategy: SimulationStrategy,
	state: GameState,
	content: Content
): PlanStep[] {
	const declareId = content.actionIds.find(
		(id) =>
			content.actions[id]?.target === 'ballot' &&
			content.actions[id]?.effects.some(
				(effect) => effect.op === 'declareCandidacy' && effect.role !== 'colistier'
			)
	);
	// Encartée, une politique demande l'investiture là où elle est exigée (P3-30).
	const investitureId = content.actionIds.find((id) =>
		content.actions[id]?.effects.some((effect) => effect.op === 'requestInvestiture')
	);
	const targets = CANDIDACY_TARGETS[strategy];
	if (!declareId || (targets !== 'all' && targets.length === 0)) return [];
	const ballots = [...state.ballots]
		.filter(
			(ballot) =>
				ballot.status === 'scheduled' && (targets === 'all' || targets.includes(ballot.electionId))
		)
		.sort((left, right) => left.turn - right.turn);
	for (const ballot of ballots) {
		const step: PlanStep = { kind: 'action', id: declareId, target: ballot.ballotId };
		if (previewPlan(state, { steps: [step] }, content).valid) return [step];
		if (investitureId) {
			const request: PlanStep = { kind: 'action', id: investitureId, target: ballot.ballotId };
			if (previewPlan(state, { steps: [request] }, content).valid) return [request];
		}
	}
	return [];
}

/**
 * Promesses par politique (P3-04) : en campagne, chaque politique candidate prend
 * jusqu'à `PROMISES_PER_CAMPAIGN` engagements, dans un ordre tiré de la seed ;
 * élue, elle prépare ses réformes sauf l'ambitieuse, qui promet plus qu'elle ne fait.
 */
const PROMISES_PER_CAMPAIGN: Readonly<Record<SimulationStrategy, number>> = {
	prudent: 1,
	ambitious: 3,
	patrimonial: 0,
	mixed: 2,
	'random-valid': 2
};
const PREPARES_REFORMS: ReadonlySet<SimulationStrategy> = new Set([
	'prudent',
	'mixed',
	'random-valid'
]);

function promiseWish(
	strategy: SimulationStrategy,
	state: GameState,
	seed: string,
	content: Content
): PlanStep[] {
	const steps: PlanStep[] = [];
	const prepareId = content.actionIds.find((id) => content.actions[id]?.target === 'pledge');
	if (prepareId && PREPARES_REFORMS.has(strategy)) {
		for (const pledge of state.promises) {
			if (pledge.status === 'in_progress' && pledge.progress < 100) {
				steps.push({ kind: 'action', id: prepareId, target: pledge.pledgeId });
			}
		}
	}
	const pledgeId = content.actionIds.find((id) => content.actions[id]?.target === 'promise');
	const running = state.campaigns.filter((campaign) => campaign.status === 'running');
	const wanted = PROMISES_PER_CAMPAIGN[strategy];
	if (pledgeId && wanted > 0) {
		const order = [...content.promiseIds].sort(
			(left, right) => hashSeed(`${seed}:promesse:${left}`) - hashSeed(`${seed}:promesse:${right}`)
		);
		// Chaque campagne en cours reçoit ses engagements, nommée explicitement (P3-22).
		const chosen = new Set<string>();
		for (const campaign of running) {
			const made = state.promises.filter(
				(pledge) => pledge.campaignId === campaign.campaignId
			).length;
			const available = order.filter(
				(promiseId) =>
					!chosen.has(promiseId) &&
					promiseIssue(pledgeTarget(campaign.campaignId, promiseId), state, content) === null
			);
			for (const promiseId of available.slice(0, Math.max(0, wanted - made))) {
				chosen.add(promiseId);
				steps.push({
					kind: 'action',
					id: pledgeId,
					target: pledgeTarget(campaign.campaignId, promiseId)
				});
			}
		}
	}
	return steps;
}

/**
 * Avance de campagne (P3-23) : l'ambitieuse avance le plus grand format
 * accessible à chaque candidature en cours, la mixte le format modeste.
 */
function advanceWish(strategy: SimulationStrategy, state: GameState, content: Content): PlanStep[] {
	if (strategy !== 'ambitious' && strategy !== 'mixed') return [];
	const formats = content.actionIds.filter((id) => content.actions[id]?.target === 'campaign');
	const order = strategy === 'ambitious' ? [...formats].reverse() : formats.slice(0, 1);
	return state.campaigns
		.filter((campaign) => campaign.status === 'running' && campaign.advanceCents === 0)
		.flatMap((campaign) =>
			order.map((id): PlanStep => ({ kind: 'action', id, target: campaign.campaignId }))
		);
}

/**
 * Médias par politique (P3-03) : l'ambitieuse accorde une interview chaque
 * trimestre au média le mieux disposé qui la suit et l'accepte (sinon, elle
 * déjeune avec le mieux disposé) ; la mixte déjeune une fois l'an avec le moins bien disposé ;
 * l'aléatoire tente une interview chez un média tiré au sort.
 */
function mediaWish(
	strategy: SimulationStrategy,
	state: GameState,
	seed: string,
	content: Content
): PlanStep[] {
	const interviewId = content.actionIds.find((id) =>
		content.actions[id]?.effects.some((effect) => effect.op === 'giveInterview')
	);
	const lunchId = content.actionIds.find(
		(id) =>
			content.actions[id]?.target === 'media' &&
			!content.actions[id]?.effects.some((effect) => effect.op === 'giveInterview')
	);
	const audience = pressAudience(state.player, state.mandates, state.campaigns, content);
	const followed = content.mediaIds.filter((mediaId) => {
		const definition = content.media[mediaId];
		return definition !== undefined && followsPlayer(definition, audience, content);
	});
	const relation = (mediaId: string): number => state.world.media[mediaId]?.relation ?? 0;
	const byRelation = [...followed].sort((left, right) => relation(right) - relation(left));
	const open = (mediaId: string): boolean =>
		interviewIssue(state.world, mediaId, state.turn, content) === null;
	if (strategy === 'ambitious' && byRelation[0]) {
		const best = byRelation.find((mediaId) => open(mediaId) && relation(mediaId) >= 0);
		if (best && interviewId) return [{ kind: 'action', id: interviewId, target: best }];
		if (lunchId) return [{ kind: 'action', id: lunchId, target: byRelation[0] }];
	}
	if (strategy === 'mixed' && lunchId && state.turn % 4 === 0) {
		const worst = byRelation[byRelation.length - 1];
		if (worst) return [{ kind: 'action', id: lunchId, target: worst }];
	}
	const available = followed.filter(open);
	if (strategy === 'random-valid' && interviewId && available.length > 0) {
		const pick = available[hashSeed(`${seed}:${state.turn}:media`) % available.length]!;
		return [{ kind: 'action', id: interviewId, target: pick }];
	}
	return [];
}

/** Réformes souhaitées par politique (P3-05), par ordre de préférence. */
const REFORM_WISHES: Readonly<Record<SimulationStrategy, readonly string[]>> = {
	prudent: [],
	ambitious: ['cumul.extended', 'press.controlled', 'justice.supervised'],
	patrimonial: ['transparency.opaque'],
	mixed: ['transparency.strict', 'ballot.mixed'],
	'random-valid': []
};

/**
 * Réformes par politique : la première réforme souhaitée encore possible ;
 * l'aléatoire tire une réforme possible au sort.
 */
function reformWish(
	strategy: SimulationStrategy,
	state: GameState,
	seed: string,
	content: Content
): PlanStep[] {
	const actionId = content.actionIds.find((id) => content.actions[id]?.target === 'reform');
	if (!actionId) return [];
	const possible = (levelId: string): boolean =>
		Object.hasOwn(content.institutionLevels, levelId) &&
		reformIssue(levelId, state.institutions, content) === null;
	const wishes =
		strategy === 'random-valid'
			? Object.keys(content.institutionLevels)
					.filter(possible)
					.sort(
						(left, right) =>
							hashSeed(`${seed}:${state.turn}:${left}`) - hashSeed(`${seed}:${state.turn}:${right}`)
					)
			: REFORM_WISHES[strategy].filter(possible);
	const pick = wishes[0];
	return pick ? [{ kind: 'action', id: actionId, target: pick }] : [];
}

/**
 * Recrutement par politique : sauf la prudente, chaque politique recrute le
 * candidat de meilleure compétence visible (CV) d'un poste ouvert.
 */
function hireWish(strategy: SimulationStrategy, state: GameState, content: Content): PlanStep[] {
	// Offre standard (P3-20) : le salaire demandé, sans entretien ni prime.
	const hireId = content.actionIds.find((id) =>
		content.actions[id]?.effects.some(
			(effect) => effect.op === 'hireStaff' && (effect.offer ?? 'standard') === 'standard'
		)
	);
	if (!hireId || strategy === 'prudent') return [];
	const candidates = Object.values(state.shortlists)
		.flat()
		.sort(
			(left, right) =>
				(state.characters[right.characterId]?.competence ?? 0) -
					(state.characters[left.characterId]?.competence ?? 0) ||
				left.characterId.localeCompare(right.characterId)
		);
	for (const candidate of candidates) {
		const step: PlanStep = { kind: 'action', id: hireId, target: candidate.characterId };
		if (previewPlan(state, { steps: [step] }, content).valid) return [step];
	}
	// Sans candidat recrutable, l'ambitieuse commande une recherche ciblée (P3-21).
	const searchId = content.actionIds.find((id) =>
		content.actions[id]?.effects.some(
			(effect) => effect.op === 'orderSearch' && effect.level === 'targeted'
		)
	);
	if (strategy !== 'ambitious' || !searchId) return [];
	for (const postId of content.postIds) {
		const step: PlanStep = { kind: 'action', id: searchId, target: postId };
		if (previewPlan(state, { steps: [step] }, content).valid) return [step];
	}
	return [];
}

function recruitmentCounts(
	state: GameState
): Pick<
	SimulationRun,
	| 'hiresRefused'
	| 'payrollFinalCents'
	| 'teamCompetence'
	| 'searchesOrdered'
	| 'raisesGranted'
	| 'staffProgress'
> {
	const active = state.staff.filter((member) => member.status === 'active');
	const quarters = state.history.flatMap((entry) =>
		entry.type === 'turn.resolved' ? [entry] : []
	);
	// Étapes du plan et choix des décisions bloquantes (la renégociation en est une).
	const politics = state.history.flatMap((entry) =>
		entry.type === 'turn.resolved' ? entry.steps.flatMap((step) => step.politics) : entry.politics
	);
	return {
		searchesOrdered: politics.filter((change) => change.kind === 'searchOrdered').length,
		raisesGranted: politics.filter((change) => change.kind === 'raiseGranted').length,
		staffProgress: quarters.reduce(
			(total, entry) =>
				total + (entry.staff?.progress ?? []).reduce((sum, step) => sum + step.to - step.from, 0),
			0
		),
		hiresRefused: state.history.reduce(
			(total, entry) =>
				entry.type === 'turn.resolved'
					? total +
						entry.steps.reduce(
							(sum, step) =>
								sum + step.politics.filter((change) => change.kind === 'hireRefused').length,
							0
						)
					: total,
			0
		),
		payrollFinalCents: payrollCents(state.staff),
		teamCompetence: active.length
			? Math.round(
					active.reduce(
						(total, member) => total + (state.characters[member.characterId]?.competence ?? 0),
						0
					) / active.length
				)
			: 0
	};
}

/** Actions de début de partie (P3-23) : terrain, réseau local et petits dons. */
const EARLY_ACTIONS: ReadonlySet<string> = new Set([
	'activism.leaflets',
	'network.meet_officials',
	'party.section_meeting',
	'campaign.canvass',
	'personal.donate'
]);

/** Mesures de la montée en échelle des actions (P3-23). */
function scaleCounts(
	state: GameState,
	content: Content
): Pick<
	SimulationRun,
	| 'donationsModest'
	| 'donationsSustained'
	| 'donationsMajor'
	| 'campaignAdvances'
	| 'personalSpentOnPoliticsCents'
	| 'wealthSpentPercent'
	| 'influenceCostEarlyCents'
	| 'influenceCostLateCents'
	| 'earlyActionsLateSharePercent'
> {
	const quarters = state.history.flatMap((entry) =>
		entry.type === 'turn.resolved' ? [entry] : []
	);
	const steps = quarters.flatMap((entry) =>
		entry.steps.map((step) => ({ turn: entry.turn, step }))
	);
	const scaled = (id: string) => content.actions[id]?.scale;
	const donations = (format: string): number =>
		steps.filter(
			({ step }) =>
				step.kind === 'action' &&
				scaled(step.id)?.format === format &&
				content.actions[step.id]?.target !== 'campaign'
		).length;
	let spent = 0;
	for (const { step } of steps) {
		const action = step.kind === 'action' ? content.actions[step.id] : undefined;
		if (!action?.scale) continue;
		spent += action.costs
			.filter((cost) => cost.resource === 'personalCashCents')
			.reduce((total, cost) => total + cost.amount, 0);
	}
	const repaid = quarters.reduce(
		(total, entry) =>
			total +
			(entry.deadlines?.campaigns ?? []).reduce(
				(sum, result) => sum + (result.advance?.repaid ? result.advance.cents : 0),
				0
			),
		0
	);
	const net = Math.max(0, spent - repaid);
	const fortune = net + Math.max(0, state.resources.personalCashCents);
	const first = quarters[0]?.turn ?? state.turn;
	const length = Math.max(1, state.turn - first);
	const third = (turn: number): number => Math.min(2, Math.floor(((turn - first) * 3) / length));
	const costPerInfluence = (index: number): number | null => {
		let money = 0;
		let influence = 0;
		for (const { turn, step } of steps) {
			if (third(turn) !== index || step.kind !== 'action') continue;
			for (const change of step.changes) {
				if (change.resource === 'influence') influence += Math.max(0, change.delta);
				else money += Math.max(0, -change.delta);
			}
		}
		return influence > 0 ? Math.round(money / influence) : null;
	};
	const late = steps.filter(({ turn, step }) => third(turn) === 2 && step.kind === 'action');
	return {
		donationsModest: donations('modest'),
		donationsSustained: donations('sustained'),
		donationsMajor: donations('major'),
		campaignAdvances: steps.filter(
			({ step }) => step.kind === 'action' && content.actions[step.id]?.target === 'campaign'
		).length,
		personalSpentOnPoliticsCents: net,
		wealthSpentPercent: fortune > 0 ? Math.round((net * 100) / fortune) : 0,
		influenceCostEarlyCents: costPerInfluence(0),
		influenceCostLateCents: costPerInfluence(2),
		earlyActionsLateSharePercent:
			late.length > 0
				? Math.round(
						(late.filter(({ step }) => EARLY_ACTIONS.has(step.id)).length * 100) / late.length
					)
				: 0
	};
}

/** Stress à partir duquel les politiques prudente et mixte lâchent un mandat (P3-09). */
export const BURNOUT_STRESS = 70;
const RESIGNS_WHEN_EXHAUSTED: ReadonlySet<SimulationStrategy> = new Set(['prudent', 'mixed']);

/**
 * Garde-fou d'épuisement : au-delà de `BURNOUT_STRESS`, avec au moins deux
 * mandats, la politique démissionne du mandat de plus bas rang dont aucun autre
 * ne dépend (le siège de conseiller d'un maire reste donc acquis). Sans lui, le
 * cumul consomme tout le temps et le repos ne trouve plus de place.
 */
function resignWish(strategy: SimulationStrategy, state: GameState, content: Content): PlanStep[] {
	if (!RESIGNS_WHEN_EXHAUSTED.has(strategy) || state.player.stress < BURNOUT_STRESS) return [];
	const resignId = content.actionIds.find((id) => content.actions[id]?.target === 'mandate');
	const active = state.mandates.filter((mandate) => mandate.status === 'active');
	if (!resignId || active.length < 2) return [];
	const required = new Set(
		active.flatMap((mandate) => state.institutions.prerequisites[mandate.mandateId] ?? [])
	);
	const rank = (mandateId: string): number => content.mandates[mandateId]?.rank ?? 0;
	const pick = active
		.filter((mandate) => !required.has(mandate.mandateId))
		.sort((left, right) => rank(left.mandateId) - rank(right.mandateId))[0];
	return pick ? [{ kind: 'action', id: resignId, target: pick.instanceId }] : [];
}

const STRATEGY_WISHES: Readonly<
	Record<Exclude<SimulationStrategy, 'random-valid'>, readonly PlanStep[]>
> = {
	// Le repos passe en premier : élu, le temps manque et la prudence protège la santé.
	prudent: [
		action('personal.rest'),
		action('network.meet_officials'),
		action('organization.fundraising'),
		action('personal.freelance'),
		action('personal.rest')
	],
	ambitious: [
		action('campaign.rally'),
		action('campaign.canvass'),
		action('party.section_meeting'),
		// Familles en trois formats (P3-39) : le plus grand format accessible d'abord.
		action('activism.zenith'),
		action('activism.congress_hall'),
		action('activism.public_meeting'),
		action('organization.fundraising_gala'),
		action('organization.fundraising_dinner'),
		action('organization.fundraising'),
		action('network.meet_officials'),
		action('wealth.patronage'),
		// Le plus grand format accessible (P3-23) : un seul passe par trimestre.
		action('personal.donate_major'),
		action('personal.donate_sustained'),
		action('personal.donate'),
		action('activism.leaflets'),
		action('activism.leaflets'),
		purchase('organization.local_office'),
		purchase('organization.federation')
	],
	// Le patrimonial investit (P3-02), puis s'offre du confort quand il en a les moyens.
	patrimonial: [
		purchase('wealth.stock_portfolio'),
		purchase('wealth.city_flat'),
		purchase('wealth.sme_shares'),
		purchase('wealth.country_house'),
		purchase('wealth.local_media'),
		// Débouchés de la fortune (P3-39) : fondation, hebdomadaire national, mécénat.
		purchase('wealth.foundation'),
		purchase('wealth.national_media'),
		action('wealth.patronage'),
		action('lifestyle.adopt_comfortable'),
		purchase('network.think_tank'),
		purchase('organization.donor_file'),
		purchase('organization.local_office'),
		purchase('communication.press_officer'),
		action('personal.freelance'),
		action('organization.gala'),
		action('organization.fundraising'),
		action('personal.rest')
	],
	mixed: [
		action('personal.rest'),
		purchase('organization.donor_file'),
		purchase('organization.local_office'),
		action('network.meet_officials'),
		action('organization.gala'),
		action('organization.fundraising_dinner'),
		action('organization.fundraising'),
		action('personal.freelance')
	]
};

function randomWishes(seed: string, turn: number, content: Content): PlanStep[] {
	const untargeted = content.actionIds.filter((id) => !content.actions[id]?.target);
	return [...untargeted.map(action), ...content.upgradeIds.map(purchase)].sort((left, right) => {
		const leftRank = hashSeed(`${seed}:${turn}:${left.kind}:${left.id}`);
		const rightRank = hashSeed(`${seed}:${turn}:${right.kind}:${right.id}`);
		return leftRank - rightRank || left.id.localeCompare(right.id);
	});
}

function pressCounts(
	state: GameState,
	content: Content
): Pick<
	SimulationRun,
	'articles' | 'criticalArticles' | 'favorableArticles' | 'interviews' | 'mediaOwned'
> {
	const articles = state.history.flatMap((entry) =>
		entry.type === 'turn.resolved'
			? (entry.press?.articles ?? []).filter((article) => article.topic !== 'ambient')
			: []
	);
	return {
		articles: articles.length,
		criticalArticles: articles.filter((article) => article.tone === 'critical').length,
		favorableArticles: articles.filter((article) => article.tone === 'favorable').length,
		interviews: articles.filter((article) => article.topic === 'interview').length,
		mediaOwned: ownedMedia(state.upgrades, state.player.territory.regionId, content).size
	};
}

function activistCounts(
	state: GameState,
	content: Content
): Pick<SimulationRun, 'activistsFinal' | 'activistsPeak' | 'activistTierPeak'> {
	const peak = state.history.reduce(
		(best, entry) =>
			entry.type === 'turn.resolved' ? Math.max(best, entry.snapshot.activists) : best,
		state.player.activists
	);
	return {
		activistsFinal: state.player.activists,
		activistsPeak: peak,
		activistTierPeak: activistTier(peak, content).id
	};
}

function wishesFor(
	strategy: SimulationStrategy,
	state: GameState,
	seed: string,
	content: Content
): readonly PlanStep[] {
	const party = [
		...resignWish(strategy, state, content),
		...partyWish(strategy, state, seed, content),
		...candidacyWish(strategy, state, content),
		...promiseWish(strategy, state, seed, content),
		...advanceWish(strategy, state, content),
		...mediaWish(strategy, state, seed, content),
		...reformWish(strategy, state, seed, content),
		...hireWish(strategy, state, content)
	];
	if (strategy === 'random-valid') return [...party, ...randomWishes(seed, state.turn, content)];
	return [
		...party,
		...STRATEGY_WISHES[strategy].filter(
			(step) =>
				(step.kind === 'action'
					? Object.hasOwn(content.actions, step.id)
					: Object.hasOwn(content.upgrades, step.id)) &&
				// Le gala épuise : seulement quand le budget politique est bas.
				(step.id !== GALA_ACTION || state.resources.politicalBudgetCents < GALA_BUDGET_BELOW) &&
				// Un train de vie plus coûteux : seulement avec dix trimestres d'avance.
				(!step.id.startsWith('lifestyle.') ||
					state.resources.personalCashCents >=
						10 * lifestyleCost(step.id.replace('adopt_', ''), content))
		)
	];
}

/** Dépense trimestrielle d'un train de vie (identifiant `lifestyle.*`), 0 s'il est inconnu. */
function lifestyleCost(lifestyleId: string, content: Content): number {
	return content.lifestyles[lifestyleId]?.costCents ?? 0;
}

const GALA_ACTION = 'organization.gala';
/** Seuil sous lequel les stratégies organisent un gala (1 000 €). */
const GALA_BUDGET_BELOW = 100_000;

/** Construit gloutonnement un plan dont chaque ajout reste valide. */
export function chooseSimulationPlan(
	state: GameState,
	strategy: SimulationStrategy,
	seed: string,
	content: Content
): TurnPlan {
	const steps: PlanStep[] = [];
	for (const candidate of wishesFor(strategy, state, seed, content)) {
		const next = { steps: [...steps, candidate] };
		if (previewPlan(state, next, content).valid) steps.push(candidate);
	}
	return { steps };
}

function visibleCost(choice: EventChoiceView): number {
	return choice.costs.reduce((total, cost) => total + cost.amount, 0);
}

/**
 * Indices publics qui signalent un risque judiciaire ou médiatique (P3-09) :
 * le joueur prudent les lit comme un avertissement. Le simulateur ne voit que
 * ces textes, jamais les effets ; `tests/unit/simulation.test.ts` vérifie que
 * chaque choix du catalogue qui inscrit un fait porte l'un d'eux.
 */
export const RISK_HINT_FRAGMENTS = [
	'coûter cher',
	'dossier qui pourrait',
	'laisse des traces',
	'mensonge',
	'mieux vaut que personne',
	'ont parfois de la mémoire',
	'promesse embarrassante',
	'vigilance médiatique'
] as const;

export function isRiskyChoice(choice: Pick<EventChoiceView, 'hints'>): boolean {
	return choice.hints.some((hint) => {
		const text = hint.toLocaleLowerCase('fr');
		return RISK_HINT_FRAGMENTS.some((fragment) => text.includes(fragment));
	});
}

/**
 * Politique de choix fondée uniquement sur la vue publique de la décision.
 * Prudente : écarte les choix dont un indice signale un risque, puis le moins
 * cher ; patrimoniale : le moins cher. À coût égal, l'ordre du catalogue
 * départage (et non l'ordre alphabétique des identifiants, qui faisait
 * renoncer la prudente à toutes ses promesses : « drop » avant « hold »).
 */
export function chooseSimulationDecision(
	view: PendingEventView,
	strategy: SimulationStrategy,
	seed: string,
	turn: number,
	/** Événement de nomination au gouvernement (P3-35) : toute politique candidate accepte. */
	appointmentEvent: string | null = null
): EventChoiceView | null {
	const available = view.choices.filter((choice) => choice.available);
	if (available.length === 0) return null;
	if (view.eventId === appointmentEvent && strategy !== 'random-valid') {
		const accept = available.find((choice) => choice.id === 'accept');
		if (accept && strategy !== 'patrimonial') return accept;
	}
	// Entre les deux tours (P3-29) : se maintenir si possible, sinon fusionner, sinon se désister.
	const runoff = ['maintain', 'merge', 'withdraw'].map((id) =>
		available.find((choice) => choice.id === id)
	);
	const isRunoff = ['maintain', 'merge', 'withdraw'].every((id) =>
		view.choices.some((choice) => choice.id === id)
	);
	if (strategy !== 'random-valid' && isRunoff) {
		const preferred = runoff.find((choice) => choice !== undefined);
		if (preferred) return preferred;
	}
	if (strategy === 'prudent' || strategy === 'patrimonial') {
		const safe = strategy === 'prudent' ? available.filter((choice) => !isRiskyChoice(choice)) : [];
		const pool = safe.length > 0 ? safe : available;
		return pool.reduce((best, choice) => (visibleCost(choice) < visibleCost(best) ? choice : best));
	}
	// L'ambitieuse est opportuniste (P3-24) : elle cède aux tentations qui se présentent.
	if (strategy === 'ambitious') {
		return available.find((choice) => isRiskyChoice(choice)) ?? available[available.length - 1]!;
	}
	if (strategy === 'mixed') return available[(turn + view.remaining) % available.length]!;
	return available[hashSeed(`${seed}:${view.instanceId}`) % available.length]!;
}

/**
 * Modèle provisoire de durée active (P3-09), en secondes, à calibrer avec les
 * chronométrages de `PLAYTEST.md` : lecture et choix d'une décision, reprise du
 * plan à chaque épisode d'alerte (l'accélération s'arrête), coup d'œil à
 * chaque trimestre avancé.
 */
export const ACTIVE_TIME_MODEL = {
	decisionSeconds: 30,
	alertSeconds: 40,
	quarterSeconds: 3
} as const;

export function estimateActiveMinutes(
	quarters: number,
	decisions: number,
	alertEpisodes: number
): number {
	const seconds =
		decisions * ACTIVE_TIME_MODEL.decisionSeconds +
		alertEpisodes * ACTIVE_TIME_MODEL.alertSeconds +
		quarters * ACTIVE_TIME_MODEL.quarterSeconds;
	return Math.round(seconds / 60);
}

function justiceCounts(
	state: GameState
): Pick<SimulationRun, 'facts' | 'playerCases' | 'convictions' | 'divertedFundsCents'> {
	const cases = state.cases.filter((legalCase) => legalCase.defendantId === null);
	return {
		facts: state.facts.length,
		playerCases: cases.length,
		convictions: cases.filter((legalCase) => legalCase.outcome === 'convicted').length,
		divertedFundsCents: divertedFunds(state.facts)
	};
}

/** Titres parus dans la carrière, nouvelles d'ambiance comprises, par identifiant. */
function headlineFrequencies(state: GameState): HeadlineFrequency[] {
	const counts = new Map<string, number>();
	for (const entry of state.history) {
		if (entry.type !== 'turn.resolved') continue;
		for (const article of entry.press?.articles ?? []) {
			counts.set(article.headlineId, (counts.get(article.headlineId) ?? 0) + 1);
		}
	}
	return [...counts.entries()]
		.map(([headlineId, count]) => ({ headlineId, count }))
		.sort((left, right) => left.headlineId.localeCompare(right.headlineId));
}

function eventFrequencies(state: GameState): EventFrequency[] {
	return Object.entries(state.events.occurrences)
		.map(([eventId, occurrence]) => ({ eventId, count: occurrence.count }))
		.sort((left, right) => left.eventId.localeCompare(right.eventId));
}

function affiliatedQuarters(state: GameState): number {
	return state.player.affiliations.reduce(
		(total, affiliation) => total + (affiliation.toTurn ?? state.turn) - affiliation.fromTurn,
		0
	);
}

function finalizeRun(
	state: GameState,
	strategy: SimulationStrategy,
	seed: string,
	status: SimulationRunStatus,
	decisions: number,
	alertEpisodes: number,
	invariantViolations: readonly string[],
	error: string | null,
	content: Content,
	peakPopularity: number,
	eligible: readonly number[] = []
): SimulationRun {
	const summary = careerSummary(state);
	const sortedEligible = [...eligible].sort((a, b) => a - b);
	return {
		eligibleEventsP10: percentile(sortedEligible, 0.1),
		quartersBelowEligibleTarget: eligible.length
			? Math.round((eligible.filter((count) => count < 8).length * 100) / eligible.length)
			: 0,
		seed,
		strategy,
		status,
		turns: summary.quartersPlayed,
		endingAge: summary.age,
		endCause: summary.cause,
		decisions,
		alertEpisodes,
		significantInterventions: decisions + alertEpisodes,
		resources: summary.resources,
		health: state.player.health,
		stress: state.player.stress,
		upgradesOwned: summary.upgradesOwned,
		actionsPerformed: summary.actionsPerformed,
		purchases: summary.purchases,
		quartersWithSuspension: summary.quartersWithSuspension,
		eventsExperienced: summary.eventsExperienced,
		eventOccurrences: eventFrequencies(state),
		repeatedEvents: eventFrequencies(state).filter((event) => event.count > 2).length,
		repeatedHeadlines: headlineFrequencies(state).reduce(
			(total, headline) => total + headline.count - 1,
			0
		),
		headlineOccurrences: headlineFrequencies(state),
		finalParty: state.player.partyId,
		affiliations: state.player.affiliations.length,
		quartersAffiliated: affiliatedQuarters(state),
		leaderChanges: state.history.reduce(
			(total, entry) =>
				total + (entry.type === 'turn.resolved' ? (entry.world?.leaderChanges.length ?? 0) : 0),
			0
		),
		indicatorRanges: indicatorRanges(state),
		charactersMet: Object.keys(state.relationships).length,
		characterDepartures: Object.values(state.characters).filter(
			(character) => character.status !== 'active'
		).length,
		traitsRevealed: Object.values(state.characters).reduce(
			(total, character) =>
				total +
				character.knownTraits.filter((trait) => content.traits[trait]?.hidden === true).length,
			0
		),
		mandatesHeld: state.mandates.length,
		highestMandate:
			[...state.mandates].sort(
				(left, right) =>
					(content.mandates[right.mandateId]?.rank ?? 0) -
					(content.mandates[left.mandateId]?.rank ?? 0)
			)[0]?.mandateId ?? null,
		campaigns: state.campaigns.length,
		campaignsWon: state.campaigns.filter((campaign) => campaign.status === 'won').length,
		campaignsLost: state.campaigns.filter((campaign) => campaign.status === 'lost').length,
		campaignsByElection: Object.fromEntries(
			content.electionIds.map((electionId) => {
				const ran = state.campaigns.filter(
					(campaign) => campaign.electionId === electionId && campaign.status !== 'running'
				);
				return [
					electionId,
					{ ran: ran.length, won: ran.filter((campaign) => campaign.status === 'won').length }
				];
			})
		),
		fortuneSpentPercent: (() => {
			const outlets = (kind: 'action' | 'purchase', id: string): boolean =>
				kind === 'purchase'
					? ['wealth.foundation', 'wealth.local_media', 'wealth.national_media'].includes(id)
					: content.actions[id]?.scale?.family === 'family.donation' ||
						content.actions[id]?.scale?.family === 'family.campaign_advance' ||
						id === 'wealth.patronage';
			const spent = state.history.reduce(
				(total, entry) =>
					entry.type !== 'turn.resolved'
						? total
						: total +
							entry.steps.reduce(
								(sum, step) =>
									outlets(step.kind, step.id)
										? sum -
											step.changes
												.filter((change) => change.resource === 'personalCashCents')
												.reduce((cash, change) => cash + Math.min(0, change.delta), 0)
										: sum,
								0
							),
				0
			);
			const remaining = Math.max(0, netWorth(state.resources, state.upgrades));
			return spent + remaining > 0 ? Math.round((spent * 100) / (spent + remaining)) : 0;
		})(),
		partyRankPeak: (() => {
			const ranks = state.history.flatMap((entry) =>
				entry.type === 'turn.resolved'
					? (entry.deadlines?.mandates ?? []).flatMap((change) =>
							change.kind === 'partyRank' ? [change.rank] : []
						)
					: []
			);
			if (ranks.includes('leader')) return 'leader' as const;
			if (ranks.includes('cadre')) return 'cadre' as const;
			return state.player.affiliations.length > 0 ? ('member' as const) : ('none' as const);
		})(),
		runoffs: state.campaigns.filter(
			(campaign) =>
				state.ballots.find((ballot) => ballot.ballotId === campaign.ballotId)?.report
					?.secondRound === true
		).length,
		distinctOpponents: new Set(
			state.campaigns.flatMap((campaign) => (campaign.opponentId ? [campaign.opponentId] : []))
		).size,
		origin: state.player.origin,
		region: state.player.territory.regionId,
		townSize: state.player.territory.homeTown.sizeId,
		engagement: state.player.engagement,
		children: state.player.family.childrenIds.length,
		promisesMade: state.promises.length,
		promisesKept: state.promises.filter((pledge) => pledge.status === 'kept').length,
		promisesPartial: state.promises.filter((pledge) => pledge.status === 'partial').length,
		promisesAbandoned: state.promises.filter((pledge) => pledge.status === 'abandoned').length,
		...pressCounts(state, content),
		...activistCounts(state, content),
		reformsProposed: state.institutions.reforms.filter((reform) => reform.origin === 'player')
			.length,
		reformsAdopted: state.institutions.reforms.filter(
			(reform) => reform.origin === 'player' && reform.status !== 'rejected'
		).length,
		obituary: obituaryOf(state, content)?.id ?? null,
		distinctions: distinctionsOf(state, content).map((distinction) => distinction.id),
		governmentReforms: state.institutions.reforms.filter((reform) => reform.origin === 'government')
			.length,
		separations: state.history.reduce(
			(total, entry) =>
				total +
				(entry.type === 'event.resolved'
					? entry.politics.filter((change) => change.kind === 'separated').length
					: 0),
			0
		),
		staffHired: state.staff.length,
		staffDepartures: state.staff.filter((member) => member.status === 'left').length,
		...recruitmentCounts(state),
		...scaleCounts(state, content),
		...justiceCounts(state),
		resignations: state.mandates.filter((mandate) => mandate.endReason === 'resigned').length,
		estimatedActiveMinutes: estimateActiveMinutes(summary.quartersPlayed, decisions, alertEpisodes),
		maxRivalEncounters: Math.max(
			0,
			...Object.values(
				state.campaigns.reduce<Record<string, number>>((counts, campaign) => {
					if (campaign.opponentId && campaign.status !== 'running') {
						counts[campaign.opponentId] = (counts[campaign.opponentId] ?? 0) + 1;
					}
					return counts;
				}, {})
			)
		),
		finalPopularity: state.player.popularity,
		peakPopularity,
		ballotsHeld: state.ballots.filter((ballot) => ballot.status === 'held').length,
		governmentChanges: state.history.reduce(
			(total, entry) =>
				total +
				(entry.type === 'turn.resolved'
					? (entry.deadlines?.ballots.filter(
							(ballot) => ballot.governingAfter !== ballot.governingBefore
						).length ?? 0)
					: 0),
			0
		),
		invariantViolations,
		error
	};
}

/** Extrêmes des indicateurs, reconstitués depuis l'état final et le journal. */
function indicatorRanges(state: GameState): SimulationRun['indicatorRanges'] {
	const current = { ...state.world.indicators };
	const ranges = Object.fromEntries(
		INDICATOR_IDS.map((id) => [id, { min: current[id], max: current[id] }])
	) as Record<IndicatorId, { min: number; max: number }>;
	// Remonte le temps : chaque variation journalisée est annulée dans l'ordre inverse.
	for (const entry of [...state.history].reverse()) {
		const changes =
			entry.type === 'turn.resolved'
				? [
						...entry.events.flatMap((event) => event.politics),
						...(entry.world?.indicators.map((change) => ({
							kind: 'indicator' as const,
							...change
						})) ?? []),
						...entry.steps.flatMap((step) => step.politics)
					]
				: entry.politics;
		for (const change of changes) {
			if (change.kind !== 'indicator') continue;
			current[change.indicator] -= change.delta;
			const range = ranges[change.indicator];
			range.min = Math.min(range.min, current[change.indicator]);
			range.max = Math.max(range.max, current[change.indicator]);
		}
	}
	return ranges;
}

/** Simule une carrière avec les mêmes transitions que le jeu interactif. */
export function simulateCareer(
	seed: string,
	strategy: SimulationStrategy,
	maxTurns: number,
	content: Content
): SimulationRun {
	if (!Number.isSafeInteger(maxTurns) || maxTurns < 1) {
		throw new RangeError(`Plafond de tours invalide : ${maxTurns}`);
	}
	// Origine et engagement tirées de la seed du lot (P2-08), sans toucher au PRNG de la partie.
	let state = createGame(
		{
			seed,
			origin: content.originIds[hashSeed(`${seed}:origine`) % content.originIds.length]!,
			engagement:
				content.engagementIds[hashSeed(`${seed}:engagement`) % content.engagementIds.length]!,
			region: content.regionIds[hashSeed(`${seed}:region`) % content.regionIds.length]!
		},
		content
	);
	let decisions = 0;
	let peakPopularity = state.player.popularity;
	let alertEpisodes = 0;
	let activeAlertIds = new Set<string>();
	let error: string | null = null;
	let violations = checkInvariants(state, content);
	const eligible: number[] = [];

	while (state.end === null && state.turn < maxTurns && error === null && violations.length === 0) {
		// Couverture (P3-24) : événements ordinaires éligibles au début de chaque trimestre.
		eligible.push(eligibleRandomEvents(state, content).length);
		const plan = chooseSimulationPlan(state, strategy, seed, content);
		const preview = previewPlan(state, plan, content);
		if (!preview.valid) {
			error = `Plan de simulation invalide au tour ${state.turn}.`;
			break;
		}
		const alerts = accelerationAlerts(state, plan, content);
		if (alerts.some((alert) => !activeAlertIds.has(alert.id))) alertEpisodes += 1;
		activeAlertIds = new Set(alerts.map((alert) => alert.id));

		const advanced = transition(state, commitTurn(plan), content);
		if (!advanced.ok) {
			error = `${advanced.error.code} au tour ${state.turn} : ${advanced.error.message}`;
			break;
		}
		state = advanced.state;
		peakPopularity = Math.max(peakPopularity, state.player.popularity);
		violations = checkInvariants(state, content);

		while (state.phase === 'decision' && error === null && violations.length === 0) {
			const view = describePendingEvent(state, content);
			if (!view) {
				error = `Décision sans vue publique au tour ${state.turn}.`;
				break;
			}
			const choice = chooseSimulationDecision(
				view,
				strategy,
				seed,
				state.turn,
				content.balance.government.appointmentEvent
			);
			if (!choice) {
				error = `Aucun choix public disponible pour ${view.eventId}.`;
				break;
			}
			const chosen = transition(state, chooseEventCommand(view.instanceId, choice.id), content);
			if (!chosen.ok) {
				error = `${chosen.error.code} pour ${view.eventId} : ${chosen.error.message}`;
				break;
			}
			state = chosen.state;
			decisions += 1;
			violations = checkInvariants(state, content);
		}
	}

	const status: SimulationRunStatus =
		error !== null || violations.length > 0 ? 'error' : state.end !== null ? 'ended' : 'capped';
	return finalizeRun(
		state,
		strategy,
		seed,
		status,
		decisions,
		alertEpisodes,
		violations,
		error,
		content,
		peakPopularity,
		eligible
	);
}

function percentile(sorted: readonly number[], ratio: number): number {
	return sorted[Math.floor((sorted.length - 1) * ratio)] ?? 0;
}

function round(value: number): number {
	return Math.round(value * 100) / 100;
}

export function distribution(values: readonly number[]): Distribution {
	if (values.length === 0) return { min: 0, p10: 0, median: 0, mean: 0, p90: 0, max: 0 };
	const sorted = [...values].sort((left, right) => left - right);
	return {
		min: sorted[0]!,
		p10: percentile(sorted, 0.1),
		median: percentile(sorted, 0.5),
		mean: round(sorted.reduce((total, value) => total + value, 0) / sorted.length),
		p90: percentile(sorted, 0.9),
		max: sorted[sorted.length - 1]!
	};
}

function strategySummary(
	strategy: SimulationStrategy,
	runs: readonly SimulationRun[]
): StrategySummary {
	const selected = runs.filter((run) => run.strategy === strategy);
	const causes: Record<string, number> = {};
	for (const run of selected) {
		if (run.endCause) causes[run.endCause] = (causes[run.endCause] ?? 0) + 1;
	}
	const resources = (resource: ResourceId): Distribution =>
		distribution(selected.map((run) => run.resources[resource]));
	return {
		strategy,
		runs: selected.length,
		ended: selected.filter((run) => run.status === 'ended').length,
		capped: selected.filter((run) => run.status === 'capped').length,
		errors: selected.filter((run) => run.status === 'error').length,
		endCauses: causes,
		turns: distribution(selected.map((run) => run.turns)),
		endingAge: distribution(selected.map((run) => run.endingAge)),
		decisions: distribution(selected.map((run) => run.decisions)),
		alertEpisodes: distribution(selected.map((run) => run.alertEpisodes)),
		significantInterventions: distribution(selected.map((run) => run.significantInterventions)),
		quartersWithSuspension: distribution(selected.map((run) => run.quartersWithSuspension)),
		upgradesOwned: distribution(selected.map((run) => run.upgradesOwned)),
		quartersAffiliated: distribution(selected.map((run) => run.quartersAffiliated)),
		resources: {
			influence: resources('influence'),
			politicalBudgetCents: resources('politicalBudgetCents'),
			personalCashCents: resources('personalCashCents')
		},
		estimatedActiveMinutes: distribution(selected.map((run) => run.estimatedActiveMinutes)),
		staffHired: distribution(selected.map((run) => run.staffHired)),
		staffDepartures: distribution(selected.map((run) => run.staffDepartures)),
		promisesMade: distribution(selected.map((run) => run.promisesMade)),
		promisesKept: distribution(selected.map((run) => run.promisesKept)),
		facts: distribution(selected.map((run) => run.facts)),
		convictions: distribution(selected.map((run) => run.convictions)),
		resignations: distribution(selected.map((run) => run.resignations)),
		mandatesHeld: distribution(selected.map((run) => run.mandatesHeld)),
		highestMandates: countBy(selected, (run) => run.highestMandate ?? 'none')
	};
}

function countBy(
	runs: readonly SimulationRun[],
	key: (run: SimulationRun) => string
): Record<string, number> {
	return runs.reduce<Record<string, number>>((totals, run) => {
		totals[key(run)] = (totals[key(run)] ?? 0) + 1;
		return totals;
	}, {});
}

function aggregateEvents(runs: readonly SimulationRun[]): AggregateEventFrequency[] {
	const totals = new Map<string, { count: number; careers: number; maxPerCareer: number }>();
	for (const run of runs) {
		for (const event of run.eventOccurrences) {
			const current = totals.get(event.eventId) ?? { count: 0, careers: 0, maxPerCareer: 0 };
			totals.set(event.eventId, {
				count: current.count + event.count,
				careers: current.careers + 1,
				maxPerCareer: Math.max(current.maxPerCareer, event.count)
			});
		}
	}
	return [...totals.entries()]
		.map(([eventId, values]) => ({ eventId, ...values }))
		.sort((left, right) => right.count - left.count || left.eventId.localeCompare(right.eventId));
}

function aggregateHeadlines(runs: readonly SimulationRun[]): AggregateHeadlineFrequency[] {
	const totals = new Map<string, { count: number; careers: number; maxPerCareer: number }>();
	for (const run of runs) {
		for (const headline of run.headlineOccurrences) {
			const current = totals.get(headline.headlineId) ?? { count: 0, careers: 0, maxPerCareer: 0 };
			totals.set(headline.headlineId, {
				count: current.count + headline.count,
				careers: current.careers + 1,
				maxPerCareer: Math.max(current.maxPerCareer, headline.count)
			});
		}
	}
	return [...totals.entries()]
		.map(([headlineId, values]) => ({ headlineId, ...values }))
		.sort(
			(left, right) => right.count - left.count || left.headlineId.localeCompare(right.headlineId)
		);
}

/** Contenus jamais atteints et couverture par catégorie d'événements (P3-15). */
function contentCoverage(runs: readonly SimulationRun[], content: Content): ContentCoverage {
	const occurrences = new Map<string, number>();
	for (const run of runs) {
		for (const event of run.eventOccurrences) {
			occurrences.set(event.eventId, (occurrences.get(event.eventId) ?? 0) + event.count);
		}
	}
	const usedHeadlines = new Set(
		runs.flatMap((run) => run.headlineOccurrences.map((headline) => headline.headlineId))
	);
	const categories: Record<string, { events: number; reached: number; occurrences: number }> = {};
	for (const eventId of content.eventIds) {
		const category = content.events[eventId]!.category;
		const current = categories[category] ?? { events: 0, reached: 0, occurrences: 0 };
		const count = occurrences.get(eventId) ?? 0;
		categories[category] = {
			events: current.events + 1,
			reached: current.reached + (count > 0 ? 1 : 0),
			occurrences: current.occurrences + count
		};
	}
	return {
		eventsNeverReached: content.eventIds.filter((eventId) => !occurrences.has(eventId)),
		headlinesNeverUsed: content.headlines
			.map((headline) => headline.id)
			.filter((id) => !usedHeadlines.has(id)),
		categories
	};
}

function aggregateRuns(runs: readonly SimulationRun[], content: Content): SimulationAggregate {
	const causes: Record<string, number> = {};
	for (const run of runs) {
		if (run.endCause) causes[run.endCause] = (causes[run.endCause] ?? 0) + 1;
	}
	const resources = (resource: ResourceId): Distribution =>
		distribution(runs.map((run) => run.resources[resource]));
	return {
		runs: runs.length,
		ended: runs.filter((run) => run.status === 'ended').length,
		capped: runs.filter((run) => run.status === 'capped').length,
		errors: runs.filter((run) => run.status === 'error').length,
		invariantViolations: runs.reduce((total, run) => total + run.invariantViolations.length, 0),
		turns: distribution(runs.map((run) => run.turns)),
		endingAge: distribution(runs.map((run) => run.endingAge)),
		decisions: distribution(runs.map((run) => run.decisions)),
		alertEpisodes: distribution(runs.map((run) => run.alertEpisodes)),
		significantInterventions: distribution(runs.map((run) => run.significantInterventions)),
		resources: {
			influence: resources('influence'),
			politicalBudgetCents: resources('politicalBudgetCents'),
			personalCashCents: resources('personalCashCents')
		},
		endCauses: causes,
		leaderChanges: distribution(runs.map((run) => run.leaderChanges)),
		charactersMet: distribution(runs.map((run) => run.charactersMet)),
		characterDepartures: distribution(runs.map((run) => run.characterDepartures)),
		traitsRevealed: distribution(runs.map((run) => run.traitsRevealed)),
		mandatesHeld: distribution(runs.map((run) => run.mandatesHeld)),
		governmentChanges: distribution(runs.map((run) => run.governmentChanges)),
		campaigns: distribution(runs.map((run) => run.campaigns)),
		campaignsWon: distribution(runs.map((run) => run.campaignsWon)),
		maxRivalEncounters: distribution(runs.map((run) => run.maxRivalEncounters)),
		staffHired: distribution(runs.map((run) => run.staffHired)),
		estimatedActiveMinutes: distribution(runs.map((run) => run.estimatedActiveMinutes)),
		finalPopularity: distribution(runs.map((run) => run.finalPopularity)),
		peakPopularity: distribution(runs.map((run) => run.peakPopularity)),
		highestMandates: countBy(runs, (run) => run.highestMandate ?? 'none'),
		finalParties: countBy(runs, (run) => run.finalParty ?? 'none'),
		indicatorExtremes: Object.fromEntries(
			INDICATOR_IDS.map((id) => [
				id,
				{
					min: Math.min(...runs.map((run) => run.indicatorRanges[id].min)),
					max: Math.max(...runs.map((run) => run.indicatorRanges[id].max))
				}
			])
		) as SimulationAggregate['indicatorExtremes'],
		strategies: SIMULATION_STRATEGIES.filter((strategy) =>
			runs.some((run) => run.strategy === strategy)
		).map((strategy) => strategySummary(strategy, runs)),
		events: aggregateEvents(runs),
		repeatedEvents: distribution(runs.map((run) => run.repeatedEvents)),
		repeatedHeadlines: distribution(runs.map((run) => run.repeatedHeadlines)),
		headlines: aggregateHeadlines(runs),
		coverage: contentCoverage(runs, content),
		problemSeeds: runs.flatMap((run): ProblemSeed[] =>
			run.status === 'ended'
				? []
				: [
						{
							seed: run.seed,
							strategy: run.strategy,
							status: run.status,
							error: run.error,
							invariantViolations: run.invariantViolations
						}
					]
		)
	};
}

function validateConfig(config: SimulationConfig): void {
	if (!Number.isSafeInteger(config.runs) || config.runs < 1) {
		throw new RangeError(`Nombre de carrières invalide : ${config.runs}`);
	}
	if (!Number.isSafeInteger(config.maxTurns) || config.maxTurns < 1) {
		throw new RangeError(`Plafond de tours invalide : ${config.maxTurns}`);
	}
	if (config.strategy !== 'all' && !SIMULATION_STRATEGIES.includes(config.strategy)) {
		throw new RangeError(`Stratégie inconnue : ${config.strategy}`);
	}
	const seedError = validateSeed(config.seed);
	if (seedError) throw new RangeError(seedError);
}

function derivedSeed(base: string, index: number): string {
	const suffix = `-${index + 1}`;
	if (base.length + suffix.length <= 64) return `${base}${suffix}`;
	return `simulation-${hashSeed(base).toString(16).padStart(8, '0')}${suffix}`;
}

/** Lance un lot reproductible et calcule son rapport agrégé. */
export function simulateBatch(config: SimulationConfig, content: Content): SimulationReport {
	validateConfig(config);
	const runs: SimulationRun[] = [];
	for (let index = 0; index < config.runs; index += 1) {
		const strategy =
			config.strategy === 'all'
				? SIMULATION_STRATEGIES[index % SIMULATION_STRATEGIES.length]!
				: config.strategy;
		runs.push(simulateCareer(derivedSeed(config.seed, index), strategy, config.maxTurns, content));
	}
	return {
		reportVersion: SIMULATION_REPORT_VERSION,
		rulesVersion: RULES_VERSION,
		contentVersion: content.version,
		config,
		unavailableMetrics: [],
		aggregate: aggregateRuns(runs, content),
		runs
	};
}

function csvCell(value: string | number | null): string {
	const text = value === null ? '' : String(value);
	return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Une ligne CSV par carrière, avec les occurrences d'événements en JSON compact. */
export function simulationReportToCsv(report: SimulationReport): string {
	const headers = [
		'seed',
		'strategy',
		'status',
		'turns',
		'endingAge',
		'endCause',
		'decisions',
		'alertEpisodes',
		'significantInterventions',
		'influence',
		'politicalBudgetCents',
		'personalCashCents',
		'health',
		'stress',
		'upgradesOwned',
		'actionsPerformed',
		'purchases',
		'quartersWithSuspension',
		'eventsExperienced',
		'eventOccurrences',
		'repeatedEvents',
		'repeatedHeadlines',
		'finalParty',
		'affiliations',
		'quartersAffiliated',
		'leaderChanges',
		'charactersMet',
		'characterDepartures',
		'traitsRevealed',
		'mandatesHeld',
		'highestMandate',
		'ballotsHeld',
		'governmentChanges',
		'campaigns',
		'campaignsWon',
		'campaignsLost',
		'distinctOpponents',
		'maxRivalEncounters',
		'origin',
		'region',
		'townSize',
		'engagement',
		'children',
		'separations',
		'promisesMade',
		'promisesKept',
		'promisesPartial',
		'promisesAbandoned',
		'articles',
		'criticalArticles',
		'favorableArticles',
		'interviews',
		'mediaOwned',
		'activistsFinal',
		'activistsPeak',
		'activistTierPeak',
		'reformsProposed',
		'reformsAdopted',
		'governmentReforms',
		'obituary',
		'distinctions',
		'staffHired',
		'staffDepartures',
		'hiresRefused',
		'payrollFinalCents',
		'teamCompetence',
		'searchesOrdered',
		'raisesGranted',
		'staffProgress',
		'donationsModest',
		'donationsSustained',
		'donationsMajor',
		'campaignAdvances',
		'personalSpentOnPoliticsCents',
		'wealthSpentPercent',
		'influenceCostEarlyCents',
		'influenceCostLateCents',
		'earlyActionsLateSharePercent',
		'facts',
		'playerCases',
		'convictions',
		'divertedFundsCents',
		'resignations',
		'estimatedActiveMinutes',
		'finalPopularity',
		'peakPopularity',
		'indicatorRanges',
		'invariantViolations',
		'error'
	];
	const rows = report.runs.map((run) => [
		run.seed,
		run.strategy,
		run.status,
		run.turns,
		run.endingAge,
		run.endCause,
		run.decisions,
		run.alertEpisodes,
		run.significantInterventions,
		run.resources.influence,
		run.resources.politicalBudgetCents,
		run.resources.personalCashCents,
		run.health,
		run.stress,
		run.upgradesOwned,
		run.actionsPerformed,
		run.purchases,
		run.quartersWithSuspension,
		run.eventsExperienced,
		JSON.stringify(run.eventOccurrences),
		run.repeatedEvents,
		run.repeatedHeadlines,
		run.finalParty,
		run.affiliations,
		run.quartersAffiliated,
		run.leaderChanges,
		run.charactersMet,
		run.characterDepartures,
		run.traitsRevealed,
		run.mandatesHeld,
		run.highestMandate,
		run.ballotsHeld,
		run.governmentChanges,
		run.campaigns,
		run.campaignsWon,
		run.campaignsLost,
		run.distinctOpponents,
		run.maxRivalEncounters,
		run.origin,
		run.region,
		run.townSize,
		run.engagement,
		run.children,
		run.separations,
		run.promisesMade,
		run.promisesKept,
		run.promisesPartial,
		run.promisesAbandoned,
		run.articles,
		run.criticalArticles,
		run.favorableArticles,
		run.interviews,
		run.mediaOwned,
		run.activistsFinal,
		run.activistsPeak,
		run.activistTierPeak,
		run.reformsProposed,
		run.reformsAdopted,
		run.governmentReforms,
		run.obituary ?? '',
		run.distinctions.join('|'),
		run.staffHired,
		run.staffDepartures,
		run.hiresRefused,
		run.payrollFinalCents,
		run.teamCompetence,
		run.searchesOrdered,
		run.raisesGranted,
		run.staffProgress,
		run.donationsModest,
		run.donationsSustained,
		run.donationsMajor,
		run.campaignAdvances,
		run.personalSpentOnPoliticsCents,
		run.wealthSpentPercent,
		run.influenceCostEarlyCents,
		run.influenceCostLateCents,
		run.earlyActionsLateSharePercent,
		run.facts,
		run.playerCases,
		run.convictions,
		run.divertedFundsCents,
		run.resignations,
		run.estimatedActiveMinutes,
		run.finalPopularity,
		run.peakPopularity,
		JSON.stringify(run.indicatorRanges),
		JSON.stringify(run.invariantViolations),
		run.error
	]);
	return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}
