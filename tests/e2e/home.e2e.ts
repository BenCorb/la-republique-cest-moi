import { expect, test } from '@playwright/test';

test.describe('coque d’accueil (build statique)', () => {
	test('affiche le titre du jeu sans erreur console', async ({ page }) => {
		const errors: string[] = [];
		page.on('console', (message) => {
			if (message.type() === 'error') errors.push(message.text());
		});
		page.on('pageerror', (error) => errors.push(error.message));

		await page.goto('./');
		await expect(page).toHaveTitle('La République, c’est moi !');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('La République, c’est moi !');
		await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
		expect(errors).toEqual([]);
	});

	test('tient dans la fenêtre sans défilement horizontal', { tag: '@layout' }, async ({ page }) => {
		await page.goto('./');
		await expect(page.getByRole('heading', { name: 'Votre carrière politique' })).toBeVisible();
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow).toBeLessThanOrEqual(0);
		await expect(page.getByRole('banner')).toBeInViewport();
		await expect(page.getByRole('contentinfo')).toBeInViewport();
	});

	test('se parcourt au clavier jusqu’au lancement d’une carrière', async ({ page }) => {
		await page.goto('./');
		await expect(page.getByRole('heading', { name: 'Votre carrière politique' })).toBeVisible();

		await page.keyboard.press('Tab');
		const skipLink = page.getByRole('link', { name: 'Aller au contenu principal' });
		await expect(skipLink).toBeFocused();
		await expect(skipLink).toBeVisible();

		await page.keyboard.press('Enter');
		await expect(page.locator('main')).toBeFocused();

		await page.keyboard.press('Tab');
		await expect(page.getByRole('button', { name: 'Nouvelle carrière' })).toBeFocused();
		await page.keyboard.press('Enter');

		// Création du personnage : choix au clavier, puis lancement.
		const firstOrigin = page.getByRole('radio').first();
		await firstOrigin.focus();
		await page.keyboard.press('ArrowDown');
		await expect(page.getByRole('radio').nth(1)).toBeChecked();
		await page.getByRole('button', { name: 'Commencer la carrière' }).focus();
		await page.keyboard.press('Enter');
		await expect(page.getByTestId('game-date')).toHaveText('T1 2000 · 25 ans');
	});

	test('charge toutes ses ressources sous le base path, sans erreur', async ({ page, baseURL }) => {
		const requested: string[] = [];
		const failed: string[] = [];
		page.on('request', (request) => requested.push(request.url()));
		page.on('response', (response) => {
			if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
		});
		page.on('requestfailed', (request) => failed.push(`échec ${request.url()}`));

		await page.goto('./');
		await page.waitForLoadState('networkidle');

		expect(failed).toEqual([]);
		expect(requested.filter((url) => !url.startsWith(baseURL ?? ''))).toEqual([]);
		expect(requested.some((url) => url.endsWith('.css'))).toBe(true);
		expect(requested.some((url) => url.endsWith('.js'))).toBe(true);

		// Fichier de `static/` (le navigateur headless ne demande pas l'icône lui-même).
		const icon = await page
			.locator('link[rel="icon"]')
			.evaluate((link: HTMLLinkElement) => link.href);
		expect(icon).toBe(`${baseURL}favicon.svg`);
		expect((await page.request.get(icon)).status()).toBe(200);

		// Après hydratation, le routeur client conserve l'URL du base path.
		expect(page.url()).toBe(baseURL);
	});

	test('fonctionne sans serveur applicatif : la page est prérendue', async ({ request }) => {
		const response = await request.get('./');
		expect(response.status()).toBe(200);
		const html = await response.text();
		expect(html).toContain('La République, c’est moi !');
	});
});
