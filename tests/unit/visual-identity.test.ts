import { describe, expect, it } from 'vitest';
import {
	CATEGORY_IDENTITY,
	RESOURCE_IDENTITY,
	SUPPORT_IDENTITY,
	categoryIdentity,
	identityOf
} from '../../src/lib/components/common/identity.ts';
import { loadContentFromFiles } from '../../src/lib/game/content/load-node.ts';
import {
	describeHealth,
	describeJudicialRisk,
	describeStress,
	formatCompactRange
} from '../../src/lib/game/app/format.ts';
import { projectView } from '../../src/lib/game/app/view-model.ts';
import { GAUGE_IDS, RESOURCE_IDS } from '../../src/lib/game/content/types.ts';
import { createGame } from '../../src/lib/game/engine/index.ts';
import { fixtureContent } from '../fixtures/content.ts';

/** Direction visuelle (P3-26) : table d'identité, paliers et pastilles de la vue. */
describe('table d’identité', () => {
	const content = loadContentFromFiles();

	it('couvre chaque ressource, jauge, groupe de soutien et thème du catalogue réel', () => {
		for (const id of RESOURCE_IDS) expect(identityOf(id)).not.toBeNull();
		for (const id of GAUGE_IDS) expect(identityOf(id)).not.toBeNull();
		for (const id of content.supportGroupIds) expect(SUPPORT_IDENTITY[id]).toBeDefined();
		for (const category of content.actionCategories)
			expect(CATEGORY_IDENTITY[category.id]).toBeDefined();
	});

	it('attribue une icône distincte à chaque ressource et jauge', () => {
		const icons = Object.values(RESOURCE_IDENTITY).map((identity) => identity.icon);
		expect(new Set(icons).size).toBe(icons.length);
	});

	it('se replie sans erreur sur un identifiant inconnu', () => {
		expect(identityOf('support.inconnu')).toBeNull();
		expect(identityOf(null)).toBeNull();
		expect(categoryIdentity('inconnue').label).toBe('Autres actions');
	});
});

describe('paliers des jauges', () => {
	it('expose les seuils publics sans changer les mots', () => {
		expect(describeHealth(74)).toMatchObject({ label: 'Correcte', tone: 'neutral' });
		expect(describeHealth(75).label).toBe('Bonne');
		expect(describeStress(29).label).toBe('Serein');
		expect(describeStress(70).label).toBe('Épuisé');
		expect(describeJudicialRisk(0).label).toBe('Nul');
		expect(describeJudicialRisk(1).label).toBe('Faible');
		expect(describeHealth(10).tiers.map((tier) => tier.from)).toEqual([0, 25, 50, 75]);
	});
});

/** Les montants `fr-FR` utilisent une espace insécable avant « € ». */
const plain = (text: string): string => text.replace(/\s/g, ' ');

describe('format compact des pastilles', () => {
	it('écrit signe, fourchette et unité', () => {
		expect(formatCompactRange('influence', 3, 3)).toBe('+3');
		expect(formatCompactRange('influence', 1, 3)).toBe('+1–3');
		expect(formatCompactRange('influence', -3, -1)).toBe('−1–3');
		expect(formatCompactRange('influence', -2, 3)).toBe('−2 à +3');
		expect(plain(formatCompactRange('politicalBudgetCents', -2000, -2000))).toBe('−20 €');
		expect(plain(formatCompactRange('politicalBudgetCents', 20000, 40000))).toBe('+200–400 €');
		expect(formatCompactRange(null, 0, 0)).toBe('0');
	});
});

describe('pastilles de la vue', () => {
	const state = createGame({ seed: 'p3-26' }, fixtureContent);
	const view = projectView(state, [], fixtureContent);
	const action = (id: string) => view.actions.find((item) => item.id === id)!;

	it('donne le sens du point de vue du joueur', () => {
		const [cost] = action('test.fixed').costChips;
		expect(cost).toMatchObject({ identity: 'politicalBudgetCents', sense: 'cost' });
		expect(plain(cost!.value)).toBe('−10 €');
		// Une baisse du stress est un gain.
		expect(action('test.rest').effectChips[0]).toMatchObject({
			identity: 'player.stress',
			sense: 'gain',
			value: '−15'
		});
		expect(action('test.random').effectChips[0]).toMatchObject({ variable: true, value: '+1–5' });
	});

	it('garde la phrase complète de chaque coût et effet', () => {
		for (const item of view.actions) {
			expect(item.costChips.map((chip) => chip.text)).toEqual(item.costs);
			expect(item.effectChips.map((chip) => chip.text)).toEqual(item.effects);
		}
	});

	it('annonce le sens des variations prévues des ressources', () => {
		expect(view.resources.map((resource) => resource.trend)).toEqual([0, 0, 0]);
		const planned = projectView(state, [{ kind: 'action', id: 'test.fixed' }], fixtureContent);
		expect(planned.resources.find((r) => r.id === 'influence')!.trend).toBe(1);
		expect(planned.resources.find((r) => r.id === 'politicalBudgetCents')!.trend).toBe(-1);
		expect(planned.plan.steps[0]!.chips.map((chip) => chip.sense)).toEqual(['cost', 'gain']);
	});
});
