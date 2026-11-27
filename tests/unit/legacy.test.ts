import { describe, expect, it } from 'vitest';
import type { Content } from '../../src/lib/game/content/types.ts';
import { validateContent, type RawContent } from '../../src/lib/game/content/validate.ts';
import { loadContentFromFiles } from '../../src/lib/game/content/load-node.ts';
import {
	createGame,
	distinctionsOf,
	legacyMetrics,
	obituaryOf,
	type GameState,
	type MandateInstance
} from '../../src/lib/game/engine/index.ts';
import { ofWord, projectView } from '../../src/lib/game/app/view-model.ts';
import {
	fixtureActions,
	fixtureBalance,
	fixtureCareer,
	fixtureCast,
	fixtureContent,
	fixtureEntourage,
	fixtureEpitaphs,
	fixtureEvents,
	fixtureInstitutions,
	fixtureJustice,
	fixtureMedia,
	fixturePromises,
	fixtureProfiles,
	fixtureSupports,
	fixtureTraits,
	fixtureUpgrades,
	fixtureWealth,
	fixtureWorld
} from '../fixtures/content.ts';

function raw(overrides: Partial<RawContent> = {}): RawContent {
	return {
		actions: fixtureActions,
		upgrades: fixtureUpgrades,
		balance: fixtureBalance,
		cast: fixtureCast,
		events: fixtureEvents,
		world: fixtureWorld,
		traits: fixtureTraits,
		career: fixtureCareer,
		supports: fixtureSupports,
		entourage: fixtureEntourage,
		profiles: fixtureProfiles,
		justice: fixtureJustice,
		wealth: fixtureWealth,
		promises: fixturePromises,
		media: fixtureMedia,
		institutions: fixtureInstitutions,
		epitaphs: fixtureEpitaphs,
		...overrides
	};
}

function issuesOf(overrides: Partial<RawContent>): string[] {
	const result = validateContent(raw(overrides));
	return result.ok ? [] : result.issues.map((issue) => `${issue.path} : ${issue.message}`);
}

function mandate(
	instanceId: string,
	mandateId: string,
	startTurn: number,
	endTurn: number | null
): MandateInstance {
	return {
		instanceId,
		mandateId,
		startTurn,
		access: 'election',
		status: endTurn === null ? 'active' : 'ended',
		endTurn,
		endReason: endTurn === null ? null : 'term'
	};
}

/** Carrière terminée au trimestre `turn`, par décès naturel. */
function ended(state: GameState, turn: number, reason: 'death' | 'prison' = 'death'): GameState {
	return {
		...state,
		turn: turn + 1,
		phase: 'ended',
		end:
			reason === 'death'
				? { turn, reason: 'death', cause: 'natural_causes' }
				: { turn, reason: 'prison', caseId: 'case.1' }
	};
}

describe('bilan de fin de carrière (P3-08)', () => {
	it('mesure le parcours depuis l’état final', () => {
		const base = createGame({ seed: 'bilan' }, fixtureContent);
		const state = ended(
			{
				...base,
				mandates: [
					mandate('term.1', 'mandate.councillor', 0, 24),
					mandate('term.2', 'mandate.mayor', 4, 24),
					mandate('term.3', 'mandate.deputy', 8, 40)
				]
			},
			47
		);
		const metrics = legacyMetrics(state, fixtureContent);
		expect(metrics).toMatchObject({
			years: 0,
			mandatesHeld: 3,
			highestRank: 40,
			yearsInOffice: 10,
			// La mairie ne compte pas dans le cumul : conseil municipal et Assemblée.
			peakCumul: 2,
			facts: 0,
			partyChanges: 0
		});
		expect(distinctionsOf(state, fixtureContent).map((entry) => entry.id)).toEqual([
			'distinction.integrity'
		]);
	});

	it('choisit la nécrologie la plus spécifique pour la cause de fin, sans tirage', () => {
		const base = createGame({ seed: 'nécrologie' }, fixtureContent);
		expect(obituaryOf(base, fixtureContent)).toBeNull();
		const quiet = ended(base, 10);
		expect(obituaryOf(quiet, fixtureContent)?.id).toBe('obituary.death');
		const elected = ended(
			{ ...base, mandates: [mandate('term.1', 'mandate.deputy', 0, null)] },
			10
		);
		expect(obituaryOf(elected, fixtureContent)?.id).toBe('obituary.office');
		expect(obituaryOf(ended(base, 10, 'prison'), fixtureContent)?.id).toBe('obituary.prison');
		expect(elected.rng).toEqual(base.rng);
	});

	it('présente une une de journal : titre, texte, distinctions, moments et rubriques', () => {
		const base = createGame({ seed: 'une' }, fixtureContent);
		const state = ended({ ...base, mandates: [mandate('term.1', 'mandate.deputy', 4, null)] }, 40);
		const summary = projectView(state, [], fixtureContent).summary!;
		// Le quotidien de la région d'origine signe l'article (P3-18).
		expect(summary.masthead).toBe('La Feuille locale · Nécrologie');
		expect(summary.title).toMatch(/^Hommage à \d+ ans$/);
		expect(summary.text).toBe('Plus haute fonction : Siège national.');
		expect(summary.distinctions.map((entry) => entry.label)).toEqual(['L’Intègre']);
		expect(summary.moments).toEqual([
			{
				key: 'm0',
				date: 'T1 2001',
				text: 'Première prise de fonction : Siège national (Département de test)'
			}
		]);
		expect(summary.sections.map((section) => section.title)).toEqual([
			'Parcours',
			'Fortune',
			'Engagements et justice',
			'Vie et relations'
		]);
		const prison = projectView(ended(base, 12, 'prison'), [], fixtureContent).summary!;
		expect(prison.masthead).toBe('La Feuille locale · Chronique judiciaire');
		expect(prison.distinctions.map((entry) => entry.label)).toEqual(['La Vie à côté']);
	});

	it('élide « de » devant une voyelle (moments marquants, titres de presse)', () => {
		expect(ofWord('emploi fictif')).toBe('d’emploi fictif');
		expect(ofWord('abus de biens sociaux')).toBe('d’abus de biens sociaux');
		expect(ofWord('favoritisme')).toBe('de favoritisme');
	});

	describe('validation', () => {
		it('exige une nécrologie générique par cause et contrôle les variables', () => {
			const issues = issuesOf({
				epitaphs: {
					...fixtureEpitaphs,
					obituaries: [
						{ ...fixtureEpitaphs.obituaries[0]!, headline: 'Disparition de {player}' },
						{ ...fixtureEpitaphs.obituaries[1]!, criteria: [] }
					]
				}
			});
			expect(issues).toEqual(
				expect.arrayContaining([
					'obituaries[0].headline : variable non permise : {player}',
					'obituaries[1].text : {office} réservé aux nécrologies exigeant un mandat exercé',
					'obituaries : aucune nécrologie générique pour la fin « prison »'
				])
			);
		});
	});

	describe('catalogue réel', () => {
		const content: Content = loadContentFromFiles();

		it('ne genre ni ne nomme le joueur dans les nécrologies', () => {
			for (const obituary of content.obituaries) {
				expect(`${obituary.headline} ${obituary.text}`).not.toMatch(
					/\{player\}|\b(il|elle) était\b/i
				);
			}
		});

		it('propose au moins deux nécrologies par cause et plus de dix distinctions', () => {
			for (const cause of ['health_failure', 'natural_causes', 'prison'] as const) {
				expect(
					content.obituaries.filter((entry) => entry.causes.includes(cause)).length
				).toBeGreaterThanOrEqual(2);
			}
			expect(content.distinctions.length).toBeGreaterThan(10);
		});
	});
});
