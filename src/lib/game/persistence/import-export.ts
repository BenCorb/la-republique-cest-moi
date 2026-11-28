/**
 * Export et import manuels de sauvegarde (ARCHITECTURE.md §10) : le fichier
 * exporté est l'enveloppe JSON elle-même ; l'import applique la même validation
 * stricte qu'un chargement (taille, format, version, schéma, invariants,
 * références au catalogue). Rien n'est écrit : l'interface décide ensuite.
 */
import type { Content } from '../content/types.ts';
import { quarterOf, yearOf } from '../engine/index.ts';
import { parseSaveText, type ReadOptions, type ReadResult, type SaveEnvelope } from './envelope.ts';

export interface ExportedSave {
	readonly fileName: string;
	readonly mimeType: 'application/json';
	readonly text: string;
}

export function exportSave(envelope: SaveEnvelope): ExportedSave {
	const { turn } = envelope.state;
	return {
		fileName: `la-republique-cest-moi-${yearOf(turn)}-T${quarterOf(turn)}.json`,
		mimeType: 'application/json',
		text: JSON.stringify(envelope, null, '\t')
	};
}

export function importSave(text: string, content: Content, options: ReadOptions = {}): ReadResult {
	return parseSaveText(text, content, options);
}

/**
 * Export d'une sauvegarde refusée (illisible, préversion, version précédente de
 * la beta), telle qu'elle est stockée, octet pour octet : le joueur la garde
 * avant de commencer une nouvelle partie (décision 0002). Rien n'est validé ni
 * corrigé.
 */
export function exportRawSave(text: string): ExportedSave {
	const version = /"saveVersion"\s*:\s*(\d{1,6})/u.exec(text)?.[1];
	return {
		fileName: `la-republique-cest-moi-sauvegarde-${version ? `v${version}` : 'illisible'}.json`,
		mimeType: 'application/json',
		text
	};
}
