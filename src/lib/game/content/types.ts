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

/**
 * Jauges du personnage, entières et bornées entre 0 et 100 (GDD §4.2).
 * L'exposition médiatique (P3-01) mesure la visibilité : elle amplifie le
 * risque judiciaire et revient vers une référence fixée par les fonctions.
 */
export const GAUGE_IDS = [
	'player.health',
	'player.stress',
	'player.exposure',
	/**
	 * Préparation de la défense (P3-01) : avocats, conseil juridique et stratégie.
	 * Elle pèse sur les décisions de justice et retombe sans dossier ouvert.
	 */
	'player.defense'
] as const;
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
 * Variable de texte et acteur réservé des événements de sujet `promise` : la
 * promesse type concernée (`promise.*`), transmise par le moteur (P3-04).
 */
export const PROMISE_VARIABLE = 'promise';

/**
 * Poste d'entourage lié à une instance d'événement de sujet `post` (P3-12) et
 * titulaire de ce poste s'il est occupé : variables `{post}` et `{incumbent}`.
 */
export const POST_VARIABLE = 'post';
export const INCUMBENT_VARIABLE = 'incumbent';

/**
 * Capacités métier exigées par les infractions (P3-12) : une infraction liée à
 * l'exercice d'un pouvoir n'est possible que si le personnage le détient.
 * - `political_activity` : une activité politique capable de recevoir des fonds
 *   (adhésion, mandat, campagne, organisation ou entourage) ;
 * - `local_power` : un pouvoir local sur permis, marchés et subventions (mairie) ;
 * - `public_office` : une fonction de décision publique (un mandat en cours) ;
 * - `real_hire` : une embauche effective du bénéficiaire (vérifiée sur l'effet) ;
 * - `organization_funds` : une organisation dotée de fonds (organisation ou entourage).
 */
export const CAPABILITY_IDS = [
	'political_activity',
	'local_power',
	'public_office',
	'real_hire',
	'organization_funds'
] as const;
export type CapabilityId = (typeof CAPABILITY_IDS)[number];

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
	/**
	 * Nombre de mandats en cours du joueur (P2-02), comptés comme pour le cumul :
	 * une fonction exercée au sein d'un mandat (la mairie) ne compte pas à part.
	 */
	'player.mandates',
	/** Popularité : synthèse pondérée des soutiens électoraux, de 0 à 100 (P2-07). */
	'player.popularity',
	/** Nombre de campagnes en cours du joueur (P2-03). */
	'player.campaigning',
	/** Nombre de collaborateurs en poste (P2-05). */
	'player.staff',
	/** 1 si le joueur vit en couple, sinon 0 (P2-08). */
	'player.hasPartner',
	/** Nombre d'enfants du joueur. */
	'player.children',
	/** Exposition médiatique, de 0 à 100 (P3-01). */
	'player.exposure',
	/** Nombre de faits du registre impliquant le joueur, comme auteur ou complice (P3-01). */
	'player.facts',
	/** Dossiers judiciaires en cours visant le joueur (P3-01). */
	'player.openCases',
	/** 1 si le joueur est frappé d'inéligibilité, sinon 0 (P3-01). */
	'player.ineligible',
	/** Nombre d'actifs patrimoniaux possédés (P3-02). */
	'player.assets',
	/** Valeur nette : argent personnel et valeur des actifs, en centimes (P3-02). */
	'player.netWorthCents',
	/** Promesses en cours de réalisation, une fois élu (P3-04). */
	'player.promisesInProgress',
	/** Promesses tenues (P3-04). */
	'player.promisesKept',
	/** Promesses abandonnées (P3-04). */
	'player.promisesBroken'
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
	| { readonly op: 'canHoldMandate'; readonly mandate: string }
	/** Origine ou profession du joueur (P2-08). */
	| { readonly op: 'origin'; readonly origin: string }
	| { readonly op: 'profession'; readonly profession: string }
	/** Train de vie en cours du joueur (P3-02). */
	| { readonly op: 'lifestyle'; readonly lifestyle: string }
	/** Le joueur possède au moins un exemplaire de cette amélioration (P3-03). */
	| { readonly op: 'ownsUpgrade'; readonly upgrade: string }
	/** Niveau en vigueur d'un paramètre institutionnel (P3-05). */
	| { readonly op: 'institution'; readonly parameter: string; readonly level: string }
	/** Le joueur détient cette capacité métier (P3-12) ; `real_hire` ne s'y évalue pas. */
	| { readonly op: 'capability'; readonly capability: CapabilityId }
	/** Soutien d'un groupe comparé à une valeur. */
	| {
			readonly op: 'support';
			readonly group: string;
			readonly cmp: ComparisonOp;
			readonly value: number;
	  };

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
	/** Variation du soutien d'un groupe, maintenue dans [0, 100]. */
	| { readonly op: 'addSupport'; readonly group: string; readonly value: number }
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
	| { readonly op: 'callEarlyElection'; readonly election: string; readonly delayTurns: number }
	/** Candidature à l'échéance choisie dans le plan (`target`), sous conditions d'éligibilité. */
	| { readonly op: 'declareCandidacy' }
	/** Préparation ajoutée à chaque campagne en cours. */
	| { readonly op: 'prepareCampaign'; readonly value: number }
	/** Embauche du candidat choisi dans le plan (`target`), sur son poste (P2-05). */
	| { readonly op: 'hireStaff' }
	/** Renvoi du collaborateur choisi dans le plan (`target`). */
	| { readonly op: 'dismissStaff' }
	/**
	 * Départ de l'exemplaire d'amélioration choisi dans le plan (`target`) : il
	 * quitte l'organisation aussitôt, sans charge ni production ce trimestre, et
	 * applique les `releaseEffects` de sa définition.
	 */
	| { readonly op: 'releaseUpgrade' }
	/** Départ du collaborateur qui tient ce rôle d'événement (débauchage, démission). */
	| { readonly op: 'staffLeaves'; readonly role: string }
	/** Arrivée d'un membre de la famille proche, généré (événements seulement, P2-08). */
	| { readonly op: 'familyJoins'; readonly relation: 'partner' | 'child' }
	/** Séparation : la personne qui partage la vie du joueur s'en va. */
	| { readonly op: 'separate' }
	/** Variation d'attitude de la famille proche (partenaire et enfants). */
	| { readonly op: 'familyAttitude'; readonly value: number }
	/**
	 * Acte douteux inscrit au registre des faits (événements seulement, P3-01).
	 * Sans `author`, le joueur en est l'auteur ; sinon l'acteur de ce rôle (un
	 * collaborateur, par exemple) l'est et le joueur en est complice.
	 */
	/** Changement de train de vie (P3-02), pris en compte dès ce trimestre. */
	| { readonly op: 'setLifestyle'; readonly lifestyle: string }
	/**
	 * Embauche de l'acteur de ce rôle au poste lié à l'événement (sujet `post`,
	 * P3-12) : poste vacant, ou, avec `replace`, à la place de son titulaire, renvoyé.
	 */
	| { readonly op: 'hireActor'; readonly role: string; readonly replace?: true | undefined }
	/**
	 * L'acteur de ce rôle rejoint la présélection du poste lié, s'il est vacant,
	 * avec ce profil de candidat (P3-12).
	 */
	| { readonly op: 'shortlistActor'; readonly role: string; readonly profile: string }
	| {
			readonly op: 'recordFact';
			readonly offense: string;
			/** Gravité de 1 (indélicatesse) à 3 (affaire d'envergure). */
			readonly severity: number;
			/** Fonds détournés, en centimes, comptés au bilan (GDD §12) ; 0 par défaut. */
			readonly divertedCents?: number | undefined;
			readonly author?: string | undefined;
			/** Rôles des autres protagonistes (donateur, bénéficiaire…). */
			readonly accomplices?: readonly string[] | undefined;
	  }
	/**
	 * Engagement de campagne sur la promesse choisie dans le plan (`target` :
	 * définition `promise.*`), rattaché à la campagne en cours (P3-04).
	 */
	| { readonly op: 'makePromise' }
	/**
	 * Avancement d'une promesse en cours : celle choisie dans le plan (`target` :
	 * exemplaire `pledge.N`) ou celle dont traite l'événement (P3-04).
	 */
	| { readonly op: 'advancePromise'; readonly value: number }
	/** Compromis : la promesse dont traite l'événement ne sera au mieux que partiellement tenue. */
	| { readonly op: 'amendPromise' }
	/** Renoncement : la promesse dont traite l'événement est abandonnée sur-le-champ. */
	| { readonly op: 'abandonPromise' }
	/**
	 * Relation d'un média envers le joueur (P3-03) : média du catalogue, ou
	 * `target` pour le média choisi dans le plan.
	 */
	| { readonly op: 'addMediaRelation'; readonly media: string; readonly value: number }
	/** Interview accordée au média choisi dans le plan (`target`) : article à la frontière. */
	| { readonly op: 'giveInterview' }
	/**
	 * Proposition de réforme institutionnelle (P3-05) : le niveau choisi dans le
	 * plan (`target`), soumis au vote à la frontière du trimestre.
	 */
	| { readonly op: 'proposeReform' };

/** États d'une promesse (GDD §7.5). */
export const PROMISE_STATUSES = [
	'announced',
	'in_progress',
	'kept',
	'partial',
	'abandoned'
] as const;
export type PromiseStatus = (typeof PROMISE_STATUSES)[number];
/** Issues d'une promesse, chacune avec ses effets propres. */
export type PromiseOutcome = Extract<PromiseStatus, 'kept' | 'partial' | 'abandoned'>;

/** Avancement auquel une promesse est entièrement réalisée. */
export const PROMISE_PROGRESS_MAX = 100;

/**
 * Promesse type (P3-04) : un engagement de campagne et ses conséquences selon
 * qu'il est tenu, partiellement tenu ou abandonné. Effets limités aux
 * ressources, jauges et soutiens ; aucune simulation de politique publique.
 */
export interface PromiseDefinition {
	readonly id: string;
	/** Intitulé de la promesse, cité dans les textes (`{promise}`). */
	readonly label: string;
	/** Thème (fiscalité, sécurité…). */
	readonly theme: string;
	readonly description: string;
	/** Élections où l'engagement peut être pris. */
	readonly elections: readonly string[];
	/** Dilemme présenté une fois élu (événement bloquant de sujet `promise`). */
	readonly dilemmaEvent: string;
	/** Effets certains de l'annonce. */
	readonly announce: readonly Effect[];
	/** Effets à l'issue de la promesse. */
	readonly kept: readonly Effect[];
	readonly partial: readonly Effect[];
	readonly abandoned: readonly Effect[];
}

/** Règles du registre des promesses ; hypothèses provisoires d'équilibrage. */
export interface PromisesBalance {
	/** Nombre maximal d'engagements par campagne. */
	readonly maxPerCampaign: number;
	/** Préparation ajoutée à la campagne par chaque engagement. */
	readonly announcePreparation: number;
	/** Délai de réalisation après l'élection, en trimestres. */
	readonly deliveryTurns: number;
	/** Délai entre l'élection et le dilemme, en trimestres (tiré dans la fourchette). */
	readonly dilemmaDelayTurns: IntRange;
	/** Avancement minimal d'une promesse partiellement tenue (en dessous : abandonnée). */
	readonly partialProgress: number;
	/** Chance, par trimestre de campagne, qu'une promesse passée soit rappelée, en %. */
	readonly recallPercent: number;
	/** Nombre maximal de rappels d'une même promesse. */
	readonly maxRecalls: number;
	/** Événements de rappel, par issue (sujet `promise`). */
	readonly recallEvents: {
		readonly kept: string;
		readonly abandoned: string;
	};
}

export interface PromisesDefinition {
	readonly promises: readonly PromiseDefinition[];
	readonly balance: PromisesBalance;
}

/**
 * Effets d'un niveau institutionnel sur les règles (P3-05), tous facultatifs :
 * ils s'appliquent à tous les acteurs tant que le niveau est en vigueur.
 */
export interface InstitutionModifiers {
	/** Plafond du cumul des mandats (absolu). */
	readonly maxMandates?: number | undefined;
	/** Chance de révélation des faits, en % de celle de la justice (100 : inchangée). */
	readonly revealPercent?: number | undefined;
	/** Probabilité de condamnation, en % de celle de la justice. */
	readonly convictionPercent?: number | undefined;
	/** Points ajoutés à la chance de classement sans suite. */
	readonly dismissalBonus?: number | undefined;
	/** Poids de la popularité, du parti et prime du sortant dans le score d'un scrutin (absolus). */
	readonly popularityWeightPercent?: number | undefined;
	readonly partyWeightPercent?: number | undefined;
	readonly incumbentBonus?: number | undefined;
	/** Effet des articles critiques, en % de celui du catalogue des médias. */
	readonly criticalPressPercent?: number | undefined;
	/** Exposition à partir de laquelle les médias nationaux suivent le joueur (absolue). */
	readonly nationalExposure?: number | undefined;
}

/** Niveau d'un paramètre institutionnel (P3-05). */
export interface InstitutionLevel {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly modifiers: InstitutionModifiers;
	/** Effets certains pour le joueur quand sa proposition est adoptée (soutiens, ressources, jauges). */
	readonly effects: readonly Effect[];
}

/**
 * Paramètre institutionnel réformable (P3-05, GDD §10.2) : niveaux ordonnés ;
 * une réforme passe au niveau voisin, jamais plus loin d'un coup.
 */
export interface InstitutionParameter {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly startLevel: string;
	readonly levels: readonly InstitutionLevel[];
}

/** Règles des réformes institutionnelles ; hypothèses provisoires d'équilibrage. */
export interface ReformsBalance {
	/** Mandats permettant de proposer une réforme (au moins un). */
	readonly proposerMandates: readonly string[];
	/** Chance d'adoption : base, bonus si le parti du joueur gouverne, bonus ministre, en points. */
	readonly baseAdoptionPercent: number;
	readonly governingBonusPercent: number;
	readonly ministerMandate: string;
	readonly ministerBonusPercent: number;
	/** Points par point d'écart à 50 du soutien de l'appareil et de la stabilité, en %. */
	readonly apparatusWeightPercent: number;
	readonly stabilityWeightPercent: number;
	/** Bornes de la chance d'adoption, en %. */
	readonly adoptionPercent: IntRange;
	/** Effets certains d'un rejet pour le joueur. */
	readonly rejectionEffects: readonly Effect[];
	/** Chance, par trimestre, que le gouvernement adopte de lui-même une réforme, en %. */
	readonly autonomousPercent: number;
}

export interface ReformsCatalog {
	readonly parameters: readonly InstitutionParameter[];
	readonly balance: ReformsBalance;
}

/**
 * Mesures du parcours (P3-08), calculées depuis l'état final et son journal,
 * sur lesquelles reposent nécrologies et distinctions. Aucune n'est une jauge
 * morale : ce sont des faits de carrière.
 */
export const LEGACY_METRICS = [
	/** Âge à la fin de carrière. */
	'age',
	/** Années de carrière (trimestres joués / 4, arrondi inférieur). */
	'years',
	/** Mandats exercés (exemplaires). */
	'mandatesHeld',
	/** Rang de la plus haute fonction exercée (0 : aucune). */
	'highestRank',
	/** Années passées avec au moins un mandat (arrondi inférieur). */
	'yearsInOffice',
	/** Plus grand nombre de mandats cumulés simultanément. */
	'peakCumul',
	'campaignsWon',
	'campaignsLost',
	/** Adhésions successives à un parti. */
	'partyChanges',
	/** Faits inscrits au registre (P3-01). */
	'facts',
	'cases',
	'convictions',
	'divertedCents',
	'netWorthCents',
	'promisesKept',
	'promisesBroken',
	/** Médias possédés à la fin (P3-03). */
	'mediaOwned',
	/** Réformes proposées par le joueur et adoptées (P3-05). */
	'reformsAdopted',
	'children',
	/** Personnages rencontrés très bien et très mal disposés (attitude ≥ 40, ≤ −40). */
	'allies',
	'enemies'
] as const;
export type LegacyMetric = (typeof LEGACY_METRICS)[number];

/** Causes de fin de carrière (décès ou prison ferme). */
export const END_CAUSES = ['health_failure', 'natural_causes', 'prison'] as const;
export type EndCauseId = (typeof END_CAUSES)[number];

export interface LegacyCriterion {
	readonly metric: LegacyMetric;
	readonly cmp: ComparisonOp;
	readonly value: number;
}

/**
 * Nécrologie ou article de bilan (P3-08) : un gabarit par cause de fin,
 * éventuellement réservé à certains parcours (critères). Variables : `{age}`,
 * `{years}` et `{office}` (plus haute fonction exercée). Le joueur n'est
 * jamais nommé ni genré.
 */
export interface ObituaryDefinition {
	readonly id: string;
	readonly causes: readonly EndCauseId[];
	readonly criteria: readonly LegacyCriterion[];
	readonly headline: string;
	readonly text: string;
}

/** Distinction narrative non exclusive, fondée sur le parcours (GDD §12). */
export interface DistinctionDefinition {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly criteria: readonly LegacyCriterion[];
}

export interface EpitaphsCatalog {
	readonly obituaries: readonly ObituaryDefinition[];
	readonly distinctions: readonly DistinctionDefinition[];
}

/** Bornes de la relation d'un média envers le joueur (P3-03). */
export const MEDIA_RELATION_MIN = -100;
export const MEDIA_RELATION_MAX = 100;

/** Familles de médias du catalogue (GDD §9.1, lot D). */
export const MEDIA_KINDS = [
	'reference',
	'popular',
	'news_channel',
	'satirical',
	'regional'
] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

/**
 * Sujets d'article (P3-03) : un dossier judiciaire, une promesse arrivée à son
 * issue, un scrutin, le train de vie, une interview, le rachat d'un média, ou
 * une nouvelle d'ambiance sans rapport avec le joueur.
 */
export const ARTICLE_TOPICS = [
	'justice',
	'promise',
	'election',
	'lifestyle',
	'interview',
	'ownership',
	'ambient'
] as const;
export type ArticleTopic = (typeof ARTICLE_TOPICS)[number];

/** Tonalité d'un article envers le joueur. */
export const ARTICLE_TONES = ['critical', 'neutral', 'favorable'] as const;
export type ArticleTone = (typeof ARTICLE_TONES)[number];

/**
 * Média fictif (P3-03, GDD §9.1) : ligne éditoriale, audience, groupes qui le
 * lisent et goût pour chaque sujet. Un média national ne s'intéresse au joueur
 * qu'au-delà d'un seuil d'exposition (sauf affaires judiciaires et rachat).
 */
export interface MediaDefinition {
	readonly id: string;
	readonly name: string;
	readonly kind: MediaKind;
	/** Ligne éditoriale, en quelques mots. */
	readonly line: string;
	readonly description: string;
	readonly scope: 'national' | 'local';
	/** Audience, de 1 à 100 : pondère le choix du média et l'effet de ses articles. */
	readonly audience: number;
	/** Relation de départ et de référence envers le joueur. */
	readonly baseRelation: number;
	/** Groupes de soutien touchés par ses articles. */
	readonly groups: readonly string[];
	/** Goût pour chaque sujet (0 : jamais), hors interview et ambiance. */
	readonly coverage: Readonly<Record<Exclude<ArticleTopic, 'interview' | 'ambient'>, number>>;
	/** Amplification de l'effet de ses articles, en % (100 : neutre). */
	readonly amplifyPercent: number;
}

/**
 * Titre de presse (P3-03) : gabarit par sujet et tonalité, éventuellement
 * réservé à des familles de médias ou à certains sujets précis (étape d'un
 * dossier, issue d'une promesse…). Variables : `{subject}` (dossier, promesse, scrutin ou média selon le sujet) et `{media}` ; le joueur n’est jamais nommé (aucun nom de personnage joueur en V1).
 */
export interface HeadlineDefinition {
	readonly id: string;
	readonly topic: ArticleTopic;
	readonly tone: ArticleTone;
	readonly text: string;
	/** Familles de médias autorisées ; absent : toutes. */
	readonly kinds?: readonly MediaKind[] | undefined;
	/** Précisions du sujet (`revealed`, `kept`, `won`…) ; absent : toutes. */
	readonly details?: readonly string[] | undefined;
	/** Première année de parution possible (nouvelles d'ambiance datées). */
	readonly fromYear?: number | undefined;
}

/** Règles du fil de presse ; hypothèses provisoires d'équilibrage. */
export interface PressBalance {
	/** Nombre maximal d'articles consacrés au joueur par trimestre. */
	readonly maxArticlesPerTurn: number;
	/** Exposition à partir de laquelle les médias nationaux suivent le joueur. */
	readonly nationalExposure: number;
	/** Relation au-delà de laquelle un média adoucit sa tonalité (et en deçà de l'opposé, la durcit). */
	readonly toneThreshold: number;
	/** Effet de base d'un article sur chaque groupe touché, par tonalité. */
	readonly toneEffects: Readonly<Record<ArticleTone, number>>;
	/** Effet maximal d'un article sur un groupe, en valeur absolue. */
	readonly maxEffect: number;
	/** Exposition ajoutée par un article critique. */
	readonly criticalExposure: number;
	/** Effet des articles d'un média possédé par le joueur, en % (crédibilité réduite). */
	readonly ownedEffectPercent: number;
	/** Retour de la relation vers sa référence, en % de l'écart, chaque trimestre. */
	readonly relationDriftPercent: number;
	/** Chance, par trimestre de train de vie fastueux, d'un article sur le train de vie, en %. */
	readonly lifestylePercent: number;
	/** Rang de train de vie à partir duquel la presse s'y intéresse. */
	readonly lifestyleLevel: number;
	/** Chance, par trimestre, d'une nouvelle d'ambiance, en %. */
	readonly ambientPercent: number;
	/** Délai minimal entre deux interviews au même média, en trimestres. */
	readonly interviewCooldownTurns: number;
	/**
	 * Délai thématique (P3-15) : nombre maximal d'articles successifs consacrés
	 * au joueur sous le même angle (sujet et précision) ; la justice, les
	 * interviews et les rachats sont toujours couverts.
	 */
	readonly angleRepeatLimit: number;
}

export interface MediaCatalog {
	readonly media: readonly MediaDefinition[];
	readonly headlines: readonly HeadlineDefinition[];
	readonly balance: PressBalance;
}

/** Gravité maximale d'un fait. */
export const FACT_SEVERITY_MAX = 3;

/** Type d'infraction fictive du registre des faits (`offense.*`, P3-01). */
export interface OffenseDefinition {
	readonly id: string;
	/** Nom affiché, par exemple « Financement occulte ». */
	readonly label: string;
	readonly description: string;
	/** Capacité que l'auteur doit détenir pour commettre l'infraction (P3-12). */
	readonly capability: CapabilityId;
}

/**
 * Règles provisoires du registre des faits et des jauges de la justice (P3-01) ;
 * toutes les valeurs sont des hypothèses d'équilibrage.
 */
export interface JusticeBalance {
	/** Risque apporté par un fait récent, par point de gravité, quand le joueur en est l'auteur. */
	readonly riskPerSeverity: number;
	/** Part de ce risque quand le joueur n'est que complice, en %. */
	readonly accompliceRiskPercent: number;
	/** Trimestres au bout desquels un fait n'apporte plus de risque (prescription). */
	readonly prescriptionTurns: number;
	/** Majoration du risque à exposition maximale, en % (proportionnelle à l'exposition). */
	readonly exposureRiskBonusPercent: number;
	/** Exposition de référence sans fonction ni campagne. */
	readonly baseExposure: number;
	/** Exposition de référence ajoutée par une campagne en cours. */
	readonly campaignExposure: number;
	/** Exposition de référence par mandat (la plus élevée des fonctions exercées compte). */
	readonly mandateExposure: Readonly<Record<string, number>>;
	/** Part de l'écart à la référence résorbée à chaque trimestre, en %. */
	readonly exposureDriftPercent: number;
	/** Chance de révélation d'un fait, par trimestre et par point de gravité, en % (majorée par l'exposition). */
	readonly revealPercentPerSeverity: number;
	/** Durées des étapes, en trimestres : enquête, attente du procès, appel. */
	readonly investigationTurns: IntRange;
	readonly trialDelayTurns: IntRange;
	readonly appealTurns: IntRange;
	/** Classement sans suite : base, moins par point de gravité, plus la défense (à 100). */
	readonly dismissalBasePercent: number;
	readonly dismissalPerSeverityPercent: number;
	readonly defenseDismissalPercent: number;
	/** Probabilité de condamnation par gravité (index 0 : gravité 1), réduite par la défense (à 100). */
	readonly convictionPercentBySeverity: readonly number[];
	readonly defenseConvictionPercent: number;
	/** Peines par gravité (index 0 : gravité 1). */
	readonly sentences: readonly SentenceRule[];
	/** Conséquences, par point de gravité sauf mention : révélation, mise en examen, verdict. */
	readonly revelationExposure: number;
	readonly revelationSupport: number;
	readonly revelationStress: number;
	readonly indictmentStress: number;
	readonly indictmentSupport: number;
	readonly convictionSupport: number;
	/** Stress d'une condamnation (forfait). */
	readonly convictionStress: number;
	/** Stress retiré par un classement ou une relaxe (forfait). */
	readonly acquittalRelief: number;
	/** Part des conséquences subies par le joueur quand un proche est poursuivi, en %. */
	readonly entourageImpactPercent: number;
	/** Baisse de la défense par trimestre avec un dossier ouvert, en % (sans dossier : retour à 0). */
	readonly defenseDecayPercent: number;
	/** Événements bloquants présentés à la révélation : dossier du joueur, puis d'un proche. */
	readonly revelationEvent: string;
	readonly entourageRevelationEvent: string;
}

/** Intervalle d’entiers, bornes incluses (trimestres, centimes). */
export interface IntRange {
	readonly min: number;
	readonly max: number;
}

/** Peine prononcée pour une gravité donnée. */
export interface SentenceRule {
	/** Amende, en centimes, prélevée sur l'argent personnel. */
	readonly fineCents: IntRange;
	/** Inéligibilité, en trimestres (0 : aucune). */
	readonly ineligibilityTurns: IntRange;
	/** Prison avec sursis (sans effet de jeu) ; ferme met fin à la carrière. */
	readonly prison: 'none' | 'suspended' | 'firm_possible';
	/** Probabilité d'une peine ferme quand elle est possible, en %. */
	readonly firmPrisonPercent: number;
}

export interface JusticeDefinition {
	readonly offenses: readonly OffenseDefinition[];
	readonly balance: JusticeBalance;
}

export interface ResourceAmount {
	readonly resource: ResourceId;
	readonly amount: number;
}

/** Thème d'actions de l'agenda (militantisme, campagne, finances…), dans l'ordre d'affichage. */
export interface ActionCategory {
	readonly id: string;
	readonly label: string;
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
	/** Thème de l'agenda (identifiant d'`ActionCategory`) ; absent : « Autres actions ». */
	readonly category?: string | undefined;
	/** Époque d'apparition (P3-07) : invisible et indisponible avant elle. */
	readonly fromEra?: string | undefined;
	readonly effects: readonly Effect[];
	/**
	 * Cible à choisir dans le plan : `party` (identifiant de parti), `mandate`
	 * (exemplaire de mandat en cours) ou `ballot` (échéance électorale).
	 */
	/** `asset` : un actif patrimonial possédé ; `upgrade` : un autre exemplaire de l'organisation. */
	/** `promise` : une promesse type à annoncer ; `pledge` : une promesse en cours (P3-04). */
	/** `media` : un média du catalogue (P3-03) ; `reform` : un niveau institutionnel (P3-05). */
	readonly target?:
		| 'party'
		| 'mandate'
		| 'ballot'
		| 'candidate'
		| 'staff'
		| 'upgrade'
		| 'asset'
		| 'promise'
		| 'pledge'
		| 'media'
		| 'reform'
		| undefined;
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
	/** Nom d'un exemplaire possédé (« Militant bénévole »), à défaut le libellé d'achat. */
	readonly ownedLabel?: string | undefined;
	/** Époque d'apparition (P3-07) : invisible et indisponible avant elle. */
	readonly fromEra?: string | undefined;
	/** Effets certains d'un départ (`releaseUpgrade`) : ressources, jauges, soutiens. */
	readonly releaseEffects?: readonly Effect[] | undefined;
	/**
	 * Actif patrimonial (P3-02) : l'exemplaire a une valeur de marché, rapporte un
	 * revenu proportionnel à cette valeur et se revend au lieu d'être abandonné.
	 */
	readonly asset?: AssetDefinition | undefined;
}

/** Règles d'un actif patrimonial ; hypothèses provisoires d'équilibrage. */
export interface AssetDefinition {
	/** Revenu passif annuel, en % de la valeur, versé par quart chaque trimestre actif. */
	readonly annualYieldPercent: number;
	/** Tendance annuelle de la valeur, en %. */
	readonly annualGrowthPercent: number;
	/** Aléa trimestriel de la valeur, en % (tirage uniforme entre − et +). */
	readonly volatilityPercent: number;
	/** Effet de la conjoncture : % de variation trimestrielle par 10 points d'écart de l'économie à 50. */
	readonly economySensitivityPercent: number;
	/** Chance de perte totale par trimestre, en dixièmes de % (faillite, sinistre). */
	readonly failurePerMille: number;
	/** Part de la valeur récupérée à la revente, en % (frais, décote). */
	readonly salePercent: number;
	/** Variation de stress par trimestre actif (confort ; négatif : apaise). */
	readonly stressPerTurn: number;
	/** Média du catalogue détenu par cet actif (P3-03) : sa couverture devient bienveillante. */
	readonly media?: string | undefined;
}

/** Train de vie du joueur (P3-02) : dépense personnelle de chaque trimestre. */
export interface LifestyleDefinition {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	/** Rang, de 0 (le plus sobre) au plus dispendieux. */
	readonly level: number;
	/** Dépense prélevée sur l'argent personnel chaque trimestre. */
	readonly costCents: number;
	/** Variation de stress par trimestre (négatif : apaise). */
	readonly stressPerTurn: number;
	/** Exposition médiatique de référence ajoutée (le luxe se voit). */
	readonly exposure: number;
}

export interface WealthDefinition {
	readonly lifestyles: readonly LifestyleDefinition[];
	/** Train de vie au début de la partie et après une dépense impayée. */
	readonly defaultLifestyle: string;
	/** Stress d'un trimestre où le train de vie n'a pas pu être payé. */
	readonly unpaidLifestyleStress: number;
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
	/**
	 * Répétition (P3-07) : chaque occurrence passée réduit le poids d'un
	 * événement ordinaire (poids × 100 / (100 + pénalité × occurrences)).
	 */
	readonly repeatPenaltyPercent: number;
	/** Occurrences par carrière d'un événement ordinaire non unique (0 : sans plafond). */
	readonly maxOccurrences: number;
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
	readonly supports: SupportsBalance;
	readonly campaigns: CampaignsBalance;
	readonly entourage: EntourageBalance;
	readonly family: FamilyBalance;
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

/** Évolution des soutiens à chaque frontière (hypothèses de tuning, P2-07). */
export interface SupportsBalance {
	/** Part de l'écart à la référence résorbée chaque trimestre, en %. */
	readonly reversionPercent: number;
	/** Bonus ou malus maximal de l'affinité entre parti et groupe. */
	readonly partyAlignmentMax: number;
	/** Notoriété : un point de référence électorale par tranche d'influence de cette taille. */
	readonly influencePerPoint: number;
	/** Plafond du bonus de notoriété. */
	readonly notorietyMax: number;
}

/**
 * Modèle de campagne et de scrutin du joueur (hypothèses de tuning, P2-03). Les
 * poids sont des pourcentages appliqués aux composantes du score.
 */
export interface CampaignsBalance {
	readonly popularityWeightPercent: number;
	/** Part du score du parti au scrutin reprise par un candidat investi. */
	readonly partyWeightPercent: number;
	readonly preparationWeightPercent: number;
	/** Préparation au-delà de laquelle travailler davantage ne rapporte plus. */
	readonly preparationCap: number;
	readonly incumbentBonus: number;
	/** Aléa maximal ajouté au score du joueur et à celui de l'adversaire. */
	readonly volatility: number;
	/** Préparation gagnée chaque trimestre de campagne, même sans action. */
	readonly passivePreparation: number;
	/** Stress de chaque trimestre de campagne (exposition). */
	readonly stressPerTurn: number;
	/** Soutien minimal de l'appareil du parti pour obtenir l'investiture. */
	readonly investitureMinApparatus: number;
	/** Groupe dont le soutien décide l'investiture. */
	readonly apparatusGroup: string;
	readonly victoryInfluence: number;
	readonly defeatInfluence: number;
	readonly defeatStress: number;
	/** Score minimal (en %) ouvrant droit au remboursement forfaitaire des frais de campagne. */
	readonly refundMinPercent: number;
	/** Points gagnés par un adversaire pour chacune de ses victoires passées contre le joueur. */
	readonly rivalExperienceBonus: number;
	/** Nombre maximal de victoires prises en compte. */
	readonly rivalExperienceCap: number;
	/** Variation d'attitude d'un adversaire après chaque affrontement. */
	readonly rivalryAttitude: number;
	/** Âge maximal d'un adversaire le jour du scrutin. */
	readonly opponentMaxAge: number;
}

/** Entourage et délégation (hypothèses de tuning, P2-05). */
export interface EntourageBalance {
	/** Profils proposés pour un poste vacant. */
	readonly candidatesPerPost: number;
	/** Compétence à laquelle une mission produit exactement ses effets de base. */
	readonly competenceReference: number;
	/** Attitude gagnée à l'embauche, perdue à chaque salaire impayé ou au renvoi. */
	readonly hireAttitude: number;
	readonly unpaidAttitude: number;
	/**
	 * Trimestres de salaires (entourage en poste et nouveau venu) que le budget
	 * politique doit couvrir pour recruter (P3-09).
	 */
	readonly hireReserveQuarters: number;
	readonly dismissAttitude: number;
	/** Sous cette attitude, un collaborateur démissionne. */
	readonly resignAttitude: number;
	/** Seuils de compétence du conseil : précis, puis indicatif ; en dessous, il peut se tromper. */
	readonly preciseAdviceCompetence: number;
	readonly fairAdviceCompetence: number;
	/** Probabilité (déterministe par décision) qu'un conseil médiocre se trompe de sens. */
	readonly poorAdviceErrorChance: number;
}

/** Vie de famille (hypothèses de tuning, P2-08). */
export interface FamilyBalance {
	/** Dépense trimestrielle par enfant à charge, sur l'argent personnel. */
	readonly childCostCents: number;
	/** Âge auquel un enfant n'est plus à charge. */
	readonly childIndependenceAge: number;
	/** Au-delà de ce temps de travail (plan et mandats), la famille se sent délaissée. */
	readonly neglectThreshold: number;
	readonly neglectAttitude: number;
	/** Attitude du partenaire à partir de laquelle il apaise, ou sous laquelle il stresse. */
	readonly supportiveAttitude: number;
	readonly hostileAttitude: number;
	readonly partnerStress: number;
	/** Âge des partenaires générés, autour de celui du joueur. */
	readonly partnerAgeSpread: number;
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
	/** Points ajoutés au score d'un adversaire électoral portant ce trait (P2-06). */
	readonly campaignBonus: number;
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
	/** Âge minimal pour être candidat le jour du scrutin. */
	readonly minAge: number;
	/** Mandat obtenu par le joueur élu. */
	readonly grants: string;
	/** Mandat supplémentaire au-delà d'un score (la tête de liste municipale devient maire). */
	readonly bonusGrant?: { readonly mandate: string; readonly minPercent: number } | undefined;
	/** Mandats dont l'un au moins est exigé pour se présenter (grands électeurs), vide sinon. */
	readonly requiresAnyMandate: readonly string[];
	/** Score de l'adversaire principal, avant aléa. */
	readonly rivalStrength: number;
	/**
	 * Remboursement forfaitaire des frais de campagne (centimes, budget politique),
	 * versé après le scrutin à partir de `refundMinPercent` des voix ; absent : aucun.
	 */
	readonly campaignRefundCents?: number | undefined;
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

/**
 * Groupe de soutien (GDD §4.4). Les groupes électoraux forment la popularité,
 * pondérés par leur poids ; les groupes d'influence (militants, appareil,
 * milieux d'affaires) n'apportent pas de voix.
 */
export interface SupportGroupDefinition {
	/** Identifiant stable, par exemple `support.working_class`. */
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly kind: 'electoral' | 'influence';
	/** Poids dans la popularité (groupes électoraux), 0 pour un groupe d'influence. */
	readonly weight: number;
	/** Soutien de départ, et niveau de référence d'un inconnu sans étiquette ni mandat. */
	readonly startingSupport: number;
	/** Attentes sur les axes, comparées aux positions du parti du joueur. */
	readonly preferences: { readonly [K in AxisId]: number };
	/** Ce groupe juge l'étiquette du joueur selon ses attentes (affinité avec le parti). */
	readonly judgesParty: boolean;
	/** Bonus de référence quand le joueur est encarté (militants, appareil). */
	readonly affiliationBonus: number;
	/** Bonus de référence par mandat exercé (visibilité locale ou nationale). */
	readonly mandateBonus: number;
}

/**
 * Mission persistante d'un poste clé (GDD §5.3) : effets appliqués chaque
 * trimestre, proportionnels à la compétence du collaborateur, temps libéré
 * pour le joueur, et précision des sondages.
 */
export interface MissionDefinition {
	/** Identifiant stable, par exemple `mission.chief.agenda`. */
	readonly id: string;
	readonly label: string;
	readonly description: string;
	/** Effets de base de chaque trimestre (ressources, soutiens, stress, préparation). */
	readonly effects: readonly Effect[];
	/** Points de temps rendus au joueur chaque trimestre. */
	readonly timeBonus: number;
	/** La mission resserre la fourchette des sondages selon la compétence. */
	readonly pollPrecision: boolean;
}

/** Poste clé de l'entourage (GDD §6.2), accessible progressivement. */
export interface PostDefinition {
	/** Identifiant stable, par exemple `post.chief_of_staff`. */
	readonly id: string;
	/** Nom du poste (sans accord de genre). */
	readonly label: string;
	readonly description: string;
	/** Étiquette donnée au titulaire, utilisable par les événements. */
	readonly tag: string;
	/** Salaire trimestriel, prélevé sur le budget politique. */
	readonly salaryCents: number;
	readonly requires?: Condition | undefined;
	readonly unavailableReason?: string | undefined;
	/** Catégories d'événements sur lesquelles le titulaire donne son avis. */
	readonly adviceCategories: readonly string[];
	readonly missions: readonly MissionDefinition[];
}

/**
 * Profil de candidat proposé pour un poste (GDD §6.2) : des arbitrages, pas un
 * classement univoque. Les traits imposés s'ajoutent aux traits tirés.
 */
export interface CandidateProfileDefinition {
	/** Identifiant stable, par exemple `profile.expert`. */
	readonly id: string;
	/** Présentation affichée (« Parcours solide, langue bien pendue »). */
	readonly label: string;
	readonly minCompetence: number;
	readonly maxCompetence: number;
	readonly traits: readonly string[];
}

/** Membre de la famille généré à la création selon l'origine (GDD §3.3). */
export interface FamilyTemplate {
	readonly relation: 'parent' | 'sibling';
	readonly minAge: number;
	readonly maxAge: number;
	/** Attitude de départ envers le joueur. */
	readonly attitude: number;
	/** Étiquettes supplémentaires (un parent élu : `politician`). */
	readonly tags: readonly string[];
}

/**
 * Origine sociale (GDD §3.1) : avantages et handicaps de départ, famille et
 * héritage. Aucune origine n'est meilleure qu'une autre ; elles s'arbitrent.
 */
export interface OriginDefinition {
	/** Identifiant stable, par exemple `origin.working_class`. */
	readonly id: string;
	readonly label: string;
	readonly description: string;
	/** Effets appliqués à la création (ressources, soutiens, stress). */
	readonly effects: readonly Effect[];
	readonly family: readonly FamilyTemplate[];
	/** Patrimoine des parents, partagé entre eux, versé au décès de chacun. */
	readonly inheritanceCents: number;
}

/** Département réel d'une région (millésime figé du COG Insee, P3-16). */
export interface DepartmentDefinition {
	/** Code officiel (`14`, `2A`…). */
	readonly code: string;
	readonly name: string;
	/** Peut accueillir une commune de départ fictive (Paris : non). */
	readonly startable: boolean;
}

/** Région métropolitaine réelle, avec ses fragments toponymiques fictifs (P3-16). */
export interface RegionDefinition {
	/** Identifiant stable, par exemple `region.normandie`. */
	readonly id: string;
	readonly name: string;
	readonly departments: readonly DepartmentDefinition[];
	/** Fragments propres à la région : racines inventées, rivières et pays réels. */
	readonly toponymy: {
		readonly roots: readonly string[];
		readonly rivers: readonly string[];
		readonly pays: readonly string[];
		/** Modèles propres à la région (Corse), à la place des modèles communs. */
		readonly patterns?:
			readonly { readonly pattern: string; readonly weight: number }[] | undefined;
	};
}

/** Taille d'une commune de départ (P3-16) : tirage pondéré, effets légers. */
export interface TownSizeDefinition {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly weight: number;
	/** Ajouté à la force de l'adversaire aux scrutins locaux (municipales). */
	readonly rivalStrengthModifier: number;
	/** Effets de départ (ressources, soutiens, jauges). */
	readonly effects: readonly Effect[];
}

/** Trait d'une commune de départ (P3-16), éventuellement modulé par l'origine sociale. */
export interface TownTraitDefinition {
	readonly id: string;
	/** Adjectif accordé au féminin (« ouvrière »), accolé à la taille. */
	readonly label: string;
	readonly description: string;
	/** Traits incompatibles dans une même commune. */
	readonly excludes: readonly string[];
	/** Tailles où le trait est possible ; absent : toutes. */
	readonly sizes?: readonly string[] | undefined;
	readonly effects: readonly Effect[];
	/** Effets supplémentaires selon l'origine sociale du joueur. */
	readonly origins: readonly { readonly origin: string; readonly effects: readonly Effect[] }[];
}

/**
 * Générateur de noms de communes fictives (P3-16) : modèles pondérés à
 * variables (`{root}`, `{river}`, `{pays}` de la région ; `{saint}`,
 * `{complement}`, `{plural}`, `{standalone}` communs), fragments validés.
 */
export interface ToponymyDefinition {
	readonly patterns: readonly { readonly pattern: string; readonly weight: number }[];
	readonly saints: readonly string[];
	readonly complements: readonly string[];
	readonly plurals: readonly string[];
	readonly standalone: readonly string[];
}

export interface TerritoryDefinition {
	readonly regions: readonly RegionDefinition[];
	readonly sizes: readonly TownSizeDefinition[];
	readonly traits: readonly TownTraitDefinition[];
	readonly traitsPerTown: { readonly min: number; readonly max: number };
	readonly toponymy: ToponymyDefinition;
}

/** Profession avant la politique : effets de départ et action propre éventuelle. */
export interface ProfessionDefinition {
	/** Identifiant stable, par exemple `profession.lawyer`. */
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly effects: readonly Effect[];
}

/** Catalogue du monde : partis, axes et noms des personnages générés. */
/** Année du premier trimestre de toute partie (T1 2000). */
export const START_YEAR = 2000;

/**
 * Époque (P3-07, GDD §8.3) : à partir de son année de début et jusqu'à la
 * suivante. Les événements, actions et améliorations d'une époque ultérieure
 * n'apparaissent pas avant elle.
 */
export interface EraDefinition {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly fromYear: number;
}

export interface WorldDefinition {
	/** Époques, par année de début croissante ; la première commence avec la partie. */
	readonly eras: readonly EraDefinition[];
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
	/**
	 * Récit du résultat, affiché juste après le choix (P3-14) : deuxième personne,
	 * trois phrases au plus, variables d'acteurs permises. Plusieurs variantes
	 * possibles, choisies de façon déterministe par l'instance ; jamais de suite
	 * cachée ni d'issue future. Absent : texte de repli généré depuis les effets.
	 */
	readonly outcome?: readonly string[] | undefined;
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
	/** Époques où l'événement peut survenir (P3-07) ; absent : toutes. */
	readonly eras?: readonly string[] | undefined;
	/** Nombre maximal d'occurrences par carrière, à défaut celui de l'équilibrage (P3-07). */
	readonly maxOccurrences?: number | undefined;
	/** Trimestres minimum entre deux occurrences. */
	readonly cooldownTurns: number;
	/** Une seule occurrence par carrière. */
	readonly unique: boolean;
	readonly when?: Condition | undefined;
	readonly actors: readonly ActorSlot[];
	/**
	 * `promise` : l'événement traite d'une promesse du registre (dilemme, rappel),
	 * transmise par le moteur et citée dans les textes par `{promise}` (P3-04).
	 * `post` : l'événement porte sur un poste d'entourage débloqué, lié à sa
	 * création (vacant d'abord, dans l'ordre du catalogue ; sinon occupé, avec son
	 * titulaire), cité par `{post}` et `{incumbent}` (P3-12).
	 */
	readonly subject?: 'promise' | 'post' | undefined;
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
	/** Thèmes de l'agenda, dans l'ordre d'affichage (vide : un seul groupe). */
	readonly actionCategories: readonly ActionCategory[];
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
	readonly origins: Readonly<Record<string, OriginDefinition>>;
	readonly originIds: readonly string[];
	readonly professions: Readonly<Record<string, ProfessionDefinition>>;
	readonly professionIds: readonly string[];
	/** Profil retenu quand la création n'en précise pas (tests, simulateur). */
	readonly defaultProfile: {
		readonly origin: string;
		readonly profession: string;
		readonly region: string;
	};
	/** Territoire d'origine (P3-16) : régions, tailles et traits de commune, toponymie. */
	readonly territory: TerritoryDefinition;
	readonly regions: Readonly<Record<string, RegionDefinition>>;
	readonly regionIds: readonly string[];
	readonly posts: Readonly<Record<string, PostDefinition>>;
	readonly postIds: readonly string[];
	readonly candidateProfiles: readonly CandidateProfileDefinition[];
	/** Missions indexées par identifiant (toutes définitions de poste confondues). */
	readonly missions: Readonly<Record<string, MissionDefinition>>;
	readonly supportGroups: Readonly<Record<string, SupportGroupDefinition>>;
	/** Ordre du catalogue : électoraux puis influence, ordre stable d'évolution. */
	readonly supportGroupIds: readonly string[];
	/** Ordre du catalogue : ordre stable des tirages de traits. */
	readonly traitIds: readonly string[];
	/** Partis indexés par identifiant. */
	readonly parties: Readonly<Record<string, PartyDefinition>>;
	/** Ordre du catalogue : ordre stable de l'évolution autonome. */
	readonly partyIds: readonly string[];
	/** Types d'infractions du registre des faits, par identifiant (P3-01). */
	readonly offenses: Readonly<Record<string, OffenseDefinition>>;
	readonly offenseIds: readonly string[];
	readonly justice: JusticeBalance;
	/** Trains de vie, par identifiant, et leur ordre de rang (P3-02). */
	readonly lifestyles: Readonly<Record<string, LifestyleDefinition>>;
	readonly lifestyleIds: readonly string[];
	readonly wealth: Omit<WealthDefinition, 'lifestyles'>;
	/** Promesses types, par identifiant, dans l'ordre du catalogue (P3-04). */
	readonly promises: Readonly<Record<string, PromiseDefinition>>;
	readonly promiseIds: readonly string[];
	readonly promiseRules: PromisesBalance;
	/** Médias du catalogue, par identifiant, dans l'ordre du catalogue (P3-03). */
	readonly media: Readonly<Record<string, MediaDefinition>>;
	readonly mediaIds: readonly string[];
	readonly headlines: readonly HeadlineDefinition[];
	readonly press: PressBalance;
	/** Paramètres institutionnels réformables, par identifiant, ordre du catalogue (P3-05). */
	readonly institutionParameters: Readonly<Record<string, InstitutionParameter>>;
	readonly institutionParameterIds: readonly string[];
	/** Niveaux, par identifiant : paramètre et rang dans l'ordre des niveaux. */
	readonly institutionLevels: Readonly<
		Record<string, { readonly parameterId: string; readonly index: number }>
	>;
	readonly reforms: ReformsBalance;
	/** Nécrologies et distinctions du bilan final (P3-08), dans l'ordre du catalogue. */
	readonly obituaries: readonly ObituaryDefinition[];
	readonly distinctions: readonly DistinctionDefinition[];
}
