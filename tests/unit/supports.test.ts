import { describe, expect, it } from 'vitest';
import type { Content } from '../../src/lib/game/content/types.ts';
import { validateContent } from '../../src/lib/game/content/validate.ts';
import {
	checkInvariants,
	commitTurn,
	computePopularity,
	createGame,
	evaluateCondition,
	partyAffinity,
	previewPlan,
	readStat,
	resolveSupports,
	supportReference,
	transition,
	type GameState,
	type MandateInstance
} from '../../src/lib/game/engine/index.ts';
import { projectView } from '../../src/lib/game/app/view-model.ts';
import {
	fixtureActions,
	fixtureBalance,
	fixtureCareer,
	fixtureCast,
	fixtureEntourage,
	fixtureEvents,
	fixtureProfiles,
	fixtureJustice,
	fixtureSupports,
	fixtureTraits,
	fixtureUpgrades,
	fixtureWorld,
	quarterLog
} from '../fixtures/content.ts';

const supportActions = [
	{
		id: 'support.rally',
		label: 'Meeting ouvrier',
		description: 'Soigne les travailleurs, agace les possédants.',
		timeCost: 10,
		maxPerTurn: 1,
		costs: [],
		effects: [
			{ op: 'addSupport', group: 'support.workers', value: 90 },
			{ op: 'addSupport', group: 'support.owners', value: -5 }
		]
	},
	{
		id: 'support.gated',
		label: 'Réservé aux soutenus',
		description: 'Exige le soutien des travailleurs.',
		timeCost: 10,
		maxPerTurn: 1,
		costs: [],
		requires: { op: 'support', group: 'support.workers', cmp: 'gte', value: 50 },
		unavailableReason: 'Il faut le soutien des travailleurs.',
		effects: [{ op: 'addResource', resource: 'influence', value: 1 }]
	}
];

function load(
	overrides: { actions?: unknown[]; supports?: unknown; balance?: unknown } = {}
): ReturnType<typeof validateContent> {
	return validateContent({
		actions: { actions: [...fixtureActions.actions, ...(overrides.actions ?? supportActions)] },
		upgrades: fixtureUpgrades,
		balance: overrides.balance ?? fixtureBalance,
		cast: fixtureCast,
		events: fixtureEvents,
		world: fixtureWorld,
		traits: fixtureTraits,
		career: fixtureCareer,
		supports: overrides.supports ?? fixtureSupports,
		entourage: fixtureEntourage,
		profiles: fixtureProfiles,
		justice: fixtureJustice
	});
}

function content(balance: unknown = fixtureBalance): Content {
	const result = load({ balance });
	if (!result.ok) throw new Error(JSON.stringify(result.issues, null, 2));
	return result.content;
}

const catalog = content();

function member(state: GameState, partyId: string): GameState {
	return {
		...state,
		player: {
			...state.player,
			partyId,
			affiliations: [{ partyId, fromTurn: 0, toTurn: null }]
		}
	};
}

describe('popularité', () => {
	const game = createGame({ seed: 'popularité' }, catalog);

	it('part des soutiens initiaux et ne pondère que les groupes électoraux', () => {
		expect(game.player.supports).toEqual({
			'support.workers': 20,
			'support.owners': 40,
			'support.members': 0
		});
		// (3 × 20 + 1 × 40) / 4 = 25 : les militants ne comptent pas.
		expect(game.player.popularity).toBe(25);
		expect(computePopularity({ ...game.player.supports, 'support.members': 100 }, catalog)).toBe(
			25
		);
		expect(readStat(game, 'player.popularity')).toBe(25);
	});

	it('suit les effets des actions, bornés, et les montre dans la prévision', () => {
		const rally = { kind: 'action' as const, id: 'support.rally' };
		const preview = previewPlan(
			game,
			{ steps: [rally, { kind: 'action', id: 'support.gated' }] },
			catalog
		);
		expect(preview.valid).toBe(true);
		const result = transition(game, commitTurn({ steps: [rally] }), catalog);
		if (!result.ok) throw new Error(result.error.message);
		expect(result.state.player.supports['support.workers']).toBe(100);
		expect(result.state.player.supports['support.owners']).toBe(35);
		expect(result.state.player.popularity).toBe(Math.round((3 * 100 + 35) / 4));
		expect(quarterLog(result).steps[0]?.politics).toEqual([
			{ kind: 'support', groupId: 'support.workers', delta: 80 },
			{ kind: 'support', groupId: 'support.owners', delta: -5 }
		]);
		expect(checkInvariants(result.state, catalog)).toEqual([]);
	});

	it('expose les soutiens aux conditions', () => {
		const condition = { op: 'support', group: 'support.owners', cmp: 'gte', value: 40 } as const;
		expect(evaluateCondition(game, condition)).toBe(true);
		expect(evaluateCondition(game, { ...condition, value: 41 })).toBe(false);
		expect(evaluateCondition(game, { ...condition, cmp: 'lte', value: 39 })).toBe(false);
	});
});

describe('référence et évolution', () => {
	const moving = content({
		...fixtureBalance,
		supports: {
			reversionPercent: 50,
			partyAlignmentMax: 10,
			influencePerPoint: 10,
			notorietyMax: 20
		}
	});
	const base = createGame({ seed: 'référence' }, moving);

	it('mesure l’affinité entre le parti et les attentes du groupe', () => {
		// Gauche (-50, -40, -20) contre travailleurs (-50, 0, 0) : écart moyen 20.
		expect(partyAffinity('party.left', 'support.workers', moving)).toBeCloseTo(0.8);
		expect(partyAffinity('party.left', 'support.owners', moving)).toBeCloseTo(1 - 160 / 300);
		expect(partyAffinity(null, 'support.workers', moving)).toBe(0);
	});

	it('combine départ, affinité, adhésion, mandats et notoriété', () => {
		const affiliated = member(base, 'party.left').player;
		expect(supportReference('support.workers', base.player, [], 0, moving)).toBe(20);
		expect(supportReference('support.workers', affiliated, [], 0, moving)).toBe(28);
		expect(supportReference('support.members', affiliated, [], 0, moving)).toBe(20);
		const mandate: MandateInstance = {
			instanceId: 'term.1',
			mandateId: 'mandate.councillor',
			startTurn: 0,
			access: 'election',
			status: 'active',
			endTurn: null,
			endReason: null
		};
		// Mandat (+2) et notoriété plafonnée (influence 500 : +20 au lieu de +50).
		expect(supportReference('support.workers', base.player, [mandate], 500, moving)).toBe(42);
		// Les groupes d'influence n'ont pas de notoriété.
		expect(supportReference('support.members', base.player, [], 500, moving)).toBe(0);
	});

	it('revient en partie vers la référence à chaque frontière, sans tirage', () => {
		const affiliated = member(base, 'party.left');
		const next = resolveSupports(affiliated.player, [], 0, moving);
		expect(next.player.supports).toEqual({
			'support.workers': 24,
			'support.owners': 42,
			'support.members': 10
		});
		expect(next.player.popularity).toBe(computePopularity(next.player.supports, moving));
		expect(next.record).toEqual([
			{ groupId: 'support.workers', delta: 4 },
			{ groupId: 'support.owners', delta: 2 },
			{ groupId: 'support.members', delta: 10 }
		]);
		const result = transition(affiliated, commitTurn(), moving);
		if (!result.ok) throw new Error(result.error.message);
		expect(quarterLog(result).supports).toEqual(next.record);
		// Aucun tirage : le PRNG avance exactement comme sans retour des soutiens.
		const still = transition(affiliated, commitTurn(), catalog);
		if (!still.ok) throw new Error(still.error.message);
		expect(result.state.rng).toEqual(still.state.rng);
	});

	it('reste immobile quand le retour à la référence est nul', () => {
		const result = transition(
			member(createGame({ seed: 'immobile' }, catalog), 'party.left'),
			commitTurn(),
			catalog
		);
		if (!result.ok) throw new Error(result.error.message);
		expect(quarterLog(result).supports).toEqual([]);
	});
});

describe('projection des soutiens', () => {
	it('sépare électorat et appuis d’influence, sans rien révéler des personnages', () => {
		const game = createGame({ seed: 'projection-soutiens' }, catalog);
		const view = projectView(game, [], catalog).supports;
		expect(view.popularity).toMatchObject({ value: 25, label: 'Discrète' });
		expect(view.electoral.map((group) => [group.label, group.share, group.gauge.value])).toEqual([
			['Travailleurs', 75, 20],
			['Possédants', 25, 40]
		]);
		expect(view.influence.map((group) => [group.label, group.share])).toEqual([
			['Militants', null]
		]);
		const serialized = JSON.stringify(view);
		for (const trait of fixtureTraits.traits.filter((entry) => entry.hidden)) {
			expect(serialized).not.toContain(trait.label);
		}
	});
});

describe('validation et invariants des soutiens', () => {
	const messages = (result: ReturnType<typeof validateContent>): string =>
		result.ok ? '' : result.issues.map((issue) => `${issue.path} ${issue.message}`).join('\n');

	it('rejette un groupe inconnu et un poids incohérent', () => {
		const unknown = load({
			actions: [
				{
					...supportActions[0],
					effects: [{ op: 'addSupport', group: 'support.absent', value: 1 }]
				}
			]
		});
		expect(messages(unknown)).toContain('groupe de soutien inconnu : support.absent');
		const weightless = structuredClone(fixtureSupports);
		weightless.groups[0]!.weight = 0;
		expect(messages(load({ supports: weightless }))).toContain(
			'seuls les groupes électoraux ont un poids'
		);
	});

	it.each<[string, (state: GameState) => GameState, string]>([
		[
			'popularité incohérente',
			(state) => ({ ...state, player: { ...state.player, popularity: 99 } }),
			'popularité incohérente'
		],
		[
			'soutien hors bornes',
			(state) => ({
				...state,
				player: { ...state.player, supports: { ...state.player.supports, 'support.owners': 120 } }
			}),
			'soutien invalide'
		]
	])('détecte : %s', (_label, change, fragment) => {
		const state = change(createGame({ seed: 'invariants-soutiens' }, catalog));
		expect(checkInvariants(state, catalog).join('\n')).toContain(fragment);
	});
});
