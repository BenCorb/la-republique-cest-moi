import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/lib/game/content/load.ts';
import { projectView } from '../../src/lib/game/app/view-model.ts';
import {
	askedSalaryCents,
	checkInvariants,
	chooseEventCommand,
	commitTurn,
	createGame,
	previewPlan,
	searchFindPercent,
	searchRefundCents,
	transition,
	vetHints,
	type GameState,
	type PlanStep
} from '../../src/lib/game/engine/index.ts';
import { gameStateSchema } from '../../src/lib/game/persistence/state-schema.ts';

/** Recrutement II (P3-21) sur le catalogue réel, sans événements aléatoires. */
const content = { ...loadContent(), eventIds: [] };
const CHIEF = 'post.chief_of_staff';
const balance = content.balance.entourage;

function commit(state: GameState, steps: PlanStep[] = []): GameState {
	const result = transition(state, commitTurn({ steps }), content);
	if (!result.ok) throw new Error(result.error.message);
	expect(checkInvariants(result.state, content)).toEqual([]);
	return result.state;
}

/** Sauvegarde puis reprise : l'état doit traverser le schéma à l'identique. */
function resume(state: GameState): GameState {
	const parsed = gameStateSchema.safeParse(JSON.parse(JSON.stringify(state)));
	expect(parsed.success).toBe(true);
	return parsed.data as GameState;
}

/** Carrière émergente, budget confortable, présélection ouverte pour la direction de cabinet. */
function ready(seed: string, budgetCents = 10_000_000): GameState {
	const start = createGame({ seed }, content);
	const state = commit({
		...start,
		resources: { ...start.resources, influence: 16, politicalBudgetCents: budgetCents }
	});
	expect(state.shortlists[CHIEF]?.length).toBeGreaterThan(0);
	return state;
}

const search = (level: string, target: string): PlanStep => ({
	kind: 'action',
	id: `staff.search_${level}`,
	target
});

describe('recherche de candidats', () => {
	it('inscrit la commande avec son échéance et son prix, une seule par poste', () => {
		const state = ready('recherche-commande');
		const after = commit(state, [search('targeted', `${CHIEF}/trait.charisma`)]);
		const level = balance.search.levels.targeted;
		expect(after.searches).toEqual([
			{
				postId: CHIEF,
				level: 'targeted',
				trait: 'trait.charisma',
				orderedTurn: state.turn,
				dueTurn: state.turn + level.delayTurns
			}
		]);
		const entry = after.history.at(-1)!;
		if (entry.type !== 'turn.resolved') throw new Error('journal attendu');
		expect(entry.steps[0]?.changes).toContainEqual({
			resource: 'politicalBudgetCents',
			delta: -level.costCents
		});
		const again = previewPlan(after, { steps: [search('simple', CHIEF)] }, content);
		expect(again.valid).toBe(false);
		expect(again.issues[0]?.message).toContain('une recherche est déjà en cours');
	});

	it('refuse un trait caché, un trait au niveau simple et un poste pourvu ou inconnu', () => {
		const state = ready('recherche-refus');
		const issue = (step: PlanStep): string | undefined =>
			previewPlan(state, { steps: [step] }, content).issues[0]?.message;
		expect(issue(search('targeted', `${CHIEF}/trait.loyalty`))).toContain('seul un trait visible');
		expect(issue(search('simple', `${CHIEF}/trait.charisma`))).toContain('ne cible aucun trait');
		expect(issue(search('simple', 'post.unknown'))).toContain('choisissez un poste');
		expect(issue(search('simple', CHIEF))).toBeUndefined();
	});

	it('livre une seule fois à l’échéance, ou rend la moitié du prix en cas d’échec', () => {
		const outcomes = new Set<string>();
		for (let index = 0; index < 30 && outcomes.size < 2; index += 1) {
			const state = ready(`recherche-livraison-${index}`);
			// Délai de deux trimestres : en cours après la première frontière, livrée à la
			// seconde ; la reprise entre les deux ne change rien.
			const ordered = commit(state, [search('targeted', `${CHIEF}/trait.charisma`)]);
			expect(ordered.searches).toHaveLength(1);
			const delivered = commit(resume(ordered));
			expect(delivered.searches).toEqual([]);
			const record = delivered.history.at(-1)!;
			if (record.type !== 'turn.resolved') throw new Error('journal attendu');
			const [outcome] = record.staff?.searches ?? [];
			expect(outcome).toBeDefined();
			outcomes.add(outcome!.outcome);
			const shortlist = delivered.shortlists[CHIEF] ?? [];
			if (outcome!.outcome === 'found') {
				expect(outcome!.candidates.length).toBeGreaterThan(0);
				for (const id of outcome!.candidates) {
					const character = delivered.characters[id]!;
					const profile = content.candidateProfiles.find((item) => item.id === 'profile.sought')!;
					expect(character.knownTraits).toContain('trait.charisma');
					expect(character.competence).toBeGreaterThanOrEqual(profile.minCompetence);
					expect(character.competence).toBeLessThanOrEqual(profile.maxCompetence);
					expect(shortlist.find((entry) => entry.characterId === id)?.profileId).toBe(
						'profile.sought'
					);
				}
				expect(shortlist.length).toBeLessThanOrEqual(balance.search.maxShortlist);
			} else {
				expect(outcome!.refundCents).toBe(searchRefundCents('targeted', content));
			}
			// Jamais livrée deux fois.
			const later = commit(delivered);
			const next = later.history.at(-1)!;
			if (next.type !== 'turn.resolved') throw new Error('journal attendu');
			expect(next.staff?.searches).toEqual([]);
		}
		expect(outcomes).toEqual(new Set(['found', 'failed']));
		expect(searchFindPercent('targeted', 'trait.charisma', content)).toBeLessThan(
			searchFindPercent('targeted', null, content)
		);
	});

	it('annule la recherche si le poste est pourvu entre-temps, prix à moitié rendu', () => {
		const state = ready('recherche-annulee');
		const ordered = commit(state, [search('targeted', CHIEF)]);
		// Poste pourvu à la main (embauche hors sujet ici) avant l'échéance.
		const candidate = ordered.shortlists[CHIEF]![0]!.characterId;
		const filled: GameState = {
			...ordered,
			staff: [
				{
					characterId: candidate,
					postId: CHIEF,
					hiredTurn: ordered.turn - 1,
					missionId: content.posts[CHIEF]!.missions[0]!.id,
					status: 'active',
					leftTurn: null,
					leaveReason: null,
					salaryCents: 100_000,
					bonusDueCents: 0,
					progressTenths: 0,
					reviewedCompetence: ordered.characters[candidate]!.competence,
					reviewTurn: ordered.turn - 1
				}
			],
			shortlists: {},
			characters: {
				...ordered.characters,
				[candidate]: { ...ordered.characters[candidate]!, tags: ['staff', 'staff_chief'] }
			}
		};
		const after = commit(filled);
		const record = after.history.at(-1)!;
		if (record.type !== 'turn.resolved') throw new Error('journal attendu');
		expect(record.staff?.searches).toEqual([
			{
				postId: CHIEF,
				level: 'targeted',
				trait: null,
				outcome: 'cancelled',
				candidates: [],
				refundCents: searchRefundCents('targeted', content)
			}
		]);
	});

	it('livre des dossiers vérifiés par le chasseur de têtes, sans toucher aux traits connus', () => {
		for (let index = 0; index < 30; index += 1) {
			let state = commit(ready(`chasse-${index}`), [search('headhunt', CHIEF)]);
			while (state.searches.length > 0) state = commit(state);
			const record = state.history.at(-1)!;
			if (record.type !== 'turn.resolved') throw new Error('journal attendu');
			const outcome = record.staff?.searches[0];
			if (outcome?.outcome !== 'found') continue;
			for (const id of outcome.candidates) {
				const entry = state.shortlists[CHIEF]!.find((item) => item.characterId === id)!;
				expect(entry.profileId).toBe('profile.headhunted');
				expect(entry.hints).not.toBeNull();
				const character = state.characters[id]!;
				expect(character.knownTraits.every((trait) => !content.traits[trait]?.hidden)).toBe(true);
			}
			return;
		}
		throw new Error('aucune chasse de tête aboutie');
	});

	it('refuse une recherche quand la présélection est complète', () => {
		const state = ready('recherche-complete');
		const entries = state.shortlists[CHIEF]!;
		const extra = Array.from({ length: balance.search.maxShortlist - entries.length }, (_, i) => ({
			...entries[0]!,
			characterId: entries[i % entries.length]!.characterId
		}));
		const full = { ...state, shortlists: { ...state.shortlists, [CHIEF]: [...entries, ...extra] } };
		const preview = previewPlan(full, { steps: [search('simple', CHIEF)] }, content);
		expect(preview.issues[0]?.message).toContain('présélection est déjà complète');
	});
});

describe('vérification de dossier', () => {
	it('donne des indices, jamais une certitude : oublis et fausses pistes existent', () => {
		let missed = 0;
		let false_ = 0;
		let found = 0;
		const hidden = content.traitIds.filter((id) => content.traits[id]?.hidden);
		for (let index = 0; index < 300; index += 1) {
			const traits = [hidden[index % hidden.length]!];
			const hints = vetHints(
				'indices',
				index,
				{ id: `character.${index}`, traits, knownTraits: [] },
				'standard',
				content
			);
			if (hints.includes(traits[0]!)) found += 1;
			else missed += 1;
			false_ += hints.filter((trait) => !traits.includes(trait)).length;
		}
		expect(found).toBeGreaterThan(missed);
		expect(missed).toBeGreaterThan(0);
		expect(false_).toBeGreaterThan(0);
	});

	it('inscrit les indices à l’exécution seulement, une fois par candidat, de façon reproductible', () => {
		const state = ready('verification');
		const candidate = state.shortlists[CHIEF]![0]!.characterId;
		const vet: PlanStep = { kind: 'action', id: 'staff.vet', target: candidate };
		const twice = previewPlan(state, { steps: [vet, vet] }, content);
		expect(twice.valid).toBe(false);
		const after = commit(state, [vet]);
		const entry = after.shortlists[CHIEF]!.find((item) => item.characterId === candidate)!;
		expect(entry.hints).not.toBeNull();
		expect(after.characters[candidate]!.knownTraits).toEqual(
			state.characters[candidate]!.knownTraits
		);
		expect(commit(state, [vet])).toStrictEqual(after);
		const view = projectView(after, [], content).entourage;
		const shown = view.posts
			.find((post) => post.id === CHIEF)!
			.candidates.find((item) => item.characterId === candidate)!;
		expect(shown.hints).toEqual(entry.hints!.map((trait) => content.traits[trait]!.label));
		expect(shown.vettable).toBe(false);
	});
});

describe('progression et renégociation', () => {
	/** Un collaborateur junior en poste depuis ce trimestre, salaire de débutant. */
	function withJunior(seed: string): { state: GameState; id: string } {
		const state = ready(seed);
		const id = state.shortlists[CHIEF]![0]!.characterId;
		const competence = 20;
		return {
			id,
			state: {
				...state,
				shortlists: {},
				staff: [
					{
						characterId: id,
						postId: CHIEF,
						hiredTurn: state.turn - 1,
						missionId: content.posts[CHIEF]!.missions[0]!.id,
						status: 'active',
						leftTurn: null,
						leaveReason: null,
						salaryCents: askedSalaryCents(CHIEF, competence, content),
						bonusDueCents: 0,
						progressTenths: 0,
						reviewedCompetence: competence,
						reviewTurn: state.turn - 1
					}
				],
				characters: {
					...state.characters,
					[id]: { ...state.characters[id]!, competence, tags: ['staff', 'staff_chief'] }
				}
			}
		};
	}

	it('fait progresser un junior en poste, puis le fait réclamer au palier suivant', () => {
		const junior = withJunior('progression');
		const id = junior.id;
		let state = junior.state;
		const step = balance.renegotiation.stepCompetence;
		let turns = 0;
		while (state.phase === 'planning' && turns < 20) {
			state = commit(state);
			turns += 1;
		}
		expect(state.phase).toBe('decision');
		expect(state.characters[id]!.competence).toBeGreaterThanOrEqual(20 + step);
		expect(turns).toBeGreaterThanOrEqual(balance.renegotiation.minTurns);
		const pending = state.events.pending[0]!;
		expect(pending.eventId).toBe(balance.renegotiation.event);
		expect(pending.actors['collaborator']).toBe(id);

		// Accorder : salaire de sa compétence actuelle, nouvelle référence.
		const granted = transition(state, chooseEventCommand(pending.instanceId, 'grant'), content);
		if (!granted.ok) throw new Error(granted.error.message);
		const member = granted.state.staff.find((entry) => entry.characterId === id)!;
		const competence = granted.state.characters[id]!.competence;
		expect(member.salaryCents).toBe(askedSalaryCents(CHIEF, competence, content));
		expect(member.reviewedCompetence).toBe(competence);

		// Refuser : relation dégradée, pas de nouvelle demande avant un an.
		const refused = transition(state, chooseEventCommand(pending.instanceId, 'refuse'), content);
		if (!refused.ok) throw new Error(refused.error.message);
		expect(refused.state.relationships[id]!.attitude).toBeLessThan(
			state.relationships[id]!.attitude
		);
		let after = refused.state;
		for (let index = 1; index < balance.renegotiation.minTurns; index += 1) {
			after = commit(after);
			expect(after.phase).toBe('planning');
		}
		expect(gameStateSchema.safeParse(after).success).toBe(true);
	});

	it('montre la progression et la prétention actuelle du titulaire', () => {
		let { state } = withJunior('progression-vue');
		for (let index = 0; index < 3; index += 1) state = commit(state);
		const occupant = projectView(state, [], content).entourage.posts.find(
			(post) => post.id === CHIEF
		)!.occupant!;
		expect(occupant.progressing).toBe(true);
		expect(occupant.asked).toMatch(/par trimestre$/u);
	});
});
