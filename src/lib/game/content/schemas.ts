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
	HIRE_OFFERS,
	ARTICLE_TONES,
	END_CAUSES,
	LEGACY_METRICS,
	ARTICLE_TOPICS,
	AXIS_IDS,
	AXIS_MAX,
	MEDIA_KINDS,
	MEDIA_RELATION_MAX,
	AXIS_MIN,
	COMPARISON_OPS,
	FACT_SEVERITY_MAX,
	INDICATOR_IDS,
	GAUGE_IDS,
	GAUGE_MAX,
	RESOURCE_IDS,
	CAPABILITY_IDS,
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
	type TerritoryDefinition,
	type MissionDefinition,
	type PostDefinition,
	type CharactersBalance,
	type ElectionDefinition,
	type ElectionsBalance,
	type InstitutionsDefinition,
	type JusticeBalance,
	type JusticeDefinition,
	type OffenseDefinition,
	type AssetDefinition,
	type LifestyleDefinition,
	type WealthDefinition,
	type PromiseDefinition,
	type PromisesBalance,
	type PromisesDefinition,
	type HeadlineDefinition,
	type DistinctionDefinition,
	type EpitaphsCatalog,
	type LegacyCriterion,
	type ObituaryDefinition,
	type InstitutionLevel,
	type InstitutionModifiers,
	type InstitutionParameter,
	type ReformsBalance,
	type ReformsCatalog,
	type MediaCatalog,
	type MediaDefinition,
	type PressBalance,
	type SentenceRule,
	type MandateDefinition,
	type SupportGroupDefinition,
	type SupportsBalance,
	type Balance,
	type RecruitmentBalance,
	type SearchBalance,
	type SearchLevelBalance,
	type VettingBalance,
	type ProgressionBalance,
	SEARCH_LEVELS,
	VETTING_LEVELS,
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
	type WorldDefinition,
	type EraDefinition
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
		z.strictObject({ op: z.literal('lifestyle'), lifestyle: contentId }),
		z.strictObject({ op: z.literal('ownsUpgrade'), upgrade: contentId }),
		z.strictObject({ op: z.literal('institution'), parameter: contentId, level: contentId }),
		z.strictObject({ op: z.literal('capability'), capability: z.enum(CAPABILITY_IDS) }),
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
	z.strictObject({ op: z.literal('hireStaff'), offer: z.enum(HIRE_OFFERS).optional() }),
	z.strictObject({ op: z.literal('courtCandidate') }),
	z.strictObject({ op: z.literal('orderSearch'), level: z.enum(SEARCH_LEVELS) }),
	z.strictObject({ op: z.literal('vetCandidate') }),
	z.strictObject({
		op: z.literal('grantRaise'),
		role: z.string().regex(/^[a-z][a-z0-9_]*$/, 'rôle en minuscules')
	}),
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
	z.strictObject({ op: z.literal('setLifestyle'), lifestyle: contentId }),
	z.strictObject({
		op: z.literal('hireActor'),
		role: z.string().regex(/^[a-z][a-z0-9_]*$/, 'rôle en minuscules'),
		replace: z.literal(true).optional()
	}),
	z.strictObject({
		op: z.literal('shortlistActor'),
		role: z.string().regex(/^[a-z][a-z0-9_]*$/, 'rôle en minuscules'),
		profile: contentId
	}),
	z.strictObject({
		op: z.literal('recordFact'),
		offense: contentId,
		severity: safeInt.refine(
			(value) => value >= 1 && value <= FACT_SEVERITY_MAX,
			`gravité de 1 à ${FACT_SEVERITY_MAX}`
		),
		divertedCents: nonNegativeInt.optional(),
		author: z
			.string()
			.regex(/^[a-z][a-z0-9_]*$/, 'rôle en minuscules')
			.optional(),
		accomplices: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/, 'rôle en minuscules')).optional()
	}),
	z.strictObject({
		op: z.literal('callEarlyElection'),
		election: contentId,
		delayTurns: safeInt.refine((value) => value >= 1 && value <= 8, 'délai de 1 à 8 trimestres')
	}),
	z.strictObject({ op: z.literal('makePromise') }),
	z.strictObject({
		op: z.literal('advancePromise'),
		value: safeInt.refine((value) => value > 0 && value <= 100, 'avancement de 1 à 100')
	}),
	z.strictObject({ op: z.literal('amendPromise') }),
	z.strictObject({ op: z.literal('abandonPromise') }),
	z.strictObject({
		op: z.literal('addMediaRelation'),
		media: z.union([contentId, z.literal('target')]),
		value: safeInt.refine(
			(value) => value !== 0 && Math.abs(value) <= MEDIA_RELATION_MAX,
			'variation non nulle de -100 à 100'
		)
	}),
	z.strictObject({ op: z.literal('giveInterview') }),
	z.strictObject({ op: z.literal('proposeReform') })
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
		target: z
			.enum([
				'party',
				'mandate',
				'ballot',
				'candidate',
				'staff',
				'upgrade',
				'asset',
				'promise',
				'pledge',
				'media',
				'reform',
				'search'
			])
			.optional(),
		fromEra: contentId.optional(),
		category: z
			.string()
			.regex(/^[a-z][a-z0-9_]*$/, 'identifiant en minuscules (a-z, 0-9, _)')
			.optional()
	})
	.refine(
		(action) => (action.requires === undefined) === (action.unavailableReason === undefined),
		{
			message: '« requires » et « unavailableReason » vont ensemble',
			path: ['unavailableReason']
		}
	);

export const actionCatalogSchema = z.strictObject({
	/** Thèmes de l'agenda, dans l'ordre d'affichage. */
	categories: z
		.array(
			z.strictObject({
				id: z.string().regex(/^[a-z][a-z0-9_]*$/, 'identifiant en minuscules (a-z, 0-9, _)'),
				label: frenchText
			})
		)
		.optional(),
	actions: z.array(actionSchema).min(1)
});

const smallPercent = safeInt.refine((value) => Math.abs(value) <= 100, 'pourcentage de -100 à 100');

export const assetSchema: z.ZodType<AssetDefinition> = z.strictObject({
	annualYieldPercent: smallPercent,
	annualGrowthPercent: smallPercent,
	volatilityPercent: smallPercent.refine((value) => value >= 0, 'aléa positif ou nul'),
	economySensitivityPercent: smallPercent,
	failurePerMille: safeInt.refine((value) => value >= 0 && value <= 1000, 'de 0 à 1000'),
	salePercent: smallPercent.refine((value) => value >= 0, 'part positive ou nulle'),
	stressPerTurn: smallPercent,
	media: contentId.optional()
});

export const lifestyleSchema: z.ZodType<LifestyleDefinition> = z.strictObject({
	id: contentId,
	label: frenchText,
	description: frenchText,
	level: nonNegativeInt,
	costCents: nonNegativeInt,
	stressPerTurn: smallPercent,
	exposure: smallPercent
});

/** Trains de vie (`wealth.json`, P3-02). */
export const wealthCatalogSchema: z.ZodType<WealthDefinition> = z.strictObject({
	lifestyles: z.array(lifestyleSchema).min(1),
	defaultLifestyle: contentId,
	unpaidLifestyleStress: nonNegativeInt
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
		production: z.array(resourceAmountSchema),
		requires: conditionSchema.optional(),
		unavailableReason: frenchText.optional(),
		ownedLabel: frenchText.optional(),
		fromEra: contentId.optional(),
		releaseEffects: z.array(effectSchema).optional(),
		asset: assetSchema.optional()
	})
	.refine(
		(upgrade) => (upgrade.requires === undefined) === (upgrade.unavailableReason === undefined),
		{ message: '« requires » et « unavailableReason » vont ensemble', path: ['unavailableReason'] }
	)
	// Un actif rapporte selon sa valeur ; les autres améliorations produisent toujours quelque chose.
	.refine((upgrade) => upgrade.asset !== undefined || upgrade.production.length > 0, {
		message: 'production attendue (sauf pour un actif)',
		path: ['production']
	});

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
	ordinaryEventChance: probability,
	repeatPenaltyPercent: nonNegativeInt,
	maxOccurrences: nonNegativeInt
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
		followUp: followUpSchema.optional(),
		outcome: z.array(frenchText).min(1).optional()
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
	eras: z.array(contentId).min(1).optional(),
	maxOccurrences: positiveInt.optional(),
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
	),
	subject: z.enum(['promise', 'post', 'staff']).optional()
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

export const eraSchema: z.ZodType<EraDefinition> = z.strictObject({
	id: contentId,
	label: frenchText,
	description: frenchText,
	fromYear: safeInt
});

export const worldSchema: z.ZodType<WorldDefinition> = z.strictObject({
	eras: z.array(eraSchema).min(1),
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
		rivalStrength: gaugeValue,
		campaignRefundCents: nonNegativeInt.optional()
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

export const offenseSchema: z.ZodType<OffenseDefinition> = z.strictObject({
	id: contentId,
	label: frenchText,
	description: frenchText,
	capability: z.enum(CAPABILITY_IDS)
});

const intRange = z
	.strictObject({ min: nonNegativeInt, max: nonNegativeInt })
	.refine((range) => range.min <= range.max, { message: 'min doit être inférieur ou égal à max' });

const sentenceRuleSchema: z.ZodType<SentenceRule> = z.strictObject({
	fineCents: intRange,
	ineligibilityTurns: intRange,
	prison: z.enum(['none', 'suspended', 'firm_possible']),
	firmPrisonPercent: percent
});

export const justiceBalanceSchema: z.ZodType<JusticeBalance> = z.strictObject({
	riskPerSeverity: gaugeValue,
	accompliceRiskPercent: percent,
	prescriptionTurns: positiveInt,
	exposureRiskBonusPercent: percent,
	baseExposure: gaugeValue,
	campaignExposure: gaugeValue,
	mandateExposure: z.record(contentId, gaugeValue),
	exposureDriftPercent: percent,
	revealPercentPerSeverity: percent,
	investigationTurns: intRange,
	trialDelayTurns: intRange,
	appealTurns: intRange,
	dismissalBasePercent: percent,
	dismissalPerSeverityPercent: percent,
	defenseDismissalPercent: percent,
	convictionPercentBySeverity: z.array(percent).length(FACT_SEVERITY_MAX),
	defenseConvictionPercent: percent,
	sentences: z.array(sentenceRuleSchema).length(FACT_SEVERITY_MAX),
	revelationExposure: gaugeValue,
	revelationSupport: gaugeValue,
	revelationStress: gaugeValue,
	indictmentStress: gaugeValue,
	indictmentSupport: gaugeValue,
	convictionSupport: gaugeValue,
	convictionStress: gaugeValue,
	acquittalRelief: gaugeValue,
	entourageImpactPercent: percent,
	defenseDecayPercent: percent,
	revelationEvent: contentId,
	entourageRevelationEvent: contentId
});

/** Registre des faits et jauges de la justice (`justice.json`, P3-01). */
export const justiceCatalogSchema: z.ZodType<JusticeDefinition> = z.strictObject({
	offenses: z.array(offenseSchema).min(1),
	balance: justiceBalanceSchema
});

export const promiseSchema: z.ZodType<PromiseDefinition> = z.strictObject({
	id: contentId,
	label: frenchText,
	theme: frenchText,
	description: frenchText,
	elections: z.array(contentId).min(1),
	dilemmaEvent: contentId,
	announce: z.array(effectSchema),
	kept: z.array(effectSchema),
	partial: z.array(effectSchema),
	abandoned: z.array(effectSchema)
});

export const promisesBalanceSchema: z.ZodType<PromisesBalance> = z.strictObject({
	maxPerCampaign: positiveInt,
	announcePreparation: nonNegativeInt,
	deliveryTurns: positiveInt,
	dilemmaDelayTurns: intRange,
	partialProgress: safeInt.refine((value) => value >= 1 && value <= 99, 'avancement de 1 à 99'),
	recallPercent: percent,
	maxRecalls: nonNegativeInt,
	recallEvents: z.strictObject({ kept: contentId, abandoned: contentId })
});

const mediaCoverage = safeInt.refine((value) => value >= 0 && value <= 10, 'goût de 0 à 10');

export const mediaSchema: z.ZodType<MediaDefinition> = z.strictObject({
	id: contentId,
	name: frenchText,
	kind: z.enum(MEDIA_KINDS),
	line: frenchText,
	description: frenchText,
	scope: z.enum(['national', 'local']),
	audience: safeInt.refine((value) => value >= 1 && value <= 100, 'audience de 1 à 100'),
	baseRelation: smallPercent,
	groups: z.array(contentId).min(1),
	coverage: z.strictObject({
		justice: mediaCoverage,
		promise: mediaCoverage,
		election: mediaCoverage,
		lifestyle: mediaCoverage,
		ownership: mediaCoverage
	}),
	amplifyPercent: safeInt.refine((value) => value >= 0 && value <= 300, 'de 0 à 300 %')
});

export const headlineSchema: z.ZodType<HeadlineDefinition> = z.strictObject({
	id: contentId,
	topic: z.enum(ARTICLE_TOPICS),
	tone: z.enum(ARTICLE_TONES),
	text: frenchText,
	kinds: z.array(z.enum(MEDIA_KINDS)).min(1).optional(),
	details: z
		.array(z.string().regex(/^[a-z][a-z_]*$/, 'précision en minuscules'))
		.min(1)
		.optional(),
	fromYear: safeInt.optional()
});

const toneEffect = safeInt.refine((value) => Math.abs(value) <= 20, 'effet de -20 à 20');

export const pressBalanceSchema: z.ZodType<PressBalance> = z.strictObject({
	maxArticlesPerTurn: positiveInt,
	nationalExposure: safeInt.refine((value) => value >= 0 && value <= 100, 'de 0 à 100'),
	toneThreshold: safeInt.refine((value) => value >= 1 && value <= 100, 'de 1 à 100'),
	toneEffects: z.strictObject({ critical: toneEffect, neutral: toneEffect, favorable: toneEffect }),
	maxEffect: positiveInt,
	criticalExposure: nonNegativeInt,
	ownedEffectPercent: percent,
	relationDriftPercent: percent,
	lifestylePercent: percent,
	lifestyleLevel: nonNegativeInt,
	ambientPercent: percent,
	interviewCooldownTurns: nonNegativeInt,
	angleRepeatLimit: positiveInt
});

const modifierPercent = safeInt.refine((value) => value >= 0 && value <= 300, 'de 0 à 300 %');

export const institutionModifiersSchema: z.ZodType<InstitutionModifiers> = z.strictObject({
	maxMandates: positiveInt.optional(),
	revealPercent: modifierPercent.optional(),
	convictionPercent: modifierPercent.optional(),
	dismissalBonus: smallPercent.optional(),
	popularityWeightPercent: percent.optional(),
	partyWeightPercent: percent.optional(),
	incumbentBonus: nonNegativeInt.optional(),
	criticalPressPercent: modifierPercent.optional(),
	nationalExposure: percent.optional()
});

export const institutionLevelSchema: z.ZodType<InstitutionLevel> = z.strictObject({
	id: contentId,
	label: frenchText,
	description: frenchText,
	modifiers: institutionModifiersSchema,
	effects: z.array(effectSchema)
});

export const institutionParameterSchema: z.ZodType<InstitutionParameter> = z.strictObject({
	id: contentId,
	label: frenchText,
	description: frenchText,
	startLevel: contentId,
	levels: z.array(institutionLevelSchema).min(2)
});

export const reformsBalanceSchema: z.ZodType<ReformsBalance> = z.strictObject({
	proposerMandates: z.array(contentId).min(1),
	baseAdoptionPercent: percent,
	governingBonusPercent: percent,
	ministerMandate: contentId,
	ministerBonusPercent: percent,
	apparatusWeightPercent: percent,
	stabilityWeightPercent: percent,
	adoptionPercent: intRange,
	rejectionEffects: z.array(effectSchema),
	autonomousPercent: percent
});

/** Paramètres institutionnels et règles des réformes (`institutions.json`, P3-05). */
export const reformsCatalogSchema: z.ZodType<ReformsCatalog> = z.strictObject({
	parameters: z.array(institutionParameterSchema).min(1),
	balance: reformsBalanceSchema
});

export const legacyCriterionSchema: z.ZodType<LegacyCriterion> = z.strictObject({
	metric: z.enum(LEGACY_METRICS),
	cmp: z.enum(COMPARISON_OPS),
	value: safeInt
});

export const obituarySchema: z.ZodType<ObituaryDefinition> = z.strictObject({
	id: contentId,
	causes: z.array(z.enum(END_CAUSES)).min(1),
	criteria: z.array(legacyCriterionSchema),
	headline: frenchText,
	text: frenchText
});

export const distinctionSchema: z.ZodType<DistinctionDefinition> = z.strictObject({
	id: contentId,
	label: frenchText,
	description: frenchText,
	criteria: z.array(legacyCriterionSchema).min(1)
});

/** Nécrologies et distinctions du bilan final (`epitaphs.json`, P3-08). */
export const epitaphsCatalogSchema: z.ZodType<EpitaphsCatalog> = z.strictObject({
	obituaries: z.array(obituarySchema).min(1),
	distinctions: z.array(distinctionSchema).min(1)
});

/** Médias, titres de presse et règles du fil de presse (`media.json`, P3-03). */
export const mediaCatalogSchema: z.ZodType<MediaCatalog> = z.strictObject({
	media: z.array(mediaSchema).min(1),
	headlines: z.array(headlineSchema).min(1),
	balance: pressBalanceSchema
});

/** Promesses types et règles du registre (`promises.json`, P3-04). */
export const promisesCatalogSchema: z.ZodType<PromisesDefinition> = z.strictObject({
	promises: z.array(promiseSchema).min(1),
	balance: promisesBalanceSchema
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
	refundMinPercent: gaugeValue,
	rivalExperienceBonus: nonNegativeInt,
	rivalExperienceCap: nonNegativeInt,
	rivalryAttitude: safeInt.refine((value) => Math.abs(value) <= 100, 'variation de -100 à 100'),
	opponentMaxAge: positiveInt
});

const hireOfferSchema = z.strictObject({
	salaryPercent: positiveInt.refine((value) => value <= 300, 'au plus 300 %'),
	interest: safeInt.refine((value) => Math.abs(value) <= 50, 'de -50 à 50'),
	attitude: safeInt.refine((value) => Math.abs(value) <= 50, 'de -50 à 50'),
	bonusPercent: nonNegativeInt.refine((value) => value <= 400, 'au plus 400 %')
});

const recruitmentBalanceSchema: z.ZodType<RecruitmentBalance> = z
	.strictObject({
		salaryCurve: z.array(z.strictObject({ competence: gaugeValue, percent: positiveInt })).min(2),
		salaryRoundingCents: positiveInt,
		offers: z.strictObject({
			low: hireOfferSchema,
			standard: hireOfferSchema,
			generous: hireOfferSchema
		}),
		influenceMax: nonNegativeInt,
		influencePerRoot: nonNegativeInt,
		popularityMax: nonNegativeInt,
		mandateRankForMax: positiveInt,
		mandateMax: nonNegativeInt,
		apparatusMax: nonNegativeInt,
		coveredQuartersForMax: positiveInt,
		payrollMax: nonNegativeInt,
		demandPercent: nonNegativeInt,
		baseAcceptPercent: gaugeValue,
		acceptPerPoint: nonNegativeInt,
		minAcceptPercent: gaugeValue,
		maxAcceptPercent: gaugeValue,
		interviewInterest: nonNegativeInt,
		maxInterviews: nonNegativeInt,
		refusalAttitude: safeInt.refine((value) => Math.abs(value) <= 100, 'de -100 à 100')
	})
	.refine(
		(balance) =>
			balance.salaryCurve.every(
				(point, index) =>
					index === 0 || point.competence > balance.salaryCurve[index - 1]!.competence
			),
		{ message: 'courbe de salaire par compétence strictement croissante', path: ['salaryCurve'] }
	)
	.refine(
		(balance) =>
			balance.influenceMax +
				balance.popularityMax +
				balance.mandateMax +
				balance.apparatusMax +
				balance.payrollMax <=
			100,
		{ message: 'l’attractivité ne dépasse pas 100', path: ['payrollMax'] }
	)
	.refine((balance) => balance.minAcceptPercent <= balance.maxAcceptPercent, {
		message: 'bornes d’acceptation inversées',
		path: ['maxAcceptPercent']
	});

const searchLevelBalanceSchema: z.ZodType<SearchLevelBalance> = z.strictObject({
	costCents: nonNegativeInt,
	delayTurns: positiveInt.refine((value) => value <= 8, 'au plus 8 trimestres'),
	candidates: positiveInt.refine((value) => value <= 6, 'au plus 6 candidats'),
	findPercent: gaugeValue,
	profile: contentId.nullable(),
	traitAllowed: z.boolean(),
	vetting: z.enum(VETTING_LEVELS).nullable()
});

const searchBalanceSchema: z.ZodType<SearchBalance> = z.strictObject({
	levels: z.strictObject({
		simple: searchLevelBalanceSchema,
		targeted: searchLevelBalanceSchema,
		headhunt: searchLevelBalanceSchema
	}),
	traitPenalty: gaugeValue,
	failureRefundPercent: gaugeValue,
	maxShortlist: positiveInt.refine((value) => value <= 8, 'au plus 8 candidats')
});

const vettingBalanceSchema: z.ZodType<VettingBalance> = z.strictObject({
	truePercent: gaugeValue,
	falsePercent: gaugeValue
});

const progressionBalanceSchema: z.ZodType<ProgressionBalance> = z
	.strictObject({
		curve: z.array(z.strictObject({ competence: gaugeValue, tenths: nonNegativeInt })).min(1),
		seniorityAttitude: nonNegativeInt
	})
	.refine(
		(balance) =>
			balance.curve.every(
				(point, index) => index === 0 || point.competence > balance.curve[index - 1]!.competence
			),
		{ message: 'courbe de progression par compétence strictement croissante', path: ['curve'] }
	);

export const entourageBalanceSchema: z.ZodType<EntourageBalance> = z
	.strictObject({
		candidatesPerPost: positiveInt.refine((value) => value <= 6, 'au plus 6 candidats'),
		competenceReference: positiveInt,
		hireAttitude: safeInt,
		unpaidAttitude: safeInt,
		hireReserveQuarters: positiveInt.refine((value) => value <= 8, 'au plus 8 trimestres'),
		dismissAttitude: safeInt,
		resignAttitude: safeInt.refine((value) => value >= -100 && value <= 0, 'seuil de -100 à 0'),
		preciseAdviceCompetence: gaugeValue,
		fairAdviceCompetence: gaugeValue,
		poorAdviceErrorChance: probability,
		recruitment: recruitmentBalanceSchema,
		search: searchBalanceSchema,
		vetting: z.strictObject({ standard: vettingBalanceSchema, thorough: vettingBalanceSchema }),
		progression: progressionBalanceSchema,
		renegotiation: z.strictObject({
			stepCompetence: positiveInt,
			minTurns: positiveInt,
			event: contentId
		})
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
		traits: z.array(contentId),
		minAttractiveness: gaugeValue,
		rareWeight: nonNegativeInt,
		searchOnly: z.boolean().optional()
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

/** Fragment toponymique : mot français à majuscule, traits d'union et apostrophes permis. */
const toponym = z
	.string()
	.regex(/^[A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-öø-ÿ’' -]*[a-zà-öø-ÿ]$/u, 'fragment toponymique mal formé')
	.max(30);

const territorySchema: z.ZodType<TerritoryDefinition> = z.strictObject({
	regions: z
		.array(
			z.strictObject({
				id: contentId.refine((value) => value.startsWith('region.'), 'identifiant « region.nom »'),
				name: frenchText,
				departments: z
					.array(
						z.strictObject({
							code: z.string().regex(/^(\d{2}|2[AB])$/u, 'code de département'),
							name: frenchText,
							startable: z.boolean()
						})
					)
					.min(1),
				toponymy: z.strictObject({
					roots: z.array(toponym).min(3),
					rivers: z.array(toponym).min(1),
					pays: z.array(toponym),
					patterns: z
						.array(z.strictObject({ pattern: z.string().min(1).max(60), weight: positiveInt }))
						.min(1)
						.optional()
				})
			})
		)
		.min(1),
	sizes: z
		.array(
			z.strictObject({
				id: contentId,
				label: frenchText,
				description: frenchText,
				weight: positiveInt,
				rivalStrengthModifier: safeInt,
				effects: z.array(effectSchema)
			})
		)
		.min(1),
	traits: z
		.array(
			z.strictObject({
				id: contentId,
				label: frenchText,
				description: frenchText,
				excludes: z.array(contentId),
				sizes: z.array(contentId).optional(),
				effects: z.array(effectSchema),
				origins: z.array(z.strictObject({ origin: contentId, effects: z.array(effectSchema) }))
			})
		)
		.min(1),
	traitsPerTown: z.strictObject({ min: nonNegativeInt, max: nonNegativeInt }),
	toponymy: z.strictObject({
		patterns: z
			.array(z.strictObject({ pattern: z.string().min(1).max(60), weight: positiveInt }))
			.min(1),
		saints: z.array(toponym).min(1),
		complements: z
			.array(z.string().regex(/^[a-zà-ÿ’']+(-[A-Za-zÀ-ÿ’']+)+$/u, 'complément « des-Bois »'))
			.min(1),
		plurals: z.array(toponym).min(1),
		standalone: z.array(toponym).min(1)
	})
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
	defaults: z.strictObject({ origin: contentId, profession: contentId, region: contentId }),
	territory: territorySchema
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
