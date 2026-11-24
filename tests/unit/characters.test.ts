import { describe, expect, it } from 'vitest';
import type { Content } from '../../src/lib/game/content/types.ts';
import { validateContent } from '../../src/lib/game/content/validate.ts';
import {
	ageAt,
	addRelation,
	checkInvariants,
	chooseEventCommand,
	commitTurn,
	completeCastingExists,
	createGame,
	describePendingEvent,
	encounterReveal,
	fitsSlot,
	modulatedDelta,
	resolveCharacters,
	resolveWorld,
	transition,
	type Character,
	type GameState
} from '../../src/lib/game/engine/index.ts';
import { projectView } from '../../src/lib/game/app/view-model.ts';
import {
	fixtureActions,
	fixtureBalance,
	fixtureCast,
	fixtureContent,
	fixtureEntourage,
	fixtureEvents,
	fixtureCareer,
	fixtureSupports,
	fixtureTraits,
	fixtureUpgrades,
	fixtureWorld,
	quarterLog,
	withCharacters,
	withEvents
} from '../fixtures/content.ts';

/** Événements de relations : rôles chevauchants, filtres de trait et d'attitude, souvenirs. */
const relationEvents = {
	events: [
		{
			id: 'rel.consult',
			category: 'relations',
			title: 'Deux avis médicaux',
			text: '{first} puis {grudging} vous examinent.',
			blocking: true,
			trigger: 'random',
			weight: 1,
			priority: 0,
			cooldownTurns: 0,
			unique: false,
			actors: [
				{ role: 'first', tags: ['medical'] },
				{ role: 'grudging', tags: ['medical'], traits: ['trait.grudge'] }
			],
			choices: [
				{
					id: 'snub',
					label: 'Ignorer {grudging}',
					hints: [],
					costs: [],
					effects: [
						{
							op: 'addRelation',
							role: 'grudging',
							value: -10,
							memory: 'Vous avez ignoré l’avis de {grudging}.'
						}
					]
				},
				{
					id: 'listen',
					label: 'Écouter',
					hints: [],
					costs: [],
					effects: [{ op: 'revealTraits', role: 'first' }]
				}
			]
		},
		{
			id: 'rel.grateful_cousin',
			category: 'relations',
			title: 'Un cousin reconnaissant',
			text: '{cousin} vous remercie encore.',
			blocking: false,
			trigger: 'random',
			weight: 1,
			priority: 0,
			cooldownTurns: 0,
			unique: false,
			actors: [{ role: 'cousin', tags: ['family'], met: true, minAttitude: 10 }],
			effects: [{ op: 'addStat', stat: 'player.stress', value: -2 }]
		}
	]
};

function load(): Content {
	const result = validateContent({
		actions: fixtureActions,
		upgrades: fixtureUpgrades,
		balance: fixtureBalance,
		cast: fixtureCast,
		events: { ...fixtureEvents, 'events/relations.json': relationEvents },
		world: fixtureWorld,
		traits: fixtureTraits,
		career: fixtureCareer,
		supports: fixtureSupports,
		entourage: fixtureEntourage
	});
	if (!result.ok) throw new Error(JSON.stringify(result.issues, null, 2));
	return result.content;
}

const content = load();

function withTraits(
	state: GameState,
	id: string,
	traits: string[],
	known: string[] = []
): GameState {
	const character = state.characters[id]!;
	return {
		...state,
		characters: { ...state.characters, [id]: { ...character, traits, knownTraits: known } }
	};
}

describe('distribution initiale', () => {
	const game = createGame({ seed: 'distribution' }, content);

	it('place chaque membre dans l’état avec son âge, ses étiquettes et deux traits', () => {
		for (const member of fixtureCast.cast) {
			const character = game.characters[member.id]!;
			expect(character.name).toBe(member.name);
			expect(character.tags).toEqual(member.tags);
			expect(ageAt(character.birthTurn, game.turn)).toBe(member.age);
			expect(character.renewal).toBe(member.renewal?.epithet ?? null);
			expect(character.status).toBe('active');
			expect(new Set(character.traits).size).toBe(2);
		}
		expect(game.relationships).toEqual({});
		expect(checkInvariants(game, content)).toEqual([]);
	});

	it('ne fait connaître d’emblée que les traits publics', () => {
		for (const character of Object.values(game.characters)) {
			expect(character.knownTraits).toEqual(
				character.traits.filter((trait) => trait === 'trait.open')
			);
		}
	});

	it('tire les traits de façon reproductible et variable selon la seed', () => {
		expect(createGame({ seed: 'distribution' }, content).characters).toStrictEqual(game.characters);
		const variants = new Set(
			['a', 'b', 'c', 'd', 'e', 'f'].map((seed) =>
				JSON.stringify(createGame({ seed }, content).characters['test.doc_a']!.traits)
			)
		);
		expect(variants.size).toBeGreaterThan(1);
	});
});

describe('attribution des acteurs (préalable P2-04)', () => {
	it('trouve une distribution complète même quand un choix glouton échouerait', () => {
		expect(completeCastingExists([['a', 'b'], ['a']])).toBe(true);
		expect(completeCastingExists([['a'], ['a']])).toBe(false);
	});

	it('réserve le seul acteur rancunier au rôle qui l’exige, quelle que soit la seed', () => {
		const consultOnly = withEvents(['rel.consult'], undefined, content);
		for (const seed of ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8']) {
			let state = createGame({ seed }, consultOnly);
			state = withTraits(state, 'test.doc_a', ['trait.open']);
			state = withTraits(state, 'test.doc_b', ['trait.grudge']);
			const result = transition(state, commitTurn(), consultOnly);
			if (!result.ok) throw new Error(result.error.message);
			expect(quarterLog(result).events[0]?.actors).toEqual({
				first: 'test.doc_a',
				grudging: 'test.doc_b'
			});
		}
	});

	it('n’attribue jamais un rôle à un personnage parti', () => {
		const base = createGame({ seed: 'parti' }, content);
		const gone: Character = { ...base.characters['test.cousin']!, status: 'dead', leftTurn: 0 };
		expect(fitsSlot(base.characters['test.cousin']!, { role: 'r', tags: ['family'] }, {})).toBe(
			true
		);
		expect(fitsSlot(gone, { role: 'r', tags: ['family'] }, {})).toBe(false);
	});
});

describe('vieillissement et départs', () => {
	it('remplace un professionnel retraité par un successeur de même fonction', () => {
		const retiring = withCharacters({ retirementAge: 45, replacementMaxAge: 40 });
		const base = createGame({ seed: 'retraite' }, retiring);
		const next = resolveCharacters(base.characters, 1, base.rng, retiring);
		// Docteure A (50 ans) part ; Docteur B (40), Reporter (35) et Cousin (famille) restent.
		expect(next.record.departures).toEqual([{ characterId: 'test.doc_a', reason: 'retirement' }]);
		const [arrival] = next.record.arrivals;
		expect(arrival?.successorOf).toBe('test.doc_a');
		const successor = next.characters[arrival!.characterId]!;
		expect(successor.tags).toEqual(['medical']);
		expect(successor.epithet).toBe('médecin');
		expect(successor.status).toBe('active');
		expect(next.characters['test.doc_a']).toMatchObject({ status: 'retired', leftTurn: 1 });
		const state = { ...base, turn: 1, characters: next.characters };
		expect(checkInvariants({ ...state, history: [] }, retiring).join()).not.toContain('personnage');
	});

	it('fait mourir selon les tranches d’âge, sans remplacer la famille', () => {
		const mortal: Content = {
			...content,
			balance: {
				...content.balance,
				wellbeing: {
					...content.balance.wellbeing,
					ageBands: [
						{
							fromAge: 0,
							maxHealth: 100,
							ageingChance: 0,
							ageingHealthLoss: 0,
							mortalityChance: 0
						},
						{
							fromAge: 30,
							maxHealth: 100,
							ageingChance: 0,
							ageingHealthLoss: 0,
							mortalityChance: 1
						}
					]
				}
			}
		};
		const base = createGame({ seed: 'mortalité' }, mortal);
		const next = resolveCharacters(base.characters, 1, base.rng, mortal);
		const dead = next.record.departures.map((departure) => departure.characterId);
		expect(dead).toContain('test.cousin');
		expect(next.characters['test.cousin']?.status).toBe('dead');
		expect(next.record.arrivals.map((arrival) => arrival.successorOf)).not.toContain('test.cousin');
		// Les dirigeants morts sont remplacés par le monde.
		const world = resolveWorld(base.world, next.characters, 1, next.rng, mortal);
		expect(world.record.leaderChanges.length).toBe(3);
		expect(world.record.leaderChanges.every((change) => change.reason === 'death')).toBe(true);
	});

	it('vieillit au fil des tours sans violer les invariants', () => {
		const ageing = withCharacters({ retirementAge: 60, replacementMaxAge: 45 });
		let state = createGame({ seed: 'vieillissement' }, ageing);
		for (let turn = 0; turn < 160; turn += 1) {
			const result = transition(state, commitTurn(), ageing);
			if (!result.ok) throw new Error(result.error.message);
			expect(checkInvariants(result.state, ageing)).toEqual([]);
			state = result.state;
		}
		const departures = state.history.flatMap((entry) =>
			entry.type === 'turn.resolved' ? (entry.characters?.departures ?? []) : []
		);
		expect(departures.length).toBeGreaterThan(0);
	});
});

describe('relations et mémoire', () => {
	const base = createGame({ seed: 'relations' }, content);

	it('module l’attitude par les traits réels', () => {
		const grudge = { ...base.characters['test.doc_a']!, traits: ['trait.grudge'] };
		const loyal = { ...base.characters['test.doc_a']!, traits: ['trait.loyal'] };
		expect(modulatedDelta(grudge, -10, content)).toBe(-20);
		expect(modulatedDelta(grudge, 10, content)).toBe(10);
		expect(modulatedDelta(loyal, 10, content)).toBe(15);
		expect(modulatedDelta(loyal, -10, content)).toBe(-5);
	});

	it('borne l’attitude et ne garde que les souvenirs les plus récents', () => {
		const character = { ...base.characters['test.reporter']!, traits: [] };
		let relationships = {};
		for (let turn = 0; turn < 5; turn += 1) {
			relationships = addRelation(
				relationships,
				character,
				60,
				`Souvenir ${turn}`,
				turn,
				content
			).relationships;
		}
		const relationship = (relationships as GameState['relationships'])['test.reporter']!;
		expect(relationship.attitude).toBe(100);
		expect(relationship.metTurn).toBe(0);
		expect(relationship.memories.map((memory) => memory.text)).toEqual([
			'Souvenir 2',
			'Souvenir 3',
			'Souvenir 4'
		]);
	});

	it('retient un acte important et le rappelle plus tard', () => {
		const consultOnly = withEvents(['rel.consult'], undefined, content);
		let state = createGame({ seed: 'mémoire' }, consultOnly);
		state = withTraits(state, 'test.doc_a', ['trait.open']);
		state = withTraits(state, 'test.doc_b', ['trait.grudge']);
		const queued = transition(state, commitTurn(), consultOnly);
		if (!queued.ok) throw new Error(queued.error.message);
		expect(queued.state.relationships['test.doc_b']?.attitude).toBe(0);
		const view = describePendingEvent(queued.state, consultOnly)!;
		expect(view.choices[0]?.label).toBe('Ignorer Docteur B');
		const chosen = transition(
			queued.state,
			chooseEventCommand(view.instanceId, 'snub'),
			consultOnly
		);
		if (!chosen.ok) throw new Error(chosen.error.message);
		const relationship = chosen.state.relationships['test.doc_b']!;
		// Rancune : la vexation compte double.
		expect(relationship.attitude).toBe(-20);
		expect(relationship.memories).toEqual([
			{ turn: 1, text: 'Vous avez ignoré l’avis de Docteur B.', tone: 'negative' }
		]);
		expect(chosen.log[0]).toMatchObject({
			people: [{ kind: 'relation', characterId: 'test.doc_b', delta: -20 }]
		});
		expect(checkInvariants(chosen.state, consultOnly)).toEqual([]);
	});

	it('révèle les traits cachés par effet explicite ou au fil des rencontres', () => {
		const character = {
			...base.characters['test.doc_a']!,
			traits: ['trait.grudge', 'trait.open'],
			knownTraits: ['trait.open']
		};
		const certain = withCharacters({ revealChancePerEncounter: 1 });
		const encounter = encounterReveal(character, base.rng, certain);
		expect(encounter.character.knownTraits).toEqual(['trait.grudge', 'trait.open']);
		expect(encounter.changes).toEqual([
			{ kind: 'revealed', characterId: 'test.doc_a', traitId: 'trait.grudge' }
		]);
		const never = encounterReveal(character, base.rng, content);
		expect(never.character).toBe(character);

		const consultOnly = withEvents(['rel.consult'], undefined, content);
		let state = createGame({ seed: 'révélation' }, consultOnly);
		state = withTraits(state, 'test.doc_a', ['trait.loyal', 'trait.open'], ['trait.open']);
		state = withTraits(state, 'test.doc_b', ['trait.grudge']);
		const queued = transition(state, commitTurn(), consultOnly);
		if (!queued.ok) throw new Error(queued.error.message);
		const view = describePendingEvent(queued.state, consultOnly)!;
		const chosen = transition(
			queued.state,
			chooseEventCommand(view.instanceId, 'listen'),
			consultOnly
		);
		if (!chosen.ok) throw new Error(chosen.error.message);
		expect(chosen.state.characters['test.doc_a']?.knownTraits).toEqual([
			'trait.loyal',
			'trait.open'
		]);
	});

	it('ne fait revenir un personnage que s’il est rencontré et assez bien disposé', () => {
		const cousinOnly = withEvents(['rel.grateful_cousin'], undefined, content);
		const stranger = transition(
			createGame({ seed: 'cousin' }, cousinOnly),
			commitTurn(),
			cousinOnly
		);
		if (!stranger.ok) throw new Error(stranger.error.message);
		expect(quarterLog(stranger).events).toEqual([]);

		const base = createGame({ seed: 'cousin' }, cousinOnly);
		const friendly: GameState = {
			...base,
			relationships: { 'test.cousin': { metTurn: 0, attitude: 12, memories: [] } }
		};
		const result = transition(friendly, commitTurn(), cousinOnly);
		if (!result.ok) throw new Error(result.error.message);
		expect(quarterLog(result).events[0]?.eventId).toBe('rel.grateful_cousin');
	});
});

describe('projection des relations', () => {
	it('montre tendance, traits connus et souvenirs, jamais les traits cachés ni le chiffre', () => {
		const base = createGame({ seed: 'projection-relations' }, content);
		const state = withTraits(
			{
				...base,
				relationships: {
					'test.reporter': {
						metTurn: 0,
						attitude: -55,
						memories: [{ turn: 0, text: 'Vous avez décliné son portrait.', tone: 'negative' }]
					}
				}
			},
			'test.reporter',
			['trait.grudge', 'trait.open'],
			['trait.open']
		);
		const [person] = projectView(state, [], content).people;
		expect(person).toMatchObject({
			id: 'test.reporter',
			name: 'Reporter',
			attitude: 'Hostile',
			unknownTraits: 1,
			knownTraits: [{ label: 'Franchise', description: 'Trait public de test.' }],
			memories: [{ dateLabel: 'T1 2000', text: 'Vous avez décliné son portrait.' }]
		});
		const serialized = JSON.stringify(person);
		expect(serialized).not.toContain('Rancune');
		expect(serialized).not.toContain('-55');
	});
});

describe('invariants des personnages', () => {
	const base = createGame({ seed: 'invariants-personnages' }, fixtureContent);
	const doc = base.characters['test.doc_a']!;

	it.each<[string, GameState, string]>([
		[
			'trait connu absent des traits réels',
			{
				...base,
				characters: { ...base.characters, 'test.doc_a': { ...doc, knownTraits: ['trait.absent'] } }
			},
			'trait connu absent'
		],
		[
			'personnage parti sans date',
			{ ...base, characters: { ...base.characters, 'test.doc_a': { ...doc, status: 'dead' } } },
			'départ incohérent'
		],
		[
			'relation avec un inconnu',
			{ ...base, relationships: { 'test.absent': { metTurn: 0, attitude: 0, memories: [] } } },
			'relation avec un personnage inconnu'
		],
		[
			'attitude hors bornes',
			{ ...base, relationships: { 'test.doc_a': { metTurn: 0, attitude: 101, memories: [] } } },
			'attitude invalide'
		],
		[
			'dirigeant décédé encore en place',
			{
				...base,
				characters: {
					...base.characters,
					[base.world.parties['party.left']!.leaderId]: {
						...base.characters[base.world.parties['party.left']!.leaderId]!,
						status: 'dead',
						leftTurn: 0
					}
				}
			},
			'dirigeant parti'
		]
	])('détecte : %s', (_label, state, fragment) => {
		expect(checkInvariants(state, fixtureContent).join('\n')).toContain(fragment);
	});
});
