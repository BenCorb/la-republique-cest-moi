/**
 * Contenu de test figé, indépendant du catalogue réel : les tests du moteur ne
 * dépendent pas des valeurs de tuning (ARCHITECTURE.md §6 et §11).
 */
import { validateContent } from '../../src/lib/game/content/validate.ts';
import type { Content } from '../../src/lib/game/content/types.ts';

/**
 * Modèle de santé neutre : ni charge de travail, ni vieillissement, ni mortalité,
 * pour que les tests d'actions et d'économie restent indépendants de la santé.
 * Les tests de santé utilisent `withWellbeing` pour activer chaque mécanisme.
 */
export const neutralWellbeing = {
	startingHealth: 80,
	startingStress: 10,
	workloadThreshold: 100,
	workloadStressPer10Points: 0,
	stressRecoveryPerTurn: 0,
	highStressThreshold: 100,
	highStressHealthLoss: 0,
	calmStressThreshold: 0,
	calmHealthGain: 0,
	fragileHealthThreshold: 0,
	fragileMortalityMultiplier: 1,
	ageBands: [
		{ fromAge: 0, maxHealth: 100, ageingChance: 0, ageingHealthLoss: 0, mortalityChance: 0 }
	]
};

export const fixtureBalance = {
	timeBudgetPerTurn: 100,
	startingResources: { influence: 0, politicalBudgetCents: 10_000, personalCashCents: 100_000 },
	wellbeing: neutralWellbeing
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
			id: 'test.rest',
			label: 'Repos',
			description: 'Réduit le stress.',
			timeCost: 20,
			maxPerTurn: 2,
			costs: [],
			effects: [{ op: 'addStat', stat: 'player.stress', value: -15 }]
		},
		{
			id: 'test.tonic',
			label: 'Cure',
			description: 'Améliore la santé, coûte de l’argent personnel.',
			timeCost: 10,
			maxPerTurn: 1,
			costs: [{ resource: 'personalCashCents', amount: 10_000 }],
			effects: [{ op: 'addStat', stat: 'player.health', value: 5 }]
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

export const fixtureUpgrades = {
	upgrades: [
		{
			id: 'test.volunteer',
			family: 'organization',
			label: 'Bénévole',
			description: 'Gratuit à l’achat, charge et production politiques.',
			treasury: 'politicalBudgetCents',
			timeCost: 10,
			maxOwned: 3,
			price: [],
			upkeep: [{ resource: 'politicalBudgetCents', amount: 4_000 }],
			production: [{ resource: 'influence', amount: 1 }]
		},
		{
			id: 'test.donors',
			family: 'organization',
			label: 'Donateurs',
			description: 'Prix et production sur le budget politique, sans charge.',
			treasury: 'politicalBudgetCents',
			timeCost: 20,
			maxOwned: 1,
			price: [{ resource: 'politicalBudgetCents', amount: 5_000 }],
			upkeep: [],
			production: [{ resource: 'politicalBudgetCents', amount: 3_000 }]
		},
		{
			id: 'test.club',
			family: 'network',
			label: 'Club',
			description: 'Payé sur l’argent personnel.',
			treasury: 'personalCashCents',
			timeCost: 0,
			maxOwned: 1,
			price: [{ resource: 'personalCashCents', amount: 30_000 }],
			upkeep: [{ resource: 'personalCashCents', amount: 10_000 }],
			production: [{ resource: 'influence', amount: 2 }],
			requires: { op: 'gte', stat: 'resources.influence', value: 2 },
			unavailableReason: 'Il faut au moins 2 points d’influence.'
		}
	]
};

function load(): Content {
	const result = validateContent({
		actions: fixtureActions,
		upgrades: fixtureUpgrades,
		balance: fixtureBalance
	});
	if (!result.ok) throw new Error(JSON.stringify(result.issues, null, 2));
	return result.content;
}

export const fixtureContent: Content = load();

/** Contenu de test avec un modèle de santé modifié. */
export function withWellbeing(changes: Partial<Content['balance']['wellbeing']>): Content {
	return {
		...fixtureContent,
		balance: {
			...fixtureContent.balance,
			wellbeing: { ...fixtureContent.balance.wellbeing, ...changes }
		}
	};
}
