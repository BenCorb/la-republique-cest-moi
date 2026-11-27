import { describe, expect, it } from 'vitest';
import type { Content } from '../../src/lib/game/content/types.ts';
import { validateContent } from '../../src/lib/game/content/validate.ts';
import {
	applyCareerEffect,
	checkInvariants,
	chooseEventCommand,
	commitTurn,
	createGame,
	describePendingEvent,
	evaluateCondition,
	holdIssue,
	previewPlan,
	readStat,
	resolveDeadlines,
	transition,
	type GameState,
	type MandateInstance,
	type TransitionSuccess
} from '../../src/lib/game/engine/index.ts';
import { projectView } from '../../src/lib/game/app/view-model.ts';
import {
	fixtureActions,
	fixtureBalance,
	fixtureCareer,
	fixtureSupports,
	fixtureCast,
	fixtureEntourage,
	fixtureEvents,
	fixtureProfiles,
	fixtureJustice,
	fixtureWealth,
	fixturePromises,
	fixtureMedia,
	fixtureInstitutions,
	fixtureEpitaphs,
	fixtureTraits,
	fixtureUpgrades,
	fixtureWorld,
	quarterLog,
	withEvents
} from '../fixtures/content.ts';

const careerActions = [
	{
		id: 'mandate.resign',
		label: 'Démissionner',
		description: 'Quitter un mandat.',
		timeCost: 5,
		maxPerTurn: 1,
		costs: [],
		requires: { op: 'gte', stat: 'player.mandates', value: 1 },
		unavailableReason: 'Aucun mandat.',
		effects: [{ op: 'endMandate', mandate: 'target' }],
		target: 'mandate'
	}
];

const careerEvents = {
	events: [
		{
			id: 'career.offer_ministry',
			category: 'career',
			title: 'Un portefeuille',
			text: 'On vous propose un ministère.',
			blocking: true,
			trigger: 'random',
			weight: 1,
			priority: 0,
			cooldownTurns: 0,
			unique: false,
			actors: [],
			choices: [
				{
					id: 'strict',
					label: 'Accepter sans rien quitter',
					hints: [],
					costs: [],
					effects: [{ op: 'grantMandate', mandate: 'mandate.minister' }]
				},
				{
					id: 'replace',
					label: 'Accepter et laisser son siège',
					hints: [],
					costs: [],
					effects: [{ op: 'grantMandate', mandate: 'mandate.minister', replaceIncompatible: true }]
				},
				{ id: 'decline', label: 'Refuser', hints: [], costs: [], effects: [] }
			]
		},
		{
			id: 'career.dissolution',
			category: 'national',
			title: 'Dissolution',
			text: 'Élections anticipées.',
			blocking: false,
			trigger: 'random',
			weight: 1,
			priority: 0,
			cooldownTurns: 0,
			unique: true,
			actors: [],
			effects: [{ op: 'callEarlyElection', election: 'election.national', delayTurns: 2 }]
		}
	]
};

function load(
	overrides: { actions?: unknown[]; events?: unknown } = {}
): ReturnType<typeof validateContent> {
	return validateContent({
		actions: { actions: [...fixtureActions.actions, ...(overrides.actions ?? careerActions)] },
		upgrades: fixtureUpgrades,
		balance: fixtureBalance,
		cast: fixtureCast,
		events: { ...fixtureEvents, 'events/career.json': overrides.events ?? careerEvents },
		world: fixtureWorld,
		traits: fixtureTraits,
		career: fixtureCareer,
		supports: fixtureSupports,
		entourage: fixtureEntourage,
		profiles: fixtureProfiles,
		justice: fixtureJustice,
		wealth: fixtureWealth,
		promises: fixturePromises,
		media: fixtureMedia,
		institutions: fixtureInstitutions,
		epitaphs: fixtureEpitaphs
	});
}

function content(): Content {
	const result = load();
	if (!result.ok) throw new Error(JSON.stringify(result.issues, null, 2));
	return result.content;
}

const catalog = content();

function holding(state: GameState, ...mandateIds: string[]): GameState {
	const mandates: MandateInstance[] = mandateIds.map((mandateId, index) => ({
		instanceId: `term.${index + 1}`,
		mandateId,
		startTurn: state.turn,
		access: 'election',
		status: 'active',
		endTurn: null,
		endReason: null,
		side: null
	}));
	return { ...state, mandates };
}

function commit(
	state: GameState,
	usedContent = catalog,
	steps = commitTurn().plan.steps
): TransitionSuccess {
	const result = transition(state, commitTurn({ steps }), usedContent);
	if (!result.ok) throw new Error(result.error.message);
	expect(checkInvariants(result.state, usedContent)).toEqual([]);
	return result;
}

/** Avance jusqu'au trimestre `turn` (journal cohérent). */
function advanceTo(state: GameState, turn: number, usedContent = catalog): GameState {
	let current = state;
	while (current.turn < turn) current = commit(current, usedContent).state;
	return current;
}

describe('calendrier électoral', () => {
	it('programme une première échéance par type d’élection, visible avec sa clôture', () => {
		const game = createGame({ seed: 'calendrier' }, catalog);
		expect(game.ballots).toEqual([
			expect.objectContaining({
				ballotId: 'ballot.1',
				electionId: 'election.local',
				turn: 40,
				filingClosesTurn: 38,
				status: 'scheduled'
			}),
			expect.objectContaining({
				ballotId: 'ballot.2',
				electionId: 'election.national',
				turn: 60,
				filingClosesTurn: 58,
				status: 'scheduled'
			})
		]);
		const view = projectView(game, [], catalog).career;
		expect(
			view.calendar.map((ballot) => [ballot.label, ballot.dateLabel, ballot.turnsLeft])
		).toEqual([
			['Élection locale', 'T1 2010', 40],
			['Élection nationale', 'T1 2015', 60]
		]);
	});

	it('tient le scrutin à la fin de son trimestre et programme le suivant un cycle plus tard', () => {
		const state = advanceTo(createGame({ seed: 'scrutin' }, catalog), 41);
		const held = state.ballots.find((ballot) => ballot.ballotId === 'ballot.1')!;
		expect(held.status).toBe('held');
		expect(held.shares?.reduce((total, share) => total + share.percent, 0)).toBe(100);
		expect(held.winnerPartyId).toBe('party.left');
		expect(state.ballots.at(-1)).toMatchObject({ electionId: 'election.local', turn: 64 });
		const entry = state.history.find(
			(candidate) => candidate.type === 'turn.resolved' && candidate.turn === 40
		);
		expect(entry?.type === 'turn.resolved' && entry.deadlines?.ballots).toEqual([
			{
				ballotId: 'ballot.1',
				electionId: 'election.local',
				winnerPartyId: 'party.left',
				governingBefore: 'party.left',
				governingAfter: 'party.left'
			}
		]);
	});

	it('change de gouvernement si l’opposition gagne les législatives, et met fin aux ministères', () => {
		const base = advanceTo(createGame({ seed: 'alternance' }, catalog), 60);
		const state = holding(
			{
				...base,
				world: {
					...base.world,
					parties: {
						...base.world.parties,
						'party.right': { ...base.world.parties['party.right']!, strength: 50 }
					}
				}
			},
			'mandate.minister'
		);
		const result = commit(state);
		expect(result.state.world.governingPartyId).toBe('party.right');
		expect(result.state.world.indicators.stability).toBe(60);
		expect(result.state.mandates[0]).toMatchObject({
			status: 'ended',
			endReason: 'government_change',
			endTurn: 60
		});
	});

	it('met fin aux mandats liés au scrutin (la candidature viendra avec P2-03)', () => {
		const base = advanceTo(createGame({ seed: 'terme' }, catalog), 40);
		const result = commit(holding(base, 'mandate.councillor', 'mandate.deputy'));
		expect(result.state.mandates.map((mandate) => mandate.status)).toEqual(['ended', 'active']);
		expect(quarterLog(result).deadlines?.mandates).toEqual([
			{
				kind: 'mandateEnded',
				instanceId: 'term.1',
				mandateId: 'mandate.councillor',
				reason: 'term'
			}
		]);
	});

	it('organise une élection anticipée sans réécrire l’échéance régulière', () => {
		const dissolution = withEvents(['career.dissolution'], undefined, catalog);
		const result = commit(createGame({ seed: 'dissolution' }, dissolution), dissolution);
		// Événement à la frontière du trimestre 1 : scrutin anticipé deux trimestres plus tard.
		expect(result.state.ballots[1]).toMatchObject({
			electionId: 'election.national',
			status: 'cancelled',
			cancelReason: 'Élection anticipée.'
		});
		expect(result.state.ballots[2]).toMatchObject({
			ballotId: 'ballot.3',
			electionId: 'election.national',
			turn: 3,
			early: true,
			status: 'scheduled'
		});
		const later = advanceTo(result.state, 4, dissolution);
		expect(later.ballots.find((ballot) => ballot.ballotId === 'ballot.3')?.status).toBe('held');
		expect(later.ballots.at(-1)).toMatchObject({ electionId: 'election.national', turn: 23 });
	});

	it('n’avance pas une échéance régulière déjà plus proche', () => {
		const base = createGame({ seed: 'proche' }, catalog);
		const parts = {
			mandates: base.mandates,
			ballots: base.ballots,
			campaigns: base.campaigns,
			institutions: base.institutions,
			promises: base.promises
		};
		const outcome = applyCareerEffect(
			{ op: 'callEarlyElection', election: 'election.local', delayTurns: 1 },
			{ ...parts, ballots: parts.ballots.map((ballot) => ({ ...ballot, turn: 1 })) },
			0,
			null,
			catalog,
			base.player
		);
		expect(outcome.changes).toEqual([]);
	});

	it('résout les scrutins de façon reproductible malgré l’aléa', () => {
		const volatile: Content = {
			...catalog,
			balance: {
				...catalog.balance,
				elections: { ...catalog.balance.elections, voteVolatility: 10 }
			}
		};
		const base = createGame({ seed: 'aléa' }, volatile);
		const run = () =>
			resolveDeadlines(
				{
					world: base.world,
					player: base.player,
					resources: base.resources,
					characters: base.characters,
					relationships: base.relationships,
					career: {
						mandates: [],
						ballots: base.ballots.map((ballot) => ({ ...ballot, turn: 0 })),
						campaigns: [],
						institutions: base.institutions,
						promises: []
					}
				},
				0,
				base.rng,
				volatile
			);
		expect(run()).toStrictEqual(run());
		expect(run().rng).not.toEqual(base.rng);
	});
});

describe('mandats et cumul', () => {
	const base = createGame({ seed: 'cumul' }, catalog);

	it('applique prérequis, incompatibilités et nombre maximal', () => {
		const rules = base.institutions;
		expect(holdIssue('mandate.mayor', [], rules, catalog)).toBe(
			'Il faut d’abord exercer : Siège local.'
		);
		const deputy = holding(base, 'mandate.deputy');
		expect(holdIssue('mandate.minister', deputy.mandates, rules, catalog)).toBe(
			'Incompatible avec : Siège national.'
		);
		expect(holdIssue('mandate.minister', deputy.mandates, rules, catalog, true)).toBeNull();
		// La mairie s'exerce au sein du conseil municipal : trois fonctions, deux mandats au cumul.
		const full = holding(base, 'mandate.councillor', 'mandate.mayor', 'mandate.deputy');
		const two = { ...rules, incompatibilities: [], maxMandates: 2 };
		expect(holdIssue('mandate.minister', full.mandates, two, catalog)).toBe(
			'Cumul limité à 2 mandats.'
		);
		expect(
			holdIssue('mandate.minister', full.mandates, { ...rules, incompatibilities: [] }, catalog)
		).toBeNull();
		// Devenir maire ne consomme pas de place au cumul.
		const local = holding(base, 'mandate.councillor', 'mandate.deputy');
		expect(holdIssue('mandate.mayor', local.mandates, two, catalog)).toBeNull();
		expect(readStat(full, 'player.mandates')).toBe(2);
		expect(holdIssue('mandate.deputy', deputy.mandates, rules, catalog)).toBe(
			'Vous exercez déjà : Siège national.'
		);
	});

	it('expose les mandats aux conditions', () => {
		const state = holding(base, 'mandate.councillor');
		expect(readStat(state, 'player.mandates')).toBe(1);
		expect(evaluateCondition(state, { op: 'holdsMandate', mandate: 'mandate.councillor' })).toBe(
			true
		);
		expect(evaluateCondition(state, { op: 'canHoldMandate', mandate: 'mandate.mayor' })).toBe(true);
		expect(evaluateCondition(base, { op: 'canHoldMandate', mandate: 'mandate.mayor' })).toBe(false);
	});

	it('réserve du temps, verse les indemnités et stresse chaque trimestre', () => {
		const state = holding(base, 'mandate.councillor', 'mandate.mayor');
		const preview = previewPlan(state, { steps: [] }, catalog);
		expect(preview.timeAvailable).toBe(70);
		expect(preview.timeReserved).toBe(30);
		expect(preview.resourceChanges.influence).toEqual({ min: 1, max: 1 });
		expect(preview.resourceChanges.personalCashCents).toEqual({ min: 50_000, max: 50_000 });
		const result = commit(state);
		expect(quarterLog(result).mandates).toEqual({
			changes: [
				{ resource: 'influence', delta: 1 },
				{ resource: 'personalCashCents', delta: 50_000 }
			],
			stress: 2
		});
		expect(result.state.resources.influence).toBe(state.resources.influence + 1);
		expect(result.state.player.stress).toBe(state.player.stress + 2);
	});

	it('refuse un plan qui dépasse le temps laissé par les mandats', () => {
		const state = holding(base, 'mandate.councillor', 'mandate.mayor', 'mandate.deputy');
		const steps = Array.from({ length: 2 }, () => ({ kind: 'action' as const, id: 'test.gated' }));
		const preview = previewPlan(
			{ ...state, resources: { ...state.resources, influence: 10 } },
			{ steps },
			catalog
		);
		expect(preview.timeAvailable).toBe(40);
		expect(preview.issues.map((issue) => issue.code)).toContain('time_exceeded');
	});

	it('démissionne d’un mandat choisi et perd ce qui en dépend', () => {
		const state = holding(base, 'mandate.councillor', 'mandate.mayor');
		const resign = { kind: 'action' as const, id: 'mandate.resign', target: 'term.1' };
		expect(previewPlan(state, { steps: [resign] }, catalog).valid).toBe(true);
		const result = commit(state, catalog, [resign]);
		expect(result.state.mandates.map((mandate) => [mandate.status, mandate.endReason])).toEqual([
			['ended', 'resigned'],
			['ended', 'removed']
		]);
		const bad = previewPlan(state, { steps: [{ ...resign, target: 'term.9' }] }, catalog);
		expect(bad.issues.map((issue) => issue.code)).toContain('invalid_target');
	});

	it('rend indisponible une nomination contraire au cumul, sauf remplacement explicite', () => {
		const offer = withEvents(['career.offer_ministry'], undefined, catalog);
		const queued = commit(
			holding(createGame({ seed: 'nomination' }, offer), 'mandate.deputy'),
			offer
		);
		const view = describePendingEvent(queued.state, offer)!;
		expect(view.choices.map((choice) => [choice.id, choice.available, choice.reason])).toEqual([
			['strict', false, 'Incompatible avec : Siège national.'],
			['replace', true, null],
			['decline', true, null]
		]);
		const chosen = transition(queued.state, chooseEventCommand(view.instanceId, 'replace'), offer);
		if (!chosen.ok) throw new Error(chosen.error.message);
		expect(
			chosen.state.mandates.map((mandate) => [mandate.mandateId, mandate.status, mandate.endReason])
		).toEqual([
			['mandate.deputy', 'ended', 'replaced'],
			['mandate.minister', 'active', null]
		]);
		expect(projectView(chosen.state, [], offer).career.mainFunction).toBe('Ministère');
		expect(checkInvariants(chosen.state, offer)).toEqual([]);
	});
});

describe('projection et alertes', () => {
	it('annonce la clôture des candidatures puis l’échéance proche', () => {
		const filing = advanceTo(createGame({ seed: 'alerte' }, catalog), 38);
		const local = `Élection locale (${filing.player.territory.homeTown.name})`;
		// Dernier dépôt possible : à traiter ; le simple calendrier reste une information (P3-13).
		expect(projectView(filing, [], catalog).alerts).toContainEqual({
			level: 'warning',
			text: `${local} : dernier trimestre pour déposer une candidature.`
		});
		const earlier = advanceTo(createGame({ seed: 'alerte' }, catalog), 37);
		expect(projectView(earlier, [], catalog).alerts).toContainEqual({
			level: 'info',
			text: `${local} : candidatures closes au T3 2009.`
		});
		const after = advanceTo(filing, 39);
		expect(projectView(after, [], catalog).alerts).toContainEqual({
			level: 'info',
			text: `${local} au T1 2010, dans 1 trimestre.`
		});
	});

	it('range la mairie sous le conseil municipal, hors du décompte du cumul', () => {
		const base = createGame({ seed: 'mairie' }, catalog);
		// Ordre d'attribution volontairement désordonné : la mairie suit tout de même son conseil.
		const state = holding(base, 'mandate.deputy', 'mandate.councillor', 'mandate.mayor');
		const career = projectView(state, [], catalog).career;
		// Chaque mandat cite son lieu : département ou commune du joueur (P3-16).
		const town = state.player.territory.homeTown.name;
		expect(career.mandates.map((mandate) => [mandate.label, mandate.within])).toEqual([
			['Siège national (Département de test)', null],
			[`Siège local (${town})`, null],
			[`Mairie (${town})`, `Siège local (${town})`]
		]);
		expect(career.cumulCount).toBe(2);
	});
});

describe('validation du contenu de carrière', () => {
	const messages = (result: ReturnType<typeof validateContent>): string =>
		result.ok ? '' : result.issues.map((issue) => `${issue.path} ${issue.message}`).join('\n');

	it('accepte le catalogue de test', () => {
		expect(messages(load())).toBe('');
	});

	it('réserve attributions et élections anticipées aux événements', () => {
		const result = load({
			actions: [
				{
					...careerActions[0],
					id: 'mandate.grab',
					target: undefined,
					requires: undefined,
					unavailableReason: undefined,
					effects: [
						{ op: 'grantMandate', mandate: 'mandate.deputy' },
						{ op: 'callEarlyElection', election: 'election.national', delayTurns: 1 },
						{ op: 'endMandate', mandate: 'target' }
					]
				}
			]
		});
		const text = messages(result);
		expect(text).toContain('attribution de mandat réservée aux événements');
		expect(text).toContain('élection anticipée réservée aux événements');
		expect(text).toContain('« target » réservé aux actions ciblant un mandat');
	});

	it('rejette les mandats et élections inconnus', () => {
		const event = structuredClone(careerEvents.events[1]!) as { effects: unknown[] };
		event.effects = [
			{ op: 'callEarlyElection', election: 'election.absent', delayTurns: 1 },
			{ op: 'endMandate', mandate: 'mandate.absent' }
		];
		const text = messages(load({ events: { events: [event] } }));
		expect(text).toContain('élection inconnue : election.absent');
		expect(text).toContain('mandat inconnu : mandate.absent');
	});
});

describe('invariants de carrière', () => {
	const base = createGame({ seed: 'invariants-carrière' }, catalog);

	it.each<[string, GameState, string]>([
		[
			'mandats incompatibles',
			holding(base, 'mandate.deputy', 'mandate.minister'),
			'mandats incompatibles'
		],
		['prérequis absent', holding(base, 'mandate.mayor'), 'prérequis absent'],
		[
			'cumul dépassé',
			{
				...holding(base, 'mandate.councillor', 'mandate.mayor', 'mandate.deputy'),
				institutions: { ...base.institutions, maxMandates: 1 }
			},
			'cumul dépassé'
		],
		[
			'deux échéances programmées',
			{ ...base, ballots: [...base.ballots, { ...base.ballots[0]!, ballotId: 'ballot.3' }] },
			'plusieurs échéances programmées'
		]
	])('détecte : %s', (_label, state, fragment) => {
		expect(checkInvariants(state, catalog).join('\n')).toContain(fragment);
	});
});
