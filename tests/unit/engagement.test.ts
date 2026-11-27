import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/lib/game/content/load.ts';
import { creationOptions, projectView } from '../../src/lib/game/app/view-model.ts';
import {
	checkInvariants,
	commitTurn,
	createGame,
	transition
} from '../../src/lib/game/engine/index.ts';

/** Terrain d'engagement (P3-17, PT-P3-09-001) sur le catalogue réel. */
const content = loadContent();

const TERRAINS = [
	'engagement.union',
	'engagement.association',
	'engagement.student',
	'engagement.public_service',
	'engagement.business',
	'engagement.press'
];

/** Actions ouvertes par un terrain. */
function ownActions(engagement: string): string[] {
	return content.actionIds.filter((id) => {
		const requires = content.actions[id]?.requires;
		return requires?.op === 'engagement' && requires.engagement === engagement;
	});
}

describe('terrain d’engagement', () => {
	it('propose six terrains, la vie associative par défaut, sans profession résiduelle', () => {
		expect(content.engagementIds).toEqual(TERRAINS);
		expect(content.defaultProfile.engagement).toBe('engagement.association');
		expect(content.actionIds.some((id) => id.startsWith('profession.'))).toBe(false);
	});

	it.each(TERRAINS)('%s : une activité rémunérée modeste et une action d’engagement', (id) => {
		const actions = ownActions(id).map((actionId) => content.actions[actionId]!);
		expect(actions).toHaveLength(2);
		const paid = actions.filter((action) =>
			action.effects.some(
				(effect) =>
					(effect.op === 'addResource' || effect.op === 'addResourceRandom') &&
					effect.resource === 'personalCashCents'
			)
		);
		expect(paid).toHaveLength(1);
		// Revenus modestes : au plus 1 800 € par trimestre et par action.
		for (const effect of paid[0]!.effects) {
			if (effect.op === 'addResource' && effect.resource === 'personalCashCents')
				expect(effect.value).toBeLessThanOrEqual(180_000);
			if (effect.op === 'addResourceRandom') expect(effect.max).toBeLessThanOrEqual(180_000);
		}
		for (const action of actions) {
			expect(action.category).toBe('work');
			expect(action.unavailableReason).toMatch(/^Réservé à qui vient /u);
		}
	});

	it('applique les effets de départ propres à chaque terrain', () => {
		const base = createGame({ seed: 'terrain', engagement: 'engagement.association' }, content);
		const union = createGame({ seed: 'terrain', engagement: 'engagement.union' }, content);
		const business = createGame({ seed: 'terrain', engagement: 'engagement.business' }, content);
		const press = createGame({ seed: 'terrain', engagement: 'engagement.press' }, content);
		expect(union.player.engagement).toBe('engagement.union');
		expect(union.player.supports['support.working_class']).toBeGreaterThan(
			base.player.supports['support.working_class']!
		);
		expect(business.resources.personalCashCents).toBeGreaterThan(base.resources.personalCashCents);
		expect(press.player.exposure).toBeGreaterThan(base.player.exposure);
		for (const state of [base, union, business, press])
			expect(checkInvariants(state, content)).toEqual([]);
	});

	it('n’ouvre que les actions de son propre terrain, jouables dès le premier trimestre', () => {
		for (const terrain of TERRAINS) {
			const state = createGame({ seed: `actions-${terrain}`, engagement: terrain }, content);
			const work = projectView(state, [], content).actionGroups.find(
				(group) => group.id === 'work'
			)!;
			const reachable = work.actions.map((action) => action.id);
			expect(reachable).toEqual(expect.arrayContaining(ownActions(terrain)));
			for (const other of TERRAINS.filter((id) => id !== terrain))
				for (const action of ownActions(other)) expect(reachable).not.toContain(action);

			const steps = ownActions(terrain).map((id) => ({ kind: 'action' as const, id }));
			const result = transition(state, commitTurn({ steps }), content);
			if (!result.ok) throw new Error(result.error.message);
			expect(checkInvariants(result.state, content)).toEqual([]);
		}
	});

	it('présente à la création les effets et les actions propres de chaque terrain', () => {
		const options = creationOptions(content);
		expect(options.engagements.map((option) => option.id)).toEqual(TERRAINS);
		const union = options.engagements.find((option) => option.id === 'engagement.union')!;
		expect(union.label).toBe('Syndicalisme');
		expect(union.effects.length).toBeGreaterThan(0);
		expect(union.actions).toEqual([
			'Faire ses heures à l’atelier',
			'Tenir la permanence syndicale'
		]);
		expect(options.origins.every((option) => option.actions.length === 0)).toBe(true);
		const state = createGame({ seed: 'profil', engagement: 'engagement.student' }, content);
		expect(projectView(state, [], content).profile.engagement).toBe('Militantisme étudiant');
	});
});
