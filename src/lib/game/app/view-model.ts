import type { ActionDefinition, ActionFamilyDefinition, Content } from '../content/types.ts';
import { RESOURCE_IDS } from '../content/types.ts';
import type { GameState, PlanStep } from '../engine/index.ts';
import {
	accelerationAlerts,
	activistTier,
	ageAt,
	describePendingEvent,
	effectRange,
	effectiveContent,
	eraReached,
	familyFormats,
	familySpentThisYear,
	fieldworkEffects,
	formatTurn,
	previewPlan
} from '../engine/index.ts';
import type { GaugeDescription } from './format.ts';
import {
	RESOURCE_NAMES,
	describeHealth,
	describeStress,
	formatRange,
	formatResource
} from './format.ts';
import type {
	ActionFormatView,
	ActionGroupView,
	CatalogItemView,
	PlanStepView,
	PlanView,
	UpgradeView
} from './view/agenda.ts';
import { addability, groupActions } from './view/agenda.ts';
import type { CareerView } from './view/career.ts';
import { ballotReportView, buildCareer } from './view/career.ts';
import type { FirstStepsView, TerritoryView } from './view/creation.ts';
import { buildFirstSteps, buildTerritory } from './view/creation.ts';
import type { TrendView } from './view/dashboard.ts';
import { buildTrends } from './view/dashboard.ts';
import type { EntourageView } from './view/entourage.ts';
import { buildEntourage } from './view/entourage.ts';
import type { DecisionView } from './view/events.ts';
import { buildAdvice } from './view/events.ts';
import type { JournalTurnView, PlanAdjustment } from './view/journal.ts';
import { buildJournal, targetLabel } from './view/journal.ts';
import type { JusticeView } from './view/justice.ts';
import { buildJustice } from './view/justice.ts';
import type { SummaryView } from './view/legacy.ts';
import { ambitionText, buildSummary } from './view/legacy.ts';
import type { PressItemView } from './view/media.ts';
import { buildNews, buildPress } from './view/media.ts';
import type { OutcomeView, QuarterNoteView } from './view/note.ts';
import { buildOutcome, buildQuarterNote } from './view/note.ts';
import type { ActivistsView, OrganisationGroupView, ProducerView } from './view/organisation.ts';
import { buildActivists, buildOrganisation } from './view/organisation.ts';
import type { PersonView } from './view/people.ts';
import { buildPeople } from './view/people.ts';
import type { Alert, ResourceView } from './view/shared.ts';
import {
	ACTION_FORMAT_LABELS,
	FAMILY_LABELS,
	amountChips,
	amounts,
	describeEffect,
	describeFamily,
	effectChip,
	electionName,
	textChip,
	upgradeLabel
} from './view/shared.ts';
import type { SupportsView } from './view/supports.ts';
import { buildSupports } from './view/supports.ts';
import type { WealthView } from './view/wealth.ts';
import { buildWealth } from './view/wealth.ts';
import type { WorldView } from './view/world.ts';
import { buildWorld } from './view/world.ts';

export type {
	ActionFormatView,
	ActionGroupView,
	CatalogItemView,
	PlanStepView,
	PlanView,
	UpgradeView
} from './view/agenda.ts';
export type {
	AdvanceOfferView,
	BallotReportRowView,
	BallotReportView,
	BallotView,
	CampaignView,
	CareerView,
	MandateView,
	PartyCareerView
} from './view/career.ts';
export { ballotReportView } from './view/career.ts';
export type {
	FirstStepView,
	FirstStepsView,
	ProfileOptionView,
	RegionOptionView,
	TerritoryView
} from './view/creation.ts';
export { buildTerritory, creationOptions, engagementOf } from './view/creation.ts';
export type { TrendView } from './view/dashboard.ts';
export type {
	CandidateView,
	EntourageView,
	HireOfferView,
	PostSearchView,
	PostView,
	SearchOptionView,
	StaffPersonView
} from './view/entourage.ts';
export type { AdviceView, ChoiceView, DecisionView } from './view/events.ts';
export type { JournalLine, JournalTurnView, PlanAdjustment } from './view/journal.ts';
export type { CaseView, FactView, JusticeView } from './view/justice.ts';
export type { LogbookEntry, SummaryView } from './view/legacy.ts';
export type { MediaActionView, MediaOutletView, MediaView, PressItemView } from './view/media.ts';
export type {
	NoteChartView,
	NoteHighlightView,
	NoteVariationView,
	OutcomeView,
	QuarterNoteView,
	SpanSummaryView
} from './view/note.ts';
export { summarizeSpan } from './view/note.ts';
export type {
	ActivistLeverView,
	ActivistsView,
	OrganisationGroupView,
	ProducerView
} from './view/organisation.ts';
export type { PersonView } from './view/people.ts';
export type {
	PledgeView,
	PromiseCampaignView,
	PromiseOfferView,
	PromisesView
} from './view/promises.ts';
export type { Alert, ChipSense, ChipView, ResourceView } from './view/shared.ts';
export {
	ACTION_FORMAT_LABELS,
	PARTY_POSTURE_LABELS,
	PARTY_RANK_LABELS,
	PROMISE_STATUS_LABELS,
	articleTitle,
	mediaRelationLabel,
	ofWord
} from './view/shared.ts';
export type { SupportGroupView, SupportsView } from './view/supports.ts';
export type { AssetView, WealthView } from './view/wealth.ts';
export type {
	IndicatorView,
	InstitutionParameterView,
	InstitutionsView,
	PartyView,
	ReformOptionView,
	WorldView
} from './view/world.ts';

export interface PlayerView {
	/** Tendances des derniers trimestres (P3-08), vides en début de carrière. */
	readonly trends: readonly TrendView[];
	/** Résultat du dernier choix d'événement (P3-14), `null` avant le premier. */
	readonly lastOutcome: OutcomeView | null;
	/** Note de cabinet du dernier trimestre résolu (P3-14), `null` avant le premier. */
	readonly quarterNote: QuarterNoteView | null;
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
	/** Base militante (P3-19). */
	readonly activists: ActivistsView;
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
	/** Premiers pas guidés (P3-40), sans aucun effet de jeu. */
	readonly firstSteps: FirstStepsView;
	/** Profil du personnage : origine, engagement et situation familiale. */
	readonly profile: {
		readonly origin: string;
		readonly engagement: string;
		readonly family: string;
		/** Ambition de départ et son état (P3-38), sinon `null`. */
		readonly ambition: string | null;
	};
	readonly career: CareerView;
	readonly supports: SupportsView;
	readonly entourage: EntourageView;
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

	// Famille à l'échelle (P3-23) : formats, ligne hors de portée seulement si tous le sont.
	const familyRow = (family: ActionFamilyDefinition, modest: ActionDefinition) => {
		const formats = familyFormats(family.id, content).map((format): ActionFormatView => {
			const add = addability(state, plan, { kind: 'action', id: format.id }, content);
			return {
				id: format.id,
				format: ACTION_FORMAT_LABELS[format.scale!.format],
				label: format.label,
				timeCost: format.timeCost,
				costChips: amountChips(format.costs, -1),
				effectChips: format.effects.map((effect) => effectChip(effectRange(effect), content)),
				planned: planned('action', format.id),
				...add
			};
		});
		const spent = family.annualCap
			? familySpentThisYear(family.id, state.history, state.turn, content)
			: 0;
		return {
			label: family.label,
			description: `${family.description} ${modest.description}`,
			formats,
			planned: formats.reduce((total, format) => total + format.planned, 0),
			outOfReach: formats.every((format) => format.outOfReach),
			familyNote: family.annualCap
				? `Plafond annuel : ${formatResource(family.annualCap.resource, family.annualCap.amount)} (${formatResource(family.annualCap.resource, spent)} déjà versés cette année)`
				: null
		};
	};

	// Les actions ciblées se planifient depuis les écrans Monde politique et Carrière.
	const actions: CatalogItemView[] = content.actionIds.flatMap((id) => {
		const action = content.actions[id]!;
		// Une action d'une époque à venir reste invisible (P3-07).
		if (action.target || !eraReached(action.fromEra, state.turn, content)) return [];
		// Famille à l'échelle (P3-23) : une seule ligne, portée par le format modeste.
		if (action.scale && action.scale.format !== 'modest') return [];
		const family = action.scale ? content.actionFamilies[action.scale.family] : undefined;
		// Bonus de terrain du palier militant (P3-19), annoncé dans la prévision.
		const bonus = fieldworkEffects(action, state.player.activists, content);
		return {
			kind: 'action',
			id,
			label: action.label,
			description: action.description,
			timeCost: action.timeCost,
			costs: amounts(action.costs, -1),
			effects: action.effects.map((effect) => describeEffect(effectRange(effect), content)),
			costChips: amountChips(action.costs, -1),
			effectChips: [
				...action.effects.map((effect) => effectChip(effectRange(effect), content)),
				...bonus.map((effect) => ({
					...effectChip(effectRange(effect), content),
					text: `Base militante : ${describeEffect(effectRange(effect), content)}`
				}))
			],
			fieldBonus:
				bonus.length > 0
					? `Base militante (${activistTier(state.player.activists, content).label}) : ${bonus.map((effect) => describeEffect(effectRange(effect), content)).join(', ')}`
					: action.fieldwork
						? `Action de terrain : bonus à partir du palier « ${content.balance.activists.tiers.find((tier) => tier.fieldMultiplier > 0)?.label ?? 'Noyau'} »`
						: null,
			category: action.category ?? null,
			planned: planned('action', id),
			...addability(state, plan, { kind: 'action', id }, content),
			...(family ? familyRow(family, action) : {})
		} satisfies CatalogItemView;
	});

	const upgradeView = (id: string): UpgradeView => {
		const upgrade = content.upgrades[id]!;
		return {
			kind: 'purchase',
			id,
			label: upgradeLabel(id, state, content, false),
			description: upgrade.description,
			family: FAMILY_LABELS[upgrade.family] ?? upgrade.family,
			treasury: RESOURCE_NAMES[upgrade.treasury],
			timeCost: upgrade.timeCost,
			costs: amounts(upgrade.price, -1),
			upkeep: amounts(upgrade.upkeep, -1),
			effects: amounts(upgrade.production, 1),
			costChips: amountChips(upgrade.price, -1),
			effectChips: amountChips(upgrade.production, 1),
			activists: upgrade.activists
				? `Base militante : + ${upgrade.activists.capacity} places d’accueil${upgrade.activists.retentionPercent > 0 ? `, usure réduite de ${upgrade.activists.retentionPercent} point${upgrade.activists.retentionPercent > 1 ? 's' : ''} par trimestre` : ''}, à partir du trimestre suivant l’achat`
				: null,
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
			label: upgradeLabel(producer.upgradeId, state, content, true),
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
				advice: buildAdvice(state, pending.instanceId, pending.eventId, content),
				appointment:
					pending.eventId === content.balance.government.appointmentEvent && state.appointment
						? state.appointment.mandateId === 'mandate.prime_minister'
							? 'Matignon : le président vous propose de former le gouvernement.'
							: state.appointment.portfolio
								? `Portefeuille proposé : ${content.portfolios[state.appointment.portfolio]?.title ?? state.appointment.portfolio}.`
								: 'Fonction proposée : un secrétariat d’État, première marche du gouvernement.'
						: null,
				report:
					pending.eventId === content.balance.elections.contests.runoffEvent
						? (state.ballots
								.filter((ballot) => ballot.report?.stage === 'runoff_pending')
								.map((ballot) => ballotReportView(ballot, state, content))[0] ?? null)
						: null
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
		// Niveaux (retour du créateur, P3-13) : « à traiter » seulement quand il faut agir ce
		// trimestre — dernier dépôt de candidature, ou scrutin où vous êtes candidat en fin de
		// trimestre ; le reste du calendrier reste une information.
		if (!candidate && filingLeft >= 0 && filingLeft <= lead) {
			alerts.push({
				level: filingLeft === 0 ? 'warning' : 'info',
				text:
					filingLeft === 0
						? `${label} : dernier trimestre pour déposer une candidature.`
						: `${label} : candidatures closes au ${formatTurn(ballot.filingClosesTurn)}.`
			});
			continue;
		}
		if (left > lead) continue;
		alerts.push({
			level: candidate && left === 0 ? 'warning' : 'info',
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
		lastOutcome: buildOutcome(state, content),
		quarterNote: buildQuarterNote(state, content, adjustments),
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
			retiring: plan.some(
				(step) =>
					step.kind === 'action' &&
					content.actions[step.id]?.effects.some((effect) => effect.op === 'retire') === true
			),
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
		activists: buildActivists(state, content),
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
		firstSteps: buildFirstSteps(state, content),
		profile: {
			origin: content.origins[state.player.origin]?.label ?? state.player.origin,
			engagement: content.engagements[state.player.engagement]?.label ?? state.player.engagement,
			family: describeFamily(state),
			ambition: ambitionText(state, content)
		}
	};
}
