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
const mandateEndReason = z.enum(['term', 'resigned', 'government_change', 'replaced', 'removed']);
const staffLeaveReason = z.enum(['resigned', 'dismissed', 'poached', 'retired', 'died']);
const politicalChange = z.discriminatedUnion('kind', [
	z.strictObject({ kind: z.literal('indicator'), indicator, delta: int }),
	z.strictObject({ kind: z.literal('partyStrength'), partyId: id, delta: int }),
	z.strictObject({ kind: z.literal('joined'), partyId: id }),
	z.strictObject({ kind: z.literal('left'), partyId: id }),
	z.strictObject({ kind: z.literal('support'), groupId: id, delta: int }),
	z.strictObject({ kind: z.literal('mandateStarted'), instanceId: id, mandateId: id }),
	z.strictObject({
		kind: z.literal('mandateEnded'),
		instanceId: id,
		mandateId: id,
		reason: mandateEndReason
	}),
	z.strictObject({ kind: z.literal('earlyElection'), ballotId: id, electionId: id, turn: int }),
	z.strictObject({
		kind: z.literal('candidacy'),
		campaignId: id,
		ballotId: id,
		invested: z.boolean()
	}),
	z.strictObject({ kind: z.literal('preparation'), delta: int }),
	z.strictObject({ kind: z.literal('hired'), characterId: id, postId: id }),
	z.strictObject({
		kind: z.literal('familyJoined'),
		characterId: id,
		relation: z.enum(['partner', 'child'])
	}),
	z.strictObject({ kind: z.literal('separated'), characterId: id }),
	z.strictObject({
		kind: z.literal('staffLeft'),
		characterId: id,
		postId: id,
		reason: staffLeaveReason
	}),
	z.strictObject({ kind: z.literal('fact'), factId: id, offenseId: id })
]);

const peopleChange = z.discriminatedUnion('kind', [
	z.strictObject({ kind: z.literal('met'), characterId: id }),
	z.strictObject({ kind: z.literal('relation'), characterId: id, delta: int }),
	z.strictObject({ kind: z.literal('revealed'), characterId: id, traitId: id })
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
				upgradeId: id,
				active: int,
				suspended: int,
				changes: z.array(resourceChange)
			})
		),
		changes: z.array(resourceChange)
	}),
	mandates: z.strictObject({ changes: z.array(resourceChange), stress: int }),
	family: z
		.strictObject({
			inheritance: int,
			childCosts: int,
			stress: int,
			neglected: z.boolean(),
			widowed: id.nullable()
		})
		.nullable(),
	staff: z
		.strictObject({
			payroll: z.array(resourceChange),
			production: z.array(
				z.strictObject({
					characterId: id,
					missionId: id,
					status: z.enum(['active', 'unpaid']),
					changes: z.array(resourceChange),
					politics: z.array(politicalChange),
					stress: int
				})
			),
			departures: z.array(
				z.strictObject({ characterId: id, postId: id, reason: staffLeaveReason })
			),
			shortlisted: z.array(id)
		})
		.nullable(),
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
	characters: z
		.strictObject({
			departures: z.array(
				z.strictObject({ characterId: id, reason: z.enum(['death', 'retirement']) })
			),
			arrivals: z.array(z.strictObject({ characterId: id, successorOf: id }))
		})
		.nullable(),
	world: z
		.strictObject({
			indicators: z.array(z.strictObject({ indicator, delta: int })),
			parties: z.array(z.strictObject({ partyId: id, delta: int })),
			leaderChanges: z.array(
				z.strictObject({
					partyId: id,
					previousLeaderId: id,
					leaderId: id,
					reason: z.enum(['retirement', 'internal_vote', 'death'])
				})
			)
		})
		.nullable(),
	supports: z.array(z.strictObject({ groupId: id, delta: int })).nullable(),
	deadlines: z
		.strictObject({
			mandates: z.array(politicalChange),
			ballots: z.array(
				z.strictObject({
					ballotId: id,
					electionId: id,
					winnerPartyId: id,
					governingBefore: id,
					governingAfter: id
				})
			),
			campaigns: z.array(
				z.strictObject({
					campaignId: id,
					opponentId: id.nullable(),
					status: z.enum(['won', 'lost', 'disqualified']),
					playerPercent: int.nullable(),
					reason: text.nullable()
				})
			),
			people: z.array(peopleChange)
		})
		.nullable(),
	exposure: int.nullable(),
	justice: z
		.strictObject({
			cases: z.array(
				z.strictObject({
					caseId: id,
					kind: z.enum(['revealed', 'dismissed', 'indicted', 'appealed', 'acquitted', 'convicted'])
				})
			),
			changes: z.array(resourceChange),
			gauges: z.array(gaugeChange),
			politics: z.array(politicalChange)
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
			people: z.array(peopleChange),
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
	people: z.array(peopleChange),
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
		exposure: int,
		defense: int,
		ineligibleUntil: int.nullable(),
		partyId: id.nullable(),
		affiliations: z.array(z.strictObject({ partyId: id, fromTurn: int, toTurn: int.nullable() })),
		supports: z.record(id, int),
		popularity: int,
		origin: id,
		profession: id,
		family: z.strictObject({
			partnerId: id.nullable(),
			childrenIds: z.array(id),
			parentIds: z.array(id),
			siblingIds: z.array(id),
			formerPartnerIds: z.array(id)
		})
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
		z.strictObject({
			id,
			name: text,
			epithet: text.nullable(),
			birthTurn: int,
			competence: int,
			partyId: id.nullable(),
			tags: z.array(z.string().max(60)),
			renewal: text.nullable(),
			traits: z.array(id),
			knownTraits: z.array(id),
			status: z.enum(['active', 'retired', 'dead']),
			leftTurn: int.nullable(),
			successorOf: id.nullable()
		})
	),
	relationships: z.record(
		id,
		z.strictObject({
			metTurn: int,
			attitude: int,
			memories: z.array(z.strictObject({ turn: int, text, tone: z.enum(['positive', 'negative']) }))
		})
	),
	mandates: z.array(
		z.strictObject({
			instanceId: id,
			mandateId: id,
			startTurn: int,
			access: z.enum(['election', 'nomination']),
			status: z.enum(['active', 'ended']),
			endTurn: int.nullable(),
			endReason: mandateEndReason.nullable()
		})
	),
	ballots: z.array(
		z.strictObject({
			ballotId: id,
			electionId: id,
			turn: int,
			filingClosesTurn: int,
			early: z.boolean(),
			status: z.enum(['scheduled', 'held', 'cancelled']),
			shares: z.array(z.strictObject({ partyId: id, percent: int })).nullable(),
			winnerPartyId: id.nullable(),
			cancelReason: text.nullable()
		})
	),
	campaigns: z.array(
		z.strictObject({
			campaignId: id,
			ballotId: id,
			electionId: id,
			declaredTurn: int,
			partyId: id.nullable(),
			invested: z.boolean(),
			preparation: int,
			opponentId: id.nullable(),
			status: z.enum(['running', 'won', 'lost', 'disqualified']),
			playerPercent: int.nullable(),
			reason: text.nullable()
		})
	),
	staff: z.array(
		z.strictObject({
			characterId: id,
			postId: id,
			hiredTurn: int,
			missionId: id,
			status: z.enum(['active', 'left']),
			leftTurn: int.nullable(),
			leaveReason: staffLeaveReason.nullable()
		})
	),
	shortlists: z.record(id, z.array(z.strictObject({ characterId: id, profileId: id }))),
	institutions: z.strictObject({
		incompatibilities: z.array(z.tuple([id, id])),
		maxMandates: int,
		prerequisites: z.record(id, z.array(id))
	}),
	facts: z.array(
		z.strictObject({
			factId: id,
			offenseId: id,
			turn: int,
			severity: int,
			divertedCents: int,
			authorId: id.nullable(),
			accompliceIds: z.array(id),
			eventId: id
		})
	),
	cases: z.array(
		z.strictObject({
			caseId: id,
			factId: id,
			defendantId: id.nullable(),
			openedTurn: int,
			stage: z.enum(['investigation', 'indicted', 'appeal', 'closed']),
			dueTurn: int.nullable(),
			outcome: z.enum(['dismissed', 'acquitted', 'convicted']).nullable(),
			closedTurn: int.nullable(),
			sentence: z
				.strictObject({
					fineCents: int,
					ineligibilityTurns: int,
					prison: z.enum(['none', 'suspended', 'firm'])
				})
				.nullable()
		})
	),
	history: z.array(z.discriminatedUnion('type', [turnEntry, choiceEntry])),
	end: z
		.discriminatedUnion('reason', [
			z.strictObject({ turn: int, reason: z.literal('death'), cause: deathCause }),
			z.strictObject({ turn: int, reason: z.literal('prison'), caseId: id })
		])
		.nullable()
});
