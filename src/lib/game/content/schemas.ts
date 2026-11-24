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
	RESOURCE_IDS,
	STAT_IDS,
	type ActionDefinition,
	type Balance,
	type Condition,
	type Effect,
	type ResourceAmount
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

export const balanceSchema: z.ZodType<Balance> = z.strictObject({
	timeBudgetPerTurn: positiveInt,
	startingResources: z.strictObject({
		influence: nonNegativeInt,
		politicalBudgetCents: nonNegativeInt,
		personalCashCents: nonNegativeInt
	})
});
