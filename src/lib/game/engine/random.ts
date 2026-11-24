/**
 * Générateur pseudo-aléatoire seedé et sérialisable (ARCHITECTURE.md §6).
 *
 * - Algorithme : Mulberry32, état entier non signé sur 32 bits.
 * - Seed → état initial : hachage FNV-1a 32 bits des octets UTF-8 de la seed.
 * - Fonctions pures : chaque tirage renvoie la valeur et le nouvel état ; l'état
 *   d'entrée n'est jamais modifié. Aucune autre source d'aléa n'est autorisée
 *   dans le moteur.
 *
 * Toute modification de ces conventions change les parties reproduites : elle
 * impose une nouvelle version de règles. Des vecteurs de référence la protègent.
 */

/** Identifiant de l'algorithme, sérialisé avec l'état. */
export const RNG_ALGORITHM = 'mulberry32';

export interface RngState {
	/** Seed d'origine de la partie, conservée pour l'affichage et la reproduction. */
	readonly seed: string;
	readonly algorithm: typeof RNG_ALGORITHM;
	/** État courant, entier dans [0, 2^32). */
	readonly state: number;
}

export interface Draw<T> {
	readonly value: T;
	readonly rng: RngState;
}

const UINT32_RANGE = 2 ** 32;
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export const SEED_MAX_LENGTH = 64;

/** Seed acceptée : 1 à 64 caractères imprimables, sans espace en bordure. */
export function validateSeed(seed: string): string | null {
	if (seed.length === 0) return 'La seed ne peut pas être vide.';
	if (seed.length > SEED_MAX_LENGTH) {
		return `La seed ne peut pas dépasser ${SEED_MAX_LENGTH} caractères.`;
	}
	if (seed.trim() !== seed) return 'La seed ne peut pas commencer ou finir par un espace.';
	// eslint-disable-next-line no-control-regex
	if (/[\u0000-\u001f\u007f]/.test(seed)) {
		return 'La seed ne peut pas contenir de caractère de contrôle.';
	}
	return null;
}

const utf8 = new TextEncoder();

/** FNV-1a 32 bits sur les octets UTF-8 de la seed. */
export function hashSeed(seed: string): number {
	let hash = FNV_OFFSET_BASIS;
	for (const byte of utf8.encode(seed)) {
		hash ^= byte;
		hash = Math.imul(hash, FNV_PRIME) >>> 0;
	}
	return hash;
}

export function createRng(seed: string): RngState {
	const error = validateSeed(seed);
	if (error) throw new RangeError(error);
	return { seed, algorithm: RNG_ALGORITHM, state: hashSeed(seed) };
}

/** Entier non signé uniforme dans [0, 2^32). */
export function nextUint32(rng: RngState): Draw<number> {
	const state = (rng.state + 0x6d2b79f5) >>> 0;
	let t = state;
	t = Math.imul(t ^ (t >>> 15), t | 1);
	t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
	const value = (t ^ (t >>> 14)) >>> 0;
	return { value, rng: { ...rng, state } };
}

/** Flottant uniforme dans [0, 1). */
export function nextFloat(rng: RngState): Draw<number> {
	const draw = nextUint32(rng);
	return { value: draw.value / UINT32_RANGE, rng: draw.rng };
}

/**
 * Entier uniforme dans [min, max] (bornes incluses). Biais de troncature
 * négligeable (< 2^-32 par valeur) pour les petits intervalles du jeu.
 */
export function nextInt(rng: RngState, min: number, max: number): Draw<number> {
	if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min) {
		throw new RangeError(`Intervalle invalide : [${min}, ${max}]`);
	}
	const span = max - min + 1;
	if (span > UINT32_RANGE) throw new RangeError('Intervalle trop large pour 32 bits.');
	const draw = nextFloat(rng);
	return { value: min + Math.floor(draw.value * span), rng: draw.rng };
}
