/**
 * Coque à six onglets (B-04, D-02, D-08) : « Fixe ce trimestre », résumés de
 * section et retraite annoncée depuis la barre du bas.
 */
import { describe, expect, it } from 'vitest';
import { GameController } from '../../src/lib/game/app/controller.ts';
import { projectView } from '../../src/lib/game/app/view-model.ts';
import { loadContent } from '../../src/lib/game/content/load.ts';
import {
	commitTurn,
	createGame,
	transition,
	type GameState
} from '../../src/lib/game/engine/index.ts';

const content = loadContent();

function controller() {
	return new GameController({
		content,
		storage: null,
		now: () => '2026-11-28T10:00:00.000Z',
		newSeed: () => 'coque'
	});
}

describe('fixe ce trimestre', () => {
	it('liste les revenus et charges certains, sans les actions du plan', () => {
		const state = createGame({ seed: 'fixe' }, content);
		const view = projectView(state, [], content);
		for (const line of view.fixed) {
			expect(line.label.length).toBeGreaterThan(0);
			expect(line.chips.length).toBeGreaterThan(0);
		}
		const keys = view.fixed.map((line) => line.key);
		expect(new Set(keys).size).toBe(keys.length);
		// Ajouter une action ne change pas le fixe.
		const action = view.actions.find((item) => item.addable);
		expect(action).toBeDefined();
		const planned = projectView(state, [{ kind: 'action', id: action!.id }], content);
		expect(planned.fixed).toEqual(view.fixed);
	});

	it('montre le train de vie et l’indemnité d’un mandat en cours', () => {
		const base = createGame({ seed: 'fixe-mandat', origin: 'origin.upper_class' }, content);
		const lifestyle = Object.keys(content.lifestyles).find(
			(id) => (content.lifestyles[id]?.costCents ?? 0) > 0
		)!;
		const mandateId = Object.keys(content.mandates).find(
			(id) => (content.mandates[id]?.income.length ?? 0) > 0
		)!;
		const state: GameState = {
			...base,
			player: { ...base.player, lifestyle },
			mandates: [
				{
					instanceId: 'term.1',
					mandateId,
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
		const view = projectView(state, [], content);
		const labels = view.fixed.map((line) => line.label);
		expect(labels.some((label) => label.startsWith('Train de vie'))).toBe(true);
		expect(labels.some((label) => label.startsWith('Indemnité'))).toBe(true);
		const income = view.fixed.find((line) => line.key === 'mandate.term.1')!;
		expect(income.chips.every((chip) => chip.sense === 'gain')).toBe(true);
	});

	it('est vide une fois la carrière terminée', () => {
		const state = createGame({ seed: 'fixe-fin' }, content);
		const ended = transition(
			state,
			commitTurn({ steps: [{ kind: 'action', id: 'personal.retire' }] }),
			content
		);
		if (!ended.ok) throw new Error(ended.error.message);
		expect(ended.state.phase).toBe('ended');
		expect(projectView(ended.state, [], content).fixed).toEqual([]);
	});
});

describe('résumés de section', () => {
	it('donne une ligne non vide à chaque section', () => {
		const view = projectView(createGame({ seed: 'résumés' }, content), [], content);
		for (const [id, summary] of Object.entries(view.sections)) {
			expect(summary, id).toMatch(/\S/u);
			expect(summary, id).not.toContain('\n');
		}
		expect(view.sections.mandates).toBe('Aucun mandat en cours.');
		expect(view.sections.situation).toContain('Influence');
	});
});

describe('retraite depuis la barre du bas (D-08)', () => {
	it('quitte l’agenda mais reste annonçable', () => {
		const view = projectView(createGame({ seed: 'retraite' }, content), [], content);
		expect(view.actions.some((action) => action.id === 'personal.retire')).toBe(false);
		expect(view.plan.retirement).toEqual({
			actionId: 'personal.retire',
			planIndex: null,
			addable: true,
			reason: null
		});
	});

	it('s’annonce, s’annule avant le tour et clôt la carrière à la fin du trimestre', () => {
		const game = controller();
		game.newCareer();
		const actionId = game.snapshot().view!.plan.retirement!.actionId;
		expect(game.addStep({ kind: 'action', id: actionId })).toBe(true);
		expect(game.snapshot().view?.plan.retirement?.planIndex).toBe(0);
		expect(game.snapshot().view?.plan.retiring).toBe(true);

		game.removeStep(0);
		expect(game.snapshot().view?.plan.retirement?.planIndex).toBeNull();
		expect(game.commitTurn()).toBe(true);
		expect(game.snapshot().view?.phase).toBe('planning');

		game.addStep({ kind: 'action', id: actionId });
		expect(game.commitTurn()).toBe(true);
		expect(game.snapshot().view?.phase).toBe('ended');
	});
});
