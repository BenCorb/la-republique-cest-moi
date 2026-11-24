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
export const RULES_VERSION = '0.2.0';

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
	type ActionRecord,
	type NewGameConfig,
	type PlayerState,
	type ResourceChange
} from './state.ts';
export {
	commitTurn,
	type CommandError,
	type CommandErrorCode,
	type CommitTurnCommand,
	type GameCommand,
	type PlannedAction,
	type TransitionFailure,
	type TransitionResult,
	type TransitionSuccess,
	type TurnPlan
} from './commands.ts';
export {
	RESOURCE_LABELS,
	executePlan,
	previewPlan,
	type PlanExecution,
	type PlanIssue,
	type PlanIssueCode,
	type PlanPreview,
	type PlanStepPreview,
	type ResourceRange,
	type ResourceRanges
} from './actions.ts';
export { evaluateCondition, readStat, type ConditionContext } from './conditions.ts';
export { effectRange, resolveEffect, type EffectRange, type ResolvedEffect } from './effects.ts';
export { transition } from './turn.ts';
export { assertInvariants, checkInvariants } from './invariants.ts';
