/**
 * Schéma strict d'un état de partie chargé depuis l'extérieur (sauvegarde,
 * import). Typé contre `GameState` : tout écart entre le moteur et ce schéma est
 * une erreur de compilation. Les objets sont stricts (champ inconnu refusé) ;
 * la cohérence (journal, instances, références au catalogue) est ensuite
 * contrôlée par `checkInvariants`.
 */
import { z } from 'zod';
import { GAUGE_IDS, INDICATOR_IDS, RESOURCE_IDS } from '../content/types.ts';
import { RNG_ALGORITHM, STATE_SCHEMA_VERSION, type GameState } from '../engine/index.ts';

const int = z.number().int().refine(Number.isSafeInteger, 'entier sûr attendu');
const text = z.string().max(500);
const id = z.string().min(1).max(120);
const resource = z.enum(RESOURCE_IDS);
const gauge = z.enum(GAUGE_IDS);
const actors = z.record(z.string().max(60), id);
const deathCause = z.enum(['health_failure', 'natural_causes']);

const resourceChange = z.strictObject({ resource, delta: int });
const gaugeChange = z.strictObject({ gauge, delta: int });
const indicator = z.enum(INDICATOR_IDS);
const politicalChange = z.discriminatedUnion('kind', [
	z.strictObject({ kind: z.literal('indicator'), indicator, delta: int }),
	z.strictObject({ kind: z.literal('partyStrength'), partyId: id, delta: int }),
	z.strictObject({ kind: z.literal('joined'), partyId: id }),
	z.strictObject({ kind: z.literal('left'), partyId: id })
]);

const scheduledEvent = z.strictObject({
	eventId: id,
	dueTurn: int,
	sourceInstanceId: id,
	actors
});

const turnEntry = z.strictObject({
	type: z.literal('turn.resolved'),
	turn: int,
	steps: z.array(
		z.strictObject({
			kind: z.enum(['action', 'purchase']),
			id,
			instanceId: id.nullable(),
			changes: z.array(resourceChange),
			gauges: z.array(gaugeChange),
			target: id.nullable(),
			politics: z.array(politicalChange)
		})
	),
	economy: z.strictObject({
		producers: z.array(
			z.strictObject({
				instanceId: id,
				upgradeId: id,
				status: z.enum(['active', 'suspended']),
				changes: z.array(resourceChange)
			})
		),
		changes: z.array(resourceChange)
	}),
	wellbeing: z.strictObject({
		contributions: z.array(
			z.strictObject({
				source: z.enum(['workload', 'recovery', 'high_stress', 'calm', 'ageing']),
				gauge,
				delta: int
			})
		),
		deathCause: deathCause.nullable()
	}),
	world: z
		.strictObject({
			indicators: z.array(z.strictObject({ indicator, delta: int })),
			parties: z.array(z.strictObject({ partyId: id, delta: int })),
			leaderChanges: z.array(
				z.strictObject({
					partyId: id,
					previousLeaderId: id,
					leaderId: id,
					reason: z.enum(['retirement', 'internal_vote'])
				})
			)
		})
		.nullable(),
	events: z.array(
		z.strictObject({
			eventId: id,
			instanceId: id.nullable(),
			outcome: z.enum(['queued', 'applied', 'cancelled']),
			actors,
			changes: z.array(resourceChange),
			gauges: z.array(gaugeChange),
			politics: z.array(politicalChange),
			reason: text.nullable()
		})
	)
});

const choiceEntry = z.strictObject({
	type: z.literal('event.resolved'),
	turn: int,
	instanceId: id,
	eventId: id,
	choiceId: id,
	changes: z.array(resourceChange),
	gauges: z.array(gaugeChange),
	politics: z.array(politicalChange),
	scheduled: scheduledEvent.nullable(),
	cancelled: z.array(z.strictObject({ instanceId: id, reason: text })),
	deathCause: deathCause.nullable()
});

export const gameStateSchema: z.ZodType<GameState> = z.strictObject({
	schemaVersion: z.literal(STATE_SCHEMA_VERSION),
	turn: int,
	rng: z.strictObject({
		seed: z.string(),
		algorithm: z.literal(RNG_ALGORITHM),
		state: int
	}),
	phase: z.enum(['planning', 'decision', 'ended']),
	player: z.strictObject({
		birthTurn: int,
		health: int,
		stress: int,
		partyId: id.nullable(),
		affiliations: z.array(z.strictObject({ partyId: id, fromTurn: int, toTurn: int.nullable() }))
	}),
	resources: z.strictObject({
		influence: int,
		politicalBudgetCents: int,
		personalCashCents: int
	}),
	upgrades: z.array(z.strictObject({ instanceId: id, upgradeId: id, acquiredTurn: int })),
	nextInstanceNumber: int,
	events: z.strictObject({
		pending: z.array(z.strictObject({ instanceId: id, eventId: id, turn: int, actors })),
		scheduled: z.array(scheduledEvent),
		occurrences: z.record(id, z.strictObject({ count: int, lastTurn: int }))
	}),
	world: z.strictObject({
		indicators: z.strictObject({ economy: int, socialClimate: int, stability: int }),
		parties: z.record(id, z.strictObject({ strength: int, leaderId: id })),
		governingPartyId: id
	}),
	characters: z.record(
		id,
		z.strictObject({ id, name: text, birthTurn: int, partyId: id.nullable() })
	),
	history: z.array(z.discriminatedUnion('type', [turnEntry, choiceEntry])),
	end: z.strictObject({ turn: int, reason: z.literal('death'), cause: deathCause }).nullable()
});
