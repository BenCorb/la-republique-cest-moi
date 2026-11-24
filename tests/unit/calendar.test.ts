import { describe, expect, it } from 'vitest';
import {
	ageAt,
	formatTurn,
	quarterOf,
	turnOf,
	yearOf
} from '../../src/lib/game/engine/calendar.ts';

describe('calendrier trimestriel', () => {
	it('fait du tour 0 le premier trimestre 2000', () => {
		expect(formatTurn(0)).toBe('T1 2000');
		expect(yearOf(0)).toBe(2000);
		expect(quarterOf(0)).toBe(1);
	});

	it('enchaîne quatre trimestres par an', () => {
		expect([0, 1, 2, 3, 4].map(formatTurn)).toEqual([
			'T1 2000',
			'T2 2000',
			'T3 2000',
			'T4 2000',
			'T1 2001'
		]);
		expect(formatTurn(17)).toBe('T2 2004');
	});

	it('gère les trimestres antérieurs à 2000 (naissances)', () => {
		expect(formatTurn(-1)).toBe('T4 1999');
		expect(formatTurn(-4)).toBe('T1 1999');
		expect(formatTurn(-100)).toBe('T1 1975');
		expect(quarterOf(-3)).toBe(2);
	});

	it('convertit année et trimestre en tour, dans les deux sens', () => {
		for (let turn = -120; turn <= 400; turn += 1) {
			expect(turnOf(yearOf(turn), quarterOf(turn))).toBe(turn);
		}
		expect(turnOf(2004, 2)).toBe(17);
	});

	it('dérive l’âge de la naissance, anniversaire au trimestre de naissance', () => {
		const birth = turnOf(1975, 1);
		expect(ageAt(birth, 0)).toBe(25);
		expect(ageAt(birth, 3)).toBe(25);
		expect(ageAt(birth, 4)).toBe(26);
		expect(ageAt(turnOf(1975, 3), turnOf(2000, 2))).toBe(24);
		expect(ageAt(turnOf(1975, 3), turnOf(2000, 3))).toBe(25);
	});

	it('rejette les tours non entiers', () => {
		expect(() => yearOf(1.5)).toThrow(RangeError);
		expect(() => quarterOf(Number.NaN)).toThrow(RangeError);
		expect(() => ageAt(0, Infinity)).toThrow(RangeError);
	});
});
