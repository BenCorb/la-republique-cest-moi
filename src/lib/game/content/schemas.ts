/**
 * Schémas des catalogues de contenu (ARCHITECTURE.md §7).
 *
 * Première étape de validation : structure, types et bornes (Zod). La seconde
 * étape — unicité, références croisées, cohérence avec l'équilibrage — se trouve
 * dans `validate.ts`. Aucun code exécutable dans le contenu : conditions et
 * effets utilisent uniquement le vocabulaire de `types.ts`.
 *
 * Chaque schéma est typé contre son interface de `types.ts` : un écart entre le
 * schéma et le type utilisé par le moteur est une erreur de compilation.
 */
import { z } from 'zod';
import {
	AXIS_IDS,
	AXIS_MAX,
	AXIS_MIN,
	COMPARISON_OPS,
	INDICATOR_IDS,
	GAUGE_IDS,
	GAUGE_MAX,
	RESOURCE_IDS,
	STAT_IDS,
	TREASURY_IDS,
	UPGRADE_FAMILIES,
	type ActionDefinition,
	type AgeBand,
	type AxisDefinition,
	type CampaignsBalance,
	type CandidateProfileDefinition,
	type EntourageBalance,
	type FamilyBalance,
	type FamilyTemplate,
	type OriginDefinition,
	type ProfessionDefinition,
	type MissionDefinition,
	type PostDefinition,
	type CharactersBalance,
	type ElectionDefinition,
	type ElectionsBalance,
	type InstitutionsDefinition,
	type MandateDefinition,
	type SupportGroupDefinition,
	type SupportsBalance,
	type Balance,
	type Condition,
	type CastMember,
	type Effect,
	type EventChoice,
	type EventDefinition,
	type EventsBalance,
	type PartyDefinition,
	type TraitDefinition,
	type ResourceAmount,
	type UpgradeDefinition,
	type WellbeingBalance,
	type WorldBalance,
	type WorldDefinition
} from './types.ts';

/** Identifiant stable : segments en minuscules séparés par des points (`activism.leaflets`). */
export const CONTENT_ID_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

const contentId = z.string().regex(CONTENT_ID_PATTERN, 'identifiant au format « famille.nom »');
const frenchText = z.string().trim().min(1);
const safeInt = z.number().int().refine(Number.isSafeInteger, 'entier sûr attendu');
const positiveInt = safeInt.refine((value) => value > 0, 'entier strictement positif attendu');
const nonNegativeInt = safeInt.refine((value) => value >= 0, 'entier positif ou nul attendu');
const resourceId = z.enum(RESOURCE_IDS);

export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
	z.discriminatedUnion('op', [
		z.strictObject({ op: z.literal('all'), conditions: z.array(conditionSchema).min(1) }),
		z.strictObject({ op: z.literal('any'), conditions: z.array(conditionSchema).min(1) }),
		z.strictObject({ op: z.literal('not'), condition: conditionSchema }),
		z.strictObject({ op: z.enum(COMPARISON_OPS), stat: z.enum(STAT_IDS), value: safeInt }),
		z.strictObject({ op: z.literal('memberOf'), party: contentId }),
		z.strictObject({ op: z.literal('holdsMandate'), mandate: contentId }),
		z.strictObject({ op: z.literal('canHoldMandate'), mandate: contentId }),
		z.strictObject({ op: z.literal('origin'), origin: contentId }),
		z.strictObject({ op: z.literal('profession'), profession: contentId }),
		z.strictObject({
			op: z.literal('support'),
			group: contentId,
			cmp: z.enum(COMPARISON_OPS),
			value: safeInt
		})
	])
);

/** Parti du catalogue (`party.x`), référence relative ou, pour une adhésion, `target`. */
const partyReference = z.string().regex(/^([a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+|[a-z]+)$/);
const nonZeroGaugeDelta = safeInt.refine(
	(value) => value !== 0 && Math.abs(value) <= GAUGE_MAX,
	'variation non nulle, au plus 100'
);

export const effectSchema: z.ZodType<Effect> = z.union([
	z.strictObject({
		op: z.literal('addResource'),
		resource: resourceId,
		value: safeInt.refine((value) => value !== 0, 'effet nul')
	}),
	z.strictObject({
		op: z.literal('addStat'),
		stat: z.enum(GAUGE_IDS),
		value: safeInt.refine(
			(value) => value !== 0 && Math.abs(value) <= GAUGE_MAX,
			'variation non nulle, au plus 100'
		)
	}),
	z
		.strictObject({
			op: z.literal('addResourceRandom'),
			resource: resourceId,
			min: safeInt,
			max: safeInt
		})
		.refine((effect) => effect.min < effect.max, {
			message: 'min doit être strictement inférieur à max',
			path: ['max']
		}),
	z.strictObject({
		op: z.literal('addIndicator'),
		indicator: z.enum(INDICATOR_IDS),
		value: nonZeroGaugeDelta
	}),
	z.strictObject({
		op: z.literal('addPartyStrength'),
		party: partyReference,
		value: nonZeroGaugeDelta
	}),
	z.strictObject({ op: z.literal('joinParty'), party: partyReference }),
	z.strictObject({ op: z.literal('leaveParty') }),
	z.strictObject({ op: z.literal('addSupport'), group: contentId, value: nonZeroGaugeDelta }),
	z.strictObject({
		op: z.literal('addRelation'),
		role: z.string().regex(/^[a-z][a-z0-9_]*$/, 'rôle en minuscules'),
		value: safeInt.refine(
			(value) => value !== 0 && Math.abs(value) <= 200,
			'variation non nulle, au plus 200'
		),
		memory: z.string().trim().min(1).optional()
	}),
	z.strictObject({
		op: z.literal('revealTraits'),
		role: z.string().regex(/^[a-z][a-z0-9_]*$/, 'rôle en minuscules')
	}),
	z.strictObject({
		op: z.literal('grantMandate'),
		mandate: contentId,
		replaceIncompatible: z.boolean().optional()
	}),
	z.strictObject({
		op: z.literal('endMandate'),
		mandate: z.union([contentId, z.literal('target')])
	}),
	z.strictObject({ op: z.literal('declareCandidacy') }),
	z.strictObject({ op: z.literal('hireStaff') }),
	z.strictObject({ op: z.literal('familyJoins'), relation: z.enum(['partner', 'child']) }),
	z.strictObject({ op: z.literal('separate') }),
	z.strictObject({ op: z.literal('familyAttitude'), value: nonZeroGaugeDelta }),
	z.strictObject({ op: z.literal('dismissStaff') }),
	z.strictObject({ op: z.literal('releaseUpgrade') }),
	z.strictObject({
		op: z.literal('staffLeaves'),
		role: z.string().regex(/^[a-z][a-z0-9_]*$/, 'rôle en minuscules')
	}),
	z.strictObject({
		op: z.literal('prepareCampaign'),
		value: safeInt.refine((value) => value > 0 && value <= 100, 'préparation de 1 à 100')
	}),
	z.strictObject({
		op: z.literal('callEarlyElection'),
		election: contentId,
		delayTurns: safeInt.refine((value) => value >= 1 && value <= 8, 'délai de 1 à 8 trimestres')
	})
]);

export const resourceAmountSchema: z.ZodType<ResourceAmount> = z.strictObject({
	resource: resourceId,
	amount: positiveInt
});

export const actionSchema: z.ZodType<ActionDefinition> = z
	.strictObject({
		id: contentId,
		label: frenchText,
		description: frenchText,
		timeCost: positiveInt,
		maxPerTurn: positiveInt,
		costs: z.array(resourceAmountSchema),
		requires: conditionSchema.optional(),
		unavailableReason: frenchText.optional(),
		effects: z.array(effectSchema).min(1),
		target: z.enum(['party', 'mandate', 'ballot', 'candidate', 'staff', 'upgrade']).optional()
	})
	.refine(
		(action) => (action.requires === undefined) === (action.unavailableReason === undefined),
		{
			message: '« requires » et « unavailableReason » vont ensemble',
			path: ['unavailableReason']
		}
	);

export const actionCatalogSchema = z.strictObject({
	actions: z.array(actionSchema).min(1)
});

export const upgradeSchema: z.ZodType<UpgradeDefinition> = z
	.strictObject({
		id: contentId,
		family: z.enum(UPGRADE_FAMILIES),
		label: frenchText,
		description: frenchText,
		treasury: z.enum(TREASURY_IDS),
		timeCost: nonNegativeInt,
		maxOwned: positiveInt,
		price: z.array(resourceAmountSchema),
		upkeep: z.array(resourceAmountSchema),
		production: z.array(resourceAmountSchema).min(1),
		requires: conditionSchema.optional(),
		unavailableReason: frenchText.optional(),
		ownedLabel: frenchText.optional(),
		releaseEffects: z.array(effectSchema).optional()
	})
	.refine(
		(upgrade) => (upgrade.requires === undefined) === (upgrade.unavailableReason === undefined),
		{ message: '« requires » et « unavailableReason » vont ensemble', path: ['unavailableReason'] }
	);

export const upgradeCatalogSchema = z.strictObject({
	upgrades: z.array(upgradeSchema)
});

const gaugeValue = safeInt.refine((value) => value >= 0 && value <= GAUGE_MAX, 'valeur de 0 à 100');
const probability = z.number().min(0).max(1);

export const ageBandSchema: z.ZodType<AgeBand> = z.strictObject({
	fromAge: nonNegativeInt,
	maxHealth: gaugeValue.refine((value) => value > 0, 'plafond strictement positif'),
	ageingChance: probability,
	ageingHealthLoss: nonNegativeInt,
	mortalityChance: probability
});

export const wellbeingSchema: z.ZodType<WellbeingBalance> = z
	.strictObject({
		startingHealth: gaugeValue.refine((value) => value > 0, 'santé de départ strictement positive'),
		startingStress: gaugeValue,
		workloadThreshold: nonNegativeInt,
		workloadStressPer10Points: nonNegativeInt,
		stressRecoveryPerTurn: nonNegativeInt,
		highStressThreshold: gaugeValue,
		highStressHealthLoss: nonNegativeInt,
		calmStressThreshold: gaugeValue,
		calmHealthGain: nonNegativeInt,
		fragileHealthThreshold: gaugeValue,
		fragileMortalityMultiplier: z.number().min(1),
		ageBands: z.array(ageBandSchema).min(1)
	})
	.refine((wellbeing) => wellbeing.ageBands[0]?.fromAge === 0, {
		message: 'la première tranche d’âge doit commencer à 0',
		path: ['ageBands', 0, 'fromAge']
	})
	.refine(
		(wellbeing) =>
			wellbeing.ageBands.every(
				(band, index) => index === 0 || band.fromAge > (wellbeing.ageBands[index - 1]?.fromAge ?? 0)
			),
		{ message: 'tranches d’âge à trier par âge strictement croissant', path: ['ageBands'] }
	)
	.refine((wellbeing) => wellbeing.calmStressThreshold <= wellbeing.highStressThreshold, {
		message: 'le seuil de calme ne peut dépasser le seuil de stress élevé',
		path: ['calmStressThreshold']
	});

export const eventsBalanceSchema: z.ZodType<EventsBalance> = z.strictObject({
	ordinaryDrawsPerTurn: nonNegativeInt,
	ordinaryEventChance: probability
});

/** Identifiant court : rôle d'acteur, identifiant de choix, étiquette. */
const shortId = z.string().regex(/^[a-z][a-z0-9_]*$/, 'identifiant en minuscules (a-z, 0-9, _)');

export const castMemberSchema: z.ZodType<CastMember> = z.strictObject({
	id: contentId,
	name: frenchText,
	tags: z.array(shortId).min(1),
	age: positiveInt.refine((value) => value <= 110, 'âge de 1 à 110 ans'),
	renewal: z.strictObject({ epithet: frenchText }).optional()
});

export const traitSchema: z.ZodType<TraitDefinition> = z.strictObject({
	id: contentId.refine((value) => value.startsWith('trait.'), 'identifiant « trait.nom »'),
	label: frenchText,
	description: frenchText,
	hidden: z.boolean(),
	positiveRelationPercent: nonNegativeInt.refine((value) => value <= 300, 'au plus 300 %'),
	negativeRelationPercent: nonNegativeInt.refine((value) => value <= 300, 'au plus 300 %'),
	campaignBonus: safeInt.refine((value) => Math.abs(value) <= 20, 'bonus de -20 à 20')
});

export const traitCatalogSchema = z.strictObject({
	traits: z.array(traitSchema).min(1)
});

export const castCatalogSchema = z.strictObject({
	cast: z.array(castMemberSchema)
});

const followUpSchema = z.strictObject({
	eventId: contentId,
	delayTurns: positiveInt
});

const eventChoiceSchema: z.ZodType<EventChoice> = z
	.strictObject({
		id: shortId,
		label: frenchText,
		hints: z.array(frenchText),
		costs: z.array(resourceAmountSchema),
		requires: conditionSchema.optional(),
		unavailableReason: frenchText.optional(),
		effects: z.array(effectSchema),
		followUp: followUpSchema.optional()
	})
	.refine(
		(choice) => (choice.requires === undefined) === (choice.unavailableReason === undefined),
		{
			message: '« requires » et « unavailableReason » vont ensemble',
			path: ['unavailableReason']
		}
	);

const eventBaseShape = {
	id: contentId,
	category: shortId,
	title: frenchText,
	text: frenchText,
	trigger: z.enum(['random', 'followUp']),
	weight: nonNegativeInt,
	priority: safeInt,
	availableFromTurn: safeInt.optional(),
	availableUntilTurn: safeInt.optional(),
	cooldownTurns: nonNegativeInt,
	unique: z.boolean(),
	when: conditionSchema.optional(),
	actors: z.array(
		z
			.strictObject({
				role: shortId,
				tags: z.array(shortId).min(1),
				traits: z.array(contentId).min(1).optional(),
				minAttitude: safeInt.optional(),
				maxAttitude: safeInt.optional(),
				met: z.literal(true).optional()
			})
			.refine(
				(slot) =>
					slot.minAttitude === undefined ||
					slot.maxAttitude === undefined ||
					slot.minAttitude <= slot.maxAttitude,
				{ message: 'attitude minimale supérieure à la maximale', path: ['maxAttitude'] }
			)
	)
};

export const eventSchema: z.ZodType<EventDefinition> = z
	.discriminatedUnion('blocking', [
		z.strictObject({
			...eventBaseShape,
			blocking: z.literal(true),
			choices: z.array(eventChoiceSchema).min(1)
		}),
		z.strictObject({
			...eventBaseShape,
			blocking: z.literal(false),
			// Une brève sans effet est permise : le fil d'actualité est aussi un ressort satirique.
			effects: z.array(effectSchema)
		})
	])
	.refine((event) => event.trigger === 'followUp' || event.weight > 0, {
		message: 'un événement tiré au sort doit avoir un poids strictement positif',
		path: ['weight']
	})
	.refine(
		(event) =>
			event.availableFromTurn === undefined ||
			event.availableUntilTurn === undefined ||
			event.availableFromTurn <= event.availableUntilTurn,
		{ message: 'fenêtre de disponibilité inversée', path: ['availableUntilTurn'] }
	);

export const eventCatalogSchema = z.strictObject({
	events: z.array(eventSchema)
});

const percent = safeInt.refine((value) => value >= 0 && value <= 100, 'pourcentage de 0 à 100');

export const worldBalanceSchema: z.ZodType<WorldBalance> = z
	.strictObject({
		startingIndicators: z.strictObject({
			economy: gaugeValue,
			socialClimate: gaugeValue,
			stability: gaugeValue
		}),
		indicatorBaseline: gaugeValue,
		indicatorReversionPercent: percent,
		indicatorVolatility: nonNegativeInt,
		minPartyStrength: gaugeValue,
		maxPartyStrength: gaugeValue,
		strengthReversionPercent: percent,
		strengthVolatility: nonNegativeInt,
		governingIndicatorDivisor: positiveInt,
		leaderChangeChance: probability,
		leaderMinAge: positiveInt,
		leaderMaxAge: positiveInt,
		leaderRetirementAge: positiveInt
	})
	.refine((world) => world.minPartyStrength <= world.maxPartyStrength, {
		message: 'force minimale supérieure à la force maximale',
		path: ['maxPartyStrength']
	})
	.refine((world) => world.leaderMinAge <= world.leaderMaxAge, {
		message: 'âge minimal des dirigeants supérieur à l’âge maximal',
		path: ['leaderMaxAge']
	})
	.refine((world) => world.leaderMaxAge < world.leaderRetirementAge, {
		message: 'l’âge de retraite doit dépasser l’âge maximal des nouveaux dirigeants',
		path: ['leaderRetirementAge']
	});

const axisPosition = safeInt.refine(
	(value) => value >= AXIS_MIN && value <= AXIS_MAX,
	'position de -100 à 100'
);

export const partySchema: z.ZodType<PartyDefinition> = z.strictObject({
	id: contentId.refine((value) => value.startsWith('party.'), 'identifiant « party.nom »'),
	name: frenchText,
	acronym: frenchText,
	family: frenchText,
	description: frenchText,
	positions: z.strictObject({
		economy: axisPosition,
		society: axisPosition,
		sovereignty: axisPosition
	}),
	baseStrength: positiveInt
});

const axisSchema: z.ZodType<AxisDefinition> = z.strictObject({
	id: z.enum(AXIS_IDS),
	label: frenchText,
	negativeLabel: frenchText,
	positiveLabel: frenchText
});

export const worldSchema: z.ZodType<WorldDefinition> = z.strictObject({
	axes: z.array(axisSchema).length(AXIS_IDS.length),
	parties: z.array(partySchema).min(2),
	startingGoverningParty: contentId,
	names: z.strictObject({
		first: z.array(frenchText).min(2),
		last: z.array(frenchText).min(2)
	})
});

export const charactersBalanceSchema: z.ZodType<CharactersBalance> = z
	.strictObject({
		traitsPerCharacter: nonNegativeInt,
		retirementAge: positiveInt,
		replacementMinAge: positiveInt,
		replacementMaxAge: positiveInt,
		revealChancePerEncounter: probability,
		maxMemories: positiveInt
	})
	.refine((balance) => balance.replacementMinAge <= balance.replacementMaxAge, {
		message: 'âge minimal des remplaçants supérieur à l’âge maximal',
		path: ['replacementMaxAge']
	})
	.refine((balance) => balance.replacementMaxAge < balance.retirementAge, {
		message: 'un remplaçant doit être plus jeune que l’âge de retraite',
		path: ['replacementMaxAge']
	});

export const electionsBalanceSchema: z.ZodType<ElectionsBalance> = z.strictObject({
	voteVolatility: nonNegativeInt,
	momentum: nonNegativeInt,
	newGovernmentStability: gaugeValue,
	alertLeadTurns: nonNegativeInt
});

export const electionSchema: z.ZodType<ElectionDefinition> = z
	.strictObject({
		id: contentId.refine((value) => value.startsWith('election.'), 'identifiant « election.nom »'),
		label: frenchText,
		firstTurn: nonNegativeInt,
		cycleTurns: positiveInt,
		filingLeadTurns: nonNegativeInt,
		scope: z.enum(['local', 'regional', 'national']),
		decidesGovernment: z.boolean(),
		minAge: positiveInt,
		grants: contentId,
		bonusGrant: z.strictObject({ mandate: contentId, minPercent: gaugeValue }).optional(),
		requiresAnyMandate: z.array(contentId),
		rivalStrength: gaugeValue
	})
	.refine((election) => election.filingLeadTurns < election.cycleTurns, {
		message: 'la clôture des candidatures doit précéder le scrutin dans le cycle',
		path: ['filingLeadTurns']
	});

export const mandateSchema: z.ZodType<MandateDefinition> = z.strictObject({
	id: contentId.refine((value) => value.startsWith('mandate.'), 'identifiant « mandate.nom »'),
	label: frenchText,
	rank: nonNegativeInt,
	election: contentId.nullable(),
	endsWithGovernment: z.boolean(),
	requires: z.array(contentId),
	timePerTurn: nonNegativeInt,
	income: z.array(resourceAmountSchema),
	stressPerTurn: nonNegativeInt
});

const institutionsSchema: z.ZodType<InstitutionsDefinition> = z.strictObject({
	incompatibilities: z.array(z.tuple([contentId, contentId])),
	maxMandates: positiveInt
});

export const careerCatalogSchema = z.strictObject({
	elections: z.array(electionSchema).min(1),
	mandates: z.array(mandateSchema).min(1),
	institutions: institutionsSchema
});

export const supportsBalanceSchema: z.ZodType<SupportsBalance> = z.strictObject({
	reversionPercent: percent,
	partyAlignmentMax: gaugeValue,
	influencePerPoint: positiveInt,
	notorietyMax: gaugeValue
});

export const supportGroupSchema: z.ZodType<SupportGroupDefinition> = z
	.strictObject({
		id: contentId.refine((value) => value.startsWith('support.'), 'identifiant « support.nom »'),
		label: frenchText,
		description: frenchText,
		kind: z.enum(['electoral', 'influence']),
		weight: nonNegativeInt,
		startingSupport: gaugeValue,
		preferences: z.strictObject({
			economy: axisPosition,
			society: axisPosition,
			sovereignty: axisPosition
		}),
		judgesParty: z.boolean(),
		affiliationBonus: safeInt.refine(
			(value) => Math.abs(value) <= GAUGE_MAX,
			'bonus de -100 à 100'
		),
		mandateBonus: safeInt.refine((value) => Math.abs(value) <= GAUGE_MAX, 'bonus de -100 à 100')
	})
	.refine((group) => (group.kind === 'electoral') === group.weight > 0, {
		message: 'seuls les groupes électoraux ont un poids (strictement positif)',
		path: ['weight']
	});

export const supportCatalogSchema = z.strictObject({
	groups: z.array(supportGroupSchema).min(1)
});

export const campaignsBalanceSchema: z.ZodType<CampaignsBalance> = z.strictObject({
	popularityWeightPercent: percent,
	partyWeightPercent: percent,
	preparationWeightPercent: percent,
	preparationCap: nonNegativeInt,
	incumbentBonus: nonNegativeInt,
	volatility: nonNegativeInt,
	passivePreparation: nonNegativeInt,
	stressPerTurn: nonNegativeInt,
	investitureMinApparatus: gaugeValue,
	apparatusGroup: contentId,
	victoryInfluence: nonNegativeInt,
	defeatInfluence: nonNegativeInt,
	defeatStress: nonNegativeInt,
	rivalExperienceBonus: nonNegativeInt,
	rivalExperienceCap: nonNegativeInt,
	rivalryAttitude: safeInt.refine((value) => Math.abs(value) <= 100, 'variation de -100 à 100'),
	opponentMaxAge: positiveInt
});

export const entourageBalanceSchema: z.ZodType<EntourageBalance> = z
	.strictObject({
		candidatesPerPost: positiveInt.refine((value) => value <= 6, 'au plus 6 candidats'),
		competenceReference: positiveInt,
		hireAttitude: safeInt,
		unpaidAttitude: safeInt,
		dismissAttitude: safeInt,
		resignAttitude: safeInt.refine((value) => value >= -100 && value <= 0, 'seuil de -100 à 0'),
		preciseAdviceCompetence: gaugeValue,
		fairAdviceCompetence: gaugeValue,
		poorAdviceErrorChance: probability
	})
	.refine((balance) => balance.fairAdviceCompetence <= balance.preciseAdviceCompetence, {
		message: 'le seuil du conseil indicatif dépasse celui du conseil précis',
		path: ['fairAdviceCompetence']
	});

const missionSchema: z.ZodType<MissionDefinition> = z.strictObject({
	id: contentId.refine((value) => value.startsWith('mission.'), 'identifiant « mission.nom »'),
	label: frenchText,
	description: frenchText,
	effects: z.array(effectSchema),
	timeBonus: nonNegativeInt,
	pollPrecision: z.boolean()
});

export const postSchema: z.ZodType<PostDefinition> = z
	.strictObject({
		id: contentId.refine((value) => value.startsWith('post.'), 'identifiant « post.nom »'),
		label: frenchText,
		description: frenchText,
		tag: shortId,
		salaryCents: nonNegativeInt,
		requires: conditionSchema.optional(),
		unavailableReason: frenchText.optional(),
		adviceCategories: z.array(shortId),
		missions: z.array(missionSchema).min(1)
	})
	.refine((post) => (post.requires === undefined) === (post.unavailableReason === undefined), {
		message: '« requires » et « unavailableReason » vont ensemble',
		path: ['unavailableReason']
	});

const candidateProfileSchema: z.ZodType<CandidateProfileDefinition> = z
	.strictObject({
		id: contentId.refine((value) => value.startsWith('profile.'), 'identifiant « profile.nom »'),
		label: frenchText,
		minCompetence: gaugeValue,
		maxCompetence: gaugeValue,
		traits: z.array(contentId)
	})
	.refine((profile) => profile.minCompetence <= profile.maxCompetence, {
		message: 'compétence minimale supérieure à la maximale',
		path: ['maxCompetence']
	});

export const entourageCatalogSchema = z.strictObject({
	posts: z.array(postSchema).min(1),
	profiles: z.array(candidateProfileSchema).min(1)
});

export const familyBalanceSchema: z.ZodType<FamilyBalance> = z.strictObject({
	childCostCents: nonNegativeInt,
	childIndependenceAge: positiveInt,
	neglectThreshold: nonNegativeInt,
	neglectAttitude: safeInt,
	supportiveAttitude: safeInt,
	hostileAttitude: safeInt,
	partnerStress: nonNegativeInt,
	partnerAgeSpread: nonNegativeInt
});

const familyTemplateSchema: z.ZodType<FamilyTemplate> = z
	.strictObject({
		relation: z.enum(['parent', 'sibling']),
		minAge: positiveInt,
		maxAge: positiveInt,
		attitude: safeInt.refine((value) => Math.abs(value) <= 100, 'attitude de -100 à 100'),
		tags: z.array(shortId)
	})
	.refine((member) => member.minAge <= member.maxAge, {
		message: 'âge minimal supérieur à l’âge maximal',
		path: ['maxAge']
	});

export const originSchema: z.ZodType<OriginDefinition> = z.strictObject({
	id: contentId.refine((value) => value.startsWith('origin.'), 'identifiant « origin.nom »'),
	label: frenchText,
	description: frenchText,
	effects: z.array(effectSchema),
	family: z.array(familyTemplateSchema),
	inheritanceCents: nonNegativeInt
});

export const professionSchema: z.ZodType<ProfessionDefinition> = z.strictObject({
	id: contentId.refine(
		(value) => value.startsWith('profession.'),
		'identifiant « profession.nom »'
	),
	label: frenchText,
	description: frenchText,
	effects: z.array(effectSchema)
});

export const profileCatalogSchema = z.strictObject({
	origins: z.array(originSchema).min(1),
	professions: z.array(professionSchema).min(1),
	defaults: z.strictObject({ origin: contentId, profession: contentId })
});

export const balanceSchema: z.ZodType<Balance> = z.strictObject({
	timeBudgetPerTurn: positiveInt,
	startingResources: z.strictObject({
		influence: nonNegativeInt,
		politicalBudgetCents: nonNegativeInt,
		personalCashCents: nonNegativeInt
	}),
	wellbeing: wellbeingSchema,
	events: eventsBalanceSchema,
	world: worldBalanceSchema,
	characters: charactersBalanceSchema,
	elections: electionsBalanceSchema,
	supports: supportsBalanceSchema,
	campaigns: campaignsBalanceSchema,
	entourage: entourageBalanceSchema,
	family: familyBalanceSchema
});
