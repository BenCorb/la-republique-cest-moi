/**
 * Territoire d'origine (P3-16, GDD §3.1).
 *
 * - La région est choisie à la création ; le département (réel, millésime figé
 *   du COG Insee, Paris exclu) et la commune (fictive) sont tirés.
 * - La commune a une taille (bourg, petite ville, ville moyenne) et deux ou
 *   trois traits compatibles ; son nom vient de modèles pondérés et de
 *   fragments validés du catalogue, jamais d'une génération libre.
 * - Les tirages utilisent un PRNG dérivé de la seed (`seed#territoire`) : le
 *   territoire ne décale aucun autre tirage de la partie.
 * - Effets légers : effets de départ de la taille, des traits et de leur
 *   rencontre avec l'origine sociale ; force de l'adversaire aux scrutins
 *   locaux selon la taille. Valeurs provisoires de `profiles.json`.
 */
import {
	REGIONAL_ANCHOR,
	type Content,
	type Effect,
	type MediaDefinition,
	type RegionDefinition,
	type ToponymyDefinition,
	type TownTraitDefinition
} from '../content/types.ts';
import { createRng, nextInt, type RngState } from './random.ts';

/** Commune de départ du joueur, fictive. */
export interface HomeTown {
	readonly name: string;
	/** Taille (`town_size.*`). */
	readonly sizeId: string;
	/** Traits (`town_trait.*`), dans l'ordre du catalogue. */
	readonly traitIds: readonly string[];
}

/** Territoire d'origine du joueur, fixé à la création et sauvegardé. */
export interface TerritoryState {
	readonly regionId: string;
	/** Code du département réel (`14`, `2A`…). */
	readonly departmentCode: string;
	readonly homeTown: HomeTown;
}

function pick<T>(items: readonly T[], rng: RngState): { item: T; rng: RngState } {
	if (items.length === 0) throw new Error('Tirage dans une liste vide.');
	if (items.length === 1) return { item: items[0]!, rng };
	const draw = nextInt(rng, 0, items.length - 1);
	return { item: items[draw.value]!, rng: draw.rng };
}

function weighted<T>(
	items: readonly T[],
	weight: (item: T) => number,
	rng: RngState
): { item: T; rng: RngState } {
	if (items.length === 1) return { item: items[0]!, rng };
	const total = items.reduce((sum, item) => sum + weight(item), 0);
	const draw = nextInt(rng, 1, total);
	let cumulative = 0;
	for (const item of items) {
		cumulative += weight(item);
		if (draw.value <= cumulative) return { item, rng: draw.rng };
	}
	return { item: items[items.length - 1]!, rng: draw.rng };
}

const VARIABLE = /\{([a-z]+)\}/gu;

/** Fragments disponibles pour chaque variable d'un modèle, dans cette région. */
function fragments(
	region: RegionDefinition,
	toponymy: ToponymyDefinition,
	name: string
): readonly string[] {
	switch (name) {
		case 'root':
			return region.toponymy.roots;
		case 'river':
			return region.toponymy.rivers;
		case 'pays':
			return region.toponymy.pays;
		case 'saint':
			return toponymy.saints;
		case 'complement':
			return toponymy.complements;
		case 'plural':
			return toponymy.plurals;
		case 'standalone':
			return toponymy.standalone;
		default:
			return [];
	}
}

/**
 * Nom de commune fictive : un modèle tiré au poids parmi ceux dont toutes les
 * variables ont des fragments dans la région, puis un fragment par variable.
 */
export function generateTownName(
	region: RegionDefinition,
	toponymy: ToponymyDefinition,
	rng: RngState
): { name: string; rng: RngState } {
	const usable = (region.toponymy.patterns ?? toponymy.patterns).filter((entry) =>
		[...entry.pattern.matchAll(VARIABLE)].every(
			(match) => fragments(region, toponymy, match[1]!).length > 0
		)
	);
	const pattern = weighted(usable, (entry) => entry.weight, rng);
	let current = pattern.rng;
	const name = pattern.item.pattern.replace(VARIABLE, (_match, variable: string) => {
		const chosen = pick(fragments(region, toponymy, variable), current);
		current = chosen.rng;
		return chosen.item;
	});
	return { name, rng: current };
}

/** Traits compatibles avec la taille et avec ceux déjà retenus. */
function compatible(
	trait: TownTraitDefinition,
	sizeId: string,
	chosen: readonly TownTraitDefinition[]
): boolean {
	return (
		(trait.sizes === undefined || trait.sizes.includes(sizeId)) &&
		!chosen.includes(trait) &&
		!chosen.some((other) => other.excludes.includes(trait.id) || trait.excludes.includes(other.id))
	);
}

/** Territoire d'origine, tiré de façon déterministe à partir de la seed. */
export function createTerritory(seed: string, regionId: string, content: Content): TerritoryState {
	const region = content.regions[regionId];
	if (!region) throw new Error(`Région inconnue : ${regionId}`);
	const { territory } = content;
	let rng = createRng(`${seed}#territoire`);

	const department = pick(
		region.departments.filter((entry) => entry.startable),
		rng
	);
	rng = department.rng;
	const size = weighted(territory.sizes, (entry) => entry.weight, rng);
	rng = size.rng;
	const count = nextInt(rng, territory.traitsPerTown.min, territory.traitsPerTown.max);
	rng = count.rng;
	const chosen: TownTraitDefinition[] = [];
	while (chosen.length < count.value) {
		const options = territory.traits.filter((trait) => compatible(trait, size.item.id, chosen));
		if (options.length === 0) break;
		const trait = pick(options, rng);
		rng = trait.rng;
		chosen.push(trait.item);
	}
	const name = generateTownName(region, territory.toponymy, rng);
	return {
		regionId,
		departmentCode: department.item.code,
		homeTown: {
			name: name.name,
			sizeId: size.item.id,
			traitIds: territory.traits.filter((trait) => chosen.includes(trait)).map((trait) => trait.id)
		}
	};
}

/** Effets de départ du territoire : taille, traits, puis rencontre des traits et de l'origine. */
export function territoryEffects(
	territoryState: TerritoryState,
	originId: string,
	content: Content
): Effect[] {
	const { territory } = content;
	const size = territory.sizes.find((entry) => entry.id === territoryState.homeTown.sizeId);
	const traits = territory.traits.filter((trait) =>
		territoryState.homeTown.traitIds.includes(trait.id)
	);
	return [
		...(size?.effects ?? []),
		...traits.flatMap((trait) => trait.effects),
		...traits.flatMap((trait) =>
			trait.origins.flatMap((entry) => (entry.origin === originId ? entry.effects : []))
		)
	];
}

/** Modificateur de la force de l'adversaire : taille de la commune, aux scrutins locaux. */
export function localRivalModifier(
	territoryState: TerritoryState,
	electionId: string,
	content: Content
): number {
	if (content.elections[electionId]?.scope !== 'local') return 0;
	return (
		content.territory.sizes.find((size) => size.id === territoryState.homeTown.sizeId)
			?.rivalStrengthModifier ?? 0
	);
}

/** Département du territoire (définition du catalogue). */
export function departmentOf(territoryState: TerritoryState, content: Content) {
	return (
		content.regions[territoryState.regionId]?.departments.find(
			(department) => department.code === territoryState.departmentCode
		) ?? null
	);
}

/**
 * Lieu d'un scrutin ou d'un mandat selon sa portée : la commune pour un
 * scrutin local, la région pour un scrutin régional, le département (la
 * circonscription) pour un scrutin national.
 */
export function placeOf(
	scope: 'local' | 'regional' | 'national',
	territoryState: TerritoryState,
	content: Content
): string {
	switch (scope) {
		case 'local':
			return territoryState.homeTown.name;
		case 'regional':
			return content.regions[territoryState.regionId]?.name ?? territoryState.regionId;
		case 'national':
			return departmentOf(territoryState, content)?.name ?? territoryState.departmentCode;
	}
}

// -- Presse régionale (P3-18) ------------------------------------------------

/** Quotidien régional d'une région (un par région, validé au chargement). */
export function regionalMedia(regionId: string, content: Content): MediaDefinition | null {
	for (const mediaId of content.mediaIds) {
		const media = content.media[mediaId]!;
		if (media.scope === 'regional' && media.region === regionId) return media;
	}
	return null;
}

/**
 * Identifiant concret d'une référence de média : `regional_anchor` désigne le
 * quotidien de la région d'origine du joueur (pas de déménagement en V1).
 */
export function resolveMediaRef(ref: string, regionId: string, content: Content): string {
	if (ref !== REGIONAL_ANCHOR) return ref;
	const media = regionalMedia(regionId, content);
	if (!media) throw new Error(`Aucun quotidien régional pour ${regionId}.`);
	return media.id;
}
