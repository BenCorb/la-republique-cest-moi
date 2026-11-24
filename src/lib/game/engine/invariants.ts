/**
 * Contrôle unique des invariants de l'état (ARCHITECTURE.md §4.3).
 *
 * Utilisé après chaque transition dans les tests et, plus tard, aux frontières de
 * chargement (sauvegarde, import). Ne corrige rien : signale toutes les violations.
 */
import { RESOURCE_IDS } from '../content/types.ts';
import { RNG_ALGORITHM, validateSeed } from './random.ts';
import { START_TURN, STATE_SCHEMA_VERSION, type GameState } from './state.ts';

const PHASES = new Set(['planning', 'decision', 'ended']);

function isUint32(value: unknown): boolean {
	return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 0xffffffff;
}

export function checkInvariants(state: GameState): string[] {
	const violations: string[] = [];

	if (state.schemaVersion !== STATE_SCHEMA_VERSION) {
		violations.push(`schemaVersion inattendue : ${String(state.schemaVersion)}`);
	}
	if (!Number.isSafeInteger(state.turn) || state.turn < START_TURN) {
		violations.push(`tour invalide : ${state.turn}`);
	}
	if (!PHASES.has(state.phase)) violations.push(`phase inconnue : ${String(state.phase)}`);

	if (state.rng.algorithm !== RNG_ALGORITHM) {
		violations.push(`algorithme aléatoire inconnu : ${String(state.rng.algorithm)}`);
	}
	if (!isUint32(state.rng.state)) violations.push(`état aléatoire invalide : ${state.rng.state}`);
	const seedError = typeof state.rng.seed === 'string' ? validateSeed(state.rng.seed) : 'absente';
	if (seedError) violations.push(`seed invalide : ${seedError}`);

	if (!Number.isSafeInteger(state.player.birthTurn) || state.player.birthTurn > state.turn) {
		violations.push(`naissance invalide : ${state.player.birthTurn}`);
	}

	for (const resource of RESOURCE_IDS) {
		const value = state.resources[resource];
		if (!Number.isSafeInteger(value) || value < 0) {
			violations.push(`ressource invalide : ${resource} = ${value}`);
		}
	}

	// Le journal contient exactement un tour résolu par trimestre écoulé, dans l'ordre.
	const resolved = state.history.filter((entry) => entry.type === 'turn.resolved');
	if (resolved.length !== state.turn - START_TURN) {
		violations.push(
			`journal incohérent : ${resolved.length} tour(s) résolu(s) pour le tour ${state.turn}`
		);
	}
	resolved.forEach((entry, index) => {
		if (entry.turn !== START_TURN + index) {
			violations.push(`journal hors séquence : tour ${entry.turn} en position ${index}`);
		}
	});

	if ((state.phase === 'ended') !== (state.end !== null)) {
		violations.push('phase de fin et état de fin incohérents');
	}
	if (state.end && (!Number.isSafeInteger(state.end.turn) || state.end.turn > state.turn)) {
		violations.push(`tour de fin invalide : ${state.end.turn}`);
	}

	return violations;
}

export function assertInvariants(state: GameState): void {
	const violations = checkInvariants(state);
	if (violations.length > 0) {
		throw new Error(`Invariants violés :\n- ${violations.join('\n- ')}`);
	}
}
