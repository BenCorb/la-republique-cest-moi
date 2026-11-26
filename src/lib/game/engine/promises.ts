/**
 * Promesses et gouvernement (P3-04, GDD §7.5, ARCHITECTURE.md §8.4).
 *
 * - Pendant une campagne, le joueur prend des engagements (`makePromise`) sur
 *   des promesses types du catalogue : chacun est inscrit au registre, rattaché
 *   à la campagne en cours, et ses effets d'annonce s'appliquent aussitôt.
 * - Élu, la promesse passe « en cours » avec une échéance de réalisation ; un
 *   dilemme (événement bloquant de sujet `promise`) est programmé entre-temps :
 *   tenir, transiger (`amendPromise`) ou renoncer (`abandonPromise`). L'action
 *   « Préparer une réforme » (`advancePromise`) la fait avancer.
 * - À l'échéance, l'avancement décide de l'issue : tenue, partiellement tenue
 *   ou abandonnée, chacune avec ses effets sur les groupes concernés. Battu, le
 *   candidat garde une promesse annoncée mais sans lendemain.
 * - Pendant une campagne suivante, une promesse tenue ou abandonnée peut être
 *   rappelée par la presse ou l'adversaire (événement différé).
 *
 * Aucune simulation de politique publique : des soutiens, des ressources, du
 * stress et des événements. Valeurs provisoires de `promises.json`.
 */
import {
	PROMISE_PROGRESS_MAX,
	PROMISE_VARIABLE,
	RESOURCE_IDS,
	type Content,
	type Effect,
	type PromiseOutcome,
	type ResourceId,
	type Resources
} from '../content/types.ts';
import type { Turn } from './calendar.ts';
import { runningCampaigns, type CareerParts } from './career.ts';
import { applyGauge, gaugeKey } from './effects.ts';
import { nextFloat, nextInt, type RngState } from './random.ts';
import type {
	Campaign,
	GaugeChange,
	PlayerState,
	PoliticalChange,
	PromiseChange,
	PromiseRecord,
	PromisesRecord,
	ScheduledEvent,
	WorldState
} from './state.ts';
import { applyPoliticalEffect } from './world.ts';

export type PromiseEffect = Extract<
	Effect,
	{ op: 'makePromise' | 'advancePromise' | 'amendPromise' | 'abandonPromise' }
>;

export function isPromiseEffect(effect: Effect): effect is PromiseEffect {
	return (
		effect.op === 'makePromise' ||
		effect.op === 'advancePromise' ||
		effect.op === 'amendPromise' ||
		effect.op === 'abandonPromise'
	);
}

export function pledgeInstanceId(rank: number): string {
	return `pledge.${rank}`;
}

/** Promesse encore ouverte : annoncée pendant une campagne en cours, ou en cours de réalisation. */
export function isOpenPledge(pledge: PromiseRecord): boolean {
	return (
		pledge.status === 'in_progress' || (pledge.status === 'announced' && pledge.closedTurn === null)
	);
}

/**
 * Promesse visée : un exemplaire (`pledge.N`) ou, pour un événement de sujet
 * `promise`, la promesse ouverte de cette promesse type (au plus une à la fois).
 */
export function findPledge(
	promises: readonly PromiseRecord[],
	target: string | null
): PromiseRecord | undefined {
	if (target === null) return undefined;
	return (
		promises.find((pledge) => pledge.pledgeId === target) ??
		promises.find((pledge) => pledge.promiseId === target && isOpenPledge(pledge))
	);
}

/**
 * Campagne à laquelle un engagement sur cette promesse type serait rattaché :
 * la campagne en cours à l'échéance la plus proche dont l'élection l'admet.
 */
export function pledgeCampaign(
	promiseId: string,
	career: CareerParts,
	content: Content
): Campaign | null {
	const definition = content.promises[promiseId];
	if (!definition) return null;
	const ballotTurn = (campaign: Campaign): number =>
		career.ballots.find((ballot) => ballot.ballotId === campaign.ballotId)?.turn ?? Infinity;
	return (
		runningCampaigns(career.campaigns)
			.filter((campaign) => definition.elections.includes(campaign.electionId))
			.sort((left, right) => ballotTurn(left) - ballotTurn(right))[0] ?? null
	);
}

/** Raison pour laquelle le joueur ne peut pas prendre cet engagement, ou `null`. */
export function promiseIssue(
	promiseId: string,
	career: CareerParts,
	content: Content
): string | null {
	const definition = Object.hasOwn(content.promises, promiseId)
		? content.promises[promiseId]
		: undefined;
	if (!definition) return 'choisissez une promesse du catalogue';
	if (runningCampaigns(career.campaigns).length === 0) return 'il faut être candidat';
	const campaign = pledgeCampaign(promiseId, career, content);
	if (!campaign) return 'cet engagement ne concerne pas l’élection que vous briguez';
	if (career.promises.some((pledge) => pledge.promiseId === promiseId && isOpenPledge(pledge))) {
		return 'vous avez déjà pris cet engagement';
	}
	const count = career.promises.filter(
		(pledge) => pledge.campaignId === campaign.campaignId
	).length;
	if (count >= content.promiseRules.maxPerCampaign) {
		return `${content.promiseRules.maxPerCampaign} engagements au plus par campagne`;
	}
	return null;
}

/** Raison pour laquelle cette promesse ne peut pas avancer, ou `null`. */
export function pledgeIssue(target: string, promises: readonly PromiseRecord[]): string | null {
	const pledge = promises.find((entry) => entry.pledgeId === target);
	if (!pledge || pledge.status !== 'in_progress') return 'choisissez une promesse en cours';
	if (pledge.progress >= PROMISE_PROGRESS_MAX) return 'cette promesse est déjà réalisée';
	return null;
}

/**
 * Effets réellement appliqués : un engagement ajoute les effets d'annonce de sa
 * promesse type, un renoncement les effets de l'abandon (si la promesse est
 * encore en cours). Utilisé à l'identique par la prévision et l'exécution.
 */
export function expandPromiseEffects(
	effects: readonly Effect[],
	target: string | null,
	promises: readonly PromiseRecord[],
	content: Content
): Effect[] {
	const expanded: Effect[] = [];
	for (const effect of effects) {
		expanded.push(effect);
		if (target === null) continue;
		if (effect.op === 'makePromise' && Object.hasOwn(content.promises, target)) {
			expanded.push(...(content.promises[target]?.announce ?? []));
		} else if (effect.op === 'abandonPromise') {
			const pledge = findPledge(promises, target);
			if (pledge?.status === 'in_progress') {
				expanded.push(...promiseOutcomeEffects(pledge.promiseId, 'abandoned', content));
			}
		}
	}
	return expanded;
}

export function promiseOutcomeEffects(
	promiseId: string,
	outcome: PromiseOutcome,
	content: Content
): readonly Effect[] {
	return content.promises[promiseId]?.[outcome] ?? [];
}

/** Issue constatée à l'échéance : tenue, partiellement tenue (ou amendée) ou abandonnée. */
export function settlementOutcome(pledge: PromiseRecord, content: Content): PromiseOutcome {
	if (pledge.progress >= PROMISE_PROGRESS_MAX && !pledge.amended) return 'kept';
	// Un compromis plafonne l'issue ; sans travail suffisant, la promesse est enterrée.
	return pledge.progress >= content.promiseRules.partialProgress ? 'partial' : 'abandoned';
}

/**
 * Applique un effet de promesse. `target` : définition (`makePromise`, et pour
 * un événement la promesse type concernée) ou exemplaire (`advancePromise`
 * ciblé). Un effet sans promesse ouverte correspondante n'a aucun effet.
 */
export function applyPromiseEffect(
	effect: PromiseEffect,
	career: CareerParts,
	turn: Turn,
	target: string | null,
	content: Content
): { parts: CareerParts; changes: PoliticalChange[] } {
	const unchanged = { parts: career, changes: [] };
	if (effect.op === 'makePromise') {
		if (target === null || promiseIssue(target, career, content)) return unchanged;
		const campaign = pledgeCampaign(target, career, content)!;
		const pledge: PromiseRecord = {
			pledgeId: pledgeInstanceId(career.promises.length + 1),
			promiseId: target,
			campaignId: campaign.campaignId,
			announcedTurn: turn,
			status: 'announced',
			progress: 0,
			amended: false,
			dueTurn: null,
			closedTurn: null,
			recalls: 0,
			lastRecalledTurn: null
		};
		const preparation = content.promiseRules.announcePreparation;
		return {
			parts: {
				...career,
				promises: [...career.promises, pledge],
				campaigns: career.campaigns.map((entry) =>
					entry.campaignId === campaign.campaignId
						? { ...entry, preparation: entry.preparation + preparation }
						: entry
				)
			},
			changes: [
				{ kind: 'promise', pledgeId: pledge.pledgeId, promiseId: target, change: 'made' },
				...(preparation > 0 ? [{ kind: 'preparation' as const, delta: preparation }] : [])
			]
		};
	}
	const pledge = findPledge(career.promises, target);
	if (!pledge || pledge.status !== 'in_progress') return unchanged;
	const update = (next: PromiseRecord): CareerParts => ({
		...career,
		promises: career.promises.map((entry) => (entry.pledgeId === pledge.pledgeId ? next : entry))
	});
	switch (effect.op) {
		case 'advancePromise': {
			const progress = Math.min(PROMISE_PROGRESS_MAX, pledge.progress + effect.value);
			if (progress === pledge.progress) return unchanged;
			return {
				parts: update({ ...pledge, progress }),
				changes: [
					{
						kind: 'promiseProgress',
						pledgeId: pledge.pledgeId,
						promiseId: pledge.promiseId,
						delta: progress - pledge.progress
					}
				]
			};
		}
		case 'amendPromise':
			if (pledge.amended) return unchanged;
			return {
				parts: update({ ...pledge, amended: true }),
				changes: [
					{
						kind: 'promise',
						pledgeId: pledge.pledgeId,
						promiseId: pledge.promiseId,
						change: 'amended'
					}
				]
			};
		case 'abandonPromise':
			return {
				parts: update({ ...pledge, status: 'abandoned', dueTurn: null, closedTurn: turn }),
				changes: [
					{
						kind: 'promise',
						pledgeId: pledge.pledgeId,
						promiseId: pledge.promiseId,
						change: 'abandoned'
					}
				]
			};
		default: {
			const unknown: never = effect;
			throw new Error(`Effet de promesse inconnu : ${JSON.stringify(unknown)}`);
		}
	}
}

// ---------------------------------------------------------------------------
// Frontière du trimestre (étape 5 quater)
// ---------------------------------------------------------------------------

export interface PromisesParts {
	readonly player: PlayerState;
	readonly resources: Resources;
	readonly world: WorldState;
	readonly career: CareerParts;
	readonly rng: RngState;
}

export interface PromisesResolution {
	readonly parts: PromisesParts;
	/** Dilemmes et rappels à présenter plus tard (événements de sujet `promise`). */
	readonly scheduled: readonly ScheduledEvent[];
	readonly record: PromisesRecord;
}

/**
 * Promesses à la fin du trimestre `turn`, après les scrutins, dans un ordre fixe :
 *   1. promesses des campagnes jugées : en cours après une victoire (échéance de
 *      réalisation et dilemme programmés, sauf dilemme au plafond de son
 *      événement), sans lendemain sinon ;
 *   2. promesses en cours arrivées à échéance : issue selon l'avancement, et ses
 *      effets ;
 *   3. rappel éventuel d'une promesse passée pendant une campagne en cours
 *      (au plus un par trimestre, et plus du tout quand l'événement de rappel
 *      a atteint son plafond d'occurrences, P3-07).
 */
export function resolvePromises(
	parts: PromisesParts,
	turn: Turn,
	content: Content,
	occurrences: Readonly<Record<string, { readonly count: number }>> = {},
	queued: readonly ScheduledEvent[] = []
): PromisesResolution {
	const rules = content.promiseRules;
	let { player, world, rng } = parts;
	const resources: Record<ResourceId, number> = { ...parts.resources };
	let career = parts.career;
	const scheduled: ScheduledEvent[] = [];
	const politics: PoliticalChange[] = [];
	const resourceDeltas = new Map<ResourceId, number>();
	const gaugeDeltas = new Map<GaugeChange['gauge'], number>();
	if (career.promises.length === 0) {
		return { parts, scheduled, record: { changes: [], gauges: [], politics: [] } };
	}
	const promises = [...career.promises];
	const note = (pledge: PromiseRecord, change: PromiseChange): void => {
		politics.push({
			kind: 'promise',
			pledgeId: pledge.pledgeId,
			promiseId: pledge.promiseId,
			change
		});
	};
	const applyEffects = (effects: readonly Effect[]): void => {
		for (const effect of effects) {
			if (effect.op === 'addResource') {
				const next = Math.max(0, resources[effect.resource] + effect.value);
				const applied = next - resources[effect.resource];
				resources[effect.resource] = next;
				resourceDeltas.set(effect.resource, (resourceDeltas.get(effect.resource) ?? 0) + applied);
			} else if (effect.op === 'addStat') {
				const key = gaugeKey(effect.stat);
				const applied = applyGauge(player[key], effect.value);
				player = { ...player, [key]: applied.value };
				if (applied.applied !== 0) {
					gaugeDeltas.set(effect.stat, (gaugeDeltas.get(effect.stat) ?? 0) + applied.applied);
				}
			} else if (effect.op === 'addSupport') {
				const outcome = applyPoliticalEffect(effect, player, world, turn, null, content);
				player = outcome.player;
				world = outcome.world;
				politics.push(...outcome.changes);
			}
		}
	};

	// Répétition contrôlée (P3-07, P3-09) : un dilemme ou un rappel ne dépasse pas le
	// plafond déclaré de son événement, occurrences passées et suites déjà programmées comprises.
	const belowCap = (eventId: string): boolean => {
		const cap = content.events[eventId]?.maxOccurrences;
		if (cap === undefined) return true;
		const pendingCount = [...queued, ...scheduled].filter(
			(entry) => entry.eventId === eventId
		).length;
		return (occurrences[eventId]?.count ?? 0) + pendingCount < cap;
	};

	// 1. Campagnes jugées.
	promises.forEach((pledge, index) => {
		if (pledge.status !== 'announced' || pledge.closedTurn !== null) return;
		const campaign = career.campaigns.find((entry) => entry.campaignId === pledge.campaignId);
		if (!campaign || campaign.status === 'running') return;
		if (campaign.status !== 'won') {
			promises[index] = { ...pledge, closedTurn: turn };
			note(pledge, 'lapsed');
			return;
		}
		const delay = nextInt(rng, rules.dilemmaDelayTurns.min, rules.dilemmaDelayTurns.max);
		rng = delay.rng;
		promises[index] = { ...pledge, status: 'in_progress', dueTurn: turn + rules.deliveryTurns };
		note(pledge, 'started');
		const dilemma = content.promises[pledge.promiseId]?.dilemmaEvent;
		if (dilemma && belowCap(dilemma)) {
			scheduled.push({
				eventId: dilemma,
				dueTurn: turn + delay.value,
				sourceInstanceId: pledge.pledgeId,
				actors: { [PROMISE_VARIABLE]: pledge.promiseId }
			});
		}
	});

	// 2. Échéances de réalisation.
	promises.forEach((pledge, index) => {
		if (pledge.status !== 'in_progress' || pledge.dueTurn === null || pledge.dueTurn > turn) return;
		const outcome = settlementOutcome(pledge, content);
		promises[index] = { ...pledge, status: outcome, dueTurn: null, closedTurn: turn };
		note(pledge, outcome);
		applyEffects(promiseOutcomeEffects(pledge.promiseId, outcome, content));
	});

	// 3. Rappel d'une promesse passée pendant une campagne en cours.
	const ballotTurn = (campaign: Campaign): number =>
		career.ballots.find((ballot) => ballot.ballotId === campaign.ballotId)?.turn ?? Infinity;
	const campaign = runningCampaigns(career.campaigns)
		.filter((entry) => entry.declaredTurn < turn)
		.sort((left, right) => ballotTurn(left) - ballotTurn(right))[0];
	if (campaign && rules.recallPercent > 0 && rules.maxRecalls > 0) {
		const index = promises.findIndex(
			(pledge) =>
				(pledge.status === 'kept' || pledge.status === 'abandoned') &&
				pledge.campaignId !== campaign.campaignId &&
				pledge.recalls < rules.maxRecalls &&
				(pledge.lastRecalledTurn === null || pledge.lastRecalledTurn < campaign.declaredTurn) &&
				belowCap(pledge.status === 'kept' ? rules.recallEvents.kept : rules.recallEvents.abandoned)
		);
		const pledge = index >= 0 ? promises[index] : undefined;
		if (pledge) {
			const roll = nextFloat(rng);
			rng = roll.rng;
			if (roll.value * 100 < rules.recallPercent) {
				promises[index] = { ...pledge, recalls: pledge.recalls + 1, lastRecalledTurn: turn };
				note(pledge, 'recalled');
				scheduled.push({
					eventId:
						pledge.status === 'kept' ? rules.recallEvents.kept : rules.recallEvents.abandoned,
					dueTurn: turn + 1,
					sourceInstanceId: pledge.pledgeId,
					actors: {
						[PROMISE_VARIABLE]: pledge.promiseId,
						...(campaign.opponentId ? { rival: campaign.opponentId } : {})
					}
				});
			}
		}
	}

	career = { ...career, promises };
	return {
		parts: { player, resources, world, career, rng },
		scheduled,
		record: {
			changes: RESOURCE_IDS.flatMap((resource) => {
				const delta = resourceDeltas.get(resource) ?? 0;
				return delta === 0 ? [] : [{ resource, delta }];
			}),
			gauges: [...gaugeDeltas].map(([gauge, delta]) => ({ gauge, delta })),
			politics
		}
	};
}

/** Synthèse du registre pour les conditions et le bilan. */
export function promiseCounts(promises: readonly PromiseRecord[]): {
	readonly made: number;
	readonly inProgress: number;
	readonly kept: number;
	readonly partial: number;
	readonly abandoned: number;
} {
	const count = (status: PromiseRecord['status']): number =>
		promises.filter((pledge) => pledge.status === status).length;
	return {
		made: promises.length,
		inProgress: count('in_progress'),
		kept: count('kept'),
		partial: count('partial'),
		abandoned: count('abandoned')
	};
}
