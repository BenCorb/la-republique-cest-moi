import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/lib/game/content/load.ts';
import { validateContent } from '../../src/lib/game/content/validate.ts';
import { buildTerritory, creationOptions } from '../../src/lib/game/app/view-model.ts';
import {
	checkInvariants,
	createGame,
	createTerritory,
	generateTownName,
	localRivalModifier,
	placeOf,
	territoryEffects
} from '../../src/lib/game/engine/index.ts';
import { createRng } from '../../src/lib/game/engine/random.ts';
import { createEnvelope, exportSave, importSave } from '../../src/lib/game/persistence/index.ts';
import {
	fixtureActions,
	fixtureBalance,
	fixtureCareer,
	fixtureCast,
	fixtureEntourage,
	fixtureEpitaphs,
	fixtureEvents,
	fixtureInstitutions,
	fixtureJustice,
	fixtureMedia,
	fixtureProfiles,
	fixturePromises,
	fixtureSupports,
	fixtureTraits,
	fixtureUpgrades,
	fixtureWealth,
	fixtureWorld
} from '../fixtures/content.ts';

/** Territoire d'origine (P3-16, PT-P3-09-002). */
const content = loadContent();

describe('catalogue du territoire (P3-16)', () => {
	it('décrit les 13 régions et les 96 départements métropolitains', () => {
		expect(content.regionIds).toHaveLength(13);
		const departments = content.regionIds.flatMap((id) => content.regions[id]!.departments);
		expect(departments).toHaveLength(96);
		expect(new Set(departments.map((department) => department.code)).size).toBe(96);
		// Paris n'accueille pas de commune de départ fictive.
		expect(departments.filter((department) => !department.startable).map((d) => d.code)).toEqual([
			'75'
		]);
	});

	it('refuse des traits ou des modèles de noms incohérents', () => {
		const raw = (profiles: unknown) => ({
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
			profiles,
			justice: fixtureJustice,
			wealth: fixtureWealth,
			promises: fixturePromises,
			media: fixtureMedia,
			institutions: fixtureInstitutions,
			epitaphs: fixtureEpitaphs
		});
		const broken = structuredClone(fixtureProfiles);
		(broken.territory.traits[0]!.excludes as string[]).push('town_trait.nope');
		broken.territory.toponymy.patterns.push({ pattern: '{root}-{nope}', weight: 1 });
		(broken.defaults as { region: string }).region = 'region.nope';
		const result = validateContent(raw(broken));
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.issues.map((issue) => issue.message)).toEqual(
				expect.arrayContaining([
					'trait inconnu : town_trait.nope',
					'modèle de nom invalide : {root}-{nope}',
					'région inconnue : region.nope'
				])
			);
		}
	});
});

describe('tirage du territoire (P3-16)', () => {
	it('tire un département de la région, une taille et des traits compatibles', () => {
		for (const regionId of content.regionIds) {
			const region = content.regions[regionId]!;
			for (let index = 0; index < 40; index += 1) {
				const territory = createTerritory(`territoire-${index}`, regionId, content);
				expect(territory.regionId).toBe(regionId);
				const department = region.departments.find(
					(entry) => entry.code === territory.departmentCode
				);
				expect(department?.startable).toBe(true);
				const { traitIds, sizeId } = territory.homeTown;
				expect(traitIds.length).toBeGreaterThanOrEqual(2);
				expect(traitIds.length).toBeLessThanOrEqual(3);
				const traits = content.territory.traits.filter((trait) => traitIds.includes(trait.id));
				for (const trait of traits) {
					expect(trait.sizes === undefined || trait.sizes.includes(sizeId)).toBe(true);
					expect(traits.some((other) => trait.excludes.includes(other.id))).toBe(false);
				}
			}
		}
	});

	it('génère des noms de communes plausibles, variés et déterministes', () => {
		const shape = /^[A-ZÀ-Ý][\p{L}’' -]*\p{Ll}$/u;
		for (const regionId of content.regionIds) {
			const region = content.regions[regionId]!;
			const names = new Set<string>();
			let rng = createRng(`noms-${regionId}`);
			for (let index = 0; index < 200; index += 1) {
				const generated = generateTownName(region, content.territory.toponymy, rng);
				rng = generated.rng;
				expect(generated.name, generated.name).toMatch(shape);
				expect(generated.name.length).toBeLessThanOrEqual(45);
				expect(generated.name).not.toMatch(/--|\s{2}|[{}]/u);
				names.add(generated.name);
			}
			expect(names.size, regionId).toBeGreaterThanOrEqual(20);
		}
		expect(createTerritory('même', 'region.bretagne', content)).toEqual(
			createTerritory('même', 'region.bretagne', content)
		);
	});

	it('ne décale aucun autre tirage de la partie', () => {
		const normandie = createGame({ seed: 'indépendance', region: 'region.normandie' }, content);
		const corse = createGame({ seed: 'indépendance', region: 'region.corse' }, content);
		expect(corse.rng).toEqual(normandie.rng);
		expect(corse.characters).toEqual(normandie.characters);
		expect(corse.world).toEqual(normandie.world);
		expect(corse.player.territory.regionId).toBe('region.corse');
		expect(checkInvariants(corse, content)).toEqual([]);
	});

	it('sauvegarde le territoire avec la partie', () => {
		const state = createGame({ seed: 'sauvegarde', region: 'region.occitanie' }, content);
		const read = importSave(
			exportSave(createEnvelope(state, content, '2026-11-26T10:00:00.000Z')).text,
			content
		);
		if (!read.ok) throw new Error(read.error.message);
		expect(read.envelope.state.player.territory).toEqual(state.player.territory);
	});
});

describe('effets légers du territoire (P3-16)', () => {
	it('applique taille et traits, modulés par l’origine sociale', () => {
		const territory = {
			regionId: 'region.hauts_de_france',
			departmentCode: '59',
			homeTown: {
				name: 'Wavringhem',
				sizeId: 'town_size.medium_town',
				traitIds: ['town_trait.working', 'town_trait.industrial']
			}
		};
		const working = territoryEffects(territory, 'origin.working_class', content);
		const upper = territoryEffects(territory, 'origin.upper_class', content);
		const sum = (effects: typeof working, group: string) =>
			effects.reduce(
				(total, effect) =>
					total + (effect.op === 'addSupport' && effect.group === group ? effect.value : 0),
				0
			);
		expect(sum(working, 'support.working_class') - sum(upper, 'support.working_class')).toBe(4);
		expect(working).toContainEqual({ op: 'addResource', resource: 'influence', value: 4 });
	});

	it('durcit la concurrence locale d’une ville moyenne, allège celle d’un bourg', () => {
		const town = (sizeId: string) => ({
			regionId: 'region.normandie',
			departmentCode: '14',
			homeTown: { name: 'Bocqueville', sizeId, traitIds: [] }
		});
		expect(localRivalModifier(town('town_size.medium_town'), 'election.municipal', content)).toBe(
			2
		);
		expect(localRivalModifier(town('town_size.village'), 'election.municipal', content)).toBe(-2);
		expect(localRivalModifier(town('town_size.medium_town'), 'election.regional', content)).toBe(0);
	});
});

describe('affichage du territoire (P3-16)', () => {
	it('propose les régions à la création et cite les lieux des scrutins', () => {
		const options = creationOptions(content);
		expect(options.regions.map((region) => region.name)).toContain('Normandie');
		expect(options.defaults.region).toBe('region.normandie');
		const state = createGame({ seed: 'affichage', region: 'region.bretagne' }, content);
		const view = buildTerritory(state, content);
		expect(view.region).toBe('Bretagne');
		expect(['Côtes-d’Armor', 'Finistère', 'Ille-et-Vilaine', 'Morbihan']).toContain(
			view.department
		);
		expect(view.description).toMatch(/^(Bourg|Petite ville|Ville moyenne) \p{Ll}/u);
		const { territory } = state.player;
		expect(placeOf('local', territory, content)).toBe(territory.homeTown.name);
		expect(placeOf('regional', territory, content)).toBe('Bretagne');
	});
});
