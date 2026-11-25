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

/** Partie arrêtée sur l'offre douteuse, au trimestre 1. */
function offered(content: Content = shady): GameState {
	const state = ok(
		transition(createGame({ seed: 'justice' }, content), commitTurn(), content),
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
		expect(judicialRisk([], 100, 10, shady)).toEqual({
			value: 0,
			contributions: [],
			exposureBonus: 0
		});
	});

	it('compte la gravité d’un fait récent, à moitié quand le joueur n’est que complice', () => {
		const author = judicialRisk([fact()], 0, 0, shady);
		expect(author.value).toBe(2 * rules.riskPerSeverity);
		const accomplice = judicialRisk([fact({ authorId: 'test.cousin' })], 0, 0, shady);
		expect(accomplice.value).toBe(rules.riskPerSeverity);
	});

	it('décroît jusqu’à la prescription', () => {
		const half = judicialRisk([fact()], 0, rules.prescriptionTurns / 2, shady);
		expect(half.value).toBe(rules.riskPerSeverity);
		expect(judicialRisk([fact()], 0, rules.prescriptionTurns, shady).value).toBe(0);
	});

	it('est majoré par l’exposition médiatique et reste borné à 100', () => {
		const exposed = judicialRisk([fact()], 100, 0, shady);
		expect(exposed.exposureBonus).toBe(8);
		expect(exposed.value).toBe(24);
		const many = Array.from({ length: 10 }, (_, index) =>
			fact({ factId: `fact.${index + 1}`, severity: 3 })
		);
		expect(judicialRisk(many, 100, 0, shady).value).toBe(100);
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
		...fixtureJustice.balance,
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
		endReason: status === 'ended' ? 'term' : null
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
