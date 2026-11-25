/**
 * État central de la partie (ARCHITECTURE.md §4.1) — sous-ensemble du prototype.
 *
 * L'état est un objet JSON pur (nombres, chaînes, booléens, tableaux, objets,
 * `null`) : il se sérialise et se recharge sans perte.
 */
import { GAUGE_MAX } from '../content/types.ts';
import type {
	Content,
	GaugeId,
	IndicatorId,
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
	/** Parti du joueur, `null` s'il n'est pas encarté. */
	readonly partyId: string | null;
	/** Historique des adhésions, dans l'ordre ; seule la dernière peut être en cours. */
	readonly affiliations: readonly Affiliation[];
	/** Soutien de chaque groupe envers le joueur, de 0 à 100 (public : sondages). */
	readonly supports: Readonly<Record<string, number>>;
	/** Popularité : synthèse pondérée des soutiens électoraux, toujours recalculée. */
	readonly popularity: number;
	/** Origine sociale et profession choisies à la création (P2-08). */
	readonly origin: string;
	readonly profession: string;
	readonly family: FamilyState;
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
}

/** Candidat présélectionné pour un poste vacant, avec le profil qui l'a fait proposer. */
export interface ShortlistEntry {
	readonly characterId: string;
	readonly profileId: string;
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
}

/** Règles du cumul en vigueur, copiées du catalogue (modifiables par réforme, P3-05). */
export interface InstitutionsState extends InstitutionsDefinition {
	/** Mandats à détenir pour en obtenir un autre, par définition (copie de `requires`). */
	readonly prerequisites: Readonly<Record<string, readonly string[]>>;
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
	| { readonly kind: 'fact'; readonly factId: string; readonly offenseId: string };

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

/** Résultat d'un producteur actif au trimestre résolu. */
export interface ProducerRecord {
	readonly instanceId: string;
	readonly upgradeId: string;
	/** `suspended` : charges impayées, aucune production ce trimestre. */
	readonly status: 'active' | 'suspended';
	readonly changes: readonly ResourceChange[];
}

export interface EconomyRecord {
	readonly producers: readonly ProducerRecord[];
	/** Variation nette de l'économie (charges et production). */
	readonly changes: readonly ResourceChange[];
}

export type DeathCause = 'health_failure' | 'natural_causes';

/** Origine identifiable d'une variation de santé ou de stress (ARCHITECTURE.md §8.2). */
export type WellbeingSource = 'workload' | 'recovery' | 'high_stress' | 'calm' | 'ageing';

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
	/** Événements créés (ou suites annulées) au passage à T+1. */
	readonly events: readonly EventRecord[];
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

export interface EndState {
	/** Trimestre au cours duquel la carrière s'est terminée. */
	readonly turn: Turn;
	readonly reason: 'death';
	readonly cause: DeathCause;
}

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
	/** Registre des faits, dans l'ordre d'inscription (P3-01). */
	readonly facts: readonly Fact[];
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
	/** Origine et profession choisies (P2-08) ; à défaut, le profil par défaut du catalogue. */
	readonly origin?: string;
	readonly profession?: string;
}

export function createGame(config: NewGameConfig, content: Content): GameState {
	const originId = config.origin ?? content.defaultProfile.origin;
	const professionId = config.profession ?? content.defaultProfile.profession;
	const origin = content.origins[originId];
	const profession = content.professions[professionId];
	if (!origin) throw new Error(`Origine inconnue : ${originId}`);
	if (!profession) throw new Error(`Profession inconnue : ${professionId}`);

	// Paysage initial fixe ; seuls les dirigeants sont tirés (GDD §8.1).
	const world = createWorld(createRng(config.seed), START_TURN, content);
	const cast = createCast(world.characters, world.rng, START_TURN, content);

	// Profil : effets de l'origine puis de la profession, dans cet ordre.
	let player: PlayerState = {
		birthTurn: START_TURN - PROTOTYPE_STARTING_AGE * TURNS_PER_YEAR,
		health: content.balance.wellbeing.startingHealth,
		stress: content.balance.wellbeing.startingStress,
		exposure: content.justice.baseExposure,
		partyId: null,
		affiliations: [],
		supports: startingSupports(content),
		popularity: computePopularity(startingSupports(content), content),
		origin: originId,
		profession: professionId,
		family: EMPTY_FAMILY
	};
	const resources: Record<ResourceId, number> = { ...content.balance.startingResources };
	for (const effect of [...origin.effects, ...profession.effects]) {
		if (effect.op === 'addResource') {
			resources[effect.resource] = Math.max(0, resources[effect.resource] + effect.value);
		} else if (effect.op === 'addStat') {
			const key = gaugeKey(effect.stat);
			// Santé et stress d'au moins 1 au départ (règle de l'alpha) ; exposition dès 0.
			const floor = key === 'exposure' ? 0 : 1;
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
			)
		},
		facts: [],
		history: [],
		end: null
	};
}
