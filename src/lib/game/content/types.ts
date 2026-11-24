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
 * Trésoreries monétaires. Une amélioration déclare celle qui la finance : ses
 * coûts et charges en argent n'utilisent que cette ressource (budget politique et
 * patrimoine personnel ne sont jamais mélangés, GDD §4.1).
 */
export const TREASURY_IDS = ['politicalBudgetCents', 'personalCashCents'] as const;
export type TreasuryId = (typeof TREASURY_IDS)[number];

/** Familles d'améliorations (GDD §5.2). */
export const UPGRADE_FAMILIES = ['organization', 'communication', 'network', 'personal'] as const;
export type UpgradeFamily = (typeof UPGRADE_FAMILIES)[number];

/** Jauges du personnage, entières et bornées entre 0 et 100 (GDD §4.2). */
export const GAUGE_IDS = ['player.health', 'player.stress'] as const;
export type GaugeId = (typeof GAUGE_IDS)[number];
export const GAUGE_MIN = 0;
export const GAUGE_MAX = 100;

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
	'player.health',
	'player.stress',
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
			readonly op: 'addStat';
			readonly stat: GaugeId;
			/** Variation appliquée puis maintenue dans les bornes de la jauge. */
			readonly value: number;
	  }
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

/**
 * Amélioration achetable (producteur) : coût initial, charges et production
 * récurrentes explicites. Un achat du trimestre T produit à partir de T+1.
 */
export interface UpgradeDefinition {
	/** Identifiant stable, par exemple `organization.volunteer`. */
	readonly id: string;
	readonly family: UpgradeFamily;
	readonly label: string;
	readonly description: string;
	/** Trésorerie qui paie le prix et les charges monétaires. */
	readonly treasury: TreasuryId;
	/** Points de temps consommés par l'achat (0 si aucun). */
	readonly timeCost: number;
	/** Nombre maximal d'exemplaires possédés. */
	readonly maxOwned: number;
	/** Prix payé à l'achat. */
	readonly price: readonly ResourceAmount[];
	/** Charges prélevées chaque trimestre ; impayées, elles suspendent la production. */
	readonly upkeep: readonly ResourceAmount[];
	/** Production de chaque trimestre où l'amélioration est active. */
	readonly production: readonly ResourceAmount[];
	readonly requires?: Condition | undefined;
	readonly unavailableReason?: string | undefined;
}

/**
 * Tranche d'âge du modèle de santé. Les probabilités sont des nombres de 0 à 1
 * appliqués à chaque trimestre ; aucune n'est affichée au joueur.
 */
export interface AgeBand {
	/** Âge (années révolues) à partir duquel la tranche s'applique. */
	readonly fromAge: number;
	/** Plafond de la récupération naturelle de santé. */
	readonly maxHealth: number;
	/** Probabilité trimestrielle de perdre de la santé en vieillissant. */
	readonly ageingChance: number;
	readonly ageingHealthLoss: number;
	/** Probabilité trimestrielle de décès de cause naturelle. */
	readonly mortalityChance: number;
}

/** Paramètres de santé, de stress et de vieillissement (hypothèses de tuning). */
export interface WellbeingBalance {
	readonly startingHealth: number;
	readonly startingStress: number;
	/** Temps utilisé au-delà duquel la charge de travail stresse. */
	readonly workloadThreshold: number;
	/** Stress ajouté par tranche complète de 10 points de temps au-delà du seuil. */
	readonly workloadStressPer10Points: number;
	/** Stress retiré chaque trimestre (récupération naturelle). */
	readonly stressRecoveryPerTurn: number;
	/** À partir de ce stress, la santé se dégrade. */
	readonly highStressThreshold: number;
	readonly highStressHealthLoss: number;
	/** Sous ce stress, la santé récupère jusqu'au plafond de la tranche d'âge. */
	readonly calmStressThreshold: number;
	readonly calmHealthGain: number;
	/** Sous cette santé, le risque de décès est multiplié. */
	readonly fragileHealthThreshold: number;
	readonly fragileMortalityMultiplier: number;
	/** Tranches triées par âge croissant, la première commençant à 0. */
	readonly ageBands: readonly AgeBand[];
}

/** Paramètres du tirage des événements ordinaires (hypothèses de tuning). */
export interface EventsBalance {
	/** Nombre maximal de tirages ordinaires par trimestre. */
	readonly ordinaryDrawsPerTurn: number;
	/** Probabilité qu'un tirage ordinaire produise un événement. */
	readonly ordinaryEventChance: number;
}

export interface Balance {
	/** Points de temps disponibles chaque trimestre, non cumulables. */
	readonly timeBudgetPerTurn: number;
	readonly startingResources: Resources;
	readonly wellbeing: WellbeingBalance;
	readonly events: EventsBalance;
}

/**
 * Personnage secondaire fictif, mobilisable comme acteur d'un événement. Le
 * prototype n'en simule ni l'âge ni les relations (personnages complets : P2-04).
 */
export interface CastMember {
	readonly id: string;
	readonly name: string;
	/** Étiquettes de rôle, par exemple `medical`, `journalist`. */
	readonly tags: readonly string[];
}

/** Rôle d'un événement, pourvu à la création de l'instance parmi la distribution. */
export interface ActorSlot {
	/** Nom du rôle, utilisé dans les textes sous la forme `{role}`. */
	readonly role: string;
	/** Étiquettes que l'acteur doit toutes posséder. */
	readonly tags: readonly string[];
}

/** Suite différée déclenchée par un choix. */
export interface FollowUp {
	readonly eventId: string;
	/** Nombre de trimestres avant la suite (au moins 1). */
	readonly delayTurns: number;
}

export interface EventChoice {
	readonly id: string;
	readonly label: string;
	/** Tendances annoncées au joueur, rédigées à la main (pas de chiffres cachés). */
	readonly hints: readonly string[];
	/** Coûts certains : le choix est indisponible s'ils ne sont pas couverts. */
	readonly costs: readonly ResourceAmount[];
	readonly requires?: Condition | undefined;
	readonly unavailableReason?: string | undefined;
	readonly effects: readonly Effect[];
	readonly followUp?: FollowUp | undefined;
}

interface EventBase {
	/** Identifiant stable, par exemple `press.local_portrait`. */
	readonly id: string;
	readonly category: string;
	readonly title: string;
	readonly text: string;
	/** `random` : tiré au sort ; `followUp` : uniquement comme suite d'un choix. */
	readonly trigger: 'random' | 'followUp';
	/** Poids relatif du tirage (événements `random`). */
	readonly weight: number;
	/** Ordre de présentation des événements bloquants (plus grand d'abord). */
	readonly priority: number;
	readonly availableFromTurn?: number | undefined;
	readonly availableUntilTurn?: number | undefined;
	/** Trimestres minimum entre deux occurrences. */
	readonly cooldownTurns: number;
	/** Une seule occurrence par carrière. */
	readonly unique: boolean;
	readonly when?: Condition | undefined;
	readonly actors: readonly ActorSlot[];
}

/** Événement bloquant : la progression attend un choix du joueur. */
export interface BlockingEventDefinition extends EventBase {
	readonly blocking: true;
	readonly choices: readonly EventChoice[];
}

/** Événement informatif : effets automatiques, aucun choix. */
export interface InformativeEventDefinition extends EventBase {
	readonly blocking: false;
	readonly effects: readonly Effect[];
}

export type EventDefinition = BlockingEventDefinition | InformativeEventDefinition;

/** Contenu validé et indexé, tel que le reçoit le moteur. */
export interface Content {
	readonly balance: Balance;
	/** Définitions indexées par identifiant. */
	readonly actions: Readonly<Record<string, ActionDefinition>>;
	/** Ordre de présentation du catalogue. */
	readonly actionIds: readonly string[];
	readonly upgrades: Readonly<Record<string, UpgradeDefinition>>;
	readonly upgradeIds: readonly string[];
	readonly events: Readonly<Record<string, EventDefinition>>;
	/** Identifiants triés : ordre stable des tirages. */
	readonly eventIds: readonly string[];
	readonly cast: Readonly<Record<string, CastMember>>;
	/** Identifiants triés : ordre stable du choix des acteurs. */
	readonly castIds: readonly string[];
}
