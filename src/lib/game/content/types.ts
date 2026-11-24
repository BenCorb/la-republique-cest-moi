/**
 * Types et vocabulaire du contenu déclaratif, sans aucune dépendance.
 *
 * Le moteur n'importe que ce module ; les schémas Zod (`schemas.ts`) sont typés
 * contre ces définitions pour qu'un écart soit détecté à la compilation.
 */

/** Ressources accumulables (GDD §4.1). L'argent est exprimé en centimes entiers. */
export const RESOURCE_IDS = ['influence', 'politicalBudgetCents', 'personalCashCents'] as const;
export type ResourceId = (typeof RESOURCE_IDS)[number];

export type Resources = { readonly [K in ResourceId]: number };

/**
 * Registre typé des statistiques lisibles par les conditions. Toute nouvelle
 * statistique s'ajoute ici et dans `engine/conditions.ts` (switch exhaustif) :
 * jamais de chemin arbitraire vers l'état.
 */
export const STAT_IDS = [
	'resources.influence',
	'resources.politicalBudgetCents',
	'resources.personalCashCents',
	'player.age',
	'calendar.year',
	'calendar.quarter'
] as const;
export type StatId = (typeof STAT_IDS)[number];

export const COMPARISON_OPS = ['gte', 'lte', 'eq'] as const;
export type ComparisonOp = (typeof COMPARISON_OPS)[number];

export type Condition =
	| { readonly op: 'all'; readonly conditions: readonly Condition[] }
	| { readonly op: 'any'; readonly conditions: readonly Condition[] }
	| { readonly op: 'not'; readonly condition: Condition }
	| { readonly op: ComparisonOp; readonly stat: StatId; readonly value: number };

export type Effect =
	| { readonly op: 'addResource'; readonly resource: ResourceId; readonly value: number }
	| {
			readonly op: 'addResourceRandom';
			readonly resource: ResourceId;
			/** Bornes incluses, tirées à la validation du trimestre. */
			readonly min: number;
			readonly max: number;
	  };

export interface ResourceAmount {
	readonly resource: ResourceId;
	readonly amount: number;
}

export interface ActionDefinition {
	/** Identifiant stable, par exemple `activism.leaflets`. */
	readonly id: string;
	readonly label: string;
	readonly description: string;
	/** Points de temps consommés sur le budget trimestriel. */
	readonly timeCost: number;
	/** Nombre maximal d'occurrences dans un même plan. */
	readonly maxPerTurn: number;
	/** Coûts certains, payés avant les effets. */
	readonly costs: readonly ResourceAmount[];
	/** Prérequis évalué au moment de l'action dans le plan. */
	readonly requires?: Condition | undefined;
	/** Explication affichée lorsque le prérequis n'est pas rempli. */
	readonly unavailableReason?: string | undefined;
	readonly effects: readonly Effect[];
}

export interface Balance {
	/** Points de temps disponibles chaque trimestre, non cumulables. */
	readonly timeBudgetPerTurn: number;
	readonly startingResources: Resources;
}

/** Contenu validé et indexé, tel que le reçoit le moteur. */
export interface Content {
	readonly balance: Balance;
	/** Définitions indexées par identifiant. */
	readonly actions: Readonly<Record<string, ActionDefinition>>;
	/** Ordre de présentation du catalogue. */
	readonly actionIds: readonly string[];
}
