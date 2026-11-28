/**
 * Projection du monde politique et des institutions (fiches partis-gouvernement-monde, institutions).
 *
 * Partie de la projection publique (`PlayerView`, ARCHITECTURE.md §9) : fonctions pures,
 * sans PRNG ni information cachée. Point d’entrée : `../view-model.ts`.
 */
import type { Content } from '../../content/types.ts';
import { INDICATOR_IDS } from '../../content/types.ts';
import type { GameState, PlanStep } from '../../engine/index.ts';
import {
	activationLabel,
	adoptionPercent,
	cohabitation,
	displayName,
	effectRange,
	eraAt,
	evaluateCondition,
	formatTurn,
	partyLedByPlayer,
	primeMinisterId
} from '../../engine/index.ts';
import type { GaugeDescription } from '../format.ts';
import { INDICATOR_NAMES, describeAxisPosition, describeIndicator } from '../format.ts';
import { addability } from './agenda.ts';
import { amounts, careerPartsOf, describeEffect, levelOf } from './shared.ts';

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
	/** Exécutif (P3-35) : président, Premier ministre, cohabitation, prochaine présidentielle. */
	readonly executive: {
		readonly president: string;
		readonly primeMinister: string;
		readonly cohabitation: boolean;
		readonly nextPresidential: string;
	};
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
	/** Époque en cours (P3-07). */
	readonly era: { readonly label: string; readonly description: string };
	/** Institutions modifiables (P3-05). */
	readonly institutions: InstitutionsView;
}

/** Réforme possible d'un paramètre : passage au niveau voisin. */
export interface ReformOptionView {
	readonly levelId: string;
	readonly label: string;
	readonly description: string;
	/** Effets pour le joueur si sa proposition est adoptée. */
	readonly effects: readonly string[];
	readonly planned: boolean;
	readonly addable: boolean;
	readonly reason: string | null;
}

export interface InstitutionParameterView {
	readonly parameterId: string;
	readonly label: string;
	readonly description: string;
	readonly currentLabel: string;
	readonly currentDescription: string;
	/** Échelle des niveaux, dans l'ordre du catalogue. */
	readonly levels: readonly {
		readonly levelId: string;
		readonly label: string;
		readonly current: boolean;
	}[];
	/** Réforme en attente, en clair, sinon `null`. */
	readonly pending: string | null;
	readonly options: readonly ReformOptionView[];
}

export interface InstitutionsView {
	readonly actionId: string | null;
	/** Chance d'adoption d'une proposition du joueur, s'il peut en déposer. */
	readonly adoptionPercent: number | null;
	/** Motif d'indisponibilité de la proposition (mandat manquant…), sinon `null`. */
	readonly lockedReason: string | null;
	readonly parameters: readonly InstitutionParameterView[];
	/** Réformes passées, de la plus récente à la plus ancienne. */
	readonly history: readonly { readonly key: string; readonly text: string }[];
}

export function buildWorld(
	state: GameState,
	plan: readonly PlanStep[],
	content: Content
): WorldView {
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
		executive: (() => {
			const president = state.characters[world.president.characterId];
			const pmId = primeMinisterId(world);
			const pm = pmId ? state.characters[pmId] : undefined;
			const acronym = (partyId: string): string => content.parties[partyId]?.acronym ?? partyId;
			const playerLeads =
				partyLedByPlayer(state.player) === world.governingPartyId ||
				state.mandates.some(
					(mandate) => mandate.status === 'active' && mandate.mandateId === 'mandate.prime_minister'
				);
			return {
				president: `${president ? displayName(president) : 'Le président'} (${acronym(world.president.partyId)})`,
				primeMinister: playerLeads
					? state.mandates.some(
							(mandate) =>
								mandate.status === 'active' && mandate.mandateId === 'mandate.prime_minister'
						)
						? `vous (${acronym(world.governingPartyId)})`
						: `nommé par le président dans votre majorité (${acronym(world.governingPartyId)})`
					: `${pm ? displayName(pm) : '—'} (${acronym(world.governingPartyId)})`,
				cohabitation: cohabitation(world),
				nextPresidential: `Présidentielle au ${formatTurn(world.president.termEndTurn)}`
			};
		})(),
		affiliation:
			memberParty && current
				? `Membre du ${memberParty.name} depuis le ${formatTurn(current.fromTurn)}`
				: 'Sans étiquette',
		partyAcronym: memberParty?.acronym ?? null,
		leave,
		joinActionId,
		joinTimeCost: joinAction?.timeCost ?? 0,
		joinCosts: joinAction ? amounts(joinAction.costs, -1) : [],
		era: (({ label, description }) => ({ label, description }))(eraAt(state.turn, content)),
		institutions: buildInstitutions(state, plan, content)
	};
}

const REFORM_STATUS_TEXT: Readonly<Record<string, string>> = {
	rejected: 'rejetée',
	scheduled: 'adoptée',
	enacted: 'en vigueur',
	proposed: 'proposée'
};

function buildInstitutions(
	state: GameState,
	plan: readonly PlanStep[],
	content: Content
): InstitutionsView {
	const actionId = content.actionIds.find((id) => content.actions[id]?.target === 'reform') ?? null;
	const action = actionId ? content.actions[actionId] : undefined;
	const conditionContext = {
		turn: state.turn,
		player: state.player,
		resources: state.resources,
		upgrades: state.upgrades,
		world: state.world,
		mandates: state.mandates,
		campaigns: state.campaigns,
		institutions: state.institutions,
		staff: state.staff,
		facts: state.facts,
		cases: state.cases,
		promises: state.promises,
		investitures: state.investitures,
		appointment: state.appointment
	};
	const allowed = !action?.requires || evaluateCondition(conditionContext, action.requires);
	const parameters = content.institutionParameterIds.flatMap(
		(parameterId): InstitutionParameterView[] => {
			const parameter = content.institutionParameters[parameterId];
			if (!parameter) return [];
			const currentId = state.institutions.parameters[parameterId] ?? parameter.startLevel;
			const current = parameter.levels.find((level) => level.id === currentId);
			const currentIndex = parameter.levels.findIndex((level) => level.id === currentId);
			const pendingReform = state.institutions.reforms.find(
				(reform) => reform.parameterId === parameterId && reform.status === 'scheduled'
			);
			const pending = pendingReform
				? `${pendingReform.origin === 'government' ? 'Décidé par le gouvernement' : 'Votre réforme a été adoptée'} : « ${levelOf(pendingReform.levelId, content)?.label ?? pendingReform.levelId} » au ${activationLabel(pendingReform.activationTurn ?? state.turn)}.`
				: null;
			const options = actionId
				? parameter.levels
						.filter((_level, index) => Math.abs(index - currentIndex) === 1)
						.map((level): ReformOptionView => {
							const step: PlanStep = { kind: 'action', id: actionId, target: level.id };
							const planned = plan.some(
								(entry) =>
									entry.kind === 'action' && entry.id === actionId && entry.target === level.id
							);
							const add = planned
								? { addable: false, reason: null }
								: addability(state, plan, step, content);
							return {
								levelId: level.id,
								label: level.label,
								description: level.description,
								effects: level.effects.map((effect) =>
									describeEffect(effectRange(effect), content)
								),
								planned,
								addable: add.addable,
								reason: allowed ? add.reason : null
							};
						})
				: [];
			return [
				{
					parameterId,
					label: parameter.label,
					description: parameter.description,
					currentLabel: current?.label ?? currentId,
					currentDescription: current?.description ?? '',
					levels: parameter.levels.map((level) => ({
						levelId: level.id,
						label: level.label,
						current: level.id === currentId
					})),
					pending,
					options
				}
			];
		}
	);
	const history = [...state.institutions.reforms].reverse().map((reform) => {
		const parameter =
			content.institutionParameters[reform.parameterId]?.label ?? reform.parameterId;
		const level = levelOf(reform.levelId, content)?.label ?? reform.levelId;
		const origin = reform.origin === 'government' ? 'gouvernement' : 'votre proposition';
		return {
			key: reform.reformId,
			text: `${formatTurn(reform.proposedTurn)} — ${parameter} : « ${level} » (${origin}, ${REFORM_STATUS_TEXT[reform.status] ?? reform.status})`
		};
	});
	return {
		actionId,
		adoptionPercent: allowed
			? adoptionPercent(state.player, state.world, careerPartsOf(state), content)
			: null,
		lockedReason: allowed ? null : (action?.unavailableReason ?? null),
		parameters,
		history
	};
}
