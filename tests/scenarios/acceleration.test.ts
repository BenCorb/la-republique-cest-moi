import { describe, expect, it } from 'vitest';
import {
	accelerate,
	assertInvariants,
	carryOverPlan,
	chooseEventCommand,
	commitTurn,
	createGame,
	transition,
	type GameState,
	type TurnPlan
} from '../../src/lib/game/engine/index.ts';
import { fixtureContent, withEvents, withWellbeing } from '../fixtures/content.ts';

function advanceManually(state: GameState, plan: TurnPlan, count: number): GameState {
	let current = state;
	for (let index = 0; index < count; index += 1) {
		const next = transition(current, commitTurn(plan), fixtureContent);
		if (!next.ok) throw new Error(next.error.message);
		current = next.state;
	}
	return current;
}

describe('accélération minimale', () => {
	it('produit exactement le même état que les tours unitaires', () => {
		const start = createGame({ seed: 'accélération-identique' }, fixtureContent);
		const plan = { steps: [{ kind: 'action' as const, id: 'test.random' }] };
		const accelerated = accelerate(start, { plan, maxTurns: 12 }, fixtureContent);
		const manual = advanceManually(start, plan, 12);

		expect(accelerated).toMatchObject({ turnsAdvanced: 12, stopReason: 'limit_reached' });
		expect(accelerated.state).toStrictEqual(manual);
		assertInvariants(accelerated.state, fixtureContent);
	});

	it('s’arrête après le tour qui crée une décision bloquante', () => {
		const content = withEvents(['test.stress_alert']);
		const base = createGame({ seed: 'accélération-décision' }, content);
		const start = { ...base, player: { ...base.player, stress: 70 } };
		const accelerated = accelerate(start, { plan: { steps: [] }, maxTurns: 20 }, content);

		expect(accelerated.stopReason).toBe('decision_pending');
		expect(accelerated.turnsAdvanced).toBe(1);
		expect(accelerated.state.phase).toBe('decision');
		const instance = accelerated.state.events.pending[0];
		expect(instance).toBeDefined();
		const chosen = transition(
			accelerated.state,
			chooseEventCommand(instance!.instanceId, 'rest'),
			content
		);
		expect(chosen.ok).toBe(true);
	});

	it('s’arrête avec l’état cohérent lorsque le plan récurrent devient invalide', () => {
		const start = createGame({ seed: 'accélération-plan' }, fixtureContent);
		const fixed = { kind: 'action' as const, id: 'test.fixed' };
		const accelerated = accelerate(
			start,
			{ plan: { steps: [fixed, fixed] }, maxTurns: 40 },
			fixtureContent
		);

		expect(accelerated.stopReason).toBe('invalid_plan');
		expect(accelerated.turnsAdvanced).toBeGreaterThan(0);
		expect(accelerated.issues.some((issue) => issue.code === 'insufficient_resource')).toBe(true);
		assertInvariants(accelerated.state, fixtureContent);
	});

	it('reporte le plan comme un tour manuel : un achat n’a lieu qu’une fois', () => {
		const start = createGame({ seed: 'accélération-achat' }, fixtureContent);
		const plan = {
			steps: [
				{ kind: 'purchase' as const, id: 'test.donors' },
				{ kind: 'action' as const, id: 'test.random' }
			]
		};
		const accelerated = accelerate(start, { plan, maxTurns: 4 }, fixtureContent);

		expect(accelerated).toMatchObject({ turnsAdvanced: 4, stopReason: 'limit_reached' });
		expect(accelerated.state.upgrades).toHaveLength(1);
		expect(accelerated.plan.steps).toEqual([{ kind: 'action', id: 'test.random' }]);
		expect(accelerated.dropped).toEqual([{ kind: 'purchase', id: 'test.donors' }]);

		let manual = start;
		let manualPlan: TurnPlan = plan;
		for (let turn = 0; turn < 4; turn += 1) {
			const next = transition(manual, commitTurn(manualPlan), fixtureContent);
			if (!next.ok) throw new Error(next.error.message);
			manual = next.state;
			manualPlan = carryOverPlan(manual, manualPlan, fixtureContent).plan;
		}
		expect(accelerated.state).toStrictEqual(manual);
	});

	it('s’arrête sur une nouvelle alerte mais ignore celle déjà visible au lancement', () => {
		const base = createGame({ seed: 'accélération-alerte' }, fixtureContent);
		const start = {
			...base,
			resources: { ...base.resources, politicalBudgetCents: 3_000 }
		};
		const recruit = { steps: [{ kind: 'purchase' as const, id: 'test.volunteer' }] };
		const accelerated = accelerate(start, { plan: recruit, maxTurns: 4 }, fixtureContent);

		expect(accelerated.stopReason).toBe('alert');
		expect(accelerated.turnsAdvanced).toBe(1);
		expect(accelerated.alerts.map((alert) => alert.id)).toContain('upkeep_at_risk:upgrade.1');

		const resumed = accelerate(accelerated.state, { plan: recruit, maxTurns: 1 }, fixtureContent);
		expect(resumed.turnsAdvanced).toBe(1);
	});

	it('s’arrête dès la fin de carrière', () => {
		const content = withWellbeing({
			ageBands: [
				{
					fromAge: 0,
					maxHealth: 100,
					ageingChance: 0,
					ageingHealthLoss: 0,
					mortalityChance: 1
				}
			]
		});
		const start = createGame({ seed: 'accélération-fin' }, content);
		const accelerated = accelerate(start, { plan: { steps: [] }, maxTurns: 4 }, content);

		expect(accelerated).toMatchObject({ turnsAdvanced: 1, stopReason: 'game_ended' });
		expect(accelerated.state.phase).toBe('ended');
		assertInvariants(accelerated.state, content);
	});
});
