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
	upgradeCatalogSchema,
	worldSchema
} from './schemas.ts';
import {
	PARTY_REFERENCES,
	PROMISE_VARIABLE,
	TREASURY_IDS,
	WORLD_TEMPLATE_VARIABLES,
	type ActionDefinition,
	type Balance,
	type CastMember,
	type Condition,
	type Content,
	type Effect,
	type ElectionDefinition,
	type EventDefinition,
	type InstitutionsDefinition,
	type MandateDefinition,
	type MissionDefinition,
	type OriginDefinition,
	type ProfessionDefinition,
	type PostDefinition,
	type SupportGroupDefinition,
	type PartyDefinition,
	type JusticeDefinition,
	type OffenseDefinition,
	type LifestyleDefinition,
	type WealthDefinition,
	type PromiseDefinition,
	type PromisesDefinition,
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
	/** Origines, professions et profil par défaut (`profiles.json`). */
	readonly profiles: unknown;
	/** Infractions du registre des faits et jauges de la justice (`justice.json`). */
	readonly justice: unknown;
	/** Trains de vie (`wealth.json`). */
	readonly wealth: unknown;
	/** Promesses types et règles du registre (`promises.json`). */
	readonly promises: unknown;
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
	readonly elections: ReadonlySet<string>;
	readonly groups: ReadonlySet<string>;
	readonly origins: ReadonlySet<string>;
	readonly professions: ReadonlySet<string>;
	readonly offenses: ReadonlySet<string>;
	readonly lifestyles: ReadonlySet<string>;
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
		case 'profession':
			return refs.professions.has(condition.profession)
				? []
				: [
						{
							source,
							path: `${path}.profession`,
							message: `profession inconnue : ${condition.profession}`
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
	promiseSubject = false
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
			case 'hireStaff':
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
			case 'declareCandidacy':
				if (targetKind !== 'ballot') {
					issues.push({
						source,
						path: at,
						message: 'candidature réservée aux actions ciblant une échéance'
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
				effect.op === 'hireStaff' ||
				effect.op === 'dismissStaff' ||
				effect.op === 'releaseUpgrade' ||
				effect.op === 'makePromise' ||
				(effect.op === 'advancePromise' && targetKind === 'pledge')
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
						subject
					)
				);
			});
		} else {
			issues.push(
				...effectIssues(event.effects, refs, null, source, `${path}.effects`, roles, subject)
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

/** Effets permis à la création d'un personnage (origine et profession). */
const PROFILE_EFFECTS = new Set(['addResource', 'addSupport', 'addStat']);

function crossCheckProfiles(
	origins: readonly OriginDefinition[],
	professions: readonly ProfessionDefinition[],
	defaults: { readonly origin: string; readonly profession: string },
	refs: Refs,
	knownIds: Set<string>
): ContentIssue[] {
	const issues: ContentIssue[] = [];
	const source = 'profiles.json';
	const check = (
		list: readonly (OriginDefinition | ProfessionDefinition)[],
		field: 'origins' | 'professions'
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
	check(professions, 'professions');
	if (!refs.origins.has(defaults.origin)) {
		issues.push({
			source,
			path: 'defaults.origin',
			message: `origine inconnue : ${defaults.origin}`
		});
	}
	if (!refs.professions.has(defaults.profession)) {
		issues.push({
			source,
			path: 'defaults.profession',
			message: `profession inconnue : ${defaults.profession}`
		});
	}
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
		const grants = [election.grants, ...(election.bonusGrant ? [election.bonusGrant.mandate] : [])];
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
	const knownIds = new Set([...actionList.map((a) => a.id), ...upgradeList.map((u) => u.id)]);
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
				promisesCatalog.data.balance.recallEvents.kept,
				promisesCatalog.data.balance.recallEvents.abandoned
			])
		)
	);
	issues.push(...crossCheckWorld(world.data, balance.data, knownIds));
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
		professions: new Set(profileData.professions.map((profession) => profession.id)),
		groups: new Set(groupList.map((group) => group.id)),
		parties: new Set(world.data.parties.map((party) => party.id)),
		mandates: new Set(career.mandates.map((mandate) => mandate.id)),
		elections: new Set(career.elections.map((election) => election.id)),
		offenses: new Set(justiceCatalog.data.offenses.map((offense) => offense.id)),
		lifestyles: new Set(wealthCatalog.data.lifestyles.map((lifestyle) => lifestyle.id))
	};
	issues.push(...crossCheckWealth(wealthCatalog.data, upgradeList, knownIds));
	issues.push(...crossCheckJustice(justiceCatalog.data, refs, knownIds, sourcedEvents));
	issues.push(...crossCheckPolitics(actionList, upgradeList, sourcedEvents, refs));
	issues.push(...crossCheckPromises(promisesCatalog.data, refs, knownIds, sourcedEvents));
	issues.push(
		...crossCheckProfiles(
			profileData.origins,
			profileData.professions,
			profileData.defaults,
			refs,
			knownIds
		)
	);
	const postList = entourageCatalog.data.posts;
	issues.push(...crossCheckEntourage(postList, refs, knownIds));
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
	const professions: Record<string, ProfessionDefinition> = {};
	for (const profession of profileData.professions) professions[profession.id] = profession;
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
				events: Object.fromEntries(eventFiles.map(({ source, parsed }) => [source, parsed.data]))
			}),
			balance: balance.data,
			actions,
			actionIds: actionList.map((action) => action.id),
			actionCategories,
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
			institutions: career.institutions,
			origins,
			originIds: profileData.origins.map((origin) => origin.id),
			professions,
			professionIds: profileData.professions.map((profession) => profession.id),
			defaultProfile: profileData.defaults,
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
			promiseRules: promisesCatalog.data.balance
		}
	};
}

/** Effets permis dans une promesse : certains, sur les ressources, jauges et soutiens. */
const PROMISE_EFFECT_OPS: ReadonlySet<string> = new Set(['addResource', 'addStat', 'addSupport']);

/**
 * Promesses types (P3-04) : identifiants uniques, élections connues, effets
 * certains (ressources, jauges, soutiens), dilemmes et rappels existants,
 * bloquants pour les dilemmes, de sujet `promise` et programmés par le moteur ;
 * dilemme présenté avant l'échéance de réalisation.
 */
function crossCheckPromises(
	catalog: PromisesDefinition,
	refs: Refs,
	knownIds: Set<string>,
	events: readonly SourcedEvent[]
): ContentIssue[] {
	const source = 'promises.json';
	const issues: ContentIssue[] = [];
	const rules = catalog.balance;
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
		promise.elections.forEach((electionId, electionIndex) => {
			if (!refs.elections.has(electionId)) {
				issues.push({
					source,
					path: `${path}.elections[${electionIndex}]`,
					message: `élection inconnue : ${electionId}`
				});
			}
		});
		if (new Set(promise.elections).size !== promise.elections.length) {
			issues.push({ source, path: `${path}.elections`, message: 'élection en double' });
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
	checkEvent(rules.recallEvents.kept, 'balance.recallEvents.kept', false);
	checkEvent(rules.recallEvents.abandoned, 'balance.recallEvents.abandoned', false);
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
