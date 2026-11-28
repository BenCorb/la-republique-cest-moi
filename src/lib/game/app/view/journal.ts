/**
 * Projection du journal : lignes de chaque trimestre et de chaque décision (fiche tour-et-acceleration).
 *
 * Partie de la projection publique (`PlayerView`, ARCHITECTURE.md §9) : fonctions pures,
 * sans PRNG ni information cachée. Point d’entrée : `../view-model.ts`.
 */
import type { Content, ResourceId } from '../../content/types.ts';
import type {
	ActivistsRecord,
	CharactersRecord,
	ChoiceRecord,
	DeadlinesRecord,
	FamilyRecord,
	GameState,
	HistoryEntry,
	StaffRecord,
	WorldRecord
} from '../../engine/index.ts';
import {
	activistTier,
	campaignRefundFor,
	caseStepMessage,
	displayName,
	formatTurn,
	parsePledgeTarget,
	parseSearchTarget,
	renderTemplate
} from '../../engine/index.ts';
import {
	GAUGE_NAMES,
	RESOURCE_NAMES,
	describeCompetence,
	formatDelta,
	formatGaugeDelta,
	formatMoney
} from '../format.ts';
import { ballotReportView } from './career.ts';
import { articleEffects } from './media.ts';
import {
	SEARCH_LABELS,
	SOURCE_LABELS,
	STAFF_LEAVE_LABELS,
	activistsWord,
	articleTitle,
	electionName,
	eventTitle,
	joinParts,
	levelOf,
	mandateName,
	peopleText,
	politicsText,
	sharesText,
	upgradeLabel
} from './shared.ts';

export interface JournalLine {
	readonly kind:
		'step' | 'economy' | 'wellbeing' | 'world' | 'people' | 'career' | 'event' | 'decision' | 'end';
	readonly text: string;
}

/** Retraits automatiques du plan au cours d'un trimestre (session, P3-11). */
export interface PlanAdjustment {
	readonly turn: number;
	readonly lines: readonly string[];
}

export interface JournalTurnView {
	readonly key: string;
	readonly label: string;
	readonly lines: readonly JournalLine[];
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
	for (const result of record.campaigns) {
		const campaign = state.campaigns.find((entry) => entry.campaignId === result.campaignId);
		const label = content.elections[campaign?.electionId ?? '']?.label ?? 'Élection';
		const rival = result.opponentId ? state.characters[result.opponentId] : undefined;
		const against = rival ? ` face à ${displayName(rival)}` : '';
		const ballot = state.ballots.find((entry) => entry.ballotId === campaign?.ballotId);
		const verdict = ballot ? ballotReportView(ballot, state, content)?.verdict : null;
		lines.push({
			kind: 'career',
			text:
				result.status === 'disqualified'
					? `${label} : candidature invalidée (${result.reason ?? 'conditions non remplies'}).`
					: `${label} : ${result.playerPercent} %${against}. ${verdict ?? (result.status === 'won' ? 'Élu.' : 'Battu.')}`
		});
		const refund = campaign
			? campaignRefundFor(campaign, result.status, state.ballots, content)
			: 0;
		if (refund > 0) {
			lines.push({
				kind: 'economy',
				text: `Frais de campagne remboursés — ${RESOURCE_NAMES.politicalBudgetCents} ${formatDelta('politicalBudgetCents', refund)}`
			});
		}
		// Avance personnelle (P3-23) : rendue ou perdue selon le score.
		if (result.advance) {
			lines.push({
				kind: 'economy',
				text: result.advance.repaid
					? `Avance de campagne rendue — ${RESOURCE_NAMES.personalCashCents} ${formatDelta('personalCashCents', result.advance.cents)}`
					: `Avance de campagne de ${formatMoney(result.advance.cents)} perdue : le score n’atteint pas ${content.balance.campaigns.advanceRepayMinPercent} % des voix`
			});
		}
	}
	for (const campaignIdValue of record.runoffs) {
		const campaign = state.campaigns.find((entry) => entry.campaignId === campaignIdValue);
		lines.push({
			kind: 'career',
			text: `${electionName(campaign?.electionId ?? '', state, content)} : pas de majorité au premier tour, le second attend votre décision.`
		});
	}
	for (const result of record.ballots) {
		const ballot = state.ballots.find((entry) => entry.ballotId === result.ballotId);
		const label = electionName(result.electionId, state, content);
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
export function characterLines(record: CharactersRecord | null, state: GameState): JournalLine[] {
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

/** Ligne de journal de la base militante (P3-19), absente si rien n'a bougé. */
function activistsJournalLine(
	record: ActivistsRecord | null,
	content: Content
): JournalLine | null {
	if (!record) return null;
	const moves = [
		record.arrivals > 0 ? `${record.arrivals} arrivée${record.arrivals > 1 ? 's' : ''}` : '',
		record.recruits > 0
			? `${record.recruits} recrue${record.recruits > 1 ? 's' : ''} de campagne`
			: '',
		record.departures > 0 ? `${record.departures} départ${record.departures > 1 ? 's' : ''}` : '',
		record.duesCents > 0 ? `cotisations ${formatMoney(record.duesCents)}` : '',
		record.upkeepCents > 0 ? `frais ${formatMoney(record.upkeepCents)}` : ''
	].filter(Boolean);
	if (moves.length === 0) return null;
	const tier = activistTier(record.total, content).label;
	return {
		kind: 'people',
		text: `Base militante — ${moves.join(', ')} : ${activistsWord(record.total)} (${tier})`
	};
}

export function worldLines(
	record: WorldRecord | null,
	state: GameState,
	content: Content
): JournalLine[] {
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

/** Libellé lisible de la cible d'une étape : parti, mandat exercé ou échéance électorale. */
export function targetLabel(target: string, state: GameState, content: Content): string {
	// Recherche de candidats (P3-21) : poste, et trait recherché éventuel.
	const sought = parseSearchTarget(target);
	if (Object.hasOwn(content.posts, sought.postId)) {
		const post = `« ${content.posts[sought.postId]?.label ?? sought.postId} »`;
		return sought.trait === null
			? post
			: `${post}, profil « ${content.traits[sought.trait]?.label ?? sought.trait} »`;
	}
	if (Object.hasOwn(content.parties, target)) return content.parties[target]?.name ?? target;
	// Engagement de campagne (P3-22) : promesse et campagne destinataire.
	const pledged = parsePledgeTarget(target);
	if (pledged && Object.hasOwn(content.promises, pledged.promiseId)) {
		const campaign = state.campaigns.find((entry) => entry.campaignId === pledged.campaignId);
		const label = `« ${content.promises[pledged.promiseId]?.label ?? pledged.promiseId} »`;
		return campaign ? `${label}, ${electionName(campaign.electionId, state, content)}` : label;
	}
	if (Object.hasOwn(content.media, target)) return content.media[target]?.name ?? target;
	if (Object.hasOwn(content.institutionLevels, target)) {
		const parameterId = content.institutionLevels[target]?.parameterId ?? '';
		return `${content.institutionParameters[parameterId]?.label ?? parameterId} → « ${levelOf(target, content)?.label ?? target} »`;
	}
	const pledge = state.promises.find((entry) => entry.pledgeId === target);
	if (pledge) return `« ${content.promises[pledge.promiseId]?.label ?? pledge.promiseId} »`;
	if (target.startsWith('upgrade.')) {
		// Exemplaire de l'organisation, encore possédé ou parti (retrouvé par son achat).
		const upgradeId =
			state.upgrades.find((upgrade) => upgrade.instanceId === target)?.upgradeId ??
			state.history
				.flatMap((entry) => (entry.type === 'turn.resolved' ? entry.steps : []))
				.find((step) => step.kind === 'purchase' && step.instanceId === target)?.id;
		const definition = upgradeId ? content.upgrades[upgradeId] : undefined;
		if (upgradeId && definition) return upgradeLabel(upgradeId, state, content, true);
	}
	const mandate = state.mandates.find((entry) => entry.instanceId === target);
	if (mandate) return mandateName(mandate.mandateId, state, content, mandate.portfolio);
	const ballot = state.ballots.find((entry) => entry.ballotId === target);
	if (ballot) {
		const label = electionName(ballot.electionId, state, content);
		return `${label} du ${formatTurn(ballot.turn)}`;
	}
	return target;
}

/** Départs de collaborateurs et présélections à la frontière (P2-05). */
export function staffLines(
	record: StaffRecord | null,
	state: GameState,
	content: Content
): JournalLine[] {
	if (!record) return [];
	const post = (postId: string): string => content.posts[postId]?.label ?? postId;
	return [
		...record.departures.map((departure) => {
			const character = state.characters[departure.characterId];
			const name = character ? displayName(character) : departure.characterId;
			return {
				kind: 'people' as const,
				text: `${name} quitte le poste « ${post(departure.postId)} » (${STAFF_LEAVE_LABELS[departure.reason]}).`
			};
		}),
		...record.shortlisted.map((postId) => ({
			kind: 'career' as const,
			text: `Candidatures reçues pour le poste « ${post(postId)} ».`
		})),
		// Contre-propositions sans réponse (P3-33).
		...(record.counterLapsed ?? []).map((characterId) => {
			const character = state.characters[characterId];
			return {
				kind: 'people' as const,
				text: `${character ? displayName(character) : 'Un candidat'} n’a pas reçu de réponse à sa contre-proposition et retire sa candidature.`
			};
		}),
		...record.searches.map((search) => ({
			kind: 'career' as const,
			text:
				search.outcome === 'found'
					? `${SEARCH_LABELS[search.level]} aboutie pour le poste « ${post(search.postId)} » : ${search.candidates.length} candidat${search.candidates.length > 1 ? 's' : ''} ajouté${search.candidates.length > 1 ? 's' : ''} à la présélection.`
					: `${SEARCH_LABELS[search.level]} ${search.outcome === 'failed' ? 'infructueuse' : 'sans objet'} pour le poste « ${post(search.postId)} » — ${RESOURCE_NAMES.politicalBudgetCents} ${formatDelta('politicalBudgetCents', search.refundCents)} rendus.`
		})),
		// Progression (P3-21) : seulement quand la compétence change de palier affiché.
		...record.progress.flatMap((step) => {
			const character = state.characters[step.characterId];
			const name = character ? displayName(character) : step.characterId;
			const after = describeCompetence(step.to).label;
			if (describeCompetence(step.from).label === after) return [];
			return [
				{
					kind: 'people' as const,
					text: `${name} progresse : compétence désormais ${after.toLowerCase()}.`
				}
			];
		})
	];
}

/** Famille à la frontière (P2-08) : héritage, veuvage, dépenses et disponibilité. */
export function familyLines(record: FamilyRecord | null, state: GameState): JournalLine[] {
	if (!record) return [];
	const lines: JournalLine[] = [];
	if (record.inheritance > 0) {
		lines.push({
			kind: 'people',
			text: `Héritage familial — ${RESOURCE_NAMES.personalCashCents} ${formatDelta('personalCashCents', record.inheritance)}`
		});
	}
	if (record.widowed) {
		const partner = state.characters[record.widowed];
		lines.push({
			kind: 'people',
			text: `Deuil : ${partner ? displayName(partner) : 'votre partenaire'} n’est plus.`
		});
	}
	if (record.childCosts < 0) {
		lines.push({
			kind: 'economy',
			text: `Enfants à charge — ${RESOURCE_NAMES.personalCashCents} ${formatDelta('personalCashCents', record.childCosts)}`
		});
	}
	if (record.neglected) {
		lines.push({ kind: 'people', text: 'Votre famille se sent délaissée par votre agenda.' });
	}
	return lines;
}

export function journalOfQuarter(
	entry: HistoryEntry,
	state: GameState,
	content: Content
): JournalLine[] {
	const lines: JournalLine[] = [];
	for (const step of entry.steps) {
		const target = step.target ? ` : ${targetLabel(step.target, state, content)}` : '';
		const label =
			step.kind === 'action'
				? `${content.actions[step.id]?.label ?? step.id}${target}`
				: `Achat : ${upgradeLabel(step.id, state, content, false)}`;
		const effects = joinParts(
			changesText(step.changes),
			gaugesText(step.gauges),
			politicsText(step.politics, content)
		);
		lines.push({ kind: 'step', text: effects ? `${label} — ${effects}` : label });
	}
	for (const producer of entry.economy.producers) {
		const label = upgradeLabel(producer.upgradeId, state, content, true);
		const count = (value: number): string => (value > 1 ? ` ×${value}` : '');
		if (producer.active > 0) {
			lines.push({
				kind: 'economy',
				text: `${label}${count(producer.active)} — ${changesText(producer.changes) || 'aucune variation'}`
			});
		}
		if (producer.suspended > 0) {
			lines.push({
				kind: 'economy',
				text: `${label}${count(producer.suspended)} : charges impayées, production suspendue`
			});
		}
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
	lines.push(...staffLines(entry.staff, state, content));
	lines.push(...familyLines(entry.family, state));
	for (const step of entry.justice?.cases ?? []) {
		lines.push({ kind: 'career', text: caseStepMessage(step.caseId, step.kind, state, content) });
	}
	if (entry.justice) {
		const effects = joinParts(
			changesText(entry.justice.changes),
			gaugesText(entry.justice.gauges),
			politicsText(entry.justice.politics, content)
		);
		if (effects) lines.push({ kind: 'career', text: `Justice — ${effects}` });
	}
	if (entry.promises) {
		const effects = joinParts(
			changesText(entry.promises.changes),
			gaugesText(entry.promises.gauges),
			politicsText(entry.promises.politics, content)
		);
		if (effects) lines.push({ kind: 'career', text: `Promesses — ${effects}` });
	}
	if (entry.institutions) {
		const effects = joinParts(
			changesText(entry.institutions.changes),
			gaugesText(entry.institutions.gauges),
			politicsText(entry.institutions.politics, content)
		);
		if (effects) lines.push({ kind: 'career', text: `Institutions — ${effects}` });
	}
	for (const article of entry.press?.articles ?? []) {
		const effects = articleEffects(article, content);
		if (!effects) continue;
		const media = content.media[article.mediaId]?.name ?? article.mediaId;
		lines.push({
			kind: 'career',
			text: `Presse — ${media} : « ${articleTitle(article, state, content)} » — ${effects}`
		});
	}
	if (entry.mandates.changes.length > 0) {
		lines.push({
			kind: 'economy',
			text: `Indemnités et moyens des mandats — ${changesText(entry.mandates.changes)}`
		});
	}
	const activistsLine = activistsJournalLine(entry.activists, content);
	if (activistsLine) lines.push(activistsLine);
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
	if (state.end?.reason === 'prison' && state.end.turn === entry.turn) {
		lines.push({ kind: 'end', text: 'Fin de carrière : incarcération.' });
	}
	if (lines.length === 0) lines.push({ kind: 'step', text: 'Trimestre calme : rien à signaler.' });
	return lines;
}

export function journalOfChoice(
	entry: ChoiceRecord,
	state: GameState,
	content: Content
): JournalLine[] {
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

export function buildJournal(
	state: GameState,
	content: Content,
	adjustments: readonly PlanAdjustment[] = []
): JournalTurnView[] {
	const groups = new Map<number, JournalLine[]>();
	const add = (turn: number, lines: JournalLine[]): void => {
		groups.set(turn, [...(groups.get(turn) ?? []), ...lines]);
	};
	// Les retraits automatiques précèdent la résolution du trimestre qu'ils concernent.
	for (const adjustment of adjustments) {
		add(
			adjustment.turn,
			adjustment.lines.map((line) => ({ kind: 'step', text: `Plan ajusté : ${line}` }))
		);
	}
	for (const entry of state.history) {
		if (entry.type === 'turn.resolved') add(entry.turn, journalOfQuarter(entry, state, content));
		else add(entry.turn, journalOfChoice(entry, state, content));
	}
	return [...groups.entries()]
		.sort(([a], [b]) => b - a)
		.map(([turn, lines]) => ({ key: `t${turn}`, label: formatTurn(turn), lines }));
}
