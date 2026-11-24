/**
 * Validation des catalogues de contenu JSON (`npm run content:validate`).
 *
 * Phase 0 : vérifie que chaque fichier `.json` du répertoire de données est lisible
 * et syntaxiquement valide. La validation par schémas et le contrôle des références
 * croisées seront ajoutés avec les premiers catalogues (P1-02, ARCHITECTURE.md §7).
 *
 * Exécuté directement par Node (suppression native des types TypeScript).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

export const DEFAULT_CONTENT_DIR = resolve(import.meta.dirname, '../src/lib/game/content/data');

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

function main(): void {
	const dir = DEFAULT_CONTENT_DIR;
	const report = validateContentDirectory(dir);
	const shownDir = relative(process.cwd(), dir) || '.';

	if (!report.directoryExists) {
		console.log(`Aucun catalogue de contenu à valider : ${shownDir} n'existe pas encore.`);
		return;
	}
	for (const issue of report.issues) {
		console.error(`✗ ${issue.file} : ${issue.message}`);
	}
	if (report.issues.length > 0) {
		console.error(`${report.issues.length} fichier(s) de contenu invalide(s).`);
		process.exitCode = 1;
		return;
	}
	console.log(`${report.files.length} fichier(s) de contenu valide(s) dans ${shownDir}.`);
}

if (import.meta.main) {
	main();
}
