/**
 * Époques (P3-07, GDD §8.3) : années 2000, 2010, 2020, puis anticipation.
 * L'époque courante découle de l'année du trimestre ; les événements, actions
 * et améliorations d'une époque ultérieure n'apparaissent pas avant elle. Les
 * dates sont des paramètres de contenu, pas une reproduction de l'Histoire.
 */
import type { Content, EraDefinition } from '../content/types.ts';
import { yearOf, type Turn } from './calendar.ts';

/** Rang de l'époque en cours au trimestre `turn` (0 : la première). */
export function eraIndexAt(turn: Turn, content: Content): number {
	const year = yearOf(turn);
	let index = 0;
	content.world.eras.forEach((era, rank) => {
		if (era.fromYear <= year) index = rank;
	});
	return index;
}

/** Époque en cours au trimestre `turn`. */
export function eraAt(turn: Turn, content: Content): EraDefinition {
	return content.world.eras[eraIndexAt(turn, content)]!;
}

/** L'époque `eraId` a-t-elle commencé ? Une époque inconnue n'est jamais atteinte. */
export function eraReached(eraId: string | undefined, turn: Turn, content: Content): boolean {
	if (eraId === undefined) return true;
	const rank = content.world.eras.findIndex((era) => era.id === eraId);
	return rank >= 0 && rank <= eraIndexAt(turn, content);
}

/** L'événement peut-il survenir à cette époque ? */
export function inEras(eras: readonly string[] | undefined, turn: Turn, content: Content): boolean {
	return eras === undefined || eras.includes(eraAt(turn, content).id);
}
