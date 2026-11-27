/**
 * Schéma strict d'un état de partie chargé depuis l'extérieur (sauvegarde,
 * import). Typé contre `GameState` : tout écart entre le moteur et ce schéma est
 * une erreur de compilation. Les objets sont stricts (champ inconnu refusé) ;
 * la cohérence (journal, instances, références au catalogue) est ensuite
 * contrôlée par `checkInvariants`.
 */
import { z } from 'zod';
import {
	ARTICLE_TONES,
	ARTICLE_TOPICS,
	GAUGE_IDS,
	SEARCH_LEVELS,
	INDICATOR_IDS,
	PROMISE_STATUSES,
	RESOURCE_IDS
} from '../content/types.ts';
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
/** Procès-verbal d'un scrutin (P3-29). */
const ballotReport = z.strictObject({
	place: text,
	system: z.enum(['list', 'single', 'senate_list', 'senate_majority']),
	seats: int,
	turnout: int,
	contestants: z.array(
		z.strictObject({
			contestantId: id,
			partyId: id.nullable(),
			leaderId: id.nullable(),
			player: z.boolean(),
			dissident: z.boolean(),
			firstRound: int,
			secondRound: int.nullable(),
			seats: int,
			status: z.enum(['won', 'lost', 'qualified', 'merged', 'withdrawn', 'eliminated']),
			mergedInto: id.nullable()
		})
	),
	stage: z.enum(['runoff_pending', 'final']),
	secondRound: z.boolean(),
	winnerId: id.nullable(),
	playerContestantId: id.nullable(),
	playerRank: int.nullable(),
	playerElected: z.boolean().nullable()
});

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
	z.strictObject({
		kind: z.literal('investiture'),
		requestId: id,
		ballotId: id,
		status: z.enum(['pending', 'granted', 'refused', 'dissident', 'renounced'])
	}),
	z.strictObject({
		kind: z.literal('runoff'),
		campaignId: id,
		decision: z.enum(['maintain', 'merge', 'withdraw']),
		status: z.enum(['won', 'lost', 'disqualified', 'withdrawn']),
		playerPercent: int.nullable()
	}),
	z.strictObject({ kind: z.literal('preparation'), delta: int }),
	z.strictObject({ kind: z.literal('campaignAdvance'), campaignId: id, cents: int }),
	z.strictObject({ kind: z.literal('hired'), characterId: id, postId: id }),
	z.strictObject({
		kind: z.literal('hireRefused'),
		characterId: id,
		postId: id,
		counterCents: int.nullable()
	}),
	z.strictObject({ kind: z.literal('interviewed'), characterId: id, postId: id }),
	z.strictObject({
		kind: z.literal('searchOrdered'),
		postId: id,
		level: z.enum(SEARCH_LEVELS),
		dueTurn: int
	}),
	z.strictObject({ kind: z.literal('vetted'), characterId: id, postId: id }),
	z.strictObject({ kind: z.literal('raiseGranted'), characterId: id, salaryCents: int }),
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
	z.strictObject({ kind: z.literal('fact'), factId: id, offenseId: id }),
	z.strictObject({
		kind: z.literal('promise'),
		pledgeId: id,
		promiseId: id,
		change: z.enum([
			'made',
			'started',
			'limited',
			'lapsed',
			'amended',
			'kept',
			'partial',
			'abandoned',
			'recalled'
		])
	}),
	z.strictObject({
		kind: z.literal('promiseProgress'),
		pledgeId: id,
		promiseId: id,
		delta: int
	}),
	z.strictObject({ kind: z.literal('mediaRelation'), mediaId: id, delta: int }),
	z.strictObject({ kind: z.literal('interview'), mediaId: id }),
	z.strictObject({
		kind: z.literal('reform'),
		reformId: id,
		parameterId: id,
		levelId: id,
		origin: z.enum(['player', 'government']),
		change: z.enum(['proposed', 'adopted', 'rejected', 'enacted'])
	})
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
		lifestyle: z.strictObject({ lifestyleId: id, costCents: int, unpaid: z.boolean() }),
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
			shortlisted: z.array(id),
			searches: z.array(
				z.strictObject({
					postId: id,
					level: z.enum(SEARCH_LEVELS),
					trait: id.nullable(),
					outcome: z.enum(['found', 'failed', 'cancelled']),
					candidates: z.array(id),
					refundCents: int
				})
			),
			progress: z.array(z.strictObject({ characterId: id, from: int, to: int })),
			raiseRequests: z.array(id),
			counterLapsed: z.array(id)
		})
		.nullable(),
	wellbeing: z.strictObject({
		contributions: z.array(
			z.strictObject({
				source: z.enum(['workload', 'comfort', 'recovery', 'high_stress', 'calm', 'ageing']),
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
					status: z.enum(['won', 'lost', 'disqualified', 'withdrawn']),
					playerPercent: int.nullable(),
					reason: text.nullable(),
					advance: z.strictObject({ cents: int, repaid: z.boolean() }).nullable()
				})
			),
			people: z.array(peopleChange),
			runoffs: z.array(id),
			investitures: z.array(z.strictObject({ requestId: id, granted: z.boolean() }))
		})
		.nullable(),
	exposure: int.nullable(),
	wealth: z.strictObject({ valueChange: int, failed: z.array(id) }).nullable(),
	promises: z
		.strictObject({
			changes: z.array(resourceChange),
			gauges: z.array(gaugeChange),
			politics: z.array(politicalChange)
		})
		.nullable(),
	press: z
		.strictObject({
			articles: z.array(
				z.strictObject({
					mediaId: id,
					topic: z.enum(ARTICLE_TOPICS),
					tone: z.enum(ARTICLE_TONES),
					headlineId: id,
					subjectId: id.nullable(),
					detail: z.string().max(60).nullable(),
					supports: z.array(z.strictObject({ groupId: id, delta: int })),
					exposure: int
				})
			),
			relations: z.array(z.strictObject({ mediaId: id, delta: int }))
		})
		.nullable(),
	institutions: z
		.strictObject({
			changes: z.array(resourceChange),
			gauges: z.array(gaugeChange),
			politics: z.array(politicalChange)
		})
		.nullable(),
	snapshot: z.strictObject({
		influence: int,
		politicalBudgetCents: int,
		personalCashCents: int,
		popularity: int,
		health: int,
		stress: int,
		exposure: int,
		activists: int
	}),
	activists: z
		.strictObject({
			arrivals: int,
			recruits: int,
			departures: int,
			total: int,
			capacity: int,
			tierBefore: id,
			tierAfter: id,
			duesCents: int,
			upkeepCents: int
		})
		.nullable(),
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
		lifestyle: id,
		partyId: id.nullable(),
		affiliations: z.array(z.strictObject({ partyId: id, fromTurn: int, toTurn: int.nullable() })),
		supports: z.record(id, int),
		popularity: int,
		origin: id,
		engagement: id,
		territory: z.strictObject({
			regionId: id,
			departmentCode: z.string().regex(/^(\d{2}|2[AB])$/u),
			homeTown: z.strictObject({ name: text, sizeId: id, traitIds: z.array(id) })
		}),
		family: z.strictObject({
			partnerId: id.nullable(),
			childrenIds: z.array(id),
			parentIds: z.array(id),
			siblingIds: z.array(id),
			formerPartnerIds: z.array(id)
		}),
		activists: int
	}),
	resources: z.strictObject({
		influence: int,
		politicalBudgetCents: int,
		personalCashCents: int
	}),
	upgrades: z.array(
		z.strictObject({ instanceId: id, upgradeId: id, acquiredTurn: int, valueCents: int.nullable() })
	),
	nextInstanceNumber: int,
	events: z.strictObject({
		pending: z.array(z.strictObject({ instanceId: id, eventId: id, turn: int, actors })),
		scheduled: z.array(scheduledEvent),
		occurrences: z.record(id, z.strictObject({ count: int, lastTurn: int }))
	}),
	world: z.strictObject({
		indicators: z.strictObject({ economy: int, socialClimate: int, stability: int }),
		parties: z.record(id, z.strictObject({ strength: int, leaderId: id })),
		governingPartyId: id,
		media: z.record(id, z.strictObject({ relation: int, interviewTurn: int.nullable() })),
		press: z.strictObject({
			usedHeadlines: z.record(text, z.array(id)),
			recentAngles: z.array(text)
		})
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
			endReason: mandateEndReason.nullable(),
			side: z.enum(['majority', 'opposition']).nullable()
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
			cancelReason: text.nullable(),
			report: ballotReport.nullable()
		})
	),
	investitures: z.array(
		z.strictObject({
			requestId: id,
			ballotId: id,
			electionId: id,
			partyId: id,
			requestedTurn: int,
			status: z.enum(['pending', 'granted', 'refused', 'dissident', 'renounced']),
			resolvedTurn: int.nullable(),
			reasons: z.array(text)
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
			advanceCents: int,
			opponentId: id.nullable(),
			status: z.enum(['running', 'won', 'lost', 'disqualified', 'withdrawn']),
			playerPercent: int.nullable(),
			reason: text.nullable(),
			role: z.enum(['head', 'colistier']),
			listRank: int,
			resultTurn: int.nullable()
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
			leaveReason: staffLeaveReason.nullable(),
			salaryCents: int,
			bonusDueCents: int,
			progressTenths: int,
			reviewedCompetence: int,
			reviewTurn: int
		})
	),
	shortlists: z.record(
		id,
		z.array(
			z.strictObject({
				characterId: id,
				profileId: id,
				interviews: int,
				hints: z.array(id).nullable(),
				counterOffer: z.strictObject({ salaryCents: int, untilTurn: int }).nullable()
			})
		)
	),
	searches: z.array(
		z.strictObject({
			postId: id,
			level: z.enum(SEARCH_LEVELS),
			trait: id.nullable(),
			orderedTurn: int,
			dueTurn: int
		})
	),
	institutions: z.strictObject({
		incompatibilities: z.array(z.tuple([id, id])),
		maxMandates: int,
		prerequisites: z.record(id, z.array(id)),
		parameters: z.record(id, id),
		reforms: z.array(
			z.strictObject({
				reformId: id,
				parameterId: id,
				levelId: id,
				fromLevelId: id,
				origin: z.enum(['player', 'government']),
				proposedTurn: int,
				status: z.enum(['proposed', 'rejected', 'scheduled', 'enacted']),
				adoptionPercent: int.nullable(),
				activationTurn: int.nullable()
			})
		)
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
	promises: z.array(
		z.strictObject({
			pledgeId: id,
			promiseId: id,
			campaignId: id,
			announcedTurn: int,
			status: z.enum(PROMISE_STATUSES),
			progress: int,
			amended: z.boolean(),
			leverHeld: z.boolean(),
			dueTurn: int.nullable(),
			closedTurn: int.nullable(),
			recalls: int,
			lastRecalledTurn: int.nullable()
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
