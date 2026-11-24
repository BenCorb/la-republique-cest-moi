/**
 * Plan trimestriel : validation, prévision pure et exécution (ARCHITECTURE.md §5).
 *
 * Un plan est une liste ordonnée d'étapes : actions et achats d'améliorations.
 * Une seule validation sert à la prévision et à la commande `commitTurn`. Elle
 * simule le plan dans l'ordre sur un état de travail :
 *   - les coûts, prix et effets déterministes s'appliquent (un gain certain peut
 *     financer une étape suivante du même plan) ;
 *   - un effet aléatoire ne compte que pour sa borne la plus défavorable
 *     (min(0, min)) : un gain incertain ne finance ni ne débloque jamais une autre
 *     étape, et l'exécution réelle ne peut donc pas descendre sous zéro ;
 *   - une étape fautive est signalée puis ignorée pour la suite de la simulation,
 *     afin de présenter tous les problèmes en une fois.
 * La prévision ajoute l'économie du trimestre (charges et production des
 * améliorations déjà actives), calculée sur le pire cas du plan, ainsi que le
 * stress certain et une fourchette de santé. Elle ne lit ni ne fait avancer le
 * PRNG et n'expose aucune probabilité.
 */
import {
	RESOURCE_IDS,
	type Condition,
	type Content,
	type Effect,
	type GaugeId,
	type ResourceAmount,
	type ResourceId,
	type Resources
} from '../content/types.ts';
import type { PlanStep, TurnPlan } from './commands.ts';
import { evaluateCondition } from './conditions.ts';
import { resolveEconomy, type ProducerForecast } from './economy.ts';
import { applyGauge, effectRange, resolveEffect, type EffectRange } from './effects.ts';
import { forecastWellbeing, type WellbeingForecast } from './health.ts';
import type { RngState } from './random.ts';
import type {
	GameState,
	GaugeChange,
	OwnedUpgrade,
	PlayerState,
	PoliticalChange,
	ResourceChange,
	StepRecord,
	WorldState
} from './state.ts';
import { applyPoliticalEffect, isPoliticalEffect } from './world.ts';
import {
	activeMandates,
	applyCareerEffect,
	candidacyIssue,
	isCareerEffect,
	mandateIncome,
	reservedTime,
	type CareerParts
} from './career.ts';

export type PlanIssueCode =
	| 'invalid_plan'
	| 'unknown_action'
	| 'unknown_upgrade'
	| 'invalid_target'
	| 'repeat_limit'
	| 'owned_limit'
	| 'condition_not_met'
	| 'time_exceeded'
	| 'insufficient_resource';

export interface PlanIssue {
	/** Position de l'étape dans le plan, ou `null` pour un problème global. */
	readonly index: number | null;
	/** Identifiant de l'action ou de l'amélioration concernée. */
	readonly id: string | null;
	readonly code: PlanIssueCode;
	/** Message lisible en français, destiné à l'interface. */
	readonly message: string;
}

/** Avertissement non bloquant : le plan reste valide. */
export interface PlanWarning {
	readonly code: 'upkeep_at_risk' | 'stress_high';
	/** Exemplaire concerné (`upkeep_at_risk`), sinon `null`. */
	readonly instanceId: string | null;
	readonly upgradeId: string | null;
	readonly message: string;
}

export interface ResourceRange {
	readonly min: number;
	readonly max: number;
}

export type ResourceRanges = { readonly [K in ResourceId]: ResourceRange };

export interface PlanStepPreview {
	readonly index: number;
	readonly kind: PlanStep['kind'] | null;
	readonly id: string | null;
	/** Cible de l'étape (parti), sinon `null`. */
	readonly target: string | null;
	readonly label: string | null;
	readonly timeCost: number;
	/** Coûts d'une action ou prix d'un achat, payés à l'étape. */
	readonly costs: readonly ResourceAmount[];
	/** Fourchettes certaines des effets d'une action (vide pour un achat). */
	readonly effects: readonly EffectRange[];
	/** Instance qui sera créée par un achat (actif à partir du trimestre suivant). */
	readonly instanceId: string | null;
	readonly issues: readonly PlanIssue[];
}

export interface PlanPreview {
	readonly valid: boolean;
	readonly timeAvailable: number;
	/** Temps réservé par les mandats en cours (déjà retiré du temps disponible). */
	readonly timeReserved: number;
	/** Temps des étapes valides du plan. */
	readonly timeUsed: number;
	readonly timeRemaining: number;
	readonly steps: readonly PlanStepPreview[];
	/** Tous les problèmes bloquants, globaux et par étape. */
	readonly issues: readonly PlanIssue[];
	/** Producteurs du trimestre selon le pire cas du plan (achats en attente inclus). */
	readonly producers: readonly ProducerForecast[];
	readonly warnings: readonly PlanWarning[];
	/** Santé et stress de fin de trimestre (stress certain, santé en fourchette). */
	readonly wellbeing: WellbeingForecast;
	/** Variation nette prévue par ressource : étapes valides puis économie. */
	readonly resourceChanges: ResourceRanges;
}

export const RESOURCE_LABELS: { readonly [K in ResourceId]: string } = {
	influence: 'Influence',
	politicalBudgetCents: 'Budget politique',
	personalCashCents: 'Argent personnel'
};

function zeroRanges(): Record<ResourceId, { min: number; max: number }> {
	return {
		influence: { min: 0, max: 0 },
		politicalBudgetCents: { min: 0, max: 0 },
		personalCashCents: { min: 0, max: 0 }
	};
}

function readStep(item: unknown): PlanStep | null {
	if (typeof item !== 'object' || item === null) return null;
	const { kind, id, target } = item as { kind?: unknown; id?: unknown; target?: unknown };
	if ((kind !== 'action' && kind !== 'purchase') || typeof id !== 'string' || id.length === 0) {
		return null;
	}
	if (target === undefined) return { kind, id };
	if (kind !== 'action' || typeof target !== 'string' || target.length === 0) return null;
	return { kind, id, target };
}

function targetOf(step: PlanStep): string | null {
	return step.kind === 'action' ? (step.target ?? null) : null;
}

/** Parties de l'état modifiées par les effets politiques et de carrière d'une action. */
interface StateParts {
	readonly player: PlayerState;
	readonly world: WorldState;
	readonly career: CareerParts;
}

/**
 * Applique les effets certains d'une action (adhésion, monde, mandats) sur un
 * état de travail. Utilisé à l'identique par la prévision et l'exécution.
 */
function applyStateEffects(
	effects: readonly Effect[],
	parts: StateParts,
	turn: number,
	target: string | null,
	content: Content
): StateParts & { changes: PoliticalChange[] } {
	let { player, world, career } = parts;
	const changes: PoliticalChange[] = [];
	for (const effect of effects) {
		if (isPoliticalEffect(effect)) {
			const outcome = applyPoliticalEffect(effect, player, world, turn, target, content);
			player = outcome.player;
			world = outcome.world;
			changes.push(...outcome.changes);
		} else if (isCareerEffect(effect)) {
			const outcome = applyCareerEffect(effect, career, turn, target, content, player);
			career = outcome.parts;
			changes.push(...outcome.changes);
		}
	}
	return { player, world, career, changes };
}

function careerOf(state: GameState): CareerParts {
	return {
		mandates: state.mandates,
		ballots: state.ballots,
		campaigns: state.campaigns,
		institutions: state.institutions
	};
}

function definitionOf<T>(catalog: Readonly<Record<string, T>>, id: string): T | undefined {
	return Object.hasOwn(catalog, id) ? catalog[id] : undefined;
}

export function instanceIdFor(number: number): string {
	return `upgrade.${number}`;
}

/** Validation et prévision pures d'un plan, sans tirage aléatoire. */
export function previewPlan(state: GameState, plan: TurnPlan, content: Content): PlanPreview {
	// Les mandats en cours réservent une part du temps du trimestre.
	const reserved = reservedTime(state.mandates, content);
	const timeAvailable = Math.max(0, content.balance.timeBudgetPerTurn - reserved);
	const stepPreviews: PlanStepPreview[] = [];
	const issues: PlanIssue[] = [];
	const totals = zeroRanges();

	const items: unknown = (plan as { steps?: unknown } | null)?.steps;
	if (!Array.isArray(items)) {
		const economy = resolveEconomy(state.resources, state.upgrades, state.turn, content);
		return {
			valid: false,
			timeAvailable,
			timeReserved: reserved,
			timeUsed: 0,
			timeRemaining: timeAvailable,
			steps: [],
			issues: [
				{
					index: null,
					id: null,
					code: 'invalid_plan',
					message: 'Le plan du trimestre est mal formé.'
				}
			],
			producers: economy.producers,
			warnings: [],
			wellbeing: forecastWellbeing(state.player, reserved, state.turn, content.balance.wellbeing),
			resourceChanges: totals
		};
	}

	// État de travail : coûts et gains certains, pire cas des effets aléatoires.
	const working: Record<ResourceId, number> = { ...state.resources };
	let workingPlayer: PlayerState = state.player;
	let workingWorld: WorldState = state.world;
	let workingCareer: CareerParts = careerOf(state);
	const upgrades: OwnedUpgrade[] = [...state.upgrades];
	let nextInstanceNumber = state.nextInstanceNumber;
	const actionCounts = new Map<string, number>();
	let timeUsed = 0;

	(items as readonly unknown[]).forEach((item, index) => {
		const step = readStep(item);
		const empty = {
			index,
			target: null,
			label: null,
			timeCost: 0,
			costs: [],
			effects: [],
			instanceId: null
		};
		if (step === null) {
			const issue: PlanIssue = {
				index,
				id: null,
				code: 'invalid_plan',
				message: `L’étape n° ${index + 1} du plan est mal formée.`
			};
			issues.push(issue);
			stepPreviews.push({ ...empty, kind: null, id: null, issues: [issue] });
			return;
		}

		const stepIssues: PlanIssue[] = [];
		const fail = (code: PlanIssueCode, message: string): void => {
			stepIssues.push({ index, id: step.id, code, message });
		};

		let label: string;
		let timeCost: number;
		let costs: readonly ResourceAmount[];
		let requires: Condition | undefined;
		let unavailableReason: string | undefined;
		let ranges: EffectRange[] = [];
		let actionEffects: readonly Effect[] = [];
		const target = targetOf(step);

		if (step.kind === 'action') {
			const definition = definitionOf(content.actions, step.id);
			if (!definition) {
				fail('unknown_action', `Action inconnue : ${step.id}.`);
				issues.push(...stepIssues);
				stepPreviews.push({ ...empty, kind: step.kind, id: step.id, issues: stepIssues });
				return;
			}
			({ label, timeCost, costs, requires, unavailableReason } = definition);
			ranges = definition.effects.map(effectRange);
			actionEffects = definition.effects;
			if (definition.target === 'party') {
				if (target === null || !Object.hasOwn(content.parties, target)) {
					fail('invalid_target', `« ${label} » : choisissez un parti existant.`);
				}
			} else if (definition.target === 'ballot') {
				const issue =
					target === null
						? 'choisissez une élection'
						: candidacyIssue(target, workingCareer, workingPlayer, state.turn, content);
				if (issue) fail('invalid_target', `« ${label} » : ${issue}`);
			} else if (definition.target === 'mandate') {
				const held = activeMandates(workingCareer.mandates).some(
					(mandate) => mandate.instanceId === target
				);
				if (!held) fail('invalid_target', `« ${label} » : choisissez un mandat en cours.`);
			} else if (target !== null) {
				fail('invalid_target', `« ${label} » ne porte sur aucune cible.`);
			}
			const occurrence = (actionCounts.get(step.id) ?? 0) + 1;
			actionCounts.set(step.id, occurrence);
			if (occurrence > definition.maxPerTurn) {
				fail(
					'repeat_limit',
					`« ${label} » ne peut être planifiée que ${definition.maxPerTurn} fois par trimestre.`
				);
			}
		} else {
			const definition = definitionOf(content.upgrades, step.id);
			if (!definition) {
				fail('unknown_upgrade', `Amélioration inconnue : ${step.id}.`);
				issues.push(...stepIssues);
				stepPreviews.push({ ...empty, kind: step.kind, id: step.id, issues: stepIssues });
				return;
			}
			({ label, timeCost, requires, unavailableReason } = definition);
			costs = definition.price;
			const owned = upgrades.filter((upgrade) => upgrade.upgradeId === step.id).length;
			if (owned + 1 > definition.maxOwned) {
				fail('owned_limit', `« ${label} » : ${definition.maxOwned} exemplaire(s) au maximum.`);
			}
		}

		const context = {
			turn: state.turn,
			player: workingPlayer,
			resources: working,
			upgrades,
			world: workingWorld,
			mandates: workingCareer.mandates,
			campaigns: workingCareer.campaigns,
			institutions: workingCareer.institutions
		};
		if (requires && !evaluateCondition(context, requires)) {
			fail('condition_not_met', unavailableReason ?? `« ${label} » n’est pas disponible.`);
		}

		if (timeUsed + timeCost > timeAvailable) {
			fail(
				'time_exceeded',
				`Temps insuffisant pour « ${label} » : ${timeCost} requis, ${timeAvailable - timeUsed} disponible(s).`
			);
		}

		const after: Record<ResourceId, number> = { ...working };
		for (const cost of costs) after[cost.resource] -= cost.amount;
		for (const range of ranges) {
			if (range.kind === 'resource') after[range.resource] += Math.min(0, range.min);
		}
		for (const resource of RESOURCE_IDS) {
			if (after[resource] < 0) {
				fail(
					'insufficient_resource',
					`${RESOURCE_LABELS[resource]} insuffisant pour « ${label} ».`
				);
			}
		}

		const valid = stepIssues.length === 0;
		const instanceId = step.kind === 'purchase' && valid ? instanceIdFor(nextInstanceNumber) : null;
		stepPreviews.push({
			index,
			kind: step.kind,
			id: step.id,
			target,
			label,
			timeCost,
			costs,
			effects: ranges,
			instanceId,
			issues: stepIssues
		});
		if (!valid) {
			issues.push(...stepIssues);
			return;
		}

		// Étape valide : elle consomme temps et coûts ; seuls ses gains certains
		// restent disponibles pour la suite du plan.
		timeUsed += timeCost;
		for (const cost of costs) {
			working[cost.resource] -= cost.amount;
			totals[cost.resource].min -= cost.amount;
			totals[cost.resource].max -= cost.amount;
		}
		for (const range of ranges) {
			if (range.kind === 'gauge') {
				// Les effets sur les jauges sont toujours certains.
				workingPlayer = applyGaugeEffect(workingPlayer, range.gauge, range.min).player;
				continue;
			}
			if (range.kind !== 'resource') continue;
			working[range.resource] += range.min === range.max ? range.min : Math.min(0, range.min);
			totals[range.resource].min += range.min;
			totals[range.resource].max += range.max;
		}
		// Effets certains (adhésion, monde, mandats), visibles des étapes suivantes.
		({
			player: workingPlayer,
			world: workingWorld,
			career: workingCareer
		} = applyStateEffects(
			actionEffects,
			{ player: workingPlayer, world: workingWorld, career: workingCareer },
			state.turn,
			target,
			content
		));
		if (instanceId !== null) {
			upgrades.push({ instanceId, upgradeId: step.id, acquiredTurn: state.turn });
			nextInstanceNumber += 1;
		}
	});

	// Économie du trimestre sur le pire cas : une charge prévue impayée est un risque.
	const economy = resolveEconomy(working, upgrades, state.turn, content);
	for (const change of economy.changes) {
		totals[change.resource].min += change.delta;
		totals[change.resource].max += change.delta;
	}
	const warnings: PlanWarning[] = economy.producers
		.filter((producer) => producer.status === 'suspended')
		.map((producer) => ({
			code: 'upkeep_at_risk',
			instanceId: producer.instanceId,
			upgradeId: producer.upgradeId,
			message: `Charges de « ${content.upgrades[producer.upgradeId]?.label ?? producer.upgradeId} » non couvertes : production suspendue ce trimestre si la trésorerie reste insuffisante.`
		}));

	// Revenus et stress des mandats encore en cours à la fin du trimestre.
	const mandates = mandateIncome(workingCareer.mandates, state.turn, content);
	for (const amount of mandates.income) {
		totals[amount.resource].min += amount.amount;
		totals[amount.resource].max += amount.amount;
	}
	const stressed = applyGaugeEffect(workingPlayer, 'player.stress', mandates.stress).player;

	// Santé et stress à la frontière du trimestre (partie certaine uniquement).
	// Le temps réservé par les mandats compte dans la charge de travail.
	const wellbeing = forecastWellbeing(
		stressed,
		timeUsed + reserved,
		state.turn,
		content.balance.wellbeing
	);
	if (wellbeing.stress >= content.balance.wellbeing.highStressThreshold) {
		warnings.push({
			code: 'stress_high',
			instanceId: null,
			upgradeId: null,
			message: 'Stress élevé en fin de trimestre : votre santé va se dégrader.'
		});
	}

	return {
		valid: issues.length === 0,
		timeAvailable,
		timeReserved: reserved,
		timeUsed,
		timeRemaining: timeAvailable - timeUsed,
		steps: stepPreviews,
		issues,
		producers: economy.producers,
		warnings,
		wellbeing,
		resourceChanges: totals
	};
}

export interface PlanExecution {
	readonly resources: Resources;
	readonly player: PlayerState;
	readonly world: WorldState;
	readonly career: CareerParts;
	/** Temps consommé par le plan, qui détermine la charge de travail. */
	readonly timeUsed: number;
	readonly rng: RngState;
	readonly upgrades: readonly OwnedUpgrade[];
	readonly nextInstanceNumber: number;
	readonly records: readonly StepRecord[];
}

/**
 * Exécute un plan déjà validé par `previewPlan` : étapes dans l'ordre, coûts puis
 * effets (tirage des effets aléatoires), achats créant des instances en attente.
 * Lève une erreur si une ressource devenait négative, ce qui signalerait un
 * défaut de validation.
 */
export function executePlan(
	state: GameState,
	steps: readonly PlanStep[],
	content: Content
): PlanExecution {
	const current: Record<ResourceId, number> = { ...state.resources };
	let player = state.player;
	let world = state.world;
	let career = careerOf(state);
	let timeUsed = 0;
	let rng = state.rng;
	const upgrades: OwnedUpgrade[] = [...state.upgrades];
	let nextInstanceNumber = state.nextInstanceNumber;
	const records: StepRecord[] = [];

	for (const step of steps) {
		const deltas = new Map<ResourceId, number>();
		const add = (resource: ResourceId, delta: number): void => {
			current[resource] += delta;
			deltas.set(resource, (deltas.get(resource) ?? 0) + delta);
		};
		let instanceId: string | null = null;
		const gauges: GaugeChange[] = [];
		const politics: PoliticalChange[] = [];
		const target = targetOf(step);

		if (step.kind === 'action') {
			const definition = definitionOf(content.actions, step.id);
			if (!definition) throw new Error(`Action non validée : ${step.id}`);
			timeUsed += definition.timeCost;
			for (const cost of definition.costs) add(cost.resource, -cost.amount);
			for (const effect of definition.effects) {
				const resolved = resolveEffect(effect, rng);
				rng = resolved.rng;
				if (resolved.kind === 'resource') {
					add(resolved.resource, resolved.delta);
				} else if (resolved.kind === 'gauge') {
					const applied = applyGaugeEffect(player, resolved.gauge, resolved.delta);
					player = applied.player;
					if (applied.delta !== 0) gauges.push({ gauge: resolved.gauge, delta: applied.delta });
				} else if (resolved.kind === 'people') {
					throw new Error(`Effet sur un personnage hors événement : ${step.id}`);
				} else {
					const applied = applyStateEffects(
						[resolved.effect],
						{ player, world, career },
						state.turn,
						target,
						content
					);
					({ player, world, career } = applied);
					politics.push(...applied.changes);
				}
			}
		} else {
			const definition = definitionOf(content.upgrades, step.id);
			if (!definition) throw new Error(`Amélioration non validée : ${step.id}`);
			timeUsed += definition.timeCost;
			for (const cost of definition.price) add(cost.resource, -cost.amount);
			instanceId = instanceIdFor(nextInstanceNumber);
			nextInstanceNumber += 1;
			upgrades.push({ instanceId, upgradeId: step.id, acquiredTurn: state.turn });
		}

		for (const resource of RESOURCE_IDS) {
			if (current[resource] < 0)
				throw new Error(`Ressource négative après ${step.id} : ${resource}`);
		}
		const changes: ResourceChange[] = RESOURCE_IDS.flatMap((resource) => {
			const delta = deltas.get(resource) ?? 0;
			return delta === 0 ? [] : [{ resource, delta }];
		});
		records.push({ kind: step.kind, id: step.id, instanceId, changes, gauges, target, politics });
	}

	return {
		resources: current,
		player,
		world,
		career,
		timeUsed,
		rng,
		upgrades,
		nextInstanceNumber,
		records
	};
}

/** Applique une variation de jauge au personnage, dans les bornes [0, 100]. */
function applyGaugeEffect(
	player: PlayerState,
	gauge: GaugeId,
	delta: number
): { player: PlayerState; delta: number } {
	const key = gauge === 'player.health' ? 'health' : 'stress';
	const { value, applied } = applyGauge(player[key], delta);
	return { player: { ...player, [key]: value }, delta: applied };
}
