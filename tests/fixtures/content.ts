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
	events: { ordinaryDrawsPerTurn: 0, ordinaryEventChance: 0 },
	// Monde immobile par défaut : les tests du monde l'activent (`withWorld`).
	world: neutralWorld(),
	// Personnages immobiles par défaut : ni retraite, ni révélation fortuite.
	characters: {
		traitsPerCharacter: 2,
		retirementAge: 150,
		replacementMinAge: 30,
		replacementMaxAge: 40,
		revealChancePerEncounter: 0,
		maxMemories: 3
	},
	// Scrutins sans aléa par défaut : le parti le plus fort l'emporte.
	elections: { voteVolatility: 0, momentum: 1, newGovernmentStability: 60, alertLeadTurns: 2 },
	// Soutiens immobiles par défaut : les tests de soutiens activent le retour à la référence.
	supports: { reversionPercent: 0, partyAlignmentMax: 10, influencePerPoint: 10, notorietyMax: 20 },
	// Scrutin du joueur sans aléa par défaut ; préparation passive et stress de campagne nuls.
	campaigns: {
		popularityWeightPercent: 50,
		partyWeightPercent: 50,
		preparationWeightPercent: 100,
		preparationCap: 20,
		incumbentBonus: 5,
		volatility: 0,
		passivePreparation: 0,
		stressPerTurn: 0,
		investitureMinApparatus: 10,
		apparatusGroup: 'support.members',
		victoryInfluence: 5,
		defeatInfluence: 1,
		defeatStress: 4,
		rivalExperienceBonus: 3,
		rivalExperienceCap: 3,
		rivalryAttitude: -8,
		opponentMaxAge: 72
	}
};

/** Deux groupes électoraux (poids 3 et 1) et un groupe d'influence. */
export const fixtureSupports = {
	groups: [
		{
			id: 'support.workers',
			label: 'Travailleurs',
			description: 'Groupe électoral de test, plutôt interventionniste.',
			kind: 'electoral',
			weight: 3,
			startingSupport: 20,
			preferences: { economy: -50, society: 0, sovereignty: 0 },
			judgesParty: true,
			affiliationBonus: 0,
			mandateBonus: 2
		},
		{
			id: 'support.owners',
			label: 'Possédants',
			description: 'Groupe électoral de test, plutôt libéral.',
			kind: 'electoral',
			weight: 1,
			startingSupport: 40,
			preferences: { economy: 50, society: 0, sovereignty: 0 },
			judgesParty: true,
			affiliationBonus: 0,
			mandateBonus: 0
		},
		{
			id: 'support.members',
			label: 'Militants',
			description: 'Groupe d’influence de test.',
			kind: 'influence',
			weight: 0,
			startingSupport: 0,
			preferences: { economy: 0, society: 0, sovereignty: 0 },
			judgesParty: false,
			affiliationBonus: 20,
			mandateBonus: 0
		}
	]
};

/** Calendrier et mandats de test : scrutins éloignés pour ne pas gêner les autres tests. */
export const fixtureCareer = {
	elections: [
		{
			id: 'election.local',
			label: 'Élection locale',
			firstTurn: 40,
			cycleTurns: 24,
			filingLeadTurns: 2,
			scope: 'local',
			decidesGovernment: false,
			minAge: 18,
			grants: 'mandate.councillor',
			bonusGrant: { mandate: 'mandate.mayor', minPercent: 60 },
			requiresAnyMandate: [],
			rivalStrength: 30
		},
		{
			id: 'election.national',
			label: 'Élection nationale',
			firstTurn: 60,
			cycleTurns: 20,
			filingLeadTurns: 2,
			scope: 'national',
			decidesGovernment: true,
			minAge: 30,
			grants: 'mandate.deputy',
			requiresAnyMandate: ['mandate.councillor'],
			rivalStrength: 40
		}
	],
	mandates: [
		{
			id: 'mandate.councillor',
			label: 'Siège local',
			rank: 10,
			election: 'election.local',
			endsWithGovernment: false,
			requires: [],
			timePerTurn: 10,
			income: [{ resource: 'influence', amount: 1 }],
			stressPerTurn: 0
		},
		{
			id: 'mandate.mayor',
			label: 'Mairie',
			rank: 30,
			election: 'election.local',
			endsWithGovernment: false,
			requires: ['mandate.councillor'],
			timePerTurn: 20,
			income: [{ resource: 'personalCashCents', amount: 50_000 }],
			stressPerTurn: 2
		},
		{
			id: 'mandate.deputy',
			label: 'Siège national',
			rank: 40,
			election: 'election.national',
			endsWithGovernment: false,
			requires: [],
			timePerTurn: 30,
			income: [{ resource: 'influence', amount: 4 }],
			stressPerTurn: 1
		},
		{
			id: 'mandate.minister',
			label: 'Ministère',
			rank: 60,
			election: null,
			endsWithGovernment: true,
			requires: [],
			timePerTurn: 40,
			income: [{ resource: 'influence', amount: 6 }],
			stressPerTurn: 3
		}
	],
	institutions: {
		incompatibilities: [['mandate.minister', 'mandate.deputy']],
		maxMandates: 3
	}
};

export const fixtureTraits = {
	traits: [
		{
			id: 'trait.open',
			label: 'Franchise',
			description: 'Trait public de test.',
			hidden: false,
			positiveRelationPercent: 100,
			negativeRelationPercent: 100,
			campaignBonus: 2
		},
		{
			id: 'trait.grudge',
			label: 'Rancune',
			description: 'Trait caché de test : double les rancœurs.',
			hidden: true,
			positiveRelationPercent: 100,
			negativeRelationPercent: 200,
			campaignBonus: 0
		},
		{
			id: 'trait.loyal',
			label: 'Loyauté',
			description: 'Trait caché de test : amplifie la gratitude.',
			hidden: true,
			positiveRelationPercent: 150,
			negativeRelationPercent: 50,
			campaignBonus: 0
		}
	]
};

/** Évolution du monde neutre : ni retour à la référence, ni aléa, ni changement de direction. */
export function neutralWorld() {
	return {
		startingIndicators: { economy: 50, socialClimate: 50, stability: 50 },
		indicatorBaseline: 50,
		indicatorReversionPercent: 0,
		indicatorVolatility: 0,
		minPartyStrength: 1,
		maxPartyStrength: 60,
		strengthReversionPercent: 0,
		strengthVolatility: 0,
		governingIndicatorDivisor: 5,
		leaderChangeChance: 0,
		leaderMinAge: 40,
		leaderMaxAge: 60,
		leaderRetirementAge: 200
	};
}

export const fixtureWorld = {
	axes: [
		{
			id: 'economy',
			label: 'Économie',
			negativeLabel: 'interventionniste',
			positiveLabel: 'libéral'
		},
		{
			id: 'society',
			label: 'Société',
			negativeLabel: 'progressiste',
			positiveLabel: 'conservateur'
		},
		{
			id: 'sovereignty',
			label: 'Souveraineté',
			negativeLabel: 'pro-européen',
			positiveLabel: 'souverainiste'
		}
	],
	parties: [
		{
			id: 'party.left',
			name: 'Parti de Gauche Test',
			acronym: 'PGT',
			family: 'Gauche',
			description: 'Parti de test.',
			positions: { economy: -50, society: -40, sovereignty: -20 },
			baseStrength: 30
		},
		{
			id: 'party.right',
			name: 'Parti de Droite Test',
			acronym: 'PDT',
			family: 'Droite',
			description: 'Parti de test.',
			positions: { economy: 50, society: 40, sovereignty: 20 },
			baseStrength: 25
		},
		{
			id: 'party.small',
			name: 'Petit Parti Test',
			acronym: 'PPT',
			family: 'Centre',
			description: 'Parti de test.',
			positions: { economy: 0, society: 0, sovereignty: -60 },
			baseStrength: 5
		}
	],
	startingGoverningParty: 'party.left',
	names: {
		first: ['Alix', 'Camille', 'Dominique', 'Sacha', 'Claude', 'Maxime'],
		last: ['Martin', 'Bernard', 'Durand', 'Petit', 'Moreau', 'Laurent']
	}
};

export const fixtureCast = {
	cast: [
		{
			id: 'test.doc_a',
			name: 'Docteure A',
			tags: ['medical'],
			age: 50,
			renewal: { epithet: 'médecin' }
		},
		{
			id: 'test.doc_b',
			name: 'Docteur B',
			tags: ['medical'],
			age: 40,
			renewal: { epithet: 'médecin' }
		},
		{
			id: 'test.reporter',
			name: 'Reporter',
			tags: ['journalist'],
			age: 35,
			renewal: { epithet: 'reporter' }
		},
		{ id: 'test.cousin', name: 'Cousin', tags: ['family'], age: 30 }
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
		events: fixtureEvents,
		world: fixtureWorld,
		traits: fixtureTraits,
		career: fixtureCareer,
		supports: fixtureSupports
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

/** Contenu de test avec des paramètres de personnages modifiés. */
export function withCharacters(changes: Partial<Content['balance']['characters']>): Content {
	return {
		...fixtureContent,
		balance: {
			...fixtureContent.balance,
			characters: { ...fixtureContent.balance.characters, ...changes }
		}
	};
}

/** Contenu de test avec une évolution des soutiens modifiée. */
export function withSupports(changes: Partial<Content['balance']['supports']>): Content {
	return {
		...fixtureContent,
		balance: {
			...fixtureContent.balance,
			supports: { ...fixtureContent.balance.supports, ...changes }
		}
	};
}

/** Contenu de test avec une évolution du monde modifiée. */
export function withWorld(changes: Partial<Content['balance']['world']>): Content {
	return {
		...fixtureContent,
		balance: {
			...fixtureContent.balance,
			world: { ...fixtureContent.balance.world, ...changes }
		}
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
