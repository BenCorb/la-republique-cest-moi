/**
 * Évaluation pure des conditions déclaratives (ARCHITECTURE.md §7.1).
 *
 * Les statistiques lisibles sont celles du registre `STAT_IDS` ; le switch est
 * exhaustif, si bien qu'une statistique ajoutée au registre sans lecture ici
 * provoque une erreur de compilation. Aucune lecture n'avance le PRNG.
 */
import type { Condition, StatId } from '../content/types.ts';
import { ageAt, quarterOf, yearOf } from './calendar.ts';
import type { GameState } from './state.ts';

/** Sous-ensemble de l'état suffisant pour évaluer une condition. */
export type ConditionContext = Pick<GameState, 'turn' | 'player' | 'resources'>;

export function readStat(context: ConditionContext, stat: StatId): number {
	switch (stat) {
		case 'resources.influence':
			return context.resources.influence;
		case 'resources.politicalBudgetCents':
			return context.resources.politicalBudgetCents;
		case 'resources.personalCashCents':
			return context.resources.personalCashCents;
		case 'player.age':
			return ageAt(context.player.birthTurn, context.turn);
		case 'player.health':
			return context.player.health;
		case 'player.stress':
			return context.player.stress;
		case 'calendar.year':
			return yearOf(context.turn);
		case 'calendar.quarter':
			return quarterOf(context.turn);
		default: {
			const unknown: never = stat;
			throw new Error(`Statistique inconnue : ${String(unknown)}`);
		}
	}
}

export function evaluateCondition(context: ConditionContext, condition: Condition): boolean {
	switch (condition.op) {
		case 'all':
			return condition.conditions.every((child) => evaluateCondition(context, child));
		case 'any':
			return condition.conditions.some((child) => evaluateCondition(context, child));
		case 'not':
			return !evaluateCondition(context, condition.condition);
		case 'gte':
			return readStat(context, condition.stat) >= condition.value;
		case 'lte':
			return readStat(context, condition.stat) <= condition.value;
		case 'eq':
			return readStat(context, condition.stat) === condition.value;
		default: {
			const unknown: never = condition;
			throw new Error(`Condition inconnue : ${JSON.stringify(unknown)}`);
		}
	}
}
