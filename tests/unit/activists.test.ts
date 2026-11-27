import { describe, expect, it } from 'vitest';
import type { ActionDefinition, Content } from '../../src/lib/game/content/types.ts';
import { loadContent } from '../../src/lib/game/content/load.ts';
import {
	activistCapacity,
	activistTier,
	campaignScore,
	checkInvariants,
	commitTurn,
	createGame,
	fieldworkEffects,
	mobilizationPenalty,
	mobilizationPercent,
	nextActivistTier,
	previewPlan,
	resolveActivists,
	transition,
	type Campaign,
	type DeadlinesRecord,
	type GameState,
	type MandateInstance,
	type OwnedUpgrade
} from '../../src/lib/game/engine/index.ts';
import { gameStateSchema } from '../../src/lib/game/persistence/state-schema.ts';
import { projectView } from '../../src/lib/game/app/view-model.ts';
import { fixtureContent } from '../fixtures/content.ts';

/** Base militante organique (P3-19, PT-P3-09-014). */
const real = loadContent();

/** Catalogue de test : cotisations, frais et pénalité de mobilisation actifs ; une action de terrain. */
const leaflets: ActionDefinition = {
	id: 'test.leaflets',
	label: 'Tracter',
	description: 'Des tracts au marché.',
	timeCost: 10,
	maxPerTurn: 2,
	costs: [],
	effects: [{ op: 'addResource', resource: 'influence', value: 1 }],
	fieldwork: { op: 'addResource', resource: 'influence', value: 2 }
};
const content: Content = {
	...fixtureContent,
	actions: { ...fixtureContent.actions, [leaflets.id]: leaflets },
	actionIds: [...fixtureContent.actionIds, leaflets.id],
	elections: Object.fromEntries(
		Object.entries(fixtureContent.elections).map(([id, election]) => [
			id,
			{ ...election, mobilizationNeed: 100 }
		])
	),
	balance: {
		...fixtureContent.balance,
		activists: {
			...fixtureContent.balance.activists,
			start: 3,
			duesCents: 100,
			mobilizationWeight: 20,
			tiers: [
				{ id: 'tier.isolated', label: 'Fidèles', min: 0, fieldMultiplier: 0, upkeepCents: 0 },
				{ id: 'tier.core', label: 'Noyau', min: 5, fieldMultiplier: 1, upkeepCents: 0 },
				{ id: 'tier.committee', label: 'Comité', min: 25, fieldMultiplier: 2, upkeepCents: 5_000 }
			]
		}
	}
};

const premises: OwnedUpgrade = {
	instanceId: 'upgrade.1',
	upgradeId: 'premises',
	acquiredTurn: 0,
	valueCents: null
};
const withPremises: Content = {
	...content,
	upgrades: {
		...content.upgrades,
		premises: {
			id: 'premises',
			family: 'organization',
			label: 'Local',
			description: 'Un local.',
			treasury: 'politicalBudgetCents',
			timeCost: 10,
			maxOwned: 1,
			price: [],
			upkeep: [],
			production: [],
			activists: { capacity: 100, retentionPercent: 4 }
		}
	}
};

const mandate = (mandateId: string): MandateInstance => ({
	instanceId: 'term.1',
	mandateId,
	startTurn: 0,
	access: 'election',
	status: 'active',
	endTurn: null,
	endReason: null
});

function campaign(overrides: Partial<Campaign> = {}): Campaign {
	return {
		campaignId: 'campaign.1',
		ballotId: 'ballot.1',
		electionId: 'election.local',
		declaredTurn: 0,
		partyId: null,
		invested: false,
		preparation: 10,
		advanceCents: 0,
		opponentId: null,
		status: 'running',
		playerPercent: null,
		reason: null,
		...overrides
	};
}

function base(seed = 'militants'): GameState {
	return createGame({ seed }, content);
}

/** Fait tourner la base seule, ressources et soutiens figés, pendant `quarters` trimestres. */
function evolve(state: GameState, quarters: number, used = content, upgrades: OwnedUpgrade[] = []) {
	let player = state.player;
	let resources = state.resources;
	const history: number[] = [];
	for (let turn = 1; turn <= quarters; turn += 1) {
		const result = resolveActivists(
			player,
			resources,
			{ turn, upgrades, mandates: [], campaigns: [], deadlines: null },
			used
		);
		player = result.player;
		resources = result.resources;
		history.push(player.activists);
	}
	return { player, resources, history };
}

describe('paliers et capacité', () => {
	it('classe un effectif dans son palier et annonce le suivant', () => {
		expect(activistTier(0, content).id).toBe('tier.isolated');
		expect(activistTier(5, content).id).toBe('tier.core');
		expect(activistTier(24, content).id).toBe('tier.core');
		expect(activistTier(500, content).id).toBe('tier.committee');
		expect(nextActivistTier(6, content)?.min).toBe(25);
		expect(nextActivistTier(30, content)).toBeNull();
		expect(real.balance.activists.tiers.map((tier) => tier.label)).toEqual([
			'Quelques fidèles',
			'Noyau',
			'Comité local',
			'Section implantée',
			'Réseau régional',
			'Organisation nationale'
		]);
	});

	it('additionne base, parti, mandats et locaux ouverts au trimestre précédent', () => {
		const { player } = base();
		const balance = content.balance.activists;
		expect(activistCapacity(player, [], [], 1, content)).toBe(balance.baseCapacity);
		const member = { ...player, partyId: content.partyIds[0]! };
		expect(activistCapacity(member, [], [], 1, content)).toBe(
			balance.baseCapacity + balance.partyCapacity
		);
		const rank = content.mandates['mandate.deputy']!.rank;
		expect(activistCapacity(player, [], [mandate('mandate.deputy')], 1, content)).toBe(
			balance.baseCapacity + rank * balance.mandateCapacityPerRank
		);
		// Le local acheté au trimestre 0 n'accueille qu'à partir du trimestre 1.
		expect(activistCapacity(player, [premises], [], 0, withPremises)).toBe(balance.baseCapacity);
		expect(activistCapacity(player, [premises], [], 1, withPremises)).toBe(
			balance.baseCapacity + 100
		);
	});
});

describe('croissance et attrition', () => {
	it('grandit avec la notoriété et le soutien militant, sans dépasser la capacité', () => {
		const state = base();
		const keen = {
			...state,
			player: { ...state.player, supports: { ...state.player.supports, 'support.activists': 60 } },
			resources: { ...state.resources, influence: 400 }
		};
		const { history } = evolve(keen, 200);
		const capacity = content.balance.activists.baseCapacity;
		expect(history[0]).toBeGreaterThan(3);
		expect(Math.max(...history)).toBeLessThanOrEqual(capacity);
		// Pas d'emballement : la base se stabilise sous le plafond.
		expect(history.at(-1)).toBe(history.at(-20));
	});

	it('ne crée pas de militants avec une base hostile, même très exposée', () => {
		const state = base();
		const hostile = {
			...state,
			player: {
				...state.player,
				exposure: 100,
				activists: 20,
				supports: { ...state.player.supports, 'support.activists': 0 }
			},
			resources: { ...state.resources, influence: 2_500 }
		};
		const { history } = evolve(hostile, 12);
		expect(history.every((count, index) => index === 0 || count <= history[index - 1]!)).toBe(true);
		expect(history.at(-1)).toBeLessThan(20);
	});

	it('retient mieux et accueille davantage avec un local', () => {
		const state = base();
		const keen = {
			...state,
			player: { ...state.player, supports: { ...state.player.supports, 'support.activists': 60 } },
			resources: { ...state.resources, influence: 400 }
		};
		const without = evolve(keen, 80, withPremises).history.at(-1)!;
		const withLocal = evolve(keen, 80, withPremises, [premises]).history.at(-1)!;
		expect(withLocal).toBeGreaterThan(without);
		expect(withLocal).toBeLessThanOrEqual(content.balance.activists.baseCapacity + 100);
	});

	it('recrute après un scrutin disputé, même perdu, jamais après une invalidation', () => {
		const { player, resources } = base();
		const deadlines = (
			status: 'lost' | 'disqualified',
			percent: number | null
		): DeadlinesRecord => ({
			mandates: [],
			ballots: [],
			people: [],
			campaigns: [
				{
					campaignId: 'campaign.1',
					opponentId: null,
					status,
					playerPercent: percent,
					reason: null,
					advance: null
				}
			]
		});
		const lost = resolveActivists(
			player,
			resources,
			{ turn: 1, upgrades: [], mandates: [], campaigns: [], deadlines: deadlines('lost', 30) },
			content
		);
		expect(lost.record.recruits).toBe(9);
		const invalid = resolveActivists(
			player,
			resources,
			{
				turn: 1,
				upgrades: [],
				mandates: [],
				campaigns: [],
				deadlines: deadlines('disqualified', null)
			},
			content
		);
		expect(invalid.record.recruits).toBe(0);
	});

	it('verse les cotisations et paie les frais du palier, sans budget négatif', () => {
		const { player } = base();
		// Adhérent : capacité suffisante, seuls les frais impayés font partir davantage.
		const committee = { ...player, activists: 30, partyId: content.partyIds[0]! };
		const paid = resolveActivists(
			committee,
			{ influence: 0, politicalBudgetCents: 10_000, personalCashCents: 0 },
			{ turn: 1, upgrades: [], mandates: [], campaigns: [], deadlines: null },
			content
		);
		expect(paid.record).toMatchObject({ duesCents: 3_000, upkeepCents: 5_000 });
		expect(paid.resources.politicalBudgetCents).toBe(8_000);
		const broke = resolveActivists(
			committee,
			{ influence: 0, politicalBudgetCents: 0, personalCashCents: 0 },
			{ turn: 1, upgrades: [], mandates: [], campaigns: [], deadlines: null },
			content
		);
		expect(broke.resources.politicalBudgetCents).toBe(0);
		// Frais impayés : la base s'use davantage.
		expect(broke.record.departures).toBeGreaterThan(paid.record.departures);
	});
	it('annonce les cotisations et les frais du palier dans la prévision (PT-B2-001)', () => {
		const start = base();
		const state: GameState = {
			...start,
			player: { ...start.player, activists: 30, partyId: content.partyIds[0]! },
			resources: { ...start.resources, politicalBudgetCents: 10_000 }
		};
		const idle = { ...state, player: { ...state.player, activists: 0 } };
		const without = previewPlan(idle, { steps: [] }, content).resourceChanges;
		const preview = previewPlan(state, { steps: [] }, content).resourceChanges;
		// 30 militants : 3 000 de cotisations, 5 000 de frais pour le palier adhérent.
		expect(preview.politicalBudgetCents.min - without.politicalBudgetCents.min).toBe(-2_000);
		const resolved = transition(state, commitTurn({ steps: [] }), content);
		if (!resolved.ok) throw new Error(resolved.error.message);
		expect(resolved.state.resources.politicalBudgetCents - 10_000).toBe(
			preview.politicalBudgetCents.min
		);
	});
});

describe('actions de terrain', () => {
	it('ajoute le bonus du palier, annoncé dans la prévision et appliqué', () => {
		expect(fieldworkEffects(leaflets, 3, content)).toEqual([]);
		expect(fieldworkEffects(leaflets, 5, content)).toEqual([
			{ op: 'addResource', resource: 'influence', value: 2 }
		]);
		expect(fieldworkEffects(leaflets, 30, content)).toEqual([
			{ op: 'addResource', resource: 'influence', value: 4 }
		]);
		const state = { ...base(), player: { ...base().player, activists: 30 } };
		const preview = previewPlan(
			state,
			{ steps: [{ kind: 'action', id: 'test.leaflets' }] },
			content
		);
		expect(preview.valid).toBe(true);
		expect(preview.resourceChanges.influence).toEqual({ min: 5, max: 5 });
		const result = transition(
			state,
			commitTurn({ steps: [{ kind: 'action', id: 'test.leaflets' }] }),
			content
		);
		if (!result.ok) throw new Error(result.error.message);
		const step = result.log.find((entry) => entry.type === 'turn.resolved')?.steps[0];
		expect(step?.changes).toEqual([{ resource: 'influence', delta: 5 }]);
		expect(checkInvariants(result.state, content)).toEqual([]);
		expect(gameStateSchema.safeParse(result.state).success).toBe(true);
	});

	it('marque les actions de terrain du catalogue réel', () => {
		const field = real.actionIds.filter((id) => real.actions[id]?.fieldwork);
		expect(field.sort()).toEqual([
			'activism.leaflets',
			'activism.public_meeting',
			'campaign.canvass',
			'organization.fundraising'
		]);
		expect(real.upgradeIds).not.toContain('organization.volunteer');
		expect(real.upgrades['organization.local_office']?.production).toEqual([]);
		expect(real.upgrades['organization.local_office']?.activists?.capacity).toBeGreaterThan(0);
	});
});

describe('mobilisation dans le score', () => {
	it('pénalise une campagne sans base, jamais l’éligibilité', () => {
		const lone = campaign();
		expect(mobilizationPercent(lone, 0, content)).toBe(0);
		expect(mobilizationPenalty(lone, 0, content)).toBe(20);
		expect(mobilizationPercent(lone, 50, content)).toBe(50);
		expect(mobilizationPenalty(lone, 100, content)).toBe(0);
		// L'investiture prête 40 % du besoin.
		expect(mobilizationPercent(campaign({ invested: true }), 0, content)).toBe(40);
		const score = (activists: number): number =>
			campaignScore(lone, 50, activists, 0, false, content);
		expect(score(100) - score(0)).toBe(20);
		// Aucun besoin : aucune pénalité.
		expect(mobilizationPenalty(lone, 0, fixtureContent)).toBe(0);
	});

	it('exige surtout une base aux régionales dans le catalogue réel', () => {
		const need = (id: string): number => real.elections[id]!.mobilizationNeed;
		expect(need('election.regional')).toBeGreaterThan(need('election.legislative'));
		expect(need('election.legislative')).toBeGreaterThan(need('election.municipal'));
		expect(need('election.senatorial')).toBeLessThan(need('election.municipal'));
	});
});

describe('projection de la base militante', () => {
	it('présente effectif, palier, capacité et effets du palier', () => {
		const state = createGame({ seed: 'vue-militants' }, real);
		const view = projectView(state, [], real).activists;
		expect(view).toMatchObject({
			count: 3,
			countLabel: '3 militants',
			tierLabel: 'Quelques fidèles',
			next: { label: 'Noyau', missing: 2 },
			capacity: real.balance.activists.baseCapacity,
			lastMove: null
		});
		expect(view.capacityParts).toEqual([`Accueil de base ${real.balance.activists.baseCapacity}`]);
		expect(view.perks[0]).toContain('aucun bonus');
		const leafletsView = projectView(
			{ ...state, player: { ...state.player, activists: 30 } },
			[],
			real
		)
			.actionGroups.flatMap((group) => group.actions)
			.find((action) => action.id === 'activism.leaflets');
		expect(leafletsView?.fieldBonus).toBe('Base militante (Comité local) : Influence + 2');
	});

	it('journalise les mouvements et signale un changement de palier dans la note', () => {
		const state = createGame({ seed: 'palier' }, content);
		const grown = {
			...state,
			player: {
				...state.player,
				activists: 4,
				supports: { ...state.player.supports, 'support.activists': 60 }
			},
			resources: { ...state.resources, influence: 400 }
		};
		const result = transition(grown, commitTurn(), content);
		if (!result.ok) throw new Error(result.error.message);
		const view = projectView(result.state, [], content);
		const line = view.journal[0]?.lines.find((entry) => entry.text.startsWith('Base militante'));
		expect(line?.text).toMatch(/^Base militante — \d+ arrivées?.* : \d+ militants \(Noyau\)$/u);
		const fact = view.quarterNote?.highlights.find((item) => item.key === 'activists');
		expect(fact).toMatchObject({ title: 'Base militante', tone: 'gain' });
		expect(fact?.text).toContain('Noyau');
	});

	it('explique les leviers de croissance et de départ sans formule (PT-B1-006)', () => {
		const state = createGame({ seed: 'leviers' }, real);
		const cold = projectView(
			{
				...state,
				player: {
					...state.player,
					supports: { ...state.player.supports, 'support.activists': 0 }
				}
			},
			[],
			real
		).activists.levers;
		expect(cold.arrivals.map((lever) => lever.sense)).toContain('cost');
		expect(cold.arrivals.some((lever) => /personne ne s’engage/u.test(lever.text))).toBe(true);
		expect(cold.departures.some((lever) => /mécontentement/u.test(lever.text))).toBe(true);
		// Sans parti : l'adhésion et les locaux sont proposés, avec leurs places d'accueil.
		expect(cold.capacity[0]).toBe(
			`Adhérer à un parti : + ${real.balance.activists.partyCapacity} places (section locale)`
		);
		expect(cold.capacity.join(' ')).toMatch(
			/permanence.*\+ 120 places, dès le trimestre suivant/iu
		);
		// Aucun chiffre de formule : ni seuil, ni pourcentage.
		expect(JSON.stringify(cold)).not.toMatch(/%/u);

		const warm = projectView(
			{
				...state,
				player: {
					...state.player,
					supports: { ...state.player.supports, 'support.activists': 60 },
					activists: real.balance.activists.baseCapacity
				}
			},
			[],
			real
		).activists.levers;
		expect(warm.arrivals[1]?.sense).toBe('gain');
		expect(warm.arrivals.some((lever) => /toutes occupées/u.test(lever.text))).toBe(true);
	});

	it('annonce sur chaque local ses places d’accueil, actives au trimestre suivant', () => {
		const state = createGame({ seed: 'locaux' }, real);
		const upgrades = projectView(state, [], real).upgrades;
		const office = upgrades.find((upgrade) => upgrade.id === 'organization.local_office');
		expect(office?.activists).toMatch(
			/^Base militante : \+ 120 places d’accueil, usure réduite de 1 point par trimestre, à partir du trimestre suivant l’achat$/u
		);
		expect(upgrades.find((upgrade) => upgrade.id === 'organization.federation')?.activists).toMatch(
			/\+ 400 places/u
		);
		expect(
			upgrades.filter((upgrade) => upgrade.activists !== null).map((upgrade) => upgrade.id)
		).toEqual(
			real.upgradeIds.filter(
				(id) => real.upgrades[id]?.activists && upgrades.some((upgrade) => upgrade.id === id)
			)
		);
	});
});
