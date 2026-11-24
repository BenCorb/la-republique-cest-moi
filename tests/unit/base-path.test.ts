import { describe, expect, it } from 'vitest';
import { normalizeBasePath } from '../../scripts/base-path.ts';

describe('normalizeBasePath', () => {
	it.each([
		[undefined, ''],
		['', ''],
		['/', ''],
		['  ', ''],
		['/la-republique-cest-moi', '/la-republique-cest-moi'],
		['la-republique-cest-moi', '/la-republique-cest-moi'],
		['/la-republique-cest-moi/', '/la-republique-cest-moi'],
		['//jeux//republique/', '/jeux/republique'],
		['/repo.v2_test~x', '/repo.v2_test~x']
	])('normalise %j en %j', (input, expected) => {
		expect(normalizeBasePath(input)).toBe(expected);
	});

	it.each([
		'/../secret',
		'/./x',
		'/avec espace',
		'/accentué',
		'/a?b',
		'/a#b',
		'https://exemple.fr'
	])('rejette %j', (input) => {
		expect(() => normalizeBasePath(input)).toThrow(/BASE_PATH invalide/);
	});
});
