/**
 * Institutions modifiables (P3-05, GDD §10.2, ARCHITECTURE.md §8.4).
 *
 * - Cinq paramètres du catalogue (`institutions.json`), chacun à un niveau en
 *   vigueur (`InstitutionsState.parameters`). Un niveau modifie des règles
 *   communes à tous les acteurs : plafond du cumul, révélation des faits,
 *   condamnations, poids du parti dans les scrutins, effet de la presse
 *   critique. Les règles effectives sont dérivées du contenu par
 *   `effectiveContent`, sans copier le catalogue dans l'état.
 * - Un parlementaire ou un ministre propose une réforme (niveau voisin du
 *   niveau en vigueur) ; le vote a lieu à la frontière du trimestre, avec une
 *   chance qui dépend du gouvernement, de l'appareil et de la stabilité.
 *   Adoptée, elle entre en vigueur au 1er janvier suivant (date fixe) et
 *   persiste après tout changement de gouvernement ; rejetée, elle coûte.
 * - Le gouvernement peut aussi réformer de lui-même, sans le joueur.
 * - À l'entrée en vigueur d'un plafond de cumul plus bas, les mandats en
 *   surnombre (les moins élevés) prennent fin.
 *
 * Valeurs provisoires de `institutions.json`.
 */
import {
	RESOURCE_IDS,
	type Content,
	type Effect,
	type InstitutionModifiers,
	type ResourceId,
	type Resources
} from '../content/types.ts';
import { quarterOf, turnOf, yearOf, type Turn } from './calendar.ts';
import {
	activeMandates,
	countsTowardCumul,
	cumulatedMandates,
	endMandates,
	type CareerParts
} from './career.ts';
import { applyGauge, gaugeKey } from './effects.ts';
import { nextInt, type RngState } from './random.ts';
import type {
	GaugeChange,
	InstitutionsRecord,
	InstitutionsState,
	PlayerState,
	PoliticalChange,
	ReformRecord,
	WorldState
} from './state.ts';
import { applyPoliticalEffect } from './world.ts';

export type ReformEffect = Extract<Effect, { op: 'proposeReform' }>;

export function isReformEffect(effect: Effect): effect is ReformEffect {
	return effect.op === 'proposeReform';
}

export function reformInstanceId(rank: number): string {
	return `reform.${rank}`;
}

/** Niveaux de départ du catalogue, par paramètre. */
export function startingParameters(content: Content): Record<string, string> {
	return Object.fromEntries(
		content.institutionParameterIds.map((id) => [id, content.institutionParameters[id]!.startLevel])
	);
}

/** Réforme en attente (proposée ce trimestre ou adoptée, pas encore en vigueur) d'un paramètre. */
export function pendingReform(
	institutions: InstitutionsState,
	parameterId: string
): ReformRecord | undefined {
	return institutions.reforms.find(
		(reform) =>
			reform.parameterId === parameterId &&
			(reform.status === 'proposed' || reform.status === 'scheduled')
	);
}

/** 1er janvier de l'année qui suit le trimestre `turn` : date d'entrée en vigueur. */
export function activationTurnAfter(turn: Turn): Turn {
	return turnOf(yearOf(turn) + 1, 1);
}

/** Raison pour laquelle ce niveau ne peut pas être proposé, ou `null`. */
export function reformIssue(
	target: string,
	institutions: InstitutionsState,
	content: Content
): string | null {
	const level = Object.hasOwn(content.institutionLevels, target)
		? content.institutionLevels[target]
		: undefined;
	if (!level) return 'choisissez une réforme du catalogue';
	const parameter = content.institutionParameters[level.parameterId]!;
	const current = institutions.parameters[level.parameterId];
	if (current === target) return 'ce régime est déjà en vigueur';
	if (pendingReform(institutions, level.parameterId)) {
		return `une réforme « ${parameter.label} » est déjà en cours`;
	}
	const currentIndex =
		current === undefined ? -1 : (content.institutionLevels[current]?.index ?? -1);
	if (Math.abs(currentIndex - level.index) !== 1) {
		return 'une réforme ne change le régime que d’un cran à la fois';
	}
	return null;
}

/** Chance d'adoption d'une proposition du joueur, en % (bornée). */
export function adoptionPercent(
	player: PlayerState,
	world: WorldState,
	career: CareerParts,
	content: Content
): number {
	const rules = content.reforms;
	const apparatus = player.supports[content.balance.campaigns.apparatusGroup] ?? 50;
	const minister = activeMandates(career.mandates).some(
		(mandate) => mandate.mandateId === rules.ministerMandate
	);
	const value =
		rules.baseAdoptionPercent +
		(player.partyId !== null && player.partyId === world.governingPartyId
			? rules.governingBonusPercent
			: 0) +
		(minister ? rules.ministerBonusPercent : 0) +
		// Matignon (P3-36) : la majorité suit plus volontiers le Premier ministre.
		(activeMandates(career.mandates).some(
			(mandate) => mandate.mandateId === 'mandate.prime_minister'
		)
			? rules.ministerBonusPercent * 2
			: 0) +
		Math.round(((apparatus - 50) * rules.apparatusWeightPercent) / 100) +
		Math.round(((world.indicators.stability - 50) * rules.stabilityWeightPercent) / 100);
	return Math.max(rules.adoptionPercent.min, Math.min(rules.adoptionPercent.max, value));
}

/**
 * Proposition du joueur : inscrite au registre, votée à la frontière. Une
 * proposition invalide (vérifiée par le plan) n'a aucun effet.
 */
export function applyReformEffect(
	_effect: ReformEffect,
	career: CareerParts,
	turn: Turn,
	target: string | null,
	content: Content
): { parts: CareerParts; changes: PoliticalChange[] } {
	if (target === null || reformIssue(target, career.institutions, content)) {
		return { parts: career, changes: [] };
	}
	const level = content.institutionLevels[target]!;
	const institutions = career.institutions;
	const reform: ReformRecord = {
		reformId: reformInstanceId(institutions.reforms.length + 1),
		parameterId: level.parameterId,
		levelId: target,
		fromLevelId: institutions.parameters[level.parameterId] ?? '',
		origin: 'player',
		proposedTurn: turn,
		status: 'proposed',
		adoptionPercent: null,
		activationTurn: null
	};
	return {
		parts: {
			...career,
			institutions: { ...institutions, reforms: [...institutions.reforms, reform] }
		},
		changes: [reformChange(reform, 'proposed')]
	};
}

function reformChange(
	reform: ReformRecord,
	change: 'proposed' | 'adopted' | 'rejected' | 'enacted'
): PoliticalChange {
	return {
		kind: 'reform',
		reformId: reform.reformId,
		parameterId: reform.parameterId,
		levelId: reform.levelId,
		origin: reform.origin,
		change
	};
}

/** Modificateurs cumulés des niveaux en vigueur (un paramètre n'en porte qu'un à la fois). */
export function activeModifiers(
	parameters: Readonly<Record<string, string>>,
	content: Content
): InstitutionModifiers {
	let modifiers: InstitutionModifiers = {};
	for (const parameterId of content.institutionParameterIds) {
		const levelId = parameters[parameterId];
		const level = content.institutionParameters[parameterId]?.levels.find(
			(entry) => entry.id === levelId
		);
		if (level) modifiers = { ...modifiers, ...level.modifiers };
	}
	return modifiers;
}

const effectiveCache = new WeakMap<Content, Map<string, Content>>();
/** Catalogue d'origine de chaque contenu effectif : les modificateurs ne se cumulent jamais. */
const baseContent = new WeakMap<Content, Content>();

function scale(value: number, percent: number | undefined): number {
	return percent === undefined ? value : Math.round((value * percent) / 100);
}

/**
 * Règles en vigueur : le contenu, modifié par les niveaux institutionnels
 * (justice, scrutins, presse). Identique au contenu quand aucun niveau ne
 * modifie rien ; mis en cache par combinaison de niveaux.
 */
export function effectiveContent(
	source: Content,
	parameters: Readonly<Record<string, string>>
): Content {
	const content = baseContent.get(source) ?? source;
	const key = content.institutionParameterIds.map((id) => parameters[id] ?? '').join('|');
	let byKey = effectiveCache.get(content);
	if (!byKey) {
		byKey = new Map();
		effectiveCache.set(content, byKey);
	}
	const cached = byKey.get(key);
	if (cached) return cached;
	const modifiers = activeModifiers(parameters, content);
	const clampPercent = (value: number): number => Math.max(0, Math.min(100, value));
	const justice = content.justice;
	const campaigns = content.balance.campaigns;
	const press = content.press;
	const result: Content = {
		...content,
		justice: {
			...justice,
			revealPercentPerSeverity: scale(justice.revealPercentPerSeverity, modifiers.revealPercent),
			convictionPercentBySeverity: justice.convictionPercentBySeverity.map((value) =>
				clampPercent(scale(value, modifiers.convictionPercent))
			),
			dismissalBasePercent: clampPercent(
				justice.dismissalBasePercent + (modifiers.dismissalBonus ?? 0)
			)
		},
		balance: {
			...content.balance,
			campaigns: {
				...campaigns,
				popularityWeightPercent:
					modifiers.popularityWeightPercent ?? campaigns.popularityWeightPercent,
				partyWeightPercent: modifiers.partyWeightPercent ?? campaigns.partyWeightPercent,
				incumbentBonus: modifiers.incumbentBonus ?? campaigns.incumbentBonus
			}
		},
		press: {
			...press,
			nationalExposure: modifiers.nationalExposure ?? press.nationalExposure,
			toneEffects: {
				...press.toneEffects,
				critical: scale(press.toneEffects.critical, modifiers.criticalPressPercent)
			}
		}
	};
	byKey.set(key, result);
	baseContent.set(result, content);
	return result;
}

export interface ReformsParts {
	readonly player: PlayerState;
	readonly resources: Resources;
	readonly world: WorldState;
	readonly career: CareerParts;
	readonly rng: RngState;
}

export interface ReformsResolution {
	readonly parts: ReformsParts;
	readonly record: InstitutionsRecord;
}

/**
 * Réformes à la fin du trimestre `turn`, dans un ordre fixe :
 *   1. vote des propositions du joueur : adoptée (entrée en vigueur au
 *      1er janvier suivant, effets du niveau pour le joueur) ou rejetée ;
 *   2. réforme éventuelle décidée par le gouvernement seul ;
 *   3. entrée en vigueur des réformes datées du trimestre suivant, et fin des
 *      mandats en surnombre si le plafond du cumul baisse.
 */
export function resolveReforms(
	parts: ReformsParts,
	turn: Turn,
	content: Content
): ReformsResolution {
	const rules = content.reforms;
	let { player, world, rng } = parts;
	const resources: Record<ResourceId, number> = { ...parts.resources };
	let career = parts.career;
	const reforms = [...career.institutions.reforms];
	const parameters: Record<string, string> = { ...career.institutions.parameters };
	let maxMandates = career.institutions.maxMandates;
	const politics: PoliticalChange[] = [];
	const resourceDeltas = new Map<ResourceId, number>();
	const gaugeDeltas = new Map<GaugeChange['gauge'], number>();
	const applyEffects = (effects: readonly Effect[]): void => {
		for (const effect of effects) {
			if (effect.op === 'addResource') {
				const next = Math.max(0, resources[effect.resource] + effect.value);
				const applied = next - resources[effect.resource];
				resources[effect.resource] = next;
				resourceDeltas.set(effect.resource, (resourceDeltas.get(effect.resource) ?? 0) + applied);
			} else if (effect.op === 'addStat') {
				const key = gaugeKey(effect.stat);
				const applied = applyGauge(player[key], effect.value);
				player = { ...player, [key]: applied.value };
				if (applied.applied !== 0) {
					gaugeDeltas.set(effect.stat, (gaugeDeltas.get(effect.stat) ?? 0) + applied.applied);
				}
			} else if (effect.op === 'addSupport') {
				const outcome = applyPoliticalEffect(effect, player, world, turn, null, content);
				player = outcome.player;
				world = outcome.world;
				politics.push(...outcome.changes);
			}
		}
	};
	const levelEffects = (levelId: string): readonly Effect[] => {
		const level = content.institutionLevels[levelId];
		return (
			content.institutionParameters[level?.parameterId ?? '']?.levels.find(
				(entry) => entry.id === levelId
			)?.effects ?? []
		);
	};

	// 1. Vote des propositions du joueur.
	reforms.forEach((reform, index) => {
		if (reform.status !== 'proposed') return;
		const chance = adoptionPercent(player, world, career, content);
		const draw = nextInt(rng, 1, 100);
		rng = draw.rng;
		if (draw.value <= chance) {
			reforms[index] = {
				...reform,
				status: 'scheduled',
				adoptionPercent: chance,
				activationTurn: activationTurnAfter(turn)
			};
			politics.push(reformChange(reform, 'adopted'));
			applyEffects(levelEffects(reform.levelId));
		} else {
			reforms[index] = { ...reform, status: 'rejected', adoptionPercent: chance };
			politics.push(reformChange(reform, 'rejected'));
			applyEffects(rules.rejectionEffects);
		}
	});

	// 2. Réforme décidée par le gouvernement seul.
	if (rules.autonomousPercent > 0) {
		const roll = nextInt(rng, 1, 100);
		rng = roll.rng;
		if (roll.value <= rules.autonomousPercent) {
			const free = content.institutionParameterIds.filter(
				(id) =>
					!reforms.some(
						(reform) =>
							reform.parameterId === id &&
							(reform.status === 'proposed' || reform.status === 'scheduled')
					)
			);
			if (free.length > 0) {
				const pick = nextInt(rng, 0, free.length - 1);
				rng = pick.rng;
				const parameterId = free[pick.value]!;
				const parameter = content.institutionParameters[parameterId]!;
				const currentIndex = content.institutionLevels[parameters[parameterId] ?? '']?.index ?? 0;
				const options = [currentIndex - 1, currentIndex + 1].filter(
					(index) => index >= 0 && index < parameter.levels.length
				);
				const direction = nextInt(rng, 0, options.length - 1);
				rng = direction.rng;
				const level = parameter.levels[options[direction.value]!]!;
				const reform: ReformRecord = {
					reformId: reformInstanceId(reforms.length + 1),
					parameterId,
					levelId: level.id,
					fromLevelId: parameters[parameterId] ?? '',
					origin: 'government',
					proposedTurn: turn,
					status: 'scheduled',
					adoptionPercent: null,
					activationTurn: activationTurnAfter(turn)
				};
				reforms.push(reform);
				politics.push(reformChange(reform, 'adopted'));
			}
		}
	}

	// 3. Entrée en vigueur au trimestre suivant (1er janvier).
	let mandates = career.mandates;
	reforms.forEach((reform, index) => {
		if (reform.status !== 'scheduled' || reform.activationTurn !== turn + 1) return;
		parameters[reform.parameterId] = reform.levelId;
		reforms[index] = { ...reform, status: 'enacted' };
		politics.push(reformChange(reform, 'enacted'));
		const level = content.institutionParameters[reform.parameterId]?.levels.find(
			(entry) => entry.id === reform.levelId
		);
		const cap = level?.modifiers.maxMandates;
		if (cap === undefined) return;
		maxMandates = cap;
		const probe: InstitutionsState = { ...career.institutions, maxMandates: cap };
		// Les mandats qui conditionnent un autre (siège du maire) partent en dernier ;
		// sinon, le moins élevé d'abord.
		const required = new Set(
			activeMandates(mandates).flatMap((mandate) => probe.prerequisites[mandate.mandateId] ?? [])
		);
		const held = cumulatedMandates(mandates, probe).sort(
			(left, right) =>
				Number(required.has(left.mandateId)) - Number(required.has(right.mandateId)) ||
				(content.mandates[left.mandateId]?.rank ?? 0) -
					(content.mandates[right.mandateId]?.rank ?? 0) ||
				left.startTurn - right.startTurn
		);
		const excess = new Set(
			held.slice(0, Math.max(0, held.length - cap)).map((mandate) => mandate.instanceId)
		);
		if (excess.size === 0) return;
		const ended = endMandates(
			mandates,
			(mandate) => excess.has(mandate.instanceId) && countsTowardCumul(mandate.mandateId, probe),
			'removed',
			turn
		);
		// Qui perd un prérequis perd aussi le mandat qui en dépend.
		const dependants = endMandates(
			ended.mandates,
			(mandate) =>
				(probe.prerequisites[mandate.mandateId] ?? []).some(
					(needed) =>
						!ended.mandates.some((other) => other.status === 'active' && other.mandateId === needed)
				),
			'removed',
			turn
		);
		mandates = dependants.mandates;
		politics.push(...ended.changes, ...dependants.changes);
	});

	career = {
		...career,
		mandates,
		institutions: { ...career.institutions, parameters, reforms, maxMandates }
	};
	return {
		parts: { player, resources, world, career, rng },
		record: {
			changes: RESOURCE_IDS.flatMap((resource) => {
				const delta = resourceDeltas.get(resource) ?? 0;
				return delta === 0 ? [] : [{ resource, delta }];
			}),
			gauges: [...gaugeDeltas].map(([gauge, delta]) => ({ gauge, delta })),
			politics
		}
	};
}

/** Libellé d'une date d'entrée en vigueur (« 1er janvier 2005 »). */
export function activationLabel(turn: Turn): string {
	return quarterOf(turn) === 1
		? `1er janvier ${yearOf(turn)}`
		: `T${quarterOf(turn)} ${yearOf(turn)}`;
}
