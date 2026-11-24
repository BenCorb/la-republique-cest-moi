/**
 * Simulateur automatique de carrières (ARCHITECTURE.md §11.1).
 *
 * Le simulateur orchestre exclusivement les commandes publiques du moteur. Les
 * politiques construisent leurs plans depuis le catalogue et la prévision, puis
 * choisissent les décisions depuis `PendingEventView`, qui n'expose aucun effet
 * caché. Elles ne lisent jamais le PRNG de la partie.
 */
import type { Content, ResourceId, Resources } from '../content/types.ts';
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
	previewPlan,
	transition,
	validateSeed,
	type DeathCause,
	type EventChoiceView,
	type GameState,
	type PendingEventView,
	type PlanStep,
	type TurnPlan
} from '../engine/index.ts';

export const SIMULATION_REPORT_VERSION = 1;
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

export interface SimulationRun {
	readonly seed: string;
	readonly strategy: SimulationStrategy;
	readonly status: SimulationRunStatus;
	readonly turns: number;
	readonly endingAge: number;
	readonly endCause: DeathCause | null;
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
	readonly resources: { readonly [K in ResourceId]: Distribution };
}

export interface AggregateEventFrequency extends EventFrequency {
	readonly careers: number;
	readonly maxPerCareer: number;
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
	readonly strategies: readonly StrategySummary[];
	readonly events: readonly AggregateEventFrequency[];
	readonly problemSeeds: readonly ProblemSeed[];
}

export interface SimulationReport {
	readonly reportVersion: typeof SIMULATION_REPORT_VERSION;
	readonly rulesVersion: string;
	readonly contentVersion: string;
	readonly config: SimulationConfig;
	/** Systèmes absents du prototype, donc volontairement non simulés. */
	readonly unavailableMetrics: readonly ['mandates', 'promises'];
	readonly aggregate: SimulationAggregate;
	readonly runs: readonly SimulationRun[];
}

const action = (id: string): PlanStep => ({ kind: 'action', id });
const purchase = (id: string): PlanStep => ({ kind: 'purchase', id });

const STRATEGY_WISHES: Readonly<
	Record<Exclude<SimulationStrategy, 'random-valid'>, readonly PlanStep[]>
> = {
	prudent: [
		action('network.meet_officials'),
		action('organization.fundraising'),
		action('personal.freelance'),
		action('personal.rest'),
		action('personal.rest')
	],
	ambitious: [
		action('activism.public_meeting'),
		action('organization.fundraising'),
		action('network.meet_officials'),
		action('personal.donate'),
		action('activism.leaflets'),
		action('activism.leaflets')
	],
	patrimonial: [
		purchase('network.think_tank'),
		purchase('organization.donor_file'),
		purchase('organization.local_office'),
		purchase('communication.press_officer'),
		purchase('organization.volunteer'),
		action('personal.freelance'),
		action('organization.fundraising'),
		action('personal.rest')
	],
	mixed: [
		purchase('organization.donor_file'),
		purchase('organization.volunteer'),
		action('network.meet_officials'),
		action('organization.fundraising'),
		action('personal.freelance'),
		action('personal.rest')
	]
};

function randomWishes(seed: string, turn: number, content: Content): PlanStep[] {
	return [...content.actionIds.map(action), ...content.upgradeIds.map(purchase)].sort(
		(left, right) => {
			const leftRank = hashSeed(`${seed}:${turn}:${left.kind}:${left.id}`);
			const rightRank = hashSeed(`${seed}:${turn}:${right.kind}:${right.id}`);
			return leftRank - rightRank || left.id.localeCompare(right.id);
		}
	);
}

function wishesFor(
	strategy: SimulationStrategy,
	seed: string,
	turn: number,
	content: Content
): readonly PlanStep[] {
	if (strategy === 'random-valid') return randomWishes(seed, turn, content);
	return STRATEGY_WISHES[strategy].filter((step) =>
		step.kind === 'action'
			? Object.hasOwn(content.actions, step.id)
			: Object.hasOwn(content.upgrades, step.id)
	);
}

/** Construit gloutonnement un plan dont chaque ajout reste valide. */
export function chooseSimulationPlan(
	state: GameState,
	strategy: SimulationStrategy,
	seed: string,
	content: Content
): TurnPlan {
	const steps: PlanStep[] = [];
	for (const candidate of wishesFor(strategy, seed, state.turn, content)) {
		const next = { steps: [...steps, candidate] };
		if (previewPlan(state, next, content).valid) steps.push(candidate);
	}
	return { steps };
}

function visibleCost(choice: EventChoiceView): number {
	return choice.costs.reduce((total, cost) => total + cost.amount, 0);
}

/** Politique de choix fondée uniquement sur la vue publique de la décision. */
export function chooseSimulationDecision(
	view: PendingEventView,
	strategy: SimulationStrategy,
	seed: string,
	turn: number
): EventChoiceView | null {
	const available = view.choices.filter((choice) => choice.available);
	if (available.length === 0) return null;
	if (strategy === 'prudent' || strategy === 'patrimonial') {
		return [...available].sort(
			(left, right) => visibleCost(left) - visibleCost(right) || left.id.localeCompare(right.id)
		)[0]!;
	}
	if (strategy === 'ambitious') return available[available.length - 1]!;
	if (strategy === 'mixed') return available[(turn + view.remaining) % available.length]!;
	return available[hashSeed(`${seed}:${view.instanceId}`) % available.length]!;
}

function eventFrequencies(state: GameState): EventFrequency[] {
	return Object.entries(state.events.occurrences)
		.map(([eventId, occurrence]) => ({ eventId, count: occurrence.count }))
		.sort((left, right) => left.eventId.localeCompare(right.eventId));
}

function finalizeRun(
	state: GameState,
	strategy: SimulationStrategy,
	seed: string,
	status: SimulationRunStatus,
	decisions: number,
	alertEpisodes: number,
	invariantViolations: readonly string[],
	error: string | null
): SimulationRun {
	const summary = careerSummary(state);
	return {
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
		invariantViolations,
		error
	};
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
	let state = createGame({ seed }, content);
	let decisions = 0;
	let alertEpisodes = 0;
	let activeAlertIds = new Set<string>();
	let error: string | null = null;
	let violations = checkInvariants(state, content);

	while (state.end === null && state.turn < maxTurns && error === null && violations.length === 0) {
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
		violations = checkInvariants(state, content);

		while (state.phase === 'decision' && error === null && violations.length === 0) {
			const view = describePendingEvent(state, content);
			if (!view) {
				error = `Décision sans vue publique au tour ${state.turn}.`;
				break;
			}
			const choice = chooseSimulationDecision(view, strategy, seed, state.turn);
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
	return finalizeRun(state, strategy, seed, status, decisions, alertEpisodes, violations, error);
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
		resources: {
			influence: resources('influence'),
			politicalBudgetCents: resources('politicalBudgetCents'),
			personalCashCents: resources('personalCashCents')
		}
	};
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

function aggregateRuns(runs: readonly SimulationRun[]): SimulationAggregate {
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
		strategies: SIMULATION_STRATEGIES.filter((strategy) =>
			runs.some((run) => run.strategy === strategy)
		).map((strategy) => strategySummary(strategy, runs)),
		events: aggregateEvents(runs),
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
		unavailableMetrics: ['mandates', 'promises'],
		aggregate: aggregateRuns(runs),
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
		JSON.stringify(run.invariantViolations),
		run.error
	]);
	return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}
