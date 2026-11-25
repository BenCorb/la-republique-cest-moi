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
	type Content,
	type Effect,
	type ResourceId
} from '../content/types.ts';
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
	Relationship,
	ResourceChange,
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

/** Raison pour laquelle ce candidat ne peut être embauché, ou `null`. */
export function hireIssue(
	candidateId: string,
	parts: EntourageParts,
	context: ConditionContext | null,
	content: Content
): string | null {
	const postId = Object.keys(parts.shortlists).find((id) =>
		parts.shortlists[id]?.some((entry) => entry.characterId === candidateId)
	);
	if (!postId) return 'Ce candidat ne figure dans aucune présélection.';
	const post = content.posts[postId];
	if (!post) return `Poste inconnu : ${postId}.`;
	if (occupantOf(parts.staff, postId)) return `Le poste « ${post.label} » est déjà pourvu.`;
	if (context && !postUnlocked(postId, context, content)) {
		return post.unavailableReason ?? `Le poste « ${post.label} » n’est pas accessible.`;
	}
	// On ne recrute pas sans pouvoir payer le premier salaire.
	if (context && context.resources.politicalBudgetCents < post.salaryCents) {
		return 'Budget politique insuffisant pour le premier salaire.';
	}
	if (parts.characters[candidateId]?.status !== 'active')
		return 'Ce candidat n’est plus disponible.';
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

export type StaffEffect = Extract<Effect, { op: 'hireStaff' | 'dismissStaff' }>;

export function isStaffEffect(effect: Effect): effect is StaffEffect {
	return effect.op === 'hireStaff' || effect.op === 'dismissStaff';
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
	content: Content
): { parts: EntourageParts; changes: PoliticalChange[] } {
	if (target === null) return { parts, changes: [] };
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
	if (hireIssue(target, parts, context, content)) return { parts, changes: [] };
	const postId = Object.keys(parts.shortlists).find((id) =>
		parts.shortlists[id]?.some((entry) => entry.characterId === target)
	)!;
	const post = content.posts[postId]!;
	const candidate = parts.characters[target]!;
	const hired: Character = {
		...candidate,
		tags: [...candidate.tags.filter((tag) => tag !== 'candidate'), 'staff', post.tag]
	};
	const shortlists = { ...parts.shortlists };
	delete shortlists[postId];
	const relation = addRelation(
		parts.relationships,
		hired,
		content.balance.entourage.hireAttitude,
		`Recrutement au poste : ${post.label}.`,
		turn,
		content
	);
	return {
		parts: {
			staff: [
				...parts.staff,
				{
					characterId: target,
					postId,
					hiredTurn: turn,
					missionId: post.missions[0]!.id,
					status: 'active',
					leftTurn: null,
					leaveReason: null
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
): ProductionParts & { record: Pick<StaffRecord, 'payroll' | 'production'> } {
	const resources: Record<ResourceId, number> = { ...parts.resources };
	let { player, world, career, entourage } = parts;
	const payroll = new Map<ResourceId, number>();
	const production: StaffProductionRecord[] = [];
	for (const member of producing(entourage.staff, turn)) {
		const post = content.posts[member.postId];
		const mission = content.missions[member.missionId];
		const character = entourage.characters[member.characterId];
		if (!post || !mission || !character) continue;
		if (resources.politicalBudgetCents < post.salaryCents) {
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
		resources.politicalBudgetCents -= post.salaryCents;
		payroll.set(
			'politicalBudgetCents',
			(payroll.get('politicalBudgetCents') ?? 0) - post.salaryCents
		);
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
			production
		}
	};
}

// ---------------------------------------------------------------------------
// Frontière : départs et présélections
// ---------------------------------------------------------------------------

/**
 * À la frontière (`turn` = T+1) : départ des collaborateurs partis de la vie
 * publique ou trop mal disposés, puis présélection de candidats pour chaque
 * poste débloqué, vacant et sans présélection, dans l'ordre du catalogue.
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
	record: Pick<StaffRecord, 'departures' | 'shortlisted'>;
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

	const shortlisted: string[] = [];
	const { candidatesPerPost } = content.balance.entourage;
	for (const postId of content.postIds) {
		const existing = parts.shortlists[postId];
		const stillAvailable = existing?.filter(
			(entry) => parts.characters[entry.characterId]?.status === 'active'
		);
		if (occupantOf(parts.staff, postId) || !postUnlocked(postId, context, content)) continue;
		if (stillAvailable && stillAvailable.length > 0) continue;
		const entries: ShortlistEntry[] = [];
		let characters = parts.characters;
		let relationships = parts.relationships;
		for (let index = 0; index < candidatesPerPost; index += 1) {
			const profile = content.candidateProfiles[index % content.candidateProfiles.length]!;
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
				characters,
				current,
				content
			);
			const competence = nextInt(generated.rng, profile.minCompetence, profile.maxCompetence);
			current = competence.rng;
			// Les traits du profil s'imposent et se voient sur le CV ; les autres restent à découvrir.
			const traits = [...new Set([...profile.traits, ...generated.character.traits])]
				.slice(0, Math.max(profile.traits.length, generated.character.traits.length))
				.sort();
			const knownTraits = [
				...new Set([
					...profile.traits,
					...generated.character.knownTraits.filter((trait) => traits.includes(trait))
				])
			].sort();
			const character: Character = {
				...generated.character,
				competence: competence.value,
				traits,
				knownTraits
			};
			characters = { ...characters, [character.id]: character };
			relationships = meet(relationships, character.id, turn).relationships;
			entries.push({ characterId: character.id, profileId: profile.id });
		}
		parts = {
			...parts,
			characters,
			relationships,
			shortlists: { ...parts.shortlists, [postId]: entries }
		};
		shortlisted.push(postId);
	}
	return { entourage: parts, rng: current, record: { departures, shortlisted } };
}
