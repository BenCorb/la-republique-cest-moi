import { describe, expect, it } from 'vitest';
import type { Content } from '../../src/lib/game/content/types.ts';
import { validateContent } from '../../src/lib/game/content/validate.ts';
import {
	assignMissionCommand,
	checkInvariants,
	chooseEventCommand,
	commitTurn,
	createGame,
	describePendingEvent,
	modulatedDelta,
	previewPlan,
	transition,
	withPopularity,
	type GameState,
	type PlanStep,
	type TransitionSuccess
} from '../../src/lib/game/engine/index.ts';
import { projectView } from '../../src/lib/game/app/view-model.ts';
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

const staffActions = [
	{
		id: 'staff.hire',
		label: 'Recruter',
		description: 'Recruter un candidat.',
		timeCost: 10,
		maxPerTurn: 2,
		costs: [],
		effects: [{ op: 'hireStaff' }],
		target: 'candidate'
	},
	{
		id: 'staff.dismiss',
		label: 'Renvoyer',
		description: 'Renvoyer un collaborateur.',
		timeCost: 5,
		maxPerTurn: 1,
		costs: [],
		effects: [{ op: 'dismissStaff' }],
		target: 'staff'
	}
];

const staffEvents = {
	events: [
		{
			id: 'test.poaching',
			category: 'personal',
			title: 'Une offre',
			text: '{staffer} reçoit une offre.',
			blocking: true,
			trigger: 'random',
			weight: 1,
			priority: 0,
			cooldownTurns: 0,
			unique: false,
			actors: [{ role: 'staffer', tags: ['staff'] }],
			choices: [
				{
					id: 'keep',
					label: 'Garder',
					hints: [],
					costs: [],
					effects: [
						{ op: 'addResource', resource: 'influence', value: 3 },
						{ op: 'addStat', stat: 'player.stress', value: -2 }
					]
				},
				{
					id: 'let_go',
					label: 'Laisser partir',
					hints: [],
					costs: [],
					effects: [{ op: 'staffLeaves', role: 'staffer' }]
				}
			]
		}
	]
};

function load(): Content {
	const result = validateContent({
		actions: { actions: [...fixtureActions.actions, ...staffActions] },
		upgrades: fixtureUpgrades,
		balance: fixtureBalance,
		cast: fixtureCast,
		events: { ...fixtureEvents, 'events/staff.json': staffEvents },
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
const hire = (id: string): PlanStep => ({ kind: 'action', id: 'staff.hire', target: id });
const dismiss = (id: string): PlanStep => ({ kind: 'action', id: 'staff.dismiss', target: id });

function commit(state: GameState, steps: PlanStep[] = [], used = catalog): TransitionSuccess {
	const result = transition(state, commitTurn({ steps }), used);
	if (!result.ok) throw new Error(result.error.message);
	expect(checkInvariants(result.state, used)).toEqual([]);
	return result;
}

/** Partie où le poste d'assistance est ouvert : 50 d'influence, et sa présélection tirée. */
function opened(seed: string, used = catalog): GameState {
	const base = createGame({ seed }, used);
	return commit(
		{ ...base, resources: { ...base.resources, influence: 50, politicalBudgetCents: 100_000 } },
		[],
		used
	).state;
}

describe('présélection', () => {
	it('propose des profils contrastés pour un poste ouvert et vacant seulement', () => {
		const closed = commit(createGame({ seed: 'fermé' }, catalog)).state;
		expect(closed.shortlists).toEqual({});

		const state = opened('présélection');
		const entries = state.shortlists['post.aide']!;
		expect(entries.map((entry) => entry.profileId)).toEqual(['profile.expert', 'profile.novice']);
		const [expert, novice] = entries.map((entry) => state.characters[entry.characterId]!);
		expect(expert!.competence).toBeGreaterThanOrEqual(80);
		expect(expert!.knownTraits).toContain('trait.open');
		expect(novice!.competence).toBeLessThanOrEqual(20);
		expect(state.shortlists['post.lawyer']).toBeUndefined();
		// Les candidats ne figurent pas dans les relations.
		expect(projectView(state, [], catalog).people).toEqual([]);
	});
});

describe('embauche et production', () => {
	it('recrute depuis le plan, puis produit à partir du trimestre suivant', () => {
		const state = opened('embauche');
		const expertId = state.shortlists['post.aide']![0]!.characterId;
		const hired = commit(state, [hire(expertId)]);
		expect(hired.state.staff).toEqual([
			{
				characterId: expertId,
				postId: 'post.aide',
				hiredTurn: 1,
				missionId: 'mission.aide.budget',
				status: 'active',
				leftTurn: null,
				leaveReason: null
			}
		]);
		expect(hired.state.shortlists['post.aide']).toBeUndefined();
		expect(hired.state.characters[expertId]!.tags).toEqual(['staff', 'staff_aide']);
		expect(hired.state.relationships[expertId]!.memories[0]?.text).toBe(
			'Recrutement au poste : Assistance.'
		);
		expect(quarterLog(hired).staff?.production).toEqual([]);

		const working = commit(hired.state);
		const competence = hired.state.characters[expertId]!.competence;
		const produced = Math.round((2_000 * competence) / 50);
		expect(quarterLog(working).staff).toMatchObject({
			payroll: [{ resource: 'politicalBudgetCents', delta: -1_000 }],
			production: [
				{
					characterId: expertId,
					status: 'active',
					changes: [{ resource: 'politicalBudgetCents', delta: produced }]
				}
			]
		});
	});

	it('refuse un candidat hors présélection, un poste fermé ou un premier salaire impayable', () => {
		const state = opened('refus');
		const candidate = state.shortlists['post.aide']![0]!.characterId;
		const issue = (target: string, from: GameState = state): string =>
			previewPlan(from, { steps: [hire(target)] }, catalog).issues[0]?.message ?? '';
		expect(issue('test.doc_a')).toContain('ne figure dans aucune présélection');
		expect(
			issue(candidate, { ...state, resources: { ...state.resources, influence: 0 } })
		).toContain('Il faut 50 points d’influence.');
		expect(
			issue(candidate, {
				...state,
				resources: { ...state.resources, politicalBudgetCents: 0 }
			})
		).toContain('Budget politique insuffisant pour le premier salaire.');
	});

	it('suspend la mission et entame la loyauté d’un collaborateur impayé, jusqu’à la démission', () => {
		const state = opened('impayé');
		const id = state.shortlists['post.aide']![1]!.characterId;
		let current = commit(state, [hire(id)]).state;
		current = { ...current, resources: { ...current.resources, politicalBudgetCents: 0 } };
		// La mission du novice rapporte moins que son salaire : les impayés s'enchaînent.
		const after = commit(current);
		expect(quarterLog(after).staff?.production[0]?.status).toBe('unpaid');
		let turns = 0;
		current = after.state;
		while (current.staff[0]!.status === 'active' && turns < 20) {
			current = commit({
				...current,
				resources: { ...current.resources, politicalBudgetCents: 0 }
			}).state;
			turns += 1;
		}
		expect(current.staff[0]).toMatchObject({ status: 'left', leaveReason: 'resigned' });
	});

	it('change de mission hors tour et rend du temps au joueur', () => {
		const state = opened('mission');
		const id = state.shortlists['post.aide']![0]!.characterId;
		const hired = commit(state, [hire(id)]).state;
		const refused = transition(hired, assignMissionCommand(id, 'mission.lawyer.calm'), catalog);
		expect(refused.ok).toBe(false);
		if (!refused.ok) expect(refused.error.code).toBe('invalid_mission');
		const assigned = transition(hired, assignMissionCommand(id, 'mission.aide.agenda'), catalog);
		if (!assigned.ok) throw new Error(assigned.error.message);
		expect(assigned.state.rng).toEqual(hired.rng);
		expect(assigned.state.staff[0]!.missionId).toBe('mission.aide.agenda');
		// Embauche au trimestre 1 : le temps est rendu dès le trimestre 2, en cours de planification.
		const competence = assigned.state.characters[id]!.competence;
		expect(previewPlan(assigned.state, { steps: [] }, catalog).timeAvailable).toBe(
			100 + Math.round((10 * competence) / 50)
		);
		// Pendant le trimestre d'embauche, rien n'était rendu.
		expect(previewPlan(state, { steps: [] }, catalog).timeAvailable).toBe(100);
	});
});

describe('départs', () => {
	it('renvoie un collaborateur choisi, qui s’en souvient', () => {
		const state = opened('renvoi');
		const id = state.shortlists['post.aide']![0]!.characterId;
		const hired = commit(state, [hire(id)]).state;
		const result = commit(hired, [dismiss(id)]);
		expect(result.state.staff[0]).toMatchObject({ status: 'left', leaveReason: 'dismissed' });
		// +10 à l'embauche, puis le renvoi (-20) modulé par ses traits réels.
		const character = hired.characters[id]!;
		expect(result.state.relationships[id]!.attitude).toBe(
			10 + modulatedDelta(character, -20, catalog)
		);
		// Le poste se rouvre : une nouvelle présélection est proposée.
		expect(result.state.shortlists['post.aide']).toHaveLength(2);
	});

	it('perd un collaborateur débauché par un événement', () => {
		const poach = withEvents(['test.poaching'], undefined, catalog);
		const state = opened('débauche', poach);
		const id = state.shortlists['post.aide']![0]!.characterId;
		const queued = commit(state, [hire(id)], poach).state;
		const view = describePendingEvent(queued, poach)!;
		const result = transition(queued, chooseEventCommand(view.instanceId, 'let_go'), poach);
		if (!result.ok) throw new Error(result.error.message);
		expect(result.state.staff[0]).toMatchObject({ status: 'left', leaveReason: 'poached' });
		expect(checkInvariants(result.state, poach)).toEqual([]);
	});

	it('libère le poste quand le collaborateur décède', () => {
		const state = opened('décès');
		const id = state.shortlists['post.aide']![0]!.characterId;
		const hired = commit(state, [hire(id)]).state;
		const dead: GameState = {
			...hired,
			characters: {
				...hired.characters,
				[id]: { ...hired.characters[id]!, status: 'dead', leftTurn: 2 }
			}
		};
		expect(checkInvariants(dead, catalog).join('\n')).toContain(
			'collaborateur parti encore en poste'
		);
		const result = commit(dead);
		expect(result.state.staff[0]).toMatchObject({ status: 'left', leaveReason: 'died' });
	});
});

describe('conseils sur les décisions', () => {
	function advised(competence: number): ReturnType<typeof projectView> {
		const poach = withEvents(['test.poaching'], undefined, catalog);
		const state = opened('conseil', poach);
		const id = state.shortlists['post.aide']![0]!.characterId;
		const queued = commit(state, [hire(id)], poach).state;
		const tuned: GameState = {
			...queued,
			player: withPopularity(queued.player, poach),
			characters: { ...queued.characters, [id]: { ...queued.characters[id]!, competence } }
		};
		return projectView(tuned, [], poach);
	}

	it('chiffre précisément les effets quand le conseiller est très compétent', () => {
		const advice = advised(85).decision!.advice!;
		expect(advice.quality).toBe('precise');
		expect(advice.choices.keep).toEqual(['Influence + 3', 'Stress − 2']);
		// Un départ n'est pas un effet chiffrable : aucun avis.
		expect(advice.choices.let_go).toEqual([]);
	});

	it('n’indique que des tendances quand il est moyen, et peut se tromper quand il est médiocre', () => {
		expect(advised(50).decision!.advice).toMatchObject({
			quality: 'fair',
			choices: { keep: ['Influence : en hausse', 'Stress : en baisse'] }
		});
		const poor = advised(10).decision!.advice!;
		expect(poor.quality).toBe('poor');
		expect(poor.choices.keep).toHaveLength(2);
		// Le même conseil est rendu à chaque projection (aucun tirage).
		expect(advised(10).decision!.advice).toEqual(poor);
	});

	it('ne donne aucun avis sans collaborateur compétent dans la catégorie', () => {
		const poach = withEvents(['test.poaching'], undefined, catalog);
		const base = createGame({ seed: 'sans-conseil' }, poach);
		expect(projectView(base, [], poach).decision).toBeNull();
	});
});
