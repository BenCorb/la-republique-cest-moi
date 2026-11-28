/**
 * Projection de l’organisation et de la base militante (fiches economie-et-organisation, soutiens-et-militants).
 *
 * Partie de la projection publique (`PlayerView`, ARCHITECTURE.md §9) : fonctions pures,
 * sans PRNG ni information cachée. Point d’entrée : `../view-model.ts`.
 */
import type { Content } from '../../content/types.ts';
import type { GameState, HistoryEntry, PlanPreview, PlanStep } from '../../engine/index.ts';
import {
	activeMandates,
	activistCapacity,
	activistTier,
	effectRange,
	eraReached,
	nextActivistTier
} from '../../engine/index.ts';
import { formatMoney } from '../format.ts';
import { addability } from './agenda.ts';
import type { ChipSense } from './shared.ts';
import { activistsWord, amounts, describeEffect, sumAmounts, upgradeLabel } from './shared.ts';

export interface ProducerView {
	readonly instanceId: string;
	readonly upgradeId: string;
	readonly label: string;
	readonly status: 'active' | 'suspended' | 'pending';
	readonly statusLabel: string;
	readonly upkeep: readonly string[];
	readonly production: readonly string[];
}

/**
 * Éléments de l'organisation regroupés par type (« Militant bénévole × 4 ») :
 * effectifs, charges et production cumulées ce trimestre, départ planifiable.
 */
export interface OrganisationGroupView {
	readonly upgradeId: string;
	readonly label: string;
	/** Exemplaires possédés au début du trimestre. */
	readonly owned: number;
	readonly active: number;
	readonly pending: number;
	readonly suspended: number;
	/** Départs déjà prévus dans le plan. */
	readonly releasesPlanned: number;
	readonly upkeep: readonly string[];
	readonly production: readonly string[];
	/** Effets propres d'un départ (par exemple sur les militants). */
	readonly releaseEffects: readonly string[];
	/** Prochain départ possible : étape à ajouter au plan, ou motif du refus. */
	readonly release: { readonly step: PlanStep | null; readonly reason: string | null } | null;
}

/**
 * Base militante (P3-19) : effectif, palier, prochain palier, capacité
 * d'accueil et ce qui la compose, dernier mouvement, effets du palier. Aucune
 * information cachée : tout se déduit de l'état public.
 */
export interface ActivistsView {
	readonly count: number;
	readonly countLabel: string;
	readonly tierLabel: string;
	/** Prochain palier et militants manquants, `null` au sommet. */
	readonly next: { readonly label: string; readonly missing: number } | null;
	/** Remplissage de la capacité, de 0 à 100. */
	readonly fillPercent: number;
	readonly capacity: number;
	/** Composantes de la capacité (« Base 15 », « Permanence 120 »…). */
	readonly capacityParts: readonly string[];
	/** Dernier trimestre (« +6 arrivées, −2 départs »), `null` avant le premier. */
	readonly lastMove: string | null;
	/** Effets du palier : bonus de terrain, cotisations, frais. */
	readonly perks: readonly string[];
	/**
	 * Leviers de la base (PT-B1-006), en langage de jeu et sans formule : ce qui
	 * fait venir des militants, ce qui les fait partir, et ce qui augmente
	 * durablement l'accueil, selon l'état public de la partie.
	 */
	readonly levers: {
		readonly arrivals: readonly ActivistLeverView[];
		readonly departures: readonly ActivistLeverView[];
		readonly capacity: readonly string[];
	};
}

/** Levier de la base militante : un constat et son sens (favorable, défavorable, neutre). */
export interface ActivistLeverView {
	readonly sense: ChipSense;
	readonly text: string;
}

export function buildActivists(state: GameState, content: Content): ActivistsView {
	const balance = content.balance.activists;
	const count = state.player.activists;
	const tier = activistTier(count, content);
	const next = nextActivistTier(count, content);
	const capacity = activistCapacity(
		state.player,
		state.upgrades,
		state.mandates,
		state.turn,
		content
	);
	const premises = new Map<string, number>();
	for (const upgrade of state.upgrades) {
		const definition = content.upgrades[upgrade.upgradeId];
		if (!definition?.activists || upgrade.acquiredTurn >= state.turn) continue;
		const label = definition.ownedLabel ?? definition.label;
		premises.set(label, (premises.get(label) ?? 0) + definition.activists.capacity);
	}
	const offices = activeMandates(state.mandates).reduce(
		(total, mandate) =>
			total + (content.mandates[mandate.mandateId]?.rank ?? 0) * balance.mandateCapacityPerRank,
		0
	);
	const capacityParts = [
		`Accueil de base ${balance.baseCapacity}`,
		...(state.player.partyId !== null ? [`Section du parti ${balance.partyCapacity}`] : []),
		...[...premises].map(([label, value]) => `${label} ${value}`),
		...(offices > 0 ? [`Mandats ${offices}`] : [])
	];
	const last = state.history.findLast(
		(entry): entry is HistoryEntry => entry.type === 'turn.resolved'
	)?.activists;
	const lastMove = last
		? last.arrivals + last.recruits === 0 && last.departures === 0
			? 'Aucun mouvement au dernier trimestre'
			: `Dernier trimestre : ${[
					`${last.arrivals} arrivée${last.arrivals > 1 ? 's' : ''}`,
					...(last.recruits > 0
						? [`${last.recruits} recrue${last.recruits > 1 ? 's' : ''} après le scrutin`]
						: []),
					`${last.departures} départ${last.departures > 1 ? 's' : ''}`
				].join(', ')}`
		: null;
	const perks = [
		tier.fieldMultiplier > 0
			? `Actions de terrain : bonus × ${tier.fieldMultiplier}`
			: 'Actions de terrain : aucun bonus (il faut un noyau de 5 militants)',
		...(balance.duesCents > 0 && count > 0
			? [`Cotisations : ${formatMoney(count * balance.duesCents)} par trimestre`]
			: []),
		...(tier.upkeepCents > 0
			? [`Frais logistiques : ${formatMoney(tier.upkeepCents)} par trimestre`]
			: [])
	];
	return {
		count,
		countLabel: activistsWord(count),
		tierLabel: tier.label,
		next: next ? { label: next.label, missing: next.min - count } : null,
		fillPercent: capacity > 0 ? Math.min(100, Math.round((count * 100) / capacity)) : 100,
		capacity,
		capacityParts,
		lastMove,
		perks,
		levers: activistLevers(state, content, capacity)
	};
}

/**
 * Leviers de la base militante (PT-B1-006) : constats tirés de l'état public
 * (soutien des militants, campagnes, capacité, locaux, adhésion), jamais la
 * formule ni un tirage.
 */
function activistLevers(
	state: GameState,
	content: Content,
	capacity: number
): ActivistsView['levers'] {
	const balance = content.balance.activists;
	const count = state.player.activists;
	const support = state.player.supports['support.activists'] ?? 0;
	const running = state.campaigns.some((campaign) => campaign.status === 'running');
	const active = (upgradeId: string): boolean =>
		state.upgrades.some(
			(upgrade) => upgrade.upgradeId === upgradeId && upgrade.acquiredTurn < state.turn
		);
	const retaining = content.upgradeIds.some(
		(id) => (content.upgrades[id]?.activists?.retentionPercent ?? 0) > 0 && active(id)
	);
	const arrivals: ActivistLeverView[] = [
		{
			sense: 'neutral',
			text: 'Votre influence et votre exposition font connaître votre nom auprès des sympathisants.'
		},
		support > balance.attractionThreshold
			? {
					sense: 'gain',
					text: 'Le soutien des militants convainc une partie de ces sympathisants de s’engager : plus il est haut, plus ils viennent.'
				}
			: {
					sense: 'cost',
					text: 'Le soutien des militants est trop bas : personne ne s’engage, quelle que soit votre notoriété.'
				},
		running
			? { sense: 'gain', text: 'Votre campagne en cours attire du monde chaque trimestre.' }
			: {
					sense: 'neutral',
					text: 'Une candidature attire du monde pendant la campagne, puis des recrues après le scrutin, même battue.'
				},
		...(count >= capacity
			? [
					{
						sense: 'cost' as const,
						text: 'Vos places d’accueil sont toutes occupées : plus personne ne peut s’engager.'
					}
				]
			: count * 10 >= capacity * 8
				? [
						{
							sense: 'cost' as const,
							text: 'Vos places d’accueil sont presque pleines : les arrivées ralentissent.'
						}
					]
				: [])
	];
	const departures: ActivistLeverView[] = [
		{
			sense: 'neutral',
			text: retaining
				? 'Chaque trimestre, quelques militants s’éloignent ; vos locaux en retiennent une partie.'
				: 'Chaque trimestre, quelques militants s’éloignent ; un local en retiendrait une partie.'
		},
		...(support < balance.discontentThreshold
			? [
					{
						sense: 'cost' as const,
						text: 'Le soutien des militants est bas : des départs par mécontentement s’ajoutent.'
					}
				]
			: []),
		...(count > capacity
			? [
					{
						sense: 'cost' as const,
						text: 'Plus de militants que de places : les départs s’accélèrent.'
					}
				]
			: [])
	];
	const capacityOptions = [
		...(state.player.partyId === null
			? [`Adhérer à un parti : + ${balance.partyCapacity} places (section locale)`]
			: []),
		...content.upgradeIds.flatMap((id) => {
			const upgrade = content.upgrades[id]!;
			if (!upgrade.activists || !eraReached(upgrade.fromEra, state.turn, content)) return [];
			const owned = state.upgrades.filter((item) => item.upgradeId === id).length;
			if (owned >= upgrade.maxOwned) return [];
			return [
				`${upgrade.label} : + ${upgrade.activists.capacity} places, dès le trimestre suivant`
			];
		}),
		`Exercer un mandat : + ${balance.mandateCapacityPerRank} places par rang du mandat, plus pour une fonction importante`
	];
	return { arrivals, departures, capacity: capacityOptions };
}

/** Organisation regroupée par type d'amélioration, dans l'ordre du catalogue. */
export function buildOrganisation(
	state: GameState,
	plan: readonly PlanStep[],
	preview: PlanPreview,
	content: Content
): OrganisationGroupView[] {
	const releaseActionId =
		content.actionIds.find((id) => content.actions[id]?.target === 'upgrade') ?? null;
	return content.upgradeIds.flatMap((upgradeId) => {
		const definition = content.upgrades[upgradeId]!;
		// Les actifs patrimoniaux ont leur propre écran (P3-02).
		if (definition.asset) return [];
		const owned = state.upgrades.filter((upgrade) => upgrade.upgradeId === upgradeId);
		// Une amélioration d'une époque à venir reste invisible (P3-07).
		if (owned.length === 0 && !eraReached(definition.fromEra, state.turn, content)) return [];
		const forecasts = preview.producers.filter((producer) => producer.upgradeId === upgradeId);
		const releasing = new Set(
			plan.flatMap((step) =>
				step.kind === 'action' && step.id === releaseActionId && step.target ? [step.target] : []
			)
		);
		const releasesPlanned = owned.filter((upgrade) => releasing.has(upgrade.instanceId)).length;
		if (owned.length === 0 && forecasts.length === 0) return [];

		// Le plus récent des exemplaires encore présents part en premier.
		const candidate = [...owned].reverse().find((upgrade) => !releasing.has(upgrade.instanceId));
		let release: OrganisationGroupView['release'] = null;
		if (releaseActionId && state.phase === 'planning' && owned.length > 0) {
			if (!candidate) {
				release = { step: null, reason: 'Tous les départs sont déjà prévus.' };
			} else {
				const step: PlanStep = {
					kind: 'action',
					id: releaseActionId,
					target: candidate.instanceId
				};
				const check = addability(state, plan, step, content);
				release = check.addable ? { step, reason: null } : { step: null, reason: check.reason };
			}
		}
		const count = (status: string): number =>
			forecasts.filter((producer) => producer.status === status).length;
		return [
			{
				upgradeId,
				label: upgradeLabel(upgradeId, state, content, true),
				owned: owned.length,
				active: count('active'),
				pending: count('pending'),
				suspended: count('suspended'),
				releasesPlanned,
				upkeep: amounts(sumAmounts(forecasts.map((producer) => producer.upkeep)), -1),
				production: amounts(sumAmounts(forecasts.map((producer) => producer.production)), 1),
				releaseEffects: (definition.releaseEffects ?? []).map((effect) =>
					describeEffect(effectRange(effect), content)
				),
				release
			}
		];
	});
}
