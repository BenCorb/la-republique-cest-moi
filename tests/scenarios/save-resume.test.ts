import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/lib/game/content/load.ts';
import {
	assertInvariants,
	chooseEventCommand,
	commitTurn,
	createGame,
	describePendingEvent,
	previewPlan,
	transition,
	type GameCommand,
	type GameState,
	type PlanStep,
	type TurnPlan
} from '../../src/lib/game/engine/index.ts';
import {
	createEnvelope,
	readSave,
	writeSave,
	type KeyValueStorage
} from '../../src/lib/game/persistence/index.ts';

const content = loadContent();

class MemoryStorage implements KeyValueStorage {
	readonly items = new Map<string, string>();
	getItem(key: string): string | null {
		return this.items.get(key) ?? null;
	}
	setItem(key: string, value: string): void {
		this.items.set(key, value);
	}
}

const act = (id: string): PlanStep => ({ kind: 'action', id });
const buy = (id: string): PlanStep => ({ kind: 'purchase', id });
const wishes = [
	buy('organization.volunteer'),
	act('organization.fundraising'),
	act('network.meet_officials'),
	act('activism.leaflets'),
	act('personal.freelance')
];

function choosePlan(state: GameState): TurnPlan {
	let candidate = [...wishes];
	for (;;) {
		const preview = previewPlan(state, { steps: candidate }, content);
		if (preview.valid) return { steps: candidate };
		const rejected = new Set(preview.issues.map((issue) => issue.index));
		candidate = candidate.filter((_step, index) => !rejected.has(index));
	}
}

/** Commande suivante d'une stratégie déterministe : décision en attente, sinon trimestre. */
function nextCommand(state: GameState): GameCommand {
	const view = describePendingEvent(state, content);
	if (view) {
		const available = view.choices.filter((choice) => choice.available);
		return chooseEventCommand(view.instanceId, available[state.turn % available.length]!.id);
	}
	return commitTurn(choosePlan(state));
}

/**
 * Joue `commands` commandes. Avec un stockage, sauvegarde après chaque transition
 * puis recharge depuis le stockage avant la commande suivante (rechargement de page).
 */
function play(
	seed: string,
	commands: number,
	storage?: MemoryStorage
): { state: GameState; decisionsReloaded: number } {
	let state = createGame({ seed }, content);
	let decisionsReloaded = 0;
	for (let index = 0; index < commands && !state.end; index += 1) {
		const result = transition(state, nextCommand(state), content);
		if (!result.ok) throw new Error(result.error.message);
		state = result.state;
		if (storage) {
			const write = writeSave(
				storage,
				createEnvelope(state, content, `2026-11-24T10:${index % 60}:00Z`),
				content
			);
			if (!write.ok) throw new Error(write.error.message);
			const loaded = readSave(storage, content);
			if (loaded.status !== 'loaded') throw new Error(`rechargement impossible : ${loaded.status}`);
			expect(loaded.source).toBe('current');
			state = loaded.envelope.state;
			if (state.phase === 'decision') decisionsReloaded += 1;
		}
		assertInvariants(state, content);
	}
	return { state, decisionsReloaded };
}

describe('scénario : sauvegarde et reprise', () => {
	it('reprend à l’identique après un rechargement à chaque commande, décisions comprises', () => {
		for (const seed of ['reprise-1', 'reprise-2', 'reprise-3']) {
			const direct = play(seed, 300);
			const reloaded = play(seed, 300, new MemoryStorage());
			expect(reloaded.state).toStrictEqual(direct.state);
			expect(reloaded.decisionsReloaded).toBeGreaterThan(0);
		}
	});

	it('applique une décision rechargée une seule fois', () => {
		const storage = new MemoryStorage();
		let { state } = play('décision-unique', 1);
		// Avance jusqu'à une décision en attente.
		for (let guard = 0; state.phase !== 'decision' && guard < 200; guard += 1) {
			const result = transition(state, nextCommand(state), content);
			if (!result.ok) throw new Error(result.error.message);
			state = result.state;
		}
		expect(state.phase).toBe('decision');
		writeSave(storage, createEnvelope(state, content, '2026-11-24T10:00:00Z'), content);

		const loaded = readSave(storage, content);
		if (loaded.status !== 'loaded') throw new Error('rechargement impossible');
		const command = nextCommand(loaded.envelope.state);
		const chosen = transition(loaded.envelope.state, command, content);
		expect(chosen.ok).toBe(true);
		if (!chosen.ok) return;
		writeSave(storage, createEnvelope(chosen.state, content, '2026-11-24T10:01:00Z'), content);

		// Après rechargement, la même décision n'est plus en attente : un second choix est refusé.
		const reloaded = readSave(storage, content);
		if (reloaded.status !== 'loaded') throw new Error('rechargement impossible');
		const again = transition(reloaded.envelope.state, command, content);
		expect(again.ok).toBe(false);
		expect(
			reloaded.envelope.state.history.filter((entry) => entry.type === 'event.resolved')
		).toHaveLength(chosen.state.history.filter((entry) => entry.type === 'event.resolved').length);
	});
});
