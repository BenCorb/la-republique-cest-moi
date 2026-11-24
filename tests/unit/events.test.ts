import { describe, expect, it } from 'vitest';
import type { Content } from '../../src/lib/game/content/types.ts';
import {
	checkInvariants,
	chooseEventCommand,
	commitTurn,
	createGame,
	describePendingEvent,
	transition,
	type ChoiceRecord,
	type GameState,
	type TransitionResult,
	type TransitionSuccess
} from '../../src/lib/game/engine/index.ts';
import { fixtureContent, quarterLog, withEvents } from '../fixtures/content.ts';

function game(
	content: Content,
	overrides: {
		player?: Partial<GameState['player']>;
		resources?: Partial<GameState['resources']>;
	} = {},
	seed = 'événements'
): GameState {
	const base = createGame({ seed }, content);
	return {
		...base,
		player: { ...base.player, ...overrides.player },
		resources: { ...base.resources, ...overrides.resources }
	};
}

function ok(result: TransitionResult, content: Content): TransitionSuccess {
	if (!result.ok) throw new Error(`${result.error.code} : ${result.error.message}`);
	expect(checkInvariants(result.state, content)).toEqual([]);
	return result;
}

const next = (state: GameState, content: Content): TransitionSuccess =>
	ok(transition(state, commitTurn(), content), content);

const choose = (state: GameState, content: Content, choiceId: string): TransitionSuccess => {
	const instance = state.events.pending[0];
	if (!instance) throw new Error('aucun événement en attente');
	return ok(transition(state, chooseEventCommand(instance.instanceId, choiceId), content), content);
};

const alertOnly = withEvents(['test.stress_alert']);
const interviewOnly = withEvents(['test.interview']);

describe('tirage conditionnel', () => {
	it('ne tire pas un événement dont la condition n’est pas remplie', () => {
		const result = next(game(alertOnly, { player: { stress: 49 } }), alertOnly);
		expect(result.state.phase).toBe('planning');
		expect(quarterLog(result).events).toEqual([]);
	});

	it('tire un événement éligible, le met en file et attend une décision', () => {
		const result = next(game(alertOnly, { player: { stress: 60 } }), alertOnly);
		expect(result.state.phase).toBe('decision');
		expect(result.state.events.pending).toHaveLength(1);
		const [instance] = result.state.events.pending;
		expect(instance).toMatchObject({
			eventId: 'test.stress_alert',
			turn: 1,
			instanceId: 'event.1'
		});
		expect(quarterLog(result).events).toEqual([
			expect.objectContaining({
				eventId: 'test.stress_alert',
				outcome: 'queued',
				instanceId: 'event.1'
			})
		]);
	});

	it('ne tire rien lorsque la probabilité est nulle', () => {
		const silent = withEvents(['test.stress_alert'], {
			ordinaryDrawsPerTurn: 3,
			ordinaryEventChance: 0
		});
		expect(next(game(silent, { player: { stress: 90 } }), silent).state.phase).toBe('planning');
	});

	it('plafonne le nombre de tirages ordinaires par trimestre', () => {
		const many = withEvents(['test.stress_alert', 'test.interview', 'test.windfall']);
		const state = game(many, { player: { stress: 90 }, resources: { influence: 10 } });
		const records = quarterLog(next(state, many)).events;
		expect(records).toHaveLength(1);
	});

	it('choisit au poids, de façon reproductible', () => {
		const two = withEvents(['test.stress_alert', 'test.interview']);
		const picks = Array.from({ length: 60 }, (_, seed) => {
			const state = game(
				two,
				{ player: { stress: 90 }, resources: { influence: 10 } },
				`poids-${seed}`
			);
			const first = next(state, two).state.events.pending[0]?.eventId;
			expect(next(state, two).state.events.pending[0]?.eventId).toBe(first);
			return first;
		});
		expect(new Set(picks)).toEqual(new Set(['test.stress_alert', 'test.interview']));
	});

	it('respecte la fenêtre de disponibilité', () => {
		const seasonal = withEvents(['test.seasonal']);
		const turnsWithEvent: number[] = [];
		let state = game(seasonal);
		for (let index = 0; index < 8; index += 1) {
			const result = next(state, seasonal);
			if (result.state.phase === 'decision') {
				turnsWithEvent.push(result.state.turn);
				state = choose(result.state, seasonal, 'ok').state;
			} else {
				state = result.state;
			}
		}
		expect(turnsWithEvent).toEqual([4, 5]);
	});
});

describe('acteurs', () => {
	it('fige un acteur portant les étiquettes du rôle et résout les textes', () => {
		const state = next(game(alertOnly, { player: { stress: 60 } }), alertOnly).state;
		const doctor = state.events.pending[0]?.actors.doctor;
		expect(['test.doc_a', 'test.doc_b']).toContain(doctor);
		const view = describePendingEvent(state, alertOnly);
		const name = fixtureContent.cast[doctor ?? '']?.name;
		expect(view?.text).toBe(`${name} s’inquiète.`);
		expect(view?.choices[0]?.label).toBe(`Écouter ${name}`);
		expect(view?.actors).toEqual([{ role: 'doctor', name }]);
		expect(JSON.stringify(view)).not.toMatch(/[{}]\w/);
	});

	it('varie les acteurs selon la seed parmi les candidats', () => {
		const doctors = new Set(
			Array.from(
				{ length: 30 },
				(_, seed) =>
					next(game(alertOnly, { player: { stress: 60 } }, `acteur-${seed}`), alertOnly).state
						.events.pending[0]?.actors.doctor
			)
		);
		expect(doctors).toEqual(new Set(['test.doc_a', 'test.doc_b']));
	});
});

describe('choix bloquant', () => {
	const pending = (): GameState =>
		next(game(alertOnly, { player: { stress: 60 } }), alertOnly).state;

	it('applique le choix une seule fois, puis rend la main', () => {
		const state = pending();
		const instanceId = state.events.pending[0]!.instanceId;
		const result = choose(state, alertOnly, 'rest');
		expect(result.state.player.stress).toBe(40);
		expect(result.state.phase).toBe('planning');
		expect(result.state.events.pending).toEqual([]);
		const record = result.log[0] as ChoiceRecord;
		expect(record).toMatchObject({ type: 'event.resolved', instanceId, choiceId: 'rest' });
		expect(result.state.history.at(-1)).toEqual(record);

		const again = transition(result.state, chooseEventCommand(instanceId, 'rest'), alertOnly);
		expect(again.ok).toBe(false);
		expect(again.state).toBe(result.state);
	});

	it('bloque le passage au trimestre suivant tant que la décision attend', () => {
		const state = pending();
		const result = transition(state, commitTurn(), alertOnly);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe('decision_pending');
		expect(result.state).toBe(state);
	});

	it.each<[string, string, string]>([
		['instance inconnue', 'event.999', 'unknown_event_instance'],
		['choix inconnu', 'event.1', 'unknown_choice']
	])('refuse : %s', (_label, instanceId, code) => {
		const state = pending();
		const result = transition(state, chooseEventCommand(instanceId, 'inexistant'), alertOnly);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.code).toBe(code);
		expect(result.state).toBe(state);
	});

	it('refuse un choix hors phase de décision', () => {
		const state = game(alertOnly);
		const result = transition(state, chooseEventCommand('event.1', 'rest'), alertOnly);
		expect(!result.ok && result.error.code).toBe('no_pending_decision');
	});

	it('refuse un choix au prérequis non rempli ou aux coûts non couverts', () => {
		const state = next(
			game(interviewOnly, { resources: { influence: 3, politicalBudgetCents: 4_999 } }),
			interviewOnly
		).state;
		const view = describePendingEvent(state, interviewOnly);
		expect(view?.choices.map((choice) => [choice.id, choice.available])).toEqual([
			['accept', true],
			['pay', false],
			['gated', false],
			['decline', true]
		]);
		expect(view?.choices[2]?.reason).toBe('Il faut 50 points d’influence.');
		for (const choiceId of ['pay', 'gated']) {
			const result = transition(state, chooseEventCommand('event.1', choiceId), interviewOnly);
			expect(!result.ok && result.error.code).toBe('choice_unavailable');
		}
	});

	it('paie les coûts d’un choix sur la bonne trésorerie', () => {
		const state = next(game(interviewOnly, { resources: { influence: 3 } }), interviewOnly).state;
		const result = choose(state, interviewOnly, 'pay');
		expect(result.state.resources).toMatchObject({ influence: 5, politicalBudgetCents: 5_000 });
	});

	it('présente les événements par priorité et impose l’ordre de la file', () => {
		const both = withEvents(['test.stress_alert', 'test.interview'], {
			ordinaryDrawsPerTurn: 2,
			ordinaryEventChance: 1
		});
		const state = next(
			game(both, { player: { stress: 60 }, resources: { influence: 5 } }),
			both
		).state;
		expect(state.events.pending.map((instance) => instance.eventId)).toEqual([
			'test.stress_alert',
			'test.interview'
		]);
		const interview = state.events.pending[1]!;
		const outOfOrder = transition(state, chooseEventCommand(interview.instanceId, 'decline'), both);
		expect(!outOfOrder.ok && outOfOrder.error.code).toBe('not_next_event');

		const afterFirst = choose(state, both, 'ignore');
		expect(afterFirst.state.phase).toBe('decision');
		const afterSecond = choose(afterFirst.state, both, 'decline');
		expect(afterSecond.state.phase).toBe('planning');
	});

	it('annule un événement en attente devenu impossible après un choix', () => {
		const both = withEvents(['test.stress_alert', 'test.interview'], {
			ordinaryDrawsPerTurn: 2,
			ordinaryEventChance: 1
		});
		const state = next(
			game(both, { player: { stress: 60 }, resources: { influence: 3 } }),
			both
		).state;
		expect(state.events.pending).toHaveLength(2);
		// « Écouter » coûte 1 d'influence : l'entretien (influence ≥ 3) n'est plus possible.
		const result = choose(state, both, 'rest');
		expect(result.state.phase).toBe('planning');
		expect((result.log[0] as ChoiceRecord).cancelled).toEqual([
			{ instanceId: 'event.2', reason: 'Les conditions de cet événement ne sont plus réunies.' }
		]);
	});

	it('n’expose ni les effets ni les suites dans la vue', () => {
		const state = next(game(interviewOnly, { resources: { influence: 3 } }), interviewOnly).state;
		const text = JSON.stringify(describePendingEvent(state, interviewOnly));
		expect(text).not.toMatch(/effects|followUp|delayTurns|test\.article/);
	});
});

describe('suites différées', () => {
	it('programme la suite, la déclenche au trimestre prévu avec le même acteur', () => {
		const start = next(game(interviewOnly, { resources: { influence: 3 } }), interviewOnly).state;
		const journalist = start.events.pending[0]!.actors.journalist;
		const chosen = choose(start, interviewOnly, 'accept');
		expect(chosen.state.events.scheduled).toEqual([
			{ eventId: 'test.article', dueTurn: 3, sourceInstanceId: 'event.1', actors: { journalist } }
		]);

		const quiet = withEvents([], { ordinaryDrawsPerTurn: 0, ordinaryEventChance: 0 });
		const turn2 = next(chosen.state, quiet);
		expect(quarterLog(turn2).events).toEqual([]);
		const turn3 = next(turn2.state, quiet);
		expect(quarterLog(turn3).events).toEqual([
			expect.objectContaining({
				eventId: 'test.article',
				outcome: 'applied',
				actors: { journalist },
				changes: [{ resource: 'influence', delta: 3 }]
			})
		]);
		expect(turn3.state.events.scheduled).toEqual([]);
		expect(turn3.state.resources.influence).toBe(6);
	});

	it('annule une suite dont les conditions ne tiennent plus', () => {
		const start = next(game(interviewOnly, { resources: { influence: 3 } }), interviewOnly).state;
		const chosen = choose(start, interviewOnly, 'accept').state;
		const broke = { ...chosen, resources: { ...chosen.resources, influence: 0 } };
		const quiet = withEvents([], { ordinaryDrawsPerTurn: 0, ordinaryEventChance: 0 });
		const turn3 = next(next(broke, quiet).state, quiet);
		expect(quarterLog(turn3).events).toEqual([
			expect.objectContaining({
				eventId: 'test.article',
				instanceId: null,
				outcome: 'cancelled',
				reason: 'Les conditions de cette suite ne sont plus réunies.'
			})
		]);
		expect(turn3.state.resources.influence).toBe(0);
	});
});

describe('répétition', () => {
	it('ne répète jamais un événement unique', () => {
		let state = game(interviewOnly, { resources: { influence: 3 } });
		let count = 0;
		for (let index = 0; index < 10; index += 1) {
			state = next(state, interviewOnly).state;
			if (state.phase === 'decision') {
				count += 1;
				state = choose(state, interviewOnly, 'decline').state;
			}
		}
		expect(count).toBe(1);
		expect(state.events.occurrences['test.interview']).toEqual({ count: 1, lastTurn: 1 });
	});

	it('respecte le délai de réapparition', () => {
		let state = game(alertOnly, { player: { stress: 90 } });
		const turns: number[] = [];
		for (let index = 0; index < 12; index += 1) {
			state = next(state, alertOnly).state;
			if (state.phase === 'decision') {
				turns.push(state.turn);
				state = choose(state, alertOnly, 'ignore').state;
			}
		}
		expect(turns).toEqual([1, 5, 9]);
	});
});

describe('événements informatifs', () => {
	it('applique les effets aussitôt, sans décision', () => {
		const windfall = withEvents(['test.windfall']);
		const result = next(game(windfall), windfall);
		expect(result.state.phase).toBe('planning');
		expect(result.state.resources.personalCashCents).toBe(101_000);
		expect(quarterLog(result).events[0]).toMatchObject({
			outcome: 'applied',
			actors: { relative: 'test.cousin' }
		});
	});

	it('ne fait jamais descendre une ressource sous zéro', () => {
		const fine = withEvents(['test.fine']);
		const result = next(game(fine), fine);
		expect(result.state.resources.politicalBudgetCents).toBe(0);
		expect(quarterLog(result).events[0]?.changes).toEqual([
			{ resource: 'politicalBudgetCents', delta: -10_000 }
		]);
	});

	it('peut mettre fin à la carrière au début du trimestre suivant', () => {
		const accident = withEvents(['test.accident']);
		const result = next(game(accident), accident);
		expect(result.state.phase).toBe('ended');
		expect(result.state.end).toEqual({ turn: 1, reason: 'death', cause: 'health_failure' });
		expect(result.state.turn).toBe(1);
		expect(transition(result.state, commitTurn(), accident).ok).toBe(false);
	});
});

describe('reproductibilité avec événements', () => {
	it('rejoue à l’identique trimestres, tirages et décisions', () => {
		const all = withEvents(['test.stress_alert', 'test.interview', 'test.windfall'], {
			ordinaryDrawsPerTurn: 1,
			ordinaryEventChance: 0.6
		});
		const play = (): GameState => {
			let state = game(all, { player: { stress: 70 }, resources: { influence: 4 } }, 'rejeu');
			for (let index = 0; index < 20 && !state.end; index += 1) {
				state = next(state, all).state;
				while (state.phase === 'decision') {
					const view = describePendingEvent(state, all)!;
					state = choose(state, all, view.choices.find((choice) => choice.available)!.id).state;
				}
			}
			return state;
		};
		const first = play();
		expect(play()).toStrictEqual(first);
		expect(first.history.some((entry) => entry.type === 'event.resolved')).toBe(true);
	});
});

describe('invariants des événements', () => {
	const base = game(fixtureContent);

	it.each<[string, GameState, string]>([
		['décision sans événement', { ...base, phase: 'decision' }, 'sans événement'],
		[
			'événement en attente hors décision',
			{
				...base,
				nextInstanceNumber: 2,
				events: {
					...base.events,
					pending: [{ instanceId: 'event.1', eventId: 'test.stress_alert', turn: 0, actors: {} }]
				}
			},
			'hors phase de décision'
		],
		[
			'suite échue non traitée',
			{
				...base,
				events: {
					...base.events,
					scheduled: [
						{ eventId: 'test.article', dueTurn: 0, sourceInstanceId: 'event.1', actors: {} }
					]
				}
			},
			'échue'
		],
		[
			'acteur inconnu',
			{
				...base,
				phase: 'decision',
				nextInstanceNumber: 2,
				events: {
					...base.events,
					pending: [
						{
							instanceId: 'event.1',
							eventId: 'test.stress_alert',
							turn: 0,
							actors: { doctor: 'test.fantôme' }
						}
					]
				}
			},
			'acteur inconnu'
		]
	])('détecte : %s', (_label, state, fragment) => {
		expect(checkInvariants(state, fixtureContent).join('\n')).toContain(fragment);
	});
});
