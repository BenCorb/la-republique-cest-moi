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
 *     (`carryOverPlan` : achats et cibles sans objet retirés) ;
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
	commitTurn,
	createGame,
	formatTurn,
	transition,
	type AccelerationResult,
	type AccelerationStopReason,
	type GameCommand,
	type GameState,
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
}

export type StartResult = 'started' | 'needs_confirmation' | 'failed';

type Listener = (snapshot: ControllerSnapshot) => void;

export class GameController {
	private readonly deps: ControllerDependencies;
	private state: GameState | null = null;
	private plan: PlanStep[] = [];
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
			view: this.state ? projectView(this.state, this.plan, content) : null,
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
			acceleration: this.acceleration
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
		options: { replaceExisting?: boolean; origin?: string; profession?: string } = {}
	): StartResult {
		this.home = this.readHome();
		const hasExisting = this.home.existing !== null || this.home.unreadable !== null;
		if (hasExisting && !options.replaceExisting) return 'needs_confirmation';
		const state = createGame(
			{
				seed: this.deps.newSeed(),
				...(options.origin ? { origin: options.origin } : {}),
				...(options.profession ? { profession: options.profession } : {})
			},
			this.deps.content
		);
		this.enterGame(state, null);
		this.persist({ overwriteUnreadable: options.replaceExisting === true });
		this.changed();
		return this.saveStatus?.kind === 'failed' ? 'failed' : 'started';
	}

	/** Origines et professions proposées à la création d'une carrière. */
	creationOptions(): ReturnType<typeof creationOptions> {
		return creationOptions(this.deps.content);
	}

	/** Retour à l'accueil ; le brouillon de plan non validé est abandonné. */
	leave(): void {
		this.accelerationToken += 1;
		this.state = null;
		this.plan = [];
		this.screen = 'home';
		this.saveStatus = null;
		this.continuingUnsaved = false;
		this.notice = null;
		this.acceleration = null;
		this.home = this.readHome();
		this.changed();
	}

	private enterGame(state: GameState, status: SaveStatus | null): void {
		this.accelerationToken += 1;
		this.state = state;
		this.plan = [];
		this.screen = 'game';
		this.continuingUnsaved = false;
		this.notice = null;
		this.acceleration = null;
		this.saveStatus = this.deps.storage ? status : { kind: 'unavailable' };
	}

	// -- Plan ---------------------------------------------------------------

	addStep(step: PlanStep): void {
		if (!this.state || this.state.phase !== 'planning' || this.acceleration?.running) return;
		this.plan = [...this.plan, step];
		this.notice = null;
		this.changed();
	}

	removeStep(index: number): void {
		if (this.acceleration?.running) return;
		this.plan = this.plan.filter((_step, position) => position !== index);
		this.changed();
	}

	moveStep(index: number, offset: -1 | 1): void {
		if (this.acceleration?.running) return;
		const target = index + offset;
		if (target < 0 || target >= this.plan.length) return;
		const next = [...this.plan];
		[next[index], next[target]] = [next[target]!, next[index]!];
		this.plan = next;
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
		return this.run(commitTurn({ steps: this.plan }), true);
	}

	/** Libellé lisible d'une étape (notice des étapes retirées du plan). */
	private stepLabel(step: PlanStep): string {
		const { content } = this.deps;
		return step.kind === 'action'
			? (content.actions[step.id]?.label ?? step.id)
			: `Achat : ${content.upgrades[step.id]?.label ?? step.id}`;
	}

	private droppedNotice(dropped: readonly PlanStep[]): Notice | null {
		if (dropped.length === 0) return null;
		return {
			level: 'info',
			text: 'Plan reconduit pour le trimestre suivant ; étapes ponctuelles retirées :',
			details: dropped.map((step) => this.stepLabel(step))
		};
	}

	/** Report du plan après une transition (règle commune au tour manuel et à l'accélération). */
	private carryPlan(): readonly PlanStep[] {
		if (!this.state || this.state.phase === 'ended') {
			this.plan = [];
			return [];
		}
		const carried = carryOverPlan(this.state, { steps: this.plan }, this.deps.content);
		this.plan = [...carried.plan.steps];
		return carried.dropped;
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
		return this.run(chooseEventCommand(instanceId, choiceId), true);
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
		let dropped: PlanStep[] = [];
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
			dropped = [...dropped, ...batch.dropped];
			this.notice = this.droppedNotice(dropped);
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
		this.notice = clearsPlan ? this.droppedNotice(this.carryPlan()) : null;
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
