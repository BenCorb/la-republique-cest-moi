import { describe, expect, it } from 'vitest';
import {
	checkInvariants,
	chooseEventCommand,
	commitTurn,
	createGame,
	describePendingEvent,
	transition,
	type BallotReport,
	type GameState,
	type PlanStep,
	withPopularity
} from '../../src/lib/game/engine/index.ts';
import {
	contestRules,
	highestAverage,
	perMille,
	runFirstRound,
	runSecondRound,
	type ContestInput
} from '../../src/lib/game/engine/ballots.ts';
import { createRng } from '../../src/lib/game/engine/random.ts';
import { validateContent } from '../../src/lib/game/content/validate.ts';
import type { Content } from '../../src/lib/game/content/types.ts';
import {
	fixtureActions,
	fixtureBalance,
	fixtureCareer,
	fixtureCast,
	fixtureContent,
	fixtureEntourage,
	fixtureEpitaphs,
	fixtureEvents,
	fixtureInstitutions,
	fixtureJustice,
	fixtureMedia,
	fixtureProfiles,
	fixturePromises,
	fixtureSupports,
	fixtureTraits,
	fixtureUpgrades,
	fixtureWealth,
	fixtureWorld
} from '../fixtures/content.ts';

const content = fixtureContent;
const local = content.elections['election.local']!;
const national = content.elections['election.national']!;
const territory = createGame({ seed: 'territoire' }, content).player.territory;

function input(definition = local, shares = [40, 35, 25]): ContestInput {
	return {
		definition,
		shares: ['party.left', 'party.right', 'party.small'].map((partyId, index) => ({
			partyId,
			percent: shares[index]!
		})),
		territory,
		entry: null
	};
}

describe('arithmétique électorale', () => {
	it('répartit 1000 ‰ aux plus forts restes', () => {
		expect(perMille([1, 1, 1])).toEqual([334, 333, 333]);
		expect(perMille([3, 1])).toEqual([750, 250]);
	});

	it('attribue les sièges à la plus forte moyenne', () => {
		// Exemple classique : 7 sièges, d'Hondt.
		expect(highestAverage([340, 280, 160, 60], 7)).toEqual([3, 3, 1, 0]);
	});
});

describe('procès-verbal sans le joueur', () => {
	it('établit un scrutin de liste complet : parts, prime majoritaire et sièges d’opposition', () => {
		const rules = contestRules(local, territory, content);
		const { report } = runFirstRound(input(), rules, createRng('pv'), content);
		expect(report.stage).toBe('final');
		expect(report.contestants.reduce((sum, c) => sum + c.firstRound, 0)).toBe(1000);
		expect(report.contestants.reduce((sum, c) => sum + c.seats, 0)).toBe(rules.seats);
		const winner = report.contestants.find((c) => c.contestantId === report.winnerId)!;
		// Prime de la moitié des sièges, arrondie au-dessus, plus sa part du reste.
		expect(winner.seats).toBeGreaterThanOrEqual(Math.ceil(rules.seats / 2));
		expect(report.playerElected).toBeNull();
		expect(report.playerContestantId).toBeNull();
	});

	it('ouvre le second tour aux listes d’au moins 10 %, en l’absence de majorité', () => {
		const rules = contestRules(local, territory, content);
		const { report } = runFirstRound(input(local, [34, 33, 33]), rules, createRng('t'), content);
		expect(report.secondRound).toBe(true);
		expect(report.stage).toBe('final');
		const present = report.contestants.filter((c) => c.secondRound !== null);
		expect(present.length).toBeGreaterThanOrEqual(2);
		expect(present.reduce((sum, c) => sum + (c.secondRound ?? 0), 0)).toBe(1000);
	});

	it('élit un seul député au scrutin uninominal', () => {
		const rules = contestRules(national, territory, content);
		const { report } = runFirstRound(input(national), rules, createRng('dep'), content);
		expect(report.system).toBe('single');
		expect(report.contestants.reduce((sum, c) => sum + c.seats, 0)).toBe(1);
	});
});

describe('second tour et décision du joueur', () => {
	const pending: BallotReport = {
		place: 'Testville',
		system: 'list',
		seats: 15,
		turnout: 60,
		contestants: [
			['c.1', null, true, 300],
			['c.2', 'party.left', false, 400],
			['c.3', 'party.right', false, 220],
			['c.4', 'party.small', false, 80]
		].map(([id, partyId, player, first]) => ({
			contestantId: id as string,
			partyId: partyId as string | null,
			leaderId: null,
			player: player as boolean,
			dissident: false,
			firstRound: first as number,
			secondRound: null,
			seats: 0,
			status: (first as number) >= 100 ? ('qualified' as const) : ('eliminated' as const),
			mergedInto: null
		})),
		stage: 'runoff_pending',
		secondRound: true,
		winnerId: null,
		playerContestantId: 'c.1',
		playerRank: 1,
		playerElected: null
	};
	const rules = contestRules(local, territory, content);

	it('retire le joueur qui se désiste : aucun siège, ses voix se reportent', () => {
		const { report } = runSecondRound(pending, rules, 'withdraw', createRng('w'), content);
		const own = report.contestants.find((c) => c.player)!;
		expect(own.status).toBe('withdrawn');
		expect(own.seats).toBe(0);
		expect(report.playerElected).toBe(false);
		expect(report.contestants.reduce((sum, c) => sum + (c.secondRound ?? 0), 0)).toBe(1000);
	});

	it('fusionne la liste du joueur dans la plus proche, qui mène si elle est plus forte', () => {
		const { report } = runSecondRound(pending, rules, 'merge', createRng('m'), content);
		const own = report.contestants.find((c) => c.player)!;
		expect(own.status).toBe('merged');
		expect(report.playerContestantId).toBe(own.mergedInto);
		expect(report.playerRank).toBeGreaterThan(1);
	});

	it('maintient le joueur et fait suivre aux autres leurs affinités', () => {
		const { report } = runSecondRound(pending, rules, 'maintain', createRng('k'), content);
		const own = report.contestants.find((c) => c.player)!;
		expect(own.secondRound).not.toBeNull();
		// La petite liste, sous 10 % mais au-dessus de 5 %, rejoint un allié ou disparaît.
		expect(['merged', 'eliminated']).toContain(report.contestants[3]!.status);
		expect(report.contestants.reduce((sum, c) => sum + c.seats, 0)).toBe(15);
	});
});

describe('second tour en partie', () => {
	const steps: PlanStep[] = [{ kind: 'action', id: 'campaign.declare', target: 'ballot.1' }];
	const declareAction = {
		id: 'campaign.declare',
		label: 'Se présenter',
		description: 'Déposer sa candidature.',
		timeCost: 10,
		maxPerTurn: 1,
		costs: [],
		effects: [{ op: 'declareCandidacy' }],
		target: 'ballot'
	};
	function load(): Content {
		const result = validateContent({
			actions: { actions: [...fixtureActions.actions, declareAction] },
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
			epitaphs: fixtureEpitaphs
		});
		if (!result.ok) throw new Error(JSON.stringify(result.issues));
		return result.content;
	}
	const catalog = load();

	function untilRunoff(seed: string): GameState {
		// Candidat populaire : la liste du joueur dispute la première place.
		const start = createGame({ seed }, catalog);
		let state: GameState = {
			...start,
			player: withPopularity(
				{ ...start.player, supports: { ...start.player.supports, 'support.workers': 70 } },
				catalog
			)
		};
		const declared = transition(state, commitTurn({ steps }), catalog);
		if (!declared.ok) throw new Error(declared.error.message);
		state = declared.state;
		while (state.phase === 'planning' && state.turn <= 41) {
			const result = transition(state, commitTurn(), catalog);
			if (!result.ok) throw new Error(result.error.message);
			state = result.state;
		}
		return state;
	}

	// Première seed sans majorité au premier tour (recherche déterministe).
	function firstRunoff(): GameState {
		for (let index = 0; index < 40; index += 1) {
			const state = untilRunoff(`second-tour-${index}`);
			if (state.ballots[0]?.report?.stage === 'runoff_pending') return state;
		}
		throw new Error('aucun second tour en 40 seeds');
	}

	it('suspend le second tour à la décision du joueur, puis le tranche une seule fois', () => {
		const waiting = firstRunoff();
		expect(waiting.ballots[0]?.report?.stage).toBe('runoff_pending');
		expect(waiting.campaigns[0]?.status).toBe('running');
		expect(checkInvariants(waiting, catalog)).toEqual([]);
		const view = describePendingEvent(waiting, catalog)!;
		expect(view.eventId).toBe('test.runoff');
		expect(view.choices.find((choice) => choice.id === 'maintain')?.available).toBe(true);
		const decided = transition(waiting, chooseEventCommand(view.instanceId, 'maintain'), catalog);
		if (!decided.ok) throw new Error(decided.error.message);
		const state = decided.state;
		expect(state.ballots[0]?.report?.stage).toBe('final');
		expect(state.campaigns[0]?.status).not.toBe('running');
		expect(state.campaigns[0]?.resultTurn).toBe(state.turn);
		expect(checkInvariants(state, catalog)).toEqual([]);
		// Rejouer la même décision est refusé : aucune double résolution.
		expect(transition(state, chooseEventCommand(view.instanceId, 'maintain'), catalog).ok).toBe(
			false
		);
	});
});
