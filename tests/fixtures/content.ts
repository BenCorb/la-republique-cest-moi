/**
 * Contenu de test figé, indépendant du catalogue réel : les tests du moteur ne
 * dépendent pas des valeurs de tuning (ARCHITECTURE.md §6 et §11).
 */
import { validateContent } from '../../src/lib/game/content/validate.ts';
import type { Content, EventsBalance } from '../../src/lib/game/content/types.ts';
import type {
	HistoryEntry,
	JournalEntry,
	TransitionSuccess
} from '../../src/lib/game/engine/index.ts';

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
	wellbeing: neutralWellbeing,
	// Aucun tirage ordinaire par défaut : les tests d'événements l'activent (`withEvents`).
	events: { ordinaryDrawsPerTurn: 0, ordinaryEventChance: 0 }
};

export const fixtureCast = {
	cast: [
		{ id: 'test.doc_a', name: 'Docteure A', tags: ['medical'] },
		{ id: 'test.doc_b', name: 'Docteur B', tags: ['medical'] },
		{ id: 'test.reporter', name: 'Reporter', tags: ['journalist'] },
		{ id: 'test.cousin', name: 'Cousin', tags: ['family'] }
	]
};

export const fixtureEvents = {
	'events/test.json': {
		events: [
			{
				id: 'test.stress_alert',
				category: 'personal',
				title: 'Alerte',
				text: '{doctor} s’inquiète.',
				blocking: true,
				trigger: 'random',
				weight: 5,
				priority: 20,
				cooldownTurns: 4,
				unique: false,
				when: { op: 'gte', stat: 'player.stress', value: 50 },
				actors: [{ role: 'doctor', tags: ['medical'] }],
				choices: [
					{
						id: 'rest',
						label: 'Écouter {doctor}',
						hints: ['Moins de stress'],
						costs: [],
						effects: [
							{ op: 'addStat', stat: 'player.stress', value: -20 },
							{ op: 'addResource', resource: 'influence', value: -1 }
						]
					},
					{
						id: 'ignore',
						label: 'Ignorer',
						hints: ['Stress en hausse'],
						costs: [],
						effects: [{ op: 'addStat', stat: 'player.stress', value: 5 }]
					}
				]
			},
			{
				id: 'test.interview',
				category: 'press',
				title: 'Entretien',
				text: '{journalist} demande un entretien.',
				blocking: true,
				trigger: 'random',
				weight: 5,
				priority: 10,
				cooldownTurns: 0,
				unique: true,
				when: { op: 'gte', stat: 'resources.influence', value: 3 },
				actors: [{ role: 'journalist', tags: ['journalist'] }],
				choices: [
					{
						id: 'accept',
						label: 'Accepter',
						hints: ['Visibilité à venir'],
						costs: [],
						effects: [],
						followUp: { eventId: 'test.article', delayTurns: 2 }
					},
					{
						id: 'pay',
						label: 'Payer un encart',
						hints: ['Visibilité immédiate'],
						costs: [{ resource: 'politicalBudgetCents', amount: 5_000 }],
						effects: [{ op: 'addResource', resource: 'influence', value: 2 }]
					},
					{
						id: 'gated',
						label: 'Option réservée',
						hints: [],
						costs: [],
						requires: { op: 'gte', stat: 'resources.influence', value: 50 },
						unavailableReason: 'Il faut 50 points d’influence.',
						effects: []
					},
					{ id: 'decline', label: 'Décliner', hints: [], costs: [], effects: [] }
				]
			},
			{
				id: 'test.article',
				category: 'press',
				title: 'Article',
				text: 'L’article de {journalist} paraît.',
				blocking: false,
				trigger: 'followUp',
				weight: 0,
				priority: 0,
				cooldownTurns: 0,
				unique: false,
				when: { op: 'gte', stat: 'resources.influence', value: 1 },
				actors: [{ role: 'journalist', tags: ['journalist'] }],
				effects: [{ op: 'addResource', resource: 'influence', value: 3 }]
			},
			{
				id: 'test.windfall',
				category: 'personal',
				title: 'Aubaine',
				text: '{relative} vous fait un cadeau.',
				blocking: false,
				trigger: 'random',
				weight: 1,
				priority: 0,
				cooldownTurns: 0,
				unique: true,
				actors: [{ role: 'relative', tags: ['family'] }],
				effects: [{ op: 'addResource', resource: 'personalCashCents', value: 1_000 }]
			},
			{
				id: 'test.fine',
				category: 'personal',
				title: 'Amende',
				text: 'Une amende très salée.',
				blocking: false,
				trigger: 'random',
				weight: 1,
				priority: 0,
				cooldownTurns: 2,
				unique: false,
				actors: [],
				effects: [{ op: 'addResource', resource: 'politicalBudgetCents', value: -999_999 }]
			},
			{
				id: 'test.accident',
				category: 'personal',
				title: 'Accident',
				text: 'Un accident grave.',
				blocking: false,
				trigger: 'random',
				weight: 1,
				priority: 0,
				cooldownTurns: 0,
				unique: false,
				actors: [],
				effects: [{ op: 'addStat', stat: 'player.health', value: -100 }]
			},
			{
				id: 'test.seasonal',
				category: 'world',
				title: 'Saison',
				text: 'Un événement de saison.',
				blocking: true,
				trigger: 'random',
				weight: 1,
				priority: 0,
				availableFromTurn: 4,
				availableUntilTurn: 5,
				cooldownTurns: 0,
				unique: false,
				actors: [],
				choices: [{ id: 'ok', label: 'D’accord', hints: [], costs: [], effects: [] }]
			}
		]
	}
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
		balance: fixtureBalance,
		cast: fixtureCast,
		events: fixtureEvents
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

/**
 * Contenu de test dont seuls les événements listés peuvent être tirés, avec les
 * paramètres de tirage donnés (par défaut : un tirage certain par trimestre).
 */
export function withEvents(
	eventIds: readonly string[],
	events: EventsBalance = { ordinaryDrawsPerTurn: 1, ordinaryEventChance: 1 },
	base: Content = fixtureContent
): Content {
	return {
		...base,
		eventIds: base.eventIds.filter(
			(id) => eventIds.includes(id) || base.events[id]?.trigger === 'followUp'
		),
		balance: { ...base.balance, events }
	};
}

/** Entrée de trimestre d'une transition `commitTurn`. */
export function quarterLog(result: TransitionSuccess): HistoryEntry {
	const [entry] = result.log;
	if (!entry || entry.type !== 'turn.resolved') throw new Error('entrée de trimestre attendue');
	return entry;
}

/** Trimestres résolus d'un journal. */
export function quarters(history: readonly JournalEntry[]): HistoryEntry[] {
	return history.filter((entry): entry is HistoryEntry => entry.type === 'turn.resolved');
}
