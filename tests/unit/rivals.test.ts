import { describe, expect, it } from 'vitest';
import type { Content } from '../../src/lib/game/content/types.ts';
import { validateContent } from '../../src/lib/game/content/validate.ts';
import {
	campaignPoll,
	checkInvariants,
	commitTurn,
	createGame,
	opponentStrength,
	transition,
	type Campaign,
	type GameState,
	type PlanStep
} from '../../src/lib/game/engine/index.ts';
import { projectView } from '../../src/lib/game/app/view-model.ts';
import {
	fixtureActions,
	fixtureBalance,
	fixtureCareer,
	fixtureCast,
	fixtureEntourage,
	fixtureEvents,
	fixtureProfiles,
	fixtureJustice,
	fixtureWealth,
	fixturePromises,
	fixtureMedia,
	fixtureSupports,
	fixtureTraits,
	fixtureUpgrades,
	fixtureWorld
} from '../fixtures/content.ts';

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

/** Distribution de test avec un rival nommé, sans parti. */
const castWithRival = {
	cast: [
		...fixtureCast.cast,
		{ id: 'test.rival', name: 'Rival Test', tags: ['politician', 'rival'], age: 40 }
	]
};

function load(cast: unknown = castWithRival): Content {
	const result = validateContent({
		actions: { actions: [...fixtureActions.actions, declareAction] },
		upgrades: fixtureUpgrades,
		balance: fixtureBalance,
		cast,
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
		media: fixtureMedia
	});
	if (!result.ok) throw new Error(JSON.stringify(result.issues, null, 2));
	return result.content;
}

const catalog = load();
const declare = (ballotId: string): PlanStep => ({
	kind: 'action',
	id: 'campaign.declare',
	target: ballotId
});

function commit(state: GameState, steps: PlanStep[] = [], used = catalog): GameState {
	const result = transition(state, commitTurn({ steps }), used);
	if (!result.ok) throw new Error(result.error.message);
	expect(checkInvariants(result.state, used)).toEqual([]);
	return result.state;
}

function advanceTo(state: GameState, turn: number, used = catalog): GameState {
	let current = state;
	while (current.turn < turn) current = commit(current, [], used);
	return current;
}

function withTraits(state: GameState, id: string, traits: string[], known: string[]): GameState {
	return {
		...state,
		characters: {
			...state.characters,
			[id]: { ...state.characters[id]!, traits, knownTraits: known }
		}
	};
}

describe('adversaire nommé', () => {
	it('est attribué à la frontière qui suit la déclaration, et rencontré', () => {
		const declared = commit(createGame({ seed: 'adversaire' }, catalog), [declare('ballot.1')]);
		const campaign = declared.campaigns[0]!;
		expect(campaign.opponentId).toBe('test.rival');
		expect(declared.relationships['test.rival']).toMatchObject({ attitude: 0, metTurn: 1 });
		const view = projectView(declared, [], catalog).career.calendar[0]!.campaign!;
		expect(view.opponent).toBe('Rival Test (sans étiquette)');
	});

	it('se génère, d’un autre parti que le joueur, quand aucun rival n’est disponible', () => {
		const noRival = load(fixtureCast);
		const base = createGame({ seed: 'généré' }, noRival);
		const member = {
			...base,
			player: {
				...base.player,
				partyId: 'party.right',
				affiliations: [{ partyId: 'party.right', fromTurn: 0, toTurn: null }]
			}
		};
		const declared = commit(member, [declare('ballot.1')], noRival);
		const opponent = declared.characters[declared.campaigns[0]!.opponentId!]!;
		expect(opponent.tags).toEqual(['politician', 'rival']);
		expect(opponent.partyId).toBe('party.left');
		expect(opponent.status).toBe('active');
	});

	it('revient à l’élection suivante du même type : un rival récurrent', () => {
		let state = commit(createGame({ seed: 'récurrent' }, catalog), [declare('ballot.1')]);
		state = advanceTo(state, 41);
		const next = state.ballots.find(
			(ballot) => ballot.electionId === 'election.local' && ballot.status === 'scheduled'
		)!;
		state = commit(advanceTo(state, next.filingClosesTurn - 1), [declare(next.ballotId)]);
		expect(state.campaigns.map((campaign) => campaign.opponentId)).toEqual([
			'test.rival',
			'test.rival'
		]);
		const view = projectView(state, [], catalog).career.calendar.find(
			(ballot) => ballot.ballotId === next.ballotId
		)!.campaign!;
		expect(view.opponent).toContain('déjà affronté 1 fois');
	});

	it('n’est jamais un personnage parti : un adversaire décédé est remplacé avant le scrutin', () => {
		const declared = commit(createGame({ seed: 'remplacé' }, catalog), [declare('ballot.1')]);
		const dead: GameState = {
			...declared,
			characters: {
				...declared.characters,
				'test.rival': { ...declared.characters['test.rival']!, status: 'dead', leftTurn: 1 }
			}
		};
		expect(checkInvariants(dead, catalog).join('\n')).toContain(
			'adversaire parti encore en campagne'
		);
		const next = commit(dead);
		const opponent = next.characters[next.campaigns[0]!.opponentId!]!;
		expect(opponent.id).not.toBe('test.rival');
		expect(opponent.status).toBe('active');
	});
});

describe('force et relation de l’adversaire', () => {
	const base = createGame({ seed: 'force' }, catalog);
	const campaign: Campaign = {
		campaignId: 'campaign.1',
		ballotId: 'ballot.1',
		electionId: 'election.local',
		declaredTurn: 0,
		partyId: null,
		invested: false,
		preparation: 0,
		opponentId: 'test.rival',
		status: 'running',
		playerPercent: null,
		reason: null
	};

	it('additionne force de base, expérience plafonnée et traits ; le sondage ignore les traits cachés', () => {
		const state = withTraits(base, 'test.rival', ['trait.grudge', 'trait.open'], []);
		expect(opponentStrength(campaign, state.characters, [], catalog)).toBe(32);
		expect(opponentStrength(campaign, state.characters, [], catalog, true)).toBe(30);
		const lost = (id: string): Campaign => ({
			...campaign,
			campaignId: id,
			status: 'lost',
			playerPercent: 40
		});
		const history = [
			lost('campaign.2'),
			lost('campaign.3'),
			lost('campaign.4'),
			lost('campaign.5')
		];
		// Trois points par victoire, plafonnés à trois victoires.
		expect(opponentStrength(campaign, state.characters, history, catalog)).toBe(32 + 9);
		const poll = campaignPoll(
			campaign,
			state.player,
			state.world,
			state.mandates,
			catalog,
			state.characters,
			[]
		);
		const known = withTraits(state, 'test.rival', ['trait.grudge', 'trait.open'], ['trait.open']);
		const informed = campaignPoll(
			campaign,
			known.player,
			known.world,
			known.mandates,
			catalog,
			known.characters,
			[]
		);
		expect(informed.max).toBeLessThan(poll.max);
	});

	it('se souvient de chaque affrontement et s’éloigne du joueur', () => {
		let state = commit(withTraits(base, 'test.rival', ['trait.open'], ['trait.open']), [
			declare('ballot.1')
		]);
		state = advanceTo(state, 41);
		const result = state.campaigns[0]!;
		expect(result.status === 'won' || result.status === 'lost').toBe(true);
		const relationship = state.relationships['test.rival']!;
		expect(relationship.attitude).toBe(-8);
		expect(relationship.memories).toEqual([
			{
				turn: 41,
				text: `Élection locale (T1 2010) : votre ${result.status === 'won' ? 'victoire' : 'défaite'}.`,
				tone: 'negative'
			}
		]);
		expect(projectView(state, [], catalog).career.pastCampaigns[0]?.outcome).toContain(
			'face à Rival Test'
		);
	});
});
