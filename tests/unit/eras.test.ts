import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Content, EventDefinition } from '../../src/lib/game/content/types.ts';
import { validateContent, type RawContent } from '../../src/lib/game/content/validate.ts';
import { DEFAULT_CONTENT_DATA_DIR } from '../../src/lib/game/content/load-node.ts';
import {
	commitTurn,
	createGame,
	eraAt,
	eraReached,
	previewPlan,
	transition,
	turnOf,
	type GameState
} from '../../src/lib/game/engine/index.ts';
import { projectView } from '../../src/lib/game/app/view-model.ts';
import {
	fixtureActions,
	fixtureBalance,
	fixtureCareer,
	fixtureCast,
	fixtureContent,
	fixtureEntourage,
	fixtureEvents,
	fixtureInstitutions,
	fixtureEpitaphs,
	fixtureJustice,
	fixtureMedia,
	fixturePromises,
	fixtureProfiles,
	fixtureSupports,
	fixtureTraits,
	fixtureUpgrades,
	fixtureWealth,
	fixtureWorld,
	quarterLog,
	withEvents
} from '../fixtures/content.ts';

const SECOND_ERA = turnOf(2010, 1);

/** Brève de test, réservée à la seconde époque, sans délai ni plafond propre. */
const eraNews: EventDefinition = {
	id: 'test.era_news',
	category: 'world',
	title: 'Nouvelle d’époque',
	text: 'Une nouvelle de la seconde époque.',
	blocking: false,
	trigger: 'random',
	weight: 1,
	priority: 0,
	cooldownTurns: 0,
	unique: false,
	eras: ['era.second'],
	actors: [],
	effects: []
};

function withEvent(event: EventDefinition, base: Content = fixtureContent): Content {
	return {
		...base,
		events: { ...base.events, [event.id]: event },
		eventIds: [...base.eventIds, event.id].sort()
	};
}

/** Action de la seconde époque, sur le modèle de la première action du catalogue. */
function withFutureAction(base: Content = fixtureContent): Content {
	const model = base.actions[base.actionIds[0]!]!;
	const future = { ...model, id: 'test.future', label: 'Action future', fromEra: 'era.second' };
	return {
		...base,
		actions: { ...base.actions, [future.id]: future },
		actionIds: [...base.actionIds, future.id]
	};
}

function at(turn: number, content: Content): GameState {
	return { ...createGame({ seed: `époque-${turn}` }, content), turn };
}

function drawn(state: GameState, content: Content): string[] {
	const result = transition(state, commitTurn(), content);
	if (!result.ok) throw new Error(result.error.message);
	return quarterLog(result).events.map((event) => event.eventId);
}

function raw(overrides: Partial<RawContent> = {}): RawContent {
	return {
		actions: fixtureActions,
		upgrades: fixtureUpgrades,
		balance: fixtureBalance,
		cast: fixtureCast,
		events: fixtureEvents,
		world: fixtureWorld,
		traits: fixtureTraits,
		career: fixtureCareer,
		supports: fixtureSupports,
		entourage: fixtureEntourage,
		profiles: fixtureProfiles,
		justice: fixtureJustice,
		wealth: fixtureWealth,
		promises: fixturePromises,
		media: fixtureMedia,
		institutions: fixtureInstitutions,
		epitaphs: fixtureEpitaphs,
		...overrides
	};
}

function issuesOf(overrides: Partial<RawContent>): string[] {
	const result = validateContent(raw(overrides));
	return result.ok ? [] : result.issues.map((issue) => `${issue.path} : ${issue.message}`);
}

describe('époques et répétitions (P3-07)', () => {
	it('déduit l’époque de l’année', () => {
		expect(eraAt(0, fixtureContent).id).toBe('era.first');
		expect(eraAt(SECOND_ERA - 1, fixtureContent).id).toBe('era.first');
		expect(eraAt(SECOND_ERA, fixtureContent).id).toBe('era.second');
		expect(eraReached('era.second', 0, fixtureContent)).toBe(false);
		expect(eraReached('era.second', SECOND_ERA, fixtureContent)).toBe(true);
		expect(eraReached('era.unknown', SECOND_ERA, fixtureContent)).toBe(false);
	});

	it('ne tire un événement d’époque qu’à son époque', () => {
		const content = withEvents(['test.era_news'], undefined, withEvent(eraNews));
		// Les événements sont tirés pour le trimestre suivant (T+1).
		expect(drawn(at(SECOND_ERA - 2, content), content)).toEqual([]);
		expect(drawn(at(SECOND_ERA - 1, content), content)).toEqual(['test.era_news']);
	});

	it('cache et refuse une action d’une époque à venir', () => {
		const content = withFutureAction();
		const early = at(0, content);
		expect(projectView(early, [], content).actions.map((action) => action.id)).not.toContain(
			'test.future'
		);
		const preview = previewPlan(early, { steps: [{ kind: 'action', id: 'test.future' }] }, content);
		expect(preview.issues[0]?.message).toBe(
			'« Action future » n’existe pas encore à cette époque.'
		);
		const later = at(SECOND_ERA, content);
		expect(projectView(later, [], content).actions.map((action) => action.id)).toContain(
			'test.future'
		);
		expect(projectView(later, [], content).world.era.label).toBe('Seconde époque');
	});

	it('plafonne les occurrences d’un événement par carrière', () => {
		const base = withEvent({ ...eraNews, eras: undefined, maxOccurrences: 2 });
		const content = withEvents(['test.era_news'], undefined, base);
		let state = at(0, content);
		const counts: number[] = [];
		for (let turn = 0; turn < 4; turn += 1) {
			const result = transition(state, commitTurn(), content);
			if (!result.ok) throw new Error(result.error.message);
			state = result.state;
			counts.push(state.events.occurrences['test.era_news']?.count ?? 0);
		}
		expect(counts).toEqual([1, 2, 2, 2]);
		const global = withEvents(
			['test.era_news'],
			{ ordinaryDrawsPerTurn: 1, ordinaryEventChance: 1, maxOccurrences: 1 },
			withEvent({ ...eraNews, eras: undefined })
		);
		const once = transition(
			transition(at(0, global), commitTurn(), global).state,
			commitTurn(),
			global
		);
		expect(once.state.events.occurrences['test.era_news']?.count).toBe(1);
	});

	it('réduit le poids d’un événement déjà survenu', () => {
		const other = { ...eraNews, id: 'test.other_news', eras: undefined };
		const base = withEvent(other, withEvent({ ...eraNews, eras: undefined }));
		const penalized = withEvents(
			['test.era_news', 'test.other_news'],
			{ ordinaryDrawsPerTurn: 1, ordinaryEventChance: 1, repeatPenaltyPercent: 300 },
			base
		);
		let repeated = 0;
		for (let seed = 0; seed < 200; seed += 1) {
			const state = createGame({ seed: `poids-${seed}` }, penalized);
			const seasoned = {
				...state,
				events: {
					...state.events,
					occurrences: { 'test.era_news': { count: 1, lastTurn: -10 } }
				}
			};
			if (drawn(seasoned, penalized).includes('test.era_news')) repeated += 1;
		}
		// Poids divisé par 4 : environ 20 % des tirages au lieu de 50 %.
		expect(repeated).toBeGreaterThan(20);
		expect(repeated).toBeLessThan(70);
	});

	describe('validation', () => {
		it('exige des époques ordonnées, commençant en 2000, et connues', () => {
			const issues = issuesOf({
				world: {
					...fixtureWorld,
					eras: [
						{ id: 'era.first', label: 'A', description: 'A.', fromYear: 2001 },
						{ id: 'era.second', label: 'B', description: 'B.', fromYear: 2001 }
					]
				}
			});
			expect(issues).toEqual(
				expect.arrayContaining([
					'eras[0].fromYear : la première époque commence avec la partie (2000)',
					'eras[1].fromYear : époques par année de début strictement croissante'
				])
			);
			const unknown = issuesOf({
				actions: {
					actions: [
						...fixtureActions.actions.slice(1),
						{ ...fixtureActions.actions[0]!, fromEra: 'era.ghost' }
					]
				}
			});
			expect(unknown).toEqual([expect.stringContaining('époque inconnue : era.ghost')]);
		});
	});

	describe('catalogue réel', () => {
		const files = [
			...readdirSync(DEFAULT_CONTENT_DATA_DIR)
				.filter((file) => file.endsWith('.json') && !file.includes(' '))
				.map((file) => join(DEFAULT_CONTENT_DATA_DIR, file)),
			...readdirSync(join(DEFAULT_CONTENT_DATA_DIR, 'events'))
				.filter((file) => file.endsWith('.json') && !file.includes(' '))
				.map((file) => join(DEFAULT_CONTENT_DATA_DIR, 'events', file))
		];
		const text = files.map((file) => readFileSync(file, 'utf8')).join('\n');

		it('ne cite aucune marque, aucun média ni aucun réseau réel (références fictives)', () => {
			const real = [
				'Twitter',
				'Facebook',
				'Instagram',
				'TikTok',
				'YouTube',
				'WhatsApp',
				'ChatGPT',
				'Google',
				'BFM',
				'Le Monde',
				'Le Figaro',
				'Libération',
				'Canard enchaîné',
				'Mediapart'
			];
			// Les institutions françaises (Matignon, l’Élysée…) restent citables (GDD §8).
			expect(real.filter((name) => text.includes(name))).toEqual([]);
		});

		it('couvre chaque époque par des événements, et chaque époque après la première par une technologie', () => {
			const eras = ['era.decade_2000', 'era.decade_2010', 'era.decade_2020', 'era.decade_2030'];
			for (const era of eras) {
				expect(text, era).toContain(`"${era}"`);
			}
			for (const era of eras.slice(1)) {
				expect(
					text.match(new RegExp(`"fromEra": "${era}"`, 'g'))?.length ?? 0,
					era
				).toBeGreaterThanOrEqual(2);
			}
		});
	});
});
