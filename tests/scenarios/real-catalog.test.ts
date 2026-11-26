import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/lib/game/content/load.ts';
import { quarters } from '../fixtures/content.ts';
import {
	assertInvariants,
	careerSummary,
	chooseEventCommand,
	commitTurn,
	describePendingEvent,
	createGame,
	formatTurn,
	previewPlan,
	transition,
	type GameState,
	type PlanStep,
	type TurnPlan
} from '../../src/lib/game/engine/index.ts';

/** Scénarios longs : le runner de CI est deux à trois fois plus lent qu'un poste local. */
const LONG_SCENARIO_TIMEOUT = 60_000;

const content = loadContent();

/** Stratégie simple : propose des actions, retire celles que la prévision refuse. */
const act = (id: string): PlanStep => ({ kind: 'action', id });
const buy = (id: string): PlanStep => ({ kind: 'purchase', id });

/** Marqueur : déclarer une candidature à la première échéance ouverte (P2-03). */
const CANDIDACY = { kind: 'action', id: 'campaign.declare', target: '*' } as const;
const declare = (target: string): PlanStep => ({ kind: 'action', id: 'campaign.declare', target });
/** Marqueur : recruter le premier candidat présélectionné qui peut l'être (P2-05). */
const HIRE = { kind: 'action', id: 'staff.hire', target: '*' } as const;
const hire = (target: string): PlanStep => ({ kind: 'action', id: 'staff.hire', target });
/** Marqueurs : prendre un engagement de campagne, préparer les réformes en cours (P3-04). */
const PROMISE = { kind: 'action', id: 'campaign.pledge', target: '*' } as const;
const REFORM = { kind: 'action', id: 'mandate.prepare_reform', target: '*' } as const;
/** Marqueur : proposer la première réforme institutionnelle possible de la liste (P3-05). */
const INSTITUTION = {
	kind: 'action',
	id: 'mandate.propose_institutional_reform',
	target: '*'
} as const;
const INSTITUTION_WISHES = [
	'ballot.mixed',
	'ballot.proportional',
	'cumul.extended',
	'justice.supervised',
	'transparency.strict',
	'press.free'
];

function choosePlan(state: GameState, wishes: readonly PlanStep[]): TurnPlan {
	let candidate: PlanStep[] = wishes.flatMap((step): PlanStep[] => {
		if (step === HIRE) {
			// Un candidat par poste ouvert, dans l'ordre des postes, au plus deux par trimestre.
			const picks: PlanStep[] = [];
			for (const entries of Object.values(state.shortlists)) {
				const pick = entries.find(
					(entry) =>
						previewPlan(state, { steps: [...picks, hire(entry.characterId)] }, content).valid
				);
				if (pick && picks.length < 2) picks.push(hire(pick.characterId));
			}
			return picks;
		}
		if (step === PROMISE) {
			// Une promesse différente selon le trimestre, pour parcourir tout le catalogue.
			const ids = content.promiseIds;
			const order = ids.map((_id, index) => ids[(index + state.turn) % ids.length]!);
			const pick = order.find(
				(id) =>
					previewPlan(
						state,
						{ steps: [{ kind: 'action', id: 'campaign.pledge', target: id }] },
						content
					).valid
			);
			return pick ? [{ kind: 'action', id: 'campaign.pledge', target: pick }] : [];
		}
		if (step === INSTITUTION) {
			const pick = INSTITUTION_WISHES.find(
				(target) => previewPlan(state, { steps: [{ ...INSTITUTION, target }] }, content).valid
			);
			return pick ? [{ ...INSTITUTION, target: pick }] : [];
		}
		if (step === REFORM) {
			return state.promises
				.filter((pledge) => pledge.status === 'in_progress')
				.map((pledge) => ({
					kind: 'action',
					id: 'mandate.prepare_reform',
					target: pledge.pledgeId
				}));
		}
		if (step !== CANDIDACY) return [step];
		const open = state.ballots.find(
			(ballot) =>
				ballot.status === 'scheduled' &&
				previewPlan(state, { steps: [declare(ballot.ballotId)] }, content).valid
		);
		return open ? [declare(open.ballotId)] : [];
	});
	for (;;) {
		const turnPlan: TurnPlan = { steps: candidate };
		const preview = previewPlan(state, turnPlan, content);
		if (preview.valid) return turnPlan;
		const rejected = new Set(preview.issues.map((issue) => issue.index));
		candidate = candidate.filter((_id, index) => !rejected.has(index));
	}
}

function career(
	seed: string,
	wishes: readonly PlanStep[],
	turns: number,
	choicePolicy = 0
): GameState {
	// Origines et professions variées d'une carrière à l'autre (P2-08).
	let state = createGame(
		{
			seed,
			origin: content.originIds[choicePolicy % content.originIds.length]!,
			profession: content.professionIds[choicePolicy % content.professionIds.length]!
		},
		content
	);
	for (let turn = 0; turn < turns && state.end === null; turn += 1) {
		const result = transition(state, commitTurn(choosePlan(state, wishes)), content);
		if (!result.ok) throw new Error(`${formatTurn(state.turn)} : ${result.error.message}`);
		state = result.state;
		assertInvariants(state, content);
		state = answerEvents(state, choicePolicy);
	}
	return state;
}

/**
 * Politique automatique déterministe : parmi les choix disponibles, prend celui de
 * rang (politique + trimestre) modulo leur nombre ; la politique 0 varie donc aussi.
 */
function answerEvents(start: GameState, policy: number): GameState {
	let state = start;
	for (
		let view = describePendingEvent(state, content);
		view;
		view = describePendingEvent(state, content)
	) {
		const available = view.choices.filter((candidate) => candidate.available);
		const choice = available[(policy + state.turn) % Math.max(1, available.length)];
		if (!choice) throw new Error(`Aucun choix disponible : ${view.eventId}`);
		const result = transition(state, chooseEventCommand(view.instanceId, choice.id), content);
		if (!result.ok) throw new Error(`${view.eventId} : ${result.error.message}`);
		state = result.state;
		assertInvariants(state, content);
	}
	return state;
}

describe('scénario : catalogue réel', { timeout: LONG_SCENARIO_TIMEOUT }, () => {
	// Ordre de priorité : la réunion publique (50 points de temps) passe en premier.
	const militant = [
		act('activism.public_meeting'),
		act('organization.fundraising'),
		act('network.meet_officials'),
		act('activism.leaflets'),
		act('personal.freelance')
	];

	it('enchaîne dix ans de trimestres planifiés sans incohérence', () => {
		const state = career('militant', militant, 40);
		expect(formatTurn(state.turn)).toBe('T1 2010');
		expect(state.resources.influence).toBeGreaterThan(0);
		const performed = new Set(
			quarters(state.history).flatMap((entry) => entry.steps.map((step) => step.id))
		);
		// Les actions conditionnelles finissent par se débloquer.
		expect(performed).toContain('organization.fundraising');
		expect(performed).toContain('activism.public_meeting');
	});

	// Organisation : bénévoles et fichier de donateurs, puis actions de terrain.
	const organisateur = [
		buy('organization.donor_file'),
		buy('organization.volunteer'),
		act('organization.fundraising'),
		act('network.meet_officials'),
		act('personal.freelance')
	];

	it('fait tourner une organisation qui produit à partir du trimestre suivant', () => {
		const state = career('organisateur', organisateur, 40);
		expect(state.upgrades.length).toBeGreaterThan(1);
		expect(state.upgrades.every((upgrade) => upgrade.acquiredTurn < state.turn)).toBe(true);
		const firstPurchaseTurn = Math.min(...state.upgrades.map((upgrade) => upgrade.acquiredTurn));
		const productive = quarters(state.history).filter((entry) =>
			entry.economy.producers.some((producer) => producer.active > 0)
		);
		expect(productive.length).toBeGreaterThan(0);
		expect(Math.min(...productive.map((entry) => entry.turn))).toBeGreaterThan(firstPurchaseTurn);
	});

	it('est reproductible avec le catalogue réel', () => {
		expect(career('militant', militant, 20)).toStrictEqual(career('militant', militant, 20));
		expect(career('organisateur', organisateur, 20)).toStrictEqual(
			career('organisateur', organisateur, 20)
		);
	});

	it('refuse dès le premier trimestre les actions encore verrouillées', () => {
		const state = createGame({ seed: 'débutant' }, content);
		const preview = previewPlan(
			state,
			{ steps: [{ kind: 'action', id: 'activism.public_meeting' }] },
			content
		);
		expect(preview.valid).toBe(false);
		expect(preview.issues[0]?.code).toBe('condition_not_met');
	});

	it('mène une carrière complète jusqu’au décès et à son bilan', () => {
		// Plafond technique de sécurité : 100 ans de trimestres.
		const prudent = [
			act('network.meet_officials'),
			act('organization.fundraising'),
			act('personal.freelance'),
			act('personal.rest')
		];
		for (const seed of ['carrière-1', 'carrière-2', 'carrière-3']) {
			const state = career(seed, prudent, 400);
			const summary = careerSummary(state);
			expect(summary.ended).toBe(true);
			expect(summary.cause).not.toBeNull();
			expect(summary.age).toBeGreaterThan(25);
			expect(summary.quartersPlayed).toBe(state.turn);
			const after = transition(state, commitTurn(), content);
			expect(after.ok).toBe(false);
		}
	});

	it('atteint chaque événement du catalogue au fil de carrières simulées', () => {
		const strategies: PlanStep[][] = [
			[
				buy('wealth.local_media'),
				act('network.meet_officials'),
				act('organization.fundraising'),
				act('personal.freelance'),
				act('personal.rest')
			],
			[
				HIRE,
				buy('communication.ai_assistant'),
				buy('organization.donor_file'),
				buy('organization.volunteer'),
				buy('organization.local_office'),
				act('organization.fundraising'),
				act('network.meet_officials'),
				act('personal.freelance')
			],
			[
				act('activism.public_meeting'),
				act('organization.fundraising'),
				act('network.meet_officials'),
				act('activism.leaflets'),
				act('personal.freelance')
			],
			// Militant encarté au parti du gouvernement de départ (P2-01), candidat (P2-03).
			[
				{ kind: 'action', id: 'party.join', target: content.world.startingGoverningParty },
				CANDIDACY,
				REFORM,
				INSTITUTION,
				PROMISE,
				buy('wealth.local_media'),
				HIRE,
				act('campaign.canvass'),
				act('party.section_meeting'),
				act('network.meet_officials'),
				act('organization.fundraising'),
				act('personal.freelance'),
				act('personal.rest')
			],
			// Candidat sans étiquette, proche des milieux d'affaires : les faveurs d'un
			// maire et d'un élu exigent un mandat (P3-12).
			[
				CANDIDACY,
				act('organization.gala'),
				buy('organization.donor_file'),
				HIRE,
				act('campaign.canvass'),
				act('organization.fundraising'),
				act('network.meet_officials'),
				act('personal.freelance')
			]
		];
		const seen = new Set<string>();
		strategies.forEach((wishes, strategy) => {
			for (let seed = 0; seed < 60; seed += 1) {
				const state = career(`atteinte-${strategy}-${seed}`, wishes, 400, seed);
				for (const entry of quarters(state.history)) {
					for (const event of entry.events) {
						if (event.outcome !== 'cancelled') seen.add(event.eventId);
					}
				}
			}
		});
		// Le permis signé par un maire (P3-12) est trop rare pour ces stratégies :
		// la chaîne jusqu'à l'enquête est couverte par `tests/unit/capabilities.test.ts`.
		const targeted = new Set(['press.donor_investigation']);
		expect(content.eventIds.filter((id) => !seen.has(id) && !targeted.has(id))).toEqual([]);
	});
});
