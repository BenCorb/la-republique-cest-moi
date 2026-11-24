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
	COMPARISON_OPS,
	GAUGE_IDS,
	GAUGE_MAX,
	RESOURCE_IDS,
	STAT_IDS,
	TREASURY_IDS,
	UPGRADE_FAMILIES,
	type ActionDefinition,
	type AgeBand,
	type Balance,
	type Condition,
	type Effect,
	type ResourceAmount,
	type UpgradeDefinition,
	type WellbeingBalance
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
		z.strictObject({ op: z.enum(COMPARISON_OPS), stat: z.enum(STAT_IDS), value: safeInt })
	])
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
		effects: z.array(effectSchema).min(1)
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
		unavailableReason: frenchText.optional()
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

export const balanceSchema: z.ZodType<Balance> = z.strictObject({
	timeBudgetPerTurn: positiveInt,
	startingResources: z.strictObject({
		influence: nonNegativeInt,
		politicalBudgetCents: nonNegativeInt,
		personalCashCents: nonNegativeInt
	}),
	wellbeing: wellbeingSchema
});
