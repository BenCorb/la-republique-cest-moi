import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/lib/game/content/load.ts';
import { projectView } from '../../src/lib/game/app/view-model.ts';
import {
	checkInvariants,
	commitTurn,
	createGame,
	regionalMedia,
	renderTemplate,
	resolveMediaRef,
	transition
} from '../../src/lib/game/engine/index.ts';

/** Presse régionale (P3-18, PT-P3-09-003) sur le catalogue réel. */
const content = loadContent();
const regional = content.mediaIds.filter((id) => content.media[id]?.scope === 'regional');
const national = content.mediaIds.filter((id) => content.media[id]?.scope === 'national');

describe('presse régionale du catalogue', () => {
	it('compte un quotidien distinct par région et quatre médias nationaux', () => {
		expect(content.regionIds).toHaveLength(13);
		expect(regional).toHaveLength(13);
		expect(national).toHaveLength(4);
		const regions = regional.map((id) => content.media[id]!.region);
		expect(new Set(regions)).toEqual(new Set(content.regionIds));
		const names = regional.map((id) => content.media[id]!.name);
		expect(new Set(names).size).toBe(13);
		// Le Courrier du Bocage devient le titre de la Normandie.
		expect(regionalMedia('region.normandie', content)?.id).toBe('media.bocage');
	});

	it('n’écrit plus aucun identifiant de titre régional en dur dans les événements et actifs', () => {
		const serialized = JSON.stringify([content.events, content.upgrades, content.actions]);
		for (const id of regional) expect(serialized).not.toContain(`"${id}"`);
		expect(serialized).not.toContain('Courrier du Bocage');
	});

	it.each(content.regionIds)('%s : ancrage, rachat nommé et vue des médias', (regionId) => {
		const state = createGame({ seed: `presse-${regionId}`, region: regionId }, content);
		const anchor = resolveMediaRef('regional_anchor', regionId, content);
		expect(content.media[anchor]?.region).toBe(regionId);
		const view = projectView(state, [], content);
		const listed = view.career.media.outlets.map((outlet) => outlet.mediaId);
		expect(listed).toEqual(expect.arrayContaining([...national, anchor]));
		expect(listed).toHaveLength(national.length + 1);
		expect(view.career.media.outlets.find((outlet) => outlet.mediaId === anchor)?.follows).toBe(
			true
		);
		const buyout = view.wealth.offers.find((item) => item.id === 'wealth.local_media');
		expect(buyout?.label).toBe(`Racheter ${content.media[anchor]!.name}`);
		// Le nom du quotidien remplace {regional_media} dans les textes d'événements.
		expect(
			renderTemplate(
				'Fax parti à {regional_media}.',
				{ regional_media: anchor },
				content,
				state.characters
			)
		).toBe(`Fax parti à ${content.media[anchor]!.name}.`);
	});

	it('rachète le quotidien de sa région et l’affiche sous son nom', () => {
		let state = createGame({ seed: 'rachat-beffroi', region: 'region.hauts_de_france' }, content);
		state = { ...state, resources: { ...state.resources, personalCashCents: 40_000_000 } };
		const result = transition(
			state,
			commitTurn({ steps: [{ kind: 'purchase', id: 'wealth.local_media' }] }),
			content
		);
		if (!result.ok) throw new Error(result.error.message);
		expect(checkInvariants(result.state, content)).toEqual([]);
		const view = projectView(result.state, [], content);
		const beffroi = view.career.media.outlets.find((outlet) => outlet.mediaId === 'media.beffroi');
		expect(beffroi?.owned).toBe(true);
		expect(
			view.career.media.outlets.find((outlet) => outlet.mediaId === 'media.bocage')
		).toBeUndefined();
	});
});
