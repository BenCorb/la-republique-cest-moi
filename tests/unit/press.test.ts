import { describe, expect, it } from 'vitest';
import type { Content } from '../../src/lib/game/content/types.ts';
import { validateContent, type RawContent } from '../../src/lib/game/content/validate.ts';
import {
	articleEffect,
	articleTone,
	checkInvariants,
	commitTurn,
	createGame,
	evaluateCondition,
	followsPlayer,
	mediaIssue,
	ownedMedia,
	pressAudience,
	previewPlan,
	resolveMediaRef,
	resolvePress,
	transition,
	type Campaign,
	type GameState,
	type LegalCase,
	type MandateInstance,
	type OwnedUpgrade,
	type PlanStep,
	type PressInputs,
	type TransitionSuccess
} from '../../src/lib/game/engine/index.ts';
import { gameStateSchema } from '../../src/lib/game/persistence/state-schema.ts';
import { projectView } from '../../src/lib/game/app/view-model.ts';
import {
	fixtureActions,
	fixtureBalance,
	fixtureCareer,
	fixtureCast,
	fixtureEntourage,
	fixtureEvents,
	fixtureJustice,
	fixtureMedia,
	fixtureInstitutions,
	fixtureEpitaphs,
	fixturePromises,
	fixtureProfiles,
	fixtureSupports,
	fixtureTraits,
	fixtureUpgrades,
	fixtureWealth,
	fixtureWorld,
	quarterLog
} from '../fixtures/content.ts';

const outlet = (id: string, overrides: Record<string, unknown> = {}) => ({
	id,
	name: `Média ${id}`,
	kind: 'reference',
	line: 'Ligne éditoriale',
	description: 'Un média de test.',
	scope: 'national',
	audience: 50,
	baseRelation: 0,
	groups: ['support.owners'],
	coverage: { justice: 1, promise: 1, election: 1, lifestyle: 1, ownership: 1 },
	amplifyPercent: 100,
	...overrides
});

/** Médias : le quotidien de la région, celui d'une autre région, un national, un satirique hostile ; effets lisibles. */
const pressCatalog = {
	...fixtureMedia,
	media: [
		outlet('media.local', {
			kind: 'regional',
			scope: 'regional',
			region: 'region.test',
			groups: ['support.workers']
		}),
		outlet('media.other', {
			kind: 'regional',
			scope: 'regional',
			region: 'region.other',
			groups: ['support.workers']
		}),
		outlet('media.national'),
		outlet('media.satire', { kind: 'satirical', baseRelation: -40, groups: ['support.members'] })
	],
	balance: {
		...fixtureMedia.balance,
		maxArticlesPerTurn: 2,
		toneEffects: { critical: -4, neutral: 0, favorable: 2 },
		criticalExposure: 2
	}
};

const mediaActions = [
	{
		id: 'media.interview',
		label: 'Accorder une interview',
		description: 'Entretien.',
		timeCost: 10,
		maxPerTurn: 1,
		costs: [],
		effects: [{ op: 'giveInterview' }, { op: 'addMediaRelation', media: 'target', value: 4 }],
		target: 'media'
	}
];

const paper = {
	id: 'test.paper',
	family: 'personal',
	label: 'Racheter le journal',
	description: 'Un journal de test.',
	treasury: 'personalCashCents',
	timeCost: 5,
	maxOwned: 1,
	price: [{ resource: 'personalCashCents', amount: 50_000 }],
	upkeep: [],
	production: [],
	asset: {
		annualYieldPercent: 0,
		annualGrowthPercent: 0,
		volatilityPercent: 0,
		economySensitivityPercent: 0,
		failurePerMille: 0,
		salePercent: 80,
		stressPerTurn: 0,
		media: 'media.local'
	}
};

function raw(overrides: Partial<RawContent> = {}): RawContent {
	return {
		actions: { actions: [...fixtureActions.actions, ...mediaActions] },
		upgrades: { upgrades: [...fixtureUpgrades.upgrades, paper] },
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
		media: pressCatalog,
		institutions: fixtureInstitutions,
		epitaphs: fixtureEpitaphs,
		...overrides
	};
}

function load(overrides: Partial<RawContent> = {}): Content {
	const result = validateContent(raw(overrides));
	if (!result.ok) throw new Error(JSON.stringify(result.issues, null, 2));
	return result.content;
}

function issuesOf(overrides: Partial<RawContent>): string[] {
	const result = validateContent(raw(overrides));
	return result.ok ? [] : result.issues.map((issue) => `${issue.path} : ${issue.message}`);
}

const catalog = load();
const interview = (target: string): PlanStep => ({
	kind: 'action',
	id: 'media.interview',
	target
});

function commit(state: GameState, steps: PlanStep[] = []): TransitionSuccess {
	const result = transition(state, commitTurn({ steps }), catalog);
	if (!result.ok) throw new Error(`${result.error.message} ${JSON.stringify(result.error.issues)}`);
	expect(checkInvariants(result.state, catalog)).toEqual([]);
	return result;
}

function inputs(state: GameState, overrides: Partial<PressInputs> = {}): PressInputs {
	return {
		turn: state.turn,
		upgrades: state.upgrades,
		mandates: state.mandates,
		campaigns: state.campaigns,
		ballots: state.ballots,
		cases: state.cases,
		justice: null,
		promises: null,
		...overrides
	};
}

const playerCase: LegalCase = {
	caseId: 'case.1',
	factId: 'fact.1',
	defendantId: null,
	openedTurn: 0,
	stage: 'investigation',
	dueTurn: 4,
	outcome: null,
	closedTurn: null,
	sentence: null
};

function press(state: GameState, overrides: Partial<PressInputs> = {}, content = catalog) {
	return resolvePress(
		{ player: state.player, world: state.world, rng: state.rng },
		inputs(state, overrides),
		content
	);
}

describe('médias et fil de presse (P3-03)', () => {
	it('crée les médias du catalogue avec leur relation de départ', () => {
		const state = createGame({ seed: 'medias' }, catalog);
		expect(state.world.media).toEqual({
			'media.local': { relation: 0, interviewTurn: null },
			'media.other': { relation: 0, interviewTurn: null },
			'media.national': { relation: 0, interviewTurn: null },
			'media.satire': { relation: -40, interviewTurn: null }
		});
		expect(gameStateSchema.safeParse(state).success).toBe(true);
	});

	it('décale la tonalité selon la relation, adoucit un média possédé, jamais de satire favorable', () => {
		const national = catalog.media['media.national']!;
		const satire = catalog.media['media.satire']!;
		expect(articleTone('critical', national, 0, false, catalog)).toBe('critical');
		expect(articleTone('critical', national, 30, false, catalog)).toBe('neutral');
		expect(articleTone('favorable', national, -30, false, catalog)).toBe('neutral');
		expect(articleTone('neutral', national, -100, true, catalog)).toBe('favorable');
		expect(articleTone('neutral', satire, 80, false, catalog)).toBe('neutral');
		// Relation très marquée : deux crans (P3-24) ; ligne éditoriale : un cran de plus ou de moins.
		expect(articleTone('critical', national, 60, false, catalog)).toBe('favorable');
		expect(articleTone('favorable', national, -60, false, catalog)).toBe('critical');
		expect(articleTone('neutral', national, 0, false, catalog, -1)).toBe('critical');
		expect(articleTone('neutral', national, 0, false, catalog, 1)).toBe('favorable');
	});

	it('proportionne l’effet à l’audience et à l’exposition, borné, réduit pour un média possédé', () => {
		const national = catalog.media['media.national']!;
		expect(articleEffect('critical', national, 0, false, catalog)).toBe(-4);
		expect(articleEffect('critical', national, 100, false, catalog)).toBe(-5);
		expect(articleEffect('critical', national, 0, true, catalog)).toBe(-2);
		expect(articleEffect('neutral', national, 100, false, catalog)).toBe(0);
	});

	it('couvre une révélation du joueur, jamais un dossier de l’entourage', () => {
		const state = createGame({ seed: 'révélation' }, catalog);
		const revealed = press(state, {
			cases: [playerCase],
			justice: {
				cases: [{ caseId: 'case.1', kind: 'revealed' }],
				changes: [],
				gauges: [],
				politics: []
			}
		});
		const [article] = revealed.record.articles;
		expect(article).toMatchObject({ topic: 'justice', tone: 'critical', detail: 'revealed' });
		expect(article?.exposure).toBe(2);
		expect(revealed.parts.player.exposure).toBe(state.player.exposure + 2);
		const media = catalog.media[article!.mediaId]!;
		for (const groupId of media.groups) {
			expect(revealed.parts.player.supports[groupId]).toBeLessThan(state.player.supports[groupId]!);
		}

		const entourage = press(state, {
			cases: [{ ...playerCase, defendantId: 'char.1' }],
			justice: {
				cases: [{ caseId: 'case.1', kind: 'revealed' }],
				changes: [],
				gauges: [],
				politics: []
			}
		});
		expect(entourage.record.articles).toEqual([]);
	});

	it('réserve la presse nationale aux joueurs exposés (sauf affaires judiciaires)', () => {
		const state = createGame({ seed: 'exposition' }, catalog);
		const promise = {
			changes: [],
			gauges: [],
			politics: [
				{
					kind: 'promise' as const,
					pledgeId: 'pledge.1',
					promiseId: 'promise.tax',
					change: 'kept' as const
				}
			]
		};
		const quiet = press(state, { promises: promise });
		expect(quiet.record.articles.map((article) => article.mediaId)).toEqual(['media.local']);
		expect(quiet.record.articles[0]).toMatchObject({ topic: 'promise', tone: 'favorable' });
		const exposed = { ...state, player: { ...state.player, exposure: 60 } };
		const seen = new Set<string>();
		for (let index = 0; index < 30; index += 1) {
			const result = press(
				{ ...exposed, rng: { ...exposed.rng, state: index * 7919 + 1 } },
				{ promises: promise }
			);
			for (const article of result.record.articles) seen.add(article.mediaId);
		}
		expect(seen).toEqual(new Set(['media.local', 'media.national', 'media.satire']));
	});

	it('limite le nombre d’articles par trimestre', () => {
		const state = createGame({ seed: 'limite' }, catalog);
		const kinds = ['kept', 'partial', 'abandoned'] as const;
		const result = press(state, {
			promises: {
				changes: [],
				gauges: [],
				politics: kinds.map((change, index) => ({
					kind: 'promise' as const,
					pledgeId: `pledge.${index + 1}`,
					promiseId: 'promise.tax',
					change
				}))
			}
		});
		expect(result.record.articles).toHaveLength(2);
	});

	it('publie l’interview accordée par le média choisi, puis la relation revient vers sa référence', () => {
		let state = createGame({ seed: 'interview' }, catalog);
		const first = commit(state, [interview('media.local')]);
		state = first.state;
		const entry = quarterLog(first);
		expect(entry.steps[0]?.politics).toEqual([
			{ kind: 'interview', mediaId: 'media.local' },
			{ kind: 'mediaRelation', mediaId: 'media.local', delta: 4 }
		]);
		expect(entry.press?.articles).toEqual([
			expect.objectContaining({ mediaId: 'media.local', topic: 'interview', tone: 'neutral' })
		]);
		expect(entry.press?.relations).toContainEqual({ mediaId: 'media.local', delta: -1 });
		expect(state.world.media['media.local']).toEqual({ relation: 3, interviewTurn: 0 });
		const next = commit(state);
		expect(quarterLog(next).press?.articles).toEqual([]);
	});

	it('espace les interviews accordées à un même média', () => {
		let state = commit(createGame({ seed: 'délai' }, catalog), [interview('media.local')]).state;
		for (let turn = 1; turn < 4; turn += 1) {
			const preview = previewPlan(state, { steps: [interview('media.local')] }, catalog);
			expect(preview.issues[0]?.message).toContain('vous a déjà interviewé récemment');
			state = commit(state).state;
		}
		expect(previewPlan(state, { steps: [interview('media.local')] }, catalog).valid).toBe(true);
	});

	it('refuse un média national qui ne suit pas encore le joueur', () => {
		const state = createGame({ seed: 'refus' }, catalog);
		const preview = previewPlan(state, { steps: [interview('media.national')] }, catalog);
		expect(preview.valid).toBe(false);
		expect(preview.issues[0]?.message).toContain('ne s’intéresse pas encore à vous');
	});

	it('fait réagir les autres médias au rachat, et adoucit ensuite le média possédé', () => {
		let state = createGame({ seed: 'rachat' }, catalog);
		const bought = commit(state, [{ kind: 'purchase', id: 'test.paper' }]);
		state = bought.state;
		const ownership = quarterLog(bought).press?.articles ?? [];
		expect(ownership).toHaveLength(1);
		expect(ownership[0]).toMatchObject({ topic: 'ownership', subjectId: 'media.local' });
		expect(ownership[0]?.mediaId).not.toBe('media.local');
		expect(
			evaluateCondition(
				{
					turn: state.turn,
					player: state.player,
					resources: state.resources,
					upgrades: state.upgrades,
					world: state.world,
					mandates: state.mandates,
					campaigns: state.campaigns,
					institutions: state.institutions,
					staff: state.staff,
					facts: state.facts,
					cases: state.cases,
					promises: state.promises
				},
				{ op: 'ownsUpgrade', upgrade: 'test.paper' }
			)
		).toBe(true);
		const preview = previewPlan(state, { steps: [interview('media.local')] }, catalog);
		expect(preview.issues[0]?.message).toContain('vous appartient déjà');
		const covered = press(state, {
			turn: state.turn,
			promises: {
				changes: [],
				gauges: [],
				politics: [
					{ kind: 'promise', pledgeId: 'pledge.1', promiseId: 'promise.tax', change: 'abandoned' }
				]
			}
		});
		expect(covered.record.articles[0]).toMatchObject({ mediaId: 'media.local', tone: 'neutral' });
	});

	it('ne consomme aucun tirage sans sujet ni ambiance', () => {
		const state = createGame({ seed: 'silence' }, catalog);
		const result = press(state);
		expect(result.parts.rng).toEqual(state.rng);
		expect(result.record.articles).toEqual([]);
	});

	it('est déterministe pour un même PRNG', () => {
		const state = createGame({ seed: 'déterminisme' }, catalog);
		const exposed = { ...state, player: { ...state.player, exposure: 60 } };
		const overrides = {
			cases: [playerCase],
			justice: {
				cases: [{ caseId: 'case.1', kind: 'revealed' as const }],
				changes: [],
				gauges: [],
				politics: []
			}
		};
		expect(press(exposed, overrides)).toEqual(press(exposed, overrides));
	});

	it('affiche le fil de presse et les médias dans la vue', () => {
		const state = commit(createGame({ seed: 'vue' }, catalog), [interview('media.local')]).state;
		const view = projectView(state, [], catalog);
		expect(view.press[0]).toMatchObject({
			media: 'Média media.local',
			aboutPlayer: true,
			toneLabel: 'Neutre',
			critical: false
		});
		expect(view.press[0]?.title).toContain('Titre interview neutral');
		const outlets = view.career.media.outlets;
		expect(outlets.map((entry) => entry.mediaId)).toEqual([
			'media.local',
			'media.national',
			'media.satire'
		]);
		expect(outlets[0]).toMatchObject({ follows: true, owned: false, relationLabel: 'Neutre' });
		expect(outlets[1]?.follows).toBe(false);
		expect(outlets[2]?.relationLabel).toBe('Réservé');
	});

	describe('validation du catalogue', () => {
		it('exige un titre générique pour chaque sujet et tonalité', () => {
			const headlines = pressCatalog.headlines.filter(
				(headline) => headline.id !== 'headline.justice_critical'
			);
			expect(issuesOf({ media: { ...pressCatalog, headlines } })).toContain(
				'headlines : aucun titre générique pour le sujet « justice » (critical)'
			);
		});

		it('refuse les variables et précisions inconnues', () => {
			const headlines = [
				...pressCatalog.headlines,
				{
					id: 'headline.bad',
					topic: 'promise',
					tone: 'critical',
					details: ['won'],
					text: '{player} a menti'
				}
			];
			const issues = issuesOf({ media: { ...pressCatalog, headlines } });
			expect(issues).toContain(
				`headlines[${headlines.length - 1}].text : variable non permise : {player}`
			);
			expect(issues).toContain(
				`headlines[${headlines.length - 1}].details : précision inconnue : won`
			);
		});

		it('rattache un actif médiatique à un média connu, en un seul exemplaire', () => {
			const broken = { ...paper, maxOwned: 2, asset: { ...paper.asset, media: 'media.ghost' } };
			const issues = issuesOf({ upgrades: { upgrades: [...fixtureUpgrades.upgrades, broken] } });
			expect(issues).toEqual(
				expect.arrayContaining([
					expect.stringContaining('média inconnu : media.ghost'),
					expect.stringContaining('un seul exemplaire')
				])
			);
		});

		it('réserve « target » et l’interview aux actions ciblant un média', () => {
			const action = {
				...mediaActions[0]!,
				id: 'media.loose',
				target: undefined
			};
			const issues = issuesOf({
				actions: { actions: [...fixtureActions.actions, ...mediaActions, action] }
			});
			expect(issues).toEqual(
				expect.arrayContaining([
					expect.stringContaining('interview réservée aux actions ciblant un média'),
					expect.stringContaining('« target » réservé aux actions ciblant un média')
				])
			);
		});
	});
});

describe('presse régionale (P3-18)', () => {
	const deputy: MandateInstance = {
		instanceId: 'term.1',
		mandateId: 'mandate.deputy',
		startTurn: 0,
		access: 'election',
		status: 'active',
		endTurn: null,
		endReason: null,
		side: null,
		portfolio: null
	};
	const running = (electionId: string): Campaign => ({
		campaignId: 'campaign.1',
		ballotId: 'ballot.1',
		electionId,
		declaredTurn: 0,
		partyId: null,
		invested: false,
		preparation: 0,
		advanceCents: 0,
		opponentId: null,
		status: 'running',
		playerPercent: null,
		reason: null,
		role: 'head',
		listRank: 1,
		resultTurn: null
	});

	it('suit le joueur par son quotidien régional, jamais par celui d’une autre région', () => {
		const state = createGame({ seed: 'région' }, catalog);
		expect(state.player.territory.regionId).toBe('region.test');
		const audience = pressAudience(state.player, [], [], catalog);
		expect(audience).toEqual({
			exposure: state.player.exposure,
			regionId: 'region.test',
			national: false
		});
		expect(followsPlayer(catalog.media['media.local']!, audience, catalog)).toBe(true);
		expect(followsPlayer(catalog.media['media.other']!, audience, catalog)).toBe(false);
		expect(followsPlayer(catalog.media['media.national']!, audience, catalog)).toBe(false);
		expect(mediaIssue('media.other', audience, [], catalog)).toBe(
			'Média media.other ne couvre pas votre région'
		);
		expect(previewPlan(state, { steps: [interview('media.other')] }, catalog).valid).toBe(false);
	});

	it('ouvre la presse nationale à un mandat national ou à une candidature nationale en cours', () => {
		const { player } = createGame({ seed: 'envergure' }, catalog);
		const national = catalog.media['media.national']!;
		const withMandate = pressAudience(player, [deputy], [], catalog);
		expect(withMandate.national).toBe(true);
		expect(followsPlayer(national, withMandate, catalog)).toBe(true);
		const ended = pressAudience(player, [{ ...deputy, status: 'ended' }], [], catalog);
		expect(ended.national).toBe(false);
		expect(pressAudience(player, [], [running('election.national')], catalog).national).toBe(true);
		expect(pressAudience(player, [], [running('election.local')], catalog).national).toBe(false);
		// Le seuil d'exposition reste une autre porte d'entrée.
		const exposed = pressAudience({ ...player, exposure: 30 }, [], [], catalog);
		expect(followsPlayer(national, exposed, catalog)).toBe(true);
	});

	it('n’écrit jamais dans le journal d’une autre région, même sur une affaire très exposée', () => {
		const state = createGame({ seed: 'croisée' }, catalog);
		const exposed = { ...state, player: { ...state.player, exposure: 90 } };
		const promise = {
			changes: [],
			gauges: [],
			politics: [
				{
					kind: 'promise' as const,
					pledgeId: 'pledge.1',
					promiseId: 'promise.tax',
					change: 'kept' as const
				}
			]
		};
		const seen = new Set<string>();
		for (let index = 0; index < 40; index += 1) {
			const result = press(
				{ ...exposed, rng: { ...exposed.rng, state: index * 7919 + 3 } },
				{ promises: promise, mandates: [deputy] }
			);
			for (const article of result.record.articles) seen.add(article.mediaId);
		}
		expect(seen.has('media.other')).toBe(false);
		expect(seen.has('media.local')).toBe(true);
		expect(seen.has('media.national')).toBe(true);
	});

	it('résout le rôle du quotidien d’ancrage pour les effets et le rachat', () => {
		expect(resolveMediaRef('regional_anchor', 'region.test', catalog)).toBe('media.local');
		expect(resolveMediaRef('regional_anchor', 'region.other', catalog)).toBe('media.other');
		expect(resolveMediaRef('media.national', 'region.test', catalog)).toBe('media.national');
		const anchored = load({
			upgrades: {
				upgrades: [
					...fixtureUpgrades.upgrades,
					{ ...paper, asset: { ...paper.asset, media: 'regional_anchor' } }
				]
			}
		});
		const owned: OwnedUpgrade[] = [
			{ instanceId: 'upgrade.1', upgradeId: 'test.paper', acquiredTurn: 0, valueCents: 0 }
		];
		expect([...ownedMedia(owned, 'region.test', anchored)]).toEqual(['media.local']);
		expect([...ownedMedia(owned, 'region.other', anchored)]).toEqual(['media.other']);
	});

	describe('validation', () => {
		it('exige un quotidien par région, rattaché à une région connue et unique', () => {
			const media = (list: unknown[]) => ({ media: { ...pressCatalog, media: list } });
			const [local, other, national, satire] = pressCatalog.media;
			expect(issuesOf(media([local, national, satire]))).toEqual(
				expect.arrayContaining([
					expect.stringContaining('aucun quotidien régional pour region.other')
				])
			);
			expect(
				issuesOf(media([local, { ...other, region: 'region.test' }, national, satire]))
			).toEqual(
				expect.arrayContaining([expect.stringContaining('région déjà couverte par media.local')])
			);
			expect(
				issuesOf(media([local, other, { ...national, region: 'region.test' }, satire]))
			).toEqual(
				expect.arrayContaining([
					expect.stringContaining('seul un quotidien régional est rattaché à une région')
				])
			);
		});
	});
});
