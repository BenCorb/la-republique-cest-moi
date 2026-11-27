/**
 * Plan trimestriel : validation, prévision pure et exécution (ARCHITECTURE.md §5).
 *
 * Un plan est une liste ordonnée d'étapes : actions et achats d'améliorations.
 * Une seule validation sert à la prévision et à la commande `commitTurn`. Elle
 * simule le plan dans l'ordre sur un état de travail :
 *   - les coûts, prix et effets déterministes s'appliquent (un gain certain peut
 *     financer une étape suivante du même plan) ;
 *   - un effet aléatoire ne compte que pour sa borne la plus défavorable
 *     (min(0, min)) : un gain incertain ne finance ni ne débloque jamais une autre
 *     étape, et l'exécution réelle ne peut donc pas descendre sous zéro ;
 *   - une étape fautive est signalée puis ignorée pour la suite de la simulation,
 *     afin de présenter tous les problèmes en une fois.
 * La prévision ajoute l'économie du trimestre (charges et production des
 * améliorations déjà actives), calculée sur le pire cas du plan, ainsi que le
 * stress certain et une fourchette de santé. Elle ne lit ni ne fait avancer le
 * PRNG et n'expose aucune probabilité.
 */
import { attractiveness, attractivenessFactors } from './recruitment.ts';
import { fieldworkEffects, resolveActivists } from './activists.ts';
import {
	RESOURCE_IDS,
	type Condition,
	type Content,
	type Effect,
	type GaugeId,
	type HireOffer,
	type SearchLevel,
	type ResourceAmount,
	type ResourceId,
	type Resources
} from '../content/types.ts';
import type { PlanStep, TurnPlan } from './commands.ts';
import { evaluateCondition, type ConditionContext } from './conditions.ts';
import { resolveEconomy, type ProducerForecast } from './economy.ts';
import { applyGauge, effectRange, gaugeKey, resolveEffect, type EffectRange } from './effects.ts';
import { forecastWellbeing, type WellbeingForecast } from './health.ts';
import { comfortStress } from './wealth.ts';
import type { RngState } from './random.ts';
import type {
	GameState,
	GaugeChange,
	OwnedUpgrade,
	PlayerState,
	PoliticalChange,
	ResourceChange,
	StepRecord,
	WorldState
} from './state.ts';
import { applyPoliticalEffect, isPoliticalEffect } from './world.ts';
import { interviewIssue, mediaIssue, pressAudience } from './press.ts';
import { eraReached } from './eras.ts';
import { applyReformEffect, effectiveContent, isReformEffect, reformIssue } from './reforms.ts';
import { cappedCost, familySpentThisYear, formatAmount } from './scale.ts';
import {
	activeMandates,
	advanceIssue,
	applyCareerEffect,
	candidacyIssue,
	investitureIssue,
	isCareerEffect,
	mandateIncome,
	reservedTime,
	type CareerParts
} from './career.ts';
import { dependantsCostCents, shiftFamily } from './family.ts';
import {
	applyPromiseEffect,
	expandPromiseEffects,
	isPromiseEffect,
	pledgeIssue,
	promiseIssue
} from './promises.ts';
import {
	applyStaffEffect,
	dismissIssue,
	candidateInterviewIssue,
	searchIssue,
	vetIssue,
	hireIssue,
	isStaffEffect,
	resolveStaffProduction,
	staffTimeBonus,
	type EntourageParts,
	type HiringDecision
} from './staff.ts';

export type PlanIssueCode =
	| 'invalid_plan'
	| 'unknown_action'
	| 'unknown_upgrade'
	| 'invalid_target'
	| 'repeat_limit'
	| 'owned_limit'
	| 'condition_not_met'
	| 'time_exceeded'
	| 'insufficient_resource'
	/** Plafond annuel d'une famille d'actions à l'échelle atteint (P3-23). */
	| 'annual_cap';

export interface PlanIssue {
	/** Position de l'étape dans le plan, ou `null` pour un problème global. */
	readonly index: number | null;
	/** Identifiant de l'action ou de l'amélioration concernée. */
	readonly id: string | null;
	readonly code: PlanIssueCode;
	/** Message lisible en français, destiné à l'interface. */
	readonly message: string;
}

/** Avertissement non bloquant : le plan reste valide. */
export interface PlanWarning {
	readonly code: 'upkeep_at_risk' | 'stress_high' | 'lifestyle_unpaid' | 'salary_unpaid';
	/** Exemplaire concerné (`upkeep_at_risk`), sinon `null`. */
	readonly instanceId: string | null;
	readonly upgradeId: string | null;
	readonly message: string;
}

export interface ResourceRange {
	readonly min: number;
	readonly max: number;
}

export type ResourceRanges = { readonly [K in ResourceId]: ResourceRange };

export interface PlanStepPreview {
	readonly index: number;
	readonly kind: PlanStep['kind'] | null;
	readonly id: string | null;
	/** Cible de l'étape (parti), sinon `null`. */
	readonly target: string | null;
	readonly label: string | null;
	readonly timeCost: number;
	/** Coûts d'une action ou prix d'un achat, payés à l'étape. */
	readonly costs: readonly ResourceAmount[];
	/** Fourchettes certaines des effets d'une action (vide pour un achat). */
	readonly effects: readonly EffectRange[];
	/** Instance qui sera créée par un achat (actif à partir du trimestre suivant). */
	readonly instanceId: string | null;
	readonly issues: readonly PlanIssue[];
}

export interface PlanPreview {
	readonly valid: boolean;
	readonly timeAvailable: number;
	/** Temps réservé par les mandats en cours (déjà retiré du temps disponible). */
	readonly timeReserved: number;
	/** Temps des étapes valides du plan. */
	readonly timeUsed: number;
	readonly timeRemaining: number;
	readonly steps: readonly PlanStepPreview[];
	/** Tous les problèmes bloquants, globaux et par étape. */
	readonly issues: readonly PlanIssue[];
	/** Producteurs du trimestre selon le pire cas du plan (achats en attente inclus). */
	readonly producers: readonly ProducerForecast[];
	readonly warnings: readonly PlanWarning[];
	/** Santé et stress de fin de trimestre (stress certain, santé en fourchette). */
	readonly wellbeing: WellbeingForecast;
	/** Variation nette prévue par ressource : étapes valides puis économie. */
	readonly resourceChanges: ResourceRanges;
}

export const RESOURCE_LABELS: { readonly [K in ResourceId]: string } = {
	influence: 'Influence',
	politicalBudgetCents: 'Budget politique',
	personalCashCents: 'Argent personnel'
};

function zeroRanges(): Record<ResourceId, { min: number; max: number }> {
	return {
		influence: { min: 0, max: 0 },
		politicalBudgetCents: { min: 0, max: 0 },
		personalCashCents: { min: 0, max: 0 }
	};
}

function readStep(item: unknown): PlanStep | null {
	if (typeof item !== 'object' || item === null) return null;
	const { kind, id, target, pinned } = item as {
		kind?: unknown;
		id?: unknown;
		target?: unknown;
		pinned?: unknown;
	};
	if ((kind !== 'action' && kind !== 'purchase') || typeof id !== 'string' || id.length === 0) {
		return null;
	}
	if (pinned !== undefined && (pinned !== true || kind !== 'action')) return null;
	const flag = pinned === true ? { pinned: true as const } : {};
	if (target === undefined) return kind === 'action' ? { kind, id, ...flag } : { kind, id };
	if (kind !== 'action' || typeof target !== 'string' || target.length === 0) return null;
	return { kind, id, target, ...flag };
}

function targetOf(step: PlanStep): string | null {
	return step.kind === 'action' ? (step.target ?? null) : null;
}

/**
 * Effets réellement appliqués par une action : un départ (`releaseUpgrade`) est
 * remplacé par les effets propres de l'exemplaire ciblé, qui quitte la liste.
 */
function expandRelease(
	effects: readonly Effect[],
	target: string | null,
	upgrades: readonly OwnedUpgrade[],
	content: Content
): { effects: Effect[]; released: string | null } {
	if (!effects.some((effect) => effect.op === 'releaseUpgrade')) {
		return { effects: [...effects], released: null };
	}
	const owned = upgrades.find((upgrade) => upgrade.instanceId === target);
	const definition = owned ? content.upgrades[owned.upgradeId] : undefined;
	const own: Effect[] = [...(definition?.releaseEffects ?? [])];
	// Revente d'un actif : sa valeur, diminuée des frais (prévision exacte, sans tirage).
	const proceeds = assetProceeds(owned, content);
	if (proceeds > 0) own.push({ op: 'addResource', resource: 'personalCashCents', value: proceeds });
	return {
		effects: [...effects.filter((effect) => effect.op !== 'releaseUpgrade'), ...own],
		released: owned?.instanceId ?? null
	};
}

/** Produit de la revente d'un actif, en centimes (0 pour un autre exemplaire). */
export function assetProceeds(owned: OwnedUpgrade | undefined, content: Content): number {
	const asset = owned ? content.upgrades[owned.upgradeId]?.asset : undefined;
	if (!owned || !asset || owned.valueCents === null) return 0;
	return Math.floor((owned.valueCents * asset.salePercent) / 100 / 100) * 100;
}

/**
 * Problème de cible d'un départ : un exemplaire possédé avant ce trimestre, actif
 * patrimonial pour une revente (`asset`), élément de l'organisation sinon.
 */
function releaseIssue(
	target: string | null,
	upgrades: readonly OwnedUpgrade[],
	turn: number,
	kind: 'upgrade' | 'asset',
	content: Content
): string | null {
	const owned = upgrades.find((upgrade) => upgrade.instanceId === target);
	const isAsset = owned ? content.upgrades[owned.upgradeId]?.asset !== undefined : false;
	if (!owned || isAsset !== (kind === 'asset')) {
		return kind === 'asset'
			? 'choisissez un bien de votre patrimoine'
			: 'choisissez un élément de votre organisation';
	}
	if (owned.acquiredTurn >= turn) return 'cet élément n’est acquis qu’à la fin du trimestre';
	return null;
}

/** Niveau de recherche porté par une action (P3-21), ou `null`. */
function searchLevelOf(effects: readonly Effect[]): SearchLevel | null {
	for (const effect of effects) if (effect.op === 'orderSearch') return effect.level;
	return null;
}

/** Rôle d'une candidature déclarée (P3-29) : tête de liste ou candidat par défaut. */
export function candidacyRoleOf(effects: readonly Effect[]): 'head' | 'colistier' {
	for (const effect of effects) {
		if (effect.op === 'declareCandidacy') return effect.role ?? 'head';
	}
	return 'head';
}

/** Offre portée par une action d'embauche (P3-20), standard par défaut. */
function hireOfferOf(effects: readonly Effect[]): HireOffer | 'counter' {
	for (const effect of effects) if (effect.op === 'hireStaff') return effect.offer ?? 'standard';
	return 'standard';
}

/** Parties de l'état modifiées par les effets politiques et de carrière d'une action. */
interface StateParts {
	readonly player: PlayerState;
	readonly world: WorldState;
	readonly career: CareerParts;
	readonly entourage: EntourageParts;
}

/**
 * Applique les effets certains d'une action (adhésion, monde, mandats) sur un
 * état de travail. Utilisé à l'identique par la prévision et l'exécution.
 */
function applyStateEffects(
	effects: readonly Effect[],
	parts: StateParts,
	turn: number,
	target: string | null,
	content: Content,
	decision: HiringDecision | null = null,
	influence = 0
): StateParts & { changes: PoliticalChange[] } {
	let { player, world, career, entourage } = parts;
	const changes: PoliticalChange[] = [];
	for (const effect of effects) {
		if (isPoliticalEffect(effect)) {
			const outcome = applyPoliticalEffect(effect, player, world, turn, target, content);
			player = outcome.player;
			world = outcome.world;
			changes.push(...outcome.changes);
		} else if (isCareerEffect(effect)) {
			const outcome = applyCareerEffect(
				effect,
				career,
				turn,
				target,
				content,
				player,
				world,
				influence
			);
			career = outcome.parts;
			changes.push(...outcome.changes);
		} else if (isStaffEffect(effect)) {
			const outcome = applyStaffEffect(effect, entourage, turn, target, null, content, decision);
			entourage = outcome.parts;
			changes.push(...outcome.changes);
		} else if (isPromiseEffect(effect)) {
			const outcome = applyPromiseEffect(effect, career, turn, target, content);
			career = outcome.parts;
			changes.push(...outcome.changes);
		} else if (isReformEffect(effect)) {
			const outcome = applyReformEffect(effect, career, turn, target, content);
			career = outcome.parts;
			changes.push(...outcome.changes);
		} else if (effect.op === 'setLifestyle') {
			player = { ...player, lifestyle: effect.lifestyle };
		} else if (effect.op === 'familyAttitude') {
			// Seul effet familial permis dans une action : déterministe, sans tirage.
			const relationships = shiftFamily(
				{ player, characters: entourage.characters, relationships: entourage.relationships },
				effect.value,
				turn,
				content
			);
			entourage = { ...entourage, relationships };
		}
	}
	return { player, world, career, entourage, changes };
}

function entourageOf(state: GameState): EntourageParts {
	return {
		staff: state.staff,
		shortlists: state.shortlists,
		characters: state.characters,
		relationships: state.relationships,
		searches: state.searches
	};
}

function careerOf(state: GameState): CareerParts {
	return {
		mandates: state.mandates,
		ballots: state.ballots,
		campaigns: state.campaigns,
		institutions: state.institutions,
		promises: state.promises,
		investitures: state.investitures,
		appointment: state.appointment
	};
}

function definitionOf<T>(catalog: Readonly<Record<string, T>>, id: string): T | undefined {
	return Object.hasOwn(catalog, id) ? catalog[id] : undefined;
}

/** Exemplaire acheté : un actif vaut d'abord son prix d'achat. */
function newInstance(
	instanceId: string,
	upgradeId: string,
	turn: number,
	content: Content
): OwnedUpgrade {
	const definition = content.upgrades[upgradeId];
	const price = definition?.price.find((cost) => cost.resource === 'personalCashCents');
	return {
		instanceId,
		upgradeId,
		acquiredTurn: turn,
		valueCents: definition?.asset ? (price?.amount ?? 0) : null
	};
}

export function instanceIdFor(number: number): string {
	return `upgrade.${number}`;
}

/** Validation et prévision pures d'un plan, sans tirage aléatoire. */
export function previewPlan(state: GameState, plan: TurnPlan, catalog: Content): PlanPreview {
	// Règles en vigueur (P3-05) : la prévision valide exactement comme le trimestre.
	const content = effectiveContent(catalog, state.institutions.parameters);
	// Les mandats en cours réservent une part du temps du trimestre.
	const reserved = reservedTime(state.mandates, content);
	// Les collaborateurs qui tiennent l'agenda rendent du temps (à partir du trimestre suivant l'embauche).
	const delegated = staffTimeBonus(state.staff, state.characters, state.turn, content);
	const timeAvailable = Math.max(0, content.balance.timeBudgetPerTurn - reserved + delegated);
	const stepPreviews: PlanStepPreview[] = [];
	const issues: PlanIssue[] = [];
	const totals = zeroRanges();

	const items: unknown = (plan as { steps?: unknown } | null)?.steps;
	if (!Array.isArray(items)) {
		const economy = resolveEconomy(
			state.resources,
			state.upgrades,
			state.turn,
			content,
			state.player.lifestyle
		);
		return {
			valid: false,
			timeAvailable,
			timeReserved: reserved,
			timeUsed: 0,
			timeRemaining: timeAvailable,
			steps: [],
			issues: [
				{
					index: null,
					id: null,
					code: 'invalid_plan',
					message: 'Le plan du trimestre est mal formé.'
				}
			],
			producers: economy.producers,
			warnings: [],
			wellbeing: forecastWellbeing(
				state.player,
				reserved,
				state.turn,
				content.balance.wellbeing,
				comfortStress(economy, content)
			),
			resourceChanges: totals
		};
	}

	// État de travail : coûts et gains certains, pire cas des effets aléatoires.
	const working: Record<ResourceId, number> = { ...state.resources };
	let workingPlayer: PlayerState = state.player;
	let workingWorld: WorldState = state.world;
	let workingCareer: CareerParts = careerOf(state);
	let workingEntourage: EntourageParts = entourageOf(state);
	const upgrades: OwnedUpgrade[] = [...state.upgrades];
	let nextInstanceNumber = state.nextInstanceNumber;
	const actionCounts = new Map<string, number>();
	// Familles à l'échelle (P3-23) : un format par trimestre, plafond annuel partagé.
	const familyCounts = new Map<string, number>();
	const familySpent = new Map<string, number>();
	let timeUsed = 0;

	(items as readonly unknown[]).forEach((item, index) => {
		const step = readStep(item);
		const empty = {
			index,
			target: null,
			label: null,
			timeCost: 0,
			costs: [],
			effects: [],
			instanceId: null
		};
		if (step === null) {
			const issue: PlanIssue = {
				index,
				id: null,
				code: 'invalid_plan',
				message: `L’étape n° ${index + 1} du plan est mal formée.`
			};
			issues.push(issue);
			stepPreviews.push({ ...empty, kind: null, id: null, issues: [issue] });
			return;
		}

		const stepIssues: PlanIssue[] = [];
		const fail = (code: PlanIssueCode, message: string): void => {
			stepIssues.push({ index, id: step.id, code, message });
		};

		let label: string;
		let timeCost: number;
		let costs: readonly ResourceAmount[];
		let requires: Condition | undefined;
		let unavailableReason: string | undefined;
		let ranges: EffectRange[] = [];
		let actionEffects: readonly Effect[] = [];
		let released: string | null = null;
		const target = targetOf(step);
		const stepContext = (): ConditionContext => ({
			turn: state.turn,
			player: workingPlayer,
			resources: working,
			upgrades,
			world: workingWorld,
			mandates: workingCareer.mandates,
			campaigns: workingCareer.campaigns,
			staff: workingEntourage.staff,
			institutions: workingCareer.institutions,
			facts: state.facts,
			cases: state.cases,
			promises: workingCareer.promises
		});

		if (step.kind === 'action') {
			const definition = definitionOf(content.actions, step.id);
			if (!definition) {
				fail('unknown_action', `Action inconnue : ${step.id}.`);
				issues.push(...stepIssues);
				stepPreviews.push({ ...empty, kind: step.kind, id: step.id, issues: stepIssues });
				return;
			}
			({ label, timeCost, costs, requires, unavailableReason } = definition);
			if (!eraReached(definition.fromEra, state.turn, content)) {
				fail('condition_not_met', `« ${label} » n’existe pas encore à cette époque.`);
			}
			// Bonus de terrain selon le palier militant du début du trimestre (P3-19).
			actionEffects = [
				...definition.effects,
				...fieldworkEffects(definition, state.player.activists, content)
			];
			ranges = actionEffects.map(effectRange);
			if (definition.target === 'party') {
				if (target === null || !Object.hasOwn(content.parties, target)) {
					fail('invalid_target', `« ${label} » : choisissez un parti existant.`);
				}
			} else if (definition.target === 'campaign') {
				const issue =
					target === null ? 'choisissez une candidature' : advanceIssue(target, workingCareer);
				if (issue) fail('invalid_target', `« ${label} » : ${issue}.`);
			} else if (definition.target === 'ballot') {
				const issue =
					target === null
						? 'choisissez une élection'
						: definition.effects.some((effect) => effect.op === 'requestInvestiture')
							? investitureIssue(target, workingCareer, workingPlayer, state.turn, content)
							: candidacyIssue(
									target,
									workingCareer,
									workingPlayer,
									state.turn,
									content,
									candidacyRoleOf(definition.effects)
								);
				if (issue) fail('invalid_target', `« ${label} » : ${issue}`);
			} else if (definition.target === 'search') {
				const level = searchLevelOf(definition.effects);
				const issue =
					target === null || level === null
						? 'choisissez un poste'
						: searchIssue(target, level, workingEntourage, stepContext(), content);
				if (issue) fail('invalid_target', `« ${label} » : ${issue}.`);
			} else if (definition.target === 'candidate' || definition.target === 'staff') {
				const issue =
					target === null
						? 'choisissez une personne'
						: definition.effects.some((effect) => effect.op === 'courtCandidate')
							? candidateInterviewIssue(target, workingEntourage, content)
							: definition.effects.some((effect) => effect.op === 'vetCandidate')
								? vetIssue(target, workingEntourage)
								: definition.target === 'candidate'
									? hireIssue(
											target,
											workingEntourage,
											{
												turn: state.turn,
												player: workingPlayer,
												resources: working,
												upgrades,
												world: workingWorld,
												mandates: workingCareer.mandates,
												campaigns: workingCareer.campaigns,
												staff: workingEntourage.staff,
												institutions: workingCareer.institutions,
												facts: state.facts,
												cases: state.cases,
												promises: workingCareer.promises
											},
											content,
											hireOfferOf(definition.effects)
										)
									: dismissIssue(target, workingEntourage);
				if (issue) fail('invalid_target', `« ${label} » : ${issue}`);
			} else if (definition.target === 'promise') {
				const issue =
					target === null
						? 'choisissez une promesse'
						: promiseIssue(target, workingCareer, content);
				if (issue) {
					fail('invalid_target', `« ${label} » : ${issue}.`);
				} else {
					// L'engagement porte les effets d'annonce de sa promesse type.
					actionEffects = expandPromiseEffects(
						definition.effects,
						target,
						workingCareer.promises,
						content
					);
					ranges = actionEffects.map(effectRange);
				}
			} else if (definition.target === 'pledge') {
				const issue =
					target === null
						? 'choisissez une promesse en cours'
						: pledgeIssue(target, workingCareer.promises);
				if (issue) fail('invalid_target', `« ${label} » : ${issue}.`);
			} else if (definition.target === 'reform') {
				const issue =
					target === null
						? 'choisissez une réforme'
						: reformIssue(target, workingCareer.institutions, content);
				if (issue) fail('invalid_target', `« ${label} » : ${issue}.`);
			} else if (definition.target === 'media') {
				const issue =
					target === null
						? 'choisissez un média'
						: (mediaIssue(
								target,
								pressAudience(
									workingPlayer,
									workingCareer.mandates,
									workingCareer.campaigns,
									content
								),
								upgrades,
								content
							) ??
							(definition.effects.some((effect) => effect.op === 'giveInterview')
								? interviewIssue(workingWorld, target, state.turn, content)
								: null));
				if (issue) fail('invalid_target', `« ${label} » : ${issue}.`);
			} else if (definition.target === 'mandate') {
				const held = activeMandates(workingCareer.mandates).some(
					(mandate) => mandate.instanceId === target
				);
				if (!held) fail('invalid_target', `« ${label} » : choisissez un mandat en cours.`);
			} else if (definition.target === 'upgrade' || definition.target === 'asset') {
				const issue = releaseIssue(target, upgrades, state.turn, definition.target, content);
				if (issue) {
					fail('invalid_target', `« ${label} » : ${issue}.`);
				} else {
					const expanded = expandRelease(definition.effects, target, upgrades, content);
					actionEffects = expanded.effects;
					ranges = expanded.effects.map(effectRange);
					released = expanded.released;
				}
			} else if (target !== null) {
				fail('invalid_target', `« ${label} » ne porte sur aucune cible.`);
			}
			const occurrence = (actionCounts.get(step.id) ?? 0) + 1;
			actionCounts.set(step.id, occurrence);
			if (occurrence > definition.maxPerTurn) {
				fail(
					'repeat_limit',
					`« ${label} » ne peut être planifiée que ${definition.maxPerTurn} fois par trimestre.`
				);
			}
			const familyId = definition.scale?.family;
			const family = familyId ? content.actionFamilies[familyId] : undefined;
			if (familyId && family) {
				const count = (familyCounts.get(familyId) ?? 0) + 1;
				familyCounts.set(familyId, count);
				if (count > 1 && occurrence === 1) {
					fail('repeat_limit', `« ${family.label} » : un seul format par trimestre.`);
				}
				if (family.annualCap) {
					const spent =
						familySpent.get(familyId) ??
						familySpentThisYear(familyId, state.history, state.turn, content);
					const cost = cappedCost(definition, content);
					if (spent + cost > family.annualCap.amount) {
						fail(
							'annual_cap',
							`« ${family.label} » : plafond annuel de ${formatAmount(family.annualCap)} atteint (${formatAmount({ resource: family.annualCap.resource, amount: spent })} déjà engagés cette année).`
						);
					} else {
						familySpent.set(familyId, spent + cost);
					}
				}
			}
		} else {
			const definition = definitionOf(content.upgrades, step.id);
			if (!definition) {
				fail('unknown_upgrade', `Amélioration inconnue : ${step.id}.`);
				issues.push(...stepIssues);
				stepPreviews.push({ ...empty, kind: step.kind, id: step.id, issues: stepIssues });
				return;
			}
			({ label, timeCost, requires, unavailableReason } = definition);
			if (!eraReached(definition.fromEra, state.turn, content)) {
				fail('condition_not_met', `« ${label} » n’existe pas encore à cette époque.`);
			}
			costs = definition.price;
			const owned = upgrades.filter((upgrade) => upgrade.upgradeId === step.id).length;
			if (owned + 1 > definition.maxOwned) {
				fail('owned_limit', `« ${label} » : ${definition.maxOwned} exemplaire(s) au maximum.`);
			}
		}

		const context = {
			turn: state.turn,
			player: workingPlayer,
			resources: working,
			upgrades,
			world: workingWorld,
			mandates: workingCareer.mandates,
			campaigns: workingCareer.campaigns,
			institutions: workingCareer.institutions,
			staff: workingEntourage.staff,
			facts: state.facts,
			cases: state.cases,
			promises: workingCareer.promises
		};
		if (requires && !evaluateCondition(context, requires)) {
			fail('condition_not_met', unavailableReason ?? `« ${label} » n’est pas disponible.`);
		}

		if (timeUsed + timeCost > timeAvailable) {
			fail(
				'time_exceeded',
				`Temps insuffisant pour « ${label} » : ${timeCost} requis, ${timeAvailable - timeUsed} disponible(s).`
			);
		}

		const after: Record<ResourceId, number> = { ...working };
		for (const cost of costs) after[cost.resource] -= cost.amount;
		for (const range of ranges) {
			if (range.kind === 'resource') after[range.resource] += Math.min(0, range.min);
		}
		for (const resource of RESOURCE_IDS) {
			if (after[resource] < 0) {
				fail(
					'insufficient_resource',
					`${RESOURCE_LABELS[resource]} insuffisant pour « ${label} ».`
				);
			}
		}

		const valid = stepIssues.length === 0;
		const instanceId = step.kind === 'purchase' && valid ? instanceIdFor(nextInstanceNumber) : null;
		stepPreviews.push({
			index,
			kind: step.kind,
			id: step.id,
			target,
			label,
			timeCost,
			costs,
			effects: ranges,
			instanceId,
			issues: stepIssues
		});
		if (!valid) {
			issues.push(...stepIssues);
			return;
		}

		// Étape valide : elle consomme temps et coûts ; seuls ses gains certains
		// restent disponibles pour la suite du plan.
		timeUsed += timeCost;
		for (const cost of costs) {
			working[cost.resource] -= cost.amount;
			totals[cost.resource].min -= cost.amount;
			totals[cost.resource].max -= cost.amount;
		}
		for (const range of ranges) {
			if (range.kind === 'gauge') {
				// Les effets sur les jauges sont toujours certains.
				workingPlayer = applyGaugeEffect(workingPlayer, range.gauge, range.min).player;
				continue;
			}
			if (range.kind !== 'resource') continue;
			working[range.resource] += range.min === range.max ? range.min : Math.min(0, range.min);
			totals[range.resource].min += range.min;
			totals[range.resource].max += range.max;
		}
		// Effets certains (adhésion, monde, mandats), visibles des étapes suivantes.
		({
			player: workingPlayer,
			world: workingWorld,
			career: workingCareer,
			entourage: workingEntourage
		} = applyStateEffects(
			actionEffects,
			{
				player: workingPlayer,
				world: workingWorld,
				career: workingCareer,
				entourage: workingEntourage
			},
			state.turn,
			target,
			content,
			null,
			working.influence
		));
		if (instanceId !== null) {
			upgrades.push(newInstance(instanceId, step.id, state.turn, content));
			nextInstanceNumber += 1;
		}
		if (released !== null) {
			upgrades.splice(
				upgrades.findIndex((upgrade) => upgrade.instanceId === released),
				1
			);
		}
	});

	// Économie du trimestre sur le pire cas : une charge prévue impayée est un risque.
	const economy = resolveEconomy(working, upgrades, state.turn, content, workingPlayer.lifestyle);
	for (const change of economy.changes) {
		totals[change.resource].min += change.delta;
		totals[change.resource].max += change.delta;
	}
	const warnings: PlanWarning[] = economy.producers
		.filter((producer) => producer.status === 'suspended')
		.map((producer) => ({
			code: 'upkeep_at_risk',
			instanceId: producer.instanceId,
			upgradeId: producer.upgradeId,
			message: `Charges de « ${content.upgrades[producer.upgradeId]?.label ?? producer.upgradeId} » non couvertes : production suspendue ce trimestre si la trésorerie reste insuffisante.`
		}));
	if (economy.lifestyle.unpaid) {
		warnings.unshift({
			code: 'lifestyle_unpaid',
			instanceId: null,
			upgradeId: null,
			message: `« ${content.lifestyles[economy.lifestyle.lifestyleId]?.label ?? economy.lifestyle.lifestyleId} » n’est pas couvert par votre argent personnel : retour au train de vie le plus sobre, et du stress en plus.`
		});
	}

	// Revenus et stress des mandats encore en cours à la fin du trimestre.
	const mandates = mandateIncome(workingCareer.mandates, state.turn, content);
	for (const amount of mandates.income) {
		totals[amount.resource].min += amount.amount;
		totals[amount.resource].max += amount.amount;
	}
	const stressed = applyGaugeEffect(workingPlayer, 'player.stress', mandates.stress).player;

	// Charges et recettes certaines de la frontière, dans l'ordre et avec les
	// fonctions de la résolution (ARCHITECTURE.md §8.4) : salaires et missions des
	// collaborateurs, enfants à charge, cotisations et frais de la base militante.
	// Les montants aléatoires ou conditionnels (scrutins, événements, justice,
	// héritages, remboursements de recherche) restent hors de la prévision.
	const frontier: Record<ResourceId, number> = { ...economy.resources };
	for (const amount of mandates.income) frontier[amount.resource] += amount.amount;
	const staffed = resolveStaffProduction(
		{
			resources: frontier,
			player: stressed,
			world: workingWorld,
			career: workingCareer,
			entourage: workingEntourage
		},
		state.turn,
		content
	);
	const withFamily: Record<ResourceId, number> = { ...staffed.resources };
	withFamily.personalCashCents -= Math.min(
		withFamily.personalCashCents,
		dependantsCostCents(staffed.player, workingEntourage.characters, state.turn + 1, content)
	);
	const settledResources = resolveActivists(
		staffed.player,
		withFamily,
		{
			turn: state.turn,
			upgrades,
			mandates: staffed.career.mandates,
			campaigns: staffed.career.campaigns,
			deadlines: null
		},
		content
	).resources;
	for (const unpaid of staffed.record.production.filter((entry) => entry.status === 'unpaid')) {
		const name = workingEntourage.characters[unpaid.characterId]?.name ?? unpaid.characterId;
		warnings.push({
			code: 'salary_unpaid',
			instanceId: null,
			upgradeId: null,
			message: `Salaire de ${name} non couvert par le budget politique : sa mission sera suspendue ce trimestre et sa relation avec vous en pâtira.`
		});
	}
	for (const resource of RESOURCE_IDS) {
		const delta = settledResources[resource] - frontier[resource];
		totals[resource].min += delta;
		totals[resource].max += delta;
	}

	// Santé et stress à la frontière du trimestre (partie certaine uniquement).
	// Le temps réservé par les mandats compte dans la charge de travail.
	const wellbeing = forecastWellbeing(
		staffed.player,
		timeUsed + reserved,
		state.turn,
		content.balance.wellbeing,
		comfortStress(economy, content)
	);
	if (wellbeing.stress >= content.balance.wellbeing.highStressThreshold) {
		warnings.push({
			code: 'stress_high',
			instanceId: null,
			upgradeId: null,
			message: 'Stress élevé en fin de trimestre : votre santé va se dégrader.'
		});
	}

	return {
		valid: issues.length === 0,
		timeAvailable,
		timeReserved: reserved,
		timeUsed,
		timeRemaining: timeAvailable - timeUsed,
		steps: stepPreviews,
		issues,
		producers: economy.producers,
		warnings,
		wellbeing,
		resourceChanges: totals
	};
}

export interface PlanExecution {
	readonly resources: Resources;
	readonly player: PlayerState;
	readonly world: WorldState;
	readonly career: CareerParts;
	readonly entourage: EntourageParts;
	/** Temps consommé par le plan, qui détermine la charge de travail. */
	readonly timeUsed: number;
	readonly rng: RngState;
	readonly upgrades: readonly OwnedUpgrade[];
	readonly nextInstanceNumber: number;
	readonly records: readonly StepRecord[];
}

/**
 * Exécute un plan déjà validé par `previewPlan` : étapes dans l'ordre, coûts puis
 * effets (tirage des effets aléatoires), achats créant des instances en attente.
 * Lève une erreur si une ressource devenait négative, ce qui signalerait un
 * défaut de validation.
 */
export function executePlan(
	state: GameState,
	steps: readonly PlanStep[],
	content: Content
): PlanExecution {
	const current: Record<ResourceId, number> = { ...state.resources };
	let player = state.player;
	let world = state.world;
	let career = careerOf(state);
	let entourage = entourageOf(state);
	let timeUsed = 0;
	let rng = state.rng;
	const upgrades: OwnedUpgrade[] = [...state.upgrades];
	let nextInstanceNumber = state.nextInstanceNumber;
	const records: StepRecord[] = [];

	for (const step of steps) {
		const deltas = new Map<ResourceId, number>();
		const add = (resource: ResourceId, delta: number): void => {
			current[resource] += delta;
			deltas.set(resource, (deltas.get(resource) ?? 0) + delta);
		};
		let instanceId: string | null = null;
		const gauges: GaugeChange[] = [];
		const politics: PoliticalChange[] = [];
		const target = targetOf(step);

		if (step.kind === 'action') {
			const definition = definitionOf(content.actions, step.id);
			if (!definition) throw new Error(`Action non validée : ${step.id}`);
			timeUsed += definition.timeCost;
			for (const cost of definition.costs) add(cost.resource, -cost.amount);
			const expanded = expandRelease(
				expandPromiseEffects(
					[...definition.effects, ...fieldworkEffects(definition, state.player.activists, content)],
					target,
					career.promises,
					content
				),
				target,
				upgrades,
				content
			);
			if (expanded.released !== null) {
				upgrades.splice(
					upgrades.findIndex((upgrade) => upgrade.instanceId === expanded.released),
					1
				);
			}
			for (const effect of expanded.effects) {
				const resolved = resolveEffect(effect, rng);
				rng = resolved.rng;
				if (resolved.kind === 'resource') {
					add(resolved.resource, resolved.delta);
				} else if (resolved.kind === 'gauge') {
					const applied = applyGaugeEffect(player, resolved.gauge, resolved.delta);
					player = applied.player;
					if (applied.delta !== 0) gauges.push({ gauge: resolved.gauge, delta: applied.delta });
				} else if (resolved.kind === 'people') {
					throw new Error(`Effet sur un personnage hors événement : ${step.id}`);
				} else if (resolved.kind === 'release') {
					throw new Error(`Départ non développé : ${step.id}`);
				} else if (resolved.kind === 'fact') {
					throw new Error(`Fait hors événement : ${step.id}`);
				} else {
					// Le candidat décide à l'exécution, selon l'attractivité du moment (P3-20).
					const decision: HiringDecision | null =
						resolved.effect.op === 'hireStaff' || resolved.effect.op === 'vetCandidate'
							? {
									seed: state.rng.seed,
									attraction: attractiveness(
										attractivenessFactors(
											player,
											current,
											career.mandates,
											entourage.staff,
											content
										)
									)
								}
							: null;
					const applied = applyStateEffects(
						[resolved.effect],
						{ player, world, career, entourage },
						state.turn,
						target,
						content,
						decision,
						current.influence
					);
					({ player, world, career, entourage } = applied);
					politics.push(...applied.changes);
				}
			}
		} else {
			const definition = definitionOf(content.upgrades, step.id);
			if (!definition) throw new Error(`Amélioration non validée : ${step.id}`);
			timeUsed += definition.timeCost;
			for (const cost of definition.price) add(cost.resource, -cost.amount);
			instanceId = instanceIdFor(nextInstanceNumber);
			nextInstanceNumber += 1;
			upgrades.push(newInstance(instanceId, step.id, state.turn, content));
		}

		for (const resource of RESOURCE_IDS) {
			if (current[resource] < 0)
				throw new Error(`Ressource négative après ${step.id} : ${resource}`);
		}
		const changes: ResourceChange[] = RESOURCE_IDS.flatMap((resource) => {
			const delta = deltas.get(resource) ?? 0;
			return delta === 0 ? [] : [{ resource, delta }];
		});
		records.push({ kind: step.kind, id: step.id, instanceId, changes, gauges, target, politics });
	}

	return {
		resources: current,
		player,
		world,
		career,
		entourage,
		timeUsed,
		rng,
		upgrades,
		nextInstanceNumber,
		records
	};
}

/** Applique une variation de jauge au personnage, dans les bornes [0, 100]. */
function applyGaugeEffect(
	player: PlayerState,
	gauge: GaugeId,
	delta: number
): { player: PlayerState; delta: number } {
	const key = gaugeKey(gauge);
	const { value, applied } = applyGauge(player[key], delta);
	return { player: { ...player, [key]: value }, delta: applied };
}

/** Étape retirée automatiquement du plan, avec son motif (P3-11). */
export interface PlanRemoval {
	readonly step: PlanStep;
	/** Motif lisible : premier problème de l'étape au moment du retrait. */
	readonly reason: string;
}

/**
 * Nettoyage du plan (P3-11, PT-P3-09-007) : tant qu'une étape est invalide, la
 * première dans l'ordre d'exécution est retirée et le plan restant est
 * revalidé. Une étape antérieure invalide ne consomme ni temps ni ressources,
 * mais compte dans les limites de répétition : la boucle conserve donc les
 * occurrences valides et ne retire que l'excédent. Les problèmes globaux (plan
 * mal formé) ne sont pas corrigés. Sans effet hors de la planification.
 */
export function prunePlan(
	state: GameState,
	plan: TurnPlan,
	content: Content
): { plan: TurnPlan; removed: PlanRemoval[] } {
	// Un plan mal formé (venu de l'extérieur) n'est pas nettoyé : la prévision le signale.
	const items: unknown = (plan as { steps?: unknown }).steps;
	if (state.phase !== 'planning' || !Array.isArray(items)) return { plan, removed: [] };
	let steps: PlanStep[] = [...plan.steps];
	const removed: PlanRemoval[] = [];
	while (steps.length > 0) {
		const preview = previewPlan(state, { steps }, content);
		const first = preview.issues.find((issue) => issue.index !== null);
		if (!first || first.index === null) break;
		const index = first.index;
		const step = steps[index];
		if (step === undefined) break;
		removed.push({ step, reason: first.message });
		steps = steps.filter((_entry, position) => position !== index);
	}
	return { plan: removed.length === 0 ? plan : { steps }, removed };
}

/**
 * Plan reporté au trimestre suivant, même règle pour un tour manuel et pour
 * l'accélération (P2-09, P3-11) : seules les actions épinglées sont reconduites
 * (`expired` : étapes ponctuelles et achats exécutés) ; le plan reconduit est
 * ensuite nettoyé (`prunePlan`) : une étape épinglée devenue impossible
 * (condition, cible, limite, temps, ressources) est retirée avec son motif et
 * perd son épinglage. Sans effet hors de la planification (décision en
 * attente, fin) : le report a lieu une fois la décision prise.
 */
export function carryOverPlan(
	state: GameState,
	plan: TurnPlan,
	content: Content
): { plan: TurnPlan; expired: PlanStep[]; removed: PlanRemoval[] } {
	if (state.phase !== 'planning') return { plan, expired: [], removed: [] };
	const pinned = plan.steps.filter((step) => step.kind === 'action' && step.pinned === true);
	const expired = plan.steps.filter((step) => !(step.kind === 'action' && step.pinned === true));
	const pruned = prunePlan(state, { steps: pinned }, content);
	return { plan: pruned.plan, expired, removed: pruned.removed };
}
