import { describe, expect, it } from 'vitest';
import {
	createRng,
	hashSeed,
	nextFloat,
	nextInt,
	nextUint32,
	validateSeed,
	type RngState
} from '../../src/lib/game/engine/random.ts';

function rngAt(state: number): RngState {
	return { seed: 'test', algorithm: 'mulberry32', state };
}

function drawUint32(rng: RngState, count: number): number[] {
	const values: number[] = [];
	let current = rng;
	for (let index = 0; index < count; index += 1) {
		const draw = nextUint32(current);
		values.push(draw.value);
		current = draw.rng;
	}
	return values;
}

describe('seed → état (FNV-1a 32 bits, UTF-8)', () => {
	it.each([
		['', 0x811c9dc5],
		['a', 0xe40c292c],
		['foobar', 0xbf9cf968],
		['42', 0x87e38583],
		['république', 0x85bc4810]
	])('hashSeed(%j) = vecteur de référence', (seed, expected) => {
		expect(hashSeed(seed)).toBe(expected);
	});

	it('crée un état sérialisable à partir de la seed', () => {
		expect(createRng('42')).toEqual({ seed: '42', algorithm: 'mulberry32', state: 0x87e38583 });
	});

	it.each([
		['', 'vide'],
		['x'.repeat(65), 'dépasser'],
		[' 42', 'espace'],
		['4\n2', 'contrôle']
	])('refuse la seed %j', (seed, fragment) => {
		expect(validateSeed(seed)).toContain(fragment);
		expect(() => createRng(seed)).toThrow(RangeError);
	});
});

describe('Mulberry32', () => {
	it.each([
		[0, [1144304738, 1416247, 958946056, 627933444, 2007157716]],
		[1, [2693262067, 11749833, 2265367787, 4213581821, 4159151403]],
		[0xdeadbeef, [4043151706, 1147597007, 3315858022, 1538288752, 2042435954]]
	])('reproduit les vecteurs de référence depuis l’état %i', (state, expected) => {
		expect(drawUint32(rngAt(state), 5)).toEqual(expected);
	});

	it('enchaîne seed et tirages de façon reproductible', () => {
		expect(drawUint32(createRng('42'), 3)).toEqual([1321692771, 1578880846, 993578597]);
	});

	it('ne modifie jamais l’état d’entrée', () => {
		const rng = Object.freeze(createRng('immuable'));
		const first = nextUint32(rng);
		const again = nextUint32(rng);
		expect(again).toEqual(first);
		expect(first.rng).not.toBe(rng);
		expect(rng.state).toBe(hashSeed('immuable'));
	});

	it('reste un entier 32 bits non signé au passage de 2^32', () => {
		const draw = nextUint32(rngAt(0xffffffff));
		expect(draw.rng.state).toBe((0xffffffff + 0x6d2b79f5) % 2 ** 32);
		expect(Number.isInteger(draw.value)).toBe(true);
		expect(draw.value).toBeGreaterThanOrEqual(0);
		expect(draw.value).toBeLessThan(2 ** 32);
	});
});

describe('tirages dérivés', () => {
	it('nextFloat reste dans [0, 1)', () => {
		let rng = createRng('flottants');
		for (let index = 0; index < 1000; index += 1) {
			const draw = nextFloat(rng);
			expect(draw.value).toBeGreaterThanOrEqual(0);
			expect(draw.value).toBeLessThan(1);
			rng = draw.rng;
		}
	});

	it('nextInt couvre exactement l’intervalle inclusif', () => {
		let rng = createRng('dés');
		const seen = new Set<number>();
		for (let index = 0; index < 600; index += 1) {
			const draw = nextInt(rng, 1, 6);
			seen.add(draw.value);
			rng = draw.rng;
		}
		expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
		expect(nextInt(rng, 7, 7).value).toBe(7);
	});

	it('nextInt refuse un intervalle invalide', () => {
		const rng = createRng('erreurs');
		expect(() => nextInt(rng, 3, 2)).toThrow(RangeError);
		expect(() => nextInt(rng, 0, 1.5)).toThrow(RangeError);
		expect(() => nextInt(rng, 0, 2 ** 33)).toThrow(RangeError);
	});
});
