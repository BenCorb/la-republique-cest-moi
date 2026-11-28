/**
 * Contenu de test figé, indépendant du catalogue réel : les tests du moteur ne
 * dépendent pas des valeurs de tuning (ARCHITECTURE.md §6 et §11).
 */
import { validateContent } from '../../src/lib/game/content/validate.ts';
import type { Content, EventsBalance } from '../../src/lib/game/content/types.ts';
import {
	chooseEventCommand,
	describePendingEvent,
	transition,
	type GameState,
	type HistoryEntry,
	type JournalEntry,
	type TransitionSuccess
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
	events: {
		ordinaryDrawsPerTurn: 0,
		ordinaryEventChance: 0,
		repeatPenaltyPercent: 0,
		maxOccurrences: 0
	},
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
	elections: {
		voteVolatility: 0,
		momentum: 1,
		newGovernmentStability: 60,
		alertLeadTurns: 2,
		contests: {
			minPartyPerMille: 50,
			maxPartyContestants: 5,
			partyStrengthPercent: 70,
			transferPercent: 80,
			mergeRetentionPercent: 90,
			allyDistance: 55,
			runoffSwing: 0,
			colistierPreparationPercent: 50,
			grandElectorBonus: 6,
			rankSpreadPercent: 40,
			outsiderRankPenalty: 20,
			runoffEvent: 'test.runoff'
		}
	},
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
		refundMinPercent: 5,
		advanceRepayMinPercent: 10,
		rivalExperienceBonus: 3,
		rivalExperienceCap: 3,
		rivalryAttitude: -8,
		opponentMaxAge: 72,
		investiture: {
			apparatusPercent: 40,
			influencePercent: 20,
			popularityPercent: 20,
			mandatePoints: 10,
			mandateCap: 30,
			localPoints: 10,
			rivalPenalty: 25,
			rivalChancePercent: 35,
			minChancePercent: 5,
			maxChancePercent: 95,
			supportedFrom: 65,
			disputedFrom: 40,
			dissidentApparatus: 10,
			refusedEvent: 'test.investiture_refused'
		}
	},
	entourage: {
		candidatesPerPost: 2,
		competenceReference: 50,
		hireAttitude: 10,
		unpaidAttitude: -5,
		hireReserveQuarters: 1,
		dismissAttitude: -20,
		resignAttitude: -30,
		preciseAdviceCompetence: 70,
		fairAdviceCompetence: 40,
		poorAdviceErrorChance: 0.5,
		/**
		 * Recrutement de test (P3-20) : salaire égal à la référence du poste et
		 * acceptation certaine ; `tests/unit/recruitment.test.ts` fixe ses valeurs.
		 */
		recruitment: {
			salaryCurve: [
				{ competence: 0, percent: 100 },
				{ competence: 100, percent: 100 }
			],
			salaryRoundingCents: 100,
			offers: {
				low: { salaryPercent: 80, interest: -15, attitude: -5, bonusPercent: 0 },
				standard: { salaryPercent: 100, interest: 0, attitude: 0, bonusPercent: 0 },
				generous: { salaryPercent: 125, interest: 15, attitude: 5, bonusPercent: 100 }
			},
			influenceMax: 30,
			influencePerRoot: 2,
			popularityMax: 20,
			mandateRankForMax: 60,
			mandateMax: 20,
			apparatusMax: 10,
			coveredQuartersForMax: 4,
			payrollMax: 20,
			demandPercent: 60,
			baseAcceptPercent: 70,
			acceptPerPoint: 2,
			minAcceptPercent: 100,
			maxAcceptPercent: 100,
			interviewInterest: 6,
			maxInterviews: 2,
			refusalAttitude: -5,
			counterOfferPercent: 140
		},
		/**
		 * Recrutement II de test (P3-21) : recherches certaines, aucune progression
		 * ni renégociation (les tests dédiés utilisent le catalogue réel).
		 */
		search: {
			levels: {
				simple: {
					costCents: 0,
					delayTurns: 1,
					candidates: 1,
					findPercent: 100,
					profile: null,
					traitAllowed: false,
					vetting: null
				},
				targeted: {
					costCents: 0,
					delayTurns: 1,
					candidates: 1,
					findPercent: 100,
					profile: 'profile.novice',
					traitAllowed: true,
					vetting: null
				},
				headhunt: {
					costCents: 0,
					delayTurns: 1,
					candidates: 1,
					findPercent: 100,
					profile: 'profile.expert',
					traitAllowed: true,
					vetting: 'thorough'
				}
			},
			traitPenalty: 0,
			failureRefundPercent: 50,
			maxShortlist: 5
		},
		vetting: {
			standard: { truePercent: 100, falsePercent: 0 },
			thorough: { truePercent: 100, falsePercent: 0 }
		},
		progression: { curve: [{ competence: 0, tenths: 0 }], seniorityAttitude: 0 },
		renegotiation: { stepCompetence: 100, minTurns: 4, event: 'test.raise_request' }
	},
	family: {
		childCostCents: 10_000,
		childIndependenceAge: 20,
		neglectThreshold: 90,
		neglectAttitude: -2,
		supportiveAttitude: 15,
		hostileAttitude: -15,
		partnerStress: 1,
		partnerAgeSpread: 5
	},
	/**
	 * Base militante de test (P3-19) : neutre par défaut (aucune cotisation, aucun
	 * frais, aucune pénalité de mobilisation) ; `tests/unit/activists.test.ts`
	 * fixe ses propres valeurs.
	 */
	government: {
		secretaryStature: 55,
		ministerStature: 72,
		primeMinisterStature: 100,
		primeMinisterChancePercent: 10,
		reshuffleStability: 55,
		reshuffleChancePercent: 0,
		keepPopularity: 30,
		presidentTermTurns: 20,
		firstPresidentialTurn: 9,
		reelectionChancePercent: 55,
		appointmentEvent: 'test.appointment'
	},
	partyCareer: {
		congressCycleTurns: 12,
		congressOffset: 6,
		cadreMinApparatus: 40,
		cadreMinActivists: 30,
		cadreMinTurns: 4,
		cadreChancePercent: 25,
		apparatusPercent: 40,
		activistsPercent: 25,
		influencePercent: 15,
		rallyPoints: 4,
		rallyCap: 20,
		minChancePercent: 5,
		maxChancePercent: 90,
		favoriteFrom: 60,
		openFrom: 35,
		retryCongresses: 1,
		defeatApparatus: 4,
		leaderChallengeApparatus: 25,
		leaderOustChancePercent: 35,
		cadreInvestitureBonus: 10,
		leaderInvestitureBonus: 30
	},
	activists: {
		start: 0,
		baseCapacity: 15,
		partyCapacity: 40,
		mandateCapacityPerRank: 4,
		reachInfluenceFactor: 2,
		reachExposureDivisor: 5,
		campaignReach: 10,
		attractionThreshold: 0,
		attractionPercentPerPoint: 4,
		baseAttritionPercent: 4,
		discontentThreshold: 10,
		discontentDivisor: 2,
		overCapacityAttritionPercent: 10,
		recruitsPerVoteTenths: 3,
		duesCents: 0,
		partyMachinePercent: 40,
		mobilizationWeight: 0,
		tiers: [
			{
				id: 'tier.isolated',
				label: 'Quelques fidèles',
				min: 0,
				fieldMultiplier: 0,
				upkeepCents: 0
			},
			{ id: 'tier.core', label: 'Noyau', min: 5, fieldMultiplier: 1, upkeepCents: 0 },
			{ id: 'tier.committee', label: 'Comité', min: 25, fieldMultiplier: 2, upkeepCents: 0 }
		]
	}
};

/**
 * Profils de test : par défaut, une origine et un terrain d’engagement sans effet ni
 * famille (les autres tests restent indépendants de la création) ; une origine
 * avec famille et héritage pour les tests de famille.
 */
export const fixtureProfiles = {
	origins: [
		{
			id: 'origin.neutral',
			label: 'Neutre',
			description: 'Origine de test sans effet.',
			effects: [],
			family: [],
			inheritanceCents: 0
		},
		{
			id: 'origin.heirs',
			label: 'Héritiers',
			description: 'Origine de test avec famille.',
			effects: [
				{ op: 'addResource', resource: 'personalCashCents', value: 50_000 },
				{ op: 'addSupport', group: 'support.owners', value: 10 }
			],
			family: [
				{ relation: 'parent', minAge: 60, maxAge: 60, attitude: 20, tags: [] },
				{ relation: 'parent', minAge: 60, maxAge: 60, attitude: 20, tags: ['politician'] },
				{ relation: 'sibling', minAge: 28, maxAge: 28, attitude: 5, tags: [] }
			],
			inheritanceCents: 1_000_000
		}
	],
	engagements: [
		{
			id: 'engagement.none',
			label: 'Aucune',
			description: 'Terrain de test sans effet.',
			effects: []
		},
		{
			id: 'engagement.press',
			label: 'Presse',
			description: 'Terrain de test.',
			effects: [
				{ op: 'addResource', resource: 'influence', value: 6 },
				{ op: 'addStat', stat: 'player.stress', value: 2 }
			]
		}
	],
	defaults: { origin: 'origin.neutral', engagement: 'engagement.none', region: 'region.test' },
	// Territoire neutre (P3-16) : aucun effet, si bien que les tests existants n'en dépendent pas.
	territory: {
		regions: [
			{
				id: 'region.test',
				name: 'Région de test',
				departments: [
					{ code: '75', name: 'Capitale de test', startable: false },
					{ code: '14', name: 'Département de test', startable: true }
				],
				councilSeats: 50,
				toponymy: { roots: ['Testville', 'Montessai', 'Brouillon'], rivers: ['Essai'], pays: [] }
			},
			{
				id: 'region.other',
				name: 'Autre région',
				departments: [{ code: '29', name: 'Autre département', startable: true }],
				councilSeats: 40,
				toponymy: { roots: ['Ailleurs', 'Autrefois', 'Lointain'], rivers: ['Rive'], pays: ['Pays'] }
			}
		],
		sizes: [
			{
				id: 'town_size.test',
				label: 'Petite ville',
				description: 'Taille de test.',
				weight: 1,
				rivalStrengthModifier: 0,
				councilSeats: 15,
				effects: []
			}
		],
		traits: [
			{
				id: 'town_trait.quiet',
				label: 'paisible',
				description: 'Trait de test.',
				excludes: [],
				effects: [],
				origins: []
			},
			{
				id: 'town_trait.busy',
				label: 'animée',
				description: 'Trait de test.',
				excludes: [],
				effects: [],
				origins: []
			}
		],
		traitsPerTown: { min: 1, max: 2 },
		toponymy: {
			patterns: [
				{ pattern: '{root}', weight: 1 },
				{ pattern: '{root}-sur-{river}', weight: 1 },
				{ pattern: '{root}-en-{pays}', weight: 1 }
			],
			saints: ['Testin'],
			complements: ['des-Tests'],
			plurals: ['Essais'],
			standalone: ['La Roche-Test']
		}
	}
};

/** Deux postes de test : un ouvert avec de l'influence, un réservé aux élus. */
export const fixtureEntourage = {
	posts: [
		{
			id: 'post.aide',
			label: 'Assistance',
			description: 'Poste de test ouvert dès 50 points d’influence.',
			tag: 'staff_aide',
			salaryCents: 1_000,
			// Fermé par défaut : aucune présélection (donc aucun tirage) dans les autres tests.
			requires: { op: 'gte', stat: 'resources.influence', value: 50 },
			unavailableReason: 'Il faut 50 points d’influence.',
			adviceCategories: ['personal'],
			missions: [
				{
					id: 'mission.aide.budget',
					label: 'Collecter',
					description: 'Rapporte du budget.',
					effects: [{ op: 'addResource', resource: 'politicalBudgetCents', value: 2_000 }],
					timeBonus: 0,
					pollPrecision: false
				},
				{
					id: 'mission.aide.agenda',
					label: 'Agenda',
					description: 'Libère du temps.',
					effects: [],
					timeBonus: 10,
					pollPrecision: false
				}
			]
		},
		{
			id: 'post.lawyer',
			label: 'Conseil juridique',
			description: 'Poste de test réservé aux élus.',
			tag: 'staff_lawyer',
			salaryCents: 1_000,
			requires: { op: 'gte', stat: 'player.mandates', value: 1 },
			unavailableReason: 'Réservé aux élus.',
			adviceCategories: [],
			missions: [
				{
					id: 'mission.lawyer.calm',
					label: 'Apaiser',
					description: 'Retire du stress.',
					effects: [{ op: 'addStat', stat: 'player.stress', value: -2 }],
					timeBonus: 0,
					pollPrecision: false
				}
			]
		}
	],
	profiles: [
		{
			id: 'profile.expert',
			label: 'Expert',
			minCompetence: 80,
			maxCompetence: 90,
			traits: ['trait.open'],
			minAttractiveness: 0,
			rareWeight: 0
		},
		{
			id: 'profile.novice',
			label: 'Novice',
			minCompetence: 10,
			maxCompetence: 20,
			traits: [],
			minAttractiveness: 0,
			rareWeight: 0
		}
	]
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
			headGrant: 'mandate.mayor',
			requiresAnyMandate: [],
			rivalStrength: 30,
			mobilizationNeed: 0,
			system: 'list',
			turnout: { min: 60, max: 60 },
			maintainPerMille: 100,
			mergePerMille: 50,
			seatMinPerMille: 50,
			bonusSeatsPercent: 50,
			firstRoundRegisteredPerMille: 0
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
			rivalStrength: 40,
			mobilizationNeed: 0,
			system: 'single',
			turnout: { min: 60, max: 60 },
			maintainPerMille: 125,
			mergePerMille: 0,
			seatMinPerMille: 0,
			bonusSeatsPercent: 0,
			firstRoundRegisteredPerMille: 250
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
	},
	portfolios: [
		{ id: 'portfolio.test_a', label: 'Essais', title: 'ministère des Essais' },
		{ id: 'portfolio.test_b', label: 'Épreuves', title: 'ministère des Épreuves' }
	]
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
	/** Époques de test (P3-07) : 2000 puis 2010. */
	eras: [
		{ id: 'era.first', label: 'Première époque', description: 'Le début.', fromYear: 2000 },
		{ id: 'era.second', label: 'Seconde époque', description: 'La suite.', fromYear: 2010 }
	],
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
				id: 'test.runoff',
				category: 'campaign',
				title: 'Entre les deux tours',
				text: 'Le second tour approche.',
				blocking: true,
				trigger: 'followUp',
				weight: 0,
				priority: 50,
				cooldownTurns: 0,
				unique: false,
				actors: [],
				choices: [
					{
						id: 'maintain',
						label: 'Se maintenir',
						hints: [],
						costs: [],
						effects: [{ op: 'runoffDecision', decision: 'maintain' }]
					},
					{
						id: 'merge',
						label: 'Fusionner',
						hints: [],
						costs: [],
						effects: [{ op: 'runoffDecision', decision: 'merge' }]
					},
					{
						id: 'withdraw',
						label: 'Se désister',
						hints: [],
						costs: [],
						effects: [{ op: 'runoffDecision', decision: 'withdraw' }]
					}
				]
			},
			{
				id: 'test.investiture_refused',
				category: 'campaign',
				title: 'Investiture refusée',
				text: 'Un autre portera les couleurs du parti.',
				blocking: true,
				trigger: 'followUp',
				weight: 0,
				priority: 45,
				cooldownTurns: 0,
				unique: false,
				actors: [],
				choices: [
					{
						id: 'renounce',
						label: 'Renoncer',
						hints: [],
						costs: [],
						effects: [{ op: 'investitureDecision', decision: 'renounce' }]
					},
					{
						id: 'dissident',
						label: 'Dissidence',
						hints: [],
						costs: [],
						effects: [{ op: 'investitureDecision', decision: 'dissident' }]
					}
				]
			},
			{
				id: 'test.appointment',
				category: 'career',
				title: 'Entrée au gouvernement',
				text: 'Un portefeuille vous est proposé.',
				blocking: true,
				trigger: 'followUp',
				weight: 0,
				priority: 40,
				cooldownTurns: 0,
				unique: false,
				actors: [],
				choices: [
					{
						id: 'accept',
						label: 'Accepter',
						hints: [],
						costs: [],
						effects: [{ op: 'appointment', decision: 'accept' }]
					},
					{
						id: 'decline',
						label: 'Décliner',
						hints: [],
						costs: [],
						effects: [{ op: 'appointment', decision: 'decline' }]
					}
				]
			},
			{
				id: 'test.raise_request',
				category: 'entourage',
				title: 'Augmentation',
				text: '{collaborator} demande une augmentation.',
				blocking: true,
				trigger: 'followUp',
				weight: 0,
				priority: 30,
				cooldownTurns: 0,
				unique: false,
				subject: 'staff',
				actors: [{ role: 'collaborator', tags: ['staff'] }],
				choices: [
					{
						id: 'grant',
						label: 'Accorder',
						hints: [],
						costs: [],
						effects: [{ op: 'grantRaise', role: 'collaborator' }]
					},
					{ id: 'refuse', label: 'Refuser', hints: [], costs: [], effects: [] }
				]
			},
			{
				id: 'test.revelation',
				category: 'press',
				title: 'Révélations',
				text: 'Un dossier vous concernant est révélé.',
				blocking: true,
				trigger: 'followUp',
				weight: 0,
				priority: 30,
				cooldownTurns: 0,
				unique: false,
				actors: [],
				choices: [
					{
						id: 'lawyer',
						label: 'Prendre un avocat',
						hints: ['Défense renforcée'],
						costs: [],
						effects: [{ op: 'addStat', stat: 'player.defense', value: 50 }]
					},
					{ id: 'deny', label: 'Nier', hints: [], costs: [], effects: [] }
				]
			},
			{
				id: 'test.entourage_revelation',
				category: 'press',
				title: 'Un proche mis en cause',
				text: '{defendant} est mis en cause.',
				blocking: true,
				trigger: 'followUp',
				weight: 0,
				priority: 30,
				cooldownTurns: 0,
				unique: false,
				actors: [{ role: 'defendant', tags: ['family'] }],
				choices: [
					{ id: 'distance', label: 'Prendre ses distances', hints: [], costs: [], effects: [] }
				]
			},
			{
				id: 'test.shady_offer',
				category: 'opportunity',
				title: 'Une offre douteuse',
				text: '{cousin} propose un arrangement.',
				blocking: true,
				trigger: 'random',
				weight: 5,
				priority: 0,
				cooldownTurns: 0,
				unique: false,
				// Une offre de financement suppose une activité politique (P3-12).
				when: { op: 'capability', capability: 'political_activity' },
				actors: [{ role: 'cousin', tags: ['family'] }],
				choices: [
					{
						id: 'accept',
						label: 'Accepter',
						hints: ['Budget en hausse'],
						costs: [],
						effects: [
							{ op: 'addResource', resource: 'politicalBudgetCents', value: 1_000 },
							{
								op: 'recordFact',
								offense: 'offense.test_financing',
								severity: 2,
								divertedCents: 1_000,
								accomplices: ['cousin']
							},
							{ op: 'addStat', stat: 'player.exposure', value: 10 }
						]
					},
					{
						id: 'delegate',
						label: 'Le laisser faire',
						hints: [],
						costs: [],
						effects: [
							{
								op: 'recordFact',
								offense: 'offense.test_favour',
								severity: 3,
								author: 'cousin'
							}
						]
					},
					{ id: 'refuse', label: 'Refuser', hints: [], costs: [], effects: [] }
				]
			},
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
	},
	// Promesses (P3-04) : dilemme et rappels, programmés par le moteur.
	'events/promises.json': {
		events: [
			{
				id: 'test.promise_dilemma',
				category: 'career',
				subject: 'promise',
				title: 'Dilemme',
				text: 'Votre promesse « {promise} » coûte cher.',
				blocking: true,
				trigger: 'followUp',
				weight: 0,
				priority: 30,
				cooldownTurns: 0,
				unique: false,
				actors: [],
				choices: [
					{
						id: 'hold',
						label: 'Tenir',
						hints: [],
						costs: [],
						effects: [{ op: 'advancePromise', value: 20 }]
					},
					{
						id: 'amend',
						label: 'Transiger',
						hints: [],
						costs: [],
						effects: [{ op: 'amendPromise' }, { op: 'advancePromise', value: 10 }]
					},
					{
						id: 'drop',
						label: 'Renoncer',
						hints: [],
						costs: [],
						effects: [{ op: 'abandonPromise' }]
					}
				]
			},
			{
				id: 'test.promise_recall_broken',
				category: 'campaign',
				subject: 'promise',
				title: 'Rappel',
				text: 'On vous rappelle « {promise} ».',
				blocking: true,
				trigger: 'followUp',
				weight: 0,
				priority: 20,
				cooldownTurns: 0,
				unique: false,
				actors: [],
				choices: [{ id: 'ok', label: 'Assumer', hints: [], costs: [], effects: [] }]
			},
			{
				id: 'test.promise_recall_kept',
				category: 'campaign',
				subject: 'promise',
				title: 'Promesse tenue',
				text: '« {promise} » a été tenue.',
				blocking: false,
				trigger: 'followUp',
				weight: 0,
				priority: 0,
				cooldownTurns: 0,
				unique: false,
				actors: [],
				effects: [{ op: 'addSupport', group: 'support.workers', value: 2 }]
			},
			{
				id: 'test.promise_recall_broken_elsewhere',
				category: 'campaign',
				subject: 'promise',
				title: 'Rappel lointain',
				text: 'On ressort « {promise} », d’un autre scrutin.',
				blocking: true,
				trigger: 'followUp',
				weight: 0,
				priority: 20,
				cooldownTurns: 0,
				unique: false,
				actors: [],
				choices: [{ id: 'ok', label: 'Expliquer', hints: [], costs: [], effects: [] }]
			},
			{
				id: 'test.promise_recall_kept_elsewhere',
				category: 'campaign',
				subject: 'promise',
				title: 'Promesse tenue ailleurs',
				text: '« {promise} » a été tenue, sur un autre mandat.',
				blocking: false,
				trigger: 'followUp',
				weight: 0,
				priority: 0,
				cooldownTurns: 0,
				unique: false,
				actors: [],
				effects: [{ op: 'addSupport', group: 'support.workers', value: 1 }]
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

/**
 * Justice neutre : l'exposition ne bouge pas d'elle-même, si bien que les tests
 * existants restent indépendants des jauges de la justice (`withJustice`).
 */
export const fixtureJustice = {
	offenses: [
		{
			id: 'offense.test_financing',
			label: 'Financement de test',
			description: 'Des fonds de test.',
			capability: 'political_activity'
		},
		{
			id: 'offense.test_favour',
			label: 'Faveur de test',
			description: 'Une faveur de test.',
			capability: 'political_activity'
		}
	],
	balance: {
		riskPerSeverity: 8,
		accompliceRiskPercent: 50,
		prescriptionTurns: 24,
		exposureRiskBonusPercent: 50,
		baseExposure: 0,
		campaignExposure: 0,
		mandateExposure: {},
		exposureDriftPercent: 0,
		// Aucune révélation par défaut : les tests de dossiers l'activent (`withJustice`).
		revealPercentPerSeverity: 0,
		investigationTurns: { min: 2, max: 2 },
		trialDelayTurns: { min: 2, max: 2 },
		appealTurns: { min: 3, max: 3 },
		dismissalBasePercent: 0,
		dismissalPerSeverityPercent: 0,
		defenseDismissalPercent: 0,
		convictionPercentBySeverity: [100, 100, 100],
		defenseConvictionPercent: 100,
		sentences: [
			{
				fineCents: { min: 1_000, max: 1_000 },
				ineligibilityTurns: { min: 0, max: 0 },
				prison: 'none',
				firmPrisonPercent: 0
			},
			{
				fineCents: { min: 5_000, max: 5_000 },
				ineligibilityTurns: { min: 8, max: 8 },
				prison: 'suspended',
				firmPrisonPercent: 0
			},
			{
				fineCents: { min: 10_000, max: 10_000 },
				ineligibilityTurns: { min: 20, max: 20 },
				prison: 'firm_possible',
				firmPrisonPercent: 100
			}
		],
		revelationExposure: 10,
		revelationSupport: 2,
		revelationStress: 4,
		indictmentStress: 3,
		indictmentSupport: 1,
		convictionSupport: 3,
		convictionStress: 5,
		acquittalRelief: 5,
		entourageImpactPercent: 50,
		defenseDecayPercent: 10,
		revelationEvent: 'test.revelation',
		entourageRevelationEvent: 'test.entourage_revelation'
	}
};

/** Trains de vie de test : le sobre est gratuit et sans effet (tests existants inchangés). */
/** Promesses de test (P3-04) : effets lisibles, pas de rappel par défaut. */
export const fixturePromises = {
	balance: {
		maxPerCampaign: 2,
		announcePreparation: 3,
		deliveryTurns: 6,
		dilemmaDelayTurns: { min: 2, max: 2 },
		partialProgress: 50,
		recallPercent: 0,
		maxRecalls: 2,
		recallEvents: {
			kept: 'test.promise_recall_kept',
			abandoned: 'test.promise_recall_broken',
			keptElsewhere: 'test.promise_recall_kept_elsewhere',
			abandonedElsewhere: 'test.promise_recall_broken_elsewhere'
		}
	},
	themes: [
		{ id: 'theme.test_taxes', label: 'Fiscalité' },
		{ id: 'theme.test_services', label: 'Services publics' },
		{ id: 'theme.test_institutions', label: 'Institutions' }
	],
	promises: [
		{
			id: 'promise.test_tax',
			label: 'Baisser les impôts',
			theme: 'theme.test_taxes',
			description: 'Promesse de test pour {place}.',
			election: 'election.local',
			lever: ['mandate.councillor', 'mandate.mayor'],
			mode: 'decide',
			dilemmaEvent: 'test.promise_dilemma',
			announce: [{ op: 'addSupport', group: 'support.owners', value: 2 }],
			kept: [{ op: 'addSupport', group: 'support.owners', value: 5 }],
			partial: [{ op: 'addSupport', group: 'support.owners', value: 1 }],
			abandoned: [
				{ op: 'addSupport', group: 'support.owners', value: -6 },
				{ op: 'addResource', resource: 'influence', value: 1 }
			]
		},
		{
			id: 'promise.test_school',
			label: 'Rénover l’école',
			theme: 'theme.test_services',
			description: 'Promesse de test.',
			election: 'election.local',
			lever: ['mandate.mayor'],
			mode: 'decide',
			dilemmaEvent: 'test.promise_dilemma',
			announce: [{ op: 'addSupport', group: 'support.workers', value: 2 }],
			kept: [{ op: 'addSupport', group: 'support.workers', value: 4 }],
			partial: [],
			abandoned: [{ op: 'addSupport', group: 'support.workers', value: -4 }]
		},
		{
			id: 'promise.test_clean',
			label: 'Ouvrir les comptes',
			theme: 'theme.test_institutions',
			description: 'Promesse de test.',
			election: 'election.local',
			lever: ['mandate.mayor'],
			mode: 'decide',
			dilemmaEvent: 'test.promise_dilemma',
			announce: [],
			kept: [],
			partial: [],
			abandoned: []
		},
		{
			id: 'promise.test_national',
			label: 'Réformer l’État',
			theme: 'theme.test_institutions',
			description: 'Promesse de test.',
			election: 'election.national',
			lever: ['mandate.deputy'],
			mode: 'carry',
			dilemmaEvent: 'test.promise_dilemma',
			announce: [],
			kept: [],
			partial: [],
			abandoned: []
		},
		{
			id: 'promise.test_tax_national',
			label: 'Voter une baisse d’impôt',
			theme: 'theme.test_taxes',
			description: 'Promesse de test.',
			election: 'election.national',
			lever: ['mandate.deputy'],
			mode: 'carry',
			dilemmaEvent: 'test.promise_dilemma',
			announce: [],
			kept: [],
			partial: [],
			abandoned: []
		}
	]
};

export const fixtureWealth = {
	lifestyles: [
		{
			id: 'lifestyle.test_modest',
			label: 'Sobre',
			description: 'Sobre.',
			level: 0,
			costCents: 0,
			stressPerTurn: 0,
			exposure: 0
		},
		{
			id: 'lifestyle.test_lavish',
			label: 'Fastueux',
			description: 'Fastueux.',
			level: 1,
			costCents: 50_000,
			stressPerTurn: -4,
			exposure: 10
		}
	],
	defaultLifestyle: 'lifestyle.test_modest',
	unpaidLifestyleStress: 6
};

/**
 * Médias de test (P3-03) : un quotidien par région de test (P3-18), des titres génériques et des
 * effets nuls, sans nouvelle d'ambiance ni tirage : les tests existants
 * gardent leur PRNG et leurs soutiens. Les tests de presse utilisent `withPress`.
 */
export const fixtureMedia = {
	media: [
		{
			id: 'media.local',
			name: 'La Feuille locale',
			kind: 'regional',
			line: 'Presse locale',
			description: 'Le journal du coin.',
			scope: 'regional',
			region: 'region.test',
			audience: 50,
			baseRelation: 0,
			groups: ['support.workers'],
			coverage: { justice: 1, promise: 1, election: 1, lifestyle: 1, ownership: 1 },
			amplifyPercent: 100
		},
		{
			id: 'media.other',
			name: 'Le Journal d’ailleurs',
			kind: 'regional',
			line: 'Presse d’une autre région',
			description: 'Le journal d’une région voisine.',
			scope: 'regional',
			region: 'region.other',
			audience: 50,
			baseRelation: 0,
			groups: ['support.workers'],
			coverage: { justice: 1, promise: 1, election: 1, lifestyle: 1, ownership: 1 },
			amplifyPercent: 100
		}
	],
	headlines: [
		{
			id: 'headline.justice_critical',
			topic: 'justice',
			tone: 'critical',
			text: 'Titre justice critical : {subject}'
		},
		{
			id: 'headline.justice_neutral',
			topic: 'justice',
			tone: 'neutral',
			text: 'Titre justice neutral : {subject}'
		},
		{
			id: 'headline.justice_favorable',
			topic: 'justice',
			tone: 'favorable',
			text: 'Titre justice favorable : {subject}'
		},
		{
			id: 'headline.promise_critical',
			topic: 'promise',
			tone: 'critical',
			text: 'Titre promise critical : {subject}'
		},
		{
			id: 'headline.promise_neutral',
			topic: 'promise',
			tone: 'neutral',
			text: 'Titre promise neutral : {subject}'
		},
		{
			id: 'headline.promise_favorable',
			topic: 'promise',
			tone: 'favorable',
			text: 'Titre promise favorable : {subject}'
		},
		{
			id: 'headline.election_critical',
			topic: 'election',
			tone: 'critical',
			text: 'Titre election critical : {subject}'
		},
		{
			id: 'headline.election_neutral',
			topic: 'election',
			tone: 'neutral',
			text: 'Titre election neutral : {subject}'
		},
		{
			id: 'headline.election_favorable',
			topic: 'election',
			tone: 'favorable',
			text: 'Titre election favorable : {subject}'
		},
		{
			id: 'headline.lifestyle_critical',
			topic: 'lifestyle',
			tone: 'critical',
			text: 'Titre lifestyle critical : {subject}'
		},
		{
			id: 'headline.lifestyle_neutral',
			topic: 'lifestyle',
			tone: 'neutral',
			text: 'Titre lifestyle neutral : {subject}'
		},
		{
			id: 'headline.lifestyle_favorable',
			topic: 'lifestyle',
			tone: 'favorable',
			text: 'Titre lifestyle favorable : {subject}'
		},
		{
			id: 'headline.interview_critical',
			topic: 'interview',
			tone: 'critical',
			text: 'Titre interview critical : {subject}'
		},
		{
			id: 'headline.interview_neutral',
			topic: 'interview',
			tone: 'neutral',
			text: 'Titre interview neutral : {subject}'
		},
		{
			id: 'headline.interview_favorable',
			topic: 'interview',
			tone: 'favorable',
			text: 'Titre interview favorable : {subject}'
		},
		{
			id: 'headline.ownership_critical',
			topic: 'ownership',
			tone: 'critical',
			text: 'Titre ownership critical : {subject}'
		},
		{
			id: 'headline.ownership_neutral',
			topic: 'ownership',
			tone: 'neutral',
			text: 'Titre ownership neutral : {subject}'
		},
		{
			id: 'headline.ownership_favorable',
			topic: 'ownership',
			tone: 'favorable',
			text: 'Titre ownership favorable : {subject}'
		},
		{ id: 'headline.ambient', topic: 'ambient', tone: 'neutral', text: 'Nouvelle d’ambiance' }
	],
	balance: {
		maxArticlesPerTurn: 3,
		nationalExposure: 30,
		nationalMandateRank: 40,
		regionalNationalPercent: 50,
		toneThreshold: 30,
		toneEffects: { critical: 0, neutral: 0, favorable: 0 },
		maxEffect: 5,
		criticalExposure: 0,
		ownedEffectPercent: 50,
		relationDriftPercent: 10,
		lifestylePercent: 0,
		lifestyleLevel: 2,
		ambientPercent: 0,
		interviewCooldownTurns: 4,
		angleRepeatLimit: 2
	}
};

/**
 * Institutions de test (P3-05) : le cumul (2, 3 ou 4 mandats) et la presse,
 * sans réforme autonome du gouvernement : le PRNG des tests existants est inchangé.
 */
export const fixtureInstitutions = {
	parameters: [
		{
			id: 'institution.cumul',
			label: 'Cumul',
			description: 'Plafond du cumul.',
			startLevel: 'cumul.standard',
			levels: [
				{
					id: 'cumul.single',
					label: 'Deux mandats',
					description: 'Strict.',
					modifiers: { maxMandates: 2 },
					effects: [{ op: 'addSupport', group: 'support.workers', value: 2 }]
				},
				{
					id: 'cumul.standard',
					label: 'Trois mandats',
					description: 'Standard.',
					modifiers: { maxMandates: 3 },
					effects: []
				},
				{
					id: 'cumul.extended',
					label: 'Quatre mandats',
					description: 'Large.',
					modifiers: { maxMandates: 4 },
					effects: []
				}
			]
		},
		{
			id: 'institution.press',
			label: 'Presse',
			description: 'Liberté de la presse.',
			startLevel: 'press.standard',
			levels: [
				{
					id: 'press.standard',
					label: 'Encadrée',
					description: 'Standard.',
					modifiers: {},
					effects: []
				},
				{
					id: 'press.free',
					label: 'Protégée',
					description: 'Libre.',
					modifiers: { criticalPressPercent: 200, nationalExposure: 10 },
					effects: []
				}
			]
		}
	],
	balance: {
		proposerMandates: ['mandate.deputy', 'mandate.minister'],
		baseAdoptionPercent: 50,
		governingBonusPercent: 20,
		ministerMandate: 'mandate.minister',
		ministerBonusPercent: 10,
		apparatusWeightPercent: 0,
		stabilityWeightPercent: 0,
		adoptionPercent: { min: 0, max: 100 },
		rejectionEffects: [{ op: 'addResource', resource: 'influence', value: -5 }],
		autonomousPercent: 0
	}
};

/** Bilan de test (P3-08) : une nécrologie générique par cause, une spécifique, deux distinctions. */
export const fixtureEpitaphs = {
	obituaries: [
		{
			id: 'obituary.death',
			causes: ['natural_causes', 'health_failure'],
			criteria: [],
			headline: 'Disparition à {age} ans',
			text: 'Une carrière de {years} ans.'
		},
		{
			id: 'obituary.office',
			causes: ['natural_causes', 'health_failure'],
			criteria: [{ metric: 'mandatesHeld', cmp: 'gte', value: 1 }],
			headline: 'Hommage à {age} ans',
			text: 'Plus haute fonction : {office}.'
		},
		{
			id: 'obituary.prison',
			causes: ['prison'],
			criteria: [],
			headline: 'Prison à {age} ans',
			text: 'Rideau.'
		},
		{
			id: 'obituary.retirement',
			causes: ['retirement'],
			criteria: [],
			headline: 'Retraite à {age} ans',
			text: 'Après {years} ans de vie publique.'
		}
	],
	distinctions: [
		{
			id: 'distinction.integrity',
			label: 'L’Intègre',
			description: 'Mandat sans fait douteux.',
			criteria: [
				{ metric: 'mandatesHeld', cmp: 'gte', value: 1 },
				{ metric: 'facts', cmp: 'eq', value: 0 }
			]
		},
		{
			id: 'distinction.private_life',
			label: 'La Vie à côté',
			description: 'Aucun mandat.',
			criteria: [{ metric: 'mandatesHeld', cmp: 'eq', value: 0 }]
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
	if (!result.ok) throw new Error(JSON.stringify(result.issues, null, 2));
	return result.content;
}

export const fixtureContent: Content = load();

/** Contenu de test avec des règles de justice modifiées. */
export function withJustice(changes: Partial<Content['justice']>): Content {
	return { ...fixtureContent, justice: { ...fixtureContent.justice, ...changes } };
}

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
	draws: Pick<EventsBalance, 'ordinaryDrawsPerTurn' | 'ordinaryEventChance'> &
		Partial<EventsBalance> = { ordinaryDrawsPerTurn: 1, ordinaryEventChance: 1 },
	base: Content = fixtureContent
): Content {
	return {
		...base,
		eventIds: base.eventIds.filter(
			(id) => eventIds.includes(id) || base.events[id]?.trigger === 'followUp'
		),
		balance: {
			...base.balance,
			events: { repeatPenaltyPercent: 0, maxOccurrences: 0, ...draws }
		}
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

/**
 * Tranche les décisions en attente (P3-29) : au second tour, le choix demandé
 * s'il est possible, sinon le premier choix disponible ; ailleurs, le premier
 * choix disponible.
 */
export function settleDecisions(
	state: GameState,
	content: Content,
	runoff: 'maintain' | 'merge' | 'withdraw' = 'maintain'
): GameState {
	let current = state;
	while (current.phase === 'decision') {
		const view = describePendingEvent(current, content);
		if (!view) break;
		const choice =
			view.choices.find((entry) => entry.id === runoff && entry.available) ??
			view.choices.find((entry) => entry.available);
		if (!choice) throw new Error(`Aucun choix disponible : ${view.eventId}`);
		const result = transition(current, chooseEventCommand(view.instanceId, choice.id), content);
		if (!result.ok) throw new Error(result.error.message);
		current = result.state;
	}
	return current;
}
