/**
 * Critères de sortie de l'alpha (ROADMAP P2-10) sur le catalogue réel :
 *   - plusieurs seeds et stratégies donnent des trajectoires distinctes ;
 *   - le cumul des mandats reste légal à chaque trimestre ;
 *   - une sauvegarde d'une autre version de développement est refusée
 *     explicitement, sans être modifiée.
 */
import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/lib/game/content/load.ts';
import {
	RULES_VERSION,
	activeMandates,
	checkInvariants,
	chooseEventCommand,
	commitTurn,
	createGame,
	describePendingEvent,
	transition,
	type GameState
} from '../../src/lib/game/engine/index.ts';
import {
	SIMULATION_STRATEGIES,
	chooseSimulationDecision,
	chooseSimulationPlan,
	simulateCareer,
	type SimulationRun,
	type SimulationStrategy
} from '../../src/lib/game/simulation/index.ts';
import {
	SAVE_KEY,
	createEnvelope,
	readEnvelope,
	readSave,
	serializeEnvelope
} from '../../src/lib/game/persistence/index.ts';

const content = loadContent();
const SEEDS = 6;

const mean = (values: readonly number[]): number =>
	values.reduce((sum, value) => sum + value, 0) / values.length;

describe('alpha : trajectoires distinctes', () => {
	const runs: SimulationRun[] = SIMULATION_STRATEGIES.flatMap((strategy) =>
		Array.from({ length: SEEDS }, (_unused, index) =>
			simulateCareer(`alpha-${strategy}-${index}`, strategy, 400, content)
		)
	);
	const byStrategy = (strategy: SimulationStrategy): SimulationRun[] =>
		runs.filter((run) => run.strategy === strategy);

	it('termine chaque carrière sans erreur ni violation', () => {
		for (const run of runs) {
			expect(run.error, run.seed).toBeNull();
			expect(run.invariantViolations, run.seed).toEqual([]);
			expect(run.status, run.seed).toBe('ended');
		}
	});

	it('fait diverger les carrières d’une seed et d’une stratégie à l’autre', () => {
		const fingerprints = new Set(
			runs.map((run) =>
				JSON.stringify([
					run.turns,
					run.endingAge,
					run.highestMandate,
					run.finalParty,
					run.campaignsWon,
					run.resources
				])
			)
		);
		expect(fingerprints.size).toBe(runs.length);
		// Plusieurs sommets de carrière, plusieurs étiquettes finales, plusieurs profils.
		expect(new Set(runs.map((run) => run.highestMandate)).size).toBeGreaterThanOrEqual(4);
		expect(new Set(runs.map((run) => run.finalParty)).size).toBeGreaterThanOrEqual(3);
		expect(new Set(runs.map((run) => run.origin)).size).toBe(content.originIds.length);
	});

	it('distingue nettement les stratégies', () => {
		// Le patrimonial ne fait pas campagne ; le mixte enchaîne les candidatures.
		expect(mean(byStrategy('patrimonial').map((run) => run.campaigns))).toBe(0);
		expect(mean(byStrategy('mixed').map((run) => run.campaigns))).toBeGreaterThan(
			mean(byStrategy('prudent').map((run) => run.campaigns))
		);
		// L'ambitieux s'use plus vite que le prudent.
		expect(mean(byStrategy('ambitious').map((run) => run.endingAge))).toBeLessThan(
			mean(byStrategy('prudent').map((run) => run.endingAge))
		);
		// Le mixte délègue davantage que le patrimonial.
		expect(mean(byStrategy('mixed').map((run) => run.staffHired))).toBeGreaterThan(
			mean(byStrategy('patrimonial').map((run) => run.staffHired))
		);
	});
});

describe('alpha : cumul légal à chaque trimestre', () => {
	const { maxMandates, incompatibilities } = content.institutions;

	function playCareer(
		seed: string,
		strategy: SimulationStrategy,
		onState: (state: GameState) => void
	) {
		let state = createGame(
			{
				seed,
				origin: content.originIds[seed.length % content.originIds.length]!,
				profession: content.professionIds[seed.length % content.professionIds.length]!
			},
			content
		);
		while (state.end === null && state.turn < 400) {
			const advanced = transition(
				state,
				commitTurn(chooseSimulationPlan(state, strategy, seed, content)),
				content
			);
			if (!advanced.ok) throw new Error(advanced.error.message);
			state = advanced.state;
			onState(state);
			while (state.phase === 'decision') {
				const view = describePendingEvent(state, content)!;
				const choice = chooseSimulationDecision(view, strategy, seed, state.turn);
				if (!choice) throw new Error(`Décision sans choix : ${view.eventId}`);
				const chosen = transition(state, chooseEventCommand(view.instanceId, choice.id), content);
				if (!chosen.ok) throw new Error(chosen.error.message);
				state = chosen.state;
				onState(state);
			}
		}
	}

	it('ne dépasse jamais le plafond ni ne réunit des mandats incompatibles, et le cumul est exercé', () => {
		let peak = 0;
		const combinations = new Set<string>();
		for (const strategy of ['mixed', 'random-valid', 'ambitious'] as const) {
			for (let index = 0; index < SEEDS; index += 1) {
				playCareer(`cumul-${strategy}-${index}`, strategy, (state) => {
					const held = activeMandates(state.mandates).map((mandate) => mandate.mandateId);
					expect(held.length).toBeLessThanOrEqual(maxMandates);
					for (const [first, second] of incompatibilities) {
						expect(held.includes(first) && held.includes(second), `${first} + ${second}`).toBe(
							false
						);
					}
					expect(checkInvariants(state, content)).toEqual([]);
					peak = Math.max(peak, held.length);
					if (held.length > 1) combinations.add([...held].sort().join('+'));
				});
			}
		}
		// Les règles sont réellement mises à l'épreuve : cumul de plusieurs mandats, sous des formes variées.
		expect(peak).toBeGreaterThanOrEqual(2);
		expect(combinations.size).toBeGreaterThanOrEqual(3);
	});
});

describe('alpha : sauvegardes', () => {
	const game = createGame({ seed: 'alpha-sauvegarde' }, content);
	const envelope = createEnvelope(game, content, '2026-11-25T10:00:00.000Z');

	it('relit une sauvegarde de la version courante', () => {
		const result = readEnvelope(JSON.parse(serializeEnvelope(envelope)), content);
		expect(result.ok).toBe(true);
	});

	it('refuse explicitement un état du prototype (règles antérieures), sans l’effacer', () => {
		// État de phase 1 : ni monde, ni personnages, ni mandats, ni famille.
		const without = (value: object, keys: readonly string[]): Record<string, unknown> =>
			Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
		const prototypeState = without(game, [
			'world',
			'characters',
			'relationships',
			'mandates',
			'ballots',
			'campaigns',
			'institutions',
			'staff',
			'shortlists'
		]);
		const player = without(game.player, ['origin', 'profession', 'family']);
		const old = {
			...envelope,
			rulesVersion: '0.7.0',
			state: { ...prototypeState, player }
		};
		const raw = JSON.stringify(old);

		const result = readEnvelope(JSON.parse(raw), content);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe('outdated_rules');
		expect(result.error.message).toContain('règles 0.7.0');
		expect(result.error.message).toContain(`version actuelle ${RULES_VERSION}`);

		const storage = new Map<string, string>([[SAVE_KEY, raw]]);
		const outcome = readSave(
			{
				getItem: (key) => storage.get(key) ?? null,
				setItem: (key, value) => void storage.set(key, value)
			},
			content
		);
		expect(outcome.status).toBe('error');
		expect(storage.get(SAVE_KEY)).toBe(raw);
	});

	it('présente toujours comme endommagée une sauvegarde invalide des règles courantes', () => {
		const broken = { ...envelope, state: { ...game, turn: -4 } };
		const result = readEnvelope(JSON.parse(JSON.stringify(broken)), content);
		expect(!result.ok && result.error.code).toBe('invalid_state');
	});
});
