/**
 * Frontière navigateur : seul module de l'application qui touche au navigateur
 * (stockage local, horloge d'affichage, seed tirée de `crypto.getRandomValues`,
 * événement `storage` d'un autre onglet, téléchargement de fichier).
 */
import { loadContent } from '../content/load.ts';
import { SAVE_KEY, browserStorage, type ExportedSave } from '../persistence/index.ts';
import { GameController } from './controller.ts';
import { GameSession } from './session.svelte.ts';

/**
 * Seed d'une nouvelle carrière. Paramètre d'essai : `?seed=…` dans l'adresse
 * impose la seed (tests, reproduction d'une partie) ; sinon tirage aléatoire.
 */
function browserSeed(): string {
	const forced = new URLSearchParams(window.location.search).get('seed');
	if (forced && forced.trim() === forced && forced.length > 0 && forced.length <= 64) return forced;
	const bytes = new Uint8Array(8);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createBrowserSession(): { session: GameSession; dispose: () => void } {
	const controller = new GameController({
		content: loadContent(),
		storage: browserStorage(),
		now: () => new Date().toISOString(),
		newSeed: browserSeed,
		yieldControl: () => new Promise((resolve) => requestAnimationFrame(() => resolve()))
	});
	const session = new GameSession(controller);
	const onStorage = (event: StorageEvent): void => {
		if (event.key === SAVE_KEY) controller.markExternalChange();
	};
	window.addEventListener('storage', onStorage);
	return {
		session,
		dispose: () => {
			window.removeEventListener('storage', onStorage);
			session.dispose();
		}
	};
}

/** Propose le fichier exporté au téléchargement. */
export function downloadExport(exported: ExportedSave): void {
	const url = URL.createObjectURL(new Blob([exported.text], { type: exported.mimeType }));
	const link = document.createElement('a');
	link.href = url;
	link.download = exported.fileName;
	link.click();
	setTimeout(() => URL.revokeObjectURL(url), 0);
}
