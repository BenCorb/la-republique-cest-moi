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
	type ResourceId
} from '../content/types.ts';
import { nextInt, type RngState } from './random.ts';

export type EffectRange =
	| {
			readonly kind: 'resource';
			readonly resource: ResourceId;
			readonly min: number;
			readonly max: number;
	  }
	| { readonly kind: 'gauge'; readonly gauge: GaugeId; readonly min: number; readonly max: number };

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
	  };

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
		default: {
			const unknown: never = effect;
			throw new Error(`Effet inconnu : ${JSON.stringify(unknown)}`);
		}
	}
}
