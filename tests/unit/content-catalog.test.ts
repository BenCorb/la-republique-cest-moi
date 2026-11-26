import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/lib/game/content/load.ts';
import { validateContent } from '../../src/lib/game/content/validate.ts';
import {
	fixtureActions,
	fixtureBalance,
	fixtureCast,
	fixtureEntourage,
	fixtureEvents,
	fixtureProfiles,
	fixtureJustice,
	fixtureWealth,
	fixturePromises,
	fixtureMedia,
	fixtureInstitutions,
	fixtureEpitaphs,
	fixtureCareer,
	fixtureSupports,
	fixtureTraits,
	fixtureUpgrades,
	fixtureWorld
} from '../fixtures/content.ts';

const rest = {
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
	epitaphs: fixtureEpitaphs
};

type MutableAction = Record<string, unknown>;

/** Valide le catalogue de test après modification de sa première action. */
function validateWithFirstAction(change: (action: MutableAction) => void) {
	const actions = structuredClone(fixtureActions) as { actions: MutableAction[] };
	const first = actions.actions[0];
	if (!first) throw new Error('fixture vide');
	change(first);
	return validateContent({ actions, upgrades: fixtureUpgrades, balance: fixtureBalance, ...rest });
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
			balance: fixtureBalance,
			...rest
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
			cast: { cast: [] },
			events: {},
			world: fixtureWorld,
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
			traits: fixtureTraits,
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
		return validateContent({ actions: fixtureActions, upgrades, balance: fixtureBalance, ...rest });
	}

	it('indexe les améliorations dans l’ordre du catalogue', () => {
		const result = validateContent({
			actions: fixtureActions,
			upgrades: fixtureUpgrades,
			balance: fixtureBalance,
			...rest
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

describe('validation des événements', () => {
	type MutableEvent = Record<string, unknown>;
	type MutableChoice = Record<string, unknown>;

	/** Valide le catalogue de test après modification d'un événement (par identifiant). */
	function validateWithEvent(eventId: string, change: (event: MutableEvent) => void) {
		const events = structuredClone(fixtureEvents) as Record<string, { events: MutableEvent[] }>;
		const event = Object.values(events)
			.flatMap((file) => file.events)
			.find((candidate) => candidate.id === eventId);
		if (!event) throw new Error(`événement absent : ${eventId}`);
		change(event);
		return validateContent({
			actions: fixtureActions,
			upgrades: fixtureUpgrades,
			balance: fixtureBalance,
			cast: fixtureCast,
			events,
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
			epitaphs: fixtureEpitaphs
		});
	}

	const choicesOf = (event: MutableEvent): MutableChoice[] => event.choices as MutableChoice[];

	it('indexe événements et distribution par identifiant trié', () => {
		const result = validateContent({
			actions: fixtureActions,
			upgrades: fixtureUpgrades,
			balance: fixtureBalance,
			...rest
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.content.eventIds).toEqual([...result.content.eventIds].sort());
		expect(result.content.castIds).toEqual([...result.content.castIds].sort());
	});

	it.each<[string, string, (event: MutableEvent) => void, string]>([
		[
			'variable de texte inconnue',
			'test.stress_alert',
			(e) => (e.text = '{nurse} arrive.'),
			'{nurse}'
		],
		['accolade isolée', 'test.stress_alert', (e) => (e.title = 'Alerte {'), 'accolade'],
		[
			'variable inconnue dans un choix',
			'test.stress_alert',
			(e) => (choicesOf(e)[0]!.label = 'Appeler {lawyer}'),
			'{lawyer}'
		],
		[
			'suite inexistante',
			'test.interview',
			(e) => (choicesOf(e)[0]!.followUp = { eventId: 'test.ghost', delayTurns: 1 }),
			'suite inconnue'
		],
		[
			'suite immédiate',
			'test.interview',
			(e) => (choicesOf(e)[0]!.followUp = { eventId: 'test.article', delayTurns: 0 }),
			'delayTurns'
		],
		[
			'aucun choix de repli',
			'test.stress_alert',
			(e) => {
				for (const choice of choicesOf(e)) {
					choice.requires = { op: 'gte', stat: 'resources.influence', value: 1 };
					choice.unavailableReason = 'Influence requise.';
				}
			},
			'aucun choix de repli'
		],
		[
			'choix en double',
			'test.stress_alert',
			(e) => (choicesOf(e)[1]!.id = 'rest'),
			'choix en double'
		],
		[
			'étiquette absente de la distribution',
			'test.stress_alert',
			(e) => (e.actors = [{ role: 'doctor', tags: ['surgeon'] }]),
			'aucun membre'
		],
		[
			'rôle en double',
			'test.stress_alert',
			(e) =>
				(e.actors = [
					{ role: 'doctor', tags: ['medical'] },
					{ role: 'doctor', tags: ['medical'] }
				]),
			'rôle en double'
		],
		[
			'fenêtre inversée',
			'test.seasonal',
			(e) => {
				e.availableFromTurn = 8;
				e.availableUntilTurn = 2;
			},
			'fenêtre'
		],
		['poids nul pour un tirage', 'test.windfall', (e) => (e.weight = 0), 'poids'],
		['identifiant d’une action', 'test.windfall', (e) => (e.id = 'test.fixed'), 'en double'],
		['bloquant sans choix', 'test.seasonal', (e) => (e.choices = []), 'choices'],
		['informatif avec choix', 'test.windfall', (e) => (e.choices = []), 'choices'],

		[
			'suite jamais déclenchée',
			'test.interview',
			(e) => delete choicesOf(e)[0]!.followUp,
			'jamais déclenchée'
		]
	])('rejette : %s', (_label, eventId, change, fragment) => {
		const result = validateWithEvent(eventId, change);
		expect(result.ok).toBe(false);
		expect(messages(result)).toContain(fragment);
	});

	it.each<[string, { id: string; name: string; tags: string[]; age?: number }, string]>([
		[
			'membre en double',
			{ id: 'test.doc_a', name: 'Copie', tags: ['medical'], age: 40 },
			'identifiant en double : test.doc_a'
		],
		['identifiant mal formé', { id: 'Mauvais', name: 'X', tags: ['x'], age: 40 }, 'cast[4].id'],
		['sans étiquette', { id: 'test.nobody', name: 'Personne', tags: [], age: 40 }, 'cast[4].tags'],
		['sans âge', { id: 'test.ageless', name: 'Sans âge', tags: ['x'] }, 'cast[4].age']
	])('rejette dans la distribution : %s', (_label, member, fragment) => {
		const result = validateContent({
			actions: fixtureActions,
			upgrades: fixtureUpgrades,
			balance: fixtureBalance,
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
			cast: { cast: [...fixtureCast.cast, member] }
		});
		expect(messages(result)).toContain(fragment);
	});
});

describe('catalogue réel des événements', () => {
	it('contient au moins une suite différée et des événements bloquants', () => {
		const content = loadContent();
		const definitions = content.eventIds.map((id) => content.events[id]!);
		expect(definitions.some((event) => event.trigger === 'followUp')).toBe(true);
		expect(definitions.some((event) => event.blocking)).toBe(true);
		expect(definitions.some((event) => !event.blocking)).toBe(true);
	});
});
