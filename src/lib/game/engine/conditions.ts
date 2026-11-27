/**
 * Évaluation pure des conditions déclaratives (ARCHITECTURE.md §7.1).
 *
 * Les statistiques lisibles sont celles du registre `STAT_IDS` ; le switch est
 * exhaustif, si bien qu'une statistique ajoutée au registre sans lecture ici
 * provoque une erreur de compilation. Aucune lecture n'avance le PRNG.
 */
import type { CapabilityId, Condition, StatId } from '../content/types.ts';
import { ageAt, quarterOf, yearOf } from './calendar.ts';
import { activeMandates, cumulatedMandates, holdIssue, isIneligible } from './career.ts';
import type { GameState } from './state.ts';
import { netWorth } from './wealth.ts';
import { partyBidIssue } from './world.ts';

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
	| 'facts'
	| 'cases'
	| 'promises'
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
		case 'player.partyBidOpen':
			return partyBidIssue(context.player, context.turn) === null ? 1 : 0;
		case 'player.partyBid':
			return context.player.partyCareer?.bid ? 1 : 0;
		case 'player.partyRank': {
			const rank = context.player.partyCareer?.rank;
			return rank === 'leader' ? 3 : rank === 'cadre' ? 2 : rank === 'member' ? 1 : 0;
		}
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
			// Comptés comme pour le cumul : la mairie s'exerce au sein du conseil municipal.
			return cumulatedMandates(context.mandates, context.institutions).length;
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
		case 'player.exposure':
			return context.player.exposure;
		case 'player.activists':
			return context.player.activists;
		case 'player.facts':
			return context.facts.length;
		case 'player.openCases':
			return context.cases.filter((entry) => entry.stage !== 'closed' && entry.defendantId === null)
				.length;
		case 'player.ineligible':
			return isIneligible(context.player, context.turn) ? 1 : 0;
		case 'player.assets':
			return context.upgrades.filter((upgrade) => upgrade.valueCents !== null).length;
		case 'player.netWorthCents':
			return netWorth(context.resources, context.upgrades);
		case 'player.promisesInProgress':
			return context.promises.filter((pledge) => pledge.status === 'in_progress').length;
		case 'player.promisesKept':
			return context.promises.filter((pledge) => pledge.status === 'kept').length;
		case 'player.promisesBroken':
			return context.promises.filter((pledge) => pledge.status === 'abandoned').length;
		default: {
			const unknown: never = stat;
			throw new Error(`Statistique inconnue : ${String(unknown)}`);
		}
	}
}

/**
 * Capacité métier exigée par une infraction (P3-12). `real_hire` dépend de
 * l'embauche du bénéficiaire et ne se lit pas sur l'état : toujours faux ici.
 */
export function hasCapability(context: ConditionContext, capability: CapabilityId): boolean {
	const mandates = activeMandates(context.mandates);
	const staff = context.staff.some((member) => member.status === 'active');
	switch (capability) {
		case 'political_activity':
			return (
				context.player.partyId !== null ||
				mandates.length > 0 ||
				context.campaigns.some((campaign) => campaign.status === 'running') ||
				context.upgrades.length > 0 ||
				staff
			);
		case 'local_power':
			return mandates.some((mandate) => mandate.mandateId === 'mandate.mayor');
		case 'public_office':
			return mandates.length > 0;
		case 'organization_funds':
			return context.upgrades.length > 0 || staff;
		case 'real_hire':
			return false;
		default: {
			const unknown: never = capability;
			throw new Error(`Capacité inconnue : ${String(unknown)}`);
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
		case 'engagement':
			return context.player.engagement === condition.engagement;
		case 'lifestyle':
			return context.player.lifestyle === condition.lifestyle;
		case 'institution':
			return context.institutions.parameters[condition.parameter] === condition.level;
		case 'ownsUpgrade':
			return context.upgrades.some((upgrade) => upgrade.upgradeId === condition.upgrade);
		case 'holdsMandate':
			return activeMandates(context.mandates).some(
				(mandate) => mandate.mandateId === condition.mandate
			);
		case 'holdsPortfolio':
			return activeMandates(context.mandates).some(
				(mandate) => mandate.portfolio === condition.portfolio
			);
		case 'support': {
			const value = context.player.supports[condition.group] ?? 0;
			return condition.cmp === 'gte'
				? value >= condition.value
				: condition.cmp === 'lte'
					? value <= condition.value
					: value === condition.value;
		}
		case 'capability':
			return hasCapability(context, condition.capability);
		case 'canHoldMandate':
			return (
				!isIneligible(context.player, context.turn) &&
				holdIssue(condition.mandate, context.mandates, context.institutions, null) === null
			);
		default: {
			const unknown: never = condition;
			throw new Error(`Condition inconnue : ${JSON.stringify(unknown)}`);
		}
	}
}
