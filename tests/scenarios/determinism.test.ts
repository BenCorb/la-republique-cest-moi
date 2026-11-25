import { describe, expect, it } from 'vitest';
import {
	ageAt,
	assertInvariants,
	commitTurn,
	createGame,
	formatTurn,
	transition,
	yearOf,
	type GameCommand,
	type GameState
} from '../../src/lib/game/engine/index.ts';
import { fixtureContent, quarters as quarterEntries } from '../fixtures/content.ts';

/** Scénarios longs : le runner de CI est deux à trois fois plus lent qu'un poste local. */
const LONG_SCENARIO_TIMEOUT = 60_000;

function deepFreeze<T>(value: T): T {
	if (value && typeof value === 'object' && !Object.isFrozen(value)) {
		Object.freeze(value);
		for (const child of Object.values(value)) deepFreeze(child);
	}
	return value;
}

/** Rejoue une partie et vérifie les invariants et l'immuabilité après chaque commande. */
function play(seed: string, commands: readonly GameCommand[]): GameState {
	let state = deepFreeze(createGame({ seed }, fixtureContent));
	assertInvariants(state, fixtureContent);
	for (const command of commands) {
		const result = transition(state, command, fixtureContent);
		if (!result.ok) throw new Error(`${result.error.code} : ${result.error.message}`);
		state = deepFreeze(result.state);
		assertInvariants(state, fixtureContent);
	}
	return state;
}

const quarters = (count: number): GameCommand[] =>
	Array.from({ length: count }, () => commitTurn());

describe('scénario : passage du temps', () => {
	it('fait passer un an en quatre trimestres, et l’âge avec', () => {
		const start = play('calendrier', []);
		const oneYearLater = play('calendrier', quarters(4));
		expect(formatTurn(oneYearLater.turn)).toBe('T1 2001');
		expect(yearOf(oneYearLater.turn) - yearOf(start.turn)).toBe(1);
		expect(ageAt(oneYearLater.player.birthTurn, oneYearLater.turn)).toBe(26);
	});

	it('avance exactement d’un trimestre par validation et le journalise', () => {
		const state = createGame({ seed: 'un-tour' }, fixtureContent);
		const result = transition(state, commitTurn(), fixtureContent);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.state.turn).toBe(1);
		expect(result.log).toEqual([
			{
				type: 'turn.resolved',
				turn: 0,
				steps: [],
				economy: { producers: [], changes: [] },
				mandates: { changes: [], stress: 0 },
				staff: { payroll: [], production: [], departures: [], shortlisted: [] },
				family: { inheritance: 0, childCosts: 0, stress: 0, neglected: false, widowed: null },
				wellbeing: { contributions: [], deathCause: null },
				characters: { departures: [], arrivals: [] },
				world: { indicators: [], parties: [], leaderChanges: [] },
				supports: [],
				deadlines: { mandates: [], ballots: [], campaigns: [], people: [] },
				exposure: 0,
				justice: { cases: [], changes: [], gauges: [], politics: [] },
				events: []
			}
		]);
		expect(result.state.history).toEqual(result.log);
		expect(state.turn).toBe(0);
	});

	it('enchaîne une carrière longue sans violer d’invariant', () => {
		const state = play('longue', quarters(220));
		expect(formatTurn(state.turn)).toBe('T1 2055');
		expect(ageAt(state.player.birthTurn, state.turn)).toBe(80);
		expect(state.history).toHaveLength(220);
	});
});

describe('scénario : reproductibilité', { timeout: LONG_SCENARIO_TIMEOUT }, () => {
	it('même seed et mêmes commandes donnent un état identique', () => {
		const first = play('reproductible', quarters(12));
		const second = play('reproductible', quarters(12));
		expect(second).toStrictEqual(first);
		expect(JSON.stringify(second)).toBe(JSON.stringify(first));
	});

	it('une partie rechargée depuis JSON se poursuit à l’identique', () => {
		const direct = play('reprise', quarters(8));
		const halfway = JSON.parse(JSON.stringify(play('reprise', quarters(5)))) as GameState;
		let resumed = halfway;
		for (const command of quarters(3)) {
			const result = transition(resumed, command, fixtureContent);
			if (!result.ok) throw new Error(result.error.message);
			resumed = result.state;
		}
		expect(resumed).toStrictEqual(direct);
	});

	it('rejoue à l’identique des trimestres avec effets aléatoires', () => {
		const busy = commitTurn({
			steps: [
				{ kind: 'action', id: 'test.random' },
				{ kind: 'action', id: 'test.random' },
				{ kind: 'action', id: 'test.random_budget' }
			]
		});
		const commands = Array.from({ length: 12 }, () => busy);
		const first = play('aléatoire', commands);
		const second = play('aléatoire', commands);
		expect(second).toStrictEqual(first);
		// Les tirages ont réellement eu lieu et diffèrent d'une seed à l'autre.
		expect(first.rng.state).not.toBe(createGame({ seed: 'aléatoire' }, fixtureContent).rng.state);
		expect(play('autre-seed', commands).resources).not.toEqual(first.resources);
	});

	it('une partie avec aléa rechargée depuis JSON se poursuit à l’identique', () => {
		const busy = commitTurn({
			steps: [
				{ kind: 'action', id: 'test.random' },
				{ kind: 'action', id: 'test.random_budget' }
			]
		});
		const direct = play(
			'reprise-aléa',
			Array.from({ length: 6 }, () => busy)
		);
		let resumed = JSON.parse(
			JSON.stringify(
				play(
					'reprise-aléa',
					Array.from({ length: 3 }, () => busy)
				)
			)
		) as GameState;
		for (let index = 0; index < 3; index += 1) {
			const result = transition(resumed, busy, fixtureContent);
			if (!result.ok) throw new Error(result.error.message);
			resumed = result.state;
		}
		expect(resumed).toStrictEqual(direct);
	});

	it('rejoue à l’identique achats, charges et production', () => {
		const buyAndAct = commitTurn({
			steps: [
				{ kind: 'purchase', id: 'test.volunteer' },
				{ kind: 'action', id: 'test.random_budget' },
				{ kind: 'action', id: 'test.random' }
			]
		});
		const actOnly = commitTurn({ steps: [{ kind: 'action', id: 'test.random_budget' }] });
		const commands = [buyAndAct, buyAndAct, ...Array.from({ length: 10 }, () => actOnly)];
		const first = play('économie', commands);
		expect(play('économie', commands)).toStrictEqual(first);
		expect(first.upgrades).toHaveLength(2);
		const statuses = quarterEntries(first.history).flatMap((entry) =>
			entry.economy.producers.map((producer) => producer.active + producer.suspended)
		);
		expect(statuses.length).toBeGreaterThan(0);
	});

	it('des seeds différentes produisent des générateurs différents', () => {
		expect(play('alpha', quarters(4)).rng).not.toEqual(play('beta', quarters(4)).rng);
	});
});

describe('scénario : commandes rejetées', () => {
	const base = deepFreeze(createGame({ seed: 'rejets' }, fixtureContent));

	it.each<[string, GameState, GameCommand, string]>([
		[
			'action inconnue',
			base,
			commitTurn({ steps: [{ kind: 'action', id: 'action.inexistante' }] }),
			'invalid_plan'
		],
		[
			'plan mal formé',
			base,
			{ type: 'commitTurn', plan: {} } as unknown as GameCommand,
			'invalid_plan'
		],
		['commande inconnue', base, { type: 'teleport' } as unknown as GameCommand, 'unknown_command'],
		[
			'décision en attente',
			deepFreeze({ ...base, phase: 'decision' }),
			commitTurn(),
			'decision_pending'
		],
		[
			'partie terminée',
			deepFreeze({
				...base,
				phase: 'ended',
				end: { turn: 0, reason: 'death', cause: 'natural_causes' }
			}),
			commitTurn(),
			'game_ended'
		]
	])('%s : refus sans modifier l’état ni le générateur', (_label, state, command, code) => {
		const before = JSON.stringify(state);
		const result = transition(state, command, fixtureContent);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe(code);
		expect(result.error.message.length).toBeGreaterThan(0);
		expect(result.state).toBe(state);
		expect(JSON.stringify(state)).toBe(before);
	});
});
