/** Sauvegarde locale, export et import : API publique de la persistance. */
export {
	FIRST_BETA_SAVE_VERSION,
	MAX_SAVE_BYTES,
	SAVE_FORMAT,
	SAVE_VERSION,
	createEnvelope,
	parseSaveText,
	readEnvelope,
	serializeEnvelope,
	type ReadOptions,
	type ReadResult,
	type SaveEnvelope,
	type SaveError,
	type SaveErrorCode
} from './envelope.ts';
export {
	BACKUP_KEY,
	SAVE_KEY,
	STORAGE_PREFIX,
	browserStorage,
	readRefusedSaveText,
	readSave,
	writeSave,
	type KeyValueStorage,
	type LoadOutcome,
	type WriteError,
	type WriteErrorCode,
	type WriteOptions,
	type WriteResult
} from './local-storage.ts';
export { exportRawSave, exportSave, importSave, type ExportedSave } from './import-export.ts';
export { gameStateSchema } from './state-schema.ts';
