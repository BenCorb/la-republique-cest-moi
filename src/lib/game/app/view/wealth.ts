/**
 * Projection du patrimoine et du train de vie (fiche patrimoine).
 *
 * Partie de la projection publique (`PlayerView`, ARCHITECTURE.md §9) : fonctions pures,
 * sans PRNG ni information cachée. Point d’entrée : `../view-model.ts`.
 */
import type { Content } from '../../content/types.ts';
import type { GameState, PlanStep } from '../../engine/index.ts';
import {
	assetIncome,
	assetProceeds,
	assetsValue,
	formatTurn,
	netWorth
} from '../../engine/index.ts';
import { formatMoney } from '../format.ts';
import type { CatalogItemView, UpgradeView } from './agenda.ts';
import { addability } from './agenda.ts';
import { upgradeLabel } from './shared.ts';

export interface AssetView {
	readonly instanceId: string;
	readonly label: string;
	readonly acquired: string;
	readonly value: string;
	/** Revenu du trimestre en cours, `null` avant le premier trimestre actif. */
	readonly income: string | null;
	readonly proceeds: string;
	readonly lost: boolean;
	readonly sale: {
		readonly step: PlanStep | null;
		readonly reason: string | null;
		readonly planned: boolean;
	};
}

export interface WealthView {
	readonly netWorth: string;
	readonly cash: string;
	readonly assetsValue: string;
	readonly lifestyle: {
		readonly label: string;
		readonly description: string;
		readonly cost: string;
	};
	/** Changements de train de vie planifiables. */
	readonly lifestyleActions: readonly CatalogItemView[];
	readonly owned: readonly AssetView[];
	readonly offers: readonly UpgradeView[];
}

export function buildWealth(
	state: GameState,
	plan: readonly PlanStep[],
	actions: readonly CatalogItemView[],
	offers: readonly UpgradeView[],
	content: Content
): WealthView {
	const lifestyle = content.lifestyles[state.player.lifestyle];
	const sellActionId =
		content.actionIds.find((id) => content.actions[id]?.target === 'asset') ?? null;
	const selling = new Set(
		plan.flatMap((step) =>
			step.kind === 'action' && step.id === sellActionId && step.target ? [step.target] : []
		)
	);
	const owned = state.upgrades.flatMap((upgrade): AssetView[] => {
		const definition = content.upgrades[upgrade.upgradeId];
		if (!definition?.asset || upgrade.valueCents === null) return [];
		const step: PlanStep | null = sellActionId
			? { kind: 'action', id: sellActionId, target: upgrade.instanceId }
			: null;
		const planned = selling.has(upgrade.instanceId);
		const check = step && !planned ? addability(state, plan, step, content) : null;
		const income = assetIncome(upgrade, content);
		return [
			{
				instanceId: upgrade.instanceId,
				label: upgradeLabel(upgrade.upgradeId, state, content, true),
				acquired: formatTurn(upgrade.acquiredTurn),
				value: formatMoney(upgrade.valueCents),
				income: upgrade.acquiredTurn < state.turn ? formatMoney(income) : null,
				proceeds: formatMoney(assetProceeds(upgrade, content)),
				lost: upgrade.valueCents === 0,
				sale: {
					step: check?.addable ? step : null,
					reason: planned ? 'Vente prévue ce trimestre.' : (check?.reason ?? null),
					planned
				}
			}
		];
	});
	return {
		netWorth: formatMoney(netWorth(state.resources, state.upgrades)),
		cash: formatMoney(state.resources.personalCashCents),
		assetsValue: formatMoney(assetsValue(state.upgrades)),
		lifestyle: {
			label: lifestyle?.label ?? state.player.lifestyle,
			description: lifestyle?.description ?? '',
			cost: formatMoney(lifestyle?.costCents ?? 0)
		},
		lifestyleActions: actions.filter((action) => action.id.startsWith('lifestyle.')),
		owned,
		offers
	};
}
