/**
 * Entourage et délégation (GDD §5.3, §6.2–6.3) — P2-05.
 *
 * - Postes clés débloqués par des conditions ; pour chaque poste vacant et
 *   débloqué, une présélection de candidats aux profils contrastés est générée
 *   à la frontière (compétence visible, traits partiellement connus).
 * - Embauche et renvoi passent par le plan (actions ciblées) ; un collaborateur
 *   embauché au trimestre T produit à partir de T+1, comme tout producteur.
 * - Chaque trimestre : salaire prélevé sur le budget politique (impayé : pas de
 *   production, loyauté en baisse), puis mission persistante dont les effets
 *   sont proportionnels à la compétence ; certaines missions rendent du temps
 *   ou resserrent les sondages.
 * - À la frontière : départ des collaborateurs qui ont quitté la vie publique
 *   et démission de ceux dont l'attitude est tombée trop bas.
 * Les tirages (présélections) passent par le PRNG de la partie, dans l'ordre
 * du catalogue des postes.
 */
import {
	GAUGE_MAX,
	GAUGE_MIN,
	type CandidateProfileDefinition,
	type Content,
	type Effect,
	type HireOffer,
	type ResourceId,
	type SearchLevel
} from '../content/types.ts';
import {
	acceptancePercent,
	acceptanceRoll,
	attractiveness,
	attractivenessFactors,
	askedSalaryCents,
	offerBonusCents,
	offeredSalaryCents,
	parseSearchTarget,
	payrollCents,
	progressionTenths,
	searchFindPercent,
	searchRefundCents,
	vetHints
} from './recruitment.ts';
import type { Turn } from './calendar.ts';
import { applyCareerEffect, type CareerParts } from './career.ts';
import { addRelation, generatePerson, meet } from './characters.ts';
import { evaluateCondition, type ConditionContext } from './conditions.ts';
import { gaugeKey } from './effects.ts';
import { nextInt, type RngState } from './random.ts';
import type {
	Character,
	PlayerState,
	PoliticalChange,
	RecruitmentSearch,
	Relationship,
	ResourceChange,
	ScheduledEvent,
	SearchOutcomeRecord,
	ShortlistEntry,
	StaffLeaveReason,
	StaffMember,
	StaffProductionRecord,
	StaffRecord,
	WorldState
} from './state.ts';
import type { Resources } from '../content/types.ts';
import { applyPoliticalEffect } from './world.ts';

/** Parties de l'état propres à l'entourage. */
export interface EntourageParts {
	readonly staff: readonly StaffMember[];
	readonly shortlists: Readonly<Record<string, readonly ShortlistEntry[]>>;
	readonly characters: Readonly<Record<string, Character>>;
	readonly relationships: Readonly<Record<string, Relationship>>;
	/** Recherches de candidats en cours (P3-21). */
	readonly searches: readonly RecruitmentSearch[];
}

export function activeStaff(staff: readonly StaffMember[]): StaffMember[] {
	return staff.filter((member) => member.status === 'active');
}

export function occupantOf(staff: readonly StaffMember[], postId: string): StaffMember | null {
	return activeStaff(staff).find((member) => member.postId === postId) ?? null;
}

/** Le poste est-il accessible (condition de déblocage remplie) ? */
export function postUnlocked(postId: string, context: ConditionContext, content: Content): boolean {
	const post = content.posts[postId];
	if (!post) return false;
	return post.requires === undefined || evaluateCondition(context, post.requires);
}

/** Valeur d'un effet de mission selon la compétence (la référence produit l'effet de base). */
export function scaledValue(value: number, competence: number, content: Content): number {
	return Math.round((value * competence) / content.balance.entourage.competenceReference);
}

/** Collaborateurs qui produisent au trimestre `turn` (embauchés avant lui). */
function producing(staff: readonly StaffMember[], turn: Turn): StaffMember[] {
	return activeStaff(staff).filter((member) => member.hiredTurn < turn);
}

/** Temps rendu au joueur ce trimestre par les missions qui libèrent son agenda. */
export function staffTimeBonus(
	staff: readonly StaffMember[],
	characters: Readonly<Record<string, Character>>,
	turn: Turn,
	content: Content
): number {
	return producing(staff, turn).reduce((total, member) => {
		const mission = content.missions[member.missionId];
		const competence = characters[member.characterId]?.competence ?? 0;
		return total + (mission ? Math.max(0, scaledValue(mission.timeBonus, competence, content)) : 0);
	}, 0);
}

/**
 * Compétence du collaborateur qui sonde l'électorat (mission `pollPrecision`),
 * ou `null` : elle resserre la fourchette des sondages publiés.
 */
export function pollingCompetence(
	staff: readonly StaffMember[],
	characters: Readonly<Record<string, Character>>,
	turn: Turn,
	content: Content
): number | null {
	let best: number | null = null;
	for (const member of producing(staff, turn)) {
		if (!content.missions[member.missionId]?.pollPrecision) continue;
		const competence = characters[member.characterId]?.competence ?? 0;
		best = Math.max(best ?? 0, competence);
	}
	return best;
}

/** Montant en euros entiers, espace fine insécable entre les milliers (« 3 000 € »). */
function euros(cents: number): string {
	const whole = String(Math.ceil(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
	return `${whole} €`;
}

/**
 * Réserve exigée pour recruter : `hireReserveQuarters` trimestres de la masse
 * salariale convenue de l'entourage en poste, augmentée du salaire offert au
 * nouveau venu (P3-20), plus sa prime éventuelle.
 */
export function hireReserveCents(
	staff: readonly StaffMember[],
	salaryCents: number,
	content: Content,
	bonusCents = 0
): number {
	return (
		(payrollCents(staff) + salaryCents) * content.balance.entourage.hireReserveQuarters + bonusCents
	);
}

/** Poste pour lequel ce personnage est présélectionné, ou `null`. */
export function shortlistPostOf(candidateId: string, parts: EntourageParts): string | null {
	return (
		Object.keys(parts.shortlists).find((id) =>
			parts.shortlists[id]?.some((entry) => entry.characterId === candidateId)
		) ?? null
	);
}

/** Conditions d'une offre d'embauche (P3-20) : salaire convenu et prime. */
export function hireTerms(
	candidateId: string,
	parts: EntourageParts,
	offer: HireOffer | 'counter',
	content: Content
): { postId: string; salaryCents: number; bonusCents: number } | null {
	const postId = shortlistPostOf(candidateId, parts);
	const candidate = parts.characters[candidateId];
	if (!postId || !candidate) return null;
	if (offer === 'counter') {
		// Contre-proposition (P3-33) : le salaire annoncé, sans prime.
		const counter = parts.shortlists[postId]?.find(
			(entry) => entry.characterId === candidateId
		)?.counterOffer;
		return counter ? { postId, salaryCents: counter.salaryCents, bonusCents: 0 } : null;
	}
	const salaryCents = offeredSalaryCents(postId, candidate.competence, offer, content);
	return { postId, salaryCents, bonusCents: offerBonusCents(salaryCents, offer, content) };
}

/**
 * Décision du candidat à l'exécution du plan (P3-20) : seed de la partie et
 * attractivité de la carrière au moment de l'offre. Absente (prévision,
 * événements) : l'offre est supposée acceptée, sans rien révéler du tirage.
 */
export interface HiringDecision {
	readonly seed: string;
	readonly attraction: number;
}

/** Raison pour laquelle ce candidat ne peut être embauché, ou `null`. */
export function hireIssue(
	candidateId: string,
	parts: EntourageParts,
	context: ConditionContext | null,
	content: Content,
	offer: HireOffer | 'counter' = 'standard'
): string | null {
	const postId = Object.keys(parts.shortlists).find((id) =>
		parts.shortlists[id]?.some((entry) => entry.characterId === candidateId)
	);
	if (!postId) return 'Ce candidat ne figure dans aucune présélection.';
	if (offer === 'counter' && !hireTerms(candidateId, parts, 'counter', content)) {
		return 'Ce candidat n’a fait aucune contre-proposition.';
	}
	const post = content.posts[postId];
	if (!post) return `Poste inconnu : ${postId}.`;
	if (occupantOf(parts.staff, postId)) return `Le poste « ${post.label} » est déjà pourvu.`;
	if (context && !postUnlocked(postId, context, content)) {
		return post.unavailableReason ?? `Le poste « ${post.label} » n’est pas accessible.`;
	}
	// On ne recrute pas sans réserve : les salaires de toute l'équipe, nouveau venu
	// compris, doivent être couverts plusieurs trimestres (P3-09).
	if (parts.characters[candidateId]?.status !== 'active')
		return 'Ce candidat n’est plus disponible.';
	if (context) {
		const terms = hireTerms(candidateId, parts, offer, content)!;
		const reserve = hireReserveCents(parts.staff, terms.salaryCents, content, terms.bonusCents);
		if (context.resources.politicalBudgetCents < reserve) {
			const quarters = content.balance.entourage.hireReserveQuarters;
			return `Budget politique insuffisant : il faut ${euros(reserve)} pour couvrir ${quarters} trimestre${quarters > 1 ? 's' : ''} de salaires de l’entourage${terms.bonusCents > 0 ? ' et la prime' : ''}.`;
		}
	}
	return null;
}

/** Raison pour laquelle on ne peut plus s'entretenir avec ce candidat, ou `null`. */
export function candidateInterviewIssue(
	candidateId: string,
	parts: EntourageParts,
	content: Content
): string | null {
	const postId = shortlistPostOf(candidateId, parts);
	if (!postId) return 'Ce candidat ne figure dans aucune présélection.';
	if (occupantOf(parts.staff, postId)) return 'Le poste est déjà pourvu.';
	if (parts.characters[candidateId]?.status !== 'active')
		return 'Ce candidat n’est plus disponible.';
	const entry = parts.shortlists[postId]!.find((item) => item.characterId === candidateId)!;
	if (entry.interviews >= content.balance.entourage.recruitment.maxInterviews)
		return 'Vous l’avez déjà longuement reçu : un entretien de plus n’y changerait rien.';
	return null;
}

/** Candidats encore disponibles de la présélection d'un poste. */
function availableEntries(parts: EntourageParts, postId: string): readonly ShortlistEntry[] {
	return (parts.shortlists[postId] ?? []).filter(
		(entry) => parts.characters[entry.characterId]?.status === 'active'
	);
}

/**
 * Raison pour laquelle cette recherche ne peut être commandée, ou `null`
 * (P3-21) : poste débloqué et vacant, aucune recherche en cours pour lui,
 * présélection non complète, trait public permis à ce niveau.
 */
export function searchIssue(
	target: string,
	level: SearchLevel,
	parts: EntourageParts,
	context: ConditionContext | null,
	content: Content
): string | null {
	const { postId, trait } = parseSearchTarget(target);
	const post = Object.hasOwn(content.posts, postId) ? content.posts[postId] : undefined;
	if (!post) return 'choisissez un poste';
	if (context && !postUnlocked(postId, context, content)) {
		return post.unavailableReason ?? `le poste « ${post.label} » n’est pas accessible`;
	}
	if (occupantOf(parts.staff, postId)) return `le poste « ${post.label} » est déjà pourvu`;
	if (parts.searches.some((search) => search.postId === postId)) {
		return 'une recherche est déjà en cours pour ce poste';
	}
	const search = content.balance.entourage.search;
	if (availableEntries(parts, postId).length >= search.maxShortlist) {
		return 'la présélection est déjà complète';
	}
	if (trait !== null) {
		if (!search.levels[level].traitAllowed) return 'ce niveau de recherche ne cible aucun trait';
		const definition = Object.hasOwn(content.traits, trait) ? content.traits[trait] : undefined;
		// Seuls les traits publics se recherchent : un trait caché ne se lit pas sur un CV.
		if (!definition || definition.hidden) return 'seul un trait visible peut être recherché';
	}
	return null;
}

/** Raison pour laquelle on ne peut vérifier le dossier de ce candidat, ou `null` (P3-21). */
export function vetIssue(candidateId: string, parts: EntourageParts): string | null {
	const postId = shortlistPostOf(candidateId, parts);
	if (!postId) return 'Ce candidat ne figure dans aucune présélection.';
	if (occupantOf(parts.staff, postId)) return 'Le poste est déjà pourvu.';
	if (parts.characters[candidateId]?.status !== 'active')
		return 'Ce candidat n’est plus disponible.';
	const entry = parts.shortlists[postId]!.find((item) => item.characterId === candidateId)!;
	if (entry.hints !== null) return 'Son dossier a déjà été vérifié.';
	return null;
}

/** Raison pour laquelle ce collaborateur ne peut être renvoyé, ou `null`. */
export function dismissIssue(characterId: string, parts: EntourageParts): string | null {
	return activeStaff(parts.staff).some((member) => member.characterId === characterId)
		? null
		: 'Ce personnage ne fait pas partie de votre entourage.';
}

function leave(
	parts: EntourageParts,
	characterId: string,
	reason: StaffLeaveReason,
	turn: Turn
): { parts: EntourageParts; changes: PoliticalChange[] } {
	const member = activeStaff(parts.staff).find((entry) => entry.characterId === characterId);
	if (!member) return { parts, changes: [] };
	return {
		parts: {
			...parts,
			staff: parts.staff.map((entry) =>
				entry === member
					? { ...entry, status: 'left' as const, leftTurn: turn, leaveReason: reason }
					: entry
			)
		},
		changes: [{ kind: 'staffLeft', characterId, postId: member.postId, reason }]
	};
}

export type StaffEffect = Extract<
	Effect,
	{ op: 'hireStaff' | 'dismissStaff' | 'courtCandidate' | 'orderSearch' | 'vetCandidate' }
>;

export function isStaffEffect(effect: Effect): effect is StaffEffect {
	return (
		effect.op === 'hireStaff' ||
		effect.op === 'dismissStaff' ||
		effect.op === 'courtCandidate' ||
		effect.op === 'orderSearch' ||
		effect.op === 'vetCandidate'
	);
}

/**
 * Embauche ou renvoi du personnage choisi dans le plan (`target`). Une cible
 * invalide n'a aucun effet (le plan est refusé en amont).
 */
export function applyStaffEffect(
	effect: StaffEffect,
	parts: EntourageParts,
	turn: Turn,
	target: string | null,
	context: ConditionContext | null,
	content: Content,
	decision: HiringDecision | null = null
): { parts: EntourageParts; changes: PoliticalChange[] } {
	if (target === null) return { parts, changes: [] };
	if (effect.op === 'orderSearch') {
		if (searchIssue(target, effect.level, parts, context, content)) return { parts, changes: [] };
		const { postId, trait } = parseSearchTarget(target);
		const dueTurn = turn + content.balance.entourage.search.levels[effect.level].delayTurns;
		return {
			parts: {
				...parts,
				searches: [
					...parts.searches,
					{ postId, level: effect.level, trait, orderedTurn: turn, dueTurn }
				]
			},
			changes: [{ kind: 'searchOrdered', postId, level: effect.level, dueTurn }]
		};
	}
	if (effect.op === 'vetCandidate') {
		if (vetIssue(target, parts)) return { parts, changes: [] };
		const postId = shortlistPostOf(target, parts)!;
		// Indices tirés à l'exécution seulement : la prévision ne révèle rien.
		const hints = decision
			? vetHints(decision.seed, turn, parts.characters[target]!, 'standard', content)
			: [];
		return {
			parts: {
				...parts,
				shortlists: {
					...parts.shortlists,
					[postId]: parts.shortlists[postId]!.map((entry) =>
						entry.characterId === target ? { ...entry, hints } : entry
					)
				}
			},
			changes: [{ kind: 'vetted', characterId: target, postId }]
		};
	}
	if (effect.op === 'courtCandidate') {
		if (candidateInterviewIssue(target, parts, content)) return { parts, changes: [] };
		const postId = shortlistPostOf(target, parts)!;
		return {
			parts: {
				...parts,
				shortlists: {
					...parts.shortlists,
					[postId]: parts.shortlists[postId]!.map((entry) =>
						entry.characterId === target ? { ...entry, interviews: entry.interviews + 1 } : entry
					)
				}
			},
			changes: [{ kind: 'interviewed', characterId: target, postId }]
		};
	}
	if (effect.op === 'dismissStaff') {
		if (dismissIssue(target, parts)) return { parts, changes: [] };
		const left = leave(parts, target, 'dismissed', turn);
		const member = parts.staff.find((entry) => entry.characterId === target)!;
		const character = parts.characters[target]!;
		const relation = addRelation(
			left.parts.relationships,
			character,
			content.balance.entourage.dismissAttitude,
			`Renvoi du poste : ${content.posts[member.postId]?.label ?? member.postId}.`,
			turn,
			content
		);
		return {
			parts: { ...left.parts, relationships: relation.relationships },
			changes: left.changes
		};
	}
	const offer = effect.offer ?? 'standard';
	if (hireIssue(target, parts, context, content, offer)) return { parts, changes: [] };
	const terms = hireTerms(target, parts, offer, content)!;
	const postId = terms.postId;
	const post = content.posts[postId]!;
	const candidate = parts.characters[target]!;
	const recruitment = content.balance.entourage.recruitment;
	// Le candidat décide à l'exécution seulement (P3-20). Un premier refus est
	// suivi d'une contre-proposition valable un trimestre ; un second, d'un départ
	// (P3-33). Une offre au montant de la contre-proposition est toujours acceptée.
	if (decision && offer !== 'counter') {
		const entry = parts.shortlists[postId]!.find((item) => item.characterId === target)!;
		const chance = acceptancePercent(
			decision.attraction,
			candidate.competence,
			offer,
			entry.interviews,
			content
		);
		if (acceptanceRoll(decision.seed, turn, target) >= chance) {
			const relation = addRelation(
				parts.relationships,
				candidate,
				recruitment.refusalAttitude,
				`A décliné votre offre pour le poste : ${post.label}.`,
				turn,
				content
			);
			if (entry.counterOffer === null) {
				const asked = askedSalaryCents(postId, candidate.competence, content);
				const rounding = recruitment.salaryRoundingCents;
				const counterCents = Math.max(
					terms.salaryCents + rounding,
					Math.round((asked * recruitment.counterOfferPercent) / 100 / rounding) * rounding
				);
				return {
					parts: {
						...parts,
						shortlists: {
							...parts.shortlists,
							[postId]: parts.shortlists[postId]!.map((item) =>
								item.characterId === target
									? { ...item, counterOffer: { salaryCents: counterCents, untilTurn: turn + 1 } }
									: item
							)
						},
						relationships: relation.relationships
					},
					changes: [{ kind: 'hireRefused', characterId: target, postId, counterCents }]
				};
			}
			return {
				parts: {
					...parts,
					shortlists: {
						...parts.shortlists,
						[postId]: parts.shortlists[postId]!.filter((item) => item.characterId !== target)
					},
					characters: {
						...parts.characters,
						[target]: { ...candidate, tags: candidate.tags.filter((tag) => tag !== 'candidate') }
					},
					relationships: relation.relationships
				},
				changes: [{ kind: 'hireRefused', characterId: target, postId, counterCents: null }]
			};
		}
	}
	const hired: Character = {
		...candidate,
		tags: [...candidate.tags.filter((tag) => tag !== 'candidate'), 'staff', post.tag]
	};
	const shortlists = { ...parts.shortlists };
	delete shortlists[postId];
	const relation = addRelation(
		parts.relationships,
		hired,
		content.balance.entourage.hireAttitude +
			(offer === 'counter' ? 0 : recruitment.offers[offer].attitude),
		`Recrutement au poste : ${post.label}.`,
		turn,
		content
	);
	return {
		parts: {
			...parts,
			staff: [
				...parts.staff,
				{
					characterId: target,
					postId,
					hiredTurn: turn,
					missionId: post.missions[0]!.id,
					status: 'active',
					leftTurn: null,
					leaveReason: null,
					salaryCents: terms.salaryCents,
					bonusDueCents: terms.bonusCents,
					progressTenths: 0,
					reviewedCompetence: candidate.competence,
					reviewTurn: turn
				}
			],
			shortlists,
			characters: { ...parts.characters, [target]: hired },
			relationships: relation.relationships
		},
		changes: [{ kind: 'hired', characterId: target, postId }]
	};
}

/** Départ d'un collaborateur qui tient un rôle d'événement (débauchage). */
/** Départ d'un collaborateur condamné (P3-01) : il démissionne. */
export function staffLeavesAfterConviction(
	parts: EntourageParts,
	characterId: string,
	turn: Turn
): { parts: EntourageParts; changes: PoliticalChange[] } {
	return leave(parts, characterId, 'resigned', turn);
}

export function staffLeavesByEvent(
	parts: EntourageParts,
	characterId: string,
	turn: Turn
): { parts: EntourageParts; changes: PoliticalChange[] } {
	return leave(parts, characterId, 'poached', turn);
}

/** Changement de mission (commande hors tour) : raison du refus, ou `null`. */
export function missionIssue(
	staff: readonly StaffMember[],
	characterId: string,
	missionId: string,
	content: Content
): string | null {
	const member = activeStaff(staff).find((entry) => entry.characterId === characterId);
	if (!member) return 'Ce personnage ne fait pas partie de votre entourage.';
	const post = content.posts[member.postId];
	if (!post?.missions.some((mission) => mission.id === missionId)) {
		return 'Cette mission ne relève pas de ce poste.';
	}
	return null;
}

// ---------------------------------------------------------------------------
// Production du trimestre (étape 3 ter)
// ---------------------------------------------------------------------------

export interface ProductionParts {
	readonly resources: Resources;
	readonly player: PlayerState;
	readonly world: WorldState;
	readonly career: CareerParts;
	readonly entourage: EntourageParts;
}

/**
 * Salaires puis missions des collaborateurs embauchés avant `turn`, dans
 * l'ordre d'embauche. Un salaire impayé suspend la mission et baisse la
 * loyauté ; une ressource ne descend jamais sous zéro.
 */
export function resolveStaffProduction(
	parts: ProductionParts,
	turn: Turn,
	content: Content
): ProductionParts & { record: Pick<StaffRecord, 'payroll' | 'production' | 'progress'> } {
	const resources: Record<ResourceId, number> = { ...parts.resources };
	let { player, world, career, entourage } = parts;
	const payroll = new Map<ResourceId, number>();
	const production: StaffProductionRecord[] = [];
	const progress: StaffRecord['progress'][number][] = [];
	const { seniorityAttitude } = content.balance.entourage.progression;
	for (const member of producing(entourage.staff, turn)) {
		const post = content.posts[member.postId];
		const mission = content.missions[member.missionId];
		const character = entourage.characters[member.characterId];
		if (!post || !mission || !character) continue;
		// Salaire convenu, et prime d'arrivée avec le premier salaire (P3-20).
		const due = member.salaryCents + member.bonusDueCents;
		if (resources.politicalBudgetCents < due) {
			const relation = addRelation(
				entourage.relationships,
				character,
				content.balance.entourage.unpaidAttitude,
				null,
				turn,
				content
			);
			entourage = { ...entourage, relationships: relation.relationships };
			production.push({
				characterId: member.characterId,
				missionId: member.missionId,
				status: 'unpaid',
				changes: [],
				politics: [],
				stress: 0
			});
			continue;
		}
		resources.politicalBudgetCents -= due;
		payroll.set('politicalBudgetCents', (payroll.get('politicalBudgetCents') ?? 0) - due);
		if (member.bonusDueCents > 0) {
			entourage = {
				...entourage,
				staff: entourage.staff.map((entry) =>
					entry.characterId === member.characterId && entry.status === 'active'
						? { ...entry, bonusDueCents: 0 }
						: entry
				)
			};
		}
		const changes = new Map<ResourceId, number>();
		const politics: PoliticalChange[] = [];
		let stress = 0;
		for (const effect of mission.effects) {
			switch (effect.op) {
				case 'addResource': {
					const value = scaledValue(effect.value, character.competence, content);
					const next = Math.max(0, resources[effect.resource] + value);
					changes.set(
						effect.resource,
						(changes.get(effect.resource) ?? 0) + next - resources[effect.resource]
					);
					resources[effect.resource] = next;
					break;
				}
				case 'addSupport': {
					const value = scaledValue(effect.value, character.competence, content);
					if (value === 0) break;
					const outcome = applyPoliticalEffect(
						{ ...effect, value },
						player,
						world,
						turn,
						null,
						content
					);
					player = outcome.player;
					world = outcome.world;
					politics.push(...outcome.changes);
					break;
				}
				case 'addStat': {
					const value = scaledValue(effect.value, character.competence, content);
					const key = gaugeKey(effect.stat);
					const next = Math.min(GAUGE_MAX, Math.max(GAUGE_MIN, player[key] + value));
					if (key === 'stress') stress += next - player[key];
					player = { ...player, [key]: next };
					break;
				}
				case 'prepareCampaign': {
					const value = scaledValue(effect.value, character.competence, content);
					if (value <= 0) break;
					const outcome = applyCareerEffect(
						{ op: 'prepareCampaign', value },
						career,
						turn,
						null,
						content,
						player
					);
					career = outcome.parts;
					politics.push(...outcome.changes);
					break;
				}
				default:
					break;
			}
		}
		// Progression (P3-21) : un trimestre exercé fait gagner des dixièmes de
		// compétence, d'autant plus que le collaborateur débute ; chaque
		// anniversaire d'embauche resserre un peu les liens.
		const gained = member.progressTenths + progressionTenths(character.competence, content);
		const points = Math.min(GAUGE_MAX - character.competence, Math.floor(gained / 10));
		const tenths = character.competence + points >= GAUGE_MAX ? 0 : gained - points * 10;
		entourage = {
			...entourage,
			staff: entourage.staff.map((entry) =>
				entry.characterId === member.characterId && entry.status === 'active'
					? { ...entry, progressTenths: tenths }
					: entry
			)
		};
		if (points > 0) {
			entourage = {
				...entourage,
				characters: {
					...entourage.characters,
					[character.id]: { ...character, competence: character.competence + points }
				}
			};
			progress.push({
				characterId: character.id,
				from: character.competence,
				to: character.competence + points
			});
		}
		const service = turn - member.hiredTurn;
		if (seniorityAttitude > 0 && service > 0 && service % 4 === 0) {
			const relation = addRelation(
				entourage.relationships,
				character,
				seniorityAttitude,
				null,
				turn,
				content
			);
			entourage = { ...entourage, relationships: relation.relationships };
		}
		production.push({
			characterId: member.characterId,
			missionId: member.missionId,
			status: 'active',
			changes: [...changes.entries()].flatMap(([resource, delta]) =>
				delta === 0 ? [] : [{ resource, delta }]
			),
			politics,
			stress
		});
	}
	return {
		resources,
		player,
		world,
		career,
		entourage,
		record: {
			payroll: [...payroll.entries()].map(([resource, delta]): ResourceChange => ({
				resource,
				delta
			})),
			production,
			progress
		}
	};
}

// ---------------------------------------------------------------------------
// Frontière : départs et présélections
// ---------------------------------------------------------------------------

/** Poids d'un profil qui se présente couramment (le poids de rareté s'y compare). */
const COMMON_PROFILE_WEIGHT = 10;

/** Tirage pondéré d'un profil de candidat ; le premier profil si aucun poids n'est positif. */
function pickProfile(
	profiles: readonly CandidateProfileDefinition[],
	weight: (profile: CandidateProfileDefinition) => number,
	rng: RngState
): { profile: CandidateProfileDefinition; rng: RngState } {
	const total = profiles.reduce((sum, profile) => sum + weight(profile), 0);
	if (total <= 0) return { profile: profiles[0]!, rng };
	const draw = nextInt(rng, 1, total);
	let cumulative = 0;
	for (const profile of profiles) {
		cumulative += weight(profile);
		if (draw.value <= cumulative) return { profile, rng: draw.rng };
	}
	return { profile: profiles.at(-1)!, rng: draw.rng };
}

/** Candidat généré pour un poste : profil, compétence et traits (le trait exigé se voit sur le CV). */
function generateCandidate(
	profile: CandidateProfileDefinition,
	extraTrait: string | null,
	turn: Turn,
	parts: EntourageParts,
	rng: RngState,
	content: Content
): { character: Character; parts: EntourageParts; rng: RngState } {
	const generated = generatePerson(
		{
			tags: ['candidate'],
			epithet: null,
			renewal: null,
			partyId: null,
			minAge: 26,
			maxAge: 55,
			successorOf: null
		},
		turn,
		parts.characters,
		rng,
		content
	);
	const competence = nextInt(generated.rng, profile.minCompetence, profile.maxCompetence);
	// Les traits du profil (et le trait recherché) s'imposent et se voient sur le CV ;
	// les autres restent à découvrir.
	const forced = [...new Set([...profile.traits, ...(extraTrait === null ? [] : [extraTrait])])];
	const traits = [...new Set([...forced, ...generated.character.traits])]
		.slice(0, Math.max(forced.length, generated.character.traits.length))
		.sort();
	const knownTraits = [
		...new Set([
			...forced,
			...generated.character.knownTraits.filter((trait) => traits.includes(trait))
		])
	].sort();
	const character: Character = {
		...generated.character,
		competence: competence.value,
		traits,
		knownTraits
	};
	return {
		character,
		parts: {
			...parts,
			characters: { ...parts.characters, [character.id]: character },
			relationships: meet(parts.relationships, character.id, turn).relationships
		},
		rng: competence.rng
	};
}

/**
 * À la frontière (`turn` = T+1) : départ des collaborateurs partis de la vie
 * publique ou trop mal disposés ; présélection de candidats pour chaque poste
 * débloqué, vacant et sans présélection, dans l'ordre du catalogue ; puis
 * recherches échues (P3-21, résolues une seule fois : retirées de l'état) et
 * demande d'augmentation d'un collaborateur qui a franchi un palier.
 */
export function resolveStaffFrontier(
	entourage: EntourageParts,
	context: ConditionContext,
	turn: Turn,
	rng: RngState,
	content: Content
): {
	entourage: EntourageParts;
	rng: RngState;
	/** Part du prix des recherches échouées ou annulées, rendue au budget politique. */
	refundCents: number;
	/** Demande d'augmentation programmée pour ce trimestre. */
	scheduled: readonly ScheduledEvent[];
	record: Pick<
		StaffRecord,
		'departures' | 'shortlisted' | 'searches' | 'raiseRequests' | 'counterLapsed'
	>;
} {
	let parts = entourage;
	let current = rng;
	const departures: StaffRecord['departures'][number][] = [];
	for (const member of activeStaff(parts.staff)) {
		const character = parts.characters[member.characterId];
		const attitude = parts.relationships[member.characterId]?.attitude ?? 0;
		const reason: StaffLeaveReason | null =
			character?.status === 'dead'
				? 'died'
				: character?.status === 'retired'
					? 'retired'
					: attitude <= content.balance.entourage.resignAttitude
						? 'resigned'
						: null;
		if (!reason) continue;
		parts = leave(parts, member.characterId, reason, turn).parts;
		departures.push({ characterId: member.characterId, postId: member.postId, reason });
	}

	// Contre-propositions restées sans réponse (P3-33) : le candidat s'en va.
	const counterLapsed: string[] = [];
	for (const [postId, entries] of Object.entries(parts.shortlists)) {
		const lapsed = entries.filter(
			(entry) => entry.counterOffer !== null && entry.counterOffer.untilTurn < turn
		);
		if (lapsed.length === 0) continue;
		counterLapsed.push(...lapsed.map((entry) => entry.characterId));
		const characters = { ...parts.characters };
		for (const entry of lapsed) {
			const character = characters[entry.characterId];
			if (character) {
				characters[entry.characterId] = {
					...character,
					tags: character.tags.filter((tag) => tag !== 'candidate')
				};
			}
		}
		parts = {
			...parts,
			characters,
			shortlists: {
				...parts.shortlists,
				[postId]: entries.filter((entry) => !lapsed.includes(entry))
			}
		};
	}

	const shortlisted: string[] = [];
	const { candidatesPerPost } = content.balance.entourage;
	// Vivier gradué (P3-20) : un profil se présente couramment si la carrière est
	// assez attractive, rarement sinon (poids de rareté, éventuellement nul). Les
	// profils de recherche (P3-21) ne se présentent jamais spontanément.
	const attraction = attractiveness(
		attractivenessFactors(context.player, context.resources, context.mandates, parts.staff, content)
	);
	const spontaneous = content.candidateProfiles.filter((profile) => !profile.searchOnly);
	const profileWeight = (profile: CandidateProfileDefinition): number =>
		attraction >= profile.minAttractiveness ? COMMON_PROFILE_WEIGHT : profile.rareWeight;
	for (const postId of content.postIds) {
		if (occupantOf(parts.staff, postId) || !postUnlocked(postId, context, content)) continue;
		if (availableEntries(parts, postId).length > 0) continue;
		const entries: ShortlistEntry[] = [];
		for (let index = 0; index < candidatesPerPost; index += 1) {
			const drawn = pickProfile(spontaneous, profileWeight, current);
			const made = generateCandidate(drawn.profile, null, turn, parts, drawn.rng, content);
			parts = made.parts;
			current = made.rng;
			entries.push({
				characterId: made.character.id,
				profileId: drawn.profile.id,
				interviews: 0,
				counterOffer: null,
				hints: null
			});
		}
		parts = { ...parts, shortlists: { ...parts.shortlists, [postId]: entries } };
		shortlisted.push(postId);
	}

	// Recherches échues, dans l'ordre de commande : le poste doit être encore
	// vacant et accessible ; la chance de trouver est tirée une seule fois.
	const searchBalance = content.balance.entourage.search;
	const searches: SearchOutcomeRecord[] = [];
	let refundCents = 0;
	for (const search of parts.searches.filter((entry) => entry.dueTurn <= turn)) {
		const level = searchBalance.levels[search.level];
		const room = searchBalance.maxShortlist - availableEntries(parts, search.postId).length;
		const closed =
			occupantOf(parts.staff, search.postId) !== null ||
			!postUnlocked(search.postId, context, content) ||
			room <= 0;
		const refund = searchRefundCents(search.level, content);
		if (closed) {
			refundCents += refund;
			searches.push({
				...outcomeOf(search),
				outcome: 'cancelled',
				candidates: [],
				refundCents: refund
			});
			continue;
		}
		const roll = nextInt(current, 0, 99);
		current = roll.rng;
		if (roll.value >= searchFindPercent(search.level, search.trait, content)) {
			refundCents += refund;
			searches.push({
				...outcomeOf(search),
				outcome: 'failed',
				candidates: [],
				refundCents: refund
			});
			continue;
		}
		const found: string[] = [];
		const entries: ShortlistEntry[] = [];
		for (let index = 0; index < Math.min(level.candidates, room); index += 1) {
			const profile =
				level.profile === null
					? (() => {
							const drawn = pickProfile(spontaneous, profileWeight, current);
							current = drawn.rng;
							return drawn.profile;
						})()
					: content.candidateProfiles.find((entry) => entry.id === level.profile)!;
			const made = generateCandidate(profile, search.trait, turn, parts, current, content);
			parts = made.parts;
			current = made.rng;
			found.push(made.character.id);
			entries.push({
				characterId: made.character.id,
				profileId: profile.id,
				interviews: 0,
				counterOffer: null,
				// Le chasseur de têtes livre un dossier vérifié : des indices, jamais une certitude.
				hints:
					level.vetting === null
						? null
						: vetHints(rng.seed, turn, made.character, level.vetting, content)
			});
		}
		parts = {
			...parts,
			shortlists: {
				...parts.shortlists,
				[search.postId]: [...(parts.shortlists[search.postId] ?? []), ...entries]
			}
		};
		searches.push({ ...outcomeOf(search), outcome: 'found', candidates: found, refundCents: 0 });
	}
	parts = { ...parts, searches: parts.searches.filter((entry) => entry.dueTurn > turn) };

	// Renégociation : un collaborateur qui a gagné un palier de compétence depuis
	// sa dernière demande (ou son embauche), dont le salaire est sous sa
	// prétention, réclame ; au plus une demande par trimestre et une par période.
	// La demande fixe la nouvelle référence : après un refus, il ne revient qu'au
	// palier suivant, la relation entamée.
	const renegotiation = content.balance.entourage.renegotiation;
	const scheduled: ScheduledEvent[] = [];
	const raiseRequests: string[] = [];
	for (const member of activeStaff(parts.staff)) {
		const character = parts.characters[member.characterId];
		if (!character || character.status !== 'active') continue;
		if (character.competence - member.reviewedCompetence < renegotiation.stepCompetence) continue;
		if (turn - member.reviewTurn < renegotiation.minTurns) continue;
		if (askedSalaryCents(member.postId, character.competence, content) <= member.salaryCents)
			continue;
		parts = {
			...parts,
			staff: parts.staff.map((entry) =>
				entry === member
					? { ...entry, reviewTurn: turn, reviewedCompetence: character.competence }
					: entry
			)
		};
		scheduled.push({
			eventId: renegotiation.event,
			dueTurn: turn,
			sourceInstanceId: `staff:${member.characterId}`,
			actors: { [STAFF_ROLE]: member.characterId }
		});
		raiseRequests.push(member.characterId);
		break;
	}

	return {
		entourage: parts,
		rng: current,
		refundCents,
		scheduled,
		record: { departures, shortlisted, searches, raiseRequests, counterLapsed }
	};
}

function outcomeOf(
	search: RecruitmentSearch
): Pick<SearchOutcomeRecord, 'postId' | 'level' | 'trait'> {
	return { postId: search.postId, level: search.level, trait: search.trait };
}

/** Rôle du collaborateur concerné par un événement de sujet `staff` (P3-21). */
export const STAFF_ROLE = 'collaborator';

/**
 * Augmentation accordée (P3-21) : le collaborateur passe au salaire demandé à
 * sa compétence actuelle, qui devient la référence du prochain palier.
 */
export function grantRaise(
	parts: EntourageParts,
	characterId: string,
	turn: Turn,
	content: Content
): { parts: EntourageParts; changes: PoliticalChange[] } {
	const member = activeStaff(parts.staff).find((entry) => entry.characterId === characterId);
	const character = parts.characters[characterId];
	if (!member || !character) return { parts, changes: [] };
	const salaryCents = Math.max(
		member.salaryCents,
		askedSalaryCents(member.postId, character.competence, content)
	);
	return {
		parts: {
			...parts,
			staff: parts.staff.map((entry) =>
				entry === member
					? { ...entry, salaryCents, reviewedCompetence: character.competence, reviewTurn: turn }
					: entry
			)
		},
		changes: [{ kind: 'raiseGranted', characterId, salaryCents }]
	};
}

// ---------------------------------------------------------------------------
// Poste lié à un événement (P3-12)
// ---------------------------------------------------------------------------

/**
 * Poste d'un événement de sujet `post`, fixé à sa création : le premier poste
 * débloqué et vacant dans l'ordre du catalogue, sinon le premier débloqué et
 * occupé, avec son titulaire ; `null` si aucun poste n'est débloqué.
 */
export function bindEventPost(
	staff: readonly StaffMember[],
	context: ConditionContext,
	content: Content
): { postId: string; incumbentId: string | null } | null {
	const unlocked = content.postIds.filter((postId) => postUnlocked(postId, context, content));
	const vacant = unlocked.find((postId) => occupantOf(staff, postId) === null);
	if (vacant !== undefined) return { postId: vacant, incumbentId: null };
	const occupied = unlocked[0];
	if (occupied === undefined) return null;
	return { postId: occupied, incumbentId: occupantOf(staff, occupied)!.characterId };
}

export type PostEffect = Extract<Effect, { op: 'hireActor' | 'shortlistActor' }>;

/** Variables d'un événement de sujet `post` : poste lié et titulaire éventuel. */
export interface PostBinding {
	readonly postId: string | null;
	readonly incumbentId: string | null;
	readonly actorId: string | null;
}

/**
 * Raison pour laquelle l'effet ne peut s'appliquer, ou `null` (P3-12) : le
 * choix correspondant est alors indisponible. L'embauche d'un proche contourne
 * l'attractivité mais pas les salaires : la réserve de l'entourage s'applique.
 */
export function postEffectIssue(
	effect: PostEffect,
	binding: PostBinding,
	parts: EntourageParts,
	context: ConditionContext | null,
	content: Content
): string | null {
	const post = binding.postId === null ? undefined : content.posts[binding.postId];
	if (!post || binding.postId === null) return 'Aucun poste n’est concerné.';
	const actor = binding.actorId === null ? undefined : parts.characters[binding.actorId];
	if (!actor || actor.status !== 'active') return 'Cette personne n’est plus disponible.';
	if (activeStaff(parts.staff).some((member) => member.characterId === actor.id)) {
		return 'Cette personne fait déjà partie de votre entourage.';
	}
	if (context && !postUnlocked(binding.postId, context, content)) {
		return post.unavailableReason ?? `Le poste « ${post.label} » n’est pas accessible.`;
	}
	const occupant = occupantOf(parts.staff, binding.postId);
	if (effect.op === 'shortlistActor') {
		return occupant ? `Le poste « ${post.label} » est déjà pourvu.` : null;
	}
	if (!effect.replace && occupant) return `Le poste « ${post.label} » est déjà pourvu.`;
	if (effect.replace) {
		if (!occupant) return `Le poste « ${post.label} » est vacant : personne à remplacer.`;
		if (occupant.characterId !== binding.incumbentId) {
			return 'Le titulaire du poste a changé entre-temps.';
		}
	}
	if (context) {
		const remaining = effect.replace
			? parts.staff.filter((member) => member.characterId !== occupant?.characterId)
			: parts.staff;
		const reserve = hireReserveCents(
			remaining,
			askedSalaryCents(binding.postId, actor.competence, content),
			content
		);
		if (context.resources.politicalBudgetCents < reserve) {
			const quarters = content.balance.entourage.hireReserveQuarters;
			return `Budget politique insuffisant : il faut ${euros(reserve)} pour couvrir ${quarters} trimestre${quarters > 1 ? 's' : ''} de salaires de l’entourage.`;
		}
	}
	return null;
}

/**
 * Embauche de l'acteur au poste lié (le titulaire renvoyé d'abord, s'il s'agit
 * d'un remplacement) ou ajout à la présélection du poste. Un effet devenu
 * impossible n'a aucun effet (le choix est refusé en amont). Comme toute
 * recrue, le collaborateur produit à partir du trimestre suivant.
 */
export function applyPostEffect(
	effect: PostEffect,
	binding: PostBinding,
	parts: EntourageParts,
	turn: Turn,
	context: ConditionContext | null,
	content: Content
): { parts: EntourageParts; changes: PoliticalChange[] } {
	if (postEffectIssue(effect, binding, parts, context, content)) return { parts, changes: [] };
	const postId = binding.postId!;
	const post = content.posts[postId]!;
	const actor = parts.characters[binding.actorId!]!;
	if (effect.op === 'shortlistActor') {
		const candidate: Character = {
			...actor,
			tags: [
				...actor.tags.filter((tag) => tag !== 'job_seeker' && tag !== 'candidate'),
				'candidate'
			]
		};
		return {
			parts: {
				...parts,
				characters: { ...parts.characters, [actor.id]: candidate },
				shortlists: {
					...parts.shortlists,
					[postId]: [
						...(parts.shortlists[postId] ?? []).filter((entry) => entry.characterId !== actor.id),
						{
							characterId: actor.id,
							profileId: effect.profile,
							interviews: 0,
							hints: null,
							counterOffer: null
						}
					]
				}
			},
			changes: []
		};
	}
	const changes: PoliticalChange[] = [];
	let current = parts;
	if (effect.replace && binding.incumbentId !== null) {
		const dismissed = applyStaffEffect(
			{ op: 'dismissStaff' },
			current,
			turn,
			binding.incumbentId,
			context,
			content
		);
		current = dismissed.parts;
		changes.push(...dismissed.changes);
	}
	const hired: Character = {
		...actor,
		tags: [
			...actor.tags.filter((tag) => !['job_seeker', 'candidate', 'staff', post.tag].includes(tag)),
			'staff',
			post.tag
		]
	};
	// Le poste est pourvu : sa présélection disparaît, et le proche quitte toute autre liste.
	const shortlists: Record<string, readonly ShortlistEntry[]> = {};
	for (const [id, entries] of Object.entries(current.shortlists)) {
		if (id === postId) continue;
		shortlists[id] = entries.filter((entry) => entry.characterId !== actor.id);
	}
	return {
		parts: {
			...current,
			shortlists,
			characters: { ...current.characters, [actor.id]: hired },
			staff: [
				...current.staff,
				{
					characterId: actor.id,
					postId,
					hiredTurn: turn,
					missionId: post.missions[0]!.id,
					status: 'active',
					leftTurn: null,
					leaveReason: null,
					// Un proche demande le salaire de sa compétence, sans prime (P3-20).
					salaryCents: askedSalaryCents(postId, actor.competence, content),
					bonusDueCents: 0,
					progressTenths: 0,
					reviewedCompetence: actor.competence,
					reviewTurn: turn
				}
			]
		},
		changes: [...changes, { kind: 'hired', characterId: actor.id, postId }]
	};
}
