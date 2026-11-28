/**
 * Projection des décisions en attente et des conseils de l’entourage (fiche evenements-et-contenu).
 *
 * Partie de la projection publique (`PlayerView`, ARCHITECTURE.md §9) : fonctions pures,
 * sans PRNG ni information cachée. Point d’entrée : `../view-model.ts`.
 */
import type { Content, Effect } from '../../content/types.ts';
import type { EffectRange, GameState } from '../../engine/index.ts';
import { activeStaff, displayName, effectRange, hashSeed } from '../../engine/index.ts';
import { GAUGE_NAMES, INDICATOR_NAMES, RESOURCE_NAMES } from '../format.ts';
import type { BallotReportView } from './career.ts';
import { describeEffect, partyLabel } from './shared.ts';

export interface ChoiceView {
	readonly id: string;
	readonly label: string;
	readonly hints: readonly string[];
	readonly costs: readonly string[];
	readonly available: boolean;
	readonly reason: string | null;
}

/**
 * Avis d'un collaborateur sur une décision (GDD §6.3) : précis s'il est très
 * compétent, indicatif sinon, et parfois faux s'il est médiocre. Il ne porte que
 * sur des effets chiffrables, jamais sur les relations ni les traits cachés.
 */
export interface AdviceView {
	readonly adviser: string;
	readonly quality: 'precise' | 'fair' | 'poor';
	/** Lignes d'avis par identifiant de choix. */
	readonly choices: Readonly<Record<string, readonly string[]>>;
}

export interface DecisionView {
	readonly instanceId: string;
	readonly title: string;
	readonly text: string;
	readonly category: string;
	readonly choices: readonly ChoiceView[];
	readonly remaining: number;
	readonly advice: AdviceView | null;
	/** Premier tour d'un scrutin en attente du second (P3-29), sinon `null`. */
	readonly report: BallotReportView | null;
	/** Fonction proposée par le gouvernement (P3-35), sinon `null`. */
	readonly appointment: string | null;
}

/** Effets d'un choix que peut chiffrer un conseiller (ni relations, ni traits, ni carrière). */
function advisableRanges(effects: readonly Effect[]): EffectRange[] {
	return effects
		.map(effectRange)
		.filter((range) =>
			['resource', 'gauge', 'support', 'indicator', 'partyStrength'].includes(range.kind)
		);
}

function rangeDirection(range: EffectRange): number {
	switch (range.kind) {
		case 'resource':
		case 'gauge':
			return Math.sign(range.min + range.max);
		case 'support':
		case 'indicator':
		case 'partyStrength':
			return Math.sign(range.value);
		default:
			return 0;
	}
}

function rangeName(range: EffectRange, content: Content): string {
	switch (range.kind) {
		case 'resource':
			return RESOURCE_NAMES[range.resource];
		case 'gauge':
			return GAUGE_NAMES[range.gauge];
		case 'support':
			return `Soutien : ${content.supportGroups[range.group]?.label ?? range.group}`;
		case 'indicator':
			return INDICATOR_NAMES[range.indicator];
		case 'partyStrength':
			return `Intentions de vote (${partyLabel(range.party, content)})`;
		default:
			return '';
	}
}

export function buildAdvice(
	state: GameState,
	instanceId: string,
	eventId: string,
	content: Content
): AdviceView | null {
	const definition = content.events[eventId];
	if (!definition?.blocking) return null;
	let best: { name: string; post: string; competence: number } | null = null;
	for (const member of activeStaff(state.staff)) {
		const post = content.posts[member.postId];
		const character = state.characters[member.characterId];
		if (!post || !character || !post.adviceCategories.includes(definition.category)) continue;
		if (!best || character.competence > best.competence) {
			best = { name: displayName(character), post: post.label, competence: character.competence };
		}
	}
	if (!best) return null;
	const balance = content.balance.entourage;
	const quality: AdviceView['quality'] =
		best.competence >= balance.preciseAdviceCompetence
			? 'precise'
			: best.competence >= balance.fairAdviceCompetence
				? 'fair'
				: 'poor';
	const choices: Record<string, string[]> = {};
	for (const choice of definition.choices) {
		choices[choice.id] = advisableRanges(choice.effects).map((range, index) => {
			if (quality === 'precise') return describeEffect(range, content);
			let direction = rangeDirection(range);
			// Un conseil médiocre se trompe parfois de sens, toujours de la même façon pour ce choix.
			if (quality === 'poor') {
				const roll = hashSeed(`${instanceId}:${choice.id}:${index}`) % 1000;
				if (roll < balance.poorAdviceErrorChance * 1000) direction = -direction;
			}
			return `${rangeName(range, content)} : ${direction > 0 ? 'en hausse' : direction < 0 ? 'en baisse' : 'stable'}`;
		});
	}
	return { adviser: `${best.name} (${best.post})`, quality, choices };
}
