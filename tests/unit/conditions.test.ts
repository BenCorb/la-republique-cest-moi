import { describe, expect, it } from 'vitest';
import type { Condition } from '../../src/lib/game/content/types.ts';
import {
	evaluateCondition,
	readStat,
	turnOf,
	type ConditionContext
} from '../../src/lib/game/engine/index.ts';

const context: ConditionContext = {
	turn: turnOf(2004, 2),
	player: { birthTurn: turnOf(1975, 1), health: 64, stress: 37 },
	resources: { influence: 12, politicalBudgetCents: 5_000, personalCashCents: 0 }
};

const influenceAtLeast = (value: number): Condition => ({
	op: 'gte',
	stat: 'resources.influence',
	value
});

describe('statistiques du registre', () => {
	it('lit ressources, âge et calendrier', () => {
		expect(readStat(context, 'resources.influence')).toBe(12);
		expect(readStat(context, 'resources.politicalBudgetCents')).toBe(5_000);
		expect(readStat(context, 'resources.personalCashCents')).toBe(0);
		expect(readStat(context, 'player.age')).toBe(29);
		expect(readStat(context, 'player.health')).toBe(64);
		expect(readStat(context, 'player.stress')).toBe(37);
		expect(readStat(context, 'calendar.year')).toBe(2004);
		expect(readStat(context, 'calendar.quarter')).toBe(2);
	});
});

describe('évaluation des conditions', () => {
	it.each<[string, Condition, boolean]>([
		['gte vrai à égalité', influenceAtLeast(12), true],
		['gte faux', influenceAtLeast(13), false],
		['lte', { op: 'lte', stat: 'player.age', value: 29 }, true],
		['eq', { op: 'eq', stat: 'calendar.quarter', value: 2 }, true],
		['eq faux', { op: 'eq', stat: 'calendar.year', value: 2005 }, false],
		['not', { op: 'not', condition: influenceAtLeast(13) }, true],
		['all vrai', { op: 'all', conditions: [influenceAtLeast(1), influenceAtLeast(12)] }, true],
		['all faux', { op: 'all', conditions: [influenceAtLeast(1), influenceAtLeast(99)] }, false],
		['any vrai', { op: 'any', conditions: [influenceAtLeast(99), influenceAtLeast(1)] }, true],
		['any faux', { op: 'any', conditions: [influenceAtLeast(99), influenceAtLeast(50)] }, false],
		[
			'imbrication',
			{
				op: 'all',
				conditions: [
					{ op: 'not', condition: { op: 'eq', stat: 'resources.personalCashCents', value: 1 } },
					{
						op: 'any',
						conditions: [{ op: 'gte', stat: 'player.age', value: 30 }, influenceAtLeast(10)]
					}
				]
			},
			true
		]
	])('%s', (_label, condition, expected) => {
		expect(evaluateCondition(context, condition)).toBe(expected);
	});
});
