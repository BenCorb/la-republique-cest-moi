/** Sauvegarde locale, export et import : API publique de la persistance. */
export {
	MAX_SAVE_BYTES,
	SAVE_FORMAT,
	SAVE_VERSION,
	createEnvelope,
	parseSaveText,
	readEnvelope,
	serializeEnvelope,
	type ReadResult,
	type SaveEnvelope,
	type SaveError,
	type SaveErrorCode
} from './envelope.ts';
export { MIGRATIONS, migrateEnvelope, type Migration, type RawEnvelope } from './migrations.ts';
export {
	BACKUP_KEY,
	SAVE_KEY,
	STORAGE_PREFIX,
	browserStorage,
	readSave,
	writeSave,
	type KeyValueStorage,
	type LoadOutcome,
	type WriteError,
	type WriteErrorCode,
	type WriteOptions,
	type WriteResult
} from './local-storage.ts';
export { exportSave, importSave, type ExportedSave } from './import-export.ts';
export { gameStateSchema } from './state-schema.ts';
