/**
 * Projection publique de la partie (`PlayerView`, ARCHITECTURE.md §9).
 *
 * Seule source de données de l'interface. Elle ne contient que ce que le joueur
 * peut savoir : valeurs courantes, coûts et effets certains, fourchettes,
 * tendances rédigées, statut des producteurs. Jamais le PRNG, les probabilités,
 * les effets des choix d'événements ni leurs suites. Fonction pure : la calculer
 * n'avance pas le PRNG et ne modifie rien.
 */
import {
	INDICATOR_IDS,
	RESOURCE_IDS,
	type Content,
	type ResourceAmount,
	type ResourceId
} from '../content/types.ts';
import {
	ageAt,
	careerSummary,
	describePendingEvent,
	effectRange,
	formatTurn,
	previewPlan,
	renderTemplate,
	type ChoiceRecord,
	type EffectRange,
	type GameState,
	type HistoryEntry,
	type PeopleChange,
	type PlanStep,
	type CharactersRecord,
	displayName,
	type PoliticalChange,
	type Ballot,
	type DeadlinesRecord,
	type MandateEndReason,
	activeMandates,
	mainMandate,
	reservedTime,
	type WellbeingSource,
	type WorldRecord
} from '../engine/index.ts';
import {
	GAUGE_NAMES,
	INDICATOR_NAMES,
	RESOURCE_NAMES,
	describeAxisPosition,
	describePopularity,
	describeSupport,
	describeHealth,
	describeIndicator,
	describeStress,
	formatDelta,
	formatGaugeDelta,
	formatRange,
	formatResource,
	type GaugeDescription
} from './format.ts';

export interface ResourceView {
	readonly id: ResourceId;
	readonly name: string;
	readonly value: string;
	/** Variation prévue sur le trimestre (plan, charges et production). */
	readonly forecast: string;
}

export interface PlanStepView {
	readonly index: number;
	readonly kind: PlanStep['kind'];
	readonly label: string;
	readonly timeCost: number;
	readonly details: readonly string[];
	readonly issues: readonly string[];
	/** Achat : rappel que la production commence au trimestre suivant. */
	readonly note: string | null;
}

export interface PlanView {
	readonly steps: readonly PlanStepView[];
	readonly timeAvailable: number;
	/** Temps réservé par les mandats, déjà retiré du temps disponible. */
	readonly timeReserved: number;
	readonly timeUsed: number;
	readonly timeRemaining: number;
	readonly valid: boolean;
	readonly issues: readonly string[];
	readonly warnings: readonly string[];
	readonly changes: readonly { readonly name: string; readonly text: string }[];
	readonly stressAfter: GaugeDescription;
	readonly healthAfter: { readonly min: number; readonly max: number };
}

export interface CatalogItemView {
	readonly kind: PlanStep['kind'];
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly timeCost: number;
	readonly costs: readonly string[];
	readonly effects: readonly string[];
	/** Occurrences déjà dans le plan. */
	readonly planned: number;
	readonly addable: boolean;
	/** Raison pour laquelle l'élément ne peut pas être ajouté au plan. */
	readonly reason: string | null;
}

export interface UpgradeView extends CatalogItemView {
	readonly family: string;
	readonly treasury: string;
	readonly upkeep: readonly string[];
	readonly owned: number;
	readonly maxOwned: number;
}

export interface ProducerView {
	readonly instanceId: string;
	readonly label: string;
	readonly status: 'active' | 'suspended' | 'pending';
	readonly statusLabel: string;
	readonly upkeep: readonly string[];
	readonly production: readonly string[];
}

export interface ChoiceView {
	readonly id: string;
	readonly label: string;
	readonly hints: readonly string[];
	readonly costs: readonly string[];
	readonly available: boolean;
	readonly reason: string | null;
}

export interface DecisionView {
	readonly instanceId: string;
	readonly title: string;
	readonly text: string;
	readonly category: string;
	readonly choices: readonly ChoiceView[];
	readonly remaining: number;
}

export interface JournalLine {
	readonly kind:
		'step' | 'economy' | 'wellbeing' | 'world' | 'people' | 'career' | 'event' | 'decision' | 'end';
	readonly text: string;
}

export interface JournalTurnView {
	readonly key: string;
	readonly label: string;
	readonly lines: readonly JournalLine[];
}

export interface Alert {
	readonly level: 'danger' | 'warning' | 'info';
	readonly text: string;
}

export interface SummaryView {
	readonly title: string;
	readonly cause: string;
	readonly lines: readonly { readonly label: string; readonly value: string }[];
}

export interface IndicatorView {
	readonly id: string;
	readonly name: string;
	readonly gauge: GaugeDescription;
}

export interface PartyView {
	readonly id: string;
	readonly name: string;
	readonly acronym: string;
	readonly family: string;
	readonly description: string;
	/** Intentions de vote : part de la force du parti dans le total, en %. */
	readonly share: number;
	readonly leader: string;
	readonly positions: readonly string[];
	readonly governing: boolean;
	readonly member: boolean;
	/** Adhésion déjà prévue dans le plan. */
	readonly joinPlanned: boolean;
	readonly joinable: boolean;
	readonly joinReason: string | null;
}

export interface WorldView {
	readonly indicators: readonly IndicatorView[];
	/** Partis par intentions de vote décroissantes. */
	readonly parties: readonly PartyView[];
	readonly governingParty: string;
	/** Situation du joueur : « Sans étiquette » ou « Membre du … depuis … ». */
	readonly affiliation: string;
	readonly partyAcronym: string | null;
	/** Action de départ du parti, si le joueur est encarté. */
	readonly leave: {
		readonly actionId: string;
		readonly planned: boolean;
		readonly addable: boolean;
		readonly reason: string | null;
	} | null;
	/** Action d'adhésion (ciblée) du catalogue, si elle existe. */
	readonly joinActionId: string | null;
	readonly joinTimeCost: number;
	readonly joinCosts: readonly string[];
}

export interface PersonView {
	readonly id: string;
	readonly name: string;
	/** Rôle principal, d'après les étiquettes. */
	readonly role: string;
	readonly age: number;
	readonly status: string;
	readonly active: boolean;
	/** Tendance de l'attitude envers le joueur (jamais le chiffre). */
	readonly attitude: string;
	readonly attitudeTone: 'good' | 'neutral' | 'warning' | 'danger';
	readonly knownTraits: readonly { readonly label: string; readonly description: string }[];
	/** Traits encore inconnus du joueur (leur nombre seul est visible). */
	readonly unknownTraits: number;
	readonly metLabel: string;
	/** Souvenirs, du plus récent au plus ancien. */
	readonly memories: readonly { readonly dateLabel: string; readonly text: string }[];
}

export interface MandateView {
	readonly instanceId: string;
	readonly label: string;
	readonly since: string;
	/** Échéance du mandat, en clair. */
	readonly ends: string;
	readonly timePerTurn: number;
	readonly income: readonly string[];
	readonly stressPerTurn: number;
	readonly resignPlanned: boolean;
	readonly resignable: boolean;
	readonly resignReason: string | null;
}

export interface BallotView {
	readonly ballotId: string;
	readonly label: string;
	readonly dateLabel: string;
	readonly turnsLeft: number;
	readonly filing: string;
	readonly early: boolean;
	/** Le joueur exerce un mandat qui prend fin à ce scrutin. */
	readonly endsMandate: boolean;
}

export interface CareerView {
	/** Fonction principale (mandat de rang le plus élevé) ou « Sans mandat ». */
	readonly mainFunction: string;
	readonly mandates: readonly MandateView[];
	readonly reservedTime: number;
	readonly resignActionId: string | null;
	readonly maxMandates: number;
	readonly incompatibilities: readonly string[];
	readonly prerequisites: readonly string[];
	readonly calendar: readonly BallotView[];
	readonly results: readonly {
		readonly ballotId: string;
		readonly label: string;
		readonly dateLabel: string;
		readonly winner: string;
		readonly shares: string;
		readonly early: boolean;
	}[];
	readonly pastMandates: readonly { readonly label: string; readonly period: string }[];
}

export interface SupportGroupView {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly gauge: GaugeDescription;
	/** Part du groupe dans la popularité, en % (groupes électoraux). */
	readonly share: number | null;
}

export interface SupportsView {
	readonly popularity: GaugeDescription;
	readonly electoral: readonly SupportGroupView[];
	readonly influence: readonly SupportGroupView[];
}

export interface PlayerView {
	readonly dateLabel: string;
	readonly age: number;
	readonly phase: GameState['phase'];
	readonly resources: readonly ResourceView[];
	readonly health: GaugeDescription;
	readonly stress: GaugeDescription;
	readonly plan: PlanView;
	readonly actions: readonly CatalogItemView[];
	readonly upgrades: readonly UpgradeView[];
	readonly producers: readonly ProducerView[];
	readonly decision: DecisionView | null;
	readonly journal: readonly JournalTurnView[];
	readonly press: readonly {
		readonly key: string;
		readonly dateLabel: string;
		readonly title: string;
	}[];
	readonly alerts: readonly Alert[];
	readonly summary: SummaryView | null;
	readonly world: WorldView;
	/** Personnages rencontrés : actifs d'abord, puis par date de rencontre. */
	readonly people: readonly PersonView[];
	readonly career: CareerView;
	readonly supports: SupportsView;
}

const FAMILY_LABELS: Readonly<Record<string, string>> = {
	organization: 'Organisation',
	communication: 'Communication',
	network: 'Réseau',
	personal: 'Vie personnelle'
};

const SOURCE_LABELS: { readonly [K in WellbeingSource]: string } = {
	workload: 'charge de travail',
	recovery: 'récupération',
	high_stress: 'stress élevé',
	calm: 'calme retrouvé',
	ageing: 'âge'
};

const CAUSE_LABELS = {
	health_failure: 'Épuisement : la santé a fini par céder.',
	natural_causes: 'Mort naturelle.'
} as const;

function amounts(list: readonly ResourceAmount[], sign: 1 | -1): string[] {
	return list.map(
		(amount) =>
			`${RESOURCE_NAMES[amount.resource]} ${formatDelta(amount.resource, sign * amount.amount)}`
	);
}

const PARTY_REFERENCE_LABELS: Readonly<Record<string, string>> = {
	governing: 'parti au gouvernement',
	player: 'votre parti',
	opposition: 'premier parti d’opposition',
	target: 'parti choisi'
};

function partyLabel(party: string | null, content: Content): string {
	if (party === null) return 'votre parti';
	return content.parties[party]?.name ?? PARTY_REFERENCE_LABELS[party] ?? party;
}

function describeEffect(range: EffectRange, content: Content): string {
	switch (range.kind) {
		case 'resource':
			return `${RESOURCE_NAMES[range.resource]} ${formatRange(range.resource, range.min, range.max)}`;
		case 'gauge':
			return `${GAUGE_NAMES[range.gauge]} ${formatGaugeDelta(range.min)}`;
		case 'indicator':
			return `${INDICATOR_NAMES[range.indicator]} ${formatGaugeDelta(range.value)}`;
		case 'support':
			return `Soutien : ${content.supportGroups[range.group]?.label ?? range.group} ${formatGaugeDelta(range.value)}`;
		case 'partyStrength':
			return `Intentions de vote (${partyLabel(range.party, content)}) ${formatGaugeDelta(range.value)}`;
		case 'affiliation':
			return range.change === 'join'
				? `Adhésion : ${partyLabel(range.party, content)}`
				: 'Départ de votre parti';
		case 'people':
			return 'Relation avec un personnage';
		case 'mandate':
			return range.change === 'grant'
				? `Mandat : ${content.mandates[range.mandate]?.label ?? range.mandate}`
				: range.mandate === 'target'
					? 'Fin du mandat choisi'
					: `Fin du mandat : ${content.mandates[range.mandate]?.label ?? range.mandate}`;
		case 'earlyElection':
			return `Élection anticipée : ${content.elections[range.election]?.label ?? range.election}`;
	}
}

function politicsText(changes: readonly PoliticalChange[], content: Content): string {
	return changes
		.map((change) => {
			switch (change.kind) {
				case 'indicator':
					return `${INDICATOR_NAMES[change.indicator]} ${formatGaugeDelta(change.delta)}`;
				case 'partyStrength':
					return `${content.parties[change.partyId]?.acronym ?? change.partyId} ${formatGaugeDelta(change.delta)}`;
				case 'joined':
					return `adhésion au ${content.parties[change.partyId]?.name ?? change.partyId}`;
				case 'left':
					return `départ du ${content.parties[change.partyId]?.name ?? change.partyId}`;
				case 'support':
					return `${content.supportGroups[change.groupId]?.label ?? change.groupId} ${formatGaugeDelta(change.delta)}`;
				case 'mandateStarted':
					return `entrée en fonction : ${content.mandates[change.mandateId]?.label ?? change.mandateId}`;
				case 'mandateEnded':
					return `fin de mandat (${MANDATE_END_LABELS[change.reason]}) : ${content.mandates[change.mandateId]?.label ?? change.mandateId}`;
				case 'earlyElection':
					return `${content.elections[change.electionId]?.label ?? change.electionId} anticipées au ${formatTurn(change.turn)}`;
			}
		})
		.join(', ');
}

const MANDATE_END_LABELS: { readonly [K in MandateEndReason]: string } = {
	term: 'fin du terme',
	resigned: 'démission',
	government_change: 'changement de gouvernement',
	replaced: 'remplacé par une fonction incompatible',
	removed: 'retrait'
};

/** Résultat d'un scrutin en une ligne : trois premières parts. */
function sharesText(ballot: Ballot, content: Content): string {
	return (ballot.shares ?? [])
		.slice(0, 3)
		.map(
			(share) => `${content.parties[share.partyId]?.acronym ?? share.partyId} ${share.percent} %`
		)
		.join(' · ');
}

function deadlineLines(
	record: DeadlinesRecord | null,
	state: GameState,
	content: Content
): JournalLine[] {
	if (!record) return [];
	const lines: JournalLine[] = [];
	const ended = politicsText(record.mandates, content);
	if (ended)
		lines.push({ kind: 'career', text: ended.charAt(0).toUpperCase() + ended.slice(1) + '.' });
	for (const result of record.ballots) {
		const ballot = state.ballots.find((entry) => entry.ballotId === result.ballotId);
		const label = content.elections[result.electionId]?.label ?? result.electionId;
		const winner = content.parties[result.winnerPartyId]?.name ?? result.winnerPartyId;
		const alternance =
			result.governingAfter !== result.governingBefore
				? ` Alternance : le ${content.parties[result.governingAfter]?.name ?? result.governingAfter} forme le gouvernement.`
				: '';
		lines.push({
			kind: 'career',
			text: `${label} : le ${winner} arrive en tête${ballot ? ` (${sharesText(ballot, content)})` : ''}.${alternance}`
		});
	}
	return lines;
}

/** Départs et successions des personnages déjà rencontrés (les dirigeants : voir le monde). */
function characterLines(record: CharactersRecord | null, state: GameState): JournalLine[] {
	if (!record) return [];
	const known = (id: string): boolean => Object.hasOwn(state.relationships, id);
	return record.departures.flatMap((departure) => {
		const character = state.characters[departure.characterId];
		if (!character || !known(character.id)) return [];
		const successor = record.arrivals.find((arrival) => arrival.successorOf === character.id);
		const successorName = successor ? state.characters[successor.characterId] : undefined;
		const what = departure.reason === 'death' ? 'Décès de' : 'Départ à la retraite de';
		return [
			{
				kind: 'people' as const,
				text: `${what} ${displayName(character)}.${successorName ? ` Relève : ${displayName(successorName)}.` : ''}`
			}
		];
	});
}

function peopleText(changes: readonly PeopleChange[], state: GameState, content: Content): string {
	return changes
		.flatMap((change) => {
			const character = state.characters[change.characterId];
			if (!character) return [];
			if (change.kind === 'revealed') {
				const trait = content.traits[change.traitId]?.label ?? change.traitId;
				return [`vous découvrez chez ${displayName(character)} : ${trait}`];
			}
			return [];
		})
		.join(', ');
}

function worldLines(record: WorldRecord | null, state: GameState, content: Content): JournalLine[] {
	if (!record) return [];
	return record.leaderChanges.map((change) => {
		const party = content.parties[change.partyId]?.name ?? change.partyId;
		const previous = state.characters[change.previousLeaderId]?.name ?? change.previousLeaderId;
		const leader = state.characters[change.leaderId]?.name ?? change.leaderId;
		const why =
			change.reason === 'retirement'
				? 'part à la retraite'
				: change.reason === 'death'
					? 'décède'
					: 'perd un vote interne';
		return {
			kind: 'world',
			text: `${party} : ${previous} ${why} ; ${leader} prend la tête du parti.`
		};
	});
}

function changesText(changes: readonly { resource: ResourceId; delta: number }[]): string {
	return changes
		.map(
			(change) => `${RESOURCE_NAMES[change.resource]} ${formatDelta(change.resource, change.delta)}`
		)
		.join(', ');
}

function gaugesText(gauges: readonly { gauge: keyof typeof GAUGE_NAMES; delta: number }[]): string {
	return gauges
		.map((change) => `${GAUGE_NAMES[change.gauge]} ${formatGaugeDelta(change.delta)}`)
		.join(', ');
}

function joinParts(...parts: string[]): string {
	return parts.filter((part) => part.length > 0).join(' ; ');
}

/** Disponibilité d'une étape supplémentaire, évaluée par la prévision du moteur. */
function addability(state: GameState, plan: readonly PlanStep[], step: PlanStep, content: Content) {
	if (state.phase !== 'planning')
		return { addable: false, reason: 'Aucune planification possible pour le moment.' };
	const preview = previewPlan(state, { steps: [...plan, step] }, content);
	const last = preview.steps.at(-1);
	const issue = last?.issues[0];
	return issue ? { addable: false, reason: issue.message } : { addable: true, reason: null };
}

function eventTitle(
	eventId: string,
	actors: Readonly<Record<string, string>>,
	state: GameState,
	content: Content
): string {
	const definition = content.events[eventId];
	return definition ? renderTemplate(definition.title, actors, content, state.characters) : eventId;
}

function journalOfQuarter(entry: HistoryEntry, state: GameState, content: Content): JournalLine[] {
	const lines: JournalLine[] = [];
	for (const step of entry.steps) {
		const target = step.target ? ` : ${content.parties[step.target]?.name ?? step.target}` : '';
		const label =
			step.kind === 'action'
				? `${content.actions[step.id]?.label ?? step.id}${target}`
				: `Achat : ${content.upgrades[step.id]?.label ?? step.id}`;
		const effects = joinParts(
			changesText(step.changes),
			gaugesText(step.gauges),
			politicsText(step.politics, content)
		);
		lines.push({ kind: 'step', text: effects ? `${label} — ${effects}` : label });
	}
	for (const producer of entry.economy.producers) {
		const label = content.upgrades[producer.upgradeId]?.label ?? producer.upgradeId;
		lines.push({
			kind: 'economy',
			text:
				producer.status === 'suspended'
					? `${label} : charges impayées, production suspendue`
					: `${label} — ${changesText(producer.changes) || 'aucune variation'}`
		});
	}
	const byGauge = new Map<string, string[]>();
	for (const contribution of entry.wellbeing.contributions) {
		const name = GAUGE_NAMES[contribution.gauge];
		const list = byGauge.get(name) ?? [];
		list.push(`${formatGaugeDelta(contribution.delta)} (${SOURCE_LABELS[contribution.source]})`);
		byGauge.set(name, list);
	}
	for (const [name, parts] of byGauge)
		lines.push({ kind: 'wellbeing', text: `${name} ${parts.join(', ')}` });
	lines.push(...characterLines(entry.characters, state));
	lines.push(...worldLines(entry.world, state, content));
	lines.push(...deadlineLines(entry.deadlines, state, content));
	if (entry.mandates.changes.length > 0) {
		lines.push({
			kind: 'career',
			text: `Indemnités et moyens des mandats — ${changesText(entry.mandates.changes)}`
		});
	}
	for (const event of entry.events) {
		const title = eventTitle(event.eventId, event.actors, state, content);
		if (event.outcome === 'queued')
			lines.push({ kind: 'event', text: `${title} — décision attendue` });
		else if (event.outcome === 'applied') {
			const effects = joinParts(
				changesText(event.changes),
				gaugesText(event.gauges),
				politicsText(event.politics, content),
				peopleText(event.people, state, content)
			);
			lines.push({ kind: 'event', text: effects ? `${title} — ${effects}` : title });
		} else
			lines.push({ kind: 'event', text: `${title} — sans suite : ${event.reason ?? 'annulé'}` });
	}
	if (entry.wellbeing.deathCause) lines.push({ kind: 'end', text: 'Fin de carrière.' });
	if (lines.length === 0) lines.push({ kind: 'step', text: 'Trimestre calme : rien à signaler.' });
	return lines;
}

function journalOfChoice(entry: ChoiceRecord, state: GameState, content: Content): JournalLine[] {
	const definition = content.events[entry.eventId];
	const quarter = state.history.find(
		(candidate): candidate is HistoryEntry =>
			candidate.type === 'turn.resolved' &&
			candidate.events.some((event) => event.instanceId === entry.instanceId)
	);
	const actors =
		quarter?.events.find((event) => event.instanceId === entry.instanceId)?.actors ?? {};
	const render = (text: string): string => renderTemplate(text, actors, content, state.characters);
	const title = definition ? render(definition.title) : entry.eventId;
	const choice =
		definition?.blocking === true
			? definition.choices.find((candidate) => candidate.id === entry.choiceId)
			: undefined;
	const label = choice ? render(choice.label) : entry.choiceId;
	const effects = joinParts(
		changesText(entry.changes),
		gaugesText(entry.gauges),
		politicsText(entry.politics, content),
		peopleText(entry.people, state, content)
	);
	const lines: JournalLine[] = [
		{
			kind: 'decision',
			text: `Décision — ${title} : « ${label} »${effects ? ` (${effects})` : ''}`
		}
	];
	if (entry.deathCause) lines.push({ kind: 'end', text: 'Fin de carrière.' });
	return lines;
}

function buildJournal(state: GameState, content: Content): JournalTurnView[] {
	const groups = new Map<number, JournalLine[]>();
	const add = (turn: number, lines: JournalLine[]): void => {
		groups.set(turn, [...(groups.get(turn) ?? []), ...lines]);
	};
	for (const entry of state.history) {
		if (entry.type === 'turn.resolved') add(entry.turn, journalOfQuarter(entry, state, content));
		else add(entry.turn, journalOfChoice(entry, state, content));
	}
	return [...groups.entries()]
		.sort(([a], [b]) => b - a)
		.map(([turn, lines]) => ({ key: `t${turn}`, label: formatTurn(turn), lines }));
}

function buildPress(state: GameState, content: Content): PlayerView['press'] {
	const items: { key: string; dateLabel: string; title: string }[] = [];
	for (const entry of state.history) {
		if (entry.type !== 'turn.resolved') continue;
		for (const event of entry.events) {
			if (event.outcome === 'cancelled' || !event.instanceId) continue;
			items.push({
				key: event.instanceId,
				dateLabel: formatTurn(entry.turn + 1),
				title: eventTitle(event.eventId, event.actors, state, content)
			});
		}
	}
	return items.reverse().slice(0, 6);
}

function buildSummary(state: GameState, content: Content): SummaryView | null {
	if (!state.end) return null;
	const summary = careerSummary(state);
	const born = formatTurn(state.player.birthTurn);
	return {
		title: `Fin de carrière à ${summary.age} ans`,
		cause: CAUSE_LABELS[state.end.cause],
		lines: [
			{ label: 'Né au', value: born },
			{ label: 'Décédé au', value: formatTurn(summary.lastTurn) },
			{ label: 'Âge', value: `${summary.age} ans` },
			{ label: 'Trimestres de carrière', value: String(summary.quartersPlayed) },
			...RESOURCE_IDS.map((id) => ({
				label: RESOURCE_NAMES[id],
				value: formatResource(id, summary.resources[id])
			})),
			{ label: 'Actions menées', value: String(summary.actionsPerformed) },
			{ label: 'Améliorations acquises', value: String(summary.upgradesOwned) },
			{ label: 'Événements vécus', value: String(summary.eventsExperienced) },
			{
				label: 'Catalogue',
				value: `${content.eventIds.length} événements possibles`
			}
		]
	};
}

function buildWorld(state: GameState, plan: readonly PlanStep[], content: Content): WorldView {
	const { world, player } = state;
	const total = content.partyIds.reduce(
		(sum, partyId) => sum + (world.parties[partyId]?.strength ?? 0),
		0
	);
	const joinActionId =
		content.actionIds.find((id) => content.actions[id]?.target === 'party') ?? null;
	const joinAction = joinActionId ? content.actions[joinActionId] : undefined;
	const leaveActionId =
		content.actionIds.find((id) =>
			content.actions[id]?.effects.some((effect) => effect.op === 'leaveParty')
		) ?? null;

	const parties: PartyView[] = content.partyIds.map((partyId) => {
		const definition = content.parties[partyId]!;
		const party = world.parties[partyId];
		const joinPlanned = plan.some(
			(step) => step.kind === 'action' && step.id === joinActionId && step.target === partyId
		);
		const join = joinActionId
			? addability(state, plan, { kind: 'action', id: joinActionId, target: partyId }, content)
			: { addable: false, reason: 'Aucune adhésion possible.' };
		return {
			id: partyId,
			name: definition.name,
			acronym: definition.acronym,
			family: definition.family,
			description: definition.description,
			share: total > 0 ? Math.round(((party?.strength ?? 0) * 100) / total) : 0,
			leader: state.characters[party?.leaderId ?? '']?.name ?? '—',
			positions: content.world.axes.map(
				(axis) =>
					`${axis.label} : ${describeAxisPosition(definition.positions[axis.id], axis.negativeLabel, axis.positiveLabel)}`
			),
			governing: partyId === world.governingPartyId,
			member: player.partyId === partyId,
			joinPlanned,
			joinable: join.addable,
			joinReason: join.reason
		};
	});
	parties.sort(
		(a, b) =>
			(world.parties[b.id]?.strength ?? 0) - (world.parties[a.id]?.strength ?? 0) ||
			content.partyIds.indexOf(a.id) - content.partyIds.indexOf(b.id)
	);

	const current = player.affiliations.at(-1);
	const memberParty = player.partyId ? content.parties[player.partyId] : undefined;
	const leave =
		player.partyId && leaveActionId
			? {
					actionId: leaveActionId,
					planned: plan.some((step) => step.kind === 'action' && step.id === leaveActionId),
					...(() => {
						const result = addability(state, plan, { kind: 'action', id: leaveActionId }, content);
						return { addable: result.addable, reason: result.reason };
					})()
				}
			: null;
	return {
		indicators: INDICATOR_IDS.map((id) => ({
			id,
			name: INDICATOR_NAMES[id],
			gauge: describeIndicator(id, world.indicators[id])
		})),
		parties,
		governingParty: content.parties[world.governingPartyId]?.name ?? world.governingPartyId,
		affiliation:
			memberParty && current
				? `Membre du ${memberParty.name} depuis le ${formatTurn(current.fromTurn)}`
				: 'Sans étiquette',
		partyAcronym: memberParty?.acronym ?? null,
		leave,
		joinActionId,
		joinTimeCost: joinAction?.timeCost ?? 0,
		joinCosts: joinAction ? amounts(joinAction.costs, -1) : []
	};
}

const ROLE_LABELS: Readonly<Record<string, string>> = {
	medical: 'Santé',
	journalist: 'Presse',
	family: 'Famille',
	friend: 'Amitiés',
	business: 'Affaires',
	donor: 'Affaires',
	politician: 'Vie politique locale',
	rival: 'Vie politique locale',
	party_official: 'Parti',
	party_leader: 'Direction de parti',
	volunteer: 'Militants'
};

function describeAttitude(attitude: number): Pick<PersonView, 'attitude' | 'attitudeTone'> {
	if (attitude >= 40) return { attitude: 'Très favorable', attitudeTone: 'good' };
	if (attitude >= 10) return { attitude: 'Favorable', attitudeTone: 'good' };
	if (attitude > -10) return { attitude: 'Neutre', attitudeTone: 'neutral' };
	if (attitude > -40) return { attitude: 'Réservée', attitudeTone: 'warning' };
	return { attitude: 'Hostile', attitudeTone: 'danger' };
}

function buildPeople(state: GameState, content: Content): PersonView[] {
	const now = state.end ? state.end.turn : state.turn;
	const people = Object.entries(state.relationships).flatMap(([id, relationship]) => {
		const character = state.characters[id];
		if (!character) return [];
		const lastTurn = character.leftTurn ?? now;
		return [
			{
				metTurn: relationship.metTurn,
				view: {
					id,
					name: displayName(character),
					role: ROLE_LABELS[character.tags[0] ?? ''] ?? 'Connaissance',
					age: ageAt(character.birthTurn, lastTurn),
					status:
						character.status === 'active'
							? 'En activité'
							: character.status === 'retired'
								? `À la retraite depuis le ${formatTurn(lastTurn)}`
								: `Décès au ${formatTurn(lastTurn)}`,
					active: character.status === 'active',
					...describeAttitude(relationship.attitude),
					knownTraits: character.knownTraits.map((traitId) => ({
						label: content.traits[traitId]?.label ?? traitId,
						description: content.traits[traitId]?.description ?? ''
					})),
					unknownTraits: character.traits.length - character.knownTraits.length,
					metLabel: `Rencontre au ${formatTurn(relationship.metTurn)}`,
					memories: [...relationship.memories].reverse().map((memory) => ({
						dateLabel: formatTurn(memory.turn),
						text: memory.text
					}))
				} satisfies PersonView
			}
		];
	});
	return people
		.sort(
			(a, b) =>
				Number(b.view.active) - Number(a.view.active) ||
				a.metTurn - b.metTurn ||
				a.view.id.localeCompare(b.view.id)
		)
		.map((entry) => entry.view);
}

function buildCareer(state: GameState, plan: readonly PlanStep[], content: Content): CareerView {
	const label = (mandateId: string): string => content.mandates[mandateId]?.label ?? mandateId;
	const resignActionId =
		content.actionIds.find((id) => content.actions[id]?.target === 'mandate') ?? null;
	const scheduled = state.ballots
		.filter((ballot) => ballot.status === 'scheduled')
		.sort((a, b) => a.turn - b.turn);
	const active = activeMandates(state.mandates);
	const main = mainMandate(state.mandates, content);
	return {
		mainFunction: main ? label(main.mandateId) : 'Sans mandat',
		mandates: active.map((mandate) => {
			const definition = content.mandates[mandate.mandateId];
			const election = definition?.election ? content.elections[definition.election] : undefined;
			const next = definition?.election
				? scheduled.find((ballot) => ballot.electionId === definition.election)
				: undefined;
			const resign = resignActionId
				? addability(
						state,
						plan,
						{ kind: 'action', id: resignActionId, target: mandate.instanceId },
						content
					)
				: { addable: false, reason: null };
			return {
				instanceId: mandate.instanceId,
				label: label(mandate.mandateId),
				since: formatTurn(mandate.startTurn),
				ends:
					election && next
						? `Terme : ${election.label.toLowerCase()} du ${formatTurn(next.turn)}`
						: 'Prend fin avec le gouvernement',
				timePerTurn: definition?.timePerTurn ?? 0,
				income: amounts(definition?.income ?? [], 1),
				stressPerTurn: definition?.stressPerTurn ?? 0,
				resignPlanned: plan.some(
					(step) =>
						step.kind === 'action' &&
						step.id === resignActionId &&
						step.target === mandate.instanceId
				),
				resignable: resign.addable,
				resignReason: resign.reason
			};
		}),
		reservedTime: reservedTime(state.mandates, content),
		resignActionId,
		maxMandates: state.institutions.maxMandates,
		incompatibilities: state.institutions.incompatibilities.map(
			([left, right]) => `${label(left)} et ${label(right)}`
		),
		prerequisites: Object.entries(state.institutions.prerequisites).map(
			([mandateId, required]) => `${label(mandateId)} : ${required.map(label).join(', ')}`
		),
		calendar: scheduled.map((ballot) => {
			const definition = content.elections[ballot.electionId];
			return {
				ballotId: ballot.ballotId,
				label: definition?.label ?? ballot.electionId,
				dateLabel: formatTurn(ballot.turn),
				turnsLeft: ballot.turn - state.turn,
				filing: `Candidatures closes au ${formatTurn(ballot.filingClosesTurn)}`,
				early: ballot.early,
				endsMandate: active.some(
					(mandate) => content.mandates[mandate.mandateId]?.election === ballot.electionId
				)
			};
		}),
		results: state.ballots
			.filter((ballot) => ballot.status === 'held')
			.slice(-6)
			.reverse()
			.map((ballot) => ({
				ballotId: ballot.ballotId,
				label: content.elections[ballot.electionId]?.label ?? ballot.electionId,
				dateLabel: formatTurn(ballot.turn),
				winner: content.parties[ballot.winnerPartyId ?? '']?.name ?? '—',
				shares: sharesText(ballot, content),
				early: ballot.early
			})),
		pastMandates: state.mandates
			.filter((mandate) => mandate.status === 'ended')
			.map((mandate) => ({
				label: label(mandate.mandateId),
				period: `${formatTurn(mandate.startTurn)} – ${formatTurn(mandate.endTurn ?? mandate.startTurn)} (${MANDATE_END_LABELS[mandate.endReason ?? 'term']})`
			}))
	};
}

function buildSupports(state: GameState, content: Content): SupportsView {
	const totalWeight = content.supportGroupIds.reduce(
		(total, id) => total + (content.supportGroups[id]?.weight ?? 0),
		0
	);
	const groups = content.supportGroupIds.flatMap((id) => {
		const group = content.supportGroups[id];
		if (!group) return [];
		return [
			{
				kind: group.kind,
				view: {
					id,
					label: group.label,
					description: group.description,
					gauge: describeSupport(state.player.supports[id] ?? 0),
					share:
						group.kind === 'electoral' && totalWeight > 0
							? Math.round((group.weight * 100) / totalWeight)
							: null
				}
			}
		];
	});
	return {
		popularity: describePopularity(state.player.popularity),
		electoral: groups.filter((group) => group.kind === 'electoral').map((group) => group.view),
		influence: groups.filter((group) => group.kind === 'influence').map((group) => group.view)
	};
}

export function projectView(
	state: GameState,
	plan: readonly PlanStep[],
	content: Content
): PlayerView {
	const preview = previewPlan(state, { steps: plan }, content);
	const steps: PlanStepView[] = preview.steps.map((step) => {
		const upgrade = step.kind === 'purchase' && step.id ? content.upgrades[step.id] : undefined;
		const target = step.target ? ` : ${content.parties[step.target]?.name ?? step.target}` : '';
		return {
			index: step.index,
			kind: step.kind ?? 'action',
			label: `${step.label ?? step.id ?? 'Étape inconnue'}${step.label ? target : ''}`,
			timeCost: step.timeCost,
			details: [
				...amounts(step.costs, -1),
				...step.effects.map((range) =>
					describeEffect(
						range.kind === 'affiliation' && range.party === 'target'
							? { ...range, party: step.target }
							: range,
						content
					)
				)
			],
			issues: step.issues.map((issue) => issue.message),
			note: upgrade ? 'Actif à partir du trimestre prochain.' : null
		};
	});

	const planned = (kind: PlanStep['kind'], id: string): number =>
		plan.filter((step) => step.kind === kind && step.id === id).length;

	// Les actions ciblées se planifient depuis les écrans Monde politique et Carrière.
	const actions: CatalogItemView[] = content.actionIds.flatMap((id) => {
		const action = content.actions[id]!;
		if (action.target) return [];
		return {
			kind: 'action',
			id,
			label: action.label,
			description: action.description,
			timeCost: action.timeCost,
			costs: amounts(action.costs, -1),
			effects: action.effects.map((effect) => describeEffect(effectRange(effect), content)),
			planned: planned('action', id),
			...addability(state, plan, { kind: 'action', id }, content)
		} satisfies CatalogItemView;
	});

	const upgrades: UpgradeView[] = content.upgradeIds.map((id) => {
		const upgrade = content.upgrades[id]!;
		return {
			kind: 'purchase',
			id,
			label: upgrade.label,
			description: upgrade.description,
			family: FAMILY_LABELS[upgrade.family] ?? upgrade.family,
			treasury: RESOURCE_NAMES[upgrade.treasury],
			timeCost: upgrade.timeCost,
			costs: amounts(upgrade.price, -1),
			upkeep: amounts(upgrade.upkeep, -1),
			effects: amounts(upgrade.production, 1),
			owned: state.upgrades.filter((owned) => owned.upgradeId === id).length,
			maxOwned: upgrade.maxOwned,
			planned: planned('purchase', id),
			...addability(state, plan, { kind: 'purchase', id }, content)
		};
	});

	const producers: ProducerView[] = preview.producers.map((producer) => ({
		instanceId: producer.instanceId,
		label: content.upgrades[producer.upgradeId]?.label ?? producer.upgradeId,
		status: producer.status,
		statusLabel:
			producer.status === 'active'
				? 'Actif ce trimestre'
				: producer.status === 'pending'
					? 'Actif à partir du trimestre prochain'
					: 'Suspendu : charges non couvertes',
		upkeep: amounts(producer.upkeep, -1),
		production: amounts(producer.production, 1)
	}));

	const pending = describePendingEvent(state, content);
	const decision: DecisionView | null = pending
		? {
				instanceId: pending.instanceId,
				title: pending.title,
				text: pending.text,
				category: pending.category,
				remaining: pending.remaining,
				choices: pending.choices.map((choice) => ({
					id: choice.id,
					label: choice.label,
					hints: choice.hints,
					costs: amounts(choice.costs, -1),
					available: choice.available,
					reason: choice.reason
				}))
			}
		: null;

	const health = describeHealth(state.player.health);
	const stress = describeStress(state.player.stress);
	const alerts: Alert[] = [];
	if (decision) alerts.push({ level: 'danger', text: `Décision attendue : ${decision.title}` });
	if (state.phase === 'planning') {
		for (const warning of preview.warnings)
			alerts.push({ level: 'warning', text: warning.message });
	}
	const lead = content.balance.elections.alertLeadTurns;
	for (const ballot of state.ballots) {
		const left = ballot.turn - state.turn;
		if (ballot.status !== 'scheduled' || left < 0 || left > lead || state.phase === 'ended')
			continue;
		const label = content.elections[ballot.electionId]?.label ?? ballot.electionId;
		alerts.push({
			level: 'info',
			text:
				left === 0
					? `${label} à la fin de ce trimestre.`
					: `${label} au ${formatTurn(ballot.turn)}, dans ${left} trimestre${left > 1 ? 's' : ''}.`
		});
	}
	if (health.tone === 'danger' || health.tone === 'warning') {
		alerts.push({
			level: health.tone,
			text: `Santé ${health.label.toLowerCase()} : pensez au repos.`
		});
	}

	return {
		dateLabel: formatTurn(state.end ? state.end.turn : state.turn),
		age: ageAt(state.player.birthTurn, state.end ? state.end.turn : state.turn),
		phase: state.phase,
		resources: RESOURCE_IDS.map((id) => ({
			id,
			name: RESOURCE_NAMES[id],
			value: formatResource(id, state.resources[id]),
			forecast: formatRange(id, preview.resourceChanges[id].min, preview.resourceChanges[id].max)
		})),
		health,
		stress,
		plan: {
			steps,
			timeAvailable: preview.timeAvailable,
			timeReserved: preview.timeReserved,
			timeUsed: preview.timeUsed,
			timeRemaining: preview.timeRemaining,
			valid: preview.valid,
			issues: preview.issues.filter((issue) => issue.index === null).map((issue) => issue.message),
			warnings: preview.warnings.map((warning) => warning.message),
			changes: RESOURCE_IDS.map((id) => ({
				name: RESOURCE_NAMES[id],
				text: formatRange(id, preview.resourceChanges[id].min, preview.resourceChanges[id].max)
			})),
			stressAfter: describeStress(preview.wellbeing.stress),
			healthAfter: preview.wellbeing.health
		},
		actions,
		upgrades,
		producers,
		decision,
		journal: buildJournal(state, content),
		press: buildPress(state, content),
		alerts,
		summary: buildSummary(state, content),
		world: buildWorld(state, plan, content),
		people: buildPeople(state, content),
		career: buildCareer(state, plan, content),
		supports: buildSupports(state, content)
	};
}
