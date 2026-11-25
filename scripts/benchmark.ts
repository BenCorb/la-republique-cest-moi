/**
 * Mesure de performance sur une carrière longue (ROADMAP §5.1, préalable 4).
 *
 * Joue une carrière avec les politiques du simulateur, puis chronomètre, sur
 * l'état final, la projection de l'interface (`projectView`), la sérialisation
 * et l'écriture de sauvegarde (relecture et validation de la précédente comprises).
 * Les chiffres dépendent de la machine : ils servent à comparer avant et après
 * l'ajout d'un module, pas de seuil absolu.
 *
 * Usage : npm run benchmark -- [--seed <texte>] [--strategy <nom>] [--repeat <n>]
 */
import { performance } from 'node:perf_hooks';
import { loadContentFromFiles } from '../src/lib/game/content/load-node.ts';
import {
	chooseEventCommand,
	commitTurn,
	createGame,
	describePendingEvent,
	transition,
	type GameState
} from '../src/lib/game/engine/index.ts';
import {
	SIMULATION_STRATEGIES,
	chooseSimulationDecision,
	chooseSimulationPlan,
	type SimulationStrategy
} from '../src/lib/game/simulation/index.ts';
import { projectView } from '../src/lib/game/app/view-model.ts';
import {
	createEnvelope,
	serializeEnvelope,
	writeSave,
	type KeyValueStorage
} from '../src/lib/game/persistence/index.ts';

function option(args: readonly string[], name: string, fallback: string): string {
	const index = args.indexOf(name);
	return index >= 0 && args[index + 1] ? args[index + 1]! : fallback;
}

function median(values: readonly number[]): number {
	const sorted = [...values].sort((left, right) => left - right);
	return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function time(repeat: number, work: () => unknown): number {
	const samples: number[] = [];
	for (let index = 0; index < repeat; index += 1) {
		const start = performance.now();
		work();
		samples.push(performance.now() - start);
	}
	return Math.round(median(samples) * 100) / 100;
}

const args = process.argv.slice(2);
const seed = option(args, '--seed', 'benchmark');
const strategy = option(args, '--strategy', 'ambitious') as SimulationStrategy;
const repeat = Number(option(args, '--repeat', '20'));
if (!SIMULATION_STRATEGIES.includes(strategy)) throw new Error(`Stratégie inconnue : ${strategy}`);

const content = loadContentFromFiles();
let state: GameState = createGame({ seed }, content);
// Dernier état en cours de partie : la projection d'une partie terminée est moins coûteuse.
let live: GameState = state;
const careerStart = performance.now();
while (state.end === null && state.turn < 400) {
	const plan = chooseSimulationPlan(state, strategy, seed, content);
	const advanced = transition(state, commitTurn(plan), content);
	if (!advanced.ok) throw new Error(advanced.error.message);
	if (advanced.state.end === null) live = advanced.state;
	state = advanced.state;
	while (state.phase === 'decision') {
		const view = describePendingEvent(state, content)!;
		const choice = chooseSimulationDecision(view, strategy, seed, state.turn)!;
		const chosen = transition(state, chooseEventCommand(view.instanceId, choice.id), content);
		if (!chosen.ok) throw new Error(chosen.error.message);
		state = chosen.state;
	}
}
const careerMs = Math.round(performance.now() - careerStart);

state = live;
const envelope = createEnvelope(state, content, '2000-01-01T00:00:00.000Z');
const text = serializeEnvelope(envelope);
const store = new Map<string, string>();
const storage: KeyValueStorage = {
	getItem: (key) => store.get(key) ?? null,
	setItem: (key, value) => void store.set(key, value)
};
writeSave(storage, envelope, content);

console.log(
	JSON.stringify(
		{
			seed,
			strategy,
			turns: state.turn,
			journalEntries: state.history.length,
			characters: Object.keys(state.characters).length,
			saveKilobytes: Math.round(text.length / 1024),
			careerMs,
			projectViewMs: time(repeat, () => projectView(state, [], content)),
			serializeMs: time(repeat, () => serializeEnvelope(createEnvelope(state, content, ''))),
			writeSaveMs: time(repeat, () => writeSave(storage, envelope, content))
		},
		null,
		2
	)
);
