import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/lib/game/content/load.ts';
import type { EventDefinition } from '../../src/lib/game/content/types.ts';
import { createGame, renderTemplate } from '../../src/lib/game/engine/index.ts';

/** Catalogue narratif du prototype (P1-06) : critères vérifiés automatiquement. */
const content = loadContent();
const events: EventDefinition[] = content.eventIds.map((id) => content.events[id]!);
/** Événements du prototype (P1-06), hors catégories ajoutées par l'alpha (P2-01 à P2-08). */
const ALPHA_CATEGORIES = new Set([
	'national',
	'relations',
	'career',
	'supports',
	'campaign',
	'entourage',
	'family'
]);
const prototypeEvents = events.filter((event) => !ALPHA_CATEGORIES.has(event.category));
const game = createGame({ seed: 'catalogue-narratif' }, content);
const someParty = content.partyIds[0]!;
/** Variables du monde liées à des valeurs plausibles (partis et dirigeants réels de l'état). */
const worldBindings: Record<string, string> = {
	governing_party: game.world.governingPartyId,
	governing_leader: game.world.parties[game.world.governingPartyId]!.leaderId,
	opposition_party: someParty,
	opposition_leader: game.world.parties[someParty]!.leaderId,
	player_party: someParty,
	player_party_leader: game.world.parties[someParty]!.leaderId
};

/** Toutes les distributions possibles d'un événement (produit des candidats par rôle). */
function castings(event: EventDefinition): Record<string, string>[] {
	return event.actors.reduce<Record<string, string>[]>(
		(partials, slot) =>
			partials.flatMap((partial) => {
				const fits = content.castIds.filter((id) => {
					const member = content.cast[id]!;
					return (
						!Object.values(partial).includes(id) &&
						slot.tags.every((tag) => member.tags.includes(tag))
					);
				});
				// Rôle pourvu en cours de partie (collaborateur) : un personnage de l'état le tient.
				const ids = fits.length > 0 ? fits : [game.world.parties[someParty]!.leaderId];
				return ids.map((id) => ({ ...partial, [slot.role]: id }));
			}),
		[{ ...worldBindings }]
	);
}

function texts(event: EventDefinition): string[] {
	const own = [event.title, event.text];
	if (!event.blocking) return own;
	return [...own, ...event.choices.flatMap((choice) => [choice.label, ...choice.hints])];
}

describe('catalogue narratif du prototype', () => {
	it('contient au moins les 20 événements du prototype', () => {
		// Le plafond de 30 de P1-06 ne valait que pour le prototype : les corrections de
		// l'alpha (gala, 26 novembre 2026) et la V1 enrichissent ces catégories.
		expect(prototypeEvents.length).toBeGreaterThanOrEqual(20);
	});

	it('ajoute des événements de relations fondés sur la mémoire et les traits (P2-04)', () => {
		const relations = events.filter((event) => event.category === 'relations');
		expect(relations.length).toBeGreaterThanOrEqual(6);
		const slots = relations.flatMap((event) => event.actors);
		expect(slots.every((slot) => slot.met === true)).toBe(true);
		expect(slots.some((slot) => slot.minAttitude !== undefined)).toBe(true);
		expect(slots.some((slot) => slot.maxAttitude !== undefined)).toBe(true);
		expect(slots.some((slot) => slot.traits !== undefined)).toBe(true);
	});

	it('ajoute une actualité nationale conditionnelle (P2-01)', () => {
		const national = events.filter((event) => event.category === 'national');
		expect(national.length).toBeGreaterThanOrEqual(10);
		expect(national.filter((event) => event.when !== undefined).length).toBeGreaterThanOrEqual(8);
		expect(national.some((event) => event.blocking)).toBe(true);
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
					// Un événement de sujet `promise` reçoit sa promesse du moteur.
					// Un événement de sujet `post` reçoit son poste (P3-12), vacant ou occupé.
					const withPromise =
						event.subject === 'promise'
							? { ...actors, promise: content.promiseIds[0] ?? '' }
							: event.subject === 'post'
								? { ...actors, post: content.postIds[0] ?? '' }
								: actors;
					const rendered = renderTemplate(text, withPromise, content, game.characters);
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
