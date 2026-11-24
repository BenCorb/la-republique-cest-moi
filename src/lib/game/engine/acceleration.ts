/**
 * Accélération minimale du calendrier (ARCHITECTURE.md §5.2).
 *
 * Cette fonction ne possède aucune transition propre : elle répète exclusivement
 * `transition(state, commitTurn(plan), content)`. Le plan est récurrent et doit
 * rester valide avant chaque trimestre. Les alertes déjà visibles au lancement
 * sont considérées comme reconnues ; une alerte qui apparaît ensuite interrompt
 * la boucle, tout comme une décision, une fin de carrière ou un plan devenu
 * invalide.
 */
import type { Content } from '../content/types.ts';
import { commitTurn, type TurnPlan } from './commands.ts';
import { previewPlan, type PlanIssue } from './plan.ts';
import type { GameState } from './state.ts';
import { transition } from './turn.ts';

export type AccelerationStopReason =
	'limit_reached' | 'decision_pending' | 'alert' | 'game_ended' | 'invalid_plan';

export interface AccelerationAlert {
	readonly id: string;
	readonly message: string;
}

export interface AccelerationRequest {
	readonly plan: TurnPlan;
	readonly maxTurns: number;
}

export interface AccelerationResult {
	readonly state: GameState;
	readonly turnsAdvanced: number;
	readonly stopReason: AccelerationStopReason;
	readonly alerts: readonly AccelerationAlert[];
	readonly issues: readonly PlanIssue[];
}

/** Alertes métier susceptibles d'interrompre une accélération. */
export function accelerationAlerts(
	state: GameState,
	plan: TurnPlan,
	content: Content
): readonly AccelerationAlert[] {
	if (state.phase !== 'planning') return [];
	const preview = previewPlan(state, plan, content);
	const alerts: AccelerationAlert[] = preview.warnings.map((warning) => ({
		id:
			warning.code === 'upkeep_at_risk'
				? `${warning.code}:${warning.instanceId ?? warning.upgradeId ?? 'unknown'}`
				: warning.code,
		message: warning.message
	}));
	if (state.player.health < content.balance.wellbeing.fragileHealthThreshold) {
		alerts.push({
			id: 'health_fragile',
			message: 'Santé critique : une intervention est recommandée.'
		});
	}
	return alerts;
}

function result(
	state: GameState,
	turnsAdvanced: number,
	stopReason: AccelerationStopReason,
	alerts: readonly AccelerationAlert[] = [],
	issues: readonly PlanIssue[] = []
): AccelerationResult {
	return { state, turnsAdvanced, stopReason, alerts, issues };
}

export function accelerate(
	state: GameState,
	request: AccelerationRequest,
	content: Content
): AccelerationResult {
	if (!Number.isSafeInteger(request.maxTurns) || request.maxTurns < 1) {
		throw new RangeError(`Nombre de trimestres invalide : ${request.maxTurns}`);
	}
	if (state.phase === 'ended') return result(state, 0, 'game_ended');
	if (state.phase === 'decision') return result(state, 0, 'decision_pending');

	let current = state;
	let turnsAdvanced = 0;
	let acknowledged = new Set(
		accelerationAlerts(current, request.plan, content).map((alert) => alert.id)
	);

	while (turnsAdvanced < request.maxTurns) {
		const preview = previewPlan(current, request.plan, content);
		if (!preview.valid) {
			return result(current, turnsAdvanced, 'invalid_plan', [], preview.issues);
		}

		const advanced = transition(current, commitTurn(request.plan), content);
		if (!advanced.ok) {
			if (advanced.error.code === 'invalid_plan') {
				return result(current, turnsAdvanced, 'invalid_plan', [], advanced.error.issues);
			}
			throw new Error(`Transition d’accélération refusée : ${advanced.error.code}`);
		}
		current = advanced.state;
		turnsAdvanced += 1;

		if (current.phase === 'ended') return result(current, turnsAdvanced, 'game_ended');
		if (current.phase === 'decision') return result(current, turnsAdvanced, 'decision_pending');

		const nextPreview = previewPlan(current, request.plan, content);
		if (!nextPreview.valid) {
			return result(current, turnsAdvanced, 'invalid_plan', [], nextPreview.issues);
		}
		const activeAlerts = accelerationAlerts(current, request.plan, content);
		const newAlerts = activeAlerts.filter((alert) => !acknowledged.has(alert.id));
		if (newAlerts.length > 0) {
			return result(current, turnsAdvanced, 'alert', newAlerts);
		}
		acknowledged = new Set(
			activeAlerts.filter((alert) => acknowledged.has(alert.id)).map((alert) => alert.id)
		);
	}

	return result(current, turnsAdvanced, 'limit_reached');
}
