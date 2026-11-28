/**
 * Projection de l’agenda : plan du trimestre, catalogue d’actions et d’améliorations, formats (fiche docs/features/agenda.md).
 *
 * Partie de la projection publique (`PlayerView`, ARCHITECTURE.md §9) : fonctions pures,
 * sans PRNG ni information cachée. Point d’entrée : `../view-model.ts`.
 */
import type { Content } from '../../content/types.ts';
import type { GameState, PlanStep } from '../../engine/index.ts';
import { previewPlan } from '../../engine/index.ts';
import type { GaugeDescription } from '../format.ts';
import type { ChipView } from './shared.ts';

export interface PlanStepView {
	readonly index: number;
	readonly kind: PlanStep['kind'];
	readonly label: string;
	readonly timeCost: number;
	readonly details: readonly string[];
	/** Coûts et effets de l'étape en pastilles (P3-26), dans l'ordre de `details`. */
	readonly chips: readonly ChipView[];
	readonly issues: readonly string[];
	/** Achat : rappel que la production commence au trimestre suivant. */
	readonly note: string | null;
	/** Épinglée : répétée chaque trimestre (P3-11) ; un achat ne l'est jamais. */
	readonly pinned: boolean;
	/** Thème de l'agenda de l'action (P3-26, couleur de la barre de temps) ; `null` sinon. */
	readonly category: string | null;
}

export interface PlanView {
	readonly steps: readonly PlanStepView[];
	/** Étapes épinglées, seules répétées aux trimestres suivants (P3-11). */
	readonly pinnedCount: number;
	/** Le plan contient la retraite (P3-37) : confirmation exigée, accélération fermée. */
	readonly retiring: boolean;
	/** Retraits automatiques du trimestre en cours, avec leur motif (P3-11). */
	readonly adjustments: readonly string[];
	readonly timeAvailable: number;
	/** Temps réservé par les mandats, déjà retiré du temps disponible. */
	readonly timeReserved: number;
	readonly timeUsed: number;
	readonly timeRemaining: number;
	readonly valid: boolean;
	readonly issues: readonly string[];
	readonly warnings: readonly string[];
	readonly changes: readonly { readonly name: string; readonly text: string }[];
	/** Mêmes variations prévues, en pastilles (P3-26). */
	readonly changeChips: readonly ChipView[];
	readonly stressAfter: GaugeDescription;
	readonly healthAfter: { readonly min: number; readonly max: number };
}

export interface CatalogItemView {
	readonly kind: PlanStep['kind'];
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly timeCost: number;
	readonly costs: readonly string[];
	readonly effects: readonly string[];
	/** Coûts en pastilles (P3-26), dans l'ordre de `costs`. */
	readonly costChips: readonly ChipView[];
	/** Effets en pastilles (P3-26), dans l'ordre de `effects`, puis le bonus de terrain. */
	readonly effectChips: readonly ChipView[];
	/** Bonus de la base militante pour une action de terrain (P3-19), en clair. */
	readonly fieldBonus?: string | null;
	/** Thème de l'agenda (catégorie du catalogue), pour l'icône et la couleur. */
	readonly category: string | null;
	/** Occurrences déjà dans le plan. */
	readonly planned: number;
	readonly addable: boolean;
	/** Raison pour laquelle l'élément ne peut pas être ajouté au plan. */
	readonly reason: string | null;
	/**
	 * Hors de portée : une condition n'est pas remplie (autre terrain d’engagement, pas
	 * d'adhésion, pas de campagne, influence insuffisante…), par opposition à un
	 * blocage du trimestre (temps, argent, limite atteinte).
	 */
	readonly outOfReach: boolean;
	/**
	 * Famille à l'échelle (P3-23) : les trois formats sous cette seule ligne, du
	 * modeste au majeur ; absent pour une action ordinaire.
	 */
	readonly formats?: readonly ActionFormatView[] | undefined;
	/** Plafond annuel de la famille et dépense de l'année, en clair (P3-23). */
	readonly familyNote?: string | null | undefined;
}

/** Format d'une famille d'actions à l'échelle (P3-23), avec son coût et son prérequis. */
export interface ActionFormatView {
	readonly id: string;
	readonly format: string;
	readonly label: string;
	readonly timeCost: number;
	readonly costChips: readonly ChipView[];
	readonly effectChips: readonly ChipView[];
	readonly planned: number;
	readonly addable: boolean;
	readonly reason: string | null;
	readonly outOfReach: boolean;
}

/** Thème de l'agenda : actions à portée, et actions hors de portée affichées à la demande. */
export interface ActionGroupView {
	readonly id: string;
	readonly label: string;
	readonly actions: readonly CatalogItemView[];
	readonly outOfReach: readonly CatalogItemView[];
}

export interface UpgradeView extends CatalogItemView {
	readonly family: string;
	readonly treasury: string;
	readonly upkeep: readonly string[];
	/** Apport à la base militante (PT-B1-006) : places d'accueil et rétention, ou `null`. */
	readonly activists: string | null;
	readonly owned: number;
	readonly maxOwned: number;
}

export function addability(
	state: GameState,
	plan: readonly PlanStep[],
	step: PlanStep,
	content: Content
) {
	if (state.phase !== 'planning')
		return {
			addable: false,
			reason: 'Aucune planification possible pour le moment.',
			outOfReach: false
		};
	const preview = previewPlan(state, { steps: [...plan, step] }, content);
	const last = preview.steps.at(-1);
	const issue = last?.issues[0];
	const outOfReach = last?.issues.some((item) => item.code === 'condition_not_met') ?? false;
	return issue
		? { addable: false, reason: issue.message, outOfReach }
		: { addable: true, reason: null, outOfReach: false };
}

const OTHER_ACTIONS = { id: 'other', label: 'Autres actions' } as const;

/** Regroupe les actions de l'agenda par thème du catalogue ; « Autres actions » en dernier. */
export function groupActions(
	actions: readonly CatalogItemView[],
	content: Content
): ActionGroupView[] {
	const categoryOf = (id: string): string => content.actions[id]?.category ?? OTHER_ACTIONS.id;
	return [...content.actionCategories, OTHER_ACTIONS].flatMap((category) => {
		const members = actions.filter((action) => categoryOf(action.id) === category.id);
		if (members.length === 0) return [];
		return [
			{
				id: category.id,
				label: category.label,
				actions: members.filter((action) => !action.outOfReach),
				outOfReach: members.filter((action) => action.outOfReach)
			}
		];
	});
}
