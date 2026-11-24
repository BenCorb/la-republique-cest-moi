/**
 * Version du contenu : empreinte stable des catalogues validés.
 *
 * Calculée sur une sérialisation canonique (clés d'objets triées) puis hachée en
 * FNV-1a 32 bits sur les octets UTF-8. Toute modification d'un catalogue (texte
 * compris) change l'empreinte. Enregistrée dans les sauvegardes à titre
 * informatif : l'acceptation d'une sauvegarde repose sur ses références au
 * catalogue, pas sur cette valeur (ARCHITECTURE.md §10).
 */

/** JSON canonique : clés triées, sans espaces. */
export function canonicalJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
	if (value !== null && typeof value === 'object') {
		const entries = Object.entries(value as Record<string, unknown>)
			.filter(([, child]) => child !== undefined)
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
		return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`).join(',')}}`;
	}
	return JSON.stringify(value);
}

const encoder = new TextEncoder();

export function contentFingerprint(value: unknown): string {
	let hash = 0x811c9dc5;
	for (const byte of encoder.encode(canonicalJson(value))) {
		hash ^= byte;
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return `content-${hash.toString(16).padStart(8, '0')}`;
}
