import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/lib/game/content/load.ts';
import { quarters } from '../fixtures/content.ts';
import {
	assertInvariants,
	careerSummary,
	chooseEventCommand,
	commitTurn,
	describePendingEvent,
	createGame,
	formatTurn,
	previewPlan,
	transition,
	type GameState,
	type PlanStep,
	type TurnPlan
} from '../../src/lib/game/engine/index.ts';

const content = loadContent();

/** Stratégie simple : propose des actions, retire celles que la prévision refuse. */
const act = (id: string): PlanStep => ({ kind: 'action', id });
const buy = (id: string): PlanStep => ({ kind: 'purchase', id });

function choosePlan(state: GameState, wishes: readonly PlanStep[]): TurnPlan {
	let candidate: PlanStep[] = [...wishes];
	for (;;) {
		const turnPlan: TurnPlan = { steps: candidate };
		const preview = previewPlan(state, turnPlan, content);
		if (preview.valid) return turnPlan;
		const rejected = new Set(preview.issues.map((issue) => issue.index));
		candidate = candidate.filter((_id, index) => !rejected.has(index));
	}
}

function career(
	seed: string,
	wishes: readonly PlanStep[],
	turns: number,
	choicePolicy = 0
): GameState {
	let state = createGame({ seed }, content);
	for (let turn = 0; turn < turns && state.end === null; turn += 1) {
		const result = transition(state, commitTurn(choosePlan(state, wishes)), content);
		if (!result.ok) throw new Error(`${formatTurn(state.turn)} : ${result.error.message}`);
		state = result.state;
		assertInvariants(state, content);
		state = answerEvents(state, choicePolicy);
	}
	return state;
}

/**
 * Politique automatique déterministe : parmi les choix disponibles, prend celui de
 * rang (politique + trimestre) modulo leur nombre ; la politique 0 varie donc aussi.
 */
function answerEvents(start: GameState, policy: number): GameState {
	let state = start;
	for (
		let view = describePendingEvent(state, content);
		view;
		view = describePendingEvent(state, content)
	) {
		const available = view.choices.filter((candidate) => candidate.available);
		const choice = available[(policy + state.turn) % Math.max(1, available.length)];
		if (!choice) throw new Error(`Aucun choix disponible : ${view.eventId}`);
		const result = transition(state, chooseEventCommand(view.instanceId, choice.id), content);
		if (!result.ok) throw new Error(`${view.eventId} : ${result.error.message}`);
		state = result.state;
		assertInvariants(state, content);
	}
	return state;
}

describe('scénario : catalogue réel', () => {
	// Ordre de priorité : la réunion publique (50 points de temps) passe en premier.
	const militant = [
		act('activism.public_meeting'),
		act('organization.fundraising'),
		act('network.meet_officials'),
		act('activism.leaflets'),
		act('personal.freelance')
	];

	it('enchaîne dix ans de trimestres planifiés sans incohérence', () => {
		const state = career('militant', militant, 40);
		expect(formatTurn(state.turn)).toBe('T1 2010');
		expect(state.resources.influence).toBeGreaterThan(0);
		const performed = new Set(
			quarters(state.history).flatMap((entry) => entry.steps.map((step) => step.id))
		);
		// Les actions conditionnelles finissent par se débloquer.
		expect(performed).toContain('organization.fundraising');
		expect(performed).toContain('activism.public_meeting');
	});

	// Organisation : bénévoles et fichier de donateurs, puis actions de terrain.
	const organisateur = [
		buy('organization.donor_file'),
		buy('organization.volunteer'),
		act('organization.fundraising'),
		act('network.meet_officials'),
		act('personal.freelance')
	];

	it('fait tourner une organisation qui produit à partir du trimestre suivant', () => {
		const state = career('organisateur', organisateur, 40);
		expect(state.upgrades.length).toBeGreaterThan(1);
		expect(state.upgrades.every((upgrade) => upgrade.acquiredTurn < state.turn)).toBe(true);
		const firstPurchaseTurn = Math.min(...state.upgrades.map((upgrade) => upgrade.acquiredTurn));
		const productive = quarters(state.history).filter((entry) =>
			entry.economy.producers.some((producer) => producer.status === 'active')
		);
		expect(productive.length).toBeGreaterThan(0);
		expect(Math.min(...productive.map((entry) => entry.turn))).toBeGreaterThan(firstPurchaseTurn);
	});

	it('est reproductible avec le catalogue réel', () => {
		expect(career('militant', militant, 20)).toStrictEqual(career('militant', militant, 20));
		expect(career('organisateur', organisateur, 20)).toStrictEqual(
			career('organisateur', organisateur, 20)
		);
	});

	it('refuse dès le premier trimestre les actions encore verrouillées', () => {
		const state = createGame({ seed: 'débutant' }, content);
		const preview = previewPlan(
			state,
			{ steps: [{ kind: 'action', id: 'activism.public_meeting' }] },
			content
		);
		expect(preview.valid).toBe(false);
		expect(preview.issues[0]?.code).toBe('condition_not_met');
	});

	it('mène une carrière complète jusqu’au décès et à son bilan', () => {
		// Plafond technique de sécurité : 100 ans de trimestres.
		const prudent = [
			act('network.meet_officials'),
			act('organization.fundraising'),
			act('personal.freelance'),
			act('personal.rest')
		];
		for (const seed of ['carrière-1', 'carrière-2', 'carrière-3']) {
			const state = career(seed, prudent, 400);
			const summary = careerSummary(state);
			expect(summary.ended).toBe(true);
			expect(summary.cause).not.toBeNull();
			expect(summary.age).toBeGreaterThan(25);
			expect(summary.quartersPlayed).toBe(state.turn);
			const after = transition(state, commitTurn(), content);
			expect(after.ok).toBe(false);
		}
	});

	it('atteint chaque événement du catalogue au fil de carrières simulées', () => {
		const strategies: PlanStep[][] = [
			[
				act('network.meet_officials'),
				act('organization.fundraising'),
				act('personal.freelance'),
				act('personal.rest')
			],
			[
				buy('organization.donor_file'),
				buy('organization.volunteer'),
				buy('organization.local_office'),
				act('organization.fundraising'),
				act('network.meet_officials'),
				act('personal.freelance')
			],
			[
				act('activism.public_meeting'),
				act('organization.fundraising'),
				act('network.meet_officials'),
				act('activism.leaflets'),
				act('personal.freelance')
			]
		];
		const seen = new Set<string>();
		strategies.forEach((wishes, strategy) => {
			for (let seed = 0; seed < 20; seed += 1) {
				const state = career(`atteinte-${strategy}-${seed}`, wishes, 400, seed);
				for (const entry of quarters(state.history)) {
					for (const event of entry.events) {
						if (event.outcome !== 'cancelled') seen.add(event.eventId);
					}
				}
			}
		});
		expect(content.eventIds.filter((id) => !seen.has(id))).toEqual([]);
	});
});
