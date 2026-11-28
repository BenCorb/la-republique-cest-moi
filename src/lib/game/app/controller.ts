/**
 * Contrôleur de partie (ARCHITECTURE.md §2, §5, §10) : seul point d'entrée de
 * l'interface vers le moteur et la sauvegarde. TypeScript pur, dépendances
 * injectées (stockage, horloge d'affichage, source de seed) : testable sans
 * navigateur.
 *
 * Règles :
 *   - le brouillon de plan n'appartient qu'à l'interface ; il n'est jamais
 *     présenté comme validé et peut être perdu au rechargement ; après un
 *     trimestre, manuel ou accéléré, il est reporté selon la règle du moteur
 *     (`carryOverPlan` : seules les actions épinglées restent, P3-11) ;
 *   - le plan reste toujours valide (P3-11) : un ajout impossible est refusé
 *     avec son motif ; après chaque changement (report, réordonnancement,
 *     commande hors tour), les étapes devenues impossibles sont retirées
 *     (`prunePlan`), signalées par une notice groupée et une ligne du journal
 *     de la session (non sauvegardée, comme le brouillon) ;
 *   - chaque transition réussie est sauvegardée aussitôt (nouvelle partie, tour,
 *     choix, fin) ; tant que la sauvegarde a échoué, aucune transition suivante
 *     n'est permise, sauf si le joueur choisit explicitement de continuer sans
 *     sauvegarde ;
 *   - une sauvegarde existante n'est jamais remplacée sans confirmation ;
 *   - un changement de sauvegarde par un autre onglet bloque les transitions
 *     jusqu'à rechargement.
 */
import type { Content } from '../content/types.ts';
import {
	assignMissionCommand,
	accelerate as accelerateEngine,
	carryOverPlan,
	chooseEventCommand,
	previewPlan,
	prunePlan,
	commitTurn,
	createGame,
	formatTurn,
	transition,
	type AccelerationResult,
	type AccelerationStopReason,
	type GameCommand,
	type GameState,
	type PlanRemoval,
	type PlanStep
} from '../engine/index.ts';
import {
	createEnvelope,
	exportSave,
	importSave,
	readSave,
	writeSave,
	type ExportedSave,
	type KeyValueStorage,
	type SaveEnvelope,
	type SaveError,
	type WriteError
} from '../persistence/index.ts';
import { formatSavedAt } from './format.ts';
import {
	creationOptions,
	projectView,
	summarizeSpan,
	type PlanAdjustment,
	type PlayerView,
	type SpanSummaryView
} from './view-model.ts';

export interface ControllerDependencies {
	readonly content: Content;
	/** `null` si le navigateur n'offre pas de stockage utilisable. */
	readonly storage: KeyValueStorage | null;
	/** Horodatage ISO des sauvegardes (métadonnée d'affichage). */
	readonly now: () => string;
	/** Seed d'une nouvelle carrière (tirée par le navigateur à sa frontière). */
	readonly newSeed: () => string;
	/** Rend la main à l'hôte entre deux tours accélérés (une frame dans le navigateur). */
	readonly yieldControl?: () => Promise<void>;
}

export type SaveStatus =
	| { readonly kind: 'saved'; readonly savedAt: string }
	| { readonly kind: 'failed'; readonly error: WriteError }
	| { readonly kind: 'unavailable' }
	| { readonly kind: 'conflict' };

export interface ExistingSave {
	readonly dateLabel: string;
	readonly savedAtLabel: string;
	readonly ended: boolean;
	/** Copie précédente utilisée parce que la sauvegarde courante est endommagée. */
	readonly fromBackup: boolean;
}

export interface HomeInfo {
	readonly existing: ExistingSave | null;
	/** Sauvegarde présente mais inutilisable (jamais effacée sans confirmation). */
	readonly unreadable: SaveError | null;
	readonly storageAvailable: boolean;
}

export interface PendingImport {
	readonly dateLabel: string;
	readonly savedAtLabel: string;
}

export interface Notice {
	readonly level: 'error' | 'warning' | 'info';
	readonly text: string;
	readonly details: readonly string[];
}

export type ControllerAccelerationStopReason =
	AccelerationStopReason | 'cancelled' | 'save_failed' | 'conflict';

export interface AccelerationStatus {
	readonly running: boolean;
	readonly turnsAdvanced: number;
	readonly targetTurns: number;
	readonly stopReason: ControllerAccelerationStopReason | null;
	readonly message: string;
	/** Alertes nouvelles qui ont interrompu l'accélération. */
	readonly alerts: readonly string[];
	/** Résumé groupé des trimestres simulés, une fois l'accélération terminée. */
	readonly summary: SpanSummaryView | null;
}

export interface ControllerSnapshot {
	readonly screen: 'home' | 'game';
	readonly home: HomeInfo;
	readonly view: PlayerView | null;
	readonly plan: readonly PlanStep[];
	readonly saveStatus: SaveStatus | null;
	/** Vrai si une transition (tour, choix) est permise maintenant. */
	readonly canAct: boolean;
	readonly continuingUnsaved: boolean;
	readonly pendingImport: PendingImport | null;
	readonly notice: Notice | null;
	readonly acceleration: AccelerationStatus | null;
	/**
	 * Résultat du dernier choix à présenter dans la fenêtre de décision (P3-14).
	 * État de session : une reprise ne le rouvre pas (pas de rejeu).
	 */
	readonly outcomeOpen: boolean;
	/** Note à présenter : trimestre manuel, période accélérée, ou aucune (P3-14). */
	readonly note: 'quarter' | 'span' | null;
}

export type StartResult = 'started' | 'needs_confirmation' | 'failed';

type Listener = (snapshot: ControllerSnapshot) => void;

export class GameController {
	private readonly deps: ControllerDependencies;
	private state: GameState | null = null;
	private plan: PlanStep[] = [];
	/** Retraits automatiques du plan pendant la session (journal, P3-11). */
	private adjustments: PlanAdjustment[] = [];
	private screen: 'home' | 'game' = 'home';
	private saveStatus: SaveStatus | null = null;
	private continuingUnsaved = false;
	private home: HomeInfo;
	private loaded: SaveEnvelope | null = null;
	private pendingImport: SaveEnvelope | null = null;
	private notice: Notice | null = null;
	private acceleration: AccelerationStatus | null = null;
	private accelerationToken = 0;
	/** État au lancement de l'accélération en cours, pour le résumé groupé. */
	private accelerationStart: GameState | null = null;
	/** Instance dont le résultat est affiché (session seulement, P3-14). */
	private outcomeFor: string | null = null;
	/** Note de cabinet ouverte (session seulement, P3-14). */
	private note: 'quarter' | 'span' | null = null;
	private readonly listeners = new Set<Listener>();
	private cachedSnapshot: ControllerSnapshot | null = null;

	constructor(deps: ControllerDependencies) {
		this.deps = deps;
		this.home = this.readHome();
	}

	// -- Abonnement ---------------------------------------------------------

	subscribe(listener: Listener): () => void {
		this.listeners.add(listener);
		listener(this.snapshot());
		return () => this.listeners.delete(listener);
	}

	snapshot(): ControllerSnapshot {
		if (this.cachedSnapshot) return this.cachedSnapshot;
		const { content } = this.deps;
		this.cachedSnapshot = {
			screen: this.screen,
			home: this.home,
			view: this.state ? projectView(this.state, this.plan, content, this.adjustments) : null,
			plan: [...this.plan],
			saveStatus: this.saveStatus,
			canAct: this.canAct(),
			continuingUnsaved: this.continuingUnsaved,
			pendingImport: this.pendingImport
				? {
						dateLabel: formatTurn(this.pendingImport.state.turn),
						savedAtLabel: formatSavedAt(this.pendingImport.savedAt)
					}
				: null,
			notice: this.notice,
			acceleration: this.acceleration,
			outcomeOpen: this.outcomeFor !== null,
			note: this.note
		};
		return this.cachedSnapshot;
	}

	private changed(): void {
		this.cachedSnapshot = null;
		const snapshot = this.snapshot();
		for (const listener of this.listeners) listener(snapshot);
	}

	// -- Accueil ------------------------------------------------------------

	private readHome(): HomeInfo {
		const { storage, content } = this.deps;
		this.loaded = null;
		if (!storage) return { existing: null, unreadable: null, storageAvailable: false };
		const outcome = readSave(storage, content);
		if (outcome.status === 'empty')
			return { existing: null, unreadable: null, storageAvailable: true };
		if (outcome.status === 'error') {
			return { existing: null, unreadable: outcome.error, storageAvailable: true };
		}
		this.loaded = outcome.envelope;
		return {
			existing: {
				dateLabel: formatTurn(outcome.envelope.state.turn),
				savedAtLabel: formatSavedAt(outcome.envelope.savedAt),
				ended: outcome.envelope.state.end !== null,
				fromBackup: outcome.source === 'backup'
			},
			unreadable: outcome.currentError,
			storageAvailable: true
		};
	}

	/** Reprend la sauvegarde existante. */
	resume(): boolean {
		this.home = this.readHome();
		if (!this.loaded) {
			this.notice = { level: 'error', text: 'Aucune sauvegarde à reprendre.', details: [] };
			this.changed();
			return false;
		}
		this.enterGame(this.loaded.state, { kind: 'saved', savedAt: this.loaded.savedAt });
		if (this.home.existing?.fromBackup) {
			this.notice = {
				level: 'warning',
				text: 'La dernière sauvegarde était endommagée : la précédente a été reprise. La sauvegarde endommagée n’a pas été effacée.',
				details: this.home.unreadable?.details ?? []
			};
		}
		this.changed();
		return true;
	}

	/**
	 * Nouvelle carrière. Une sauvegarde existante (lisible ou non) n'est remplacée
	 * qu'avec `replaceExisting`, après confirmation du joueur.
	 */
	newCareer(
		options: {
			replaceExisting?: boolean;
			origin?: string;
			engagement?: string;
			region?: string;
			ambition?: string;
			/** Seed imposée pour rejouer une partie (P3-42). */
			seed?: string;
		} = {}
	): StartResult {
		this.home = this.readHome();
		const hasExisting = this.home.existing !== null || this.home.unreadable !== null;
		if (hasExisting && !options.replaceExisting) return 'needs_confirmation';
		const state = createGame(
			{
				seed: options.seed ?? this.deps.newSeed(),
				...(options.origin ? { origin: options.origin } : {}),
				...(options.engagement ? { engagement: options.engagement } : {}),
				...(options.region ? { region: options.region } : {}),
				...(options.ambition ? { ambition: options.ambition } : {})
			},
			this.deps.content
		);
		this.enterGame(state, null);
		this.persist({ overwriteUnreadable: options.replaceExisting === true });
		this.changed();
		return this.saveStatus?.kind === 'failed' ? 'failed' : 'started';
	}

	/** Origines et engagements proposées à la création d'une carrière. */
	creationOptions(): ReturnType<typeof creationOptions> {
		return creationOptions(this.deps.content);
	}

	/** Retour à l'accueil ; le brouillon de plan non validé est abandonné. */
	leave(): void {
		this.accelerationToken += 1;
		this.state = null;
		this.plan = [];
		this.adjustments = [];
		this.screen = 'home';
		this.saveStatus = null;
		this.continuingUnsaved = false;
		this.notice = null;
		this.acceleration = null;
		this.outcomeFor = null;
		this.note = null;
		this.home = this.readHome();
		this.changed();
	}

	private enterGame(state: GameState, status: SaveStatus | null): void {
		this.accelerationToken += 1;
		this.state = state;
		this.plan = [];
		this.adjustments = [];
		this.screen = 'game';
		this.continuingUnsaved = false;
		this.notice = null;
		this.acceleration = null;
		this.outcomeFor = null;
		this.note = null;
		this.saveStatus = this.deps.storage ? status : { kind: 'unavailable' };
	}

	// -- Plan ---------------------------------------------------------------

	/**
	 * Ajoute une étape en fin de plan (ponctuelle, P3-11). Une étape déjà
	 * impossible est refusée avec son motif, sans être ajoutée.
	 */
	addStep(step: PlanStep): boolean {
		if (!this.state || this.state.phase !== 'planning' || this.acceleration?.running) return false;
		const preview = previewPlan(this.state, { steps: [...this.plan, step] }, this.deps.content);
		const issue = preview.steps.at(-1)?.issues[0];
		if (issue) {
			this.notice = {
				level: 'warning',
				text: `« ${this.stepLabel(step)} » n’a pas été ajoutée au plan.`,
				details: [issue.message]
			};
			this.changed();
			return false;
		}
		this.plan = [...this.plan, step];
		this.notice = null;
		this.changed();
		return true;
	}

	removeStep(index: number): void {
		if (this.acceleration?.running) return;
		this.plan = this.plan.filter((_step, position) => position !== index);
		// Retirer une étape peut rendre valide une occurrence suivante, jamais l'inverse.
		this.changed();
	}

	moveStep(index: number, offset: -1 | 1): void {
		if (this.acceleration?.running) return;
		const target = index + offset;
		if (target < 0 || target >= this.plan.length) return;
		const next = [...this.plan];
		[next[index], next[target]] = [next[target]!, next[index]!];
		this.plan = next;
		// Une étape avancée peut épuiser le temps ou les ressources d'une suivante.
		const removed = this.settlePlan();
		if (removed.length > 0) this.notice = this.adjustedNotice(removed);
		this.changed();
	}

	/** Épingle (répète chaque trimestre) ou rend ponctuelle une action du plan (P3-11). */
	togglePin(index: number): void {
		if (this.acceleration?.running) return;
		const step = this.plan[index];
		if (!step || step.kind !== 'action') return;
		const base: PlanStep =
			step.target === undefined
				? { kind: 'action', id: step.id }
				: { kind: 'action', id: step.id, target: step.target };
		this.plan = this.plan.map((entry, position) =>
			position === index ? (step.pinned ? base : { ...base, pinned: true }) : entry
		);
		this.changed();
	}

	clearPlan(): void {
		if (this.acceleration?.running) return;
		this.plan = [];
		this.changed();
	}

	// -- Transitions --------------------------------------------------------

	private canAct(): boolean {
		if (!this.state || this.state.phase === 'ended' || this.acceleration?.running) return false;
		const status = this.saveStatus;
		if (!status || status.kind === 'conflict') return false;
		return status.kind !== 'failed' || this.continuingUnsaved;
	}

	commitTurn(): boolean {
		if (this.acceleration?.running) return false;
		this.acceleration = null;
		const turn = this.state?.turn;
		const done = this.run(commitTurn({ steps: this.plan }), true);
		// Note de cabinet après chaque trimestre manuel, sauf fin de carrière (bilan).
		if (done && this.state && this.state.turn !== turn && this.state.phase !== 'ended') {
			this.outcomeFor = null;
			this.note = 'quarter';
			this.changed();
		}
		return done;
	}

	/** Ferme le résultat du choix (« Continuer » ou « Décision suivante »). */
	dismissOutcome(): void {
		if (this.outcomeFor === null) return;
		this.outcomeFor = null;
		this.changed();
	}

	/** Rouvre la note du dernier trimestre (date de l'en-tête). */
	openQuarterNote(): void {
		if (!this.state || this.acceleration?.running) return;
		this.note = 'quarter';
		this.changed();
	}

	/** Ferme la note ; la note de période referme aussi le résumé d'accélération. */
	dismissNote(): void {
		if (this.note === null) return;
		if (this.note === 'span' && !this.acceleration?.running) this.acceleration = null;
		this.note = null;
		this.changed();
	}

	/** Libellé lisible d'une étape (notice des étapes retirées du plan). */
	private stepLabel(step: PlanStep): string {
		const { content } = this.deps;
		return step.kind === 'action'
			? (content.actions[step.id]?.label ?? step.id)
			: `Achat : ${content.upgrades[step.id]?.label ?? step.id}`;
	}

	private adjustedNotice(removed: readonly PlanRemoval[]): Notice | null {
		if (removed.length === 0) return null;
		return {
			level: 'info',
			text: 'Plan ajusté :',
			details: removed.map((removal) => this.removalText(removal))
		};
	}

	private removalText(removal: PlanRemoval): string {
		return `${this.stepLabel(removal.step)} retiré — ${removal.reason}`;
	}

	/** Consigne les retraits automatiques au journal de la session (trimestre en cours). */
	private recordRemovals(removed: readonly PlanRemoval[]): void {
		if (!this.state || removed.length === 0) return;
		const turn = this.state.turn;
		const lines = removed.map((removal) => this.removalText(removal));
		const last = this.adjustments.at(-1);
		this.adjustments =
			last?.turn === turn
				? [...this.adjustments.slice(0, -1), { turn, lines: [...last.lines, ...lines] }]
				: [...this.adjustments, { turn, lines }];
	}

	/** Nettoie le brouillon après un changement d'état ou d'ordre (P3-11). */
	private settlePlan(): readonly PlanRemoval[] {
		if (!this.state || this.state.phase !== 'planning') return [];
		const pruned = prunePlan(this.state, { steps: this.plan }, this.deps.content);
		this.plan = [...pruned.plan.steps];
		this.recordRemovals(pruned.removed);
		return pruned.removed;
	}

	/** Report du plan après une transition (règle commune au tour manuel et à l'accélération). */
	private carryPlan(): readonly PlanRemoval[] {
		if (!this.state || this.state.phase === 'ended') {
			this.plan = [];
			return [];
		}
		const carried = carryOverPlan(this.state, { steps: this.plan }, this.deps.content);
		this.plan = [...carried.plan.steps];
		this.recordRemovals(carried.removed);
		return carried.removed;
	}

	/** Change la mission d'un collaborateur (commande hors tour, sauvegardée aussitôt). */
	assignMission(characterId: string, missionId: string): boolean {
		if (this.acceleration?.running) return false;
		return this.run(assignMissionCommand(characterId, missionId), false);
	}

	choose(choiceId: string): boolean {
		// Le résumé d'une accélération arrêtée par cette décision reste consultable.
		if (this.acceleration?.running) return false;
		const instanceId = this.state?.events.pending[0]?.instanceId;
		if (!instanceId) return false;
		const done = this.run(chooseEventCommand(instanceId, choiceId), true);
		// Résultat présenté dans la même fenêtre (P3-14), une seule fois.
		if (done) {
			this.outcomeFor = instanceId;
			this.changed();
		}
		return done;
	}

	// -- Accélération -------------------------------------------------------

	private accelerationMessage(
		result: Pick<AccelerationResult, 'stopReason' | 'alerts' | 'issues'>,
		turnsAdvanced: number
	): string {
		const count = `${turnsAdvanced} trimestre${turnsAdvanced > 1 ? 's' : ''} simulé${turnsAdvanced > 1 ? 's' : ''}`;
		switch (result.stopReason) {
			case 'limit_reached':
				return `${count} : limite demandée atteinte.`;
			case 'decision_pending':
				return `${count} : une décision attend votre réponse.`;
			case 'alert': {
				const others = result.alerts.length - 1;
				const more =
					others > 0
						? ` (et ${others} autre${others > 1 ? 's' : ''} alerte${others > 1 ? 's' : ''})`
						: '';
				return `${count} : ${result.alerts[0]?.message ?? 'une nouvelle alerte demande votre attention'}${more}`;
			}
			case 'game_ended':
				return `${count} : la carrière est terminée.`;
			case 'invalid_plan':
				return `${count} : ${result.issues[0]?.message ?? 'le plan récurrent n’est plus valide'}`;
			case 'empty_plan':
				return `${count} : le plan ne contient plus aucune activité ; accélération arrêtée.`;
		}
	}

	private finishAcceleration(
		running: AccelerationStatus,
		stopReason: ControllerAccelerationStopReason,
		message: string
	): void {
		const start = this.accelerationStart;
		this.accelerationStart = null;
		const summary =
			start && this.state && running.turnsAdvanced > 0
				? summarizeSpan(start, this.state, this.deps.content)
				: null;
		this.acceleration = { ...running, running: false, stopReason, message, summary };
		// Note de période présentée d'office ; une décision qui a arrêté l'accélération suit.
		if (summary && this.state?.phase !== 'ended') this.note = 'span';
	}

	/**
	 * Simule au plus `maxTurns` trimestres, un par lot : chaque état cohérent est
	 * sauvegardé puis le navigateur reprend la main avant le tour suivant.
	 */
	async accelerate(maxTurns: number): Promise<boolean> {
		if (!Number.isSafeInteger(maxTurns) || maxTurns < 1) return false;
		if (!this.state || !this.canAct() || this.state.phase !== 'planning') return false;

		const token = ++this.accelerationToken;
		this.accelerationStart = this.state;
		let removed: PlanRemoval[] = [];
		let running: AccelerationStatus = {
			running: true,
			turnsAdvanced: 0,
			targetTurns: maxTurns,
			stopReason: null,
			message: 'Accélération en cours…',
			alerts: [],
			summary: null
		};
		this.acceleration = running;
		this.notice = null;
		this.note = null;
		this.outcomeFor = null;
		this.changed();

		while (running.turnsAdvanced < maxTurns && this.state) {
			if (token !== this.accelerationToken) return true;
			const batch = accelerateEngine(
				this.state,
				{ plan: { steps: this.plan }, maxTurns: 1 },
				this.deps.content
			);
			this.state = batch.state;
			this.plan = batch.state.phase === 'ended' ? [] : [...batch.plan.steps];
			this.recordRemovals(batch.removed);
			removed = [...removed, ...batch.removed];
			this.notice = this.adjustedNotice(removed);
			running = {
				...running,
				turnsAdvanced: running.turnsAdvanced + batch.turnsAdvanced
			};

			if (batch.turnsAdvanced > 0) {
				this.persist();
				if (this.saveStatus?.kind === 'failed' && !this.continuingUnsaved) {
					this.finishAcceleration(
						running,
						'save_failed',
						`${running.turnsAdvanced} trimestre${running.turnsAdvanced > 1 ? 's' : ''} simulé${running.turnsAdvanced > 1 ? 's' : ''} : la sauvegarde a échoué.`
					);
					this.changed();
					return true;
				}
			}

			if (batch.stopReason !== 'limit_reached') {
				this.finishAcceleration(
					{ ...running, alerts: batch.alerts.map((alert) => alert.message) },
					batch.stopReason,
					this.accelerationMessage(batch, running.turnsAdvanced)
				);
				this.changed();
				return true;
			}
			if (running.turnsAdvanced >= maxTurns) {
				this.finishAcceleration(
					running,
					'limit_reached',
					this.accelerationMessage(batch, running.turnsAdvanced)
				);
				this.changed();
				return true;
			}

			this.acceleration = running;
			this.changed();
			await (this.deps.yieldControl?.() ?? Promise.resolve());
		}
		return true;
	}

	cancelAcceleration(): boolean {
		const running = this.acceleration;
		if (!running?.running) return false;
		this.accelerationToken += 1;
		this.finishAcceleration(
			running,
			'cancelled',
			`${running.turnsAdvanced} trimestre${running.turnsAdvanced > 1 ? 's' : ''} simulé${running.turnsAdvanced > 1 ? 's' : ''} : accélération interrompue.`
		);
		this.changed();
		return true;
	}

	private run(command: GameCommand, clearsPlan: boolean): boolean {
		if (!this.state) return false;
		if (!this.canAct()) {
			this.notice = {
				level: 'error',
				text:
					this.saveStatus?.kind === 'conflict'
						? 'La partie a été modifiée dans un autre onglet : rechargez-la avant de continuer.'
						: 'La dernière étape n’est pas sauvegardée : réessayez, exportez ou continuez sans sauvegarde.',
				details: []
			};
			this.changed();
			return false;
		}
		const result = transition(this.state, command, this.deps.content);
		if (!result.ok) {
			this.notice = {
				level: 'error',
				text: result.error.message,
				details: result.error.issues.map((issue) => issue.message)
			};
			this.changed();
			return false;
		}
		this.state = result.state;
		this.notice = this.adjustedNotice(clearsPlan ? this.carryPlan() : this.settlePlan());
		this.persist();
		this.changed();
		return true;
	}

	// -- Sauvegarde ---------------------------------------------------------

	private persist(options: { overwriteUnreadable?: boolean } = {}): void {
		const { storage, content, now } = this.deps;
		if (!this.state || !storage) return;
		if (this.saveStatus?.kind === 'conflict') return;
		const savedAt = now();
		const result = writeSave(
			storage,
			createEnvelope(this.state, content, savedAt),
			content,
			options
		);
		if (result.ok) {
			this.saveStatus = { kind: 'saved', savedAt };
			this.continuingUnsaved = false;
		} else {
			this.saveStatus = { kind: 'failed', error: result.error };
		}
	}

	retrySave(): boolean {
		if (this.saveStatus?.kind !== 'failed') return false;
		this.persist();
		this.changed();
		// `persist` modifie le statut : relecture explicite, hors de l'analyse de flux.
		const status = this.saveStatus as SaveStatus | null;
		return status?.kind === 'saved';
	}

	/** Décision explicite : continuer malgré l'échec de sauvegarde. */
	continueWithoutSaving(): void {
		if (this.saveStatus?.kind === 'failed') {
			this.continuingUnsaved = true;
			this.changed();
		}
	}

	/** Un autre onglet a modifié la sauvegarde : plus aucune écriture ni transition. */
	markExternalChange(): void {
		if (this.screen !== 'game' || !this.deps.storage) return;
		if (this.acceleration?.running) {
			const running = this.acceleration;
			this.accelerationToken += 1;
			this.finishAcceleration(
				running,
				'conflict',
				`${running.turnsAdvanced} trimestre${running.turnsAdvanced > 1 ? 's' : ''} simulé${running.turnsAdvanced > 1 ? 's' : ''} : une autre fenêtre a modifié la sauvegarde.`
			);
		}
		this.saveStatus = { kind: 'conflict' };
		this.changed();
	}

	/** Recharge la partie depuis le stockage (après un conflit d'onglets). */
	reload(): boolean {
		this.leave();
		return this.resume();
	}

	exportCurrent(): ExportedSave | null {
		if (!this.state) return null;
		return exportSave(createEnvelope(this.state, this.deps.content, this.deps.now()));
	}

	// -- Import -------------------------------------------------------------

	/** Valide un fichier importé ; demande confirmation si une partie existe. */
	importFile(text: string): 'imported' | 'needs_confirmation' | 'invalid' {
		const result = importSave(text, this.deps.content);
		if (!result.ok) {
			this.notice = { level: 'error', text: result.error.message, details: result.error.details };
			this.changed();
			return 'invalid';
		}
		this.pendingImport = result.envelope;
		const hasExisting =
			this.state !== null || this.home.existing !== null || this.home.unreadable !== null;
		if (hasExisting) {
			this.changed();
			return 'needs_confirmation';
		}
		this.confirmImport();
		return 'imported';
	}

	confirmImport(): void {
		const envelope = this.pendingImport;
		if (!envelope) return;
		this.pendingImport = null;
		this.enterGame(envelope.state, null);
		this.persist({ overwriteUnreadable: true });
		this.changed();
	}

	cancelImport(): void {
		this.pendingImport = null;
		this.changed();
	}

	/** Masque le résumé et le message de la dernière accélération terminée. */
	dismissAcceleration(): void {
		if (this.acceleration?.running) return;
		this.acceleration = null;
		this.changed();
	}

	dismissNotice(): void {
		this.notice = null;
		this.changed();
	}
}
