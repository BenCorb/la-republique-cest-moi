/**
 * Chemin de base du site (`paths.base` de SvelteKit), partagé par la configuration
 * Vite, Playwright et le serveur statique de vérification.
 *
 * - `''` : site à la racine d'un domaine (domaine personnalisé, `<compte>.github.io`).
 * - `'/nom-du-depot'` : site de projet GitHub Pages servi dans un sous-répertoire.
 *
 * Fourni par la variable d'environnement `BASE_PATH` au build ; en CI, la valeur
 * vient de `actions/configure-pages` (sortie `base_path`).
 */

/** Forme exigée par SvelteKit : vide, ou commençant par « / » sans « / » final. */
export type BasePath = '' | `/${string}`;

const SEGMENT = /^[A-Za-z0-9._~-]+$/;

export function normalizeBasePath(input: string | undefined): BasePath {
	const trimmed = (input ?? '').trim();
	const segments = trimmed.split('/').filter((segment) => segment !== '');
	for (const segment of segments) {
		if (!SEGMENT.test(segment) || segment === '.' || segment === '..') {
			throw new Error(
				`BASE_PATH invalide (« ${trimmed} ») : segments attendus en lettres, chiffres, « . », « _ », « ~ » ou « - ».`
			);
		}
	}
	return segments.length === 0 ? '' : `/${segments.join('/')}`;
}
