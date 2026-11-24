/**
 * Export et import manuels de sauvegarde (ARCHITECTURE.md §10) : le fichier
 * exporté est l'enveloppe JSON elle-même ; l'import applique la même validation
 * stricte qu'un chargement (taille, format, version, schéma, invariants,
 * références au catalogue). Rien n'est écrit : l'interface décide ensuite.
 */
import type { Content } from '../content/types.ts';
import { quarterOf, yearOf } from '../engine/index.ts';
import { MIGRATIONS, type Migration } from './migrations.ts';
import { parseSaveText, type ReadResult, type SaveEnvelope } from './envelope.ts';

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

export function importSave(
	text: string,
	content: Content,
	migrations: Readonly<Record<number, Migration>> = MIGRATIONS
): ReadResult {
	return parseSaveText(text, content, migrations);
}
