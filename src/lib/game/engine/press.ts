/**
 * Médias et fil de presse (P3-03, GDD §9.1, ARCHITECTURE.md §8.4).
 *
 * - Cinq médias fictifs du catalogue, chacun avec sa ligne, son audience, ses
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
import { nextInt, type RngState } from './random.ts';
import type {
	Article,
	Campaign,
	Ballot,
	JusticeRecord,
	LegalCase,
	MediaState,
	OwnedUpgrade,
	PlayerState,
	PressRecord,
	PromisesRecord,
	WorldState
} from './state.ts';
import { applyPoliticalEffect } from './world.ts';

/** Médias possédés par le joueur, par identifiant (actifs `asset.media`). */
export function ownedMedia(upgrades: readonly OwnedUpgrade[], content: Content): Set<string> {
	const owned = new Set<string>();
	for (const upgrade of upgrades) {
		const mediaId = content.upgrades[upgrade.upgradeId]?.asset?.media;
		if (mediaId !== undefined) owned.add(mediaId);
	}
	return owned;
}

/** Le média suit-il le joueur ? Un média national, seulement au-delà du seuil d'exposition. */
export function followsPlayer(media: MediaDefinition, exposure: number, content: Content): boolean {
	return media.scope === 'local' || exposure >= content.press.nationalExposure;
}

/** Raison pour laquelle ce média ne peut pas être ciblé, ou `null`. */
export function mediaIssue(
	target: string,
	player: PlayerState,
	upgrades: readonly OwnedUpgrade[],
	content: Content
): string | null {
	const media = Object.hasOwn(content.media, target) ? content.media[target] : undefined;
	if (!media) return 'choisissez un média du catalogue';
	if (ownedMedia(upgrades, content).has(target)) return 'ce média vous appartient déjà';
	if (!followsPlayer(media, player.exposure, content)) {
		return `${media.name} ne s’intéresse pas encore à vous (exposition insuffisante)`;
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
	content: Content
): ArticleTone {
	const threshold = content.press.toneThreshold;
	const shift = owned ? 1 : relation >= threshold ? 1 : relation <= -threshold ? -1 : 0;
	const tone = shiftTone(base, shift);
	return media.kind === 'satirical' && tone === 'favorable' ? 'neutral' : tone;
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
		const ballot = inputs.ballots.find((item) => item.ballotId === campaign.ballotId);
		if (ballot?.turn !== inputs.turn) continue;
		subjects.push({
			topic: 'election',
			subjectId: campaign.campaignId,
			detail: campaign.status,
			tone: campaign.status === 'won' ? 'favorable' : 'neutral',
			mediaId: null
		});
	}
	for (const upgrade of inputs.upgrades) {
		const mediaId = content.upgrades[upgrade.upgradeId]?.asset?.media;
		if (mediaId === undefined || upgrade.acquiredTurn !== inputs.turn) continue;
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
				tone: 'critical',
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
	const owned = ownedMedia(inputs.upgrades, content);
	const listed = subjectsOf(inputs, player, world, parts.rng, content);
	let rng = listed.rng;
	const articles: Article[] = [];
	for (const subject of listed.subjects) {
		if (articles.length >= content.press.maxArticlesPerTurn) break;
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
						(subject.topic === 'justice' ||
							subject.topic === 'ownership' ||
							followsPlayer(entry, player.exposure, content))
				);
			const pick = weighted(
				candidates,
				(entry) =>
					subject.topic === 'interview' ? 0 : entry.coverage[subject.topic] * entry.audience,
				rng
			);
			rng = pick.rng;
			media = pick.item;
		}
		if (!media) continue;
		const isOwned = owned.has(media.id) && subject.topic !== 'ownership';
		const relation = world.media[media.id]?.relation ?? 0;
		const tone = articleTone(subject.tone, media, relation, isOwned, content);
		const headlines = headlineCandidates(
			subject.topic,
			tone,
			subject.detail,
			media,
			inputs.turn,
			content
		);
		const choice = pickOne(headlines, rng);
		rng = choice.rng;
		const headline = choice.item;
		if (!headline) throw new Error(`Aucun titre pour ${subject.topic} (${tone}).`);
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
	const mediaPick = ambient.hit ? pickOne(content.mediaIds, rng) : { item: null, rng };
	rng = mediaPick.rng;
	const ambientMedia = mediaPick.item === null ? undefined : content.media[mediaPick.item];
	if (ambientMedia) {
		const media = ambientMedia;
		const headlines = headlineCandidates('ambient', 'neutral', null, media, inputs.turn, content);
		const choice = pickOne(headlines, rng);
		rng = choice.rng;
		const headline = choice.item;
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
	world = { ...world, media };
	return { parts: { player, world, rng }, record: { articles, relations } };
}
