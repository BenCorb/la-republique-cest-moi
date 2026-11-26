import { describe, expect, it } from 'vitest';
import type { Content } from '../../src/lib/game/content/types.ts';
import { validateContent } from '../../src/lib/game/content/validate.ts';
import {
	carryOverPlan,
	checkInvariants,
	commitTurn,
	createGame,
	previewPlan,
	transition,
	type GameState,
	type PlanStep
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
	quarterLog
} from '../fixtures/content.ts';

const releaseAction = {
	id: 'test.release',
	label: 'Se séparer',
	description: 'Un exemplaire quitte l’organisation.',
	timeCost: 2,
	maxPerTurn: 5,
	costs: [],
	effects: [{ op: 'releaseUpgrade' }],
	target: 'upgrade'
};

function raw(overrides: { actions?: unknown[]; upgradeChanges?: Record<string, unknown> } = {}) {
	return {
		actions: { actions: [...fixtureActions.actions, ...(overrides.actions ?? [releaseAction])] },
		upgrades: {
			upgrades: fixtureUpgrades.upgrades.map((upgrade) =>
				upgrade.id === 'test.volunteer'
					? {
							...upgrade,
							ownedLabel: 'Bénévole en poste',
							releaseEffects: [{ op: 'addSupport', group: 'support.members', value: -2 }],
							...overrides.upgradeChanges
						}
					: upgrade
			)
		},
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
		epitaphs: fixtureEpitaphs
	};
}

function load(): Content {
	const result = validateContent(raw());
	if (!result.ok) throw new Error(JSON.stringify(result.issues, null, 2));
	return result.content;
}

const catalog = load();
const buy: PlanStep = { kind: 'purchase', id: 'test.volunteer' };
const release = (target: string): PlanStep => ({ kind: 'action', id: 'test.release', target });

function commit(state: GameState, steps: readonly PlanStep[]): GameState {
	const result = transition(state, commitTurn({ steps }), catalog);
	if (!result.ok) throw new Error(result.error.message);
	expect(checkInvariants(result.state, catalog)).toEqual([]);
	return result.state;
}

/** Deux bénévoles achetés au premier trimestre, actifs au deuxième. */
function withVolunteers(): GameState {
	const start = createGame({ seed: 'organisation' }, catalog);
	const funded = {
		...start,
		resources: { ...start.resources, politicalBudgetCents: 100_000 },
		player: { ...start.player, supports: { ...start.player.supports, 'support.members': 20 } }
	};
	return commit(funded, [buy, buy]);
}

describe('départ d’un élément de l’organisation', () => {
	it('retire l’exemplaire dès ce trimestre, sans charge ni production, avec ses effets propres', () => {
		const state = withVolunteers();
		const [first, second] = state.upgrades;
		const before = state.player.supports['support.members'] ?? 0;

		const result = transition(state, commitTurn({ steps: [release(second!.instanceId)] }), catalog);
		if (!result.ok) throw new Error(result.error.message);
		const log = quarterLog(result);

		expect(result.state.upgrades.map((upgrade) => upgrade.instanceId)).toEqual([first!.instanceId]);
		// Seul l'exemplaire restant a payé ses charges et produit.
		expect(log.economy.producers.map((producer) => [producer.active, producer.suspended])).toEqual([
			[1, 0]
		]);
		expect(log.steps[0]).toMatchObject({ id: 'test.release', target: second!.instanceId });
		expect(result.state.player.supports['support.members']).toBeLessThan(before);
		expect(checkInvariants(result.state, catalog)).toEqual([]);

		// Le journal nomme encore l'exemplaire parti.
		const view = projectView(result.state, [], catalog);
		expect(view.journal[0]!.lines[0]!.text).toMatch(/^Se séparer : Bénévole en poste/u);
	});

	it('refuse un exemplaire inconnu, en cours d’achat ou déjà parti dans le même plan', () => {
		const state = withVolunteers();
		const owned = state.upgrades[0]!.instanceId;
		const issue = (steps: PlanStep[]): string | undefined =>
			previewPlan(state, { steps }, catalog).issues.at(-1)?.code;

		expect(issue([release('upgrade.99')])).toBe('invalid_target');
		expect(issue([release(owned), release(owned)])).toBe('invalid_target');
		// L'exemplaire acheté dans ce plan n'est acquis qu'en fin de trimestre.
		const next = `upgrade.${state.nextInstanceNumber}`;
		expect(issue([buy, release(next)])).toBe('invalid_target');
		expect(previewPlan(state, { steps: [release(owned)] }, catalog).valid).toBe(true);
	});

	it('montre l’effet du départ dans la prévision et retire l’étape du plan reconduit', () => {
		const state = withVolunteers();
		const target = state.upgrades[0]!.instanceId;
		const preview = previewPlan(state, { steps: [release(target)] }, catalog);
		expect(preview.steps[0]!.effects).toEqual([
			{ kind: 'support', group: 'support.members', value: -2 }
		]);
		expect(preview.producers).toHaveLength(1);

		const after = commit(state, [release(target)]);
		expect(carryOverPlan(after, { steps: [release(target)] }, catalog).plan.steps).toEqual([]);
	});
});

describe('organisation regroupée', () => {
	it('regroupe les exemplaires et propose le départ du plus récent', () => {
		const state = withVolunteers();
		const [, newest] = state.upgrades;
		const group = projectView(state, [], catalog).organisation[0]!;
		expect(group).toMatchObject({
			upgradeId: 'test.volunteer',
			label: 'Bénévole en poste',
			owned: 2,
			active: 2,
			pending: 0,
			releasesPlanned: 0,
			releaseEffects: ['Soutien : Militants − 2'],
			release: { step: release(newest!.instanceId), reason: null }
		});
		// Montants avec espaces insécables : comparaison normalisée.
		expect(group.upkeep.map((text) => text.replace(/\s/gu, ' '))).toEqual([
			'Budget politique − 80 €'
		]);

		const planned = projectView(state, [release(newest!.instanceId)], catalog).organisation[0]!;
		expect(planned).toMatchObject({ releasesPlanned: 1, active: 1 });
		expect(planned.release?.step).toEqual(release(state.upgrades[0]!.instanceId));
	});
});

describe('validation du départ', () => {
	it('réserve le départ aux actions ciblant un exemplaire', () => {
		const result = validateContent(
			raw({ actions: [{ ...releaseAction, id: 'test.bad_release', target: 'staff' }] })
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.issues.map((issue) => issue.message)).toContain(
				'départ réservé aux actions ciblant un exemplaire de l’organisation'
			);
		}
	});

	it('n’admet que des effets certains au départ', () => {
		const result = validateContent(
			raw({ upgradeChanges: { releaseEffects: [{ op: 'leaveParty' }] } })
		);
		expect(result.ok).toBe(false);
	});
});
