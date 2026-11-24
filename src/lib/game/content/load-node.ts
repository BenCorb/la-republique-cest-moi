/**
 * Chargeur de contenu réservé aux outils Node.
 *
 * Le jeu utilise `load.ts` et `import.meta.glob`, transformé par Vite. Les scripts
 * Node lisent les mêmes fichiers explicitement avant d'appliquer exactement la
 * même validation et la même indexation.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Content } from './types.ts';
import { validateContent } from './validate.ts';

export const DEFAULT_CONTENT_DATA_DIR = resolve(import.meta.dirname, 'data');

export function loadContentFromFiles(directory = DEFAULT_CONTENT_DATA_DIR): Content {
	const read = (file: string): unknown => JSON.parse(readFileSync(join(directory, file), 'utf8'));
	const events: Record<string, unknown> = {};
	for (const file of readdirSync(join(directory, 'events')).sort()) {
		if (file.endsWith('.json')) events[`events/${file}`] = read(join('events', file));
	}
	const result = validateContent({
		actions: read('actions.json'),
		upgrades: read('upgrades.json'),
		balance: read('balance.json'),
		cast: read('cast.json'),
		events
	});
	if (!result.ok) {
		const details = result.issues
			.map((issue) => `${issue.source} ${issue.path} : ${issue.message}`)
			.join('\n- ');
		throw new Error(`Catalogue de contenu invalide :\n- ${details}`);
	}
	return result.content;
}
