/**
 * État central de la partie (ARCHITECTURE.md §4.1) — sous-ensemble du prototype.
 *
 * L'état est un objet JSON pur (nombres, chaînes, booléens, tableaux, objets,
 * `null`) : il se sérialise et se recharge sans perte.
 */
import type { Content, GaugeId, IndicatorId, ResourceId, Resources } from '../content/types.ts';
import { TURNS_PER_YEAR, type Turn } from './calendar.ts';
import { createRng, type RngState } from './random.ts';
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
	/** Parti du joueur, `null` s'il n'est pas encarté. */
	readonly partyId: string | null;
	/** Historique des adhésions, dans l'ordre ; seule la dernière peut être en cours. */
	readonly affiliations: readonly Affiliation[];
}

/**
 * Personnage nommé généré par le moteur (dirigeants de parti en P2-01). Modèle
 * volontairement minimal, enrichi par P2-04 (traits, relations, mémoire).
 * Un personnage remplacé reste dans l'état : les textes déjà figés le citent.
 */
export interface Character {
	/** Identifiant `character.N`, N étant le rang de création (personnages jamais supprimés). */
	readonly id: string;
	readonly name: string;
	readonly birthTurn: Turn;
	readonly partyId: string | null;
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

/** Variation politique produite par un effet (journal). */
export type PoliticalChange =
	| { readonly kind: 'indicator'; readonly indicator: IndicatorId; readonly delta: number }
	| { readonly kind: 'partyStrength'; readonly partyId: string; readonly delta: number }
	| { readonly kind: 'joined'; readonly partyId: string }
	| { readonly kind: 'left'; readonly partyId: string };

export interface LeaderChange {
	readonly partyId: string;
	readonly previousLeaderId: string;
	readonly leaderId: string;
	readonly reason: 'retirement' | 'internal_vote';
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
	/** Charge de travail, récupération, vieillissement et éventuel décès. */
	readonly wellbeing: WellbeingRecord;
	/** Évolution autonome du monde, `null` si la carrière s'est terminée avant. */
	readonly world: WorldRecord | null;
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
	/** Personnages nommés générés, par identifiant (jamais supprimés). */
	readonly characters: Readonly<Record<string, Character>>;
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
}

export function createGame(config: NewGameConfig, content: Content): GameState {
	// Paysage initial fixe ; seuls les dirigeants sont tirés (GDD §8.1).
	const world = createWorld(createRng(config.seed), START_TURN, content);
	return {
		schemaVersion: STATE_SCHEMA_VERSION,
		turn: START_TURN,
		rng: world.rng,
		phase: 'planning',
		player: {
			birthTurn: START_TURN - PROTOTYPE_STARTING_AGE * TURNS_PER_YEAR,
			health: content.balance.wellbeing.startingHealth,
			stress: content.balance.wellbeing.startingStress,
			partyId: null,
			affiliations: []
		},
		resources: { ...content.balance.startingResources },
		upgrades: [],
		nextInstanceNumber: 1,
		events: { pending: [], scheduled: [], occurrences: {} },
		world: world.world,
		characters: world.characters,
		history: [],
		end: null
	};
}
