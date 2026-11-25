import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/lib/game/content/load.ts';
import { validateContent } from '../../src/lib/game/content/validate.ts';
import { createGame } from '../../src/lib/game/engine/index.ts';
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
	fixtureSupports,
	fixtureTraits,
	fixtureUpgrades,
	fixtureWorld
} from '../fixtures/content.ts';

const content = loadContent();

function validate(actions: unknown) {
	return validateContent({
		actions,
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
		institutions: fixtureInstitutions
	});
}

describe('agenda regroupé par thème', () => {
	const view = projectView(createGame({ seed: 'agenda' }, content), [], content);

	it('classe chaque action du catalogue dans un thème connu', () => {
		const known = new Set(content.actionCategories.map((category) => category.id));
		for (const id of content.actionIds)
			expect(known.has(content.actions[id]!.category ?? '')).toBe(true);
	});

	it('suit l’ordre des thèmes et omet les actions ciblées, choisies ailleurs', () => {
		const order = content.actionCategories.map((category) => category.id);
		const ids = view.actionGroups.map((group) => group.id);
		expect(ids).toEqual(order.filter((id) => ids.includes(id)));
		const listed = view.actionGroups.flatMap((group) => [...group.actions, ...group.outOfReach]);
		expect(listed.map((action) => action.id).sort()).toEqual(
			view.actions.map((action) => action.id).sort()
		);
		expect(listed.some((action) => content.actions[action.id]?.target)).toBe(false);
	});

	it('met à part les actions hors de portée, avec leur motif', () => {
		const activism = view.actionGroups.find((group) => group.id === 'activism')!;
		expect(activism.actions.map((action) => action.id)).toEqual(['activism.leaflets']);
		expect(activism.outOfReach.map((action) => action.id)).toEqual(['activism.public_meeting']);
		expect(activism.outOfReach[0]?.outOfReach).toBe(true);
		expect(activism.outOfReach[0]?.reason).toContain('10 points d’influence');
		// Les actions d'autres professions sont hors de portée (profil par défaut : enseignement).
		const work = view.actionGroups.find((group) => group.id === 'work')!;
		expect(work.actions.map((action) => action.id)).toEqual([
			'personal.freelance',
			'profession.evening_classes'
		]);
	});

	it('garde visible, grisée, une action seulement bloquée ce trimestre', () => {
		const state = createGame({ seed: 'agenda-limite' }, content);
		const leaflets = { kind: 'action' as const, id: 'activism.leaflets' };
		const busy = projectView(state, [leaflets, leaflets], content);
		const action = busy.actionGroups
			.find((group) => group.id === 'activism')!
			.actions.find((item) => item.id === 'activism.leaflets')!;
		expect(action).toMatchObject({ addable: false, outOfReach: false, planned: 2 });
	});
});

describe('validation des thèmes', () => {
	it('refuse un thème inconnu ou en double', () => {
		const unknown = validate({
			categories: [{ id: 'one', label: 'Un' }],
			actions: [
				{ ...fixtureActions.actions[0], category: 'two' },
				...fixtureActions.actions.slice(1)
			]
		});
		expect(!unknown.ok && unknown.issues.map((issue) => issue.message)).toContain(
			'thème inconnu : two'
		);
		const duplicate = validate({
			categories: [
				{ id: 'one', label: 'Un' },
				{ id: 'one', label: 'Un bis' }
			],
			actions: fixtureActions.actions
		});
		expect(!duplicate.ok && duplicate.issues.map((issue) => issue.message)).toContain(
			'thème en double'
		);
	});

	it('range les actions sans thème dans « Autres actions »', () => {
		const result = validate(fixtureActions);
		if (!result.ok) throw new Error('catalogue de test invalide');
		const groups = projectView(
			createGame({ seed: 'autres' }, result.content),
			[],
			result.content
		).actionGroups;
		expect(groups.map((group) => group.label)).toEqual(['Autres actions']);
	});
});
