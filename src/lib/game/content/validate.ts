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
	traitCatalogSchema,
	careerCatalogSchema,
	supportCatalogSchema,
	entourageCatalogSchema,
	profileCatalogSchema,
	justiceCatalogSchema,
	wealthCatalogSchema,
	promisesCatalogSchema,
	mediaCatalogSchema,
	reformsCatalogSchema,
	epitaphsCatalogSchema,
	upgradeCatalogSchema,
	worldSchema
} from './schemas.ts';
import {
	ARTICLE_TONES,
	ARTICLE_TOPICS,
	REGIONAL_ANCHOR,
	END_CAUSES,
	PARTY_REFERENCES,
	START_YEAR,
	PROMISE_PLACE_VARIABLE,
	PROMISE_VARIABLE,
	POST_VARIABLE,
	INCUMBENT_VARIABLE,
	TREASURY_IDS,
	WORLD_TEMPLATE_VARIABLES,
	ACTION_FORMATS,
	type ActionDefinition,
	type ActionFamilyDefinition,
	type CandidateProfileDefinition,
	type EntourageBalance,
	SEARCH_LEVELS,
	type Balance,
	type CastMember,
	type CapabilityId,
	type Condition,
	type Content,
	type Effect,
	type TerritoryDefinition,
	type TownTraitDefinition,
	type ElectionDefinition,
	type EventDefinition,
	type InstitutionsDefinition,
	type MandateDefinition,
	type MissionDefinition,
	type OriginDefinition,
	type EngagementDefinition,
	type PostDefinition,
	type SupportGroupDefinition,
	type PartyDefinition,
	type JusticeDefinition,
	type OffenseDefinition,
	type LifestyleDefinition,
	type WealthDefinition,
	type PromiseDefinition,
	type PromiseThemeDefinition,
	type PromisesDefinition,
	type MediaCatalog,
	type InstitutionParameter,
	type ReformsCatalog,
	type EpitaphsCatalog,
	type MediaDefinition,
	type ResourceAmount,
	type TraitDefinition,
	type UpgradeDefinition,
	type WorldDefinition
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
	/** Partis, axes et noms du monde (`world.json`). */
	readonly world: unknown;
	/** Traits de personnalité (`traits.json`). */
	readonly traits: unknown;
	/** Élections, mandats et règles du cumul (`career.json`). */
	readonly career: unknown;
	/** Groupes de soutien (`supports.json`). */
	readonly supports: unknown;
	/** Postes clés et missions de l'entourage (`entourage.json`). */
	readonly entourage: unknown;
	/** Origines, engagements et profil par défaut (`profiles.json`). */
	readonly profiles: unknown;
	/** Infractions du registre des faits et jauges de la justice (`justice.json`). */
	readonly justice: unknown;
	/** Trains de vie (`wealth.json`). */
	readonly wealth: unknown;
	/** Promesses types et règles du registre (`promises.json`). */
	readonly promises: unknown;
	/** Médias, titres de presse et règles du fil de presse (`media.json`). */
	readonly media: unknown;
	/** Paramètres institutionnels et règles des réformes (`institutions.json`). */
	readonly institutions: unknown;
	/** Nécrologies et distinctions du bilan final (`epitaphs.json`). */
	readonly epitaphs: unknown;
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

// ---------------------------------------------------------------------------
// Monde : partis et références politiques
// ---------------------------------------------------------------------------

function crossCheckWorld(
	world: WorldDefinition,
	balance: Balance,
	knownIds: Set<string>
): ContentIssue[] {
	const issues: ContentIssue[] = [];
	const source = 'world.json';
	world.eras.forEach((era, index) => {
		if (knownIds.has(era.id)) {
			issues.push({
				source,
				path: `eras[${index}].id`,
				message: `identifiant en double : ${era.id}`
			});
		}
		knownIds.add(era.id);
		const previous = world.eras[index - 1];
		if (index === 0 && era.fromYear !== START_YEAR) {
			issues.push({
				source,
				path: `eras[0].fromYear`,
				message: `la première époque commence avec la partie (${START_YEAR})`
			});
		}
		if (previous && era.fromYear <= previous.fromYear) {
			issues.push({
				source,
				path: `eras[${index}].fromYear`,
				message: 'époques par année de début strictement croissante'
			});
		}
	});
	const axisIds = new Set<string>();
	world.axes.forEach((axis, index) => {
		if (axisIds.has(axis.id)) {
			issues.push({ source, path: `axes[${index}].id`, message: `axe en double : ${axis.id}` });
		}
		axisIds.add(axis.id);
	});
	const partyIds = new Set<string>();
	const names = new Set<string>();
	world.parties.forEach((party, index) => {
		if (partyIds.has(party.id) || knownIds.has(party.id)) {
			issues.push({
				source,
				path: `parties[${index}].id`,
				message: `identifiant en double : ${party.id}`
			});
		}
		partyIds.add(party.id);
		knownIds.add(party.id);
		if (names.has(party.name)) {
			issues.push({
				source,
				path: `parties[${index}].name`,
				message: `nom de parti en double : ${party.name}`
			});
		}
		names.add(party.name);
		const { minPartyStrength, maxPartyStrength } = balance.world;
		if (party.baseStrength < minPartyStrength || party.baseStrength > maxPartyStrength) {
			issues.push({
				source,
				path: `parties[${index}].baseStrength`,
				message: `force de référence hors des bornes ${minPartyStrength}–${maxPartyStrength}`
			});
		}
	});
	if (!partyIds.has(world.startingGoverningParty)) {
		issues.push({
			source,
			path: 'startingGoverningParty',
			message: `parti inconnu : ${world.startingGoverningParty}`
		});
	}
	// Assez de combinaisons de noms pour renouveler les directions sans doublon.
	const combinations = new Set(world.names.first).size * new Set(world.names.last).size;
	if (combinations < world.parties.length * 10) {
		issues.push({
			source,
			path: 'names',
			message: `trop peu de combinaisons de noms (${combinations}) pour ${world.parties.length} partis`
		});
	}
	return issues;
}

/** Identifiants connus, pour les références des conditions et des effets. */
interface Refs {
	readonly parties: ReadonlySet<string>;
	readonly mandates: ReadonlySet<string>;
	readonly portfolios: ReadonlySet<string>;
	readonly elections: ReadonlySet<string>;
	readonly groups: ReadonlySet<string>;
	readonly origins: ReadonlySet<string>;
	readonly engagements: ReadonlySet<string>;
	/** Infractions et capacité exigée de leur auteur (P3-12). */
	readonly offenses: ReadonlyMap<string, CapabilityId>;
	/** Profils de candidats de l'entourage. */
	readonly candidateProfiles: ReadonlySet<string>;
	readonly lifestyles: ReadonlySet<string>;
	readonly media: ReadonlySet<string>;
	readonly upgrades: ReadonlySet<string>;
	/** Niveaux institutionnels, par paramètre. */
	readonly institutions: ReadonlyMap<string, ReadonlySet<string>>;
}

/** Vérifie les partis et mandats cités par une condition. */
function conditionIssues(
	condition: Condition | undefined,
	refs: Refs,
	source: string,
	path: string
): ContentIssue[] {
	if (!condition) return [];
	switch (condition.op) {
		case 'all':
		case 'any':
			return condition.conditions.flatMap((child, index) =>
				conditionIssues(child, refs, source, `${path}.conditions[${index}]`)
			);
		case 'not':
			return conditionIssues(condition.condition, refs, source, `${path}.condition`);
		case 'memberOf':
			return refs.parties.has(condition.party)
				? []
				: [{ source, path: `${path}.party`, message: `parti inconnu : ${condition.party}` }];
		case 'origin':
			return refs.origins.has(condition.origin)
				? []
				: [{ source, path: `${path}.origin`, message: `origine inconnue : ${condition.origin}` }];
		case 'institution': {
			const levels = refs.institutions.get(condition.parameter);
			if (!levels) {
				return [
					{
						source,
						path: `${path}.parameter`,
						message: `paramètre institutionnel inconnu : ${condition.parameter}`
					}
				];
			}
			return levels.has(condition.level)
				? []
				: [
						{
							source,
							path: `${path}.level`,
							message: `niveau inconnu pour ${condition.parameter} : ${condition.level}`
						}
					];
		}
		case 'ownsUpgrade':
			return refs.upgrades.has(condition.upgrade)
				? []
				: [
						{
							source,
							path: `${path}.upgrade`,
							message: `amélioration inconnue : ${condition.upgrade}`
						}
					];
		case 'lifestyle':
			return refs.lifestyles.has(condition.lifestyle)
				? []
				: [
						{
							source,
							path: `${path}.lifestyle`,
							message: `train de vie inconnu : ${condition.lifestyle}`
						}
					];
		case 'engagement':
			return refs.engagements.has(condition.engagement)
				? []
				: [
						{
							source,
							path: `${path}.engagement`,
							message: `engagement inconnue : ${condition.engagement}`
						}
					];
		case 'support':
			return refs.groups.has(condition.group)
				? []
				: [
						{
							source,
							path: `${path}.group`,
							message: `groupe de soutien inconnu : ${condition.group}`
						}
					];
		case 'capability':
			return condition.capability === 'real_hire'
				? [
						{
							source,
							path: `${path}.capability`,
							message: 'l’embauche réelle se vérifie sur l’effet d’embauche, pas en condition'
						}
					]
				: [];
		case 'holdsPortfolio':
			return refs.portfolios.has(condition.portfolio)
				? []
				: [
						{
							source,
							path: `${path}.portfolio`,
							message: `portefeuille inconnu : ${condition.portfolio}`
						}
					];
		case 'holdsMandate':
		case 'canHoldMandate':
			return refs.mandates.has(condition.mandate)
				? []
				: [{ source, path: `${path}.mandate`, message: `mandat inconnu : ${condition.mandate}` }];
		default:
			return [];
	}
}

/**
 * Vérifie les références des effets. `target` n'est permis que dans une action
 * ciblant le bon type d'objet (`targetKind`) ; les effets sur un personnage
 * n'existent que dans les événements (`roles`).
 */
function effectIssues(
	effects: readonly Effect[],
	refs: Refs,
	targetKind: ActionDefinition['target'] | null,
	source: string,
	path: string,
	roles: ReadonlySet<string> | null = null,
	/** Événement de sujet `promise` : il agit sur la promesse que le moteur lui transmet. */
	promiseSubject = false,
	/** Événement de sujet `post` : il agit sur le poste lié à sa création (P3-12). */
	postSubject = false
): ContentIssue[] {
	const issues: ContentIssue[] = [];
	effects.forEach((effect, index) => {
		const at = `${path}[${index}]`;
		switch (effect.op) {
			case 'addRelation':
			case 'revealTraits':
				if (roles === null) {
					issues.push({
						source,
						path: `${at}.role`,
						message: 'effet sur un personnage réservé aux événements'
					});
				} else if (!roles.has(effect.role)) {
					issues.push({
						source,
						path: `${at}.role`,
						message: `rôle inconnu de l’événement : ${effect.role}`
					});
				}
				break;
			case 'addPartyStrength': {
				const relative = (PARTY_REFERENCES as readonly string[]).includes(effect.party);
				if (!relative && !refs.parties.has(effect.party)) {
					issues.push({ source, path: `${at}.party`, message: `parti inconnu : ${effect.party}` });
				}
				break;
			}
			case 'joinParty':
				if (effect.party === 'target') {
					if (targetKind !== 'party') {
						issues.push({
							source,
							path: `${at}.party`,
							message: '« target » réservé aux actions ciblant un parti'
						});
					}
				} else if (!refs.parties.has(effect.party)) {
					issues.push({ source, path: `${at}.party`, message: `parti inconnu : ${effect.party}` });
				}
				break;
			case 'familyJoins':
			case 'separate':
				if (roles === null) {
					issues.push({ source, path: at, message: 'vie de famille réservée aux événements' });
				}
				break;
			case 'orderSearch':
				if (targetKind !== 'search') {
					issues.push({
						source,
						path: at,
						message: 'recherche réservée aux actions ciblant un poste (« search »)'
					});
				}
				break;
			case 'grantRaise':
				if (roles === null || !roles.has(effect.role)) {
					issues.push({
						source,
						path: `${at}.role`,
						message: `augmentation réservée aux événements, rôle inconnu : ${effect.role}`
					});
				}
				break;
			case 'hireStaff':
			case 'courtCandidate':
			case 'vetCandidate':
				if (targetKind !== 'candidate') {
					issues.push({
						source,
						path: at,
						message: 'embauche réservée aux actions ciblant un candidat'
					});
				}
				break;
			case 'releaseUpgrade':
				if (targetKind !== 'upgrade' && targetKind !== 'asset') {
					issues.push({
						source,
						path: at,
						message: 'départ réservé aux actions ciblant un exemplaire de l’organisation'
					});
				}
				break;
			case 'dismissStaff':
				if (targetKind !== 'staff') {
					issues.push({
						source,
						path: at,
						message: 'renvoi réservé aux actions ciblant un collaborateur'
					});
				}
				break;
			case 'staffLeaves':
				if (roles === null || !roles.has(effect.role)) {
					issues.push({
						source,
						path: `${at}.role`,
						message: `rôle inconnu de l’événement : ${effect.role}`
					});
				}
				break;
			case 'advanceCampaign':
				if (targetKind !== 'campaign') {
					issues.push({
						source,
						path: at,
						message: 'avance réservée aux actions ciblant une candidature'
					});
				}
				break;
			case 'declareCandidacy':
				if (targetKind !== 'ballot') {
					issues.push({
						source,
						path: at,
						message: 'candidature réservée aux actions ciblant une échéance'
					});
				}
				break;
			case 'requestInvestiture':
				if (targetKind !== 'ballot') {
					issues.push({
						source,
						path: at,
						message: 'investiture réservée aux actions ciblant une échéance'
					});
				}
				break;
			case 'investitureDecision':
			case 'appointment':
			case 'runoffDecision':
				if (roles === null) {
					issues.push({
						source,
						path: at,
						message: 'décision d’entre-deux-tours réservée aux événements'
					});
				}
				break;
			case 'addSupport':
				if (!refs.groups.has(effect.group)) {
					issues.push({
						source,
						path: `${at}.group`,
						message: `groupe de soutien inconnu : ${effect.group}`
					});
				}
				break;
			case 'grantMandate':
				if (!refs.mandates.has(effect.mandate)) {
					issues.push({
						source,
						path: `${at}.mandate`,
						message: `mandat inconnu : ${effect.mandate}`
					});
				}
				if (roles === null) {
					issues.push({
						source,
						path: `${at}.mandate`,
						message: 'attribution de mandat réservée aux événements'
					});
				}
				break;
			case 'endMandate':
				if (effect.mandate === 'target') {
					if (targetKind !== 'mandate') {
						issues.push({
							source,
							path: `${at}.mandate`,
							message: '« target » réservé aux actions ciblant un mandat'
						});
					}
				} else if (!refs.mandates.has(effect.mandate)) {
					issues.push({
						source,
						path: `${at}.mandate`,
						message: `mandat inconnu : ${effect.mandate}`
					});
				}
				break;
			case 'callEarlyElection':
				if (!refs.elections.has(effect.election)) {
					issues.push({
						source,
						path: `${at}.election`,
						message: `élection inconnue : ${effect.election}`
					});
				}
				if (roles === null) {
					issues.push({
						source,
						path: `${at}.election`,
						message: 'élection anticipée réservée aux événements'
					});
				}
				break;
			case 'setLifestyle':
				if (!refs.lifestyles.has(effect.lifestyle)) {
					issues.push({
						source,
						path: `${at}.lifestyle`,
						message: `train de vie inconnu : ${effect.lifestyle}`
					});
				}
				break;
			case 'addMediaRelation':
				if (
					effect.media === 'target'
						? targetKind !== 'media'
						: effect.media !== REGIONAL_ANCHOR && !refs.media.has(effect.media)
				) {
					issues.push({
						source,
						path: `${at}.media`,
						message:
							effect.media === 'target'
								? '« target » réservé aux actions ciblant un média'
								: `média inconnu : ${effect.media}`
					});
				}
				break;
			case 'proposeReform':
				if (targetKind !== 'reform') {
					issues.push({
						source,
						path: at,
						message: 'proposition réservée aux actions ciblant une réforme'
					});
				}
				break;
			case 'giveInterview':
				if (targetKind !== 'media') {
					issues.push({
						source,
						path: at,
						message: 'interview réservée aux actions ciblant un média'
					});
				}
				break;
			case 'makePromise':
				if (targetKind !== 'promise') {
					issues.push({
						source,
						path: at,
						message: 'engagement réservé aux actions ciblant une promesse type'
					});
				}
				break;
			case 'advancePromise':
				if (targetKind !== 'pledge' && !promiseSubject) {
					issues.push({
						source,
						path: at,
						message:
							'avancement réservé aux actions ciblant une promesse en cours et aux événements de sujet « promise »'
					});
				}
				break;
			case 'amendPromise':
			case 'abandonPromise':
				if (!promiseSubject) {
					issues.push({
						source,
						path: at,
						message: 'compromis et renoncement réservés aux événements de sujet « promise »'
					});
				}
				break;
			case 'hireActor':
			case 'shortlistActor':
				if (roles === null || !postSubject) {
					issues.push({
						source,
						path: at,
						message: 'embauche d’un acteur réservée aux événements de sujet « post »'
					});
					break;
				}
				if (!roles.has(effect.role)) {
					issues.push({
						source,
						path: at,
						message: `rôle inconnu de l’événement : ${effect.role}`
					});
				}
				if (effect.op === 'shortlistActor' && !refs.candidateProfiles.has(effect.profile)) {
					issues.push({
						source,
						path: `${at}.profile`,
						message: `profil de candidat inconnu : ${effect.profile}`
					});
				}
				break;
			case 'recordFact': {
				if (!refs.offenses.has(effect.offense)) {
					issues.push({
						source,
						path: `${at}.offense`,
						message: `infraction inconnue : ${effect.offense}`
					});
				}
				if (roles === null) {
					issues.push({ source, path: at, message: 'fait réservé aux événements' });
					break;
				}
				const cited = [
					...(effect.author === undefined ? [] : [effect.author]),
					...(effect.accomplices ?? [])
				];
				if (new Set(cited).size !== cited.length) {
					issues.push({ source, path: at, message: 'protagoniste cité deux fois' });
				}
				for (const role of cited) {
					if (!roles.has(role)) {
						issues.push({
							source,
							path: at,
							message: `rôle inconnu de l’événement : ${role}`
						});
					}
				}
				break;
			}
			default:
				break;
		}
	});
	return issues;
}

/** La condition impose-t-elle, à coup sûr, que le joueur soit encarté ? */
export function requiresAffiliation(condition: Condition | undefined): boolean {
	if (!condition) return false;
	switch (condition.op) {
		case 'memberOf':
			return true;
		case 'all':
			return condition.conditions.some(requiresAffiliation);
		case 'any':
			return condition.conditions.length > 0 && condition.conditions.every(requiresAffiliation);
		case 'gte':
			return condition.stat === 'player.affiliated' && condition.value >= 1;
		case 'eq':
			return condition.stat === 'player.affiliated' && condition.value === 1;
		default:
			return false;
	}
}

/** Conditions imposées en conjonction (directement ou dans un `all`), sans `any` ni `not`. */
function requiredCapabilities(condition: Condition | undefined): CapabilityId[] {
	if (!condition) return [];
	if (condition.op === 'capability') return [condition.capability];
	if (condition.op === 'all') return condition.conditions.flatMap(requiredCapabilities);
	return [];
}

/**
 * Garde statique du registre (P3-12) : chaque fait exige la capacité de son
 * infraction dans la condition de l'événement ou du choix ; un emploi fictif
 * exige une embauche antérieure, dans le même choix, de l'un de ses protagonistes.
 */
function capabilityIssues(
	effects: readonly Effect[],
	conditions: readonly (Condition | undefined)[],
	refs: Refs,
	source: string,
	path: string
): ContentIssue[] {
	const issues: ContentIssue[] = [];
	const imposed = new Set(conditions.flatMap(requiredCapabilities));
	effects.forEach((effect, index) => {
		if (effect.op !== 'recordFact') return;
		const capability = refs.offenses.get(effect.offense);
		if (capability === undefined) return;
		if (capability === 'real_hire') {
			const cited = [
				...(effect.author === undefined ? [] : [effect.author]),
				...(effect.accomplices ?? [])
			];
			const hired = effects
				.slice(0, index)
				.some((earlier) => earlier.op === 'hireActor' && cited.includes(earlier.role));
			if (!hired) {
				issues.push({
					source,
					path: `${path}[${index}]`,
					message: `${effect.offense} exige l’embauche réelle d’un protagoniste (hireActor) avant le fait`
				});
			}
			return;
		}
		if (!imposed.has(capability)) {
			issues.push({
				source,
				path: `${path}[${index}]`,
				message: `${effect.offense} exige la capacité « ${capability} » dans la condition de l’événement ou du choix`
			});
		}
	});
	return issues;
}

function crossCheckPolitics(
	actions: readonly ActionDefinition[],
	upgrades: readonly UpgradeDefinition[],
	events: readonly SourcedEvent[],
	refs: Refs
): ContentIssue[] {
	const issues: ContentIssue[] = [];
	actions.forEach((action, index) => {
		const path = `actions[${index}]`;
		issues.push(...conditionIssues(action.requires, refs, 'actions.json', `${path}.requires`));
		const targetKind = action.target ?? null;
		issues.push(
			...effectIssues(action.effects, refs, targetKind, 'actions.json', `${path}.effects`)
		);
		const usesTarget = action.effects.some(
			(effect) =>
				(effect.op === 'joinParty' && effect.party === 'target') ||
				(effect.op === 'endMandate' && effect.mandate === 'target') ||
				effect.op === 'declareCandidacy' ||
				effect.op === 'requestInvestiture' ||
				effect.op === 'advanceCampaign' ||
				effect.op === 'hireStaff' ||
				effect.op === 'courtCandidate' ||
				effect.op === 'vetCandidate' ||
				effect.op === 'orderSearch' ||
				effect.op === 'dismissStaff' ||
				effect.op === 'releaseUpgrade' ||
				effect.op === 'makePromise' ||
				(effect.op === 'advancePromise' && targetKind === 'pledge') ||
				(effect.op === 'addMediaRelation' && effect.media === 'target') ||
				effect.op === 'giveInterview' ||
				effect.op === 'proposeReform'
		);
		if (targetKind !== null && !usesTarget) {
			issues.push({
				source: 'actions.json',
				path: `${path}.target`,
				message: 'cible déclarée mais jamais utilisée'
			});
		}
	});
	upgrades.forEach((upgrade, index) => {
		issues.push(
			...conditionIssues(upgrade.requires, refs, 'upgrades.json', `upgrades[${index}].requires`)
		);
		const release = upgrade.releaseEffects ?? [];
		const path = `upgrades[${index}].releaseEffects`;
		issues.push(...effectIssues(release, refs, null, 'upgrades.json', path));
		release.forEach((effect, effectIndex) => {
			if (!['addResource', 'addStat', 'addSupport'].includes(effect.op)) {
				issues.push({
					source: 'upgrades.json',
					path: `${path}[${effectIndex}]`,
					message: 'un départ n’a que des effets certains : ressources, jauges ou soutiens'
				});
			}
		});
	});
	for (const { source, index, event } of events) {
		const path = `events[${index}]`;
		issues.push(...conditionIssues(event.when, refs, source, `${path}.when`));
		const roles = new Set(event.actors.map((slot) => slot.role));
		const subject = event.subject === 'promise';
		const post = event.subject === 'post';
		if (event.blocking) {
			event.choices.forEach((choice, choiceIndex) => {
				const choicePath = `${path}.choices[${choiceIndex}]`;
				issues.push(...conditionIssues(choice.requires, refs, source, `${choicePath}.requires`));
				issues.push(
					...effectIssues(
						choice.effects,
						refs,
						null,
						source,
						`${choicePath}.effects`,
						roles,
						subject,
						post
					)
				);
				issues.push(
					...capabilityIssues(
						choice.effects,
						[event.when, choice.requires],
						refs,
						source,
						`${choicePath}.effects`
					)
				);
			});
		} else {
			issues.push(
				...effectIssues(event.effects, refs, null, source, `${path}.effects`, roles, subject, post)
			);
			issues.push(
				...capabilityIssues(event.effects, [event.when], refs, source, `${path}.effects`)
			);
		}
	}
	return issues;
}

function crossCheckSupports(
	groups: readonly SupportGroupDefinition[],
	knownIds: Set<string>
): ContentIssue[] {
	const issues: ContentIssue[] = [];
	groups.forEach((group, index) => {
		if (knownIds.has(group.id)) {
			issues.push({
				source: 'supports.json',
				path: `groups[${index}].id`,
				message: `identifiant en double : ${group.id}`
			});
		}
		knownIds.add(group.id);
	});
	if (!groups.some((group) => group.kind === 'electoral')) {
		issues.push({
			source: 'supports.json',
			path: 'groups',
			message: 'au moins un groupe électoral est nécessaire à la popularité'
		});
	}
	return issues;
}

/** Effets permis à la création d'un personnage (origine et engagement). */
const PROFILE_EFFECTS = new Set(['addResource', 'addSupport', 'addStat']);

function crossCheckProfiles(
	origins: readonly OriginDefinition[],
	engagements: readonly EngagementDefinition[],
	defaults: { readonly origin: string; readonly engagement: string },
	refs: Refs,
	knownIds: Set<string>
): ContentIssue[] {
	const issues: ContentIssue[] = [];
	const source = 'profiles.json';
	const check = (
		list: readonly (OriginDefinition | EngagementDefinition)[],
		field: 'origins' | 'engagements'
	): void => {
		list.forEach((entry, index) => {
			const path = `${field}[${index}]`;
			if (knownIds.has(entry.id)) {
				issues.push({ source, path: `${path}.id`, message: `identifiant en double : ${entry.id}` });
			}
			knownIds.add(entry.id);
			entry.effects.forEach((effect, effectIndex) => {
				if (!PROFILE_EFFECTS.has(effect.op)) {
					issues.push({
						source,
						path: `${path}.effects[${effectIndex}]`,
						message: `effet non permis à la création : ${effect.op}`
					});
				}
			});
			issues.push(...effectIssues(entry.effects, refs, null, source, `${path}.effects`));
		});
	};
	check(origins, 'origins');
	check(engagements, 'engagements');
	if (!refs.origins.has(defaults.origin)) {
		issues.push({
			source,
			path: 'defaults.origin',
			message: `origine inconnue : ${defaults.origin}`
		});
	}
	if (!refs.engagements.has(defaults.engagement)) {
		issues.push({
			source,
			path: 'defaults.engagement',
			message: `engagement inconnue : ${defaults.engagement}`
		});
	}
	return issues;
}

/** Variables permises dans un modèle de nom de commune (P3-16). */
export const TOPONYM_VARIABLES = [
	'root',
	'river',
	'pays',
	'saint',
	'complement',
	'plural',
	'standalone'
] as const;

/** Combinaisons de traits possibles pour une taille de commune (P3-16). */
function traitSetExists(territory: TerritoryDefinition, sizeId: string): boolean {
	const allowed = territory.traits.filter(
		(trait) => trait.sizes === undefined || trait.sizes.includes(sizeId)
	);
	const search = (start: number, chosen: readonly TownTraitDefinition[]): boolean => {
		if (chosen.length >= territory.traitsPerTown.min) return true;
		for (let index = start; index < allowed.length; index += 1) {
			const trait = allowed[index]!;
			const clash = chosen.some(
				(other) => other.excludes.includes(trait.id) || trait.excludes.includes(other.id)
			);
			if (!clash && search(index + 1, [...chosen, trait])) return true;
		}
		return false;
	};
	return search(0, []);
}

/**
 * Territoire d'origine (P3-16) : régions et départements uniques, au moins un
 * département de départ par région, tailles et traits cohérents (références,
 * effets de création, combinaisons possibles), modèles de noms valides.
 */
function crossCheckTerritory(
	territory: TerritoryDefinition,
	defaultRegion: string,
	refs: Refs,
	knownIds: Set<string>
): ContentIssue[] {
	const issues: ContentIssue[] = [];
	const source = 'profiles.json';
	const unique = (id: string, path: string): void => {
		if (knownIds.has(id)) issues.push({ source, path, message: `identifiant en double : ${id}` });
		knownIds.add(id);
	};
	const codes = new Set<string>();
	territory.regions.forEach((region, index) => {
		const path = `territory.regions[${index}]`;
		unique(region.id, `${path}.id`);
		region.departments.forEach((department, departmentIndex) => {
			if (codes.has(department.code)) {
				issues.push({
					source,
					path: `${path}.departments[${departmentIndex}].code`,
					message: `département en double : ${department.code}`
				});
			}
			codes.add(department.code);
		});
		if (!region.departments.some((department) => department.startable)) {
			issues.push({ source, path, message: `aucun département de départ : ${region.id}` });
		}
	});
	if (!territory.regions.some((region) => region.id === defaultRegion)) {
		issues.push({ source, path: 'defaults.region', message: `région inconnue : ${defaultRegion}` });
	}
	const sizeIds = new Set(territory.sizes.map((size) => size.id));
	const traitIds = new Set(territory.traits.map((trait) => trait.id));
	const checkEffects = (effects: readonly Effect[], path: string): void => {
		effects.forEach((effect, effectIndex) => {
			if (!PROFILE_EFFECTS.has(effect.op)) {
				issues.push({
					source,
					path: `${path}[${effectIndex}]`,
					message: `effet non permis à la création : ${effect.op}`
				});
			}
		});
		issues.push(...effectIssues(effects, refs, null, source, path));
	};
	territory.sizes.forEach((size, index) => {
		unique(size.id, `territory.sizes[${index}].id`);
		checkEffects(size.effects, `territory.sizes[${index}].effects`);
	});
	territory.traits.forEach((trait, index) => {
		const path = `territory.traits[${index}]`;
		unique(trait.id, `${path}.id`);
		for (const other of trait.excludes) {
			if (!traitIds.has(other) || other === trait.id) {
				issues.push({ source, path: `${path}.excludes`, message: `trait inconnu : ${other}` });
			}
		}
		for (const size of trait.sizes ?? []) {
			if (!sizeIds.has(size)) {
				issues.push({ source, path: `${path}.sizes`, message: `taille inconnue : ${size}` });
			}
		}
		checkEffects(trait.effects, `${path}.effects`);
		trait.origins.forEach((entry, originIndex) => {
			if (!refs.origins.has(entry.origin)) {
				issues.push({
					source,
					path: `${path}.origins[${originIndex}].origin`,
					message: `origine inconnue : ${entry.origin}`
				});
			}
			checkEffects(entry.effects, `${path}.origins[${originIndex}].effects`);
		});
	});
	const { min, max } = territory.traitsPerTown;
	if (min > max || max > territory.traits.length) {
		issues.push({
			source,
			path: 'territory.traitsPerTown',
			message: 'nombre de traits par commune incohérent'
		});
	} else {
		for (const size of territory.sizes) {
			if (!traitSetExists(territory, size.id)) {
				issues.push({
					source,
					path: 'territory.traits',
					message: `aucune combinaison de ${min} traits compatibles pour ${size.id}`
				});
			}
		}
	}
	const known = new Set<string>(TOPONYM_VARIABLES);
	const checkPatterns = (patterns: readonly { readonly pattern: string }[], path: string): void => {
		patterns.forEach((entry, index) => {
			const variables = [...entry.pattern.matchAll(/\{([a-z]+)\}/gu)].map((match) => match[1]!);
			if (variables.length === 0 || variables.some((variable) => !known.has(variable))) {
				issues.push({
					source,
					path: `${path}[${index}]`,
					message: `modèle de nom invalide : ${entry.pattern}`
				});
			}
			if (/[{}]/u.test(entry.pattern.replace(/\{[a-z]+\}/gu, ''))) {
				issues.push({
					source,
					path: `${path}[${index}]`,
					message: 'accolade isolée dans un modèle de nom'
				});
			}
		});
	};
	checkPatterns(territory.toponymy.patterns, 'territory.toponymy.patterns');
	territory.regions.forEach((region, index) => {
		if (region.toponymy.patterns) {
			checkPatterns(region.toponymy.patterns, `territory.regions[${index}].toponymy.patterns`);
		}
	});
	return issues;
}

/** Effets permis dans une mission (production déterministe, proportionnelle à la compétence). */
const MISSION_EFFECTS = new Set(['addResource', 'addSupport', 'addStat', 'prepareCampaign']);

function crossCheckEntourage(
	posts: readonly PostDefinition[],
	refs: Refs,
	knownIds: Set<string>
): ContentIssue[] {
	const issues: ContentIssue[] = [];
	const source = 'entourage.json';
	const tags = new Set<string>();
	posts.forEach((post, index) => {
		const path = `posts[${index}]`;
		if (knownIds.has(post.id)) {
			issues.push({ source, path: `${path}.id`, message: `identifiant en double : ${post.id}` });
		}
		knownIds.add(post.id);
		if (tags.has(post.tag)) {
			issues.push({ source, path: `${path}.tag`, message: `étiquette en double : ${post.tag}` });
		}
		tags.add(post.tag);
		issues.push(...conditionIssues(post.requires, refs, source, `${path}.requires`));
		post.missions.forEach((mission, missionIndex) => {
			const missionPath = `${path}.missions[${missionIndex}]`;
			if (knownIds.has(mission.id)) {
				issues.push({
					source,
					path: `${missionPath}.id`,
					message: `identifiant en double : ${mission.id}`
				});
			}
			knownIds.add(mission.id);
			mission.effects.forEach((effect, effectIndex) => {
				if (!MISSION_EFFECTS.has(effect.op)) {
					issues.push({
						source,
						path: `${missionPath}.effects[${effectIndex}]`,
						message: `effet non permis dans une mission : ${effect.op}`
					});
				}
			});
			issues.push(...effectIssues(mission.effects, refs, null, source, `${missionPath}.effects`));
		});
	});
	return issues;
}

/**
 * Recrutement II (P3-21) : profils des niveaux de recherche, prix des actions
 * égal à celui du niveau, événement de renégociation de sujet `staff`.
 */
function crossCheckRecruitment(
	entourage: EntourageBalance,
	profiles: readonly CandidateProfileDefinition[],
	actions: readonly ActionDefinition[],
	events: readonly SourcedEvent[]
): ContentIssue[] {
	const issues: ContentIssue[] = [];
	const profileIds = new Set(profiles.map((profile) => profile.id));
	for (const level of SEARCH_LEVELS) {
		const profile = entourage.search.levels[level].profile;
		if (profile !== null && !profileIds.has(profile)) {
			issues.push({
				source: 'balance.json',
				path: `entourage.search.levels.${level}.profile`,
				message: `profil de candidat inconnu : ${profile}`
			});
		}
	}
	actions.forEach((action, index) => {
		for (const effect of action.effects) {
			if (effect.op !== 'orderSearch') continue;
			const price = action.costs
				.filter((cost) => cost.resource === 'politicalBudgetCents')
				.reduce((total, cost) => total + cost.amount, 0);
			if (price !== entourage.search.levels[effect.level].costCents) {
				issues.push({
					source: 'actions.json',
					path: `actions[${index}].costs`,
					message: `le prix d’une recherche « ${effect.level} » est celui de l’équilibrage (${entourage.search.levels[effect.level].costCents})`
				});
			}
		}
	});
	const event = events.find((entry) => entry.event.id === entourage.renegotiation.event);
	if (!event) {
		issues.push({
			source: 'balance.json',
			path: 'entourage.renegotiation.event',
			message: `événement inconnu : ${entourage.renegotiation.event}`
		});
	} else if (
		!event.event.blocking ||
		event.event.trigger !== 'followUp' ||
		event.event.subject !== 'staff' ||
		!event.event.actors.some((slot) => slot.role === 'collaborator')
	) {
		issues.push({
			source: event.source,
			path: `events[${event.index}]`,
			message:
				'la renégociation est un événement bloquant « followUp » de sujet « staff » avec un rôle « collaborator »'
		});
	}
	for (const { source, index, event: definition } of events) {
		const raises =
			definition.blocking &&
			definition.choices.some((choice) =>
				choice.effects.some((effect) => effect.op === 'grantRaise')
			);
		if (raises && definition.subject !== 'staff') {
			issues.push({
				source,
				path: `events[${index}].subject`,
				message: 'une augmentation n’est accordée que par un événement de sujet « staff »'
			});
		}
		if (definition.subject === 'staff' && definition.trigger !== 'followUp') {
			issues.push({
				source,
				path: `events[${index}].trigger`,
				message: 'un événement de sujet « staff » est programmé par le moteur (« followUp »)'
			});
		}
	}
	return issues;
}

/** Élections, mandats et règles du cumul (`career.json`). */
function crossCheckCareer(
	elections: readonly ElectionDefinition[],
	mandates: readonly MandateDefinition[],
	institutions: InstitutionsDefinition,
	timeBudgetPerTurn: number,
	knownIds: Set<string>
): ContentIssue[] {
	const issues: ContentIssue[] = [];
	const source = 'career.json';
	const electionIds = new Set<string>();
	elections.forEach((election, index) => {
		if (knownIds.has(election.id)) {
			issues.push({
				source,
				path: `elections[${index}].id`,
				message: `identifiant en double : ${election.id}`
			});
		}
		knownIds.add(election.id);
		electionIds.add(election.id);
	});
	const mandateIds = new Set(mandates.map((mandate) => mandate.id));
	mandates.forEach((mandate, index) => {
		const path = `mandates[${index}]`;
		if (knownIds.has(mandate.id)) {
			issues.push({ source, path: `${path}.id`, message: `identifiant en double : ${mandate.id}` });
		}
		knownIds.add(mandate.id);
		if (mandate.election !== null && !electionIds.has(mandate.election)) {
			issues.push({
				source,
				path: `${path}.election`,
				message: `élection inconnue : ${mandate.election}`
			});
		}
		if (mandate.election === null && !mandate.endsWithGovernment) {
			issues.push({
				source,
				path: `${path}.endsWithGovernment`,
				message: 'un mandat sans élection doit prendre fin avec le gouvernement'
			});
		}
		mandate.requires.forEach((required, requiredIndex) => {
			if (!mandateIds.has(required) || required === mandate.id) {
				issues.push({
					source,
					path: `${path}.requires[${requiredIndex}]`,
					message: `mandat requis invalide : ${required}`
				});
			}
		});
		if (mandate.timePerTurn >= timeBudgetPerTurn) {
			issues.push({
				source,
				path: `${path}.timePerTurn`,
				message: `temps réservé ${mandate.timePerTurn} supérieur ou égal au budget trimestriel`
			});
		}
		issues.push(...duplicateResources(mandate.income, source, `${path}.income`, 'les revenus'));
	});
	elections.forEach((election, index) => {
		const path = `elections[${index}]`;
		const grants = [election.grants, ...(election.headGrant ? [election.headGrant] : [])];
		for (const mandateId of [...grants, ...election.requiresAnyMandate]) {
			if (!mandateIds.has(mandateId)) {
				issues.push({ source, path, message: `mandat inconnu : ${mandateId}` });
			}
		}
		const granted = mandates.find((mandate) => mandate.id === election.grants);
		if (granted && granted.election !== election.id) {
			issues.push({
				source,
				path: `${path}.grants`,
				message: `le mandat obtenu doit prendre fin à cette élection : ${election.grants}`
			});
		}
	});
	institutions.incompatibilities.forEach(([left, right], index) => {
		if (!mandateIds.has(left) || !mandateIds.has(right) || left === right) {
			issues.push({
				source,
				path: `institutions.incompatibilities[${index}]`,
				message: `incompatibilité invalide : ${left} / ${right}`
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

/**
 * Existe-t-il une distribution complète (un acteur distinct par rôle) ?
 * Recherche avec retour arrière : les petits effectifs la rendent immédiate.
 */
function matchingExists(
	candidates: readonly (readonly string[])[],
	used = new Set<string>()
): boolean {
	const [first, ...rest] = candidates;
	if (first === undefined) return true;
	return first.some((id) => {
		if (used.has(id)) return false;
		used.add(id);
		const found = matchingExists(rest, used);
		used.delete(id);
		return found;
	});
}

function crossCheckTraits(
	traits: readonly TraitDefinition[],
	balance: Balance,
	knownIds: Set<string>
): ContentIssue[] {
	const issues: ContentIssue[] = [];
	traits.forEach((trait, index) => {
		if (knownIds.has(trait.id)) {
			issues.push({
				source: 'traits.json',
				path: `traits[${index}].id`,
				message: `identifiant en double : ${trait.id}`
			});
		}
		knownIds.add(trait.id);
	});
	if (balance.characters.traitsPerCharacter > traits.length) {
		issues.push({
			source: 'balance.json',
			path: 'characters.traitsPerCharacter',
			message: `plus de traits par personnage (${balance.characters.traitsPerCharacter}) que de traits au catalogue (${traits.length})`
		});
	}
	return issues;
}

function crossCheckEvents(
	events: readonly SourcedEvent[],
	cast: readonly CastMember[],
	knownIds: Set<string>,
	traitIds: ReadonlySet<string> = new Set(),
	dynamicTags: ReadonlySet<string> = new Set(),
	/** Suites déclenchées par le moteur lui-même (révélations judiciaires, P3-01). */
	engineFollowUps: ReadonlySet<string> = new Set()
): ContentIssue[] {
	const issues: ContentIssue[] = [];
	const eventIds = new Set(events.map(({ event }) => event.id));
	// Un rôle qui exige une étiquette attribuée en cours de partie (collaborateur,
	// dirigeant) n'a pas d'acteur dans la distribution initiale.
	const isDynamic = (tags: readonly string[]): boolean => tags.some((tag) => dynamicTags.has(tag));

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
			if ((WORLD_TEMPLATE_VARIABLES as readonly string[]).includes(slot.role)) {
				issues.push({
					source,
					path: `${path}.actors[${slotIndex}].role`,
					message: `rôle réservé aux variables du monde : ${slot.role}`
				});
			}
			if (slot.role === PROMISE_VARIABLE) {
				issues.push({
					source,
					path: `${path}.actors[${slotIndex}].role`,
					message: `rôle réservé à la promesse concernée : ${slot.role}`
				});
			}
			if (slot.role === POST_VARIABLE || slot.role === INCUMBENT_VARIABLE) {
				issues.push({
					source,
					path: `${path}.actors[${slotIndex}].role`,
					message: `rôle réservé au poste concerné : ${slot.role}`
				});
			}
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
			if (candidates.length === 0 && !isDynamic(slot.tags)) {
				issues.push({
					source,
					path: `${path}.actors[${slotIndex}].tags`,
					message: `aucun membre de la distribution ne porte les étiquettes ${slot.tags.join(', ')}`
				});
			}
			(slot.traits ?? []).forEach((trait, traitIndex) => {
				if (!traitIds.has(trait)) {
					issues.push({
						source,
						path: `${path}.actors[${slotIndex}].traits[${traitIndex}]`,
						message: `trait inconnu : ${trait}`
					});
				}
			});
		});
		if (event.actors.some((slot) => isDynamic(slot.tags))) {
			// Acteurs pourvus en cours de partie : pas de distribution initiale à vérifier.
		} else if (event.actors.length > cast.length) {
			issues.push({
				source,
				path: `${path}.actors`,
				message: 'plus de rôles que de membres de la distribution'
			});
		} else if (
			// Distribution complète possible avec les personnages initiaux (étiquettes seules :
			// traits et attitudes évoluent en cours de partie).
			!matchingExists(
				event.actors.map((slot) =>
					cast
						.filter((member) => slot.tags.every((tag) => member.tags.includes(tag)))
						.map((member) => member.id)
				)
			)
		) {
			issues.push({
				source,
				path: `${path}.actors`,
				message: 'aucune distribution complète possible avec des acteurs distincts'
			});
		}

		const worldVariables = new Set<string>(WORLD_TEMPLATE_VARIABLES);
		const affiliated = requiresAffiliation(event.when);
		const checkText = (text: string, textPath: string): void => {
			for (const match of text.matchAll(TEMPLATE_VARIABLE)) {
				const role = match[1] ?? '';
				if (worldVariables.has(role)) {
					if (role.startsWith('player_party') && !affiliated) {
						issues.push({
							source,
							path: textPath,
							message: `{${role}} exige une condition imposant l’adhésion du joueur`
						});
					}
					continue;
				}
				if (role === POST_VARIABLE || role === INCUMBENT_VARIABLE) {
					if (event.subject !== 'post') {
						issues.push({
							source,
							path: textPath,
							message: `{${role}} réservé aux événements de sujet « post »`
						});
					}
					continue;
				}
				if (role === PROMISE_VARIABLE) {
					if (event.subject !== 'promise') {
						issues.push({
							source,
							path: textPath,
							message: `{${role}} réservé aux événements de sujet « promise »`
						});
					}
					continue;
				}
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
				choice.effects.forEach((effect, effectIndex) => {
					if (effect.op === 'addRelation' && effect.memory !== undefined) {
						checkText(effect.memory, `${choicePath}.effects[${effectIndex}].memory`);
					}
				});
				choice.hints.forEach((hint, hintIndex) =>
					checkText(hint, `${choicePath}.hints[${hintIndex}]`)
				);
				choice.outcome?.forEach((text, outcomeIndex) =>
					checkText(text, `${choicePath}.outcome[${outcomeIndex}]`)
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
				// Une suite qui traite d'une promesse ne la reçoit que d'un événement qui en traite.
				const next = events.find(({ event: other }) => other.id === choice.followUp?.eventId);
				if (next?.event.subject === 'promise' && event.subject !== 'promise') {
					issues.push({
						source,
						path: `${choicePath}.followUp.eventId`,
						message: `suite de sujet « promise » depuis un événement qui n’en traite pas : ${next.event.id}`
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

	// Une suite `followUp` doit être atteignable par au moins un choix ou par le moteur.
	const reachable = new Set([
		...engineFollowUps,
		...events.flatMap(({ event }) =>
			event.blocking
				? event.choices.flatMap((choice) => (choice.followUp ? [choice.followUp.eventId] : []))
				: []
		)
	]);
	for (const { source, index, event } of events) {
		if (event.subject === 'promise' && event.trigger !== 'followUp') {
			issues.push({
				source,
				path: `events[${index}].trigger`,
				message: 'un événement de sujet « promise » est programmé par le moteur (« followUp »)'
			});
		}
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
	const world = worldSchema.safeParse(raw.world);
	const traitCatalog = traitCatalogSchema.safeParse(raw.traits);
	const careerCatalog = careerCatalogSchema.safeParse(raw.career);
	const supportCatalog = supportCatalogSchema.safeParse(raw.supports);
	const entourageCatalog = entourageCatalogSchema.safeParse(raw.entourage);
	const profileCatalog = profileCatalogSchema.safeParse(raw.profiles);
	const justiceCatalog = justiceCatalogSchema.safeParse(raw.justice);
	const wealthCatalog = wealthCatalogSchema.safeParse(raw.wealth);
	const promisesCatalog = promisesCatalogSchema.safeParse(raw.promises);
	const mediaCatalog = mediaCatalogSchema.safeParse(raw.media);
	const reformsCatalog = reformsCatalogSchema.safeParse(raw.institutions);
	const epitaphsCatalog = epitaphsCatalogSchema.safeParse(raw.epitaphs);
	const eventFiles = Object.keys(raw.events)
		.sort()
		.map((source) => ({ source, parsed: eventCatalogSchema.safeParse(raw.events[source]) }));

	const issues: ContentIssue[] = [];
	if (!balance.success) issues.push(...zodIssues('balance.json', balance.error));
	if (!actionCatalog.success) issues.push(...zodIssues('actions.json', actionCatalog.error));
	if (!upgradeCatalog.success) issues.push(...zodIssues('upgrades.json', upgradeCatalog.error));
	if (!castCatalog.success) issues.push(...zodIssues('cast.json', castCatalog.error));
	if (!world.success) issues.push(...zodIssues('world.json', world.error));
	if (!traitCatalog.success) issues.push(...zodIssues('traits.json', traitCatalog.error));
	if (!careerCatalog.success) issues.push(...zodIssues('career.json', careerCatalog.error));
	if (!supportCatalog.success) issues.push(...zodIssues('supports.json', supportCatalog.error));
	if (!entourageCatalog.success) {
		issues.push(...zodIssues('entourage.json', entourageCatalog.error));
	}
	if (!profileCatalog.success) issues.push(...zodIssues('profiles.json', profileCatalog.error));
	if (!justiceCatalog.success) issues.push(...zodIssues('justice.json', justiceCatalog.error));
	if (!wealthCatalog.success) issues.push(...zodIssues('wealth.json', wealthCatalog.error));
	if (!promisesCatalog.success) {
		issues.push(...zodIssues('promises.json', promisesCatalog.error));
	}
	if (!mediaCatalog.success) issues.push(...zodIssues('media.json', mediaCatalog.error));
	if (!reformsCatalog.success) {
		issues.push(...zodIssues('institutions.json', reformsCatalog.error));
	}
	if (!epitaphsCatalog.success) {
		issues.push(...zodIssues('epitaphs.json', epitaphsCatalog.error));
	}
	for (const { source, parsed } of eventFiles) {
		if (!parsed.success) issues.push(...zodIssues(source, parsed.error));
	}
	if (
		!balance.success ||
		!actionCatalog.success ||
		!upgradeCatalog.success ||
		!castCatalog.success ||
		!world.success ||
		!traitCatalog.success ||
		!careerCatalog.success ||
		!supportCatalog.success ||
		!entourageCatalog.success ||
		!profileCatalog.success ||
		!justiceCatalog.success ||
		!wealthCatalog.success ||
		!promisesCatalog.success ||
		!mediaCatalog.success ||
		!reformsCatalog.success ||
		!epitaphsCatalog.success ||
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
	const actionCategories = actionCatalog.data.categories ?? [];
	const categoryIds = new Set(actionCategories.map((category) => category.id));
	if (categoryIds.size !== actionCategories.length) {
		issues.push({ source: 'actions.json', path: 'categories', message: 'thème en double' });
	}
	actionList.forEach((action, index) => {
		if (action.category !== undefined && !categoryIds.has(action.category)) {
			issues.push({
				source: 'actions.json',
				path: `actions[${index}].category`,
				message: `thème inconnu : ${action.category}`
			});
		}
	});
	const actionFamilyList = actionCatalog.data.families ?? [];
	issues.push(...crossCheckActionFamilies(actionList, actionFamilyList));
	const knownIds = new Set([
		...actionList.map((a) => a.id),
		...upgradeList.map((u) => u.id),
		...actionFamilyList.map((family) => family.id)
	]);
	const traitList = traitCatalog.data.traits;
	issues.push(...crossCheckTraits(traitList, balance.data, knownIds));
	issues.push(
		...crossCheckEvents(
			sourcedEvents,
			castList,
			knownIds,
			new Set(traitList.map((trait) => trait.id)),
			new Set([
				'staff',
				'candidate',
				'party_leader',
				'parent',
				'sibling',
				'partner',
				'child',
				...(entourageCatalog.data.posts ?? []).map((post) => post.tag)
			]),
			new Set([
				justiceCatalog.data.balance.revelationEvent,
				justiceCatalog.data.balance.entourageRevelationEvent,
				...promisesCatalog.data.promises.map((promise) => promise.dilemmaEvent),
				...Object.values(promisesCatalog.data.balance.recallEvents),
				balance.data.entourage.renegotiation.event,
				balance.data.elections.contests.runoffEvent,
				balance.data.campaigns.investiture.refusedEvent,
				balance.data.government.appointmentEvent
			])
		)
	);
	issues.push(...crossCheckWorld(world.data, balance.data, knownIds));
	issues.push(...crossCheckEras(world.data, actionList, upgradeList, sourcedEvents));
	const career = careerCatalog.data;
	issues.push(
		...crossCheckCareer(
			career.elections,
			career.mandates,
			career.institutions,
			balance.data.timeBudgetPerTurn,
			knownIds
		)
	);
	const groupList = supportCatalog.data.groups;
	issues.push(...crossCheckSupports(groupList, knownIds));
	if (!groupList.some((group) => group.id === balance.data.campaigns.apparatusGroup)) {
		issues.push({
			source: 'balance.json',
			path: 'campaigns.apparatusGroup',
			message: `groupe de soutien inconnu : ${balance.data.campaigns.apparatusGroup}`
		});
	}
	const profileData = profileCatalog.data;
	const refs: Refs = {
		origins: new Set(profileData.origins.map((origin) => origin.id)),
		engagements: new Set(profileData.engagements.map((engagement) => engagement.id)),
		groups: new Set(groupList.map((group) => group.id)),
		parties: new Set(world.data.parties.map((party) => party.id)),
		mandates: new Set(career.mandates.map((mandate) => mandate.id)),
		portfolios: new Set(career.portfolios.map((portfolio) => portfolio.id)),
		elections: new Set(career.elections.map((election) => election.id)),
		offenses: new Map(
			justiceCatalog.data.offenses.map((offense) => [offense.id, offense.capability])
		),
		candidateProfiles: new Set(entourageCatalog.data.profiles.map((profile) => profile.id)),
		lifestyles: new Set(wealthCatalog.data.lifestyles.map((lifestyle) => lifestyle.id)),
		media: new Set(mediaCatalog.data.media.map((media) => media.id)),
		upgrades: new Set(upgradeList.map((upgrade) => upgrade.id)),
		institutions: new Map(
			reformsCatalog.data.parameters.map((parameter) => [
				parameter.id,
				new Set(parameter.levels.map((level) => level.id))
			])
		)
	};
	issues.push(...crossCheckWealth(wealthCatalog.data, upgradeList, knownIds));
	issues.push(...crossCheckJustice(justiceCatalog.data, refs, knownIds, sourcedEvents));
	issues.push(...crossCheckPolitics(actionList, upgradeList, sourcedEvents, refs));
	issues.push(
		...crossCheckPromises(promisesCatalog.data, career.elections, refs, knownIds, sourcedEvents)
	);
	issues.push(
		...crossCheckMedia(
			mediaCatalog.data,
			upgradeList,
			refs,
			knownIds,
			new Set(profileData.territory.regions.map((region) => region.id))
		)
	);
	issues.push(...crossCheckReforms(reformsCatalog.data, career.institutions, refs, knownIds));
	issues.push(...crossCheckEpitaphs(epitaphsCatalog.data, knownIds));
	issues.push(
		...crossCheckProfiles(
			profileData.origins,
			profileData.engagements,
			profileData.defaults,
			refs,
			knownIds
		)
	);
	issues.push(
		...crossCheckTerritory(profileData.territory, profileData.defaults.region, refs, knownIds)
	);
	const postList = entourageCatalog.data.posts;
	issues.push(...crossCheckEntourage(postList, refs, knownIds));
	issues.push(
		...crossCheckRecruitment(
			balance.data.entourage,
			entourageCatalog.data.profiles,
			actionList,
			sourcedEvents
		)
	);
	const traitIdSet = new Set(traitList.map((trait) => trait.id));
	entourageCatalog.data.profiles.forEach((profile, index) => {
		if (knownIds.has(profile.id)) {
			issues.push({
				source: 'entourage.json',
				path: `profiles[${index}].id`,
				message: `identifiant en double : ${profile.id}`
			});
		}
		knownIds.add(profile.id);
		for (const trait of profile.traits) {
			if (!traitIdSet.has(trait)) {
				issues.push({
					source: 'entourage.json',
					path: `profiles[${index}].traits`,
					message: `trait inconnu : ${trait}`
				});
			}
		}
	});
	if (issues.length > 0) return { ok: false, issues };

	const actions: Record<string, ActionDefinition> = {};
	for (const action of actionList) actions[action.id] = action;
	const upgrades: Record<string, UpgradeDefinition> = {};
	for (const upgrade of upgradeList) upgrades[upgrade.id] = upgrade;
	const events: Record<string, EventDefinition> = {};
	for (const { event } of sourcedEvents) events[event.id] = event;
	const cast: Record<string, CastMember> = {};
	for (const member of castList) cast[member.id] = member;
	const traits: Record<string, TraitDefinition> = {};
	for (const trait of traitList) traits[trait.id] = trait;
	const elections: Record<string, ElectionDefinition> = {};
	for (const election of career.elections) elections[election.id] = election;
	const mandates: Record<string, MandateDefinition> = {};
	for (const mandate of career.mandates) mandates[mandate.id] = mandate;
	const origins: Record<string, OriginDefinition> = {};
	for (const origin of profileData.origins) origins[origin.id] = origin;
	const engagements: Record<string, EngagementDefinition> = {};
	for (const engagement of profileData.engagements) engagements[engagement.id] = engagement;
	const posts: Record<string, PostDefinition> = {};
	const missions: Record<string, MissionDefinition> = {};
	for (const post of postList) {
		posts[post.id] = post;
		for (const mission of post.missions) missions[mission.id] = mission;
	}
	const supportGroups: Record<string, SupportGroupDefinition> = {};
	for (const group of groupList) supportGroups[group.id] = group;
	const parties: Record<string, PartyDefinition> = {};
	for (const party of world.data.parties) parties[party.id] = party;
	const lifestyleList = [...wealthCatalog.data.lifestyles].sort(
		(left, right) => left.level - right.level
	);
	const lifestyles: Record<string, LifestyleDefinition> = {};
	for (const lifestyle of lifestyleList) lifestyles[lifestyle.id] = lifestyle;
	const offenses: Record<string, OffenseDefinition> = {};
	for (const offense of justiceCatalog.data.offenses) offenses[offense.id] = offense;
	const promises: Record<string, PromiseDefinition> = {};
	for (const promise of promisesCatalog.data.promises) promises[promise.id] = promise;
	const promiseThemes: Record<string, PromiseThemeDefinition> = {};
	for (const theme of promisesCatalog.data.themes) promiseThemes[theme.id] = theme;
	const institutionParameters: Record<string, InstitutionParameter> = {};
	const institutionLevels: Record<string, { parameterId: string; index: number }> = {};
	for (const parameter of reformsCatalog.data.parameters) {
		institutionParameters[parameter.id] = parameter;
		parameter.levels.forEach((level, index) => {
			institutionLevels[level.id] = { parameterId: parameter.id, index };
		});
	}
	const media: Record<string, MediaDefinition> = {};
	for (const entry of mediaCatalog.data.media) media[entry.id] = entry;
	return {
		ok: true,
		content: {
			version: contentFingerprint({
				actions: actionCatalog.data,
				upgrades: upgradeCatalog.data,
				balance: balance.data,
				cast: castCatalog.data,
				world: world.data,
				traits: traitCatalog.data,
				career,
				supports: supportCatalog.data,
				entourage: entourageCatalog.data,
				profiles: profileData,
				justice: justiceCatalog.data,
				wealth: wealthCatalog.data,
				promises: promisesCatalog.data,
				media: mediaCatalog.data,
				institutions: reformsCatalog.data,
				epitaphs: epitaphsCatalog.data,
				events: Object.fromEntries(eventFiles.map(({ source, parsed }) => [source, parsed.data]))
			}),
			balance: balance.data,
			actions,
			actionIds: actionList.map((action) => action.id),
			actionCategories,
			actionFamilies: Object.fromEntries(actionFamilyList.map((family) => [family.id, family])),
			actionFamilyIds: actionFamilyList.map((family) => family.id),
			upgrades,
			upgradeIds: upgradeList.map((upgrade) => upgrade.id),
			events,
			eventIds: Object.keys(events).sort(),
			cast,
			castIds: Object.keys(cast).sort(),
			world: world.data,
			traits,
			traitIds: traitList.map((trait) => trait.id),
			elections,
			electionIds: career.elections.map((election) => election.id),
			mandates,
			mandateIds: career.mandates.map((mandate) => mandate.id),
			portfolios: Object.fromEntries(
				career.portfolios.map((portfolio) => [portfolio.id, portfolio])
			),
			portfolioIds: career.portfolios.map((portfolio) => portfolio.id),
			institutions: career.institutions,
			origins,
			originIds: profileData.origins.map((origin) => origin.id),
			engagements,
			engagementIds: profileData.engagements.map((engagement) => engagement.id),
			defaultProfile: profileData.defaults,
			territory: profileData.territory,
			regions: Object.fromEntries(
				profileData.territory.regions.map((region) => [region.id, region])
			),
			regionIds: profileData.territory.regions.map((region) => region.id),
			posts,
			postIds: postList.map((post) => post.id),
			candidateProfiles: entourageCatalog.data.profiles,
			missions,
			supportGroups,
			supportGroupIds: [
				...groupList.filter((group) => group.kind === 'electoral'),
				...groupList.filter((group) => group.kind === 'influence')
			].map((group) => group.id),
			parties,
			partyIds: world.data.parties.map((party) => party.id),
			offenses,
			offenseIds: justiceCatalog.data.offenses.map((offense) => offense.id),
			justice: justiceCatalog.data.balance,
			lifestyles,
			lifestyleIds: lifestyleList.map((lifestyle) => lifestyle.id),
			wealth: {
				defaultLifestyle: wealthCatalog.data.defaultLifestyle,
				unpaidLifestyleStress: wealthCatalog.data.unpaidLifestyleStress
			},
			promises,
			promiseIds: promisesCatalog.data.promises.map((promise) => promise.id),
			promiseThemes,
			promiseRules: promisesCatalog.data.balance,
			media,
			mediaIds: mediaCatalog.data.media.map((entry) => entry.id),
			headlines: mediaCatalog.data.headlines,
			press: mediaCatalog.data.balance,
			institutionParameters,
			institutionParameterIds: reformsCatalog.data.parameters.map((parameter) => parameter.id),
			institutionLevels,
			reforms: reformsCatalog.data.balance,
			obituaries: epitaphsCatalog.data.obituaries,
			distinctions: epitaphsCatalog.data.distinctions
		}
	};
}

/** Variables permises dans une nécrologie : âge, années de carrière, plus haute fonction. */
const OBITUARY_VARIABLES: ReadonlySet<string> = new Set(['age', 'years', 'office']);

/**
 * Bilan final (P3-08) : identifiants uniques, variables permises, une
 * nécrologie générique (sans critère) pour chaque cause de fin, et
 * `{office}` seulement dans une nécrologie réservée à qui a exercé un mandat.
 */
function crossCheckEpitaphs(catalog: EpitaphsCatalog, knownIds: Set<string>): ContentIssue[] {
	const source = 'epitaphs.json';
	const issues: ContentIssue[] = [];
	const unique = (id: string, path: string): void => {
		if (knownIds.has(id)) issues.push({ source, path, message: `identifiant en double : ${id}` });
		knownIds.add(id);
	};
	catalog.obituaries.forEach((obituary, index) => {
		const path = `obituaries[${index}]`;
		unique(obituary.id, `${path}.id`);
		for (const key of ['headline', 'text'] as const) {
			for (const match of obituary[key].matchAll(TEMPLATE_VARIABLE)) {
				const name = match[1] ?? '';
				if (!OBITUARY_VARIABLES.has(name)) {
					issues.push({
						source,
						path: `${path}.${key}`,
						message: `variable non permise : {${name}}`
					});
				} else if (
					name === 'office' &&
					!obituary.criteria.some(
						(criterion) =>
							(criterion.metric === 'mandatesHeld' || criterion.metric === 'highestRank') &&
							criterion.cmp === 'gte' &&
							criterion.value >= 1
					)
				) {
					issues.push({
						source,
						path: `${path}.${key}`,
						message: '{office} réservé aux nécrologies exigeant un mandat exercé'
					});
				}
			}
		}
	});
	for (const cause of END_CAUSES) {
		if (
			!catalog.obituaries.some(
				(obituary) => obituary.causes.includes(cause) && obituary.criteria.length === 0
			)
		) {
			issues.push({
				source,
				path: 'obituaries',
				message: `aucune nécrologie générique pour la fin « ${cause} »`
			});
		}
	}
	catalog.distinctions.forEach((distinction, index) => {
		unique(distinction.id, `distinctions[${index}].id`);
	});
	return issues;
}

/** Effets permis à l'adoption ou au rejet d'une réforme : certains, sur ressources, jauges et soutiens. */
const REFORM_EFFECT_OPS: ReadonlySet<string> = new Set(['addResource', 'addStat', 'addSupport']);

/**
 * Réformes institutionnelles (P3-05) : identifiants uniques (paramètres et
 * niveaux), niveau de départ existant, effets certains, mandats connus,
 * bornes d'adoption ordonnées ; un plafond de cumul de départ identique à
 * celui de `career.json`.
 */
function crossCheckReforms(
	catalog: ReformsCatalog,
	institutions: InstitutionsDefinition,
	refs: Refs,
	knownIds: Set<string>
): ContentIssue[] {
	const source = 'institutions.json';
	const issues: ContentIssue[] = [];
	const checkEffects = (effects: readonly Effect[], path: string): void => {
		issues.push(...effectIssues(effects, refs, null, source, path));
		effects.forEach((effect, index) => {
			if (!REFORM_EFFECT_OPS.has(effect.op)) {
				issues.push({
					source,
					path: `${path}[${index}]`,
					message: `effet non permis pour une réforme : ${effect.op}`
				});
			}
		});
	};
	catalog.parameters.forEach((parameter, index) => {
		const path = `parameters[${index}]`;
		for (const id of [parameter.id, ...parameter.levels.map((level) => level.id)]) {
			if (knownIds.has(id)) {
				issues.push({ source, path, message: `identifiant en double : ${id}` });
			}
			knownIds.add(id);
		}
		const start = parameter.levels.find((level) => level.id === parameter.startLevel);
		if (!start) {
			issues.push({
				source,
				path: `${path}.startLevel`,
				message: `niveau de départ inconnu : ${parameter.startLevel}`
			});
		}
		const cap = start?.modifiers.maxMandates;
		if (cap !== undefined && cap !== institutions.maxMandates) {
			issues.push({
				source,
				path: `${path}.startLevel`,
				message: `plafond de cumul de départ différent de career.json (${institutions.maxMandates})`
			});
		}
		parameter.levels.forEach((level, levelIndex) => {
			checkEffects(level.effects, `${path}.levels[${levelIndex}].effects`);
		});
	});
	const balance = catalog.balance;
	for (const [key, mandateId] of [
		...balance.proposerMandates.map((id) => ['proposerMandates', id] as const),
		['ministerMandate', balance.ministerMandate] as const
	]) {
		if (!refs.mandates.has(mandateId)) {
			issues.push({ source, path: `balance.${key}`, message: `mandat inconnu : ${mandateId}` });
		}
	}
	const { min, max } = balance.adoptionPercent;
	if (min < 0 || max > 100 || min > max) {
		issues.push({
			source,
			path: 'balance.adoptionPercent',
			message: 'bornes d’adoption de 0 à 100, minimum inférieur au maximum'
		});
	}
	checkEffects(balance.rejectionEffects, 'balance.rejectionEffects');
	return issues;
}

/**
 * Époques (P3-07) : époques connues pour les événements, actions et
 * améliorations ; une suite ne précède jamais l'époque de l'événement qui la
 * programme (pas d'anachronisme par une chaîne).
 */
function crossCheckEras(
	world: WorldDefinition,
	actions: readonly ActionDefinition[],
	upgrades: readonly UpgradeDefinition[],
	events: readonly SourcedEvent[]
): ContentIssue[] {
	const issues: ContentIssue[] = [];
	const rank = new Map(world.eras.map((era, index) => [era.id, index]));
	const check = (eraId: string, source: string, path: string): void => {
		if (!rank.has(eraId)) issues.push({ source, path, message: `époque inconnue : ${eraId}` });
	};
	actions.forEach((action, index) => {
		if (action.fromEra !== undefined)
			check(action.fromEra, 'actions.json', `actions[${index}].fromEra`);
	});
	upgrades.forEach((upgrade, index) => {
		if (upgrade.fromEra !== undefined) {
			check(upgrade.fromEra, 'upgrades.json', `upgrades[${index}].fromEra`);
		}
	});
	const byId = new Map(events.map((entry) => [entry.event.id, entry.event]));
	const earliest = (event: EventDefinition): number =>
		event.eras === undefined ? 0 : Math.min(...event.eras.map((eraId) => rank.get(eraId) ?? 0));
	for (const { source, index, event } of events) {
		(event.eras ?? []).forEach((eraId, eraIndex) => {
			check(eraId, source, `events[${index}].eras[${eraIndex}]`);
		});
		const choices = event.blocking ? event.choices : [];
		choices.forEach((choice, choiceIndex) => {
			const next = choice.followUp ? byId.get(choice.followUp.eventId) : undefined;
			if (
				next &&
				earliest(next) > earliest(event) &&
				next.eras !== undefined &&
				event.eras === undefined
			) {
				issues.push({
					source,
					path: `events[${index}].choices[${choiceIndex}].followUp`,
					message: `suite d’une époque ultérieure depuis un événement de toutes les époques : ${next.id}`
				});
			}
		});
	}
	return issues;
}

/** Précisions de sujet permises dans un titre, par sujet (P3-03). */
const HEADLINE_DETAILS: Readonly<Record<string, readonly string[]>> = {
	justice: ['revealed', 'dismissed', 'indicted', 'appealed', 'acquitted', 'convicted'],
	promise: ['kept', 'partial', 'abandoned'],
	election: ['won', 'lost']
};

/** Variables permises dans un titre : `{subject}` et `{media}` ; rien d'autre. */
const HEADLINE_VARIABLES: ReadonlySet<string> = new Set(['subject', 'media']);

/**
 * Médias et fil de presse (P3-03) : identifiants uniques, groupes connus,
 * titres aux variables permises et précisions valides, un titre générique
 * (sans restriction) pour chaque sujet et tonalité, actifs médiatiques
 * rattachés à un média connu, un seul exemplaire et un seul actif par média.
 */
function crossCheckMedia(
	catalog: MediaCatalog,
	upgrades: readonly UpgradeDefinition[],
	refs: Refs,
	knownIds: Set<string>,
	regionIds: ReadonlySet<string>
): ContentIssue[] {
	const source = 'media.json';
	const issues: ContentIssue[] = [];
	const anchors = new Map<string, string>();
	catalog.media.forEach((entry, index) => {
		const path = `media[${index}]`;
		if (knownIds.has(entry.id)) {
			issues.push({ source, path: `${path}.id`, message: `identifiant en double : ${entry.id}` });
		}
		knownIds.add(entry.id);
		entry.groups.forEach((group, groupIndex) => {
			if (!refs.groups.has(group)) {
				issues.push({
					source,
					path: `${path}.groups[${groupIndex}]`,
					message: `groupe de soutien inconnu : ${group}`
				});
			}
		});
		// Quotidien régional (P3-18) : une région connue, et seulement pour lui.
		if (entry.scope === 'regional') {
			if (entry.region === undefined || !regionIds.has(entry.region)) {
				issues.push({
					source,
					path: `${path}.region`,
					message: `région inconnue ou absente : ${entry.region ?? '—'}`
				});
			} else if (anchors.has(entry.region)) {
				issues.push({
					source,
					path: `${path}.region`,
					message: `région déjà couverte par ${anchors.get(entry.region)}`
				});
			} else anchors.set(entry.region, entry.id);
		} else if (entry.region !== undefined) {
			issues.push({
				source,
				path: `${path}.region`,
				message: 'seul un quotidien régional est rattaché à une région'
			});
		}
	});
	for (const regionId of regionIds) {
		if (!anchors.has(regionId)) {
			issues.push({
				source,
				path: 'media',
				message: `aucun quotidien régional pour ${regionId}`
			});
		}
	}
	catalog.headlines.forEach((headline, index) => {
		const path = `headlines[${index}]`;
		if (knownIds.has(headline.id)) {
			issues.push({
				source,
				path: `${path}.id`,
				message: `identifiant en double : ${headline.id}`
			});
		}
		knownIds.add(headline.id);
		for (const match of headline.text.matchAll(TEMPLATE_VARIABLE)) {
			const name = match[1] ?? '';
			if (!HEADLINE_VARIABLES.has(name) || (headline.topic === 'ambient' && name !== 'media')) {
				issues.push({ source, path: `${path}.text`, message: `variable non permise : {${name}}` });
			}
		}
		const allowed = HEADLINE_DETAILS[headline.topic] ?? [];
		for (const detail of headline.details ?? []) {
			if (!allowed.includes(detail)) {
				issues.push({ source, path: `${path}.details`, message: `précision inconnue : ${detail}` });
			}
		}
		if (headline.topic === 'ambient' && headline.tone !== 'neutral') {
			issues.push({ source, path: `${path}.tone`, message: 'une nouvelle d’ambiance est neutre' });
		}
	});
	const generic = (topic: string, tone: string): boolean =>
		catalog.headlines.some(
			(headline) =>
				headline.topic === topic &&
				headline.tone === tone &&
				headline.kinds === undefined &&
				headline.details === undefined &&
				headline.fromYear === undefined
		);
	for (const topic of ARTICLE_TOPICS) {
		for (const tone of topic === 'ambient' ? (['neutral'] as const) : ARTICLE_TONES) {
			if (!generic(topic, tone)) {
				issues.push({
					source,
					path: 'headlines',
					message: `aucun titre générique pour le sujet « ${topic} » (${tone})`
				});
			}
		}
	}
	const owners = new Map<string, string>();
	upgrades.forEach((upgrade, index) => {
		const mediaId = upgrade.asset?.media;
		if (mediaId === undefined) return;
		const path = `upgrades[${index}].asset.media`;
		if (mediaId !== REGIONAL_ANCHOR && !refs.media.has(mediaId)) {
			issues.push({ source: 'upgrades.json', path, message: `média inconnu : ${mediaId}` });
		}
		if (upgrade.maxOwned !== 1) {
			issues.push({
				source: 'upgrades.json',
				path: `upgrades[${index}].maxOwned`,
				message: 'un actif médiatique se possède en un seul exemplaire'
			});
		}
		const previous = owners.get(mediaId);
		if (previous) {
			issues.push({
				source: 'upgrades.json',
				path,
				message: `média déjà rattaché à ${previous}`
			});
		}
		owners.set(mediaId, upgrade.id);
	});
	return issues;
}

/** Effets permis dans une promesse : certains, sur les ressources, jauges et soutiens. */
/** Coût total d'une action en centimes (ressources monétaires seulement). */
function cashCost(action: ActionDefinition): number {
	return action.costs
		.filter((cost) => cost.resource !== 'influence')
		.reduce((total, cost) => total + cost.amount, 0);
}

/**
 * Familles d'actions à l'échelle (P3-23) : identifiants uniques ; chaque action
 * à l'échelle appartient à une famille connue ; chaque famille a exactement un
 * format modeste, soutenu et majeur, de même thème, cible et époque, limités à
 * une occurrence par trimestre, au coût strictement croissant, les formats
 * supérieurs soumis à un prérequis de capacité ; une avance de campagne verse
 * exactement son coût en argent personnel.
 */
function crossCheckActionFamilies(
	actions: readonly ActionDefinition[],
	families: readonly ActionFamilyDefinition[]
): ContentIssue[] {
	const source = 'actions.json';
	const issues: ContentIssue[] = [];
	const familyIds = new Set<string>();
	families.forEach((family, index) => {
		if (familyIds.has(family.id)) {
			issues.push({ source, path: `families[${index}].id`, message: 'famille en double' });
		}
		familyIds.add(family.id);
	});
	actions.forEach((action, index) => {
		if (action.scale && !familyIds.has(action.scale.family)) {
			issues.push({
				source,
				path: `actions[${index}].scale.family`,
				message: `famille inconnue : ${action.scale.family}`
			});
		}
		for (const effect of action.effects) {
			if (effect.op !== 'advanceCampaign') continue;
			const cash = action.costs.find((cost) => cost.resource === 'personalCashCents');
			if (cash?.amount !== effect.valueCents) {
				issues.push({
					source,
					path: `actions[${index}].effects`,
					message: 'une avance de campagne verse exactement son coût en argent personnel'
				});
			}
		}
	});
	families.forEach((family, index) => {
		const path = `families[${index}]`;
		const members = actions.filter((action) => action.scale?.family === family.id);
		const byFormat = ACTION_FORMATS.map((format) =>
			members.filter((action) => action.scale?.format === format)
		);
		if (byFormat.some((list) => list.length !== 1)) {
			issues.push({
				source,
				path,
				message: 'une famille a exactement un format modeste, un soutenu et un majeur'
			});
			return;
		}
		const [modest, sustained, major] = byFormat.map((list) => list[0]!) as [
			ActionDefinition,
			ActionDefinition,
			ActionDefinition
		];
		const formats = [modest, sustained, major];
		if (
			formats.some(
				(action) =>
					action.category !== modest.category ||
					action.target !== modest.target ||
					action.fromEra !== modest.fromEra
			)
		) {
			issues.push({
				source,
				path,
				message: 'les formats d’une famille partagent thème, cible et époque'
			});
		}
		if (formats.some((action) => action.maxPerTurn !== 1)) {
			issues.push({ source, path, message: 'un format se planifie une fois par trimestre' });
		}
		if (!(cashCost(modest) < cashCost(sustained) && cashCost(sustained) < cashCost(major))) {
			issues.push({ source, path, message: 'le coût des formats croît strictement' });
		}
		const cap = family.annualCap;
		if (
			cap &&
			formats.some(
				(action) =>
					action.costs
						.filter((cost) => cost.resource === cap.resource)
						.reduce((total, cost) => total + cost.amount, 0) > cap.amount
			)
		) {
			issues.push({ source, path, message: 'un format dépasse à lui seul le plafond annuel' });
		}
		if (sustained.requires === undefined || major.requires === undefined) {
			issues.push({
				source,
				path,
				message: 'les formats soutenu et majeur exigent un prérequis de capacité'
			});
		}
	});
	return issues;
}

const PROMISE_EFFECT_OPS: ReadonlySet<string> = new Set(['addResource', 'addStat', 'addSupport']);

/**
 * Promesses types (P3-04, P3-22) : identifiants uniques, thème connu, une
 * élection connue et au plus une déclinaison par thème et élection, levier
 * attribuable par cette élection, intitulé sans variable et description avec
 * `{place}` seulement, effets
 * certains (ressources, jauges, soutiens), dilemmes et rappels existants,
 * bloquants pour les dilemmes, de sujet `promise` et programmés par le moteur ;
 * dilemme présenté avant l'échéance de réalisation.
 */
function crossCheckPromises(
	catalog: PromisesDefinition,
	elections: readonly ElectionDefinition[],
	refs: Refs,
	knownIds: Set<string>,
	events: readonly SourcedEvent[]
): ContentIssue[] {
	const source = 'promises.json';
	const issues: ContentIssue[] = [];
	const rules = catalog.balance;
	const themes = new Set<string>();
	catalog.themes.forEach((theme, index) => {
		if (themes.has(theme.id) || knownIds.has(theme.id)) {
			issues.push({
				source,
				path: `themes[${index}].id`,
				message: `identifiant en double : ${theme.id}`
			});
		}
		themes.add(theme.id);
		knownIds.add(theme.id);
	});
	const variants = new Set<string>();
	const checkEvent = (eventId: string, path: string, blocking: boolean): void => {
		const event = events.find((entry) => entry.event.id === eventId)?.event;
		if (!event) {
			issues.push({ source, path, message: `événement inconnu : ${eventId}` });
		} else if (event.subject !== 'promise' || (blocking && !event.blocking)) {
			issues.push({
				source,
				path,
				message: blocking
					? 'le dilemme doit être un événement bloquant de sujet « promise »'
					: 'le rappel doit être un événement de sujet « promise »'
			});
		}
	};
	catalog.promises.forEach((promise, index) => {
		const path = `promises[${index}]`;
		if (knownIds.has(promise.id)) {
			issues.push({ source, path: `${path}.id`, message: `identifiant en double : ${promise.id}` });
		}
		knownIds.add(promise.id);
		if (!themes.has(promise.theme)) {
			issues.push({ source, path: `${path}.theme`, message: `thème inconnu : ${promise.theme}` });
		}
		const election = elections.find((entry) => entry.id === promise.election);
		if (!election) {
			issues.push({
				source,
				path: `${path}.election`,
				message: `élection inconnue : ${promise.election}`
			});
		} else {
			// Levier vérifié (P3-22) : seul un mandat issu de cette élection peut tenir la promesse.
			const granted = new Set([election.grants, election.headGrant ?? election.grants]);
			promise.lever.forEach((mandateId, leverIndex) => {
				if (!granted.has(mandateId)) {
					issues.push({
						source,
						path: `${path}.lever[${leverIndex}]`,
						message: `levier non attribué par ${promise.election} : ${mandateId}`
					});
				}
			});
			const variant = `${promise.theme}/${promise.election}`;
			if (variants.has(variant)) {
				issues.push({
					source,
					path,
					message: `deux déclinaisons du thème ${promise.theme} pour ${promise.election}`
				});
			}
			variants.add(variant);
		}
		if (new Set(promise.lever).size !== promise.lever.length) {
			issues.push({ source, path: `${path}.lever`, message: 'levier en double' });
		}
		if (/\{[^}]*\}/u.test(promise.label)) {
			issues.push({
				source,
				path: `${path}.label`,
				message: 'l’intitulé d’une promesse ne contient aucune variable'
			});
		}
		for (const match of promise.description.matchAll(/\{([^}]*)\}/gu)) {
			if (match[1] !== PROMISE_PLACE_VARIABLE) {
				issues.push({
					source,
					path: `${path}.description`,
					message: `variable inconnue dans la description : {${match[1]}}`
				});
			}
		}
		checkEvent(promise.dilemmaEvent, `${path}.dilemmaEvent`, true);
		for (const key of ['announce', 'kept', 'partial', 'abandoned'] as const) {
			issues.push(...effectIssues(promise[key], refs, null, source, `${path}.${key}`));
			promise[key].forEach((effect, effectIndex) => {
				if (!PROMISE_EFFECT_OPS.has(effect.op)) {
					issues.push({
						source,
						path: `${path}.${key}[${effectIndex}]`,
						message: 'une promesse n’a que des effets certains : ressources, jauges ou soutiens'
					});
				}
			});
		}
	});
	for (const key of ['kept', 'abandoned', 'keptElsewhere', 'abandonedElsewhere'] as const) {
		checkEvent(rules.recallEvents[key], `balance.recallEvents.${key}`, false);
	}
	if (rules.dilemmaDelayTurns.min < 1 || rules.dilemmaDelayTurns.max >= rules.deliveryTurns) {
		issues.push({
			source,
			path: 'balance.dilemmaDelayTurns',
			message: 'le dilemme arrive au moins un trimestre après l’élection et avant l’échéance'
		});
	}
	return issues;
}

/**
 * Trains de vie aux identifiants et rangs uniques (0, 1, 2…), le plus sobre
 * gratuit et par défaut ; actifs patrimoniaux personnels, payés et entretenus
 * sur l'argent personnel, au prix d'achat non nul (leur valeur initiale).
 */
function crossCheckWealth(
	wealth: WealthDefinition,
	upgrades: readonly UpgradeDefinition[],
	knownIds: Set<string>
): ContentIssue[] {
	const issues: ContentIssue[] = [];
	const levels = wealth.lifestyles.map((lifestyle) => lifestyle.level).sort((a, b) => a - b);
	if (levels.some((level, index) => level !== index)) {
		issues.push({
			source: 'wealth.json',
			path: 'lifestyles',
			message: 'rangs attendus : 0, 1, 2… sans doublon'
		});
	}
	wealth.lifestyles.forEach((lifestyle, index) => {
		if (knownIds.has(lifestyle.id)) {
			issues.push({
				source: 'wealth.json',
				path: `lifestyles[${index}].id`,
				message: `identifiant en double : ${lifestyle.id}`
			});
		}
		knownIds.add(lifestyle.id);
	});
	const fallback = wealth.lifestyles.find((lifestyle) => lifestyle.id === wealth.defaultLifestyle);
	if (!fallback) {
		issues.push({
			source: 'wealth.json',
			path: 'defaultLifestyle',
			message: `train de vie inconnu : ${wealth.defaultLifestyle}`
		});
	} else if (fallback.level !== 0 || fallback.costCents !== 0) {
		issues.push({
			source: 'wealth.json',
			path: 'defaultLifestyle',
			message: 'le train de vie par défaut doit être le plus sobre et gratuit'
		});
	}
	upgrades.forEach((upgrade, index) => {
		if (!upgrade.asset) return;
		const at = `upgrades[${index}]`;
		if (upgrade.family !== 'personal' || upgrade.treasury !== 'personalCashCents') {
			issues.push({
				source: 'upgrades.json',
				path: at,
				message: 'un actif est personnel et payé sur l’argent personnel'
			});
		}
		const price = upgrade.price.filter((cost) => cost.resource === 'personalCashCents');
		if (price.length !== 1 || upgrade.price.length !== 1) {
			issues.push({
				source: 'upgrades.json',
				path: `${at}.price`,
				message: 'un actif a un prix unique en argent personnel (sa valeur initiale)'
			});
		}
		if (upgrade.releaseEffects !== undefined) {
			issues.push({
				source: 'upgrades.json',
				path: `${at}.releaseEffects`,
				message: 'la revente d’un actif rapporte sa valeur : pas d’effets de départ'
			});
		}
	});
	return issues;
}

/** Infractions uniques, mandats connus dans les expositions de référence. */
function crossCheckJustice(
	justice: JusticeDefinition,
	refs: Refs,
	knownIds: Set<string>,
	events: readonly SourcedEvent[]
): ContentIssue[] {
	const issues: ContentIssue[] = [];
	const rules = justice.balance;
	for (const key of ['investigationTurns', 'trialDelayTurns', 'appealTurns'] as const) {
		if (rules[key].min < 1) {
			issues.push({
				source: 'justice.json',
				path: `balance.${key}.min`,
				message: 'une étape dure au moins un trimestre'
			});
		}
	}
	for (const [key, role] of [
		['revelationEvent', null],
		['entourageRevelationEvent', 'defendant']
	] as const) {
		const event = events.find((entry) => entry.event.id === rules[key])?.event;
		if (!event) {
			issues.push({
				source: 'justice.json',
				path: `balance.${key}`,
				message: `événement inconnu : ${rules[key]}`
			});
		} else if (!event.blocking || event.trigger !== 'followUp') {
			issues.push({
				source: 'justice.json',
				path: `balance.${key}`,
				message: 'la révélation doit être un événement bloquant de type « followUp »'
			});
		} else if (role !== null && !event.actors.some((slot) => slot.role === role)) {
			issues.push({
				source: 'justice.json',
				path: `balance.${key}`,
				message: `l’événement doit avoir un rôle « ${role} »`
			});
		}
	}
	justice.offenses.forEach((offense, index) => {
		if (knownIds.has(offense.id)) {
			issues.push({
				source: 'justice.json',
				path: `offenses[${index}].id`,
				message: `identifiant en double : ${offense.id}`
			});
		}
		knownIds.add(offense.id);
	});
	for (const mandateId of Object.keys(justice.balance.mandateExposure)) {
		if (!refs.mandates.has(mandateId)) {
			issues.push({
				source: 'justice.json',
				path: `balance.mandateExposure.${mandateId}`,
				message: `mandat inconnu : ${mandateId}`
			});
		}
	}
	return issues;
}
