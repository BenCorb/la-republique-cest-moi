import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/lib/game/content/load.ts';
import type { Content, HeadlineDefinition } from '../../src/lib/game/content/types.ts';
import {
	ALWAYS_COVERED_TOPICS,
	articleAngle,
	checkInvariants,
	chooseEventCommand,
	commitTurn,
	createGame,
	describePendingEvent,
	drawHeadline,
	headlineCandidates,
	headlinePoolKey,
	headlinePoolReport,
	previewPlan,
	resolvePress,
	transition,
	type GameState,
	type PlanStep,
	type PressMemory
} from '../../src/lib/game/engine/index.ts';
import { yearOf } from '../../src/lib/game/engine/calendar.ts';
import { createRng } from '../../src/lib/game/engine/random.ts';
import { createEnvelope, exportSave, importSave } from '../../src/lib/game/persistence/index.ts';
import { simulateBatch } from '../../src/lib/game/simulation/index.ts';
import { withEvents } from '../fixtures/content.ts';

/** Anti-répétition et instrumentation du contenu (P3-15, PT-P3-09-016). */
const content = loadContent();

const headline = (id: string): HeadlineDefinition => ({
	id,
	topic: 'ambient',
	tone: 'neutral',
	text: id
});
const EMPTY: PressMemory = { usedHeadlines: {}, recentAngles: [] };
const KEY = 'ambient:neutral::reference';

describe('pioche sans remise des titres (P3-15)', () => {
	it('épuise le pool avant toute reprise, puis ne répète jamais le dernier titre', () => {
		const pool = ['a', 'b', 'c'].map(headline);
		let memory = EMPTY;
		let rng = createRng('titres');
		const drawn: string[] = [];
		for (let index = 0; index < 30; index += 1) {
			const draw = drawHeadline(pool, KEY, memory, rng);
			memory = draw.memory;
			rng = draw.rng;
			drawn.push(draw.headline!.id);
		}
		// Chaque série de trois tirages consécutifs depuis un recyclage couvre tout le pool.
		expect(new Set(drawn.slice(0, 3))).toEqual(new Set(['a', 'b', 'c']));
		for (let index = 1; index < drawn.length; index += 1) {
			expect(drawn[index]).not.toBe(drawn[index - 1]);
		}
		// La mémoire ne garde que les titres parus depuis le dernier recyclage.
		expect(memory.usedHeadlines[KEY]!.length).toBeLessThanOrEqual(pool.length);
	});

	it('reste déterministe et ne tire rien pour un pool d’un seul titre', () => {
		const pool = ['a', 'b', 'c', 'd'].map(headline);
		const run = () => {
			let memory = EMPTY;
			let rng = createRng('déterminisme');
			return Array.from({ length: 10 }, () => {
				const draw = drawHeadline(pool, KEY, memory, rng);
				memory = draw.memory;
				rng = draw.rng;
				return draw.headline!.id;
			});
		};
		expect(run()).toEqual(run());
		const rng = createRng('seul');
		const single = drawHeadline(
			[headline('a')],
			KEY,
			{ ...EMPTY, usedHeadlines: { [KEY]: ['a'] } },
			rng
		);
		expect(single.headline?.id).toBe('a');
		expect(single.rng).toEqual(rng);
		expect(single.memory.usedHeadlines[KEY]).toEqual(['a']);
		// Les pools sont indépendants : un titre paru dans l'un reste neuf dans l'autre.
		const other = drawHeadline([headline('a'), headline('b')], 'autre', single.memory, rng);
		expect(other.memory.usedHeadlines[KEY]).toEqual(['a']);
		expect(other.memory.usedHeadlines['autre']).toHaveLength(1);
	});

	it('signale les pools de titres trop petits sans bloquer la validation', () => {
		const report = headlinePoolReport(content);
		expect(report.length).toBeGreaterThan(0);
		for (const pool of report) expect(pool.size).toBeLessThan(3);
		expect(headlinePoolReport(content, 1)).toEqual([]);
	});
});

const act = (id: string): PlanStep => ({ kind: 'action', id });
const WISHES: PlanStep[] = [
	act('activism.public_meeting'),
	act('organization.fundraising'),
	act('network.meet_officials'),
	act('activism.leaflets'),
	act('personal.freelance')
];

/** Carrière automatique sur le catalogue réel, invariants vérifiés à chaque trimestre. */
function career(seed: string, turns: number, used: Content = content): GameState {
	let state = createGame({ seed }, used);
	for (let turn = 0; turn < turns && state.end === null; turn += 1) {
		let steps = WISHES;
		for (;;) {
			const preview = previewPlan(state, { steps }, used);
			if (preview.valid) break;
			const rejected = new Set(preview.issues.map((issue) => issue.index));
			steps = steps.filter((_step, index) => !rejected.has(index));
		}
		const result = transition(state, commitTurn({ steps }), used);
		if (!result.ok) throw new Error(result.error.message);
		state = result.state;
		for (let view = describePendingEvent(state, used); view;) {
			const choice = view.choices.find((candidate) => candidate.available)!;
			const chosen = transition(state, chooseEventCommand(view.instanceId, choice.id), used);
			if (!chosen.ok) throw new Error(chosen.error.message);
			state = chosen.state;
			view = describePendingEvent(state, used);
		}
		expect(checkInvariants(state, used)).toEqual([]);
	}
	return state;
}

describe('presse et événements sur une carrière (P3-15)', () => {
	const state = career('anti-répétition', 160);
	const articles = state.history.flatMap((entry) =>
		entry.type === 'turn.resolved'
			? (entry.press?.articles ?? []).map((article) => ({ ...article, turn: entry.turn }))
			: []
	);

	it('ne reprend un titre qu’après épuisement de son pool', () => {
		// Catalogue réduit à deux titres par groupe : le catalogue réel est devenu
		// assez riche pour ne plus rien répéter sur une carrière, ce que l'on veut
		// pourtant vérifier ici.
		const seen = new Map<string, number>();
		const sparse: Content = {
			...content,
			headlines: content.headlines.filter((headline) => {
				const group = JSON.stringify([
					headline.topic,
					headline.tone,
					headline.details,
					headline.kinds
				]);
				const count = seen.get(group) ?? 0;
				seen.set(group, count + 1);
				return count < 2;
			})
		};
		const articles = career('anti-répétition', 160, sparse).history.flatMap((entry) =>
			entry.type === 'turn.resolved'
				? (entry.press?.articles ?? []).map((article) => ({ ...article, turn: entry.turn }))
				: []
		);
		expect(articles.length).toBeGreaterThan(20);
		// Dernière parution de chaque titre, par pool (sujet, tonalité, précision, famille de média).
		const lastSeen = new Map<string, number>();
		let repeats = 0;
		for (const article of articles) {
			const media = sparse.media[article.mediaId]!;
			const key = headlinePoolKey(article.topic, article.tone, article.detail, media.kind);
			const previous = lastSeen.get(`${key}|${article.headlineId}`);
			if (previous !== undefined) {
				repeats += 1;
				const pool = headlineCandidates(
					article.topic,
					article.tone,
					article.detail,
					media,
					article.turn,
					sparse
				);
				// Tout titre du pool est déjà paru, sauf un titre daté entré depuis.
				const previousYear = yearOf(previous);
				for (const other of pool) {
					if ((other.fromYear ?? 0) > previousYear) continue;
					expect(lastSeen.has(`${key}|${other.id}`), other.id).toBe(true);
				}
			}
			lastSeen.set(`${key}|${article.headlineId}`, article.turn);
		}
		expect(repeats).toBeGreaterThan(0);
	});

	it('n’aligne jamais plus de deux articles successifs sous le même angle secondaire', () => {
		const limit = content.press.angleRepeatLimit;
		const angles = articles
			.filter((article) => article.topic !== 'ambient')
			.map((article) => ({
				angle: articleAngle(article.topic, article.detail),
				always: ALWAYS_COVERED_TOPICS.has(article.topic)
			}));
		const violations = angles.filter(
			(entry, index) =>
				!entry.always &&
				index >= limit &&
				angles.slice(index - limit, index).every((other) => other.angle === entry.angle)
		);
		expect(violations).toEqual([]);
	});

	it('respecte le plafond d’occurrences de chaque événement tiré au sort', () => {
		for (const [eventId, occurrence] of Object.entries(state.events.occurrences)) {
			const event = content.events[eventId]!;
			if (event.trigger !== 'random') continue;
			const cap = event.maxOccurrences ?? content.balance.events.maxOccurrences;
			expect(occurrence.count, eventId).toBeLessThanOrEqual(cap);
		}
		expect(content.balance.events.maxOccurrences).toBe(2);
	});

	it('sauvegarde la mémoire de presse avec la partie', () => {
		expect(Object.keys(state.world.press.usedHeadlines).length).toBeGreaterThan(0);
		const read = importSave(
			exportSave(createEnvelope(state, content, '2026-11-26T10:00:00.000Z')).text,
			content
		);
		if (!read.ok) throw new Error(read.error.message);
		expect(read.envelope.state.world.press).toEqual(state.world.press);
	});
});

describe('délai thématique (P3-15)', () => {
	it('passe sous silence le troisième article successif sur le même angle, puis y revient', () => {
		const lavish = content.lifestyleIds.find(
			(id) => content.lifestyles[id]!.level >= content.press.lifestyleLevel
		)!;
		const press = { ...content.press, lifestylePercent: 100, ambientPercent: 0 };
		const loud = { ...content, press };
		const base = createGame({ seed: 'délai' }, content);
		let parts = {
			player: { ...base.player, lifestyle: lavish, exposure: 60 },
			world: base.world,
			rng: base.rng
		};
		const published: number[] = [];
		for (let turn = 1; turn <= 6; turn += 1) {
			const resolution = resolvePress(
				parts,
				{
					turn,
					upgrades: [],
					mandates: [],
					campaigns: [],
					ballots: [],
					cases: [],
					justice: null,
					promises: null
				},
				loud
			);
			parts = resolution.parts;
			published.push(resolution.record.articles.length);
		}
		expect(published).toEqual([1, 1, 0, 1, 1, 0]);
	});
});

describe('instrumentation du contenu (P3-15)', () => {
	it('rapporte répétitions et couverture du catalogue', () => {
		const report = simulateBatch(
			{ runs: 5, seed: 'instrumentation', strategy: 'all', maxTurns: 120 },
			content
		);
		const { aggregate } = report;
		expect(report.reportVersion).toBe(24);
		expect(aggregate.repeatedEvents.max).toBeGreaterThanOrEqual(0);
		expect(aggregate.headlines.length).toBeGreaterThan(0);
		const categories = aggregate.coverage.categories;
		expect(Object.values(categories).reduce((total, entry) => total + entry.events, 0)).toBe(
			content.eventIds.length
		);
		for (const eventId of aggregate.coverage.eventsNeverReached) {
			expect(aggregate.events.some((event) => event.eventId === eventId)).toBe(false);
		}
		for (const run of report.runs) {
			expect(run.repeatedHeadlines).toBe(
				run.headlineOccurrences.reduce((total, entry) => total + entry.count - 1, 0)
			);
		}
	});
});

describe('événement rare du catalogue (P3-15)', () => {
	it('fait survenir « Un rempart » avec un directeur de cabinet loyal et bien disposé', () => {
		const only = withEvents(['entourage.loyal_chief'], undefined, content);
		const base = createGame({ seed: 'rempart' }, content);
		const chief = Object.values(base.characters).find(
			(character) => character.status === 'active' && !character.tags.includes('family')
		)!;
		const state: GameState = {
			...base,
			characters: {
				...base.characters,
				[chief.id]: {
					...chief,
					tags: [...chief.tags, 'staff', 'staff_chief'],
					traits: ['trait.loyalty']
				}
			},
			relationships: {
				...base.relationships,
				[chief.id]: { metTurn: 0, attitude: 20, memories: [] }
			},
			staff: [
				{
					characterId: chief.id,
					postId: 'post.chief_of_staff',
					hiredTurn: 0,
					missionId: content.posts['post.chief_of_staff']!.missions[0]!.id,
					status: 'active',
					leftTurn: null,
					leaveReason: null,
					salaryCents: 150_000,
					bonusDueCents: 0,
					progressTenths: 0,
					reviewedCompetence: 50,
					reviewTurn: 0
				}
			]
		};
		const result = transition(state, commitTurn(), only);
		if (!result.ok) throw new Error(result.error.message);
		const seen = result.state.history.flatMap((entry) =>
			entry.type === 'turn.resolved' ? entry.events.map((event) => event.eventId) : []
		);
		expect(seen).toContain('entourage.loyal_chief');
	});
});
