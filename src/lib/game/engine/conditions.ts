/**
 * Évaluation pure des conditions déclaratives (ARCHITECTURE.md §7.1).
 *
 * Les statistiques lisibles sont celles du registre `STAT_IDS` ; le switch est
 * exhaustif, si bien qu'une statistique ajoutée au registre sans lecture ici
 * provoque une erreur de compilation. Aucune lecture n'avance le PRNG.
 */
import type { Condition, StatId } from '../content/types.ts';
import { ageAt, quarterOf, yearOf } from './calendar.ts';
import { activeMandates, holdIssue } from './career.ts';
import type { GameState } from './state.ts';

/** Sous-ensemble de l'état suffisant pour évaluer une condition. */
export type ConditionContext = Pick<
	GameState,
	| 'turn'
	| 'player'
	| 'resources'
	| 'upgrades'
	| 'world'
	| 'mandates'
	| 'institutions'
	| 'campaigns'
	| 'staff'
>;

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
		case 'upgrades.owned':
			return context.upgrades.length;
		case 'world.economy':
			return context.world.indicators.economy;
		case 'world.socialClimate':
			return context.world.indicators.socialClimate;
		case 'world.stability':
			return context.world.indicators.stability;
		case 'player.affiliated':
			return context.player.partyId === null ? 0 : 1;
		case 'player.partyStrength':
			return context.player.partyId === null
				? 0
				: (context.world.parties[context.player.partyId]?.strength ?? 0);
		case 'player.partyGoverning':
			return context.player.partyId !== null &&
				context.player.partyId === context.world.governingPartyId
				? 1
				: 0;
		case 'player.mandates':
			return activeMandates(context.mandates).length;
		case 'player.popularity':
			return context.player.popularity;
		case 'player.hasPartner':
			return context.player.family.partnerId === null ? 0 : 1;
		case 'player.children':
			return context.player.family.childrenIds.length;
		case 'player.staff':
			return context.staff.filter((member) => member.status === 'active').length;
		case 'player.campaigning':
			return context.campaigns.filter((campaign) => campaign.status === 'running').length;
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
		case 'memberOf':
			return context.player.partyId === condition.party;
		case 'origin':
			return context.player.origin === condition.origin;
		case 'profession':
			return context.player.profession === condition.profession;
		case 'holdsMandate':
			return activeMandates(context.mandates).some(
				(mandate) => mandate.mandateId === condition.mandate
			);
		case 'support': {
			const value = context.player.supports[condition.group] ?? 0;
			return condition.cmp === 'gte'
				? value >= condition.value
				: condition.cmp === 'lte'
					? value <= condition.value
					: value === condition.value;
		}
		case 'canHoldMandate':
			return holdIssue(condition.mandate, context.mandates, context.institutions, null) === null;
		default: {
			const unknown: never = condition;
			throw new Error(`Condition inconnue : ${JSON.stringify(unknown)}`);
		}
	}
}
