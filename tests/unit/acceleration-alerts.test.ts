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
	// Conseiller sortant (P3-09) : seuls les sortants sont arrêtés avant la clôture.
	const fresh = createGame({ seed: 'alertes-échéances' }, catalog);
	const start: GameState = {
		...fresh,
		mandates: [
			{
				instanceId: 'term.1',
				mandateId: 'mandate.councillor',
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
	const local = start.ballots.find(
		(ballot) =>
			ballot.electionId === 'election.local' && ballot.filingClosesTurn - start.turn > LEAD
	)!;

	it('s’arrête avant la clôture des candidatures d’une élection accessible, pour un sortant', () => {
		// Sans mandat en jeu, le rappel ne coupe pas l'accélération.
		expect(
			accelerationAlerts(fresh, EMPTY, catalog).some((alert) => alert.id.startsWith('filing:'))
		).toBe(false);
		const near: GameState = { ...start, turn: local.filingClosesTurn - LEAD };
		const run = { state: near, alerts: accelerationAlerts(near, EMPTY, catalog) };
		expect(
			run.alerts.filter((alert) => alert.id.startsWith('filing:')).map((alert) => alert.id)
		).toEqual([`filing:${local.ballotId}`]);
		expect(run.alerts.find((alert) => alert.id.startsWith('filing:'))).toMatchObject({
			kind: 'deadline'
		});
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
		let stopped = fresh;
		while (stopped.turn < local.filingClosesTurn - LEAD) stopped = commit(stopped);
		const plan: TurnPlan = {
			steps: [{ kind: 'action', id: 'campaign.declare', target: local.ballotId, pinned: true }]
		};
		const declared = commit(stopped, plan);
		// Même épinglée, la candidature déposée n'a plus d'objet : retirée avec son motif.
		const carried = carryOverPlan(declared, plan, catalog);
		expect(carried.plan.steps).toEqual([]);
		expect(carried.removed.map((removal) => removal.step)).toEqual(plan.steps);

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
				shortlisted: ['post.aide'],
				searches: [],
				progress: [],
				raiseRequests: [],
				counterLapsed: []
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
					leaveReason: null,
					salaryCents: 150_000,
					bonusDueCents: 0,
					progressTenths: 0,
					reviewedCompetence: 50,
					reviewTurn: 0
				}
			]
		};
		// Salaires impayés : un seul épisode « finances » (P3-09).
		expect(
			accelerationAlerts(state, EMPTY, catalog).filter((alert) => alert.id === 'finances')
		).toHaveLength(1);
	});

	it('n’émet aucune alerte hors de la planification', () => {
		expect(accelerationAlerts({ ...base, phase: 'decision' }, EMPTY, catalog)).toEqual([]);
	});
});

describe('résumé groupé d’une période', () => {
	it('additionne les variations et reprend le journal de la période seulement', () => {
		const start = commit(createGame({ seed: 'résumé' }, catalog));
		const plan: TurnPlan = { steps: [{ kind: 'action', id: 'test.fixed', pinned: true }] };
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
