import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
	DEFAULT_CONTENT_DIR,
	validateContentDirectory,
	validateGameContent
} from '../../scripts/validate-content.ts';
import {
	fixtureActions,
	fixtureBalance,
	fixtureCast,
	fixtureEvents,
	fixtureUpgrades
} from '../fixtures/content.ts';

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

	it('valide le catalogue réel du jeu', () => {
		const report = validateGameContent(DEFAULT_CONTENT_DIR);
		expect(report.issues).toEqual([]);
		expect(report.files).toEqual(
			expect.arrayContaining(['actions.json', 'upgrades.json', 'balance.json', 'cast.json'])
		);
	});

	it('signale un catalogue obligatoire manquant', () => {
		const dir = makeTempDir();
		writeFileSync(join(dir, 'balance.json'), JSON.stringify(fixtureBalance));
		expect(validateGameContent(dir).issues).toEqual([
			{ file: 'actions.json', message: 'catalogue obligatoire manquant' },
			{ file: 'upgrades.json', message: 'catalogue obligatoire manquant' },
			{ file: 'cast.json', message: 'catalogue obligatoire manquant' }
		]);
	});

	it('applique la validation complète, pas seulement la syntaxe', () => {
		const dir = makeTempDir();
		const broken = structuredClone(fixtureActions);
		const first = broken.actions[0];
		if (first) first.timeCost = 500;
		writeFileSync(join(dir, 'actions.json'), JSON.stringify(broken));
		writeFileSync(join(dir, 'balance.json'), JSON.stringify(fixtureBalance));
		writeFileSync(join(dir, 'upgrades.json'), JSON.stringify(fixtureUpgrades));
		writeFileSync(join(dir, 'cast.json'), JSON.stringify(fixtureCast));
		mkdirSync(join(dir, 'events'));
		for (const [file, catalog] of Object.entries(fixtureEvents)) {
			writeFileSync(join(dir, file), JSON.stringify(catalog));
		}
		const report = validateGameContent(dir);
		expect(report.issues).toHaveLength(1);
		expect(report.issues[0]?.message).toContain('actions[0].timeCost');
	});
});
