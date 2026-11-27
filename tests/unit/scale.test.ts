import { describe, expect, it } from 'vitest';
import type { Content } from '../../src/lib/game/content/types.ts';
import { validateContent, type RawContent } from '../../src/lib/game/content/validate.ts';
import {
	checkInvariants,
	chooseEventCommand,
	commitTurn,
	createGame,
	previewPlan,
	transition,
	type GameState,
	type PlanStep,
	type TransitionSuccess
} from '../../src/lib/game/engine/index.ts';
import { loadContentFromFiles } from '../../src/lib/game/content/load-node.ts';
import { gameStateSchema } from '../../src/lib/game/persistence/state-schema.ts';
import { projectView } from '../../src/lib/game/app/view-model.ts';
import {
	fixtureActions,
	fixtureBalance,
	fixtureCareer,
	fixtureCast,
	fixtureEntourage,
	fixtureEpitaphs,
	fixtureEvents,
	fixtureInstitutions,
	fixtureJustice,
	fixtureMedia,
	fixtureProfiles,
	fixturePromises,
	fixtureSupports,
	fixtureTraits,
	fixtureUpgrades,
	fixtureWealth,
	fixtureWorld,
	quarterLog
} from '../fixtures/content.ts';

const cash = (amount: number) => [{ resource: 'personalCashCents', amount }];
const budget = (value: number) => ({ op: 'addResource', resource: 'politicalBudgetCents', value });
const activists = (value: number) => ({ op: 'gte', stat: 'player.activists', value });

/** Famille de dons et famille d'avances de test (P3-23). */
const scaleActions = [
	{
		id: 'campaign.declare',
		label: 'Se présenter',
		description: 'Déposer sa candidature.',
		timeCost: 10,
		maxPerTurn: 1,
		costs: [],
		effects: [{ op: 'declareCandidacy' }],
		target: 'ballot'
	},
	{
		id: 'test.donate',
		label: 'Don modeste',
		description: 'Petit don.',
		timeCost: 5,
		maxPerTurn: 1,
		costs: cash(50_000),
		effects: [budget(50_000)],
		scale: { family: 'family.test_donation', format: 'modest' }
	},
	{
		id: 'test.donate_sustained',
		label: 'Don soutenu',
		description: 'Don moyen.',
		timeCost: 5,
		maxPerTurn: 1,
		costs: cash(300_000),
		requires: activists(25),
		unavailableReason: 'Il faut un comité local.',
		effects: [budget(300_000), { op: 'addSupport', group: 'support.members', value: 1 }],
		scale: { family: 'family.test_donation', format: 'sustained' }
	},
	{
		id: 'test.donate_major',
		label: 'Don majeur',
		description: 'Gros don.',
		timeCost: 10,
		maxPerTurn: 1,
		costs: cash(1_500_000),
		requires: activists(100),
		unavailableReason: 'Il faut une section implantée.',
		effects: [budget(1_500_000), { op: 'addSupport', group: 'support.members', value: 2 }],
		scale: { family: 'family.test_donation', format: 'major' }
	},
	...(
		[
			['modest', 100_000, undefined],
			['sustained', 400_000, activists(25)],
			['major', 900_000, activists(100)]
		] as const
	).map(([format, amount, requires]) => ({
		id: `test.advance_${format}`,
		label: `Avance ${format}`,
		description: 'Avance de campagne.',
		timeCost: 5,
		maxPerTurn: 1,
		costs: cash(amount),
		...(requires ? { requires, unavailableReason: 'Capacité insuffisante.' } : {}),
		effects: [budget(amount), { op: 'advanceCampaign', valueCents: amount }],
		scale: { family: 'family.test_advance', format },
		target: 'campaign'
	}))
];

const families = [
	{
		id: 'family.test_donation',
		label: 'Verser un don',
		description: 'Dons de test.',
		annualCap: { resource: 'personalCashCents', amount: 2_000_000 }
	},
	{ id: 'family.test_advance', label: 'Avancer des fonds', description: 'Avances de test.' }
];

function raw(overrides: Partial<RawContent> = {}): RawContent {
	return {
		actions: { actions: [...fixtureActions.actions, ...scaleActions], families },
		upgrades: fixtureUpgrades,
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
		institutions: fixtureInstitutions,
		epitaphs: fixtureEpitaphs,
		...overrides
	};
}

function load(overrides: Partial<RawContent> = {}): Content {
	const result = validateContent(raw(overrides));
	if (!result.ok) throw new Error(JSON.stringify(result.issues, null, 2));
	return result.content;
}

const catalog = load();
const step = (id: string, target?: string): PlanStep =>
	target === undefined ? { kind: 'action', id } : { kind: 'action', id, target };

function commit(state: GameState, steps: PlanStep[] = [], used = catalog): TransitionSuccess {
	const result = transition(state, commitTurn({ steps }), used);
	if (!result.ok) throw new Error(`${result.error.message} ${JSON.stringify(result.error.issues)}`);
	expect(checkInvariants(result.state, used)).toEqual([]);
	return result;
}

/** Joueur fortuné, avec une base militante donnée. */
function rich(base: number, used = catalog): GameState {
	const state = createGame({ seed: 'echelle' }, used);
	return {
		...state,
		resources: { ...state.resources, personalCashCents: 10_000_000 },
		player: { ...state.player, activists: base }
	};
}

function advanceTo(state: GameState, turn: number, used = catalog): GameState {
	let current = state;
	while (current.turn < turn) {
		if (current.phase === 'decision') {
			const instance = current.events.pending[0]!;
			const event = used.events[instance.eventId];
			const choice = event && 'choices' in event ? (event.choices[0]?.id ?? 'ok') : 'ok';
			const chosen = transition(current, chooseEventCommand(instance.instanceId, choice), used);
			if (!chosen.ok) throw new Error(chosen.error.message);
			current = chosen.state;
			continue;
		}
		current = commit(current, [], used).state;
	}
	return current;
}

describe('formats d’une famille d’actions (P3-23)', () => {
	it('présente une seule ligne d’agenda et ses trois formats, les supérieurs selon la capacité', () => {
		const view = projectView(rich(0), [], catalog);
		const rows = view.actionGroups.flatMap((group) => [...group.actions, ...group.outOfReach]);
		expect(rows.filter((row) => row.id.startsWith('test.donate')).map((row) => row.id)).toEqual([
			'test.donate'
		]);
		const row = rows.find((entry) => entry.id === 'test.donate')!;
		expect(row.label).toBe('Verser un don');
		expect(row.formats?.map((format) => [format.format, format.addable])).toEqual([
			['Modeste', true],
			['Soutenu', false],
			['Majeur', false]
		]);
		expect(row.formats?.[2]?.reason).toBe('Il faut une section implantée.');
		expect(row.formats?.[2]?.outOfReach).toBe(true);
		expect(row.familyNote).toMatch(
			/^Plafond annuel : 20\s000\s€ \(0\s€ déjà versés cette année\)$/
		);

		const organised = projectView(rich(120), [], catalog);
		const unlocked = organised.actionGroups
			.flatMap((group) => group.actions)
			.find((entry) => entry.id === 'test.donate')!;
		expect(unlocked.formats?.every((format) => format.addable)).toBe(true);
	});

	it('n’admet qu’un format par trimestre et applique les effets du format choisi', () => {
		const state = rich(120);
		const twice = previewPlan(
			state,
			{ steps: [step('test.donate'), step('test.donate_sustained')] },
			catalog
		);
		expect(twice.steps[1]?.issues[0]?.message).toMatch(/un seul format par trimestre/);
		const result = commit(state, [step('test.donate_sustained')]);
		expect(result.state.resources.personalCashCents).toBe(10_000_000 - 300_000);
		expect(result.state.resources.politicalBudgetCents).toBeGreaterThanOrEqual(
			state.resources.politicalBudgetCents + 300_000 - 100_000
		);
		expect(quarterLog(result).steps[0]?.id).toBe('test.donate_sustained');
	});

	it('plafonne la dépense de l’année civile, tous formats confondus, puis la remet à zéro', () => {
		// 15 000 € puis 3 000 € : le plafond de 20 000 € laisse encore un don modeste cette année.
		const first = commit(rich(400), [step('test.donate_major')]).state;
		const second = commit(first, [step('test.donate_sustained')]).state;
		const capped = previewPlan(second, { steps: [step('test.donate_sustained')] }, catalog);
		expect(capped.issues[0]?.code).toBe('annual_cap');
		expect(capped.issues[0]?.message).toMatch(
			/plafond annuel de 20\s000 €.*18\s000 € déjà engagés/
		);
		const third = commit(second, [step('test.donate')]).state;
		expect(
			projectView(third, [], catalog)
				.actionGroups.flatMap((group) => group.actions)
				.find((row) => row.id === 'test.donate')?.familyNote
		).toMatch(/18\s500\s€ déjà versés/);
		// Année suivante : le plafond se reconstitue.
		const nextYear = advanceTo(third, 4);
		expect(nextYear.turn).toBe(4);
		expect(previewPlan(nextYear, { steps: [step('test.donate_sustained')] }, catalog).valid).toBe(
			true
		);
	});
});

describe('avance de campagne (P3-23)', () => {
	/** Candidat déclaré au scrutin local du T40. */
	function candidate(used = catalog): GameState {
		const declared = commit(rich(60, used), [step('campaign.declare', 'ballot.1')], used).state;
		expect(declared.campaigns[0]?.status).toBe('running');
		return declared;
	}

	it('verse l’avance à la campagne choisie, une seule fois, selon la capacité', () => {
		const state = candidate();
		expect(
			previewPlan(state, { steps: [step('test.advance_major', 'campaign.1')] }, catalog).issues[0]
				?.message
		).toBe('Capacité insuffisante.');
		expect(
			previewPlan(state, { steps: [step('test.advance_modest', 'campaign.9')] }, catalog).issues[0]
				?.message
		).toMatch(/candidature en cours/);
		const result = commit(state, [step('test.advance_sustained', 'campaign.1')]);
		expect(result.state.campaigns[0]?.advanceCents).toBe(400_000);
		expect(result.state.resources.personalCashCents).toBe(
			state.resources.personalCashCents - 400_000
		);
		expect(quarterLog(result).steps[0]?.politics).toContainEqual({
			kind: 'campaignAdvance',
			campaignId: 'campaign.1',
			cents: 400_000
		});
		expect(
			previewPlan(result.state, { steps: [step('test.advance_modest', 'campaign.1')] }, catalog)
				.issues[0]?.message
		).toMatch(/une seule avance par campagne/);
		const view = projectView(result.state, [], catalog);
		expect(JSON.stringify(view.career)).toMatch(
			/Avance personnelle : 4\s000\s€, rendue à partir de 10 %/
		);
		const restored = gameStateSchema.parse(JSON.parse(JSON.stringify(result.state)));
		expect(restored).toStrictEqual(result.state);
	});

	it('rend l’avance après le scrutin à partir du score minimal, la perd en dessous', () => {
		const advanced = commit(candidate(), [step('test.advance_modest', 'campaign.1')]).state;
		const before = advanceTo(advanced, 40);
		const held = commit(before);
		const campaign = held.state.campaigns[0]!;
		expect(campaign.status === 'won' || campaign.status === 'lost').toBe(true);
		expect(campaign.playerPercent).toBeGreaterThanOrEqual(10);
		expect(quarterLog(held).deadlines?.campaigns[0]?.advance).toEqual({
			cents: 100_000,
			repaid: true
		});
		const journal = JSON.stringify(projectView(held.state, [], catalog).journal);
		expect(journal).toContain('Avance de campagne rendue');

		// Seuil inatteignable : l'avance est perdue.
		const strict: Content = {
			...catalog,
			balance: {
				...catalog.balance,
				campaigns: { ...catalog.balance.campaigns, advanceRepayMinPercent: 100 }
			}
		};
		const lost = commit(advanceTo(advanced, 40, strict), [], strict);
		expect(quarterLog(lost).deadlines?.campaigns[0]?.advance).toEqual({
			cents: 100_000,
			repaid: false
		});
		const gain = lost.state.resources.personalCashCents - held.state.resources.personalCashCents;
		expect(gain).toBe(-100_000);
	});
});

describe('validation des familles (P3-23)', () => {
	const issues = (actions: unknown[], list: unknown[] = families): string[] => {
		const result = validateContent(
			raw({ actions: { actions: [...fixtureActions.actions, ...actions], families: list } })
		);
		return result.ok ? [] : result.issues.map((issue) => issue.message);
	};

	it('exige trois formats, un coût croissant, des prérequis et une avance égale à son coût', () => {
		const [declare, modest, sustained, major, ...advances] = scaleActions;
		expect(issues([declare, modest, sustained, ...advances]).join(' ')).toMatch(
			/exactement un format modeste, un soutenu et un majeur/
		);
		expect(
			issues([declare, modest, { ...sustained, costs: cash(2_000_000) }, major, ...advances]).join(
				' '
			)
		).toMatch(/coût des formats croît strictement/);
		const tightCap = [
			{ ...families[0]!, annualCap: { resource: 'personalCashCents', amount: 1_000_000 } },
			families[1]!
		];
		expect(issues([declare, modest, sustained, major, ...advances], tightCap).join(' ')).toMatch(
			/dépasse à lui seul le plafond annuel/
		);
		const open = Object.fromEntries(
			Object.entries(major!).filter(([key]) => key !== 'requires' && key !== 'unavailableReason')
		);
		expect(issues([declare, modest, sustained, open, ...advances]).join(' ')).toMatch(
			/exigent un prérequis de capacité/
		);
		const [advance, ...others] = advances;
		expect(
			issues([
				declare,
				modest,
				sustained,
				major,
				{ ...advance, effects: [budget(100_000), { op: 'advanceCampaign', valueCents: 1 }] },
				...others
			]).join(' ')
		).toMatch(/verse exactement son coût/);
		expect(
			issues([declare, { ...modest, scale: { family: 'family.unknown', format: 'modest' } }])
		).toContain('famille inconnue : family.unknown');
	});
});

describe('catalogue réel (P3-23)', () => {
	it('décline le don personnel et l’avance de campagne en trois formats, aux rendements décroissants', () => {
		const content = loadContentFromFiles();
		expect(content.actionFamilyIds).toEqual(['family.donation', 'family.campaign_advance']);
		const donation = ['personal.donate', 'personal.donate_sustained', 'personal.donate_major'].map(
			(id) => content.actions[id]!
		);
		expect(donation.map((action) => action.costs[0]?.amount)).toEqual([50_000, 300_000, 1_500_000]);
		expect(content.actionFamilies['family.donation']?.annualCap).toEqual({
			resource: 'personalCashCents',
			amount: 3_000_000
		});
		// Soutien de l'appareil par millier d'euros : décroissant d'un format au suivant.
		const apparatus = donation.map((action) => {
			const support = action.effects.find(
				(effect) => effect.op === 'addSupport' && effect.group === 'support.apparatus'
			);
			const value = support?.op === 'addSupport' ? support.value : 0;
			return value / (action.costs[0]!.amount / 100_000);
		});
		expect(apparatus[1]!).toBeGreaterThan(apparatus[2]!);
		// Temps par euro transféré : les grands formats en économisent.
		const timePerEuro = donation.map((action) => action.timeCost / action.costs[0]!.amount);
		expect(timePerEuro[0]!).toBeGreaterThan(timePerEuro[1]!);
		expect(timePerEuro[1]!).toBeGreaterThan(timePerEuro[2]!);
	});
});
