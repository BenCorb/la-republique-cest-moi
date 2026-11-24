/**
 * Catalogue du jeu, importé au build puis validé et indexé au chargement.
 * Un catalogue invalide est une erreur de développement : le chargement échoue
 * avec la liste des problèmes (également détectés par `npm run content:validate`).
 */
import actions from './data/actions.json';
import balance from './data/balance.json';
import upgrades from './data/upgrades.json';
import type { Content } from './types.ts';
import { validateContent } from './validate.ts';

export function loadContent(): Content {
	const result = validateContent({ actions, upgrades, balance });
	if (!result.ok) {
		const details = result.issues
			.map((issue) => `${issue.source} ${issue.path} : ${issue.message}`)
			.join('\n- ');
		throw new Error(`Catalogue de contenu invalide :\n- ${details}`);
	}
	return result.content;
}
