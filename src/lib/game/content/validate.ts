/**
 * Validation complète des catalogues (ARCHITECTURE.md §7) :
 *   1. structure par les schémas Zod ;
 *   2. contrôles croisés : identifiants uniques (actions et améliorations
 *      partagent un même espace de noms), ressources non dupliquées, temps
 *      compatible avec le budget trimestriel, trésorerie unique par amélioration,
 *      événements cohérents (suites existantes, textes sans variable inconnue,
 *      choix de repli, acteurs disponibles dans la distribution).
 * Renvoie soit le contenu indexé, soit la liste complète des problèmes.
 */
import type { z } from 'zod';
import {
	actionCatalogSchema,
	balanceSchema,
	castCatalogSchema,
	eventCatalogSchema,
	upgradeCatalogSchema
} from './schemas.ts';
import {
	TREASURY_IDS,
	type ActionDefinition,
	type CastMember,
	type Content,
	type EventDefinition,
	type ResourceAmount,
	type UpgradeDefinition
} from './types.ts';
import { contentFingerprint } from './version.ts';

/** Variables de texte : `{role}`. Toute autre accolade est interdite. */
export const TEMPLATE_VARIABLE = /\{([^{}]*)\}/g;

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
	readonly cast: unknown;
	/** Fichiers d'événements, par nom de fichier (par exemple `events/press.json`). */
	readonly events: Readonly<Record<string, unknown>>;
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

interface SourcedEvent {
	readonly source: string;
	readonly index: number;
	readonly event: EventDefinition;
}

function crossCheckEvents(
	events: readonly SourcedEvent[],
	cast: readonly CastMember[],
	knownIds: Set<string>
): ContentIssue[] {
	const issues: ContentIssue[] = [];
	const eventIds = new Set(events.map(({ event }) => event.id));

	const castIds = new Set<string>();
	cast.forEach((member, index) => {
		if (castIds.has(member.id) || knownIds.has(member.id)) {
			issues.push({
				source: 'cast.json',
				path: `cast[${index}].id`,
				message: `identifiant en double : ${member.id}`
			});
		}
		castIds.add(member.id);
	});

	for (const { source, index, event } of events) {
		const path = `events[${index}]`;
		if (knownIds.has(event.id)) {
			issues.push({ source, path: `${path}.id`, message: `identifiant en double : ${event.id}` });
		}
		knownIds.add(event.id);

		const roles = new Set<string>();
		event.actors.forEach((slot, slotIndex) => {
			if (roles.has(slot.role)) {
				issues.push({
					source,
					path: `${path}.actors[${slotIndex}].role`,
					message: `rôle en double : ${slot.role}`
				});
			}
			roles.add(slot.role);
			const candidates = cast.filter((member) =>
				slot.tags.every((tag) => member.tags.includes(tag))
			);
			if (candidates.length === 0) {
				issues.push({
					source,
					path: `${path}.actors[${slotIndex}].tags`,
					message: `aucun membre de la distribution ne porte les étiquettes ${slot.tags.join(', ')}`
				});
			}
		});
		if (event.actors.length > cast.length) {
			issues.push({
				source,
				path: `${path}.actors`,
				message: 'plus de rôles que de membres de la distribution'
			});
		}

		const checkText = (text: string, textPath: string): void => {
			for (const match of text.matchAll(TEMPLATE_VARIABLE)) {
				const role = match[1] ?? '';
				if (!roles.has(role)) {
					issues.push({
						source,
						path: textPath,
						message: `variable de texte inconnue : {${role}}`
					});
				}
			}
			if (/[{}]/.test(text.replace(TEMPLATE_VARIABLE, ''))) {
				issues.push({ source, path: textPath, message: 'accolade isolée dans le texte' });
			}
		};
		checkText(event.title, `${path}.title`);
		checkText(event.text, `${path}.text`);

		if (event.blocking) {
			const choiceIds = new Set<string>();
			event.choices.forEach((choice, choiceIndex) => {
				const choicePath = `${path}.choices[${choiceIndex}]`;
				if (choiceIds.has(choice.id)) {
					issues.push({
						source,
						path: `${choicePath}.id`,
						message: `choix en double : ${choice.id}`
					});
				}
				choiceIds.add(choice.id);
				checkText(choice.label, `${choicePath}.label`);
				choice.hints.forEach((hint, hintIndex) =>
					checkText(hint, `${choicePath}.hints[${hintIndex}]`)
				);
				issues.push(
					...duplicateResources(choice.costs, source, `${choicePath}.costs`, 'les coûts')
				);
				if (choice.followUp && !eventIds.has(choice.followUp.eventId)) {
					issues.push({
						source,
						path: `${choicePath}.followUp.eventId`,
						message: `suite inconnue : ${choice.followUp.eventId}`
					});
				}
			});
			// Toujours une issue : au moins un choix sans prérequis ni coût.
			if (!event.choices.some((choice) => !choice.requires && choice.costs.length === 0)) {
				issues.push({
					source,
					path: `${path}.choices`,
					message: 'aucun choix de repli (sans prérequis ni coût)'
				});
			}
		}
	}

	// Une suite `followUp` doit être atteignable par au moins un choix.
	const reachable = new Set(
		events.flatMap(({ event }) =>
			event.blocking
				? event.choices.flatMap((choice) => (choice.followUp ? [choice.followUp.eventId] : []))
				: []
		)
	);
	for (const { source, index, event } of events) {
		if (event.trigger === 'followUp' && !reachable.has(event.id)) {
			issues.push({
				source,
				path: `events[${index}].trigger`,
				message: `suite jamais déclenchée par un choix : ${event.id}`
			});
		}
	}
	return issues;
}

export function validateContent(raw: RawContent): ContentValidation {
	const balance = balanceSchema.safeParse(raw.balance);
	const actionCatalog = actionCatalogSchema.safeParse(raw.actions);
	const upgradeCatalog = upgradeCatalogSchema.safeParse(raw.upgrades);
	const castCatalog = castCatalogSchema.safeParse(raw.cast);
	const eventFiles = Object.keys(raw.events)
		.sort()
		.map((source) => ({ source, parsed: eventCatalogSchema.safeParse(raw.events[source]) }));

	const issues: ContentIssue[] = [];
	if (!balance.success) issues.push(...zodIssues('balance.json', balance.error));
	if (!actionCatalog.success) issues.push(...zodIssues('actions.json', actionCatalog.error));
	if (!upgradeCatalog.success) issues.push(...zodIssues('upgrades.json', upgradeCatalog.error));
	if (!castCatalog.success) issues.push(...zodIssues('cast.json', castCatalog.error));
	for (const { source, parsed } of eventFiles) {
		if (!parsed.success) issues.push(...zodIssues(source, parsed.error));
	}
	if (
		!balance.success ||
		!actionCatalog.success ||
		!upgradeCatalog.success ||
		!castCatalog.success ||
		eventFiles.some(({ parsed }) => !parsed.success)
	) {
		return { ok: false, issues };
	}

	const actionList = actionCatalog.data.actions;
	const upgradeList = upgradeCatalog.data.upgrades;
	const castList = castCatalog.data.cast;
	const sourcedEvents: SourcedEvent[] = eventFiles.flatMap(({ source, parsed }) =>
		parsed.success ? parsed.data.events.map((event, index) => ({ source, index, event })) : []
	);
	issues.push(...crossCheck(actionList, upgradeList, balance.data.timeBudgetPerTurn));
	const knownIds = new Set([...actionList.map((a) => a.id), ...upgradeList.map((u) => u.id)]);
	issues.push(...crossCheckEvents(sourcedEvents, castList, knownIds));
	if (issues.length > 0) return { ok: false, issues };

	const actions: Record<string, ActionDefinition> = {};
	for (const action of actionList) actions[action.id] = action;
	const upgrades: Record<string, UpgradeDefinition> = {};
	for (const upgrade of upgradeList) upgrades[upgrade.id] = upgrade;
	const events: Record<string, EventDefinition> = {};
	for (const { event } of sourcedEvents) events[event.id] = event;
	const cast: Record<string, CastMember> = {};
	for (const member of castList) cast[member.id] = member;
	return {
		ok: true,
		content: {
			version: contentFingerprint({
				actions: actionCatalog.data,
				upgrades: upgradeCatalog.data,
				balance: balance.data,
				cast: castCatalog.data,
				events: Object.fromEntries(eventFiles.map(({ source, parsed }) => [source, parsed.data]))
			}),
			balance: balance.data,
			actions,
			actionIds: actionList.map((action) => action.id),
			upgrades,
			upgradeIds: upgradeList.map((upgrade) => upgrade.id),
			events,
			eventIds: Object.keys(events).sort(),
			cast,
			castIds: Object.keys(cast).sort()
		}
	};
}
