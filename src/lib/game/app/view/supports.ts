/**
 * Projection des groupes de soutien (fiche soutiens-et-militants).
 *
 * Partie de la projection publique (`PlayerView`, ARCHITECTURE.md §9) : fonctions pures,
 * sans PRNG ni information cachée. Point d’entrée : `../view-model.ts`.
 */
import type { Content } from '../../content/types.ts';
import type { GameState } from '../../engine/index.ts';
import type { GaugeDescription } from '../format.ts';
import { describePopularity, describeSupport } from '../format.ts';

export interface SupportGroupView {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly gauge: GaugeDescription;
	/** Part du groupe dans la popularité, en % (groupes électoraux). */
	readonly share: number | null;
}

export interface SupportsView {
	readonly popularity: GaugeDescription;
	readonly electoral: readonly SupportGroupView[];
	readonly influence: readonly SupportGroupView[];
}

export function buildSupports(state: GameState, content: Content): SupportsView {
	const totalWeight = content.supportGroupIds.reduce(
		(total, id) => total + (content.supportGroups[id]?.weight ?? 0),
		0
	);
	const groups = content.supportGroupIds.flatMap((id) => {
		const group = content.supportGroups[id];
		if (!group) return [];
		return [
			{
				kind: group.kind,
				view: {
					id,
					label: group.label,
					description: group.description,
					gauge: describeSupport(state.player.supports[id] ?? 0),
					share:
						group.kind === 'electoral' && totalWeight > 0
							? Math.round((group.weight * 100) / totalWeight)
							: null
				}
			}
		];
	});
	return {
		popularity: describePopularity(state.player.popularity),
		electoral: groups.filter((group) => group.kind === 'electoral').map((group) => group.view),
		influence: groups.filter((group) => group.kind === 'influence').map((group) => group.view)
	};
}
