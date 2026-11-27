/**
 * Base militante organique (P3-19, PT-P3-09-014, GDD §5.2).
 *
 * - Un effectif entier (`player.activists`) remplace l'achat de militants :
 *   on ne recrute pas une personne contre du temps, on fait grandir une base.
 * - Chaque frontière (étape 5 septies), la notoriété (√influence, exposition,
 *   campagnes en cours) fait connaître le joueur ; le soutien militant décide
 *   qui s'engage. La capacité d'accueil (local, parti, mandats) freine la
 *   croissance à l'approche du plafond : aucune croissance exponentielle.
 * - Départs : usure naturelle, mécontentement (soutien militant bas), manque
 *   de place, frais impayés. Une candidature disputée attire des recrues selon
 *   le score, même battue.
 * - Paliers (noyau, comité, section, réseau régional, organisation nationale) :
 *   bonus des actions de terrain, frais logistiques ; cotisations par militant.
 * - Mobilisation : chaque scrutin a un besoin de militants ; en deçà, le score
 *   baisse (jamais l'éligibilité). L'investiture prête une part de la machine.
 *
 * Déterministe, sans tirage. Valeurs provisoires de `balance.json`.
 */
import type {
	ActivistTierDefinition,
	ActionDefinition,
	Content,
	Effect,
	Resources
} from '../content/types.ts';
import { activeMandates } from './career.ts';
import type {
	ActivistsRecord,
	Campaign,
	DeadlinesRecord,
	MandateInstance,
	OwnedUpgrade,
	PlayerState
} from './state.ts';

/** Palier atteint par un effectif. */
export function activistTier(activists: number, content: Content): ActivistTierDefinition {
	const tiers = content.balance.activists.tiers;
	let reached = tiers[0]!;
	for (const tier of tiers) if (activists >= tier.min) reached = tier;
	return reached;
}

/** Palier suivant, `null` au sommet. */
export function nextActivistTier(
	activists: number,
	content: Content
): ActivistTierDefinition | null {
	return content.balance.activists.tiers.find((tier) => tier.min > activists) ?? null;
}

/** Capacité d'accueil : base, locaux actifs, adhésion à un parti, mandats en cours. */
export function activistCapacity(
	player: PlayerState,
	upgrades: readonly OwnedUpgrade[],
	mandates: readonly MandateInstance[],
	turn: number,
	content: Content
): number {
	const balance = content.balance.activists;
	// Un local ouvre ses portes au trimestre qui suit l'achat, comme toute amélioration.
	const premises = upgrades.reduce(
		(total, upgrade) =>
			upgrade.acquiredTurn < turn
				? total + (content.upgrades[upgrade.upgradeId]?.activists?.capacity ?? 0)
				: total,
		0
	);
	const offices = activeMandates(mandates).reduce(
		(total, mandate) =>
			total + (content.mandates[mandate.mandateId]?.rank ?? 0) * balance.mandateCapacityPerRank,
		0
	);
	return (
		balance.baseCapacity +
		premises +
		(player.partyId === null ? 0 : balance.partyCapacity) +
		offices
	);
}

function retentionPercent(
	upgrades: readonly OwnedUpgrade[],
	turn: number,
	content: Content
): number {
	return upgrades.reduce(
		(total, upgrade) =>
			upgrade.acquiredTurn < turn
				? total + (content.upgrades[upgrade.upgradeId]?.activists?.retentionPercent ?? 0)
				: total,
		0
	);
}

/** Bonus de terrain d'une action selon le palier (vide hors action de terrain ou sans base). */
export function fieldworkEffects(
	definition: ActionDefinition,
	activists: number,
	content: Content
): Effect[] {
	const unit = definition.fieldwork;
	const times = activistTier(activists, content).fieldMultiplier;
	if (!unit || times <= 0) return [];
	return [{ ...unit, value: unit.value * times }];
}

export interface ActivistsInputs {
	readonly turn: number;
	readonly upgrades: readonly OwnedUpgrade[];
	readonly mandates: readonly MandateInstance[];
	readonly campaigns: readonly Campaign[];
	/** Résultats des scrutins du joueur à cette frontière. */
	readonly deadlines: DeadlinesRecord | null;
}

export interface ActivistsResolution {
	readonly player: PlayerState;
	readonly resources: Resources;
	readonly record: ActivistsRecord;
}

/** Évolution trimestrielle de la base militante, cotisations et frais logistiques. */
export function resolveActivists(
	player: PlayerState,
	resources: Resources,
	inputs: ActivistsInputs,
	content: Content
): ActivistsResolution {
	const balance = content.balance.activists;
	const before = player.activists;
	const tierBefore = activistTier(before, content);
	const capacity = activistCapacity(player, inputs.upgrades, inputs.mandates, inputs.turn, content);

	// Cotisations et frais : payés sur le budget politique, jamais en dessous de zéro.
	const duesCents = before * balance.duesCents;
	const available = resources.politicalBudgetCents + duesCents;
	const upkeepCents = Math.min(tierBefore.upkeepCents, available);
	const unpaid = tierBefore.upkeepCents > available;

	// Arrivées : notoriété × engagement, freinées à l'approche de la capacité.
	const support = player.supports['support.activists'] ?? 0;
	const running = inputs.campaigns.filter((campaign) => campaign.status === 'running').length;
	const reach =
		Math.floor(Math.sqrt(resources.influence) * balance.reachInfluenceFactor) +
		Math.floor(player.exposure / balance.reachExposureDivisor) +
		running * balance.campaignReach;
	const engagement =
		Math.max(0, support - balance.attractionThreshold) * balance.attractionPercentPerPoint;
	const room = Math.max(0, capacity - before);
	const arrivals = Math.min(
		room,
		Math.round((reach * Math.min(100, engagement) * room) / (100 * Math.max(1, capacity)))
	);

	// Recrues d'un scrutin disputé, même perdu (pas après une invalidation).
	const recruits = Math.min(
		Math.max(0, room - arrivals),
		(inputs.deadlines?.campaigns ?? []).reduce(
			(total, result) =>
				result.playerPercent === null || result.status === 'disqualified'
					? total
					: total + Math.floor((result.playerPercent * balance.recruitsPerVoteTenths) / 10),
			0
		)
	);

	// Départs : usure, mécontentement, manque de place, frais impayés ; la permanence retient.
	const discontent =
		support < balance.discontentThreshold
			? Math.floor((balance.discontentThreshold - support) / balance.discontentDivisor)
			: 0;
	const crowded = before > capacity || unpaid ? balance.overCapacityAttritionPercent : 0;
	const attrition = Math.max(
		0,
		balance.baseAttritionPercent +
			discontent +
			crowded -
			retentionPercent(inputs.upgrades, inputs.turn, content)
	);
	// Arrondi au plus proche : un noyau de trois fidèles ne s'éteint pas mécaniquement.
	const departures = Math.min(before, Math.round((before * attrition) / 100));

	const total = before + arrivals + recruits - departures;
	return {
		player: { ...player, activists: total },
		resources: {
			...resources,
			politicalBudgetCents: available - upkeepCents
		},
		record: {
			arrivals,
			recruits,
			departures,
			total,
			capacity,
			tierBefore: tierBefore.id,
			tierAfter: activistTier(total, content).id,
			duesCents,
			upkeepCents
		}
	};
}
