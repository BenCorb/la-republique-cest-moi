/**
 * Carnet des carrières (P3-41) : archive locale des carrières terminées, dans
 * une clé distincte de la sauvegarde. Affichage seul : aucun bonus, aucun
 * déblocage. Lectures et écritures protégées : sans stockage, le carnet est vide.
 */
import type { LogbookEntry } from './view-model.ts';

const LOGBOOK_KEY = 'la-republique-cest-moi:carnet';
/** Nombre de fiches conservées au plus (les plus récentes). */
export const LOGBOOK_LIMIT = 50;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function storage(): StorageLike | null {
	try {
		return globalThis.localStorage ?? null;
	} catch {
		return null;
	}
}

function isEntry(value: unknown): value is LogbookEntry {
	if (typeof value !== 'object' || value === null) return false;
	const entry = value as Record<string, unknown>;
	return (
		typeof entry['id'] === 'string' &&
		typeof entry['seed'] === 'string' &&
		typeof entry['headline'] === 'string' &&
		Array.isArray(entry['distinctions'])
	);
}

/** Fiches du carnet, de la plus récente à la plus ancienne ; vide si illisible. */
export function readLogbook(store: StorageLike | null = storage()): LogbookEntry[] {
	try {
		const raw = store?.getItem(LOGBOOK_KEY);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
	} catch {
		return [];
	}
}

/** Archive une carrière terminée, une seule fois ; rend le carnet à jour. */
export function addToLogbook(
	entry: LogbookEntry,
	store: StorageLike | null = storage()
): LogbookEntry[] {
	const current = readLogbook(store);
	if (current.some((existing) => existing.id === entry.id)) return current;
	const next = [entry, ...current].slice(0, LOGBOOK_LIMIT);
	try {
		store?.setItem(LOGBOOK_KEY, JSON.stringify(next));
	} catch {
		// Stockage plein ou refusé : le carnet reste tel quel.
		return current;
	}
	return next;
}

/** Retire une fiche, ou tout le carnet sans identifiant. */
export function removeFromLogbook(
	id: string | null,
	store: StorageLike | null = storage()
): LogbookEntry[] {
	const next = id === null ? [] : readLogbook(store).filter((entry) => entry.id !== id);
	try {
		if (next.length === 0) store?.removeItem(LOGBOOK_KEY);
		else store?.setItem(LOGBOOK_KEY, JSON.stringify(next));
	} catch {
		return readLogbook(store);
	}
	return next;
}

/** Distinctions obtenues au moins une fois, avec le nombre de carrières. */
export function logbookDistinctions(
	entries: readonly LogbookEntry[]
): { readonly id: string; readonly label: string; readonly count: number }[] {
	const counts = new Map<string, { label: string; count: number }>();
	for (const entry of entries) {
		for (const distinction of entry.distinctions) {
			const previous = counts.get(distinction.id);
			counts.set(distinction.id, {
				label: distinction.label,
				count: (previous?.count ?? 0) + 1
			});
		}
	}
	return [...counts.entries()].map(([id, value]) => ({ id, ...value }));
}
