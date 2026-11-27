/**
 * Effets déclaratifs (ARCHITECTURE.md §7.1).
 *
 * - `effectRange` donne la fourchette certaine d'un effet, sans aléa (prévision).
 * - `resolveEffect` tire la valeur réelle à la validation du trimestre ; seul
 *   `addResourceRandom` consomme le PRNG, un tirage par effet, dans l'ordre.
 * - Les jauges (santé, stress) restent dans [0, 100] : `applyGauge` renvoie la
 *   variation réellement appliquée.
 */
import {
	GAUGE_MAX,
	GAUGE_MIN,
	type Effect,
	type GaugeId,
	type IndicatorId,
	type ResourceId
} from '../content/types.ts';
import { nextInt, type RngState } from './random.ts';
import type { CareerEffect } from './career.ts';
import type { PostEffect, StaffEffect } from './staff.ts';
import type { FamilyEffect } from './family.ts';
import type { PoliticalEffect } from './world.ts';
import type { PromiseEffect } from './promises.ts';
import type { ReformEffect } from './reforms.ts';

export type EffectRange =
	| {
			readonly kind: 'resource';
			readonly resource: ResourceId;
			readonly min: number;
			readonly max: number;
	  }
	| { readonly kind: 'gauge'; readonly gauge: GaugeId; readonly min: number; readonly max: number }
	| { readonly kind: 'indicator'; readonly indicator: IndicatorId; readonly value: number }
	| { readonly kind: 'support'; readonly group: string; readonly value: number }
	/** `party` : identifiant ou référence relative, résolu à l'application. */
	| { readonly kind: 'partyStrength'; readonly party: string; readonly value: number }
	/** `party` : identifiant, `target` (cible du plan) ou `null` pour un départ. */
	| {
			readonly kind: 'affiliation';
			readonly change: 'join' | 'leave';
			readonly party: string | null;
	  }
	/** Effet sur un acteur d'événement : jamais chiffré pour le joueur. */
	| { readonly kind: 'people'; readonly role: string }
	| { readonly kind: 'mandate'; readonly change: 'grant' | 'end'; readonly mandate: string }
	| { readonly kind: 'earlyElection'; readonly election: string; readonly delayTurns: number }
	| { readonly kind: 'candidacy' }
	| {
			readonly kind: 'staff';
			readonly change:
				| 'hire'
				| 'dismiss'
				| 'leave'
				| 'replace'
				| 'shortlist'
				| 'interview'
				| 'search'
				| 'vet'
				| 'raise';
	  }
	/** Départ d'un exemplaire de l'organisation ; ses effets propres sont ajoutés par le plan. */
	| { readonly kind: 'release' }
	| {
			readonly kind: 'family';
			readonly change: 'partner' | 'child' | 'separate' | 'attitude';
			readonly value: number;
	  }
	| { readonly kind: 'preparation'; readonly value: number }
	/** Fait inscrit au registre : connu du joueur, qui l'a choisi. */
	| { readonly kind: 'fact'; readonly offense: string; readonly severity: number }
	| { readonly kind: 'lifestyle'; readonly lifestyle: string }
	/** Promesse : engagement, avancement, compromis ou renoncement (P3-04). */
	| {
			readonly kind: 'promise';
			readonly change: 'make' | 'advance' | 'amend' | 'abandon';
			readonly value: number;
	  }
	/** Proposition de réforme institutionnelle, votée à la fin du trimestre (P3-05). */
	| { readonly kind: 'reform' }
	/** Média (P3-03) : relation (`media` : identifiant ou `target`) ou interview ciblée. */
	| {
			readonly kind: 'media';
			readonly change: 'relation' | 'interview';
			readonly media: string;
			readonly value: number;
	  };

export type ResolvedEffect =
	| {
			readonly kind: 'resource';
			readonly resource: ResourceId;
			readonly delta: number;
			readonly rng: RngState;
	  }
	| {
			readonly kind: 'gauge';
			readonly gauge: GaugeId;
			readonly delta: number;
			readonly rng: RngState;
	  }
	/** Effet politique déterministe, appliqué par `applyPoliticalEffect`. */
	| { readonly kind: 'politics'; readonly effect: PoliticalEffect; readonly rng: RngState }
	/** Effet sur un acteur d'événement, appliqué par le moteur d'événements. */
	| { readonly kind: 'people'; readonly effect: PeopleEffect; readonly rng: RngState }
	/** Effet de carrière déterministe, appliqué par `applyCareerEffect`. */
	| { readonly kind: 'career'; readonly effect: CareerEffect; readonly rng: RngState }
	/** Embauche ou renvoi ciblé, appliqué par `applyStaffEffect`. */
	| { readonly kind: 'staffAction'; readonly effect: StaffEffect; readonly rng: RngState }
	/** Vie de famille, appliquée par `applyFamilyEffect` (une arrivée tire un personnage). */
	| { readonly kind: 'family'; readonly effect: FamilyEffect; readonly rng: RngState }
	/** Départ de l'exemplaire ciblé, appliqué par le plan (actions seulement). */
	| { readonly kind: 'release'; readonly rng: RngState }
	/** Fait inscrit au registre par le moteur d'événements (P3-01). */
	| { readonly kind: 'fact'; readonly effect: FactEffect; readonly rng: RngState }
	/** Embauche ou présélection d'un acteur au poste lié à l'événement (P3-12). */
	| { readonly kind: 'post'; readonly effect: PostEffect; readonly rng: RngState }
	/** Changement de train de vie (P3-02), appliqué au joueur. */
	| { readonly kind: 'lifestyle'; readonly effect: LifestyleEffect; readonly rng: RngState }
	/** Promesse du registre, appliquée par `applyPromiseEffect` (P3-04). */
	| { readonly kind: 'promise'; readonly effect: PromiseEffect; readonly rng: RngState }
	/** Proposition de réforme, appliquée par `applyReformEffect` (P3-05, actions seulement). */
	| { readonly kind: 'reform'; readonly effect: ReformEffect; readonly rng: RngState };

export type LifestyleEffect = Extract<Effect, { op: 'setLifestyle' }>;

export type FactEffect = Extract<Effect, { op: 'recordFact' }>;

/** Champ de `PlayerState` portant une jauge. */
export function gaugeKey(gauge: GaugeId): 'health' | 'stress' | 'exposure' | 'defense' {
	switch (gauge) {
		case 'player.health':
			return 'health';
		case 'player.stress':
			return 'stress';
		case 'player.exposure':
			return 'exposure';
		case 'player.defense':
			return 'defense';
		default: {
			const unknown: never = gauge;
			throw new Error(`Jauge inconnue : ${String(unknown)}`);
		}
	}
}

export type PeopleEffect = Extract<
	Effect,
	{ op: 'addRelation' | 'revealTraits' | 'staffLeaves' | 'grantRaise' }
>;

export function clampGauge(value: number): number {
	return Math.min(GAUGE_MAX, Math.max(GAUGE_MIN, value));
}

/** Nouvelle valeur d'une jauge et variation réellement appliquée. */
export function applyGauge(value: number, delta: number): { value: number; applied: number } {
	const next = clampGauge(value + delta);
	return { value: next, applied: next - value };
}

export function effectRange(effect: Effect): EffectRange {
	switch (effect.op) {
		case 'addResource':
			return { kind: 'resource', resource: effect.resource, min: effect.value, max: effect.value };
		case 'addResourceRandom':
			return { kind: 'resource', resource: effect.resource, min: effect.min, max: effect.max };
		case 'addStat':
			return { kind: 'gauge', gauge: effect.stat, min: effect.value, max: effect.value };
		case 'addIndicator':
			return { kind: 'indicator', indicator: effect.indicator, value: effect.value };
		case 'addSupport':
			return { kind: 'support', group: effect.group, value: effect.value };
		case 'addPartyStrength':
			return { kind: 'partyStrength', party: effect.party, value: effect.value };
		case 'joinParty':
			return { kind: 'affiliation', change: 'join', party: effect.party };
		case 'leaveParty':
			return { kind: 'affiliation', change: 'leave', party: null };
		case 'addRelation':
		case 'revealTraits':
			return { kind: 'people', role: effect.role };
		case 'grantMandate':
			return { kind: 'mandate', change: 'grant', mandate: effect.mandate };
		case 'endMandate':
			return { kind: 'mandate', change: 'end', mandate: effect.mandate };
		case 'callEarlyElection':
			return { kind: 'earlyElection', election: effect.election, delayTurns: effect.delayTurns };
		case 'declareCandidacy':
			return { kind: 'candidacy' };
		case 'hireStaff':
			return { kind: 'staff', change: 'hire' };
		case 'courtCandidate':
			return { kind: 'staff', change: 'interview' };
		case 'orderSearch':
			return { kind: 'staff', change: 'search' };
		case 'vetCandidate':
			return { kind: 'staff', change: 'vet' };
		case 'grantRaise':
			return { kind: 'staff', change: 'raise' };
		case 'dismissStaff':
			return { kind: 'staff', change: 'dismiss' };
		case 'releaseUpgrade':
			return { kind: 'release' };
		case 'staffLeaves':
			return { kind: 'staff', change: 'leave' };
		case 'familyJoins':
			return { kind: 'family', change: effect.relation, value: 0 };
		case 'separate':
			return { kind: 'family', change: 'separate', value: 0 };
		case 'familyAttitude':
			return { kind: 'family', change: 'attitude', value: effect.value };
		case 'prepareCampaign':
			return { kind: 'preparation', value: effect.value };
		case 'recordFact':
			return { kind: 'fact', offense: effect.offense, severity: effect.severity };
		case 'hireActor':
			return { kind: 'staff', change: effect.replace ? 'replace' : 'hire' };
		case 'shortlistActor':
			return { kind: 'staff', change: 'shortlist' };
		case 'setLifestyle':
			return { kind: 'lifestyle', lifestyle: effect.lifestyle };
		case 'makePromise':
			return { kind: 'promise', change: 'make', value: 0 };
		case 'advancePromise':
			return { kind: 'promise', change: 'advance', value: effect.value };
		case 'amendPromise':
			return { kind: 'promise', change: 'amend', value: 0 };
		case 'abandonPromise':
			return { kind: 'promise', change: 'abandon', value: 0 };
		case 'addMediaRelation':
			return { kind: 'media', change: 'relation', media: effect.media, value: effect.value };
		case 'giveInterview':
			return { kind: 'media', change: 'interview', media: 'target', value: 0 };
		case 'proposeReform':
			return { kind: 'reform' };
		default: {
			const unknown: never = effect;
			throw new Error(`Effet inconnu : ${JSON.stringify(unknown)}`);
		}
	}
}

export function resolveEffect(effect: Effect, rng: RngState): ResolvedEffect {
	switch (effect.op) {
		case 'addResource':
			return { kind: 'resource', resource: effect.resource, delta: effect.value, rng };
		case 'addResourceRandom': {
			const draw = nextInt(rng, effect.min, effect.max);
			return { kind: 'resource', resource: effect.resource, delta: draw.value, rng: draw.rng };
		}
		case 'addStat':
			return { kind: 'gauge', gauge: effect.stat, delta: effect.value, rng };
		case 'addIndicator':
		case 'addSupport':
		case 'addPartyStrength':
		case 'joinParty':
		case 'leaveParty':
		case 'addMediaRelation':
		case 'giveInterview':
			return { kind: 'politics', effect, rng };
		case 'proposeReform':
			return { kind: 'reform', effect, rng };
		case 'addRelation':
		case 'revealTraits':
			return { kind: 'people', effect, rng };
		case 'grantMandate':
		case 'endMandate':
		case 'callEarlyElection':
		case 'declareCandidacy':
		case 'prepareCampaign':
			return { kind: 'career', effect, rng };
		case 'hireStaff':
		case 'dismissStaff':
		case 'courtCandidate':
		case 'orderSearch':
		case 'vetCandidate':
			return { kind: 'staffAction', effect, rng };
		case 'releaseUpgrade':
			return { kind: 'release', rng };
		case 'staffLeaves':
		case 'grantRaise':
			return { kind: 'people', effect, rng };
		case 'familyJoins':
		case 'separate':
		case 'familyAttitude':
			return { kind: 'family', effect, rng };
		case 'recordFact':
			return { kind: 'fact', effect, rng };
		case 'hireActor':
		case 'shortlistActor':
			return { kind: 'post', effect, rng };
		case 'setLifestyle':
			return { kind: 'lifestyle', effect, rng };
		case 'makePromise':
		case 'advancePromise':
		case 'amendPromise':
		case 'abandonPromise':
			return { kind: 'promise', effect, rng };
		default: {
			const unknown: never = effect;
			throw new Error(`Effet inconnu : ${JSON.stringify(unknown)}`);
		}
	}
}
