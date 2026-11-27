/**
 * API publique du moteur de simulation.
 *
 * Le moteur est du TypeScript pur : il ne dépend ni de Svelte, ni du DOM, ni du
 * stockage navigateur, ni du réseau, ni de l'horloge réelle, ni de `Math.random()`
 * (voir ARCHITECTURE.md §2 et §6). Ces frontières sont vérifiées par
 * `tests/unit/engine-boundaries.test.ts`.
 *
 * Même seed + mêmes commandes + mêmes versions = même état et même journal.
 */

/** Version des règles du moteur, enregistrée plus tard dans les sauvegardes. */
export const RULES_VERSION = '0.34.0';

export {
	START_YEAR,
	TURNS_PER_YEAR,
	ageAt,
	formatTurn,
	quarterOf,
	turnOf,
	yearOf,
	type Quarter,
	type Turn
} from './calendar.ts';
export {
	RNG_ALGORITHM,
	SEED_MAX_LENGTH,
	createRng,
	hashSeed,
	nextFloat,
	nextInt,
	nextUint32,
	validateSeed,
	type Draw,
	type RngState
} from './random.ts';
export {
	PROTOTYPE_STARTING_AGE,
	START_TURN,
	STATE_SCHEMA_VERSION,
	createGame,
	type EndState,
	type GamePhase,
	type GameState,
	type HistoryEntry,
	type ChoiceRecord,
	type DeathCause,
	type EventInstance,
	type EventOccurrence,
	type EventRecord,
	type EventsState,
	type Fact,
	type CaseEventKind,
	type CaseOutcome,
	type CaseStage,
	type JusticeRecord,
	type LegalCase,
	type PromiseChange,
	type PromiseRecord,
	type PromisesRecord,
	type Article,
	type MediaState,
	type PressRecord,
	type InstitutionsRecord,
	type QuarterSnapshot,
	type ReformRecord,
	type Sentence,
	type JournalEntry,
	type PressMemory,
	type ScheduledEvent,
	type EconomyRecord,
	type GaugeChange,
	type NewGameConfig,
	type OwnedUpgrade,
	type PlayerState,
	type ProducerRecord,
	type WealthRecord,
	type ResourceChange,
	type StepRecord,
	type WellbeingContribution,
	type WellbeingRecord,
	type WellbeingSource,
	type Affiliation,
	type Ballot,
	type BallotShare,
	type Campaign,
	type CampaignStatus,
	type FamilyState,
	type ShortlistEntry,
	type StaffLeaveReason,
	type StaffMember,
	type StaffProductionRecord,
	type StaffRecord,
	type DeadlinesRecord,
	type InstitutionsState,
	type MandateEndReason,
	type MandateInstance,
	type Character,
	type CharacterStatus,
	type CharactersRecord,
	type Memory,
	type PeopleChange,
	type Relationship,
	type LeaderChange,
	type PartyState,
	type PoliticalChange,
	type WorldRecord,
	type WorldState
} from './state.ts';
export {
	createTerritory,
	departmentOf,
	generateTownName,
	localRivalModifier,
	placeOf,
	regionalMedia,
	resolveMediaRef,
	territoryEffects,
	type HomeTown,
	type TerritoryState
} from './territory.ts';
export {
	EMPTY_FAMILY,
	applyFamilyEffect,
	closeFamily,
	createFamily,
	isFamilyEffect,
	livingChildren,
	resolveFamily,
	shiftFamily,
	type FamilyEffect,
	type FamilyParts,
	type FamilyRecord
} from './family.ts';
export {
	activeStaff,
	applyPostEffect,
	applyStaffEffect,
	bindEventPost,
	dismissIssue,
	hireIssue,
	hireReserveCents,
	isStaffEffect,
	missionIssue,
	occupantOf,
	pollingCompetence,
	postEffectIssue,
	postUnlocked,
	resolveStaffFrontier,
	resolveStaffProduction,
	scaledValue,
	staffLeavesByEvent,
	staffTimeBonus,
	type EntourageParts,
	type ProductionParts,
	type StaffEffect
} from './staff.ts';
export {
	computePopularity,
	partyAffinity,
	resolveSupports,
	startingSupports,
	supportReference,
	withPopularity,
	type FrontierSupports
} from './supports.ts';
export {
	activeMandates,
	countsTowardCumul,
	cumulatedMandates,
	applyCareerEffect,
	ballotId,
	campaignId,
	campaignPoll,
	campaignRefund,
	campaignScore,
	candidacyIssue,
	careerEffectIssue,
	opponentStrength,
	partyPollShare,
	rivalWins,
	runningCampaigns,
	conflictingMandates,
	createCalendar,
	holdIssue,
	isIneligible,
	isCareerEffect,
	mainMandate,
	mandateIncome,
	reservedTime,
	resolveDeadlines,
	scheduledBallot,
	termId,
	type CareerEffect,
	type CareerParts,
	type DeadlineParts,
	type FrontierDeadlines
} from './career.ts';
export {
	addRelation,
	COMPETENCE_MAX,
	COMPETENCE_MIN,
	characterId,
	completeCastingExists,
	createCast,
	displayName,
	encounterReveal,
	fitsSlot,
	generatePerson,
	meet,
	modulatedDelta,
	resolveCharacters,
	revealAll,
	sortedIds,
	type FrontierCharacters,
	type PersonSpec
} from './characters.ts';
export {
	applyPoliticalEffect,
	createWorld,
	isPoliticalEffect,
	oppositionPartyId,
	resolvePartyReference,
	resolveWorld,
	type FrontierWorld,
	type PoliticalEffect,
	type PoliticalOutcome,
	type WorldCreation
} from './world.ts';
export {
	assignMissionCommand,
	chooseEventCommand,
	commitTurn,
	type AssignMissionCommand,
	type ChooseEventCommand,
	type CommandError,
	type CommandErrorCode,
	type CommitTurnCommand,
	type GameCommand,
	type PlanStep,
	type TransitionFailure,
	type TransitionResult,
	type TransitionSuccess,
	type TurnPlan
} from './commands.ts';
export {
	RESOURCE_LABELS,
	assetProceeds,
	carryOverPlan,
	executePlan,
	instanceIdFor,
	previewPlan,
	prunePlan,
	type PlanExecution,
	type PlanIssue,
	type PlanIssueCode,
	type PlanPreview,
	type PlanRemoval,
	type PlanStepPreview,
	type PlanWarning,
	type ResourceRange,
	type ResourceRanges
} from './plan.ts';
export {
	assetIncome,
	economyRecords,
	isProducing,
	resolveEconomy,
	type EconomyResult,
	type ProducerForecast,
	type ProducerStatus
} from './economy.ts';
export { evaluateCondition, hasCapability, readStat, type ConditionContext } from './conditions.ts';
export {
	applyGauge,
	clampGauge,
	effectRange,
	gaugeKey,
	resolveEffect,
	type EffectRange,
	type ResolvedEffect
} from './effects.ts';
export {
	ageBandFor,
	forecastWellbeing,
	resolveWellbeing,
	workloadStress,
	type WellbeingForecast,
	type WellbeingResolution
} from './health.ts';
export { assetsValue, comfortStress, netWorth, revalueAssets } from './wealth.ts';
export {
	applyPromiseEffect,
	expandPromiseEffects,
	findPledge,
	isOpenPledge,
	isPromiseEffect,
	pledgeCampaign,
	pledgeInstanceId,
	pledgeIssue,
	promiseCounts,
	promiseIssue,
	promiseOutcomeEffects,
	resolvePromises,
	settlementOutcome,
	type PromiseEffect,
	type PromisesParts,
	type PromisesResolution
} from './promises.ts';
export {
	distinctionsOf,
	endCauseOf,
	highestOffice,
	legacyMetrics,
	meetsCriteria,
	obituaryOf,
	type LegacyMetrics
} from './legacy.ts';
export { eraAt, eraIndexAt, eraReached, inEras } from './eras.ts';
export {
	activationLabel,
	activationTurnAfter,
	activeModifiers,
	adoptionPercent,
	effectiveContent,
	pendingReform,
	reformIssue,
	reformInstanceId,
	resolveReforms,
	startingParameters,
	type ReformsParts,
	type ReformsResolution
} from './reforms.ts';
export {
	ALWAYS_COVERED_TOPICS,
	MIN_HEADLINE_POOL,
	articleAngle,
	articleEffect,
	articleTone,
	drawHeadline,
	headlinePoolKey,
	followsPlayer,
	headlineCandidates,
	headlinePoolReport,
	interviewIssue,
	mediaIssue,
	ownedMedia,
	pressAudience,
	resolvePress,
	type PressAudience,
	type HeadlinePool,
	type PressInputs,
	type PressParts,
	type PressResolution
} from './press.ts';
export { careerSummary, type CareerSummary, type EndCause } from './selectors.ts';
export {
	caseInstanceId,
	convictionPercent,
	createFact,
	currentJudicialRisk,
	factIssue,
	dismissalPercent,
	openCases,
	resolveJustice,
	revealPercent,
	divertedFunds,
	factInstanceId,
	judicialRisk,
	referenceExposure,
	resolveExposure,
	type JudicialRisk,
	type RiskContribution
} from './justice.ts';
export {
	actorName,
	choiceAvailability,
	describePendingEvent,
	eventInstanceId,
	renderTemplate,
	resolveEventFrontier,
	type ChoiceAvailability,
	type EventChoiceView,
	type FrontierInput,
	type FrontierResult,
	type PendingEventView
} from './events.ts';
export { transition } from './turn.ts';
export {
	accelerate,
	accelerationAlerts,
	caseStepMessage,
	type AccelerationAlert,
	type AccelerationAlertKind,
	type AccelerationRequest,
	type AccelerationResult,
	type AccelerationStopReason
} from './acceleration.ts';
export { assertInvariants, checkContentReferences, checkInvariants } from './invariants.ts';
