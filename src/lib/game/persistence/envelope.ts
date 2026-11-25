/**
 * Enveloppe de sauvegarde versionnée et lecture validée (ARCHITECTURE.md §10).
 *
 * Lecture d'une sauvegarde, dans cet ordre, sans jamais rien corriger :
 *   1. taille et syntaxe JSON (texte importé) ;
 *   2. format `republique-save` ;
 *   3. version : future → refus ; ancienne → migrations séquentielles ;
 *   4. schéma strict de l'état (`state-schema.ts`) ;
 *   5. invariants du moteur et références au catalogue actuel.
 * `savedAt` est une métadonnée d'affichage : elle n'intervient jamais dans la
 * simulation (aucune progression hors ligne).
 */
import type { Content } from '../content/types.ts';
import {
	RULES_VERSION,
	checkContentReferences,
	checkInvariants,
	type GameState
} from '../engine/index.ts';
import { MIGRATIONS, migrateEnvelope, type Migration, type RawEnvelope } from './migrations.ts';
import { gameStateSchema } from './state-schema.ts';

export const SAVE_FORMAT = 'republique-save';
export const SAVE_VERSION = 1;
/** Taille maximale d'une sauvegarde lue ou importée (octets UTF-8). */
export const MAX_SAVE_BYTES = 5_000_000;

export interface SaveEnvelope {
	readonly format: typeof SAVE_FORMAT;
	readonly saveVersion: number;
	readonly rulesVersion: string;
	readonly contentVersion: string;
	/** Date d'enregistrement ISO 8601, métadonnée d'interface exclue de la simulation. */
	readonly savedAt: string;
	readonly state: GameState;
}

export type SaveErrorCode =
	| 'too_large'
	| 'unreadable'
	| 'wrong_format'
	| 'future_version'
	| 'unsupported_version'
	/** Sauvegarde de même format mais écrite par d'autres règles, incompatible (alpha, P2-10). */
	| 'outdated_rules'
	| 'invalid_state'
	| 'incompatible_content';

export interface SaveError {
	readonly code: SaveErrorCode;
	/** Message lisible en français. */
	readonly message: string;
	/** Détails techniques (chemins, invariants), pour l'export ou le diagnostic. */
	readonly details: readonly string[];
}

export type ReadResult =
	| {
			readonly ok: true;
			readonly envelope: SaveEnvelope;
			/** Version d'origine si une migration a eu lieu, sinon `null`. */
			readonly migratedFrom: number | null;
	  }
	| { readonly ok: false; readonly error: SaveError };

export function createEnvelope(state: GameState, content: Content, savedAt: string): SaveEnvelope {
	return {
		format: SAVE_FORMAT,
		saveVersion: SAVE_VERSION,
		rulesVersion: RULES_VERSION,
		contentVersion: content.version,
		savedAt,
		state
	};
}

export function serializeEnvelope(envelope: SaveEnvelope): string {
	return JSON.stringify(envelope);
}

function fail(code: SaveErrorCode, message: string, details: readonly string[] = []): ReadResult {
	return { ok: false, error: { code, message, details } };
}

/** Valide une enveloppe déjà désérialisée. */
export function readEnvelope(
	raw: unknown,
	content: Content,
	migrations: Readonly<Record<number, Migration>> = MIGRATIONS
): ReadResult {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
		return fail('wrong_format', 'Ce fichier n’est pas une sauvegarde du jeu.');
	}
	const envelope = raw as RawEnvelope;
	if (envelope.format !== SAVE_FORMAT) {
		return fail('wrong_format', 'Ce fichier n’est pas une sauvegarde du jeu.');
	}
	const version = envelope.saveVersion;
	if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 1) {
		return fail('wrong_format', 'La version de cette sauvegarde est illisible.');
	}
	if (version > SAVE_VERSION) {
		return fail(
			'future_version',
			'Cette sauvegarde provient d’une version plus récente du jeu. Elle n’a pas été modifiée.',
			[`saveVersion ${version} > ${SAVE_VERSION}`]
		);
	}

	let current = envelope;
	if (version < SAVE_VERSION) {
		const migrated = migrateEnvelope(envelope, version, SAVE_VERSION, migrations);
		if (!migrated.ok) {
			return fail(
				'unsupported_version',
				'Cette sauvegarde est trop ancienne pour cette version du jeu.',
				[`aucune migration depuis la version ${migrated.missingFrom}`]
			);
		}
		current = migrated.envelope;
	}

	const meta = [current.rulesVersion, current.contentVersion, current.savedAt];
	if (meta.some((value) => typeof value !== 'string' || value.length > 100)) {
		return fail('wrong_format', 'Les informations de cette sauvegarde sont incomplètes.');
	}

	// Pendant l'alpha, le format reste en version 1 (ROADMAP §4.1) : un état écrit par
	// d'autres règles et devenu illisible est refusé explicitement, sans être modifié,
	// plutôt que présenté comme endommagé.
	const outdated = (details: readonly string[]): ReadResult =>
		fail(
			'outdated_rules',
			`Cette sauvegarde a été créée par une autre version de développement du jeu (règles ${String(current.rulesVersion)}, version actuelle ${RULES_VERSION}) et n’est plus compatible.`,
			details
		);
	const otherRules = current.rulesVersion !== RULES_VERSION;

	const parsed = gameStateSchema.safeParse(current.state);
	if (!parsed.success) {
		const details = parsed.error.issues
			.slice(0, 20)
			.map((issue) => `${issue.path.join('.')} : ${issue.message}`);
		if (otherRules) return outdated(details);
		return fail(
			'invalid_state',
			'Cette sauvegarde est endommagée ou a été modifiée.',
			parsed.error.issues.slice(0, 20).map((issue) => `${issue.path.join('.')} : ${issue.message}`)
		);
	}

	const violations = checkInvariants(parsed.data);
	if (violations.length > 0 && otherRules) return outdated(violations);
	if (violations.length > 0) {
		return fail('invalid_state', 'Cette sauvegarde est incohérente.', violations);
	}
	const references = checkContentReferences(parsed.data, content);
	if (references.length > 0 && otherRules) return outdated(references);
	if (references.length > 0) {
		return fail(
			'incompatible_content',
			'Cette sauvegarde fait référence à des éléments absents de cette version du jeu.',
			references
		);
	}

	return {
		ok: true,
		envelope: {
			format: SAVE_FORMAT,
			saveVersion: SAVE_VERSION,
			rulesVersion: current.rulesVersion as string,
			contentVersion: current.contentVersion as string,
			savedAt: current.savedAt as string,
			state: parsed.data
		},
		migratedFrom: version < SAVE_VERSION ? version : null
	};
}

const encoder = new TextEncoder();

/** Valide une sauvegarde sous forme de texte (stockage ou fichier importé). */
export function parseSaveText(
	text: string,
	content: Content,
	migrations: Readonly<Record<number, Migration>> = MIGRATIONS
): ReadResult {
	if (encoder.encode(text).length > MAX_SAVE_BYTES) {
		return fail('too_large', 'Ce fichier est trop volumineux pour être une sauvegarde.');
	}
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch (error) {
		return fail('unreadable', 'Ce fichier est illisible.', [
			error instanceof Error ? error.message : String(error)
		]);
	}
	return readEnvelope(raw, content, migrations);
}
