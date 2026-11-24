/**
 * État central de la partie (ARCHITECTURE.md §4.1) — sous-ensemble du prototype.
 *
 * L'état est un objet JSON pur (nombres, chaînes, booléens, tableaux, objets,
 * `null`) : il se sérialise et se recharge sans perte. La santé, les producteurs,
 * les événements, etc. rejoignent cet état avec leurs tâches (P1-03 à P1-05).
 */
import type { Content, ResourceId, Resources } from '../content/types.ts';
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
}

export interface ResourceChange {
	readonly resource: ResourceId;
	/** Variation nette (coûts et effets), non nulle. */
	readonly delta: number;
}

/** Action exécutée pendant un trimestre, avec ses variations réelles. */
export interface ActionRecord {
	readonly actionId: string;
	readonly changes: readonly ResourceChange[];
}

export interface HistoryEntry {
	readonly type: 'turn.resolved';
	/** Trimestre résolu (T), le journal étant produit au passage vers T+1. */
	readonly turn: Turn;
	/** Actions du plan, dans l'ordre d'exécution. */
	readonly actions: readonly ActionRecord[];
}

export interface EndState {
	readonly turn: Turn;
	readonly reason: string;
}

export interface GameState {
	readonly schemaVersion: typeof STATE_SCHEMA_VERSION;
	readonly turn: Turn;
	readonly rng: RngState;
	readonly phase: GamePhase;
	readonly player: PlayerState;
	/** Influence, budget politique et liquidités personnelles, jamais fusionnés. */
	readonly resources: Resources;
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
		player: { birthTurn: START_TURN - PROTOTYPE_STARTING_AGE * TURNS_PER_YEAR },
		resources: { ...content.balance.startingResources },
		history: [],
		end: null
	};
}
