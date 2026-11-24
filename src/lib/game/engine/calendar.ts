/**
 * Calendrier trimestriel (ARCHITECTURE.md §4.3).
 *
 * Un tour = un trimestre. Le tour 0 est le premier trimestre 2000 (T1 2000) ;
 * les tours négatifs désignent les trimestres antérieurs (dates de naissance).
 * année = 2000 + floor(tour / 4), trimestre = (tour mod 4) + 1.
 */

/** Numéro de trimestre : 0 = T1 2000. */
export type Turn = number;

export type Quarter = 1 | 2 | 3 | 4;

export const START_YEAR = 2000;
export const TURNS_PER_YEAR = 4;

function assertTurn(turn: Turn): void {
	if (!Number.isSafeInteger(turn)) {
		throw new RangeError(`Tour invalide : ${turn}`);
	}
}

export function yearOf(turn: Turn): number {
	assertTurn(turn);
	return START_YEAR + Math.floor(turn / TURNS_PER_YEAR);
}

export function quarterOf(turn: Turn): Quarter {
	assertTurn(turn);
	return ((((turn % TURNS_PER_YEAR) + TURNS_PER_YEAR) % TURNS_PER_YEAR) + 1) as Quarter;
}

/** Tour correspondant à un trimestre d'une année donnée. */
export function turnOf(year: number, quarter: Quarter): Turn {
	if (!Number.isSafeInteger(year)) throw new RangeError(`Année invalide : ${year}`);
	return (year - START_YEAR) * TURNS_PER_YEAR + (quarter - 1);
}

/** Libellé affiché, par exemple « T2 2004 » (DESIGN.md §7). */
export function formatTurn(turn: Turn): string {
	return `T${quarterOf(turn)} ${yearOf(turn)}`;
}

/**
 * Âge en années révolues au tour donné, dérivé de la naissance : aucun compteur
 * d'âge indépendant n'est stocké. L'anniversaire tombe au trimestre de naissance.
 */
export function ageAt(birthTurn: Turn, turn: Turn): number {
	assertTurn(birthTurn);
	assertTurn(turn);
	return Math.floor((turn - birthTurn) / TURNS_PER_YEAR);
}
