import { describe, expect, it } from 'vitest';
import { GameController } from '../../src/lib/game/app/controller.ts';
import type { Content, EventChoice } from '../../src/lib/game/content/types.ts';
import type { KeyValueStorage } from '../../src/lib/game/persistence/index.ts';
import { fixtureContent, withEvents } from '../fixtures/content.ts';

/** Résultat des décisions et note de cabinet (P3-14). */
class MemoryStorage implements KeyValueStorage {
	readonly items = new Map<string, string>();
	getItem(key: string): string | null {
		return this.items.get(key) ?? null;
	}
	setItem(key: string, value: string): void {
		this.items.set(key, value);
	}
}

let clock = 0;
function controller(storage: KeyValueStorage, content: Content = fixtureContent) {
	return new GameController({
		content,
		storage,
		now: () => `2026-11-26T10:00:${String(clock++ % 60).padStart(2, '0')}.000Z`,
		newSeed: () => 'contrôleur'
	});
}

/** Catalogue de test : l'entretien bloquant, avec un récit écrit pour « Payer un encart ». */
function interviewContent(): Content {
	const base = withEvents(['test.windfall', 'test.interview']);
	const interview = base.events['test.interview'];
	if (!interview?.blocking) throw new Error('événement de test manquant');
	const choices: EventChoice[] = interview.choices.map((choice) =>
		choice.id === 'pay'
			? { ...choice, outcome: ['{journalist} encaisse le chèque et promet un bel encart.'] }
			: choice
	);
	return { ...base, events: { ...base.events, 'test.interview': { ...interview, choices } } };
}

/** Avance jusqu'à l'entretien (influence ≥ 3 requise), en refermant les notes. */
function reachInterview(game: GameController): void {
	game.newCareer();
	for (let guard = 0; !game.snapshot().view?.decision && guard < 12; guard += 1) {
		game.addStep({ kind: 'action', id: 'test.fixed' });
		game.commitTurn();
		game.dismissNote();
	}
	expect(game.snapshot().view?.decision?.title).toBe('Entretien');
}

describe('résultat d’une décision', () => {
	it('présente les effets réellement appliqués et le récit écrit, une seule fois', () => {
		const storage = new MemoryStorage();
		const content = interviewContent();
		const game = controller(storage, content);
		reachInterview(game);
		expect(game.snapshot().outcomeOpen).toBe(false);

		expect(game.choose('pay')).toBe(true);
		const snapshot = game.snapshot();
		expect(snapshot.outcomeOpen).toBe(true);
		const outcome = snapshot.view?.lastOutcome;
		expect(outcome?.choice).toBe('Payer un encart');
		expect(outcome?.written).toBe(true);
		expect(outcome?.text).toMatch(/encaisse le chèque et promet un bel encart\.$/);
		expect(outcome?.text).not.toContain('{journalist}');
		expect(outcome?.chips.map((chip) => [chip.identity, chip.sense])).toEqual(
			expect.arrayContaining([
				['politicalBudgetCents', 'cost'],
				['influence', 'gain']
			])
		);
		expect(outcome?.chips).toHaveLength(2);

		game.dismissOutcome();
		expect(game.snapshot().outcomeOpen).toBe(false);

		// Reprise : le résultat reste consultable, mais n'est jamais rejoué.
		const resumed = controller(storage, content);
		expect(resumed.resume()).toBe(true);
		expect(resumed.snapshot().outcomeOpen).toBe(false);
		expect(resumed.snapshot().view?.lastOutcome?.instanceId).toBe(outcome?.instanceId);
	});

	it('ne révèle pas la suite programmée d’un choix et se rabat sur un texte sobre', () => {
		const game = controller(new MemoryStorage(), interviewContent());
		reachInterview(game);
		expect(game.choose('accept')).toBe(true);
		const outcome = game.snapshot().view?.lastOutcome;
		expect(outcome?.written).toBe(false);
		expect(outcome?.text).toContain('Vous tranchez : « Accepter »');
		expect(outcome?.chips).toEqual([]);
		expect(JSON.stringify(outcome)).not.toMatch(/article|Visibilité à venir|followUp/i);
	});
});

describe('note de cabinet', () => {
	it('suit chaque trimestre manuel, se rouvre et ne se rejoue pas après reprise', () => {
		const storage = new MemoryStorage();
		const game = controller(storage);
		game.newCareer();
		expect(game.snapshot().note).toBeNull();
		expect(game.snapshot().view?.quarterNote).toBeNull();

		game.addStep({ kind: 'action', id: 'test.fixed' });
		expect(game.commitTurn()).toBe(true);
		let snapshot = game.snapshot();
		expect(snapshot.note).toBe('quarter');
		const first = snapshot.view?.quarterNote;
		expect(first?.dateLabel).toBe(snapshot.view?.dateLabel);
		expect(first?.endedLabel).toBe('T1 2000');
		// Premier trimestre : pas de point de départ, valeurs atteintes et sens neutre.
		expect(first?.totals).toBe(true);
		expect(first?.chips.every((chip) => chip.sense === 'neutral')).toBe(true);
		expect(first?.opening.length).toBeGreaterThan(0);
		game.dismissNote();
		expect(game.snapshot().note).toBeNull();

		game.addStep({ kind: 'action', id: 'test.fixed' });
		game.commitTurn();
		snapshot = game.snapshot();
		const second = snapshot.view?.quarterNote;
		expect(second?.totals).toBe(false);
		expect(second?.chips.find((chip) => chip.identity === 'influence')).toMatchObject({
			sense: 'gain',
			value: '+2'
		});
		expect(second?.sections.length).toBeLessThanOrEqual(3);
		expect(second?.sections.every((section) => section.lines.length <= 2)).toBe(true);

		const resumed = controller(storage);
		expect(resumed.resume()).toBe(true);
		expect(resumed.snapshot().note).toBeNull();
		expect(resumed.snapshot().view?.quarterNote?.key).toBe(second?.key);
		resumed.openQuarterNote();
		expect(resumed.snapshot().note).toBe('quarter');
	});

	it('présente une note de période après une accélération', async () => {
		const game = controller(new MemoryStorage());
		game.newCareer();
		game.addStep({ kind: 'action', id: 'test.fixed' });
		game.togglePin(0);
		expect(await game.accelerate(3)).toBe(true);
		const snapshot = game.snapshot();
		expect(snapshot.note).toBe('span');
		expect(snapshot.acceleration?.summary?.turns).toBe(3);
		game.dismissNote();
		expect(game.snapshot().note).toBeNull();
		expect(game.snapshot().acceleration).toBeNull();
	});
});
