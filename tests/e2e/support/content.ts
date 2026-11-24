/**
 * Contenu réel chargé depuis les fichiers (sans `import.meta.glob`, propre à Vite),
 * pour fabriquer des sauvegardes de test côté Node.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { validateContent } from '../../../src/lib/game/content/validate.ts';
import type { Content } from '../../../src/lib/game/content/types.ts';

const DATA = resolve(import.meta.dirname, '../../../src/lib/game/content/data');
const read = (file: string): unknown => JSON.parse(readFileSync(join(DATA, file), 'utf8'));

export function loadContentFromFiles(): Content {
	const events: Record<string, unknown> = {};
	for (const file of readdirSync(join(DATA, 'events')).sort()) {
		events[`events/${file}`] = read(join('events', file));
	}
	const result = validateContent({
		actions: read('actions.json'),
		upgrades: read('upgrades.json'),
		balance: read('balance.json'),
		cast: read('cast.json'),
		events
	});
	if (!result.ok) throw new Error(JSON.stringify(result.issues));
	return result.content;
}
