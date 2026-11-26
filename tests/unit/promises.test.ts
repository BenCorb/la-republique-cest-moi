import { describe, expect, it } from 'vitest';
import type { Content } from '../../src/lib/game/content/types.ts';
import { validateContent, type RawContent } from '../../src/lib/game/content/validate.ts';
import {
	careerSummary,
	checkInvariants,
	chooseEventCommand,
	commitTurn,
	createGame,
	evaluateCondition,
	previewPlan,
	promiseIssue,
	settlementOutcome,
	transition,
	withPopularity,
	type GameState,
	type PlanStep,
	type TransitionSuccess
} from '../../src/lib/game/engine/index.ts';
import { gameStateSchema } from '../../src/lib/game/persistence/state-schema.ts';
import { projectView } from '../../src/lib/game/app/view-model.ts';
import {
	fixtureActions,
	fixtureBalance,
	fixtureCareer,
	fixtureCast,
	fixtureEntourage,
	fixtureEvents,
	fixtureJustice,
	fixturePromises,
	fixtureMedia,
	fixtureInstitutions,
	fixtureEpitaphs,
	fixtureProfiles,
	fixtureSupports,
	fixtureTraits,
	fixtureUpgrades,
	fixtureWealth,
	fixtureWorld,
	quarterLog
} from '../fixtures/content.ts';

const promiseActions = [
	{
		id: 'campaign.declare',
		label: 'Se présenter',
		description: 'Déposer sa candidature.',
		timeCost: 10,
		maxPerTurn: 1,
		costs: [],
		effects: [{ op: 'declareCandidacy' }],
		target: 'ballot'
	},
	{
		id: 'campaign.pledge',
		label: 'Prendre un engagement',
		description: 'Promettre.',
		timeCost: 5,
		maxPerTurn: 3,
		costs: [],
		requires: { op: 'gte', stat: 'player.campaigning', value: 1 },
		unavailableReason: 'Il faut être en campagne.',
		effects: [{ op: 'makePromise' }],
		target: 'promise'
	},
	{
		id: 'mandate.prepare_reform',
		label: 'Préparer une réforme',
		description: 'Avancer.',
		timeCost: 20,
		maxPerTurn: 3,
		costs: [],
		requires: { op: 'gte', stat: 'player.promisesInProgress', value: 1 },
		unavailableReason: 'Aucune promesse en cours.',
		effects: [{ op: 'advancePromise', value: 35 }],
		target: 'pledge'
	}
];

function raw(overrides: Partial<RawContent> = {}): RawContent {
	return {
		actions: { actions: [...fixtureActions.actions, ...promiseActions] },
		upgrades: fixtureUpgrades,
		balance: fixtureBalance,
		cast: fixtureCast,
		events: fixtureEvents,
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
		epitaphs: fixtureEpitaphs,
		...overrides
	};
}

function load(overrides: Partial<RawContent> = {}): Content {
	const result = validateContent(raw(overrides));
	if (!result.ok) throw new Error(JSON.stringify(result.issues, null, 2));
	return result.content;
}

const catalog = load();
const declare: PlanStep = { kind: 'action', id: 'campaign.declare', target: 'ballot.1' };
const pledge = (promiseId: string): PlanStep => ({
	kind: 'action',
	id: 'campaign.pledge',
	target: promiseId
});
const prepare = (pledgeId: string): PlanStep => ({
	kind: 'action',
	id: 'mandate.prepare_reform',
	target: pledgeId
});

function commit(state: GameState, steps: PlanStep[] = [], used = catalog): TransitionSuccess {
	const result = transition(state, commitTurn({ steps }), used);
	if (!result.ok) throw new Error(`${result.error.message} ${JSON.stringify(result.error.issues)}`);
	expect(checkInvariants(result.state, used)).toEqual([]);
	return result;
}

function choose(state: GameState, choiceId: string, used = catalog): GameState {
	const instance = state.events.pending[0]!;
	const result = transition(state, chooseEventCommand(instance.instanceId, choiceId), used);
	if (!result.ok) throw new Error(result.error.message);
	expect(checkInvariants(result.state, used)).toEqual([]);
	return result.state;
}

/** Avance jusqu'au trimestre voulu ; une décision en attente reçoit `choiceId`. */
function advanceTo(state: GameState, turn: number, choiceId = 'hold', used = catalog): GameState {
	let current = state;
	while (current.turn < turn) {
		current =
			current.phase === 'decision'
				? choose(current, choiceId, used)
				: commit(current, [], used).state;
	}
	return current.phase === 'decision' ? choose(current, choiceId, used) : current;
}

/** Candidat bien placé (investi, soutiens forts) : il l'emporte au scrutin local du T40. */
function strongCandidate(used = catalog): GameState {
	const base = createGame({ seed: 'promesses' }, used);
	const player = withPopularity(
		{
			...base.player,
			partyId: 'party.left',
			affiliations: [{ partyId: 'party.left', fromTurn: 0, toTurn: null }],
			supports: { ...base.player.supports, 'support.members': 20, 'support.workers': 80 }
		},
		used
	);
	return { ...base, player };
}

describe('engagements de campagne', () => {
	it('inscrit la promesse, prépare la campagne et applique les effets d’annonce', () => {
		const declared = commit(strongCandidate(), [declare]).state;
		const preview = previewPlan(declared, { steps: [pledge('promise.test_tax')] }, catalog);
		expect(preview.valid).toBe(true);
		expect(preview.steps[0]?.effects).toContainEqual({
			kind: 'support',
			group: 'support.owners',
			value: 2
		});
		const result = commit(declared, [pledge('promise.test_tax')]);
		expect(result.state.promises).toEqual([
			{
				pledgeId: 'pledge.1',
				promiseId: 'promise.test_tax',
				campaignId: 'campaign.1',
				announcedTurn: 1,
				status: 'announced',
				progress: 0,
				amended: false,
				dueTurn: null,
				closedTurn: null,
				recalls: 0,
				lastRecalledTurn: null
			}
		]);
		expect(result.state.player.supports['support.owners']).toBe(
			declared.player.supports['support.owners']! + 2
		);
		expect(result.state.campaigns[0]!.preparation).toBe(declared.campaigns[0]!.preparation + 3);
		expect(quarterLog(result).steps[0]?.politics).toContainEqual({
			kind: 'promise',
			pledgeId: 'pledge.1',
			promiseId: 'promise.test_tax',
			change: 'made'
		});
	});

	it('refuse un engagement sans campagne, en double, hors élection ou au-delà du plafond', () => {
		const base = strongCandidate();
		const alone = previewPlan(base, { steps: [pledge('promise.test_tax')] }, catalog);
		expect(alone.issues.map((issue) => issue.code)).toContain('condition_not_met');

		const declared = commit(base, [declare]).state;
		const career = { ...declared, promises: declared.promises };
		expect(promiseIssue('promise.test_national', career, catalog)).toMatch(/ne concerne pas/);
		expect(promiseIssue('promise.unknown', career, catalog)).toMatch(/catalogue/);

		const twice = previewPlan(
			declared,
			{ steps: [pledge('promise.test_tax'), pledge('promise.test_tax')] },
			catalog
		);
		expect(twice.steps[1]?.issues[0]?.message).toMatch(/déjà pris/);

		const full = commit(declared, [
			pledge('promise.test_tax'),
			pledge('promise.test_school')
		]).state;
		expect(full.promises).toHaveLength(2);
		const capped = previewPlan(full, { steps: [pledge('promise.test_national')] }, catalog);
		expect(capped.valid).toBe(false);
	});
});

describe('après le scrutin', () => {
	const declared = commit(strongCandidate(), [declare, pledge('promise.test_tax')]).state;

	it('passe en cours après une victoire, avec échéance et dilemme programmés', () => {
		const before = advanceTo(declared, 40);
		const result = commit(before);
		expect(result.state.campaigns[0]?.status).toBe('won');
		expect(result.state.promises[0]).toMatchObject({ status: 'in_progress', dueTurn: 46 });
		expect(result.state.events.scheduled).toContainEqual({
			eventId: 'test.promise_dilemma',
			dueTurn: 42,
			sourceInstanceId: 'pledge.1',
			actors: { promise: 'promise.test_tax' }
		});
		expect(quarterLog(result).promises?.politics).toContainEqual({
			kind: 'promise',
			pledgeId: 'pledge.1',
			promiseId: 'promise.test_tax',
			change: 'started'
		});
		expect(
			evaluateCondition(result.state, {
				op: 'gte',
				stat: 'player.promisesInProgress',
				value: 1
			})
		).toBe(true);
	});

	it('ne programme plus de dilemme au plafond de son événement, suites en attente comprises (P3-09)', () => {
		const dilemma = catalog.events['test.promise_dilemma']!;
		const capped: Content = {
			...catalog,
			events: { ...catalog.events, [dilemma.id]: { ...dilemma, maxOccurrences: 1 } }
		};
		const before = advanceTo(declared, 40, 'hold', capped);
		const scheduledDilemmas = (state: GameState): number =>
			state.events.scheduled.filter((entry) => entry.eventId === dilemma.id).length;

		const seen = {
			...before,
			events: {
				...before.events,
				occurrences: { ...before.events.occurrences, [dilemma.id]: { count: 1, lastTurn: 10 } }
			}
		};
		const afterSeen = commit(seen, [], capped).state;
		expect(afterSeen.promises[0]).toMatchObject({ status: 'in_progress', dueTurn: 46 });
		expect(scheduledDilemmas(afterSeen)).toBe(0);

		const queued = {
			...before,
			events: {
				...before.events,
				scheduled: [
					...before.events.scheduled,
					{ eventId: dilemma.id, dueTurn: 60, sourceInstanceId: 'pledge.0', actors: {} }
				]
			}
		};
		expect(scheduledDilemmas(commit(queued, [], capped).state)).toBe(1);
		// Sans plafond déclaré, le dilemme reste programmé.
		expect(scheduledDilemmas(commit(seen).state)).toBe(1);
	});

	it('reste sans lendemain après une défaite', () => {
		const weak = commit(createGame({ seed: 'promesses' }, catalog), [declare]).state;
		const promised = commit(weak, [pledge('promise.test_school')]).state;
		const result = commit(advanceTo(promised, 40));
		expect(result.state.campaigns[0]?.status).toBe('lost');
		expect(result.state.promises[0]).toMatchObject({ status: 'announced', closedTurn: 40 });
		expect(result.state.events.scheduled).toEqual([]);
	});

	it('présente le dilemme en nommant la promesse et le tranche une seule fois', () => {
		let state = commit(advanceTo(declared, 40)).state;
		while (state.phase !== 'decision') state = commit(state).state;
		expect(state.turn).toBe(42);
		const view = projectView(state, [], catalog);
		expect(view.decision?.text).toContain('« Baisser les impôts »');
		const owners = state.player.supports['support.owners']!;
		const dropped = choose(state, 'drop');
		expect(dropped.promises[0]).toMatchObject({ status: 'abandoned', closedTurn: 42 });
		expect(dropped.player.supports['support.owners']).toBe(owners - 6);
		expect(dropped.resources.influence).toBe(state.resources.influence + 1);
		const repeat = transition(
			dropped,
			chooseEventCommand(state.events.pending[0]!.instanceId, 'drop'),
			catalog
		);
		expect(repeat.ok).toBe(false);
	});
});

describe('issue à l’échéance', () => {
	const declared = commit(strongCandidate(), [declare, pledge('promise.test_tax')]).state;
	const elected = commit(advanceTo(declared, 40)).state;

	it('est tenue quand la réforme est menée à bien', () => {
		let state = advanceTo(elected, 42, 'hold');
		expect(state.promises[0]?.progress).toBe(20);
		while (state.promises[0]!.progress < 100) state = commit(state, [prepare('pledge.1')]).state;
		const preview = previewPlan(state, { steps: [prepare('pledge.1')] }, catalog);
		expect(preview.issues[0]?.message).toMatch(/déjà réalisée/);
		const owners = state.player.supports['support.owners']!;
		const settled = advanceTo(state, 47);
		expect(settled.promises[0]).toMatchObject({ status: 'kept', closedTurn: 46, dueTurn: null });
		expect(settled.player.supports['support.owners']).toBeGreaterThanOrEqual(owners);
		expect(careerSummary(settled).promises).toMatchObject({ made: 1, kept: 1 });
	});

	it('est abandonnée faute de travail, partiellement tenue après un compromis', () => {
		const idle = advanceTo(elected, 47, 'hold');
		expect(idle.promises[0]).toMatchObject({ status: 'abandoned', progress: 20 });

		let amended = advanceTo(elected, 42, 'amend');
		expect(amended.promises[0]).toMatchObject({ amended: true, progress: 10 });
		amended = commit(amended, [
			prepare('pledge.1'),
			prepare('pledge.1'),
			prepare('pledge.1')
		]).state;
		expect(amended.promises[0]?.progress).toBe(100);
		expect(settlementOutcome(amended.promises[0]!, catalog)).toBe('partial');
		expect(advanceTo(amended, 47).promises[0]?.status).toBe('partial');
	});

	it('se sauvegarde et se relit sans perte', () => {
		const restored = gameStateSchema.parse(JSON.parse(JSON.stringify(elected)));
		expect(restored).toStrictEqual(elected);
	});
});

describe('rappels en campagne', () => {
	it('rappelle une promesse passée au plus tard dans la campagne suivante, une fois par campagne', () => {
		const recalling = load({
			promises: { ...fixturePromises, balance: { ...fixturePromises.balance, recallPercent: 100 } }
		});
		// Première campagne gagnée, promesse abandonnée au dilemme.
		const first0 = commit(
			strongCandidate(recalling),
			[declare, pledge('promise.test_tax')],
			recalling
		);
		const dropped = advanceTo(
			commit(advanceTo(first0.state, 40, 'drop', recalling), [], recalling).state,
			43,
			'drop',
			recalling
		);
		expect(dropped.promises[0]?.status).toBe('abandoned');
		// Seconde campagne, au scrutin local suivant.
		const next = dropped.ballots.find(
			(ballot) => ballot.electionId === 'election.local' && ballot.status === 'scheduled'
		)!;
		const past = commit(
			dropped,
			[{ kind: 'action', id: 'campaign.declare', target: next.ballotId }],
			recalling
		).state;
		const first = commit(past, [], recalling);
		expect(first.state.promises[0]).toMatchObject({ recalls: 1, lastRecalledTurn: past.turn });
		expect(first.state.phase).toBe('decision');
		expect(first.state.events.pending[0]?.eventId).toBe('test.promise_recall_broken');
		const after = choose(first.state, 'ok', recalling);
		const second = commit(after, [], recalling).state;
		expect(second.promises[0]?.recalls).toBe(1);
	});
});

describe('projection', () => {
	it('propose les engagements en campagne et décrit le registre sans rien cacher', () => {
		const declared = commit(strongCandidate(), [declare]).state;
		const offers = projectView(declared, [], catalog).career.promises.offers;
		expect(offers.map((offer) => [offer.promiseId, offer.addable])).toEqual([
			['promise.test_tax', true],
			['promise.test_school', true],
			['promise.test_national', false]
		]);
		expect(offers[0]?.effects).toEqual(['Soutien : Possédants + 2']);
		const promised = commit(declared, [pledge('promise.test_tax')]).state;
		const elected = commit(advanceTo(promised, 40)).state;
		const view = projectView(elected, [prepare('pledge.1')], catalog);
		expect(view.career.promises.offers).toEqual([]);
		expect(view.career.promises.pledges[0]).toMatchObject({
			label: 'Baisser les impôts',
			status: 'En cours',
			inProgress: true,
			preparePlanned: true
		});
		expect(view.career.promises.pledges[0]?.detail).toMatch(/Échéance : T3 2011/);
		const journal = JSON.stringify(projectView(elected, [], catalog).journal);
		expect(journal).toContain('« Baisser les impôts » : élu, place à la réalisation');
	});
});

describe('validation du catalogue', () => {
	const issues = (overrides: Partial<RawContent>): string[] => {
		const result = validateContent(raw(overrides));
		return result.ok ? [] : result.issues.map((issue) => issue.message);
	};

	it('réserve les effets de promesse à leurs cibles et aux événements de sujet « promise »', () => {
		const wrongAction = {
			actions: [
				...fixtureActions.actions,
				{ ...promiseActions[0]!, id: 'test.bad', effects: [{ op: 'abandonPromise' }] }
			]
		};
		expect(issues({ actions: wrongAction }).join(' ')).toMatch(/compromis et renoncement/);
		const dilemma = fixtureEvents['events/promises.json'].events[0]!;
		const noSubject = {
			...fixtureEvents,
			'events/promises.json': {
				events: [
					{ ...dilemma, subject: undefined },
					...fixtureEvents['events/promises.json'].events.slice(1)
				]
			}
		};
		const messages = issues({ events: noSubject }).join(' ');
		expect(messages).toMatch(/réservé aux événements de sujet/);
		expect(messages).toMatch(/dilemme doit être un événement bloquant/);
	});

	it('refuse une élection inconnue, un effet incertain et un dilemme trop tardif', () => {
		const promise = fixturePromises.promises[0]!;
		const broken = {
			balance: { ...fixturePromises.balance, dilemmaDelayTurns: { min: 2, max: 6 } },
			promises: [
				{
					...promise,
					elections: ['election.unknown'],
					kept: [{ op: 'addResourceRandom', resource: 'influence', min: 1, max: 2 }]
				},
				...fixturePromises.promises.slice(1)
			]
		};
		const messages = issues({ promises: broken }).join(' ');
		expect(messages).toMatch(/élection inconnue/);
		expect(messages).toMatch(/effets certains/);
		expect(messages).toMatch(/avant l’échéance/);
	});
});
