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
export const RULES_VERSION = '0.20.0';

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
	type JournalEntry,
	type ScheduledEvent,
	type EconomyRecord,
	type GaugeChange,
	type NewGameConfig,
	type OwnedUpgrade,
	type PlayerState,
	type ProducerRecord,
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
	applyStaffEffect,
	dismissIssue,
	hireIssue,
	isStaffEffect,
	missionIssue,
	occupantOf,
	pollingCompetence,
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
	carryOverPlan,
	executePlan,
	instanceIdFor,
	previewPlan,
	type PlanExecution,
	type PlanIssue,
	type PlanIssueCode,
	type PlanPreview,
	type PlanStepPreview,
	type PlanWarning,
	type ResourceRange,
	type ResourceRanges
} from './plan.ts';
export {
	economyRecords,
	isProducing,
	resolveEconomy,
	type EconomyResult,
	type ProducerForecast,
	type ProducerStatus
} from './economy.ts';
export { evaluateCondition, readStat, type ConditionContext } from './conditions.ts';
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
export { careerSummary, type CareerSummary } from './selectors.ts';
export {
	createFact,
	currentJudicialRisk,
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
	type AccelerationAlert,
	type AccelerationAlertKind,
	type AccelerationRequest,
	type AccelerationResult,
	type AccelerationStopReason
} from './acceleration.ts';
export { assertInvariants, checkContentReferences, checkInvariants } from './invariants.ts';
