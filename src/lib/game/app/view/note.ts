/**
 * Projection de la note de cabinet, du résultat des décisions et du résumé de période (fiche tour-et-acceleration).
 *
 * Partie de la projection publique (`PlayerView`, ARCHITECTURE.md §9) : fonctions pures,
 * sans PRNG ni information cachée. Point d’entrée : `../view-model.ts`.
 */
import type { Content } from '../../content/types.ts';
import { RESOURCE_IDS } from '../../content/types.ts';
import type { ChoiceRecord, GameState, HistoryEntry, QuarterSnapshot } from '../../engine/index.ts';
import { caseStepMessage, displayName, formatTurn, renderTemplate } from '../../engine/index.ts';
import {
	RESOURCE_NAMES,
	formatCompactRange,
	formatDelta,
	formatGaugeDelta,
	formatResource
} from '../format.ts';
import type { BallotReportView } from './career.ts';
import { ballotReportView, runoffReport } from './career.ts';
import type { JournalLine, JournalTurnView, PlanAdjustment } from './journal.ts';
import {
	buildJournal,
	characterLines,
	familyLines,
	journalOfChoice,
	journalOfQuarter,
	staffLines,
	worldLines
} from './journal.ts';
import type { ChipSense, ChipView } from './shared.ts';
import {
	activistsWord,
	effectChips,
	electionName,
	eventTitle,
	lowerFirstUpper,
	mandateName,
	politicsText,
	senseOf,
	textHash
} from './shared.ts';

/**
 * Résultat du dernier choix (P3-14) : récit, variations réellement appliquées
 * (aléas compris) et détail. Tiré de l'entrée `event.resolved` du journal :
 * aucune suite programmée ni information cachée n'y figure.
 */
export interface OutcomeView {
	readonly instanceId: string;
	readonly dateLabel: string;
	readonly title: string;
	readonly choice: string;
	/** Récit du catalogue (`outcome`) ou texte de repli tiré des effets. */
	readonly text: string;
	/** Récit écrit au catalogue (sinon repli généré). */
	readonly written: boolean;
	/** Ressources, jauges, soutiens, préparation et faits, en pastilles. */
	readonly chips: readonly ChipView[];
	/** Autres conséquences constatées (mandats, partis, personnes…). */
	readonly details: readonly string[];
	/** Procès-verbal définitif après une décision d'entre-deux-tours (P3-29). */
	readonly report: BallotReportView | null;
}

/** Statistique de la note : variation du trimestre et valeur atteinte (P3-14). */
export interface NoteVariationView {
	readonly identity: string;
	readonly label: string;
	/** « +3 », « −120 € », « 0 » ; `null` au premier trimestre (pas de point de départ). */
	readonly change: string | null;
	/** Valeur atteinte (« 14 », « 3 800 € »). */
	readonly value: string;
	readonly sense: ChipSense;
}

/** Graphique d'un fait marquant : procès-verbal du joueur ou parts d'un scrutin. */
export type NoteChartView =
	| { readonly kind: 'report'; readonly report: BallotReportView }
	| {
			readonly kind: 'shares';
			readonly rows: readonly {
				readonly label: string;
				readonly percent: number;
				readonly mine: boolean;
			}[];
	  };

/**
 * Fait marquant entre deux trimestres (P3-14) : élection, alternance, mandat,
 * dirigeant de parti, justice, entourage, événement. Titre court, une phrase,
 * graphique éventuel ; uniquement des faits publics déjà inscrits au journal.
 */
export interface NoteHighlightView {
	readonly key: string;
	readonly kind:
		| 'victory'
		| 'defeat'
		| 'ballot'
		| 'mandate'
		| 'party'
		| 'justice'
		| 'people'
		| 'event'
		| 'institution';
	readonly tone: ChipSense;
	readonly title: string;
	readonly text: string;
	readonly chart: NoteChartView | null;
	/** Bilan électoral de la carrière, joint au résultat d'une candidature. */
	readonly record: { readonly won: number; readonly lost: number } | null;
	/**
	 * Effets observables propres au fait (PT-B1-003) : pastilles de l'événement
	 * lui-même, jamais la variation nette du trimestre ; vide pour les autres faits.
	 */
	readonly chips: readonly ChipView[];
	/** Autres conséquences de l'événement (mandats, partis, personnes…), repliées. */
	readonly details: readonly string[];
}

/**
 * Note de cabinet du dernier trimestre (P3-14, version « suivi de partie ») :
 * nouvelle date, évolution des statistiques, faits marquants entre les deux
 * trimestres. Tirée du journal sauvegardé : rouvrable, jamais rejouée.
 */
export interface QuarterNoteView {
	readonly key: string;
	/** Trimestre qui commence (« T2 2004 »). */
	readonly dateLabel: string;
	/** Trimestre écoulé. */
	readonly endedLabel: string;
	/** Premier trimestre : valeurs atteintes sans variation. */
	readonly first: boolean;
	readonly variations: readonly NoteVariationView[];
	readonly highlights: readonly NoteHighlightView[];
	/** Autres faits du trimestre laissés au journal. */
	readonly journalLines: number;
	/** Activités retirées du plan reconduit (P3-11). */
	readonly adjustments: readonly string[];
}

/** Phrase de repli (choix sans récit au catalogue) : sobre, tirée de l'effet le plus visible. */
function fallbackOutcome(entry: ChoiceRecord, label: string): string {
	const opening = `Vous tranchez : « ${label} ».`;
	const money = entry.changes.find((change) => change.resource !== 'influence');
	const influence = entry.changes.find((change) => change.resource === 'influence');
	const stress = entry.gauges.find((change) => change.gauge === 'player.stress');
	const support = entry.politics.find((change) => change.kind === 'support');
	if (money && money.delta < 0)
		return `${opening} La dépense est actée ; le service comptable soupire, mais signe.`;
	if (money && money.delta > 0)
		return `${opening} Les fonds arrivent ; personne ne demande trop d’où.`;
	if (influence && influence.delta > 0)
		return `${opening} Quelques portes s’entrouvrent ; on retient votre nom.`;
	if (influence && influence.delta < 0) return `${opening} Quelques portes se referment, poliment.`;
	if (support?.kind === 'support')
		return support.delta > 0
			? `${opening} L’écho est plutôt bon chez ceux qui comptent.`
			: `${opening} Certains électeurs froncent les sourcils.`;
	if (stress && stress.delta > 0) return `${opening} Vous le sentez passer.`;
	if (stress && stress.delta < 0) return `${opening} Vous respirez un peu mieux.`;
	return `${opening} L’affaire est classée, pour l’instant.`;
}

export function buildOutcome(state: GameState, content: Content): OutcomeView | null {
	const entry = state.history.findLast(
		(candidate): candidate is ChoiceRecord => candidate.type === 'event.resolved'
	);
	if (!entry) return null;
	const definition = content.events[entry.eventId];
	const quarter = state.history.find(
		(candidate): candidate is HistoryEntry =>
			candidate.type === 'turn.resolved' &&
			candidate.events.some((event) => event.instanceId === entry.instanceId)
	);
	const actors =
		quarter?.events.find((event) => event.instanceId === entry.instanceId)?.actors ?? {};
	const render = (text: string): string => renderTemplate(text, actors, content, state.characters);
	const choice =
		definition?.blocking === true
			? definition.choices.find((candidate) => candidate.id === entry.choiceId)
			: undefined;
	const label = choice ? render(choice.label) : entry.choiceId;
	const variants = choice?.outcome ?? [];
	const written = variants.length > 0;
	const text = written
		? render(variants[textHash(entry.instanceId) % variants.length]!)
		: fallbackOutcome(entry, label);
	const { chips, details } = effectChips(entry, state, content);
	if (entry.deathCause) details.push('Fin de carrière.');
	return {
		instanceId: entry.instanceId,
		dateLabel: formatTurn(entry.turn),
		title: definition ? render(definition.title) : entry.eventId,
		choice: label,
		text,
		written,
		chips,
		details,
		report: runoffReport(entry, state, content)
	};
}

const NOTE_VARIATIONS: readonly {
	readonly key: keyof QuarterSnapshot;
	readonly identity: string;
	readonly label: string;
	/** 1 : une hausse est un gain ; −1 : une hausse est un coût. */
	readonly good: 1 | -1;
}[] = [
	{ key: 'influence', identity: 'influence', label: 'Influence', good: 1 },
	{
		key: 'politicalBudgetCents',
		identity: 'politicalBudgetCents',
		label: 'Budget politique',
		good: 1
	},
	{ key: 'personalCashCents', identity: 'personalCashCents', label: 'Argent personnel', good: 1 },
	{ key: 'popularity', identity: 'popularity', label: 'Popularité', good: 1 },
	{ key: 'health', identity: 'player.health', label: 'Santé', good: 1 },
	{ key: 'stress', identity: 'player.stress', label: 'Stress', good: -1 }
];

/** Faits marquants retenus dans la note ; les autres restent au journal. */
const MAX_HIGHLIGHTS_IN_NOTE = 5;

/** Phrase d'un résultat de candidature, selon l'écart (variante fixe, pas de hasard). */
function campaignSentence(won: boolean, percent: number, rival: string): string {
	const against = rival ? ` face à ${rival}` : '';
	if (won) {
		if (percent >= 60)
			return `Raz-de-marée : ${percent} % des voix${against}. Les militants n’ont même pas eu le temps de s’inquiéter.`;
		if (percent < 53)
			return `D’un cheveu : ${percent} %${against}. Le recomptage n’y changera rien, l’écharpe est à vous.`;
		return `Vous l’emportez avec ${percent} %${against}. La soirée électorale se prolonge tard.`;
	}
	if (percent >= 47)
		return `Défaite d’un souffle : ${percent} %${against}. La notoriété progresse, la fatigue aussi.`;
	return `Défaite nette : ${percent} %${against}. Les affiches restent sur les murs, les militants rentrent chez eux.`;
}

function reportChart(
	ballotIdValue: string | null,
	state: GameState,
	content: Content
): NoteChartView | null {
	const ballot = state.ballots.find((entry) => entry.ballotId === ballotIdValue);
	const report = ballot ? ballotReportView(ballot, state, content) : null;
	return report ? { kind: 'report', report } : null;
}

function noteHighlights(
	entry: HistoryEntry,
	state: GameState,
	content: Content
): NoteHighlightView[] {
	const items: NoteHighlightView[] = [];
	// Ambition de départ (P3-38) : saluée, ou constatée trahie, au trimestre où elle se joue.
	const ambition = state.player.ambition;
	const ambitionLabel = ambition ? content.ambitions[ambition.ambitionId]?.label : undefined;
	if (ambition && ambitionLabel && ambition.achievedTurn === entry.turn + 1) {
		items.push({
			key: `ambition:${ambition.ambitionId}`,
			kind: 'victory',
			tone: 'gain',
			title: `Ambition atteinte — ${ambitionLabel}`,
			text: 'Le cap fixé à vingt-cinq ans est atteint. Reste à savoir ce que l’on fait d’un rêve réalisé.',
			chart: null,
			record: null,
			chips: [],
			details: []
		});
	} else if (ambition && ambitionLabel && ambition.betrayedTurn === entry.turn + 1) {
		items.push({
			key: `ambition:${ambition.ambitionId}`,
			kind: 'defeat',
			tone: 'cost',
			title: `Ambition trahie — ${ambitionLabel}`,
			text: 'Le jeune militant de vingt-cinq ans ne s’y serait pas reconnu. Le bilan s’en souviendra.',
			chart: null,
			record: null,
			chips: [],
			details: []
		});
	}
	const record = {
		won: state.campaigns.filter((campaign) => campaign.status === 'won').length,
		lost: state.campaigns.filter((campaign) => campaign.status === 'lost').length
	};
	const deadlines = entry.deadlines;
	const ownBallots = new Set<string>();
	for (const result of deadlines?.campaigns ?? []) {
		const campaign = state.campaigns.find(
			(candidate) => candidate.campaignId === result.campaignId
		);
		if (campaign) ownBallots.add(campaign.ballotId);
		const label = electionName(campaign?.electionId ?? '', state, content);
		const rival = result.opponentId ? state.characters[result.opponentId] : undefined;
		const rivalName = rival ? displayName(rival) : '';
		if (result.status === 'disqualified' || result.playerPercent === null) {
			items.push({
				key: `campaign:${result.campaignId}`,
				kind: 'defeat',
				tone: 'cost',
				title: `Candidature invalidée — ${label}`,
				text: `Votre candidature n’a pas été retenue : ${result.reason ?? 'conditions non remplies'}.`,
				chart: null,
				record,
				chips: [],
				details: []
			});
			continue;
		}
		const won = result.status === 'won';
		items.push({
			key: `campaign:${result.campaignId}`,
			kind: won ? 'victory' : 'defeat',
			tone: won ? 'gain' : 'cost',
			title: `${won ? 'Victoire' : 'Défaite'} — ${label}`,
			text: campaignSentence(won, result.playerPercent, rivalName),
			chart: reportChart(campaign?.ballotId ?? null, state, content),
			record,
			chips: [],
			details: []
		});
	}
	// Premier tour sans vainqueur : le second attend la décision du joueur (P3-29).
	for (const campaignIdValue of deadlines?.runoffs ?? []) {
		const campaign = state.campaigns.find((candidate) => candidate.campaignId === campaignIdValue);
		if (!campaign) continue;
		ownBallots.add(campaign.ballotId);
		items.push({
			key: `runoff:${campaignIdValue}`,
			kind: 'ballot',
			tone: 'risk',
			title: `Premier tour — ${electionName(campaign.electionId, state, content)}`,
			text: 'Aucune majorité au premier tour : le second se joue dans quelques jours, et la décision vous revient.',
			chart: reportChart(campaign.ballotId, state, content),
			record: null,
			chips: [],
			details: []
		});
	}
	for (const result of deadlines?.ballots ?? []) {
		if (ownBallots.has(result.ballotId)) continue;
		const ballot = state.ballots.find((entry) => entry.ballotId === result.ballotId);
		const winner = content.parties[result.winnerPartyId]?.name ?? result.winnerPartyId;
		const alternance = result.governingAfter !== result.governingBefore;
		const mine = state.player.partyId;
		items.push({
			key: `ballot:${result.ballotId}`,
			kind: 'ballot',
			tone: alternance ? 'risk' : 'neutral',
			title: `${alternance ? 'Alternance' : 'Scrutin'} — ${electionName(result.electionId, state, content)}`,
			text: alternance
				? `Le ${content.parties[result.governingAfter]?.name ?? result.governingAfter} forme le nouveau gouvernement ; le ${content.parties[result.governingBefore]?.name ?? result.governingBefore} passe dans l’opposition.`
				: `Le ${winner} arrive en tête.`,
			// Procès-verbal du territoire, comme pour une candidature (P3-29) ; à défaut, les parts.
			chart: ballot?.report
				? reportChart(ballot.ballotId, state, content)
				: ballot?.shares
					? {
							kind: 'shares',
							rows: ballot.shares.slice(0, 5).map((share) => ({
								label: content.parties[share.partyId]?.acronym ?? share.partyId,
								percent: share.percent,
								mine: share.partyId === mine
							}))
						}
					: null,
			record: null,
			chips: [],
			details: []
		});
	}
	for (const change of deadlines?.mandates ?? []) {
		if (change.kind !== 'mandateEnded') continue;
		items.push({
			key: `mandate:${change.instanceId}`,
			kind: 'mandate',
			tone: 'neutral',
			title: `Fin de mandat — ${mandateName(change.mandateId, state, content)}`,
			text: 'Le mandat arrive à son terme ; le bureau se vide, les cartons se remplissent.',
			chart: null,
			record: null,
			chips: [],
			details: []
		});
	}
	for (const step of entry.justice?.cases ?? []) {
		items.push({
			key: `case:${step.caseId}:${step.kind}`,
			kind: 'justice',
			tone: 'risk',
			title: 'Justice',
			text: caseStepMessage(step.caseId, step.kind, state, content),
			chart: null,
			record: null,
			chips: [],
			details: []
		});
	}
	// Recrutement tenté au trimestre (PT-B1-005) : acceptation ou refus du candidat.
	for (const change of entry.steps.flatMap((step) => step.politics)) {
		if (change.kind !== 'hired' && change.kind !== 'hireRefused') continue;
		const character = state.characters[change.characterId];
		const name = character ? displayName(character) : 'Le candidat';
		const post = content.posts[change.postId]?.label ?? change.postId;
		const member = state.staff.find(
			(entry) => entry.characterId === change.characterId && entry.postId === change.postId
		);
		items.push({
			key: `recruitment:${change.characterId}`,
			kind: 'people',
			tone: change.kind === 'hired' ? 'gain' : 'cost',
			title: change.kind === 'hired' ? 'Recrutement conclu' : 'Offre déclinée',
			text:
				change.kind === 'hired'
					? `${name} accepte le poste « ${post} »${member ? ` pour ${formatResource('politicalBudgetCents', member.salaryCents)} par trimestre` : ''} et se met au travail dès ce trimestre.`
					: change.counterCents === null
						? `${name} décline le poste « ${post} » et quitte la présélection. Aucune prime n’a été versée ; le poste reste à pourvoir.`
						: `${name} décline le poste « ${post} », mais fait savoir qu’il accepterait ${formatResource('politicalBudgetCents', change.counterCents)} par trimestre. La proposition tient un trimestre ; sans réponse, il partira.`,
			chart: null,
			record: null,
			chips: [],
			details: []
		});
	}
	for (const line of worldLines(entry.world, state, content)) {
		items.push({
			key: `party:${items.length}`,
			kind: 'party',
			tone: 'neutral',
			title: 'Vie des partis',
			text: line.text,
			chart: null,
			record: null,
			chips: [],
			details: []
		});
	}
	for (const line of [
		...staffLines(entry.staff, state, content),
		...familyLines(entry.family, state),
		...characterLines(entry.characters, state)
	]) {
		if (line.kind !== 'people' && line.kind !== 'career') continue;
		items.push({
			key: `people:${items.length}`,
			kind: 'people',
			tone: 'neutral',
			title: 'Entourage',
			text: line.text,
			chart: null,
			record: null,
			chips: [],
			details: []
		});
	}
	const base = entry.activists;
	if (base && base.tierAfter !== base.tierBefore) {
		const tiers = content.balance.activists.tiers;
		const rise =
			tiers.findIndex((tier) => tier.id === base.tierAfter) >
			tiers.findIndex((tier) => tier.id === base.tierBefore);
		const label = tiers.find((tier) => tier.id === base.tierAfter)?.label ?? base.tierAfter;
		items.push({
			key: 'activists',
			kind: 'people',
			tone: rise ? 'gain' : 'cost',
			title: 'Base militante',
			text: rise
				? `Votre base devient : ${label} (${activistsWord(base.total)}). Les tracts partent plus vite.`
				: `Votre base retombe : ${label} (${activistsWord(base.total)}). Les permanences sonnent creux.`,
			chart: null,
			record: null,
			chips: [],
			details: []
		});
	}
	if (entry.institutions && entry.institutions.politics.length > 0) {
		items.push({
			key: 'institutions',
			kind: 'institution',
			tone: 'neutral',
			title: 'Institutions',
			text: lowerFirstUpper(politicsText(entry.institutions.politics, content)) + '.',
			chart: null,
			record: null,
			chips: [],
			details: []
		});
	}
	for (const event of entry.events) {
		if (event.outcome !== 'applied') continue;
		const { chips, details } = effectChips(event, state, content);
		items.push({
			key: `event:${event.instanceId}`,
			kind: 'event',
			tone: 'neutral',
			title: 'Événement',
			text: `${eventTitle(event.eventId, event.actors, state, content)}.`,
			chart: null,
			record: null,
			chips,
			details
		});
	}
	return items;
}

export function buildQuarterNote(
	state: GameState,
	content: Content,
	adjustments: readonly PlanAdjustment[]
): QuarterNoteView | null {
	const quarters = state.history.filter(
		(entry): entry is HistoryEntry => entry.type === 'turn.resolved'
	);
	const entry = quarters.at(-1);
	if (!entry) return null;
	const previous = quarters.at(-2)?.snapshot ?? null;
	const now = entry.snapshot;
	const variations = NOTE_VARIATIONS.map(({ key, identity, label, good }): NoteVariationView => {
		const resource = RESOURCE_IDS.find((id) => id === key) ?? null;
		const value = resource ? formatResource(resource, now[key]) : String(now[key]);
		if (!previous) return { identity, label, change: null, value, sense: 'neutral' };
		const change = now[key] - previous[key];
		return {
			identity,
			label,
			change: formatCompactRange(resource, change, change),
			value,
			sense: senseOf(change * good)
		};
	});
	const highlights = noteHighlights(entry, state, content);
	const journalLines = journalOfQuarter(entry, state, content).filter(
		(line) => line.kind !== 'step' && line.text !== 'Trimestre calme : rien à signaler.'
	).length;
	const shown = highlights.slice(0, MAX_HIGHLIGHTS_IN_NOTE);
	return {
		key: `t${entry.turn}`,
		dateLabel: formatTurn(entry.turn + 1),
		endedLabel: formatTurn(entry.turn),
		first: previous === null,
		variations,
		highlights: shown,
		journalLines: Math.max(0, journalLines - shown.length),
		adjustments: adjustments.find((adjustment) => adjustment.turn === state.turn)?.lines ?? []
	};
}

/** Choix proposés à la création d'un personnage (P2-08). */
/** Résumé groupé d'une série de trimestres simulés (DESIGN.md §5, P2-09). */
export interface SpanSummaryView {
	/** « du T1 2003 au T4 2005 ». */
	readonly period: string;
	readonly turns: number;
	/** Variations nettes : ressources, santé, stress, popularité. */
	readonly changes: readonly { readonly name: string; readonly text: string }[];
	/** Faits marquants : carrière, entourage, famille, décisions, fin. */
	readonly highlights: readonly string[];
	/** Faits marquants non affichés faute de place. */
	readonly moreHighlights: number;
	readonly events: number;
	readonly decisions: number;
	/** Journal détaillé de la période, du plus récent au plus ancien. */
	readonly quarters: readonly JournalTurnView[];
}

const HIGHLIGHT_KINDS: ReadonlySet<JournalLine['kind']> = new Set([
	'career',
	'people',
	'decision',
	'end'
]);
const MAX_HIGHLIGHTS = 8;

/**
 * Résume la période écoulée entre deux états d'une même partie (`to` dérive de
 * `from` par des transitions : le journal est un ajout pur). Aucune donnée
 * cachée : seulement ce que le journal et le tableau de bord montrent déjà.
 */
export function summarizeSpan(from: GameState, to: GameState, content: Content): SpanSummaryView {
	const entries = to.history.slice(from.history.length);
	const quarterEntries = entries.filter(
		(entry): entry is HistoryEntry => entry.type === 'turn.resolved'
	);
	const turns = quarterEntries.length;
	const lastTurn = quarterEntries.at(-1)?.turn ?? from.turn;
	const lines = entries.flatMap((entry) =>
		entry.type === 'turn.resolved'
			? journalOfQuarter(entry, to, content)
			: journalOfChoice(entry, to, content)
	);
	const highlights = lines
		.filter((line) => HIGHLIGHT_KINDS.has(line.kind))
		.map((line) => line.text);
	const gauge = (name: string, before: number, after: number) => ({
		name,
		text: formatGaugeDelta(after - before)
	});
	return {
		period:
			turns <= 1
				? `au ${formatTurn(from.turn)}`
				: `du ${formatTurn(from.turn)} au ${formatTurn(lastTurn)}`,
		turns,
		changes: [
			...RESOURCE_IDS.map((id) => ({
				name: RESOURCE_NAMES[id],
				text: formatDelta(id, to.resources[id] - from.resources[id])
			})),
			gauge('Santé', from.player.health, to.player.health),
			gauge('Stress', from.player.stress, to.player.stress),
			gauge('Popularité', from.player.popularity, to.player.popularity)
		],
		highlights: highlights.slice(0, MAX_HIGHLIGHTS),
		moreHighlights: Math.max(0, highlights.length - MAX_HIGHLIGHTS),
		events: quarterEntries.reduce(
			(sum, entry) => sum + entry.events.filter((event) => event.outcome !== 'cancelled').length,
			0
		),
		decisions: entries.filter((entry) => entry.type === 'event.resolved').length,
		quarters: buildJournal(to, content).filter((quarter) =>
			quarterEntries.some((entry) => quarter.key === `t${entry.turn}`)
		)
	};
}
