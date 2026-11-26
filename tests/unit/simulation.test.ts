import { describe, expect, it } from 'vitest';
import { parseSimulationArgs } from '../../scripts/simulate.ts';
import { loadContentFromFiles } from '../../src/lib/game/content/load-node.ts';
import { loadContent } from '../../src/lib/game/content/load.ts';
import type { EventChoice } from '../../src/lib/game/content/types.ts';
import { createGame, type GameState } from '../../src/lib/game/engine/index.ts';
import {
	ACTIVE_TIME_MODEL,
	BURNOUT_STRESS,
	SIMULATION_STRATEGIES,
	chooseSimulationDecision,
	chooseSimulationPlan,
	estimateActiveMinutes,
	isRiskyChoice,
	simulateBatch,
	simulateCareer,
	simulationReportToCsv
} from '../../src/lib/game/simulation/index.ts';

const content = loadContent();

function choicesOf(eventId: string): readonly EventChoice[] {
	const definition = content.events[eventId];
	return definition && 'choices' in definition ? definition.choices : [];
}

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
		expect(first.unavailableMetrics).toEqual([]);
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

	it('départage à coût égal par l’ordre du catalogue, pas par l’identifiant (P3-09)', () => {
		const choice = (id: string, hints: string[] = []) => ({
			id,
			label: id,
			hints,
			costs: [],
			available: true,
			reason: null
		});
		const view = {
			instanceId: 'event.2',
			eventId: 'test.dilemma',
			category: 'career',
			title: 'Dilemme',
			text: 'Dilemme',
			actors: [],
			remaining: 0,
			choices: [choice('hold'), choice('stagger'), choice('drop')]
		};
		expect(chooseSimulationDecision(view, 'prudent', 'ordre', 0)?.id).toBe('hold');
		expect(chooseSimulationDecision(view, 'patrimonial', 'ordre', 0)?.id).toBe('hold');
	});

	it('écarte, pour la prudente seule, les choix dont un indice signale un risque', () => {
		const view = {
			instanceId: 'event.3',
			eventId: 'test.offer',
			category: 'finance',
			title: 'Offre',
			text: 'Offre',
			actors: [],
			remaining: 0,
			choices: [
				{
					id: 'accept',
					label: 'Accepter',
					hints: ['Budget en hausse', 'Un dossier qui pourrait intéresser la presse'],
					costs: [],
					available: true,
					reason: null
				},
				{
					id: 'refuse',
					label: 'Refuser',
					hints: ['Conscience tranquille'],
					costs: [{ resource: 'influence' as const, amount: 2 }],
					available: true,
					reason: null
				}
			]
		};
		expect(chooseSimulationDecision(view, 'prudent', 'risque', 0)?.id).toBe('refuse');
		expect(chooseSimulationDecision(view, 'patrimonial', 'risque', 0)?.id).toBe('accept');
		// Sans option sûre, la prudente prend quand même une décision.
		const onlyRisky = { ...view, choices: [view.choices[0]!] };
		expect(chooseSimulationDecision(onlyRisky, 'prudent', 'risque', 0)?.id).toBe('accept');
	});

	it('reconnaît comme risqué chaque choix du catalogue qui inscrit un fait, et lui seul', () => {
		const mismatches = content.eventIds.flatMap((eventId) =>
			choicesOf(eventId).flatMap((choice) => {
				const recordsFact = choice.effects.some((effect) => effect.op === 'recordFact');
				return recordsFact === isRiskyChoice(choice) ? [] : [`${eventId}/${choice.id}`];
			})
		);
		expect(mismatches).toEqual([]);
	});

	it('démissionne, épuisée, du mandat de plus bas rang dont aucun ne dépend', () => {
		const base = createGame({ seed: 'epuisement' }, content);
		const mandate = (index: number, mandateId: string) => ({
			instanceId: `term.${index}`,
			mandateId,
			startTurn: 0,
			access: 'election' as const,
			status: 'active' as const,
			endTurn: null,
			endReason: null
		});
		const exhausted: GameState = {
			...base,
			player: { ...base.player, stress: BURNOUT_STRESS },
			mandates: [
				mandate(1, 'mandate.municipal_councillor'),
				mandate(2, 'mandate.mayor'),
				mandate(3, 'mandate.deputy')
			]
		};
		const resign = { kind: 'action', id: 'mandate.resign', target: 'term.2' };
		expect(chooseSimulationPlan(exhausted, 'mixed', 'epuisement', content).steps[0]).toEqual(
			resign
		);
		expect(chooseSimulationPlan(exhausted, 'prudent', 'epuisement', content).steps[0]).toEqual(
			resign
		);
		expect(
			chooseSimulationPlan(exhausted, 'ambitious', 'epuisement', content).steps
		).not.toContainEqual(resign);
		const rested = { ...exhausted, player: { ...exhausted.player, stress: BURNOUT_STRESS - 1 } };
		expect(chooseSimulationPlan(rested, 'mixed', 'epuisement', content).steps).not.toContainEqual(
			resign
		);
	});

	it('estime la durée active avec le modèle provisoire déclaré', () => {
		expect(estimateActiveMinutes(0, 0, 0)).toBe(0);
		const expected =
			(40 * ACTIVE_TIME_MODEL.decisionSeconds +
				30 * ACTIVE_TIME_MODEL.alertSeconds +
				100 * ACTIVE_TIME_MODEL.quarterSeconds) /
			60;
		expect(estimateActiveMinutes(100, 40, 30)).toBe(Math.round(expected));
		const run = simulateCareer('duree', 'prudent', 400, content);
		expect(run.estimatedActiveMinutes).toBe(
			estimateActiveMinutes(run.turns, run.decisions, run.alertEpisodes)
		);
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
			'seed,strategy,status,turns,endingAge,endCause,decisions,alertEpisodes,significantInterventions,influence,politicalBudgetCents,personalCashCents,health,stress,upgradesOwned,actionsPerformed,purchases,quartersWithSuspension,eventsExperienced,eventOccurrences,repeatedEvents,repeatedHeadlines,finalParty,affiliations,quartersAffiliated,leaderChanges,charactersMet,characterDepartures,traitsRevealed,mandatesHeld,highestMandate,ballotsHeld,governmentChanges,campaigns,campaignsWon,campaignsLost,distinctOpponents,maxRivalEncounters,origin,profession,children,separations,promisesMade,promisesKept,promisesPartial,promisesAbandoned,articles,criticalArticles,favorableArticles,interviews,mediaOwned,reformsProposed,reformsAdopted,governmentReforms,obituary,distinctions,staffHired,staffDepartures,facts,playerCases,convictions,divertedFundsCents,resignations,estimatedActiveMinutes,finalPopularity,peakPopularity,indicatorRanges,invariantViolations,error'
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
