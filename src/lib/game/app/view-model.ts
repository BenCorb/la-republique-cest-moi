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
	type Effect,
	PROMISE_PROGRESS_MAX,
	type PromiseStatus,
	type ResourceAmount,
	type ResourceId
} from '../content/types.ts';
import {
	accelerationAlerts,
	ageAt,
	campaignRefund,
	careerSummary,
	currentJudicialRisk,
	assetIncome,
	assetProceeds,
	assetsValue,
	netWorth,
	caseStepMessage,
	isIneligible,
	divertedFunds,
	describePendingEvent,
	effectRange,
	formatTurn,
	placeOf,
	previewPlan,
	renderTemplate,
	type ChoiceRecord,
	type EffectRange,
	type GameState,
	type LegalCase,
	type Sentence,
	type HistoryEntry,
	type PeopleChange,
	type PlanStep,
	type CharactersRecord,
	displayName,
	type PoliticalChange,
	type Ballot,
	type DeadlinesRecord,
	type MandateEndReason,
	type PromiseChange,
	type PromiseRecord,
	isOpenPledge,
	type Article,
	activationLabel,
	adoptionPercent,
	distinctionsOf,
	highestOffice,
	legacyMetrics,
	obituaryOf,
	eraAt,
	eraReached,
	effectiveContent,
	evaluateCondition,
	type CareerParts,
	type QuarterSnapshot,
	followsPlayer,
	ownedMedia,
	type StaffLeaveReason,
	activeMandates,
	activeStaff,
	countsTowardCumul,
	cumulatedMandates,
	type MandateInstance,
	campaignPoll,
	livingChildren,
	pollingCompetence,
	postUnlocked,
	staffTimeBonus,
	hashSeed,
	mainMandate,
	reservedTime,
	type WellbeingSource,
	type WorldRecord,
	type PlanPreview,
	type FamilyRecord,
	type StaffRecord
} from '../engine/index.ts';
import {
	GAUGE_NAMES,
	INDICATOR_NAMES,
	RESOURCE_NAMES,
	describeAxisPosition,
	describeCompetence,
	describePopularity,
	describeSupport,
	describeHealth,
	describeIndicator,
	describeStress,
	describeExposure,
	describeJudicialRisk,
	describeDefense,
	formatDelta,
	formatMoney,
	formatGaugeDelta,
	formatCompactRange,
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
	/** Sens de la variation prévue (flèche de la tuile) : hausse, stable, baisse. */
	readonly trend: -1 | 0 | 1;
}

/** Sens d'une pastille pour le joueur (P3-26) : gain, coût, risque ou neutre. */
export type ChipSense = 'gain' | 'cost' | 'risk' | 'neutral';

/**
 * Pastille de coût ou d'effet (P3-26, DESIGN.md §10.4) : identité visuelle,
 * valeur compacte et sens, plus la phrase complète pour l'accessibilité et le
 * détail. Construite à partir des seuls effets certains déjà affichés.
 */
export interface ChipView {
	/** Clé de la table d'identité (ressource, jauge, groupe) ; `null` : pastille de texte. */
	readonly identity: string | null;
	/** « +1–3 », « −20 € » ; la phrase complète si `identity` est `null`. */
	readonly value: string;
	readonly sense: ChipSense;
	/** Fourchette : la valeur finale dépend du tirage. */
	readonly variable: boolean;
	/** Phrase complète (« Budget politique − 20 € »). */
	readonly text: string;
}

export interface PlanStepView {
	readonly index: number;
	readonly kind: PlanStep['kind'];
	readonly label: string;
	readonly timeCost: number;
	readonly details: readonly string[];
	/** Coûts et effets de l'étape en pastilles (P3-26), dans l'ordre de `details`. */
	readonly chips: readonly ChipView[];
	readonly issues: readonly string[];
	/** Achat : rappel que la production commence au trimestre suivant. */
	readonly note: string | null;
	/** Épinglée : répétée chaque trimestre (P3-11) ; un achat ne l'est jamais. */
	readonly pinned: boolean;
	/** Thème de l'agenda de l'action (P3-26, couleur de la barre de temps) ; `null` sinon. */
	readonly category: string | null;
}

export interface PlanView {
	readonly steps: readonly PlanStepView[];
	/** Étapes épinglées, seules répétées aux trimestres suivants (P3-11). */
	readonly pinnedCount: number;
	/** Retraits automatiques du trimestre en cours, avec leur motif (P3-11). */
	readonly adjustments: readonly string[];
	readonly timeAvailable: number;
	/** Temps réservé par les mandats, déjà retiré du temps disponible. */
	readonly timeReserved: number;
	readonly timeUsed: number;
	readonly timeRemaining: number;
	readonly valid: boolean;
	readonly issues: readonly string[];
	readonly warnings: readonly string[];
	readonly changes: readonly { readonly name: string; readonly text: string }[];
	/** Mêmes variations prévues, en pastilles (P3-26). */
	readonly changeChips: readonly ChipView[];
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
	/** Coûts en pastilles (P3-26), dans l'ordre de `costs`. */
	readonly costChips: readonly ChipView[];
	/** Effets en pastilles (P3-26), dans l'ordre de `effects`. */
	readonly effectChips: readonly ChipView[];
	/** Thème de l'agenda (catégorie du catalogue), pour l'icône et la couleur. */
	readonly category: string | null;
	/** Occurrences déjà dans le plan. */
	readonly planned: number;
	readonly addable: boolean;
	/** Raison pour laquelle l'élément ne peut pas être ajouté au plan. */
	readonly reason: string | null;
	/**
	 * Hors de portée : une condition n'est pas remplie (autre profession, pas
	 * d'adhésion, pas de campagne, influence insuffisante…), par opposition à un
	 * blocage du trimestre (temps, argent, limite atteinte).
	 */
	readonly outOfReach: boolean;
}

/** Thème de l'agenda : actions à portée, et actions hors de portée affichées à la demande. */
export interface ActionGroupView {
	readonly id: string;
	readonly label: string;
	readonly actions: readonly CatalogItemView[];
	readonly outOfReach: readonly CatalogItemView[];
}

export interface UpgradeView extends CatalogItemView {
	readonly family: string;
	readonly treasury: string;
	readonly upkeep: readonly string[];
	readonly owned: number;
	readonly maxOwned: number;
}

export interface AssetView {
	readonly instanceId: string;
	readonly label: string;
	readonly acquired: string;
	readonly value: string;
	/** Revenu du trimestre en cours, `null` avant le premier trimestre actif. */
	readonly income: string | null;
	readonly proceeds: string;
	readonly lost: boolean;
	readonly sale: {
		readonly step: PlanStep | null;
		readonly reason: string | null;
		readonly planned: boolean;
	};
}

export interface WealthView {
	readonly netWorth: string;
	readonly cash: string;
	readonly assetsValue: string;
	readonly lifestyle: {
		readonly label: string;
		readonly description: string;
		readonly cost: string;
	};
	/** Changements de train de vie planifiables. */
	readonly lifestyleActions: readonly CatalogItemView[];
	readonly owned: readonly AssetView[];
	readonly offers: readonly UpgradeView[];
}

export interface ProducerView {
	readonly instanceId: string;
	readonly upgradeId: string;
	readonly label: string;
	readonly status: 'active' | 'suspended' | 'pending';
	readonly statusLabel: string;
	readonly upkeep: readonly string[];
	readonly production: readonly string[];
}

/**
 * Éléments de l'organisation regroupés par type (« Militant bénévole × 4 ») :
 * effectifs, charges et production cumulées ce trimestre, départ planifiable.
 */
export interface OrganisationGroupView {
	readonly upgradeId: string;
	readonly label: string;
	/** Exemplaires possédés au début du trimestre. */
	readonly owned: number;
	readonly active: number;
	readonly pending: number;
	readonly suspended: number;
	/** Départs déjà prévus dans le plan. */
	readonly releasesPlanned: number;
	readonly upkeep: readonly string[];
	readonly production: readonly string[];
	/** Effets propres d'un départ (par exemple sur les militants). */
	readonly releaseEffects: readonly string[];
	/** Prochain départ possible : étape à ajouter au plan, ou motif du refus. */
	readonly release: { readonly step: PlanStep | null; readonly reason: string | null } | null;
}

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
}

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

export interface Alert {
	readonly level: 'danger' | 'warning' | 'info';
	readonly text: string;
}

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
}

export interface CareerView {
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

/** Bouton d'une action ciblant un média (interview, déjeuner). */
export interface MediaActionView {
	readonly actionId: string;
	readonly label: string;
	readonly planned: boolean;
	readonly addable: boolean;
	readonly reason: string | null;
}

/** Média du catalogue et sa relation au joueur (P3-03). */
export interface MediaOutletView {
	readonly mediaId: string;
	readonly name: string;
	readonly kindLabel: string;
	readonly line: string;
	readonly description: string;
	readonly audienceLabel: string;
	readonly relationLabel: string;
	readonly owned: boolean;
	/** Le média suit-il le joueur (média local, ou exposition suffisante) ? */
	readonly follows: boolean;
	readonly actions: readonly MediaActionView[];
}

export interface MediaView {
	readonly outlets: readonly MediaOutletView[];
	/** Seuil d'exposition au-delà duquel les médias nationaux suivent le joueur. */
	readonly nationalExposure: number;
}

/** Article du fil de presse (P3-03). */
export interface PressItemView {
	readonly key: string;
	readonly dateLabel: string;
	readonly media: string;
	readonly title: string;
	/** L'article concerne le joueur (sinon : nouvelle d'ambiance). */
	readonly aboutPlayer: boolean;
	readonly toneLabel: string | null;
	/** Information critique (article défavorable), à distinguer de l'ambiance. */
	readonly critical: boolean;
	/** Effets sur les soutiens, en clair (vide si aucun). */
	readonly effects: string;
}

/** Promesse type que le candidat peut annoncer (P3-04). */
export interface PromiseOfferView {
	readonly promiseId: string;
	readonly label: string;
	readonly theme: string;
	readonly description: string;
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
	/** Échéance (en cours), issue datée ou rappels. */
	readonly detail: string;
	readonly preparePlanned: boolean;
	readonly prepareAddable: boolean;
	readonly prepareReason: string | null;
}

export interface PromisesView {
	readonly pledgeActionId: string | null;
	readonly prepareActionId: string | null;
	readonly maxPerCampaign: number;
	readonly partialProgress: number;
	/** Engagements possibles pendant une campagne en cours (vide sinon). */
	readonly offers: readonly PromiseOfferView[];
	/** Promesses ouvertes d'abord, puis closes, des plus récentes aux plus anciennes. */
	readonly pledges: readonly PledgeView[];
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
				readonly dismissPlanned: boolean;
				readonly dismissable: boolean;
				readonly dismissReason: string | null;
		  })
		| null;
	readonly candidates: readonly (StaffPersonView & {
		readonly profile: string;
		readonly planned: boolean;
		readonly hireable: boolean;
		readonly reason: string | null;
	})[];
}

export interface EntourageView {
	readonly posts: readonly PostView[];
	readonly hireActionId: string | null;
	readonly dismissActionId: string | null;
	/** Temps rendu ce trimestre par les missions qui tiennent l'agenda. */
	readonly timeBonus: number;
	readonly former: readonly {
		readonly name: string;
		readonly post: string;
		readonly period: string;
	}[];
}

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

function buildJustice(state: GameState, content: Content): JusticeView {
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

/**
 * Tendance d'une ressource ou d'une jauge sur les derniers trimestres (P3-08) :
 * valeurs en fin de trimestre, de la plus ancienne à l'actuelle.
 */
export interface TrendView {
	readonly id: string;
	readonly label: string;
	readonly points: readonly number[];
	/** Valeur actuelle, formatée. */
	readonly current: string;
	/** Variation sur la période, formatée (« + 12 », « − 3 400 € »), `null` si nulle. */
	readonly change: string | null;
	/** Sens de la variation pour le joueur : favorable, défavorable ou neutre. */
	readonly mood: 'good' | 'bad' | 'neutral';
	/** Résumé accessible : période, départ et arrivée. */
	readonly description: string;
}

/** Territoire d'origine (P3-16), affiché dans l'en-tête et au bilan. */
export interface TerritoryView {
	readonly town: string;
	/** « Petite ville ouvrière et rurale ». */
	readonly description: string;
	readonly department: string;
	readonly region: string;
}

export interface PlayerView {
	/** Tendances des derniers trimestres (P3-08), vides en début de carrière. */
	readonly trends: readonly TrendView[];
	readonly territory: TerritoryView;
	readonly dateLabel: string;
	readonly age: number;
	readonly phase: GameState['phase'];
	readonly resources: readonly ResourceView[];
	readonly health: GaugeDescription;
	readonly stress: GaugeDescription;
	/** Exposition médiatique, risque judiciaire et registre des faits (P3-01). */
	readonly justice: JusticeView;
	readonly plan: PlanView;
	readonly actions: readonly CatalogItemView[];
	/** Actions de l'agenda regroupées par thème, dans l'ordre du catalogue ; groupes vides omis. */
	readonly actionGroups: readonly ActionGroupView[];
	readonly upgrades: readonly UpgradeView[];
	/** Patrimoine personnel (P3-02). */
	readonly wealth: WealthView;
	readonly producers: readonly ProducerView[];
	readonly organisation: readonly OrganisationGroupView[];
	readonly decision: DecisionView | null;
	readonly journal: readonly JournalTurnView[];
	/** Fil de presse : articles des derniers trimestres, du plus récent au plus ancien. */
	readonly press: readonly PressItemView[];
	/** Écran Actualités (P3-08) : articles regroupés par trimestre, du plus récent au plus ancien. */
	readonly news: readonly {
		readonly key: string;
		readonly label: string;
		readonly items: readonly PressItemView[];
	}[];
	readonly alerts: readonly Alert[];
	readonly summary: SummaryView | null;
	readonly world: WorldView;
	/** Personnages rencontrés : actifs d'abord, puis par date de rencontre. */
	readonly people: readonly PersonView[];
	/** Profil du personnage : origine, profession et situation familiale. */
	readonly profile: {
		readonly origin: string;
		readonly profession: string;
		readonly family: string;
	};
	readonly career: CareerView;
	readonly supports: SupportsView;
	readonly entourage: EntourageView;
}

const FAMILY_LABELS: Readonly<Record<string, string>> = {
	organization: 'Organisation',
	communication: 'Communication',
	network: 'Réseau',
	personal: 'Vie personnelle'
};

const SOURCE_LABELS: { readonly [K in WellbeingSource]: string } = {
	workload: 'charge de travail',
	comfort: 'confort',
	recovery: 'récupération',
	high_stress: 'stress élevé',
	calm: 'calme retrouvé',
	ageing: 'âge'
};

const CAUSE_LABELS = {
	health_failure: 'Épuisement : la santé a fini par céder.',
	natural_causes: 'Mort naturelle.',
	prison: 'Condamnation définitive à de la prison ferme.'
} as const;

function amounts(list: readonly ResourceAmount[], sign: 1 | -1): string[] {
	return list.map(
		(amount) =>
			`${RESOURCE_NAMES[amount.resource]} ${formatDelta(amount.resource, sign * amount.amount)}`
	);
}

function senseOf(direction: number): ChipSense {
	return direction > 0 ? 'gain' : direction < 0 ? 'cost' : 'neutral';
}

/** Coûts ou productions en pastilles (P3-26), dans l'ordre d'`amounts`. */
function amountChips(list: readonly ResourceAmount[], sign: 1 | -1): ChipView[] {
	return list.map((amount) => {
		const delta = sign * amount.amount;
		return {
			identity: amount.resource,
			value: formatCompactRange(amount.resource, delta, delta),
			sense: senseOf(delta),
			variable: false,
			text: `${RESOURCE_NAMES[amount.resource]} ${formatDelta(amount.resource, delta)}`
		};
	});
}

/** Pastille de texte (effet qualitatif : adhésion, mandat, promesse…). */
function textChip(text: string, sense: ChipSense = 'neutral'): ChipView {
	return { identity: null, value: text, sense, variable: false, text };
}

/**
 * Effet en pastille (P3-26) : même source que `describeEffect`, donc rien de plus
 * que les effets certains déjà annoncés. Une hausse du stress est un coût ;
 * l'exposition reste neutre (ni bonne ni mauvaise en soi, §8.4 bis).
 */
function effectChip(range: EffectRange, content: Content): ChipView {
	const text = describeEffect(range, content);
	switch (range.kind) {
		case 'resource':
			return {
				identity: range.resource,
				value: formatCompactRange(range.resource, range.min, range.max),
				sense: senseOf(range.min + range.max),
				variable: range.min !== range.max,
				text
			};
		case 'gauge': {
			const direction = Math.sign(range.min);
			const sense =
				range.gauge === 'player.exposure'
					? 'neutral'
					: senseOf(range.gauge === 'player.stress' ? -direction : direction);
			return {
				identity: range.gauge,
				value: formatCompactRange(null, range.min, range.min),
				sense,
				variable: false,
				text
			};
		}
		case 'support':
			return {
				identity: range.group,
				value: formatCompactRange(null, range.value, range.value),
				sense: senseOf(range.value),
				variable: false,
				text
			};
		case 'preparation':
			return {
				identity: 'preparation',
				value: formatCompactRange(null, range.value, range.value),
				sense: 'gain',
				variable: false,
				text
			};
		case 'fact':
			return { identity: 'justice.risk', value: 'Risque', sense: 'risk', variable: false, text };
		case 'media':
			return textChip(text, range.change === 'interview' ? 'neutral' : senseOf(range.value));
		default:
			return textChip(text);
	}
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
		case 'candidacy':
			return 'Candidature déposée';
		case 'fact':
			return `Fait inscrit au registre : ${content.offenses[range.offense]?.label ?? range.offense}`;
		case 'lifestyle':
			return content.lifestyles[range.lifestyle]?.label ?? range.lifestyle;
		case 'family':
			return range.change === 'attitude'
				? `Famille ${range.value > 0 ? 'apaisée' : 'agacée'}`
				: 'Vie de famille';
		case 'staff':
			return STAFF_CHANGE_LABELS[range.change];
		case 'release':
			return 'Départ de l’organisation';
		case 'preparation':
			return `Préparation de campagne + ${range.value}`;
		case 'promise':
			return range.change === 'make'
				? 'Engagement inscrit au registre des promesses'
				: range.change === 'advance'
					? `Avancement de la promesse + ${range.value}`
					: range.change === 'amend'
						? 'Promesse amendée'
						: 'Promesse abandonnée';
		case 'reform':
			return 'Réforme soumise au vote à la fin du trimestre';
		case 'media':
			return range.change === 'interview'
				? 'Interview publiée à la fin du trimestre'
				: `Relation (${range.media === 'target' ? 'média choisi' : (content.media[range.media]?.name ?? range.media)}) ${formatGaugeDelta(range.value)}`;
	}
}

/** Étapes d'une promesse, en clair (journal). */
const PROMISE_CHANGE_LABELS: { readonly [K in PromiseChange]: string } = {
	made: 'engagement pris',
	started: 'élu, place à la réalisation',
	lapsed: 'élection perdue, promesse sans lendemain',
	amended: 'compromis : au mieux partiellement tenue',
	kept: 'promesse tenue',
	partial: 'promesse partiellement tenue',
	abandoned: 'promesse abandonnée',
	recalled: 'promesse rappelée en campagne'
};

/** États d'une promesse, en clair (registre). */
export const PROMISE_STATUS_LABELS: { readonly [K in PromiseStatus]: string } = {
	announced: 'Annoncée',
	in_progress: 'En cours',
	kept: 'Tenue',
	partial: 'Partiellement tenue',
	abandoned: 'Abandonnée'
};

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
				case 'candidacy':
					return change.invested
						? 'candidature déposée avec l’investiture du parti'
						: 'candidature déposée sans investiture';
				case 'preparation':
					return `préparation de campagne + ${change.delta}`;
				case 'familyJoined':
					return change.relation === 'partner'
						? 'une nouvelle vie à deux'
						: 'une naissance dans la famille';
				case 'separated':
					return 'une séparation';
				case 'hired':
					return `embauche au poste « ${content.posts[change.postId]?.label ?? change.postId} »`;
				case 'staffLeft':
					return `départ du poste « ${content.posts[change.postId]?.label ?? change.postId} » (${STAFF_LEAVE_LABELS[change.reason]})`;
				case 'earlyElection':
					return `${content.elections[change.electionId]?.label ?? change.electionId} anticipées au ${formatTurn(change.turn)}`;
				case 'fact':
					return `fait inscrit au registre : ${content.offenses[change.offenseId]?.label ?? change.offenseId}`;
				case 'promise':
					return `« ${content.promises[change.promiseId]?.label ?? change.promiseId} » : ${PROMISE_CHANGE_LABELS[change.change]}`;
				case 'promiseProgress':
					return `« ${content.promises[change.promiseId]?.label ?? change.promiseId} » : avancement + ${change.delta}`;
				case 'mediaRelation':
					return `relation avec ${content.media[change.mediaId]?.name ?? change.mediaId} ${change.delta > 0 ? 'améliorée' : 'dégradée'}`;
				case 'interview':
					return `interview accordée à ${content.media[change.mediaId]?.name ?? change.mediaId}`;
				case 'reform': {
					const parameter =
						content.institutionParameters[change.parameterId]?.label ?? change.parameterId;
					const level = levelOf(change.levelId, content)?.label ?? change.levelId;
					const who = change.origin === 'government' ? 'le gouvernement' : 'vous';
					return change.change === 'proposed'
						? `réforme proposée — ${parameter} : « ${level} »`
						: change.change === 'adopted'
							? `réforme adoptée (${who}) — ${parameter} : « ${level} »`
							: change.change === 'rejected'
								? `réforme rejetée — ${parameter} : « ${level} »`
								: `entrée en vigueur — ${parameter} : « ${level} »`;
				}
			}
		})
		.join(', ');
}

const STAFF_LEAVE_LABELS: { readonly [K in StaffLeaveReason]: string } = {
	resigned: 'démission',
	dismissed: 'renvoi',
	poached: 'débauchage',
	retired: 'retraite',
	died: 'décès'
};

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
	for (const result of record.campaigns) {
		const campaign = state.campaigns.find((entry) => entry.campaignId === result.campaignId);
		const label = content.elections[campaign?.electionId ?? '']?.label ?? 'Élection';
		const rival = result.opponentId ? state.characters[result.opponentId] : undefined;
		const against = rival ? ` face à ${displayName(rival)}` : '';
		lines.push({
			kind: 'career',
			text:
				result.status === 'won'
					? `${label} : vous l’emportez avec ${result.playerPercent} %${against}.`
					: result.status === 'lost'
						? `${label} : défaite avec ${result.playerPercent} %${against}. La notoriété progresse, la fatigue aussi.`
						: `${label} : candidature invalidée (${result.reason ?? 'conditions non remplies'}).`
		});
		const definition = content.elections[campaign?.electionId ?? ''];
		const refund = definition
			? campaignRefund(definition, result.status, result.playerPercent, content)
			: 0;
		if (refund > 0) {
			lines.push({
				kind: 'economy',
				text: `Frais de campagne remboursés — ${RESOURCE_NAMES.politicalBudgetCents} ${formatDelta('politicalBudgetCents', refund)}`
			});
		}
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
const STAFF_CHANGE_LABELS: Readonly<
	Record<Extract<EffectRange, { kind: 'staff' }>['change'], string>
> = {
	hire: 'Embauche',
	replace: 'Embauche à la place du titulaire, renvoyé',
	shortlist: 'Candidature ajoutée à la présélection',
	dismiss: 'Renvoi',
	leave: 'Départ d’un collaborateur'
};

/** Liste française : « a, b et c ». */
function joinFrench(items: readonly string[]): string {
	if (items.length <= 1) return items[0] ?? '';
	return `${items.slice(0, -1).join(', ')} et ${items.at(-1)!}`;
}

/** Territoire d'origine : commune, taille et traits, département et région (P3-16). */
export function buildTerritory(state: GameState, content: Content): TerritoryView {
	const { territory } = state.player;
	const size = content.territory.sizes.find((entry) => entry.id === territory.homeTown.sizeId);
	const traits = territory.homeTown.traitIds.map(
		(id) => content.territory.traits.find((trait) => trait.id === id)?.label ?? id
	);
	const sizeLabel = size?.label ?? territory.homeTown.sizeId;
	return {
		town: territory.homeTown.name,
		description: traits.length > 0 ? `${sizeLabel} ${joinFrench(traits)}` : sizeLabel,
		department: placeOf('national', territory, content),
		region: placeOf('regional', territory, content)
	};
}

/**
 * Nom localisé d'un scrutin (P3-16) : la commune pour les municipales, la
 * région pour les régionales, le département (la circonscription) sinon.
 */
function electionName(electionId: string, state: GameState, content: Content): string {
	const election = content.elections[electionId];
	if (!election) return electionId;
	return `${election.label} (${placeOf(election.scope, state.player.territory, content)})`;
}

/** Nom localisé d'un mandat (P3-16) : selon le scrutin qui y mène ; sans lieu pour un ministère. */
function mandateName(mandateId: string, state: GameState, content: Content): string {
	const mandate = content.mandates[mandateId];
	if (!mandate) return mandateId;
	const election = mandate.election ? content.elections[mandate.election] : undefined;
	return election
		? `${mandate.label} (${placeOf(election.scope, state.player.territory, content)})`
		: mandate.label;
}

function addability(state: GameState, plan: readonly PlanStep[], step: PlanStep, content: Content) {
	if (state.phase !== 'planning')
		return {
			addable: false,
			reason: 'Aucune planification possible pour le moment.',
			outOfReach: false
		};
	const preview = previewPlan(state, { steps: [...plan, step] }, content);
	const last = preview.steps.at(-1);
	const issue = last?.issues[0];
	const outOfReach = last?.issues.some((item) => item.code === 'condition_not_met') ?? false;
	return issue
		? { addable: false, reason: issue.message, outOfReach }
		: { addable: true, reason: null, outOfReach: false };
}

const OTHER_ACTIONS = { id: 'other', label: 'Autres actions' } as const;

/** Regroupe les actions de l'agenda par thème du catalogue ; « Autres actions » en dernier. */
function groupActions(actions: readonly CatalogItemView[], content: Content): ActionGroupView[] {
	const categoryOf = (id: string): string => content.actions[id]?.category ?? OTHER_ACTIONS.id;
	return [...content.actionCategories, OTHER_ACTIONS].flatMap((category) => {
		const members = actions.filter((action) => categoryOf(action.id) === category.id);
		if (members.length === 0) return [];
		return [
			{
				id: category.id,
				label: category.label,
				actions: members.filter((action) => !action.outOfReach),
				outOfReach: members.filter((action) => action.outOfReach)
			}
		];
	});
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

/** Libellé lisible de la cible d'une étape : parti, mandat exercé ou échéance électorale. */
function targetLabel(target: string, state: GameState, content: Content): string {
	if (Object.hasOwn(content.parties, target)) return content.parties[target]?.name ?? target;
	if (Object.hasOwn(content.promises, target)) {
		return `« ${content.promises[target]?.label ?? target} »`;
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
		if (definition) return definition.ownedLabel ?? definition.label;
	}
	const mandate = state.mandates.find((entry) => entry.instanceId === target);
	if (mandate) return mandateName(mandate.mandateId, state, content);
	const ballot = state.ballots.find((entry) => entry.ballotId === target);
	if (ballot) {
		const label = electionName(ballot.electionId, state, content);
		return `${label} du ${formatTurn(ballot.turn)}`;
	}
	return target;
}

/** Départs de collaborateurs et présélections à la frontière (P2-05). */
function staffLines(record: StaffRecord | null, state: GameState, content: Content): JournalLine[] {
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
		}))
	];
}

/** Famille à la frontière (P2-08) : héritage, veuvage, dépenses et disponibilité. */
function familyLines(record: FamilyRecord | null, state: GameState): JournalLine[] {
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

function journalOfQuarter(entry: HistoryEntry, state: GameState, content: Content): JournalLine[] {
	const lines: JournalLine[] = [];
	for (const step of entry.steps) {
		const target = step.target ? ` : ${targetLabel(step.target, state, content)}` : '';
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

function buildJournal(
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

const TONE_LABELS: Readonly<Record<string, string>> = {
	critical: 'Critique',
	neutral: 'Neutre',
	favorable: 'Favorable'
};

const MEDIA_KIND_LABELS: Readonly<Record<string, string>> = {
	reference: 'Quotidien de référence',
	popular: 'Quotidien populaire',
	news_channel: 'Chaîne d’information continue',
	satirical: 'Hebdomadaire satirique',
	regional: 'Presse régionale'
};

function lowerFirst(text: string): string {
	return text.charAt(0).toLocaleLowerCase('fr-FR') + text.slice(1);
}

/** Sujet d'un article, tel qu'il est cité dans le titre (`{subject}`). */
function articleSubject(article: Article, state: GameState, content: Content): string {
	const id = article.subjectId;
	if (id === null) return '';
	switch (article.topic) {
		case 'justice': {
			const legalCase = state.cases.find((entry) => entry.caseId === id);
			const fact = state.facts.find((entry) => entry.factId === legalCase?.factId);
			const label = fact ? content.offenses[fact.offenseId]?.label : undefined;
			return label ? lowerFirst(label) : 'justice';
		}
		case 'promise': {
			const pledge = state.promises.find((entry) => entry.pledgeId === id);
			return pledge ? (content.promises[pledge.promiseId]?.label ?? pledge.promiseId) : id;
		}
		case 'election': {
			const campaign = state.campaigns.find((entry) => entry.campaignId === id);
			return campaign ? electionName(campaign.electionId, state, content) : id;
		}
		default:
			return content.media[id]?.name ?? id;
	}
}

/** « de » suivi d'un mot, avec élision devant une voyelle (« d’emploi fictif »). */
export function ofWord(word: string): string {
	return /^[aeiouyàâäéèêëîïôöûü]/i.test(word) ? `d’${word}` : `de ${word}`;
}

/** Titre d'un article : gabarit du catalogue, variables résolues. */
export function articleTitle(article: Article, state: GameState, content: Content): string {
	const headline = content.headlines.find((entry) => entry.id === article.headlineId);
	if (!headline) return article.headlineId;
	const subject = articleSubject(article, state, content);
	const media = content.media[article.mediaId]?.name ?? article.mediaId;
	return headline.text
		.replaceAll('de {subject}', ofWord(subject))
		.replaceAll('{subject}', subject)
		.replaceAll('{media}', media);
}

function articleEffects(article: Article, content: Content): string {
	return [
		...article.supports.map(
			(change) =>
				`${content.supportGroups[change.groupId]?.label ?? change.groupId} ${formatGaugeDelta(change.delta)}`
		),
		...(article.exposure !== 0 ? [`Exposition ${formatGaugeDelta(article.exposure)}`] : [])
	].join(', ');
}

function buildPress(state: GameState, content: Content): PlayerView['press'] {
	const items: PressItemView[] = [];
	for (const entry of state.history) {
		if (entry.type !== 'turn.resolved' || !entry.press) continue;
		entry.press.articles.forEach((article, index) => {
			const aboutPlayer = article.topic !== 'ambient';
			items.push({
				key: `t${entry.turn}-a${index}`,
				dateLabel: formatTurn(entry.turn + 1),
				media: content.media[article.mediaId]?.name ?? article.mediaId,
				title: articleTitle(article, state, content),
				aboutPlayer,
				toneLabel: aboutPlayer ? (TONE_LABELS[article.tone] ?? null) : null,
				critical: aboutPlayer && article.tone === 'critical',
				effects: articleEffects(article, content)
			});
		});
	}
	return items.reverse().slice(0, 8);
}

/** Trimestres couverts par l'écran Actualités ; les plus anciens restent au journal. */
const NEWS_QUARTERS = 20;

function buildNews(state: GameState, content: Content): PlayerView['news'] {
	const groups: { key: string; label: string; items: PressItemView[] }[] = [];
	for (const entry of state.history) {
		if (entry.type !== 'turn.resolved' || !entry.press || entry.press.articles.length === 0)
			continue;
		groups.push({
			key: `t${entry.turn}`,
			label: formatTurn(entry.turn + 1),
			items: entry.press.articles.map((article, index) => {
				const aboutPlayer = article.topic !== 'ambient';
				return {
					key: `t${entry.turn}-a${index}`,
					dateLabel: formatTurn(entry.turn + 1),
					media: content.media[article.mediaId]?.name ?? article.mediaId,
					title: articleTitle(article, state, content),
					aboutPlayer,
					toneLabel: aboutPlayer ? (TONE_LABELS[article.tone] ?? null) : null,
					critical: aboutPlayer && article.tone === 'critical',
					effects: articleEffects(article, content)
				};
			})
		});
	}
	return groups.reverse().slice(0, NEWS_QUARTERS);
}

function audienceLabel(audience: number): string {
	return audience >= 50
		? 'Forte audience'
		: audience >= 30
			? 'Audience moyenne'
			: 'Audience confidentielle';
}

/** Relation d'un média, en clair (aucun chiffre affiché). */
export function mediaRelationLabel(relation: number): string {
	if (relation >= 50) return 'Très bienveillant';
	if (relation >= 20) return 'Bienveillant';
	if (relation > -20) return 'Neutre';
	if (relation > -50) return 'Réservé';
	return 'Hostile';
}

function buildMedia(state: GameState, plan: readonly PlanStep[], content: Content): MediaView {
	const actionIds = content.actionIds.filter((id) => content.actions[id]?.target === 'media');
	const owned = ownedMedia(state.upgrades, content);
	const outlets = content.mediaIds.flatMap((mediaId): MediaOutletView[] => {
		const definition = content.media[mediaId];
		if (!definition) return [];
		const isOwned = owned.has(mediaId);
		return [
			{
				mediaId,
				name: definition.name,
				kindLabel: MEDIA_KIND_LABELS[definition.kind] ?? definition.kind,
				line: definition.line,
				description: definition.description,
				audienceLabel: audienceLabel(definition.audience),
				relationLabel: isOwned
					? 'Votre propriété'
					: mediaRelationLabel(state.world.media[mediaId]?.relation ?? 0),
				owned: isOwned,
				follows: followsPlayer(definition, state.player.exposure, content),
				actions: isOwned
					? []
					: actionIds.map((actionId) => {
							const step: PlanStep = { kind: 'action', id: actionId, target: mediaId };
							const isPlanned = plan.some(
								(entry) =>
									entry.kind === 'action' && entry.id === actionId && entry.target === mediaId
							);
							const add = isPlanned
								? { addable: false, reason: null }
								: addability(state, plan, step, content);
							return {
								actionId,
								label: content.actions[actionId]?.label ?? actionId,
								planned: isPlanned,
								addable: add.addable,
								reason: add.reason
							};
						})
			}
		];
	});
	return { outlets, nationalExposure: content.press.nationalExposure };
}

/** Somme des montants par ressource, dans l'ordre des ressources. */
function sumAmounts(lists: readonly (readonly ResourceAmount[])[]): ResourceAmount[] {
	return RESOURCE_IDS.flatMap((resource) => {
		const amount = lists
			.flat()
			.filter((item) => item.resource === resource)
			.reduce((sum, item) => sum + item.amount, 0);
		return amount === 0 ? [] : [{ resource, amount }];
	});
}

function buildWealth(
	state: GameState,
	plan: readonly PlanStep[],
	actions: readonly CatalogItemView[],
	offers: readonly UpgradeView[],
	content: Content
): WealthView {
	const lifestyle = content.lifestyles[state.player.lifestyle];
	const sellActionId =
		content.actionIds.find((id) => content.actions[id]?.target === 'asset') ?? null;
	const selling = new Set(
		plan.flatMap((step) =>
			step.kind === 'action' && step.id === sellActionId && step.target ? [step.target] : []
		)
	);
	const owned = state.upgrades.flatMap((upgrade): AssetView[] => {
		const definition = content.upgrades[upgrade.upgradeId];
		if (!definition?.asset || upgrade.valueCents === null) return [];
		const step: PlanStep | null = sellActionId
			? { kind: 'action', id: sellActionId, target: upgrade.instanceId }
			: null;
		const planned = selling.has(upgrade.instanceId);
		const check = step && !planned ? addability(state, plan, step, content) : null;
		const income = assetIncome(upgrade, content);
		return [
			{
				instanceId: upgrade.instanceId,
				label: definition.ownedLabel ?? definition.label,
				acquired: formatTurn(upgrade.acquiredTurn),
				value: formatMoney(upgrade.valueCents),
				income: upgrade.acquiredTurn < state.turn ? formatMoney(income) : null,
				proceeds: formatMoney(assetProceeds(upgrade, content)),
				lost: upgrade.valueCents === 0,
				sale: {
					step: check?.addable ? step : null,
					reason: planned ? 'Vente prévue ce trimestre.' : (check?.reason ?? null),
					planned
				}
			}
		];
	});
	return {
		netWorth: formatMoney(netWorth(state.resources, state.upgrades)),
		cash: formatMoney(state.resources.personalCashCents),
		assetsValue: formatMoney(assetsValue(state.upgrades)),
		lifestyle: {
			label: lifestyle?.label ?? state.player.lifestyle,
			description: lifestyle?.description ?? '',
			cost: formatMoney(lifestyle?.costCents ?? 0)
		},
		lifestyleActions: actions.filter((action) => action.id.startsWith('lifestyle.')),
		owned,
		offers
	};
}

/** Organisation regroupée par type d'amélioration, dans l'ordre du catalogue. */
function buildOrganisation(
	state: GameState,
	plan: readonly PlanStep[],
	preview: PlanPreview,
	content: Content
): OrganisationGroupView[] {
	const releaseActionId =
		content.actionIds.find((id) => content.actions[id]?.target === 'upgrade') ?? null;
	return content.upgradeIds.flatMap((upgradeId) => {
		const definition = content.upgrades[upgradeId]!;
		// Les actifs patrimoniaux ont leur propre écran (P3-02).
		if (definition.asset) return [];
		const owned = state.upgrades.filter((upgrade) => upgrade.upgradeId === upgradeId);
		// Une amélioration d'une époque à venir reste invisible (P3-07).
		if (owned.length === 0 && !eraReached(definition.fromEra, state.turn, content)) return [];
		const forecasts = preview.producers.filter((producer) => producer.upgradeId === upgradeId);
		const releasing = new Set(
			plan.flatMap((step) =>
				step.kind === 'action' && step.id === releaseActionId && step.target ? [step.target] : []
			)
		);
		const releasesPlanned = owned.filter((upgrade) => releasing.has(upgrade.instanceId)).length;
		if (owned.length === 0 && forecasts.length === 0) return [];

		// Le plus récent des exemplaires encore présents part en premier.
		const candidate = [...owned].reverse().find((upgrade) => !releasing.has(upgrade.instanceId));
		let release: OrganisationGroupView['release'] = null;
		if (releaseActionId && state.phase === 'planning' && owned.length > 0) {
			if (!candidate) {
				release = { step: null, reason: 'Tous les départs sont déjà prévus.' };
			} else {
				const step: PlanStep = {
					kind: 'action',
					id: releaseActionId,
					target: candidate.instanceId
				};
				const check = addability(state, plan, step, content);
				release = check.addable ? { step, reason: null } : { step: null, reason: check.reason };
			}
		}
		const count = (status: string): number =>
			forecasts.filter((producer) => producer.status === status).length;
		return [
			{
				upgradeId,
				label: definition.ownedLabel ?? definition.label,
				owned: owned.length,
				active: count('active'),
				pending: count('pending'),
				suspended: count('suspended'),
				releasesPlanned,
				upkeep: amounts(sumAmounts(forecasts.map((producer) => producer.upkeep)), -1),
				production: amounts(sumAmounts(forecasts.map((producer) => producer.production)), 1),
				releaseEffects: (definition.releaseEffects ?? []).map((effect) =>
					describeEffect(effectRange(effect), content)
				),
				release
			}
		];
	});
}

/** Bilan des promesses en une ligne (P3-04). */
function promisesSummary(counts: ReturnType<typeof careerSummary>['promises']): string {
	if (counts.made === 0) return 'Aucun engagement pris';
	return `${counts.made} engagement(s) : ${counts.kept} tenue(s), ${counts.partial} partiellement, ${counts.abandoned} abandonnée(s)`;
}

/** Trimestres affichés dans les tendances du tableau de bord. */
const TREND_QUARTERS = 12;

const TREND_SERIES: readonly {
	readonly id: keyof QuarterSnapshot;
	readonly label: string;
	readonly rising: 'good' | 'bad';
}[] = [
	{ id: 'influence', label: 'Influence', rising: 'good' },
	{ id: 'politicalBudgetCents', label: 'Budget politique', rising: 'good' },
	{ id: 'personalCashCents', label: 'Argent personnel', rising: 'good' },
	{ id: 'popularity', label: 'Popularité', rising: 'good' },
	{ id: 'health', label: 'Santé', rising: 'good' },
	{ id: 'stress', label: 'Stress', rising: 'bad' }
];

function formatTrendValue(id: keyof QuarterSnapshot, value: number): string {
	return id === 'politicalBudgetCents' || id === 'personalCashCents'
		? formatMoney(value)
		: String(value);
}

/** Tendances : instantanés des derniers trimestres, puis la situation actuelle. */
function buildTrends(state: GameState): TrendView[] {
	const quarters = state.history
		.filter((entry): entry is HistoryEntry => entry.type === 'turn.resolved')
		.slice(-TREND_QUARTERS);
	if (quarters.length < 2) return [];
	const first = quarters[0]!.turn;
	return TREND_SERIES.map(({ id, label, rising }) => {
		const points = quarters.map((entry) => entry.snapshot[id]);
		const start = points[0]!;
		const end = points[points.length - 1]!;
		const delta = end - start;
		const sign = delta > 0 ? '+ ' : '− ';
		return {
			id,
			label,
			points,
			current: formatTrendValue(id, end),
			change: delta === 0 ? null : `${sign}${formatTrendValue(id, Math.abs(delta))}`,
			mood: delta === 0 ? 'neutral' : delta > 0 === (rising === 'good') ? 'good' : 'bad',
			description: `${label} depuis le ${formatTurn(first)} : de ${formatTrendValue(id, start)} à ${formatTrendValue(id, end)}`
		};
	});
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
		const label = mandateName(mandate.mandateId, state, content);
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
		const mediaId = content.upgrades[upgrade.upgradeId]?.asset?.media;
		if (mediaId === undefined) continue;
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

function buildSummary(state: GameState, content: Content): SummaryView | null {
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
	return {
		masthead:
			cause === 'prison'
				? 'Le Courrier du Bocage · Chronique judiciaire'
				: 'Le Courrier du Bocage · Nécrologie',
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
					{ label: 'Mandats exercés', value: String(metrics.mandatesHeld) },
					{ label: 'Années en fonction', value: String(metrics.yearsInOffice) },
					{
						label: 'Scrutins',
						value: `${metrics.campaignsWon} gagné(s), ${metrics.campaignsLost} perdu(s)`
					},
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
						label: 'Profession',
						value: content.professions[state.player.profession]?.label ?? state.player.profession
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
		joinCosts: joinAction ? amounts(joinAction.costs, -1) : [],
		era: (({ label, description }) => ({ label, description }))(eraAt(state.turn, content)),
		institutions: buildInstitutions(state, plan, content)
	};
}

function careerPartsOf(state: GameState): CareerParts {
	return {
		mandates: state.mandates,
		ballots: state.ballots,
		campaigns: state.campaigns,
		institutions: state.institutions,
		promises: state.promises
	};
}

function levelOf(levelId: string, content: Content) {
	const parameterId = content.institutionLevels[levelId]?.parameterId;
	return parameterId
		? content.institutionParameters[parameterId]?.levels.find((level) => level.id === levelId)
		: undefined;
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
		promises: state.promises
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

/** Lien familial d'un personnage généré (étiquette `kin`), sans accord de genre. */
const KIN_LABELS: Readonly<Record<string, string>> = {
	partner: 'Famille — vie commune',
	former_partner: 'Famille — ancienne relation',
	child: 'Famille — enfant',
	parent: 'Famille — parent',
	sibling: 'Famille — fratrie'
};

function roleOf(tags: readonly string[]): string {
	if (tags.includes('kin')) {
		const relation = tags.find((tag) => Object.hasOwn(KIN_LABELS, tag));
		return relation ? KIN_LABELS[relation]! : 'Famille';
	}
	if (tags.includes('staff')) return 'Entourage';
	return ROLE_LABELS[tags[0] ?? ''] ?? 'Connaissance';
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
		// Les candidats non retenus ne sont que des CV : ils n'entrent pas dans vos relations.
		if (!character || character.tags.includes('candidate')) return [];
		const lastTurn = character.leftTurn ?? now;
		return [
			{
				metTurn: relationship.metTurn,
				view: {
					id,
					name: displayName(character),
					role: roleOf(character.tags),
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
	// La famille d'abord, puis les personnages actifs, par date de rencontre.
	return people
		.sort(
			(a, b) =>
				Number(b.view.role.startsWith('Famille')) - Number(a.view.role.startsWith('Famille')) ||
				Number(b.view.active) - Number(a.view.active) ||
				a.metTurn - b.metTurn ||
				a.view.id.localeCompare(b.view.id)
		)
		.map((entry) => entry.view);
}

function buildPromises(
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
	const campaigning = state.campaigns.some((campaign) => campaign.status === 'running');
	const offers =
		campaigning && pledgeActionId
			? content.promiseIds.flatMap((promiseId) => {
					const definition = content.promises[promiseId];
					if (!definition) return [];
					const add = addability(
						state,
						plan,
						{ kind: 'action', id: pledgeActionId, target: promiseId },
						content
					);
					return [
						{
							promiseId,
							label: definition.label,
							theme: definition.theme,
							description: definition.description,
							effects: definition.announce.map((effect) =>
								describeEffect(effectRange(effect), content)
							),
							planned: planned(pledgeActionId, promiseId),
							addable: add.addable,
							reason: add.reason
						}
					];
				})
			: [];
	const order = (pledge: PromiseRecord): number => (isOpenPledge(pledge) ? 0 : 1);
	const pledges = [...state.promises]
		.reverse()
		.sort((left, right) => order(left) - order(right))
		.map((pledge): PledgeView => {
			const definition = content.promises[pledge.promiseId];
			const campaign = state.campaigns.find((entry) => entry.campaignId === pledge.campaignId);
			const election = campaign ? content.elections[campaign.electionId]?.label : undefined;
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
				theme: definition?.theme ?? '',
				status: lapsed ? 'Sans lendemain' : PROMISE_STATUS_LABELS[pledge.status],
				origin: `${election ?? 'Campagne'} — annoncée au ${formatTurn(pledge.announcedTurn)}`,
				progress: pledge.progress,
				inProgress,
				amended: pledge.amended,
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
		offers,
		pledges
	};
}

function buildCareer(state: GameState, plan: readonly PlanStep[], content: Content): CareerView {
	const label = (mandateId: string): string => mandateName(mandateId, state, content);
	const resignActionId =
		content.actionIds.find((id) => content.actions[id]?.target === 'mandate') ?? null;
	const declareActionId =
		content.actionIds.find((id) => content.actions[id]?.target === 'ballot') ?? null;
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
		const outcome =
			campaign.status === 'won'
				? `Victoire avec ${campaign.playerPercent} %${rival ? ` face à ${displayName(rival)}` : ''}`
				: campaign.status === 'lost'
					? `Défaite avec ${campaign.playerPercent} %${rival ? ` face à ${displayName(rival)}` : ''} : la carrière continue`
					: campaign.status === 'disqualified'
						? `Candidature invalidée : ${campaign.reason ?? 'conditions non remplies'}`
						: null;
		return {
			campaignId: campaign.campaignId,
			label: electionName(campaign.electionId, state, content),
			dateLabel: ballot ? formatTurn(ballot.turn) : '—',
			declared: `Candidature déclarée au ${formatTurn(campaign.declaredTurn)}`,
			investiture:
				campaign.partyId === null
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
			outcome
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
			return {
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
				early: ballot.early
			})),
		declareActionId,
		promises: buildPromises(state, plan, content),
		media: buildMedia(state, plan, content),
		pastCampaigns: state.campaigns
			.filter((campaign) => campaign.status !== 'running')
			.map(campaignView)
			.reverse(),
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

function personOf(state: GameState, characterId: string, content: Content): StaffPersonView {
	const character = state.characters[characterId]!;
	return {
		characterId,
		name: displayName(character),
		age: ageAt(character.birthTurn, state.turn),
		competence: describeCompetence(character.competence),
		knownTraits: character.knownTraits.map((trait) => content.traits[trait]?.label ?? trait),
		unknownTraits: character.traits.length - character.knownTraits.length
	};
}

function buildEntourage(
	state: GameState,
	plan: readonly PlanStep[],
	content: Content
): EntourageView {
	const hireActionId =
		content.actionIds.find((id) => content.actions[id]?.target === 'candidate') ?? null;
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
					const hire = hireActionId
						? addability(
								state,
								plan,
								{ kind: 'action', id: hireActionId, target: entry.characterId },
								content
							)
						: { addable: false, reason: null };
					return [
						{
							...personOf(state, entry.characterId, content),
							profile:
								content.candidateProfiles.find((profile) => profile.id === entry.profileId)
									?.label ?? '',
							planned: planned(hireActionId, entry.characterId),
							hireable: hire.addable,
							reason: hire.reason
						}
					];
				});
		return {
			id: postId,
			label: post.label,
			description: post.description,
			salary: `${formatResource('politicalBudgetCents', post.salaryCents)} par trimestre`,
			lockedReason: unlocked ? null : (post.unavailableReason ?? 'Poste pas encore accessible.'),
			occupant,
			candidates
		};
	});
	return {
		posts,
		hireActionId,
		dismissActionId,
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

function buildAdvice(
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

function describeFamily(state: GameState): string {
	const partner = state.player.family.partnerId ? 'en couple' : 'célibataire';
	const children = livingChildren(state.player, state.characters).length;
	return children === 0 ? partner : `${partner}, ${children} enfant${children > 1 ? 's' : ''}`;
}

/** Option de création : libellé, description et effets de départ lisibles. */
export interface ProfileOptionView {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly effects: readonly string[];
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

/** Région proposée à la création (P3-16) : nom et départements, la commune étant tirée. */
export interface RegionOptionView {
	readonly id: string;
	readonly name: string;
	readonly departments: string;
}

export function creationOptions(content: Content): {
	readonly origins: readonly ProfileOptionView[];
	readonly professions: readonly ProfileOptionView[];
	readonly regions: readonly RegionOptionView[];
	readonly defaults: Content['defaultProfile'];
} {
	const option = (entry: {
		id: string;
		label: string;
		description: string;
		effects: readonly Effect[];
	}): ProfileOptionView => ({
		id: entry.id,
		label: entry.label,
		description: entry.description,
		effects: entry.effects.map((effect) => describeEffect(effectRange(effect), content))
	});
	return {
		origins: content.originIds.map((id) => option(content.origins[id]!)),
		professions: content.professionIds.map((id) => option(content.professions[id]!)),
		regions: content.regionIds.map((id) => {
			const region = content.regions[id]!;
			return {
				id,
				name: region.name,
				departments: region.departments.map((department) => department.name).join(', ')
			};
		}),
		defaults: content.defaultProfile
	};
}

export function projectView(
	state: GameState,
	plan: readonly PlanStep[],
	catalog: Content,
	adjustments: readonly PlanAdjustment[] = []
): PlayerView {
	// Règles en vigueur (P3-05) : sondages, presse et justice affichés selon les institutions.
	const content = effectiveContent(catalog, state.institutions.parameters);
	const preview = previewPlan(state, { steps: plan }, content);
	const steps: PlanStepView[] = preview.steps.map((step) => {
		const upgrade = step.kind === 'purchase' && step.id ? content.upgrades[step.id] : undefined;
		const target = step.target ? ` : ${targetLabel(step.target, state, content)}` : '';
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
			chips: [
				...amountChips(step.costs, -1),
				...step.effects.map((range) =>
					effectChip(
						range.kind === 'affiliation' && range.party === 'target'
							? { ...range, party: step.target }
							: range,
						content
					)
				)
			],
			issues: step.issues.map((issue) => issue.message),
			note: upgrade ? 'Actif à partir du trimestre prochain.' : null,
			pinned: (() => {
				const source = plan[step.index];
				return source?.kind === 'action' && source.pinned === true;
			})(),
			category:
				(step.kind ?? 'action') === 'action' && step.id
					? (content.actions[step.id]?.category ?? null)
					: null
		};
	});

	const planned = (kind: PlanStep['kind'], id: string): number =>
		plan.filter((step) => step.kind === kind && step.id === id).length;

	// Les actions ciblées se planifient depuis les écrans Monde politique et Carrière.
	const actions: CatalogItemView[] = content.actionIds.flatMap((id) => {
		const action = content.actions[id]!;
		// Une action d'une époque à venir reste invisible (P3-07).
		if (action.target || !eraReached(action.fromEra, state.turn, content)) return [];
		return {
			kind: 'action',
			id,
			label: action.label,
			description: action.description,
			timeCost: action.timeCost,
			costs: amounts(action.costs, -1),
			effects: action.effects.map((effect) => describeEffect(effectRange(effect), content)),
			costChips: amountChips(action.costs, -1),
			effectChips: action.effects.map((effect) => effectChip(effectRange(effect), content)),
			category: action.category ?? null,
			planned: planned('action', id),
			...addability(state, plan, { kind: 'action', id }, content)
		} satisfies CatalogItemView;
	});

	const upgradeView = (id: string): UpgradeView => {
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
			costChips: amountChips(upgrade.price, -1),
			effectChips: amountChips(upgrade.production, 1),
			category: null,
			owned: state.upgrades.filter((owned) => owned.upgradeId === id).length,
			maxOwned: upgrade.maxOwned,
			planned: planned('purchase', id),
			...addability(state, plan, { kind: 'purchase', id }, content)
		};
	};
	const current = (id: string): boolean =>
		eraReached(content.upgrades[id]?.fromEra, state.turn, content);
	const upgrades = content.upgradeIds
		.filter((id) => !content.upgrades[id]?.asset && current(id))
		.map(upgradeView);
	const assetOffers = content.upgradeIds
		.filter((id) => content.upgrades[id]?.asset && current(id))
		.map((id) => {
			const view = upgradeView(id);
			const asset = content.upgrades[id]!.asset!;
			const effects = [
				asset.annualYieldPercent > 0
					? `Revenu : ${asset.annualYieldPercent} % de la valeur par an`
					: 'Aucun revenu',
				`Valeur : tendance ${asset.annualGrowthPercent >= 0 ? '+' : ''}${asset.annualGrowthPercent} % par an, aléa ± ${asset.volatilityPercent} % par trimestre`,
				...(asset.failurePerMille > 0 ? ['Risque de perte totale'] : []),
				...(asset.stressPerTurn < 0 ? [`Stress ${asset.stressPerTurn} par trimestre`] : []),
				`Revente : ${asset.salePercent} % de la valeur`
			];
			return { ...view, effects, effectChips: effects.map((text) => textChip(text)) };
		});

	// Organisation seulement : les actifs patrimoniaux ont leur écran (P3-02).
	const producers: ProducerView[] = preview.producers
		.filter((producer) => !content.upgrades[producer.upgradeId]?.asset)
		.map((producer) => ({
			instanceId: producer.instanceId,
			upgradeId: producer.upgradeId,
			label:
				content.upgrades[producer.upgradeId]?.ownedLabel ??
				content.upgrades[producer.upgradeId]?.label ??
				producer.upgradeId,
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
				})),
				advice: buildAdvice(state, pending.instanceId, pending.eventId, content)
			}
		: null;

	const health = describeHealth(state.player.health);
	const stress = describeStress(state.player.stress);
	const alerts: Alert[] = [];
	if (decision) alerts.push({ level: 'danger', text: `Décision attendue : ${decision.title}` });
	if (state.phase === 'planning') {
		for (const warning of preview.warnings)
			alerts.push({ level: 'warning', text: warning.message });
		// Alertes du moteur qui interrompent aussi l'accélération (P2-09) ; échéances et
		// santé sont présentées plus bas, de façon plus complète.
		for (const alert of accelerationAlerts(state, { steps: plan }, content)) {
			if (alert.kind === 'finance' || alert.id.startsWith('staff_left:')) {
				alerts.push({ level: 'warning', text: alert.message });
			} else if (alert.kind === 'justice') {
				alerts.push({ level: 'warning', text: alert.message });
			} else if (alert.kind === 'career' || alert.kind === 'staff') {
				alerts.push({ level: 'info', text: alert.message });
			}
		}
	}
	const lead = content.balance.elections.alertLeadTurns;
	for (const ballot of state.ballots) {
		const left = ballot.turn - state.turn;
		if (ballot.status !== 'scheduled' || left < 0 || state.phase === 'ended') continue;
		const label = electionName(ballot.electionId, state, content);
		const candidate = state.campaigns.some(
			(campaign) => campaign.status === 'running' && campaign.ballotId === ballot.ballotId
		);
		const filingLeft = ballot.filingClosesTurn - state.turn;
		// Les candidatures ferment avant le scrutin : l'alerte suit la plus proche des deux échéances.
		if (!candidate && filingLeft >= 0 && filingLeft <= lead) {
			alerts.push({
				level: 'info',
				text:
					filingLeft === 0
						? `${label} : dernier trimestre pour déposer une candidature.`
						: `${label} : candidatures closes au ${formatTurn(ballot.filingClosesTurn)}.`
			});
			continue;
		}
		if (left > lead) continue;
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
		trends: buildTrends(state),
		territory: buildTerritory(state, content),
		dateLabel: formatTurn(state.end ? state.end.turn : state.turn),
		age: ageAt(state.player.birthTurn, state.end ? state.end.turn : state.turn),
		phase: state.phase,
		resources: RESOURCE_IDS.map((id) => ({
			id,
			name: RESOURCE_NAMES[id],
			value: formatResource(id, state.resources[id]),
			forecast: formatRange(id, preview.resourceChanges[id].min, preview.resourceChanges[id].max),
			trend: Math.sign(preview.resourceChanges[id].min + preview.resourceChanges[id].max) as
				-1 | 0 | 1
		})),
		health,
		stress,
		justice: buildJustice(state, content),
		plan: {
			steps,
			pinnedCount: steps.filter((step) => step.pinned).length,
			adjustments: adjustments.find((entry) => entry.turn === state.turn)?.lines ?? [],
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
			changeChips: RESOURCE_IDS.map((id) =>
				effectChip(
					{
						kind: 'resource',
						resource: id,
						min: preview.resourceChanges[id].min,
						max: preview.resourceChanges[id].max
					},
					content
				)
			),
			stressAfter: describeStress(preview.wellbeing.stress),
			healthAfter: preview.wellbeing.health
		},
		actions,
		actionGroups: groupActions(actions, content),
		wealth: buildWealth(state, plan, actions, assetOffers, content),
		upgrades,
		producers,
		organisation: buildOrganisation(state, plan, preview, content),
		decision,
		journal: buildJournal(state, content, adjustments),
		press: buildPress(state, content),
		news: buildNews(state, content),
		// Carrière terminée (P3-08) : plus d'alerte de santé ni d'échéance, seulement le bilan.
		alerts: state.end
			? [{ level: 'info', text: 'Carrière terminée : le bilan est présenté au centre de l’écran.' }]
			: alerts,
		summary: buildSummary(state, content),
		world: buildWorld(state, plan, content),
		people: buildPeople(state, content),
		career: buildCareer(state, plan, content),
		supports: buildSupports(state, content),
		entourage: buildEntourage(state, plan, content),
		profile: {
			origin: content.origins[state.player.origin]?.label ?? state.player.origin,
			profession: content.professions[state.player.profession]?.label ?? state.player.profession,
			family: describeFamily(state)
		}
	};
}
