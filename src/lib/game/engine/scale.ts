/**
 * Montée en échelle des actions (P3-23, GDD §5, ARCHITECTURE.md §8.4).
 *
 * - Une famille d'actions (`actions.json`, `families`) regroupe trois formats —
 *   modeste, soutenu, majeur — sous une seule ligne d'agenda. Chaque format est
 *   une action ordinaire du catalogue (coût, temps, effets et prérequis propres,
 *   rattachée par `scale`) : le moteur ne multiplie rien.
 * - Un seul format d'une famille par trimestre.
 * - Plafond annuel facultatif sur une ressource dépensée, tous formats
 *   confondus, par année civile. La dépense passée est relue dans le journal
 *   (étapes exécutées et coûts du catalogue) : aucun registre supplémentaire
 *   dans l'état, et la prévision comme l'exécution lisent la même source.
 * - Les rendements décroissants et les prérequis de capacité (palier militant,
 *   collaborateur) sont portés par le contenu et vérifiés à la validation.
 */
import type { ActionDefinition, ActionFormat, Content, ResourceAmount } from '../content/types.ts';
import { yearOf, type Turn } from './calendar.ts';
import type { JournalEntry } from './state.ts';

/** Famille d'une action à l'échelle, ou `null`. */
export function familyOf(actionId: string, content: Content): string | null {
	return content.actions[actionId]?.scale?.family ?? null;
}

/** Formats d'une famille, du modeste au majeur. */
export function familyFormats(familyId: string, content: Content): ActionDefinition[] {
	const order: readonly ActionFormat[] = ['modest', 'sustained', 'major'];
	return content.actionIds
		.map((id) => content.actions[id]!)
		.filter((action) => action.scale?.family === familyId)
		.sort((left, right) => order.indexOf(left.scale!.format) - order.indexOf(right.scale!.format));
}

/** Part du coût d'une action payée dans la ressource du plafond de sa famille. */
export function cappedCost(action: ActionDefinition, content: Content): number {
	const family = action.scale ? content.actionFamilies[action.scale.family] : undefined;
	const cap = family?.annualCap;
	if (!cap) return 0;
	return action.costs
		.filter((cost) => cost.resource === cap.resource)
		.reduce((total, cost) => total + cost.amount, 0);
}

/**
 * Dépense déjà engagée cette année civile par les formats d'une famille, d'après
 * les étapes exécutées au journal (les trimestres de l'année avant `turn`).
 */
export function familySpentThisYear(
	familyId: string,
	history: readonly JournalEntry[],
	turn: Turn,
	content: Content
): number {
	const year = yearOf(turn);
	let spent = 0;
	for (const entry of history) {
		if (entry.type !== 'turn.resolved') continue;
		if (yearOf(entry.turn) !== year || entry.turn >= turn) continue;
		for (const step of entry.steps) {
			if (step.kind !== 'action') continue;
			const action = content.actions[step.id];
			if (action?.scale?.family === familyId) spent += cappedCost(action, content);
		}
	}
	return spent;
}

/** Montant lisible d'un plafond : euros entiers (« 30 000 € ») ou points d'influence. */
export function formatAmount(amount: ResourceAmount): string {
	if (amount.resource === 'influence') return `${amount.amount} points d’influence`;
	const whole = String(Math.ceil(amount.amount / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
	return `${whole} €`;
}
