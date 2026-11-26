/**
 * Segments de la barre de temps du plan (P3-26, partagés par P3-13) : un par
 * thème de l'agenda, dans l'ordre d'apparition, puis le temps réservé par les
 * mandats. Présentation seulement : les durées viennent de `PlanView`.
 */
import type { PlanView } from '#lib/game/app/view-model.ts';
import { categoryIdentity } from '#lib/components/common/identity.ts';

export interface PlanSegment {
	readonly key: string;
	readonly label: string;
	readonly color: string;
	readonly points: number;
	/** Largeur en % du temps total (disponible + réservé). */
	readonly width: number;
	readonly reserved: boolean;
}

export function planSegments(plan: PlanView): PlanSegment[] {
	const total = plan.timeAvailable + plan.timeReserved || 1;
	const byCategory: { key: string; label: string; color: string; points: number }[] = [];
	for (const step of plan.steps) {
		if (step.timeCost <= 0) continue;
		const key = step.category ?? 'other';
		const existing = byCategory.find((segment) => segment.key === key);
		if (existing) existing.points += step.timeCost;
		else {
			const identity = categoryIdentity(key);
			byCategory.push({ key, label: identity.label, color: identity.color, points: step.timeCost });
		}
	}
	const segments: PlanSegment[] = byCategory.map((segment) => ({
		...segment,
		width: (segment.points / total) * 100,
		reserved: false
	}));
	if (plan.timeReserved > 0)
		segments.push({
			key: 'reserved',
			label: 'Mandats (réservé)',
			color: 'var(--color-muted)',
			points: plan.timeReserved,
			width: (plan.timeReserved / total) * 100,
			reserved: true
		});
	return segments;
}
