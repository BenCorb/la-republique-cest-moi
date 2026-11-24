import { describe, expect, it } from 'vitest';
import {
	ageAt,
	checkInvariants,
	createGame,
	formatTurn,
	type GameState
} from '../../src/lib/game/engine/index.ts';
import { fixtureContent } from '../fixtures/content.ts';

describe('création de partie', () => {
	const game = createGame({ seed: 'création' }, fixtureContent);

	it('démarre au T1 2000 en phase de planification', () => {
		expect(game.turn).toBe(0);
		expect(formatTurn(game.turn)).toBe('T1 2000');
		expect(game.phase).toBe('planning');
		expect(game.history).toEqual([]);
		expect(game.end).toBeNull();
	});

	it('incarne le profil fixe de 25 ans, né au T1 1975', () => {
		expect(ageAt(game.player.birthTurn, game.turn)).toBe(25);
		expect(formatTurn(game.player.birthTurn)).toBe('T1 1975');
	});

	it('initialise le générateur depuis la seed fournie', () => {
		expect(game.rng.seed).toBe('création');
		expect(createGame({ seed: 'création' }, fixtureContent)).toEqual(game);
		expect(createGame({ seed: 'autre' }, fixtureContent).rng.state).not.toBe(game.rng.state);
	});

	it('refuse une seed invalide', () => {
		expect(() => createGame({ seed: '' }, fixtureContent)).toThrow(RangeError);
	});

	it('démarre avec les ressources de l’équilibrage, budgets séparés', () => {
		expect(game.resources).toEqual(fixtureContent.balance.startingResources);
		expect(game.resources).not.toBe(fixtureContent.balance.startingResources);
	});

	it('respecte les invariants', () => {
		expect(checkInvariants(game)).toEqual([]);
	});

	it('se sérialise en JSON sans perte', () => {
		const restored = JSON.parse(JSON.stringify(game)) as GameState;
		expect(restored).toStrictEqual(game);
	});
});

describe('contrôle des invariants', () => {
	const game = createGame({ seed: 'invariants' }, fixtureContent);

	it.each<[string, GameState, string]>([
		['tour négatif', { ...game, turn: -1 }, 'tour invalide'],
		['tour non entier', { ...game, turn: 0.5 }, 'tour invalide'],
		[
			'état aléatoire hors 32 bits',
			{ ...game, rng: { ...game.rng, state: 2 ** 32 } },
			'état aléatoire'
		],
		['journal manquant', { ...game, turn: 2 }, 'journal incohérent'],
		[
			'journal hors séquence',
			{
				...game,
				turn: 2,
				history: [
					{
						type: 'turn.resolved',
						turn: 1,
						steps: [],
						economy: { producers: [], changes: [] },
						wellbeing: { contributions: [], deathCause: null }
					},
					{
						type: 'turn.resolved',
						turn: 0,
						steps: [],
						economy: { producers: [], changes: [] },
						wellbeing: { contributions: [], deathCause: null }
					}
				]
			},
			'hors séquence'
		],
		[
			'fin sans phase terminale',
			{ ...game, end: { turn: 0, reason: 'death', cause: 'natural_causes' } },
			'fin'
		],
		['phase terminale sans fin', { ...game, phase: 'ended' }, 'fin'],
		[
			'ressource négative',
			{ ...game, resources: { ...game.resources, influence: -1 } },
			'ressource invalide'
		],
		[
			'ressource non entière',
			{ ...game, resources: { ...game.resources, personalCashCents: 0.5 } },
			'ressource invalide'
		],
		['naissance future', { ...game, player: { ...game.player, birthTurn: 1 } }, 'naissance']
	])('détecte : %s', (_label, state, fragment) => {
		expect(checkInvariants(state).join('\n')).toContain(fragment);
	});
});
