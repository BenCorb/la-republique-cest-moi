import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/lib/game/content/load.ts';
import type { EventDefinition } from '../../src/lib/game/content/types.ts';
import { renderTemplate } from '../../src/lib/game/engine/index.ts';

/** Catalogue narratif du prototype (P1-06) : critères vérifiés automatiquement. */
const content = loadContent();
const events: EventDefinition[] = content.eventIds.map((id) => content.events[id]!);

/** Toutes les distributions possibles d'un événement (produit des candidats par rôle). */
function castings(event: EventDefinition): Record<string, string>[] {
	return event.actors.reduce<Record<string, string>[]>(
		(partials, slot) =>
			partials.flatMap((partial) =>
				content.castIds
					.filter((id) => {
						const member = content.cast[id]!;
						return (
							!Object.values(partial).includes(id) &&
							slot.tags.every((tag) => member.tags.includes(tag))
						);
					})
					.map((id) => ({ ...partial, [slot.role]: id }))
			),
		[{}]
	);
}

function texts(event: EventDefinition): string[] {
	const own = [event.title, event.text];
	if (!event.blocking) return own;
	return [...own, ...event.choices.flatMap((choice) => [choice.label, ...choice.hints])];
}

describe('catalogue narratif du prototype', () => {
	it('contient entre 20 et 30 événements', () => {
		expect(events.length).toBeGreaterThanOrEqual(20);
		expect(events.length).toBeLessThanOrEqual(30);
	});

	it('couvre les thèmes du prototype', () => {
		const categories = new Set(events.map((event) => event.category));
		for (const category of [
			'personal',
			'press',
			'finance',
			'organization',
			'opportunity',
			'world'
		]) {
			expect(categories).toContain(category);
		}
	});

	it('mêle décisions, brèves et suites différées, dont une chaîne de trois étapes', () => {
		expect(events.filter((event) => event.blocking).length).toBeGreaterThanOrEqual(10);
		expect(events.filter((event) => !event.blocking).length).toBeGreaterThanOrEqual(5);
		expect(events.filter((event) => event.trigger === 'followUp').length).toBeGreaterThanOrEqual(3);
		// Le donateur généreux mène à un service demandé, qui mène à une enquête.
		const followUps = (id: string): string[] => {
			const event = content.events[id];
			return event?.blocking
				? event.choices.flatMap((choice) => (choice.followUp ? [choice.followUp.eventId] : []))
				: [];
		};
		expect(followUps('finance.generous_donor')).toContain('finance.donor_favour');
		expect(followUps('finance.donor_favour')).toContain('press.donor_investigation');
	});

	it.each(events.map((event) => [event.id, event] as const))(
		'%s : textes entièrement résolus pour chaque distribution possible',
		(_id, event) => {
			const possible = castings(event);
			expect(possible.length).toBeGreaterThan(0);
			for (const actors of possible) {
				for (const text of texts(event)) {
					const rendered = renderTemplate(text, actors, content);
					expect(rendered).not.toMatch(/[{}]|undefined|null/);
					expect(rendered.trim().length).toBeGreaterThan(0);
				}
			}
		}
	);

	it.each(events.filter((event) => event.blocking).map((event) => [event.id, event] as const))(
		'%s : toujours une issue (choix de repli sans prérequis ni coût)',
		(_id, event) => {
			expect(
				event.blocking &&
					event.choices.some((choice) => !choice.requires && choice.costs.length === 0)
			).toBe(true);
		}
	);

	it('garde des textes courts et lisibles', () => {
		for (const event of events) {
			expect(event.title.length, event.id).toBeLessThanOrEqual(60);
			expect(event.text.length, event.id).toBeLessThanOrEqual(400);
			if (event.blocking) {
				expect(event.choices.length, event.id).toBeLessThanOrEqual(4);
				for (const choice of event.choices)
					expect(choice.label.length, event.id).toBeLessThanOrEqual(70);
			}
		}
	});

	it('emploie la typographie française (apostrophes et guillemets)', () => {
		for (const event of events) {
			for (const text of texts(event)) {
				expect(text, event.id).not.toMatch(/'|"/);
			}
		}
	});
});
