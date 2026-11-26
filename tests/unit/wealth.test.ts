import { describe, expect, it } from 'vitest';
import type { Content } from '../../src/lib/game/content/types.ts';
import { validateContent } from '../../src/lib/game/content/validate.ts';
import {
	checkInvariants,
	commitTurn,
	createGame,
	evaluateCondition,
	netWorth,
	previewPlan,
	readStat,
	referenceExposure,
	revalueAssets,
	transition,
	type GameState,
	type PlanStep,
	type TransitionSuccess
} from '../../src/lib/game/engine/index.ts';
import { gameStateSchema } from '../../src/lib/game/persistence/state-schema.ts';
import { projectView } from '../../src/lib/game/app/view-model.ts';
import { formatMoney } from '../../src/lib/game/app/format.ts';
import {
	fixtureActions,
	fixtureBalance,
	fixtureCareer,
	fixtureCast,
	fixtureEntourage,
	fixtureEvents,
	fixtureJustice,
	fixtureProfiles,
	fixtureSupports,
	fixtureTraits,
	fixtureUpgrades,
	fixtureWealth,
	fixturePromises,
	fixtureMedia,
	fixtureWorld,
	quarterLog
} from '../fixtures/content.ts';

const asset = (overrides: Record<string, number> = {}) => ({
	annualYieldPercent: 8,
	annualGrowthPercent: 4,
	volatilityPercent: 0,
	economySensitivityPercent: 0,
	failurePerMille: 0,
	salePercent: 90,
	stressPerTurn: -2,
	...overrides
});

const flat = (overrides: Record<string, number> = {}) => ({
	id: 'test.flat',
	family: 'personal',
	label: 'Acheter un appartement',
	description: 'Un appartement de test.',
	treasury: 'personalCashCents',
	timeCost: 5,
	maxOwned: 2,
	price: [{ resource: 'personalCashCents', amount: 50_000 }],
	upkeep: [{ resource: 'personalCashCents', amount: 100 }],
	production: [],
	asset: asset(overrides)
});

const extraActions = [
	{
		id: 'test.sell',
		label: 'Vendre un bien',
		description: 'Vente.',
		timeCost: 5,
		maxPerTurn: 3,
		costs: [],
		effects: [{ op: 'releaseUpgrade' }],
		target: 'asset'
	},
	{
		id: 'test.release',
		label: 'Se séparer',
		description: 'Départ.',
		timeCost: 1,
		maxPerTurn: 3,
		costs: [],
		effects: [{ op: 'releaseUpgrade' }],
		target: 'upgrade'
	},
	{
		id: 'lifestyle.go_lavish',
		label: 'Vivre fastueusement',
		description: 'Luxe.',
		timeCost: 5,
		maxPerTurn: 1,
		costs: [],
		requires: { op: 'not', condition: { op: 'lifestyle', lifestyle: 'lifestyle.test_lavish' } },
		unavailableReason: 'Déjà fastueux.',
		effects: [{ op: 'setLifestyle', lifestyle: 'lifestyle.test_lavish' }]
	}
];

function raw(overrides: Record<string, unknown> = {}) {
	return {
		actions: { ...fixtureActions, actions: [...fixtureActions.actions, ...extraActions] },
		upgrades: { upgrades: [...fixtureUpgrades.upgrades, flat()] },
		balance: fixtureBalance,
		cast: fixtureCast,
		events: fixtureEvents,
		world: fixtureWorld,
		traits: fixtureTraits,
		career: fixtureCareer,
		supports: fixtureSupports,
		entourage: fixtureEntourage,
		profiles: fixtureProfiles,
		justice: fixtureJustice,
		wealth: fixtureWealth,
		promises: fixturePromises,
		media: fixtureMedia,
		...overrides
	};
}

function load(overrides: Record<string, unknown> = {}): Content {
	const result = validateContent(raw(overrides));
	if (!result.ok) throw new Error(JSON.stringify(result.issues));
	return result.content;
}

const content = load();
const withAsset = (overrides: Record<string, number>): Content =>
	load({ upgrades: { upgrades: [...fixtureUpgrades.upgrades, flat(overrides)] } });

function ok(state: GameState, steps: PlanStep[], catalog = content): TransitionSuccess {
	const result = transition(state, commitTurn({ steps }), catalog);
	if (!result.ok) throw new Error(`${result.error.code} : ${result.error.message}`);
	expect(checkInvariants(result.state, catalog)).toEqual([]);
	return result;
}

const buy: PlanStep = { kind: 'purchase', id: 'test.flat' };

describe('actifs patrimoniaux', () => {
	it('vaut son prix à l’achat, sans revenu ni réévaluation le premier trimestre', () => {
		const start = createGame({ seed: 'patrimoine' }, content);
		const bought = ok(start, [buy]);
		const owned = bought.state.upgrades.at(-1)!;
		expect(owned).toMatchObject({ upgradeId: 'test.flat', valueCents: 50_000 });
		expect(bought.state.resources.personalCashCents).toBe(
			start.resources.personalCashCents - 50_000
		);
		expect(quarterLog(bought).wealth).toEqual({ valueChange: 0, failed: [] });
		expect(readStat(bought.state, 'player.assets')).toBe(1);
		expect(netWorth(bought.state.resources, bought.state.upgrades)).toBe(
			start.resources.personalCashCents
		);
	});

	it('rapporte un quart du rendement annuel de sa valeur et suit sa tendance', () => {
		const bought = ok(createGame({ seed: 'patrimoine' }, content), [buy]).state;
		const next = ok(bought, []);
		// 8 % par an sur 500 € : 10 € par trimestre, moins 1 € de charges.
		expect(quarterLog(next).economy.producers).toEqual([
			{
				upgradeId: 'test.flat',
				active: 1,
				suspended: 0,
				changes: [{ resource: 'personalCashCents', delta: 900 }]
			}
		]);
		// Tendance de 4 % par an : + 1 % ce trimestre, sans aléa ni conjoncture.
		expect(next.state.upgrades.at(-1)?.valueCents).toBe(50_500);
		expect(quarterLog(next).wealth).toEqual({ valueChange: 500, failed: [] });
	});

	it('suit la conjoncture et peut tout perdre', () => {
		const state = createGame({ seed: 'conjoncture' }, content);
		const owned = [
			{ instanceId: 'upgrade.1', upgradeId: 'test.flat', acquiredTurn: 0, valueCents: 100_000 }
		];
		const sensitive = withAsset({ economySensitivityPercent: 2, annualGrowthPercent: 0 });
		const crisis = { ...state.world, indicators: { ...state.world.indicators, economy: 30 } };
		// 20 points sous la normale, 2 % par tranche de 10 points : − 4 %.
		const revalued = revalueAssets(owned, crisis, 1, state.rng, sensitive);
		expect(revalued.upgrades[0]?.valueCents).toBe(96_000);

		const ruin = withAsset({ failurePerMille: 1000 });
		const lost = revalueAssets(owned, state.world, 1, state.rng, ruin);
		expect(lost.upgrades[0]?.valueCents).toBe(0);
		expect(lost.record).toEqual({ valueChange: -100_000, failed: ['upgrade.1'] });
		// Sans valeur, ni revenu ni nouvelle réévaluation.
		expect(revalueAssets(lost.upgrades, state.world, 2, lost.rng, ruin).upgrades).toEqual(
			lost.upgrades
		);
	});

	it('reste dans des bornes avec de l’aléa, de façon reproductible', () => {
		const volatile = withAsset({ volatilityPercent: 10, annualGrowthPercent: 0 });
		const state = createGame({ seed: 'aléa' }, volatile);
		const owned = [
			{ instanceId: 'upgrade.1', upgradeId: 'test.flat', acquiredTurn: 0, valueCents: 100_000 }
		];
		const first = revalueAssets(owned, state.world, 1, state.rng, volatile);
		expect(revalueAssets(owned, state.world, 1, state.rng, volatile)).toStrictEqual(first);
		expect(first.upgrades[0]!.valueCents).toBeGreaterThanOrEqual(90_000);
		expect(first.upgrades[0]!.valueCents).toBeLessThanOrEqual(110_000);
	});

	it('se revend pour une part de sa valeur, prévue exactement dans le plan', () => {
		const bought = ok(createGame({ seed: 'vente' }, content), [buy]).state;
		const instanceId = bought.upgrades.at(-1)!.instanceId;
		const sell: PlanStep = { kind: 'action', id: 'test.sell', target: instanceId };
		const preview = previewPlan(bought, { steps: [sell] }, content);
		expect(preview.valid).toBe(true);
		expect(preview.steps[0]?.effects).toContainEqual({
			kind: 'resource',
			resource: 'personalCashCents',
			min: 45_000,
			max: 45_000
		});
		const sold = ok(bought, [sell]);
		expect(sold.state.upgrades.some((upgrade) => upgrade.instanceId === instanceId)).toBe(false);
		expect(quarterLog(sold).steps[0]?.changes).toEqual([
			{ resource: 'personalCashCents', delta: 45_000 }
		]);
	});

	it('distingue la revente d’un bien et le départ d’un élément de l’organisation', () => {
		const bought = ok(createGame({ seed: 'cibles' }, content), [
			buy,
			{ kind: 'purchase', id: 'test.volunteer' }
		]).state;
		const [, , flatId, volunteerId] = [null, null, ...bought.upgrades.map((u) => u.instanceId)];
		const issues = (step: PlanStep) =>
			previewPlan(bought, { steps: [step] }, content).issues.map((issue) => issue.code);
		expect(issues({ kind: 'action', id: 'test.sell', target: volunteerId! })).toContain(
			'invalid_target'
		);
		expect(issues({ kind: 'action', id: 'test.release', target: flatId! })).toContain(
			'invalid_target'
		);
	});

	it('survit à la sauvegarde et apparaît au patrimoine et au bilan', () => {
		const bought = ok(createGame({ seed: 'vue' }, content), [buy]).state;
		expect(gameStateSchema.parse(JSON.parse(JSON.stringify(bought)))).toStrictEqual(bought);
		const view = projectView(bought, [], content);
		expect(view.wealth.owned).toHaveLength(1);
		expect(view.wealth.owned[0]).toMatchObject({
			value: formatMoney(50_000),
			// Acheté au trimestre précédent : il rapporte dès ce trimestre (8 % par an de 500 €).
			income: formatMoney(1_000),
			proceeds: formatMoney(45_000)
		});
		expect(view.wealth.offers.map((offer) => offer.id)).toEqual(['test.flat']);
		expect(view.upgrades.map((upgrade) => upgrade.id)).not.toContain('test.flat');
		expect(view.organisation.map((group) => group.upgradeId)).not.toContain('test.flat');
		expect(view.producers.map((producer) => producer.upgradeId)).not.toContain('test.flat');
	});
});

describe('train de vie', () => {
	it('commence au plus sobre, gratuit', () => {
		const state = createGame({ seed: 'train' }, content);
		expect(state.player.lifestyle).toBe('lifestyle.test_modest');
		expect(evaluateCondition(state, { op: 'lifestyle', lifestyle: 'lifestyle.test_modest' })).toBe(
			true
		);
	});

	it('se paie dès le trimestre du changement et apaise le stress', () => {
		const state = createGame({ seed: 'luxe' }, content);
		const lavish = ok(state, [{ kind: 'action', id: 'lifestyle.go_lavish' }]);
		expect(lavish.state.player.lifestyle).toBe('lifestyle.test_lavish');
		expect(quarterLog(lavish).economy.lifestyle).toEqual({
			lifestyleId: 'lifestyle.test_lavish',
			costCents: 50_000,
			unpaid: false
		});
		expect(lavish.state.resources.personalCashCents).toBe(
			state.resources.personalCashCents - 50_000
		);
		expect(quarterLog(lavish).wellbeing.contributions).toContainEqual({
			source: 'comfort',
			gauge: 'player.stress',
			delta: -4
		});
		expect(
			previewPlan(lavish.state, { steps: [{ kind: 'action', id: 'lifestyle.go_lavish' }] }, content)
				.issues[0]?.code
		).toBe('condition_not_met');
	});

	it('revient au plus sobre, avec du stress, quand il n’est plus payé', () => {
		const state = createGame({ seed: 'faillite' }, content);
		const broke = {
			...state,
			player: { ...state.player, lifestyle: 'lifestyle.test_lavish', stress: 20 },
			resources: { ...state.resources, personalCashCents: 10_000 }
		};
		expect(previewPlan(broke, { steps: [] }, content).warnings[0]?.code).toBe('lifestyle_unpaid');
		const next = ok(broke, []);
		expect(next.state.player.lifestyle).toBe('lifestyle.test_modest');
		expect(next.state.resources.personalCashCents).toBe(10_000);
		expect(quarterLog(next).economy.lifestyle.unpaid).toBe(true);
		expect(quarterLog(next).wellbeing.contributions).toContainEqual({
			source: 'comfort',
			gauge: 'player.stress',
			delta: fixtureWealth.unpaidLifestyleStress
		});
	});

	it('se voit dans l’exposition de référence', () => {
		expect(referenceExposure([], [], content, 'lifestyle.test_lavish')).toBe(
			fixtureJustice.balance.baseExposure + 10
		);
	});
});

describe('validation du patrimoine', () => {
	const messages = (overrides: Record<string, unknown>): string[] => {
		const result = validateContent(raw(overrides));
		return result.ok ? [] : result.issues.map((issue) => issue.message);
	};

	it('exige un actif personnel, payé sur l’argent personnel', () => {
		const wrong = { ...flat(), treasury: 'politicalBudgetCents', family: 'organization' };
		expect(messages({ upgrades: { upgrades: [...fixtureUpgrades.upgrades, wrong] } })).toContain(
			'un actif est personnel et payé sur l’argent personnel'
		);
	});

	it('exige un train de vie par défaut gratuit et le plus sobre', () => {
		const wealth = { ...fixtureWealth, defaultLifestyle: 'lifestyle.test_lavish' };
		expect(messages({ wealth })).toContain(
			'le train de vie par défaut doit être le plus sobre et gratuit'
		);
	});

	it('refuse un train de vie inconnu dans un effet', () => {
		const actions = {
			...fixtureActions,
			actions: [
				...fixtureActions.actions,
				{ ...extraActions[2], effects: [{ op: 'setLifestyle', lifestyle: 'lifestyle.nope' }] }
			]
		};
		expect(messages({ actions })).toContain('train de vie inconnu : lifestyle.nope');
	});
});
