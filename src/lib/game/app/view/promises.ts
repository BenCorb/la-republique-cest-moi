/**
 * Projection des promesses de campagne (fiche promesses).
 *
 * Partie de la projection publique (`PlayerView`, ARCHITECTURE.md §9) : fonctions pures,
 * sans PRNG ni information cachée. Point d’entrée : `../view-model.ts`.
 */
import type { Content } from '../../content/types.ts';
import { PROMISE_PROGRESS_MAX } from '../../content/types.ts';
import type { GameState, PlanStep, PromiseRecord } from '../../engine/index.ts';
import {
	careerSummary,
	effectRange,
	formatTurn,
	isOpenPledge,
	pledgeTarget
} from '../../engine/index.ts';
import { addability } from './agenda.ts';
import {
	PROMISE_STATUS_LABELS,
	describeEffect,
	electionName,
	leverLabel,
	mandateName,
	promiseDescription
} from './shared.ts';

/** Promesse type que le candidat peut annoncer (P3-04). */
export interface PromiseOfferView {
	readonly promiseId: string;
	/** Cible de l'engagement : la campagne destinataire et la promesse (P3-22). */
	readonly target: string;
	readonly label: string;
	readonly theme: string;
	/** Description, lieu du scrutin compris. */
	readonly description: string;
	/** Pouvoir qui permet de tenir la promesse, en clair (P3-22). */
	readonly lever: string;
	/** Effets certains de l'annonce, en clair. */
	readonly effects: readonly string[];
	readonly planned: boolean;
	readonly addable: boolean;
	readonly reason: string | null;
}

/** Promesse du registre, en clair. */
export interface PledgeView {
	readonly pledgeId: string;
	readonly label: string;
	readonly theme: string;
	readonly status: string;
	/** Campagne et date de l'annonce. */
	readonly origin: string;
	readonly progress: number;
	readonly inProgress: boolean;
	readonly amended: boolean;
	/** Élu sans le mandat qui donne le levier (P3-22) : au mieux partiellement tenue. */
	readonly limited: boolean;
	/** Pouvoir qui permet de tenir la promesse, en clair (P3-22). */
	readonly lever: string;
	/** Échéance (en cours), issue datée ou rappels. */
	readonly detail: string;
	readonly preparePlanned: boolean;
	readonly prepareAddable: boolean;
	readonly prepareReason: string | null;
}

/** Candidature en cours et engagements qui lui sont propres (P3-22). */
export interface PromiseCampaignView {
	readonly campaignId: string;
	/** Scrutin et territoire : « Élections municipales (Montvérel) ». */
	readonly title: string;
	/** Date du scrutin et fonction recherchée. */
	readonly detail: string;
	/** Engagements déjà inscrits au registre pour cette campagne. */
	readonly made: number;
	readonly offers: readonly PromiseOfferView[];
}

export interface PromisesView {
	readonly pledgeActionId: string | null;
	readonly prepareActionId: string | null;
	readonly maxPerCampaign: number;
	readonly partialProgress: number;
	/** Candidatures en cours, chacune avec ses engagements possibles (vide hors campagne). */
	readonly campaigns: readonly PromiseCampaignView[];
	/** Promesses ouvertes d'abord, puis closes, des plus récentes aux plus anciennes. */
	readonly pledges: readonly PledgeView[];
}

/** Bilan des promesses en une ligne (P3-04). */
export function promisesSummary(counts: ReturnType<typeof careerSummary>['promises']): string {
	if (counts.made === 0) return 'Aucun engagement pris';
	return `${counts.made} engagement(s) : ${counts.kept} tenue(s), ${counts.partial} partiellement, ${counts.abandoned} abandonnée(s)`;
}

export function buildPromises(
	state: GameState,
	plan: readonly PlanStep[],
	content: Content
): PromisesView {
	const pledgeActionId =
		content.actionIds.find((id) => content.actions[id]?.target === 'promise') ?? null;
	const prepareActionId =
		content.actionIds.find((id) => content.actions[id]?.target === 'pledge') ?? null;
	const planned = (id: string | null, target: string): boolean =>
		plan.some((step) => step.kind === 'action' && step.id === id && step.target === target);
	const campaigns = pledgeActionId
		? state.campaigns
				.filter((campaign) => campaign.status === 'running')
				.map((campaign): PromiseCampaignView => {
					const election = content.elections[campaign.electionId];
					const ballot = state.ballots.find((entry) => entry.ballotId === campaign.ballotId);
					const seats = election
						? [
								mandateName(election.grants, state, content),
								...(election.headGrant
									? [
											`${mandateName(election.headGrant, state, content)} pour la tête de la liste victorieuse`
										]
									: [])
							].join(' ; ')
						: '';
					const offers = content.promiseIds.flatMap((promiseId): PromiseOfferView[] => {
						const definition = content.promises[promiseId];
						if (!definition || definition.election !== campaign.electionId) return [];
						const target = pledgeTarget(campaign.campaignId, promiseId);
						const add = addability(
							state,
							plan,
							{ kind: 'action', id: pledgeActionId, target },
							content
						);
						return [
							{
								promiseId,
								target,
								label: definition.label,
								theme: content.promiseThemes[definition.theme]?.label ?? definition.theme,
								description: promiseDescription(definition, state, content),
								lever: leverLabel(definition, state, content),
								effects: definition.announce.map((effect) =>
									describeEffect(effectRange(effect), content)
								),
								planned: planned(pledgeActionId, target),
								addable: add.addable,
								reason: add.reason
							}
						];
					});
					return {
						campaignId: campaign.campaignId,
						title: electionName(campaign.electionId, state, content),
						detail: `Scrutin au ${formatTurn(ballot?.turn ?? state.turn)}${seats ? ` · Fonction visée : ${seats}` : ''}`,
						made: state.promises.filter((pledge) => pledge.campaignId === campaign.campaignId)
							.length,
						offers
					};
				})
		: [];
	const order = (pledge: PromiseRecord): number => (isOpenPledge(pledge) ? 0 : 1);
	const pledges = [...state.promises]
		.reverse()
		.sort((left, right) => order(left) - order(right))
		.map((pledge): PledgeView => {
			const definition = content.promises[pledge.promiseId];
			const campaign = state.campaigns.find((entry) => entry.campaignId === pledge.campaignId);
			const election = campaign ? electionName(campaign.electionId, state, content) : undefined;
			const inProgress = pledge.status === 'in_progress';
			const prepare =
				inProgress && prepareActionId
					? addability(
							state,
							plan,
							{ kind: 'action', id: prepareActionId, target: pledge.pledgeId },
							content
						)
					: { addable: false, reason: null };
			const lapsed = pledge.status === 'announced' && pledge.closedTurn !== null;
			const recalls = pledge.recalls > 0 ? ` · Rappelée ${pledge.recalls} fois en campagne` : '';
			const detail = inProgress
				? `Échéance : ${formatTurn(pledge.dueTurn ?? state.turn)} — tenue à ${PROMISE_PROGRESS_MAX}, partiellement à ${content.promiseRules.partialProgress}, abandonnée en dessous`
				: pledge.status === 'announced'
					? lapsed
						? `Élection perdue au ${formatTurn(pledge.closedTurn ?? state.turn)} : promesse sans lendemain`
						: 'À réaliser si vous êtes élu'
					: `${PROMISE_STATUS_LABELS[pledge.status]} au ${formatTurn(pledge.closedTurn ?? state.turn)}${recalls}`;
			return {
				pledgeId: pledge.pledgeId,
				label: definition?.label ?? pledge.promiseId,
				theme: definition
					? (content.promiseThemes[definition.theme]?.label ?? definition.theme)
					: '',
				status: lapsed ? 'Sans lendemain' : PROMISE_STATUS_LABELS[pledge.status],
				origin: `${election ?? 'Campagne'} — annoncée au ${formatTurn(pledge.announcedTurn)}`,
				progress: pledge.progress,
				inProgress,
				amended: pledge.amended,
				limited: inProgress && !pledge.leverHeld,
				lever: definition ? leverLabel(definition, state, content) : '',
				detail,
				preparePlanned: planned(prepareActionId, pledge.pledgeId),
				prepareAddable: prepare.addable,
				prepareReason: prepare.reason
			};
		});
	return {
		pledgeActionId,
		prepareActionId,
		maxPerCampaign: content.promiseRules.maxPerCampaign,
		partialProgress: content.promiseRules.partialProgress,
		campaigns,
		pledges
	};
}
