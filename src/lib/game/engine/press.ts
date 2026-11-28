/**
 * Médias et fil de presse (P3-03, GDD §9.1, ARCHITECTURE.md §8.4).
 *
 * - Médias fictifs du catalogue : quatre nationaux et un quotidien par région
 *   (P3-18), chacun avec sa ligne, son audience, ses
 *   lecteurs (groupes de soutien) et ses sujets de prédilection. Leur relation
 *   envers le joueur (`WorldState.media`) évolue par les interviews, déjeuners
 *   et choix d'événements, puis revient lentement vers celle du catalogue.
 * - À la frontière (étape 5 quinquies), la presse couvre ce qui s'est passé au
 *   trimestre : étapes des dossiers judiciaires du joueur (jamais un fait non
 *   révélé), issues des promesses, scrutins, train de vie fastueux, interviews
 *   accordées et rachat d'un média. Un article par sujet au plus, dans cet ordre
 *   de priorité et dans la limite du trimestre, plus une nouvelle d'ambiance.
 * - Tonalité : celle du sujet (une révélation est critique, une promesse tenue
 *   favorable…), adoucie ou durcie d'un cran selon la relation du média ; un
 *   média possédé relativise toujours, un hebdomadaire satirique n'est jamais
 *   favorable. Effet sur les groupes lecteurs, proportionnel à l'audience et
 *   amplifié par l'exposition ; un article critique accroît l'exposition.
 * - Un média possédé (actif `asset.media`) n'empêche pas les autres d'écrire,
 *   et ses articles pèsent moins (crédibilité réduite).
 * - Anti-répétition (P3-15, `WorldState.press`) : un titre n'est repris
 *   qu'une fois épuisés tous les titres possibles de son pool (sujet,
 *   tonalité, précision, famille du média ; pioche sans remise, jamais deux
 *   fois de suite le même au recyclage) ; au-delà de
 *   `angleRepeatLimit` articles successifs sous le même angle, un sujet
 *   secondaire n'est pas couvert ce trimestre, puis revient (la justice, les
 *   interviews et les rachats sont toujours couverts).
 *
 * Valeurs provisoires de `media.json`.
 */
import {
	ARTICLE_TONES,
	MEDIA_RELATION_MAX,
	MEDIA_RELATION_MIN,
	type ArticleTone,
	type ArticleTopic,
	type Content,
	type HeadlineDefinition,
	type MediaDefinition
} from '../content/types.ts';
import { yearOf, type Turn } from './calendar.ts';
import { applyGauge } from './effects.ts';
import { hashSeed, nextInt, type RngState } from './random.ts';
import type {
	Article,
	Campaign,
	MandateInstance,
	Ballot,
	JusticeRecord,
	LegalCase,
	MediaState,
	OwnedUpgrade,
	PressMemory,
	PlayerState,
	PressRecord,
	PromisesRecord,
	WorldState
} from './state.ts';
import { applyPoliticalEffect } from './world.ts';
import { resolveMediaRef } from './territory.ts';

/** Médias possédés par le joueur, par identifiant (actifs `asset.media`). */
export function ownedMedia(
	upgrades: readonly OwnedUpgrade[],
	regionId: string,
	content: Content
): Set<string> {
	const owned = new Set<string>();
	for (const upgrade of upgrades) {
		const ref = content.upgrades[upgrade.upgradeId]?.asset?.media;
		if (ref !== undefined) owned.add(resolveMediaRef(ref, regionId, content));
	}
	return owned;
}

/**
 * Ce qui rend le joueur intéressant pour la presse (P3-18) : son exposition,
 * sa région d'origine et une portée nationale (mandat de rang national ou
 * candidature en cours à un scrutin national).
 */
export interface PressAudience {
	readonly exposure: number;
	readonly regionId: string;
	readonly national: boolean;
}

export function pressAudience(
	player: PlayerState,
	mandates: readonly MandateInstance[],
	campaigns: readonly Campaign[],
	content: Content
): PressAudience {
	const rank = content.press.nationalMandateRank;
	const national =
		mandates.some(
			(mandate) =>
				mandate.status === 'active' && (content.mandates[mandate.mandateId]?.rank ?? 0) >= rank
		) ||
		campaigns.some(
			(campaign) =>
				campaign.status === 'running' &&
				content.elections[campaign.electionId]?.scope === 'national'
		);
	return { exposure: player.exposure, regionId: player.territory.regionId, national };
}

/**
 * Le média suit-il le joueur ? Le quotidien de sa région, toujours ; ceux des
 * autres régions, jamais ; un média national, à partir d'une portée nationale
 * ou du seuil d'exposition.
 */
export function followsPlayer(
	media: MediaDefinition,
	audience: PressAudience,
	content: Content
): boolean {
	if (media.scope === 'regional') return media.region === audience.regionId;
	return audience.national || audience.exposure >= content.press.nationalExposure;
}

/** Raison pour laquelle ce média ne peut pas être ciblé, ou `null`. */
export function mediaIssue(
	target: string,
	audience: PressAudience,
	upgrades: readonly OwnedUpgrade[],
	content: Content
): string | null {
	const media = Object.hasOwn(content.media, target) ? content.media[target] : undefined;
	if (!media) return 'choisissez un média du catalogue';
	if (ownedMedia(upgrades, audience.regionId, content).has(target))
		return 'ce média vous appartient déjà';
	if (media.scope === 'regional' && media.region !== audience.regionId) {
		return `${media.name} ne couvre pas votre région`;
	}
	if (!followsPlayer(media, audience, content)) {
		return `${media.name} ne s’intéresse pas encore à vous (exposition ou envergure nationale insuffisantes)`;
	}
	return null;
}

/** Raison pour laquelle ce média refuse une nouvelle interview, ou `null`. */
export function interviewIssue(
	world: WorldState,
	mediaId: string,
	turn: Turn,
	content: Content
): string | null {
	const last = world.media[mediaId]?.interviewTurn ?? null;
	const cooldown = content.press.interviewCooldownTurns;
	if (last !== null && turn - last < cooldown) {
		return `${content.media[mediaId]?.name ?? mediaId} vous a déjà interviewé récemment (une fois tous les ${cooldown} trimestres au plus)`;
	}
	return null;
}

/** Cran de tonalité, de critique (0) à favorable (2). */
function shiftTone(tone: ArticleTone, shift: number): ArticleTone {
	const index = Math.min(2, Math.max(0, ARTICLE_TONES.indexOf(tone) + shift));
	return ARTICLE_TONES[index]!;
}

/**
 * Tonalité publiée : celle du sujet, décalée d'un cran par la relation (ou
 * toujours adoucie par un média possédé) ; jamais favorable dans la satire.
 */
export function articleTone(
	base: ArticleTone,
	media: MediaDefinition,
	relation: number,
	owned: boolean,
	content: Content,
	/** Ligne éditoriale de l'article (P3-24) : −1, 0 ou +1. */
	editorial = 0
): ArticleTone {
	const threshold = content.press.toneThreshold;
	// Un cran par seuil de relation, deux pour une relation très marquée ; un média
	// possédé adoucit toujours d'un cran (P3-24 : tous les titres deviennent possibles).
	const strong = relation >= 2 * threshold ? 1 : relation <= -2 * threshold ? -1 : 0;
	const shift = owned
		? 1 + Math.max(0, strong)
		: (relation >= threshold ? 1 : relation <= -threshold ? -1 : 0) + strong;
	const tone = shiftTone(base, shift + editorial);
	return media.kind === 'satirical' && tone === 'favorable' ? 'neutral' : tone;
}

/** Ligne éditoriale d'un article (P3-24), par empreinte : −1, 0 ou +1, sans tirage. */
export function editorialSwing(
	mediaId: string,
	topic: string,
	subjectId: string | null,
	turn: number,
	content: Content
): number {
	const percent = content.press.editorialSwingPercent;
	if (percent <= 0) return 0;
	const roll = hashSeed(`${mediaId}:${topic}:${subjectId ?? ''}:${turn}`) % 100;
	return roll < percent ? -1 : roll >= 100 - percent ? 1 : 0;
}

/** Effet d'un article sur chaque groupe lecteur (entier borné, 0 pour la neutralité). */
export function articleEffect(
	tone: ArticleTone,
	media: MediaDefinition,
	exposure: number,
	owned: boolean,
	content: Content
): number {
	const { toneEffects, maxEffect, ownedEffectPercent } = content.press;
	const numerator =
		toneEffects[tone] *
		media.audience *
		(100 + exposure) *
		media.amplifyPercent *
		(owned ? ownedEffectPercent : 100);
	const value = Math.round(numerator / (50 * 100 * 100 * 100));
	return Math.max(-maxEffect, Math.min(maxEffect, value));
}

/** Sujet couvert : thème, référence, précision et tonalité de départ. */
interface Subject {
	readonly topic: Exclude<ArticleTopic, 'ambient'>;
	readonly subjectId: string | null;
	readonly detail: string | null;
	readonly tone: ArticleTone;
	/** Média imposé (interview), sinon tiré parmi ceux qui suivent le joueur. */
	readonly mediaId: string | null;
}

const CASE_TONES: Readonly<Record<string, ArticleTone>> = {
	revealed: 'critical',
	indicted: 'critical',
	appealed: 'critical',
	convicted: 'critical',
	acquitted: 'favorable',
	dismissed: 'favorable'
};

const PROMISE_TONES: Readonly<Record<string, ArticleTone>> = {
	kept: 'favorable',
	partial: 'neutral',
	abandoned: 'critical'
};

export interface PressInputs {
	readonly turn: Turn;
	readonly upgrades: readonly OwnedUpgrade[];
	readonly mandates: readonly MandateInstance[];
	readonly campaigns: readonly Campaign[];
	readonly ballots: readonly Ballot[];
	readonly cases: readonly LegalCase[];
	readonly justice: JusticeRecord | null;
	readonly promises: PromisesRecord | null;
}

/** Sujets du trimestre, par ordre de priorité. */
function subjectsOf(
	inputs: PressInputs,
	player: PlayerState,
	world: WorldState,
	rng: RngState,
	content: Content
): { subjects: Subject[]; rng: RngState } {
	const subjects: Subject[] = [];
	for (const entry of inputs.justice?.cases ?? []) {
		const legalCase = inputs.cases.find((item) => item.caseId === entry.caseId);
		if (!legalCase || legalCase.defendantId !== null) continue;
		const tone = CASE_TONES[entry.kind];
		if (tone) {
			subjects.push({
				topic: 'justice',
				subjectId: entry.caseId,
				detail: entry.kind,
				tone,
				mediaId: null
			});
		}
	}
	for (const change of inputs.promises?.politics ?? []) {
		if (change.kind !== 'promise') continue;
		const tone = PROMISE_TONES[change.change];
		if (tone) {
			subjects.push({
				topic: 'promise',
				subjectId: change.pledgeId,
				detail: change.change,
				tone,
				mediaId: null
			});
		}
	}
	for (const campaign of inputs.campaigns) {
		if (campaign.status !== 'won' && campaign.status !== 'lost') continue;
		// Résultat connu ce trimestre : au scrutin, ou après la décision du second tour (P3-29).
		if (campaign.resultTurn !== inputs.turn) continue;
		subjects.push({
			topic: 'election',
			subjectId: campaign.campaignId,
			detail: campaign.status,
			// Tonalité selon le score (P3-24) : large victoire, victoire étroite, défaite honorable ou lourde.
			tone:
				campaign.status === 'won'
					? (campaign.playerPercent ?? 0) >= 55
						? 'favorable'
						: 'neutral'
					: (campaign.playerPercent ?? 0) >= 40
						? 'neutral'
						: 'critical',
			mediaId: null
		});
	}
	for (const upgrade of inputs.upgrades) {
		const ref = content.upgrades[upgrade.upgradeId]?.asset?.media;
		if (ref === undefined || upgrade.acquiredTurn !== inputs.turn) continue;
		const mediaId = resolveMediaRef(ref, player.territory.regionId, content);
		subjects.push({
			topic: 'ownership',
			subjectId: mediaId,
			detail: null,
			tone: 'critical',
			mediaId: null
		});
	}
	for (const mediaId of content.mediaIds) {
		if (world.media[mediaId]?.interviewTurn !== inputs.turn) continue;
		subjects.push({
			topic: 'interview',
			subjectId: mediaId,
			detail: null,
			tone: 'neutral',
			mediaId
		});
	}
	let current = rng;
	const lifestyle = content.lifestyles[player.lifestyle];
	if (lifestyle && lifestyle.level >= content.press.lifestyleLevel) {
		const draw = chance(content.press.lifestylePercent, current);
		current = draw.rng;
		if (draw.hit) {
			subjects.push({
				topic: 'lifestyle',
				subjectId: null,
				detail: null,
				// Train de vie aisé : on en parle ; fastueux : on le reproche (P3-24).
				tone: lifestyle.level > content.press.lifestyleLevel ? 'critical' : 'neutral',
				mediaId: null
			});
		}
	}
	return { subjects, rng: current };
}

/** Chance en % ; aucun tirage à 0 ou 100 % (PRNG inchangé). */
function chance(percent: number, rng: RngState): { hit: boolean; rng: RngState } {
	if (percent <= 0) return { hit: false, rng };
	if (percent >= 100) return { hit: true, rng };
	const draw = nextInt(rng, 1, 100);
	return { hit: draw.value <= percent, rng: draw.rng };
}

/** Choix uniforme ; aucun tirage s'il n'y a qu'une possibilité. */
function pickOne<T>(items: readonly T[], rng: RngState): { item: T | null; rng: RngState } {
	if (items.length <= 1) return { item: items[0] ?? null, rng };
	const draw = nextInt(rng, 0, items.length - 1);
	return { item: items[draw.value] ?? null, rng: draw.rng };
}

/** Tirage pondéré ; `null` si aucun poids n'est positif, aucun tirage pour un seul candidat. */
function weighted<T>(
	items: readonly T[],
	weight: (item: T) => number,
	rng: RngState
): { item: T | null; rng: RngState } {
	const eligible = items.filter((item) => weight(item) > 0);
	if (eligible.length <= 1) return { item: eligible[0] ?? null, rng };
	const total = eligible.reduce((sum, item) => sum + weight(item), 0);
	const draw = nextInt(rng, 1, total);
	let cumulative = 0;
	for (const item of eligible) {
		cumulative += weight(item);
		if (draw.value <= cumulative) return { item, rng: draw.rng };
	}
	return { item: null, rng: draw.rng };
}

/** Titres possibles pour ce média, ce sujet, cette tonalité et cette date. */
export function headlineCandidates(
	topic: ArticleTopic,
	tone: ArticleTone,
	detail: string | null,
	media: MediaDefinition,
	turn: Turn,
	content: Content
): HeadlineDefinition[] {
	const year = yearOf(turn);
	return content.headlines.filter(
		(headline) =>
			headline.topic === topic &&
			headline.tone === tone &&
			(headline.kinds === undefined || headline.kinds.includes(media.kind)) &&
			(headline.details === undefined || (detail !== null && headline.details.includes(detail))) &&
			(headline.fromYear === undefined || headline.fromYear <= year)
	);
}

/**
 * Clé d'un pool de titres (P3-15) : sujet, tonalité, précision et famille du
 * média. La date n'y entre pas : un titre daté rejoint son pool en cours de route.
 */
export function headlinePoolKey(
	topic: ArticleTopic,
	tone: ArticleTone,
	detail: string | null,
	kind: MediaDefinition['kind']
): string {
	return `${topic}:${tone}:${detail ?? ''}:${kind}`;
}

/**
 * Pioche sans remise (P3-15), par pool : un titre encore jamais paru dans ce
 * pool depuis son dernier recyclage ; pool épuisé, ses titres redeviennent
 * disponibles, sauf le dernier paru s'il en reste d'autres. Aucun tirage pour
 * un seul candidat.
 */
export function drawHeadline(
	pool: readonly HeadlineDefinition[],
	key: string,
	memory: PressMemory,
	rng: RngState
): { headline: HeadlineDefinition | null; memory: PressMemory; rng: RngState } {
	if (pool.length === 0) return { headline: null, memory, rng };
	const previous = memory.usedHeadlines[key] ?? [];
	const used = new Set(previous);
	let fresh = pool.filter((headline) => !used.has(headline.id));
	let kept = previous;
	if (fresh.length === 0) {
		const last = previous.at(-1);
		kept = [];
		fresh = pool.length > 1 ? pool.filter((headline) => headline.id !== last) : [...pool];
	}
	const choice = pickOne(fresh, rng);
	const headline = choice.item;
	if (!headline) return { headline: null, memory, rng: choice.rng };
	return {
		headline,
		memory: {
			...memory,
			usedHeadlines: { ...memory.usedHeadlines, [key]: [...kept, headline.id] }
		},
		rng: choice.rng
	};
}

/**
 * Taille minimale visée pour un pool de titres (P3-15, décision déléguée :
 * trois titres par combinaison sujet × tonalité × famille de média accessible).
 */
export const MIN_HEADLINE_POOL = 3;

/** Combinaison de presse dont le pool de titres est trop petit. */
export interface HeadlinePool {
	readonly topic: ArticleTopic;
	readonly tone: ArticleTone;
	readonly mediaId: string;
	readonly detail: string | null;
	readonly size: number;
}

/**
 * Pools de titres trop petits (P3-15) : pour chaque sujet, tonalité publiable,
 * média qui le couvre et précision possible, le nombre de titres disponibles
 * en début de partie. Rapport non bloquant, destiné à la vague de contenu.
 */
export function headlinePoolReport(
	content: Content,
	minimum: number = MIN_HEADLINE_POOL
): HeadlinePool[] {
	const report: HeadlinePool[] = [];
	const topics = [...new Set(content.headlines.map((headline) => headline.topic))];
	for (const topic of topics) {
		const declared = [
			...new Set(
				content.headlines
					.filter((headline) => headline.topic === topic)
					.flatMap((headline) => headline.details ?? [])
			)
		].sort();
		const details: (string | null)[] = declared.length > 0 ? declared : [null];
		const tones: readonly ArticleTone[] = topic === 'ambient' ? ['neutral'] : ARTICLE_TONES;
		// Les titres ne dépendent que de la famille du média : une ligne par famille
		// (les treize quotidiens régionaux partagent leurs pools, P3-18).
		const kinds = new Set<string>();
		for (const mediaId of content.mediaIds) {
			const media = content.media[mediaId]!;
			const covered = topic === 'ambient' || topic === 'interview' || media.coverage[topic] > 0;
			if (!covered || kinds.has(media.kind)) continue;
			kinds.add(media.kind);
			for (const tone of tones) {
				if (media.kind === 'satirical' && tone === 'favorable') continue;
				for (const detail of details) {
					const size = headlineCandidates(topic, tone, detail, media, 0, content).length;
					if (size < minimum) report.push({ topic, tone, mediaId, detail, size });
				}
			}
		}
	}
	return report;
}

/** Angle d'un article consacré au joueur (délai thématique, P3-15). */
export function articleAngle(topic: ArticleTopic, detail: string | null): string {
	return `${topic}:${detail ?? ''}`;
}

/** Sujets toujours couverts, quel que soit le délai thématique. */
export const ALWAYS_COVERED_TOPICS: ReadonlySet<ArticleTopic> = new Set([
	'justice',
	'interview',
	'ownership'
]);

export interface PressParts {
	readonly player: PlayerState;
	readonly world: WorldState;
	readonly rng: RngState;
}

export interface PressResolution {
	readonly parts: PressParts;
	readonly record: PressRecord;
}

/**
 * Fil de presse du trimestre `inputs.turn` (étape 5 quinquies) : articles sur
 * les sujets du trimestre, nouvelle d'ambiance, puis retour des relations vers
 * leur référence. Déterministe pour un même PRNG.
 */
export function resolvePress(
	parts: PressParts,
	inputs: PressInputs,
	content: Content
): PressResolution {
	let { player, world } = parts;
	let memory = world.press;
	const owned = ownedMedia(inputs.upgrades, player.territory.regionId, content);
	const audience = pressAudience(player, inputs.mandates, inputs.campaigns, content);
	const listed = subjectsOf(inputs, player, world, parts.rng, content);
	let rng = listed.rng;
	const articles: Article[] = [];
	const limit = content.press.angleRepeatLimit;
	for (const subject of listed.subjects) {
		if (articles.length >= content.press.maxArticlesPerTurn) break;
		// Délai thématique : pas un article de plus sous un angle déjà répété `limit` fois de suite.
		const angle = articleAngle(subject.topic, subject.detail);
		const recent = memory.recentAngles.slice(-limit);
		if (
			!ALWAYS_COVERED_TOPICS.has(subject.topic) &&
			recent.length >= limit &&
			recent.every((entry) => entry === angle)
		) {
			// Le sujet passe son tour ; la pause compte comme un angle vide, si bien
			// que le sujet revient au trimestre suivant.
			memory = { ...memory, recentAngles: [...memory.recentAngles, ''].slice(-limit) };
			continue;
		}
		let media: MediaDefinition | null;
		if (subject.mediaId !== null) {
			media = content.media[subject.mediaId] ?? null;
		} else {
			const candidates = content.mediaIds
				.map((mediaId) => content.media[mediaId]!)
				.filter(
					(entry) =>
						subject.topic !== 'interview' &&
						entry.coverage[subject.topic] > 0 &&
						!(subject.topic === 'ownership' && owned.has(entry.id)) &&
						// Couverture croisée (P3-18) : une affaire ou un rachat intéressent toute
						// la presse nationale, jamais les titres d'autres régions.
						(entry.scope === 'regional'
							? entry.region === audience.regionId
							: subject.topic === 'justice' ||
								subject.topic === 'ownership' ||
								followsPlayer(entry, audience, content))
				);
			const pick = weighted(
				candidates,
				(entry) =>
					// Poids en centièmes : le quotidien régional pèse moins dans une carrière nationale.
					subject.topic === 'interview'
						? 0
						: entry.coverage[subject.topic] *
							entry.audience *
							(entry.scope === 'regional' && audience.national
								? content.press.regionalNationalPercent
								: 100),
				rng
			);
			rng = pick.rng;
			media = pick.item;
		}
		if (!media) continue;
		const isOwned = owned.has(media.id) && subject.topic !== 'ownership';
		const relation = world.media[media.id]?.relation ?? 0;
		const tone = articleTone(
			subject.tone,
			media,
			relation,
			isOwned,
			content,
			editorialSwing(media.id, subject.topic, subject.subjectId, inputs.turn, content)
		);
		const headlines = headlineCandidates(
			subject.topic,
			tone,
			subject.detail,
			media,
			inputs.turn,
			content
		);
		const choice = drawHeadline(
			headlines,
			headlinePoolKey(subject.topic, tone, subject.detail, media.kind),
			memory,
			rng
		);
		rng = choice.rng;
		const headline = choice.headline;
		if (!headline) throw new Error(`Aucun titre pour ${subject.topic} (${tone}).`);
		memory = {
			...choice.memory,
			recentAngles: [...choice.memory.recentAngles, angle].slice(-limit)
		};
		const value = articleEffect(tone, media, player.exposure, isOwned, content);
		const supports: { groupId: string; delta: number }[] = [];
		if (value !== 0) {
			for (const groupId of media.groups) {
				const outcome = applyPoliticalEffect(
					{ op: 'addSupport', group: groupId, value },
					player,
					world,
					inputs.turn,
					null,
					content
				);
				player = outcome.player;
				for (const change of outcome.changes) {
					if (change.kind === 'support') supports.push({ groupId, delta: change.delta });
				}
			}
		}
		let exposure = 0;
		if (tone === 'critical' && content.press.criticalExposure > 0) {
			const gauge = applyGauge(player.exposure, content.press.criticalExposure);
			player = { ...player, exposure: gauge.value };
			exposure = gauge.applied;
		}
		articles.push({
			mediaId: media.id,
			topic: subject.topic,
			tone,
			headlineId: headline.id,
			subjectId: subject.subjectId,
			detail: subject.detail,
			supports,
			exposure
		});
	}

	// Nouvelle d'ambiance : sans rapport avec le joueur, sans effet.
	const ambient = chance(content.press.ambientPercent, rng);
	rng = ambient.rng;
	// Ambiance : un média national ou le quotidien de la région, jamais celui d'une autre.
	const ambientPool = content.mediaIds.filter((mediaId) => {
		const entry = content.media[mediaId]!;
		return entry.scope === 'national' || entry.region === audience.regionId;
	});
	const mediaPick = ambient.hit ? pickOne(ambientPool, rng) : { item: null, rng };
	rng = mediaPick.rng;
	const ambientMedia = mediaPick.item === null ? undefined : content.media[mediaPick.item];
	if (ambientMedia) {
		const media = ambientMedia;
		const headlines = headlineCandidates('ambient', 'neutral', null, media, inputs.turn, content);
		const choice = drawHeadline(
			headlines,
			headlinePoolKey('ambient', 'neutral', null, media.kind),
			memory,
			rng
		);
		rng = choice.rng;
		memory = choice.memory;
		const headline = choice.headline;
		if (headline) {
			articles.push({
				mediaId: media.id,
				topic: 'ambient',
				tone: 'neutral',
				headlineId: headline.id,
				subjectId: null,
				detail: null,
				supports: [],
				exposure: 0
			});
		}
	}

	// Retour des relations vers leur référence.
	const relations: { mediaId: string; delta: number }[] = [];
	const media: Record<string, MediaState> = { ...world.media };
	for (const mediaId of content.mediaIds) {
		const state = media[mediaId];
		const definition = content.media[mediaId];
		if (!state || !definition) continue;
		const gap = definition.baseRelation - state.relation;
		if (gap === 0) continue;
		const step =
			Math.sign(gap) * Math.ceil((Math.abs(gap) * content.press.relationDriftPercent) / 100);
		const next = Math.max(MEDIA_RELATION_MIN, Math.min(MEDIA_RELATION_MAX, state.relation + step));
		if (next === state.relation) continue;
		media[mediaId] = { ...state, relation: next };
		relations.push({ mediaId, delta: next - state.relation });
	}
	world = { ...world, media, press: memory };
	return { parts: { player, world, rng }, record: { articles, relations } };
}
