import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/lib/game/content/load.ts';
import { validateContent } from '../../src/lib/game/content/validate.ts';
import { fixtureActions, fixtureBalance, fixtureUpgrades } from '../fixtures/content.ts';

type MutableAction = Record<string, unknown>;

/** Valide le catalogue de test après modification de sa première action. */
function validateWithFirstAction(change: (action: MutableAction) => void) {
	const actions = structuredClone(fixtureActions) as { actions: MutableAction[] };
	const first = actions.actions[0];
	if (!first) throw new Error('fixture vide');
	change(first);
	return validateContent({ actions, upgrades: fixtureUpgrades, balance: fixtureBalance });
}

function messages(result: ReturnType<typeof validateContent>): string {
	return result.ok ? '' : result.issues.map((issue) => `${issue.path} ${issue.message}`).join('\n');
}

describe('catalogue réel', () => {
	it('se charge et se valide', () => {
		const content = loadContent();
		expect(content.actionIds.length).toBeGreaterThan(0);
		expect(content.actionIds.every((id) => content.actions[id]?.id === id)).toBe(true);
	});

	it('propose au moins une action réalisable dès le premier trimestre', () => {
		const content = loadContent();
		const free = content.actionIds.filter((id) => !content.actions[id]?.requires);
		expect(free.length).toBeGreaterThan(0);
	});
});

describe('validation des catalogues', () => {
	it('accepte le catalogue de test et l’indexe dans l’ordre', () => {
		const result = validateContent({
			actions: fixtureActions,
			upgrades: fixtureUpgrades,
			balance: fixtureBalance
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.content.actionIds).toEqual(fixtureActions.actions.map((action) => action.id));
	});

	it.each<[string, (action: MutableAction) => void, string]>([
		['identifiant mal formé', (a) => (a.id = 'Fixed'), 'id'],
		['identifiant sans famille', (a) => (a.id = 'fixed'), 'id'],
		['identifiant en double', (a) => (a.id = 'test.random'), 'en double'],
		['libellé vide', (a) => (a.label = '  '), 'label'],
		['temps nul', (a) => (a.timeCost = 0), 'timeCost'],
		['temps décimal', (a) => (a.timeCost = 12.5), 'timeCost'],
		['temps supérieur au budget', (a) => (a.timeCost = 101), 'supérieur au budget'],
		['répétition nulle', (a) => (a.maxPerTurn = 0), 'maxPerTurn'],
		['champ inconnu', (a) => (a.script = 'alert(1)'), 'script'],
		['coût négatif', (a) => (a.costs = [{ resource: 'influence', amount: -1 }]), 'costs[0].amount'],
		[
			'coût en double',
			(a) =>
				(a.costs = [
					{ resource: 'influence', amount: 1 },
					{ resource: 'influence', amount: 2 }
				]),
			'en double'
		],
		['ressource inconnue', (a) => (a.costs = [{ resource: 'votes', amount: 1 }]), 'resource'],
		['sans effet', (a) => (a.effects = []), 'effects'],
		[
			'effet nul',
			(a) => (a.effects = [{ op: 'addResource', resource: 'influence', value: 0 }]),
			'effects[0]'
		],
		['opération inconnue', (a) => (a.effects = [{ op: 'eval', code: '1' }]), 'effects[0]'],
		[
			'fourchette inversée',
			(a) => (a.effects = [{ op: 'addResourceRandom', resource: 'influence', min: 3, max: 3 }]),
			'min'
		],
		[
			'prérequis sans explication',
			(a) => (a.requires = { op: 'gte', stat: 'resources.influence', value: 1 }),
			'unavailableReason'
		],
		[
			'statistique hors registre',
			(a) => {
				a.requires = { op: 'gte', stat: 'player.integrity', value: 1 };
				a.unavailableReason = 'Intégrité requise.';
			},
			'requires.stat'
		],
		[
			'condition composée vide',
			(a) => {
				a.requires = { op: 'all', conditions: [] };
				a.unavailableReason = 'Rien.';
			},
			'requires.conditions'
		]
	])('rejette : %s', (_label, change, fragment) => {
		const result = validateWithFirstAction(change);
		expect(result.ok).toBe(false);
		expect(messages(result)).toContain(fragment);
	});

	it('accepte des conditions imbriquées', () => {
		const result = validateWithFirstAction((action) => {
			action.requires = {
				op: 'all',
				conditions: [
					{ op: 'gte', stat: 'player.age', value: 18 },
					{ op: 'not', condition: { op: 'eq', stat: 'calendar.quarter', value: 3 } },
					{ op: 'any', conditions: [{ op: 'lte', stat: 'calendar.year', value: 2010 }] }
				]
			};
			action.unavailableReason = 'Conditions non remplies.';
		});
		expect(messages(result)).toBe('');
	});

	it('rejette un équilibrage invalide et signale tous les problèmes', () => {
		const result = validateContent({
			actions: { actions: [] },
			upgrades: { upgrades: [] },
			balance: { timeBudgetPerTurn: 0, startingResources: { influence: -1 } }
		});
		expect(result.ok).toBe(false);
		const text = messages(result);
		expect(text).toContain('timeBudgetPerTurn');
		expect(text).toContain('startingResources.influence');
		expect(text).toContain('startingResources.politicalBudgetCents');
		expect(text).toContain('actions');
	});
});

describe('validation des améliorations', () => {
	type MutableUpgrade = Record<string, unknown>;

	function validateWithFirstUpgrade(change: (upgrade: MutableUpgrade) => void) {
		const upgrades = structuredClone(fixtureUpgrades) as { upgrades: MutableUpgrade[] };
		const first = upgrades.upgrades[0];
		if (!first) throw new Error('fixture vide');
		change(first);
		return validateContent({ actions: fixtureActions, upgrades, balance: fixtureBalance });
	}

	it('indexe les améliorations dans l’ordre du catalogue', () => {
		const result = validateContent({
			actions: fixtureActions,
			upgrades: fixtureUpgrades,
			balance: fixtureBalance
		});
		expect(result.ok && result.content.upgradeIds).toEqual(
			fixtureUpgrades.upgrades.map((upgrade) => upgrade.id)
		);
	});

	it.each<[string, (upgrade: MutableUpgrade) => void, string]>([
		['identifiant partagé avec une action', (u) => (u.id = 'test.fixed'), 'en double'],
		['famille inconnue', (u) => (u.family = 'media'), 'family'],
		['trésorerie non monétaire', (u) => (u.treasury = 'influence'), 'treasury'],
		[
			'charge sur l’autre trésorerie',
			(u) => (u.upkeep = [{ resource: 'personalCashCents', amount: 100 }]),
			'trésorerie déclarée'
		],
		[
			'prix sur l’autre trésorerie',
			(u) => (u.price = [{ resource: 'personalCashCents', amount: 100 }]),
			'trésorerie déclarée'
		],
		['sans production', (u) => (u.production = []), 'production'],
		[
			'production en double',
			(u) =>
				(u.production = [
					{ resource: 'influence', amount: 1 },
					{ resource: 'influence', amount: 1 }
				]),
			'en double'
		],
		['temps négatif', (u) => (u.timeCost = -1), 'timeCost'],
		['temps supérieur au budget', (u) => (u.timeCost = 150), 'supérieur au budget'],
		['aucun exemplaire autorisé', (u) => (u.maxOwned = 0), 'maxOwned'],
		[
			'prérequis sans explication',
			(u) => (u.requires = { op: 'gte', stat: 'resources.influence', value: 1 }),
			'unavailableReason'
		]
	])('rejette : %s', (_label, change, fragment) => {
		const result = validateWithFirstUpgrade(change);
		expect(result.ok).toBe(false);
		expect(messages(result)).toContain(fragment);
	});

	it('accepte un prix en influence sur une amélioration financée par le budget', () => {
		const result = validateWithFirstUpgrade(
			(u) => (u.price = [{ resource: 'influence', amount: 2 }])
		);
		expect(messages(result)).toBe('');
	});
});

describe('catalogue réel des améliorations', () => {
	it('respecte la séparation des trésoreries et propose un premier achat accessible', () => {
		const content = loadContent();
		expect(content.upgradeIds.length).toBeGreaterThan(0);
		const firstAffordable = content.upgradeIds.filter((id) => !content.upgrades[id]?.requires);
		expect(firstAffordable.length).toBeGreaterThan(0);
	});
});
