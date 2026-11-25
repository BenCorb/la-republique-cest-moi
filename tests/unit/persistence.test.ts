import { describe, expect, it } from 'vitest';
import {
	BACKUP_KEY,
	MAX_SAVE_BYTES,
	SAVE_KEY,
	SAVE_VERSION,
	createEnvelope,
	exportSave,
	importSave,
	migrateEnvelope,
	parseSaveText,
	readEnvelope,
	readSave,
	serializeEnvelope,
	writeSave,
	type KeyValueStorage,
	type ReadResult
} from '../../src/lib/game/persistence/index.ts';
import {
	RULES_VERSION,
	commitTurn,
	createGame,
	transition,
	turnOf,
	type GameState
} from '../../src/lib/game/engine/index.ts';
import { fixtureContent, withEvents } from '../fixtures/content.ts';

const SAVED_AT = '2026-11-24T10:00:00.000Z';

/** Stockage en mémoire, capable de simuler les pannes du navigateur. */
class MemoryStorage implements KeyValueStorage {
	readonly items = new Map<string, string>();
	failReads = false;
	quotaOn: string | null = null;
	failWritesOn: string | null = null;

	getItem(key: string): string | null {
		if (this.failReads) throw new Error('SecurityError');
		return this.items.get(key) ?? null;
	}

	setItem(key: string, value: string): void {
		if (this.quotaOn === key) {
			throw Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
		}
		if (this.failWritesOn === key) throw new Error('écriture impossible');
		this.items.set(key, value);
	}
}

function played(turns = 3, seed = 'sauvegarde'): GameState {
	let state = createGame({ seed }, fixtureContent);
	for (let index = 0; index < turns; index += 1) {
		const result = transition(
			state,
			commitTurn({ steps: [{ kind: 'action', id: 'test.random' }] }),
			fixtureContent
		);
		if (!result.ok) throw new Error(result.error.message);
		state = result.state;
	}
	return state;
}

const envelopeText = (state: GameState = played(), savedAt = SAVED_AT): string =>
	serializeEnvelope(createEnvelope(state, fixtureContent, savedAt));

function errorCode(result: ReadResult): string | null {
	return result.ok ? null : result.error.code;
}

/** Enveloppe brute modifiable pour fabriquer des sauvegardes invalides. */
function rawEnvelope(
	state: GameState = played()
): Record<string, unknown> & { state: Record<string, unknown> } {
	return JSON.parse(envelopeText(state)) as Record<string, unknown> & {
		state: Record<string, unknown>;
	};
}

describe('enveloppe de sauvegarde', () => {
	it('contient format, versions, date et état complet', () => {
		const state = played();
		const envelope = createEnvelope(state, fixtureContent, SAVED_AT);
		expect(envelope).toEqual({
			format: 'republique-save',
			saveVersion: SAVE_VERSION,
			rulesVersion: RULES_VERSION,
			contentVersion: fixtureContent.version,
			savedAt: SAVED_AT,
			state
		});
		expect(fixtureContent.version).toMatch(/^content-[0-9a-f]{8}$/);
	});

	it('restitue l’état à l’identique, PRNG et journal compris', () => {
		const state = played(6);
		const result = parseSaveText(envelopeText(state), fixtureContent);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.envelope.state).toStrictEqual(state);
		expect(result.migratedFrom).toBeNull();
	});

	it('ignore la date d’enregistrement : aucune progression hors ligne', () => {
		const state = played();
		const now = parseSaveText(envelopeText(state, SAVED_AT), fixtureContent);
		const later = parseSaveText(envelopeText(state, '2031-01-01T00:00:00.000Z'), fixtureContent);
		if (!now.ok || !later.ok) throw new Error('lecture impossible');
		expect(later.envelope.state).toStrictEqual(now.envelope.state);
		const next = (s: GameState) => transition(s, commitTurn(), fixtureContent);
		expect(next(later.envelope.state)).toStrictEqual(next(now.envelope.state));
	});
});

describe('lecture validée', () => {
	it.each<[string, () => string, string]>([
		['texte trop volumineux', () => ' '.repeat(MAX_SAVE_BYTES + 1), 'too_large'],
		['JSON illisible', () => '{ "format": ', 'unreadable'],
		['tableau', () => '[]', 'wrong_format'],
		[
			'autre format',
			() => JSON.stringify({ ...rawEnvelope(), format: 'autre-jeu' }),
			'wrong_format'
		],
		[
			'version absente',
			() => JSON.stringify({ ...rawEnvelope(), saveVersion: undefined }),
			'wrong_format'
		],
		[
			'version future',
			() => JSON.stringify({ ...rawEnvelope(), saveVersion: SAVE_VERSION + 1 }),
			'future_version'
		],
		['date absente', () => JSON.stringify({ ...rawEnvelope(), savedAt: 12 }), 'wrong_format'],
		[
			'champ inconnu dans l’état',
			() => {
				const raw = rawEnvelope();
				return JSON.stringify({ ...raw, state: { ...raw.state, cheat: true } });
			},
			'invalid_state'
		],
		[
			'ressource décimale',
			() => {
				const raw = rawEnvelope();
				const resources = raw.state.resources as Record<string, number>;
				return JSON.stringify({
					...raw,
					state: { ...raw.state, resources: { ...resources, influence: 1.5 } }
				});
			},
			'invalid_state'
		],
		[
			'journal incohérent',
			() => {
				const raw = rawEnvelope();
				return JSON.stringify({ ...raw, state: { ...raw.state, turn: 40 } });
			},
			'invalid_state'
		],
		[
			'amélioration absente du catalogue',
			() => {
				const raw = rawEnvelope();
				const upgrades = [{ instanceId: 'upgrade.1', upgradeId: 'test.disparue', acquiredTurn: 0 }];
				return JSON.stringify({ ...raw, state: { ...raw.state, upgrades, nextInstanceNumber: 2 } });
			},
			'incompatible_content'
		],
		[
			// Politique de l'alpha (ROADMAP §4.1) : pas de migration, refus explicite.
			'sauvegarde de développement du prototype (sans monde politique)',
			() => {
				const raw = rawEnvelope();
				const state: Record<string, unknown> = { ...raw.state };
				delete state.world;
				delete state.characters;
				return JSON.stringify({ ...raw, state });
			},
			'invalid_state'
		],
		[
			'parti inconnu du catalogue',
			() => {
				const raw = rawEnvelope();
				const world = raw.state.world as { parties: Record<string, unknown> };
				const parties = {
					...world.parties,
					'party.disparu': { strength: 3, leaderId: 'character.1' }
				};
				return JSON.stringify({ ...raw, state: { ...raw.state, world: { ...world, parties } } });
			},
			'invalid_state'
		]
	])('refuse : %s', (_label, text, code) => {
		const result = parseSaveText(text(), fixtureContent);
		expect(errorCode(result)).toBe(code);
		if (!result.ok) expect(result.error.message.length).toBeGreaterThan(0);
	});

	it('détaille la cause d’un état endommagé', () => {
		const raw = rawEnvelope();
		const result = readEnvelope(
			{ ...raw, state: { ...raw.state, turn: 'demain' } },
			fixtureContent
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.details.join('\n')).toContain('turn');
	});
});

describe('migrations', () => {
	const add = (field: string) => (envelope: Readonly<Record<string, unknown>>) => ({
		...envelope,
		[field]: true
	});

	it('applique les migrations dans l’ordre, sans modifier l’entrée', () => {
		const input = Object.freeze({ format: 'republique-save', saveVersion: 1 });
		const result = migrateEnvelope(input, 1, 3, { 1: add('a'), 2: add('b') });
		expect(result).toEqual({
			ok: true,
			envelope: { format: 'republique-save', saveVersion: 3, a: true, b: true }
		});
		expect(input).toEqual({ format: 'republique-save', saveVersion: 1 });
	});

	it('refuse un chemin de migration incomplet', () => {
		expect(migrateEnvelope({ saveVersion: 1 }, 1, 3, { 1: add('a') })).toEqual({
			ok: false,
			missingFrom: 2
		});
	});

	it('ne migre rien pour la version courante', () => {
		expect(migrateEnvelope({ saveVersion: SAVE_VERSION }, SAVE_VERSION, SAVE_VERSION)).toEqual({
			ok: true,
			envelope: { saveVersion: SAVE_VERSION }
		});
	});
});

describe('stockage local', () => {
	const envelope = (state: GameState = played()) => createEnvelope(state, fixtureContent, SAVED_AT);

	it('signale une absence de sauvegarde', () => {
		expect(readSave(new MemoryStorage(), fixtureContent)).toEqual({ status: 'empty' });
	});

	it('écrit sous une clé préfixée puis relit à l’identique', () => {
		const storage = new MemoryStorage();
		const state = played(5);
		expect(writeSave(storage, envelope(state), fixtureContent)).toEqual({
			ok: true,
			backedUp: false
		});
		expect([...storage.items.keys()]).toEqual([SAVE_KEY]);
		expect(SAVE_KEY.startsWith('la-republique-cest-moi:')).toBe(true);
		const loaded = readSave(storage, fixtureContent);
		expect(loaded.status === 'loaded' && loaded.envelope.state).toStrictEqual(state);
		expect(loaded.status === 'loaded' && loaded.source).toBe('current');
	});

	it('conserve la sauvegarde valide précédente avant d’écrire', () => {
		const storage = new MemoryStorage();
		const first = played(2);
		const second = played(4);
		writeSave(storage, envelope(first), fixtureContent);
		expect(writeSave(storage, envelope(second), fixtureContent)).toEqual({
			ok: true,
			backedUp: true
		});
		const backup = parseSaveText(storage.items.get(BACKUP_KEY)!, fixtureContent);
		expect(backup.ok && backup.envelope.state).toStrictEqual(first);
	});

	it('se rabat sur la copie précédente si la sauvegarde courante est endommagée, sans l’effacer', () => {
		const storage = new MemoryStorage();
		writeSave(storage, envelope(played(2)), fixtureContent);
		writeSave(storage, envelope(played(4)), fixtureContent);
		storage.items.set(SAVE_KEY, '{ endommagé');
		const loaded = readSave(storage, fixtureContent);
		expect(loaded.status).toBe('loaded');
		if (loaded.status !== 'loaded') return;
		expect(loaded.source).toBe('backup');
		expect(loaded.currentError?.code).toBe('unreadable');
		expect(loaded.envelope.state.turn).toBe(2);
		expect(storage.items.get(SAVE_KEY)).toBe('{ endommagé');
	});

	it('signale une erreur sans rien modifier si aucune copie n’est valide', () => {
		const storage = new MemoryStorage();
		const future = JSON.stringify({ ...rawEnvelope(), saveVersion: SAVE_VERSION + 1 });
		storage.items.set(SAVE_KEY, future);
		const loaded = readSave(storage, fixtureContent);
		expect(loaded.status === 'error' && loaded.error.code).toBe('future_version');
		expect(storage.items.get(SAVE_KEY)).toBe(future);
	});

	it('refuse d’écraser une sauvegarde illisible ou incompatible sans décision explicite', () => {
		const storage = new MemoryStorage();
		const future = JSON.stringify({ ...rawEnvelope(), saveVersion: SAVE_VERSION + 1 });
		storage.items.set(SAVE_KEY, future);
		const refused = writeSave(storage, envelope(), fixtureContent);
		expect(refused.ok).toBe(false);
		if (refused.ok) return;
		expect(refused.error.code).toBe('existing_save_unreadable');
		expect(refused.error.existing?.code).toBe('future_version');
		expect(storage.items.get(SAVE_KEY)).toBe(future);

		const forced = writeSave(storage, envelope(), fixtureContent, { overwriteUnreadable: true });
		expect(forced).toEqual({ ok: true, backedUp: false });
	});

	it('signale un quota dépassé sans prétendre avoir sauvegardé', () => {
		const storage = new MemoryStorage();
		writeSave(storage, envelope(played(2)), fixtureContent);
		const before = storage.items.get(SAVE_KEY);
		storage.quotaOn = SAVE_KEY;
		const result = writeSave(storage, envelope(played(4)), fixtureContent);
		expect(!result.ok && result.error.code).toBe('quota_exceeded');
		expect(storage.items.get(SAVE_KEY)).toBe(before);
	});

	it('enregistre même si la copie de sécurité échoue', () => {
		const storage = new MemoryStorage();
		writeSave(storage, envelope(played(2)), fixtureContent);
		storage.failWritesOn = BACKUP_KEY;
		expect(writeSave(storage, envelope(played(3)), fixtureContent)).toEqual({
			ok: true,
			backedUp: false
		});
	});

	it('signale un échec d’écriture ou un stockage inaccessible', () => {
		const failing = new MemoryStorage();
		failing.failWritesOn = SAVE_KEY;
		expect(!writeSave(failing, envelope(), fixtureContent).ok).toBe(true);
		const blocked = new MemoryStorage();
		blocked.failReads = true;
		const write = writeSave(blocked, envelope(), fixtureContent);
		expect(!write.ok && write.error.code).toBe('storage_unavailable');
		expect(readSave(blocked, fixtureContent).status).toBe('error');
	});
});

describe('export et import', () => {
	it('exporte un fichier nommé d’après la date du jeu et réimportable', () => {
		const atT2_2004 = played(turnOf(2004, 2));
		const exported = exportSave(createEnvelope(atT2_2004, fixtureContent, SAVED_AT));
		expect(exported.fileName).toBe('la-republique-cest-moi-2004-T2.json');
		expect(exported.mimeType).toBe('application/json');
		const imported = importSave(exported.text, fixtureContent);
		expect(imported.ok && imported.envelope.state).toStrictEqual(atT2_2004);
	});

	it('applique la validation stricte à l’import', () => {
		expect(errorCode(importSave('pas du JSON', fixtureContent))).toBe('unreadable');
		expect(errorCode(importSave(JSON.stringify({ format: 'autre' }), fixtureContent))).toBe(
			'wrong_format'
		);
	});

	it('conserve une décision en attente', () => {
		const alert = withEvents(['test.stress_alert']);
		const base = createGame({ seed: 'export-décision' }, alert);
		const start = { ...base, player: { ...base.player, stress: 70 } };
		const result = transition(start, commitTurn(), alert);
		if (!result.ok) throw new Error(result.error.message);
		expect(result.state.phase).toBe('decision');
		const exported = exportSave(createEnvelope(result.state, alert, SAVED_AT));
		const imported = importSave(exported.text, alert);
		expect(imported.ok && imported.envelope.state).toStrictEqual(result.state);
	});
});
