/**
 * Projection de la carrière : mandats, scrutins, campagnes, carrière partisane, procès-verbaux (fiche elections-et-mandats).
 *
 * Partie de la projection publique (`PlayerView`, ARCHITECTURE.md §9) : fonctions pures,
 * sans PRNG ni information cachée. Point d’entrée : `../view-model.ts`.
 */
import type { Content } from '../../content/types.ts';
import type {
	Ballot,
	BallotContestant,
	ChoiceRecord,
	GameState,
	MandateInstance,
	PlanStep
} from '../../engine/index.ts';
import {
	activeMandates,
	campaignPoll,
	candidacyRoleOf,
	congressAppraisal,
	countsTowardCumul,
	cumulatedMandates,
	displayName,
	effectiveSystem,
	familyFormats,
	formatTurn,
	investitureAppraisal,
	listSystem,
	mainMandate,
	pollingCompetence,
	reservedTime
} from '../../engine/index.ts';
import { formatMoney } from '../format.ts';
import { addability } from './agenda.ts';
import type { MediaView } from './media.ts';
import { buildMedia } from './media.ts';
import type { PromisesView } from './promises.ts';
import { buildPromises } from './promises.ts';
import {
	ACTION_FORMAT_LABELS,
	INVESTITURE_STATUS_TEXT,
	MANDATE_END_LABELS,
	PARTY_POSTURE_LABELS,
	PARTY_RANK_LABELS,
	REPORT_SYSTEMS,
	advanceLabel,
	amounts,
	electionName,
	formatPerMille,
	mandateName,
	sharesText
} from './shared.ts';

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
	/**
	 * Mandat au sein duquel cette fonction s'exerce (la mairie au sein du conseil
	 * municipal) : elle ne compte pas à part dans le cumul. `null` sinon.
	 */
	readonly within: string | null;
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
	/** Mandat brigué en cas de victoire. */
	readonly stake: string;
	/** Remboursement forfaitaire des frais de campagne, en clair, ou `null`. */
	readonly refund: string | null;
	/** Candidature : déjà déposée (campagne en cours), prévue dans le plan, ou possible. */
	readonly campaign: CampaignView | null;
	readonly candidacyPlanned: boolean;
	readonly candidacyAddable: boolean;
	readonly candidacyReason: string | null;
	/**
	 * Investiture nationale (P3-30) : appréciation qualitative et facteurs
	 * observables, demande possible, prévue, ou issue ; `null` hors scrutin concerné.
	 */
	readonly investiture: {
		readonly actionId: string;
		readonly appraisal: string;
		readonly factors: readonly { readonly label: string; readonly favorable: boolean }[];
		readonly planned: boolean;
		readonly addable: boolean;
		readonly reason: string | null;
		/** Issue d'une demande déjà faite, en clair, sinon `null`. */
		readonly status: string | null;
	} | null;
	/** Place sur la liste d'un parti (P3-29) : action, prévue, possible ; `null` sans liste. */
	readonly listPlace: {
		readonly actionId: string;
		readonly planned: boolean;
		readonly addable: boolean;
		readonly reason: string | null;
	} | null;
}

export interface CampaignView {
	readonly campaignId: string;
	readonly label: string;
	readonly dateLabel: string;
	readonly declared: string;
	readonly investiture: string;
	readonly preparation: number;
	/** Adversaire principal nommé, son étiquette et l'historique des affrontements. */
	readonly opponent: string | null;
	/** Sondage : fourchette du score face à l'adversaire principal (en cours seulement). */
	readonly poll: { readonly min: number; readonly max: number } | null;
	readonly outcome: string | null;
	/** Avance personnelle versée et son sort (P3-23), en clair, ou `null`. */
	readonly advance: string | null;
	/** Formats d'avance possibles pour une candidature en cours (P3-23), vide sinon. */
	readonly advanceOffers: readonly AdvanceOfferView[];
}

/** Format d'avance de campagne (P3-23) : montant, prérequis et disponibilité. */
export interface AdvanceOfferView {
	readonly actionId: string;
	readonly label: string;
	readonly format: string;
	readonly timeCost: number;
	readonly planned: boolean;
	readonly addable: boolean;
	readonly reason: string | null;
}

/** Carrière dans le parti (P3-34), sans aucun chiffre caché. */
export interface PartyCareerView {
	readonly party: string;
	readonly rank: string;
	readonly since: string;
	readonly congress: string;
	/** Candidature déclarée (posture, ralliements), sinon `null`. */
	readonly bid: string | null;
	/** Appréciation du congrès pour une candidature déclarée, sinon `null`. */
	readonly appraisal: string | null;
	readonly factors: readonly { readonly label: string; readonly favorable: boolean }[];
	/** Délai après une défaite, en clair, sinon `null`. */
	readonly retry: string | null;
}

export interface CareerView {
	/** Carrière dans le parti (P3-34), `null` sans adhésion. */
	readonly partyCareer: PartyCareerView | null;
	/** Fonction principale (mandat de rang le plus élevé) ou « Sans mandat ». */
	readonly mainFunction: string;
	readonly mandates: readonly MandateView[];
	readonly reservedTime: number;
	readonly resignActionId: string | null;
	readonly maxMandates: number;
	/** Mandats comptés dans le cumul (une fonction exercée au sein d'un mandat n'y compte pas). */
	readonly cumulCount: number;
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
		/** Procès-verbal du territoire du joueur (P3-29). */
		readonly report: BallotReportView | null;
	}[];
	readonly pastMandates: readonly { readonly label: string; readonly period: string }[];
	readonly declareActionId: string | null;
	/** Campagnes passées, de la plus récente à la plus ancienne. */
	readonly pastCampaigns: readonly CampaignView[];
	/** Registre des promesses et engagements possibles (P3-04). */
	readonly promises: PromisesView;
	/** Médias et relations (P3-03). */
	readonly media: MediaView;
}

/** Ligne du procès-verbal d'un scrutin (P3-29). */
export interface BallotReportRowView {
	readonly key: string;
	/** « Vous », la tête de liste nommée ou « Liste du … ». */
	readonly name: string;
	/** Étiquette : sigle du parti, « sans étiquette » ou « dissident ». */
	readonly label: string;
	readonly player: boolean;
	/** La liste où figure le joueur (colistier compris). */
	readonly mine: boolean;
	/** Parts en % avec une décimale (« 27,1 % »). */
	readonly firstRound: string;
	readonly firstRoundValue: number;
	readonly secondRound: string | null;
	readonly seats: number;
	/** Issue rédigée : élue, battue, qualifiée, fusionnée avec…, retirée, éliminée. */
	readonly outcome: string;
	readonly winner: boolean;
}

/** Procès-verbal d'un scrutin, identique avec ou sans candidature du joueur (P3-29). */
export interface BallotReportView {
	readonly ballotId: string;
	readonly title: string;
	readonly dateLabel: string;
	/** Mode, sièges et participation en une ligne. */
	readonly summary: string;
	readonly rows: readonly BallotReportRowView[];
	readonly secondRound: boolean;
	readonly pending: boolean;
	readonly showSeats: boolean;
	/** Issue pour le joueur (élu, rang, mairie…), `null` s'il n'était pas candidat. */
	readonly verdict: string | null;
}

/**
 * Procès-verbal public d'un scrutin tenu (P3-29) : candidatures, tours,
 * sièges et issue du joueur. Rien n'existe avant le vote ; un second tour en
 * attente ne montre que le premier.
 */
export function ballotReportView(
	ballot: Ballot,
	state: GameState,
	content: Content
): BallotReportView | null {
	const report = ballot.report;
	if (!report) return null;
	const list = report.system === 'list' || report.system === 'senate_list';
	const byId = new Map(
		report.contestants.map((contestant) => [contestant.contestantId, contestant])
	);
	const nameOf = (contestant: BallotContestant): string => {
		if (contestant.player) return list ? 'Votre liste' : 'Vous';
		const leader = contestant.leaderId ? state.characters[contestant.leaderId] : undefined;
		if (leader) return list ? `Liste de ${displayName(leader)}` : displayName(leader);
		const party = contestant.partyId ? content.parties[contestant.partyId] : undefined;
		if (!party) return list ? 'Liste sans étiquette' : 'Candidat sans étiquette';
		return list ? `Liste ${party.acronym}` : `Candidat ${party.acronym}`;
	};
	const labelOf = (contestant: BallotContestant): string => {
		const acronym = contestant.partyId
			? (content.parties[contestant.partyId]?.acronym ?? contestant.partyId)
			: 'sans étiquette';
		return contestant.dissident ? `${acronym} dissident` : acronym;
	};
	const outcomeOf = (contestant: BallotContestant): string => {
		switch (contestant.status) {
			case 'won':
				return list ? 'en tête' : 'élu';
			case 'lost':
				return list && contestant.seats > 0 ? 'opposition' : 'battu';
			case 'qualified':
				return 'qualifiée pour le second tour';
			case 'merged': {
				const host = contestant.mergedInto ? byId.get(contestant.mergedInto) : undefined;
				return host ? `fusion avec ${nameOf(host)}` : 'fusion';
			}
			case 'withdrawn':
				return 'retrait';
			case 'eliminated':
				return 'éliminée';
			default: {
				const unknown: never = contestant.status;
				return String(unknown);
			}
		}
	};
	const rows = [...report.contestants]
		.sort((a, b) => b.firstRound - a.firstRound)
		.map((contestant) => ({
			key: contestant.contestantId,
			name: nameOf(contestant),
			label: labelOf(contestant),
			player: contestant.player,
			mine: contestant.contestantId === report.playerContestantId,
			firstRound: formatPerMille(contestant.firstRound),
			firstRoundValue: contestant.firstRound / 10,
			secondRound: contestant.secondRound === null ? null : formatPerMille(contestant.secondRound),
			seats: contestant.seats,
			outcome: outcomeOf(contestant),
			winner: contestant.contestantId === report.winnerId
		}));
	const definition = content.elections[ballot.electionId];
	const pending = report.stage === 'runoff_pending';
	const seatsLabel = report.seats > 1 ? `${report.seats} sièges` : '1 siège';
	let verdict: string | null = null;
	if (report.playerRank !== null) {
		const mine = report.playerContestantId ? byId.get(report.playerContestantId) : undefined;
		const rank = report.playerRank > 1 ? ` (${report.playerRank}e de liste)` : '';
		if (pending) verdict = 'Premier tour tenu : le second attend votre décision.';
		else if (report.contestants.find((c) => c.player)?.status === 'withdrawn')
			verdict = 'Vous vous êtes désisté avant le second tour.';
		else if (report.playerElected) {
			const head =
				definition?.headGrant &&
				report.playerRank === 1 &&
				report.playerContestantId === report.winnerId;
			verdict = head
				? `Élu${rank} : votre liste l’emporte et le conseil vous élit ${content.mandates[definition.headGrant]?.label.toLocaleLowerCase('fr') ?? 'à sa tête'}.`
				: list
					? `Élu${rank}, ${report.playerContestantId === report.winnerId ? 'dans la majorité' : 'dans l’opposition'} (${mine?.seats ?? 0} siège(s) pour votre liste).`
					: 'Élu.';
		} else {
			verdict = list
				? `Non élu${rank} : votre liste obtient ${mine?.seats ?? 0} siège(s).`
				: 'Battu.';
		}
	}
	return {
		ballotId: ballot.ballotId,
		title: `${definition?.label ?? ballot.electionId} — ${report.place}`,
		dateLabel: formatTurn(ballot.turn),
		summary: `${REPORT_SYSTEMS[report.system]} · ${seatsLabel} · participation ${report.turnout} %`,
		rows,
		secondRound: report.secondRound,
		pending,
		showSeats: !pending && report.seats > 1,
		verdict
	};
}

/** Meilleur score du joueur et seconds tours disputés, lus aux procès-verbaux (P3-29). */
export function bestBallotLine(
	state: GameState,
	content: Content
): { readonly label: string; readonly value: string }[] {
	const judged = state.campaigns.filter(
		(campaign) => campaign.playerPercent !== null && campaign.status !== 'running'
	);
	if (judged.length === 0) return [];
	const best = judged.reduce((top, campaign) =>
		(campaign.playerPercent ?? 0) > (top.playerPercent ?? 0) ? campaign : top
	);
	const ballot = state.ballots.find((entry) => entry.ballotId === best.ballotId);
	const runoffs = judged.filter(
		(campaign) =>
			state.ballots.find((entry) => entry.ballotId === campaign.ballotId)?.report?.secondRound ===
			true
	).length;
	return [
		{
			label: 'Meilleur score',
			value: `${best.playerPercent} % — ${content.elections[best.electionId]?.label ?? best.electionId}${ballot?.report ? `, ${ballot.report.place}` : ''} (${formatTurn(ballot?.turn ?? best.declaredTurn)})`
		},
		{ label: 'Seconds tours disputés', value: String(runoffs) }
	];
}

/** Procès-verbal tranché par un choix d'entre-deux-tours (P3-29), sinon `null`. */
export function runoffReport(
	entry: ChoiceRecord,
	state: GameState,
	content: Content
): BallotReportView | null {
	const change = entry.politics.find((politics) => politics.kind === 'runoff');
	if (!change) return null;
	const campaign = state.campaigns.find((candidate) => candidate.campaignId === change.campaignId);
	const ballot = state.ballots.find((candidate) => candidate.ballotId === campaign?.ballotId);
	return ballot ? ballotReportView(ballot, state, content) : null;
}

export function buildCareer(
	state: GameState,
	plan: readonly PlanStep[],
	content: Content
): CareerView {
	const label = (mandateId: string): string => mandateName(mandateId, state, content);
	const resignActionId =
		content.actionIds.find((id) => content.actions[id]?.target === 'mandate') ?? null;
	const ballotActions = content.actionIds.filter((id) => content.actions[id]?.target === 'ballot');
	const declareActionId =
		ballotActions.find((id) => candidacyRoleOf(content.actions[id]?.effects ?? []) === 'head') ??
		null;
	const investitureActionId =
		content.actionIds.find((id) =>
			content.actions[id]?.effects.some((effect) => effect.op === 'requestInvestiture')
		) ?? null;
	const listActionId =
		ballotActions.find(
			(id) => candidacyRoleOf(content.actions[id]?.effects ?? []) === 'colistier'
		) ?? null;
	// Avance de campagne (P3-23) : la famille dont les formats ciblent une candidature.
	const advanceFamily = content.actionFamilyIds.find(
		(familyId) => familyFormats(familyId, content)[0]?.target === 'campaign'
	);
	const advanceFormats = advanceFamily ? familyFormats(advanceFamily, content) : [];
	const campaignView = (campaign: GameState['campaigns'][number]): CampaignView => {
		const ballot = state.ballots.find((entry) => entry.ballotId === campaign.ballotId);
		const rival = campaign.opponentId ? state.characters[campaign.opponentId] : undefined;
		const previous = rival
			? state.campaigns.filter(
					(other) =>
						other.opponentId === rival.id &&
						other.campaignId !== campaign.campaignId &&
						(other.status === 'won' || other.status === 'lost') &&
						other.declaredTurn < campaign.declaredTurn + (campaign.status === 'running' ? 1 : 0)
				)
			: [];
		const opponent = rival
			? `${displayName(rival)} (${rival.partyId ? (content.parties[rival.partyId]?.acronym ?? rival.partyId) : 'sans étiquette'})${
					previous.length > 0
						? ` — déjà affronté ${previous.length} fois : ${previous.filter((other) => other.status === 'won').length} victoire(s) pour vous`
						: ''
				}`
			: null;
		const verdict = ballot ? (ballotReportView(ballot, state, content)?.verdict ?? null) : null;
		const against = rival ? ` face à ${displayName(rival)}` : '';
		const outcome =
			campaign.status === 'won'
				? `Victoire avec ${campaign.playerPercent} %${against}${verdict ? ` — ${verdict}` : ''}`
				: campaign.status === 'lost'
					? `Défaite avec ${campaign.playerPercent} %${against} : la carrière continue`
					: campaign.status === 'withdrawn'
						? `Désistement entre les deux tours (${campaign.playerPercent} % au premier)`
						: campaign.status === 'disqualified'
							? `Candidature invalidée : ${campaign.reason ?? 'conditions non remplies'}`
							: ballot?.report?.stage === 'runoff_pending'
								? 'Premier tour tenu : le second attend votre décision'
								: null;
		return {
			campaignId: campaign.campaignId,
			label: electionName(campaign.electionId, state, content),
			dateLabel: ballot ? formatTurn(ballot.turn) : '—',
			declared: `Candidature déclarée au ${formatTurn(campaign.declaredTurn)}`,
			investiture:
				campaign.role === 'colistier'
					? `Colistier sur la liste du ${content.parties[campaign.partyId ?? '']?.name ?? 'premier parti'}, ${campaign.listRank}e de liste`
					: campaign.partyId === null
						? 'Sans étiquette'
						: campaign.invested
							? `Investiture du ${content.parties[campaign.partyId]?.name ?? campaign.partyId}`
							: 'Sans investiture : l’appareil du parti ne vous soutient pas',
			preparation: campaign.preparation,
			opponent,
			poll:
				campaign.status === 'running'
					? campaignPoll(
							campaign,
							state.player,
							state.world,
							state.mandates,
							content,
							state.characters,
							state.campaigns,
							pollingCompetence(state.staff, state.characters, state.turn, content)
						)
					: null,
			outcome,
			advance: advanceLabel(campaign, content),
			advanceOffers:
				campaign.status === 'running' && campaign.advanceCents === 0
					? advanceFormats.map((action): AdvanceOfferView => {
							const step: PlanStep = {
								kind: 'action',
								id: action.id,
								target: campaign.campaignId
							};
							return {
								actionId: action.id,
								label: action.label,
								format: ACTION_FORMAT_LABELS[action.scale!.format],
								timeCost: action.timeCost,
								planned: plan.some(
									(entry) =>
										entry.kind === 'action' &&
										entry.id === action.id &&
										entry.target === campaign.campaignId
								),
								...addability(state, plan, step, content)
							};
						})
					: []
		};
	};
	const scheduled = state.ballots
		.filter((ballot) => ballot.status === 'scheduled')
		.sort((a, b) => a.turn - b.turn);
	// Une fonction exercée au sein d'un mandat (la mairie) suit ce mandat dans la liste.
	const unsorted = activeMandates(state.mandates);
	const hostOf = (mandate: MandateInstance): string | null =>
		state.institutions.prerequisites[mandate.mandateId]?.[0] ?? null;
	const active = unsorted
		.filter((mandate) => hostOf(mandate) === null)
		.flatMap((host) => [host, ...unsorted.filter((mandate) => hostOf(mandate) === host.mandateId)]);
	active.push(...unsorted.filter((mandate) => !active.includes(mandate)));
	const main = mainMandate(state.mandates, content);
	return {
		mainFunction: main
			? mandateName(main.mandateId, state, content, main.portfolio)
			: 'Sans mandat',
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
				label: mandateName(mandate.mandateId, state, content, mandate.portfolio),
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
				resignReason: resign.reason,
				within: countsTowardCumul(mandate.mandateId, state.institutions)
					? null
					: (state.institutions.prerequisites[mandate.mandateId] ?? []).map(label).join(', ')
			};
		}),
		reservedTime: reservedTime(state.mandates, content),
		resignActionId,
		maxMandates: state.institutions.maxMandates,
		cumulCount: cumulatedMandates(state.mandates, state.institutions).length,
		incompatibilities: state.institutions.incompatibilities.map(
			([left, right]) => `${label(left)} et ${label(right)}`
		),
		prerequisites: Object.entries(state.institutions.prerequisites).map(
			([mandateId, required]) => `${label(mandateId)} : ${required.map(label).join(', ')}`
		),
		calendar: scheduled.map((ballot) => {
			const definition = content.elections[ballot.electionId];
			const running = state.campaigns.find(
				(campaign) => campaign.status === 'running' && campaign.ballotId === ballot.ballotId
			);
			const declare =
				declareActionId && !running
					? addability(
							state,
							plan,
							{ kind: 'action', id: declareActionId, target: ballot.ballotId },
							content
						)
					: { addable: false, reason: null };
			const listOpen =
				listActionId !== null &&
				definition !== undefined &&
				listSystem(effectiveSystem(definition, state.player.territory, content));
			const place =
				listOpen && !running
					? addability(
							state,
							plan,
							{ kind: 'action', id: listActionId, target: ballot.ballotId },
							content
						)
					: { addable: false, reason: null };
			const request = state.investitures.find((entry) => entry.ballotId === ballot.ballotId);
			const appraisal =
				definition?.investiture && state.player.partyId !== null && investitureActionId
					? investitureAppraisal(
							ballot.ballotId,
							state.player,
							state.resources.influence,
							state.mandates,
							content
						)
					: null;
			const investitureStep = investitureActionId
				? addability(
						state,
						plan,
						{ kind: 'action', id: investitureActionId, target: ballot.ballotId },
						content
					)
				: { addable: false, reason: null };
			return {
				investiture:
					appraisal && investitureActionId
						? {
								actionId: investitureActionId,
								appraisal: appraisal.label,
								factors: appraisal.factors,
								planned: plan.some(
									(step) =>
										step.kind === 'action' &&
										step.id === investitureActionId &&
										step.target === ballot.ballotId
								),
								addable: !request && investitureStep.addable,
								reason: request ? null : investitureStep.reason,
								status: request
									? `${INVESTITURE_STATUS_TEXT[request.status].charAt(0).toUpperCase()}${INVESTITURE_STATUS_TEXT[request.status].slice(1)}${request.reasons.length > 0 ? ` (${request.reasons.join(', ')})` : ''}.`
									: null
							}
						: null,
				listPlace: listOpen
					? {
							actionId: listActionId,
							planned: plan.some(
								(step) =>
									step.kind === 'action' &&
									step.id === listActionId &&
									step.target === ballot.ballotId
							),
							addable: place.addable,
							reason: place.reason
						}
					: null,
				stake: definition ? label(definition.grants) : '—',
				campaign: running ? campaignView(running) : null,
				candidacyPlanned: plan.some(
					(step) =>
						step.kind === 'action' && step.id === declareActionId && step.target === ballot.ballotId
				),
				candidacyAddable: declare.addable,
				candidacyReason: declare.reason,
				ballotId: ballot.ballotId,
				label: definition?.label ?? ballot.electionId,
				dateLabel: formatTurn(ballot.turn),
				turnsLeft: ballot.turn - state.turn,
				filing: `Candidatures closes au ${formatTurn(ballot.filingClosesTurn)}`,
				refund: definition?.campaignRefundCents
					? `Frais de campagne remboursés ${formatMoney(definition.campaignRefundCents)} à partir de ${content.balance.campaigns.refundMinPercent} % des voix`
					: null,
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
				label: electionName(ballot.electionId, state, content),
				dateLabel: formatTurn(ballot.turn),
				winner: content.parties[ballot.winnerPartyId ?? '']?.name ?? '—',
				shares: sharesText(ballot, content),
				early: ballot.early,
				report: ballotReportView(ballot, state, content)
			})),
		declareActionId,
		partyCareer: (() => {
			const party = state.player.partyCareer;
			if (!party || state.player.partyId === null) return null;
			const appraisal = party.bid
				? congressAppraisal(state.player, state.resources.influence, content)
				: null;
			return {
				party: content.parties[state.player.partyId]?.name ?? state.player.partyId,
				rank: PARTY_RANK_LABELS[party.rank],
				since: `depuis le ${formatTurn(party.rankSince)}`,
				congress: `Prochain congrès : ${formatTurn(party.nextCongressTurn)}`,
				bid: party.bid
					? `Candidature à la direction, ligne du ${PARTY_POSTURE_LABELS[party.bid.posture].toLocaleLowerCase('fr')} · ${party.bid.rallies} ralliement(s)`
					: null,
				appraisal: appraisal?.label ?? null,
				factors: appraisal?.factors ?? [],
				retry:
					party.retryTurn !== null && party.retryTurn > party.nextCongressTurn
						? `Nouvelle candidature possible au congrès du ${formatTurn(party.retryTurn)}`
						: null
			};
		})(),
		promises: buildPromises(state, plan, content),
		media: buildMedia(state, plan, content),
		pastCampaigns: state.campaigns
			.filter((campaign) => campaign.status !== 'running')
			.map(campaignView)
			.reverse(),
		pastMandates: state.mandates
			.filter((mandate) => mandate.status === 'ended')
			.map((mandate) => ({
				label: mandateName(mandate.mandateId, state, content, mandate.portfolio),
				period: `${formatTurn(mandate.startTurn)} – ${formatTurn(mandate.endTurn ?? mandate.startTurn)} (${MANDATE_END_LABELS[mandate.endReason ?? 'term']})`
			}))
	};
}
