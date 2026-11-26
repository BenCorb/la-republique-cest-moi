import { describe, expect, it } from 'vitest';
import type { Content } from '../../src/lib/game/content/types.ts';
import { validateContent, type RawContent } from '../../src/lib/game/content/validate.ts';
import {
	checkInvariants,
	commitTurn,
	createGame,
	effectiveContent,
	evaluateCondition,
	previewPlan,
	reformIssue,
	transition,
	type GameState,
	type MandateInstance,
	type PlanStep,
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
	fixtureInstitutions,
	fixtureJustice,
	fixtureMedia,
	fixturePromises,
	fixtureProfiles,
	fixtureSupports,
	fixtureTraits,
	fixtureUpgrades,
	fixtureWealth,
	fixtureWorld,
	quarterLog
} from '../fixtures/content.ts';

const proposeAction = {
	id: 'mandate.propose_reform',
	label: 'Proposer une réforme',
	description: 'Réformer.',
	timeCost: 10,
	maxPerTurn: 1,
	costs: [],
	requires: {
		op: 'any',
		conditions: [
			{ op: 'holdsMandate', mandate: 'mandate.deputy' },
			{ op: 'holdsMandate', mandate: 'mandate.minister' }
		]
	},
	unavailableReason: 'Réservé aux parlementaires.',
	effects: [{ op: 'proposeReform' }],
	target: 'reform'
};

type Institutions = typeof fixtureInstitutions;

function institutions(balance: Partial<Institutions['balance']> = {}, singleCap = 2): Institutions {
	const [cumul, press] = fixtureInstitutions.parameters;
	return {
		parameters: [
			{
				...cumul!,
				levels: cumul!.levels.map((level) =>
					level.id === 'cumul.single' ? { ...level, modifiers: { maxMandates: singleCap } } : level
				)
			},
			press!
		],
		balance: { ...fixtureInstitutions.balance, ...balance }
	} as Institutions;
}

function raw(overrides: Partial<RawContent> = {}): RawContent {
	return {
		actions: { actions: [...fixtureActions.actions, proposeAction] },
		upgrades: fixtureUpgrades,
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
		media: fixtureMedia,
		institutions: fixtureInstitutions,
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
const adopted = load({ institutions: institutions({ adoptionPercent: { min: 100, max: 100 } }) });
const rejected = load({ institutions: institutions({ adoptionPercent: { min: 0, max: 0 } }) });
const propose = (target: string): PlanStep => ({
	kind: 'action',
	id: 'mandate.propose_reform',
	target
});

function holding(state: GameState, ...mandateIds: string[]): GameState {
	const mandates: MandateInstance[] = mandateIds.map((mandateId, index) => ({
		instanceId: `term.${index + 1}`,
		mandateId,
		startTurn: state.turn,
		access: 'election',
		status: 'active',
		endTurn: null,
		endReason: null
	}));
	return { ...state, mandates };
}

function commit(state: GameState, steps: PlanStep[] = [], used = catalog): TransitionSuccess {
	const result = transition(state, commitTurn({ steps }), used);
	if (!result.ok) throw new Error(`${result.error.message} ${JSON.stringify(result.error.issues)}`);
	expect(checkInvariants(result.state, used)).toEqual([]);
	return result;
}

function advanceTo(state: GameState, turn: number, used = catalog): GameState {
	let current = state;
	while (current.turn < turn) current = commit(current, [], used).state;
	return current;
}

describe('institutions modifiables (P3-05)', () => {
	it('démarre aux niveaux du catalogue, sans réforme', () => {
		const state = createGame({ seed: 'institutions' }, catalog);
		expect(state.institutions.parameters).toEqual({
			'institution.cumul': 'cumul.standard',
			'institution.press': 'press.standard'
		});
		expect(state.institutions.reforms).toEqual([]);
		expect(gameStateSchema.safeParse(state).success).toBe(true);
	});

	it('réserve la proposition aux parlementaires et ne change le régime que d’un cran', () => {
		const state = createGame({ seed: 'proposition' }, catalog);
		const preview = previewPlan(state, { steps: [propose('cumul.single')] }, catalog);
		expect(preview.issues[0]?.message).toBe('Réservé aux parlementaires.');
		const deputy = holding(state, 'mandate.deputy');
		expect(previewPlan(deputy, { steps: [propose('cumul.single')] }, catalog).valid).toBe(true);
		expect(reformIssue('cumul.standard', deputy.institutions, catalog)).toBe(
			'ce régime est déjà en vigueur'
		);
		expect(reformIssue('press.free', deputy.institutions, catalog)).toBeNull();
		expect(reformIssue('unknown.level', deputy.institutions, catalog)).toBe(
			'choisissez une réforme du catalogue'
		);
		const twoSteps = {
			...deputy.institutions,
			parameters: { ...deputy.institutions.parameters, 'institution.cumul': 'cumul.single' }
		};
		expect(reformIssue('cumul.extended', twoSteps, catalog)).toBe(
			'une réforme ne change le régime que d’un cran à la fois'
		);
	});

	it('vote la réforme à la fin du trimestre et la met en vigueur au 1er janvier suivant', () => {
		let state = holding(createGame({ seed: 'adoption' }, adopted), 'mandate.deputy');
		const before = state.player.supports['support.workers']!;
		const first = commit(state, [propose('cumul.single')], adopted);
		state = first.state;
		expect(quarterLog(first).steps[0]?.politics).toEqual([
			expect.objectContaining({ kind: 'reform', change: 'proposed', levelId: 'cumul.single' })
		]);
		expect(quarterLog(first).institutions?.politics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ kind: 'reform', change: 'adopted', origin: 'player' }),
				{ kind: 'support', groupId: 'support.workers', delta: 2 }
			])
		);
		expect(state.player.supports['support.workers']).toBeGreaterThan(before);
		expect(state.institutions.reforms[0]).toMatchObject({
			status: 'scheduled',
			adoptionPercent: 100,
			activationTurn: 4
		});
		// Toujours l'ancien régime jusqu'au 1er janvier, et pas de seconde réforme en attente.
		expect(state.institutions.parameters['institution.cumul']).toBe('cumul.standard');
		expect(reformIssue('cumul.extended', state.institutions, adopted)).toContain('déjà en cours');
		state = advanceTo(state, 4, adopted);
		expect(state.institutions.parameters['institution.cumul']).toBe('cumul.single');
		expect(state.institutions.maxMandates).toBe(2);
		expect(state.institutions.reforms[0]?.status).toBe('enacted');
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
				{ op: 'institution', parameter: 'institution.cumul', level: 'cumul.single' }
			)
		).toBe(true);
	});

	it('fait payer un rejet', () => {
		const state = holding(createGame({ seed: 'rejet' }, rejected), 'mandate.deputy');
		const withInfluence = { ...state, resources: { ...state.resources, influence: 20 } };
		const result = commit(withInfluence, [propose('press.free')], rejected);
		expect(result.state.institutions.reforms[0]).toMatchObject({
			status: 'rejected',
			activationTurn: null,
			adoptionPercent: 0
		});
		expect(quarterLog(result).institutions?.changes).toEqual([
			{ resource: 'influence', delta: -5 }
		]);
		expect(result.state.institutions.parameters['institution.press']).toBe('press.standard');
	});

	it('met fin aux mandats en surnombre quand le plafond baisse, sans priver le maire de son siège', () => {
		const strict = load({
			institutions: institutions({ adoptionPercent: { min: 100, max: 100 } }, 1)
		});
		let state = holding(
			createGame({ seed: 'surnombre' }, strict),
			'mandate.councillor',
			'mandate.mayor',
			'mandate.deputy'
		);
		state = commit(state, [propose('cumul.single')], strict).state;
		const enactment = commit(advanceTo(state, 3, strict), [], strict);
		const active = enactment.state.mandates
			.filter((mandate) => mandate.status === 'active')
			.map((mandate) => mandate.mandateId);
		expect(active).toEqual(['mandate.councillor', 'mandate.mayor']);
		expect(quarterLog(enactment).institutions?.politics).toContainEqual(
			expect.objectContaining({
				kind: 'mandateEnded',
				mandateId: 'mandate.deputy',
				reason: 'removed'
			})
		);
	});

	it('laisse le gouvernement réformer de lui-même', () => {
		const autonomous = load({ institutions: institutions({ autonomousPercent: 100 }) });
		const state = commit(createGame({ seed: 'gouvernement' }, autonomous), [], autonomous).state;
		expect(state.institutions.reforms).toHaveLength(1);
		expect(state.institutions.reforms[0]).toMatchObject({
			origin: 'government',
			status: 'scheduled',
			activationTurn: 4
		});
		// Un paramètre déjà en attente n'est pas réformé deux fois.
		const next = commit(state, [], autonomous).state;
		const pending = next.institutions.reforms.filter((reform) => reform.status === 'scheduled');
		expect(new Set(pending.map((reform) => reform.parameterId)).size).toBe(pending.length);
	});

	it('applique les règles en vigueur à tous, sans cumuler les modificateurs', () => {
		const free = { 'institution.cumul': 'cumul.standard', 'institution.press': 'press.free' };
		const rules = effectiveContent(catalog, free);
		expect(rules.press.nationalExposure).toBe(10);
		expect(rules.press.toneEffects.critical).toBe(catalog.press.toneEffects.critical * 2);
		expect(rules.justice).toEqual(catalog.justice);
		expect(effectiveContent(rules, free)).toBe(rules);
		expect(effectiveContent(catalog, free)).toBe(rules);
		const standard = {
			'institution.cumul': 'cumul.standard',
			'institution.press': 'press.standard'
		};
		expect(effectiveContent(rules, standard).press).toEqual(catalog.press);
	});

	it('affiche les institutions, la chance d’adoption et la réforme en attente', () => {
		const outsider = projectView(createGame({ seed: 'vue' }, catalog), [], catalog);
		expect(outsider.world.institutions.adoptionPercent).toBeNull();
		expect(outsider.world.institutions.lockedReason).toBe('Réservé aux parlementaires.');
		const deputy = holding(createGame({ seed: 'vue' }, adopted), 'mandate.deputy');
		const view = projectView(deputy, [], adopted);
		expect(view.world.institutions.adoptionPercent).toBe(100);
		const cumul = view.world.institutions.parameters[0]!;
		expect(cumul).toMatchObject({ currentLabel: 'Trois mandats', pending: null });
		expect(cumul.options.map((option) => option.levelId)).toEqual([
			'cumul.single',
			'cumul.extended'
		]);
		const after = commit(deputy, [propose('cumul.single')], adopted).state;
		const pending = projectView(after, [], adopted).world.institutions;
		expect(pending.parameters[0]?.pending).toContain('« Deux mandats » au 1er janvier 2001');
		expect(pending.history[0]?.text).toContain('votre proposition, adoptée');
	});

	describe('validation du catalogue', () => {
		it('vérifie le niveau de départ et le plafond de cumul', () => {
			const broken = institutions();
			const [cumul, press] = broken.parameters;
			const issues = issuesOf({
				institutions: {
					...broken,
					parameters: [
						{ ...cumul!, startLevel: 'cumul.extended' },
						{ ...press!, startLevel: 'press.ghost' }
					]
				}
			});
			expect(issues).toEqual(
				expect.arrayContaining([
					expect.stringContaining('plafond de cumul de départ différent de career.json'),
					expect.stringContaining('niveau de départ inconnu : press.ghost')
				])
			);
		});

		it('limite les effets d’une réforme et vérifie les conditions institutionnelles', () => {
			const broken = institutions({
				rejectionEffects: [{ op: 'prepareCampaign', value: 2 }] as never
			});
			expect(issuesOf({ institutions: broken })).toContain(
				'balance.rejectionEffects[0] : effet non permis pour une réforme : prepareCampaign'
			);
			const action = {
				...fixtureActions.actions[0]!,
				id: 'test.conditional',
				requires: { op: 'institution', parameter: 'institution.cumul', level: 'press.free' },
				unavailableReason: 'Pas maintenant.'
			};
			expect(
				issuesOf({ actions: { actions: [...fixtureActions.actions, proposeAction, action] } })
			).toEqual(
				expect.arrayContaining([expect.stringContaining('niveau inconnu pour institution.cumul')])
			);
		});
	});
});
