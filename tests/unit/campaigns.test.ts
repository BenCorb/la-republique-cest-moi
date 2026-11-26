import { describe, expect, it } from 'vitest';
import type { Content } from '../../src/lib/game/content/types.ts';
import { validateContent } from '../../src/lib/game/content/validate.ts';
import {
	campaignPoll,
	campaignRefund,
	candidacyIssue,
	checkInvariants,
	commitTurn,
	createGame,
	previewPlan,
	transition,
	withPopularity,
	type Campaign,
	type GameState,
	type MandateInstance,
	type PlanStep,
	type TransitionSuccess
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
	fixtureInstitutions,
	fixtureSupports,
	fixtureTraits,
	fixtureUpgrades,
	fixtureWorld,
	quarterLog,
	withEvents
} from '../fixtures/content.ts';

const campaignActions = [
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
		id: 'campaign.canvass',
		label: 'Porte-à-porte',
		description: 'Préparer la campagne.',
		timeCost: 20,
		maxPerTurn: 1,
		costs: [],
		requires: { op: 'gte', stat: 'player.campaigning', value: 1 },
		unavailableReason: 'Il faut être en campagne.',
		effects: [{ op: 'prepareCampaign', value: 5 }]
	}
];

const dissolution = {
	events: [
		{
			id: 'test.dissolution',
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

function load(balance: unknown = fixtureBalance): Content {
	const result = validateContent({
		actions: { actions: [...fixtureActions.actions, ...campaignActions] },
		upgrades: fixtureUpgrades,
		balance,
		cast: fixtureCast,
		events: { ...fixtureEvents, 'events/dissolution.json': dissolution },
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
		institutions: fixtureInstitutions
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
const canvass: PlanStep = { kind: 'action', id: 'campaign.canvass' };

function commit(state: GameState, steps: PlanStep[] = [], used = catalog): TransitionSuccess {
	const result = transition(state, commitTurn({ steps }), used);
	if (!result.ok) throw new Error(result.error.message);
	expect(checkInvariants(result.state, used)).toEqual([]);
	return result;
}

function advanceTo(state: GameState, turn: number, steps: PlanStep[] = [], used = catalog) {
	let current = state;
	while (current.turn < turn) current = commit(current, steps, used).state;
	return current;
}

function councillor(state: GameState): GameState {
	const mandate: MandateInstance = {
		instanceId: 'term.1',
		mandateId: 'mandate.councillor',
		startTurn: state.turn,
		access: 'election',
		status: 'active',
		endTurn: null,
		endReason: null
	};
	return { ...state, mandates: [mandate] };
}

function withSupport(state: GameState, group: string, value: number): GameState {
	const player = { ...state.player, supports: { ...state.player.supports, [group]: value } };
	return { ...state, player: withPopularity(player, catalog) };
}

function member(state: GameState, partyId: string): GameState {
	return {
		...state,
		player: { ...state.player, partyId, affiliations: [{ partyId, fromTurn: 0, toTurn: null }] }
	};
}

describe('candidature', () => {
	const base = createGame({ seed: 'candidature' }, catalog);
	const parts = (state: GameState) => ({
		mandates: state.mandates,
		ballots: state.ballots,
		campaigns: state.campaigns,
		institutions: state.institutions,
		promises: state.promises
	});

	it('s’ouvre jusqu’à la clôture, sous conditions d’âge et de mandat', () => {
		expect(candidacyIssue('ballot.1', parts(base), base.player, 0, catalog)).toBeNull();
		expect(candidacyIssue('ballot.1', parts(base), base.player, 39, catalog)).toBe(
			'Les candidatures sont closes.'
		);
		// Élection nationale : 30 ans au scrutin (le joueur en aura 40) et un siège local exigé.
		expect(candidacyIssue('ballot.2', parts(base), base.player, 0, catalog)).toBe(
			'Il faut exercer l’un de ces mandats : Siège local.'
		);
		const young = { ...base.player, birthTurn: 60 - 29 * 4 };
		expect(candidacyIssue('ballot.2', parts(base), young, 0, catalog)).toBe(
			'Il faut avoir 30 ans le jour du scrutin.'
		);
		expect(candidacyIssue('ballot.9', parts(base), base.player, 0, catalog)).toBe(
			'Aucune élection programmée à cette date.'
		);
	});

	it('se déclare depuis le plan, avec ou sans investiture, une seule fois par échéance', () => {
		const independent = commit(base, [declare('ballot.1')]);
		expect(independent.state.campaigns).toEqual([
			expect.objectContaining({
				campaignId: 'campaign.1',
				ballotId: 'ballot.1',
				partyId: null,
				invested: false,
				status: 'running'
			})
		]);
		const again = previewPlan(independent.state, { steps: [declare('ballot.1')] }, catalog);
		expect(again.issues[0]?.message).toContain('Vous êtes déjà candidat à cette élection.');

		const dissident = commit(member(base, 'party.left'), [declare('ballot.1')]);
		expect(dissident.state.campaigns[0]?.invested).toBe(false);
		const invested = commit(withSupport(member(base, 'party.left'), 'support.members', 15), [
			declare('ballot.1')
		]);
		expect(invested.state.campaigns[0]?.invested).toBe(true);
		const journal = projectView(invested.state, [], catalog).journal[0]!.lines.map(
			(line) => line.text
		);
		expect(journal[0]).toMatch(/^Se présenter : Élection locale du T1 2010 — /);
		expect(projectView(invested.state, [declare('ballot.2')], catalog).plan.steps[0]?.label).toBe(
			'Se présenter : Élection nationale du T1 2015'
		);
		expect(quarterLog(invested).steps[0]?.politics).toEqual([
			{ kind: 'candidacy', campaignId: 'campaign.1', ballotId: 'ballot.1', invested: true }
		]);
	});

	it('prépare la campagne et publie un sondage en fourchette', () => {
		const running = commit(base, [declare('ballot.1')]).state;
		const prepared = commit(running, [canvass]).state;
		expect(prepared.campaigns[0]?.preparation).toBe(5);
		const campaign = prepared.campaigns[0]!;
		// Sans aléa, le sondage est un point : popularité, préparation et adversaire connus.
		const exact = campaignPoll(
			campaign,
			prepared.player,
			prepared.world,
			prepared.mandates,
			catalog,
			prepared.characters,
			prepared.campaigns
		);
		expect(exact.min).toBe(exact.max);
		expect(exact.min).toBeGreaterThan(25);
		expect(exact.min).toBeLessThan(45);
		const volatile = load({
			...fixtureBalance,
			campaigns: { ...fixtureBalance.campaigns, volatility: 5 }
		});
		const poll = campaignPoll(
			campaign,
			prepared.player,
			prepared.world,
			prepared.mandates,
			volatile
		);
		expect(poll.min).toBeLessThan(38);
		expect(poll.max).toBeGreaterThan(38);
		const view = projectView(prepared, [], catalog).career.calendar[0]!;
		expect(view.campaign?.poll).toEqual(exact);
		expect(view.stake).toBe('Siège local');
	});
});

describe('scrutin du joueur', () => {
	it('élit un candidat assez fort et lui donne le mandat, mairie comprise au-delà du seuil', () => {
		const strong = withSupport(
			withSupport(
				member(createGame({ seed: 'victoire' }, catalog), 'party.left'),
				'support.members',
				20
			),
			'support.workers',
			80
		);
		const declared = commit(strong, [declare('ballot.1')]).state;
		const before = advanceTo(declared, 40);
		const result = commit(before);
		const campaign = result.state.campaigns[0]!;
		expect(campaign.status).toBe('won');
		expect(campaign.playerPercent).toBeGreaterThanOrEqual(60);
		expect(result.state.mandates.map((mandate) => [mandate.mandateId, mandate.status])).toEqual([
			['mandate.councillor', 'active'],
			['mandate.mayor', 'active']
		]);
		expect(result.state.resources.influence).toBe(before.resources.influence + 5);
		expect(quarterLog(result).deadlines?.campaigns).toEqual([
			{
				campaignId: 'campaign.1',
				opponentId: campaign.opponentId,
				status: 'won',
				playerPercent: campaign.playerPercent,
				reason: null
			}
		]);
	});

	it('fait perdre sans finir la carrière : un peu d’influence, du stress', () => {
		const weak = withSupport(createGame({ seed: 'défaite' }, catalog), 'support.workers', 0);
		const before = advanceTo(commit(weak, [declare('ballot.1')]).state, 40);
		const result = commit(before);
		expect(result.state.campaigns[0]).toMatchObject({ status: 'lost' });
		expect(result.state.end).toBeNull();
		expect(result.state.mandates).toEqual([]);
		expect(result.state.resources.influence).toBe(before.resources.influence + 1);
		expect(result.state.player.stress).toBe(before.player.stress + 4);
		expect(projectView(result.state, [], catalog).career.pastCampaigns[0]?.outcome).toMatch(
			/^Défaite avec \d+ % face à .+ : la carrière continue$/
		);
	});

	it('permet au sortant de se représenter et lui donne une prime', () => {
		// Popularité 55 : 28 sans la prime du sortant, 33 avec, face à 30.
		const sitting = councillor(
			withSupport(createGame({ seed: 'sortant' }, catalog), 'support.workers', 60)
		);
		const declared = commit(sitting, [declare('ballot.1')]).state;
		const result = commit(advanceTo(declared, 40));
		expect(result.state.campaigns[0]?.status).toBe('won');
		expect(
			result.state.mandates.map((mandate) => [mandate.mandateId, mandate.status, mandate.endReason])
		).toEqual([
			['mandate.councillor', 'ended', 'term'],
			['mandate.councillor', 'active', null]
		]);
	});

	it('invalide au scrutin une candidature devenue contraire au cumul', () => {
		const eligible = councillor(createGame({ seed: 'invalidée' }, catalog));
		const declared = commit(eligible, [declare('ballot.2')]).state;
		// Échéance nationale avancée avant le terme du siège local, pour garder le prérequis.
		const early = {
			...declared,
			ballots: declared.ballots.map((ballot) =>
				ballot.ballotId === 'ballot.2' ? { ...ballot, turn: 5, filingClosesTurn: 3 } : ballot
			)
		};
		const before = advanceTo(early, 5);
		const minister: MandateInstance = {
			instanceId: 'term.2',
			mandateId: 'mandate.minister',
			startTurn: before.turn,
			access: 'nomination',
			status: 'active',
			endTurn: null,
			endReason: null
		};
		const result = commit({ ...before, mandates: [...before.mandates, minister] });
		expect(result.state.campaigns[0]).toMatchObject({
			status: 'disqualified',
			reason: 'Incompatible avec : Ministère.'
		});
	});

	it('reporte la campagne sur l’élection anticipée, préparation comprise', () => {
		const dissolve = withEvents(['test.dissolution'], undefined, catalog);
		const eligible = councillor(createGame({ seed: 'anticipée' }, dissolve));
		const declared = commit(eligible, [declare('ballot.2'), canvass], dissolve).state;
		const early = declared.ballots.find((ballot) => ballot.early)!;
		expect(declared.campaigns[0]).toMatchObject({ ballotId: early.ballotId, preparation: 5 });
	});

	it('résout le scrutin de façon reproductible malgré l’aléa', () => {
		const volatile = load({
			...fixtureBalance,
			campaigns: { ...fixtureBalance.campaigns, volatility: 10 }
		});
		const run = (): Campaign => {
			const state = commit(
				createGame({ seed: 'aléa-campagne' }, volatile),
				[declare('ballot.1')],
				volatile
			).state;
			return commit(advanceTo(state, 40, [], volatile), [], volatile).state.campaigns[0]!;
		};
		expect(run()).toStrictEqual(run());
	});
});

describe('invariants des campagnes', () => {
	it('détecte une campagne en cours pour une échéance tenue', () => {
		const base = createGame({ seed: 'invariants-campagnes' }, catalog);
		const state: GameState = {
			...base,
			campaigns: [
				{
					campaignId: 'campaign.1',
					ballotId: 'ballot.1',
					electionId: 'election.local',
					declaredTurn: 0,
					partyId: null,
					invested: false,
					preparation: 0,
					opponentId: null,
					status: 'running',
					playerPercent: null,
					reason: null
				}
			],
			ballots: base.ballots.map((ballot) =>
				ballot.ballotId === 'ballot.1'
					? { ...ballot, status: 'cancelled', cancelReason: 'test' }
					: ballot
			)
		};
		expect(checkInvariants(state, catalog).join('\n')).toContain(
			'campagne en cours pour une échéance passée'
		);
	});
});

describe('remboursement des frais de campagne', () => {
	const refunded = (() => {
		const result = validateContent({
			actions: { actions: [...fixtureActions.actions, ...campaignActions] },
			upgrades: fixtureUpgrades,
			balance: fixtureBalance,
			cast: fixtureCast,
			events: { ...fixtureEvents, 'events/dissolution.json': dissolution },
			world: fixtureWorld,
			traits: fixtureTraits,
			career: {
				...fixtureCareer,
				elections: fixtureCareer.elections.map((election) =>
					election.id === 'election.local' ? { ...election, campaignRefundCents: 80_000 } : election
				)
			},
			supports: fixtureSupports,
			entourage: fixtureEntourage,
			profiles: fixtureProfiles,
			justice: fixtureJustice,
			wealth: fixtureWealth,
			promises: fixturePromises,
			media: fixtureMedia,
			institutions: fixtureInstitutions
		});
		if (!result.ok) throw new Error(JSON.stringify(result.issues, null, 2));
		return result.content;
	})();
	const local = refunded.elections['election.local']!;

	it('rembourse au forfait une candidature jugée à partir du seuil, jamais une invalidation', () => {
		expect(campaignRefund(local, 'won', 62, refunded)).toBe(80_000);
		expect(campaignRefund(local, 'lost', 5, refunded)).toBe(80_000);
		expect(campaignRefund(local, 'lost', 4, refunded)).toBe(0);
		expect(campaignRefund(local, 'lost', null, refunded)).toBe(0);
		expect(campaignRefund(local, 'disqualified', 60, refunded)).toBe(0);
		expect(campaignRefund(catalog.elections['election.local']!, 'won', 62, catalog)).toBe(0);
	});

	it('verse le remboursement après le scrutin, sans changer le tirage, et le note au journal', () => {
		const strong = withSupport(
			withSupport(
				member(createGame({ seed: 'victoire' }, refunded), 'party.left'),
				'support.members',
				20
			),
			'support.workers',
			80
		);
		const play = (used: Content) => {
			const declared = commit(strong, [declare('ballot.1')], used).state;
			return commit(advanceTo(declared, 40, [], used), [], used);
		};
		const without = play(catalog);
		const withRefund = play(refunded);
		expect(withRefund.state.campaigns[0]).toMatchObject({ status: 'won' });
		expect(withRefund.state.rng).toEqual(without.state.rng);
		expect(withRefund.state.resources.politicalBudgetCents).toBe(
			without.state.resources.politicalBudgetCents + 80_000
		);
		const lines = projectView(withRefund.state, [], refunded).journal[0]!.lines.map((line) =>
			line.text.replace(/\s/gu, ' ')
		);
		expect(lines).toContain('Frais de campagne remboursés — Budget politique + 800 €');
	});

	it('annonce le remboursement dans le calendrier électoral', () => {
		const view = projectView(createGame({ seed: 'calendrier' }, refunded), [], refunded);
		const ballot = view.career.calendar.find((entry) => entry.label === local.label);
		expect(ballot?.refund?.replace(/\s/gu, ' ')).toBe(
			'Frais de campagne remboursés 800 € à partir de 5 % des voix'
		);
	});
});
