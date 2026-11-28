import { describe, expect, it } from 'vitest';
import type { Content } from '../../src/lib/game/content/types.ts';
import { validateContent } from '../../src/lib/game/content/validate.ts';
import {
	candidacyIssue,
	checkInvariants,
	chooseEventCommand,
	commitTurn,
	createGame,
	describePendingEvent,
	investitureAppraisal,
	transition,
	type GameState,
	type MandateInstance,
	type PlanStep
} from '../../src/lib/game/engine/index.ts';
import { projectView } from '../../src/lib/game/app/view-model.ts';
import {
	fixtureActions,
	fixtureBalance,
	fixtureCareer,
	fixtureCast,
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

const actions = [
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
		id: 'campaign.request_investiture',
		label: 'Demander l’investiture',
		description: 'Solliciter le parti.',
		timeCost: 5,
		maxPerTurn: 1,
		costs: [],
		effects: [{ op: 'requestInvestiture' }],
		target: 'ballot'
	}
];

/** Catalogue de test : élection nationale à investiture, chance forcée. */
function load(chance: number): Content {
	const result = validateContent({
		actions: { actions: [...fixtureActions.actions, ...actions] },
		upgrades: fixtureUpgrades,
		balance: {
			...fixtureBalance,
			campaigns: {
				...fixtureBalance.campaigns,
				investiture: {
					...fixtureBalance.campaigns.investiture,
					minChancePercent: chance,
					maxChancePercent: chance
				}
			}
		},
		cast: fixtureCast,
		events: fixtureEvents,
		world: fixtureWorld,
		traits: fixtureTraits,
		career: {
			...fixtureCareer,
			elections: fixtureCareer.elections.map((election) =>
				election.id === 'election.national' ? { ...election, investiture: true } : election
			)
		},
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
	if (!result.ok) throw new Error(JSON.stringify(result.issues, null, 2));
	return result.content;
}

/** Militant encarté, conseiller local et assez âgé pour l'élection nationale. */
function candidate(content: Content): GameState {
	const base = createGame({ seed: 'investiture' }, content);
	const seat: MandateInstance = {
		instanceId: 'term.1',
		mandateId: 'mandate.councillor',
		startTurn: 0,
		access: 'election',
		status: 'active',
		endTurn: null,
		endReason: null,
		side: null,
		portfolio: null
	};
	return {
		...base,
		player: {
			...base.player,
			birthTurn: base.player.birthTurn - 40,
			partyId: 'party.left',
			affiliations: [{ partyId: 'party.left', fromTurn: 0, toTurn: null }],
			supports: { ...base.player.supports, 'support.members': 30 }
		},
		mandates: [seat]
	};
}

const national = (state: GameState): string =>
	state.ballots.find((ballot) => ballot.electionId === 'election.national')!.ballotId;
const request = (target: string): PlanStep => ({
	kind: 'action',
	id: 'campaign.request_investiture',
	target
});

function commit(state: GameState, steps: PlanStep[], content: Content): GameState {
	const result = transition(state, commitTurn({ steps }), content);
	if (!result.ok) throw new Error(result.error.message);
	expect(checkInvariants(result.state, content)).toEqual([]);
	return result.state;
}

describe('investiture nationale (P3-30)', () => {
	it('interdit une candidature sous étiquette sans demande d’investiture', () => {
		const content = load(50);
		const state = candidate(content);
		const career = { ...state, investitures: state.investitures };
		expect(candidacyIssue(national(state), career, state.player, state.turn, content)).toBe(
			'Encarté, demandez d’abord l’investiture de votre parti.'
		);
	});

	it('apprécie la demande en clair, sans aucun chiffre', () => {
		const content = load(50);
		const state = candidate(content);
		const appraisal = investitureAppraisal(
			national(state),
			state.player,
			state.resources.influence,
			state.mandates,
			content
		);
		expect(['Candidature soutenue', 'Investiture disputée', 'Investiture peu probable']).toContain(
			appraisal.label
		);
		const view = projectView(state, [], content).career.calendar.find(
			(ballot) => ballot.ballotId === national(state)
		)!.investiture!;
		expect(view.appraisal).toBe(appraisal.label);
		for (const factor of view.factors) expect(factor.label).not.toMatch(/\d+ ?%/u);
		expect(view.addable).toBe(true);
	});

	it('accordée, dépose une candidature investie, une seule fois', () => {
		const content = load(100);
		const state = commit(candidate(content), [request(national(candidate(content)))], content);
		expect(state.investitures).toMatchObject([{ status: 'granted', resolvedTurn: 0 }]);
		expect(state.campaigns).toMatchObject([
			{ ballotId: national(state), invested: true, partyId: 'party.left', status: 'running' }
		]);
		// Une seconde demande pour le même scrutin est refusée par le plan.
		const again = transition(state, commitTurn({ steps: [request(national(state))] }), content);
		expect(again.ok).toBe(false);
	});

	it('refusée, motive le refus puis ouvre la dissidence, sans étiquette et contre l’appareil', () => {
		const content = load(0);
		const start = candidate(content);
		const refused = commit(start, [request(national(start))], content);
		expect(refused.investitures[0]?.status).toBe('refused');
		expect(refused.investitures[0]?.reasons.length).toBeGreaterThan(0);
		expect(refused.campaigns).toEqual([]);
		expect(refused.phase).toBe('decision');
		const view = describePendingEvent(refused, content)!;
		expect(view.eventId).toBe('test.investiture_refused');
		const apparatus = refused.player.supports['support.members'] ?? 0;
		const chosen = transition(refused, chooseEventCommand(view.instanceId, 'dissident'), content);
		if (!chosen.ok) throw new Error(chosen.error.message);
		expect(chosen.state.investitures[0]?.status).toBe('dissident');
		expect(chosen.state.campaigns).toMatchObject([
			{ ballotId: national(start), invested: false, partyId: 'party.left' }
		]);
		expect(chosen.state.player.supports['support.members']).toBeLessThan(apparatus);
		expect(checkInvariants(chosen.state, content)).toEqual([]);
	});

	it('refusée puis acceptée avec discipline : aucune campagne, l’appareil apprécie', () => {
		const content = load(0);
		const start = candidate(content);
		const refused = commit(start, [request(national(start))], content);
		const view = describePendingEvent(refused, content)!;
		const apparatus = refused.player.supports['support.members'] ?? 0;
		const chosen = transition(refused, chooseEventCommand(view.instanceId, 'renounce'), content);
		if (!chosen.ok) throw new Error(chosen.error.message);
		expect(chosen.state.investitures[0]?.status).toBe('renounced');
		expect(chosen.state.campaigns).toEqual([]);
		expect(chosen.state.player.supports['support.members']).toBeGreaterThan(apparatus);
	});
});
