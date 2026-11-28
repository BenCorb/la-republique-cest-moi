/**
 * Migrations de sauvegarde (ARCHITECTURE.md §10) : fonctions pures et
 * séquentielles, chacune faisant passer une enveloppe brute de la version N à
 * N + 1. Aucune réparation silencieuse : une version sans chemin de migration
 * est refusée.
 *
 * Version 1 : format du prototype, de l'alpha et du rush (P1-07 à P3-42), jetable.
 * Version 2 : premier format conservé de la V1 (P3-10). Les migrations commencent
 * à partir de cette version : 2 → 3 sera la première à écrire ici.
 */

export type RawEnvelope = Readonly<Record<string, unknown>>;

/** Migration de la version `from` (clé) vers `from + 1`. */
export type Migration = (envelope: RawEnvelope) => RawEnvelope;

export const MIGRATIONS: Readonly<Record<number, Migration>> = {};

export type MigrationResult =
	| { readonly ok: true; readonly envelope: RawEnvelope }
	| { readonly ok: false; readonly missingFrom: number };

export function migrateEnvelope(
	envelope: RawEnvelope,
	from: number,
	to: number,
	migrations: Readonly<Record<number, Migration>> = MIGRATIONS
): MigrationResult {
	let current = envelope;
	for (let version = from; version < to; version += 1) {
		const migration = migrations[version];
		if (!migration) return { ok: false, missingFrom: version };
		current = { ...migration(current), saveVersion: version + 1 };
	}
	return { ok: true, envelope: current };
}
