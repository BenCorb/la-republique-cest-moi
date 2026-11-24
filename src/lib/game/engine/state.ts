/**
 * État central de la partie (ARCHITECTURE.md §4.1) — sous-ensemble du prototype.
 *
 * L'état est un objet JSON pur (nombres, chaînes, booléens, tableaux, objets,
 * `null`) : il se sérialise et se recharge sans perte. Les événements rejoignent
 * cet état avec leur tâche (P1-05).
 */
import type { Content, GaugeId, ResourceId, Resources } from '../content/types.ts';
import { TURNS_PER_YEAR, type Turn } from './calendar.ts';
import { createRng, type RngState } from './random.ts';

/** Version du format de l'état, à incrémenter avec une migration explicite. */
export const STATE_SCHEMA_VERSION = 1;

/** Premier tour d'une partie : T1 2000. */
export const START_TURN: Turn = 0;

/** Profil fixe du prototype : personnage de 25 ans au début de la partie (GDD §3.1). */
export const PROTOTYPE_STARTING_AGE = 25;

export type GamePhase = 'planning' | 'decision' | 'ended';

export interface PlayerState {
	/** Trimestre de naissance ; l'âge en est toujours dérivé. */
	readonly birthTurn: Turn;
	/** Santé, entier de 0 à 100 ; 0 signifie le décès. */
	readonly health: number;
	/** Stress, entier de 0 à 100. */
	readonly stress: number;
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
}

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
	readonly history: readonly HistoryEntry[];
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
	return {
		schemaVersion: STATE_SCHEMA_VERSION,
		turn: START_TURN,
		rng: createRng(config.seed),
		phase: 'planning',
		player: {
			birthTurn: START_TURN - PROTOTYPE_STARTING_AGE * TURNS_PER_YEAR,
			health: content.balance.wellbeing.startingHealth,
			stress: content.balance.wellbeing.startingStress
		},
		resources: { ...content.balance.startingResources },
		upgrades: [],
		nextInstanceNumber: 1,
		history: [],
		end: null
	};
}
