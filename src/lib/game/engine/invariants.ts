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
	FACT_SEVERITY_MAX,
	MEDIA_RELATION_MAX,
	MEDIA_RELATION_MIN,
	GAUGE_MAX,
	GAUGE_MIN,
	INDICATOR_IDS,
	PROMISE_PROGRESS_MAX,
	POST_VARIABLE,
	PROMISE_VARIABLE,
	RESOURCE_IDS,
	WORLD_TEMPLATE_VARIABLES,
	type Content
} from '../content/types.ts';
import { RNG_ALGORITHM, validateSeed } from './random.ts';
import { activeMandates, conflictingMandates, cumulatedMandates } from './career.ts';
import { computePopularity } from './supports.ts';
import { caseInstanceId, factInstanceId } from './justice.ts';
import { isOpenPledge, pledgeInstanceId } from './promises.ts';
import { reformInstanceId } from './reforms.ts';
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

	for (const upgrade of state.upgrades) {
		const value = upgrade.valueCents;
		if (value !== null && (!Number.isSafeInteger(value) || value < 0)) {
			violations.push(`valeur d’actif invalide : ${upgrade.instanceId} = ${value}`);
		}
	}

	for (const gauge of ['health', 'stress', 'exposure', 'defense'] as const) {
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
	violations.push(...checkFactInvariants(state));
	violations.push(...checkCaseInvariants(state));
	violations.push(...checkPromiseInvariants(state));
	violations.push(...checkMediaInvariants(state));
	violations.push(...checkReformInvariants(state));
	if (content) violations.push(...checkContentReferences(state, content));
	if (content) violations.push(...checkPressMemory(state, content));
	return violations;
}

/**
 * Promesses : rangs en séquence, campagne connue, états cohérents avec la
 * campagne (annoncée pendant la campagne, en cours après une victoire), issue
 * datée, échéance non échue tant que la partie continue, au plus une promesse
 * ouverte par promesse type.
 */
/**
 * Réformes (P3-05) : séquence, aucune proposition non votée entre deux
 * trimestres, entrée en vigueur datée cohérente avec l'état, une seule
 * réforme en attente par paramètre.
 */
function checkReformInvariants(state: GameState): string[] {
	const violations: string[] = [];
	const pending = new Set<string>();
	state.institutions.reforms.forEach((reform, index) => {
		const id = reform.reformId;
		if (id !== reformInstanceId(index + 1)) violations.push(`réforme hors séquence : ${id}`);
		if (reform.proposedTurn > state.turn) violations.push(`date de proposition invalide : ${id}`);
		// Une proposition reste non votée seulement si la carrière s'est terminée avant le vote.
		if (reform.status === 'proposed' && state.phase !== 'ended') {
			violations.push(`réforme non votée : ${id}`);
		}
		if (reform.status === 'scheduled') {
			// Après une fin de carrière, plus rien n'entre en vigueur.
			if (
				reform.activationTurn === null ||
				(state.phase !== 'ended' && reform.activationTurn <= state.turn)
			) {
				violations.push(`entrée en vigueur échue : ${id}`);
			}
			if (pending.has(reform.parameterId)) {
				violations.push(`deux réformes en attente : ${reform.parameterId}`);
			}
			pending.add(reform.parameterId);
		}
		if (
			reform.status === 'enacted' &&
			(reform.activationTurn === null || reform.activationTurn > state.turn)
		) {
			violations.push(`entrée en vigueur future : ${id}`);
		}
		const undated = reform.status === 'rejected' || reform.status === 'proposed';
		if (undated !== (reform.activationTurn === null)) {
			violations.push(`date d’entrée en vigueur incohérente : ${id}`);
		}
	});
	return violations;
}

/** Médias (P3-03) : relations entières bornées, interviews passées. */
function checkMediaInvariants(state: GameState): string[] {
	const violations: string[] = [];
	for (const [mediaId, media] of Object.entries(state.world.media)) {
		if (
			!Number.isSafeInteger(media.relation) ||
			media.relation < MEDIA_RELATION_MIN ||
			media.relation > MEDIA_RELATION_MAX
		) {
			violations.push(`relation de média hors bornes : ${mediaId} = ${media.relation}`);
		}
		if (
			media.interviewTurn !== null &&
			(media.interviewTurn < START_TURN || media.interviewTurn > state.turn)
		) {
			violations.push(`date d’interview invalide : ${mediaId}`);
		}
	}
	return violations;
}

/** Mémoire du fil de presse (P3-15) : titres connus, sans doublon ; angles bornés. */
function checkPressMemory(state: GameState, content: Content): string[] {
	const violations: string[] = [];
	const { usedHeadlines, recentAngles } = state.world.press;
	const known = new Set(content.headlines.map((headline) => headline.id));
	for (const [key, ids] of Object.entries(usedHeadlines)) {
		const seen = new Set<string>();
		for (const id of ids) {
			if (!known.has(id)) violations.push(`titre inconnu dans la mémoire de presse : ${id}`);
			if (seen.has(id)) violations.push(`titre en double dans le pool ${key} : ${id}`);
			seen.add(id);
		}
	}
	if (recentAngles.length > content.press.angleRepeatLimit) {
		violations.push('mémoire des angles de presse plus longue que le délai thématique');
	}
	return violations;
}

function checkPromiseInvariants(state: GameState): string[] {
	const violations: string[] = [];
	const open = new Set<string>();
	const ongoing = state.phase !== 'ended';
	state.promises.forEach((pledge, index) => {
		const id = pledge.pledgeId;
		if (id !== pledgeInstanceId(index + 1)) violations.push(`promesse hors séquence : ${id}`);
		const campaign = state.campaigns.find((entry) => entry.campaignId === pledge.campaignId);
		if (!campaign) violations.push(`campagne inconnue pour ${id} : ${pledge.campaignId}`);
		if (
			pledge.announcedTurn > state.turn ||
			(campaign && pledge.announcedTurn < campaign.declaredTurn)
		) {
			violations.push(`date d’annonce invalide : ${id}`);
		}
		if (
			!Number.isSafeInteger(pledge.progress) ||
			pledge.progress < 0 ||
			pledge.progress > PROMISE_PROGRESS_MAX
		) {
			violations.push(`avancement hors bornes : ${id}`);
		}
		const inProgress = pledge.status === 'in_progress';
		if (inProgress !== (pledge.dueTurn !== null)) violations.push(`échéance incohérente : ${id}`);
		const settled = pledge.status !== 'announced' && !inProgress;
		if (settled && pledge.closedTurn === null) violations.push(`issue non datée : ${id}`);
		if (inProgress && pledge.closedTurn !== null)
			violations.push(`promesse close en cours : ${id}`);
		if (ongoing && campaign) {
			if (
				pledge.status === 'announced' &&
				(pledge.closedTurn === null) !== (campaign.status === 'running')
			) {
				violations.push(`promesse annoncée incohérente avec sa campagne : ${id}`);
			}
			if (pledge.status !== 'announced' && campaign.status !== 'won') {
				violations.push(`promesse réalisée sans victoire : ${id}`);
			}
		}
		if (ongoing && inProgress && pledge.dueTurn !== null && pledge.dueTurn < state.turn) {
			violations.push(`échéance de promesse non traitée : ${id}`);
		}
		if (pledge.status === 'announced' && (pledge.progress !== 0 || pledge.amended)) {
			violations.push(`promesse annoncée déjà engagée : ${id}`);
		}
		if (pledge.recalls < 0 || (pledge.recalls === 0) !== (pledge.lastRecalledTurn === null)) {
			violations.push(`rappels incohérents : ${id}`);
		}
		if (isOpenPledge(pledge)) {
			if (open.has(pledge.promiseId)) {
				violations.push(`promesse ouverte en double : ${pledge.promiseId}`);
			}
			open.add(pledge.promiseId);
		}
	});
	return violations;
}

/** Dossiers : rangs en séquence, un dossier par fait, étapes et issues cohérentes. */
function checkCaseInvariants(state: GameState): string[] {
	const violations: string[] = [];
	const seen = new Set<string>();
	state.cases.forEach((legalCase, index) => {
		const id = legalCase.caseId;
		if (id !== caseInstanceId(index + 1)) violations.push(`dossier hors séquence : ${id}`);
		const fact = state.facts.find((entry) => entry.factId === legalCase.factId);
		if (!fact) violations.push(`fait inconnu pour ${id} : ${legalCase.factId}`);
		else if (fact.authorId !== legalCase.defendantId) {
			violations.push(`personne poursuivie incohérente : ${id}`);
		}
		if (seen.has(legalCase.factId))
			violations.push(`fait poursuivi deux fois : ${legalCase.factId}`);
		seen.add(legalCase.factId);
		if (legalCase.openedTurn > state.turn || (fact && legalCase.openedTurn <= fact.turn)) {
			violations.push(`date d’ouverture invalide : ${id}`);
		}
		const closed = legalCase.stage === 'closed';
		if (closed !== (legalCase.outcome !== null) || closed !== (legalCase.closedTurn !== null)) {
			violations.push(`clôture incohérente : ${id}`);
		}
		if (closed === (legalCase.dueTurn !== null)) violations.push(`échéance incohérente : ${id}`);
		if (
			state.phase !== 'ended' &&
			!closed &&
			legalCase.dueTurn !== null &&
			legalCase.dueTurn < state.turn
		) {
			violations.push(`étape échue non traitée : ${id}`);
		}
		if ((legalCase.outcome === 'convicted') !== (legalCase.sentence !== null)) {
			violations.push(`peine incohérente : ${id}`);
		}
		if (legalCase.stage === 'appeal' && legalCase.defendantId !== null) {
			violations.push(`appel d’un proche : ${id}`);
		}
	});
	const end = state.end;
	if (
		end?.reason === 'prison' &&
		!state.cases.some((entry) => entry.caseId === end.caseId && entry.sentence?.prison === 'firm')
	) {
		violations.push('fin de carrière en prison sans peine ferme');
	}
	return violations;
}

/** Registre des faits : rangs en séquence, dates passées, protagonistes connus. */
function checkFactInvariants(state: GameState): string[] {
	const violations: string[] = [];
	state.facts.forEach((fact, index) => {
		if (fact.factId !== factInstanceId(index + 1)) {
			violations.push(`fait hors séquence : ${fact.factId} en position ${index}`);
		}
		if (!Number.isSafeInteger(fact.turn) || fact.turn < START_TURN || fact.turn > state.turn) {
			violations.push(`date de fait invalide : ${fact.factId}`);
		}
		if (index > 0 && fact.turn < state.facts[index - 1]!.turn) {
			violations.push(`faits hors ordre chronologique : ${fact.factId}`);
		}
		if (
			!Number.isSafeInteger(fact.severity) ||
			fact.severity < 1 ||
			fact.severity > FACT_SEVERITY_MAX
		) {
			violations.push(`gravité de fait invalide : ${fact.factId}`);
		}
		if (!Number.isSafeInteger(fact.divertedCents) || fact.divertedCents < 0) {
			violations.push(`fonds détournés invalides : ${fact.factId}`);
		}
		const protagonists = [
			...(fact.authorId === null ? [] : [fact.authorId]),
			...fact.accompliceIds
		];
		if (new Set(protagonists).size !== protagonists.length) {
			violations.push(`protagoniste en double : ${fact.factId}`);
		}
		for (const id of protagonists) {
			if (!Object.hasOwn(state.characters, id)) {
				violations.push(`protagoniste inconnu pour ${fact.factId} : ${id}`);
			}
		}
	});
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

	const { family } = player;
	const kin = [
		...(family.partnerId ? [family.partnerId] : []),
		...family.childrenIds,
		...family.parentIds,
		...family.siblingIds,
		...family.formerPartnerIds
	];
	for (const id of kin) {
		if (!state.characters[id]) violations.push(`membre de la famille inconnu : ${id}`);
	}
	if (new Set(kin).size !== kin.length) violations.push('membre de la famille compté deux fois');
	if (
		family.partnerId &&
		state.characters[family.partnerId]?.status === 'dead' &&
		state.phase !== 'ended'
	) {
		violations.push(`partenaire décédé encore en couple : ${family.partnerId}`);
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
	const cumulated = cumulatedMandates(mandates, institutions).length;
	if (cumulated > institutions.maxMandates) {
		violations.push(`cumul dépassé : ${cumulated} > ${institutions.maxMandates}`);
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
	state.campaigns.forEach((campaign, index) => {
		if (campaign.campaignId !== `campaign.${index + 1}`) {
			violations.push(`identifiant de campagne invalide : ${campaign.campaignId}`);
		}
		const ballot = ballots.find((entry) => entry.ballotId === campaign.ballotId);
		if (!ballot) {
			violations.push(`campagne pour une échéance inconnue : ${campaign.campaignId}`);
		} else if (campaign.status === 'running' && ballot.status !== 'scheduled') {
			violations.push(`campagne en cours pour une échéance passée : ${campaign.campaignId}`);
		} else if (campaign.status !== 'running' && ballot.status === 'scheduled') {
			violations.push(`campagne jugée avant son scrutin : ${campaign.campaignId}`);
		}
		if (
			campaign.declaredTurn > state.turn ||
			!Number.isSafeInteger(campaign.preparation) ||
			campaign.preparation < 0
		) {
			violations.push(`campagne incohérente : ${campaign.campaignId}`);
		}
		if (
			(campaign.status === 'won' || campaign.status === 'lost') !==
			(campaign.playerPercent !== null)
		) {
			violations.push(`score de campagne incohérent : ${campaign.campaignId}`);
		}
	});
	for (const campaign of state.campaigns) {
		if (campaign.opponentId === null) continue;
		const opponent = state.characters[campaign.opponentId];
		if (!opponent) {
			violations.push(`adversaire inconnu : ${campaign.campaignId}`);
		} else if (campaign.status === 'running' && opponent.status !== 'active') {
			violations.push(`adversaire parti encore en campagne : ${campaign.campaignId}`);
		}
	}
	const occupied = new Set<string>();
	for (const member of state.staff) {
		const character = state.characters[member.characterId];
		if (!character) {
			violations.push(`collaborateur inconnu : ${member.characterId}`);
			continue;
		}
		if ((member.status === 'active') !== (member.leftTurn === null)) {
			violations.push(`départ de collaborateur incohérent : ${member.characterId}`);
		}
		if (member.hiredTurn > state.turn) violations.push(`embauche future : ${member.characterId}`);
		if (member.status !== 'active') continue;
		if (occupied.has(member.postId)) violations.push(`poste occupé deux fois : ${member.postId}`);
		occupied.add(member.postId);
		if (character.status !== 'active') {
			violations.push(`collaborateur parti encore en poste : ${member.characterId}`);
		}
		if (!character.tags.includes('staff')) {
			violations.push(`collaborateur sans étiquette d’entourage : ${member.characterId}`);
		}
	}
	for (const [postId, entries] of Object.entries(state.shortlists)) {
		if (occupied.has(postId)) violations.push(`présélection pour un poste pourvu : ${postId}`);
		for (const entry of entries) {
			if (!state.characters[entry.characterId]) {
				violations.push(`candidat inconnu : ${entry.characterId}`);
			}
		}
	}
	for (const character of Object.values(state.characters)) {
		if (
			!Number.isSafeInteger(character.competence) ||
			character.competence < 0 ||
			character.competence > 100
		) {
			violations.push(`compétence invalide : ${character.id}`);
		}
	}
	const running = state.campaigns.filter((campaign) => campaign.status === 'running');
	if (new Set(running.map((campaign) => campaign.ballotId)).size !== running.length) {
		violations.push('deux campagnes en cours pour une même échéance');
	}
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
	// Territoire d'origine (P3-16) : région, département de la région, taille et traits connus.
	const { territory } = state.player;
	const region = content.regions[territory.regionId];
	if (!region) violations.push(`région inconnue : ${territory.regionId}`);
	else if (!region.departments.some((entry) => entry.code === territory.departmentCode)) {
		violations.push(`département hors de la région : ${territory.departmentCode}`);
	}
	if (!content.territory.sizes.some((size) => size.id === territory.homeTown.sizeId)) {
		violations.push(`taille de commune inconnue : ${territory.homeTown.sizeId}`);
	}
	for (const traitId of territory.homeTown.traitIds) {
		if (!content.territory.traits.some((trait) => trait.id === traitId)) {
			violations.push(`trait de commune inconnu : ${traitId}`);
		}
	}
	for (const parameterId of content.institutionParameterIds) {
		const levelId = state.institutions.parameters[parameterId];
		const level = content.institutionParameters[parameterId]?.levels.find(
			(entry) => entry.id === levelId
		);
		if (!level) {
			violations.push(`niveau institutionnel inconnu : ${parameterId} = ${String(levelId)}`);
		} else if (
			level.modifiers.maxMandates !== undefined &&
			level.modifiers.maxMandates !== state.institutions.maxMandates
		) {
			violations.push(`plafond du cumul différent du niveau en vigueur : ${level.id}`);
		}
	}
	if (
		Object.keys(state.institutions.parameters).length !== content.institutionParameterIds.length
	) {
		violations.push('paramètres institutionnels différents du catalogue');
	}
	const mediaIds = Object.keys(state.world.media).sort();
	const catalogMedia = [...content.mediaIds].sort();
	if (mediaIds.join() !== catalogMedia.join()) {
		violations.push(`médias différents du catalogue : ${mediaIds.join(', ')}`);
	}
	if (!Object.hasOwn(content.lifestyles, state.player.lifestyle)) {
		violations.push(`train de vie inconnu : ${state.player.lifestyle}`);
	}
	for (const upgrade of state.upgrades) {
		const isAsset = content.upgrades[upgrade.upgradeId]?.asset !== undefined;
		if (isAsset !== (upgrade.valueCents !== null)) {
			violations.push(`valeur d’actif incohérente : ${upgrade.instanceId}`);
		}
	}
	for (const fact of state.facts) {
		if (!Object.hasOwn(content.offenses, fact.offenseId)) {
			violations.push(`infraction inconnue du catalogue : ${fact.offenseId}`);
		}
		if (!Object.hasOwn(content.events, fact.eventId)) {
			violations.push(`événement inconnu du catalogue pour ${fact.factId} : ${fact.eventId}`);
		}
	}
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
			if (role === PROMISE_VARIABLE) {
				if (!Object.hasOwn(content.promises, actorId)) {
					violations.push(`promesse inconnue pour un événement : ${actorId}`);
				}
				continue;
			}
			// Poste lié à un événement de sujet `post` (P3-12) ; son titulaire est un personnage.
			if (role === POST_VARIABLE) {
				if (!Object.hasOwn(content.posts, actorId)) {
					violations.push(`poste inconnu pour un événement : ${actorId}`);
				}
				continue;
			}
			const known = worldVariables.has(role)
				? Object.hasOwn(content.parties, actorId) || Object.hasOwn(state.characters, actorId)
				: Object.hasOwn(state.characters, actorId);
			if (!known) violations.push(`acteur inconnu : ${role} = ${actorId}`);
		}
	}
	const perCampaign = new Map<string, number>();
	for (const pledge of state.promises) {
		const definition = content.promises[pledge.promiseId];
		if (!definition) {
			violations.push(`promesse inconnue du catalogue : ${pledge.promiseId}`);
			continue;
		}
		const campaign = state.campaigns.find((entry) => entry.campaignId === pledge.campaignId);
		if (campaign && !definition.elections.includes(campaign.electionId)) {
			violations.push(`promesse étrangère à l’élection : ${pledge.pledgeId}`);
		}
		if (pledge.recalls > content.promiseRules.maxRecalls) {
			violations.push(`trop de rappels : ${pledge.pledgeId}`);
		}
		perCampaign.set(pledge.campaignId, (perCampaign.get(pledge.campaignId) ?? 0) + 1);
	}
	for (const [campaignId, count] of perCampaign) {
		if (count > content.promiseRules.maxPerCampaign) {
			violations.push(`trop de promesses pour ${campaignId} : ${count}`);
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
	if (!Object.hasOwn(content.origins, state.player.origin)) {
		violations.push(`origine inconnue du catalogue : ${state.player.origin}`);
	}
	if (!Object.hasOwn(content.engagements, state.player.engagement)) {
		violations.push(`engagement inconnue du catalogue : ${state.player.engagement}`);
	}
	for (const member of state.staff) {
		const post = content.posts[member.postId];
		if (!post) violations.push(`poste inconnu du catalogue : ${member.postId}`);
		else if (!post.missions.some((mission) => mission.id === member.missionId)) {
			violations.push(`mission étrangère au poste : ${member.missionId}`);
		}
	}
	for (const postId of Object.keys(state.shortlists)) {
		if (!Object.hasOwn(content.posts, postId))
			violations.push(`présélection pour un poste inconnu : ${postId}`);
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
