/**
 * Validation complète des catalogues (ARCHITECTURE.md §7) :
 *   1. structure par les schémas Zod ;
 *   2. contrôles croisés : identifiants uniques, coûts non dupliqués, temps
 *      compatible avec le budget trimestriel.
 * Renvoie soit le contenu indexé, soit la liste complète des problèmes.
 */
import type { z } from 'zod';
import { actionCatalogSchema, balanceSchema } from './schemas.ts';
import type { ActionDefinition, Content } from './types.ts';

export interface ContentIssue {
	/** Fichier ou catalogue concerné, par exemple `actions.json`. */
	readonly source: string;
	/** Chemin dans le document, par exemple `actions[2].timeCost`. */
	readonly path: string;
	readonly message: string;
}

export interface RawContent {
	readonly actions: unknown;
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

function crossCheckActions(
	actions: readonly ActionDefinition[],
	timeBudgetPerTurn: number
): ContentIssue[] {
	const issues: ContentIssue[] = [];
	const seen = new Set<string>();
	actions.forEach((action, index) => {
		const path = `actions[${index}]`;
		if (seen.has(action.id)) {
			issues.push({
				source: 'actions.json',
				path: `${path}.id`,
				message: `identifiant en double : ${action.id}`
			});
		}
		seen.add(action.id);

		if (action.timeCost > timeBudgetPerTurn) {
			issues.push({
				source: 'actions.json',
				path: `${path}.timeCost`,
				message: `coût en temps ${action.timeCost} supérieur au budget trimestriel ${timeBudgetPerTurn}`
			});
		}

		const costResources = new Set<string>();
		action.costs.forEach((cost, costIndex) => {
			if (costResources.has(cost.resource)) {
				issues.push({
					source: 'actions.json',
					path: `${path}.costs[${costIndex}]`,
					message: `ressource en double dans les coûts : ${cost.resource}`
				});
			}
			costResources.add(cost.resource);
		});
	});
	return issues;
}

export function validateContent(raw: RawContent): ContentValidation {
	const balance = balanceSchema.safeParse(raw.balance);
	const catalog = actionCatalogSchema.safeParse(raw.actions);

	const issues: ContentIssue[] = [];
	if (!balance.success) issues.push(...zodIssues('balance.json', balance.error));
	if (!catalog.success) issues.push(...zodIssues('actions.json', catalog.error));
	if (!balance.success || !catalog.success) return { ok: false, issues };

	issues.push(...crossCheckActions(catalog.data.actions, balance.data.timeBudgetPerTurn));
	if (issues.length > 0) return { ok: false, issues };

	const actions: Record<string, ActionDefinition> = {};
	for (const action of catalog.data.actions) actions[action.id] = action;
	return {
		ok: true,
		content: {
			balance: balance.data,
			actions,
			actionIds: catalog.data.actions.map((action) => action.id)
		}
	};
}
