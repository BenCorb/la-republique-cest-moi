/**
 * Projection des tendances du tableau de bord (fiche interface-coque).
 *
 * Partie de la projection publique (`PlayerView`, ARCHITECTURE.md §9) : fonctions pures,
 * sans PRNG ni information cachée. Point d’entrée : `../view-model.ts`.
 */
import type { GameState, HistoryEntry, QuarterSnapshot } from '../../engine/index.ts';
import { formatTurn } from '../../engine/index.ts';
import { formatMoney } from '../format.ts';

/**
 * Tendance d'une ressource ou d'une jauge sur les derniers trimestres (P3-08) :
 * valeurs en fin de trimestre, de la plus ancienne à l'actuelle.
 */
export interface TrendView {
	readonly id: string;
	readonly label: string;
	readonly points: readonly number[];
	/** Valeur actuelle, formatée. */
	readonly current: string;
	/** Variation sur la période, formatée (« + 12 », « − 3 400 € »), `null` si nulle. */
	readonly change: string | null;
	/** Sens de la variation pour le joueur : favorable, défavorable ou neutre. */
	readonly mood: 'good' | 'bad' | 'neutral';
	/** Résumé accessible : période, départ et arrivée. */
	readonly description: string;
}

/** Trimestres affichés dans les tendances du tableau de bord. */
const TREND_QUARTERS = 12;

const TREND_SERIES: readonly {
	readonly id: keyof QuarterSnapshot;
	readonly label: string;
	readonly rising: 'good' | 'bad';
}[] = [
	{ id: 'influence', label: 'Influence', rising: 'good' },
	{ id: 'politicalBudgetCents', label: 'Budget politique', rising: 'good' },
	{ id: 'personalCashCents', label: 'Argent personnel', rising: 'good' },
	{ id: 'popularity', label: 'Popularité', rising: 'good' },
	{ id: 'health', label: 'Santé', rising: 'good' },
	{ id: 'stress', label: 'Stress', rising: 'bad' }
];

function formatTrendValue(id: keyof QuarterSnapshot, value: number): string {
	return id === 'politicalBudgetCents' || id === 'personalCashCents'
		? formatMoney(value)
		: String(value);
}

/** Tendances : instantanés des derniers trimestres, puis la situation actuelle. */
export function buildTrends(state: GameState): TrendView[] {
	const quarters = state.history
		.filter((entry): entry is HistoryEntry => entry.type === 'turn.resolved')
		.slice(-TREND_QUARTERS);
	if (quarters.length < 2) return [];
	const first = quarters[0]!.turn;
	return TREND_SERIES.map(({ id, label, rising }) => {
		const points = quarters.map((entry) => entry.snapshot[id]);
		const start = points[0]!;
		const end = points[points.length - 1]!;
		const delta = end - start;
		const sign = delta > 0 ? '+ ' : '− ';
		return {
			id,
			label,
			points,
			current: formatTrendValue(id, end),
			change: delta === 0 ? null : `${sign}${formatTrendValue(id, Math.abs(delta))}`,
			mood: delta === 0 ? 'neutral' : delta > 0 === (rising === 'good') ? 'good' : 'bad',
			description: `${label} depuis le ${formatTurn(first)} : de ${formatTrendValue(id, start)} à ${formatTrendValue(id, end)}`
		};
	});
}
