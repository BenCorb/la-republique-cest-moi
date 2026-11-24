import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/lib/game/content/load.ts';
import {
	assertInvariants,
	commitTurn,
	createGame,
	formatTurn,
	previewPlan,
	transition,
	type GameState,
	type TurnPlan
} from '../../src/lib/game/engine/index.ts';

const content = loadContent();

/** Stratégie simple : propose des actions, retire celles que la prévision refuse. */
function choosePlan(state: GameState, wishes: readonly string[]): TurnPlan {
	let candidate: string[] = [...wishes];
	for (;;) {
		const turnPlan = { actions: candidate.map((actionId) => ({ actionId })) };
		const preview = previewPlan(state, turnPlan, content);
		if (preview.valid) return turnPlan;
		const rejected = new Set(preview.issues.map((issue) => issue.index));
		candidate = candidate.filter((_id, index) => !rejected.has(index));
	}
}

function career(seed: string, wishes: readonly string[], turns: number): GameState {
	let state = createGame({ seed }, content);
	for (let turn = 0; turn < turns; turn += 1) {
		const result = transition(state, commitTurn(choosePlan(state, wishes)), content);
		if (!result.ok) throw new Error(`${formatTurn(state.turn)} : ${result.error.message}`);
		state = result.state;
		assertInvariants(state);
	}
	return state;
}

describe('scénario : catalogue réel', () => {
	// Ordre de priorité : la réunion publique (50 points de temps) passe en premier.
	const militant = [
		'activism.public_meeting',
		'organization.fundraising',
		'network.meet_officials',
		'activism.leaflets',
		'personal.freelance'
	];

	it('enchaîne dix ans de trimestres planifiés sans incohérence', () => {
		const state = career('militant', militant, 40);
		expect(formatTurn(state.turn)).toBe('T1 2010');
		expect(state.resources.influence).toBeGreaterThan(0);
		const performed = new Set(
			state.history.flatMap((entry) => entry.actions.map((a) => a.actionId))
		);
		// Les actions conditionnelles finissent par se débloquer.
		expect(performed).toContain('organization.fundraising');
		expect(performed).toContain('activism.public_meeting');
	});

	it('est reproductible avec le catalogue réel', () => {
		expect(career('militant', militant, 20)).toStrictEqual(career('militant', militant, 20));
	});

	it('refuse dès le premier trimestre les actions encore verrouillées', () => {
		const state = createGame({ seed: 'débutant' }, content);
		const preview = previewPlan(
			state,
			{ actions: [{ actionId: 'activism.public_meeting' }] },
			content
		);
		expect(preview.valid).toBe(false);
		expect(preview.issues[0]?.code).toBe('condition_not_met');
	});
});
