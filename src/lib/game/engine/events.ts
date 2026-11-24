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
	RESOURCE_IDS,
	type Content,
	type Effect,
	type EventChoice,
	type EventDefinition,
	type ResourceAmount,
	type ResourceId,
	type Resources
} from '../content/types.ts';
import type { Turn } from './calendar.ts';
import type { ChooseEventCommand, CommandError, TransitionResult } from './commands.ts';
import { evaluateCondition, type ConditionContext } from './conditions.ts';
import { applyGauge, resolveEffect } from './effects.ts';
import { nextFloat, nextInt, type RngState } from './random.ts';
import type {
	ChoiceRecord,
	DeathCause,
	EventInstance,
	EventRecord,
	EventsState,
	GameState,
	GaugeChange,
	PlayerState,
	ResourceChange,
	ScheduledEvent
} from './state.ts';

export function eventInstanceId(number: number): string {
	return `event.${number}`;
}

const TEMPLATE_VARIABLE = /\{([a-z][a-z0-9_]*)\}/g;

/** Remplace `{role}` par le nom de l'acteur ; les textes sont validés au chargement. */
export function renderTemplate(
	text: string,
	actors: Readonly<Record<string, string>>,
	content: Content
): string {
	return text.replace(TEMPLATE_VARIABLE, (match, role: string) => {
		const castId = actors[role];
		const member = castId ? content.cast[castId] : undefined;
		return member ? member.name : match;
	});
}

// ---------------------------------------------------------------------------
// Effets automatiques
// ---------------------------------------------------------------------------

interface EffectOutcome {
	readonly resources: Resources;
	readonly player: PlayerState;
	readonly rng: RngState;
	readonly changes: readonly ResourceChange[];
	readonly gauges: readonly GaugeChange[];
}

function applyAutomaticEffects(
	effects: readonly Effect[],
	costs: readonly ResourceAmount[],
	resources: Resources,
	player: PlayerState,
	rng: RngState
): EffectOutcome {
	const current: Record<ResourceId, number> = { ...resources };
	let currentPlayer = player;
	let currentRng = rng;
	const deltas = new Map<ResourceId, number>();
	const gaugeDeltas = new Map<GaugeChange['gauge'], number>();

	const addResource = (resource: ResourceId, delta: number): void => {
		const next = Math.max(0, current[resource] + delta);
		const applied = next - current[resource];
		current[resource] = next;
		deltas.set(resource, (deltas.get(resource) ?? 0) + applied);
	};

	for (const cost of costs) addResource(cost.resource, -cost.amount);
	for (const effect of effects) {
		const resolved = resolveEffect(effect, currentRng);
		currentRng = resolved.rng;
		if (resolved.kind === 'resource') {
			addResource(resolved.resource, resolved.delta);
		} else {
			const key = resolved.gauge === 'player.health' ? 'health' : 'stress';
			const { value, applied } = applyGauge(currentPlayer[key], resolved.delta);
			currentPlayer = { ...currentPlayer, [key]: value };
			gaugeDeltas.set(resolved.gauge, (gaugeDeltas.get(resolved.gauge) ?? 0) + applied);
		}
	}

	return {
		resources: current,
		player: currentPlayer,
		rng: currentRng,
		changes: RESOURCE_IDS.flatMap((resource) => {
			const delta = deltas.get(resource) ?? 0;
			return delta === 0 ? [] : [{ resource, delta }];
		}),
		gauges: (['player.health', 'player.stress'] as const).flatMap((gauge) => {
			const delta = gaugeDeltas.get(gauge) ?? 0;
			return delta === 0 ? [] : [{ gauge, delta }];
		})
	};
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

/** Acteurs possibles d'un rôle, dans l'ordre stable de la distribution. */
function candidatesFor(
	tags: readonly string[],
	used: ReadonlySet<string>,
	content: Content
): string[] {
	return content.castIds.filter((id) => {
		const member = content.cast[id];
		return member !== undefined && !used.has(id) && tags.every((tag) => member.tags.includes(tag));
	});
}

/** Vérifie sans tirage qu'une distribution complète existe (affectation gloutonne). */
function actorsAvailable(definition: EventDefinition, content: Content): boolean {
	const used = new Set<string>();
	for (const slot of definition.actors) {
		const [first] = candidatesFor(slot.tags, used, content);
		if (first === undefined) return false;
		used.add(first);
	}
	return true;
}

function resolveActors(
	definition: EventDefinition,
	inherited: Readonly<Record<string, string>>,
	rng: RngState,
	content: Content
): { actors: Record<string, string>; rng: RngState } | null {
	const actors: Record<string, string> = {};
	const used = new Set<string>();
	let currentRng = rng;
	for (const slot of definition.actors) {
		const candidates = candidatesFor(slot.tags, used, content);
		const kept = inherited[slot.role];
		let chosen: string | undefined;
		if (kept !== undefined && candidates.includes(kept)) {
			chosen = kept;
		} else if (candidates.length > 0) {
			const draw = nextInt(currentRng, 0, candidates.length - 1);
			currentRng = draw.rng;
			chosen = candidates[draw.value];
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
	readonly rng: RngState;
	readonly nextInstanceNumber: number;
	readonly events: EventsState;
}

export interface FrontierResult {
	readonly player: PlayerState;
	readonly resources: Resources;
	readonly rng: RngState;
	readonly nextInstanceNumber: number;
	readonly events: EventsState;
	readonly records: readonly EventRecord[];
	readonly deathCause: DeathCause | null;
}

export function resolveEventFrontier(input: FrontierInput, content: Content): FrontierResult {
	let { player, resources, rng, nextInstanceNumber } = input;
	const turn = input.turn;
	const pending: EventInstance[] = [...input.events.pending];
	const occurrences: Record<string, { count: number; lastTurn: Turn }> = {
		...input.events.occurrences
	};
	const records: EventRecord[] = [];
	// Modifié dans `create` : objet mutable pour que l'analyse de flux suive la valeur.
	const death: { cause: DeathCause | null } = { cause: null };
	const context = (): ConditionContext => ({ turn, player, resources });

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

		if (definition.blocking) {
			pending.push(instance);
			records.push({
				eventId: definition.id,
				instanceId: instance.instanceId,
				outcome: 'queued',
				actors,
				changes: [],
				gauges: [],
				reason: null
			});
			return;
		}
		const outcome = applyAutomaticEffects(definition.effects, [], resources, player, rng);
		({ resources, player, rng } = outcome);
		records.push({
			eventId: definition.id,
			instanceId: instance.instanceId,
			outcome: 'applied',
			actors,
			changes: outcome.changes,
			gauges: outcome.gauges,
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
		const resolved = resolveActors(definition, entry.actors, rng, content);
		if (!resolved) {
			cancel(entry, 'Aucun acteur disponible pour cette suite.');
			continue;
		}
		rng = resolved.rng;
		create(definition, resolved.actors);
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
			if (pending.some((instance) => instance.eventId === id)) return [];
			if (!inWindow(definition, turn) || !conditionHolds(definition, context())) return [];
			if (!actorsAvailable(definition, content)) return [];
			return [definition];
		});
		const totalWeight = candidates.reduce((total, definition) => total + definition.weight, 0);
		if (totalWeight <= 0) continue;

		const pick = nextFloat(rng);
		rng = pick.rng;
		let threshold = pick.value * totalWeight;
		const chosen =
			candidates.find((definition) => {
				threshold -= definition.weight;
				return threshold < 0;
			}) ?? candidates[candidates.length - 1];
		if (!chosen) continue;

		const resolved = resolveActors(chosen, {}, rng, content);
		if (!resolved) continue;
		rng = resolved.rng;
		drawnThisTurn.add(chosen.id);
		create(chosen, resolved.actors);
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

export function choiceAvailability(choice: EventChoice, state: GameState): ChoiceAvailability {
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
	const availability = choiceAvailability(choice, state);
	if (!availability.available) {
		return reject(state, 'choice_unavailable', availability.reason ?? 'Choix indisponible.');
	}

	const outcome = applyAutomaticEffects(
		choice.effects,
		choice.costs,
		state.resources,
		state.player,
		state.rng
	);
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
		resources: outcome.resources
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
	const render = (text: string): string => renderTemplate(text, instance.actors, content);
	return {
		instanceId: instance.instanceId,
		eventId: instance.eventId,
		category: definition.category,
		title: render(definition.title),
		text: render(definition.text),
		actors: definition.actors.map((slot) => ({
			role: slot.role,
			name: content.cast[instance.actors[slot.role] ?? '']?.name ?? slot.role
		})),
		choices: definition.choices.map((choice) => ({
			id: choice.id,
			label: render(choice.label),
			hints: choice.hints.map(render),
			costs: choice.costs,
			...choiceAvailability(choice, state)
		})),
		remaining: state.events.pending.length - 1
	};
}
