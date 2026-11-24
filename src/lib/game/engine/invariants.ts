/**
 * Contrôle unique des invariants de l'état (ARCHITECTURE.md §4.3).
 *
 * Utilisé après chaque transition dans les tests et, plus tard, aux frontières de
 * chargement (sauvegarde, import). Ne corrige rien : signale toutes les violations.
 * Avec le contenu, vérifie aussi les références vers le catalogue.
 */
import { GAUGE_MAX, GAUGE_MIN, RESOURCE_IDS, type Content } from '../content/types.ts';
import { RNG_ALGORITHM, validateSeed } from './random.ts';
import { START_TURN, STATE_SCHEMA_VERSION, type GameState } from './state.ts';

const PHASES = new Set(['planning', 'decision', 'ended']);

function isUint32(value: unknown): boolean {
	return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 0xffffffff;
}

const INSTANCE_ID = /^upgrade\.([1-9][0-9]*)$/;
const EVENT_INSTANCE_ID = /^event\.([1-9][0-9]*)$/;

export function checkInvariants(state: GameState, content?: Content): string[] {
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

	for (const gauge of ['health', 'stress'] as const) {
		const value = state.player[gauge];
		if (!Number.isSafeInteger(value) || value < GAUGE_MIN || value > GAUGE_MAX) {
			violations.push(`jauge invalide : ${gauge} = ${value}`);
		}
	}
	if (state.phase !== 'ended' && state.player.health <= 0) {
		violations.push('personnage vivant avec une santé nulle');
	}

	for (const resource of RESOURCE_IDS) {
		const value = state.resources[resource];
		if (!Number.isSafeInteger(value) || value < 0) {
			violations.push(`ressource invalide : ${resource} = ${value}`);
		}
	}

	if (!Number.isSafeInteger(state.nextInstanceNumber) || state.nextInstanceNumber < 1) {
		violations.push(`compteur d’instances invalide : ${state.nextInstanceNumber}`);
	}
	const instanceIds = new Set<string>();
	let previousTurn = -Infinity;
	for (const upgrade of state.upgrades) {
		const match = INSTANCE_ID.exec(upgrade.instanceId);
		if (!match || Number(match[1]) >= state.nextInstanceNumber) {
			violations.push(`identifiant d’instance invalide : ${upgrade.instanceId}`);
		}
		if (instanceIds.has(upgrade.instanceId)) {
			violations.push(`instance en double : ${upgrade.instanceId}`);
		}
		instanceIds.add(upgrade.instanceId);
		// Les achats ont lieu pendant un trimestre déjà résolu, dans l'ordre chronologique.
		if (!Number.isSafeInteger(upgrade.acquiredTurn) || upgrade.acquiredTurn >= state.turn) {
			violations.push(`date d’acquisition invalide : ${upgrade.instanceId}`);
		}
		if (upgrade.acquiredTurn < previousTurn) {
			violations.push(`améliorations hors ordre d’acquisition : ${upgrade.instanceId}`);
		}
		previousTurn = upgrade.acquiredTurn;
		if (content && !Object.hasOwn(content.upgrades, upgrade.upgradeId)) {
			violations.push(`amélioration inconnue du catalogue : ${upgrade.upgradeId}`);
		}
	}
	if (content) {
		const counts = new Map<string, number>();
		for (const upgrade of state.upgrades) {
			counts.set(upgrade.upgradeId, (counts.get(upgrade.upgradeId) ?? 0) + 1);
		}
		for (const [upgradeId, count] of counts) {
			const maxOwned = content.upgrades[upgradeId]?.maxOwned;
			if (maxOwned !== undefined && count > maxOwned) {
				violations.push(`trop d’exemplaires de ${upgradeId} : ${count} > ${maxOwned}`);
			}
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
	// Fin en T (pendant la résolution) ou en T+1 (événement ou choix après la frontière).
	if (state.end && (!Number.isSafeInteger(state.end.turn) || state.end.turn > state.turn)) {
		violations.push(`tour de fin invalide : ${state.end.turn}`);
	}

	violations.push(...checkEventInvariants(state, instanceIds, content));
	return violations;
}

function checkEventInvariants(
	state: GameState,
	usedInstanceIds: Set<string>,
	content: Content | undefined
): string[] {
	const violations: string[] = [];
	const { pending, scheduled, occurrences } = state.events;

	if (state.phase === 'decision' && pending.length === 0) {
		violations.push('phase de décision sans événement en attente');
	}
	if (state.phase !== 'decision' && pending.length > 0) {
		violations.push(`événement(s) en attente hors phase de décision : ${pending.length}`);
	}
	if (state.phase === 'ended' && scheduled.length > 0) {
		violations.push('suites programmées après la fin de carrière');
	}

	for (const instance of pending) {
		const match = EVENT_INSTANCE_ID.exec(instance.instanceId);
		if (!match || Number(match[1]) >= state.nextInstanceNumber) {
			violations.push(`identifiant d’événement invalide : ${instance.instanceId}`);
		}
		if (usedInstanceIds.has(instance.instanceId)) {
			violations.push(`instance en double : ${instance.instanceId}`);
		}
		usedInstanceIds.add(instance.instanceId);
		if (!Number.isSafeInteger(instance.turn) || instance.turn > state.turn) {
			violations.push(`date d’événement invalide : ${instance.instanceId}`);
		}
		if (content) {
			const definition = content.events[instance.eventId];
			if (!definition || !definition.blocking) {
				violations.push(`événement en attente inconnu ou non bloquant : ${instance.eventId}`);
			}
		}
	}
	for (const entry of scheduled) {
		if (!Number.isSafeInteger(entry.dueTurn) || entry.dueTurn <= state.turn) {
			violations.push(`suite échue non traitée : ${entry.eventId} au tour ${entry.dueTurn}`);
		}
		if (content && !Object.hasOwn(content.events, entry.eventId)) {
			violations.push(`suite inconnue du catalogue : ${entry.eventId}`);
		}
	}
	for (const [eventId, occurrence] of Object.entries(occurrences)) {
		if (!Number.isSafeInteger(occurrence.count) || occurrence.count < 1) {
			violations.push(`occurrences invalides : ${eventId}`);
		}
		if (!Number.isSafeInteger(occurrence.lastTurn) || occurrence.lastTurn > state.turn) {
			violations.push(`dernière occurrence future : ${eventId}`);
		}
		if (content && !Object.hasOwn(content.events, eventId)) {
			violations.push(`occurrence d’un événement inconnu : ${eventId}`);
		}
	}
	if (content) {
		const actorSets = [
			...pending.map((instance) => instance.actors),
			...scheduled.map((entry) => entry.actors)
		];
		for (const actors of actorSets) {
			for (const castId of Object.values(actors)) {
				if (!Object.hasOwn(content.cast, castId)) {
					violations.push(`acteur inconnu de la distribution : ${castId}`);
				}
			}
		}
	}
	return violations;
}

export function assertInvariants(state: GameState, content?: Content): void {
	const violations = checkInvariants(state, content);
	if (violations.length > 0) {
		throw new Error(`Invariants violés :\n- ${violations.join('\n- ')}`);
	}
}
