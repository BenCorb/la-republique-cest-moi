import { describe, expect, it } from 'vitest';
import { GameController } from '../../src/lib/game/app/controller.ts';
import { projectView } from '../../src/lib/game/app/view-model.ts';
import {
	accelerate,
	carryOverPlan,
	commitTurn,
	createGame,
	previewPlan,
	transition,
	type GameState
} from '../../src/lib/game/engine/index.ts';
import { fixtureContent } from '../fixtures/content.ts';

/** Interface définitive, second volet de P3-08 : épinglage, tendances, actualités. */
const fixed = { kind: 'action', id: 'test.fixed' } as const;
const once = { kind: 'action', id: 'test.fixed', once: true } as const;

function advance(state: GameState, turns: number): GameState {
	let current = state;
	for (let turn = 0; turn < turns; turn += 1) {
		const result = transition(current, commitTurn(), fixtureContent);
		if (!result.ok) throw new Error(result.error.message);
		current = result.state;
	}
	return current;
}

describe('plan épinglé (P3-08)', () => {
	it('reconduit les actions épinglées et retire les ponctuelles, au tour comme en accélération', () => {
		const state = createGame({ seed: 'épinglage' }, fixtureContent);
		const plan = { steps: [fixed, once] };
		expect(previewPlan(state, plan, fixtureContent).valid).toBe(true);
		expect(carryOverPlan(state, plan, fixtureContent)).toEqual({
			plan: { steps: [fixed] },
			dropped: [once]
		});
		const batch = accelerate(state, { plan, maxTurns: 2 }, fixtureContent);
		expect(batch.plan.steps).toEqual([fixed]);
		expect(batch.dropped).toEqual([once]);
	});

	it('n’accepte le marqueur ponctuel que sur une action', () => {
		const state = createGame({ seed: 'marqueur' }, fixtureContent);
		const preview = previewPlan(
			state,
			{ steps: [{ kind: 'purchase', id: fixtureContent.upgradeIds[0]!, once: true } as never] },
			fixtureContent
		);
		expect(preview.valid).toBe(false);
	});

	it('bascule l’épinglage depuis le contrôleur et l’affiche dans le plan', () => {
		const game = new GameController({
			content: fixtureContent,
			storage: null,
			now: () => '2026-11-26T10:00:00.000Z',
			newSeed: () => 'contrôleur-épinglage'
		});
		game.newCareer();
		game.addStep(fixed);
		game.addStep({ kind: 'action', id: 'test.random' });
		expect(game.snapshot().view?.plan.steps.map((step) => step.pinned)).toEqual([true, true]);
		game.togglePin(1);
		expect(game.snapshot().view?.plan.steps.map((step) => step.pinned)).toEqual([true, false]);
		expect(game.commitTurn()).toBe(true);
		expect(game.snapshot().plan).toEqual([fixed]);
		expect(game.snapshot().notice?.details).toEqual([fixtureContent.actions['test.random']?.label]);
	});
});

describe('tendances et actualités (P3-08)', () => {
	it('trace les tendances depuis les instantanés de fin de trimestre', () => {
		const start = createGame({ seed: 'tendances' }, fixtureContent);
		expect(projectView(start, [], fixtureContent).trends).toEqual([]);
		let state = start;
		for (let turn = 0; turn < 3; turn += 1) {
			const result = transition(state, commitTurn({ steps: [fixed] }), fixtureContent);
			if (!result.ok) throw new Error(result.error.message);
			state = result.state;
		}
		const trends = projectView(state, [], fixtureContent).trends;
		const influence = trends.find((trend) => trend.id === 'influence')!;
		expect(influence.points).toEqual([
			start.resources.influence + 2,
			start.resources.influence + 4,
			start.resources.influence + 6
		]);
		expect(influence).toMatchObject({ change: '+ 4', mood: 'good' });
		expect(influence.description).toContain('depuis le T1 2000');
		expect(trends.map((trend) => trend.id)).toEqual([
			'influence',
			'politicalBudgetCents',
			'personalCashCents',
			'popularity',
			'health',
			'stress'
		]);
	});

	it('n’affiche plus que le bilan dans les alertes une fois la carrière terminée', () => {
		const state = advance(createGame({ seed: 'fin' }, fixtureContent), 1);
		const ended: GameState = {
			...state,
			phase: 'ended',
			player: { ...state.player, health: 0 },
			end: { turn: state.turn - 1, reason: 'death', cause: 'health_failure' }
		};
		expect(projectView(ended, [], fixtureContent).alerts).toEqual([
			{ level: 'info', text: 'Carrière terminée : le bilan est présenté au centre de l’écran.' }
		]);
	});

	it('regroupe les actualités par trimestre, du plus récent au plus ancien', () => {
		// Une nouvelle d'ambiance à chaque trimestre.
		const content = { ...fixtureContent, press: { ...fixtureContent.press, ambientPercent: 100 } };
		let state = createGame({ seed: 'actualités' }, content);
		for (let turn = 0; turn < 2; turn += 1) {
			const result = transition(state, commitTurn(), content);
			if (!result.ok) throw new Error(result.error.message);
			state = result.state;
		}
		const news = projectView(state, [], content).news;
		expect(news.map((quarter) => quarter.label)).toEqual(['T3 2000', 'T2 2000']);
		expect(news[0]?.items).toEqual([
			expect.objectContaining({
				media: 'La Feuille locale',
				title: 'Nouvelle d’ambiance',
				aboutPlayer: false,
				toneLabel: null,
				critical: false
			})
		]);
	});
});
