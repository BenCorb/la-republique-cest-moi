/**
 * État central de la partie (ARCHITECTURE.md §4.1) — sous-ensemble du prototype.
 *
 * L'état est un objet JSON pur (nombres, chaînes, booléens, tableaux, objets,
 * `null`) : il se sérialise et se recharge sans perte.
 */
import { GAUGE_MAX } from '../content/types.ts';
import type {
	ArticleTone,
	ArticleTopic,
	Content,
	GaugeId,
	IndicatorId,
	PromiseStatus,
	SearchLevel,
	InstitutionsDefinition,
	ResourceId,
	Resources
} from '../content/types.ts';
import { TURNS_PER_YEAR, type Turn } from './calendar.ts';
import { createRng, type RngState } from './random.ts';
import { createCalendar } from './career.ts';
import { createCast } from './characters.ts';
import { computePopularity, startingSupports } from './supports.ts';
import { EMPTY_FAMILY, createFamily, type FamilyRecord } from './family.ts';
import { applyPoliticalEffect } from './world.ts';
import { gaugeKey } from './effects.ts';
import { createWorld } from './world.ts';
import { startingParameters } from './reforms.ts';
import { createTerritory, territoryEffects, type TerritoryState } from './territory.ts';

/** Version du format de l'état, à incrémenter avec une migration explicite. */
export const STATE_SCHEMA_VERSION = 1;

/** Premier tour d'une partie : T1 2000. */
export const START_TURN: Turn = 0;

/** Profil fixe du prototype : personnage de 25 ans au début de la partie (GDD §3.1). */
export const PROTOTYPE_STARTING_AGE = 25;

export type GamePhase = 'planning' | 'decision' | 'ended';

/** Période d'adhésion à un parti, conservée pour le bilan et les événements. */
export interface Affiliation {
	readonly partyId: string;
	/** Trimestre de l'adhésion. */
	readonly fromTurn: Turn;
	/** Trimestre du départ, `null` pour l'adhésion en cours. */
	readonly toTurn: Turn | null;
}

export interface PlayerState {
	/** Trimestre de naissance ; l'âge en est toujours dérivé. */
	readonly birthTurn: Turn;
	/** Santé, entier de 0 à 100 ; 0 signifie le décès. */
	readonly health: number;
	/** Stress, entier de 0 à 100. */
	readonly stress: number;
	/** Exposition médiatique, entier de 0 à 100 (P3-01). */
	readonly exposure: number;
	/** Préparation de la défense, entier de 0 à 100 (P3-01). */
	readonly defense: number;
	/** Inéligible jusqu'à ce trimestre exclu, `null` sinon (P3-01). */
	readonly ineligibleUntil: Turn | null;
	/** Train de vie en cours (`lifestyle.*`, P3-02). */
	readonly lifestyle: string;
	/** Parti du joueur, `null` s'il n'est pas encarté. */
	readonly partyId: string | null;
	/** Historique des adhésions, dans l'ordre ; seule la dernière peut être en cours. */
	readonly affiliations: readonly Affiliation[];
	/** Soutien de chaque groupe envers le joueur, de 0 à 100 (public : sondages). */
	readonly supports: Readonly<Record<string, number>>;
	/** Popularité : synthèse pondérée des soutiens électoraux, toujours recalculée. */
	readonly popularity: number;
	/** Origine sociale et engagement choisies à la création (P2-08). */
	readonly origin: string;
	readonly engagement: string;
	/** Territoire d'origine : région choisie, département et commune tirés (P3-16). */
	readonly territory: TerritoryState;
	readonly family: FamilyState;
	/** Base militante active, en nombre de personnes (P3-19). */
	readonly activists: number;
}

/** Liens familiaux du joueur : identifiants de personnages (P2-08). */
export interface FamilyState {
	readonly partnerId: string | null;
	readonly childrenIds: readonly string[];
	readonly parentIds: readonly string[];
	readonly siblingIds: readonly string[];
	/** Ex-partenaires (séparation) et partenaires décédés. */
	readonly formerPartnerIds: readonly string[];
}

export type CharacterStatus = 'active' | 'retired' | 'dead';

/**
 * Personnage nommé (GDD §6.1, P2-04) : modèle commun aux membres de la
 * distribution initiale, aux dirigeants de parti et aux successeurs générés.
 * Un personnage parti reste dans l'état : textes figés, souvenirs et bilan le citent.
 */
export interface Character {
	/**
	 * Identifiant de la distribution (`cast.x`) pour un personnage initial, sinon
	 * `character.N`, N étant le rang de création (personnages jamais supprimés).
	 */
	readonly id: string;
	readonly name: string;
	/** Fonction affichée après le nom (successeurs générés), sinon `null`. */
	readonly epithet: string | null;
	readonly birthTurn: Turn;
	readonly partyId: string | null;
	/** Étiquettes de rôle (`journalist`, `party_leader`…) utilisées par les événements. */
	readonly tags: readonly string[];
	/** Fonction transmise au successeur à son départ ; `null` : pas de remplacement. */
	readonly renewal: string | null;
	/** Compétence générale, de 0 à 100, visible sur le CV d'un candidat (P2-05). */
	readonly competence: number;
	/** Traits réels : jamais exposés tels quels au joueur. */
	readonly traits: readonly string[];
	/** Traits connus du joueur (publics dès le départ, cachés une fois révélés). */
	readonly knownTraits: readonly string[];
	readonly status: CharacterStatus;
	/** Trimestre de départ (retraite ou décès), `null` tant qu'il est actif. */
	readonly leftTurn: Turn | null;
	/** Personnage auquel il succède, le cas échéant. */
	readonly successorOf: string | null;
}

/** Souvenir d'un acte important du joueur, gardé par un personnage. */
export interface Memory {
	readonly turn: Turn;
	/** Texte déjà résolu, en français. */
	readonly text: string;
	/** Sens de la variation d'attitude associée. */
	readonly tone: 'positive' | 'negative';
}

/** Relation orientée : attitude d'un personnage envers le joueur et ses souvenirs. */
export interface Relationship {
	/** Trimestre de la première rencontre. */
	readonly metTurn: Turn;
	/** Attitude envers le joueur, de -100 à 100 (cachée : seule une tendance est montrée). */
	readonly attitude: number;
	/** Souvenirs, du plus ancien au plus récent, en nombre borné. */
	readonly memories: readonly Memory[];
}

/** Variation concernant un personnage, produite par un effet ou une rencontre. */
export type PeopleChange =
	| { readonly kind: 'met'; readonly characterId: string }
	| { readonly kind: 'relation'; readonly characterId: string; readonly delta: number }
	| { readonly kind: 'revealed'; readonly characterId: string; readonly traitId: string };

/** Vieillissement des personnages à la frontière du trimestre. */
export interface CharactersRecord {
	readonly departures: readonly {
		readonly characterId: string;
		readonly reason: 'death' | 'retirement';
	}[];
	readonly arrivals: readonly { readonly characterId: string; readonly successorOf: string }[];
}

export interface PartyState {
	/** Force électorale relative, entière, dans les bornes de l'équilibrage. */
	readonly strength: number;
	/** Personnage à la tête du parti. */
	readonly leaderId: string;
}

/** Contexte national abstrait (ARCHITECTURE.md §4.2) : indicateurs et partis. */
export interface WorldState {
	readonly indicators: { readonly [K in IndicatorId]: number };
	/** États des partis du catalogue, par identifiant. */
	readonly parties: Readonly<Record<string, PartyState>>;
	readonly governingPartyId: string;
	/** Médias du catalogue, par identifiant (P3-03). */
	readonly media: Readonly<Record<string, MediaState>>;
	/** Mémoire anti-répétition du fil de presse (P3-15). */
	readonly press: PressMemory;
}

/**
 * Mémoire du fil de presse (P3-15) : pioche sans remise des titres et délai
 * thématique des articles consacrés au joueur.
 */
export interface PressMemory {
	/**
	 * Par pool (`headlinePoolKey` : sujet, tonalité, précision, famille de
	 * média), titres parus depuis son dernier recyclage, du plus ancien au plus
	 * récent : un titre n'y revient qu'une fois le pool épuisé.
	 */
	readonly usedHeadlines: Readonly<Record<string, readonly string[]>>;
	/**
	 * Angles (`sujet:précision`) des derniers articles consacrés au joueur, du
	 * plus ancien au plus récent ; une chaîne vide marque un sujet passé sous silence.
	 */
	readonly recentAngles: readonly string[];
}

/** Média envers le joueur (P3-03) : relation et dernière interview accordée. */
export interface MediaState {
	/** Relation envers le joueur, de -100 à 100 ; revient vers celle du catalogue. */
	readonly relation: number;
	/** Trimestre de la dernière interview, `null` si aucune. */
	readonly interviewTurn: Turn | null;
}

export type MandateEndReason = 'term' | 'resigned' | 'government_change' | 'replaced' | 'removed';

/** Exemplaire de mandat exercé par le joueur (définition `mandate.*`, instance `term.N`). */
export interface MandateInstance {
	/** `term.N`, N étant le rang d'attribution (jamais réutilisé). */
	readonly instanceId: string;
	readonly mandateId: string;
	/** Trimestre d'entrée en fonction : le mandat produit à partir de ce trimestre. */
	readonly startTurn: Turn;
	readonly access: 'election' | 'nomination';
	readonly status: 'active' | 'ended';
	/** Trimestre de fin, `null` tant que le mandat est en cours. */
	readonly endTurn: Turn | null;
	readonly endReason: MandateEndReason | null;
}

export interface BallotShare {
	readonly partyId: string;
	/** Part des suffrages, en % entier (le total vaut 100). */
	readonly percent: number;
}

/** Échéance électorale (instance `ballot.N`) ; le scrutin a lieu à la fin de son trimestre. */
export interface Ballot {
	readonly ballotId: string;
	readonly electionId: string;
	readonly turn: Turn;
	/** Dernier trimestre où une candidature peut être déposée (P2-03). */
	readonly filingClosesTurn: Turn;
	readonly early: boolean;
	readonly status: 'scheduled' | 'held' | 'cancelled';
	/** Parts triées par ordre décroissant, une fois le scrutin tenu. */
	readonly shares: readonly BallotShare[] | null;
	readonly winnerPartyId: string | null;
	/** Motif d'annulation (élection anticipée), sinon `null`. */
	readonly cancelReason: string | null;
}

export type CampaignStatus = 'running' | 'won' | 'lost' | 'disqualified';

/** Candidature du joueur à une échéance (instance `campaign.N`, P2-03). */
export interface Campaign {
	readonly campaignId: string;
	readonly ballotId: string;
	readonly electionId: string;
	readonly declaredTurn: Turn;
	/** Parti du joueur à la déclaration, `null` pour une candidature indépendante. */
	readonly partyId: string | null;
	/** Investi par son parti (soutien suffisant de l'appareil) ; sinon dissident ou indépendant. */
	readonly invested: boolean;
	/** Préparation accumulée (actions de campagne et temps écoulé). */
	readonly preparation: number;
	/**
	 * Adversaire principal nommé (P2-06), attribué à la frontière qui suit la
	 * déclaration et remplacé s'il quitte la vie publique avant le scrutin.
	 */
	readonly opponentId: string | null;
	readonly status: CampaignStatus;
	/** Score du joueur face à l'adversaire principal, en %, une fois le scrutin tenu. */
	readonly playerPercent: number | null;
	/** Motif d'une disqualification, sinon `null`. */
	readonly reason: string | null;
}

export type StaffLeaveReason = 'resigned' | 'dismissed' | 'poached' | 'retired' | 'died';

/** Collaborateur sur un poste clé (P2-05) ; un départ est conservé pour l'historique. */
export interface StaffMember {
	readonly characterId: string;
	readonly postId: string;
	/** Trimestre d'embauche : la production commence au trimestre suivant. */
	readonly hiredTurn: Turn;
	/** Mission persistante, modifiable hors tour. */
	readonly missionId: string;
	readonly status: 'active' | 'left';
	readonly leftTurn: Turn | null;
	readonly leaveReason: StaffLeaveReason | null;
	/** Salaire convenu par trimestre (P3-20), en centimes de budget politique. */
	readonly salaryCents: number;
	/** Prime d'arrivée restant due, payée avec le premier salaire (P3-20). */
	readonly bonusDueCents: number;
	/** Progression en cours vers le prochain point de compétence, en dixièmes (P3-21). */
	readonly progressTenths: number;
	/** Compétence à l'embauche ou à la dernière demande d'augmentation (P3-21). */
	readonly reviewedCompetence: number;
	/** Trimestre du dernier accord ou de la dernière demande d'augmentation (P3-21). */
	readonly reviewTurn: Turn;
}

/** Candidat présélectionné pour un poste vacant, avec le profil qui l'a fait proposer. */
export interface ShortlistEntry {
	readonly characterId: string;
	readonly profileId: string;
	/** Entretiens approfondis déjà menés (P3-20). */
	readonly interviews: number;
	/**
	 * Vérification du dossier (P3-21) : traits cachés signalés par les
	 * références, peut-être à tort ; `null` tant que rien n'a été vérifié.
	 */
	readonly hints: readonly string[] | null;
}

/** Recherche de candidats commandée, en attente de son échéance (P3-21). */
export interface RecruitmentSearch {
	readonly postId: string;
	readonly level: SearchLevel;
	/** Trait public exigé, ou `null`. */
	readonly trait: string | null;
	readonly orderedTurn: Turn;
	/** Frontière à laquelle le résultat arrive (une seule résolution). */
	readonly dueTurn: Turn;
}

/** Issue d'une recherche à son échéance (P3-21). */
export interface SearchOutcomeRecord {
	readonly postId: string;
	readonly level: SearchLevel;
	readonly trait: string | null;
	/** `cancelled` : poste pourvu ou fermé entre-temps. */
	readonly outcome: 'found' | 'failed' | 'cancelled';
	readonly candidates: readonly string[];
	/** Part du prix rendue au budget politique. */
	readonly refundCents: number;
}

/** Production d'un collaborateur au trimestre résolu. */
export interface StaffProductionRecord {
	readonly characterId: string;
	readonly missionId: string;
	/** `unpaid` : salaire impayé faute de budget, aucune production. */
	readonly status: 'active' | 'unpaid';
	readonly changes: readonly ResourceChange[];
	readonly politics: readonly PoliticalChange[];
	readonly stress: number;
}

/** Entourage à la fin du trimestre : salaires, production, départs et présélections. */
export interface StaffRecord {
	readonly payroll: readonly ResourceChange[];
	readonly production: readonly StaffProductionRecord[];
	readonly departures: readonly {
		readonly characterId: string;
		readonly postId: string;
		readonly reason: StaffLeaveReason;
	}[];
	/** Postes pour lesquels une nouvelle présélection a été proposée. */
	readonly shortlisted: readonly string[];
	/** Recherches arrivées à échéance (P3-21). */
	readonly searches: readonly SearchOutcomeRecord[];
	/** Compétence gagnée en poste ce trimestre (P3-21). */
	readonly progress: readonly {
		readonly characterId: string;
		readonly from: number;
		readonly to: number;
	}[];
	/** Demandes d'augmentation adressées ce trimestre (P3-21). */
	readonly raiseRequests: readonly string[];
}

/** Règles du cumul en vigueur, copiées du catalogue (modifiables par réforme, P3-05). */
export interface InstitutionsState extends InstitutionsDefinition {
	/** Mandats à détenir pour en obtenir un autre, par définition (copie de `requires`). */
	readonly prerequisites: Readonly<Record<string, readonly string[]>>;
	/** Niveau en vigueur de chaque paramètre institutionnel (P3-05). */
	readonly parameters: Readonly<Record<string, string>>;
	/** Réformes proposées ou décidées, dans l'ordre (`reform.N`, jamais supprimées). */
	readonly reforms: readonly ReformRecord[];
}

/**
 * Réforme institutionnelle (P3-05) : proposée par le joueur (votée à la
 * frontière du trimestre) ou décidée par le gouvernement ; adoptée, elle entre
 * en vigueur au 1er janvier suivant et persiste.
 */
export interface ReformRecord {
	readonly reformId: string;
	readonly parameterId: string;
	readonly levelId: string;
	/** Niveau en vigueur au moment de la proposition. */
	readonly fromLevelId: string;
	readonly origin: 'player' | 'government';
	readonly proposedTurn: Turn;
	readonly status: 'proposed' | 'rejected' | 'scheduled' | 'enacted';
	/** Chance d'adoption au vote (proposition du joueur), `null` sinon. */
	readonly adoptionPercent: number | null;
	/** Trimestre d'entrée en vigueur (1er janvier), une fois adoptée. */
	readonly activationTurn: Turn | null;
}

/** Réformes à la frontière : votes, réformes du gouvernement, entrées en vigueur (P3-05). */
export interface InstitutionsRecord {
	readonly changes: readonly ResourceChange[];
	readonly gauges: readonly GaugeChange[];
	readonly politics: readonly PoliticalChange[];
}

/** Variation politique produite par un effet (journal). */
export type PoliticalChange =
	| { readonly kind: 'indicator'; readonly indicator: IndicatorId; readonly delta: number }
	| { readonly kind: 'partyStrength'; readonly partyId: string; readonly delta: number }
	| { readonly kind: 'joined'; readonly partyId: string }
	| { readonly kind: 'left'; readonly partyId: string }
	| { readonly kind: 'support'; readonly groupId: string; readonly delta: number }
	| { readonly kind: 'mandateStarted'; readonly instanceId: string; readonly mandateId: string }
	| {
			readonly kind: 'mandateEnded';
			readonly instanceId: string;
			readonly mandateId: string;
			readonly reason: MandateEndReason;
	  }
	| {
			readonly kind: 'candidacy';
			readonly campaignId: string;
			readonly ballotId: string;
			readonly invested: boolean;
	  }
	| { readonly kind: 'preparation'; readonly delta: number }
	| { readonly kind: 'hired'; readonly characterId: string; readonly postId: string }
	/** Candidat qui décline l'offre (P3-20) : il quitte la présélection. */
	| { readonly kind: 'hireRefused'; readonly characterId: string; readonly postId: string }
	/** Entretien approfondi avec un candidat (P3-20). */
	| { readonly kind: 'interviewed'; readonly characterId: string; readonly postId: string }
	/** Recherche de candidats commandée (P3-21). */
	| {
			readonly kind: 'searchOrdered';
			readonly postId: string;
			readonly level: SearchLevel;
			readonly dueTurn: Turn;
	  }
	/** Dossier du candidat vérifié (P3-21). */
	| { readonly kind: 'vetted'; readonly characterId: string; readonly postId: string }
	/** Augmentation accordée (P3-21). */
	| {
			readonly kind: 'raiseGranted';
			readonly characterId: string;
			readonly salaryCents: number;
	  }
	| {
			readonly kind: 'familyJoined';
			readonly characterId: string;
			readonly relation: 'partner' | 'child';
	  }
	| { readonly kind: 'separated'; readonly characterId: string }
	| {
			readonly kind: 'staffLeft';
			readonly characterId: string;
			readonly postId: string;
			readonly reason: StaffLeaveReason;
	  }
	| {
			readonly kind: 'earlyElection';
			readonly ballotId: string;
			readonly electionId: string;
			readonly turn: Turn;
	  }
	/** Acte douteux inscrit au registre des faits (P3-01). */
	| { readonly kind: 'fact'; readonly factId: string; readonly offenseId: string }
	/** Étape d'une promesse du registre (P3-04). */
	| {
			readonly kind: 'promise';
			readonly pledgeId: string;
			readonly promiseId: string;
			readonly change: PromiseChange;
	  }
	| {
			readonly kind: 'promiseProgress';
			readonly pledgeId: string;
			readonly promiseId: string;
			readonly delta: number;
	  }
	/** Relation d'un média envers le joueur (P3-03). */
	| { readonly kind: 'mediaRelation'; readonly mediaId: string; readonly delta: number }
	/** Interview accordée, publiée à la frontière du trimestre (P3-03). */
	| { readonly kind: 'interview'; readonly mediaId: string }
	/** Étape d'une réforme institutionnelle (P3-05). */
	| {
			readonly kind: 'reform';
			readonly reformId: string;
			readonly parameterId: string;
			readonly levelId: string;
			readonly origin: 'player' | 'government';
			readonly change: 'proposed' | 'adopted' | 'rejected' | 'enacted';
	  };

/**
 * Étapes d'une promesse : annoncée (`made`), en cours après la victoire
 * (`started`), sans lendemain après une défaite (`lapsed`), amendée par un
 * compromis, issue (`kept`, `partial`, `abandoned`) ou rappelée en campagne.
 */
export type PromiseChange =
	| 'made'
	| 'started'
	/** Élu sans le mandat qui donne le levier de la promesse (P3-22). */
	| 'limited'
	| 'lapsed'
	| 'amended'
	| 'kept'
	| 'partial'
	| 'abandoned'
	| 'recalled';

/**
 * Promesse du registre (P3-04, GDD §7.5) : un engagement pris pendant une
 * campagne, réalisé une fois élu ou non, et conservé pour les rappels et le
 * bilan. Jamais supprimée.
 */
export interface PromiseRecord {
	/** `pledge.N`, N étant le rang d'annonce (jamais réutilisé). */
	readonly pledgeId: string;
	/** Promesse type (`promise.*`). */
	readonly promiseId: string;
	/** Campagne pendant laquelle l'engagement a été pris. */
	readonly campaignId: string;
	readonly announcedTurn: Turn;
	/**
	 * `announced` pendant la campagne (et après une défaite, close), `in_progress`
	 * une fois élu, puis l'issue : tenue, partiellement tenue ou abandonnée.
	 */
	readonly status: PromiseStatus;
	/** Avancement de la réalisation, de 0 à 100. */
	readonly progress: number;
	/** Compromis accepté : la promesse ne sera au mieux que partiellement tenue. */
	readonly amended: boolean;
	/**
	 * Levier institutionnel obtenu à l'élection (P3-22) : sans lui, la promesse
	 * ne sera au mieux que partiellement tenue. `false` tant qu'elle est annoncée.
	 */
	readonly leverHeld: boolean;
	/** Trimestre à la fin duquel l'issue est constatée (en cours seulement), sinon `null`. */
	readonly dueTurn: Turn | null;
	/** Trimestre de l'issue, ou de la défaite pour une promesse sans lendemain. */
	readonly closedTurn: Turn | null;
	/** Nombre de rappels pendant les campagnes suivantes. */
	readonly recalls: number;
	readonly lastRecalledTurn: Turn | null;
}

/** Promesses à la frontière : réalisations, issues, rappels et leurs effets (P3-04). */
export interface PromisesRecord {
	readonly changes: readonly ResourceChange[];
	readonly gauges: readonly GaugeChange[];
	/** Étapes des promesses, puis variations de soutiens. */
	readonly politics: readonly PoliticalChange[];
}

/**
 * Fait du registre (P3-01) : acte douteux daté, avec ses protagonistes et sa
 * gravité. Justice, presse et bilan s'appuient sur ce même registre ; un fait
 * n'est jamais supprimé. Il ne dit rien d'une enquête ni d'une culpabilité
 * établie : ce sont des états distincts (ARCHITECTURE.md §8.4).
 */
export interface Fact {
	/** `fact.N`, N étant le rang d'inscription (jamais réutilisé). */
	readonly factId: string;
	readonly offenseId: string;
	readonly turn: Turn;
	/** Gravité de 1 à 3. */
	readonly severity: number;
	/** Fonds détournés, en centimes (statistique de bilan, pas une monnaie). */
	readonly divertedCents: number;
	/** Auteur : `null` pour le joueur, sinon un personnage (le joueur est alors complice). */
	readonly authorId: string | null;
	/** Autres protagonistes (donateur, bénéficiaire…), sans le joueur. */
	readonly accompliceIds: readonly string[];
	/** Événement dont le choix a produit le fait. */
	readonly eventId: string;
}

/**
 * Étape d'un dossier judiciaire (P3-01) : enquête après la révélation, mise en
 * examen dans l'attente du procès, appel après une première condamnation du
 * joueur, puis clôture. Une enquête n'établit aucune culpabilité.
 */
export type CaseStage = 'investigation' | 'indicted' | 'appeal' | 'closed';

export type CaseOutcome = 'dismissed' | 'acquitted' | 'convicted';

export interface Sentence {
	/** Amende prononcée, en centimes (prélevée dans la limite de l'argent personnel). */
	readonly fineCents: number;
	/** Inéligibilité, en trimestres (0 : aucune). */
	readonly ineligibilityTurns: number;
	readonly prison: 'none' | 'suspended' | 'firm';
}

/** Dossier judiciaire ouvert par la révélation d'un fait (instance `case.N`). */
export interface LegalCase {
	readonly caseId: string;
	readonly factId: string;
	/** Personne poursuivie : `null` pour le joueur, sinon l'auteur du fait. */
	readonly defendantId: string | null;
	/** Trimestre de la révélation. */
	readonly openedTurn: Turn;
	readonly stage: CaseStage;
	/** Trimestre à la fin duquel l'étape en cours se conclut, `null` une fois clos. */
	readonly dueTurn: Turn | null;
	readonly outcome: CaseOutcome | null;
	readonly closedTurn: Turn | null;
	/** Peine définitive, en cas de condamnation. */
	readonly sentence: Sentence | null;
}

/** Réévaluation des actifs patrimoniaux à la frontière (P3-02). */
export interface WealthRecord {
	/** Variation totale de la valeur des actifs, en centimes. */
	readonly valueChange: number;
	/** Exemplaires dont la valeur est tombée à zéro (faillite, sinistre). */
	readonly failed: readonly string[];
}

export type CaseEventKind =
	'revealed' | 'dismissed' | 'indicted' | 'appealed' | 'acquitted' | 'convicted';

/** Justice à la frontière du trimestre : étapes franchies et conséquences. */
export interface JusticeRecord {
	readonly cases: readonly { readonly caseId: string; readonly kind: CaseEventKind }[];
	readonly changes: readonly ResourceChange[];
	readonly gauges: readonly GaugeChange[];
	readonly politics: readonly PoliticalChange[];
}

/**
 * Article du fil de presse (P3-03) : un média, un sujet, une tonalité et un
 * titre du catalogue, avec ses effets sur les groupes de lecteurs.
 */
export interface Article {
	readonly mediaId: string;
	readonly topic: ArticleTopic;
	readonly tone: ArticleTone;
	readonly headlineId: string;
	/** Sujet : dossier (`case.N`), promesse (`pledge.N`), candidature (`campaign.N`), média, ou `null`. */
	readonly subjectId: string | null;
	/** Précision du sujet (`revealed`, `kept`, `won`…), `null` sinon. */
	readonly detail: string | null;
	/** Variations de soutien des groupes qui lisent le média. */
	readonly supports: readonly { readonly groupId: string; readonly delta: number }[];
	/** Exposition ajoutée par l'article. */
	readonly exposure: number;
}

/** Fil de presse à la frontière du trimestre (P3-03). */
export interface PressRecord {
	readonly articles: readonly Article[];
	/** Retour des relations vers leur référence. */
	readonly relations: readonly { readonly mediaId: string; readonly delta: number }[];
}

/** Échéances résolues à la fin du trimestre (étape 5 de l'ordre de tour). */
export interface DeadlinesRecord {
	/** Mandats arrivés à leur terme, puis scrutins tenus, dans l'ordre. */
	readonly mandates: readonly PoliticalChange[];
	readonly ballots: readonly {
		readonly ballotId: string;
		readonly electionId: string;
		readonly winnerPartyId: string;
		readonly governingBefore: string;
		readonly governingAfter: string;
	}[];
	/** Rencontres et rivalités avec les adversaires nommés. */
	readonly people: readonly PeopleChange[];
	/** Campagnes du joueur jugées à ces scrutins. */
	readonly campaigns: readonly {
		readonly campaignId: string;
		readonly opponentId: string | null;
		readonly status: Exclude<CampaignStatus, 'running'>;
		readonly playerPercent: number | null;
		readonly reason: string | null;
	}[];
}

export interface LeaderChange {
	readonly partyId: string;
	readonly previousLeaderId: string;
	readonly leaderId: string;
	readonly reason: 'retirement' | 'internal_vote' | 'death';
}

/** Évolution autonome du monde à la frontière du trimestre. */
export interface WorldRecord {
	readonly indicators: readonly { readonly indicator: IndicatorId; readonly delta: number }[];
	readonly parties: readonly { readonly partyId: string; readonly delta: number }[];
	readonly leaderChanges: readonly LeaderChange[];
}

export interface ResourceChange {
	readonly resource: ResourceId;
	/** Variation nette (coûts et effets), non nulle. */
	readonly delta: number;
}

export interface GaugeChange {
	readonly gauge: GaugeId;
	/** Variation réelle, après maintien dans les bornes, non nulle. */
	readonly delta: number;
}

/** Exemplaire possédé d'une amélioration (instance d'une définition du catalogue). */
export interface OwnedUpgrade {
	/** Identifiant d'instance stable, tiré du compteur `nextInstanceNumber`. */
	readonly instanceId: string;
	/** Identifiant de la définition, par exemple `organization.volunteer`. */
	readonly upgradeId: string;
	/** Trimestre d'achat ; l'exemplaire produit à partir du trimestre suivant. */
	readonly acquiredTurn: Turn;
	/** Valeur de marché d'un actif patrimonial, en centimes (P3-02) ; `null` pour les autres. */
	readonly valueCents: number | null;
}

/** Étape du plan exécutée pendant un trimestre, avec ses variations réelles. */
export interface StepRecord {
	readonly kind: 'action' | 'purchase';
	/** Identifiant de l'action ou de l'amélioration. */
	readonly id: string;
	/** Instance créée par un achat, `null` pour une action. */
	readonly instanceId: string | null;
	readonly changes: readonly ResourceChange[];
	/** Variations de santé et de stress dues à l'étape. */
	readonly gauges: readonly GaugeChange[];
	/** Cible choisie dans le plan (parti), sinon `null`. */
	readonly target: string | null;
	readonly politics: readonly PoliticalChange[];
}

/**
 * Production d'une définition d'amélioration au trimestre résolu : les
 * exemplaires sont regroupés pour garder le journal compact (ARCHITECTURE.md §15.3).
 */
export interface ProducerRecord {
	readonly upgradeId: string;
	/** Nombre d'exemplaires qui ont payé leurs charges et produit. */
	readonly active: number;
	/**
	 * Nombre d'exemplaires suspendus faute de trésorerie (ni charge prélevée ni
	 * production). Les charges étant payées dans l'ordre d'acquisition, ce sont
	 * les plus récents qui le sont.
	 */
	readonly suspended: number;
	/** Variation nette cumulée des exemplaires actifs. */
	readonly changes: readonly ResourceChange[];
}

export interface EconomyRecord {
	/** Train de vie du trimestre : dépense prélevée, ou impayée (retour au plus sobre). */
	readonly lifestyle: {
		readonly lifestyleId: string;
		readonly costCents: number;
		readonly unpaid: boolean;
	};
	readonly producers: readonly ProducerRecord[];
	/** Variation nette de l'économie (charges et production). */
	readonly changes: readonly ResourceChange[];
}

export type DeathCause = 'health_failure' | 'natural_causes';

/** Origine identifiable d'une variation de santé ou de stress (ARCHITECTURE.md §8.2). */
export type WellbeingSource =
	'workload' | 'comfort' | 'recovery' | 'high_stress' | 'calm' | 'ageing';

export interface WellbeingContribution {
	readonly source: WellbeingSource;
	readonly gauge: GaugeId;
	readonly delta: number;
}

/** Santé et stress à la frontière du trimestre. */
export interface WellbeingRecord {
	readonly contributions: readonly WellbeingContribution[];
	readonly deathCause: DeathCause | null;
}

/** Occurrence d'un événement, avec ses acteurs figés à la création. */
export interface EventInstance {
	/** Identifiant d'instance, tiré du compteur `nextInstanceNumber` (`event.N`). */
	readonly instanceId: string;
	readonly eventId: string;
	/** Trimestre de création. */
	readonly turn: Turn;
	/** Acteurs par rôle : identifiants de la distribution. */
	readonly actors: Readonly<Record<string, string>>;
}

/** Suite différée en attente de son trimestre. */
export interface ScheduledEvent {
	readonly eventId: string;
	readonly dueTurn: Turn;
	/** Instance dont un choix a programmé la suite. */
	readonly sourceInstanceId: string;
	/** Acteurs transmis, réutilisés pour les rôles de même nom. */
	readonly actors: Readonly<Record<string, string>>;
}

export interface EventOccurrence {
	readonly count: number;
	readonly lastTurn: Turn;
}

export interface EventsState {
	/** Événements bloquants en attente de choix, dans l'ordre de présentation. */
	readonly pending: readonly EventInstance[];
	/** Suites différées, dans l'ordre de programmation. */
	readonly scheduled: readonly ScheduledEvent[];
	/** Occurrences créées par définition : unicité et délai de réapparition. */
	readonly occurrences: Readonly<Record<string, EventOccurrence>>;
}

/** Devenir d'un événement à la frontière du trimestre. */
export interface EventRecord {
	readonly eventId: string;
	/** `null` pour une suite annulée avant création. */
	readonly instanceId: string | null;
	/** `queued` : bloquant en attente ; `applied` : informatif appliqué ; `cancelled` : suite devenue impossible. */
	readonly outcome: 'queued' | 'applied' | 'cancelled';
	readonly actors: Readonly<Record<string, string>>;
	readonly changes: readonly ResourceChange[];
	readonly gauges: readonly GaugeChange[];
	readonly politics: readonly PoliticalChange[];
	readonly people: readonly PeopleChange[];
	/** Motif d'annulation, en français. */
	readonly reason: string | null;
}

export interface HistoryEntry {
	readonly type: 'turn.resolved';
	/** Trimestre résolu (T), le journal étant produit au passage vers T+1. */
	readonly turn: Turn;
	/** Étapes du plan (actions et achats), dans l'ordre d'exécution. */
	readonly steps: readonly StepRecord[];
	/** Charges et production des améliorations actives au trimestre T. */
	readonly economy: EconomyRecord;
	/** Revenus et stress des mandats exercés au trimestre T. */
	readonly mandates: { readonly changes: readonly ResourceChange[]; readonly stress: number };
	/** Entourage : salaires et missions du trimestre T, départs et présélections à la frontière. */
	readonly staff: StaffRecord | null;
	/** Famille à la frontière : héritage, dépenses, disponibilité, `null` après un décès. */
	readonly family: FamilyRecord | null;
	/** Charge de travail, récupération, vieillissement et éventuel décès. */
	readonly wellbeing: WellbeingRecord;
	/** Vieillissement, départs et successions, `null` si la carrière s'est terminée avant. */
	readonly characters: CharactersRecord | null;
	/** Évolution autonome du monde, `null` si la carrière s'est terminée avant. */
	readonly world: WorldRecord | null;
	/** Retour des soutiens vers leur référence, `null` si la carrière s'est terminée avant. */
	readonly supports: readonly { readonly groupId: string; readonly delta: number }[] | null;
	/** Échéances (fins de mandat, scrutins), `null` si la carrière s'est terminée avant. */
	readonly deadlines: DeadlinesRecord | null;
	/** Retour de l'exposition vers sa référence, `null` si la carrière s'est terminée avant. */
	readonly exposure: number | null;
	/** Dossiers judiciaires, `null` si la carrière s'est terminée avant. */
	readonly justice: JusticeRecord | null;
	/** Réévaluation des actifs, `null` si la carrière s'est terminée avant. */
	readonly wealth: WealthRecord | null;
	/** Promesses (réalisation, issues, rappels), `null` si la carrière s'est terminée avant. */
	readonly promises: PromisesRecord | null;
	/** Fil de presse du trimestre, `null` si la carrière s'est terminée avant. */
	readonly press: PressRecord | null;
	/** Réformes institutionnelles, `null` si la carrière s'est terminée avant. */
	readonly institutions: InstitutionsRecord | null;
	/** Base militante (arrivées, départs, cotisations), `null` si la carrière s'est terminée avant. */
	readonly activists: ActivistsRecord | null;
	/** Événements créés (ou suites annulées) au passage à T+1. */
	readonly events: readonly EventRecord[];
	/** Situation à l'issue du trimestre, pour les tendances du tableau de bord (P3-08). */
	readonly snapshot: QuarterSnapshot;
}

/** Ressources et jauges principales à la fin d'un trimestre (P3-08). */
export interface QuarterSnapshot extends Resources {
	readonly popularity: number;
	readonly health: number;
	readonly stress: number;
	readonly exposure: number;
	/** Base militante (P3-19). */
	readonly activists: number;
}

/** Évolution de la base militante à la frontière (P3-19). */
export interface ActivistsRecord {
	/** Sympathisants qui s'engagent (notoriété × soutien militant, dans la capacité d'accueil). */
	readonly arrivals: number;
	/** Recrues après un scrutin disputé. */
	readonly recruits: number;
	/** Départs (usure, mécontentement, manque de place). */
	readonly departures: number;
	/** Effectif après la frontière. */
	readonly total: number;
	readonly capacity: number;
	/** Palier avant et après (identifiants du catalogue). */
	readonly tierBefore: string;
	readonly tierAfter: string;
	/** Cotisations reçues et frais logistiques payés (budget politique), en centimes. */
	readonly duesCents: number;
	readonly upkeepCents: number;
}

/** Choix appliqué pour un événement bloquant, exactement une fois. */
export interface ChoiceRecord {
	readonly type: 'event.resolved';
	/** Trimestre pendant lequel le choix a été fait. */
	readonly turn: Turn;
	readonly instanceId: string;
	readonly eventId: string;
	readonly choiceId: string;
	readonly changes: readonly ResourceChange[];
	readonly gauges: readonly GaugeChange[];
	readonly politics: readonly PoliticalChange[];
	readonly people: readonly PeopleChange[];
	readonly scheduled: ScheduledEvent | null;
	/** Événements en attente annulés parce que devenus impossibles. */
	readonly cancelled: readonly { readonly instanceId: string; readonly reason: string }[];
	readonly deathCause: DeathCause | null;
}

export type JournalEntry = HistoryEntry | ChoiceRecord;

export type EndState =
	| {
			/** Trimestre au cours duquel la carrière s'est terminée. */
			readonly turn: Turn;
			readonly reason: 'death';
			readonly cause: DeathCause;
	  }
	/** Condamnation définitive à de la prison ferme (P3-01). */
	| { readonly turn: Turn; readonly reason: 'prison'; readonly caseId: string };

export interface GameState {
	readonly schemaVersion: typeof STATE_SCHEMA_VERSION;
	readonly turn: Turn;
	readonly rng: RngState;
	readonly phase: GamePhase;
	readonly player: PlayerState;
	/** Influence, budget politique et liquidités personnelles, jamais fusionnés. */
	readonly resources: Resources;
	/** Améliorations possédées, dans l'ordre d'acquisition. */
	readonly upgrades: readonly OwnedUpgrade[];
	/** Prochain numéro d'instance (identifiants déterministes, jamais réutilisés). */
	readonly nextInstanceNumber: number;
	readonly events: EventsState;
	readonly world: WorldState;
	/** Personnages nommés, par identifiant (jamais supprimés). */
	readonly characters: Readonly<Record<string, Character>>;
	/** Relations des personnages rencontrés envers le joueur. */
	readonly relationships: Readonly<Record<string, Relationship>>;
	/** Mandats du joueur, en cours et passés, dans l'ordre d'attribution. */
	readonly mandates: readonly MandateInstance[];
	/** Calendrier électoral : échéances tenues, annulées et à venir, dans l'ordre de création. */
	readonly ballots: readonly Ballot[];
	/** Candidatures du joueur, en cours et passées, dans l'ordre de déclaration. */
	readonly campaigns: readonly Campaign[];
	readonly institutions: InstitutionsState;
	/** Entourage : collaborateurs en poste et partis, dans l'ordre d'embauche. */
	readonly staff: readonly StaffMember[];
	/** Présélections ouvertes, par poste vacant. */
	readonly shortlists: Readonly<Record<string, readonly ShortlistEntry[]>>;
	/** Recherches de candidats en cours, une par poste au plus (P3-21). */
	readonly searches: readonly RecruitmentSearch[];
	/** Registre des faits, dans l'ordre d'inscription (P3-01). */
	readonly facts: readonly Fact[];
	/** Dossiers judiciaires, dans l'ordre d'ouverture (P3-01). */
	readonly cases: readonly LegalCase[];
	/** Registre des promesses, dans l'ordre d'annonce (P3-04). */
	readonly promises: readonly PromiseRecord[];
	/** Journal : trimestres résolus et choix, dans l'ordre chronologique. */
	readonly history: readonly JournalEntry[];
	readonly end: EndState | null;
}

export interface NewGameConfig {
	/**
	 * Seed explicite. Le navigateur la tire de `crypto.getRandomValues` à sa
	 * frontière ; les tests et le simulateur la fournissent.
	 */
	readonly seed: string;
	/** Origine et engagement choisies (P2-08) ; à défaut, le profil par défaut du catalogue. */
	readonly origin?: string;
	readonly engagement?: string;
	/** Région d'origine (P3-16) ; à défaut, celle du profil par défaut. */
	readonly region?: string;
}

export function createGame(config: NewGameConfig, content: Content): GameState {
	const originId = config.origin ?? content.defaultProfile.origin;
	const engagementId = config.engagement ?? content.defaultProfile.engagement;
	const regionId = config.region ?? content.defaultProfile.region;
	const origin = content.origins[originId];
	const engagement = content.engagements[engagementId];
	if (!origin) throw new Error(`Origine inconnue : ${originId}`);
	if (!engagement) throw new Error(`Terrain d’engagement inconnu : ${engagementId}`);
	// Territoire tiré sur un PRNG dérivé : aucun autre tirage n'en est décalé.
	const territory = createTerritory(config.seed, regionId, content);

	// Paysage initial fixe ; seuls les dirigeants sont tirés (GDD §8.1).
	const world = createWorld(createRng(config.seed), START_TURN, content);
	const cast = createCast(world.characters, world.rng, START_TURN, content);

	// Profil : effets de l'origine puis de le terrain d’engagement, dans cet ordre.
	let player: PlayerState = {
		birthTurn: START_TURN - PROTOTYPE_STARTING_AGE * TURNS_PER_YEAR,
		health: content.balance.wellbeing.startingHealth,
		stress: content.balance.wellbeing.startingStress,
		exposure: content.justice.baseExposure,
		activists: content.balance.activists.start,
		defense: 0,
		ineligibleUntil: null,
		lifestyle: content.wealth.defaultLifestyle,
		partyId: null,
		affiliations: [],
		supports: startingSupports(content),
		popularity: computePopularity(startingSupports(content), content),
		origin: originId,
		engagement: engagementId,
		territory,
		family: EMPTY_FAMILY
	};
	const resources: Record<ResourceId, number> = { ...content.balance.startingResources };
	for (const effect of [
		...origin.effects,
		...engagement.effects,
		...territoryEffects(territory, originId, content)
	]) {
		if (effect.op === 'addResource') {
			resources[effect.resource] = Math.max(0, resources[effect.resource] + effect.value);
		} else if (effect.op === 'addStat') {
			const key = gaugeKey(effect.stat);
			// Santé et stress d'au moins 1 au départ (règle de l'alpha) ; autres jauges dès 0.
			const floor = key === 'health' || key === 'stress' ? 1 : 0;
			player = {
				...player,
				[key]: Math.min(GAUGE_MAX, Math.max(floor, player[key] + effect.value))
			};
		} else if (effect.op === 'addSupport') {
			player = applyPoliticalEffect(effect, player, world.world, START_TURN, null, content).player;
		}
	}

	// Famille d'origine : parents et fratrie générés.
	const family = createFamily(
		originId,
		{ player, characters: cast.characters, relationships: {} },
		START_TURN,
		cast.rng,
		content
	);
	return {
		schemaVersion: STATE_SCHEMA_VERSION,
		turn: START_TURN,
		rng: family.rng,
		phase: 'planning',
		player: family.parts.player,
		resources,
		upgrades: [],
		nextInstanceNumber: 1,
		events: { pending: [], scheduled: [], occurrences: {} },
		world: world.world,
		characters: family.parts.characters,
		relationships: family.parts.relationships,
		mandates: [],
		ballots: createCalendar(START_TURN, content),
		campaigns: [],
		staff: [],
		shortlists: {},
		searches: [],
		institutions: {
			incompatibilities: content.institutions.incompatibilities.map(
				([left, right]) => [left, right] as const
			),
			maxMandates: content.institutions.maxMandates,
			prerequisites: Object.fromEntries(
				content.mandateIds.flatMap((id) => {
					const requires = content.mandates[id]?.requires ?? [];
					return requires.length > 0 ? [[id, [...requires]]] : [];
				})
			),
			parameters: startingParameters(content),
			reforms: []
		},
		facts: [],
		cases: [],
		promises: [],
		history: [],
		end: null
	};
}
