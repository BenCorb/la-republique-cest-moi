/**
 * Validation des catalogues de contenu (`npm run content:validate`).
 *
 * 1. Chaque fichier `.json` du répertoire de données doit être du JSON valide.
 * 2. Les catalogues (`actions.json`, `upgrades.json`, `balance.json`, `cast.json` et
 *    `events/*.json`) passent la validation complète du jeu : schémas et contrôles
 *    croisés (`content/validate.ts`).
 *
 * Exécuté directement par Node (suppression native des types TypeScript).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { validateContent } from '../src/lib/game/content/validate.ts';

export const DEFAULT_CONTENT_DIR = resolve(import.meta.dirname, '../src/lib/game/content/data');

/** Catalogues obligatoires, validés par le moteur de contenu. */
export const REQUIRED_CATALOGS = [
	'actions.json',
	'upgrades.json',
	'balance.json',
	'cast.json',
	'world.json',
	'traits.json',
	'career.json',
	'supports.json',
	'entourage.json',
	'profiles.json',
	'justice.json',
	'wealth.json',
	'promises.json'
] as const;

/** Répertoire des catalogues d'événements, relatif au répertoire de données. */
export const EVENTS_DIR = 'events';

export interface ContentIssue {
	file: string;
	message: string;
}

export interface ContentReport {
	directoryExists: boolean;
	files: string[];
	issues: ContentIssue[];
}

function listJsonFiles(dir: string): string[] {
	const found: string[] = [];
	for (const entry of readdirSync(dir).sort()) {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) {
			found.push(...listJsonFiles(path));
		} else if (entry.endsWith('.json')) {
			found.push(path);
		}
	}
	return found;
}

/** Vérifie uniquement la syntaxe JSON de tous les fichiers du répertoire. */
export function validateContentDirectory(dir: string): ContentReport {
	if (!existsSync(dir)) {
		return { directoryExists: false, files: [], issues: [] };
	}
	const files = listJsonFiles(dir);
	const issues: ContentIssue[] = [];
	for (const file of files) {
		const name = relative(dir, file);
		try {
			JSON.parse(readFileSync(file, 'utf8'));
		} catch (error) {
			issues.push({
				file: name,
				message: error instanceof Error ? error.message : String(error)
			});
		}
	}
	return { directoryExists: true, files: files.map((file) => relative(dir, file)), issues };
}

/** Syntaxe JSON, présence des catalogues obligatoires puis validation complète. */
export function validateGameContent(dir: string): ContentReport {
	const report = validateContentDirectory(dir);
	if (!report.directoryExists || report.issues.length > 0) return report;

	const missing = REQUIRED_CATALOGS.filter((name) => !report.files.includes(name));
	if (missing.length > 0) {
		return {
			...report,
			issues: missing.map((file) => ({ file, message: 'catalogue obligatoire manquant' }))
		};
	}

	const read = (name: string): unknown => JSON.parse(readFileSync(join(dir, name), 'utf8'));
	const events: Record<string, unknown> = {};
	for (const file of report.files) {
		if (file.startsWith(`${EVENTS_DIR}/`) || file.startsWith(`${EVENTS_DIR}\\`)) {
			events[file.split(/[\\/]/).join('/')] = read(file);
		}
	}
	const result = validateContent({
		actions: read('actions.json'),
		upgrades: read('upgrades.json'),
		balance: read('balance.json'),
		cast: read('cast.json'),
		world: read('world.json'),
		traits: read('traits.json'),
		career: read('career.json'),
		supports: read('supports.json'),
		entourage: read('entourage.json'),
		profiles: read('profiles.json'),
		justice: read('justice.json'),
		wealth: read('wealth.json'),
		promises: read('promises.json'),
		events
	});
	if (result.ok) return report;
	return {
		...report,
		issues: result.issues.map((issue) => ({
			file: issue.source,
			message: `${issue.path || '(racine)'} : ${issue.message}`
		}))
	};
}

function main(): void {
	const dir = DEFAULT_CONTENT_DIR;
	const report = validateGameContent(dir);
	const shownDir = relative(process.cwd(), dir) || '.';

	if (!report.directoryExists) {
		console.error(`Répertoire de contenu introuvable : ${shownDir}.`);
		process.exitCode = 1;
		return;
	}
	for (const issue of report.issues) {
		console.error(`✗ ${issue.file} : ${issue.message}`);
	}
	if (report.issues.length > 0) {
		console.error(`${report.issues.length} problème(s) de contenu.`);
		process.exitCode = 1;
		return;
	}
	console.log(`${report.files.length} fichier(s) de contenu valide(s) dans ${shownDir}.`);
}

if (import.meta.main) {
	main();
}
