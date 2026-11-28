/**
 * Projection des médias et du fil de presse (fiche medias-et-presse).
 *
 * Partie de la projection publique (`PlayerView`, ARCHITECTURE.md §9) : fonctions pures,
 * sans PRNG ni information cachée. Point d’entrée : `../view-model.ts`.
 */
import type { Content } from '../../content/types.ts';
import type { Article, GameState, PlanStep } from '../../engine/index.ts';
import { followsPlayer, formatTurn, ownedMedia, pressAudience } from '../../engine/index.ts';
import { formatGaugeDelta } from '../format.ts';
import { addability } from './agenda.ts';
import type { PlayerView } from '../view-model.ts';
import { articleTitle, mediaRelationLabel } from './shared.ts';

/** Bouton d'une action ciblant un média (interview, déjeuner). */
export interface MediaActionView {
	readonly actionId: string;
	readonly label: string;
	readonly planned: boolean;
	readonly addable: boolean;
	readonly reason: string | null;
}

/** Média du catalogue et sa relation au joueur (P3-03). */
export interface MediaOutletView {
	readonly mediaId: string;
	readonly name: string;
	readonly kindLabel: string;
	readonly line: string;
	readonly description: string;
	readonly audienceLabel: string;
	readonly relationLabel: string;
	readonly owned: boolean;
	/** Le média suit-il le joueur (média local, ou exposition suffisante) ? */
	readonly follows: boolean;
	readonly actions: readonly MediaActionView[];
}

export interface MediaView {
	readonly outlets: readonly MediaOutletView[];
	/** Seuil d'exposition au-delà duquel les médias nationaux suivent le joueur. */
	readonly nationalExposure: number;
}

/** Article du fil de presse (P3-03). */
export interface PressItemView {
	readonly key: string;
	readonly dateLabel: string;
	readonly media: string;
	readonly title: string;
	/** L'article concerne le joueur (sinon : nouvelle d'ambiance). */
	readonly aboutPlayer: boolean;
	readonly toneLabel: string | null;
	/** Information critique (article défavorable), à distinguer de l'ambiance. */
	readonly critical: boolean;
	/** Effets sur les soutiens, en clair (vide si aucun). */
	readonly effects: string;
}

const TONE_LABELS: Readonly<Record<string, string>> = {
	critical: 'Critique',
	neutral: 'Neutre',
	favorable: 'Favorable'
};

const MEDIA_KIND_LABELS: Readonly<Record<string, string>> = {
	reference: 'Quotidien de référence',
	popular: 'Quotidien populaire',
	news_channel: 'Chaîne d’information continue',
	satirical: 'Hebdomadaire satirique',
	regional: 'Presse régionale'
};

export function articleEffects(article: Article, content: Content): string {
	return [
		...article.supports.map(
			(change) =>
				`${content.supportGroups[change.groupId]?.label ?? change.groupId} ${formatGaugeDelta(change.delta)}`
		),
		...(article.exposure !== 0 ? [`Exposition ${formatGaugeDelta(article.exposure)}`] : [])
	].join(', ');
}

export function buildPress(state: GameState, content: Content): PlayerView['press'] {
	const items: PressItemView[] = [];
	for (const entry of state.history) {
		if (entry.type !== 'turn.resolved' || !entry.press) continue;
		entry.press.articles.forEach((article, index) => {
			const aboutPlayer = article.topic !== 'ambient';
			items.push({
				key: `t${entry.turn}-a${index}`,
				dateLabel: formatTurn(entry.turn + 1),
				media: content.media[article.mediaId]?.name ?? article.mediaId,
				title: articleTitle(article, state, content),
				aboutPlayer,
				toneLabel: aboutPlayer ? (TONE_LABELS[article.tone] ?? null) : null,
				critical: aboutPlayer && article.tone === 'critical',
				effects: articleEffects(article, content)
			});
		});
	}
	return items.reverse().slice(0, 8);
}

/** Trimestres couverts par l'écran Actualités ; les plus anciens restent au journal. */
const NEWS_QUARTERS = 20;

export function buildNews(state: GameState, content: Content): PlayerView['news'] {
	const groups: { key: string; label: string; items: PressItemView[] }[] = [];
	for (const entry of state.history) {
		if (entry.type !== 'turn.resolved' || !entry.press || entry.press.articles.length === 0)
			continue;
		groups.push({
			key: `t${entry.turn}`,
			label: formatTurn(entry.turn + 1),
			items: entry.press.articles.map((article, index) => {
				const aboutPlayer = article.topic !== 'ambient';
				return {
					key: `t${entry.turn}-a${index}`,
					dateLabel: formatTurn(entry.turn + 1),
					media: content.media[article.mediaId]?.name ?? article.mediaId,
					title: articleTitle(article, state, content),
					aboutPlayer,
					toneLabel: aboutPlayer ? (TONE_LABELS[article.tone] ?? null) : null,
					critical: aboutPlayer && article.tone === 'critical',
					effects: articleEffects(article, content)
				};
			})
		});
	}
	return groups.reverse().slice(0, NEWS_QUARTERS);
}

function audienceLabel(audience: number): string {
	return audience >= 50
		? 'Forte audience'
		: audience >= 30
			? 'Audience moyenne'
			: 'Audience confidentielle';
}

export function buildMedia(
	state: GameState,
	plan: readonly PlanStep[],
	content: Content
): MediaView {
	const actionIds = content.actionIds.filter((id) => content.actions[id]?.target === 'media');
	const regionId = state.player.territory.regionId;
	const owned = ownedMedia(state.upgrades, regionId, content);
	const audience = pressAudience(state.player, state.mandates, state.campaigns, content);
	const outlets = content.mediaIds.flatMap((mediaId): MediaOutletView[] => {
		const definition = content.media[mediaId];
		// Presse nationale et quotidien de la région ; les titres des autres régions restent hors champ.
		if (!definition || (definition.scope === 'regional' && definition.region !== regionId))
			return [];
		const isOwned = owned.has(mediaId);
		return [
			{
				mediaId,
				name: definition.name,
				kindLabel: MEDIA_KIND_LABELS[definition.kind] ?? definition.kind,
				line: definition.line,
				description: definition.description,
				audienceLabel: audienceLabel(definition.audience),
				relationLabel: isOwned
					? 'Votre propriété'
					: mediaRelationLabel(state.world.media[mediaId]?.relation ?? 0),
				owned: isOwned,
				follows: followsPlayer(definition, audience, content),
				actions: isOwned
					? []
					: actionIds.map((actionId) => {
							const step: PlanStep = { kind: 'action', id: actionId, target: mediaId };
							const isPlanned = plan.some(
								(entry) =>
									entry.kind === 'action' && entry.id === actionId && entry.target === mediaId
							);
							const add = isPlanned
								? { addable: false, reason: null }
								: addability(state, plan, step, content);
							return {
								actionId,
								label: content.actions[actionId]?.label ?? actionId,
								planned: isPlanned,
								addable: add.addable,
								reason: add.reason
							};
						})
			}
		];
	});
	return { outlets, nationalExposure: content.press.nationalExposure };
}
