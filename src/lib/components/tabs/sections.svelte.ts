/**
 * Sections dépliées pendant la session (D-02) : un état d'interface, hors
 * sauvegarde, qui survit au changement d'onglet.
 */
import type { SectionId } from '#lib/game/app/view-model.ts';

const opened = $state<Partial<Record<SectionId, boolean>>>({});

export function isOpen(id: SectionId, initial: boolean): boolean {
	return opened[id] ?? initial;
}

export function setOpen(id: SectionId, value: boolean): void {
	opened[id] = value;
}
