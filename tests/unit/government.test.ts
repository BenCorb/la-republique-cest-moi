import { describe, expect, it } from 'vitest';
import type { Content } from '../../src/lib/game/content/types.ts';
import {
	applyCareerEffect,
	careerEffectIssue,
	cohabitation,
	createGame,
	createRng,
	governmentStature,
	primeMinisterId,
	resolveGovernment,
	resolveWorld,
	type CareerParts,
	type GameState
} from '../../src/lib/game/engine/index.ts';
import { fixtureContent } from '../fixtures/content.ts';

const content = fixtureContent;

function career(state: GameState): CareerParts {
	return {
		mandates: state.mandates,
		ballots: state.ballots,
		campaigns: state.campaigns,
		institutions: state.institutions,
		promises: state.promises,
		investitures: state.investitures,
		appointment: state.appointment
	};
}

/** Membre influent et populaire du parti au gouvernement. */
function heavyweight(popularity = 60): GameState {
	const base = createGame({ seed: 'gouvernement' }, content);
	const partyId = base.world.governingPartyId;
	return {
		...base,
		resources: { ...base.resources, influence: 100 },
		player: {
			...base.player,
			partyId,
			affiliations: [{ partyId, fromTurn: 0, toTurn: null }],
			popularity
		}
	};
}

describe('gouvernement (P3-35)', () => {
	it('crée un président du monde et nomme le Premier ministre dans la majorité', () => {
		const state = createGame({ seed: 'exécutif' }, content);
		expect(state.characters[state.world.president.characterId]?.tags).toContain('president');
		expect(primeMinisterId(state.world)).toBe(
			state.world.parties[state.world.governingPartyId]?.leaderId
		);
		expect(cohabitation(state.world)).toBe(
			state.world.president.partyId !== state.world.governingPartyId
		);
	});

	it('réélit ou remplace le président à l’échéance, une seule fois', () => {
		const state = createGame({ seed: 'présidentielle' }, content);
		const end = state.world.president.termEndTurn;
		const before = resolveWorld(state.world, state.characters, end, state.rng, content);
		expect(before.record.president).toBeNull();
		const after = resolveWorld(state.world, state.characters, end + 1, state.rng, content);
		expect(after.record.president).not.toBeNull();
		expect(after.world.president.termEndTurn).toBe(
			end + content.balance.government.presidentTermTurns
		);
	});

	it('propose un portefeuille après des législatives à qui en a la stature', () => {
		const state = heavyweight();
		expect(governmentStature(state.player, 100, career(state), content)).toBeGreaterThanOrEqual(
			content.balance.government.ministerStature
		);
		const formed = resolveGovernment(
			career(state),
			state.player,
			state.world,
			100,
			{ legislative: true },
			10,
			createRng('formation'),
			content
		);
		expect(formed.career.appointment).toMatchObject({
			mandateId: 'mandate.minister',
			offeredTurn: 10,
			reshuffle: false
		});
		expect(content.portfolioIds).toContain(formed.career.appointment!.portfolio);
		// Rien sans législatives ni remaniement.
		const quiet = resolveGovernment(
			career(state),
			state.player,
			state.world,
			100,
			{ legislative: false },
			10,
			createRng('calme'),
			content
		);
		expect(quiet.career.appointment).toBeNull();
	});

	it('accepte le portefeuille, ou le décline, une seule fois', () => {
		const state = heavyweight();
		const offered = resolveGovernment(
			career(state),
			state.player,
			state.world,
			100,
			{ legislative: true },
			10,
			createRng('choix'),
			content
		).career;
		const accept = { op: 'appointment', decision: 'accept' } as const;
		expect(careerEffectIssue(accept, offered, content, state.player, 11)).toBeNull();
		const accepted = applyCareerEffect(accept, offered, 11, null, content, state.player).parts;
		expect(accepted.appointment).toBeNull();
		expect(accepted.mandates.at(-1)).toMatchObject({
			mandateId: 'mandate.minister',
			portfolio: offered.appointment!.portfolio,
			status: 'active'
		});
		// Une seconde réponse n'a plus d'effet.
		expect(applyCareerEffect(accept, accepted, 11, null, content, state.player).parts).toEqual(
			accepted
		);
		const declined = applyCareerEffect(
			{ op: 'appointment', decision: 'decline' },
			offered,
			11,
			null,
			content,
			state.player
		).parts;
		expect(declined.appointment).toBeNull();
		expect(declined.mandates).toEqual(offered.mandates);
	});

	it('remercie au remaniement un ministre devenu impopulaire', () => {
		const state = heavyweight(10);
		const minister: CareerParts = {
			...career(state),
			mandates: [
				{
					instanceId: 'term.1',
					mandateId: 'mandate.minister',
					startTurn: 0,
					access: 'nomination',
					status: 'active',
					endTurn: null,
					endReason: null,
					side: null,
					portfolio: 'portfolio.test_a'
				}
			]
		};
		const rules: Content = {
			...content,
			balance: {
				...content.balance,
				government: { ...content.balance.government, reshuffleChancePercent: 100 }
			}
		};
		const shaken = resolveGovernment(
			minister,
			state.player,
			{ ...state.world, indicators: { ...state.world.indicators, stability: 20 } },
			100,
			{ legislative: false },
			5,
			createRng('remaniement'),
			rules
		);
		expect(shaken.career.mandates[0]).toMatchObject({ status: 'ended', endReason: 'removed' });
	});
});
