import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/lib/game/content/load.ts';
import { projectView } from '../../src/lib/game/app/view-model.ts';
import {
	ambitionVerdict,
	commitTurn,
	createGame,
	transition,
	updateAmbition,
	type GameState,
	type MandateInstance
} from '../../src/lib/game/engine/index.ts';

const content = loadContent();

function mandate(mandateId: string): MandateInstance {
	return {
		instanceId: 'term.1',
		mandateId,
		startTurn: 0,
		access: 'election',
		status: 'active',
		endTurn: null,
		endReason: null,
		side: null,
		portfolio: null
	};
}

describe('ambition de départ (P3-38)', () => {
	it('est facultative, sans aucun effet de jeu', () => {
		const none = createGame({ seed: 'ambition' }, content);
		const chosen = createGame({ seed: 'ambition', ambition: 'ambition.matignon' }, content);
		expect(none.player.ambition).toBeNull();
		expect(chosen.player.ambition).toEqual({
			ambitionId: 'ambition.matignon',
			achievedTurn: null,
			betrayedTurn: null
		});
		// Aucun bonus : ressources, soutiens et tirages identiques.
		expect({ ...chosen, player: { ...chosen.player, ambition: null } }).toEqual(none);
		expect(ambitionVerdict(chosen, content)).toBe('pending');
		expect(projectView(chosen, [], content).profile.ambition).toBe('Matignon — en cours');
	});

	it('se salue une fois atteinte, et reste atteinte', () => {
		const base = createGame({ seed: 'maire', ambition: 'ambition.mayor_for_life' }, content);
		const mayor: GameState = { ...base, mandates: [mandate('mandate.mayor')] };
		const reached = updateAmbition(mayor, content);
		expect(reached.player.ambition?.achievedTurn).toBe(base.turn);
		expect(updateAmbition({ ...reached, mandates: [] }, content)).toEqual({
			...reached,
			mandates: []
		});
		expect(ambitionVerdict(reached, content)).toBe('achieved');
	});

	it('juge les mains propres en fin de carrière, et les tient pour trahies au premier fait', () => {
		const base = createGame({ seed: 'mains', ambition: 'ambition.clean_hands' }, content);
		const retired = transition(
			{ ...base, mandates: [mandate('mandate.municipal_councillor')] },
			commitTurn({ steps: [{ kind: 'action', id: 'personal.retire' }] }),
			content
		);
		if (!retired.ok) throw new Error(retired.error.message);
		expect(ambitionVerdict(retired.state, content)).toBe('achieved');
		const tainted: GameState = {
			...base,
			facts: [
				{
					factId: 'fact.1',
					offenseId: 'offense.favoritism',
					severity: 1,
					turn: 0,
					sourceEventId: 'test',
					accomplices: [],
					beneficiaryId: null,
					amountCents: 0,
					revealed: false,
					caseId: null
				} as unknown as GameState['facts'][number]
			]
		};
		expect(ambitionVerdict(updateAmbition(tainted, content), content)).toBe('betrayed');
	});
});
