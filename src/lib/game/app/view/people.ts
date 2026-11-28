/**
 * Projection des personnages rencontrés (fiche personnages-et-relations).
 *
 * Partie de la projection publique (`PlayerView`, ARCHITECTURE.md §9) : fonctions pures,
 * sans PRNG ni information cachée. Point d’entrée : `../view-model.ts`.
 */
import type { Content } from '../../content/types.ts';
import type { GameState } from '../../engine/index.ts';
import { ageAt, displayName, formatTurn } from '../../engine/index.ts';
import { describeAttitude, roleOf } from './shared.ts';

export interface PersonView {
	readonly id: string;
	readonly name: string;
	/** Rôle principal, d'après les étiquettes. */
	readonly role: string;
	readonly age: number;
	readonly status: string;
	readonly active: boolean;
	/** Tendance de l'attitude envers le joueur (jamais le chiffre). */
	readonly attitude: string;
	readonly attitudeTone: 'good' | 'neutral' | 'warning' | 'danger';
	readonly knownTraits: readonly { readonly label: string; readonly description: string }[];
	/** Traits encore inconnus du joueur (leur nombre seul est visible). */
	readonly unknownTraits: number;
	readonly metLabel: string;
	/** Souvenirs, du plus récent au plus ancien. */
	readonly memories: readonly { readonly dateLabel: string; readonly text: string }[];
}

export function buildPeople(state: GameState, content: Content): PersonView[] {
	const now = state.end ? state.end.turn : state.turn;
	const people = Object.entries(state.relationships).flatMap(([id, relationship]) => {
		const character = state.characters[id];
		// Les candidats non retenus ne sont que des CV : ils n'entrent pas dans vos relations.
		if (!character || character.tags.includes('candidate')) return [];
		const lastTurn = character.leftTurn ?? now;
		return [
			{
				metTurn: relationship.metTurn,
				view: {
					id,
					name: displayName(character),
					role: roleOf(character.tags),
					age: ageAt(character.birthTurn, lastTurn),
					status:
						character.status === 'active'
							? 'En activité'
							: character.status === 'retired'
								? `À la retraite depuis le ${formatTurn(lastTurn)}`
								: `Décès au ${formatTurn(lastTurn)}`,
					active: character.status === 'active',
					...describeAttitude(relationship.attitude),
					knownTraits: character.knownTraits.map((traitId) => ({
						label: content.traits[traitId]?.label ?? traitId,
						description: content.traits[traitId]?.description ?? ''
					})),
					unknownTraits: character.traits.length - character.knownTraits.length,
					metLabel: `Rencontre au ${formatTurn(relationship.metTurn)}`,
					memories: [...relationship.memories].reverse().map((memory) => ({
						dateLabel: formatTurn(memory.turn),
						text: memory.text
					}))
				} satisfies PersonView
			}
		];
	});
	// La famille d'abord, puis les personnages actifs, par date de rencontre.
	return people
		.sort(
			(a, b) =>
				Number(b.view.role.startsWith('Famille')) - Number(a.view.role.startsWith('Famille')) ||
				Number(b.view.active) - Number(a.view.active) ||
				a.metTurn - b.metTurn ||
				a.view.id.localeCompare(b.view.id)
		)
		.map((entry) => entry.view);
}
