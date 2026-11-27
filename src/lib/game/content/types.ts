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
	'player_party_leader',
	/** Quotidien de la région du joueur (P3-18). */
	'regional_media'
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
	/** Rang dans le parti (P3-34) : 0 sans parti, 1 militant, 2 cadre, 3 chef. */
	'player.partyRank',
	/** Candidature à la direction possible au prochain congrès (P3-34), 1 ou 0. */
	'player.partyBidOpen',
	/** Candidature à la direction déclarée (P3-34), 1 ou 0. */
	'player.partyBid',
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
	/** Base militante active, en nombre de personnes (P3-19). */
	'player.activists',
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
	/** Portefeuille ministériel exercé (P3-35). */
	| { readonly op: 'holdsPortfolio'; readonly portfolio: string }
	/** Le joueur pourrait recevoir ce mandat sans en quitter aucun (cumul et incompatibilités). */
	| { readonly op: 'canHoldMandate'; readonly mandate: string }
	/** Origine ou engagement du joueur (P2-08). */
	| { readonly op: 'origin'; readonly origin: string }
	| { readonly op: 'engagement'; readonly engagement: string }
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
	| { readonly op: 'declareCandidacy'; readonly role?: 'head' | 'colistier' | undefined }
	| { readonly op: 'runoffDecision'; readonly decision: RunoffDecision }
	| { readonly op: 'requestInvestiture' }
	| { readonly op: 'partyBid'; readonly posture: PartyPosture }
	| { readonly op: 'appointment'; readonly decision: 'accept' | 'decline' }
	| { readonly op: 'rallySupport'; readonly value: number }
	| { readonly op: 'investitureDecision'; readonly decision: 'dissident' | 'renounce' }
	/** Préparation ajoutée à chaque campagne en cours. */
	| { readonly op: 'prepareCampaign'; readonly value: number }
	/**
	 * Avance personnelle à la campagne choisie dans le plan (`target` de type
	 * `campaign`, P3-23) : le montant, égal au coût en argent personnel de
	 * l'action, est versé au budget politique et remboursé après le scrutin si le
	 * score atteint `campaigns.advanceRepayMinPercent`.
	 */
	| { readonly op: 'advanceCampaign'; readonly valueCents: number }
	/** Embauche du candidat choisi dans le plan (`target`), sur son poste (P2-05). */
	/** Offre faite au candidat (P3-20) : réduite, standard (par défaut) ou généreuse. */
	| { readonly op: 'hireStaff'; readonly offer?: HireOffer | 'counter' | undefined }
	/** Entretien approfondi avec un candidat présélectionné (P3-20), avant l'offre. */
	| { readonly op: 'courtCandidate' }
	/**
	 * Recherche de candidats pour le poste choisi dans le plan (`target` de type
	 * `search` : `post.x` ou `post.x/trait.y`), à ce niveau (P3-21). Le prix est
	 * le coût de l'action ; les candidats arrivent à l'échéance du niveau.
	 */
	| { readonly op: 'orderSearch'; readonly level: SearchLevel }
	/** Vérification du dossier du candidat choisi (P3-21) : indices, jamais de certitude. */
	| { readonly op: 'vetCandidate' }
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
	/**
	 * Le collaborateur de ce rôle obtient le salaire demandé à sa compétence
	 * actuelle (renégociation, P3-21).
	 */
	| { readonly op: 'grantRaise'; readonly role: string }
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
 * Façon de tenir une promesse (P3-22) : `decide` pour un mandat exécutif qui
 * décide (mairie), `carry` pour un mandat d'assemblée qui porte et vote un
 * texte ou un budget (conseil régional, Assemblée, Sénat).
 */
export const PROMISE_MODES = ['decide', 'carry'] as const;
export type PromiseMode = (typeof PROMISE_MODES)[number];

/** Variable autorisée dans la description d'une promesse : le lieu du scrutin (P3-22). */
export const PROMISE_PLACE_VARIABLE = 'place';

/** Grand thème commun aux déclinaisons d'une promesse selon le scrutin (P3-22). */
export interface PromiseThemeDefinition {
	readonly id: string;
	readonly label: string;
}

/**
 * Promesse type (P3-04), déclinée par scrutin (P3-22) : un engagement de
 * campagne propre à une élection, le levier institutionnel qui permet de le
 * tenir, et ses conséquences selon qu'il est tenu, partiellement tenu ou
 * abandonné. Effets limités aux ressources, jauges et soutiens ; aucune
 * simulation de politique publique.
 */
export interface PromiseDefinition {
	readonly id: string;
	/** Intitulé de la promesse, cité dans les textes (`{promise}`), sans variable. */
	readonly label: string;
	/** Thème commun (`theme.*`), partagé par les déclinaisons des autres scrutins. */
	readonly theme: string;
	/** Description ; `{place}` y désigne le lieu du scrutin (commune, région, département). */
	readonly description: string;
	/** Seule élection où l'engagement peut être pris (P3-22). */
	readonly election: string;
	/**
	 * Mandats qui donnent le levier pour tenir la promesse, tous attribuables
	 * par cette élection. Élu sans l'un d'eux, la promesse ne sera au mieux que
	 * partiellement tenue.
	 */
	readonly lever: readonly string[];
	readonly mode: PromiseMode;
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
	/**
	 * Événements de rappel, par issue (sujet `promise`) : `kept` et `abandoned`
	 * pour une promesse de même échelle que la campagne en cours, `keptElsewhere`
	 * et `abandonedElsewhere` pour une promesse d'une autre échelle (P3-22).
	 */
	readonly recallEvents: {
		readonly kept: string;
		readonly abandoned: string;
		readonly keptElsewhere: string;
		readonly abandonedElsewhere: string;
	};
}

export interface PromisesDefinition {
	readonly themes: readonly PromiseThemeDefinition[];
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
 * Rôle stable du quotidien de la région du joueur (P3-18) : utilisable à la
 * place d'un identifiant de média dans `addMediaRelation` et `asset.media`.
 */
export const REGIONAL_ANCHOR = 'regional_anchor';

/**
 * Média fictif (P3-03, GDD §9.1) : ligne éditoriale, audience, groupes qui le
 * lisent et goût pour chaque sujet. Un média national ne s'intéresse au joueur
 * qu'à partir d'une portée nationale ou d'un seuil d'exposition (sauf affaires
 * judiciaires et rachat) ; un quotidien régional (P3-18) ne suit que les
 * personnages de sa région.
 */
export interface MediaDefinition {
	readonly id: string;
	readonly name: string;
	readonly kind: MediaKind;
	/** Ligne éditoriale, en quelques mots. */
	readonly line: string;
	readonly description: string;
	readonly scope: 'national' | 'regional';
	/** Région couverte, pour un quotidien régional (un seul par région). */
	readonly region?: string | undefined;
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
	/** Rang de mandat à partir duquel la presse nationale suit le joueur (P3-18). */
	readonly nationalMandateRank: number;
	/** Poids du quotidien régional dans une carrière de portée nationale, en % (P3-18). */
	readonly regionalNationalPercent: number;
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

/**
 * Formats d'une action à l'échelle (P3-23), du plus petit au plus grand :
 * trois intensités lisibles plutôt qu'un curseur.
 */
export const ACTION_FORMATS = ['modest', 'sustained', 'major'] as const;
export type ActionFormat = (typeof ACTION_FORMATS)[number];

/**
 * Famille d'actions à l'échelle (P3-23) : une seule ligne d'agenda, trois
 * formats (actions du catalogue rattachées par `scale`), un seul format par
 * trimestre, et éventuellement un plafond annuel sur une ressource dépensée.
 */
export interface ActionFamilyDefinition {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	/** Dépense maximale de cette ressource par année civile, tous formats confondus. */
	readonly annualCap?: ResourceAmount | undefined;
}

/** Rattachement d'une action à sa famille et son format (P3-23). */
export interface ActionScale {
	readonly family: string;
	readonly format: ActionFormat;
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
	 * Action de terrain (P3-19) : effet unitaire ajouté une fois par cran du
	 * palier militant atteint (bonus annoncé dans la prévision, aucun tirage).
	 */
	readonly fieldwork?: FieldworkBonus | undefined;
	/** Format d'une famille d'actions à l'échelle (P3-23). */
	readonly scale?: ActionScale | undefined;
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
		| 'search'
		/** `campaign` : une candidature en cours (P3-23, avance de campagne). */
		| 'campaign'
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
	/**
	 * Accueil des militants (P3-19) : capacité ajoutée par exemplaire actif et
	 * départs trimestriels évités, en points de pourcentage.
	 */
	readonly activists?: { readonly capacity: number; readonly retentionPercent: number } | undefined;
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
	readonly activists: ActivistsBalance;
	/** Carrière partisane (P3-34). */
	readonly partyCareer: PartyCareerBalance;
	/** Gouvernement : président, nominations et remaniements (P3-35). */
	readonly government: GovernmentBalance;
}

/** Gouvernement (P3-35, décisions déléguées provisoires). */
export interface GovernmentBalance {
	/** Stature exigée pour un secrétariat d'État, puis pour un ministère. */
	readonly secretaryStature: number;
	readonly ministerStature: number;
	/** Remaniement possible sous cette stabilité, avec cette chance par trimestre (%). */
	readonly reshuffleStability: number;
	readonly reshuffleChancePercent: number;
	/** Popularité en deçà de laquelle un membre du gouvernement est remercié au remaniement. */
	readonly keepPopularity: number;
	/** Mandat présidentiel (trimestres), premier scrutin, chance de réélection (%). */
	readonly presidentTermTurns: number;
	readonly firstPresidentialTurn: number;
	readonly reelectionChancePercent: number;
	/** Événement bloquant de la proposition de nomination (`followUp`). */
	readonly appointmentEvent: string;
}

/** Portefeuille ministériel jouable (P3-35). */
export interface PortfolioDefinition {
	readonly id: string;
	/** Nom court (« Intérieur »). */
	readonly label: string;
	/** Nom du ministère, en minuscules (« ministère de l’Intérieur »). */
	readonly title: string;
}

/** Posture d'une candidature à la direction du parti (P3-34). */
export type PartyPosture = 'unity' | 'apparatus' | 'rupture';
export const PARTY_POSTURES = ['unity', 'apparatus', 'rupture'] as const;

/**
 * Carrière partisane (P3-34, décisions déléguées provisoires) : promotion de
 * cadre par opportunité, congrès réguliers, candidature à la direction.
 */
export interface PartyCareerBalance {
	/** Trimestres entre deux congrès, et rang du congrès dans le cycle (`turn % cycle`). */
	readonly congressCycleTurns: number;
	readonly congressOffset: number;
	/** Promotion de cadre : appui de l'appareil, militants et ancienneté minimaux, chance par trimestre (%). */
	readonly cadreMinApparatus: number;
	readonly cadreMinActivists: number;
	readonly cadreMinTurns: number;
	readonly cadreChancePercent: number;
	/** Poids (en %) de l'appareil, du soutien militant et de l'influence dans un congrès. */
	readonly apparatusPercent: number;
	readonly activistsPercent: number;
	readonly influencePercent: number;
	/** Points par ralliement obtenu, plafonnés. */
	readonly rallyPoints: number;
	readonly rallyCap: number;
	/** Bornes de la chance de l'emporter au congrès (%). */
	readonly minChancePercent: number;
	readonly maxChancePercent: number;
	/** Seuils d'appréciation : « favori », « congrès ouvert ». */
	readonly favoriteFrom: number;
	readonly openFrom: number;
	/** Congrès à attendre après une défaite avant une nouvelle candidature. */
	readonly retryCongresses: number;
	/** Appui de l'appareil perdu après une défaite (doublé pour la rupture). */
	readonly defeatApparatus: number;
	/** Chef : contesté sous cet appui de l'appareil, et chance d'être renversé (%). */
	readonly leaderChallengeApparatus: number;
	readonly leaderOustChancePercent: number;
	/** Bonus d'investiture d'un cadre et d'un chef du parti. */
	readonly cadreInvestitureBonus: number;
	readonly leaderInvestitureBonus: number;
}

/** Bonus de terrain d'une action (P3-19) : ressource ou préparation de campagne. */
export type FieldworkBonus =
	| { readonly op: 'addResource'; readonly resource: ResourceId; readonly value: number }
	| { readonly op: 'prepareCampaign'; readonly value: number };

/** Palier de la base militante (P3-19), du noyau à l'organisation nationale. */
export interface ActivistTierDefinition {
	readonly id: string;
	readonly label: string;
	/** Effectif minimal du palier. */
	readonly min: number;
	/** Nombre de fois que le bonus de terrain d'une action s'ajoute. */
	readonly fieldMultiplier: number;
	/** Frais logistiques (locaux, impressions, déplacements), en centimes par trimestre. */
	readonly upkeepCents: number;
}

/**
 * Base militante organique (P3-19, PT-P3-09-014 ; hypothèses de tuning). Chaque
 * trimestre, la notoriété fait connaître le joueur, le soutien militant décide
 * qui reste ; la capacité d'accueil plafonne la croissance, l'attrition et le
 * mécontentement font partir.
 */
export interface ActivistsBalance {
	/** Effectif au départ (amis, collègues, premiers sympathisants). */
	readonly start: number;
	/** Capacité d'accueil sans local ni parti. */
	readonly baseCapacity: number;
	/** Capacité ajoutée par l'adhésion à un parti (relais de la section). */
	readonly partyCapacity: number;
	/** Capacité ajoutée par point de rang de chaque mandat en cours. */
	readonly mandateCapacityPerRank: number;
	/** Audience : √influence × ce facteur… */
	readonly reachInfluenceFactor: number;
	/** … plus l'exposition divisée par cette valeur… */
	readonly reachExposureDivisor: number;
	/** … plus ce bonus par campagne en cours. */
	readonly campaignReach: number;
	/** Soutien militant en deçà duquel personne ne s'engage. */
	readonly attractionThreshold: number;
	/** Taux d'engagement de l'audience par point de soutien au-delà du seuil, en %. */
	readonly attractionPercentPerPoint: number;
	/** Départs naturels par trimestre, en % de l'effectif. */
	readonly baseAttritionPercent: number;
	/** Soutien militant en deçà duquel la base se démobilise davantage. */
	readonly discontentThreshold: number;
	/** Départs supplémentaires : un point de % par tranche de cette taille sous le seuil. */
	readonly discontentDivisor: number;
	/** Départs supplémentaires au-delà de la capacité d'accueil, en %. */
	readonly overCapacityAttritionPercent: number;
	/** Recrues après un scrutin disputé : tant de personnes par point de % des voix, en dixièmes. */
	readonly recruitsPerVoteTenths: number;
	/** Cotisations reversées par militant et par trimestre, en centimes (budget politique). */
	readonly duesCents: number;
	/** Part du besoin de mobilisation couverte par la machine du parti en cas d'investiture, en %. */
	readonly partyMachinePercent: number;
	/** Pénalité de score maximale d'une campagne sans aucune mobilisation. */
	readonly mobilizationWeight: number;
	/** Paliers, par effectif minimal croissant (le premier commence à 0). */
	readonly tiers: readonly ActivistTierDefinition[];
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
	/** Scrutins réalistes (P3-29) : candidatures locales, tours et sièges. */
	readonly contests: ContestsBalance;
}

/**
 * Scrutins réalistes (P3-29, décisions déléguées provisoires) : qui se
 * présente, avec quelle force, et comment les voix se reportent au second tour.
 */
export interface ContestsBalance {
	/** Part nationale minimale (‰) pour qu'un parti présente une liste ou un candidat. */
	readonly minPartyPerMille: number;
	/** Candidatures ou listes de partis au plus, hors joueur et adversaire nommé. */
	readonly maxPartyContestants: number;
	/** Force de la liste du premier parti, en % de la force de base de l'élection. */
	readonly partyStrengthPercent: number;
	/** Part des voix d'un éliminé qui se reporte au second tour, en %. */
	readonly transferPercent: number;
	/** Part des voix conservée par une liste qui fusionne, en %. */
	readonly mergeRetentionPercent: number;
	/** Écart moyen de positions (0 à 200) en deçà duquel deux forces sont alliées. */
	readonly allyDistance: number;
	/** Aléa maximal ajouté à chaque candidature au second tour. */
	readonly runoffSwing: number;
	/** Part de la préparation du joueur colistier qui renforce sa liste, en %. */
	readonly colistierPreparationPercent: number;
	/** Prime des grands électeurs par mandat local exercé (sénatoriales). */
	readonly grandElectorBonus: number;
	/** Étendue des rangs possibles d'un colistier, en % des sièges. */
	readonly rankSpreadPercent: number;
	/** Points d'appui retirés à un colistier sans carte du parti de la liste. */
	readonly outsiderRankPenalty: number;
	/** Événement bloquant de la décision d'entre-deux-tours (`followUp`). */
	readonly runoffEvent: string;
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
/**
 * Investiture nationale (P3-30, décisions déléguées provisoires) : appréciation
 * de la candidature par l'appareil, sans seuil affiché ; décision tirée une fois.
 */
export interface InvestitureBalance {
	/** Poids (en %) de l'appui de l'appareil, de l'influence (plafonnée à 100) et de la popularité. */
	readonly apparatusPercent: number;
	readonly influencePercent: number;
	readonly popularityPercent: number;
	/** Points par mandat exercé, plafonnés. */
	readonly mandatePoints: number;
	readonly mandateCap: number;
	/** Points d'un mandat local ou régional exercé (ancrage). */
	readonly localPoints: number;
	/** Pénalité quand un candidat mieux placé brigue l'investiture, et sa fréquence (%). */
	readonly rivalPenalty: number;
	readonly rivalChancePercent: number;
	/** Bornes de la chance d'investiture (%). */
	readonly minChancePercent: number;
	readonly maxChancePercent: number;
	/** Seuils d'appréciation : « candidature soutenue », « investiture disputée ». */
	readonly supportedFrom: number;
	readonly disputedFrom: number;
	/** Appui de l'appareil perdu par une candidature dissidente. */
	readonly dissidentApparatus: number;
	/** Événement bloquant après un refus (`followUp`). */
	readonly refusedEvent: string;
}

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
	/** Score minimal (en %) pour que l'avance personnelle de campagne soit remboursée (P3-23). */
	readonly advanceRepayMinPercent: number;
	/** Points gagnés par un adversaire pour chacune de ses victoires passées contre le joueur. */
	readonly rivalExperienceBonus: number;
	/** Nombre maximal de victoires prises en compte. */
	readonly rivalExperienceCap: number;
	/** Variation d'attitude d'un adversaire après chaque affrontement. */
	readonly rivalryAttitude: number;
	/** Âge maximal d'un adversaire le jour du scrutin. */
	readonly opponentMaxAge: number;
	/** Investiture nationale (P3-30). */
	readonly investiture: InvestitureBalance;
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
	/** Recrutement : salaire, attractivité, acceptation (P3-20). */
	readonly recruitment: RecruitmentBalance;
	/** Recherche, vérification, progression et renégociations (P3-21). */
	readonly search: SearchBalance;
	readonly vetting: Readonly<Record<VettingLevel, VettingBalance>>;
	readonly progression: ProgressionBalance;
	readonly renegotiation: RenegotiationBalance;
}

/** Niveaux de recherche de candidats (P3-21). */
export const SEARCH_LEVELS = ['simple', 'targeted', 'headhunt'] as const;
export type SearchLevel = (typeof SEARCH_LEVELS)[number];

/** Fiabilité d'une vérification de dossier (P3-21). */
export const VETTING_LEVELS = ['standard', 'thorough'] as const;
export type VettingLevel = (typeof VETTING_LEVELS)[number];

export interface SearchLevelBalance {
	/** Prix, égal au coût en budget politique de l'action qui la commande. */
	readonly costCents: number;
	/** Trimestres avant le résultat (1 : à la frontière suivante). */
	readonly delayTurns: number;
	/** Candidats trouvés en cas de succès (dans la limite de la présélection). */
	readonly candidates: number;
	/** Chance de trouver, en %, avant la pénalité d'un trait recherché. */
	readonly findPercent: number;
	/**
	 * Compétence des candidats trouvés ; `profile` nul : profils du vivier
	 * spontané (gradué par l'attractivité), sinon ce profil de recherche.
	 */
	readonly profile: string | null;
	/** Un trait public peut être exigé à ce niveau. */
	readonly traitAllowed: boolean;
	/** Dossier des candidats vérifié d'office, à ce niveau de fiabilité. */
	readonly vetting: VettingLevel | null;
}

export interface SearchBalance {
	readonly levels: Readonly<Record<SearchLevel, SearchLevelBalance>>;
	/** Points de % retirés à la chance de trouver quand un trait est exigé. */
	readonly traitPenalty: number;
	/** Part du prix rendue si la recherche échoue ou devient sans objet, en %. */
	readonly failureRefundPercent: number;
	/** Taille maximale d'une présélection (spontanés et recherches). */
	readonly maxShortlist: number;
}

export interface VettingBalance {
	/** Chance qu'un trait caché réel soit signalé, en %. */
	readonly truePercent: number;
	/** Chance qu'un trait caché absent soit signalé à tort, en %. */
	readonly falsePercent: number;
}

/** Progression des collaborateurs (P3-21) : dixièmes de compétence par trimestre exercé. */
export interface ProgressionBalance {
	/** Gain selon la compétence actuelle, en dixièmes de point (interpolé). */
	readonly curve: readonly { readonly competence: number; readonly tenths: number }[];
	/** Attitude gagnée à chaque anniversaire d'embauche. */
	readonly seniorityAttitude: number;
}

/** Renégociations (P3-21) : à chaque palier de compétence, au plus une fois par période. */
export interface RenegotiationBalance {
	/** Points de compétence gagnés depuis la dernière demande (ou l'embauche) pour réclamer. */
	readonly stepCompetence: number;
	/** Trimestres minimum entre deux demandes du même collaborateur. */
	readonly minTurns: number;
	/** Événement bloquant de la demande (rôle `collaborator`). */
	readonly event: string;
}

/** Offre d'embauche (P3-20). */
export const HIRE_OFFERS = ['low', 'standard', 'generous'] as const;
export type HireOffer = (typeof HIRE_OFFERS)[number];

/** Paramètres d'une offre : salaire, intérêt du candidat, attitude, prime. */
export interface HireOfferBalance {
	/** Salaire convenu, en % de la prétention du candidat. */
	readonly salaryPercent: number;
	/** Points d'intérêt ajoutés (ou retirés) à l'estimation du candidat. */
	readonly interest: number;
	/** Attitude ajoutée à celle de l'embauche. */
	readonly attitude: number;
	/** Prime à l'acceptation, en % du salaire trimestriel convenu (payée avec le premier salaire). */
	readonly bonusPercent: number;
}

/**
 * Recrutement (P3-20, PT-P3-09-005/006 ; hypothèses de tuning) : salaire selon
 * la compétence, attractivité de la carrière, intérêt du candidat et offres.
 */
export interface RecruitmentBalance {
	/** Courbe du salaire demandé : % du salaire de référence du poste, par compétence (interpolée). */
	readonly salaryCurve: readonly { readonly competence: number; readonly percent: number }[];
	/** Arrondi du salaire demandé, en centimes. */
	readonly salaryRoundingCents: number;
	readonly offers: Readonly<Record<HireOffer, HireOfferBalance>>;
	/** Attractivité : plafonds de chaque facteur (somme ≤ 100). */
	readonly influenceMax: number;
	/** Points d'attractivité par √influence. */
	readonly influencePerRoot: number;
	readonly popularityMax: number;
	/** Rang de mandat pour le plafond de ce facteur. */
	readonly mandateRankForMax: number;
	readonly mandateMax: number;
	readonly apparatusMax: number;
	/** Trimestres de masse salariale (nouveau venu compris) couverts pour le plafond. */
	readonly coveredQuartersForMax: number;
	readonly payrollMax: number;
	/** Exigence du candidat : % de sa compétence que l'attractivité doit atteindre. */
	readonly demandPercent: number;
	/** Chance d'accepter à marge nulle, points de % par point de marge, bornes. */
	readonly baseAcceptPercent: number;
	readonly acceptPerPoint: number;
	readonly minAcceptPercent: number;
	readonly maxAcceptPercent: number;
	/** Intérêt gagné par entretien approfondi, et nombre maximal d'entretiens utiles. */
	readonly interviewInterest: number;
	readonly maxInterviews: number;
	/** Attitude d'un candidat qui décline. */
	readonly refusalAttitude: number;
	/** Salaire réclamé après un premier refus (P3-33), en % du salaire demandé. */
	readonly counterOfferPercent: number;
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
	/**
	 * Tenu à l'écart des alliances d'entre-deux-tours (P3-29) : ni fusion ni
	 * désistement avec lui, de part et d'autre.
	 */
	readonly cordon?: boolean | undefined;
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
/** Décision du joueur entre les deux tours (P3-29). */
export type RunoffDecision = 'maintain' | 'merge' | 'withdraw';

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
	/** Mandat de la tête de la liste victorieuse (le maire, élu par le conseil), sinon absent. */
	readonly headGrant?: string | undefined;
	/** Un candidat encarté doit demander l'investiture de son parti (P3-30). */
	readonly investiture?: boolean | undefined;
	/**
	 * Mode de scrutin (P3-29) : liste à deux tours avec prime majoritaire,
	 * uninominal à deux tours, ou sénatoriales (grands électeurs, liste à la
	 * proportionnelle ou majoritaire selon le nombre de sièges du département).
	 */
	readonly system: 'list' | 'single' | 'senate';
	/** Participation tirée au scrutin, en % des inscrits. */
	readonly turnout: { readonly min: number; readonly max: number };
	/**
	 * Seuil de maintien au second tour, en ‰ : des suffrages exprimés pour une
	 * liste, des inscrits pour un scrutin uninominal.
	 */
	readonly maintainPerMille: number;
	/** Seuil de fusion d'une liste, en ‰ des exprimés ; 0 : aucune fusion. */
	readonly mergePerMille: number;
	/** Seuil de répartition des sièges d'une liste, en ‰ des exprimés. */
	readonly seatMinPerMille: number;
	/** Prime majoritaire de la liste en tête, en % des sièges. */
	readonly bonusSeatsPercent: number;
	/** Uninominal : part des inscrits exigée pour l'emporter au premier tour, en ‰ ; 0 : aucune. */
	readonly firstRoundRegisteredPerMille: number;
	/** Sénatoriales : sièges d'un département sans valeur propre, et seuil de la proportionnelle. */
	readonly senate?:
		{ readonly defaultSeats: number; readonly proportionalMinSeats: number } | undefined;
	/** Mandats dont l'un au moins est exigé pour se présenter (grands électeurs), vide sinon. */
	readonly requiresAnyMandate: readonly string[];
	/** Score de l'adversaire principal, avant aléa. */
	readonly rivalStrength: number;
	/**
	 * Remboursement forfaitaire des frais de campagne (centimes, budget politique),
	 * versé après le scrutin à partir de `refundMinPercent` des voix ; absent : aucun.
	 */
	readonly campaignRefundCents?: number | undefined;
	/**
	 * Besoin de mobilisation (P3-19) : militants nécessaires pour couvrir le
	 * territoire du scrutin ; en deçà, le score baisse (jamais l'éligibilité).
	 */
	readonly mobilizationNeed: number;
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
	/**
	 * Vivier gradué (P3-20) : attractivité à partir de laquelle le profil se
	 * présente couramment (poids 10) ; en deçà, poids de rareté (0 : jamais).
	 */
	readonly minAttractiveness: number;
	readonly rareWeight: number;
	/** Profil réservé aux résultats d'une recherche (P3-21), jamais spontané. */
	readonly searchOnly?: boolean | undefined;
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
	/** Sénateurs élus par le département (P3-29), sinon la valeur par défaut de l'élection. */
	readonly senators?: number | undefined;
}

/** Région métropolitaine réelle, avec ses fragments toponymiques fictifs (P3-16). */
export interface RegionDefinition {
	/** Identifiant stable, par exemple `region.normandie`. */
	readonly id: string;
	readonly name: string;
	readonly departments: readonly DepartmentDefinition[];
	/** Sièges du conseil régional (P3-29). */
	readonly councilSeats: number;
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
	/** Sièges du conseil municipal (P3-29). */
	readonly councilSeats: number;
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

/** Terrain d’engagement (P3-17) : ce qui a mené à la politique ; effets de départ, actions propres. */
export interface EngagementDefinition {
	/** Identifiant stable, par exemple `engagement.union`. */
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
	 * `staff` : l'événement porte sur le collaborateur transmis par le moteur
	 * (rôle `collaborator`, renégociation P3-21) ; annulé s'il n'est plus en poste.
	 */
	readonly subject?: 'promise' | 'post' | 'staff' | undefined;
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
	/** Familles d'actions à l'échelle, par identifiant, dans l'ordre du catalogue (P3-23). */
	readonly actionFamilies: Readonly<Record<string, ActionFamilyDefinition>>;
	readonly actionFamilyIds: readonly string[];
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
	/** Portefeuilles ministériels jouables (P3-35). */
	readonly portfolios: Readonly<Record<string, PortfolioDefinition>>;
	readonly portfolioIds: readonly string[];
	readonly institutions: InstitutionsDefinition;
	readonly origins: Readonly<Record<string, OriginDefinition>>;
	readonly originIds: readonly string[];
	readonly engagements: Readonly<Record<string, EngagementDefinition>>;
	readonly engagementIds: readonly string[];
	/** Profil retenu quand la création n'en précise pas (tests, simulateur). */
	readonly defaultProfile: {
		readonly origin: string;
		readonly engagement: string;
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
	/** Thèmes communs des promesses, par identifiant (P3-22). */
	readonly promiseThemes: Readonly<Record<string, PromiseThemeDefinition>>;
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
