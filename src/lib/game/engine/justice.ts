/**
 * Registre des faits et jauges de la justice (P3-01, ARCHITECTURE.md §8.4).
 *
 * - Un acte douteux choisi dans un événement inscrit un fait daté au registre
 *   (`recordFact`) ; justice, presse et bilan s'appuient sur ce registre plutôt
 *   que sur des tirages indépendants.
 * - Le risque judiciaire est dérivé, jamais stocké : chaque fait récent y
 *   contribue selon sa gravité et l'implication du joueur, en décroissant
 *   jusqu'à la prescription ; l'exposition médiatique le majore. Il mesure une
 *   exposition aux enquêtes, pas une culpabilité, et n'entraîne jamais seul de
 *   condamnation.
 * - L'exposition médiatique est une jauge stockée : les effets la font varier,
 *   puis elle revient à chaque frontière vers une référence fixée par les
 *   fonctions exercées et les campagnes en cours.
 *
 * Toutes les valeurs sont des hypothèses de `justice.json`. Aucun aléa.
 */
import {
	GAUGE_MAX,
	GAUGE_MIN,
	type CapabilityId,
	type Content,
	type IntRange,
	type ResourceId,
	type Resources
} from '../content/types.ts';
import type { Turn } from './calendar.ts';
import { hasCapability, type ConditionContext } from './conditions.ts';
import { activeMandates, endMandates, type CareerParts } from './career.ts';
import { applyGauge, clampGauge, type FactEffect } from './effects.ts';
import { nextFloat, nextInt, type RngState } from './random.ts';
import { staffLeavesAfterConviction, type EntourageParts } from './staff.ts';
import { applyPoliticalEffect } from './world.ts';
import type {
	Campaign,
	CaseEventKind,
	EndState,
	Fact,
	GameState,
	GaugeChange,
	JusticeRecord,
	LegalCase,
	MandateInstance,
	PlayerState,
	PoliticalChange,
	ScheduledEvent,
	Sentence,
	WorldState
} from './state.ts';

export function factInstanceId(rank: number): string {
	return `fact.${rank}`;
}

/**
 * Inscrit un fait. Les protagonistes sont les acteurs de l'événement pour les
 * rôles cités ; un rôle sans acteur (personnage parti) est simplement omis.
 */
const CAPABILITY_MISSING: { readonly [K in CapabilityId]: string } = {
	political_activity: 'Sans activité politique, personne ne vous confie de fonds.',
	local_power: 'Il faut détenir un pouvoir local (une mairie) pour cela.',
	public_office: 'Il faut exercer un mandat pour cela.',
	real_hire: 'Aucune embauche réelle n’a eu lieu.',
	organization_funds: 'Il faut une organisation dotée de fonds pour cela.'
};

/**
 * Garde du registre (P3-12) : raison pour laquelle ce fait ne peut pas être
 * commis, ou `null`. La capacité de l'infraction se lit sur l'état ; un emploi
 * fictif (`real_hire`) exige qu'un protagoniste du fait soit réellement en
 * poste dans l'entourage, embauché au besoin par un effet antérieur du choix.
 */
export function factIssue(
	effect: FactEffect,
	context: ConditionContext,
	actors: Readonly<Record<string, string>>,
	content: Content
): string | null {
	const capability = content.offenses[effect.offense]?.capability;
	if (capability === undefined) return `Infraction inconnue : ${effect.offense}.`;
	if (capability === 'real_hire') {
		const roles = [
			...(effect.author === undefined ? [] : [effect.author]),
			...(effect.accomplices ?? [])
		];
		const hired = roles.some((role) =>
			context.staff.some(
				(member) => member.status === 'active' && member.characterId === actors[role]
			)
		);
		return hired ? null : CAPABILITY_MISSING.real_hire;
	}
	return hasCapability(context, capability) ? null : CAPABILITY_MISSING[capability];
}

export function createFact(
	effect: FactEffect,
	facts: readonly Fact[],
	actors: Readonly<Record<string, string>>,
	eventId: string,
	turn: Turn
): Fact {
	const authorId = effect.author === undefined ? null : (actors[effect.author] ?? null);
	return {
		factId: factInstanceId(facts.length + 1),
		offenseId: effect.offense,
		turn,
		severity: effect.severity,
		divertedCents: effect.divertedCents ?? 0,
		authorId,
		accompliceIds: (effect.accomplices ?? []).flatMap((role) => {
			const id = actors[role];
			return id === undefined || id === authorId ? [] : [id];
		}),
		eventId
	};
}

/** Part du fait dans le risque : 100 % auteur, `accompliceRiskPercent` complice. */
function involvementPercent(fact: Fact, content: Content): number {
	return fact.authorId === null ? 100 : content.justice.accompliceRiskPercent;
}

export interface RiskContribution {
	readonly factId: string;
	/** Points de risque apportés par ce fait, avant majoration par l'exposition. */
	readonly points: number;
}

export interface JudicialRisk {
	/** Risque judiciaire, entier de 0 à 100. */
	readonly value: number;
	/** Contributions des faits non prescrits, dans l'ordre du registre. */
	readonly contributions: readonly RiskContribution[];
	/** Majoration due à l'exposition médiatique, en points. */
	readonly exposureBonus: number;
}

/**
 * Risque judiciaire au trimestre `turn` : somme des contributions des faits
 * encore inconnus de la justice (un fait révélé relève de son dossier),
 * chacune décroissant linéairement jusqu'à la prescription, puis majoration
 * proportionnelle à l'exposition, bornée à [0, 100].
 */
export function judicialRisk(
	facts: readonly Fact[],
	cases: readonly LegalCase[],
	exposure: number,
	turn: Turn,
	content: Content
): JudicialRisk {
	const rules = content.justice;
	const contributions: RiskContribution[] = [];
	const revealed = new Set(cases.map((entry) => entry.factId));
	for (const fact of facts) {
		if (revealed.has(fact.factId)) continue;
		const remaining = rules.prescriptionTurns - (turn - fact.turn);
		if (remaining <= 0) continue;
		const points = Math.round(
			(fact.severity * rules.riskPerSeverity * involvementPercent(fact, content) * remaining) /
				(100 * rules.prescriptionTurns)
		);
		if (points > 0) contributions.push({ factId: fact.factId, points });
	}
	const base = contributions.reduce((sum, entry) => sum + entry.points, 0);
	const exposureBonus = Math.round(
		(base * rules.exposureRiskBonusPercent * exposure) / (100 * GAUGE_MAX)
	);
	return { value: clampGauge(base + exposureBonus), contributions, exposureBonus };
}

/** Risque judiciaire de l'état courant. */
export function currentJudicialRisk(
	state: Pick<GameState, 'facts' | 'cases' | 'player' | 'turn'>,
	content: Content
): JudicialRisk {
	return judicialRisk(state.facts, state.cases, state.player.exposure, state.turn, content);
}

/** Fonds détournés cumulés par le joueur ou avec sa complicité (bilan, GDD §12). */
export function divertedFunds(facts: readonly Fact[]): number {
	return facts.reduce((sum, fact) => sum + fact.divertedCents, 0);
}

/**
 * Exposition de référence : base, plus la plus exposée des fonctions exercées,
 * plus un supplément pendant une campagne.
 */
export function referenceExposure(
	mandates: readonly MandateInstance[],
	campaigns: readonly Campaign[],
	content: Content,
	lifestyleId: string | null = null
): number {
	const rules = content.justice;
	const office = Math.max(
		0,
		...activeMandates(mandates).map((mandate) => rules.mandateExposure[mandate.mandateId] ?? 0)
	);
	const campaigning = campaigns.some((campaign) => campaign.status === 'running')
		? rules.campaignExposure
		: 0;
	// Le luxe se voit (P3-02).
	const lifestyle = lifestyleId === null ? 0 : (content.lifestyles[lifestyleId]?.exposure ?? 0);
	return Math.min(
		GAUGE_MAX,
		Math.max(GAUGE_MIN, rules.baseExposure + office + campaigning + lifestyle)
	);
}

/**
 * Retour de l'exposition vers sa référence à la frontière : une part de l'écart,
 * arrondie vers le haut pour qu'un écart finisse toujours par se résorber.
 */
export function resolveExposure(
	player: PlayerState,
	mandates: readonly MandateInstance[],
	campaigns: readonly Campaign[],
	content: Content
): { readonly player: PlayerState; readonly delta: number } {
	const gap = referenceExposure(mandates, campaigns, content, player.lifestyle) - player.exposure;
	const step = Math.ceil((Math.abs(gap) * content.justice.exposureDriftPercent) / 100);
	const delta = Math.sign(gap) * Math.min(Math.abs(gap), step);
	return delta === 0
		? { player, delta: 0 }
		: { player: { ...player, exposure: clampGauge(player.exposure + delta) }, delta };
}

// ---------------------------------------------------------------------------
// Dossiers judiciaires (étape 5, autres échéances)
// ---------------------------------------------------------------------------

export function caseInstanceId(rank: number): string {
	return `case.${rank}`;
}

export function openCases(cases: readonly LegalCase[]): LegalCase[] {
	return cases.filter((entry) => entry.stage !== 'closed');
}

/** Chance de révélation d'un fait au trimestre, en % (avant tirage). */
export function revealPercent(fact: Fact, exposure: number, content: Content): number {
	return (content.justice.revealPercentPerSeverity * fact.severity * (100 + exposure)) / 100;
}

/** Chance de classement sans suite à la fin de l'enquête, en %. */
export function dismissalPercent(severity: number, defense: number, content: Content): number {
	const rules = content.justice;
	return Math.max(
		0,
		Math.min(
			100,
			rules.dismissalBasePercent -
				rules.dismissalPerSeverityPercent * severity +
				(rules.defenseDismissalPercent * defense) / GAUGE_MAX
		)
	);
}

/** Chance de condamnation au procès ou en appel, en %. */
export function convictionPercent(severity: number, defense: number, content: Content): number {
	const rules = content.justice;
	const base = rules.convictionPercentBySeverity[severity - 1] ?? 100;
	return Math.max(0, Math.min(100, base - (rules.defenseConvictionPercent * defense) / GAUGE_MAX));
}

export interface JusticeParts {
	readonly player: PlayerState;
	readonly resources: Resources;
	readonly world: WorldState;
	readonly career: CareerParts;
	readonly entourage: EntourageParts;
	readonly facts: readonly Fact[];
	readonly cases: readonly LegalCase[];
	readonly rng: RngState;
}

export interface JusticeResolution {
	readonly parts: JusticeParts;
	/** Révélations à présenter au trimestre suivant (événements bloquants). */
	readonly scheduled: readonly ScheduledEvent[];
	readonly record: JusticeRecord;
	/** Condamnation définitive à de la prison ferme : fin de carrière. */
	readonly end: EndState | null;
}

/**
 * Justice à la fin du trimestre `turn`, dans un ordre fixe :
 *   1. étapes échues des dossiers ouverts, dans l'ordre d'ouverture (classement,
 *      mise en examen, jugement, appel, peine) ;
 *   2. révélations des faits inconnus, dans l'ordre du registre ;
 *   3. défense : elle s'use avec un dossier ouvert, retombe à 0 sans dossier.
 * Une condamnation définitive à de la prison ferme interrompt la suite.
 */
export function resolveJustice(
	parts: JusticeParts,
	turn: Turn,
	content: Content
): JusticeResolution {
	const rules = content.justice;
	let { player, world, career, entourage, rng } = parts;
	const resources: Record<ResourceId, number> = { ...parts.resources };
	const cases: LegalCase[] = [...parts.cases];
	const events: { caseId: string; kind: CaseEventKind }[] = [];
	const politics: PoliticalChange[] = [];
	const gaugeDeltas = new Map<GaugeChange['gauge'], number>();
	const cashBefore = resources.personalCashCents;
	const scheduled: ScheduledEvent[] = [];
	let end: EndState | null = null;

	const roll = (percent: number): boolean => {
		const draw = nextFloat(rng);
		rng = draw.rng;
		return draw.value * 100 < percent;
	};
	const between = (range: IntRange): number => {
		const draw = nextInt(rng, range.min, range.max);
		rng = draw.rng;
		return draw.value;
	};
	const gauge = (key: 'stress' | 'exposure', id: GaugeChange['gauge'], delta: number): void => {
		const applied = applyGauge(player[key], delta);
		player = { ...player, [key]: applied.value };
		if (applied.applied !== 0) gaugeDeltas.set(id, (gaugeDeltas.get(id) ?? 0) + applied.applied);
	};
	/** Variation des soutiens électoraux, atténuée quand un proche est seul en cause. */
	const supports = (perSeverity: number, severity: number, own: boolean): void => {
		const value = Math.round(
			(perSeverity * severity * (own ? 100 : rules.entourageImpactPercent)) / 100
		);
		if (value === 0) return;
		for (const groupId of content.supportGroupIds) {
			if (content.supportGroups[groupId]?.kind !== 'electoral') continue;
			const outcome = applyPoliticalEffect(
				{ op: 'addSupport', group: groupId, value },
				player,
				world,
				turn,
				null,
				content
			);
			player = outcome.player;
			world = outcome.world;
			politics.push(...outcome.changes);
		}
	};
	const scaled = (value: number, own: boolean): number =>
		own ? value : Math.round((value * rules.entourageImpactPercent) / 100);
	const severityOf = (legalCase: LegalCase): number =>
		parts.facts.find((fact) => fact.factId === legalCase.factId)?.severity ?? 1;
	const close = (index: number, outcome: LegalCase['outcome'], sentence: Sentence | null): void => {
		cases[index] = {
			...cases[index]!,
			stage: 'closed',
			dueTurn: null,
			outcome,
			closedTurn: turn,
			sentence
		};
	};

	// 1. Étapes échues.
	for (let index = 0; index < cases.length && end === null; index += 1) {
		const legalCase = cases[index]!;
		if (legalCase.stage === 'closed' || legalCase.dueTurn === null || legalCase.dueTurn > turn) {
			continue;
		}
		const own = legalCase.defendantId === null;
		const severity = severityOf(legalCase);
		const defense = own ? player.defense : 0;
		if (legalCase.stage === 'investigation') {
			if (roll(dismissalPercent(severity, defense, content))) {
				close(index, 'dismissed', null);
				events.push({ caseId: legalCase.caseId, kind: 'dismissed' });
				gauge('stress', 'player.stress', -scaled(rules.acquittalRelief, own));
			} else {
				cases[index] = {
					...legalCase,
					stage: 'indicted',
					dueTurn: turn + between(rules.trialDelayTurns)
				};
				events.push({ caseId: legalCase.caseId, kind: 'indicted' });
				gauge('stress', 'player.stress', scaled(rules.indictmentStress * severity, own));
				supports(-rules.indictmentSupport, severity, own);
			}
			continue;
		}
		// Procès (mise en examen échue) ou appel.
		const convicted = roll(convictionPercent(severity, defense, content));
		if (!convicted) {
			close(index, 'acquitted', null);
			events.push({ caseId: legalCase.caseId, kind: 'acquitted' });
			gauge('stress', 'player.stress', -scaled(rules.acquittalRelief, own));
			continue;
		}
		if (own && legalCase.stage === 'indicted') {
			// Le joueur fait toujours appel : la peine attend la décision définitive.
			cases[index] = { ...legalCase, stage: 'appeal', dueTurn: turn + between(rules.appealTurns) };
			events.push({ caseId: legalCase.caseId, kind: 'appealed' });
			gauge('stress', 'player.stress', rules.convictionStress);
			continue;
		}
		const rule = rules.sentences[severity - 1];
		if (!rule) throw new Error(`Peine inconnue pour la gravité ${severity}.`);
		const sentence: Sentence = {
			fineCents: own ? between(rule.fineCents) : 0,
			ineligibilityTurns: own ? between(rule.ineligibilityTurns) : 0,
			prison:
				rule.prison === 'none'
					? 'none'
					: rule.prison === 'firm_possible' && roll(rule.firmPrisonPercent)
						? 'firm'
						: 'suspended'
		};
		close(index, 'convicted', sentence);
		events.push({ caseId: legalCase.caseId, kind: 'convicted' });
		gauge('stress', 'player.stress', scaled(rules.convictionStress, own));
		supports(-rules.convictionSupport, severity, own);
		if (!own) {
			const left = staffLeavesAfterConviction(entourage, legalCase.defendantId, turn);
			entourage = left.parts;
			politics.push(...left.changes);
			continue;
		}
		resources.personalCashCents = Math.max(0, resources.personalCashCents - sentence.fineCents);
		if (sentence.ineligibilityTurns > 0) {
			const until = turn + 1 + sentence.ineligibilityTurns;
			player = {
				...player,
				ineligibleUntil: Math.max(player.ineligibleUntil ?? 0, until)
			};
			// L'inéligibilité emporte les fonctions exercées.
			const ended = endMandates(career.mandates, () => true, 'removed', turn);
			career = { ...career, mandates: ended.mandates };
			politics.push(...ended.changes);
		}
		if (sentence.prison === 'firm') {
			end = { turn, reason: 'prison', caseId: legalCase.caseId };
		}
	}

	// 2. Révélations.
	if (end === null) {
		const known = new Set(cases.map((entry) => entry.factId));
		for (const fact of parts.facts) {
			if (known.has(fact.factId) || fact.turn >= turn) continue;
			if (turn - fact.turn >= rules.prescriptionTurns) continue;
			const author = fact.authorId === null ? null : entourage.characters[fact.authorId];
			if (author !== null && author?.status !== 'active') continue;
			if (!roll(revealPercent(fact, player.exposure, content))) continue;
			const own = fact.authorId === null;
			const legalCase: LegalCase = {
				caseId: caseInstanceId(cases.length + 1),
				factId: fact.factId,
				defendantId: fact.authorId,
				openedTurn: turn,
				stage: 'investigation',
				dueTurn: turn + between(rules.investigationTurns),
				outcome: null,
				closedTurn: null,
				sentence: null
			};
			cases.push(legalCase);
			events.push({ caseId: legalCase.caseId, kind: 'revealed' });
			gauge('exposure', 'player.exposure', scaled(rules.revelationExposure * fact.severity, own));
			gauge('stress', 'player.stress', scaled(rules.revelationStress * fact.severity, own));
			supports(-rules.revelationSupport, fact.severity, own);
			scheduled.push({
				eventId: own ? rules.revelationEvent : rules.entourageRevelationEvent,
				dueTurn: turn + 1,
				sourceInstanceId: legalCase.caseId,
				actors: own ? {} : { defendant: fact.authorId }
			});
		}
	}

	// 3. Défense.
	const pending = cases.some((entry) => entry.stage !== 'closed' && entry.defendantId === null);
	const decay = pending
		? Math.ceil((player.defense * rules.defenseDecayPercent) / 100)
		: player.defense;
	if (decay > 0) {
		player = { ...player, defense: player.defense - decay };
		gaugeDeltas.set('player.defense', -decay);
	}

	const fine = resources.personalCashCents - cashBefore;
	return {
		parts: { player, resources, world, career, entourage, facts: parts.facts, cases, rng },
		scheduled,
		record: {
			cases: events,
			changes: fine === 0 ? [] : [{ resource: 'personalCashCents', delta: fine }],
			gauges: [...gaugeDeltas].map(([id, delta]) => ({ gauge: id, delta })),
			politics
		},
		end
	};
}
