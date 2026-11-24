import { describe, expect, it } from 'vitest';
import type { Content } from '../../src/lib/game/content/types.ts';
import { validateContent } from '../../src/lib/game/content/validate.ts';
import {
	ageAt,
	checkInvariants,
	chooseEventCommand,
	commitTurn,
	createGame,
	describePendingEvent,
	evaluateCondition,
	oppositionPartyId,
	previewPlan,
	readStat,
	resolveWorld,
	transition,
	type GameState,
	type PlanStep,
	type TransitionSuccess
} from '../../src/lib/game/engine/index.ts';
import {
	fixtureActions,
	fixtureBalance,
	fixtureCast,
	fixtureContent,
	fixtureEvents,
	fixtureCareer,
	fixtureTraits,
	fixtureUpgrades,
	fixtureWorld,
	neutralWorld,
	quarterLog,
	withEvents,
	withWorld
} from '../fixtures/content.ts';

/** Catalogue de test enrichi des actions et événements politiques de P2-01. */
const politicalActions = [
	{
		id: 'party.join',
		label: 'Adhérer',
		description: 'Prendre sa carte.',
		timeCost: 10,
		maxPerTurn: 1,
		costs: [],
		requires: { op: 'eq', stat: 'player.affiliated', value: 0 },
		unavailableReason: 'Déjà encarté.',
		effects: [{ op: 'joinParty', party: 'target' }],
		target: 'party'
	},
	{
		id: 'party.meeting',
		label: 'Réunion de section',
		description: 'Réservée aux membres.',
		timeCost: 10,
		maxPerTurn: 1,
		costs: [],
		requires: { op: 'eq', stat: 'player.affiliated', value: 1 },
		unavailableReason: 'Réservé aux membres.',
		effects: [{ op: 'addResource', resource: 'influence', value: 1 }]
	},
	{
		id: 'party.leave',
		label: 'Rendre sa carte',
		description: 'Quitter le parti.',
		timeCost: 5,
		maxPerTurn: 1,
		costs: [],
		requires: { op: 'eq', stat: 'player.affiliated', value: 1 },
		unavailableReason: 'Pas encarté.',
		effects: [{ op: 'leaveParty' }]
	}
];

const politicalEvents = {
	events: [
		{
			id: 'national.strike',
			category: 'national',
			title: 'Grève contre {governing_party}',
			text: '{governing_leader} dénonce la grève.',
			blocking: false,
			trigger: 'random',
			weight: 1,
			priority: 0,
			cooldownTurns: 0,
			unique: false,
			actors: [],
			effects: [
				{ op: 'addIndicator', indicator: 'stability', value: -5 },
				{ op: 'addPartyStrength', party: 'governing', value: -2 }
			]
		},
		{
			id: 'national.congress',
			category: 'national',
			title: 'Congrès de {player_party}',
			text: '{player_party_leader} réclame votre soutien.',
			blocking: true,
			trigger: 'random',
			weight: 1,
			priority: 0,
			cooldownTurns: 0,
			unique: false,
			when: { op: 'eq', stat: 'player.affiliated', value: 1 },
			actors: [],
			choices: [
				{
					id: 'support',
					label: 'Soutenir {player_party_leader}',
					hints: [],
					costs: [],
					effects: [{ op: 'addPartyStrength', party: 'player', value: 3 }]
				},
				{
					id: 'switch',
					label: 'Passer au Petit Parti Test',
					hints: [],
					costs: [],
					effects: [{ op: 'joinParty', party: 'party.small' }]
				}
			]
		}
	]
};

function political(
	overrides: { actions?: unknown[]; events?: Record<string, unknown> } = {}
): ReturnType<typeof validateContent> {
	return validateContent({
		actions: {
			actions: [...fixtureActions.actions, ...(overrides.actions ?? politicalActions)]
		},
		upgrades: fixtureUpgrades,
		balance: fixtureBalance,
		cast: fixtureCast,
		events: overrides.events ?? { ...fixtureEvents, 'events/national.json': politicalEvents },
		world: fixtureWorld,
		traits: fixtureTraits,
		career: fixtureCareer
	});
}

function load(): Content {
	const result = political();
	if (!result.ok) throw new Error(JSON.stringify(result.issues, null, 2));
	return result.content;
}

const content = load();
const join = (target: string): PlanStep => ({ kind: 'action', id: 'party.join', target });
const act = (id: string): PlanStep => ({ kind: 'action', id });

function commit(state: GameState, steps: PlanStep[], usedContent = content): TransitionSuccess {
	const result = transition(state, commitTurn({ steps }), usedContent);
	if (!result.ok) throw new Error(result.error.message);
	expect(checkInvariants(result.state, usedContent)).toEqual([]);
	return result;
}

describe('paysage initial', () => {
	const game = createGame({ seed: 'paysage' }, content);

	it('reprend les partis, forces et gouvernement du catalogue', () => {
		expect(Object.keys(game.world.parties)).toEqual(content.partyIds);
		for (const party of fixtureWorld.parties) {
			expect(game.world.parties[party.id]?.strength).toBe(party.baseStrength);
		}
		expect(game.world.governingPartyId).toBe('party.left');
		expect(game.world.indicators).toEqual({ economy: 50, socialClimate: 50, stability: 50 });
		expect(game.player.partyId).toBeNull();
		expect(game.player.affiliations).toEqual([]);
	});

	it('tire des dirigeants distincts, nommés et d’âge plausible', () => {
		const leaders = content.partyIds.map(
			(id) => game.characters[game.world.parties[id]!.leaderId]!
		);
		expect(new Set(leaders.map((leader) => leader.name)).size).toBe(leaders.length);
		for (const [index, leader] of leaders.entries()) {
			expect(leader.id).toBe(`character.${index + 1}`);
			expect(leader.partyId).toBe(content.partyIds[index]);
			const age = ageAt(leader.birthTurn, game.turn);
			expect(age).toBeGreaterThanOrEqual(40);
			expect(age).toBeLessThanOrEqual(60);
		}
		expect(checkInvariants(game, content)).toEqual([]);
	});

	it('est reproductible pour une seed et varie entre les seeds', () => {
		expect(createGame({ seed: 'paysage' }, content)).toStrictEqual(game);
		const names = (seed: string): string[] => {
			const other = createGame({ seed }, content);
			return Object.values(other.characters).map((character) => character.name);
		};
		const variants = new Set(['a', 'b', 'c', 'd', 'e'].map((seed) => names(seed).join('|')));
		expect(variants.size).toBeGreaterThan(1);
	});

	it('garde les identifiants d’instance du prototype (personnages numérotés à part)', () => {
		expect(game.nextInstanceNumber).toBe(1);
	});
});

describe('évolution autonome', () => {
	it('reste immobile avec un équilibrage neutre', () => {
		let state = createGame({ seed: 'immobile' }, content);
		for (let turn = 0; turn < 8; turn += 1) state = commit(state, []).state;
		expect(state.world).toStrictEqual(createGame({ seed: 'immobile' }, content).world);
	});

	it('évolue sans action du joueur, dans les bornes, de façon reproductible', () => {
		const moving = withWorld({
			indicatorVolatility: 6,
			indicatorReversionPercent: 5,
			strengthVolatility: 2,
			strengthReversionPercent: 10,
			leaderChangeChance: 0.1,
			maxPartyStrength: 40
		});
		const run = (): GameState => {
			let state = createGame({ seed: 'mouvant' }, moving);
			for (let turn = 0; turn < 120; turn += 1) {
				const result = transition(state, commitTurn(), moving);
				if (!result.ok) throw new Error(result.error.message);
				expect(checkInvariants(result.state, moving)).toEqual([]);
				state = result.state;
			}
			return state;
		};
		const state = run();
		expect(run()).toStrictEqual(state);
		const records = state.history.flatMap((entry) =>
			entry.type === 'turn.resolved' && entry.world ? [entry.world] : []
		);
		expect(records.some((record) => record.indicators.length > 0)).toBe(true);
		expect(records.some((record) => record.parties.length > 0)).toBe(true);
		const changes = records.flatMap((record) => record.leaderChanges);
		expect(changes.length).toBeGreaterThan(0);
		// Les anciens dirigeants restent connus ; chaque parti a un dirigeant actuel.
		for (const change of changes) {
			expect(state.characters[change.previousLeaderId]).toBeDefined();
			expect(state.characters[change.leaderId]?.partyId).toBe(change.partyId);
		}
		// Même une fois les combinaisons de noms épuisées, deux dirigeants en place
		// ne portent jamais le même nom.
		const current = Object.values(state.world.parties).map(
			(party) => state.characters[party.leaderId]!.name
		);
		expect(new Set(current).size).toBe(current.length);
		for (const party of Object.values(state.world.parties)) {
			expect(party.strength).toBeGreaterThanOrEqual(1);
			expect(party.strength).toBeLessThanOrEqual(40);
		}
	});

	it('use le parti au gouvernement quand l’économie et le climat social se dégradent', () => {
		const wear = withWorld({ strengthReversionPercent: 50, governingIndicatorDivisor: 2 });
		const base = createGame({ seed: 'usure' }, wear);
		const gloomy: GameState = {
			...base,
			world: { ...base.world, indicators: { economy: 20, socialClimate: 20, stability: 50 } }
		};
		const next = resolveWorld(gloomy.world, gloomy.characters, 1, gloomy.rng, wear);
		// Cible : 30 + (-30 - 30) / 2 = 0 → bornée à 1 ; la moitié de l'écart est résorbée.
		expect(next.world.parties['party.left']?.strength).toBe(30 - 15);
		expect(next.world.parties['party.right']?.strength).toBe(25);
		expect(next.record.parties).toEqual([{ partyId: 'party.left', delta: -15 }]);
	});

	it('remplace un dirigeant atteint par l’âge de la retraite', () => {
		const retiring = withWorld({ leaderRetirementAge: 61 });
		const base = createGame({ seed: 'retraite' }, retiring);
		const leaderId = base.world.parties['party.small']!.leaderId;
		const aged: GameState = {
			...base,
			characters: {
				...base.characters,
				[leaderId]: { ...base.characters[leaderId]!, birthTurn: base.turn - 61 * 4 }
			}
		};
		const next = resolveWorld(aged.world, aged.characters, 1, aged.rng, retiring);
		expect(next.record.leaderChanges).toEqual([
			{
				partyId: 'party.small',
				previousLeaderId: leaderId,
				// Trois dirigeants et quatre membres de la distribution existent déjà.
				leaderId: 'character.8',
				reason: 'retirement'
			}
		]);
		expect(next.world.parties['party.small']?.leaderId).toBe('character.8');
		expect(next.characters[leaderId]?.status).toBe('retired');
	});

	it('n’évolue plus après un décès pendant le trimestre', () => {
		const deadly = { ...content, balance: { ...content.balance, world: neutralWorld() } };
		const base = createGame({ seed: 'fin' }, deadly);
		const dying: GameState = { ...base, player: { ...base.player, health: 0 } };
		const result = transition({ ...dying, player: { ...dying.player, health: 1 } }, commitTurn(), {
			...deadly,
			balance: {
				...deadly.balance,
				wellbeing: {
					...deadly.balance.wellbeing,
					ageBands: [
						{ fromAge: 0, maxHealth: 100, ageingChance: 0, ageingHealthLoss: 0, mortalityChance: 1 }
					]
				}
			}
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.state.end).not.toBeNull();
		expect(quarterLog(result).world).toBeNull();
	});
});

describe('adhésion du joueur', () => {
	it('adhère au parti choisi dans le plan et l’enregistre', () => {
		const result = commit(createGame({ seed: 'adhésion' }, content), [join('party.right')]);
		expect(result.state.player.partyId).toBe('party.right');
		expect(result.state.player.affiliations).toEqual([
			{ partyId: 'party.right', fromTurn: 0, toTurn: null }
		]);
		expect(quarterLog(result).steps[0]).toMatchObject({
			id: 'party.join',
			target: 'party.right',
			politics: [{ kind: 'joined', partyId: 'party.right' }]
		});
	});

	it('voit l’adhésion dès l’étape suivante du même plan', () => {
		const state = createGame({ seed: 'enchaînement' }, content);
		expect(previewPlan(state, { steps: [act('party.meeting')] }, content).valid).toBe(false);
		const preview = previewPlan(
			state,
			{ steps: [join('party.left'), act('party.meeting')] },
			content
		);
		expect(preview.valid).toBe(true);
		expect(preview.steps[0]?.target).toBe('party.left');
	});

	it.each<[string, PlanStep, string]>([
		['sans cible', { kind: 'action', id: 'party.join' }, 'invalid_target'],
		['cible inconnue', join('party.absent'), 'invalid_target'],
		[
			'cible sur une action non ciblée',
			{ kind: 'action', id: 'test.fixed', target: 'party.left' },
			'invalid_target'
		]
	])('refuse une adhésion %s sans modifier l’état', (_label, step, code) => {
		const state = createGame({ seed: 'refus' }, content);
		const preview = previewPlan(state, { steps: [step] }, content);
		expect(preview.issues.map((issue) => issue.code)).toContain(code);
		const result = transition(state, commitTurn({ steps: [step] }), content);
		expect(result.ok).toBe(false);
		expect(result.state).toBe(state);
	});

	it('quitte puis rejoint un autre parti en gardant l’historique', () => {
		let state = commit(createGame({ seed: 'transfuge' }, content), [join('party.left')]).state;
		state = commit(state, [act('party.leave')]).state;
		expect(state.player.partyId).toBeNull();
		state = commit(state, [join('party.small')]).state;
		expect(state.player.affiliations).toEqual([
			{ partyId: 'party.left', fromTurn: 0, toTurn: 1 },
			{ partyId: 'party.small', fromTurn: 2, toTurn: null }
		]);
	});
});

describe('conditions et effets politiques', () => {
	const base = createGame({ seed: 'conditions-politiques' }, content);
	const member: GameState = {
		...base,
		player: {
			...base.player,
			partyId: 'party.left',
			affiliations: [{ partyId: 'party.left', fromTurn: 0, toTurn: null }]
		}
	};

	it('lit les indicateurs, l’adhésion, la force et le gouvernement', () => {
		expect(readStat(base, 'world.stability')).toBe(50);
		expect(readStat(base, 'player.affiliated')).toBe(0);
		expect(readStat(base, 'player.partyStrength')).toBe(0);
		expect(readStat(base, 'player.partyGoverning')).toBe(0);
		expect(readStat(member, 'player.affiliated')).toBe(1);
		expect(readStat(member, 'player.partyStrength')).toBe(30);
		expect(readStat(member, 'player.partyGoverning')).toBe(1);
		expect(evaluateCondition(member, { op: 'memberOf', party: 'party.left' })).toBe(true);
		expect(evaluateCondition(member, { op: 'memberOf', party: 'party.right' })).toBe(false);
	});

	it('désigne comme opposition le parti le plus fort hors gouvernement', () => {
		expect(oppositionPartyId(base.world, content)).toBe('party.right');
	});

	it('applique un événement national au monde et fige ses variables de texte', () => {
		const strikeOnly = withEvents(['national.strike'], undefined, content);
		const result = commit(createGame({ seed: 'grève' }, strikeOnly), [], strikeOnly);
		const [record] = quarterLog(result).events;
		expect(record?.politics).toEqual([
			{ kind: 'indicator', indicator: 'stability', delta: -5 },
			{ kind: 'partyStrength', partyId: 'party.left', delta: -2 }
		]);
		expect(record?.actors).toEqual({
			governing_leader: result.state.world.parties['party.left']!.leaderId,
			governing_party: 'party.left'
		});
		expect(result.state.world.indicators.stability).toBe(45);
	});

	it('réserve un événement de parti aux membres et résout ses textes', () => {
		const congressOnly = withEvents(['national.congress'], undefined, content);
		const outsider = commit(createGame({ seed: 'congrès' }, congressOnly), [], congressOnly);
		expect(outsider.state.phase).toBe('planning');

		const insider = commit(
			createGame({ seed: 'congrès' }, congressOnly),
			[join('party.right')],
			congressOnly
		);
		expect(insider.state.phase).toBe('decision');
		const view = describePendingEvent(insider.state, congressOnly);
		const leader = insider.state.characters[insider.state.world.parties['party.right']!.leaderId]!;
		expect(view?.title).toBe('Congrès de Parti de Droite Test');
		expect(view?.choices[0]?.label).toBe(`Soutenir ${leader.name}`);

		const chosen = transition(
			insider.state,
			chooseEventCommand(view!.instanceId, 'switch'),
			congressOnly
		);
		expect(chosen.ok).toBe(true);
		if (!chosen.ok) return;
		expect(chosen.state.player.partyId).toBe('party.small');
		expect(chosen.state.player.affiliations.map((entry) => entry.toTurn)).toEqual([1, null]);
		expect(checkInvariants(chosen.state, congressOnly)).toEqual([]);
	});
});

describe('validation du contenu politique', () => {
	const messages = (result: ReturnType<typeof validateContent>): string =>
		result.ok ? '' : result.issues.map((issue) => `${issue.path} ${issue.message}`).join('\n');

	it('accepte le catalogue politique de test', () => {
		expect(messages(political())).toBe('');
	});

	it('exige une condition d’adhésion pour citer le parti du joueur', () => {
		const event = structuredClone(politicalEvents.events[1]!) as Record<string, unknown>;
		delete event.when;
		const result = political({
			events: { ...fixtureEvents, 'events/national.json': { events: [event] } }
		});
		expect(messages(result)).toContain('{player_party} exige une condition imposant l’adhésion');
	});

	it('rejette les partis inconnus et la cible hors action ciblée', () => {
		const event = structuredClone(politicalEvents.events[0]!) as { effects: unknown[] };
		event.effects = [
			{ op: 'addPartyStrength', party: 'party.absent', value: 1 },
			{ op: 'joinParty', party: 'target' }
		];
		const result = political({
			events: { ...fixtureEvents, 'events/national.json': { events: [event] } }
		});
		expect(messages(result)).toContain('parti inconnu : party.absent');
		expect(messages(result)).toContain('« target » réservé aux actions ciblant un parti');
	});

	it('rejette une action ciblée qui n’utilise pas sa cible', () => {
		const result = political({
			actions: [{ ...politicalActions[1], target: 'party' }]
		});
		expect(messages(result)).toContain('cible déclarée mais jamais utilisée');
	});
});

describe('invariants du monde', () => {
	const base = createGame({ seed: 'invariants-monde' }, fixtureContent);

	it.each<[string, GameState, string]>([
		[
			'parti actuel sans adhésion',
			{ ...base, player: { ...base.player, partyId: 'party.left' } },
			'parti du joueur incohérent'
		],
		[
			'deux adhésions en cours',
			{
				...base,
				player: {
					...base.player,
					partyId: 'party.right',
					affiliations: [
						{ partyId: 'party.left', fromTurn: 0, toTurn: null },
						{ partyId: 'party.right', fromTurn: 0, toTurn: null }
					]
				}
			},
			'adhésion en cours qui n’est pas la dernière'
		],
		[
			'dirigeant inconnu',
			{
				...base,
				world: {
					...base.world,
					parties: {
						...base.world.parties,
						'party.left': { strength: 30, leaderId: 'character.99' }
					}
				}
			},
			'dirigeant inconnu'
		],
		[
			'indicateur hors bornes',
			{ ...base, world: { ...base.world, indicators: { ...base.world.indicators, economy: 101 } } },
			'indicateur invalide'
		]
	])('détecte : %s', (_label, state, fragment) => {
		expect(checkInvariants(state, fixtureContent).join('\n')).toContain(fragment);
	});
});

describe('projection du monde politique', () => {
	it('présente partis, indicateurs et adhésion sans chiffres d’axes', async () => {
		const { projectView } = await import('../../src/lib/game/app/view-model.ts');
		const state = createGame({ seed: 'projection' }, content);
		const view = projectView(state, [], content);
		expect(view.world.parties.map((party) => party.id)).toEqual([
			'party.left',
			'party.right',
			'party.small'
		]);
		expect(view.world.parties.map((party) => party.share)).toEqual([50, 42, 8]);
		expect(view.world.parties[0]?.governing).toBe(true);
		expect(view.world.parties[0]?.positions.join(' ')).not.toMatch(/\d/);
		expect(view.world.affiliation).toBe('Sans étiquette');
		expect(view.world.indicators.map((indicator) => indicator.gauge.label)).toEqual([
			'Hésitante',
			'Grincheux',
			'Fragile'
		]);
		// L'adhésion ciblée se planifie depuis le monde politique, pas depuis l'agenda.
		expect(view.actions.map((action) => action.id)).not.toContain('party.join');
		expect(view.world.parties.every((party) => party.joinable)).toBe(true);

		const planned = projectView(state, [join('party.right')], content);
		expect(planned.plan.steps[0]?.label).toBe('Adhérer : Parti de Droite Test');
		expect(planned.plan.steps[0]?.details).toContain('Adhésion : Parti de Droite Test');
		expect(planned.world.parties.find((party) => party.id === 'party.right')?.joinPlanned).toBe(
			true
		);
		// Une seule adhésion par trimestre : les autres partis deviennent indisponibles.
		expect(planned.world.parties.find((party) => party.id === 'party.small')?.joinable).toBe(false);

		const member = commit(state, [join('party.right')]).state;
		const memberView = projectView(member, [], content);
		expect(memberView.world.affiliation).toBe('Membre du Parti de Droite Test depuis le T1 2000');
		expect(memberView.world.partyAcronym).toBe('PDT');
		expect(memberView.world.leave?.addable).toBe(true);
		expect(memberView.journal[0]?.lines.map((line) => line.text)).toContain(
			'Adhérer : Parti de Droite Test — adhésion au Parti de Droite Test'
		);
	});
});
