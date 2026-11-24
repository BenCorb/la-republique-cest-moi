import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { validateContentDirectory } from '../../scripts/validate-content.ts';

const temporaryDirs: string[] = [];

function makeTempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), 'lrcm-content-'));
	temporaryDirs.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of temporaryDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('validation de contenu', () => {
	it('signale un répertoire de données absent sans erreur', () => {
		const report = validateContentDirectory(join(makeTempDir(), 'absent'));
		expect(report).toEqual({ directoryExists: false, files: [], issues: [] });
	});

	it('accepte des fichiers JSON valides, y compris dans les sous-dossiers', () => {
		const dir = makeTempDir();
		mkdirSync(join(dir, 'events'));
		writeFileSync(join(dir, 'actions.json'), '[]');
		writeFileSync(join(dir, 'events', 'personal.json'), '{"events": []}');
		writeFileSync(join(dir, 'notes.txt'), 'ignoré');

		const report = validateContentDirectory(dir);
		expect(report.issues).toEqual([]);
		expect(report.files).toEqual(['actions.json', join('events', 'personal.json')]);
	});

	it('rejette un fichier JSON mal formé', () => {
		const dir = makeTempDir();
		writeFileSync(join(dir, 'broken.json'), '{ "id": ');

		const report = validateContentDirectory(dir);
		expect(report.issues).toHaveLength(1);
		expect(report.issues[0]?.file).toBe('broken.json');
	});
});
