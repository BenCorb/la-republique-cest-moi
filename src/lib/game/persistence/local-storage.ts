/**
 * Sauvegarde locale (ARCHITECTURE.md §10).
 *
 * - Une enveloppe complète par emplacement, sous des clés préfixées par le
 *   projet : sur GitHub Pages, tous les sites d'un même compte partagent
 *   l'origine, donc le stockage.
 * - Avant chaque écriture, la sauvegarde actuelle, si elle est valide, est
 *   conservée comme copie précédente.
 * - Une sauvegarde existante illisible, endommagée, incompatible, d'une version
 *   précédente de la beta ou d'une version future n'est jamais écrasée sans
 *   demande explicite
 *   (`overwriteUnreadable`) : AGENTS.md interdit de l'effacer silencieusement.
 * - Toute erreur d'écriture (quota, stockage indisponible) est renvoyée : le jeu
 *   ne doit jamais prétendre avoir sauvegardé.
 * Le stockage est injecté (`KeyValueStorage`) : testable sans navigateur.
 */
import type { Content } from '../content/types.ts';
import {
	parseSaveText,
	serializeEnvelope,
	type ReadOptions,
	type SaveEnvelope,
	type SaveError
} from './envelope.ts';

/** Sous-ensemble de l'API `Storage` du navigateur. */
export interface KeyValueStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

export const STORAGE_PREFIX = 'la-republique-cest-moi';
export const SAVE_KEY = `${STORAGE_PREFIX}:save`;
export const BACKUP_KEY = `${STORAGE_PREFIX}:save:previous`;

export type WriteErrorCode =
	'storage_unavailable' | 'quota_exceeded' | 'write_failed' | 'existing_save_unreadable';

export interface WriteError {
	readonly code: WriteErrorCode;
	readonly message: string;
	/** Pour `existing_save_unreadable` : raison du refus de lecture de l'existant. */
	readonly existing: SaveError | null;
}

export type WriteResult =
	| { readonly ok: true; readonly backedUp: boolean }
	| { readonly ok: false; readonly error: WriteError };

export type LoadOutcome =
	| { readonly status: 'empty' }
	| {
			readonly status: 'loaded';
			readonly envelope: SaveEnvelope;
			readonly source: 'current' | 'backup';
			/** Problème de la sauvegarde courante lorsque la copie précédente a été utilisée. */
			readonly currentError: SaveError | null;
	  }
	| {
			readonly status: 'error';
			readonly error: SaveError;
			/** Erreur de la copie précédente, si elle existe aussi. */
			readonly backupError: SaveError | null;
	  };

function isQuotaError(error: unknown): boolean {
	if (typeof error !== 'object' || error === null) return false;
	const { name, code } = error as { name?: unknown; code?: unknown };
	return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22;
}

function safeGet(
	storage: KeyValueStorage,
	key: string
): { ok: true; value: string | null } | { ok: false } {
	try {
		return { ok: true, value: storage.getItem(key) };
	} catch {
		return { ok: false };
	}
}

function writeError(
	code: WriteErrorCode,
	message: string,
	existing: SaveError | null = null
): WriteResult {
	return { ok: false, error: { code, message, existing } };
}

export interface WriteOptions extends ReadOptions {
	/** Écrase une sauvegarde existante illisible ou incompatible (décision explicite du joueur). */
	readonly overwriteUnreadable?: boolean;
}

export function writeSave(
	storage: KeyValueStorage,
	envelope: SaveEnvelope,
	content: Content,
	options: WriteOptions = {}
): WriteResult {
	const current = safeGet(storage, SAVE_KEY);
	if (!current.ok) {
		return writeError('storage_unavailable', 'Le stockage local du navigateur est inaccessible.');
	}

	let backedUp = false;
	if (current.value !== null) {
		const existing = parseSaveText(current.value, content, options);
		if (existing.ok) {
			try {
				storage.setItem(BACKUP_KEY, current.value);
				backedUp = true;
			} catch {
				// La copie précédente est une sécurité : son échec n'empêche pas d'enregistrer.
			}
		} else if (!options.overwriteUnreadable) {
			return writeError(
				'existing_save_unreadable',
				'Une sauvegarde existante ne peut pas être lue. Elle n’a pas été remplacée.',
				existing.error
			);
		}
	}

	try {
		storage.setItem(SAVE_KEY, serializeEnvelope(envelope));
	} catch (error) {
		if (isQuotaError(error)) {
			return writeError(
				'quota_exceeded',
				'Le stockage du navigateur est plein : la partie n’a pas été sauvegardée.'
			);
		}
		return writeError('write_failed', 'La partie n’a pas pu être sauvegardée.');
	}
	return { ok: true, backedUp };
}

/**
 * Texte brut de la sauvegarde refusée par `readSave` (courante, sinon copie
 * précédente), pour l'exporter telle quelle ; `null` si aucune ne l'est.
 */
export function readRefusedSaveText(
	storage: KeyValueStorage,
	content: Content,
	options: ReadOptions = {}
): string | null {
	for (const key of [SAVE_KEY, BACKUP_KEY]) {
		const stored = safeGet(storage, key);
		if (!stored.ok || stored.value === null) continue;
		if (!parseSaveText(stored.value, content, options).ok) return stored.value;
	}
	return null;
}

export function readSave(
	storage: KeyValueStorage,
	content: Content,
	options: ReadOptions = {}
): LoadOutcome {
	const current = safeGet(storage, SAVE_KEY);
	const backup = safeGet(storage, BACKUP_KEY);
	if (!current.ok || !backup.ok) {
		return {
			status: 'error',
			error: {
				code: 'unreadable',
				message: 'Le stockage local du navigateur est inaccessible.',
				details: []
			},
			backupError: null
		};
	}

	const currentResult =
		current.value === null ? null : parseSaveText(current.value, content, options);
	if (currentResult?.ok) {
		return {
			status: 'loaded',
			envelope: currentResult.envelope,
			source: 'current',
			currentError: null
		};
	}

	const backupResult = backup.value === null ? null : parseSaveText(backup.value, content, options);
	if (backupResult?.ok) {
		return {
			status: 'loaded',
			envelope: backupResult.envelope,
			source: 'backup',
			currentError: currentResult && !currentResult.ok ? currentResult.error : null
		};
	}
	if (currentResult === null && backupResult === null) return { status: 'empty' };

	const primary = currentResult && !currentResult.ok ? currentResult.error : null;
	const secondary = backupResult && !backupResult.ok ? backupResult.error : null;
	return {
		status: 'error',
		error: primary ?? secondary!,
		backupError: primary ? secondary : null
	};
}

/**
 * Stockage du navigateur s'il est utilisable (navigation privée, cookies bloqués
 * ou rendu serveur le rendent parfois indisponible), sinon `null`.
 */
export function browserStorage(): KeyValueStorage | null {
	try {
		const storage = globalThis.localStorage;
		if (!storage) return null;
		const probe = `${STORAGE_PREFIX}:probe`;
		storage.setItem(probe, '1');
		storage.removeItem(probe);
		return storage;
	} catch {
		return null;
	}
}
