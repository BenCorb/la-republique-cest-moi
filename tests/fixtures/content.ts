/**
 * Contenu de test figé, indépendant du catalogue réel : les tests du moteur ne
 * dépendent pas des valeurs de tuning (ARCHITECTURE.md §6 et §11).
 */
import { validateContent } from '../../src/lib/game/content/validate.ts';
import type { Content } from '../../src/lib/game/content/types.ts';

export const fixtureBalance = {
	timeBudgetPerTurn: 100,
	startingResources: { influence: 0, politicalBudgetCents: 10_000, personalCashCents: 100_000 }
};

export const fixtureActions = {
	actions: [
		{
			id: 'test.fixed',
			label: 'Gain fixe',
			description: 'Coûte du budget, rapporte une influence certaine.',
			timeCost: 20,
			maxPerTurn: 2,
			costs: [{ resource: 'politicalBudgetCents', amount: 1_000 }],
			effects: [{ op: 'addResource', resource: 'influence', value: 2 }]
		},
		{
			id: 'test.random',
			label: 'Gain aléatoire',
			description: 'Rapporte une influence incertaine.',
			timeCost: 10,
			maxPerTurn: 3,
			costs: [],
			effects: [{ op: 'addResourceRandom', resource: 'influence', min: 1, max: 5 }]
		},
		{
			id: 'test.gated',
			label: 'Action conditionnelle',
			description: 'Demande de l’influence.',
			timeCost: 30,
			maxPerTurn: 1,
			costs: [],
			requires: { op: 'gte', stat: 'resources.influence', value: 4 },
			unavailableReason: 'Il faut au moins 4 points d’influence.',
			effects: [{ op: 'addResource', resource: 'politicalBudgetCents', value: 500 }]
		},
		{
			id: 'test.earn',
			label: 'Revenu certain',
			description: 'Rapporte de l’argent personnel.',
			timeCost: 30,
			maxPerTurn: 1,
			costs: [],
			effects: [{ op: 'addResource', resource: 'personalCashCents', value: 50_000 }]
		},
		{
			id: 'test.spend_cash',
			label: 'Dépense personnelle',
			description: 'Transfère de l’argent personnel vers le budget.',
			timeCost: 10,
			maxPerTurn: 1,
			costs: [{ resource: 'personalCashCents', amount: 120_000 }],
			effects: [{ op: 'addResource', resource: 'politicalBudgetCents', value: 120_000 }]
		},
		{
			id: 'test.random_budget',
			label: 'Collecte incertaine',
			description: 'Rapporte un budget incertain.',
			timeCost: 10,
			maxPerTurn: 1,
			costs: [],
			effects: [{ op: 'addResourceRandom', resource: 'politicalBudgetCents', min: 0, max: 50_000 }]
		},
		{
			id: 'test.expensive',
			label: 'Dépense lourde',
			description: 'Coûte plus que le budget initial.',
			timeCost: 10,
			maxPerTurn: 1,
			costs: [{ resource: 'politicalBudgetCents', amount: 20_000 }],
			effects: [{ op: 'addResource', resource: 'influence', value: 1 }]
		},
		{
			id: 'test.heavy',
			label: 'Trimestre complet',
			description: 'Occupe tout le temps disponible.',
			timeCost: 100,
			maxPerTurn: 1,
			costs: [],
			effects: [{ op: 'addResource', resource: 'influence', value: 1 }]
		}
	]
};

function load(): Content {
	const result = validateContent({ actions: fixtureActions, balance: fixtureBalance });
	if (!result.ok) throw new Error(JSON.stringify(result.issues, null, 2));
	return result.content;
}

export const fixtureContent: Content = load();
