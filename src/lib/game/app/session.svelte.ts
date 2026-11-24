/**
 * Session de jeu réactive (Svelte 5). Les composants lisent `session.snapshot` et
 * appellent `session.controller` ; ils ne modifient jamais l'état de jeu eux-mêmes.
 * La frontière navigateur (stockage, horloge, seed, onglets) est dans `browser.ts`.
 */
import type { ControllerSnapshot, GameController } from './controller.ts';

export class GameSession {
	snapshot: ControllerSnapshot;
	readonly controller: GameController;
	private readonly unsubscribe: () => void;

	constructor(controller: GameController) {
		this.controller = controller;
		this.snapshot = $state.raw(controller.snapshot());
		this.unsubscribe = controller.subscribe((snapshot) => {
			this.snapshot = snapshot;
		});
	}

	dispose(): void {
		this.unsubscribe();
	}
}
