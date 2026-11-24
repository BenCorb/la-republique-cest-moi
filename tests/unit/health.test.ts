import { describe, expect, it } from 'vitest';
import type { Content } from '../../src/lib/game/content/types.ts';
import {
	ageBandFor,
	careerSummary,
	checkInvariants,
	commitTurn,
	createGame,
	formatTurn,
	previewPlan,
	transition,
	turnOf,
	workloadStress,
	type GameState,
	type PlanStep,
	type TransitionSuccess,
	type TurnPlan
} from '../../src/lib/game/engine/index.ts';
import { fixtureContent, withWellbeing } from '../fixtures/content.ts';

const act = (id: string): PlanStep => ({ kind: 'action', id });
const plan = (...steps: PlanStep[]): TurnPlan => ({ steps });

function game(
	content: Content,
	player: Partial<GameState['player']> = {},
	seed = 'santé'
): GameState {
	const base = createGame({ seed }, content);
	return { ...base, player: { ...base.player, ...player } };
}

function commit(
	state: GameState,
	content: Content,
	turnPlan: TurnPlan = plan()
): TransitionSuccess {
	const result = transition(state, commitTurn(turnPlan), content);
	if (!result.ok) throw new Error(`${result.error.message} ${JSON.stringify(result.error.issues)}`);
	expect(checkInvariants(result.state, content)).toEqual([]);
	return result;
}

/** Charge de travail : +3 de stress par tranche de 10 points au-delà de 50. */
const workloadModel = withWellbeing({
	workloadThreshold: 50,
	workloadStressPer10Points: 3,
	stressRecoveryPerTurn: 4
});

describe('charge de travail et repos', () => {
	it('calcule le stress de la charge de travail par tranches complètes', () => {
		const wellbeing = workloadModel.balance.wellbeing;
		expect([0, 50, 59, 60, 79, 80, 100].map((time) => workloadStress(time, wellbeing))).toEqual([
			0, 0, 0, 3, 6, 9, 15
		]);
	});

	it('stresse un trimestre chargé et laisse récupérer un trimestre calme', () => {
		const start = game(workloadModel, { stress: 20 });
		const busy = commit(start, workloadModel, plan(act('test.heavy')));
		expect(busy.state.player.stress).toBe(20 + 15 - 4);
		expect(busy.log[0]?.wellbeing.contributions).toEqual([
			{ source: 'workload', gauge: 'player.stress', delta: 15 },
			{ source: 'recovery', gauge: 'player.stress', delta: -4 }
		]);

		const quiet = commit(start, workloadModel);
		expect(quiet.state.player.stress).toBe(16);
	});

	it('fait baisser le stress avec le repos, malgré le temps qu’il occupe', () => {
		const start = game(workloadModel, { stress: 50 });
		const rested = commit(start, workloadModel, plan(act('test.rest'), act('test.rest')));
		// 40 points de temps : sous le seuil ; −30 de repos, −4 de récupération.
		expect(rested.state.player.stress).toBe(16);
		expect(rested.log[0]?.steps.map((step) => step.gauges)).toEqual([
			[{ gauge: 'player.stress', delta: -15 }],
			[{ gauge: 'player.stress', delta: -15 }]
		]);
	});

	it('maintient les jauges dans leurs bornes et journalise la variation réelle', () => {
		const start = game(workloadModel, { stress: 5, health: 98 });
		const result = commit(start, workloadModel, plan(act('test.rest'), act('test.tonic')));
		expect(result.state.player).toMatchObject({ stress: 0, health: 100 });
		expect(result.log[0]?.steps.map((step) => step.gauges)).toEqual([
			[{ gauge: 'player.stress', delta: -5 }],
			[{ gauge: 'player.health', delta: 2 }]
		]);
	});

	it('permet aux prérequis de lire la santé et le stress modifiés par le plan', () => {
		const gated: Content = {
			...fixtureContent,
			actions: {
				...fixtureContent.actions,
				'test.gated': {
					...fixtureContent.actions['test.gated']!,
					requires: { op: 'lte', stat: 'player.stress', value: 10 }
				}
			}
		};
		const state = game(gated, { stress: 20 });
		expect(previewPlan(state, plan(act('test.gated')), gated).valid).toBe(false);
		expect(previewPlan(state, plan(act('test.rest'), act('test.gated')), gated).valid).toBe(true);
	});
});

describe('stress élevé, calme et vieillissement', () => {
	const model = withWellbeing({
		highStressThreshold: 70,
		highStressHealthLoss: 2,
		calmStressThreshold: 30,
		calmHealthGain: 1,
		ageBands: [
			{ fromAge: 0, maxHealth: 82, ageingChance: 0, ageingHealthLoss: 0, mortalityChance: 0 }
		]
	});

	it('dégrade la santé sous stress élevé', () => {
		const result = commit(game(model, { stress: 80, health: 60 }), model);
		expect(result.state.player.health).toBe(58);
		expect(result.log[0]?.wellbeing.contributions).toContainEqual({
			source: 'high_stress',
			gauge: 'player.health',
			delta: -2
		});
	});

	it('fait récupérer la santé au calme, sans dépasser le plafond de l’âge', () => {
		let state = game(model, { stress: 10, health: 80 });
		const healths: number[] = [];
		for (let index = 0; index < 4; index += 1) {
			state = commit(state, model).state;
			healths.push(state.player.health);
		}
		expect(healths).toEqual([81, 82, 82, 82]);
	});

	it('ni perte ni gain entre les deux seuils', () => {
		const result = commit(game(model, { stress: 50, health: 60 }), model);
		expect(result.state.player.health).toBe(60);
	});

	it('choisit la tranche d’âge selon l’âge atteint', () => {
		const bands = withWellbeing({
			ageBands: [
				{ fromAge: 0, maxHealth: 100, ageingChance: 0, ageingHealthLoss: 0, mortalityChance: 0 },
				{ fromAge: 60, maxHealth: 70, ageingChance: 1, ageingHealthLoss: 2, mortalityChance: 0 }
			]
		}).balance.wellbeing;
		expect(ageBandFor(25, bands).fromAge).toBe(0);
		expect(ageBandFor(59, bands).fromAge).toBe(0);
		expect(ageBandFor(60, bands).fromAge).toBe(60);
		expect(ageBandFor(102, bands).fromAge).toBe(60);
	});

	it('applique le vieillissement de la tranche d’âge', () => {
		const ageing = withWellbeing({
			ageBands: [
				{ fromAge: 0, maxHealth: 100, ageingChance: 0, ageingHealthLoss: 0, mortalityChance: 0 },
				{ fromAge: 60, maxHealth: 70, ageingChance: 1, ageingHealthLoss: 2, mortalityChance: 0 }
			]
		});
		const young = commit(game(ageing, { health: 70 }), ageing);
		expect(young.state.player.health).toBe(70);

		// Né en 1940 : 60 ans au T1 2000.
		const old = commit(game(ageing, { health: 70, birthTurn: turnOf(1940, 1) }), ageing);
		expect(old.state.player.health).toBe(68);
		expect(old.log[0]?.wellbeing.contributions).toEqual([
			{ source: 'ageing', gauge: 'player.health', delta: -2 }
		]);
	});
});

describe('décès et fin de carrière', () => {
	it('meurt lorsque la santé atteint zéro', () => {
		const fatal = withWellbeing({
			ageBands: [
				{ fromAge: 0, maxHealth: 100, ageingChance: 1, ageingHealthLoss: 3, mortalityChance: 0 }
			]
		});
		const start = game(fatal, { health: 2 });
		const result = commit(start, fatal);
		expect(result.state.phase).toBe('ended');
		expect(result.state.end).toEqual({ turn: 0, reason: 'death', cause: 'health_failure' });
		expect(result.state.turn).toBe(1);
		expect(result.state.player.health).toBe(0);
		expect(result.log[0]?.wellbeing.deathCause).toBe('health_failure');
	});

	it('peut mourir de cause naturelle selon le risque de la tranche d’âge', () => {
		const certain = withWellbeing({
			ageBands: [
				{ fromAge: 0, maxHealth: 100, ageingChance: 0, ageingHealthLoss: 0, mortalityChance: 1 }
			]
		});
		const result = commit(game(certain), certain);
		expect(result.state.end?.cause).toBe('natural_causes');
		expect(result.state.player.health).toBeGreaterThan(0);
	});

	it('multiplie le risque lorsque la santé est fragile', () => {
		const fragile = withWellbeing({
			fragileHealthThreshold: 30,
			fragileMortalityMultiplier: 2,
			ageBands: [
				{ fromAge: 0, maxHealth: 100, ageingChance: 0, ageingHealthLoss: 0, mortalityChance: 0.5 }
			]
		});
		const deaths = (health: number): number =>
			Array.from({ length: 40 }, (_, seed) =>
				commit(game(fragile, { health }, `fragile-${seed}`), fragile)
			).filter((result) => result.state.end !== null).length;
		expect(deaths(20)).toBe(40);
		expect(deaths(80)).toBeGreaterThan(0);
		expect(deaths(80)).toBeLessThan(40);
	});

	it('refuse toute commande après la fin, sans rien modifier', () => {
		const certain = withWellbeing({
			ageBands: [
				{ fromAge: 0, maxHealth: 100, ageingChance: 0, ageingHealthLoss: 0, mortalityChance: 1 }
			]
		});
		const ended = commit(game(certain), certain).state;
		const before = JSON.stringify(ended);
		const again = transition(ended, commitTurn(plan(act('test.rest'))), certain);
		expect(again.ok).toBe(false);
		if (again.ok) return;
		expect(again.error.code).toBe('game_ended');
		expect(again.state).toBe(ended);
		expect(JSON.stringify(ended)).toBe(before);
	});

	it('produit un bilan de carrière', () => {
		const certain = withWellbeing({
			ageBands: [
				{ fromAge: 0, maxHealth: 100, ageingChance: 0, ageingHealthLoss: 0, mortalityChance: 1 }
			]
		});
		const ended = commit(game(certain), certain, plan(act('test.fixed'))).state;
		expect(careerSummary(ended)).toMatchObject({
			ended: true,
			cause: 'natural_causes',
			lastTurn: 0,
			age: 25,
			quartersPlayed: 1,
			actionsPerformed: 1,
			purchases: 0
		});
		expect(formatTurn(careerSummary(ended).lastTurn)).toBe('T1 2000');
	});
});

describe('prévision de santé', () => {
	const model = withWellbeing({
		workloadThreshold: 50,
		workloadStressPer10Points: 3,
		stressRecoveryPerTurn: 4,
		highStressThreshold: 70,
		highStressHealthLoss: 2,
		ageBands: [
			{ fromAge: 0, maxHealth: 100, ageingChance: 0.5, ageingHealthLoss: 1, mortalityChance: 0.01 }
		]
	});

	it('annonce un stress certain et une fourchette de santé exactes', () => {
		for (let seed = 0; seed < 50; seed += 1) {
			const state = game(model, { stress: 60, health: 70 }, `prévision-${seed}`);
			const turnPlan = plan(act('test.heavy'));
			const preview = previewPlan(state, turnPlan, model);
			expect(preview.wellbeing.stress).toBe(60 + 15 - 4);
			expect(preview.wellbeing.health).toEqual({ min: 67, max: 68 });
			const result = transition(state, commitTurn(turnPlan), model);
			if (!result.ok) throw new Error(result.error.message);
			expect(result.state.player.stress).toBe(preview.wellbeing.stress);
			if (result.state.end === null) {
				expect(result.state.player.health).toBeGreaterThanOrEqual(preview.wellbeing.health.min);
				expect(result.state.player.health).toBeLessThanOrEqual(preview.wellbeing.health.max);
			}
		}
	});

	it('avertit d’un stress élevé et n’expose aucune probabilité', () => {
		const preview = previewPlan(game(model, { stress: 60 }), plan(act('test.heavy')), model);
		expect(preview.valid).toBe(true);
		expect(preview.warnings.map((warning) => warning.code)).toEqual(['stress_high']);
		expect(JSON.stringify(preview)).not.toMatch(/chance|mortalit|probab/i);
	});
});

describe('invariants des jauges', () => {
	const base = createGame({ seed: 'jauges' }, fixtureContent);

	it.each<[string, GameState, string]>([
		['santé hors bornes', { ...base, player: { ...base.player, health: 101 } }, 'jauge invalide'],
		['stress négatif', { ...base, player: { ...base.player, stress: -1 } }, 'jauge invalide'],
		['stress décimal', { ...base, player: { ...base.player, stress: 1.5 } }, 'jauge invalide'],
		['vivant sans santé', { ...base, player: { ...base.player, health: 0 } }, 'santé nulle']
	])('détecte : %s', (_label, state, fragment) => {
		expect(checkInvariants(state).join('\n')).toContain(fragment);
	});
});
