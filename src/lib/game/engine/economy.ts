/**
 * Économie récurrente des améliorations (ARCHITECTURE.md §5.1 étape 3, §8.1).
 *
 * Règles du prototype :
 *   - un exemplaire acheté au trimestre T est « en attente » pendant T et produit
 *     à partir de T+1 ;
 *   - toutes les charges sont d'abord prélevées, exemplaire par exemplaire dans
 *     l'ordre d'acquisition, chacune sur sa trésorerie ;
 *   - un exemplaire dont les charges ne peuvent pas être payées en totalité est
 *     suspendu pour le trimestre : rien n'est prélevé, rien n'est produit, et la
 *     suspension figure au journal (pas de dette implicite) ;
 *   - les exemplaires actifs produisent ensuite.
 * Fonction pure et déterministe : la même fonction sert à la prévision et à la
 * résolution du trimestre.
 */
import {
	RESOURCE_IDS,
	type Content,
	type ResourceAmount,
	type ResourceId,
	type Resources
} from '../content/types.ts';
import type { Turn } from './calendar.ts';
import type { OwnedUpgrade, ProducerRecord, ResourceChange } from './state.ts';

export type ProducerStatus = 'active' | 'suspended' | 'pending';

export interface ProducerForecast {
	readonly instanceId: string;
	readonly upgradeId: string;
	readonly status: ProducerStatus;
	readonly upkeep: readonly ResourceAmount[];
	readonly production: readonly ResourceAmount[];
}

export interface EconomyResult {
	readonly producers: readonly ProducerForecast[];
	readonly resources: Resources;
	/** Variation nette de l'économie par ressource (non nulle). */
	readonly changes: readonly ResourceChange[];
}

/** Un exemplaire produit pendant un trimestre postérieur à son achat. */
export function isProducing(upgrade: OwnedUpgrade, turn: Turn): boolean {
	return upgrade.acquiredTurn < turn;
}

function netChanges(deltas: ReadonlyMap<ResourceId, number>): ResourceChange[] {
	return RESOURCE_IDS.flatMap((resource) => {
		const delta = deltas.get(resource) ?? 0;
		return delta === 0 ? [] : [{ resource, delta }];
	});
}

export function resolveEconomy(
	resources: Resources,
	upgrades: readonly OwnedUpgrade[],
	turn: Turn,
	content: Content
): EconomyResult {
	const current: Record<ResourceId, number> = { ...resources };
	const deltas = new Map<ResourceId, number>();
	const add = (resource: ResourceId, delta: number): void => {
		current[resource] += delta;
		deltas.set(resource, (deltas.get(resource) ?? 0) + delta);
	};

	// 1. Charges, dans l'ordre d'acquisition.
	const producers: ProducerForecast[] = upgrades.map((owned) => {
		const definition = content.upgrades[owned.upgradeId];
		if (!definition) throw new Error(`Amélioration inconnue : ${owned.upgradeId}`);
		const base = {
			instanceId: owned.instanceId,
			upgradeId: owned.upgradeId,
			upkeep: definition.upkeep,
			production: definition.production
		};
		if (!isProducing(owned, turn)) return { ...base, status: 'pending' };
		const affordable = definition.upkeep.every((cost) => current[cost.resource] >= cost.amount);
		if (!affordable) return { ...base, status: 'suspended' };
		for (const cost of definition.upkeep) add(cost.resource, -cost.amount);
		return { ...base, status: 'active' };
	});

	// 2. Production des exemplaires actifs.
	for (const producer of producers) {
		if (producer.status !== 'active') continue;
		for (const output of producer.production) add(output.resource, output.amount);
	}

	return { producers, resources: current, changes: netChanges(deltas) };
}

/**
 * Journal du trimestre : un relevé par définition, dans l'ordre de première
 * acquisition : nombres d'exemplaires actifs et suspendus, variation cumulée.
 */
export function economyRecords(result: EconomyResult): ProducerRecord[] {
	const groups = new Map<
		string,
		{ active: number; suspended: number; deltas: Map<ResourceId, number> }
	>();
	for (const producer of result.producers) {
		if (producer.status === 'pending') continue;
		let group = groups.get(producer.upgradeId);
		if (!group) {
			group = { active: 0, suspended: 0, deltas: new Map() };
			groups.set(producer.upgradeId, group);
		}
		if (producer.status === 'suspended') {
			group.suspended += 1;
			continue;
		}
		group.active += 1;
		for (const cost of producer.upkeep) {
			group.deltas.set(cost.resource, (group.deltas.get(cost.resource) ?? 0) - cost.amount);
		}
		for (const output of producer.production) {
			group.deltas.set(output.resource, (group.deltas.get(output.resource) ?? 0) + output.amount);
		}
	}
	return [...groups].map(([upgradeId, group]) => ({
		upgradeId,
		active: group.active,
		suspended: group.suspended,
		changes: netChanges(group.deltas)
	}));
}
