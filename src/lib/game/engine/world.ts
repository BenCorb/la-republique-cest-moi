/**
 * Monde politique autonome (GDD §8, ARCHITECTURE.md §4.2 et §8.3 bis) — P2-01.
 *
 * - `createWorld` : paysage initial fixe (partis, indicateurs du catalogue) et
 *   dirigeants tirés au sort, seule part variable d'une partie à l'autre.
 * - `resolveWorld` : évolution autonome à la frontière T/T+1, dans un ordre fixe :
 *   indicateurs (ordre du registre), forces des partis (ordre du catalogue), puis
 *   directions des partis (retraite d'office, puis renouvellement aléatoire).
 * - `applyPoliticalEffect` : effets déclaratifs sur le monde et l'adhésion du
 *   joueur, déterministes (aucun tirage).
 *
 * Toutes les valeurs sont des entiers bornés ; le monde évolue même si le joueur
 * ne fait rien.
 */
import {
	GAUGE_MAX,
	GAUGE_MIN,
	INDICATOR_IDS,
	type Content,
	type Effect,
	type IndicatorId
} from '../content/types.ts';
import { TURNS_PER_YEAR, ageAt, type Turn } from './calendar.ts';
import { nextFloat, nextInt, type RngState } from './random.ts';
import type {
	Character,
	LeaderChange,
	PartyState,
	PlayerState,
	PoliticalChange,
	WorldRecord,
	WorldState
} from './state.ts';

/**
 * Identifiant du n-ième personnage créé. Les personnages ne sont jamais
 * supprimés : le suivant reçoit le rang `nombre de personnages + 1`, sans
 * compteur séparé et sans décaler les autres identifiants d'instance.
 */
export function characterId(number: number): string {
	return `character.${number}`;
}

/** Tirage avec une variation aléatoire symétrique ; aucun tirage si l'amplitude est nulle. */
function jitter(rng: RngState, amplitude: number): { value: number; rng: RngState } {
	if (amplitude <= 0) return { value: 0, rng };
	const draw = nextInt(rng, -amplitude, amplitude);
	return { value: draw.value, rng: draw.rng };
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

interface Generation {
	readonly character: Character;
	readonly rng: RngState;
}

/**
 * Génère un dirigeant fictif : prénom et nom tirés, sans homonyme parmi les
 * personnages existants (le nom suivant du catalogue est pris en cas de doublon).
 * Si toutes les combinaisons ont servi, seul un homonyme d'un dirigeant en place
 * est exclu (le catalogue garantit plus de combinaisons que de partis).
 */
function generateLeader(
	partyId: string,
	turn: Turn,
	characters: Readonly<Record<string, Character>>,
	activeLeaderIds: ReadonlySet<string>,
	rng: RngState,
	content: Content
): Generation {
	const { first, last } = content.world.names;
	const { leaderMinAge, leaderMaxAge } = content.balance.world;
	const firstDraw = nextInt(rng, 0, first.length - 1);
	const lastDraw = nextInt(firstDraw.rng, 0, last.length - 1);
	const ageDraw = nextInt(lastDraw.rng, leaderMinAge, leaderMaxAge);
	const quarterDraw = nextInt(ageDraw.rng, 0, TURNS_PER_YEAR - 1);
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
		[...activeLeaderIds].flatMap((id) => (characters[id] ? [characters[id].name] : []))
	);
	const name = pick(everyone) ?? pick(active);
	if (name === null) throw new Error('Plus aucun nom disponible pour un nouveau dirigeant.');
	const id = characterId(Object.keys(characters).length + 1);
	return {
		character: {
			id,
			name,
			birthTurn: turn - ageDraw.value * TURNS_PER_YEAR - quarterDraw.value,
			partyId
		},
		rng: quarterDraw.rng
	};
}

export interface WorldCreation {
	readonly world: WorldState;
	readonly characters: Readonly<Record<string, Character>>;
	readonly rng: RngState;
}

export function createWorld(rng: RngState, turn: Turn, content: Content): WorldCreation {
	const characters: Record<string, Character> = {};
	const parties: Record<string, PartyState> = {};
	let currentRng = rng;
	for (const partyId of content.partyIds) {
		const party = content.parties[partyId];
		if (!party) throw new Error(`Parti inconnu : ${partyId}`);
		const generated = generateLeader(
			partyId,
			turn,
			characters,
			new Set(Object.keys(characters)),
			currentRng,
			content
		);
		characters[generated.character.id] = generated.character;
		currentRng = generated.rng;
		parties[partyId] = { strength: party.baseStrength, leaderId: generated.character.id };
	}
	return {
		world: {
			indicators: { ...content.balance.world.startingIndicators },
			parties,
			governingPartyId: content.world.startingGoverningParty
		},
		characters,
		rng: currentRng
	};
}

/** Premier parti d'opposition : le plus fort hors gouvernement (ordre du catalogue en cas d'égalité). */
export function oppositionPartyId(world: WorldState, content: Content): string {
	let best: string | null = null;
	for (const partyId of content.partyIds) {
		if (partyId === world.governingPartyId) continue;
		const strength = world.parties[partyId]?.strength ?? 0;
		if (best === null || strength > (world.parties[best]?.strength ?? 0)) best = partyId;
	}
	if (best === null) throw new Error('Aucun parti d’opposition.');
	return best;
}

/** Résout une référence de parti d'un effet ; `null` si elle ne désigne aucun parti. */
export function resolvePartyReference(
	reference: string,
	player: PlayerState,
	world: WorldState,
	content: Content
): string | null {
	switch (reference) {
		case 'governing':
			return world.governingPartyId;
		case 'player':
			return player.partyId;
		case 'opposition':
			return oppositionPartyId(world, content);
		default:
			return Object.hasOwn(content.parties, reference) ? reference : null;
	}
}

export interface FrontierWorld {
	readonly world: WorldState;
	readonly characters: Readonly<Record<string, Character>>;
	readonly rng: RngState;
	readonly record: WorldRecord;
}

/** Évolution autonome du monde à la frontière, `turn` étant le nouveau trimestre (T+1). */
export function resolveWorld(
	world: WorldState,
	characters: Readonly<Record<string, Character>>,
	turn: Turn,
	rng: RngState,
	content: Content
): FrontierWorld {
	const balance = content.balance.world;
	let currentRng = rng;

	// 1. Indicateurs : retour partiel vers la référence et variation bornée.
	const indicators = { ...world.indicators };
	const indicatorChanges: { indicator: IndicatorId; delta: number }[] = [];
	for (const indicator of INDICATOR_IDS) {
		const value = indicators[indicator];
		const drift = jitter(currentRng, balance.indicatorVolatility);
		currentRng = drift.rng;
		const reversion = Math.round(
			((balance.indicatorBaseline - value) * balance.indicatorReversionPercent) / 100
		);
		const next = clamp(value + reversion + drift.value, GAUGE_MIN, GAUGE_MAX);
		indicators[indicator] = next;
		if (next !== value) indicatorChanges.push({ indicator, delta: next - value });
	}

	// 2. Forces : retour vers la référence, usure ou état de grâce du gouvernement.
	const mood =
		indicators.economy -
		balance.indicatorBaseline +
		(indicators.socialClimate - balance.indicatorBaseline);
	const parties: Record<string, PartyState> = { ...world.parties };
	const partyChanges: { partyId: string; delta: number }[] = [];
	for (const partyId of content.partyIds) {
		const party = parties[partyId];
		const definition = content.parties[partyId];
		if (!party || !definition) throw new Error(`Parti inconnu : ${partyId}`);
		const target =
			definition.baseStrength +
			(partyId === world.governingPartyId
				? Math.round(mood / balance.governingIndicatorDivisor)
				: 0);
		const drift = jitter(currentRng, balance.strengthVolatility);
		currentRng = drift.rng;
		const reversion = Math.round(
			((target - party.strength) * balance.strengthReversionPercent) / 100
		);
		const next = clamp(
			party.strength + reversion + drift.value,
			balance.minPartyStrength,
			balance.maxPartyStrength
		);
		parties[partyId] = { ...party, strength: next };
		if (next !== party.strength) partyChanges.push({ partyId, delta: next - party.strength });
	}

	// 3. Directions : retraite d'office, sinon renouvellement aléatoire.
	const updatedCharacters: Record<string, Character> = { ...characters };
	const leaderChanges: LeaderChange[] = [];
	for (const partyId of content.partyIds) {
		const party = parties[partyId];
		if (!party) continue;
		const leader = updatedCharacters[party.leaderId];
		if (!leader) throw new Error(`Dirigeant inconnu : ${party.leaderId}`);
		let reason: LeaderChange['reason'] | null =
			ageAt(leader.birthTurn, turn) >= balance.leaderRetirementAge ? 'retirement' : null;
		if (reason === null && balance.leaderChangeChance > 0) {
			const roll = nextFloat(currentRng);
			currentRng = roll.rng;
			if (roll.value < balance.leaderChangeChance) reason = 'internal_vote';
		}
		if (reason === null) continue;
		const activeLeaders = new Set(Object.values(parties).map((entry) => entry.leaderId));
		activeLeaders.delete(leader.id);
		const generated = generateLeader(
			partyId,
			turn,
			updatedCharacters,
			activeLeaders,
			currentRng,
			content
		);
		currentRng = generated.rng;
		updatedCharacters[generated.character.id] = generated.character;
		parties[partyId] = { ...party, leaderId: generated.character.id };
		leaderChanges.push({
			partyId,
			previousLeaderId: leader.id,
			leaderId: generated.character.id,
			reason
		});
	}

	return {
		world: { ...world, indicators, parties },
		characters: updatedCharacters,
		rng: currentRng,
		record: { indicators: indicatorChanges, parties: partyChanges, leaderChanges }
	};
}

export type PoliticalEffect = Extract<
	Effect,
	{ op: 'addIndicator' | 'addPartyStrength' | 'joinParty' | 'leaveParty' }
>;

export function isPoliticalEffect(effect: Effect): effect is PoliticalEffect {
	return (
		effect.op === 'addIndicator' ||
		effect.op === 'addPartyStrength' ||
		effect.op === 'joinParty' ||
		effect.op === 'leaveParty'
	);
}

export interface PoliticalOutcome {
	readonly player: PlayerState;
	readonly world: WorldState;
	readonly changes: readonly PoliticalChange[];
}

function leave(player: PlayerState, turn: Turn): { player: PlayerState; left: string | null } {
	if (player.partyId === null) return { player, left: null };
	const affiliations = player.affiliations.map((affiliation) =>
		affiliation.toTurn === null ? { ...affiliation, toTurn: turn } : affiliation
	);
	return { player: { ...player, partyId: null, affiliations }, left: player.partyId };
}

/**
 * Applique un effet politique. `target` est la cible choisie dans le plan pour
 * `joinParty` avec `target`. Adhérer au parti dont on est déjà membre ne change
 * rien ; adhérer à un autre parti fait d'abord quitter le parti actuel.
 */
export function applyPoliticalEffect(
	effect: PoliticalEffect,
	player: PlayerState,
	world: WorldState,
	turn: Turn,
	target: string | null,
	content: Content
): PoliticalOutcome {
	switch (effect.op) {
		case 'addIndicator': {
			const value = world.indicators[effect.indicator];
			const next = clamp(value + effect.value, GAUGE_MIN, GAUGE_MAX);
			if (next === value) return { player, world, changes: [] };
			return {
				player,
				world: { ...world, indicators: { ...world.indicators, [effect.indicator]: next } },
				changes: [{ kind: 'indicator', indicator: effect.indicator, delta: next - value }]
			};
		}
		case 'addPartyStrength': {
			const partyId = resolvePartyReference(effect.party, player, world, content);
			const party = partyId === null ? undefined : world.parties[partyId];
			if (partyId === null || !party) return { player, world, changes: [] };
			const { minPartyStrength, maxPartyStrength } = content.balance.world;
			const next = clamp(party.strength + effect.value, minPartyStrength, maxPartyStrength);
			if (next === party.strength) return { player, world, changes: [] };
			return {
				player,
				world: { ...world, parties: { ...world.parties, [partyId]: { ...party, strength: next } } },
				changes: [{ kind: 'partyStrength', partyId, delta: next - party.strength }]
			};
		}
		case 'joinParty': {
			const partyId = effect.party === 'target' ? target : effect.party;
			if (partyId === null || !Object.hasOwn(content.parties, partyId)) {
				throw new Error(`Adhésion à un parti inconnu : ${String(partyId)}`);
			}
			if (player.partyId === partyId) return { player, world, changes: [] };
			const changes: PoliticalChange[] = [];
			const left = leave(player, turn);
			if (left.left) changes.push({ kind: 'left', partyId: left.left });
			changes.push({ kind: 'joined', partyId });
			return {
				player: {
					...left.player,
					partyId,
					affiliations: [...left.player.affiliations, { partyId, fromTurn: turn, toTurn: null }]
				},
				world,
				changes
			};
		}
		case 'leaveParty': {
			const left = leave(player, turn);
			return {
				player: left.player,
				world,
				changes: left.left ? [{ kind: 'left', partyId: left.left }] : []
			};
		}
		default: {
			const unknown: never = effect;
			throw new Error(`Effet politique inconnu : ${JSON.stringify(unknown)}`);
		}
	}
}
