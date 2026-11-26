import { describe, expect, it } from 'vitest';
import type { Content } from '../../src/lib/game/content/types.ts';
import { validateContent } from '../../src/lib/game/content/validate.ts';
import {
	accelerate,
	accelerationAlerts,
	carryOverPlan,
	checkInvariants,
	commitTurn,
	createGame,
	transition,
	type GameState,
	type HistoryEntry,
	type TurnPlan
} from '../../src/lib/game/engine/index.ts';
import { projectView, summarizeSpan } from '../../src/lib/game/app/view-model.ts';
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
	fixtureEpitaphs,
	fixtureSupports,
	fixtureTraits,
	fixtureUpgrades,
	fixtureWorld,
	withEvents
} from '../fixtures/content.ts';

const declare = {
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
		actions: { actions: [...fixtureActions.actions, declare] },
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
	if (!result.ok) throw new Error(JSON.stringify(result.issues, null, 2));
	// Aucun événement aléatoire : seules les échéances et alertes interrompent le temps.
	return withEvents([], undefined, result.content);
}

const catalog = load();
const EMPTY: TurnPlan = { steps: [] };
const LEAD = catalog.balance.elections.alertLeadTurns;

function commit(state: GameState, plan: TurnPlan = EMPTY): GameState {
	const result = transition(state, commitTurn(plan), catalog);
	if (!result.ok) throw new Error(result.error.message);
	return result.state;
}

/** Remplace le dernier trimestre résolu du journal (alertes issues de la frontière). */
function withLastQuarter(state: GameState, patch: Partial<HistoryEntry>): GameState {
	const index = state.history.findLastIndex((entry) => entry.type === 'turn.resolved');
	const entry = state.history[index] as HistoryEntry;
	const history = [...state.history];
	history[index] = { ...entry, ...patch };
	return { ...state, history };
}

describe('arrêts motivés de l’accélération', () => {
	const start = createGame({ seed: 'alertes-échéances' }, catalog);
	const local = start.ballots.find(
		(ballot) =>
			ballot.electionId === 'election.local' && ballot.filingClosesTurn - start.turn > LEAD
	)!;

	it('s’arrête avant la clôture des candidatures d’une élection accessible', () => {
		const run = accelerate(start, { plan: EMPTY, maxTurns: 200 }, catalog);
		expect(run.stopReason).toBe('alert');
		expect(run.alerts.map((alert) => alert.id)).toEqual([`filing:${local.ballotId}`]);
		expect(run.alerts[0]).toMatchObject({ kind: 'deadline' });
		expect(run.state.turn).toBe(local.filingClosesTurn - LEAD);
		// L'élection nationale exige un mandat local : aucune alerte inutile.
		expect(
			accelerationAlerts(run.state, EMPTY, catalog).some((alert) =>
				run.state.ballots.some(
					(ballot) =>
						ballot.electionId === 'election.national' && alert.id === `filing:${ballot.ballotId}`
				)
			)
		).toBe(false);
	});

	it('retire la candidature déposée du plan, puis s’arrête au dernier trimestre de campagne et au résultat', () => {
		const stopped = accelerate(start, { plan: EMPTY, maxTurns: 200 }, catalog).state;
		const plan: TurnPlan = {
			steps: [{ kind: 'action', id: 'campaign.declare', target: local.ballotId }]
		};
		const declared = commit(stopped, plan);
		const carried = carryOverPlan(declared, plan, catalog);
		expect(carried.plan.steps).toEqual([]);
		expect(carried.dropped).toEqual(plan.steps);

		const toVote = accelerate(declared, { plan: EMPTY, maxTurns: 200 }, catalog);
		expect(toVote.stopReason).toBe('alert');
		expect(toVote.alerts.map((alert) => alert.id)).toEqual([`vote:${local.ballotId}`]);
		expect(toVote.state.turn).toBe(local.turn);

		const result = accelerate(toVote.state, { plan: EMPTY, maxTurns: 200 }, catalog);
		expect(result.turnsAdvanced).toBe(1);
		expect(result.alerts[0]).toMatchObject({ id: 'result:campaign.1', kind: 'career' });
		expect(result.alerts[0]!.message).toMatch(/^Élection locale : (victoire|défaite)/u);
		expect(checkInvariants(result.state, catalog)).toEqual([]);
	});
});

describe('alertes d’entourage et de budget', () => {
	const base = commit(createGame({ seed: 'alertes-entourage' }, catalog));
	const someone = Object.keys(base.characters)[0]!;

	it('signale un départ (poste vacant) et des candidatures reçues', () => {
		const state = withLastQuarter(base, {
			staff: {
				payroll: [],
				production: [],
				departures: [{ characterId: someone, postId: 'post.aide', reason: 'resigned' }],
				shortlisted: ['post.aide']
			}
		});
		const alerts = accelerationAlerts(state, EMPTY, catalog);
		expect(alerts.map((alert) => alert.id)).toEqual([
			`staff_left:${someone}`,
			`shortlist:post.aide:${state.turn - 1}`
		]);
		expect(alerts[0]!.message).toContain('« Assistance », désormais vacant');

		const view = projectView(state, [], catalog);
		expect(view.alerts).toContainEqual({ level: 'warning', text: alerts[0]!.message });
		expect(view.journal[0]!.lines.map((line) => line.text)).toContainEqual(
			expect.stringContaining('quitte le poste « Assistance » (démission)')
		);
	});

	it('signale des salaires que le budget ne couvre plus', () => {
		const state: GameState = {
			...base,
			resources: { ...base.resources, politicalBudgetCents: 500 },
			staff: [
				{
					characterId: someone,
					postId: 'post.aide',
					hiredTurn: 0,
					missionId: 'mission.aide.budget',
					status: 'active',
					leftTurn: null,
					leaveReason: null
				}
			]
		};
		expect(accelerationAlerts(state, EMPTY, catalog)).toContainEqual({
			id: 'payroll_at_risk',
			kind: 'finance',
			message: 'Budget politique insuffisant pour payer l’entourage le trimestre prochain.'
		});
	});

	it('n’émet aucune alerte hors de la planification', () => {
		expect(accelerationAlerts({ ...base, phase: 'decision' }, EMPTY, catalog)).toEqual([]);
	});
});

describe('résumé groupé d’une période', () => {
	it('additionne les variations et reprend le journal de la période seulement', () => {
		const start = commit(createGame({ seed: 'résumé' }, catalog));
		const plan: TurnPlan = { steps: [{ kind: 'action', id: 'test.fixed' }] };
		const run = accelerate(start, { plan, maxTurns: 3 }, catalog);
		const summary = summarizeSpan(start, run.state, catalog);

		expect(summary).toMatchObject({ turns: 3, period: 'du T2 2000 au T4 2000', decisions: 0 });
		expect(summary.quarters.map((quarter) => quarter.label)).toEqual([
			'T4 2000',
			'T3 2000',
			'T2 2000'
		]);
		expect(summary.changes[0]).toEqual({ name: 'Influence', text: '+ 6' });
		expect(summary.changes.map((change) => change.name)).toEqual([
			'Influence',
			'Budget politique',
			'Argent personnel',
			'Santé',
			'Stress',
			'Popularité'
		]);
	});
});
