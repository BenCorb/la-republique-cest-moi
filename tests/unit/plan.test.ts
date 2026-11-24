import { describe, expect, it } from 'vitest';
import {
	checkInvariants,
	commitTurn,
	createGame,
	previewPlan,
	transition,
	type GameState,
	type TurnPlan
} from '../../src/lib/game/engine/index.ts';
import { fixtureContent } from '../fixtures/content.ts';

function deepFreeze<T>(value: T): T {
	if (value && typeof value === 'object' && !Object.isFrozen(value)) {
		Object.freeze(value);
		for (const child of Object.values(value)) deepFreeze(child);
	}
	return value;
}

const plan = (...actionIds: string[]): TurnPlan => ({
	actions: actionIds.map((actionId) => ({ actionId }))
});

function game(overrides: Partial<GameState['resources']> = {}): GameState {
	const base = createGame({ seed: 'plan' }, fixtureContent);
	return deepFreeze({ ...base, resources: { ...base.resources, ...overrides } });
}

function issueCodes(state: GameState, turnPlan: TurnPlan): (string | number | null)[][] {
	return previewPlan(state, turnPlan, fixtureContent).issues.map((issue) => [
		issue.index,
		issue.code
	]);
}

describe('prévision du plan', () => {
	it('accepte un plan vide', () => {
		const preview = previewPlan(game(), plan(), fixtureContent);
		expect(preview.valid).toBe(true);
		expect(preview.timeUsed).toBe(0);
		expect(preview.timeRemaining).toBe(100);
	});

	it('détaille temps, coûts et fourchettes certaines', () => {
		const preview = previewPlan(
			game(),
			plan('test.fixed', 'test.random', 'test.random'),
			fixtureContent
		);
		expect(preview.valid).toBe(true);
		expect(preview.timeUsed).toBe(40);
		expect(preview.timeRemaining).toBe(60);
		expect(preview.steps.map((step) => step.label)).toEqual([
			'Gain fixe',
			'Gain aléatoire',
			'Gain aléatoire'
		]);
		expect(preview.steps[1]?.effects).toEqual([{ resource: 'influence', min: 1, max: 5 }]);
		expect(preview.resourceChanges).toEqual({
			influence: { min: 4, max: 12 },
			politicalBudgetCents: { min: -1_000, max: -1_000 },
			personalCashCents: { min: 0, max: 0 }
		});
	});

	it('est pure : ni l’état ni le PRNG ne changent, résultat identique à chaque appel', () => {
		const state = game();
		const before = JSON.stringify(state);
		const turnPlan = deepFreeze(plan('test.random', 'test.fixed', 'test.inconnue'));
		const first = previewPlan(state, turnPlan, fixtureContent);
		const second = previewPlan(state, turnPlan, fixtureContent);
		expect(second).toEqual(first);
		expect(JSON.stringify(state)).toBe(before);
	});

	it('remplit exactement le budget de temps', () => {
		expect(previewPlan(game(), plan('test.heavy'), fixtureContent).timeRemaining).toBe(0);
	});

	it.each<[string, TurnPlan, (string | number | null)[][]]>([
		['action inconnue', plan('test.inconnue'), [[0, 'unknown_action']]],
		['identifiant hérité de Object', plan('constructor'), [[0, 'unknown_action']]],
		['temps dépassé', plan('test.heavy', 'test.random'), [[1, 'time_exceeded']]],
		[
			'répétition au-delà de la limite',
			plan('test.fixed', 'test.fixed', 'test.fixed'),
			[[2, 'repeat_limit']]
		],
		['prérequis non rempli', plan('test.gated'), [[0, 'condition_not_met']]],
		['budget insuffisant', plan('test.expensive'), [[0, 'insufficient_resource']]],
		[
			'plusieurs problèmes signalés ensemble',
			plan('test.inconnue', 'test.gated', 'test.expensive'),
			[
				[0, 'unknown_action'],
				[1, 'condition_not_met'],
				[2, 'insufficient_resource']
			]
		]
	])('signale : %s', (_label, turnPlan, expected) => {
		expect(issueCodes(game(), turnPlan)).toEqual(expected);
	});

	it('rejette un plan mal formé', () => {
		const malformed = { actions: 'tout' } as unknown as TurnPlan;
		expect(issueCodes(game(), malformed)).toEqual([[null, 'invalid_plan']]);
		expect(issueCodes(game(), { actions: [{}, null] } as unknown as TurnPlan)).toEqual([
			[0, 'invalid_plan'],
			[1, 'invalid_plan']
		]);
	});

	it('explique un prérequis manquant avec le texte du catalogue', () => {
		const [issue] = previewPlan(game(), plan('test.gated'), fixtureContent).issues;
		expect(issue?.message).toBe('Il faut au moins 4 points d’influence.');
	});

	it('évalue les prérequis dans l’ordre du plan, avec les gains certains', () => {
		expect(issueCodes(game(), plan('test.fixed', 'test.fixed', 'test.gated'))).toEqual([]);
		expect(issueCodes(game(), plan('test.gated', 'test.fixed', 'test.fixed'))).toEqual([
			[0, 'condition_not_met']
		]);
	});

	it('laisse un gain certain financer une action suivante, pas l’inverse', () => {
		expect(issueCodes(game(), plan('test.earn', 'test.spend_cash'))).toEqual([]);
		expect(issueCodes(game(), plan('test.spend_cash', 'test.earn'))).toEqual([
			[0, 'insufficient_resource']
		]);
	});

	it('ne laisse jamais un gain aléatoire financer ou débloquer une autre action', () => {
		expect(issueCodes(game(), plan('test.random_budget', 'test.expensive'))).toEqual([
			[1, 'insufficient_resource']
		]);
		expect(issueCodes(game({ influence: 3 }), plan('test.random', 'test.gated'))).toEqual([
			[1, 'condition_not_met']
		]);
	});

	it('ignore une action fautive pour la suite de la simulation', () => {
		const preview = previewPlan(game(), plan('test.heavy', 'test.heavy'), fixtureContent);
		expect(preview.issues.map((issue) => issue.code)).toEqual(['repeat_limit', 'time_exceeded']);
		expect(preview.timeUsed).toBe(100);
	});
});

describe('validation du trimestre avec un plan', () => {
	it('refuse un plan invalide sans rien modifier, PRNG compris', () => {
		const state = game();
		const before = JSON.stringify(state);
		const result = transition(
			state,
			commitTurn(plan('test.random', 'test.expensive')),
			fixtureContent
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe('invalid_plan');
		expect(result.error.issues.map((issue) => issue.code)).toEqual(['insufficient_resource']);
		expect(result.state).toBe(state);
		expect(JSON.stringify(state)).toBe(before);
	});

	it('applique coûts et effets dans l’ordre et les journalise', () => {
		const state = game();
		const result = transition(
			state,
			commitTurn(plan('test.earn', 'test.spend_cash', 'test.fixed')),
			fixtureContent
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.state.resources).toEqual({
			influence: 2,
			politicalBudgetCents: 10_000 + 120_000 - 1_000,
			personalCashCents: 100_000 + 50_000 - 120_000
		});
		expect(result.log[0]?.actions).toEqual([
			{ actionId: 'test.earn', changes: [{ resource: 'personalCashCents', delta: 50_000 }] },
			{
				actionId: 'test.spend_cash',
				changes: [
					{ resource: 'politicalBudgetCents', delta: 120_000 },
					{ resource: 'personalCashCents', delta: -120_000 }
				]
			},
			{
				actionId: 'test.fixed',
				changes: [
					{ resource: 'influence', delta: 2 },
					{ resource: 'politicalBudgetCents', delta: -1_000 }
				]
			}
		]);
		// Aucun effet aléatoire : le PRNG n'avance pas.
		expect(result.state.rng).toEqual(state.rng);
		expect(checkInvariants(result.state)).toEqual([]);
	});

	it('tire les effets aléatoires dans la fourchette annoncée par la prévision', () => {
		const turnPlan = plan('test.random', 'test.random', 'test.random', 'test.random_budget');
		const preview = previewPlan(game(), turnPlan, fixtureContent);
		for (let seed = 0; seed < 200; seed += 1) {
			const start = createGame({ seed: `fourchette-${seed}` }, fixtureContent);
			const result = transition(start, commitTurn(turnPlan), fixtureContent);
			if (!result.ok) throw new Error(result.error.message);
			for (const [resource, range] of Object.entries(preview.resourceChanges)) {
				const key = resource as keyof GameState['resources'];
				const delta = result.state.resources[key] - start.resources[key];
				expect(delta).toBeGreaterThanOrEqual(range.min);
				expect(delta).toBeLessThanOrEqual(range.max);
			}
			expect(result.state.rng.state).not.toBe(start.rng.state);
		}
	});
});
