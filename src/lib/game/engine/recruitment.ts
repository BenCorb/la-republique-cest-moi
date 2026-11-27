/**
 * Recrutement (P3-20, PT-P3-09-005/006, GDD §6.2).
 *
 * - Salaire : chaque candidat demande un salaire selon sa compétence (courbe
 *   interpolée, en % du salaire de référence du poste). Le salaire convenu est
 *   inscrit au contrat (`StaffMember.salaryCents`) : réserve, paie, alertes et
 *   projections le relisent, jamais le tarif du poste.
 * - Attractivité de la carrière, de 0 à 100 : influence (√), popularité, rang
 *   du mandat principal, appui de l'appareil et trimestres de masse salariale
 *   couverts. Elle gradue le vivier spontané et pèse sur l'acceptation. Ce
 *   n'est pas une jauge morale ; l'interface la résume en mots.
 * - Acceptation : marge = attractivité + offre + entretiens − exigence
 *   (une part de la compétence) ; chance bornée. Le tirage est une empreinte
 *   de la seed, du trimestre et du candidat : reproductible, sans décaler le
 *   PRNG, et effectué seulement à l'exécution (la prévision suppose l'accord).
 * - Trois offres (réduite, standard, généreuse) ; la généreuse ajoute une
 *   prime versée avec le premier salaire, donc jamais en cas de refus.
 *
 * Valeurs provisoires de `balance.entourage.recruitment`.
 */
import type { Content, HireOffer, SearchLevel, VettingLevel } from '../content/types.ts';
import { mainMandate } from './career.ts';
import { hashSeed } from './random.ts';
import type { Character, MandateInstance, PlayerState, StaffMember } from './state.ts';
import type { Resources } from '../content/types.ts';

/** Salaire demandé par un candidat de cette compétence pour ce poste, en centimes. */
export function askedSalaryCents(postId: string, competence: number, content: Content): number {
	const reference = content.posts[postId]?.salaryCents ?? 0;
	const { salaryCurve, salaryRoundingCents } = content.balance.entourage.recruitment;
	const first = salaryCurve[0]!;
	const last = salaryCurve.at(-1)!;
	let percent: number;
	if (competence <= first.competence) percent = first.percent;
	else if (competence >= last.competence) percent = last.percent;
	else {
		const upper = salaryCurve.findIndex((point) => point.competence >= competence);
		const high = salaryCurve[upper]!;
		const low = salaryCurve[upper - 1]!;
		percent =
			low.percent +
			((high.percent - low.percent) * (competence - low.competence)) /
				(high.competence - low.competence);
	}
	const raw = (reference * percent) / 100;
	return Math.max(salaryRoundingCents, Math.round(raw / salaryRoundingCents) * salaryRoundingCents);
}

/** Salaire convenu pour une offre (arrondi comme la prétention). */
export function offeredSalaryCents(
	postId: string,
	competence: number,
	offer: HireOffer,
	content: Content
): number {
	const { offers, salaryRoundingCents } = content.balance.entourage.recruitment;
	const asked = askedSalaryCents(postId, competence, content);
	return Math.max(
		salaryRoundingCents,
		Math.round((asked * offers[offer].salaryPercent) / 100 / salaryRoundingCents) *
			salaryRoundingCents
	);
}

/** Prime d'arrivée d'une offre, payée avec le premier salaire. */
export function offerBonusCents(salaryCents: number, offer: HireOffer, content: Content): number {
	return Math.round(
		(salaryCents * content.balance.entourage.recruitment.offers[offer].bonusPercent) / 100
	);
}

/** Masse salariale trimestrielle des collaborateurs en poste (salaires convenus). */
export function payrollCents(staff: readonly StaffMember[]): number {
	return staff
		.filter((member) => member.status === 'active')
		.reduce((total, member) => total + member.salaryCents, 0);
}

/** Facteurs de l'attractivité, chacun plafonné ; leur somme est l'attractivité. */
export interface AttractivenessFactors {
	readonly influence: number;
	readonly popularity: number;
	readonly mandate: number;
	readonly apparatus: number;
	readonly payroll: number;
}

export function attractivenessFactors(
	player: PlayerState,
	resources: Resources,
	mandates: readonly MandateInstance[],
	staff: readonly StaffMember[],
	content: Content
): AttractivenessFactors {
	const balance = content.balance.entourage.recruitment;
	const main = mainMandate(mandates, content);
	const rank = main ? (content.mandates[main.mandateId]?.rank ?? 0) : 0;
	// Trimestres de masse salariale couverts, un salaire de référence moyen compris.
	const references = content.postIds.map((id) => content.posts[id]?.salaryCents ?? 0);
	const average = references.length
		? references.reduce((total, value) => total + value, 0) / references.length
		: 0;
	const payroll = payrollCents(staff) + average;
	const covered =
		payroll > 0 ? resources.politicalBudgetCents / payroll : balance.coveredQuartersForMax;
	return {
		influence: Math.min(
			balance.influenceMax,
			Math.floor(Math.sqrt(Math.max(0, resources.influence)) * balance.influencePerRoot)
		),
		popularity: Math.floor((Math.min(100, player.popularity) * balance.popularityMax) / 100),
		mandate: Math.floor(
			(Math.min(rank, balance.mandateRankForMax) * balance.mandateMax) / balance.mandateRankForMax
		),
		apparatus: Math.floor(
			(Math.min(100, player.supports[content.balance.campaigns.apparatusGroup] ?? 0) *
				balance.apparatusMax) /
				100
		),
		payroll: Math.floor(
			(Math.min(covered, balance.coveredQuartersForMax) * balance.payrollMax) /
				balance.coveredQuartersForMax
		)
	};
}

export function attractiveness(factors: AttractivenessFactors): number {
	return Math.min(
		100,
		factors.influence + factors.popularity + factors.mandate + factors.apparatus + factors.payroll
	);
}

/** Chance d'accepter une offre, en %, à partir de données publiques seulement. */
export function acceptancePercent(
	attraction: number,
	competence: number,
	offer: HireOffer,
	interviews: number,
	content: Content
): number {
	const balance = content.balance.entourage.recruitment;
	const margin =
		attraction +
		balance.offers[offer].interest +
		Math.min(interviews, balance.maxInterviews) * balance.interviewInterest -
		Math.round((competence * balance.demandPercent) / 100);
	return Math.max(
		balance.minAcceptPercent,
		Math.min(balance.maxAcceptPercent, balance.baseAcceptPercent + margin * balance.acceptPerPoint)
	);
}

/**
 * Tirage d'acceptation, de 0 à 99 : empreinte de la seed de la partie, du
 * trimestre et du candidat. Accepte si le tirage est inférieur à la chance.
 */
export function acceptanceRoll(seed: string, turn: number, candidateId: string): number {
	return hashSeed(`${seed}:recrutement:${turn}:${candidateId}`) % 100;
}

// ---------------------------------------------------------------------------
// Recrutement II (P3-21) : recherche, vérification, progression
// ---------------------------------------------------------------------------

/**
 * Cible d'une recherche : `post.x`, ou `post.x/trait.y` quand un trait public
 * est exigé. Ne vérifie pas l'existence des identifiants.
 */
export function parseSearchTarget(target: string): { postId: string; trait: string | null } {
	const slash = target.indexOf('/');
	return slash < 0
		? { postId: target, trait: null }
		: { postId: target.slice(0, slash), trait: target.slice(slash + 1) };
}

export function searchTarget(postId: string, trait: string | null): string {
	return trait === null ? postId : `${postId}/${trait}`;
}

/** Chance de trouver, en % : celle du niveau, moins la pénalité d'un trait exigé. */
export function searchFindPercent(
	level: SearchLevel,
	trait: string | null,
	content: Content
): number {
	const search = content.balance.entourage.search;
	return Math.max(0, search.levels[level].findPercent - (trait === null ? 0 : search.traitPenalty));
}

/** Part du prix rendue quand la recherche échoue ou devient sans objet. */
export function searchRefundCents(level: SearchLevel, content: Content): number {
	const search = content.balance.entourage.search;
	return Math.round((search.levels[level].costCents * search.failureRefundPercent) / 100);
}

/**
 * Traits cachés signalés par une vérification de dossier : chaque trait caché
 * encore inconnu est signalé avec une probabilité qui dépend de sa présence
 * réelle (`truePercent`) ou de son absence (`falsePercent`). Le tirage est une
 * empreinte de la seed, du trimestre, du candidat et du trait : reproductible,
 * sans décaler le PRNG. Un indice n'est jamais une certitude.
 */
export function vetHints(
	seed: string,
	turn: number,
	character: Pick<Character, 'id' | 'traits' | 'knownTraits'>,
	level: VettingLevel,
	content: Content
): string[] {
	const { truePercent, falsePercent } = content.balance.entourage.vetting[level];
	return content.traitIds.filter((traitId) => {
		if (!content.traits[traitId]?.hidden || character.knownTraits.includes(traitId)) return false;
		const roll = hashSeed(`${seed}:dossier:${turn}:${character.id}:${traitId}`) % 100;
		return roll < (character.traits.includes(traitId) ? truePercent : falsePercent);
	});
}

/** Progression d'un collaborateur par trimestre exercé, en dixièmes de point (interpolée). */
export function progressionTenths(competence: number, content: Content): number {
	const curve = content.balance.entourage.progression.curve;
	const first = curve[0]!;
	const last = curve.at(-1)!;
	if (competence <= first.competence) return first.tenths;
	if (competence >= last.competence) return last.tenths;
	const upper = curve.findIndex((point) => point.competence >= competence);
	const high = curve[upper]!;
	const low = curve[upper - 1]!;
	return Math.round(
		low.tenths +
			((high.tenths - low.tenths) * (competence - low.competence)) /
				(high.competence - low.competence)
	);
}
