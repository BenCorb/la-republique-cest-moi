import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/lib/game/content/load.ts';
import { projectView } from '../../src/lib/game/app/view-model.ts';
import {
	checkInvariants,
	commitTurn,
	createGame,
	transition,
	type GameState,
	type MandateInstance
} from '../../src/lib/game/engine/index.ts';
import { gameStateSchema } from '../../src/lib/game/persistence/state-schema.ts';

const content = loadContent();
const retire = { kind: 'action', id: 'personal.retire' } as const;

function mayor(): GameState {
	const base = createGame({ seed: 'retraite' }, content);
	const seat = (instanceId: string, mandateId: string): MandateInstance => ({
		instanceId,
		mandateId,
		startTurn: 0,
		access: 'election',
		status: 'active',
		endTurn: null,
		endReason: null,
		side: 'majority',
		portfolio: null
	});
	return {
		...base,
		mandates: [seat('term.1', 'mandate.municipal_councillor'), seat('term.2', 'mandate.mayor')]
	};
}

describe('fin de carrière choisie (P3-37)', () => {
	it('rend tous les mandats et clôt la carrière à la fin du trimestre, sans événement', () => {
		const state = mayor();
		const result = transition(state, commitTurn({ steps: [retire] }), content);
		if (!result.ok) throw new Error(result.error.message);
		const ended = result.state;
		expect(ended.end).toEqual({ turn: state.turn, reason: 'retirement' });
		expect(ended.phase).toBe('ended');
		expect(ended.mandates.every((mandate) => mandate.status === 'ended')).toBe(true);
		expect(ended.mandates.map((mandate) => mandate.endReason)).toEqual(['resigned', 'resigned']);
		expect(ended.events.pending).toEqual([]);
		expect(checkInvariants(ended, content)).toEqual([]);
		expect(gameStateSchema.safeParse(ended).success).toBe(true);
		// Une seule résolution : plus aucune commande après la retraite.
		expect(transition(ended, commitTurn(), content).ok).toBe(false);
		// Bilan : article de retraite, cause expliquée.
		const legacy = projectView(ended, [], content).summary!;
		expect(legacy.masthead).toMatch(/Portrait$/u);
		expect(legacy.cause).toMatch(/Retraite choisie/u);
	});

	it('se signale dans le plan pour exiger une confirmation et fermer l’accélération', () => {
		const view = projectView(mayor(), [retire], content);
		expect(view.plan.retiring).toBe(true);
		expect(projectView(mayor(), [], content).plan.retiring).toBe(false);
	});
});
