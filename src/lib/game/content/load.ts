/**
 * Catalogue du jeu, importé au build puis validé et indexé au chargement.
 * Un catalogue invalide est une erreur de développement : le chargement échoue
 * avec la liste des problèmes (également détectés par `npm run content:validate`).
 * Chaque fichier de `data/events/` est un catalogue d'événements.
 */
import actions from './data/actions.json';
import balance from './data/balance.json';
import cast from './data/cast.json';
import upgrades from './data/upgrades.json';
import career from './data/career.json';
import supports from './data/supports.json';
import entourage from './data/entourage.json';
import profiles from './data/profiles.json';
import justice from './data/justice.json';
import wealth from './data/wealth.json';
import promises from './data/promises.json';
import media from './data/media.json';
import institutions from './data/institutions.json';
import epitaphs from './data/epitaphs.json';
import traits from './data/traits.json';
import world from './data/world.json';
import type { Content } from './types.ts';
import { validateContent } from './validate.ts';

const eventModules = import.meta.glob<unknown>('./data/events/*.json', {
	eager: true,
	import: 'default'
});

export function loadContent(): Content {
	const events: Record<string, unknown> = {};
	for (const [path, module] of Object.entries(eventModules)) {
		events[path.replace('./data/', '')] = module;
	}
	const result = validateContent({
		actions,
		upgrades,
		balance,
		cast,
		events,
		world,
		traits,
		career,
		supports,
		entourage,
		profiles,
		justice,
		wealth,
		promises,
		media,
		institutions,
		epitaphs
	});
	if (!result.ok) {
		const details = result.issues
			.map((issue) => `${issue.source} ${issue.path} : ${issue.message}`)
			.join('\n- ');
		throw new Error(`Catalogue de contenu invalide :\n- ${details}`);
	}
	return result.content;
}
