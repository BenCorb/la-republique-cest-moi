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
import type { PoliticalEffect } from './world.ts';

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
	| { readonly kind: 'earlyElection'; readonly election: string; readonly delayTurns: number };

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
	| { readonly kind: 'career'; readonly effect: CareerEffect; readonly rng: RngState };

export type PeopleEffect = Extract<Effect, { op: 'addRelation' | 'revealTraits' }>;

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
			return { kind: 'politics', effect, rng };
		case 'addRelation':
		case 'revealTraits':
			return { kind: 'people', effect, rng };
		case 'grantMandate':
		case 'endMandate':
		case 'callEarlyElection':
			return { kind: 'career', effect, rng };
		default: {
			const unknown: never = effect;
			throw new Error(`Effet inconnu : ${JSON.stringify(unknown)}`);
		}
	}
}
