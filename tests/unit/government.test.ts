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
import { loadContent } from '../../src/lib/game/content/load.ts';
import { evaluateCondition } from '../../src/lib/game/engine/conditions.ts';

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
		},
		// Député élu (P3-09) : on n'entre au gouvernement qu'avec un parcours électif.
		mandates: [
			{
				instanceId: 'term.1',
				mandateId: 'mandate.deputy',
				startTurn: 0,
				access: 'election',
				status: 'active',
				endTurn: null,
				endReason: null,
				side: null,
				portfolio: null
			}
		]
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

	it('appelle à Matignon le chef du parti majoritaire, renversé ou remercié selon le contexte (P3-36)', () => {
		const state = heavyweight();
		const leader = {
			...state.player,
			partyCareer: {
				rank: 'leader' as const,
				rankSince: 0,
				nextCongressTurn: 6,
				bid: null,
				retryTurn: null
			}
		};
		const formed = resolveGovernment(
			career(state),
			leader,
			state.world,
			100,
			{ legislative: true },
			10,
			createRng('matignon'),
			content
		);
		expect(formed.career.appointment).toMatchObject({
			mandateId: 'mandate.prime_minister',
			portfolio: null
		});
		// Catalogue réel : la censure et le renvoi visent un Premier ministre fragilisé.
		const real = loadContent();
		const base = createGame({ seed: 'censure' }, real);
		const office = {
			instanceId: 'term.1',
			mandateId: 'mandate.prime_minister',
			startTurn: 0,
			access: 'nomination' as const,
			status: 'active' as const,
			endTurn: null,
			endReason: null,
			side: null,
			portfolio: null
		};
		const context = (stability: number, popularity: number) => ({
			...base,
			mandates: [office],
			world: { ...base.world, indicators: { ...base.world.indicators, stability } },
			player: { ...base.player, popularity }
		});
		const when = (id: string) => {
			const event = real.events[id]!;
			return event.when!;
		};
		expect(evaluateCondition(context(20, 50), when('matignon.censure_adopted'))).toBe(true);
		expect(evaluateCondition(context(60, 50), when('matignon.censure_adopted'))).toBe(false);
		expect(evaluateCondition(context(60, 20), when('matignon.dismissed'))).toBe(true);
		expect(evaluateCondition(context(60, 50), when('matignon.dismissed'))).toBe(false);
	});

	it('ouvre à chaque portefeuille sa crise propre (P3-35)', () => {
		const real = loadContent();
		const base = createGame({ seed: 'crises' }, real);
		for (const portfolio of real.portfolioIds) {
			const crises = real.eventIds.filter((id) =>
				JSON.stringify(real.events[id]?.when ?? null).includes(`"portfolio":"${portfolio}"`)
			);
			expect(crises.length, portfolio).toBeGreaterThanOrEqual(1);
			const minister = {
				...base,
				mandates: [
					{
						instanceId: 'term.1',
						mandateId: 'mandate.minister',
						startTurn: 0,
						access: 'nomination' as const,
						status: 'active' as const,
						endTurn: null,
						endReason: null,
						side: null,
						portfolio
					}
				]
			};
			for (const id of crises) {
				expect(evaluateCondition(minister, real.events[id]!.when!), id).toBe(true);
			}
		}
	});

	it('rend chaque scène du gouvernement et de Matignon possible dans son contexte (P3-09)', () => {
		const real = loadContent();
		const base = createGame({ seed: 'scènes' }, real);
		const office = (mandateId: string, portfolio: string | null) => ({
			instanceId: 'term.1',
			mandateId,
			startTurn: 0,
			access: 'nomination' as const,
			status: 'active' as const,
			endTurn: null,
			endReason: null,
			side: null,
			portfolio
		});
		const contexts = [
			...real.portfolioIds.map((portfolio) => office('mandate.minister', portfolio)),
			office('mandate.secretary_of_state', null),
			office('mandate.prime_minister', null)
		].flatMap((mandate) =>
			[20, 35, 60].flatMap((stability) =>
				[20, 60].map((popularity) => ({
					...base,
					turn: 4,
					mandates: [mandate],
					world: { ...base.world, indicators: { ...base.world.indicators, stability } },
					player: { ...base.player, popularity }
				}))
			)
		);
		const scenes = real.eventIds.filter(
			(id) =>
				id.startsWith('government.') ||
				id.startsWith('matignon.') ||
				id === 'unique.pm_first_night' ||
				id === 'mandate.evening_news_gaffe'
		);
		for (const id of scenes) {
			const when = real.events[id]!.when;
			if (!when) continue;
			// Les tentations exigent aussi la capacité « fonction publique », accordée par la fonction.
			expect(
				contexts.some((context) => evaluateCondition(context, when)),
				id
			).toBe(true);
		}
	});
});
