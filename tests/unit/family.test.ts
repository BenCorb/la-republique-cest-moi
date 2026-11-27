import { describe, expect, it } from 'vitest';
import type { Content } from '../../src/lib/game/content/types.ts';
import { validateContent } from '../../src/lib/game/content/validate.ts';
import {
	checkInvariants,
	chooseEventCommand,
	commitTurn,
	computePopularity,
	createGame,
	describePendingEvent,
	evaluateCondition,
	readStat,
	resolveFamily,
	transition,
	type GameState
} from '../../src/lib/game/engine/index.ts';
import { creationOptions, projectView } from '../../src/lib/game/app/view-model.ts';
import {
	fixtureActions,
	fixtureBalance,
	fixtureCareer,
	fixtureCast,
	fixtureEntourage,
	fixtureEvents,
	fixtureProfiles,
	fixtureJustice,
	fixtureWealth,
	fixturePromises,
	fixtureMedia,
	fixtureInstitutions,
	fixtureEpitaphs,
	fixtureSupports,
	fixtureTraits,
	fixtureUpgrades,
	fixtureWorld,
	quarterLog,
	withEvents
} from '../fixtures/content.ts';

const familyActions = [
	{
		id: 'test.holiday',
		label: 'Vacances en famille',
		description: 'Apaise la famille.',
		timeCost: 20,
		maxPerTurn: 1,
		costs: [],
		effects: [{ op: 'familyAttitude', value: 10 }]
	}
];

const familyEvents = {
	events: [
		{
			id: 'test.meeting',
			category: 'family',
			title: 'Rencontre',
			text: 'Une rencontre.',
			blocking: true,
			trigger: 'random',
			weight: 1,
			priority: 0,
			cooldownTurns: 0,
			unique: false,
			when: { op: 'eq', stat: 'player.hasPartner', value: 0 },
			actors: [],
			choices: [
				{
					id: 'commit',
					label: 'S’engager',
					hints: [],
					costs: [],
					effects: [{ op: 'familyJoins', relation: 'partner' }]
				},
				{ id: 'single', label: 'Rester seul', hints: [], costs: [], effects: [] }
			]
		},
		{
			id: 'test.birth',
			category: 'family',
			title: 'Naissance',
			text: 'Avec {partner}.',
			blocking: false,
			trigger: 'random',
			weight: 1,
			priority: 0,
			cooldownTurns: 0,
			unique: false,
			actors: [{ role: 'partner', tags: ['partner'] }],
			effects: [{ op: 'familyJoins', relation: 'child' }]
		},
		{
			id: 'test.breakup',
			category: 'family',
			title: 'Rupture',
			text: '{partner} s’en va.',
			blocking: false,
			trigger: 'random',
			weight: 1,
			priority: 0,
			cooldownTurns: 0,
			unique: false,
			actors: [{ role: 'partner', tags: ['partner'] }],
			effects: [{ op: 'separate' }]
		}
	]
};

function load(): Content {
	const result = validateContent({
		actions: { actions: [...fixtureActions.actions, ...familyActions] },
		upgrades: fixtureUpgrades,
		balance: fixtureBalance,
		cast: fixtureCast,
		events: { ...fixtureEvents, 'events/family.json': familyEvents },
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
		epitaphs: fixtureEpitaphs
	});
	if (!result.ok) throw new Error(JSON.stringify(result.issues, null, 2));
	return result.content;
}

const catalog = load();

function heirs(seed: string, used = catalog): GameState {
	return createGame({ seed, origin: 'origin.heirs', engagement: 'engagement.press' }, used);
}

function commit(state: GameState, used = catalog, steps = commitTurn().plan.steps): GameState {
	const result = transition(state, commitTurn({ steps }), used);
	if (!result.ok) throw new Error(result.error.message);
	expect(checkInvariants(result.state, used)).toEqual([]);
	return result.state;
}

describe('création du personnage', () => {
	it('applique le profil par défaut sans effet quand rien n’est choisi', () => {
		const game = createGame({ seed: 'défaut' }, catalog);
		expect(game.player.origin).toBe('origin.neutral');
		expect(game.player.engagement).toBe('engagement.none');
		expect(game.player.family).toEqual({
			partnerId: null,
			childrenIds: [],
			parentIds: [],
			siblingIds: [],
			formerPartnerIds: []
		});
	});

	it('applique les effets de l’origine et de le terrain d’engagement, et génère la famille', () => {
		const neutral = createGame({ seed: 'profil' }, catalog);
		const game = heirs('profil');
		expect(game.resources.personalCashCents).toBe(neutral.resources.personalCashCents + 50_000);
		expect(game.resources.influence).toBe(neutral.resources.influence + 6);
		expect(game.player.stress).toBe(neutral.player.stress + 2);
		expect(game.player.supports['support.owners']).toBe(50);
		expect(game.player.popularity).toBe(computePopularity(game.player.supports, catalog));
		const { parentIds, siblingIds } = game.player.family;
		expect(parentIds).toHaveLength(2);
		expect(siblingIds).toHaveLength(1);
		const politician = game.characters[parentIds[1]!]!;
		expect(politician.tags).toEqual(['kin', 'parent', 'politician']);
		expect(game.relationships[parentIds[0]!]?.attitude).toBe(20);
		expect(checkInvariants(game, catalog)).toEqual([]);
		expect(evaluateCondition(game, { op: 'origin', origin: 'origin.heirs' })).toBe(true);
		expect(evaluateCondition(game, { op: 'engagement', engagement: 'engagement.none' })).toBe(
			false
		);
	});

	it('propose les options avec leurs effets lisibles', () => {
		const options = creationOptions(catalog);
		expect(options.defaults).toEqual({
			origin: 'origin.neutral',
			engagement: 'engagement.none',
			region: 'region.test'
		});
		const effects = options.origins.find((option) => option.id === 'origin.heirs')?.effects ?? [];
		// Les montants utilisent des espaces insécables : comparaison normalisée.
		expect(effects.map((text) => text.replace(/\s/gu, ' '))).toEqual([
			'Argent personnel + 500 €',
			'Soutien : Possédants + 10'
		]);
	});
});

describe('vie de famille', () => {
	it('forme un couple, accueille un enfant puis peut se séparer', () => {
		const meeting = withEvents(['test.meeting'], undefined, catalog);
		const queued = commit(heirs('couple', meeting), meeting);
		const view = describePendingEvent(queued, meeting)!;
		const engaged = transition(queued, chooseEventCommand(view.instanceId, 'commit'), meeting);
		if (!engaged.ok) throw new Error(engaged.error.message);
		const partnerId = engaged.state.player.family.partnerId!;
		expect(engaged.state.characters[partnerId]!.tags).toEqual(['kin', 'partner']);
		expect(readStat(engaged.state, 'player.hasPartner')).toBe(1);

		const birth = withEvents(['test.birth'], undefined, catalog);
		const parent = commit(engaged.state, birth);
		const childId = parent.player.family.childrenIds[0]!;
		// L'enfant naît au trimestre résolu, juste avant la frontière.
		expect(parent.characters[childId]!.birthTurn).toBe(engaged.state.turn);
		expect(readStat(parent, 'player.children')).toBe(1);

		const breakup = withEvents(['test.breakup'], undefined, catalog);
		const separated = commit(parent, breakup);
		expect(separated.player.family.partnerId).toBeNull();
		expect(separated.player.family.formerPartnerIds).toEqual([partnerId]);
		expect(separated.characters[partnerId]!.tags).toContain('former_partner');
		expect(separated.relationships[partnerId]!.memories.at(-1)?.text).toBe('Séparation.');
	});

	it('apaise la famille proche par une action', () => {
		const meeting = withEvents(['test.meeting'], undefined, catalog);
		const queued = commit(heirs('vacances', meeting), meeting);
		const view = describePendingEvent(queued, meeting)!;
		const engaged = transition(queued, chooseEventCommand(view.instanceId, 'commit'), meeting);
		if (!engaged.ok) throw new Error(engaged.error.message);
		const partnerId = engaged.state.player.family.partnerId!;
		const before = engaged.state.relationships[partnerId]!.attitude;
		const after = commit(engaged.state, catalog, [{ kind: 'action', id: 'test.holiday' }]);
		expect(after.relationships[partnerId]!.attitude).toBeGreaterThan(before);
	});
});

describe('frontière familiale', () => {
	const base = heirs('frontière');
	const parentId = base.player.family.parentIds[0]!;

	it('verse la part d’héritage au décès d’un parent', () => {
		const characters = {
			...base.characters,
			[parentId]: { ...base.characters[parentId]!, status: 'dead' as const, leftTurn: 1 }
		};
		const result = resolveFamily(
			{ player: base.player, characters, relationships: base.relationships },
			base.resources,
			0,
			1,
			catalog
		);
		expect(result.record.inheritance).toBe(500_000);
		expect(result.resources.personalCashCents).toBe(base.resources.personalCashCents + 500_000);
	});

	it('fait payer les enfants à charge, signale la négligence et fait jouer le partenaire', () => {
		const partner = {
			...base.characters[parentId]!,
			id: 'character.900',
			tags: ['kin', 'partner']
		};
		const child = {
			...base.characters[parentId]!,
			id: 'character.901',
			tags: ['kin', 'child'],
			birthTurn: 0
		};
		const player = {
			...base.player,
			stress: 50,
			family: { ...base.player.family, partnerId: partner.id, childrenIds: [child.id] }
		};
		const relationships = {
			...base.relationships,
			[partner.id]: { metTurn: 0, attitude: 20, memories: [] },
			[child.id]: { metTurn: 0, attitude: 10, memories: [] }
		};
		const characters = { ...base.characters, [partner.id]: partner, [child.id]: child };
		const result = resolveFamily(
			{ player, characters, relationships },
			base.resources,
			95,
			1,
			catalog
		);
		expect(result.record).toMatchObject({ childCosts: -10_000, neglected: true, stress: -1 });
		// La négligence entame l'attitude ; elle reste assez haute pour apaiser.
		expect(result.parts.relationships[partner.id]!.attitude).toBeLessThan(20);
		expect(result.parts.player.stress).toBe(49);
	});

	it('constate le veuvage quand le partenaire décède', () => {
		const partner = {
			...base.characters[parentId]!,
			id: 'character.902',
			tags: ['kin', 'partner'],
			status: 'dead' as const,
			leftTurn: 1
		};
		const player = { ...base.player, family: { ...base.player.family, partnerId: partner.id } };
		const result = resolveFamily(
			{
				player,
				characters: { ...base.characters, [partner.id]: partner },
				relationships: base.relationships
			},
			base.resources,
			0,
			1,
			catalog
		);
		expect(result.record.widowed).toBe(partner.id);
		expect(result.parts.player.family.partnerId).toBeNull();
		expect(result.parts.player.family.formerPartnerIds).toEqual([partner.id]);
	});

	it('détecte un membre de la famille inconnu', () => {
		const broken: GameState = {
			...base,
			player: { ...base.player, family: { ...base.player.family, childrenIds: ['character.999'] } }
		};
		expect(checkInvariants(broken, catalog).join('\n')).toContain('membre de la famille inconnu');
	});
});

describe('projection du profil et de la famille', () => {
	it('présente l’origine, le terrain d’engagement, la situation et les liens familiaux', () => {
		const game = heirs('projection-famille');
		const view = projectView(game, [], catalog);
		expect(view.profile).toEqual({
			origin: 'Héritiers',
			engagement: 'Presse',
			family: 'célibataire'
		});
		// Les membres de la famille ouvrent la liste des relations.
		expect(
			view.people
				.slice(0, 3)
				.map((person) => person.role)
				.sort()
		).toEqual(['Famille — fratrie', 'Famille — parent', 'Famille — parent']);
		const result = transition(game, commitTurn(), catalog);
		if (!result.ok) throw new Error(result.error.message);
		expect(quarterLog(result).family).toMatchObject({ inheritance: 0, widowed: null });
	});
});
