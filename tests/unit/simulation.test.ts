import { describe, expect, it } from 'vitest';
import { parseSimulationArgs } from '../../scripts/simulate.ts';
import { loadContentFromFiles } from '../../src/lib/game/content/load-node.ts';
import { loadContent } from '../../src/lib/game/content/load.ts';
import {
	SIMULATION_STRATEGIES,
	chooseSimulationDecision,
	simulateBatch,
	simulateCareer,
	simulationReportToCsv
} from '../../src/lib/game/simulation/index.ts';

const content = loadContent();

describe('simulateur automatique', () => {
	it('charge sous Node exactement le même catalogue validé que le jeu', () => {
		const fromFiles = loadContentFromFiles();
		expect(fromFiles.version).toBe(content.version);
		expect(fromFiles.actionIds).toEqual(content.actionIds);
		expect(fromFiles.upgradeIds).toEqual(content.upgradeIds);
		expect(fromFiles.eventIds).toEqual(content.eventIds);
	});

	it('rejoue un lot à l’identique et couvre les cinq stratégies', () => {
		const config = { runs: 5, seed: 'reproductible', strategy: 'all' as const, maxTurns: 400 };
		const first = simulateBatch(config, content);
		const second = simulateBatch(config, content);

		expect(first).toStrictEqual(second);
		expect(first.runs.map((run) => run.strategy)).toEqual(SIMULATION_STRATEGIES);
		expect(first.aggregate).toMatchObject({
			runs: 5,
			ended: 5,
			capped: 0,
			errors: 0,
			invariantViolations: 0,
			problemSeeds: []
		});
		expect(first.unavailableMetrics).toEqual(['promises']);
	});

	it('distingue explicitement un plafond technique d’une fin de carrière', () => {
		const run = simulateCareer('plafond', 'prudent', 1, content);
		expect(run).toMatchObject({ status: 'capped', turns: 1, endCause: null });
		const report = simulateBatch(
			{ runs: 1, seed: 'plafond', strategy: 'prudent', maxTurns: 1 },
			content
		);
		expect(report.aggregate).toMatchObject({ ended: 0, capped: 1, errors: 0 });
		expect(report.aggregate.problemSeeds).toHaveLength(1);
	});

	it('ne choisit que parmi les options publiques et disponibles', () => {
		const view = {
			instanceId: 'event.1',
			eventId: 'test.event',
			category: 'test',
			title: 'Test',
			text: 'Test',
			actors: [],
			remaining: 0,
			choices: [
				{
					id: 'blocked',
					label: 'Bloqué',
					hints: [],
					costs: [],
					available: false,
					reason: 'Indisponible'
				},
				{
					id: 'available',
					label: 'Disponible',
					hints: [],
					costs: [],
					available: true,
					reason: null
				}
			]
		};
		for (const strategy of SIMULATION_STRATEGIES) {
			expect(chooseSimulationDecision(view, strategy, 'publique', 0)?.id).toBe('available');
		}
	});

	it('produit un CSV stable avec une ligne par carrière', () => {
		const report = simulateBatch(
			{ runs: 2, seed: 'csv', strategy: 'mixed', maxTurns: 400 },
			content
		);
		const csv = simulationReportToCsv(report);
		const lines = csv.split('\n');
		expect(lines).toHaveLength(3);
		expect(lines[0]).toBe(
			'seed,strategy,status,turns,endingAge,endCause,decisions,alertEpisodes,significantInterventions,influence,politicalBudgetCents,personalCashCents,health,stress,upgradesOwned,actionsPerformed,purchases,quartersWithSuspension,eventsExperienced,eventOccurrences,finalParty,affiliations,quartersAffiliated,leaderChanges,charactersMet,characterDepartures,traitsRevealed,mandatesHeld,highestMandate,ballotsHeld,governmentChanges,campaigns,campaignsWon,campaignsLost,distinctOpponents,maxRivalEncounters,staffHired,staffDepartures,finalPopularity,peakPopularity,indicatorRanges,invariantViolations,error'
		);
		expect(lines[1]).toContain('csv-1,mixed,ended');
		expect(lines[1]).toContain('"[{""eventId""');
	});
});

describe('CLI de simulation', () => {
	it('interprète les options documentées', () => {
		expect(
			parseSimulationArgs([
				'--runs',
				'12',
				'--seed',
				'essai',
				'--strategy',
				'prudent',
				'--max-turns',
				'250',
				'--format',
				'csv',
				'--output',
				'rapport.csv'
			])
		).toEqual({
			runs: 12,
			seed: 'essai',
			strategy: 'prudent',
			maxTurns: 250,
			format: 'csv',
			output: 'rapport.csv'
		});
	});

	it('refuse une option ou une stratégie inconnue', () => {
		expect(() => parseSimulationArgs(['--unknown', '1'])).toThrow('Option inconnue');
		expect(() => parseSimulationArgs(['--strategy', 'omniscient'])).toThrow('Stratégie inconnue');
	});
});
