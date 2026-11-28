/**
 * Projection du bilan de fin de carrière et du carnet (fiche bilan-et-carnet).
 *
 * Partie de la projection publique (`PlayerView`, ARCHITECTURE.md §9) : fonctions pures,
 * sans PRNG ni information cachée. Point d’entrée : `../view-model.ts`.
 */
import type { Content } from '../../content/types.ts';
import { RESOURCE_IDS } from '../../content/types.ts';
import type { AmbitionVerdict, GameState } from '../../engine/index.ts';
import {
	ambitionVerdict,
	careerSummary,
	distinctionsOf,
	formatTurn,
	highestOffice,
	legacyMetrics,
	obituaryOf,
	regionalMedia,
	resolveMediaRef
} from '../../engine/index.ts';
import { RESOURCE_NAMES, formatMoney, formatResource } from '../format.ts';
import { bestBallotLine } from './career.ts';
import { buildTerritory } from './creation.ts';
import { promisesSummary } from './promises.ts';
import { CAUSE_LABELS, electionName, levelOf, mandateName, ofWord } from './shared.ts';

/**
 * Bilan de fin de carrière (P3-08, DESIGN.md §6) : une de journal avec la
 * nécrologie (ou la chronique judiciaire), les distinctions méritées, les
 * moments marquants et le parcours par rubriques.
 */
export interface SummaryView {
	/** Bandeau du journal : nécrologie ou chronique judiciaire. */
	readonly masthead: string;
	readonly title: string;
	readonly text: string;
	readonly cause: string;
	/** Naissance, fin et âge, en une ligne. */
	readonly dates: string;
	readonly distinctions: readonly {
		readonly id: string;
		readonly label: string;
		readonly description: string;
	}[];
	/** Moments marquants, dans l'ordre chronologique. */
	readonly moments: readonly {
		readonly key: string;
		readonly date: string;
		readonly text: string;
	}[];
	readonly sections: readonly {
		readonly title: string;
		readonly lines: readonly { readonly label: string; readonly value: string }[];
	}[];
	/** Fiche du carnet des carrières (P3-41), archivée dans ce navigateur. */
	readonly logbook: LogbookEntry;
	/** Pour rejouer la même partie (P3-42) : seed et profil de départ. */
	readonly replay: {
		readonly seed: string;
		readonly origin: string;
		readonly engagement: string;
		readonly region: string;
		readonly ambition: string | null;
	};
}

/**
 * Fiche d'une carrière terminée au carnet (P3-41) : affichage seul, jamais
 * mêlée à la sauvegarde en cours, sans bonus ni déblocage.
 */
export interface LogbookEntry {
	/** Seed et trimestre de fin : une carrière n'est archivée qu'une fois. */
	readonly id: string;
	readonly seed: string;
	readonly headline: string;
	readonly dates: string;
	readonly cause: string;
	readonly office: string;
	readonly ambition: string | null;
	readonly distinctions: readonly { readonly id: string; readonly label: string }[];
}

const AMBITION_VERDICTS: Readonly<Record<AmbitionVerdict, string>> = {
	pending: 'en cours',
	achieved: 'atteinte',
	missed: 'manquée',
	betrayed: 'trahie'
};

/** Ambition de départ et son état, en clair (P3-38), sinon `null`. */
export function ambitionText(state: GameState, content: Content): string | null {
	const ambition = state.player.ambition;
	const verdict = ambitionVerdict(state, content);
	if (!ambition || !verdict) return null;
	const label = content.ambitions[ambition.ambitionId]?.label ?? ambition.ambitionId;
	const when =
		verdict === 'achieved' && ambition.achievedTurn !== null
			? ` au ${formatTurn(ambition.achievedTurn)}`
			: verdict === 'betrayed' && ambition.betrayedTurn !== null
				? ` au ${formatTurn(ambition.betrayedTurn)}`
				: '';
	return `${label} — ${AMBITION_VERDICTS[verdict]}${when}`;
}

/** Nombre de moments marquants retenus au bilan. */
const MAX_MOMENTS = 10;

function lowerOffence(label: string): string {
	return label.charAt(0).toLocaleLowerCase('fr-FR') + label.slice(1);
}

/** Moments marquants : les plus importants, puis dans l'ordre chronologique. */
function buildMoments(state: GameState, content: Content): SummaryView['moments'] {
	const moments: { turn: number; weight: number; text: string }[] = [];
	const ranks = state.mandates.map((mandate) => content.mandates[mandate.mandateId]?.rank ?? 0);
	const top = Math.max(0, ...ranks);
	const seen = new Set<string>();
	state.mandates.forEach((mandate, index) => {
		const label = mandateName(mandate.mandateId, state, content, mandate.portfolio);
		const first = !seen.has(mandate.mandateId);
		seen.add(mandate.mandateId);
		if (!first && ranks[index] !== top) return;
		moments.push({
			turn: mandate.startTurn,
			weight: ranks[index] === top ? 9 : 7,
			text: `${first ? 'Première prise de fonction' : 'Retour'} : ${label}`
		});
	});
	for (const campaign of state.campaigns) {
		if (campaign.status !== 'lost') continue;
		const ballot = state.ballots.find((entry) => entry.ballotId === campaign.ballotId);
		const election = electionName(campaign.electionId, state, content);
		moments.push({
			turn: ballot?.turn ?? campaign.declaredTurn,
			weight: 3,
			text: `Défaite : ${election}`
		});
	}
	for (const legalCase of state.cases) {
		if (legalCase.defendantId !== null) continue;
		const fact = state.facts.find((entry) => entry.factId === legalCase.factId);
		const offence = lowerOffence(content.offenses[fact?.offenseId ?? '']?.label ?? 'une affaire');
		moments.push({
			turn: legalCase.openedTurn,
			weight: 6,
			text: `Révélation d’une affaire ${ofWord(offence)}`
		});
		if (legalCase.outcome && legalCase.closedTurn !== null) {
			const verdict =
				legalCase.outcome === 'convicted'
					? 'Condamnation'
					: legalCase.outcome === 'acquitted'
						? 'Relaxe'
						: 'Classement sans suite';
			moments.push({
				turn: legalCase.closedTurn,
				weight: legalCase.outcome === 'convicted' ? 10 : 6,
				text: `${verdict} dans l’affaire ${ofWord(offence)}`
			});
		}
	}
	for (const pledge of state.promises) {
		if ((pledge.status !== 'kept' && pledge.status !== 'abandoned') || pledge.closedTurn === null)
			continue;
		const label = content.promises[pledge.promiseId]?.label ?? pledge.promiseId;
		moments.push({
			turn: pledge.closedTurn,
			weight: 5,
			text: `${pledge.status === 'kept' ? 'Promesse tenue' : 'Promesse abandonnée'} : « ${label} »`
		});
	}
	for (const reform of state.institutions.reforms) {
		if (
			reform.origin !== 'player' ||
			(reform.status !== 'scheduled' && reform.status !== 'enacted')
		)
			continue;
		const parameter =
			content.institutionParameters[reform.parameterId]?.label ?? reform.parameterId;
		const level = levelOf(reform.levelId, content)?.label ?? reform.levelId;
		moments.push({
			turn: reform.proposedTurn,
			weight: 6,
			text: `Réforme adoptée — ${parameter} : « ${level} »`
		});
	}
	for (const upgrade of state.upgrades) {
		const ref = content.upgrades[upgrade.upgradeId]?.asset?.media;
		if (ref === undefined) continue;
		const mediaId = resolveMediaRef(ref, state.player.territory.regionId, content);
		moments.push({
			turn: upgrade.acquiredTurn,
			weight: 5,
			text: `Rachat de ${content.media[mediaId]?.name ?? mediaId}`
		});
	}
	for (const entry of state.history) {
		if (entry.type !== 'event.resolved') continue;
		for (const change of entry.politics) {
			if (change.kind !== 'familyJoined') continue;
			moments.push({
				turn: entry.turn,
				weight: 4,
				text: change.relation === 'partner' ? 'Une nouvelle vie à deux' : 'Naissance d’un enfant'
			});
		}
	}
	return moments
		.map((moment, index) => ({ ...moment, index }))
		.sort(
			(left, right) =>
				right.weight - left.weight || left.turn - right.turn || left.index - right.index
		)
		.slice(0, MAX_MOMENTS)
		.sort((left, right) => left.turn - right.turn || left.index - right.index)
		.map((moment) => ({
			key: `m${moment.index}`,
			date: formatTurn(moment.turn),
			text: moment.text
		}));
}

export function buildSummary(state: GameState, content: Content): SummaryView | null {
	if (!state.end) return null;
	const summary = careerSummary(state);
	const metrics = legacyMetrics(state, content);
	const obituary = obituaryOf(state, content);
	const office = highestOffice(state, content);
	const fill = (text: string): string =>
		text
			.replaceAll('{age}', String(summary.age))
			.replaceAll('{years}', String(metrics.years))
			.replaceAll('{office}', office ?? 'aucune');
	const cause = summary.cause ?? 'natural_causes';
	const attitudes = Object.entries(state.relationships)
		.map(([id, relation]) => ({
			name: state.characters[id]?.name ?? id,
			attitude: relation.attitude
		}))
		.sort((left, right) => right.attitude - left.attitude);
	const ally = attitudes[0] && attitudes[0].attitude >= 40 ? attitudes[0].name : 'aucun';
	const foe = attitudes.at(-1);
	const parties = state.player.affiliations
		.map((affiliation) => content.parties[affiliation.partyId]?.acronym ?? affiliation.partyId)
		.join(', ');
	// Le quotidien de la région d'origine signe l'article (P3-18).
	const paper =
		regionalMedia(state.player.territory.regionId, content)?.name ?? 'La presse régionale';
	return {
		replay: {
			seed: state.rng.seed,
			origin: state.player.origin,
			engagement: state.player.engagement,
			region: state.player.territory.regionId,
			ambition: state.player.ambition?.ambitionId ?? null
		},
		logbook: {
			id: `${state.rng.seed}@${summary.lastTurn}`,
			seed: state.rng.seed,
			headline: obituary ? fill(obituary.headline) : `Fin de carrière à ${summary.age} ans`,
			dates: `${formatTurn(state.player.birthTurn)} – ${formatTurn(summary.lastTurn)} · ${summary.age} ans`,
			cause: CAUSE_LABELS[cause],
			office: office ?? 'Aucun mandat',
			ambition: ambitionText(state, content),
			distinctions: distinctionsOf(state, content).map(({ id, label }) => ({ id, label }))
		},
		masthead: `${paper} · ${cause === 'prison' ? 'Chronique judiciaire' : cause === 'retirement' ? 'Portrait' : 'Nécrologie'}`,
		title: obituary ? fill(obituary.headline) : `Fin de carrière à ${summary.age} ans`,
		text: obituary ? fill(obituary.text) : '',
		cause: CAUSE_LABELS[cause],
		dates: `${formatTurn(state.player.birthTurn)} – ${formatTurn(summary.lastTurn)} · ${summary.age} ans`,
		distinctions: distinctionsOf(state, content).map(({ id, label, description }) => ({
			id,
			label,
			description
		})),
		moments: buildMoments(state, content),
		sections: [
			{
				title: 'Parcours',
				lines: [
					{ label: 'Plus haute fonction', value: office ?? 'Aucun mandat' },
					...(state.player.ambition
						? [{ label: 'Ambition de départ', value: ambitionText(state, content) ?? '' }]
						: []),
					{ label: 'Mandats exercés', value: String(metrics.mandatesHeld) },
					{ label: 'Années en fonction', value: String(metrics.yearsInOffice) },
					{
						label: 'Scrutins',
						value: `${metrics.campaignsWon} gagné(s), ${metrics.campaignsLost} perdu(s)`
					},
					...bestBallotLine(state, content),
					{ label: 'Partis', value: parties || 'Sans étiquette' },
					{ label: 'Trimestres de carrière', value: String(summary.quartersPlayed) }
				]
			},
			{
				title: 'Fortune',
				lines: [
					{ label: 'Valeur nette (argent et biens)', value: formatMoney(summary.netWorthCents) },
					...RESOURCE_IDS.map((id) => ({
						label: RESOURCE_NAMES[id],
						value: formatResource(id, summary.resources[id])
					})),
					{ label: 'Fonds détournés', value: formatMoney(summary.divertedCents) }
				]
			},
			{
				title: 'Engagements et justice',
				lines: [
					{ label: 'Promesses', value: promisesSummary(summary.promises) },
					{
						label: 'Affaires judiciaires',
						value: `${summary.cases} dossier(s), ${summary.convictions} condamnation(s)`
					},
					{ label: 'Réformes adoptées', value: String(metrics.reformsAdopted) }
				]
			},
			{
				title: 'Vie et relations',
				lines: [
					{
						label: 'Origine',
						value: content.origins[state.player.origin]?.label ?? state.player.origin
					},
					{
						label: 'Commune natale',
						value: (() => {
							const territory = buildTerritory(state, content);
							return `${territory.town} (${territory.department}, ${territory.region})`;
						})()
					},
					{
						label: 'Terrain d’engagement',
						value: content.engagements[state.player.engagement]?.label ?? state.player.engagement
					},
					{ label: 'Enfants', value: String(metrics.children) },
					{ label: 'Plus fidèle soutien', value: ally },
					{
						label: 'Rancune la plus tenace',
						value: foe && foe.attitude <= -40 ? foe.name : 'aucune'
					},
					{ label: 'Événements vécus', value: String(summary.eventsExperienced) }
				]
			}
		]
	};
}
