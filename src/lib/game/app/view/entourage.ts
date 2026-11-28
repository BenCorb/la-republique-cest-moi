/**
 * Projection de l’entourage et du recrutement (fiche entourage-et-recrutement).
 *
 * Partie de la projection publique (`PlayerView`, ARCHITECTURE.md §9) : fonctions pures,
 * sans PRNG ni information cachée. Point d’entrée : `../view-model.ts`.
 */
import type { Content, HireOffer, SearchLevel } from '../../content/types.ts';
import { SEARCH_LEVELS } from '../../content/types.ts';
import type { GameState, PlanStep } from '../../engine/index.ts';
import {
	acceptancePercent,
	activeStaff,
	askedSalaryCents,
	attractiveness,
	attractivenessFactors,
	displayName,
	formatTurn,
	offerBonusCents,
	offeredSalaryCents,
	parseSearchTarget,
	payrollCents,
	postUnlocked,
	progressionTenths,
	searchFindPercent,
	searchRefundCents,
	searchTarget,
	staffTimeBonus
} from '../../engine/index.ts';
import type { GaugeDescription } from '../format.ts';
import { formatResource } from '../format.ts';
import { addability } from './agenda.ts';
import type { PersonView } from './people.ts';
import {
	SEARCH_LABELS,
	STAFF_LEAVE_LABELS,
	describeAttitude,
	findChanceLabel,
	personOf
} from './shared.ts';

export interface StaffPersonView {
	readonly characterId: string;
	readonly name: string;
	readonly age: number;
	readonly competence: GaugeDescription;
	readonly knownTraits: readonly string[];
	readonly unknownTraits: number;
}

export interface PostView {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly salary: string;
	readonly lockedReason: string | null;
	readonly occupant:
		| (StaffPersonView & {
				readonly since: string;
				readonly attitude: string;
				readonly attitudeTone: PersonView['attitudeTone'];
				readonly missions: readonly {
					readonly id: string;
					readonly label: string;
					readonly description: string;
					readonly active: boolean;
				}[];
				readonly producing: boolean;
				/** Salaire convenu au contrat (P3-20). */
				readonly salary: string;
				/**
				 * Prétention à sa compétence actuelle quand elle dépasse le salaire
				 * convenu (P3-21) : une demande d'augmentation viendra au palier suivant.
				 */
				readonly asked: string | null;
				/** Le collaborateur progresse encore en poste (P3-21). */
				readonly progressing: boolean;
				readonly dismissPlanned: boolean;
				readonly dismissable: boolean;
				readonly dismissReason: string | null;
		  })
		| null;
	readonly candidates: readonly CandidateView[];
	/** Recherche de candidats (P3-21) ; `null` si le poste est pourvu ou fermé. */
	readonly search: PostSearchView | null;
}

/** Niveau de recherche proposé pour un poste vacant (P3-21). */
export interface SearchOptionView {
	readonly actionId: string;
	readonly level: SearchLevel;
	readonly label: string;
	readonly cost: string;
	readonly time: number;
	/** « résultat au 2e trimestre 2001 ». */
	readonly due: string;
	/** Chance d'aboutir en mots, sans trait exigé puis avec. */
	readonly chance: string;
	readonly chanceWithTrait: string | null;
	readonly refund: string;
	readonly vetted: boolean;
	readonly traitAllowed: boolean;
	readonly planned: boolean;
	readonly addable: boolean;
	readonly reason: string | null;
}

export interface PostSearchView {
	/** Recherche en cours : niveau, trait exigé et échéance. */
	readonly inProgress: { readonly label: string; readonly due: string } | null;
	readonly options: readonly SearchOptionView[];
	/** Traits publics qu'une recherche ciblée peut exiger. */
	readonly traits: readonly { readonly id: string; readonly label: string }[];
}

/** Offre d'embauche proposée à un candidat (P3-20). */
export interface HireOfferView {
	readonly actionId: string;
	readonly offer: HireOffer | 'counter';
	readonly label: string;
	/** « 1 040 € par trimestre », prime éventuelle comprise en mention. */
	readonly salary: string;
	readonly bonus: string | null;
	/** Intérêt estimé du candidat pour cette offre, en mots. */
	readonly interest: string;
	readonly interestTone: 'good' | 'neutral' | 'warning' | 'danger';
	readonly planned: boolean;
	readonly addable: boolean;
	readonly reason: string | null;
}

export interface CandidateView extends StaffPersonView {
	readonly profile: string;
	/** Contre-proposition en cours (P3-33), en clair, sinon `null`. */
	readonly counter: string | null;
	/** Prétention salariale (P3-20). */
	readonly asked: string;
	/** Une offre est déjà prévue au plan. */
	readonly planned: boolean;
	readonly offers: readonly HireOfferView[];
	/** Entretien approfondi : déjà menés, prévu, possible. */
	readonly interviews: number;
	readonly interviewPlanned: boolean;
	readonly interviewable: boolean;
	readonly interviewReason: string | null;
	/**
	 * Vérification du dossier (P3-21) : `null` tant qu'elle n'a pas eu lieu,
	 * sinon les traits signalés par les références (indices, peut-être faux).
	 */
	readonly hints: readonly string[] | null;
	readonly vetPlanned: boolean;
	readonly vettable: boolean;
	readonly vetReason: string | null;
}

export interface EntourageView {
	readonly posts: readonly PostView[];
	readonly hireActionId: string | null;
	readonly interviewActionId: string | null;
	readonly vetActionId: string | null;
	readonly dismissActionId: string | null;
	/**
	 * Attractivité de la carrière (P3-20) : mot, valeur sur 100 et facteurs
	 * publics. Ce n'est pas une jauge morale.
	 */
	readonly attractiveness: {
		readonly label: string;
		readonly value: number;
		readonly factors: readonly string[];
	};
	/** Masse salariale convenue et trimestres couverts par le budget politique. */
	readonly payroll: { readonly total: string; readonly covered: string | null };
	/** Temps rendu ce trimestre par les missions qui tiennent l'agenda. */
	readonly timeBonus: number;
	readonly former: readonly {
		readonly name: string;
		readonly post: string;
		readonly period: string;
	}[];
}

/** Attractivité de la carrière, en mots (P3-20), du plus haut seuil au plus bas. */
const ATTRACTIVENESS_LABELS: readonly { readonly min: number; readonly label: string }[] = [
	{ min: 75, label: 'Cabinet très recherché' },
	{ min: 50, label: 'Équipe reconnue' },
	{ min: 25, label: 'Équipe en construction' },
	{ min: 0, label: 'Structure émergente' }
];

const OFFER_LABELS: Readonly<Record<HireOffer, string>> = {
	low: 'Offre réduite',
	standard: 'Salaire demandé',
	generous: 'Offre généreuse'
};

/** Intérêt estimé d'un candidat, en mots (aucun chiffre, aucun trait caché). */
function interestOf(percent: number): {
	interest: string;
	interestTone: HireOfferView['interestTone'];
} {
	if (percent >= 80) return { interest: 'Très intéressé', interestTone: 'good' };
	if (percent >= 55) return { interest: 'Intéressé', interestTone: 'neutral' };
	if (percent >= 30) return { interest: 'Hésitant', interestTone: 'warning' };
	return { interest: 'Peu intéressé', interestTone: 'danger' };
}

export function buildEntourage(
	state: GameState,
	plan: readonly PlanStep[],
	content: Content
): EntourageView {
	const offerOf = (id: string): HireOffer | 'counter' | null => {
		for (const effect of content.actions[id]?.effects ?? [])
			if (effect.op === 'hireStaff') return effect.offer ?? 'standard';
		return null;
	};
	const offerActions = content.actionIds.filter(
		(id) => content.actions[id]?.target === 'candidate' && offerOf(id) !== null
	);
	const hireActionId =
		offerActions.find((id) => offerOf(id) === 'standard') ?? offerActions[0] ?? null;
	const interviewActionId =
		content.actionIds.find(
			(id) =>
				content.actions[id]?.target === 'candidate' &&
				content.actions[id]?.effects.some((effect) => effect.op === 'courtCandidate')
		) ?? null;
	const vetActionId =
		content.actionIds.find((id) =>
			content.actions[id]?.effects.some((effect) => effect.op === 'vetCandidate')
		) ?? null;
	const searchActions = SEARCH_LEVELS.flatMap((level) => {
		const id = content.actionIds.find((actionId) =>
			content.actions[actionId]?.effects.some(
				(effect) => effect.op === 'orderSearch' && effect.level === level
			)
		);
		return id === undefined ? [] : [{ level, id }];
	});
	const searchBalance = content.balance.entourage.search;
	const publicTraits = content.traitIds
		.filter((id) => content.traits[id]?.hidden === false)
		.map((id) => ({ id, label: content.traits[id]!.label }));
	const factors = attractivenessFactors(
		state.player,
		state.resources,
		state.mandates,
		state.staff,
		content
	);
	const attraction = attractiveness(factors);
	const recruitment = content.balance.entourage.recruitment;
	const dismissActionId =
		content.actionIds.find((id) => content.actions[id]?.target === 'staff') ?? null;
	const planned = (actionId: string | null, target: string): boolean =>
		actionId !== null &&
		plan.some((step) => step.kind === 'action' && step.id === actionId && step.target === target);
	const posts: PostView[] = content.postIds.map((postId) => {
		const post = content.posts[postId]!;
		const member = activeStaff(state.staff).find((entry) => entry.postId === postId);
		const unlocked = postUnlocked(postId, state, content);
		const occupant = member
			? (() => {
					const relationship = state.relationships[member.characterId];
					const dismiss = dismissActionId
						? addability(
								state,
								plan,
								{ kind: 'action', id: dismissActionId, target: member.characterId },
								content
							)
						: { addable: false, reason: null };
					return {
						...personOf(state, member.characterId, content),
						since: `En poste depuis le ${formatTurn(member.hiredTurn)}`,
						...describeAttitude(relationship?.attitude ?? 0),
						missions: post.missions.map((mission) => ({
							id: mission.id,
							label: mission.label,
							description: mission.description,
							active: mission.id === member.missionId
						})),
						producing: member.hiredTurn < state.turn,
						salary: `${formatResource('politicalBudgetCents', member.salaryCents)} par trimestre`,
						asked: (() => {
							const asked = askedSalaryCents(
								postId,
								state.characters[member.characterId]?.competence ?? 0,
								content
							);
							return asked > member.salaryCents
								? `${formatResource('politicalBudgetCents', asked)} par trimestre`
								: null;
						})(),
						progressing:
							progressionTenths(state.characters[member.characterId]?.competence ?? 0, content) > 0,
						dismissPlanned: planned(dismissActionId, member.characterId),
						dismissable: dismiss.addable,
						dismissReason: dismiss.reason
					};
				})()
			: null;
		const candidates = member
			? []
			: (state.shortlists[postId] ?? []).flatMap((entry) => {
					const character = state.characters[entry.characterId];
					if (!character || character.status !== 'active') return [];
					// Contre-proposition (P3-33) : l'offre à son montant n'existe que pendant sa validité.
					const offers = offerActions.flatMap((actionId): HireOfferView[] => {
						const offer = offerOf(actionId)!;
						if (offer === 'counter' && entry.counterOffer === null) return [];
						const salary =
							offer === 'counter'
								? entry.counterOffer!.salaryCents
								: offeredSalaryCents(postId, character.competence, offer, content);
						const bonus = offer === 'counter' ? 0 : offerBonusCents(salary, offer, content);
						const add = addability(
							state,
							plan,
							{ kind: 'action', id: actionId, target: entry.characterId },
							content
						);
						const interest =
							offer === 'counter'
								? { interest: 'acceptée à coup sûr', interestTone: 'good' as const }
								: interestOf(
										acceptancePercent(
											attraction,
											character.competence,
											offer,
											entry.interviews,
											content
										)
									);
						return [
							{
								actionId,
								offer,
								label: offer === 'counter' ? 'Accepter sa contre-proposition' : OFFER_LABELS[offer],
								salary: `${formatResource('politicalBudgetCents', salary)} par trimestre`,
								bonus:
									bonus > 0
										? `prime de ${formatResource('politicalBudgetCents', bonus)} à l’arrivée`
										: null,
								...interest,
								planned: planned(actionId, entry.characterId),
								addable: add.addable,
								reason: add.reason
							}
						];
					});
					const vet = vetActionId
						? addability(
								state,
								plan,
								{ kind: 'action', id: vetActionId, target: entry.characterId },
								content
							)
						: { addable: false, reason: null };
					const interview = interviewActionId
						? addability(
								state,
								plan,
								{ kind: 'action', id: interviewActionId, target: entry.characterId },
								content
							)
						: { addable: false, reason: null };
					return [
						{
							...personOf(state, entry.characterId, content),
							profile:
								content.candidateProfiles.find((profile) => profile.id === entry.profileId)
									?.label ?? '',
							asked: `${formatResource('politicalBudgetCents', askedSalaryCents(postId, character.competence, content))} par trimestre`,
							counter: entry.counterOffer
								? `A décliné votre offre ; accepterait ${formatResource('politicalBudgetCents', entry.counterOffer.salaryCents)} par trimestre, réponse attendue avant la fin du ${formatTurn(entry.counterOffer.untilTurn)}.`
								: null,
							planned: offers.some((offer) => offer.planned),
							offers,
							interviews: entry.interviews,
							interviewPlanned:
								interviewActionId !== null && planned(interviewActionId, entry.characterId),
							interviewable: interview.addable,
							interviewReason: interview.reason,
							hints:
								entry.hints === null
									? null
									: entry.hints.map((trait) => content.traits[trait]?.label ?? trait),
							vetPlanned: vetActionId !== null && planned(vetActionId, entry.characterId),
							vettable: vet.addable,
							vetReason: vet.reason
						}
					];
				});
		const pending = state.searches.find((entry) => entry.postId === postId);
		const plannedSearch = (actionId: string): boolean =>
			plan.some(
				(step) =>
					step.kind === 'action' &&
					step.id === actionId &&
					step.target !== undefined &&
					parseSearchTarget(step.target).postId === postId
			);
		const search: PostSearchView | null =
			member || !unlocked
				? null
				: {
						inProgress: pending
							? {
									label: `${SEARCH_LABELS[pending.level]}${pending.trait ? `, profil « ${content.traits[pending.trait]?.label ?? pending.trait} »` : ''}`,
									due: `résultat attendu au ${formatTurn(pending.dueTurn)}`
								}
							: null,
						options: searchActions.map(({ level, id }): SearchOptionView => {
							const action = content.actions[id]!;
							const balance = searchBalance.levels[level];
							const add = addability(
								state,
								plan,
								{ kind: 'action', id, target: searchTarget(postId, null) },
								content
							);
							return {
								actionId: id,
								level,
								label: action.label,
								cost: formatResource('politicalBudgetCents', balance.costCents),
								time: action.timeCost,
								due: `résultat au ${formatTurn(state.turn + balance.delayTurns)}`,
								chance: findChanceLabel(searchFindPercent(level, null, content)),
								chanceWithTrait: balance.traitAllowed
									? findChanceLabel(searchFindPercent(level, publicTraits[0]?.id ?? null, content))
									: null,
								refund: `${formatResource('politicalBudgetCents', searchRefundCents(level, content))} rendus en cas d’échec`,
								vetted: balance.vetting !== null,
								traitAllowed: balance.traitAllowed,
								planned: plannedSearch(id),
								addable: add.addable,
								reason: add.reason
							};
						}),
						traits: publicTraits
					};
		return {
			id: postId,
			label: post.label,
			description: post.description,
			salary: `Référence : ${formatResource('politicalBudgetCents', post.salaryCents)} par trimestre`,
			lockedReason: unlocked ? null : (post.unavailableReason ?? 'Poste pas encore accessible.'),
			occupant,
			candidates,
			search
		};
	});
	const payroll = payrollCents(state.staff);
	return {
		posts,
		hireActionId,
		interviewActionId,
		vetActionId,
		dismissActionId,
		attractiveness: {
			label: ATTRACTIVENESS_LABELS.find((entry) => attraction >= entry.min)!.label,
			value: attraction,
			factors: [
				`Influence ${factors.influence}/${recruitment.influenceMax}`,
				`Popularité ${factors.popularity}/${recruitment.popularityMax}`,
				`Mandat ${factors.mandate}/${recruitment.mandateMax}`,
				`Appareil ${factors.apparatus}/${recruitment.apparatusMax}`,
				`Budget ${factors.payroll}/${recruitment.payrollMax}`
			]
		},
		payroll: {
			total: `${formatResource('politicalBudgetCents', payroll)} par trimestre`,
			covered:
				payroll > 0
					? `${Math.floor(state.resources.politicalBudgetCents / payroll)} trimestre(s) couvert(s) par le budget politique`
					: null
		},
		timeBonus: staffTimeBonus(state.staff, state.characters, state.turn, content),
		former: state.staff
			.filter((member) => member.status === 'left')
			.map((member) => ({
				name: displayName(state.characters[member.characterId]!),
				post: content.posts[member.postId]?.label ?? member.postId,
				period: `${formatTurn(member.hiredTurn)} – ${formatTurn(member.leftTurn ?? member.hiredTurn)} (${STAFF_LEAVE_LABELS[member.leaveReason ?? 'resigned']})`
			}))
			.reverse()
	};
}
