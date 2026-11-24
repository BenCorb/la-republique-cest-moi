/**
 * Contrôle unique des invariants de l'état (ARCHITECTURE.md §4.3).
 *
 * Utilisé après chaque transition dans les tests et, plus tard, aux frontières de
 * chargement (sauvegarde, import). Ne corrige rien : signale toutes les violations.
 * Avec le contenu, vérifie aussi les références vers le catalogue.
 */
import {
	ATTITUDE_MAX,
	ATTITUDE_MIN,
	GAUGE_MAX,
	GAUGE_MIN,
	INDICATOR_IDS,
	RESOURCE_IDS,
	WORLD_TEMPLATE_VARIABLES,
	type Content
} from '../content/types.ts';
import { RNG_ALGORITHM, validateSeed } from './random.ts';
import { activeMandates, conflictingMandates } from './career.ts';
import { computePopularity } from './supports.ts';
import { START_TURN, STATE_SCHEMA_VERSION, type GameState } from './state.ts';

const PHASES = new Set(['planning', 'decision', 'ended']);

function isUint32(value: unknown): boolean {
	return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 0xffffffff;
}

const INSTANCE_ID = /^upgrade\.([1-9][0-9]*)$/;
const EVENT_INSTANCE_ID = /^event\.([1-9][0-9]*)$/;
const CHARACTER_ID = /^character\.([1-9][0-9]*)$/;
/** Personnage initial : identifiant de la distribution (`cast.x`), contrôlé avec le contenu. */
const CAST_ID = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const STATUSES = new Set(['active', 'retired', 'dead']);

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

	violations.push(...checkEventInvariants(state, instanceIds));
	violations.push(...checkWorldInvariants(state));
	violations.push(...checkCareerInvariants(state));
	if (content) violations.push(...checkContentReferences(state, content));
	return violations;
}

function checkEventInvariants(state: GameState, usedInstanceIds: Set<string>): string[] {
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
	}
	for (const entry of scheduled) {
		if (!Number.isSafeInteger(entry.dueTurn) || entry.dueTurn <= state.turn) {
			violations.push(`suite échue non traitée : ${entry.eventId} au tour ${entry.dueTurn}`);
		}
	}
	for (const [eventId, occurrence] of Object.entries(occurrences)) {
		if (!Number.isSafeInteger(occurrence.count) || occurrence.count < 1) {
			violations.push(`occurrences invalides : ${eventId}`);
		}
		if (!Number.isSafeInteger(occurrence.lastTurn) || occurrence.lastTurn > state.turn) {
			violations.push(`dernière occurrence future : ${eventId}`);
		}
	}
	return violations;
}

/** Monde, personnages et adhésions du joueur (P2-01). */
function checkWorldInvariants(state: GameState): string[] {
	const violations: string[] = [];
	const { world, characters, player } = state;

	for (const indicator of INDICATOR_IDS) {
		const value = world.indicators[indicator];
		if (!Number.isSafeInteger(value) || value < GAUGE_MIN || value > GAUGE_MAX) {
			violations.push(`indicateur invalide : ${indicator} = ${value}`);
		}
	}
	if (!Object.hasOwn(world.parties, world.governingPartyId)) {
		violations.push(`parti au gouvernement inconnu : ${world.governingPartyId}`);
	}

	const characterCount = Object.keys(characters).length;
	for (const [key, character] of Object.entries(characters)) {
		// Rangs de création 1..N, sans trou : aucun personnage n'est supprimé.
		const match = CHARACTER_ID.exec(character.id);
		const valid = match ? Number(match[1]) <= characterCount : CAST_ID.test(character.id);
		if (key !== character.id || !valid) {
			violations.push(`identifiant de personnage invalide : ${key}`);
		}
		if (!STATUSES.has(character.status)) {
			violations.push(`statut de personnage inconnu : ${character.id}`);
		}
		if ((character.status === 'active') !== (character.leftTurn === null)) {
			violations.push(`départ incohérent avec le statut : ${character.id}`);
		}
		if (character.leftTurn !== null && character.leftTurn > state.turn) {
			violations.push(`départ futur : ${character.id}`);
		}
		if (new Set(character.traits).size !== character.traits.length) {
			violations.push(`trait en double : ${character.id}`);
		}
		if (character.knownTraits.some((trait) => !character.traits.includes(trait))) {
			violations.push(`trait connu absent des traits réels : ${character.id}`);
		}
		if (character.successorOf !== null && !Object.hasOwn(characters, character.successorOf)) {
			violations.push(`prédécesseur inconnu : ${character.id}`);
		}
		if (!Number.isSafeInteger(character.birthTurn) || character.birthTurn > state.turn) {
			violations.push(`naissance de personnage invalide : ${character.id}`);
		}
		if (character.partyId !== null && !Object.hasOwn(world.parties, character.partyId)) {
			violations.push(`parti inconnu pour ${character.id} : ${character.partyId}`);
		}
	}
	const leaders = new Set<string>();
	for (const [partyId, party] of Object.entries(world.parties)) {
		if (!Number.isSafeInteger(party.strength) || party.strength < 0) {
			violations.push(`force invalide : ${partyId} = ${party.strength}`);
		}
		const leader = characters[party.leaderId];
		if (!leader) {
			violations.push(`dirigeant inconnu pour ${partyId} : ${party.leaderId}`);
		} else if (leader.partyId !== partyId) {
			violations.push(`dirigeant d’un autre parti à la tête de ${partyId} : ${leader.id}`);
		} else if (leader.status !== 'active') {
			violations.push(`dirigeant parti à la tête de ${partyId} : ${leader.id}`);
		}
		if (leaders.has(party.leaderId)) {
			violations.push(`dirigeant à la tête de deux partis : ${party.leaderId}`);
		}
		leaders.add(party.leaderId);
	}

	for (const [characterId, relationship] of Object.entries(state.relationships)) {
		if (!Object.hasOwn(characters, characterId)) {
			violations.push(`relation avec un personnage inconnu : ${characterId}`);
		}
		const { attitude, metTurn, memories } = relationship;
		if (!Number.isSafeInteger(attitude) || attitude < ATTITUDE_MIN || attitude > ATTITUDE_MAX) {
			violations.push(`attitude invalide : ${characterId} = ${attitude}`);
		}
		if (!Number.isSafeInteger(metTurn) || metTurn > state.turn) {
			violations.push(`rencontre future : ${characterId}`);
		}
		memories.forEach((memory, index) => {
			const previous = memories[index - 1];
			if (
				memory.turn < metTurn ||
				memory.turn > state.turn ||
				(previous && memory.turn < previous.turn)
			) {
				violations.push(`souvenir hors chronologie : ${characterId}`);
			}
		});
	}

	for (const [groupId, value] of Object.entries(player.supports)) {
		if (!Number.isSafeInteger(value) || value < GAUGE_MIN || value > GAUGE_MAX) {
			violations.push(`soutien invalide : ${groupId} = ${value}`);
		}
	}
	if (
		!Number.isSafeInteger(player.popularity) ||
		player.popularity < GAUGE_MIN ||
		player.popularity > GAUGE_MAX
	) {
		violations.push(`popularité invalide : ${player.popularity}`);
	}

	// Adhésions : chronologiques, une seule en cours, cohérente avec le parti actuel.
	let previousEnd = -Infinity;
	player.affiliations.forEach((affiliation, index) => {
		const last = index === player.affiliations.length - 1;
		if (!Object.hasOwn(world.parties, affiliation.partyId)) {
			violations.push(`adhésion à un parti inconnu : ${affiliation.partyId}`);
		}
		if (affiliation.fromTurn < previousEnd || affiliation.fromTurn > state.turn) {
			violations.push(`adhésion hors chronologie : ${affiliation.partyId}`);
		}
		if (affiliation.toTurn === null && !last) {
			violations.push(`adhésion en cours qui n’est pas la dernière : ${affiliation.partyId}`);
		}
		if (affiliation.toTurn !== null && affiliation.toTurn < affiliation.fromTurn) {
			violations.push(`adhésion terminée avant d’avoir commencé : ${affiliation.partyId}`);
		}
		previousEnd = affiliation.toTurn ?? affiliation.fromTurn;
	});
	const current = player.affiliations.at(-1);
	const expected = current && current.toTurn === null ? current.partyId : null;
	if (player.partyId !== expected) {
		violations.push(`parti du joueur incohérent avec ses adhésions : ${String(player.partyId)}`);
	}
	return violations;
}

const TERM_ID = /^term\.([1-9][0-9]*)$/;
const BALLOT_ID = /^ballot\.([1-9][0-9]*)$/;

/** Mandats et calendrier électoral (P2-02) : cumul respecté, échéances cohérentes. */
function checkCareerInvariants(state: GameState): string[] {
	const violations: string[] = [];
	const { mandates, ballots, institutions } = state;

	mandates.forEach((mandate, index) => {
		const match = TERM_ID.exec(mandate.instanceId);
		if (!match || Number(match[1]) !== index + 1) {
			violations.push(`identifiant de mandat invalide : ${mandate.instanceId}`);
		}
		if (mandate.startTurn > state.turn) violations.push(`mandat futur : ${mandate.instanceId}`);
		if ((mandate.status === 'active') !== (mandate.endTurn === null)) {
			violations.push(`fin de mandat incohérente : ${mandate.instanceId}`);
		}
		if ((mandate.endTurn === null) !== (mandate.endReason === null)) {
			violations.push(`motif de fin de mandat incohérent : ${mandate.instanceId}`);
		}
		if (mandate.endTurn !== null && mandate.endTurn < mandate.startTurn) {
			violations.push(`mandat terminé avant d’avoir commencé : ${mandate.instanceId}`);
		}
	});
	const active = activeMandates(mandates);
	if (active.length > institutions.maxMandates) {
		violations.push(`cumul dépassé : ${active.length} > ${institutions.maxMandates}`);
	}
	if (new Set(active.map((mandate) => mandate.mandateId)).size !== active.length) {
		violations.push('le même mandat est exercé deux fois');
	}
	for (const mandate of active) {
		if (conflictingMandates(mandate.mandateId, mandates, institutions).length > 0) {
			violations.push(`mandats incompatibles exercés ensemble : ${mandate.mandateId}`);
		}
		for (const required of institutions.prerequisites[mandate.mandateId] ?? []) {
			if (!active.some((other) => other.mandateId === required)) {
				violations.push(`prérequis absent pour ${mandate.mandateId} : ${required}`);
			}
		}
	}

	ballots.forEach((ballot, index) => {
		const match = BALLOT_ID.exec(ballot.ballotId);
		if (!match || Number(match[1]) !== index + 1) {
			violations.push(`identifiant d’échéance invalide : ${ballot.ballotId}`);
		}
		// Après un décès en cours de trimestre, l'échéance de ce trimestre n'est jamais tenue.
		if (ballot.status === 'scheduled' && ballot.turn < state.turn && state.phase !== 'ended') {
			violations.push(`échéance passée non tenue : ${ballot.ballotId}`);
		}
		if (
			ballot.status === 'held' &&
			(ballot.turn >= state.turn || !ballot.shares || !ballot.winnerPartyId)
		) {
			violations.push(`scrutin tenu incohérent : ${ballot.ballotId}`);
		}
		if (ballot.shares && ballot.shares.reduce((total, share) => total + share.percent, 0) !== 100) {
			violations.push(`parts de voix dont la somme diffère de 100 : ${ballot.ballotId}`);
		}
		if ((ballot.status === 'cancelled') !== (ballot.cancelReason !== null)) {
			violations.push(`annulation incohérente : ${ballot.ballotId}`);
		}
		if (ballot.filingClosesTurn > ballot.turn) {
			violations.push(`clôture des candidatures après le scrutin : ${ballot.ballotId}`);
		}
	});
	const scheduledTypes = ballots
		.filter((ballot) => ballot.status === 'scheduled')
		.map((ballot) => ballot.electionId);
	if (new Set(scheduledTypes).size !== scheduledTypes.length) {
		violations.push('plusieurs échéances programmées pour un même type d’élection');
	}
	return violations;
}

/**
 * Références de l'état vers le catalogue : améliorations, événements en attente
 * ou programmés, occurrences, acteurs et nombres maximaux d'exemplaires. Une
 * violation ici signale un état incompatible avec ce contenu (par exemple une
 * sauvegarde d'une autre version), pas un état incohérent en soi.
 */
export function checkContentReferences(state: GameState, content: Content): string[] {
	const violations: string[] = [];
	const counts = new Map<string, number>();
	for (const upgrade of state.upgrades) {
		if (!Object.hasOwn(content.upgrades, upgrade.upgradeId)) {
			violations.push(`amélioration inconnue du catalogue : ${upgrade.upgradeId}`);
		}
		counts.set(upgrade.upgradeId, (counts.get(upgrade.upgradeId) ?? 0) + 1);
	}
	for (const [upgradeId, count] of counts) {
		const maxOwned = content.upgrades[upgradeId]?.maxOwned;
		if (maxOwned !== undefined && count > maxOwned) {
			violations.push(`trop d’exemplaires de ${upgradeId} : ${count} > ${maxOwned}`);
		}
	}
	const { pending, scheduled, occurrences } = state.events;
	for (const instance of pending) {
		const definition = content.events[instance.eventId];
		if (!definition || !definition.blocking) {
			violations.push(`événement en attente inconnu ou non bloquant : ${instance.eventId}`);
		}
	}
	for (const entry of scheduled) {
		if (!Object.hasOwn(content.events, entry.eventId)) {
			violations.push(`suite inconnue du catalogue : ${entry.eventId}`);
		}
	}
	for (const eventId of Object.keys(occurrences)) {
		if (!Object.hasOwn(content.events, eventId)) {
			violations.push(`occurrence d’un événement inconnu : ${eventId}`);
		}
	}
	const actorSets = [
		...pending.map((instance) => instance.actors),
		...scheduled.map((entry) => entry.actors)
	];
	const worldVariables = new Set<string>(WORLD_TEMPLATE_VARIABLES);
	for (const actors of actorSets) {
		for (const [role, actorId] of Object.entries(actors)) {
			const known = worldVariables.has(role)
				? Object.hasOwn(content.parties, actorId) || Object.hasOwn(state.characters, actorId)
				: Object.hasOwn(state.characters, actorId);
			if (!known) violations.push(`acteur inconnu : ${role} = ${actorId}`);
		}
	}
	for (const castId of content.castIds) {
		if (!Object.hasOwn(state.characters, castId)) {
			violations.push(`membre de la distribution absent de l’état : ${castId}`);
		}
	}
	for (const character of Object.values(state.characters)) {
		if (!CHARACTER_ID.test(character.id) && !Object.hasOwn(content.cast, character.id)) {
			violations.push(`personnage inconnu de la distribution : ${character.id}`);
		}
		for (const trait of character.traits) {
			if (!Object.hasOwn(content.traits, trait)) violations.push(`trait inconnu : ${trait}`);
		}
	}
	for (const [characterId, relationship] of Object.entries(state.relationships)) {
		if (relationship.memories.length > content.balance.characters.maxMemories) {
			violations.push(`trop de souvenirs : ${characterId}`);
		}
	}
	const groups = Object.keys(state.player.supports).sort().join(',');
	if (groups !== [...content.supportGroupIds].sort().join(',')) {
		violations.push('groupes de soutien de l’état différents de ceux du catalogue');
	}
	if (state.player.popularity !== computePopularity(state.player.supports, content)) {
		violations.push(`popularité incohérente avec les soutiens : ${state.player.popularity}`);
	}
	for (const mandate of state.mandates) {
		if (!Object.hasOwn(content.mandates, mandate.mandateId)) {
			violations.push(`mandat inconnu du catalogue : ${mandate.mandateId}`);
		}
	}
	for (const electionId of content.electionIds) {
		const scheduled = state.ballots.filter(
			(ballot) => ballot.electionId === electionId && ballot.status === 'scheduled'
		);
		if (scheduled.length !== 1) {
			violations.push(`échéance programmée manquante ou multiple : ${electionId}`);
		}
	}
	for (const ballot of state.ballots) {
		if (!Object.hasOwn(content.elections, ballot.electionId)) {
			violations.push(`élection inconnue du catalogue : ${ballot.electionId}`);
		}
	}
	const partyIds = Object.keys(state.world.parties).sort();
	const catalogIds = [...content.partyIds].sort();
	if (partyIds.join(',') !== catalogIds.join(',')) {
		violations.push('partis de l’état différents de ceux du catalogue');
	}
	const { minPartyStrength, maxPartyStrength } = content.balance.world;
	for (const [partyId, party] of Object.entries(state.world.parties)) {
		if (party.strength < minPartyStrength || party.strength > maxPartyStrength) {
			violations.push(`force hors bornes : ${partyId} = ${party.strength}`);
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
