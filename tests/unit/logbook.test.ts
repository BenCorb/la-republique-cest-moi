import { describe, expect, it } from 'vitest';
import {
	LOGBOOK_LIMIT,
	addToLogbook,
	logbookDistinctions,
	readLogbook,
	removeFromLogbook
} from '../../src/lib/game/app/logbook.ts';
import type { LogbookEntry } from '../../src/lib/game/app/view-model.ts';

function memory() {
	const data = new Map<string, string>();
	return {
		getItem: (key: string) => data.get(key) ?? null,
		setItem: (key: string, value: string) => void data.set(key, value),
		removeItem: (key: string) => void data.delete(key),
		data
	};
}

const entry = (id: string, distinctions: string[] = []): LogbookEntry => ({
	id,
	seed: id.split('@')[0]!,
	headline: 'Une figure locale s’est éteinte',
	dates: 'T1 1975 – T4 2040 · 65 ans',
	cause: 'Mort naturelle.',
	office: 'Mairie',
	ambition: null,
	distinctions: distinctions.map((label) => ({ id: `distinction.${label}`, label }))
});

describe('carnet des carrières (P3-41)', () => {
	it('archive une carrière une seule fois, la plus récente en tête, et la retire sur demande', () => {
		const store = memory();
		expect(readLogbook(store)).toEqual([]);
		addToLogbook(entry('a@10', ['Intègre']), store);
		addToLogbook(entry('b@20', ['Intègre', 'Matignon']), store);
		const twice = addToLogbook(entry('a@10'), store);
		expect(twice.map((item) => item.id)).toEqual(['b@20', 'a@10']);
		expect(logbookDistinctions(twice)).toEqual([
			{ id: 'distinction.Intègre', label: 'Intègre', count: 2 },
			{ id: 'distinction.Matignon', label: 'Matignon', count: 1 }
		]);
		expect(removeFromLogbook('b@20', store).map((item) => item.id)).toEqual(['a@10']);
		expect(removeFromLogbook(null, store)).toEqual([]);
		expect(store.data.size).toBe(0);
	});

	it('reste vide et intact face à un contenu illisible, et se limite en taille', () => {
		const store = memory();
		store.setItem('la-republique-cest-moi:carnet', '{pas du json');
		expect(readLogbook(store)).toEqual([]);
		for (let index = 0; index < LOGBOOK_LIMIT + 5; index += 1) {
			addToLogbook(entry(`s${index}@${index}`), store);
		}
		expect(readLogbook(store)).toHaveLength(LOGBOOK_LIMIT);
		expect(readLogbook(null)).toEqual([]);
	});
});
