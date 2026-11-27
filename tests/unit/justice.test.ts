import { describe, expect, it } from 'vitest';
import type { Content } from '../../src/lib/game/content/types.ts';
import { validateContent } from '../../src/lib/game/content/validate.ts';
import {
	checkInvariants,
	chooseEventCommand,
	commitTurn,
	createGame,
	currentJudicialRisk,
	divertedFunds,
	evaluateCondition,
	judicialRisk,
	readStat,
	referenceExposure,
	resolveExposure,
	transition,
	type Fact,
	type GameState,
	type MandateInstance,
	type TransitionResult,
	type TransitionSuccess
} from '../../src/lib/game/engine/index.ts';
import { gameStateSchema } from '../../src/lib/game/persistence/state-schema.ts';
import { projectView } from '../../src/lib/game/app/view-model.ts';
import { formatMoney } from '../../src/lib/game/app/format.ts';
import {
	fixtureActions,
	fixtureBalance,
	fixtureCareer,
	fixtureCast,
	fixtureEntourage,
	fixtureEvents,
	fixtureJustice,
	fixtureWealth,
	fixturePromises,
	fixtureMedia,
	fixtureInstitutions,
	fixtureEpitaphs,
	fixtureProfiles,
	fixtureSupports,
	fixtureTraits,
	fixtureUpgrades,
	fixtureWorld,
	withEvents,
	withJustice
} from '../fixtures/content.ts';

const shady = withEvents(['test.shady_offer']);

function ok(result: TransitionResult, content: Content): TransitionSuccess {
	if (!result.ok) throw new Error(`${result.error.code} : ${result.error.message}`);
	expect(checkInvariants(result.state, content)).toEqual([]);
	return result;
}

/**
 * Partie arrêtée sur l'offre douteuse, au trimestre 1 : un premier achat donne
 * au joueur l'activité politique qu'exige un financement occulte (P3-12).
 */
function offered(content: Content = shady): GameState {
	const state = ok(
		transition(
			createGame({ seed: 'justice' }, content),
			commitTurn({ steps: [{ kind: 'purchase', id: 'test.donors' }] }),
			content
		),
		content
	).state;
	expect(state.events.pending[0]?.eventId).toBe('test.shady_offer');
	return state;
}

function choose(state: GameState, choiceId: string, content: Content = shady): GameState {
	const instance = state.events.pending[0]!;
	return ok(transition(state, chooseEventCommand(instance.instanceId, choiceId), content), content)
		.state;
}

function fact(overrides: Partial<Fact> = {}): Fact {
	return {
		factId: 'fact.1',
		offenseId: 'offense.test_financing',
		turn: 0,
		severity: 2,
		divertedCents: 0,
		authorId: null,
		accompliceIds: [],
		eventId: 'test.shady_offer',
		...overrides
	};
}

function raw(overrides: Record<string, unknown> = {}) {
	return {
		actions: fixtureActions,
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
		epitaphs: fixtureEpitaphs,
		...overrides
	};
}

describe('registre des faits', () => {
	it('démarre vide, avec l’exposition de référence', () => {
		const state = createGame({ seed: 'justice' }, shady);
		expect(state.facts).toEqual([]);
		expect(state.player.exposure).toBe(fixtureJustice.balance.baseExposure);
		expect(readStat(state, 'player.facts')).toBe(0);
	});

	it('inscrit un fait daté, avec ses protagonistes, quand le joueur choisit un acte douteux', () => {
		const before = offered();
		const actor = before.events.pending[0]!.actors['cousin']!;
		const after = choose(before, 'accept');
		expect(after.facts).toEqual([
			{
				factId: 'fact.1',
				offenseId: 'offense.test_financing',
				turn: before.turn,
				severity: 2,
				divertedCents: 1_000,
				authorId: null,
				accompliceIds: [actor],
				eventId: 'test.shady_offer'
			}
		]);
		expect(after.history.at(-1)).toMatchObject({
			type: 'event.resolved',
			politics: [{ kind: 'fact', factId: 'fact.1', offenseId: 'offense.test_financing' }]
		});
		expect(after.player.exposure).toBe(before.player.exposure + 10);
		expect(readStat(after, 'player.facts')).toBe(1);
		expect(readStat(after, 'player.exposure')).toBe(after.player.exposure);
	});

	it('attribue le fait à l’auteur désigné, le joueur restant complice', () => {
		const before = offered();
		const actor = before.events.pending[0]!.actors['cousin']!;
		const after = choose(before, 'delegate');
		expect(after.facts[0]).toMatchObject({ authorId: actor, accompliceIds: [], severity: 3 });
	});

	it('n’inscrit rien pour un choix honnête', () => {
		expect(choose(offered(), 'refuse').facts).toEqual([]);
	});

	it('numérote les faits dans l’ordre et ne les supprime jamais', () => {
		let state = choose(offered(), 'accept');
		state = ok(transition(state, commitTurn(), shady), shady).state;
		state = choose(state, 'refuse');
		state = ok(transition(state, commitTurn(), shady), shady).state;
		state = choose(state, 'delegate');
		expect(state.facts.map((entry) => entry.factId)).toEqual(['fact.1', 'fact.2']);
		expect(divertedFunds(state.facts)).toBe(1_000);
	});

	it('survit à la sauvegarde : le schéma de l’état accepte faits et exposition', () => {
		const state = choose(offered(), 'accept');
		const restored = gameStateSchema.parse(JSON.parse(JSON.stringify(state)));
		expect(restored).toStrictEqual(state);
	});

	it('signale un registre incohérent', () => {
		const state = choose(offered(), 'accept');
		const broken = { ...state, facts: [{ ...state.facts[0]!, factId: 'fact.7' }] };
		expect(checkInvariants(broken).join(' ')).toContain('fait hors séquence');
		const future = { ...state, facts: [{ ...state.facts[0]!, turn: state.turn + 1 }] };
		expect(checkInvariants(future).join(' ')).toContain('date de fait invalide');
		const unknown = { ...state, facts: [{ ...state.facts[0]!, offenseId: 'offense.nope' }] };
		expect(checkInvariants(unknown, shady).join(' ')).toContain('infraction inconnue');
	});
});

describe('risque judiciaire', () => {
	const rules = fixtureJustice.balance;

	it('vaut zéro sans fait, quelle que soit l’exposition', () => {
		expect(judicialRisk([], [], 100, 10, shady)).toEqual({
			value: 0,
			contributions: [],
			exposureBonus: 0
		});
	});

	it('compte la gravité d’un fait récent, à moitié quand le joueur n’est que complice', () => {
		const author = judicialRisk([fact()], [], 0, 0, shady);
		expect(author.value).toBe(2 * rules.riskPerSeverity);
		const accomplice = judicialRisk([fact({ authorId: 'test.cousin' })], [], 0, 0, shady);
		expect(accomplice.value).toBe(rules.riskPerSeverity);
	});

	it('décroît jusqu’à la prescription', () => {
		const half = judicialRisk([fact()], [], 0, rules.prescriptionTurns / 2, shady);
		expect(half.value).toBe(rules.riskPerSeverity);
		expect(judicialRisk([fact()], [], 0, rules.prescriptionTurns, shady).value).toBe(0);
	});

	it('est majoré par l’exposition médiatique et reste borné à 100', () => {
		const exposed = judicialRisk([fact()], [], 100, 0, shady);
		expect(exposed.exposureBonus).toBe(8);
		expect(exposed.value).toBe(24);
		const many = Array.from({ length: 10 }, (_, index) =>
			fact({ factId: `fact.${index + 1}`, severity: 3 })
		);
		expect(judicialRisk(many, [], 100, 0, shady).value).toBe(100);
	});

	it('se lit sur l’état courant sans être stocké', () => {
		const state = choose(offered(), 'accept');
		const risk = currentJudicialRisk(state, shady);
		expect(risk.contributions).toEqual([{ factId: 'fact.1', points: 16 }]);
		expect(risk.value).toBeGreaterThanOrEqual(16);
	});
});

describe('exposition médiatique', () => {
	const drifting = withJustice({
		baseExposure: 5,
		campaignExposure: 10,
		mandateExposure: { 'mandate.mayor': 20, 'mandate.councillor': 10 },
		exposureDriftPercent: 25
	});
	const mandate = (mandateId: string, status: 'active' | 'ended' = 'active'): MandateInstance => ({
		instanceId: `term.${mandateId}`,
		mandateId,
		startTurn: 0,
		access: 'election',
		status,
		endTurn: status === 'ended' ? 1 : null,
		endReason: status === 'ended' ? 'term' : null,
		side: null
	});

	it('a pour référence la fonction la plus exposée, plus la campagne en cours', () => {
		expect(referenceExposure([], [], drifting)).toBe(5);
		expect(
			referenceExposure([mandate('mandate.councillor'), mandate('mandate.mayor')], [], drifting)
		).toBe(25);
		expect(referenceExposure([mandate('mandate.mayor', 'ended')], [], drifting)).toBe(5);
	});

	it('revient vers la référence d’une part de l’écart, arrondie vers le haut', () => {
		const player = createGame({ seed: 'exposition' }, drifting).player;
		const high = resolveExposure({ ...player, exposure: 45 }, [], [], drifting);
		expect(high.delta).toBe(-10);
		expect(high.player.exposure).toBe(35);
		const close = resolveExposure({ ...player, exposure: 6 }, [], [], drifting);
		expect(close.delta).toBe(-1);
		expect(close.player.exposure).toBe(5);
		const settled = resolveExposure({ ...player, exposure: 5 }, [], [], drifting);
		expect(settled).toEqual({ player: { ...player, exposure: 5 }, delta: 0 });
	});

	it('évolue à chaque trimestre et le journal en garde la trace', () => {
		const state = createGame({ seed: 'exposition' }, drifting);
		const raised = { ...state, player: { ...state.player, exposure: 45 } };
		const result = ok(transition(raised, commitTurn(), drifting), drifting);
		expect(result.state.player.exposure).toBe(35);
		expect(result.log[0]).toMatchObject({ type: 'turn.resolved', exposure: -10 });
	});
});

describe('validation du contenu', () => {
	it('réserve les faits aux événements', () => {
		const actions = structuredClone(fixtureActions);
		actions.actions[0]!.effects = [
			...actions.actions[0]!.effects,
			{ op: 'recordFact', offense: 'offense.test_financing', severity: 1 }
		] as never;
		const result = validateContent(raw({ actions }));
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.issues.map((issue) => issue.message)).toContain('fait réservé aux événements');
		}
	});

	it('refuse une infraction ou un rôle inconnus', () => {
		const events = structuredClone(fixtureEvents);
		const offer = events['events/test.json'].events[0]!;
		const accept = offer.choices![0]!;
		accept.effects = [
			{ op: 'recordFact', offense: 'offense.nope', severity: 1, accomplices: ['ghost'] }
		] as never;
		const result = validateContent(raw({ events }));
		expect(result.ok).toBe(false);
		if (!result.ok) {
			const messages = result.issues.map((issue) => issue.message);
			expect(messages).toContain('infraction inconnue : offense.nope');
			expect(messages).toContain('rôle inconnu de l’événement : ghost');
		}
	});

	it('exige la capacité de chaque infraction dans les conditions (P3-12)', () => {
		const messages = (overrides: Record<string, unknown>): string[] => {
			const result = validateContent(raw(overrides));
			return result.ok ? [] : result.issues.map((issue) => issue.message);
		};
		const shady = (events: typeof fixtureEvents) =>
			events['events/test.json'].events.find((event) => event.id === 'test.shady_offer')!;

		const withoutWhen = structuredClone(fixtureEvents);
		delete (shady(withoutWhen) as { when?: unknown }).when;
		expect(messages({ events: withoutWhen })).toContain(
			'offense.test_financing exige la capacité « political_activity » dans la condition de l’événement ou du choix'
		);

		// Un emploi fictif exige l'embauche réelle d'un protagoniste, dans le même choix et avant.
		const justice = structuredClone(fixtureJustice);
		(justice.offenses as unknown[]).push({
			id: 'offense.test_job',
			label: 'Emploi de test',
			description: 'Un emploi de test.',
			capability: 'real_hire'
		});
		const job = structuredClone(fixtureEvents);
		shady(job).choices![0]!.effects = [
			{ op: 'recordFact', offense: 'offense.test_job', severity: 1, accomplices: ['cousin'] }
		] as never;
		expect(messages({ events: job, justice })).toContain(
			'offense.test_job exige l’embauche réelle d’un protagoniste (hireActor) avant le fait'
		);

		// L'embauche d'un acteur et les variables de poste sont réservées au sujet « post ».
		const hire = structuredClone(fixtureEvents);
		shady(hire).text = '{cousin} vise le poste « {post} ».';
		shady(hire).choices![2]!.effects = [{ op: 'hireActor', role: 'cousin' }] as never;
		(shady(hire) as { when?: unknown }).when = { op: 'capability', capability: 'real_hire' };
		expect(messages({ events: hire })).toEqual(
			expect.arrayContaining([
				'embauche d’un acteur réservée aux événements de sujet « post »',
				'{post} réservé aux événements de sujet « post »',
				'l’embauche réelle se vérifie sur l’effet d’embauche, pas en condition'
			])
		);
	});

	it('refuse une gravité hors bornes et un mandat inconnu dans les expositions', () => {
		const events = structuredClone(fixtureEvents);
		events['events/test.json'].events[0]!.choices![0]!.effects = [
			{ op: 'recordFact', offense: 'offense.test_financing', severity: 4 }
		] as never;
		expect(validateContent(raw({ events })).ok).toBe(false);
		const justice = structuredClone(fixtureJustice);
		(justice.balance.mandateExposure as Record<string, number>)['mandate.nope'] = 10;
		const result = validateContent(raw({ justice }));
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.issues.map((issue) => issue.message)).toContain(
				'mandat inconnu : mandate.nope'
			);
		}
	});
});

describe('projection de l’interface', () => {
	it('présente les jauges et le registre, du fait le plus récent au plus ancien', () => {
		let state = choose(offered(), 'accept');
		state = ok(transition(state, commitTurn(), shady), shady).state;
		state = choose(state, 'delegate');
		const view = projectView(state, [], shady).justice;
		expect(view.facts.map((entry) => [entry.offense, entry.involvement, entry.severity])).toEqual([
			['Faveur de test', 'complice', 'affaire d’envergure'],
			['Financement de test', 'auteur', 'faute']
		]);
		expect(view.facts.every((entry) => !entry.prescribed && entry.riskPoints > 0)).toBe(true);
		expect(view.risk.value).toBe(currentJudicialRisk(state, shady).value);
		expect(view.exposure.value).toBe(state.player.exposure);
		expect(view.diverted).toBe(formatMoney(1_000));
	});

	it('marque un fait prescrit', () => {
		const state = choose(offered(), 'accept');
		const later = { ...state, turn: state.turn + fixtureJustice.balance.prescriptionTurns };
		const view = projectView(later, [], shady).justice;
		expect(view.facts[0]).toMatchObject({ prescribed: true, riskPoints: 0 });
		expect(view.risk.value).toBe(0);
	});
});

describe('dossiers judiciaires', () => {
	/** Révélation certaine, enquête sans classement, condamnation certaine sans défense. */
	const court = (changes: Partial<Content['justice']> = {}): Content =>
		withJustice({ revealPercentPerSeverity: 100, ...changes });
	const withCourt = (changes: Partial<Content['justice']> = {}): Content => {
		const base = court(changes);
		return { ...shady, justice: base.justice };
	};

	/** Valide des trimestres vides en tranchant les décisions par le choix donné. */
	function advance(
		state: GameState,
		content: Content,
		turns: number,
		choiceId = 'refuse'
	): GameState {
		let current = state;
		for (let index = 0; index < turns && current.phase !== 'ended'; index += 1) {
			if (current.phase === 'planning') {
				current = ok(transition(current, commitTurn(), content), content).state;
			}
			while (current.phase === 'decision') {
				const instance = current.events.pending[0]!;
				const definition = content.events[instance.eventId]!;
				const ids = definition.blocking ? definition.choices.map((choice) => choice.id) : [];
				const id = ids.includes(choiceId) ? choiceId : ids.at(-1)!;
				current = ok(
					transition(current, chooseEventCommand(instance.instanceId, id), content),
					content
				).state;
			}
		}
		return current;
	}

	const quiet = (content: Content): Content => ({
		...content,
		balance: {
			...content.balance,
			events: { ...content.balance.events, ordinaryDrawsPerTurn: 0, ordinaryEventChance: 0 }
		}
	});
	/**
	 * Partie avec un fait (gravité 2) commis pendant le trimestre 1, puis un trimestre
	 * calme : le fait, plus ancien que le trimestre en cours, peut désormais être révélé.
	 */
	function withFact(content: Content, choiceId = 'accept'): GameState {
		const loud = { ...content, balance: shady.balance };
		const state = choose(offered(loud), choiceId, loud);
		return ok(transition(state, commitTurn(), content), content).state;
	}

	it('révèle un fait à la frontière suivante et présente la révélation', () => {
		const content = quiet(withCourt());
		const before = withFact(content);
		const after = ok(transition(before, commitTurn(), content), content).state;
		expect(after.cases).toEqual([
			{
				caseId: 'case.1',
				factId: 'fact.1',
				defendantId: null,
				openedTurn: before.turn,
				stage: 'investigation',
				dueTurn: before.turn + 2,
				outcome: null,
				closedTurn: null,
				sentence: null
			}
		]);
		expect(after.phase).toBe('decision');
		expect(after.events.pending[0]?.eventId).toBe('test.revelation');
		const entry = after.history.at(-1)!;
		expect(entry).toMatchObject({ type: 'turn.resolved' });
		if (entry.type !== 'turn.resolved') return;
		expect(entry.justice?.cases).toEqual([{ caseId: 'case.1', kind: 'revealed' }]);
		expect(after.player.exposure).toBe(before.player.exposure + 20);
		// Un fait révélé relève de son dossier : il ne compte plus dans le risque.
		expect(currentJudicialRisk(after, content).value).toBe(0);
		expect(readStat(after, 'player.openCases')).toBe(1);
	});

	it('ne révèle pas un fait commis pendant le trimestre ni un fait prescrit', () => {
		const content = quiet(withCourt());
		const fresh = withFact(content);
		const sameTurn = { ...fresh, facts: [{ ...fresh.facts[0]!, turn: fresh.turn }] };
		expect(ok(transition(sameTurn, commitTurn(), content), content).state.cases).toEqual([]);
		const prescribing = quiet(withCourt({ prescriptionTurns: 1 }));
		const prescribed = withFact(prescribing);
		expect(ok(transition(prescribed, commitTurn(), prescribing), prescribing).state.cases).toEqual(
			[]
		);
	});

	it('mène de l’enquête à la condamnation définitive, après appel, avec amende et inéligibilité', () => {
		const content = quiet(withCourt());
		let state = withFact(content);
		state = advance(state, content, 1, 'deny');
		expect(state.cases[0]?.stage).toBe('investigation');
		state = advance(state, content, 2);
		expect(state.cases[0]?.stage).toBe('indicted');
		state = advance(state, content, 2);
		expect(state.cases[0]?.stage).toBe('appeal');
		const cash = state.resources.personalCashCents;
		state = advance(state, content, 3);
		const closed = state.cases[0]!;
		expect(closed).toMatchObject({
			stage: 'closed',
			outcome: 'convicted',
			sentence: { fineCents: 5_000, ineligibilityTurns: 8, prison: 'suspended' }
		});
		expect(state.resources.personalCashCents).toBe(Math.max(0, cash - 5_000));
		expect(state.player.ineligibleUntil).toBe(closed.closedTurn! + 1 + 8);
		expect(readStat(state, 'player.ineligible')).toBe(1);
		expect(readStat(state, 'player.openCases')).toBe(0);
		const kinds = state.history.flatMap((entry) =>
			entry.type === 'turn.resolved' ? (entry.justice?.cases.map((item) => item.kind) ?? []) : []
		);
		expect(kinds).toEqual(['revealed', 'indicted', 'appealed', 'convicted']);
		const view = projectView(state, [], content).justice;
		expect(view.cases[0]).toMatchObject({
			offense: 'Financement de test',
			defendant: 'vous',
			status: 'condamnation définitive',
			due: null,
			closed: true
		});
		expect(view.cases[0]?.sentence).toContain('inéligibilité de 8 trimestres');
		expect(view.ineligibleUntil).not.toBeNull();
		expect(view.facts[0]?.inCase).toBe(true);
		const summary = projectView({ ...state, phase: 'ended' }, [], content);
		expect(
			summary.journal.some((turn) =>
				turn.lines.some((line) => line.text.includes('mise en examen'))
			)
		).toBe(true);
		expect(state.phase).not.toBe('ended');
	});

	it('classe sans suite ou relaxe selon la défense', () => {
		const dismissing = quiet(withCourt({ dismissalBasePercent: 100 }));
		const dismissed = advance(withFact(dismissing), dismissing, 3);
		expect(dismissed.cases[0]).toMatchObject({ outcome: 'dismissed', sentence: null });

		const content = quiet(withCourt());
		let state = advance(withFact(content), content, 3);
		expect(state.cases[0]?.stage).toBe('indicted');
		// Défense maximale : la condamnation n'est plus certaine, elle devient impossible ici.
		state = { ...state, player: { ...state.player, defense: 100 } };
		state = advance(state, content, 2);
		expect(state.cases[0]).toMatchObject({ outcome: 'acquitted', sentence: null });
	});

	it('use la défense avec un dossier ouvert et la remet à zéro sans dossier', () => {
		const content = quiet(withCourt());
		const open = advance(withFact(content), content, 1, 'lawyer');
		expect(open.player.defense).toBe(50);
		const next = ok(transition(open, commitTurn(), content), content).state;
		expect(next.player.defense).toBe(45);
		const idle = createGame({ seed: 'défense' }, content);
		const reset = ok(
			transition({ ...idle, player: { ...idle.player, defense: 30 } }, commitTurn(), content),
			content
		).state;
		expect(reset.player.defense).toBe(0);
	});

	it('met fin à la carrière par une peine de prison ferme', () => {
		const content = quiet(withCourt());
		let state = withFact(content);
		state = { ...state, facts: [{ ...state.facts[0]!, severity: 3 }] };
		state = advance(state, content, 12);
		expect(state.phase).toBe('ended');
		expect(state.end).toMatchObject({ reason: 'prison', caseId: 'case.1' });
		expect(state.cases[0]?.sentence?.prison).toBe('firm');
		const summary = projectView(state, [], content).summary;
		expect(summary?.cause).toBe('Condamnation définitive à de la prison ferme.');
		expect(gameStateSchema.parse(JSON.parse(JSON.stringify(state)))).toStrictEqual(state);
	});

	it('poursuit le proche auteur du fait, sans appel ni peine pour le joueur', () => {
		const content = quiet(withCourt());
		let state = withFact(content, 'delegate');
		const author = state.facts[0]!.authorId!;
		state = ok(transition(state, commitTurn(), content), content).state;
		expect(state.cases[0]?.defendantId).toBe(author);
		expect(state.events.pending[0]).toMatchObject({
			eventId: 'test.entourage_revelation',
			actors: { defendant: author }
		});
		state = advance(state, content, 6, 'distance');
		expect(state.cases[0]).toMatchObject({ outcome: 'convicted', defendantId: author });
		expect(state.cases[0]?.sentence).toMatchObject({ fineCents: 0, ineligibilityTurns: 0 });
		expect(state.player.ineligibleUntil).toBeNull();
		expect(readStat(state, 'player.openCases')).toBe(0);
	});

	it('refuse la candidature et l’attribution d’un mandat pendant l’inéligibilité', () => {
		const content = quiet(withCourt());
		const base = createGame({ seed: 'inéligible' }, content);
		const banned = { ...base, player: { ...base.player, ineligibleUntil: base.turn + 40 } };
		expect(evaluateCondition(banned, { op: 'canHoldMandate', mandate: 'mandate.councillor' })).toBe(
			false
		);
		expect(evaluateCondition(base, { op: 'canHoldMandate', mandate: 'mandate.councillor' })).toBe(
			true
		);
	});
});
