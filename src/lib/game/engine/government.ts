/**
 * Gouvernement (P3-35, décisions du créateur du 27 novembre 2026).
 *
 * - Le président (personnage du monde) nomme le Premier ministre dans la
 *   majorité issue des législatives : son dirigeant. Cohabitation quand le
 *   président est d'un autre parti.
 * - Formation (législatives tenues ou alternance) et remaniements (stabilité
 *   basse, chance par trimestre) : un membre de la majorité dont la stature
 *   suffit reçoit une proposition — secrétariat d'État, puis ministère et son
 *   portefeuille tiré parmi les huit jouables. Un membre du gouvernement trop
 *   impopulaire est remercié au remaniement ; un secrétaire d'État d'assez
 *   grande stature peut être promu ministre.
 * - La proposition attend la réponse du joueur (événement bloquant) ; elle est
 *   tranchée une seule fois. Les fonctions prennent fin avec le gouvernement.
 */
import type { Content } from '../content/types.ts';
import type { Turn } from './calendar.ts';
import {
	activeMandates,
	endMandates,
	isIneligible,
	mainMandate,
	type CareerParts
} from './career.ts';
import { nextInt, type RngState } from './random.ts';
import type { PlayerState, PoliticalChange, WorldState } from './state.ts';

export const SECRETARY_MANDATE = 'mandate.secretary_of_state';
export const MINISTER_MANDATE = 'mandate.minister';
export const PRIME_MINISTER_MANDATE = 'mandate.prime_minister';

/** Stature gouvernementale : influence, popularité, rang du mandat principal, rang dans le parti. */
export function governmentStature(
	player: PlayerState,
	influence: number,
	career: Pick<CareerParts, 'mandates'>,
	content: Content
): number {
	const main = mainMandate(career.mandates, content);
	const rank = main ? (content.mandates[main.mandateId]?.rank ?? 0) : 0;
	const party = player.partyCareer?.rank;
	return Math.round(
		Math.min(50, influence / 2) +
			player.popularity / 2 +
			rank / 2 +
			(party === 'leader' ? 15 : party === 'cadre' ? 5 : 0)
	);
}

/** Fonction gouvernementale exercée par le joueur, sinon `null`. */
export function governmentPost(career: Pick<CareerParts, 'mandates'>): string | null {
	return (
		activeMandates(career.mandates).find(
			(mandate) =>
				mandate.mandateId === SECRETARY_MANDATE ||
				mandate.mandateId === MINISTER_MANDATE ||
				mandate.mandateId === PRIME_MINISTER_MANDATE
		)?.mandateId ?? null
	);
}

export interface GovernmentTrigger {
	/** Législatives tenues à cette frontière (nouveau gouvernement). */
	readonly legislative: boolean;
}

/**
 * Formation ou remaniement à la frontière du trimestre `turn` : départ du
 * joueur impopulaire, promotion ou proposition d'entrée au gouvernement.
 */
export function resolveGovernment(
	career: CareerParts,
	player: PlayerState,
	world: WorldState,
	influence: number,
	trigger: GovernmentTrigger,
	turn: Turn,
	rng: RngState,
	content: Content
): { career: CareerParts; rng: RngState; changes: PoliticalChange[] } {
	const rules = content.balance.government;
	let current = rng;
	let reshuffle = false;
	if (
		!trigger.legislative &&
		rules.reshuffleChancePercent > 0 &&
		world.indicators.stability <= rules.reshuffleStability
	) {
		const roll = nextInt(current, 1, 100);
		current = roll.rng;
		reshuffle = roll.value <= rules.reshuffleChancePercent;
	}
	if (!trigger.legislative && !reshuffle) return { career, rng: current, changes: [] };
	if (career.appointment !== null) return { career, rng: current, changes: [] };

	const changes: PoliticalChange[] = [];
	const post = governmentPost(career);
	let promoteToMatignon = false;
	const stature = governmentStature(player, influence, career, content);
	let parts = career;

	if (post !== null) {
		// Remaniement : l'impopulaire est remercié, le secrétaire d'État reconnu promu.
		if (player.popularity < rules.keepPopularity) {
			const ended = endMandates(
				parts.mandates,
				(mandate) => mandate.mandateId === post,
				'removed',
				turn
			);
			parts = { ...parts, mandates: ended.mandates };
			changes.push(...ended.changes);
			return { career: parts, rng: current, changes };
		}
		if (post === PRIME_MINISTER_MANDATE) return { career: parts, rng: current, changes };
		// Matignon (P3-36) : le chef du parti majoritaire, ou un ministre de très grande
		// stature, que le président choisit dans une partie des remaniements seulement.
		let matignon =
			trigger.legislative &&
			player.partyCareer?.rank === 'leader' &&
			player.partyId === world.governingPartyId;
		if (!matignon && post === MINISTER_MANDATE && stature >= rules.primeMinisterStature) {
			const roll = nextInt(current, 1, 100);
			current = roll.rng;
			matignon = roll.value <= rules.primeMinisterChancePercent;
		}
		promoteToMatignon = matignon;
		if (!matignon && (post !== SECRETARY_MANDATE || stature < rules.ministerStature)) {
			return { career: parts, rng: current, changes };
		}
	} else if (
		player.partyId === null ||
		player.partyId !== world.governingPartyId ||
		isIneligible(player, turn) ||
		stature < rules.secretaryStature
	) {
		return { career: parts, rng: current, changes };
	}

	// Matignon (P3-36) : le chef du parti majoritaire, ou une stature exceptionnelle.
	// Le chef du parti majoritaire est appelé à Matignon à la formation du gouvernement.
	const primeMinister =
		promoteToMatignon ||
		(trigger.legislative &&
			player.partyCareer?.rank === 'leader' &&
			player.partyId === world.governingPartyId);
	const minister = !primeMinister && stature >= rules.ministerStature;
	let portfolio: string | null = null;
	if (minister && content.portfolioIds.length > 0) {
		const draw = nextInt(current, 0, content.portfolioIds.length - 1);
		current = draw.rng;
		portfolio = content.portfolioIds[draw.value]!;
	}
	const mandateId = primeMinister
		? PRIME_MINISTER_MANDATE
		: minister
			? MINISTER_MANDATE
			: SECRETARY_MANDATE;
	parts = {
		...parts,
		appointment: { mandateId, portfolio, offeredTurn: turn, reshuffle: post !== null }
	};
	changes.push({ kind: 'appointment', mandateId, portfolio, status: 'offered' });
	return { career: parts, rng: current, changes };
}
