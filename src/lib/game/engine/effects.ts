/**
 * Effets déclaratifs sur les ressources (ARCHITECTURE.md §7.1).
 *
 * - `effectRange` donne la fourchette certaine d'un effet, sans aléa (preview).
 * - `resolveEffect` tire la valeur réelle à la validation du trimestre ; seul
 *   `addResourceRandom` consomme le PRNG, un tirage par effet, dans l'ordre.
 */
import type { Effect, ResourceId } from '../content/types.ts';
import { nextInt, type RngState } from './random.ts';

export interface EffectRange {
	readonly resource: ResourceId;
	readonly min: number;
	readonly max: number;
}

export interface ResolvedEffect {
	readonly resource: ResourceId;
	readonly delta: number;
	readonly rng: RngState;
}

export function effectRange(effect: Effect): EffectRange {
	switch (effect.op) {
		case 'addResource':
			return { resource: effect.resource, min: effect.value, max: effect.value };
		case 'addResourceRandom':
			return { resource: effect.resource, min: effect.min, max: effect.max };
		default: {
			const unknown: never = effect;
			throw new Error(`Effet inconnu : ${JSON.stringify(unknown)}`);
		}
	}
}

export function resolveEffect(effect: Effect, rng: RngState): ResolvedEffect {
	switch (effect.op) {
		case 'addResource':
			return { resource: effect.resource, delta: effect.value, rng };
		case 'addResourceRandom': {
			const draw = nextInt(rng, effect.min, effect.max);
			return { resource: effect.resource, delta: draw.value, rng: draw.rng };
		}
		default: {
			const unknown: never = effect;
			throw new Error(`Effet inconnu : ${JSON.stringify(unknown)}`);
		}
	}
}
