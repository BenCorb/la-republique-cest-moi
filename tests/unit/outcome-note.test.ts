import { describe, expect, it } from 'vitest';
import { GameController } from '../../src/lib/game/app/controller.ts';
import type { Content, EventChoice } from '../../src/lib/game/content/types.ts';
import type { KeyValueStorage } from '../../src/lib/game/persistence/index.ts';
import { projectView, type NoteHighlightView } from '../../src/lib/game/app/view-model.ts';
import {
	commitTurn,
	createGame,
	transition,
	type Campaign,
	type DeadlinesRecord,
	type GameState
} from '../../src/lib/game/engine/index.ts';
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
		// Premier trimestre : pas de point de départ, valeurs atteintes sans variation.
		expect(first?.first).toBe(true);
		expect(first?.variations).toHaveLength(6);
		expect(first?.variations.every((tile) => tile.change === null)).toBe(true);
		expect(first?.highlights.length).toBeLessThanOrEqual(5);
		game.dismissNote();
		expect(game.snapshot().note).toBeNull();

		game.addStep({ kind: 'action', id: 'test.fixed' });
		game.addStep({ kind: 'action', id: 'test.fixed' });
		game.commitTurn();
		snapshot = game.snapshot();
		const second = snapshot.view?.quarterNote;
		expect(second?.first).toBe(false);
		expect(second?.variations.find((tile) => tile.identity === 'influence')).toMatchObject({
			change: '+4',
			sense: 'gain'
		});

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

describe('faits marquants de la note', () => {
	/** Dernier trimestre résolu avec un scrutin préparé pour le joueur. */
	function withResult(status: 'won' | 'lost', percent: number): GameState {
		const base = createGame({ seed: 'note-election' }, fixtureContent);
		const played = transition(base, commitTurn(), fixtureContent);
		if (!played.ok) throw new Error(played.error.message);
		const ballot = played.state.ballots[0]!;
		const campaign: Campaign = {
			campaignId: 'campaign.1',
			ballotId: ballot.ballotId,
			electionId: ballot.electionId,
			declaredTurn: 0,
			partyId: null,
			invested: false,
			preparation: 10,
			opponentId: null,
			status,
			playerPercent: percent,
			reason: null
		};
		const deadlines: DeadlinesRecord = {
			mandates: [],
			ballots: [],
			people: [],
			campaigns: [
				{ campaignId: 'campaign.1', opponentId: null, status, playerPercent: percent, reason: null }
			]
		};
		return {
			...played.state,
			campaigns: [campaign],
			history: played.state.history.map((entry) =>
				entry.type === 'turn.resolved' ? { ...entry, deadlines } : entry
			)
		};
	}

	it('met en tête une victoire, avec sa phrase, son duel et le bilan électoral', () => {
		const note = projectView(withResult('won', 54), [], fixtureContent).quarterNote;
		const fact = note?.highlights[0];
		expect(fact).toMatchObject({ kind: 'victory', tone: 'gain' });
		expect(fact?.title).toMatch(/^Victoire — /u);
		expect(fact?.text).toContain('54 %');
		expect(fact?.chart).toEqual({ kind: 'duel', playerPercent: 54, rival: 'Adversaire' });
		expect(fact?.record).toEqual({ won: 1, lost: 0 });
	});

	it('annonce une défaite serrée sans la confondre avec une victoire', () => {
		const fact = projectView(withResult('lost', 48), [], fixtureContent).quarterNote?.highlights[0];
		expect(fact).toMatchObject({ kind: 'defeat', tone: 'cost' });
		expect(fact?.text).toMatch(/^Défaite d’un souffle : 48 %/u);
		expect(fact?.record).toEqual({ won: 0, lost: 1 });
	});
});

describe('effets des événements dans la note (PT-B1-003)', () => {
	it('affiche les effets propres à l’événement, identiques après reprise', () => {
		const storage = new MemoryStorage();
		const content = withEvents(['test.windfall']);
		const game = controller(storage, content);
		game.newCareer();
		let fact: NoteHighlightView | undefined;
		for (let guard = 0; !fact && guard < 20; guard += 1) {
			game.addStep({ kind: 'action', id: 'test.fixed' });
			game.commitTurn();
			fact = game.snapshot().view?.quarterNote?.highlights.find((item) => item.kind === 'event');
			game.dismissNote();
		}
		expect(fact?.text).toMatch(/^Aubaine/u);
		// Seul le cadeau de l'événement : ni l'action du plan, ni les revenus du trimestre.
		expect(fact?.chips).toEqual([
			expect.objectContaining({ identity: 'personalCashCents', sense: 'gain', variable: false })
		]);
		expect(fact?.chips[0]?.text).toMatch(/\+\s?10\s?€/u);
		// Les autres faits ne portent pas de pastilles.
		const note = game.snapshot().view?.quarterNote;
		expect(
			note?.highlights
				.filter((item) => item.kind !== 'event')
				.every((item) => item.chips.length === 0)
		).toBe(true);

		const resumed = controller(storage, content);
		expect(resumed.resume()).toBe(true);
		const again = resumed
			.snapshot()
			.view?.quarterNote?.highlights.find((item) => item.key === fact?.key);
		expect(again?.chips).toEqual(fact?.chips);
	});
});
