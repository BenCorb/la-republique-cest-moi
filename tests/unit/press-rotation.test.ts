import { describe, expect, it } from 'vitest';
import { quarterHeadlines } from '../../src/lib/components/shell/press-rotation.ts';
import type { PressItemView } from '../../src/lib/game/app/view-model.ts';

const item = (key: string, dateLabel: string, aboutPlayer: boolean, critical = false) =>
	({
		key,
		dateLabel,
		media: 'Média',
		title: key,
		aboutPlayer,
		toneLabel: null,
		critical,
		effects: ''
	}) satisfies PressItemView;

/** Fil tournant de l'en-tête (P3-13). */
describe('titres du trimestre', () => {
	it('ne garde que le dernier trimestre publié, critique et personnel d’abord', () => {
		const press = [
			item('ambiance', 'T3 2001', false),
			item('flatteur', 'T3 2001', true),
			item('critique', 'T3 2001', true, true),
			item('ancien', 'T2 2001', true, true)
		];
		expect(quarterHeadlines(press).map((entry) => entry.key)).toEqual([
			'critique',
			'flatteur',
			'ambiance'
		]);
	});

	it('reste vide sans article', () => {
		expect(quarterHeadlines([])).toEqual([]);
	});
});
