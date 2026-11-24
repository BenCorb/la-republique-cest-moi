import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RULES_VERSION } from '../../src/lib/game/engine/index.ts';

const ENGINE_DIR = resolve(import.meta.dirname, '../../src/lib/game/engine');

function listSourceFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) return listSourceFiles(path);
		return entry.endsWith('.ts') ? [path] : [];
	});
}

/** Retire les commentaires pour ne contrôler que le code exécutable. */
function stripComments(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// Frontières du moteur pur (AGENTS.md, ARCHITECTURE.md §2 et §6).
const FORBIDDEN_PATTERNS: Array<[string, RegExp]> = [
	['import Svelte', /from\s+['"]svelte(\/[^'"]*)?['"]/],
	['import SvelteKit ($app)', /from\s+['"]\$app\//],
	['import interface/application', /from\s+['"][^'"]*(components|\/app\/|persistence)[^'"]*['"]/],
	['Math.random()', /Math\.random\s*\(/],
	['Date.now()', /Date\.now\s*\(/],
	['new Date()', /new\s+Date\s*\(/],
	['performance.now()', /performance\.now\s*\(/],
	['crypto aléatoire', /crypto\.(getRandomValues|randomUUID)/],
	['eval / Function', /\beval\s*\(|new\s+Function\s*\(/],
	['stockage navigateur', /\b(localStorage|sessionStorage|indexedDB)\b/],
	['DOM / fenêtre', /\b(window|document|navigator)\s*\./],
	['réseau', /\bfetch\s*\(|XMLHttpRequest|WebSocket/]
];

describe('moteur — démarrage', () => {
	it('se charge dans Node sans navigateur et expose une version de règles', () => {
		expect(RULES_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
	});
});

describe('moteur — frontières', () => {
	const files = listSourceFiles(ENGINE_DIR);

	it('contient au moins le point d’entrée public', () => {
		expect(files.map((file) => relative(ENGINE_DIR, file))).toContain('index.ts');
	});

	it.each(files.map((file) => [relative(ENGINE_DIR, file), file]))(
		'%s ne dépend ni de l’interface, ni du navigateur, ni du hasard ou de l’horloge réels',
		(_name, file) => {
			const code = stripComments(readFileSync(file, 'utf8'));
			const violations = FORBIDDEN_PATTERNS.filter(([, pattern]) => pattern.test(code)).map(
				([label]) => label
			);
			expect(violations).toEqual([]);
		}
	);
});
