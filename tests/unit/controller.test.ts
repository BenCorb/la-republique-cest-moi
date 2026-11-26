import { describe, expect, it } from 'vitest';
import { GameController } from '../../src/lib/game/app/controller.ts';
import { SAVE_KEY, readSave, type KeyValueStorage } from '../../src/lib/game/persistence/index.ts';
import type { Content } from '../../src/lib/game/content/types.ts';
import { fixtureContent, withEvents } from '../fixtures/content.ts';

class MemoryStorage implements KeyValueStorage {
	readonly items = new Map<string, string>();
	quota = false;
	getItem(key: string): string | null {
		return this.items.get(key) ?? null;
	}
	setItem(key: string, value: string): void {
		if (this.quota) throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
		this.items.set(key, value);
	}
}

let clock = 0;
function controller(
	storage: KeyValueStorage | null = new MemoryStorage(),
	content: Content = fixtureContent,
	yieldControl?: () => Promise<void>
) {
	return new GameController({
		content,
		storage,
		now: () => `2026-11-24T10:00:${String(clock++ % 60).padStart(2, '0')}.000Z`,
		newSeed: () => 'contrôleur',
		...(yieldControl ? { yieldControl } : {})
	});
}

describe('accueil et nouvelle carrière', () => {
	it('démarre sans sauvegarde, crée une carrière au T1 2000 et la sauvegarde', () => {
		const storage = new MemoryStorage();
		const game = controller(storage);
		expect(game.snapshot()).toMatchObject({
			screen: 'home',
			home: { existing: null, storageAvailable: true }
		});
		expect(game.newCareer()).toBe('started');
		const snapshot = game.snapshot();
		expect(snapshot.screen).toBe('game');
		expect(snapshot.view?.dateLabel).toBe('T1 2000');
		expect(snapshot.view?.age).toBe(25);
		expect(snapshot.saveStatus?.kind).toBe('saved');
		expect(snapshot.canAct).toBe(true);
		expect(storage.items.has(SAVE_KEY)).toBe(true);
	});

	it('demande confirmation avant de remplacer une carrière existante', () => {
		const storage = new MemoryStorage();
		controller(storage).newCareer();
		const second = controller(storage);
		expect(second.snapshot().home.existing?.dateLabel).toBe('T1 2000');
		expect(second.newCareer()).toBe('needs_confirmation');
		expect(second.snapshot().screen).toBe('home');
		expect(second.newCareer({ replaceExisting: true })).toBe('started');
	});

	it('reprend une carrière sauvegardée à l’identique', () => {
		const storage = new MemoryStorage();
		const first = controller(storage);
		first.newCareer();
		first.addStep({ kind: 'action', id: 'test.fixed' });
		first.commitTurn();
		// Le brouillon reconduit n'est pas sauvegardé (il se perd au rechargement).
		first.clearPlan();
		const second = controller(storage);
		expect(second.resume()).toBe(true);
		expect(second.snapshot().view).toEqual(first.snapshot().view);
	});

	it('signale une sauvegarde illisible sans l’effacer, puis la remplace sur confirmation', () => {
		const storage = new MemoryStorage();
		storage.items.set(SAVE_KEY, '{ cassé');
		const game = controller(storage);
		expect(game.snapshot().home.unreadable?.code).toBe('unreadable');
		expect(game.newCareer()).toBe('needs_confirmation');
		expect(storage.items.get(SAVE_KEY)).toBe('{ cassé');
		expect(game.newCareer({ replaceExisting: true })).toBe('started');
		expect(readSave(storage, fixtureContent).status).toBe('loaded');
	});
});

describe('plan et trimestres', () => {
	it('compose le plan, l’ordonne, valide le trimestre et reconduit le plan', () => {
		const game = controller();
		game.newCareer();
		game.addStep({ kind: 'action', id: 'test.earn' });
		game.addStep({ kind: 'action', id: 'test.spend_cash' });
		expect(game.snapshot().view?.plan.valid).toBe(true);
		// Avancer la dépense la rend impossible : elle est retirée, le plan reste valide.
		game.moveStep(1, -1);
		expect(game.snapshot().view?.plan.valid).toBe(true);
		expect(game.snapshot().plan).toEqual([{ kind: 'action', id: 'test.earn' }]);
		game.addStep({ kind: 'action', id: 'test.random' });
		game.togglePin(0);
		game.removeStep(1);
		expect(game.snapshot().plan).toEqual([{ kind: 'action', id: 'test.earn', pinned: true }]);
		expect(game.commitTurn()).toBe(true);
		expect(game.snapshot().view?.dateLabel).toBe('T2 2000');
		expect(game.snapshot().plan).toEqual([{ kind: 'action', id: 'test.earn', pinned: true }]);
		expect(game.snapshot().notice).toBeNull();
	});

	it('retire les achats du plan reconduit et le signale', () => {
		const game = controller();
		game.newCareer();
		game.addStep({ kind: 'action', id: 'test.earn' });
		game.addStep({ kind: 'purchase', id: 'test.donors' });
		game.togglePin(0);
		game.togglePin(1);
		expect(game.commitTurn()).toBe(true);
		// Un achat n'est jamais épinglé ni reconduit ; son expiration n'est pas signalée.
		expect(game.snapshot().plan).toEqual([{ kind: 'action', id: 'test.earn', pinned: true }]);
		expect(game.snapshot().notice).toBeNull();
	});

	it('refuse une étape impossible avec un message lisible, sans rien changer', () => {
		const game = controller();
		game.newCareer();
		const before = game.snapshot().view;
		expect(game.addStep({ kind: 'action', id: 'test.expensive' })).toBe(false);
		const snapshot = game.snapshot();
		expect(snapshot.notice?.text).toBe('« Dépense lourde » n’a pas été ajoutée au plan.');
		expect(snapshot.notice?.details[0]).toContain('Budget politique insuffisant');
		expect(snapshot.view?.dateLabel).toBe(before?.dateLabel);
		expect(snapshot.plan).toHaveLength(0);
	});

	it('indique pourquoi une action ne peut pas être ajoutée', () => {
		const game = controller();
		game.newCareer();
		const gated = game.snapshot().view?.actions.find((action) => action.id === 'test.gated');
		expect(gated).toMatchObject({
			addable: false,
			reason: 'Il faut au moins 4 points d’influence.'
		});
	});

	it('ne révèle ni le générateur, ni les probabilités, ni les effets des choix', () => {
		const alert = withEvents(['test.stress_alert']);
		const game = controller(new MemoryStorage(), alert);
		game.newCareer();
		const text = JSON.stringify(game.snapshot().view);
		// « chance » en mot entier : les paliers publics (« Chancelante ») ne sont pas une fuite.
		expect(text).not.toMatch(/rng|seed|mortality|\bchances?\b|probab|followUp/i);
	});
});

describe('décisions', () => {
	it('présente l’événement bloquant, applique le choix et le sauvegarde', () => {
		const alert = withEvents(['test.windfall', 'test.interview']);
		const storage = new MemoryStorage();
		const game = controller(storage, alert);
		game.newCareer();
		// Influence ≥ 3 requise par l'entretien : trois gains fixes.
		for (let index = 0; index < 2; index += 1) {
			game.addStep({ kind: 'action', id: 'test.fixed' });
			game.commitTurn();
			const snapshot = game.snapshot();
			if (snapshot.view?.decision) break;
		}
		let snapshot = game.snapshot();
		for (let guard = 0; !snapshot.view?.decision && guard < 10; guard += 1) {
			game.commitTurn();
			snapshot = game.snapshot();
		}
		const decision = snapshot.view?.decision;
		expect(decision?.title).toBe('Entretien');
		expect(snapshot.view?.alerts[0]).toEqual({
			level: 'danger',
			text: 'Décision attendue : Entretien'
		});
		expect(game.commitTurn()).toBe(false);
		expect(game.choose('decline')).toBe(true);
		expect(game.snapshot().view?.decision).toBeNull();
		const saved = readSave(storage, alert);
		expect(saved.status === 'loaded' && saved.envelope.state.phase).toBe('planning');
	});
});

describe('accélération', () => {
	it('répète le plan pendant une année et sauvegarde chaque état cohérent', async () => {
		const storage = new MemoryStorage();
		const game = controller(storage);
		game.newCareer();
		game.addStep({ kind: 'action', id: 'test.fixed' });
		game.togglePin(0);

		expect(await game.accelerate(4)).toBe(true);
		const snapshot = game.snapshot();
		expect(snapshot.view?.dateLabel).toBe('T1 2001');
		expect(snapshot.view?.resources.find((resource) => resource.id === 'influence')?.value).toBe(
			'8'
		);
		expect(snapshot.plan).toEqual([{ kind: 'action', id: 'test.fixed', pinned: true }]);
		expect(snapshot.acceleration).toMatchObject({
			running: false,
			turnsAdvanced: 4,
			stopReason: 'limit_reached'
		});
		const saved = readSave(storage, fixtureContent);
		expect(saved.status === 'loaded' && saved.envelope.state.turn).toBe(4);
	});

	it('rend la main entre les tours et peut être interrompue', async () => {
		let release: (() => void) | undefined;
		const yieldControl = () =>
			new Promise<void>((resolve) => {
				release = resolve;
			});
		const storage = new MemoryStorage();
		const game = controller(storage, fixtureContent, yieldControl);
		game.newCareer();

		const running = game.accelerate(40);
		await Promise.resolve();
		expect(game.snapshot().acceleration).toMatchObject({ running: true, turnsAdvanced: 1 });
		expect(game.cancelAcceleration()).toBe(true);
		release?.();
		expect(await running).toBe(true);
		expect(game.snapshot().acceleration).toMatchObject({
			running: false,
			turnsAdvanced: 1,
			stopReason: 'cancelled'
		});
		const saved = readSave(storage, fixtureContent);
		expect(saved.status === 'loaded' && saved.envelope.state.turn).toBe(1);
	});

	it('s’arrête et sauvegarde lorsqu’une décision apparaît', async () => {
		const events = withEvents(['test.stress_alert']);
		const content: Content = {
			...events,
			balance: {
				...events.balance,
				wellbeing: { ...events.balance.wellbeing, startingStress: 70 }
			}
		};
		const storage = new MemoryStorage();
		const game = controller(storage, content);
		game.newCareer();

		await game.accelerate(40);
		expect(game.snapshot().acceleration).toMatchObject({
			turnsAdvanced: 1,
			stopReason: 'decision_pending'
		});
		expect(game.snapshot().view?.decision).not.toBeNull();
		const saved = readSave(storage, content);
		expect(saved.status === 'loaded' && saved.envelope.state.phase).toBe('decision');
	});

	it('retire les activités épinglées devenues impossibles et s’arrête sur le plan vide', async () => {
		const game = controller();
		game.newCareer();
		game.addStep({ kind: 'action', id: 'test.fixed' });
		game.addStep({ kind: 'action', id: 'test.fixed' });
		game.togglePin(0);
		game.togglePin(1);

		await game.accelerate(40);
		const snapshot = game.snapshot();
		expect(snapshot.acceleration?.stopReason).toBe('empty_plan');
		expect(snapshot.acceleration?.message).toMatch(/plus aucune activité/u);
		expect(snapshot.plan).toEqual([]);
		expect(snapshot.view?.plan.valid).toBe(true);
		expect(snapshot.notice?.text).toBe('Plan ajusté :');
		expect(snapshot.notice?.details).toEqual([
			expect.stringMatching(/^Gain fixe retiré — Budget politique insuffisant/u),
			expect.stringMatching(/^Gain fixe retiré — Budget politique insuffisant/u)
		]);
		const journal = snapshot.view?.journal.flatMap((quarter) => quarter.lines) ?? [];
		expect(journal.filter((line) => line.text.startsWith('Plan ajusté :'))).toHaveLength(2);
	});

	it('n’achète qu’une fois pendant l’accélération et résume la période', async () => {
		const game = controller();
		game.newCareer();
		game.addStep({ kind: 'purchase', id: 'test.donors' });
		game.addStep({ kind: 'action', id: 'test.random' });
		game.togglePin(1);

		await game.accelerate(4);
		const snapshot = game.snapshot();
		expect(snapshot.acceleration).toMatchObject({ turnsAdvanced: 4, stopReason: 'limit_reached' });
		expect(snapshot.plan).toEqual([{ kind: 'action', id: 'test.random', pinned: true }]);
		// Un achat expiré n'est pas un retrait : aucune notice.
		expect(snapshot.notice).toBeNull();
		const summary = snapshot.acceleration?.summary;
		expect(summary).toMatchObject({ turns: 4, period: 'du T1 2000 au T4 2000' });
		expect(summary?.quarters).toHaveLength(4);
		expect(summary?.changes.map((change) => change.name)).toContain('Popularité');

		game.dismissAcceleration();
		expect(game.snapshot().acceleration).toBeNull();
	});

	it('s’arrête au premier échec de sauvegarde', async () => {
		const storage = new MemoryStorage();
		const game = controller(storage);
		game.newCareer();
		storage.quota = true;

		await game.accelerate(4);
		expect(game.snapshot().acceleration).toMatchObject({
			turnsAdvanced: 1,
			stopReason: 'save_failed'
		});
		expect(game.snapshot().saveStatus).toMatchObject({
			kind: 'failed',
			error: { code: 'quota_exceeded' }
		});
		expect(game.snapshot().canAct).toBe(false);
	});
});

describe('échecs de sauvegarde', () => {
	it('bloque la suite tant que la sauvegarde a échoué, puis réessaie', () => {
		const storage = new MemoryStorage();
		const game = controller(storage);
		game.newCareer();
		storage.quota = true;
		expect(game.commitTurn()).toBe(true);
		let snapshot = game.snapshot();
		expect(snapshot.saveStatus).toMatchObject({
			kind: 'failed',
			error: { code: 'quota_exceeded' }
		});
		expect(snapshot.canAct).toBe(false);
		expect(game.commitTurn()).toBe(false);
		expect(game.snapshot().notice?.text).toContain('pas sauvegardée');

		storage.quota = false;
		expect(game.retrySave()).toBe(true);
		snapshot = game.snapshot();
		expect(snapshot.saveStatus?.kind).toBe('saved');
		expect(snapshot.canAct).toBe(true);
	});

	it('permet de continuer sans sauvegarde sur décision explicite', () => {
		const storage = new MemoryStorage();
		const game = controller(storage);
		game.newCareer();
		storage.quota = true;
		game.commitTurn();
		game.continueWithoutSaving();
		expect(game.snapshot().canAct).toBe(true);
		expect(game.commitTurn()).toBe(true);
		expect(game.snapshot().continuingUnsaved).toBe(true);
	});

	it('joue sans stockage en le signalant', () => {
		const game = controller(null);
		expect(game.snapshot().home.storageAvailable).toBe(false);
		game.newCareer();
		expect(game.snapshot().saveStatus).toEqual({ kind: 'unavailable' });
		expect(game.commitTurn()).toBe(true);
	});

	it('bloque les transitions après une modification par un autre onglet, jusqu’au rechargement', () => {
		const storage = new MemoryStorage();
		const game = controller(storage);
		game.newCareer();
		game.markExternalChange();
		expect(game.snapshot().canAct).toBe(false);
		expect(game.commitTurn()).toBe(false);
		expect(game.reload()).toBe(true);
		expect(game.snapshot().canAct).toBe(true);
	});
});

describe('export et import', () => {
	it('exporte puis réimporte la partie sur confirmation', () => {
		const storage = new MemoryStorage();
		const game = controller(storage);
		game.newCareer();
		game.commitTurn();
		const exported = game.exportCurrent();
		expect(exported?.fileName).toBe('la-republique-cest-moi-2000-T2.json');

		game.commitTurn();
		expect(game.importFile(exported!.text)).toBe('needs_confirmation');
		expect(game.snapshot().pendingImport?.dateLabel).toBe('T2 2000');
		game.cancelImport();
		expect(game.snapshot().view?.dateLabel).toBe('T3 2000');

		game.importFile(exported!.text);
		game.confirmImport();
		expect(game.snapshot().view?.dateLabel).toBe('T2 2000');
		expect(game.snapshot().saveStatus?.kind).toBe('saved');
	});

	it('refuse un fichier invalide avec un message lisible', () => {
		const game = controller();
		expect(game.importFile('n’importe quoi')).toBe('invalid');
		expect(game.snapshot().notice?.text).toBe('Ce fichier est illisible.');
	});

	it('importe directement s’il n’existe aucune partie', () => {
		const source = controller();
		source.newCareer();
		const text = source.exportCurrent()!.text;
		const target = controller(new MemoryStorage());
		expect(target.importFile(text)).toBe('imported');
		expect(target.snapshot().screen).toBe('game');
	});
});
