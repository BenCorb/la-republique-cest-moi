/**
 * Origine, engagement et famille (GDD §3.1, §3.3) — P2-08.
 *
 * - Création : l'origine et le terrain d’engagement appliquent leurs effets de départ
 *   (ressources, soutiens, stress) ; l'origine génère parents et fratrie, avec
 *   une attitude de départ. L'âge reste fixé à 25 ans.
 * - Vie de famille légère, par relations et événements : rencontre, naissance,
 *   séparation ; l'attitude de la famille proche (partenaire, enfants) évolue
 *   avec les choix et la disponibilité du joueur.
 * - À la frontière : héritage au décès d'un parent, dépenses des enfants à
 *   charge, famille délaissée quand le joueur travaille trop, apaisement ou
 *   stress selon l'attitude du partenaire.
 * Les membres générés portent l'étiquette `kin` et leur lien (`parent`,
 * `sibling`, `partner`, `child`), distincte de la famille élargie de la
 * distribution (`family`).
 */
import {
	GAUGE_MAX,
	GAUGE_MIN,
	type Content,
	type Effect,
	type Resources
} from '../content/types.ts';
import { ageAt, type Turn } from './calendar.ts';
import { addRelation, generatePerson, meet } from './characters.ts';
import type { RngState } from './random.ts';
import type {
	Character,
	FamilyState,
	PlayerState,
	PoliticalChange,
	Relationship
} from './state.ts';

export const EMPTY_FAMILY: FamilyState = {
	partnerId: null,
	childrenIds: [],
	parentIds: [],
	siblingIds: [],
	formerPartnerIds: []
};

/** Attitude de départ d'un partenaire ou d'un enfant qui rejoint la famille. */
const PARTNER_ATTITUDE = 20;
const CHILD_ATTITUDE = 15;

export interface FamilyParts {
	readonly player: PlayerState;
	readonly characters: Readonly<Record<string, Character>>;
	readonly relationships: Readonly<Record<string, Relationship>>;
}

/** Membres proches (partenaire et enfants) encore en vie. */
export function closeFamily(
	player: PlayerState,
	characters: Readonly<Record<string, Character>>
): string[] {
	return [player.family.partnerId, ...player.family.childrenIds].filter(
		(id): id is string => id !== null && characters[id]?.status !== 'dead'
	);
}

/** Enfants encore en vie. */
export function livingChildren(
	player: PlayerState,
	characters: Readonly<Record<string, Character>>
): string[] {
	return player.family.childrenIds.filter((id) => characters[id]?.status !== 'dead');
}

function newRelative(
	relation: 'parent' | 'sibling' | 'partner' | 'child',
	extraTags: readonly string[],
	minAge: number,
	maxAge: number,
	attitude: number,
	parts: FamilyParts,
	turn: Turn,
	rng: RngState,
	content: Content
): { parts: FamilyParts; id: string; rng: RngState } {
	const generated = generatePerson(
		{
			tags: ['kin', relation, ...extraTags],
			epithet: null,
			renewal: null,
			partyId: null,
			minAge,
			maxAge,
			successorOf: null
		},
		turn,
		parts.characters,
		rng,
		content
	);
	const characters = { ...parts.characters, [generated.character.id]: generated.character };
	let relationships = meet(parts.relationships, generated.character.id, turn).relationships;
	const relationship = relationships[generated.character.id]!;
	relationships = { ...relationships, [generated.character.id]: { ...relationship, attitude } };
	return {
		parts: { ...parts, characters, relationships },
		id: generated.character.id,
		rng: generated.rng
	};
}

/** Famille d'origine générée à la création (parents, fratrie), dans l'ordre du catalogue. */
export function createFamily(
	originId: string,
	parts: FamilyParts,
	turn: Turn,
	rng: RngState,
	content: Content
): { parts: FamilyParts; rng: RngState } {
	const origin = content.origins[originId];
	if (!origin) throw new Error(`Origine inconnue : ${originId}`);
	let current = parts;
	let currentRng = rng;
	const parentIds: string[] = [];
	const siblingIds: string[] = [];
	for (const template of origin.family) {
		const relative = newRelative(
			template.relation,
			template.tags,
			template.minAge,
			template.maxAge,
			template.attitude,
			current,
			turn,
			currentRng,
			content
		);
		current = relative.parts;
		currentRng = relative.rng;
		(template.relation === 'parent' ? parentIds : siblingIds).push(relative.id);
	}
	return {
		parts: {
			...current,
			player: { ...current.player, family: { ...current.player.family, parentIds, siblingIds } }
		},
		rng: currentRng
	};
}

export type FamilyEffect = Extract<Effect, { op: 'familyJoins' | 'separate' | 'familyAttitude' }>;

export function isFamilyEffect(effect: Effect): effect is FamilyEffect {
	return effect.op === 'familyJoins' || effect.op === 'separate' || effect.op === 'familyAttitude';
}

/**
 * Applique un effet familial. `familyJoins` tire un nouveau personnage (PRNG) ;
 * une rencontre est sans effet si le joueur vit déjà en couple, une naissance
 * l'est sans partenaire.
 */
export function applyFamilyEffect(
	effect: FamilyEffect,
	parts: FamilyParts,
	turn: Turn,
	rng: RngState,
	content: Content
): { parts: FamilyParts; rng: RngState; changes: PoliticalChange[] } {
	const { family } = parts.player;
	switch (effect.op) {
		case 'familyJoins': {
			if (effect.relation === 'partner' && family.partnerId !== null) {
				return { parts, rng, changes: [] };
			}
			if (effect.relation === 'child' && family.partnerId === null) {
				return { parts, rng, changes: [] };
			}
			const age = ageAt(parts.player.birthTurn, turn);
			const spread = content.balance.family.partnerAgeSpread;
			const relative =
				effect.relation === 'partner'
					? newRelative(
							'partner',
							[],
							Math.max(18, age - spread),
							age + spread,
							PARTNER_ATTITUDE,
							parts,
							turn,
							rng,
							content
						)
					: newRelative('child', [], 0, 0, CHILD_ATTITUDE, parts, turn, rng, content);
			const updatedFamily =
				effect.relation === 'partner'
					? { ...family, partnerId: relative.id }
					: { ...family, childrenIds: [...family.childrenIds, relative.id] };
			return {
				parts: { ...relative.parts, player: { ...relative.parts.player, family: updatedFamily } },
				rng: relative.rng,
				changes: [{ kind: 'familyJoined', characterId: relative.id, relation: effect.relation }]
			};
		}
		case 'separate': {
			const partnerId = family.partnerId;
			const partner = partnerId ? parts.characters[partnerId] : undefined;
			if (!partnerId || !partner) return { parts, rng, changes: [] };
			const relation = addRelation(parts.relationships, partner, -20, 'Séparation.', turn, content);
			return {
				parts: {
					characters: {
						...parts.characters,
						[partnerId]: {
							...partner,
							tags: [...partner.tags.filter((tag) => tag !== 'partner'), 'former_partner']
						}
					},
					relationships: relation.relationships,
					player: {
						...parts.player,
						family: {
							...family,
							partnerId: null,
							formerPartnerIds: [...family.formerPartnerIds, partnerId]
						}
					}
				},
				rng,
				changes: [{ kind: 'separated', characterId: partnerId }]
			};
		}
		case 'familyAttitude':
			return {
				parts: { ...parts, relationships: shiftFamily(parts, effect.value, turn, content) },
				rng,
				changes: []
			};
		default: {
			const unknown: never = effect;
			throw new Error(`Effet familial inconnu : ${JSON.stringify(unknown)}`);
		}
	}
}

/** Variation d'attitude de la famille proche, sans mémoire ni tirage. */
export function shiftFamily(
	parts: FamilyParts,
	value: number,
	turn: Turn,
	content: Content
): Readonly<Record<string, Relationship>> {
	let relationships = parts.relationships;
	for (const id of closeFamily(parts.player, parts.characters)) {
		const character = parts.characters[id];
		if (!character) continue;
		relationships = addRelation(relationships, character, value, null, turn, content).relationships;
	}
	return relationships;
}

export interface FamilyRecord {
	/** Héritage reçu (centimes) au décès d'un parent. */
	readonly inheritance: number;
	/** Dépense des enfants à charge (centimes, négative). */
	readonly childCosts: number;
	/** Variation de stress due au partenaire. */
	readonly stress: number;
	/** La famille s'est sentie délaissée ce trimestre. */
	readonly neglected: boolean;
	/** Partenaire décédé (veuvage), le cas échéant. */
	readonly widowed: string | null;
}

/**
 * Frontière (`turn` = T+1), après le vieillissement : héritage des parents
 * décédés ce trimestre, veuvage, dépenses des enfants à charge (sans descendre
 * sous zéro), famille délaissée si `workload` dépasse le seuil, puis stress ou
 * apaisement selon l'attitude du partenaire.
 */
/**
 * Coût trimestriel des enfants encore à charge à `turn` (avant plafonnement par
 * l'argent personnel). Partagé par la résolution et la prévision du plan.
 */
export function dependantsCostCents(
	player: PlayerState,
	characters: FamilyParts['characters'],
	turn: Turn,
	content: Content
): number {
	const balance = content.balance.family;
	const dependants = livingChildren(player, characters).filter(
		(id) => ageAt(characters[id]!.birthTurn, turn) < balance.childIndependenceAge
	).length;
	return dependants * balance.childCostCents;
}

export function resolveFamily(
	parts: FamilyParts,
	resources: Resources,
	workload: number,
	turn: Turn,
	content: Content
): { parts: FamilyParts; resources: Resources; record: FamilyRecord } {
	const balance = content.balance.family;
	let { player, relationships } = parts;
	const { characters } = parts;
	const current = { ...resources };

	// Héritage : chaque parent lègue sa part au décès.
	const origin = content.origins[player.origin];
	const parentCount = Math.max(1, player.family.parentIds.length);
	let inheritance = 0;
	for (const id of player.family.parentIds) {
		const parent = characters[id];
		if (parent?.status === 'dead' && parent.leftTurn === turn) {
			inheritance += Math.floor((origin?.inheritanceCents ?? 0) / parentCount);
		}
	}
	current.personalCashCents += inheritance;

	// Veuvage.
	let widowed: string | null = null;
	const partnerId = player.family.partnerId;
	if (partnerId && characters[partnerId]?.status === 'dead') {
		widowed = partnerId;
		player = {
			...player,
			family: {
				...player.family,
				partnerId: null,
				formerPartnerIds: [...player.family.formerPartnerIds, partnerId]
			}
		};
	}

	// Enfants à charge.
	const cost = Math.min(
		current.personalCashCents,
		dependantsCostCents(player, characters, turn, content)
	);
	current.personalCashCents -= cost;

	// Famille délaissée.
	const neglected =
		workload >= balance.neglectThreshold && closeFamily(player, characters).length > 0;
	if (neglected) {
		relationships = shiftFamily(
			{ player, characters, relationships },
			balance.neglectAttitude,
			turn,
			content
		);
	}

	// Le partenaire apaise ou stresse.
	let stress = 0;
	const partnerAttitude = player.family.partnerId
		? (relationships[player.family.partnerId]?.attitude ?? 0)
		: null;
	if (partnerAttitude !== null) {
		const delta =
			partnerAttitude >= balance.supportiveAttitude
				? -balance.partnerStress
				: partnerAttitude <= balance.hostileAttitude
					? balance.partnerStress
					: 0;
		const next = Math.min(GAUGE_MAX, Math.max(GAUGE_MIN, player.stress + delta));
		stress = next - player.stress;
		player = { ...player, stress: next };
	}

	return {
		parts: { player, characters, relationships },
		resources: current,
		// `0 - cost` : jamais de -0, qui ne survivrait pas à une sauvegarde JSON.
		record: { inheritance, childCosts: 0 - cost, stress, neglected, widowed }
	};
}
