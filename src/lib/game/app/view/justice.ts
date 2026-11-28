/**
 * Projection des faits et dossiers judiciaires (fiche justice).
 *
 * Partie de la projection publique (`PlayerView`, ARCHITECTURE.md §9) : fonctions pures,
 * sans PRNG ni information cachée. Point d’entrée : `../view-model.ts`.
 */
import type { Content } from '../../content/types.ts';
import type { GameState, LegalCase, Sentence } from '../../engine/index.ts';
import {
	currentJudicialRisk,
	divertedFunds,
	formatTurn,
	isIneligible
} from '../../engine/index.ts';
import type { GaugeDescription } from '../format.ts';
import { describeDefense, describeExposure, describeJudicialRisk, formatMoney } from '../format.ts';
import { joinParts } from './shared.ts';

export interface FactView {
	readonly key: string;
	readonly dateLabel: string;
	readonly offense: string;
	/** « auteur » ou « complice ». */
	readonly involvement: string;
	readonly severity: string;
	/** Points de risque encore apportés (avant majoration par l'exposition). */
	readonly riskPoints: number;
	readonly prescribed: boolean;
	/** Le fait a été révélé : il relève désormais de son dossier. */
	readonly inCase: boolean;
}

export interface CaseView {
	readonly key: string;
	readonly offense: string;
	/** « vous » ou le nom du proche poursuivi. */
	readonly defendant: string;
	readonly opened: string;
	/** Étape ou issue, en clair. */
	readonly status: string;
	/** Prochaine échéance, `null` une fois clos. */
	readonly due: string | null;
	readonly sentence: string | null;
	readonly closed: boolean;
}

export interface JusticeView {
	readonly exposure: GaugeDescription;
	readonly risk: GaugeDescription;
	readonly defense: GaugeDescription;
	/** Dossiers, en cours d'abord puis clos, du plus récent au plus ancien. */
	readonly cases: readonly CaseView[];
	/** Fin de l'inéligibilité, `null` si le joueur est éligible. */
	readonly ineligibleUntil: string | null;
	/** Majoration du risque due à l'exposition, en points. */
	readonly exposureBonus: number;
	/** Faits du registre, du plus récent au plus ancien. */
	readonly facts: readonly FactView[];
	/** Fonds détournés cumulés, formatés (statistique de bilan). */
	readonly diverted: string;
}

const SEVERITY_LABELS = ['', 'indélicatesse', 'faute', 'affaire d’envergure'] as const;

const STAGE_LABELS = {
	investigation: 'enquête préliminaire',
	indicted: 'mise en examen, procès à venir',
	appeal: 'condamné en première instance, en appel',
	closed: 'clos'
} as const;

const OUTCOME_LABELS = {
	dismissed: 'classé sans suite',
	acquitted: 'relaxe',
	convicted: 'condamnation définitive'
} as const;

function sentenceText(sentence: Sentence): string {
	return joinParts(
		sentence.fineCents > 0 ? `amende de ${formatMoney(sentence.fineCents)}` : '',
		sentence.ineligibilityTurns > 0
			? `inéligibilité de ${sentence.ineligibilityTurns} trimestres`
			: '',
		sentence.prison === 'firm'
			? 'prison ferme'
			: sentence.prison === 'suspended'
				? 'prison avec sursis'
				: ''
	);
}

function caseView(legalCase: LegalCase, state: GameState, content: Content): CaseView {
	const fact = state.facts.find((entry) => entry.factId === legalCase.factId);
	return {
		key: legalCase.caseId,
		offense: content.offenses[fact?.offenseId ?? '']?.label ?? legalCase.factId,
		defendant:
			legalCase.defendantId === null
				? 'vous'
				: (state.characters[legalCase.defendantId]?.name ?? legalCase.defendantId),
		opened: formatTurn(legalCase.openedTurn),
		status: legalCase.outcome ? OUTCOME_LABELS[legalCase.outcome] : STAGE_LABELS[legalCase.stage],
		due: legalCase.dueTurn === null ? null : formatTurn(legalCase.dueTurn),
		sentence: legalCase.sentence ? sentenceText(legalCase.sentence) || null : null,
		closed: legalCase.stage === 'closed'
	};
}

export function buildJustice(state: GameState, content: Content): JusticeView {
	const risk = currentJudicialRisk(state, content);
	const points = new Map(risk.contributions.map((entry) => [entry.factId, entry.points]));
	return {
		exposure: describeExposure(state.player.exposure),
		risk: describeJudicialRisk(risk.value),
		defense: describeDefense(state.player.defense),
		cases: [...state.cases]
			.reverse()
			.sort((left, right) => Number(left.stage === 'closed') - Number(right.stage === 'closed'))
			.map((legalCase) => caseView(legalCase, state, content)),
		ineligibleUntil: isIneligible(state.player, state.turn)
			? formatTurn(state.player.ineligibleUntil!)
			: null,
		exposureBonus: risk.exposureBonus,
		facts: [...state.facts].reverse().map((fact) => ({
			key: fact.factId,
			dateLabel: formatTurn(fact.turn),
			offense: content.offenses[fact.offenseId]?.label ?? fact.offenseId,
			involvement: fact.authorId === null ? 'auteur' : 'complice',
			severity: SEVERITY_LABELS[fact.severity] ?? String(fact.severity),
			riskPoints: points.get(fact.factId) ?? 0,
			prescribed: state.turn - fact.turn >= content.justice.prescriptionTurns,
			inCase: state.cases.some((legalCase) => legalCase.factId === fact.factId)
		})),
		diverted: formatMoney(divertedFunds(state.facts))
	};
}
