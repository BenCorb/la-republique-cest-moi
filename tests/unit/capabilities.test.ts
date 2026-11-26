import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/lib/game/content/load.ts';
import type { Content, Effect, EventChoice } from '../../src/lib/game/content/types.ts';
import {
	checkInvariants,
	choiceAvailability,
	chooseEventCommand,
	commitTurn,
	createGame,
	describePendingEvent,
	factIssue,
	transition,
	type GameState,
	type MandateInstance,
	type TurnPlan
} from '../../src/lib/game/engine/index.ts';
import { createEnvelope, exportSave, importSave } from '../../src/lib/game/persistence/index.ts';
import { withEvents } from '../fixtures/content.ts';

/**
 * Cohérence des affaires et embauche familiale (P3-12, PT-P3-09-008 et 009),
 * sur le catalogue réel.
 */
const content = loadContent();

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

/** Joueur sans activité politique : ni étiquette, ni mandat, ni organisation, ni entourage. */
const fresh = createGame({ seed: 'capacités' }, content);

/** Maire, conseiller municipal et doté d'une organisation : toutes les capacités lues sur l'état. */
const powerful: GameState = {
	...holding(fresh, 'mandate.municipal_councillor', 'mandate.mayor'),
	upgrades: [
		{
			instanceId: 'upgrade.1',
			upgradeId: content.upgradeIds[0]!,
			acquiredTurn: 0,
			valueCents: null
		}
	]
};

/** Tous les choix (ou événements informatifs) du catalogue qui inscrivent un fait. */
const factSources = content.eventIds.flatMap((eventId) => {
	const event = content.events[eventId]!;
	const lists: { label: string; effects: readonly Effect[]; choice: EventChoice | null }[] =
		event.blocking
			? event.choices.map((choice) => ({
					label: `${eventId} › ${choice.id}`,
					effects: choice.effects,
					choice
				}))
			: [{ label: eventId, effects: event.effects, choice: null }];
	return lists.flatMap((entry) =>
		entry.effects.flatMap((effect) =>
			effect.op === 'recordFact' ? [{ ...entry, eventId, effect }] : []
		)
	);
});

function ok(state: GameState, usedContent: Content = content): GameState {
	expect(checkInvariants(state, usedContent)).toEqual([]);
	return state;
}

function commit(state: GameState, usedContent: Content, plan?: TurnPlan): GameState {
	const result = transition(state, commitTurn(plan), usedContent);
	if (!result.ok) throw new Error(result.error.message);
	return ok(result.state, usedContent);
}

function choose(state: GameState, choiceId: string, usedContent: Content): GameState {
	const instance = state.events.pending[0]!;
	const result = transition(state, chooseEventCommand(instance.instanceId, choiceId), usedContent);
	if (!result.ok) throw new Error(result.error.message);
	return ok(result.state, usedContent);
}

/** Répond aux décisions imprévues par le premier choix disponible. */
function settle(state: GameState, usedContent: Content): GameState {
	let current = state;
	for (let view = describePendingEvent(current, usedContent); view;) {
		const choice = view.choices.find((candidate) => candidate.available)!;
		current = choose(current, choice.id, usedContent);
		view = describePendingEvent(current, usedContent);
	}
	return current;
}

describe('capacités exigées par les infractions (P3-12)', () => {
	it('associe une capacité à chaque infraction du catalogue', () => {
		expect(
			Object.fromEntries(content.offenseIds.map((id) => [id, content.offenses[id]!.capability]))
		).toEqual({
			'offense.fictitious_job': 'real_hire',
			'offense.illegal_financing': 'political_activity',
			'offense.favoritism': 'local_power',
			'offense.conflict_of_interest': 'public_office',
			'offense.misuse_of_assets': 'organization_funds'
		});
	});

	it('audite chaque fait du catalogue : impossible sans pouvoir, possible avec', () => {
		expect(factSources.map((source) => source.label).sort()).toEqual([
			'entourage.creative_accounting › accept',
			'finance.donor_favour › call',
			'finance.expense_report › charge',
			'finance.gala_table › help',
			'finance.generous_donor › accept',
			'institutions.transparency_audit › omit',
			'mandate.lobby_breakfast › sign',
			'personal.family_job_request › hire',
			'personal.family_job_request › replace',
			'relations.donor_returns › accept',
			'relations.donor_returns › accept_funds'
		]);
		for (const { label, effect } of factSources) {
			if (content.offenses[effect.offense]!.capability === 'real_hire') continue;
			expect(factIssue(effect, fresh, {}, content), label).not.toBeNull();
			expect(factIssue(effect, powerful, {}, content), label).toBeNull();
		}
	});

	it('refuse dans le moteur un choix dont l’infraction est hors de portée', () => {
		// Même si la condition de l'événement était contournée, le choix reste indisponible.
		const gala = content.events['finance.gala_table']!;
		if (!gala.blocking) throw new Error('événement bloquant attendu');
		const help = gala.choices.find((choice) => choice.id === 'help')!;
		expect(choiceAvailability(help, fresh, content)).toEqual({
			available: false,
			reason: 'Il faut détenir un pouvoir local (une mairie) pour cela.'
		});
		expect(choiceAvailability(help, powerful, content).available).toBe(true);
	});

	it('n’inscrit d’emploi fictif qu’après une embauche réelle', () => {
		const effect = factSources.find((source) =>
			source.label.endsWith('family_job_request › hire')
		)!.effect;
		expect(factIssue(effect, powerful, { relative: 'cast.x' }, content)).toBe(
			'Aucune embauche réelle n’a eu lieu.'
		);
	});
});

describe('le petit service du donateur (P3-12)', () => {
	const favour = content.events['finance.donor_favour']!;
	if (!favour.blocking) throw new Error('événement bloquant attendu');
	const option = (id: string) => favour.choices.find((choice) => choice.id === id)!;

	it('propose le permis au maire, une mise en relation sans infraction sinon', () => {
		const councillor = holding(fresh, 'mandate.municipal_councillor');
		expect(choiceAvailability(option('call'), councillor, content).available).toBe(false);
		expect(choiceAvailability(option('introduce'), councillor, content).available).toBe(true);
		expect(choiceAvailability(option('call'), powerful, content).available).toBe(true);
		expect(choiceAvailability(option('introduce'), powerful, content).available).toBe(false);
		expect(option('introduce').effects.some((effect) => effect.op === 'recordFact')).toBe(false);
		expect(choiceAvailability(option('refuse'), fresh, content).available).toBe(true);
	});

	it('réévalue la demande à l’échéance, puis mène le maire à l’enquête de presse', () => {
		const quiet = withEvents([], { ordinaryDrawsPerTurn: 0, ordinaryEventChance: 0 }, content);
		const donor = Object.values(fresh.characters).find((character) =>
			character.tags.includes('donor')
		)!;
		// La suite a été programmée avant l'élection ; le joueur est maire quand elle arrive.
		const scheduled: GameState = {
			...powerful,
			upgrades: [],
			events: {
				...powerful.events,
				scheduled: [
					{
						eventId: 'finance.donor_favour',
						dueTurn: 1,
						sourceInstanceId: 'event.0',
						actors: { donor: donor.id }
					}
				]
			}
		};
		let state = commit(scheduled, quiet);
		const view = describePendingEvent(state, quiet)!;
		expect(view.eventId).toBe('finance.donor_favour');
		expect(view.choices.find((choice) => choice.id === 'call')?.available).toBe(true);
		state = choose(state, 'call', quiet);
		expect(state.facts.at(-1)).toMatchObject({ offenseId: 'offense.favoritism' });
		for (let turn = 0; turn < 4; turn += 1) state = settle(commit(state, quiet), quiet);
		const seen = state.history.flatMap((entry) =>
			entry.type === 'turn.resolved' ? entry.events.map((event) => event.eventId) : []
		);
		expect(seen).toContain('press.donor_investigation');
	});
});

describe('le retour du donateur (P3-12)', () => {
	it('survient avec un donateur vénal bien disposé, décliné selon le mandat', () => {
		const only = withEvents(['relations.donor_returns'], undefined, content);
		const donor = Object.values(fresh.characters).find((character) =>
			character.tags.includes('donor')
		)!;
		const courted = (state: GameState): GameState => ({
			...state,
			characters: {
				...state.characters,
				[donor.id]: { ...donor, traits: ['trait.venality'] }
			},
			relationships: {
				...state.relationships,
				[donor.id]: { metTurn: 0, attitude: 30, memories: [] }
			}
		});
		const available = (state: GameState) => {
			const next = commit(courted(state), only);
			const view = describePendingEvent(next, only)!;
			expect(view.eventId).toBe('relations.donor_returns');
			return Object.fromEntries(view.choices.map((choice) => [choice.id, choice.available]));
		};
		// Élu : prise illégale d'intérêts ; sans mandat mais organisé : tribune payée.
		expect(available(holding(fresh, 'mandate.municipal_councillor'))).toMatchObject({
			accept: true,
			accept_funds: false
		});
		expect(available({ ...powerful, mandates: [] })).toMatchObject({
			accept: false,
			accept_funds: true
		});
	});
});

describe('un poste pour la famille (P3-12)', () => {
	const family = withEvents(['personal.family_job_request'], undefined, content);
	const quiet = withEvents([], { ordinaryDrawsPerTurn: 0, ordinaryEventChance: 0 }, content);

	/** Joueur assez influent pour débloquer la direction de cabinet, et solvable. */
	function influent(influence: number): GameState {
		return {
			...fresh,
			resources: { ...fresh.resources, influence, politicalBudgetCents: 2_000_000 }
		};
	}

	it('lie l’événement au premier poste vacant et embauche réellement le proche', () => {
		const state = commit(influent(30), family);
		const instance = state.events.pending[0]!;
		expect(instance.eventId).toBe('personal.family_job_request');
		expect(instance.actors['post']).toBe('post.chief_of_staff');
		const view = describePendingEvent(state, family)!;
		expect(view.text).toContain('« Direction de cabinet »');
		const choices = Object.fromEntries(view.choices.map((choice) => [choice.id, choice]));
		expect(choices['hire']).toMatchObject({
			label: 'Le recruter au poste « Direction de cabinet »',
			available: true
		});
		expect(choices['replace']).toMatchObject({
			available: false,
			reason: 'Le poste « Direction de cabinet » est vacant : personne à remplacer.'
		});
		expect(choices['replace']?.label).toMatch(/^Remplacer le titulaire par /u);

		const relativeId = instance.actors['relative']!;
		const hired = choose(state, 'hire', family);
		expect(hired.staff).toContainEqual({
			characterId: relativeId,
			postId: 'post.chief_of_staff',
			hiredTurn: state.turn,
			missionId: content.posts['post.chief_of_staff']!.missions[0]!.id,
			status: 'active',
			leftTurn: null,
			leaveReason: null
		});
		// Le même personnage : famille, relations et entourage.
		const relative = hired.characters[relativeId]!;
		expect(relative.tags).toEqual(expect.arrayContaining(['family', 'staff', 'staff_chief']));
		expect(relative.tags).not.toContain('job_seeker');
		expect(hired.relationships[relativeId]).toBeDefined();
		expect(hired.shortlists['post.chief_of_staff']).toBeUndefined();
		expect(hired.facts.at(-1)).toMatchObject({
			offenseId: 'offense.fictitious_job',
			accompliceIds: [relativeId]
		});

		// Recruté au trimestre T, il ne produit qu'à partir de T+1.
		const first = commit(hired, quiet);
		const production = (entry: GameState['history'][number] | undefined) =>
			entry?.type === 'turn.resolved'
				? (entry.staff?.production ?? []).map((record) => record.characterId)
				: [];
		expect(
			production(first.history.findLast((entry) => entry.type === 'turn.resolved'))
		).not.toContain(relativeId);
		const second = commit(settle(first, quiet), quiet);
		expect(
			production(second.history.findLast((entry) => entry.type === 'turn.resolved'))
		).toContain(relativeId);
	});

	it('n’embauche jamais deux fois après reprise d’une sauvegarde', () => {
		const state = commit(influent(30), family);
		const instanceId = state.events.pending[0]!.instanceId;
		const hired = choose(state, 'hire', family);
		const read = importSave(
			exportSave(createEnvelope(hired, family, '2026-11-26T10:00:00.000Z')).text,
			family
		);
		if (!read.ok) throw new Error(read.error.message);
		const resumed = read.envelope.state;
		expect(resumed).toStrictEqual(hired);
		const replay = transition(resumed, chooseEventCommand(instanceId, 'hire'), family);
		expect(replay.ok).toBe(false);
		const relativeId = state.events.pending[0]!.actors['relative']!;
		expect(resumed.staff.filter((member) => member.characterId === relativeId)).toHaveLength(1);
	});

	it('propose explicitement de remplacer le titulaire quand le poste est occupé', () => {
		// Seule la direction de cabinet est débloquée ; un premier collaborateur l'occupe.
		let state = commit(influent(16), quiet);
		const candidate = state.shortlists['post.chief_of_staff']![0]!.characterId;
		state = commit(state, quiet, {
			steps: [{ kind: 'action', id: 'staff.hire', target: candidate }]
		});
		state = commit(settle(state, quiet), family);
		const instance = state.events.pending[0]!;
		expect(instance.actors).toMatchObject({ post: 'post.chief_of_staff', incumbent: candidate });
		const view = describePendingEvent(state, family)!;
		const choices = Object.fromEntries(view.choices.map((choice) => [choice.id, choice]));
		expect(choices['hire']).toMatchObject({
			available: false,
			reason: 'Le poste « Direction de cabinet » est déjà pourvu.'
		});
		expect(choices['open_selection']?.available).toBe(false);
		expect(choices['replace']).toMatchObject({
			label: `Remplacer ${state.characters[candidate]!.name} par ${state.characters[instance.actors['relative']!]!.name}`,
			available: true
		});

		const before = state.relationships[candidate]!.attitude;
		const replaced = choose(state, 'replace', family);
		expect(replaced.staff.find((member) => member.characterId === candidate)).toMatchObject({
			status: 'left',
			leaveReason: 'dismissed'
		});
		expect(replaced.relationships[candidate]!.attitude).toBeLessThan(before);
		expect(replaced.staff.find((member) => member.status === 'active')?.characterId).toBe(
			instance.actors['relative']
		);
	});

	it('ajoute le proche à la présélection sans infraction lors d’une sélection ouverte', () => {
		const state = commit(influent(30), family);
		const relativeId = state.events.pending[0]!.actors['relative']!;
		const selected = choose(state, 'open_selection', family);
		expect(selected.shortlists['post.chief_of_staff']).toContainEqual({
			characterId: relativeId,
			profileId: 'profile.connected'
		});
		expect(selected.characters[relativeId]!.tags).toContain('candidate');
		expect(selected.staff).toEqual(state.staff);
		expect(selected.facts).toEqual(state.facts);
	});

	it('n’apparaît pas sans poste d’entourage débloqué', () => {
		const state = commit(influent(0), family);
		expect(state.events.pending).toEqual([]);
	});
});
