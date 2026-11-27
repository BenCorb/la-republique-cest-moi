import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/lib/game/content/load.ts';
import { projectView } from '../../src/lib/game/app/view-model.ts';
import {
	acceptancePercent,
	acceptanceRoll,
	askedSalaryCents,
	attractiveness,
	attractivenessFactors,
	checkInvariants,
	commitTurn,
	createGame,
	hireReserveCents,
	offerBonusCents,
	offeredSalaryCents,
	previewPlan,
	transition,
	type GameState,
	type PlanStep,
	type StaffMember
} from '../../src/lib/game/engine/index.ts';
import { gameStateSchema } from '../../src/lib/game/persistence/state-schema.ts';

/** Recrutement I (P3-20, PT-P3-09-005/006) sur le catalogue réel, sans événements aléatoires. */
const content = { ...loadContent(), eventIds: [] };
const CHIEF = 'post.chief_of_staff';
const reference = content.posts[CHIEF]!.salaryCents;

function commit(state: GameState, steps: PlanStep[] = []): GameState {
	const result = transition(state, commitTurn({ steps }), content);
	if (!result.ok) throw new Error(result.error.message);
	expect(checkInvariants(result.state, content)).toEqual([]);
	return result.state;
}

/** Carrière émergente avec une présélection pour la direction de cabinet. */
function withShortlist(seed: string, budgetCents = 5_000_000): GameState {
	const start = createGame({ seed }, content);
	const ready = commit({
		...start,
		resources: { ...start.resources, influence: 16, politicalBudgetCents: budgetCents }
	});
	expect(ready.shortlists[CHIEF]?.length).toBeGreaterThan(0);
	return ready;
}

/** Fixe la compétence d'un candidat (CV public) pour un test. */
function withCompetence(state: GameState, characterId: string, competence: number): GameState {
	return {
		...state,
		characters: {
			...state.characters,
			[characterId]: { ...state.characters[characterId]!, competence }
		}
	};
}

const hire = (target: string, id = 'staff.hire'): PlanStep => ({ kind: 'action', id, target });

describe('salaire selon la compétence', () => {
	it('suit la courbe : junior bon marché, confirmé proche de la référence, pointure plusieurs fois plus chère', () => {
		expect(askedSalaryCents(CHIEF, 20, content)).toBe(reference * 0.5);
		expect(askedSalaryCents(CHIEF, 60, content)).toBe(reference * 1.3);
		expect(askedSalaryCents(CHIEF, 90, content)).toBe(reference * 2.5);
		const salaries = [0, 10, 30, 50, 70, 85, 100].map((value) =>
			askedSalaryCents(CHIEF, value, content)
		);
		expect([...salaries].sort((left, right) => left - right)).toEqual(salaries);
	});

	it('décline trois offres : réduite, standard, généreuse avec prime', () => {
		const asked = askedSalaryCents(CHIEF, 60, content);
		// Arrondi à 10 € comme la prétention.
		const rounded = (cents: number): number => Math.round(cents / 1_000) * 1_000;
		expect(offeredSalaryCents(CHIEF, 60, 'low', content)).toBe(rounded(asked * 0.8));
		expect(offeredSalaryCents(CHIEF, 60, 'standard', content)).toBe(asked);
		const generous = offeredSalaryCents(CHIEF, 60, 'generous', content);
		expect(generous).toBe(rounded(asked * 1.25));
		expect(offerBonusCents(generous, 'generous', content)).toBe(generous);
		expect(offerBonusCents(asked, 'standard', content)).toBe(0);
	});
});

describe('attractivité de la carrière', () => {
	it('reste faible au début et monte avec influence, popularité, mandat et budget', () => {
		const state = createGame({ seed: 'attrait' }, content);
		const start = attractiveness(
			attractivenessFactors(state.player, state.resources, [], [], content)
		);
		expect(start).toBeLessThan(25);
		const rich = attractivenessFactors(
			{ ...state.player, popularity: 80 },
			{ ...state.resources, influence: 900, politicalBudgetCents: 50_000_000 },
			[
				{
					instanceId: 'term.1',
					mandateId: 'mandate.minister',
					startTurn: 0,
					access: 'nomination',
					status: 'active',
					endTurn: null,
					endReason: null
				}
			],
			[],
			content
		);
		const recruitment = content.balance.entourage.recruitment;
		expect(rich.influence).toBe(recruitment.influenceMax);
		expect(rich.mandate).toBe(recruitment.mandateMax);
		expect(rich.payroll).toBe(recruitment.payrollMax);
		expect(attractiveness(rich)).toBeGreaterThanOrEqual(75);
	});

	it('gradue le vivier : peu d’experts pour une carrière émergente, davantage pour une carrière installée', () => {
		const share = (influence: number, popularity: number): number => {
			let experts = 0;
			let total = 0;
			for (let index = 0; index < 40; index += 1) {
				const start = createGame({ seed: `vivier-${influence}-${index}` }, content);
				const state = commit({
					...start,
					player: { ...start.player, popularity },
					resources: { ...start.resources, influence, politicalBudgetCents: 50_000_000 }
				});
				for (const entry of state.shortlists[CHIEF] ?? []) {
					total += 1;
					if (entry.profileId === 'profile.expert') experts += 1;
				}
			}
			return experts / total;
		};
		const emerging = share(16, 10);
		const established = share(900, 90);
		expect(emerging).toBeLessThan(0.15);
		expect(established).toBeGreaterThan(emerging * 2);
	});
});

describe('offre et réponse du candidat', () => {
	/** Cherche une seed où le candidat (compétence imposée) refuse ou accepte l'offre généreuse. */
	function scenario(outcome: 'refuse' | 'accept', competence: number) {
		for (let index = 0; index < 200; index += 1) {
			const base = withShortlist(`offre-${outcome}-${index}`);
			const candidate = base.shortlists[CHIEF]![0]!.characterId;
			const state = withCompetence(base, candidate, competence);
			const attraction = attractiveness(
				attractivenessFactors(state.player, state.resources, state.mandates, state.staff, content)
			);
			const chance = acceptancePercent(attraction, competence, 'generous', 0, content);
			const roll = acceptanceRoll(state.rng.seed, state.turn, candidate);
			if (roll < chance === (outcome === 'accept')) return { state, candidate, chance };
		}
		throw new Error('aucune seed trouvée');
	}

	it('un refus retire le candidat, ne verse ni salaire ni prime, et coûte le temps de l’entretien', () => {
		const { state, candidate, chance } = scenario('refuse', 90);
		expect(chance).toBeLessThan(100);
		// La prévision suppose l'accord : elle ne révèle rien de la décision.
		const preview = previewPlan(
			state,
			{ steps: [hire(candidate, 'staff.hire_generous')] },
			content
		);
		expect(preview.valid).toBe(true);
		const after = commit(state, [hire(candidate, 'staff.hire_generous')]);
		expect(after.staff.filter((member) => member.status === 'active')).toHaveLength(0);
		expect(after.shortlists[CHIEF]?.some((entry) => entry.characterId === candidate) ?? false).toBe(
			false
		);
		const entry = after.history.at(-1)!;
		if (entry.type !== 'turn.resolved') throw new Error('journal attendu');
		expect(entry.steps[0]?.politics).toEqual([
			{ kind: 'hireRefused', characterId: candidate, postId: CHIEF }
		]);
		expect(entry.staff?.payroll).toEqual([]);
		expect(after.relationships[candidate]?.memories.at(-1)?.text).toMatch(/décliné votre offre/u);
		// Même seed, même issue ; le refus n'est jamais rejoué après reprise.
		expect(commit(state, [hire(candidate, 'staff.hire_generous')])).toStrictEqual(after);
		expect(gameStateSchema.safeParse(after).success).toBe(true);
	});

	it('un accord inscrit le salaire convenu, versé à partir du trimestre suivant avec la prime', () => {
		const { state, candidate } = scenario('accept', 30);
		const salary = offeredSalaryCents(CHIEF, 30, 'generous', content);
		const bonus = offerBonusCents(salary, 'generous', content);
		const hired = commit(state, [hire(candidate, 'staff.hire_generous')]);
		const member = hired.staff.find((entry) => entry.characterId === candidate)!;
		expect(member).toMatchObject({ salaryCents: salary, bonusDueCents: bonus, postId: CHIEF });
		const paid = commit(hired);
		const entry = paid.history.at(-1)!;
		if (entry.type !== 'turn.resolved') throw new Error('journal attendu');
		expect(entry.staff?.payroll).toEqual([
			{ resource: 'politicalBudgetCents', delta: -(salary + bonus) }
		]);
		expect(paid.staff.find((item) => item.characterId === candidate)?.bonusDueCents).toBe(0);
		const next = commit(paid);
		const later = next.history.at(-1)!;
		if (later.type !== 'turn.resolved') throw new Error('journal attendu');
		expect(later.staff?.payroll).toEqual([{ resource: 'politicalBudgetCents', delta: -salary }]);
	});

	it('exige une réserve fondée sur les salaires convenus, prime comprise', () => {
		const member: StaffMember = {
			characterId: 'character.1',
			postId: CHIEF,
			hiredTurn: 0,
			missionId: 'mission.chief.agenda',
			status: 'active',
			leftTurn: null,
			leaveReason: null,
			salaryCents: 300_000,
			bonusDueCents: 0
		};
		const quarters = content.balance.entourage.hireReserveQuarters;
		expect(hireReserveCents([member], 100_000, content, 50_000)).toBe(
			(300_000 + 100_000) * quarters + 50_000
		);
		const state = withShortlist('réserve', 1_000);
		const candidate = state.shortlists[CHIEF]![0]!.characterId;
		const preview = previewPlan(state, { steps: [hire(candidate)] }, content);
		expect(preview.valid).toBe(false);
		expect(preview.issues[0]?.message).toContain('Budget politique insuffisant');
	});

	it('l’entretien approfondi rend le candidat plus intéressé, deux fois au plus', () => {
		const state = withShortlist('entretien');
		const candidate = state.shortlists[CHIEF]![0]!.characterId;
		const interview: PlanStep = { kind: 'action', id: 'staff.interview', target: candidate };
		const once = commit(state, [interview]);
		expect(
			once.shortlists[CHIEF]?.find((entry) => entry.characterId === candidate)?.interviews
		).toBe(1);
		const twice = commit(once, [interview]);
		const third = previewPlan(twice, { steps: [interview] }, content);
		expect(third.valid).toBe(false);
		expect(third.issues[0]?.message).toContain('un entretien de plus n’y changerait rien');
		const competence = twice.characters[candidate]!.competence;
		expect(acceptancePercent(20, competence, 'standard', 2, content)).toBeGreaterThan(
			acceptancePercent(20, competence, 'standard', 0, content)
		);
	});
});

describe('projection du recrutement', () => {
	it('affiche attractivité, masse salariale, salaire demandé et intérêt estimé par offre', () => {
		const state = withShortlist('vue-recrutement');
		const entourage = projectView(state, [], content).entourage;
		expect(['Structure émergente', 'Équipe en construction']).toContain(
			entourage.attractiveness.label
		);
		expect(entourage.attractiveness.value).toBeLessThan(50);
		expect(entourage.attractiveness.factors).toHaveLength(5);
		expect(entourage.payroll.covered).toBeNull();
		const post = entourage.posts.find((entry) => entry.id === CHIEF)!;
		const candidate = post.candidates[0]!;
		expect(candidate.asked).toMatch(/par trimestre$/u);
		expect(candidate.offers.map((offer) => offer.offer)).toEqual(['low', 'standard', 'generous']);
		expect(candidate.offers[2]?.bonus).toMatch(/^prime de /u);
		// L'intérêt ne baisse jamais quand l'offre monte ; aucun chiffre affiché.
		const order = ['Peu intéressé', 'Hésitant', 'Intéressé', 'Très intéressé'];
		const ranks = candidate.offers.map((offer) => order.indexOf(offer.interest));
		expect(ranks.every((rank) => rank >= 0)).toBe(true);
		expect([...ranks].sort((left, right) => left - right)).toEqual(ranks);
		expect(JSON.stringify(candidate.offers)).not.toMatch(/%/u);
	});
});
