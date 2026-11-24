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
 * améliorations déjà actives), calculée sur le pire cas du plan. Elle ne lit ni
 * ne fait avancer le PRNG.
 */
import {
	RESOURCE_IDS,
	type Condition,
	type Content,
	type ResourceAmount,
	type ResourceId,
	type Resources
} from '../content/types.ts';
import type { PlanStep, TurnPlan } from './commands.ts';
import { evaluateCondition } from './conditions.ts';
import { resolveEconomy, type ProducerForecast } from './economy.ts';
import { effectRange, resolveEffect, type EffectRange } from './effects.ts';
import type { RngState } from './random.ts';
import type { GameState, OwnedUpgrade, ResourceChange, StepRecord } from './state.ts';

export type PlanIssueCode =
	| 'invalid_plan'
	| 'unknown_action'
	| 'unknown_upgrade'
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
	readonly code: 'upkeep_at_risk';
	readonly instanceId: string;
	readonly upgradeId: string;
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
	/** Temps des étapes valides du plan. */
	readonly timeUsed: number;
	readonly timeRemaining: number;
	readonly steps: readonly PlanStepPreview[];
	/** Tous les problèmes bloquants, globaux et par étape. */
	readonly issues: readonly PlanIssue[];
	/** Producteurs du trimestre selon le pire cas du plan (achats en attente inclus). */
	readonly producers: readonly ProducerForecast[];
	readonly warnings: readonly PlanWarning[];
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
	const { kind, id } = item as { kind?: unknown; id?: unknown };
	if ((kind !== 'action' && kind !== 'purchase') || typeof id !== 'string' || id.length === 0) {
		return null;
	}
	return { kind, id };
}

function definitionOf<T>(catalog: Readonly<Record<string, T>>, id: string): T | undefined {
	return Object.hasOwn(catalog, id) ? catalog[id] : undefined;
}

export function instanceIdFor(number: number): string {
	return `upgrade.${number}`;
}

/** Validation et prévision pures d'un plan, sans tirage aléatoire. */
export function previewPlan(state: GameState, plan: TurnPlan, content: Content): PlanPreview {
	const timeAvailable = content.balance.timeBudgetPerTurn;
	const stepPreviews: PlanStepPreview[] = [];
	const issues: PlanIssue[] = [];
	const totals = zeroRanges();

	const items: unknown = (plan as { steps?: unknown } | null)?.steps;
	if (!Array.isArray(items)) {
		const economy = resolveEconomy(state.resources, state.upgrades, state.turn, content);
		return {
			valid: false,
			timeAvailable,
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
			resourceChanges: totals
		};
	}

	// État de travail : coûts et gains certains, pire cas des effets aléatoires.
	const working: Record<ResourceId, number> = { ...state.resources };
	const upgrades: OwnedUpgrade[] = [...state.upgrades];
	let nextInstanceNumber = state.nextInstanceNumber;
	const actionCounts = new Map<string, number>();
	let timeUsed = 0;

	(items as readonly unknown[]).forEach((item, index) => {
		const step = readStep(item);
		const empty = { index, label: null, timeCost: 0, costs: [], effects: [], instanceId: null };
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

		const context = { turn: state.turn, player: state.player, resources: working };
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
		for (const range of ranges) after[range.resource] += Math.min(0, range.min);
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
			working[range.resource] += range.min === range.max ? range.min : Math.min(0, range.min);
			totals[range.resource].min += range.min;
			totals[range.resource].max += range.max;
		}
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

	return {
		valid: issues.length === 0,
		timeAvailable,
		timeUsed,
		timeRemaining: timeAvailable - timeUsed,
		steps: stepPreviews,
		issues,
		producers: economy.producers,
		warnings,
		resourceChanges: totals
	};
}

export interface PlanExecution {
	readonly resources: Resources;
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

		if (step.kind === 'action') {
			const definition = definitionOf(content.actions, step.id);
			if (!definition) throw new Error(`Action non validée : ${step.id}`);
			for (const cost of definition.costs) add(cost.resource, -cost.amount);
			for (const effect of definition.effects) {
				const resolved = resolveEffect(effect, rng);
				rng = resolved.rng;
				add(resolved.resource, resolved.delta);
			}
		} else {
			const definition = definitionOf(content.upgrades, step.id);
			if (!definition) throw new Error(`Amélioration non validée : ${step.id}`);
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
		records.push({ kind: step.kind, id: step.id, instanceId, changes });
	}

	return { resources: current, rng, upgrades, nextInstanceNumber, records };
}
