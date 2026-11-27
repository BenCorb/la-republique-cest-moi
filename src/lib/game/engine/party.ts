/**
 * Carrière partisane (P3-34, décisions du créateur du 27 novembre 2026).
 *
 * - Statuts : militant à l'adhésion, cadre par opportunité (appui de
 *   l'appareil, base militante et ancienneté suffisants, puis une chance par
 *   trimestre), chef du parti après un congrès gagné. Pas de scission en V1.
 * - Congrès réguliers (`congressCycleTurns`) : un cadre qui a déclaré sa
 *   candidature (posture rassemblement, appareil ou rupture, ralliements)
 *   l'emporte selon une chance seedée, tirée une seule fois ; l'appréciation
 *   affichée est qualitative. Battu, il attend un congrès et perd de l'appui ;
 *   chef contesté (appareil trop faible), il peut être renversé.
 * - Un chef remplace les renouvellements autonomes de la direction (le monde
 *   ne tire plus de nouveau dirigeant pour son parti) et accède mieux aux
 *   investitures.
 *
 * Fonctions pures, tirages sur le PRNG reçu et seulement quand une décision
 * est possible : les autres tirages de la partie ne sont pas décalés.
 */
import type { Content } from '../content/types.ts';
import type { Turn } from './calendar.ts';
import { nextInt, type RngState } from './random.ts';
import type { PartyCareer, PlayerState, PoliticalChange, WorldState } from './state.ts';
import { applyPoliticalEffect } from './world.ts';

/** Facteur observable de l'appréciation d'un congrès. */
export interface CongressFactor {
	readonly label: string;
	readonly favorable: boolean;
}

/**
 * Appréciation d'une candidature à la direction : facteurs observables
 * (appareil, base militante, influence, ralliements, posture) et appréciation
 * qualitative ; la chance reste interne.
 */
export function congressAppraisal(
	player: PlayerState,
	influence: number,
	content: Content
): { chancePercent: number; label: string; factors: CongressFactor[] } {
	const rules = content.balance.partyCareer;
	const apparatus = player.supports[content.balance.campaigns.apparatusGroup] ?? 0;
	const base = Math.min(100, Math.floor(player.activists / 10));
	const bid = player.partyCareer?.bid ?? null;
	const rallies = Math.min(rules.rallyCap, (bid?.rallies ?? 0) * rules.rallyPoints);
	const posture =
		bid?.posture === 'unity'
			? player.popularity * 0.15
			: bid?.posture === 'apparatus'
				? apparatus * 0.15
				: bid?.posture === 'rupture'
					? base * 0.2
					: 0;
	const score =
		(apparatus * rules.apparatusPercent +
			base * rules.activistsPercent +
			Math.min(100, influence) * rules.influencePercent) /
			100 +
		rallies +
		posture;
	const chancePercent = Math.round(
		Math.min(rules.maxChancePercent, Math.max(rules.minChancePercent, score))
	);
	const factors: CongressFactor[] = [
		apparatus >= 50
			? { label: 'l’appareil vous suit', favorable: true }
			: { label: 'l’appareil hésite', favorable: false },
		base >= 30
			? { label: 'une base militante nombreuse', favorable: true }
			: { label: 'une base militante encore mince', favorable: false },
		influence >= 60
			? { label: 'une influence reconnue', favorable: true }
			: { label: 'une influence modeste', favorable: false },
		rallies > 0
			? { label: `${bid?.rallies ?? 0} ralliement(s) obtenu(s)`, favorable: true }
			: { label: 'aucun ralliement', favorable: false }
	];
	const label =
		chancePercent >= rules.favoriteFrom
			? 'Favori du congrès'
			: chancePercent >= rules.openFrom
				? 'Congrès ouvert'
				: 'Candidature d’outsider';
	return { chancePercent, label, factors };
}

/** Parti dirigé par le joueur, sinon `null`. */
export function partyLedByPlayer(player: PlayerState): string | null {
	return player.partyCareer?.rank === 'leader' ? player.partyId : null;
}

/**
 * Frontière du trimestre `turn` : promotion de cadre éventuelle, puis congrès
 * du parti s'il se tient à ce trimestre (candidature, contestation du chef).
 */
export function resolvePartyCareer(
	player: PlayerState,
	world: WorldState,
	influence: number,
	turn: Turn,
	rng: RngState,
	content: Content
): { player: PlayerState; rng: RngState; changes: PoliticalChange[] } {
	const career = player.partyCareer;
	const partyId = player.partyId;
	if (!career || partyId === null) return { player, rng, changes: [] };
	const rules = content.balance.partyCareer;
	const apparatus = player.supports[content.balance.campaigns.apparatusGroup] ?? 0;
	const changes: PoliticalChange[] = [];
	let current = rng;
	let next: PartyCareer = career;
	let updated = player;

	// Promotion de cadre par opportunité.
	if (
		next.rank === 'member' &&
		apparatus >= rules.cadreMinApparatus &&
		player.activists >= rules.cadreMinActivists &&
		turn - next.rankSince >= rules.cadreMinTurns
	) {
		const roll = nextInt(current, 1, 100);
		current = roll.rng;
		if (roll.value <= rules.cadreChancePercent) {
			next = { ...next, rank: 'cadre', rankSince: turn + 1 };
			changes.push({ kind: 'partyRank', partyId, rank: 'cadre', reason: 'promotion' });
		}
	}

	// Congrès du parti, à la fin de son trimestre.
	if (turn === next.nextCongressTurn) {
		const following = turn + rules.congressCycleTurns;
		const retryTurn = following + rules.retryCongresses * rules.congressCycleTurns;
		let apparatusLoss = 0;
		if (next.rank === 'leader') {
			let ousted = false;
			if (apparatus < rules.leaderChallengeApparatus) {
				const roll = nextInt(current, 1, 100);
				current = roll.rng;
				ousted = roll.value <= rules.leaderOustChancePercent;
			}
			next = ousted
				? { ...next, rank: 'cadre', rankSince: turn + 1, retryTurn }
				: { ...next, retryTurn: null };
			changes.push({
				kind: 'partyRank',
				partyId,
				rank: ousted ? 'cadre' : 'leader',
				reason: ousted ? 'ousted' : 'confirmed'
			});
			if (ousted) apparatusLoss = rules.defeatApparatus;
		} else if (next.rank === 'cadre' && next.bid) {
			const appraisal = congressAppraisal({ ...updated, partyCareer: next }, influence, content);
			const roll = nextInt(current, 1, 100);
			current = roll.rng;
			const won = roll.value <= appraisal.chancePercent;
			if (won) {
				next = { ...next, rank: 'leader', rankSince: turn + 1, retryTurn: null };
			} else {
				next = { ...next, retryTurn };
				apparatusLoss =
					next.bid?.posture === 'rupture' ? rules.defeatApparatus * 2 : rules.defeatApparatus;
			}
			changes.push({
				kind: 'partyRank',
				partyId,
				rank: won ? 'leader' : 'cadre',
				reason: won ? 'congress_won' : 'congress_lost'
			});
		}
		next = { ...next, nextCongressTurn: following, bid: null };
		if (apparatusLoss > 0) {
			const outcome = applyPoliticalEffect(
				{
					op: 'addSupport',
					group: content.balance.campaigns.apparatusGroup,
					value: -apparatusLoss
				},
				{ ...updated, partyCareer: next },
				world,
				turn,
				null,
				content
			);
			updated = outcome.player;
			changes.push(...outcome.changes);
		}
	}
	return { player: { ...updated, partyCareer: next }, rng: current, changes };
}
