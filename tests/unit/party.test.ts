import { describe, expect, it } from 'vitest';
import type { Content } from '../../src/lib/game/content/types.ts';
import {
	applyPoliticalEffect,
	congressAppraisal,
	createGame,
	createRng,
	resolvePartyCareer,
	resolveWorld,
	type GameState,
	type PlayerState
} from '../../src/lib/game/engine/index.ts';
import { nextCongressAfter, partyBidIssue } from '../../src/lib/game/engine/world.ts';
import { fixtureContent } from '../fixtures/content.ts';

/** Catalogue de test dont la chance de congrès et de promotion est forcée. */
function withRules(overrides: Partial<Content['balance']['partyCareer']>): Content {
	return {
		...fixtureContent,
		balance: {
			...fixtureContent.balance,
			partyCareer: { ...fixtureContent.balance.partyCareer, ...overrides }
		}
	};
}

const APPARATUS = fixtureContent.balance.campaigns.apparatusGroup;

function joined(content: Content, apparatus = 60, activists = 400): GameState {
	const base = createGame({ seed: 'parti' }, content);
	const member = applyPoliticalEffect(
		{ op: 'joinParty', party: 'party.left' },
		base.player,
		base.world,
		0,
		null,
		content
	).player;
	return {
		...base,
		player: { ...member, activists, supports: { ...member.supports, [APPARATUS]: apparatus } }
	};
}

function frontier(player: PlayerState, state: GameState, turn: number, content: Content) {
	return resolvePartyCareer(player, state.world, 50, turn, createRng(`p${turn}`), content);
}

describe('carrière partisane (P3-34)', () => {
	it('fait d’un adhérent un militant, avec son prochain congrès', () => {
		const state = joined(fixtureContent);
		const career = state.player.partyCareer!;
		expect(career).toMatchObject({ rank: 'member', bid: null, retryTurn: null });
		expect(career.nextCongressTurn).toBe(nextCongressAfter(0, fixtureContent));
		expect(career.nextCongressTurn % 12).toBe(6);
		// Rendre sa carte efface la carrière partisane.
		const left = applyPoliticalEffect(
			{ op: 'leaveParty' },
			state.player,
			state.world,
			1,
			null,
			fixtureContent
		).player;
		expect(left.partyCareer).toBeNull();
	});

	it('promeut un militant installé en cadre, par opportunité', () => {
		const content = withRules({ cadreChancePercent: 100 });
		const state = joined(content);
		expect(frontier(state.player, state, 2, content).player.partyCareer?.rank).toBe('member');
		const promoted = frontier(state.player, state, 4, content);
		expect(promoted.player.partyCareer?.rank).toBe('cadre');
		expect(promoted.changes).toContainEqual({
			kind: 'partyRank',
			partyId: 'party.left',
			rank: 'cadre',
			reason: 'promotion'
		});
	});

	it('réserve la candidature à la direction aux cadres, avec une posture', () => {
		const state = joined(fixtureContent);
		expect(partyBidIssue(state.player, 1)).toMatch(/cadre/u);
		const cadre: PlayerState = {
			...state.player,
			partyCareer: { ...state.player.partyCareer!, rank: 'cadre' }
		};
		expect(partyBidIssue(cadre, 1)).toBeNull();
		const bid = applyPoliticalEffect(
			{ op: 'partyBid', posture: 'rupture' },
			cadre,
			state.world,
			1,
			null,
			fixtureContent
		).player;
		expect(bid.partyCareer?.bid).toEqual({ posture: 'rupture', rallies: 0 });
		const rallied = applyPoliticalEffect(
			{ op: 'rallySupport', value: 1 },
			bid,
			state.world,
			1,
			null,
			fixtureContent
		).player;
		expect(rallied.partyCareer?.bid?.rallies).toBe(1);
		// Appréciation qualitative, sans chiffre.
		const appraisal = congressAppraisal(rallied, 50, fixtureContent);
		expect(['Favori du congrès', 'Congrès ouvert', 'Candidature d’outsider']).toContain(
			appraisal.label
		);
	});

	it('au congrès, fait gagner ou perdre une candidature, une seule fois', () => {
		const state = joined(fixtureContent);
		const congress = state.player.partyCareer!.nextCongressTurn;
		const bidder: PlayerState = {
			...state.player,
			partyCareer: {
				...state.player.partyCareer!,
				rank: 'cadre',
				bid: { posture: 'apparatus', rallies: 2 }
			}
		};
		const won = frontier(
			bidder,
			state,
			congress,
			withRules({ minChancePercent: 100, maxChancePercent: 100 })
		);
		expect(won.player.partyCareer).toMatchObject({
			rank: 'leader',
			bid: null,
			nextCongressTurn: congress + 12
		});
		const lost = frontier(
			bidder,
			state,
			congress,
			withRules({ minChancePercent: 0, maxChancePercent: 0 })
		);
		expect(lost.player.partyCareer).toMatchObject({ rank: 'cadre', bid: null });
		expect(lost.player.partyCareer?.retryTurn).toBe(congress + 24);
		expect(lost.player.supports[APPARATUS]).toBeLessThan(bidder.supports[APPARATUS]!);
		// Délai : pas de nouvelle candidature au congrès suivant.
		expect(partyBidIssue(lost.player, congress + 1)).toMatch(/attend un congrès/u);
	});

	it('renverse un chef qui a perdu l’appareil', () => {
		const content = withRules({ leaderOustChancePercent: 100 });
		const state = joined(content, 10);
		const leader: PlayerState = {
			...state.player,
			partyCareer: { ...state.player.partyCareer!, rank: 'leader' }
		};
		const ousted = frontier(leader, state, leader.partyCareer!.nextCongressTurn, content);
		expect(ousted.player.partyCareer?.rank).toBe('cadre');
		expect(ousted.changes[0]).toMatchObject({ kind: 'partyRank', reason: 'ousted' });
	});

	it('ne renouvelle plus la direction d’un parti dirigé par le joueur', () => {
		const content: Content = {
			...fixtureContent,
			balance: {
				...fixtureContent.balance,
				world: { ...fixtureContent.balance.world, leaderChangeChance: 1 }
			}
		};
		const state = createGame({ seed: 'direction' }, content);
		const before = state.world.parties['party.left']!.leaderId;
		const led = resolveWorld(state.world, state.characters, 1, state.rng, content, 'party.left');
		expect(led.world.parties['party.left']!.leaderId).toBe(before);
		const free = resolveWorld(state.world, state.characters, 1, state.rng, content, null);
		expect(free.world.parties['party.left']!.leaderId).not.toBe(before);
	});
});
