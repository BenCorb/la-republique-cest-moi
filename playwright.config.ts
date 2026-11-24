import { defineConfig, devices } from '@playwright/test';
import { normalizeBasePath } from './scripts/base-path.ts';

const PORT = 4174;
// Même valeur au build et au service : permet de tester un hébergement en
// sous-répertoire (GitHub Pages de projet) avec `BASE_PATH=/depot`.
const BASE_PATH = normalizeBasePath(process.env.BASE_PATH);

// Les tests navigateur s'exécutent contre le build statique (`build/`) servi par un
// simple serveur de fichiers : aucun serveur SvelteKit/Node applicatif n'intervient.
// Dans les tests, naviguer avec des URL relatives (`./`) pour conserver le base path.
export default defineConfig({
	testDir: 'tests/e2e',
	testMatch: '**/*.e2e.ts',
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: `http://127.0.0.1:${PORT}${BASE_PATH}/`,
		trace: 'retain-on-failure'
	},
	webServer: {
		command: `npm run build && npm run serve:static -- --port ${PORT}`,
		url: `http://127.0.0.1:${PORT}${BASE_PATH}/`,
		// Toujours reconstruire : un serveur déjà lancé pourrait servir un autre base path.
		reuseExistingServer: false,
		timeout: 120_000
	},
	projects: [
		{
			name: 'desktop-1440',
			use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }
		},
		{
			name: 'desktop-1280',
			use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } }
		}
	]
});
