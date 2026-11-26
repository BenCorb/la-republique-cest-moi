import { describe, expect, it } from 'vitest';
import { GameController } from '../../src/lib/game/app/controller.ts';
import { projectView } from '../../src/lib/game/app/view-model.ts';
import {
	accelerate,
	carryOverPlan,
	commitTurn,
	createGame,
	previewPlan,
	prunePlan,
	transition,
	type GameState,
	type TurnPlan
} from '../../src/lib/game/engine/index.ts';
import type { KeyValueStorage } from '../../src/lib/game/persistence/index.ts';
import { fixtureContent } from '../fixtures/content.ts';

/** Agenda ponctuel par défaut et retrait automatique (P3-11), tendances et actualités (P3-08). */
const fixed = { kind: 'action', id: 'test.fixed' } as const;
const pinnedFixed = { kind: 'action', id: 'test.fixed', pinned: true } as const;
const random = { kind: 'action', id: 'test.random' } as const;

function advance(state: GameState, turns: number): GameState {
	let current = state;
	for (let turn = 0; turn < turns; turn += 1) {
		const result = transition(current, commitTurn(), fixtureContent);
		if (!result.ok) throw new Error(result.error.message);
		current = result.state;
	}
	return current;
}

function newController(seed: string, storage: KeyValueStorage | null = null): GameController {
	const game = new GameController({
		content: fixtureContent,
		storage,
		now: () => '2026-11-26T10:00:00.000Z',
		newSeed: () => seed
	});
	game.newCareer();
	return game;
}

class MemoryStorage implements KeyValueStorage {
	readonly items = new Map<string, string>();
	getItem(key: string): string | null {
		return this.items.get(key) ?? null;
	}
	setItem(key: string, value: string): void {
		this.items.set(key, value);
	}
}

describe('plan ponctuel par défaut (P3-11)', () => {
	it('ne reconduit que les actions épinglées, au tour comme en accélération', () => {
		const state = createGame({ seed: 'épinglage' }, fixtureContent);
		const plan = { steps: [pinnedFixed, random] };
		expect(previewPlan(state, plan, fixtureContent).valid).toBe(true);
		expect(carryOverPlan(state, plan, fixtureContent)).toEqual({
			plan: { steps: [pinnedFixed] },
			expired: [random],
			removed: []
		});
		const batch = accelerate(state, { plan, maxTurns: 2 }, fixtureContent);
		expect(batch).toMatchObject({ turnsAdvanced: 2, stopReason: 'limit_reached' });
		expect(batch.plan.steps).toEqual([pinnedFixed]);
		expect(batch.expired).toEqual([random]);

		// Même résultat trimestre par trimestre.
		let manual = state;
		let manualPlan: TurnPlan = plan;
		for (let turn = 0; turn < 2; turn += 1) {
			const next = transition(manual, commitTurn(manualPlan), fixtureContent);
			if (!next.ok) throw new Error(next.error.message);
			manual = next.state;
			manualPlan = carryOverPlan(manual, manualPlan, fixtureContent).plan;
		}
		expect(batch.state).toStrictEqual(manual);
	});

	it('n’accepte l’épinglage que sur une action', () => {
		const state = createGame({ seed: 'marqueur' }, fixtureContent);
		const preview = previewPlan(
			state,
			{ steps: [{ kind: 'purchase', id: fixtureContent.upgradeIds[0]!, pinned: true } as never] },
			fixtureContent
		);
		expect(preview.valid).toBe(false);
	});

	it('ajoute toujours une activité ponctuelle, ciblée ou non, qui disparaît après le trimestre', () => {
		const game = newController('ponctuel');
		expect(game.addStep(fixed)).toBe(true);
		expect(game.addStep(random)).toBe(true);
		expect(game.addStep({ kind: 'purchase', id: 'test.donors' })).toBe(true);
		const view = game.snapshot().view!;
		expect(view.plan.steps.map((step) => step.pinned)).toEqual([false, false, false]);
		expect(view.plan.pinnedCount).toBe(0);
		expect(game.commitTurn()).toBe(true);
		expect(game.snapshot().plan).toEqual([]);
		// Une expiration normale n'est pas signalée.
		expect(game.snapshot().notice).toBeNull();
	});

	it('épingle, reconduit, puis désépingle pour un dernier passage', () => {
		const game = newController('épingle');
		game.addStep(fixed);
		game.addStep(random);
		game.addStep(random);
		game.togglePin(0);
		game.togglePin(2);
		expect(game.snapshot().view?.plan.steps.map((step) => step.pinned)).toEqual([
			true,
			false,
			true
		]);
		expect(game.commitTurn()).toBe(true);
		// Les épinglées gardent leur ordre relatif.
		expect(game.snapshot().plan).toEqual([pinnedFixed, { ...random, pinned: true }]);
		expect(game.commitTurn()).toBe(true);
		expect(game.snapshot().plan).toEqual([pinnedFixed, { ...random, pinned: true }]);
		game.togglePin(0);
		expect(game.snapshot().plan).toEqual([fixed, { ...random, pinned: true }]);
		expect(game.commitTurn()).toBe(true);
		expect(game.snapshot().plan).toEqual([{ ...random, pinned: true }]);
	});

	it('n’épingle jamais un achat', () => {
		const game = newController('achat');
		game.addStep({ kind: 'purchase', id: 'test.donors' });
		game.togglePin(0);
		expect(game.snapshot().plan).toEqual([{ kind: 'purchase', id: 'test.donors' }]);
		expect(game.snapshot().view?.plan.steps[0]?.pinned).toBe(false);
	});

	it('refuse avec son motif une activité déjà impossible', () => {
		const game = newController('refus');
		expect(game.addStep({ kind: 'action', id: 'test.gated' })).toBe(false);
		expect(game.snapshot().plan).toEqual([]);
		expect(game.snapshot().notice).toMatchObject({
			level: 'warning',
			details: ['Il faut au moins 4 points d’influence.']
		});
		game.addStep(fixed);
		game.addStep(fixed);
		// Troisième occurrence : limite de répétition.
		expect(game.addStep(fixed)).toBe(false);
		expect(game.snapshot().plan).toHaveLength(2);
	});
});

describe('retrait automatique du plan (P3-11)', () => {
	it('retire la première étape invalide puis recalcule : seules les occurrences en trop partent', () => {
		const base = createGame({ seed: 'cascade' }, fixtureContent);
		// Budget pour une seule « Gain fixe » (1 000 c), puis une action conditionnelle impossible.
		const state = { ...base, resources: { ...base.resources, politicalBudgetCents: 1_500 } };
		const plan = {
			steps: [pinnedFixed, pinnedFixed, { kind: 'action', id: 'test.gated', pinned: true } as const]
		};
		const pruned = prunePlan(state, plan, fixtureContent);
		expect(pruned.plan.steps).toEqual([pinnedFixed]);
		expect(pruned.removed.map((removal) => removal.step.id)).toEqual(['test.fixed', 'test.gated']);
		expect(pruned.removed[0]!.reason).toMatch(/Budget politique insuffisant/u);
		expect(previewPlan(state, pruned.plan, fixtureContent).valid).toBe(true);

		// Limite de répétition : deux occurrences gardées sur trois.
		const repeated = prunePlan(base, { steps: [random, random, random, random] }, fixtureContent);
		expect(repeated.plan.steps).toEqual([random, random, random]);
		expect(repeated.removed).toHaveLength(1);
	});

	it('ne fait pas revenir une épinglée retirée quand elle redevient possible', () => {
		const base = createGame({ seed: 'désépinglée' }, fixtureContent);
		const poor = { ...base, resources: { ...base.resources, politicalBudgetCents: 0 } };
		const carried = carryOverPlan(poor, { steps: [pinnedFixed, random] }, fixtureContent);
		expect(carried.plan.steps).toEqual([]);
		expect(carried.removed.map((removal) => removal.step)).toEqual([pinnedFixed]);
		// Le plan reconduit est vide : rien ne revient au trimestre suivant.
		const rich = { ...base, resources: { ...base.resources, politicalBudgetCents: 100_000 } };
		expect(carryOverPlan(rich, carried.plan, fixtureContent).plan.steps).toEqual([]);
	});

	it('retire l’étape devenue excédentaire après un réordonnancement et l’inscrit au journal', () => {
		const game = newController('réordonner');
		const earn = { kind: 'action', id: 'test.earn' } as const;
		const spend = { kind: 'action', id: 'test.spend_cash' } as const;
		// La dépense n'est possible qu'après le revenu du même trimestre.
		expect(game.addStep(earn)).toBe(true);
		expect(game.addStep(spend)).toBe(true);
		game.moveStep(1, -1);
		const snapshot = game.snapshot();
		expect(snapshot.plan).toEqual([earn]);
		expect(snapshot.view?.plan.adjustments).toEqual([
			'Dépense personnelle retiré — Argent personnel insuffisant pour « Dépense personnelle ».'
		]);
		expect(snapshot.notice?.text).toBe('Plan ajusté :');
		const lines = snapshot.view?.journal[0]?.lines ?? [];
		expect(lines[0]).toEqual({
			kind: 'step',
			text: 'Plan ajusté : Dépense personnelle retiré — Argent personnel insuffisant pour « Dépense personnelle ».'
		});
	});

	it('s’arrête sur un plan devenu vide quand toutes les activités sont ponctuelles', async () => {
		const game = newController('accélération-ponctuelle', new MemoryStorage());
		game.addStep(random);
		await game.accelerate(4);
		expect(game.snapshot().acceleration).toMatchObject({
			turnsAdvanced: 1,
			stopReason: 'empty_plan'
		});
		// Un plan vide au lancement ne déclenche pas le garde-fou.
		await game.accelerate(2);
		expect(game.snapshot().acceleration).toMatchObject({
			turnsAdvanced: 2,
			stopReason: 'limit_reached'
		});
	});

	it('n’enregistre pas le brouillon : la reprise repart d’un plan vide', () => {
		const storage = new MemoryStorage();
		const game = newController('reprise', storage);
		game.addStep(fixed);
		game.togglePin(0);
		expect(game.commitTurn()).toBe(true);
		expect(game.snapshot().plan).toEqual([pinnedFixed]);
		const turn = game.snapshot().view?.dateLabel;
		const resumed = new GameController({
			content: fixtureContent,
			storage,
			now: () => '2026-11-26T10:00:00.000Z',
			newSeed: () => 'reprise'
		});
		expect(resumed.resume()).toBe(true);
		expect(resumed.snapshot().view?.dateLabel).toBe(turn);
		expect(resumed.snapshot().plan).toEqual([]);
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
