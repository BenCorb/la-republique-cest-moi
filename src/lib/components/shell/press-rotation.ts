/**
 * Titres du fil de l'en-tête (P3-13) : seulement le dernier trimestre publié,
 * l'article critique vous concernant d'abord, puis les autres articles vous
 * concernant, puis l'ambiance ; ordre de publication conservé à rang égal.
 */
import type { PressItemView } from '#lib/game/app/view-model.ts';

function rank(item: PressItemView): number {
	if (item.critical) return 0;
	return item.aboutPlayer ? 1 : 2;
}

export function quarterHeadlines(press: readonly PressItemView[]): PressItemView[] {
	const latest = press[0]?.dateLabel;
	if (latest === undefined) return [];
	return press
		.filter((item) => item.dateLabel === latest)
		.map((item, order) => ({ item, order }))
		.sort((a, b) => rank(a.item) - rank(b.item) || a.order - b.order)
		.map(({ item }) => item);
}
