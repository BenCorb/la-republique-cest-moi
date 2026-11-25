/**
 * Patrimoine personnel (P3-02, GDD §9.2) : actifs, valeur nette et train de vie.
 *
 * - Un actif est une amélioration personnelle dotée d'une valeur de marché
 *   (`OwnedUpgrade.valueCents`) : achetée à son prix, elle rapporte chaque
 *   trimestre actif un revenu proportionnel à cette valeur (`assetIncome`) et
 *   se revend pour une part de celle-ci (`assetProceeds`).
 * - À chaque frontière, la valeur évolue : tendance, conjoncture (indicateur
 *   d'économie), aléa, et une rare perte totale. Un actif tombé à zéro reste
 *   possédé, sans valeur ni revenu.
 * - La valeur nette (argent personnel et actifs) est dérivée, jamais stockée ;
 *   le budget politique n'y entre pas.
 *
 * Toutes les valeurs sont des hypothèses de `upgrades.json` et `wealth.json`.
 */
import type { Content, Resources } from '../content/types.ts';
import { nextFloat, nextInt, type RngState } from './random.ts';
import type { OwnedUpgrade, WealthRecord, WorldState } from './state.ts';

/** Valeur nette : argent personnel et valeur des actifs, en centimes. */
export function netWorth(
	resources: Pick<Resources, 'personalCashCents'>,
	upgrades: readonly OwnedUpgrade[]
): number {
	return upgrades.reduce(
		(sum, upgrade) => sum + (upgrade.valueCents ?? 0),
		resources.personalCashCents
	);
}

/** Valeur totale des actifs, en centimes. */
export function assetsValue(upgrades: readonly OwnedUpgrade[]): number {
	return netWorth({ personalCashCents: 0 }, upgrades);
}

/**
 * Réévaluation des actifs à la frontière, dans l'ordre d'acquisition. Pour
 * chacun : un tirage de perte totale, puis un tirage d'aléa ; la variation
 * trimestrielle vaut tendance / 4 + conjoncture + aléa, en % de la valeur,
 * arrondie à l'euro. Un exemplaire acheté pendant le trimestre n'est pas réévalué.
 */
export function revalueAssets(
	upgrades: readonly OwnedUpgrade[],
	world: WorldState,
	turn: number,
	rng: RngState,
	content: Content
): { upgrades: OwnedUpgrade[]; rng: RngState; record: WealthRecord } {
	let current = rng;
	let valueChange = 0;
	const failed: string[] = [];
	const economyGap = world.indicators.economy - 50;
	const next = upgrades.map((upgrade) => {
		const asset = content.upgrades[upgrade.upgradeId]?.asset;
		if (!asset || upgrade.valueCents === null || upgrade.valueCents === 0) return upgrade;
		if (upgrade.acquiredTurn >= turn) return upgrade;
		const failure = nextFloat(current);
		current = failure.rng;
		if (failure.value * 1000 < asset.failurePerMille) {
			valueChange -= upgrade.valueCents;
			failed.push(upgrade.instanceId);
			return { ...upgrade, valueCents: 0 };
		}
		// Aléa en centièmes de %, pour une variation fine sans flottant cumulé.
		const noise = nextInt(current, -asset.volatilityPercent * 100, asset.volatilityPercent * 100);
		current = noise.rng;
		const basisPoints =
			asset.annualGrowthPercent * 25 +
			asset.economySensitivityPercent * economyGap * 10 +
			noise.value;
		const delta = Math.round((upgrade.valueCents * basisPoints) / 10_000 / 100) * 100;
		const value = Math.max(0, upgrade.valueCents + delta);
		valueChange += value - upgrade.valueCents;
		return { ...upgrade, valueCents: value };
	});
	return { upgrades: next, rng: current, record: { valueChange, failed } };
}

/**
 * Effet du confort sur le stress du trimestre : train de vie payé (ou stress
 * d'une dépense impayée) et actifs actifs qui apaisent (résidence, vignoble).
 */
export function comfortStress(
	economy: {
		readonly lifestyle: { readonly lifestyleId: string; readonly unpaid: boolean };
		readonly producers: readonly { readonly upgradeId: string; readonly status: string }[];
	},
	content: Content
): number {
	const lifestyle = economy.lifestyle.unpaid
		? content.wealth.unpaidLifestyleStress
		: (content.lifestyles[economy.lifestyle.lifestyleId]?.stressPerTurn ?? 0);
	return economy.producers.reduce(
		(sum, producer) =>
			producer.status === 'active'
				? sum + (content.upgrades[producer.upgradeId]?.asset?.stressPerTurn ?? 0)
				: sum,
		lifestyle
	);
}
