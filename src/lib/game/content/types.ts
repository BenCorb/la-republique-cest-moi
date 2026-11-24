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

/** Axes politiques retenus pour l'alpha (GDD §3.2), positions de -100 à 100. */
export const AXIS_IDS = ['economy', 'society', 'sovereignty'] as const;
export type AxisId = (typeof AXIS_IDS)[number];
export const AXIS_MIN = -100;
export const AXIS_MAX = 100;

/** Indicateurs nationaux abstraits (GDD §8.2), entiers de 0 à 100, 50 = situation ordinaire. */
export const INDICATOR_IDS = ['economy', 'socialClimate', 'stability'] as const;
export type IndicatorId = (typeof INDICATOR_IDS)[number];

/**
 * Cible d'un effet sur la force d'un parti : un parti du catalogue, le parti au
 * gouvernement, celui du joueur (sans effet s'il n'est pas encarté) ou le
 * premier parti d'opposition.
 */
export const PARTY_REFERENCES = ['governing', 'player', 'opposition'] as const;
export type PartyReference = (typeof PARTY_REFERENCES)[number];

/**
 * Variables de texte liées au monde, figées à la création d'une instance
 * d'événement comme les acteurs. Les variables `player_party*` exigent que la
 * condition de l'événement impose l'adhésion du joueur.
 */
export const WORLD_TEMPLATE_VARIABLES = [
	'governing_party',
	'governing_leader',
	'opposition_party',
	'opposition_leader',
	'player_party',
	'player_party_leader'
] as const;
export type WorldTemplateVariable = (typeof WORLD_TEMPLATE_VARIABLES)[number];

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
	'calendar.quarter',
	/** Nombre d'exemplaires d'améliorations possédés (taille de l'organisation). */
	'upgrades.owned',
	'world.economy',
	'world.socialClimate',
	'world.stability',
	/** 1 si le joueur est membre d'un parti, sinon 0. */
	'player.affiliated',
	/** Force du parti du joueur (0 sans parti). */
	'player.partyStrength',
	/** 1 si le parti du joueur conduit le gouvernement, sinon 0. */
	'player.partyGoverning',
	/** Nombre de mandats en cours du joueur (P2-02). */
	'player.mandates'
] as const;
export type StatId = (typeof STAT_IDS)[number];

export const COMPARISON_OPS = ['gte', 'lte', 'eq'] as const;
export type ComparisonOp = (typeof COMPARISON_OPS)[number];

export type Condition =
	| { readonly op: 'all'; readonly conditions: readonly Condition[] }
	| { readonly op: 'any'; readonly conditions: readonly Condition[] }
	| { readonly op: 'not'; readonly condition: Condition }
	| { readonly op: ComparisonOp; readonly stat: StatId; readonly value: number }
	/** Le joueur est membre de ce parti. */
	| { readonly op: 'memberOf'; readonly party: string }
	/** Le joueur exerce un mandat de cette définition. */
	| { readonly op: 'holdsMandate'; readonly mandate: string }
	/** Le joueur pourrait recevoir ce mandat sans en quitter aucun (cumul et incompatibilités). */
	| { readonly op: 'canHoldMandate'; readonly mandate: string };

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
	  }
	| {
			readonly op: 'addIndicator';
			readonly indicator: IndicatorId;
			/** Variation maintenue dans [0, 100]. */
			readonly value: number;
	  }
	| {
			readonly op: 'addPartyStrength';
			/** Identifiant de parti ou référence relative (`governing`, `player`, `opposition`). */
			readonly party: string;
			/** Variation maintenue dans les bornes de force de l'équilibrage. */
			readonly value: number;
	  }
	| {
			readonly op: 'joinParty';
			/** Identifiant de parti, ou `target` pour la cible choisie dans le plan. */
			readonly party: string;
	  }
	| { readonly op: 'leaveParty' }
	| {
			readonly op: 'addRelation';
			/** Rôle de l'événement dont l'attitude envers le joueur change. */
			readonly role: string;
			/** Variation avant modulation par les traits, bornée ensuite à [-100, 100]. */
			readonly value: number;
			/** Souvenir conservé par le personnage (texte à variables), facultatif. */
			readonly memory?: string | undefined;
	  }
	/** Révèle au joueur les traits cachés de l'acteur du rôle. */
	| { readonly op: 'revealTraits'; readonly role: string }
	| {
			readonly op: 'grantMandate';
			readonly mandate: string;
			/**
			 * `true` : les mandats incompatibles en cours prennent fin (un ministre
			 * laisse son siège à son suppléant) ; sinon l'effet exige la compatibilité.
			 */
			readonly replaceIncompatible?: boolean | undefined;
	  }
	/** Fin d'un mandat en cours : définition, ou `target` (exemplaire choisi dans le plan). */
	| { readonly op: 'endMandate'; readonly mandate: string }
	/** Élection anticipée : remplace l'échéance régulière prévue de ce type. */
	| { readonly op: 'callEarlyElection'; readonly election: string; readonly delayTurns: number };

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
	/**
	 * Cible à choisir dans le plan : `party` (identifiant de parti) ou `mandate`
	 * (exemplaire de mandat en cours).
	 */
	readonly target?: 'party' | 'mandate' | undefined;
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

/** Personnages nommés : traits, vieillissement et relations (hypothèses de tuning, P2-04). */
export interface CharactersBalance {
	/** Traits tirés pour chaque personnage (distincts). */
	readonly traitsPerCharacter: number;
	/** Âge de retraite des personnages professionnels renouvelables. */
	readonly retirementAge: number;
	/** Âge des remplaçants générés. */
	readonly replacementMinAge: number;
	readonly replacementMaxAge: number;
	/** Probabilité de découvrir un trait caché d'un acteur à chaque décision le concernant. */
	readonly revealChancePerEncounter: number;
	/** Nombre maximal de souvenirs conservés par personnage (les plus anciens sont oubliés). */
	readonly maxMemories: number;
}

/** Paramètres du tirage des événements ordinaires (hypothèses de tuning). */
export interface EventsBalance {
	/** Nombre maximal de tirages ordinaires par trimestre. */
	readonly ordinaryDrawsPerTurn: number;
	/** Probabilité qu'un tirage ordinaire produise un événement. */
	readonly ordinaryEventChance: number;
}

/**
 * Évolution autonome du monde à chaque frontière de trimestre (hypothèses de
 * tuning, ARCHITECTURE.md §8.3 bis). Les pourcentages sont des entiers.
 */
export interface WorldBalance {
	readonly startingIndicators: { readonly [K in IndicatorId]: number };
	/** Valeur vers laquelle les indicateurs reviennent. */
	readonly indicatorBaseline: number;
	/** Part de l'écart à la référence résorbée chaque trimestre, en %. */
	readonly indicatorReversionPercent: number;
	/** Variation aléatoire maximale d'un indicateur par trimestre. */
	readonly indicatorVolatility: number;
	readonly minPartyStrength: number;
	readonly maxPartyStrength: number;
	/** Part de l'écart à la force de référence résorbée chaque trimestre, en %. */
	readonly strengthReversionPercent: number;
	readonly strengthVolatility: number;
	/**
	 * Écart des indicateurs économie et climat social à la référence, divisé par
	 * ce nombre, ajouté à la force de référence du parti au gouvernement (usure ou
	 * état de grâce).
	 */
	readonly governingIndicatorDivisor: number;
	/** Probabilité trimestrielle de changement de direction de chaque parti. */
	readonly leaderChangeChance: number;
	/** Âge des dirigeants tirés au sort (nouvelle direction). */
	readonly leaderMinAge: number;
	readonly leaderMaxAge: number;
	/** Âge auquel un dirigeant quitte d'office la direction de son parti. */
	readonly leaderRetirementAge: number;
}

export interface Balance {
	/** Points de temps disponibles chaque trimestre, non cumulables. */
	readonly timeBudgetPerTurn: number;
	readonly startingResources: Resources;
	readonly wellbeing: WellbeingBalance;
	readonly events: EventsBalance;
	readonly world: WorldBalance;
	readonly characters: CharactersBalance;
	readonly elections: ElectionsBalance;
}

/** Paramètres des scrutins et du gouvernement (hypothèses de tuning, P2-02). */
export interface ElectionsBalance {
	/** Aléa maximal ajouté à la force de chaque parti au scrutin. */
	readonly voteVolatility: number;
	/** Force gagnée par le vainqueur d'un scrutin, perdue par le gouvernement battu. */
	readonly momentum: number;
	/** Stabilité d'un nouveau gouvernement après alternance. */
	readonly newGovernmentStability: number;
	/** Trimestres avant une échéance où une alerte est affichée. */
	readonly alertLeadTurns: number;
}

/** Bornes de l'attitude d'un personnage envers le joueur. */
export const ATTITUDE_MIN = -100;
export const ATTITUDE_MAX = 100;

/**
 * Trait de personnalité (GDD §6.1). Un trait caché n'est connu du joueur
 * qu'après révélation. Les pourcentages modulent les variations d'attitude.
 */
export interface TraitDefinition {
	/** Identifiant stable, par exemple `trait.grudge`. */
	readonly id: string;
	/** Nom (substantif, sans accord de genre). */
	readonly label: string;
	readonly description: string;
	readonly hidden: boolean;
	/** Pourcentage appliqué aux variations positives d'attitude (100 = neutre). */
	readonly positiveRelationPercent: number;
	/** Pourcentage appliqué aux variations négatives d'attitude (100 = neutre). */
	readonly negativeRelationPercent: number;
}

/** Parti fictif du paysage initial (GDD §8.1), identique à chaque partie. */
export interface PartyDefinition {
	/** Identifiant stable, par exemple `party.ps`. */
	readonly id: string;
	readonly name: string;
	readonly acronym: string;
	/** Famille politique, en clair (par exemple « Centre »). */
	readonly family: string;
	readonly description: string;
	/** Positions internes sur les axes, jamais affichées en chiffres. */
	readonly positions: { readonly [K in AxisId]: number };
	/** Force électorale de référence (poids relatif, entier). */
	readonly baseStrength: number;
}

export interface AxisDefinition {
	readonly id: AxisId;
	readonly label: string;
	/** Adjectif (accordé avec « parti ») du pôle négatif (-100) puis du pôle positif (100). */
	readonly negativeLabel: string;
	readonly positiveLabel: string;
}

/**
 * Type d'élection (GDD §7.3) : calendrier régulier fictif, échelle et effet sur
 * le gouvernement. Le scrutin d'une échéance a lieu à la fin de son trimestre.
 */
export interface ElectionDefinition {
	/** Identifiant stable, par exemple `election.legislative`. */
	readonly id: string;
	readonly label: string;
	/** Trimestre du premier scrutin régulier. */
	readonly firstTurn: number;
	/** Trimestres entre deux scrutins réguliers (ou après une élection anticipée). */
	readonly cycleTurns: number;
	/** Trimestres avant le scrutin où les candidatures sont closes. */
	readonly filingLeadTurns: number;
	readonly scope: 'local' | 'regional' | 'national';
	/** Le vainqueur forme le gouvernement (élections législatives). */
	readonly decidesGovernment: boolean;
}

/**
 * Fonction exercée par le joueur (GDD §7.1–7.2) : élective (terme lié à une
 * élection) ou de nomination (fin avec le gouvernement). Chaque trimestre, elle
 * réserve du temps, rapporte et stresse.
 */
export interface MandateDefinition {
	/** Identifiant stable, par exemple `mandate.mayor`. */
	readonly id: string;
	readonly label: string;
	/** Rang de présentation : la fonction principale est le mandat de rang le plus élevé. */
	readonly rank: number;
	/** Élection dont le scrutin met fin au mandat, `null` pour une nomination. */
	readonly election: string | null;
	/** Le mandat prend fin quand le parti au gouvernement change. */
	readonly endsWithGovernment: boolean;
	/** Mandats à détenir pour l'obtenir (un maire est d'abord conseiller municipal). */
	readonly requires: readonly string[];
	/** Points de temps réservés chaque trimestre. */
	readonly timePerTurn: number;
	/** Revenus et ressources perçus chaque trimestre. */
	readonly income: readonly ResourceAmount[];
	/** Stress ajouté chaque trimestre. */
	readonly stressPerTurn: number;
}

/**
 * Règles institutionnelles fictives du cumul (GDD §7.2), copiées dans l'état à
 * la création : une réforme (P3-05) pourra les modifier en cours de partie.
 */
export interface InstitutionsDefinition {
	/** Paires de mandats qui ne peuvent être détenus ensemble. */
	readonly incompatibilities: readonly (readonly [string, string])[];
	/** Nombre maximal de mandats simultanés. */
	readonly maxMandates: number;
}

/** Catalogue du monde : partis, axes et noms des personnages générés. */
export interface WorldDefinition {
	readonly axes: readonly AxisDefinition[];
	readonly parties: readonly PartyDefinition[];
	/** Parti qui conduit le gouvernement au début de la partie. */
	readonly startingGoverningParty: string;
	/** Prénoms et noms fictifs combinés pour générer les dirigeants. */
	readonly names: { readonly first: readonly string[]; readonly last: readonly string[] };
}

/**
 * Personnage initial de la distribution, placé dans l'état à la création de la
 * partie (P2-04) : il vieillit, peut partir et garde ses relations.
 */
export interface CastMember {
	readonly id: string;
	/** Nom affiché, accord et article compris (« la docteure Hélène Mercier »). */
	readonly name: string;
	/** Étiquettes de rôle, par exemple `medical`, `journalist`. */
	readonly tags: readonly string[];
	/** Âge au premier trimestre 2000. */
	readonly age: number;
	/**
	 * Personnage professionnel remplacé à son départ (retraite, décès) par un
	 * successeur généré portant les mêmes étiquettes et cette fonction.
	 */
	readonly renewal?: { readonly epithet: string } | undefined;
}

/** Rôle d'un événement, pourvu à la création de l'instance parmi les personnages actifs. */
export interface ActorSlot {
	/** Nom du rôle, utilisé dans les textes sous la forme `{role}`. */
	readonly role: string;
	/** Étiquettes que l'acteur doit toutes posséder. */
	readonly tags: readonly string[];
	/** Traits réels que l'acteur doit tous posséder (connus ou non du joueur). */
	readonly traits?: readonly string[] | undefined;
	/** Attitude minimale ou maximale de l'acteur envers le joueur. */
	readonly minAttitude?: number | undefined;
	readonly maxAttitude?: number | undefined;
	/** `true` : seulement un personnage déjà rencontré. */
	readonly met?: boolean | undefined;
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

/** Événement informatif : effets automatiques (éventuellement aucun : simple brève), aucun choix. */
export interface InformativeEventDefinition extends EventBase {
	readonly blocking: false;
	readonly effects: readonly Effect[];
}

export type EventDefinition = BlockingEventDefinition | InformativeEventDefinition;

/** Contenu validé et indexé, tel que le reçoit le moteur. */
export interface Content {
	/** Empreinte des catalogues (`content-xxxxxxxx`), enregistrée dans les sauvegardes. */
	readonly version: string;
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
	readonly world: WorldDefinition;
	readonly traits: Readonly<Record<string, TraitDefinition>>;
	readonly elections: Readonly<Record<string, ElectionDefinition>>;
	/** Ordre du catalogue : ordre stable de la résolution des scrutins d'un même trimestre. */
	readonly electionIds: readonly string[];
	readonly mandates: Readonly<Record<string, MandateDefinition>>;
	readonly mandateIds: readonly string[];
	readonly institutions: InstitutionsDefinition;
	/** Ordre du catalogue : ordre stable des tirages de traits. */
	readonly traitIds: readonly string[];
	/** Partis indexés par identifiant. */
	readonly parties: Readonly<Record<string, PartyDefinition>>;
	/** Ordre du catalogue : ordre stable de l'évolution autonome. */
	readonly partyIds: readonly string[];
}
