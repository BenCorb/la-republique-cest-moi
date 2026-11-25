/**
 * Groupes de soutien et popularité (GDD §4.4) — P2-07.
 *
 * - Soutien de chaque groupe envers le joueur : entier de 0 à 100, public
 *   (sondages), modifié par les actions et les choix (`addSupport`).
 * - Popularité : moyenne des seuls groupes électoraux, pondérée par leur poids ;
 *   les groupes d'influence (militants, appareil, milieux d'affaires) ne
 *   comptent jamais dans les voix. Elle est recalculée à chaque variation.
 * - Évolution à la frontière : chaque soutien revient en partie vers sa
 *   référence (niveau de départ, affinité entre le parti du joueur et les
 *   attentes du groupe, bonus d'adhésion et de mandats, notoriété tirée de
 *   l'influence pour les groupes électoraux). Aucun tirage : les
 *   soutiens ne dépendent ni du hasard ni des traits cachés des personnages.
 */
import { AXIS_IDS, GAUGE_MAX, GAUGE_MIN, type Content } from '../content/types.ts';
import { activeMandates } from './career.ts';
import type { MandateInstance, PlayerState } from './state.ts';

function clamp(value: number): number {
	return Math.min(GAUGE_MAX, Math.max(GAUGE_MIN, value));
}

/** Popularité : moyenne des soutiens électoraux pondérée par les poids, arrondie. */
export function computePopularity(
	supports: Readonly<Record<string, number>>,
	content: Content
): number {
	let total = 0;
	let weights = 0;
	for (const groupId of content.supportGroupIds) {
		const group = content.supportGroups[groupId];
		if (!group || group.kind !== 'electoral') continue;
		total += (supports[groupId] ?? 0) * group.weight;
		weights += group.weight;
	}
	return weights > 0 ? Math.round(total / weights) : 0;
}

/** Joueur dont la popularité est recalculée d'après ses soutiens. */
export function withPopularity(player: PlayerState, content: Content): PlayerState {
	const popularity = computePopularity(player.supports, content);
	return popularity === player.popularity ? player : { ...player, popularity };
}

/** Soutiens de départ, dans l'ordre du catalogue. */
export function startingSupports(content: Content): Record<string, number> {
	return Object.fromEntries(
		content.supportGroupIds.map((groupId) => [
			groupId,
			content.supportGroups[groupId]?.startingSupport ?? 0
		])
	);
}

/**
 * Affinité de -1 à 1 entre les positions du parti et les attentes du groupe :
 * 1 pour des positions identiques, 0 pour un écart moyen de 100 sur les axes.
 */
export function partyAffinity(partyId: string | null, groupId: string, content: Content): number {
	const party = partyId ? content.parties[partyId] : undefined;
	const group = content.supportGroups[groupId];
	if (!party || !group) return 0;
	const distance =
		AXIS_IDS.reduce(
			(sum, axis) => sum + Math.abs(party.positions[axis] - group.preferences[axis]),
			0
		) / AXIS_IDS.length;
	return Math.max(-1, Math.min(1, 1 - distance / 100));
}

/** Niveau vers lequel le soutien d'un groupe revient en l'absence d'événement. */
export function supportReference(
	groupId: string,
	player: PlayerState,
	mandates: readonly MandateInstance[],
	influence: number,
	content: Content
): number {
	const group = content.supportGroups[groupId];
	if (!group) return 0;
	const affiliated = player.partyId !== null;
	const alignment =
		group.judgesParty && affiliated
			? Math.round(
					partyAffinity(player.partyId, groupId, content) *
						content.balance.supports.partyAlignmentMax
				)
			: 0;
	const { influencePerPoint, notorietyMax } = content.balance.supports;
	const notoriety =
		group.kind === 'electoral'
			? Math.min(notorietyMax, Math.floor(influence / influencePerPoint))
			: 0;
	return clamp(
		group.startingSupport +
			notoriety +
			alignment +
			(affiliated ? group.affiliationBonus : 0) +
			group.mandateBonus * activeMandates(mandates).length
	);
}

export interface FrontierSupports {
	readonly player: PlayerState;
	readonly record: readonly { readonly groupId: string; readonly delta: number }[];
}

/**
 * Évolution à la frontière : retour d'une part de l'écart à la référence
 * (arrondi vers zéro, au moins 1 point tant qu'un écart subsiste).
 */
export function resolveSupports(
	player: PlayerState,
	mandates: readonly MandateInstance[],
	influence: number,
	content: Content
): FrontierSupports {
	const supports: Record<string, number> = { ...player.supports };
	const record: { groupId: string; delta: number }[] = [];
	if (content.balance.supports.reversionPercent <= 0) return { player, record };
	for (const groupId of content.supportGroupIds) {
		const value = supports[groupId] ?? 0;
		const gap = supportReference(groupId, player, mandates, influence, content) - value;
		if (gap === 0) continue;
		const step = Math.trunc((gap * content.balance.supports.reversionPercent) / 100);
		const delta = step !== 0 ? step : Math.sign(gap);
		supports[groupId] = clamp(value + delta);
		record.push({ groupId, delta: supports[groupId] - value });
	}
	return { player: withPopularity({ ...player, supports }, content), record };
}
