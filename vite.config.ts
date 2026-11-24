import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { normalizeBasePath } from './scripts/base-path.ts';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Mode runes imposé au projet (hors dépendances). Retirable avec Svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// Site entièrement statique : toutes les pages sont prérendues dans `build/`,
			// aucune page de repli ni serveur Node en production (ARCHITECTURE.md §12).
			adapter: adapter({ pages: 'build', assets: 'build', strict: true }),
			paths: {
				// '' à la racine d'un domaine, '/depot' pour un site de projet GitHub Pages.
				base: normalizeBasePath(process.env.BASE_PATH),
				// Ressources référencées en chemins relatifs dans le HTML prérendu.
				relative: true
			}
		})
	],
	test: {
		expect: { requireAssertions: true },
		environment: 'node',
		include: ['tests/unit/**/*.test.ts', 'tests/scenarios/**/*.test.ts']
	}
});
