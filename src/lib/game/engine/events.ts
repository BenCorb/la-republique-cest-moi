/**
 * Moteur d'événements (ARCHITECTURE.md §5.1 étapes 6–7, §7.2).
 *
 * À la frontière T/T+1, dans cet ordre :
 *   1. suites différées dues (programmées par des choix) : créées si leurs
 *      conditions tiennent encore, sinon annulées avec motif ;
 *   2. au plus `ordinaryDrawsPerTurn` tirages ordinaires : chaque tirage réussit
 *      avec `ordinaryEventChance`, puis choisit au poids parmi les événements
 *      éligibles triés par identifiant (fenêtre, condition, unicité, délai de
 *      réapparition, aucune instance du même événement en attente, acteurs
 *      disponibles).
 * Chaque instance fige ses acteurs (distribution triée, tirage seedé). Un
 * événement informatif applique ses effets aussitôt ; un événement bloquant
 * rejoint la file, triée par priorité décroissante puis par ordre de création.
 *
 * `chooseEvent` n'accepte que la tête de file ; l'instance est retirée en même
 * temps que ses effets sont appliqués, si bien qu'un choix ne peut jamais être
 * appliqué deux fois. Les événements restants sont ensuite revalidés.
 *
 * Effets automatiques (événements et choix) : une ressource ne descend jamais
 * sous zéro, la perte est limitée au disponible et le journal garde la variation
 * réelle. Les coûts d'un choix, eux, doivent être couverts.
 */
import {
	GAUGE_IDS,
	INCUMBENT_VARIABLE,
	POST_VARIABLE,
	PROMISE_VARIABLE,
	RESOURCE_IDS,
	REGIONAL_ANCHOR,
	WORLD_TEMPLATE_VARIABLES,
	type Content,
	type Effect,
	type EventChoice,
	type EventDefinition,
	type ResourceAmount,
	type ResourceId,
	type Resources,
	type WorldTemplateVariable
} from '../content/types.ts';
import type { Turn } from './calendar.ts';
import type { ChooseEventCommand, CommandError, TransitionResult } from './commands.ts';
import { evaluateCondition, type ConditionContext } from './conditions.ts';
import { applyGauge, gaugeKey, resolveEffect } from './effects.ts';
import { createFact, factIssue } from './justice.ts';
import { resolveMediaRef } from './territory.ts';
import { nextFloat, nextInt, type RngState } from './random.ts';
import {
	addRelation,
	completeCastingExists,
	displayName,
	encounterReveal,
	fitsSlot,
	meet,
	revealAll,
	sortedIds
} from './characters.ts';
import { applyPoliticalEffect, oppositionPartyId } from './world.ts';
import { inEras } from './eras.ts';
import { applyCareerEffect, careerEffectIssue, type CareerParts } from './career.ts';
import {
	applyPostEffect,
	bindEventPost,
	postEffectIssue,
	staffLeavesByEvent,
	type PostBinding,
	type PostEffect
} from './staff.ts';
import { applyPromiseEffect, expandPromiseEffects } from './promises.ts';
import { applyFamilyEffect } from './family.ts';
import type {
	Character,
	ChoiceRecord,
	DeathCause,
	EventInstance,
	EventRecord,
	EventsState,
	GameState,
	GaugeChange,
	PlayerState,
	PeopleChange,
	PoliticalChange,
	Relationship,
	ResourceChange,
	ScheduledEvent,
	WorldState
} from './state.ts';

export function eventInstanceId(number: number): string {
	return `event.${number}`;
}

const TEMPLATE_VARIABLE = /\{([a-z][a-z0-9_]*)\}/g;

/** Nom affichable d'un acteur figé : membre de la distribution, parti ou personnage. */
export function actorName(
	id: string | undefined,
	content: Content,
	characters: Readonly<Record<string, Character>>
): string | undefined {
	if (id === undefined) return undefined;
	if (Object.hasOwn(characters, id)) {
		const character = characters[id];
		return character ? displayName(character) : undefined;
	}
	if (Object.hasOwn(content.parties, id)) return content.parties[id]?.name;
	if (Object.hasOwn(content.cast, id)) return content.cast[id]?.name;
	// Promesse concernée par un événement de sujet `promise` (P3-04).
	if (Object.hasOwn(content.promises, id)) return content.promises[id]?.label;
	// Poste concerné par un événement de sujet `post` (P3-12).
	if (Object.hasOwn(content.posts, id)) return content.posts[id]?.label;
	// Quotidien régional du joueur (P3-18).
	if (Object.hasOwn(content.media, id)) return content.media[id]?.name;
	return undefined;
}

/** Remplace `{role}` par le nom de l'acteur ; les textes sont validés au chargement. */
export function renderTemplate(
	text: string,
	actors: Readonly<Record<string, string>>,
	content: Content,
	characters: Readonly<Record<string, Character>>
): string {
	return text.replace(
		TEMPLATE_VARIABLE,
		(match, role: string) =>
			actorName(actors[role], content, characters) ??
			// Poste vacant (P3-12) : le choix de remplacement reste lisible, et indisponible.
			(role === INCUMBENT_VARIABLE ? 'le titulaire' : match)
	);
}

const WORLD_VARIABLES = new Set<string>(WORLD_TEMPLATE_VARIABLES);

/** Variables du monde citées par les textes d'un événement. */
function worldVariablesOf(definition: EventDefinition): WorldTemplateVariable[] {
	const texts = [definition.title, definition.text];
	if (definition.blocking) {
		for (const choice of definition.choices)
			texts.push(choice.label, ...choice.hints, ...(choice.outcome ?? []));
	}
	const found = new Set<WorldTemplateVariable>();
	for (const text of texts) {
		for (const match of text.matchAll(TEMPLATE_VARIABLE)) {
			const name = match[1] ?? '';
			if (WORLD_VARIABLES.has(name)) found.add(name as WorldTemplateVariable);
		}
	}
	return [...found].sort();
}

/**
 * Fige les variables du monde d'une instance (partis et dirigeants du moment).
 * Une suite conserve les valeurs héritées de l'événement d'origine.
 */
function bindWorldVariables(
	definition: EventDefinition,
	inherited: Readonly<Record<string, string>>,
	player: PlayerState,
	world: WorldState,
	content: Content
): Record<string, string> | null {
	const bound: Record<string, string> = {};
	for (const variable of worldVariablesOf(definition)) {
		const kept = inherited[variable];
		if (kept !== undefined) {
			bound[variable] = kept;
			continue;
		}
		if (variable === 'regional_media') {
			bound[variable] = resolveMediaRef(REGIONAL_ANCHOR, player.territory.regionId, content);
			continue;
		}
		let partyId: string | null;
		switch (variable) {
			case 'governing_party':
			case 'governing_leader':
				partyId = world.governingPartyId;
				break;
			case 'opposition_party':
			case 'opposition_leader':
				partyId = oppositionPartyId(world, content);
				break;
			case 'player_party':
			case 'player_party_leader':
				partyId = player.partyId;
				break;
		}
		if (partyId === null) return null;
		const value = variable.endsWith('_leader') ? world.parties[partyId]?.leaderId : partyId;
		if (value === undefined) return null;
		bound[variable] = value;
	}
	return bound;
}

// ---------------------------------------------------------------------------
// Effets automatiques
// ---------------------------------------------------------------------------

/** Parties de l'état modifiables par des effets automatiques. */
interface EffectParts {
	readonly resources: Resources;
	readonly player: PlayerState;
	readonly world: WorldState;
	readonly characters: Readonly<Record<string, Character>>;
	readonly relationships: Readonly<Record<string, Relationship>>;
	readonly career: CareerParts;
	/** Collaborateurs et présélections (P2-05). */
	readonly staff: GameState['staff'];
	readonly shortlists: GameState['shortlists'];
	/** Registre des faits (P3-01). */
	readonly facts: GameState['facts'];
	readonly rng: RngState;
}

interface EffectOutcome extends EffectParts {
	readonly changes: readonly ResourceChange[];
	readonly gauges: readonly GaugeChange[];
	readonly politics: readonly PoliticalChange[];
	readonly people: readonly PeopleChange[];
}

/** Parties de l'état lues par les conditions mais jamais modifiées par un effet automatique. */
type FixedContext = Pick<ConditionContext, 'upgrades' | 'cases'>;

/** Poste lié à l'instance (sujet `post`) et acteur visé par un effet de poste (P3-12). */
function postBinding(effect: PostEffect, actors: Readonly<Record<string, string>>): PostBinding {
	return {
		postId: actors[POST_VARIABLE] ?? null,
		incumbentId: actors[INCUMBENT_VARIABLE] ?? null,
		actorId: actors[effect.role] ?? null
	};
}

function applyAutomaticEffects(
	effects: readonly Effect[],
	costs: readonly ResourceAmount[],
	parts: EffectParts,
	actors: Readonly<Record<string, string>>,
	eventId: string,
	turn: Turn,
	fixed: FixedContext,
	content: Content
): EffectOutcome {
	const current: Record<ResourceId, number> = { ...parts.resources };
	let { player, world, characters, relationships, career, staff, shortlists, facts, rng } = parts;
	const context = (): ConditionContext => ({
		turn,
		player,
		resources: current,
		upgrades: fixed.upgrades,
		world,
		mandates: career.mandates,
		campaigns: career.campaigns,
		institutions: career.institutions,
		staff,
		facts,
		cases: fixed.cases,
		promises: career.promises
	});
	const politics: PoliticalChange[] = [];
	const people: PeopleChange[] = [];
	const deltas = new Map<ResourceId, number>();
	const gaugeDeltas = new Map<GaugeChange['gauge'], number>();

	const addResource = (resource: ResourceId, delta: number): void => {
		const next = Math.max(0, current[resource] + delta);
		const applied = next - current[resource];
		current[resource] = next;
		deltas.set(resource, (deltas.get(resource) ?? 0) + applied);
	};

	for (const cost of costs) addResource(cost.resource, -cost.amount);
	// Promesse concernée (événement de sujet `promise`) : un renoncement en entraîne les effets.
	const promiseTarget = actors[PROMISE_VARIABLE] ?? null;
	for (const effect of expandPromiseEffects(effects, promiseTarget, career.promises, content)) {
		const resolved = resolveEffect(effect, rng);
		rng = resolved.rng;
		if (resolved.kind === 'resource') {
			addResource(resolved.resource, resolved.delta);
		} else if (resolved.kind === 'politics') {
			const outcome = applyPoliticalEffect(resolved.effect, player, world, turn, null, content);
			player = outcome.player;
			world = outcome.world;
			politics.push(...outcome.changes);
		} else if (resolved.kind === 'people') {
			// Un acteur parti entre-temps n'est plus concerné.
			const character = characters[actors[resolved.effect.role] ?? ''];
			if (!character || character.status !== 'active') continue;
			if (resolved.effect.op === 'staffLeaves') {
				const outcome = staffLeavesByEvent(
					{ staff, shortlists, characters, relationships },
					character.id,
					turn
				);
				staff = outcome.parts.staff;
				politics.push(...outcome.changes);
			} else if (resolved.effect.op === 'addRelation') {
				const memory =
					resolved.effect.memory === undefined
						? null
						: renderTemplate(resolved.effect.memory, actors, content, characters);
				const outcome = addRelation(
					relationships,
					character,
					resolved.effect.value,
					memory,
					turn,
					content
				);
				relationships = outcome.relationships;
				people.push(...outcome.changes);
			} else {
				const outcome = revealAll(character);
				characters = { ...characters, [character.id]: outcome.character };
				people.push(...outcome.changes);
			}
		} else if (resolved.kind === 'career') {
			const outcome = applyCareerEffect(resolved.effect, career, turn, null, content, player);
			career = outcome.parts;
			politics.push(...outcome.changes);
		} else if (resolved.kind === 'family') {
			const outcome = applyFamilyEffect(
				resolved.effect,
				{ player, characters, relationships },
				turn,
				rng,
				content
			);
			({ player, characters, relationships } = outcome.parts);
			rng = outcome.rng;
			politics.push(...outcome.changes);
		} else if (resolved.kind === 'staffAction') {
			throw new Error(`Embauche ou renvoi hors du plan : ${resolved.effect.op}`);
		} else if (resolved.kind === 'release') {
			throw new Error('Départ d’un élément de l’organisation hors du plan.');
		} else if (resolved.kind === 'lifestyle') {
			player = { ...player, lifestyle: resolved.effect.lifestyle };
		} else if (resolved.kind === 'fact') {
			// Garde du registre (P3-12) : sans la capacité exigée, aucun fait n'est inscrit.
			if (factIssue(resolved.effect, context(), actors, content) !== null) continue;
			const fact = createFact(resolved.effect, facts, actors, eventId, turn);
			facts = [...facts, fact];
			politics.push({ kind: 'fact', factId: fact.factId, offenseId: fact.offenseId });
		} else if (resolved.kind === 'post') {
			const outcome = applyPostEffect(
				resolved.effect,
				postBinding(resolved.effect, actors),
				{ staff, shortlists, characters, relationships },
				turn,
				context(),
				content
			);
			({ staff, shortlists, characters, relationships } = outcome.parts);
			politics.push(...outcome.changes);
		} else if (resolved.kind === 'promise') {
			const outcome = applyPromiseEffect(resolved.effect, career, turn, promiseTarget, content);
			career = outcome.parts;
			politics.push(...outcome.changes);
		} else if (resolved.kind === 'reform') {
			throw new Error('Proposition de réforme hors du plan.');
		} else {
			const key = gaugeKey(resolved.gauge);
			const { value, applied } = applyGauge(player[key], resolved.delta);
			player = { ...player, [key]: value };
			gaugeDeltas.set(resolved.gauge, (gaugeDeltas.get(resolved.gauge) ?? 0) + applied);
		}
	}

	return {
		resources: current,
		player,
		world,
		characters,
		relationships,
		career,
		staff,
		shortlists,
		facts,
		rng,
		politics,
		people,
		changes: RESOURCE_IDS.flatMap((resource) => {
			const delta = deltas.get(resource) ?? 0;
			return delta === 0 ? [] : [{ resource, delta }];
		}),
		gauges: GAUGE_IDS.flatMap((gauge) => {
			const delta = gaugeDeltas.get(gauge) ?? 0;
			return delta === 0 ? [] : [{ gauge, delta }];
		})
	};
}

/** Acteurs de rôles (hors variables du monde) d'une instance, dans l'ordre des rôles. */
function slotActors(
	definition: EventDefinition,
	actors: Readonly<Record<string, string>>
): string[] {
	return definition.actors.flatMap((slot) => {
		const id = actors[slot.role];
		return id === undefined ? [] : [id];
	});
}

// ---------------------------------------------------------------------------
// Éligibilité et acteurs
// ---------------------------------------------------------------------------

function inWindow(definition: EventDefinition, turn: Turn): boolean {
	return (
		(definition.availableFromTurn === undefined || turn >= definition.availableFromTurn) &&
		(definition.availableUntilTurn === undefined || turn <= definition.availableUntilTurn)
	);
}

function conditionHolds(definition: EventDefinition, context: ConditionContext): boolean {
	return definition.when === undefined || evaluateCondition(context, definition.when);
}

/** Personnages actifs et relations : vivier des acteurs d'événements. */
interface CastPool {
	readonly characters: Readonly<Record<string, Character>>;
	readonly relationships: Readonly<Record<string, Relationship>>;
}

/** Acteurs possibles d'un rôle, dans l'ordre stable des identifiants. */
function candidatesFor(slot: EventDefinition['actors'][number], pool: CastPool): string[] {
	return sortedIds(pool.characters).filter((id) => {
		const character = pool.characters[id];
		return character !== undefined && fitsSlot(character, slot, pool.relationships);
	});
}

/** Une distribution complète existe-t-elle ? (recherche avec retour arrière, sans tirage) */
function actorsAvailable(definition: EventDefinition, pool: CastPool): boolean {
	return completeCastingExists(definition.actors.map((slot) => candidatesFor(slot, pool)));
}

/**
 * Pourvoit chaque rôle dans l'ordre : un acteur hérité est gardé s'il convient
 * encore, sinon un candidat est tiré parmi ceux qui laissent une distribution
 * complète possible pour les rôles suivants. Aucun rôle ne peut donc échouer
 * faute d'acteur à cause d'un choix antérieur malheureux.
 */
function resolveActors(
	definition: EventDefinition,
	inherited: Readonly<Record<string, string>>,
	rng: RngState,
	pool: CastPool
): { actors: Record<string, string>; rng: RngState } | null {
	const lists = definition.actors.map((slot) => candidatesFor(slot, pool));
	const actors: Record<string, string> = {};
	const used = new Set<string>();
	let currentRng = rng;
	for (const [index, slot] of definition.actors.entries()) {
		const rest = lists.slice(index + 1);
		const options = (lists[index] ?? []).filter(
			(id) => !used.has(id) && completeCastingExists(rest, new Set([...used, id]))
		);
		const kept = inherited[slot.role];
		let chosen: string | undefined;
		if (kept !== undefined && options.includes(kept)) {
			chosen = kept;
		} else if (options.length > 0) {
			const draw = nextInt(currentRng, 0, options.length - 1);
			currentRng = draw.rng;
			chosen = options[draw.value];
		}
		if (chosen === undefined) return null;
		actors[slot.role] = chosen;
		used.add(chosen);
	}
	return { actors, rng: currentRng };
}

// ---------------------------------------------------------------------------
// Frontière du trimestre
// ---------------------------------------------------------------------------

export interface FrontierInput {
	/** Nouveau trimestre (T+1). */
	readonly turn: Turn;
	readonly player: PlayerState;
	readonly resources: Resources;
	/** Améliorations possédées, lisibles par les conditions (`upgrades.owned`). */
	readonly upgrades: GameState['upgrades'];
	readonly rng: RngState;
	readonly nextInstanceNumber: number;
	readonly events: EventsState;
	readonly world: WorldState;
	readonly characters: Readonly<Record<string, Character>>;
	readonly relationships: Readonly<Record<string, Relationship>>;
	readonly career: CareerParts;
	readonly staff: GameState['staff'];
	readonly shortlists: GameState['shortlists'];
	readonly facts: GameState['facts'];
	/** Dossiers judiciaires, lisibles par les conditions (P3-01). */
	readonly cases: GameState['cases'];
}

export interface FrontierResult {
	readonly player: PlayerState;
	readonly resources: Resources;
	readonly world: WorldState;
	readonly characters: Readonly<Record<string, Character>>;
	readonly relationships: Readonly<Record<string, Relationship>>;
	readonly career: CareerParts;
	readonly staff: GameState['staff'];
	readonly shortlists: GameState['shortlists'];
	readonly facts: GameState['facts'];
	readonly rng: RngState;
	readonly nextInstanceNumber: number;
	readonly events: EventsState;
	readonly records: readonly EventRecord[];
	readonly deathCause: DeathCause | null;
}

export function resolveEventFrontier(input: FrontierInput, content: Content): FrontierResult {
	let {
		player,
		resources,
		rng,
		nextInstanceNumber,
		world,
		characters,
		relationships,
		career,
		staff,
		shortlists,
		facts
	} = input;
	const pool = (): CastPool => ({ characters, relationships });
	const turn = input.turn;
	const pending: EventInstance[] = [...input.events.pending];
	const occurrences: Record<string, { count: number; lastTurn: Turn }> = {
		...input.events.occurrences
	};
	const records: EventRecord[] = [];
	// Modifié dans `create` : objet mutable pour que l'analyse de flux suive la valeur.
	const death: { cause: DeathCause | null } = { cause: null };
	const context = (): ConditionContext => ({
		turn,
		player,
		resources,
		upgrades: input.upgrades,
		world,
		mandates: career.mandates,
		campaigns: career.campaigns,
		staff,
		institutions: career.institutions,
		facts,
		cases: input.cases,
		promises: career.promises
	});

	/**
	 * Poste d'un événement de sujet `post` (P3-12) : hérité d'une origine qui en
	 * traitait, sinon lié à la création ; `null` si aucun poste n'est débloqué.
	 */
	const postVariables = (
		definition: EventDefinition,
		inherited: Readonly<Record<string, string>>
	): Record<string, string> | null => {
		if (definition.subject !== 'post') return {};
		const kept = inherited[POST_VARIABLE];
		if (kept !== undefined) {
			const incumbent = inherited[INCUMBENT_VARIABLE];
			return { [POST_VARIABLE]: kept, ...(incumbent ? { [INCUMBENT_VARIABLE]: incumbent } : {}) };
		}
		const binding = bindEventPost(staff, context(), content);
		if (!binding) return null;
		return {
			[POST_VARIABLE]: binding.postId,
			...(binding.incumbentId ? { [INCUMBENT_VARIABLE]: binding.incumbentId } : {})
		};
	};

	const create = (definition: EventDefinition, actors: Record<string, string>): void => {
		const instance: EventInstance = {
			instanceId: eventInstanceId(nextInstanceNumber),
			eventId: definition.id,
			turn,
			actors
		};
		nextInstanceNumber += 1;
		const previous = occurrences[definition.id];
		occurrences[definition.id] = { count: (previous?.count ?? 0) + 1, lastTurn: turn };

		// Les acteurs de l'événement deviennent des personnages rencontrés.
		const met: PeopleChange[] = [];
		for (const id of slotActors(definition, actors)) {
			const outcome = meet(relationships, id, turn);
			relationships = outcome.relationships;
			if (outcome.change) met.push(outcome.change);
		}

		if (definition.blocking) {
			pending.push(instance);
			records.push({
				eventId: definition.id,
				instanceId: instance.instanceId,
				outcome: 'queued',
				actors,
				changes: [],
				gauges: [],
				politics: [],
				people: met,
				reason: null
			});
			return;
		}
		const outcome = applyAutomaticEffects(
			definition.effects,
			[],
			{
				resources,
				player,
				world,
				characters,
				relationships,
				career,
				staff,
				shortlists,
				facts,
				rng
			},
			actors,
			definition.id,
			turn,
			{ upgrades: input.upgrades, cases: input.cases },
			content
		);
		({
			resources,
			player,
			rng,
			world,
			characters,
			relationships,
			career,
			staff,
			shortlists,
			facts
		} = outcome);
		records.push({
			eventId: definition.id,
			instanceId: instance.instanceId,
			outcome: 'applied',
			actors,
			changes: outcome.changes,
			gauges: outcome.gauges,
			politics: outcome.politics,
			people: [...met, ...outcome.people],
			reason: null
		});
		if (player.health <= 0) death.cause = 'health_failure';
	};

	const cancel = (scheduled: ScheduledEvent, reason: string): void => {
		records.push({
			eventId: scheduled.eventId,
			instanceId: null,
			outcome: 'cancelled',
			actors: scheduled.actors,
			changes: [],
			gauges: [],
			politics: [],
			people: [],
			reason
		});
	};

	// 1. Suites différées dues.
	const due = input.events.scheduled.filter((scheduled) => scheduled.dueTurn <= turn);
	const scheduled = input.events.scheduled.filter((entry) => entry.dueTurn > turn);
	for (const entry of due) {
		if (death.cause) break;
		const definition = content.events[entry.eventId];
		if (!definition) throw new Error(`Événement inconnu : ${entry.eventId}`);
		if (!inWindow(definition, turn) || !conditionHolds(definition, context())) {
			cancel(entry, 'Les conditions de cette suite ne sont plus réunies.');
			continue;
		}
		// Un événement de sujet `promise` reçoit la promesse concernée de son origine.
		const promise = entry.actors[PROMISE_VARIABLE];
		if (definition.subject === 'promise' && promise === undefined) {
			cancel(entry, 'Cette suite ne concerne plus aucune promesse.');
			continue;
		}
		const resolved = resolveActors(definition, entry.actors, rng, pool());
		const bound = bindWorldVariables(definition, entry.actors, player, world, content);
		if (!resolved || !bound) {
			cancel(entry, 'Aucun acteur disponible pour cette suite.');
			continue;
		}
		const post = postVariables(definition, entry.actors);
		if (!post) {
			cancel(entry, 'Aucun poste d’entourage n’est concerné.');
			continue;
		}
		rng = resolved.rng;
		create(definition, {
			...resolved.actors,
			...bound,
			...post,
			...(definition.subject === 'promise' && promise !== undefined
				? { [PROMISE_VARIABLE]: promise }
				: {})
		});
	}

	// 2. Tirages ordinaires.
	const drawnThisTurn = new Set<string>();
	for (
		let draw = 0;
		draw < content.balance.events.ordinaryDrawsPerTurn && !death.cause;
		draw += 1
	) {
		if (content.balance.events.ordinaryEventChance <= 0) break;
		const roll = nextFloat(rng);
		rng = roll.rng;
		if (roll.value >= content.balance.events.ordinaryEventChance) continue;

		const candidates = content.eventIds.flatMap((id) => {
			const definition = content.events[id];
			if (!definition || definition.trigger !== 'random' || drawnThisTurn.has(id)) return [];
			const occurrence = occurrences[id];
			if (definition.unique && occurrence) return [];
			if (occurrence && turn - occurrence.lastTurn < definition.cooldownTurns) return [];
			// Répétition contrôlée (P3-07) : plafond d'occurrences par carrière.
			const cap = definition.maxOccurrences ?? content.balance.events.maxOccurrences;
			if (occurrence && cap > 0 && occurrence.count >= cap) return [];
			if (pending.some((instance) => instance.eventId === id)) return [];
			// Époques (P3-07) : un tirage ordinaire respecte l'époque ; une suite déjà programmée, non.
			if (!inEras(definition.eras, turn, content)) return [];
			if (!inWindow(definition, turn) || !conditionHolds(definition, context())) return [];
			if (!actorsAvailable(definition, pool())) return [];
			if (postVariables(definition, {}) === null) return [];
			return [definition];
		});
		// Chaque occurrence passée réduit le poids (P3-07) ; sans pénalité, le poids du catalogue.
		const penalty = content.balance.events.repeatPenaltyPercent;
		const weightOf = (definition: EventDefinition): number => {
			const count = occurrences[definition.id]?.count ?? 0;
			return penalty === 0 || count === 0
				? definition.weight
				: (definition.weight * 100) / (100 + penalty * count);
		};
		const totalWeight = candidates.reduce((total, definition) => total + weightOf(definition), 0);
		if (totalWeight <= 0) continue;

		const pick = nextFloat(rng);
		rng = pick.rng;
		let threshold = pick.value * totalWeight;
		const chosen =
			candidates.find((definition) => {
				threshold -= weightOf(definition);
				return threshold < 0;
			}) ?? candidates[candidates.length - 1];
		if (!chosen) continue;

		const resolved = resolveActors(chosen, {}, rng, pool());
		const bound = bindWorldVariables(chosen, {}, player, world, content);
		const post = postVariables(chosen, {});
		if (!resolved || !bound || !post) continue;
		rng = resolved.rng;
		drawnThisTurn.add(chosen.id);
		create(chosen, { ...resolved.actors, ...bound, ...post });
	}

	// File des événements bloquants : priorité décroissante, puis ordre de création.
	const priorityOf = (instance: EventInstance): number =>
		content.events[instance.eventId]?.priority ?? 0;
	const ordered = pending
		.map((instance, index) => ({ instance, index }))
		.sort((a, b) => priorityOf(b.instance) - priorityOf(a.instance) || a.index - b.index)
		.map(({ instance }) => instance);

	return {
		player,
		resources,
		world,
		characters,
		relationships,
		career,
		staff,
		shortlists,
		facts,
		rng,
		nextInstanceNumber,
		events: {
			pending: death.cause ? [] : ordered,
			scheduled: death.cause ? [] : scheduled,
			occurrences
		},
		records,
		deathCause: death.cause
	};
}

// ---------------------------------------------------------------------------
// Choix
// ---------------------------------------------------------------------------

export interface ChoiceAvailability {
	readonly available: boolean;
	readonly reason: string | null;
}

export function choiceAvailability(
	choice: EventChoice,
	state: GameState,
	content?: Content,
	actors: Readonly<Record<string, string>> = {}
): ChoiceAvailability {
	if (choice.requires && !evaluateCondition(state, choice.requires)) {
		return {
			available: false,
			reason: choice.unavailableReason ?? 'Ce choix n’est pas disponible.'
		};
	}
	const uncovered = choice.costs.find((cost) => state.resources[cost.resource] < cost.amount);
	if (uncovered) {
		return { available: false, reason: 'Ressources insuffisantes pour ce choix.' };
	}
	// Un mandat proposé doit respecter les règles du cumul en vigueur.
	const career: CareerParts = {
		mandates: state.mandates,
		ballots: state.ballots,
		campaigns: state.campaigns,
		institutions: state.institutions,
		promises: state.promises
	};
	for (const effect of choice.effects) {
		const issue = careerEffectIssue(effect, career, content ?? null, state.player, state.turn);
		if (issue) return { available: false, reason: issue };
	}
	if (!content) return { available: true, reason: null };
	// Postes et registre (P3-12), dans l'ordre des effets : une embauche du même
	// choix rend possible l'emploi fictif qui la suit.
	let entourage = {
		staff: state.staff,
		shortlists: state.shortlists,
		characters: state.characters,
		relationships: state.relationships
	};
	for (const effect of choice.effects) {
		if (effect.op === 'hireActor' || effect.op === 'shortlistActor') {
			const binding = postBinding(effect, actors);
			const issue = postEffectIssue(effect, binding, entourage, state, content);
			if (issue) return { available: false, reason: issue };
			entourage = applyPostEffect(effect, binding, entourage, state.turn, state, content).parts;
		} else if (effect.op === 'recordFact') {
			const issue = factIssue(effect, { ...state, staff: entourage.staff }, actors, content);
			if (issue) return { available: false, reason: issue };
		}
	}
	return { available: true, reason: null };
}

function reject(state: GameState, code: CommandError['code'], message: string): TransitionResult {
	return { ok: false, state, error: { code, message, issues: [] } };
}

export function chooseEvent(
	state: GameState,
	command: ChooseEventCommand,
	content: Content
): TransitionResult {
	if (state.phase === 'ended') return reject(state, 'game_ended', 'La carrière est terminée.');
	if (state.phase !== 'decision') {
		return reject(state, 'no_pending_decision', 'Aucune décision n’est attendue.');
	}
	const position = state.events.pending.findIndex(
		(instance) => instance.instanceId === command.instanceId
	);
	if (position < 0) {
		return reject(state, 'unknown_event_instance', 'Cet événement n’attend pas de décision.');
	}
	if (position > 0) {
		return reject(state, 'not_next_event', 'Un autre événement doit être traité avant celui-ci.');
	}
	const instance = state.events.pending[0]!;
	const definition = content.events[instance.eventId];
	if (!definition || !definition.blocking) {
		throw new Error(`Événement bloquant inconnu : ${instance.eventId}`);
	}
	const choice = definition.choices.find((candidate) => candidate.id === command.choiceId);
	if (!choice) return reject(state, 'unknown_choice', 'Ce choix n’existe pas pour cet événement.');
	const availability = choiceAvailability(choice, state, content, instance.actors);
	if (!availability.available) {
		return reject(state, 'choice_unavailable', availability.reason ?? 'Choix indisponible.');
	}

	const applied = applyAutomaticEffects(
		choice.effects,
		choice.costs,
		{
			resources: state.resources,
			player: state.player,
			world: state.world,
			characters: state.characters,
			relationships: state.relationships,
			career: {
				mandates: state.mandates,
				ballots: state.ballots,
				campaigns: state.campaigns,
				institutions: state.institutions,
				promises: state.promises
			},
			staff: state.staff,
			shortlists: state.shortlists,
			facts: state.facts,
			rng: state.rng
		},
		instance.actors,
		instance.eventId,
		state.turn,
		{ upgrades: state.upgrades, cases: state.cases },
		content
	);
	// Rencontre : chaque acteur encore actif peut laisser voir un trait caché.
	let characters = applied.characters;
	let rng = applied.rng;
	const people: PeopleChange[] = [...applied.people];
	for (const id of slotActors(definition, instance.actors)) {
		const character = characters[id];
		if (!character || character.status !== 'active') continue;
		const encounter = encounterReveal(character, rng, content);
		rng = encounter.rng;
		characters = { ...characters, [id]: encounter.character };
		people.push(...encounter.changes);
	}
	const outcome = { ...applied, characters, rng, people };
	const scheduledEntry: ScheduledEvent | null = choice.followUp
		? {
				eventId: choice.followUp.eventId,
				dueTurn: state.turn + choice.followUp.delayTurns,
				sourceInstanceId: instance.instanceId,
				actors: instance.actors
			}
		: null;

	const deathCause: DeathCause | null = outcome.player.health <= 0 ? 'health_failure' : null;
	const afterContext: ConditionContext = {
		turn: state.turn,
		player: outcome.player,
		resources: outcome.resources,
		upgrades: state.upgrades,
		world: outcome.world,
		mandates: outcome.career.mandates,
		campaigns: outcome.career.campaigns,
		institutions: outcome.career.institutions,
		staff: outcome.staff,
		facts: outcome.facts,
		cases: state.cases,
		promises: outcome.career.promises
	};
	const cancelled: { instanceId: string; reason: string }[] = [];
	const remaining = state.events.pending.slice(1).filter((other) => {
		const otherDefinition = content.events[other.eventId];
		if (deathCause) {
			cancelled.push({ instanceId: other.instanceId, reason: 'La carrière est terminée.' });
			return false;
		}
		if (!otherDefinition || !conditionHolds(otherDefinition, afterContext)) {
			cancelled.push({
				instanceId: other.instanceId,
				reason: 'Les conditions de cet événement ne sont plus réunies.'
			});
			return false;
		}
		return true;
	});

	const record: ChoiceRecord = {
		type: 'event.resolved',
		turn: state.turn,
		instanceId: instance.instanceId,
		eventId: instance.eventId,
		choiceId: choice.id,
		changes: outcome.changes,
		gauges: outcome.gauges,
		politics: outcome.politics,
		people: outcome.people,
		scheduled: scheduledEntry,
		cancelled,
		deathCause
	};

	return {
		ok: true,
		state: {
			...state,
			resources: outcome.resources,
			player: outcome.player,
			world: outcome.world,
			characters: outcome.characters,
			relationships: outcome.relationships,
			mandates: outcome.career.mandates,
			ballots: outcome.career.ballots,
			campaigns: outcome.career.campaigns,
			institutions: outcome.career.institutions,
			promises: outcome.career.promises,
			staff: outcome.staff,
			shortlists: outcome.shortlists,
			facts: outcome.facts,
			rng: outcome.rng,
			phase: deathCause ? 'ended' : remaining.length > 0 ? 'decision' : 'planning',
			end: deathCause ? { turn: state.turn, reason: 'death', cause: deathCause } : null,
			events: {
				...state.events,
				pending: remaining,
				scheduled: deathCause
					? []
					: scheduledEntry
						? [...state.events.scheduled, scheduledEntry]
						: state.events.scheduled
			},
			history: [...state.history, record]
		},
		log: [record]
	};
}

// ---------------------------------------------------------------------------
// Vue publique de l'événement en attente
// ---------------------------------------------------------------------------

export interface EventChoiceView {
	readonly id: string;
	readonly label: string;
	readonly hints: readonly string[];
	readonly costs: readonly ResourceAmount[];
	readonly available: boolean;
	readonly reason: string | null;
}

export interface PendingEventView {
	readonly instanceId: string;
	readonly eventId: string;
	readonly category: string;
	readonly title: string;
	readonly text: string;
	readonly actors: readonly { readonly role: string; readonly name: string }[];
	readonly choices: readonly EventChoiceView[];
	/** Nombre d'événements encore en attente après celui-ci. */
	readonly remaining: number;
}

/**
 * Événement à traiter, textes résolus. N'expose ni les effets ni les suites :
 * seulement les coûts certains, les tendances rédigées et la disponibilité.
 */
export function describePendingEvent(state: GameState, content: Content): PendingEventView | null {
	const instance = state.events.pending[0];
	if (!instance) return null;
	const definition = content.events[instance.eventId];
	if (!definition || !definition.blocking) return null;
	const render = (text: string): string =>
		renderTemplate(text, instance.actors, content, state.characters);
	return {
		instanceId: instance.instanceId,
		eventId: instance.eventId,
		category: definition.category,
		title: render(definition.title),
		text: render(definition.text),
		actors: definition.actors.map((slot) => ({
			role: slot.role,
			name: actorName(instance.actors[slot.role], content, state.characters) ?? slot.role
		})),
		choices: definition.choices.map((choice) => ({
			id: choice.id,
			label: render(choice.label),
			hints: choice.hints.map(render),
			costs: choice.costs,
			...choiceAvailability(choice, state, content, instance.actors)
		})),
		remaining: state.events.pending.length - 1
	};
}
