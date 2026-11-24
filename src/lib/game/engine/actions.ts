/**
 * Plan trimestriel : validation, prévision pure et exécution (ARCHITECTURE.md §5).
 *
 * Une seule validation sert à la prévision et à la commande `commitTurn`. Elle
 * simule le plan dans l'ordre sur un état de travail :
 *   - les coûts et effets déterministes s'appliquent (un gain certain peut
 *     financer une action suivante du même plan) ;
 *   - un effet aléatoire ne compte que pour sa borne la plus défavorable
 *     (min(0, min)) : un gain incertain ne finance jamais une autre action, et
 *     l'exécution réelle ne peut donc pas descendre sous zéro ;
 *   - une action fautive est signalée puis ignorée pour la suite de la simulation,
 *     afin de présenter tous les problèmes en une fois.
 * La prévision ne lit ni ne fait avancer le PRNG.
 */
import {
	RESOURCE_IDS,
	type Content,
	type ResourceAmount,
	type ResourceId,
	type Resources
} from '../content/types.ts';
import type { PlannedAction, TurnPlan } from './commands.ts';
import { evaluateCondition } from './conditions.ts';
import { effectRange, resolveEffect, type EffectRange } from './effects.ts';
import type { RngState } from './random.ts';
import type { ActionRecord, GameState, ResourceChange } from './state.ts';

export type PlanIssueCode =
	| 'invalid_plan'
	| 'unknown_action'
	| 'repeat_limit'
	| 'condition_not_met'
	| 'time_exceeded'
	| 'insufficient_resource';

export interface PlanIssue {
	/** Position de l'action dans le plan, ou `null` pour un problème global. */
	readonly index: number | null;
	readonly actionId: string | null;
	readonly code: PlanIssueCode;
	/** Message lisible en français, destiné à l'interface. */
	readonly message: string;
}

export interface ResourceRange {
	readonly min: number;
	readonly max: number;
}

export type ResourceRanges = { readonly [K in ResourceId]: ResourceRange };

export interface PlanStepPreview {
	readonly index: number;
	readonly actionId: string;
	readonly label: string | null;
	readonly timeCost: number;
	readonly costs: readonly ResourceAmount[];
	/** Fourchettes certaines des effets (min = max pour un effet déterministe). */
	readonly effects: readonly EffectRange[];
	readonly issues: readonly PlanIssue[];
}

export interface PlanPreview {
	readonly valid: boolean;
	readonly timeAvailable: number;
	/** Temps des actions valides du plan. */
	readonly timeUsed: number;
	readonly timeRemaining: number;
	readonly steps: readonly PlanStepPreview[];
	/** Tous les problèmes, globaux et par action. */
	readonly issues: readonly PlanIssue[];
	/** Variation nette prévue par ressource (coûts et effets des actions valides). */
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

function readActionId(item: unknown): string | null {
	if (typeof item !== 'object' || item === null) return null;
	const { actionId } = item as { actionId?: unknown };
	return typeof actionId === 'string' && actionId.length > 0 ? actionId : null;
}

/** Validation et prévision pures d'un plan, sans tirage aléatoire. */
export function previewPlan(state: GameState, plan: TurnPlan, content: Content): PlanPreview {
	const timeAvailable = content.balance.timeBudgetPerTurn;
	const steps: PlanStepPreview[] = [];
	const issues: PlanIssue[] = [];
	const totals = zeroRanges();

	const items: unknown = (plan as { actions?: unknown } | null)?.actions;
	if (!Array.isArray(items)) {
		const issue: PlanIssue = {
			index: null,
			actionId: null,
			code: 'invalid_plan',
			message: 'Le plan du trimestre est mal formé.'
		};
		return {
			valid: false,
			timeAvailable,
			timeUsed: 0,
			timeRemaining: timeAvailable,
			steps,
			issues: [issue],
			resourceChanges: totals
		};
	}

	// Ressources de travail : coûts et effets déterministes, pire cas des effets aléatoires.
	const working: Record<ResourceId, number> = { ...state.resources };
	const counts = new Map<string, number>();
	let timeUsed = 0;

	(items as readonly unknown[]).forEach((item, index) => {
		const actionId = readActionId(item);
		if (actionId === null) {
			const issue: PlanIssue = {
				index,
				actionId: null,
				code: 'invalid_plan',
				message: `L’action n° ${index + 1} du plan est mal formée.`
			};
			issues.push(issue);
			steps.push({
				index,
				actionId: '',
				label: null,
				timeCost: 0,
				costs: [],
				effects: [],
				issues: [issue]
			});
			return;
		}

		const definition = Object.hasOwn(content.actions, actionId)
			? content.actions[actionId]
			: undefined;
		if (!definition) {
			const issue: PlanIssue = {
				index,
				actionId,
				code: 'unknown_action',
				message: `Action inconnue : ${actionId}.`
			};
			issues.push(issue);
			steps.push({
				index,
				actionId,
				label: null,
				timeCost: 0,
				costs: [],
				effects: [],
				issues: [issue]
			});
			return;
		}

		const stepIssues: PlanIssue[] = [];
		const fail = (code: PlanIssueCode, message: string): void => {
			stepIssues.push({ index, actionId, code, message });
		};

		const occurrence = (counts.get(actionId) ?? 0) + 1;
		counts.set(actionId, occurrence);
		if (occurrence > definition.maxPerTurn) {
			fail(
				'repeat_limit',
				`« ${definition.label} » ne peut être planifiée que ${definition.maxPerTurn} fois par trimestre.`
			);
		}

		if (
			definition.requires &&
			!evaluateCondition(
				{ turn: state.turn, player: state.player, resources: working },
				definition.requires
			)
		) {
			fail(
				'condition_not_met',
				definition.unavailableReason ?? `« ${definition.label} » n’est pas disponible.`
			);
		}

		if (timeUsed + definition.timeCost > timeAvailable) {
			fail(
				'time_exceeded',
				`Temps insuffisant pour « ${definition.label} » : ${definition.timeCost} requis, ${timeAvailable - timeUsed} disponible(s).`
			);
		}

		const after: Record<ResourceId, number> = { ...working };
		for (const cost of definition.costs) after[cost.resource] -= cost.amount;
		const ranges = definition.effects.map(effectRange);
		for (const range of ranges) after[range.resource] += Math.min(0, range.min);
		for (const resource of RESOURCE_IDS) {
			if (after[resource] < 0) {
				fail(
					'insufficient_resource',
					`${RESOURCE_LABELS[resource]} insuffisant pour « ${definition.label} ».`
				);
			}
		}

		steps.push({
			index,
			actionId,
			label: definition.label,
			timeCost: definition.timeCost,
			costs: definition.costs,
			effects: ranges,
			issues: stepIssues
		});
		if (stepIssues.length > 0) {
			issues.push(...stepIssues);
			return;
		}

		// Action valide : elle consomme son temps et ses coûts ; seuls ses gains certains
		// restent disponibles pour la suite du plan.
		timeUsed += definition.timeCost;
		for (const cost of definition.costs) {
			working[cost.resource] -= cost.amount;
			totals[cost.resource].min -= cost.amount;
			totals[cost.resource].max -= cost.amount;
		}
		for (const range of ranges) {
			working[range.resource] += range.min === range.max ? range.min : Math.min(0, range.min);
			totals[range.resource].min += range.min;
			totals[range.resource].max += range.max;
		}
	});

	return {
		valid: issues.length === 0,
		timeAvailable,
		timeUsed,
		timeRemaining: timeAvailable - timeUsed,
		steps,
		issues,
		resourceChanges: totals
	};
}

export interface PlanExecution {
	readonly resources: Resources;
	readonly rng: RngState;
	readonly records: readonly ActionRecord[];
}

/**
 * Exécute un plan déjà validé par `previewPlan` : coûts, puis effets dans l'ordre,
 * avec tirage des effets aléatoires. Lève une erreur si une ressource devenait
 * négative, ce qui signalerait un défaut de validation.
 */
export function executePlan(
	resources: Resources,
	rng: RngState,
	actions: readonly PlannedAction[],
	content: Content
): PlanExecution {
	const current: Record<ResourceId, number> = { ...resources };
	let currentRng = rng;
	const records: ActionRecord[] = [];

	for (const planned of actions) {
		const definition = content.actions[planned.actionId];
		if (!definition) throw new Error(`Action non validée : ${planned.actionId}`);

		const deltas = new Map<ResourceId, number>();
		const add = (resource: ResourceId, delta: number): void => {
			current[resource] += delta;
			deltas.set(resource, (deltas.get(resource) ?? 0) + delta);
		};
		for (const cost of definition.costs) add(cost.resource, -cost.amount);
		for (const effect of definition.effects) {
			const resolved = resolveEffect(effect, currentRng);
			currentRng = resolved.rng;
			add(resolved.resource, resolved.delta);
		}

		for (const resource of RESOURCE_IDS) {
			if (current[resource] < 0) {
				throw new Error(`Ressource négative après ${definition.id} : ${resource}`);
			}
		}
		const changes: ResourceChange[] = RESOURCE_IDS.flatMap((resource) => {
			const delta = deltas.get(resource) ?? 0;
			return delta === 0 ? [] : [{ resource, delta }];
		});
		records.push({ actionId: definition.id, changes });
	}

	return { resources: current, rng: currentRng, records };
}
