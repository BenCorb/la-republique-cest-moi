/**
 * Personnages nommés (GDD §6, ARCHITECTURE.md §8.3 ter) — P2-04.
 *
 * - Modèle commun : distribution initiale, dirigeants de parti et successeurs
 *   générés partagent `Character` ; seuls quelques dizaines d'acteurs existent.
 * - Traits réels tirés à la création ; les traits publics sont connus d'emblée,
 *   les traits cachés se révèlent au fil des rencontres ou par un effet explicite.
 * - Vieillissement à chaque frontière : décès selon les tranches d'âge du modèle
 *   de santé, retraite des personnages professionnels, successeur généré pour
 *   reprendre leur fonction. Un personnage parti n'est plus jamais acteur.
 * - Relations orientées : attitude du personnage envers le joueur, modulée par
 *   ses traits, et souvenirs des actes importants, en nombre borné.
 * Tous les tirages passent par le PRNG de la partie, dans un ordre fixe
 * (identifiants triés).
 */
import { ATTITUDE_MAX, ATTITUDE_MIN, type ActorSlot, type Content } from '../content/types.ts';
import { TURNS_PER_YEAR, ageAt, type Turn } from './calendar.ts';
import { ageBandFor } from './health.ts';
import { nextFloat, nextInt, type RngState } from './random.ts';
import type { Character, CharactersRecord, Memory, PeopleChange, Relationship } from './state.ts';

/** Bornes de la compétence tirée pour un personnage ordinaire. */
export const COMPETENCE_MIN = 20;
export const COMPETENCE_MAX = 80;

export function characterId(number: number): string {
	return `character.${number}`;
}

/** Nom affiché : nom, puis fonction pour un successeur généré. */
export function displayName(character: Character): string {
	return character.epithet ? `${character.name}, ${character.epithet}` : character.name;
}

/** Identifiants triés : ordre stable de tous les traitements de personnages. */
export function sortedIds(characters: Readonly<Record<string, Character>>): string[] {
	return Object.keys(characters).sort();
}

/** Tire des traits distincts dans l'ordre du catalogue ; les traits publics sont aussitôt connus. */
function drawTraits(
	rng: RngState,
	content: Content
): { traits: string[]; knownTraits: string[]; rng: RngState } {
	const pool = [...content.traitIds];
	const traits: string[] = [];
	let current = rng;
	const count = Math.min(content.balance.characters.traitsPerCharacter, pool.length);
	for (let index = 0; index < count; index += 1) {
		const draw = nextInt(current, 0, pool.length - 1);
		current = draw.rng;
		const [trait] = pool.splice(draw.value, 1);
		if (trait !== undefined) traits.push(trait);
	}
	traits.sort();
	return {
		traits,
		knownTraits: traits.filter((trait) => content.traits[trait]?.hidden === false),
		rng: current
	};
}

export interface PersonSpec {
	readonly tags: readonly string[];
	readonly epithet: string | null;
	readonly renewal: string | null;
	readonly partyId: string | null;
	readonly minAge: number;
	readonly maxAge: number;
	readonly successorOf: string | null;
}

/**
 * Génère un personnage fictif : prénom et nom tirés, sans homonyme parmi les
 * personnages existants (le nom suivant est pris en cas de doublon). Si toutes
 * les combinaisons ont servi, seul un homonyme d'un personnage actif est exclu.
 */
export function generatePerson(
	spec: PersonSpec,
	turn: Turn,
	characters: Readonly<Record<string, Character>>,
	rng: RngState,
	content: Content
): { character: Character; rng: RngState } {
	const { first, last } = content.world.names;
	const firstDraw = nextInt(rng, 0, first.length - 1);
	const lastDraw = nextInt(firstDraw.rng, 0, last.length - 1);
	const ageDraw = nextInt(lastDraw.rng, spec.minAge, spec.maxAge);
	const quarterDraw = nextInt(ageDraw.rng, 0, TURNS_PER_YEAR - 1);
	const competenceDraw = nextInt(quarterDraw.rng, COMPETENCE_MIN, COMPETENCE_MAX);
	const total = first.length * last.length;
	const pick = (used: ReadonlySet<string>): string | null => {
		for (let offset = 0; offset < total; offset += 1) {
			const index = (firstDraw.value * last.length + lastDraw.value + offset) % total;
			const candidate = `${first[Math.floor(index / last.length)]} ${last[index % last.length]}`;
			if (!used.has(candidate)) return candidate;
		}
		return null;
	};
	const everyone = new Set(Object.values(characters).map((character) => character.name));
	const active = new Set(
		Object.values(characters)
			.filter((character) => character.status === 'active')
			.map((character) => character.name)
	);
	const name = pick(everyone) ?? pick(active);
	if (name === null) throw new Error('Plus aucun nom disponible pour un nouveau personnage.');
	const traits = drawTraits(competenceDraw.rng, content);
	return {
		character: {
			id: characterId(Object.keys(characters).length + 1),
			name,
			epithet: spec.epithet,
			competence: competenceDraw.value,
			birthTurn: turn - ageDraw.value * TURNS_PER_YEAR - quarterDraw.value,
			partyId: spec.partyId,
			tags: [...spec.tags],
			renewal: spec.renewal,
			traits: traits.traits,
			knownTraits: traits.knownTraits,
			status: 'active',
			leftTurn: null,
			successorOf: spec.successorOf
		},
		rng: traits.rng
	};
}

/** Place la distribution initiale dans l'état, avec ses âges et des traits tirés. */
export function createCast(
	existing: Readonly<Record<string, Character>>,
	rng: RngState,
	turn: Turn,
	content: Content
): { characters: Record<string, Character>; rng: RngState } {
	const characters: Record<string, Character> = { ...existing };
	let current = rng;
	for (const castId of content.castIds) {
		const member = content.cast[castId];
		if (!member) throw new Error(`Membre de la distribution inconnu : ${castId}`);
		const competence = nextInt(current, COMPETENCE_MIN, COMPETENCE_MAX);
		const traits = drawTraits(competence.rng, content);
		current = traits.rng;
		characters[castId] = {
			id: castId,
			name: member.name,
			epithet: null,
			competence: competence.value,
			birthTurn: turn - member.age * TURNS_PER_YEAR,
			partyId: null,
			tags: [...member.tags],
			renewal: member.renewal?.epithet ?? null,
			traits: traits.traits,
			knownTraits: traits.knownTraits,
			status: 'active',
			leftTurn: null,
			successorOf: null
		};
	}
	return { characters, rng: current };
}

export interface FrontierCharacters {
	readonly characters: Readonly<Record<string, Character>>;
	readonly rng: RngState;
	readonly record: CharactersRecord;
}

/**
 * Vieillissement à la frontière (`turn` = T+1) : chaque personnage actif, par
 * identifiant trié, peut mourir selon sa tranche d'âge ; un personnage
 * professionnel (avec `renewal`) part à la retraite à l'âge prévu. Les
 * successeurs sont ensuite générés, dans l'ordre des départs. Les dirigeants de
 * parti décédés sont remplacés par le monde (`world.ts`).
 */
export function resolveCharacters(
	characters: Readonly<Record<string, Character>>,
	turn: Turn,
	rng: RngState,
	content: Content
): FrontierCharacters {
	const updated: Record<string, Character> = { ...characters };
	const departures: { characterId: string; reason: 'death' | 'retirement' }[] = [];
	let current = rng;
	for (const id of sortedIds(characters)) {
		const character = updated[id];
		if (!character || character.status !== 'active') continue;
		const age = ageAt(character.birthTurn, turn);
		const band = ageBandFor(age, content.balance.wellbeing);
		let reason: 'death' | 'retirement' | null = null;
		if (band.mortalityChance > 0) {
			const roll = nextFloat(current);
			current = roll.rng;
			if (roll.value < band.mortalityChance) reason = 'death';
		}
		if (
			reason === null &&
			character.renewal !== null &&
			age >= content.balance.characters.retirementAge
		) {
			reason = 'retirement';
		}
		if (reason === null) continue;
		updated[id] = {
			...character,
			status: reason === 'death' ? 'dead' : 'retired',
			leftTurn: turn
		};
		departures.push({ characterId: id, reason });
	}

	const arrivals: { characterId: string; successorOf: string }[] = [];
	const { replacementMinAge, replacementMaxAge } = content.balance.characters;
	for (const departure of departures) {
		const leaving = updated[departure.characterId];
		if (!leaving || leaving.renewal === null) continue;
		const generated = generatePerson(
			{
				tags: leaving.tags,
				epithet: leaving.renewal,
				renewal: leaving.renewal,
				partyId: leaving.partyId,
				minAge: replacementMinAge,
				maxAge: replacementMaxAge,
				successorOf: leaving.id
			},
			turn,
			updated,
			current,
			content
		);
		current = generated.rng;
		updated[generated.character.id] = generated.character;
		arrivals.push({ characterId: generated.character.id, successorOf: leaving.id });
	}
	return { characters: updated, rng: current, record: { departures, arrivals } };
}

// ---------------------------------------------------------------------------
// Acteurs des événements
// ---------------------------------------------------------------------------

/** Le personnage peut-il tenir ce rôle ? Seuls les personnages actifs sont acteurs. */
export function fitsSlot(
	character: Character,
	slot: ActorSlot,
	relationships: Readonly<Record<string, Relationship>>
): boolean {
	if (character.status !== 'active') return false;
	if (!slot.tags.every((tag) => character.tags.includes(tag))) return false;
	if (slot.traits && !slot.traits.every((trait) => character.traits.includes(trait))) return false;
	const relationship = relationships[character.id];
	if (slot.met && !relationship) return false;
	const attitude = relationship?.attitude ?? 0;
	if (slot.minAttitude !== undefined && attitude < slot.minAttitude) return false;
	if (slot.maxAttitude !== undefined && attitude > slot.maxAttitude) return false;
	return true;
}

/**
 * Existe-t-il une distribution complète, chaque rôle tenu par un acteur
 * distinct ? Recherche avec retour arrière sur les candidats de chaque rôle.
 */
export function completeCastingExists(
	candidates: readonly (readonly string[])[],
	used: ReadonlySet<string> = new Set()
): boolean {
	const [first, ...rest] = candidates;
	if (first === undefined) return true;
	return first.some((id) => !used.has(id) && completeCastingExists(rest, new Set([...used, id])));
}

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

/** Première rencontre : crée la relation (attitude neutre) si elle n'existe pas. */
export function meet(
	relationships: Readonly<Record<string, Relationship>>,
	characterId: string,
	turn: Turn
): { relationships: Readonly<Record<string, Relationship>>; change: PeopleChange | null } {
	if (relationships[characterId]) return { relationships, change: null };
	return {
		relationships: {
			...relationships,
			[characterId]: { metTurn: turn, attitude: 0, memories: [] }
		},
		change: { kind: 'met', characterId }
	};
}

/** Variation d'attitude modulée par les traits réels du personnage. */
export function modulatedDelta(character: Character, value: number, content: Content): number {
	let delta = value;
	for (const traitId of character.traits) {
		const trait = content.traits[traitId];
		if (!trait) continue;
		const percent = value > 0 ? trait.positiveRelationPercent : trait.negativeRelationPercent;
		delta = (delta * percent) / 100;
	}
	return Math.round(delta);
}

/**
 * Change l'attitude d'un personnage (rencontré au besoin) et retient un
 * souvenir s'il est fourni. L'attitude reste dans [-100, 100] ; seuls les
 * `maxMemories` souvenirs les plus récents sont gardés.
 */
export function addRelation(
	relationships: Readonly<Record<string, Relationship>>,
	character: Character,
	value: number,
	memory: string | null,
	turn: Turn,
	content: Content
): { relationships: Readonly<Record<string, Relationship>>; changes: PeopleChange[] } {
	const met = meet(relationships, character.id, turn);
	const relationship = met.relationships[character.id]!;
	const next = Math.min(
		ATTITUDE_MAX,
		Math.max(ATTITUDE_MIN, relationship.attitude + modulatedDelta(character, value, content))
	);
	const memories: Memory[] = memory
		? [
				...relationship.memories,
				{ turn, text: memory, tone: value > 0 ? ('positive' as const) : ('negative' as const) }
			].slice(-content.balance.characters.maxMemories)
		: [...relationship.memories];
	const changes: PeopleChange[] = met.change ? [met.change] : [];
	if (next !== relationship.attitude) {
		changes.push({
			kind: 'relation',
			characterId: character.id,
			delta: next - relationship.attitude
		});
	}
	return {
		relationships: {
			...met.relationships,
			[character.id]: { ...relationship, attitude: next, memories }
		},
		changes
	};
}

/** Révèle au joueur tous les traits cachés d'un personnage. */
export function revealAll(character: Character): { character: Character; changes: PeopleChange[] } {
	const hidden = character.traits.filter((trait) => !character.knownTraits.includes(trait));
	if (hidden.length === 0) return { character, changes: [] };
	return {
		character: { ...character, knownTraits: [...character.traits] },
		changes: hidden.map((traitId) => ({ kind: 'revealed', characterId: character.id, traitId }))
	};
}

/** Rencontre lors d'une décision : chance de découvrir un trait caché encore inconnu. */
export function encounterReveal(
	character: Character,
	rng: RngState,
	content: Content
): { character: Character; rng: RngState; changes: PeopleChange[] } {
	const hidden = character.traits.filter((trait) => !character.knownTraits.includes(trait));
	const chance = content.balance.characters.revealChancePerEncounter;
	if (hidden.length === 0 || chance <= 0) return { character, rng, changes: [] };
	const roll = nextFloat(rng);
	if (roll.value >= chance) return { character, rng: roll.rng, changes: [] };
	const pick = nextInt(roll.rng, 0, hidden.length - 1);
	const traitId = hidden[pick.value]!;
	return {
		character: { ...character, knownTraits: [...character.knownTraits, traitId].sort() },
		rng: pick.rng,
		changes: [{ kind: 'revealed', characterId: character.id, traitId }]
	};
}
