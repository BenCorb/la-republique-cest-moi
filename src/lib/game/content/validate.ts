/**
 * Validation complète des catalogues (ARCHITECTURE.md §7) :
 *   1. structure par les schémas Zod ;
 *   2. contrôles croisés : identifiants uniques (actions et améliorations
 *      partagent un même espace de noms), ressources non dupliquées, temps
 *      compatible avec le budget trimestriel, trésorerie unique par amélioration.
 * Renvoie soit le contenu indexé, soit la liste complète des problèmes.
 */
import type { z } from 'zod';
import { actionCatalogSchema, balanceSchema, upgradeCatalogSchema } from './schemas.ts';
import {
	TREASURY_IDS,
	type ActionDefinition,
	type Content,
	type ResourceAmount,
	type UpgradeDefinition
} from './types.ts';

export interface ContentIssue {
	/** Fichier ou catalogue concerné, par exemple `actions.json`. */
	readonly source: string;
	/** Chemin dans le document, par exemple `actions[2].timeCost`. */
	readonly path: string;
	readonly message: string;
}

export interface RawContent {
	readonly actions: unknown;
	readonly upgrades: unknown;
	readonly balance: unknown;
}

export type ContentValidation =
	| { readonly ok: true; readonly content: Content }
	| { readonly ok: false; readonly issues: readonly ContentIssue[] };

function formatPath(path: readonly PropertyKey[]): string {
	return path.reduce<string>((text, key) => {
		if (typeof key === 'number') return `${text}[${key}]`;
		return text ? `${text}.${String(key)}` : String(key);
	}, '');
}

function zodIssues(source: string, error: z.ZodError): ContentIssue[] {
	return error.issues.map((issue) => ({
		source,
		path: formatPath(issue.path),
		message: issue.message
	}));
}

function duplicateResources(
	amounts: readonly ResourceAmount[],
	source: string,
	path: string,
	label: string
): ContentIssue[] {
	const seen = new Set<string>();
	const issues: ContentIssue[] = [];
	amounts.forEach((amount, index) => {
		if (seen.has(amount.resource)) {
			issues.push({
				source,
				path: `${path}[${index}]`,
				message: `ressource en double dans ${label} : ${amount.resource}`
			});
		}
		seen.add(amount.resource);
	});
	return issues;
}

function crossCheck(
	actions: readonly ActionDefinition[],
	upgrades: readonly UpgradeDefinition[],
	timeBudgetPerTurn: number
): ContentIssue[] {
	const issues: ContentIssue[] = [];
	const ids = new Set<string>();
	const checkId = (id: string, source: string, path: string): void => {
		if (ids.has(id)) issues.push({ source, path, message: `identifiant en double : ${id}` });
		ids.add(id);
	};
	const checkTime = (timeCost: number, source: string, path: string): void => {
		if (timeCost > timeBudgetPerTurn) {
			issues.push({
				source,
				path,
				message: `coût en temps ${timeCost} supérieur au budget trimestriel ${timeBudgetPerTurn}`
			});
		}
	};

	actions.forEach((action, index) => {
		const path = `actions[${index}]`;
		checkId(action.id, 'actions.json', `${path}.id`);
		checkTime(action.timeCost, 'actions.json', `${path}.timeCost`);
		issues.push(...duplicateResources(action.costs, 'actions.json', `${path}.costs`, 'les coûts'));
	});

	upgrades.forEach((upgrade, index) => {
		const path = `upgrades[${index}]`;
		const source = 'upgrades.json';
		checkId(upgrade.id, source, `${path}.id`);
		checkTime(upgrade.timeCost, source, `${path}.timeCost`);
		for (const [field, label] of [
			['price', 'le prix'],
			['upkeep', 'les charges'],
			['production', 'la production']
		] as const) {
			issues.push(...duplicateResources(upgrade[field], source, `${path}.${field}`, label));
		}
		// Le prix et les charges monétaires n'utilisent que la trésorerie déclarée.
		for (const field of ['price', 'upkeep'] as const) {
			upgrade[field].forEach((amount, amountIndex) => {
				const isTreasury = (TREASURY_IDS as readonly string[]).includes(amount.resource);
				if (isTreasury && amount.resource !== upgrade.treasury) {
					issues.push({
						source,
						path: `${path}.${field}[${amountIndex}]`,
						message: `${amount.resource} ne correspond pas à la trésorerie déclarée (${upgrade.treasury})`
					});
				}
			});
		}
	});
	return issues;
}

export function validateContent(raw: RawContent): ContentValidation {
	const balance = balanceSchema.safeParse(raw.balance);
	const actionCatalog = actionCatalogSchema.safeParse(raw.actions);
	const upgradeCatalog = upgradeCatalogSchema.safeParse(raw.upgrades);

	const issues: ContentIssue[] = [];
	if (!balance.success) issues.push(...zodIssues('balance.json', balance.error));
	if (!actionCatalog.success) issues.push(...zodIssues('actions.json', actionCatalog.error));
	if (!upgradeCatalog.success) issues.push(...zodIssues('upgrades.json', upgradeCatalog.error));
	if (!balance.success || !actionCatalog.success || !upgradeCatalog.success) {
		return { ok: false, issues };
	}

	const actionList = actionCatalog.data.actions;
	const upgradeList = upgradeCatalog.data.upgrades;
	issues.push(...crossCheck(actionList, upgradeList, balance.data.timeBudgetPerTurn));
	if (issues.length > 0) return { ok: false, issues };

	const actions: Record<string, ActionDefinition> = {};
	for (const action of actionList) actions[action.id] = action;
	const upgrades: Record<string, UpgradeDefinition> = {};
	for (const upgrade of upgradeList) upgrades[upgrade.id] = upgrade;
	return {
		ok: true,
		content: {
			balance: balance.data,
			actions,
			actionIds: actionList.map((action) => action.id),
			upgrades,
			upgradeIds: upgradeList.map((upgrade) => upgrade.id)
		}
	};
}
