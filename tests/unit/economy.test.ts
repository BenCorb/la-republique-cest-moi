import { describe, expect, it } from 'vitest';
import {
	checkInvariants,
	commitTurn,
	createGame,
	previewPlan,
	transition,
	type GameState,
	type OwnedUpgrade,
	type PlanStep,
	type TransitionSuccess,
	type TurnPlan
} from '../../src/lib/game/engine/index.ts';
import { fixtureContent, quarterLog } from '../fixtures/content.ts';

const act = (id: string): PlanStep => ({ kind: 'action', id });
const buy = (id: string): PlanStep => ({ kind: 'purchase', id });
const plan = (...steps: PlanStep[]): TurnPlan => ({ steps });

function game(
	resources: Partial<GameState['resources']> = {},
	upgrades: readonly OwnedUpgrade[] = [],
	turn = 0
): GameState {
	const base = createGame({ seed: 'économie' }, fixtureContent);
	return {
		...base,
		turn,
		// Journal cohérent avec le tour : un trimestre résolu vide par trimestre écoulé.
		history: Array.from({ length: turn }, (_, index) => ({
			type: 'turn.resolved' as const,
			turn: index,
			steps: [],
			economy: { producers: [], changes: [] },
			mandates: { changes: [], stress: 0 },
			staff: null,
			family: null,
			wellbeing: { contributions: [], deathCause: null },
			characters: null,
			world: null,
			supports: null,
			deadlines: null,
			exposure: null,
			events: []
		})),
		resources: { ...base.resources, ...resources },
		upgrades,
		nextInstanceNumber: upgrades.length + 1
	};
}

const owned = (number: number, upgradeId: string, acquiredTurn = 0): OwnedUpgrade => ({
	instanceId: `upgrade.${number}`,
	upgradeId,
	acquiredTurn
});

function commit(state: GameState, turnPlan: TurnPlan = plan()): TransitionSuccess {
	const result = transition(state, commitTurn(turnPlan), fixtureContent);
	if (!result.ok) {
		throw new Error(`${result.error.message} ${JSON.stringify(result.error.issues)}`);
	}
	expect(checkInvariants(result.state, fixtureContent)).toEqual([]);
	return result;
}

describe('achat d’une amélioration', () => {
	it('paie le prix au trimestre T, crée une instance et ne produit qu’à partir de T+1', () => {
		const start = game();
		const bought = commit(start, plan(buy('test.donors')));

		expect(bought.state.upgrades).toEqual([owned(1, 'test.donors', 0)]);
		expect(bought.state.nextInstanceNumber).toBe(2);
		expect(quarterLog(bought).steps).toEqual([
			{
				kind: 'purchase',
				id: 'test.donors',
				instanceId: 'upgrade.1',
				changes: [{ resource: 'politicalBudgetCents', delta: -5_000 }],
				gauges: [],
				target: null,
				politics: []
			}
		]);
		// Trimestre T : aucune production.
		expect(quarterLog(bought).economy).toEqual({ producers: [], changes: [] });
		expect(bought.state.resources.politicalBudgetCents).toBe(10_000 - 5_000);

		// Trimestre T+1 : production.
		const next = commit(bought.state);
		expect(quarterLog(next).economy.producers).toEqual([
			{
				instanceId: 'upgrade.1',
				upgradeId: 'test.donors',
				status: 'active',
				changes: [{ resource: 'politicalBudgetCents', delta: 3_000 }]
			}
		]);
		expect(next.state.resources.politicalBudgetCents).toBe(5_000 + 3_000);
	});

	it('prélève les charges à partir de T+1 seulement', () => {
		const bought = commit(game(), plan(buy('test.volunteer')));
		expect(bought.state.resources.politicalBudgetCents).toBe(10_000);
		const next = commit(bought.state);
		expect(next.state.resources).toMatchObject({ politicalBudgetCents: 6_000, influence: 1 });
	});

	it('attribue des identifiants d’instance uniques et croissants', () => {
		const first = commit(game(), plan(buy('test.volunteer'), buy('test.volunteer')));
		const second = commit(first.state, plan(buy('test.volunteer')));
		expect(second.state.upgrades.map((upgrade) => upgrade.instanceId)).toEqual([
			'upgrade.1',
			'upgrade.2',
			'upgrade.3'
		]);
		expect(second.state.upgrades.map((upgrade) => upgrade.acquiredTurn)).toEqual([0, 0, 1]);
	});

	it.each<[string, TurnPlan, GameState, string[]]>([
		['amélioration inconnue', plan(buy('test.inconnue')), game(), ['unknown_upgrade']],
		[
			'identifiant d’action utilisé comme achat',
			plan(buy('test.fixed')),
			game(),
			['unknown_upgrade']
		],
		[
			'nombre maximal possédé',
			plan(buy('test.volunteer')),
			game(
				{},
				[owned(1, 'test.volunteer'), owned(2, 'test.volunteer'), owned(3, 'test.volunteer')],
				1
			),
			['owned_limit']
		],
		[
			'nombre maximal atteint dans le plan',
			plan(buy('test.donors'), buy('test.donors')),
			game(),
			['owned_limit']
		],
		[
			'prix non couvert',
			plan(buy('test.donors')),
			game({ politicalBudgetCents: 4_999 }),
			['insufficient_resource']
		],
		['prérequis', plan(buy('test.club')), game({ influence: 1 }), ['condition_not_met']],
		['temps', plan(act('test.heavy'), buy('test.volunteer')), game(), ['time_exceeded']]
	])('refuse : %s', (_label, turnPlan, state, codes) => {
		const preview = previewPlan(state, turnPlan, fixtureContent);
		expect(preview.issues.map((issue) => issue.code)).toEqual(codes);
		const result = transition(state, commitTurn(turnPlan), fixtureContent);
		expect(result.ok).toBe(false);
		expect(result.state).toBe(state);
	});

	it('accepte un achat sans coût en temps', () => {
		const preview = previewPlan(
			game({ influence: 2 }),
			plan(act('test.heavy'), buy('test.club')),
			fixtureContent
		);
		expect(preview.valid).toBe(true);
		expect(preview.timeUsed).toBe(100);
	});
});

describe('trésoreries séparées', () => {
	it('paie une amélioration personnelle sur l’argent personnel uniquement', () => {
		const start = game({ influence: 2 });
		const bought = commit(start, plan(buy('test.club')));
		expect(bought.state.resources).toEqual({
			influence: 2,
			politicalBudgetCents: start.resources.politicalBudgetCents,
			personalCashCents: start.resources.personalCashCents - 30_000
		});
		const next = commit(bought.state);
		expect(next.state.resources).toEqual({
			influence: 4,
			politicalBudgetCents: start.resources.politicalBudgetCents,
			personalCashCents: start.resources.personalCashCents - 30_000 - 10_000
		});
	});

	it('ne puise jamais dans l’autre trésorerie pour payer une charge', () => {
		const state = game(
			{ politicalBudgetCents: 0, personalCashCents: 1_000_000 },
			[owned(1, 'test.volunteer')],
			1
		);
		const next = commit(state);
		expect(quarterLog(next).economy.producers[0]?.status).toBe('suspended');
		expect(next.state.resources.personalCashCents).toBe(1_000_000);
	});
});

describe('charges impayées', () => {
	it('suspend la production sans rien prélever, puis reprend quand la trésorerie suffit', () => {
		const state = game({ politicalBudgetCents: 3_999 }, [owned(1, 'test.volunteer')], 1);
		const suspended = commit(state);
		expect(quarterLog(suspended).economy.producers).toEqual([
			{ instanceId: 'upgrade.1', upgradeId: 'test.volunteer', status: 'suspended', changes: [] }
		]);
		expect(suspended.state.resources).toEqual(state.resources);

		const funded = commit({
			...suspended.state,
			resources: { ...suspended.state.resources, politicalBudgetCents: 4_000 }
		});
		expect(quarterLog(funded).economy.producers[0]?.status).toBe('active');
		expect(funded.state.resources).toMatchObject({ politicalBudgetCents: 0, influence: 1 });
	});

	it('paie les charges dans l’ordre d’acquisition', () => {
		const state = game(
			{ politicalBudgetCents: 5_000 },
			[owned(1, 'test.volunteer'), owned(2, 'test.volunteer')],
			1
		);
		const next = commit(state);
		expect(quarterLog(next).economy.producers.map((producer) => producer.status)).toEqual([
			'active',
			'suspended'
		]);
		expect(next.state.resources).toMatchObject({ politicalBudgetCents: 1_000, influence: 1 });
	});

	it('prélève toutes les charges avant la production du trimestre', () => {
		// La production des donateurs n'est pas disponible pour payer le bénévole du même trimestre.
		const state = game(
			{ politicalBudgetCents: 1_000 },
			[owned(1, 'test.donors'), owned(2, 'test.volunteer')],
			1
		);
		const next = commit(state);
		expect(quarterLog(next).economy.producers.map((producer) => producer.status)).toEqual([
			'active',
			'suspended'
		]);
		expect(next.state.resources.politicalBudgetCents).toBe(4_000);
	});

	it('laisse les actions du plan dépenser avant les charges, avec un avertissement', () => {
		const state = game({ politicalBudgetCents: 21_000 }, [owned(1, 'test.volunteer')], 1);
		const turnPlan = plan(act('test.expensive'));
		const preview = previewPlan(state, turnPlan, fixtureContent);
		expect(preview.valid).toBe(true);
		expect(preview.warnings).toEqual([
			expect.objectContaining({ code: 'upkeep_at_risk', instanceId: 'upgrade.1' })
		]);
		const next = commit(state, turnPlan);
		expect(quarterLog(next).economy.producers[0]?.status).toBe('suspended');
	});
});

describe('prévision économique', () => {
	it('annonce les producteurs, l’instance à créer et les variations nettes', () => {
		const state = game(
			{ politicalBudgetCents: 20_000 },
			[owned(1, 'test.volunteer'), owned(2, 'test.donors')],
			1
		);
		const turnPlan = plan(buy('test.volunteer'));
		const preview = previewPlan(state, turnPlan, fixtureContent);
		expect(preview.steps[0]?.instanceId).toBe('upgrade.3');
		expect(preview.producers.map((producer) => [producer.instanceId, producer.status])).toEqual([
			['upgrade.1', 'active'],
			['upgrade.2', 'active'],
			['upgrade.3', 'pending']
		]);
		expect(preview.warnings).toEqual([]);
		expect(preview.resourceChanges).toEqual({
			influence: { min: 1, max: 1 },
			politicalBudgetCents: { min: -4_000 + 3_000, max: -4_000 + 3_000 },
			personalCashCents: { min: 0, max: 0 }
		});

		const result = commit(state, turnPlan);
		expect(result.state.upgrades.at(-1)?.instanceId).toBe('upgrade.3');
		expect(result.state.resources.influence - state.resources.influence).toBe(1);
		expect(result.state.resources.politicalBudgetCents - state.resources.politicalBudgetCents).toBe(
			-1_000
		);
	});

	it('ne modifie pas l’état', () => {
		const state = game({}, [owned(1, 'test.volunteer')], 1);
		const before = JSON.stringify(state);
		previewPlan(state, plan(buy('test.volunteer'), act('test.random')), fixtureContent);
		expect(JSON.stringify(state)).toBe(before);
	});
});

describe('invariants des améliorations', () => {
	it.each<[string, GameState, string]>([
		[
			'instance en double',
			game({}, [owned(1, 'test.volunteer'), owned(1, 'test.volunteer')], 1),
			'en double'
		],
		['achat non antérieur au tour', game({}, [owned(1, 'test.volunteer', 1)], 1), 'acquisition'],
		[
			'ordre d’acquisition',
			game({}, [owned(1, 'test.volunteer', 1), owned(2, 'test.volunteer', 0)], 2),
			'hors ordre'
		],
		[
			'identifiant au-delà du compteur',
			{ ...game({}, [owned(1, 'test.volunteer')], 1), nextInstanceNumber: 1 },
			'identifiant d’instance'
		],
		[
			'amélioration hors catalogue',
			game({}, [owned(1, 'test.disparue')], 1),
			'inconnue du catalogue'
		],
		[
			'trop d’exemplaires',
			game({}, [owned(1, 'test.donors'), owned(2, 'test.donors')], 1),
			'trop d’exemplaires'
		]
	])('détecte : %s', (_label, state, fragment) => {
		expect(checkInvariants(state, fixtureContent).join('\n')).toContain(fragment);
	});
});
