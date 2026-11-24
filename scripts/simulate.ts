/** Interface en ligne de commande du simulateur automatique (P1-10). */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadContentFromFiles } from '../src/lib/game/content/load-node.ts';
import {
	SIMULATION_STRATEGIES,
	simulateBatch,
	simulationReportToCsv,
	type SimulationConfig,
	type SimulationStrategyOption
} from '../src/lib/game/simulation/index.ts';

type OutputFormat = 'json' | 'csv';

interface CliOptions extends SimulationConfig {
	readonly format: OutputFormat;
	readonly output: string | null;
}

const HELP = `Usage : npm run simulate -- [options]

Options :
  --runs <n>          Nombre de carrières (défaut : 20)
  --seed <texte>      Préfixe seed reproductible (défaut : simulation)
  --strategy <nom>    prudent, ambitious, patrimonial, mixed, random-valid ou all
                      (défaut : all)
  --max-turns <n>     Plafond technique par carrière (défaut : 400)
  --format <format>   json ou csv (défaut : json)
  --output <chemin>   Écrit le rapport dans un fichier au lieu de stdout
  --help              Affiche cette aide

Exemples :
  npm run simulate -- --runs 100 --seed 42 --strategy all --format json
  npm run simulate -- --runs 100 --seed 42 --strategy prudent --format csv --output rapport.csv`;

function positiveInteger(value: string | undefined, option: string): number {
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed < 1) {
		throw new Error(`${option} attend un entier positif.`);
	}
	return parsed;
}

function valueAfter(args: readonly string[], index: number): string {
	const value = args[index + 1];
	if (!value || value.startsWith('--')) throw new Error(`Valeur manquante après ${args[index]}.`);
	return value;
}

function isStrategy(value: string): value is SimulationStrategyOption {
	return value === 'all' || (SIMULATION_STRATEGIES as readonly string[]).includes(value);
}

export function parseSimulationArgs(args: readonly string[]): CliOptions | null {
	let runs = 20;
	let seed = 'simulation';
	let strategy: SimulationStrategyOption = 'all';
	let maxTurns = 400;
	let format: OutputFormat = 'json';
	let output: string | null = null;

	for (let index = 0; index < args.length; index += 1) {
		const option = args[index];
		if (option === '--help') return null;
		const value = valueAfter(args, index);
		index += 1;
		switch (option) {
			case '--runs':
				runs = positiveInteger(value, option);
				break;
			case '--seed':
				seed = value;
				break;
			case '--strategy':
				if (!isStrategy(value)) throw new Error(`Stratégie inconnue : ${value}.`);
				strategy = value;
				break;
			case '--max-turns':
				maxTurns = positiveInteger(value, option);
				break;
			case '--format':
				if (value !== 'json' && value !== 'csv') {
					throw new Error(`Format inconnu : ${value}.`);
				}
				format = value;
				break;
			case '--output':
				output = value;
				break;
			default:
				throw new Error(`Option inconnue : ${option}.`);
		}
	}
	return { runs, seed, strategy, maxTurns, format, output };
}

function main(): void {
	try {
		const options = parseSimulationArgs(process.argv.slice(2));
		if (!options) {
			console.log(HELP);
			return;
		}
		const report = simulateBatch(
			{
				runs: options.runs,
				seed: options.seed,
				strategy: options.strategy,
				maxTurns: options.maxTurns
			},
			loadContentFromFiles()
		);
		const serialized =
			options.format === 'json'
				? `${JSON.stringify(report, null, 2)}\n`
				: `${simulationReportToCsv(report)}\n`;
		if (options.output) {
			const path = resolve(options.output);
			mkdirSync(dirname(path), { recursive: true });
			writeFileSync(path, serialized, 'utf8');
			console.error(`Rapport ${options.format.toUpperCase()} écrit dans ${path}.`);
		} else {
			process.stdout.write(serialized);
		}
		if (report.aggregate.problemSeeds.length > 0) process.exitCode = 1;
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}

if (import.meta.main) main();
