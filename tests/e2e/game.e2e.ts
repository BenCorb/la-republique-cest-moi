import { writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { commitTurn, createGame, transition, turnOf } from '../../src/lib/game/engine/index.ts';
import { formatResource } from '../../src/lib/game/app/format.ts';
import { createEnvelope, exportSave } from '../../src/lib/game/persistence/index.ts';
import { loadContentFromFiles } from './support/content.ts';

/** Ouvre le jeu avec une seed imposée (paramètre d'essai `?seed=`) et lance une carrière. */
async function startCareer(page: Page, seed = 'e2e'): Promise<void> {
	await page.goto(`./?seed=${seed}`);
	await page.getByRole('button', { name: 'Nouvelle carrière' }).click();
	await page.getByRole('button', { name: 'Commencer la carrière' }).click();
	await expect(page.getByTestId('game-date')).toHaveText('T1 2000 · 25 ans');
}

/** Tranche les décisions éventuelles en prenant le premier choix disponible. */
async function settleDecisions(page: Page): Promise<void> {
	const dialog = page.getByRole('dialog');
	for (let index = 0; index < 5 && (await dialog.isVisible()); index += 1) {
		await dialog.getByRole('button').and(page.locator(':enabled')).first().click();
	}
}

/** Valide des trimestres vides jusqu'à l'apparition d'une décision (au plus `limit`). */
async function advanceUntilDecision(page: Page, limit = 40): Promise<void> {
	const next = page.getByRole('button', { name: 'Trimestre suivant' });
	for (let index = 0; index < limit; index += 1) {
		if (await page.getByRole('dialog').isVisible()) return;
		await next.click();
	}
	await expect(page.getByRole('dialog')).toBeVisible();
}

test.describe('parcours de jeu', () => {
	test('planifie, valide un trimestre et le retrouve au journal', async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await startCareer(page);

		await expect(page.getByTestId('save-status')).toContainText('Sauvegardé');
		await page
			.getByRole('button', { name: 'Ajouter « Rencontrer des élus locaux » au plan' })
			.click();
		await page
			.getByRole('button', { name: 'Ajouter « Accepter des missions en free-lance » au plan' })
			.click();
		await expect(page.getByTestId('time-used')).toHaveText('50/100');

		// Coûts et indisponibilités lisibles.
		const meeting = page.getByTestId('action-activism.public_meeting');
		await expect(meeting).toContainText('Coût : Budget politique − 300 €');
		await expect(meeting).toContainText('Il faut au moins 10 points d’influence');
		await expect(
			page.getByRole('button', { name: 'Ajouter « Organiser une réunion publique » au plan' })
		).toBeDisabled();

		await page.getByRole('button', { name: 'Trimestre suivant' }).click();
		await expect(page.getByTestId('game-date')).toHaveText('T2 2000 · 25 ans');
		// Influence du profil par défaut (+2) et de la rencontre d'élus (+3).
		await expect(page.getByTestId('resource-influence')).toHaveText('5');
		// Gain aléatoire du free-lance : valeur attendue calculée par le même moteur et la même seed.
		const content = loadContentFromFiles();
		const expected = transition(
			createGame({ seed: 'e2e' }, content),
			commitTurn({
				steps: [
					{ kind: 'action', id: 'network.meet_officials' },
					{ kind: 'action', id: 'personal.freelance' }
				]
			}),
			content
		);
		if (!expected.ok) throw new Error(expected.error.message);
		await expect(page.getByTestId('resource-personalCashCents')).toHaveText(
			formatResource('personalCashCents', expected.state.resources.personalCashCents)
		);

		await page.getByRole('button', { name: 'Journal', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'T1 2000' })).toBeVisible();
		await expect(page.getByText('Rencontrer des élus locaux — Influence + 3')).toBeVisible();
		expect(errors).toEqual([]);
	});

	test('affiche le calendrier électoral et la fonction principale', async ({ page }) => {
		await startCareer(page, 'e2e-carriere');
		await expect(page.getByTestId('header-function')).toHaveText('Fonction Sans mandat');
		await page.getByRole('button', { name: 'Carrière', exact: true }).click();
		await expect(page.getByTestId('main-function')).toHaveText('Fonction principale : Sans mandat');
		const municipal = page.getByTestId('ballot-ballot.1');
		await expect(municipal).toContainText('Élections municipales');
		await expect(municipal).toContainText('T1 2001');
		await expect(municipal).toContainText('Candidatures closes au T3 2000');
		await expect(page.getByText('Cumul : 3 mandats au plus.')).toBeVisible();
		await expect(page.getByTestId('support-support.working_class')).toContainText(
			'Classes populaires (40 % de l’électorat)'
		);
		await expect(page.getByTestId('support-support.apparatus')).toContainText('Appareil du parti');
		await expect(page.getByRole('meter', { name: 'Popularité' }).first()).toBeVisible();

		// Candidature aux municipales, puis sondage de la campagne en cours.
		await page
			.getByRole('button', { name: 'Prévoir la candidature : Élections municipales du T1 2001' })
			.click();
		await expect(municipal).toContainText('Candidature prévue ce trimestre.');
		await page.getByRole('button', { name: 'Trimestre suivant' }).click();
		// Un événement peut survenir : il ne fait pas partie de ce parcours.
		await expect(page.getByTestId('game-date')).toHaveText('T2 2000 · 25 ans');
		await settleDecisions(page);
		await page.getByRole('button', { name: 'Carrière', exact: true }).click();
		await expect(page.getByTestId('campaign-campaign.1')).toContainText('Candidature déposée');
		await expect(page.getByTestId('poll-campaign.1')).toContainText('Sondage : entre');
		await expect(page.getByTestId('opponent-campaign.1')).toContainText('Adversaire : ');
		await expect(page.getByTestId('opponent-campaign.1')).not.toContainText('prochain trimestre');

		// Entourage : postes verrouillés tant que l'influence manque.
		await page.getByRole('button', { name: 'Entourage', exact: true }).click();
		await expect(page.getByTestId('post-post.chief_of_staff')).toContainText(
			'Il faut au moins 15 points d’influence'
		);
	});

	test('adhère à un parti depuis le monde politique', async ({ page }) => {
		await startCareer(page, 'e2e-parti');
		await expect(page.getByTestId('header-party')).toHaveText('Étiquette aucune');
		await page.getByRole('button', { name: 'Monde politique', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Contexte national' })).toBeVisible();
		await expect(page.getByText('Gouvernement conduit par Parti des Synthèses.')).toBeVisible();
		await expect(page.getByTestId('party-party.fn')).toContainText('Front du Non');

		await page.getByRole('button', { name: 'Prévoir l’adhésion au Parti des Synthèses' }).click();
		await expect(page.getByTestId('party-party.ps')).toContainText('Adhésion prévue ce trimestre');
		await expect(
			page.getByRole('button', { name: 'Prévoir l’adhésion au Front du Non' })
		).toBeDisabled();
		await page.getByRole('button', { name: 'Trimestre suivant' }).click();

		await expect(page.getByTestId('header-party')).toHaveText('Étiquette PS');
		await page.getByRole('button', { name: 'Monde politique', exact: true }).click();
		await expect(page.getByTestId('affiliation')).toHaveText(
			'Membre du Parti des Synthèses depuis le T1 2000'
		);
		await expect(page.getByTestId('party-party.ps')).toContainText('Votre parti');
	});

	test('planifie un achat qui ne produit qu’au trimestre suivant', async ({ page }) => {
		await startCareer(page, 'e2e-achat');
		await page.getByRole('button', { name: 'Organisation', exact: true }).click();
		await page
			.getByRole('button', { name: 'Planifier l’achat « Recruter un militant bénévole »' })
			.click();
		await expect(page.getByText('Actif à partir du trimestre prochain.').first()).toBeVisible();
		await page.getByRole('button', { name: 'Trimestre suivant' }).click();
		await page.getByRole('button', { name: 'Organisation', exact: true }).click();
		await expect(page.getByText('Actif ce trimestre')).toBeVisible();
	});

	test('refuse explicitement une sauvegarde d’une ancienne version, sans l’effacer', async ({
		page
	}) => {
		await startCareer(page, 'e2e-ancienne');
		const key = 'la-republique-cest-moi:save';
		const old = await page.evaluate((saveKey) => {
			const envelope = JSON.parse(localStorage.getItem(saveKey) ?? '{}') as {
				rulesVersion: string;
				state: Record<string, unknown>;
			};
			envelope.rulesVersion = '0.7.0';
			delete envelope.state.world;
			const raw = JSON.stringify(envelope);
			localStorage.setItem(saveKey, raw);
			localStorage.removeItem(`${saveKey}:previous`);
			return raw;
		}, key);

		await page.reload();
		await expect(page.getByRole('alert')).toContainText(
			'créée par une autre version de développement du jeu (règles 0.7.0'
		);
		await expect(page.getByRole('alert')).toContainText('Elle est conservée telle quelle.');
		await expect(page.getByRole('button', { name: 'Reprendre la carrière' })).toHaveCount(0);
		expect(await page.evaluate((saveKey) => localStorage.getItem(saveKey), key)).toBe(old);
	});

	test('s’arrête avant une échéance, résume la période, puis accélère une année', async ({
		page
	}) => {
		await startCareer(page, 'e2e-year');
		await page.getByRole('button', { name: 'Année suivante' }).click();

		// Les législatives sont accessibles : le temps s'arrête avant la clôture des candidatures.
		await expect(page.getByTestId('acceleration-status')).toContainText(
			'3 trimestres simulés : Élections législatives : candidatures ouvertes'
		);
		const summary = page.getByTestId('span-summary');
		await expect(summary).toContainText('3 trimestres simulés du T1 2000 au T3 2000');
		await summary.getByText('Détail trimestre par trimestre').click();
		await expect(summary.getByRole('heading', { name: 'T2 2000' })).toBeVisible();
		await expect(page.getByTestId('game-date')).toHaveText('T4 2000 · 25 ans');

		await page.getByRole('button', { name: 'Année suivante' }).click();
		await expect(page.getByTestId('acceleration-status')).toContainText(
			'4 trimestres simulés : limite demandée atteinte.'
		);
		await expect(page.getByTestId('game-date')).toHaveText('T4 2001 · 26 ans');
		await page.getByRole('button', { name: 'Masquer le résumé' }).click();
		await expect(summary).toBeHidden();

		await page.reload();
		await page.getByRole('button', { name: 'Reprendre la carrière' }).click();
		await expect(page.getByTestId('game-date')).toHaveText('T4 2001 · 26 ans');
	});

	test('peut interrompre une accélération longue entre deux trimestres', async ({ page }) => {
		// Le contrôleur cède une frame entre deux trimestres : le test retient ces frames
		// pour garder l'accélération en cours le temps de l'interrompre, sans course.
		await page.addInitScript(() => {
			const native = window.requestAnimationFrame.bind(window);
			const held: FrameRequestCallback[] = [];
			const gate = {
				hold: false,
				release(): void {
					gate.hold = false;
					for (const callback of held.splice(0)) native(callback);
				}
			};
			Object.assign(window, { __frames: gate });
			window.requestAnimationFrame = (callback) => {
				if (!gate.hold) return native(callback);
				held.push(callback);
				return 0;
			};
		});
		type Gate = { hold: boolean; release: () => void };
		await startCareer(page, 'e2e-year');
		await page.evaluate(() => {
			(window as unknown as { __frames: Gate }).__frames.hold = true;
		});
		await page.getByRole('button', { name: 'Jusqu’à une alerte' }).click();
		const cancel = page.getByRole('button', { name: 'Interrompre' });
		await expect(cancel).toBeVisible();
		await cancel.click();
		await page.evaluate(() => {
			(window as unknown as { __frames: Gate }).__frames.release();
		});

		await expect(page.getByTestId('acceleration-status')).toContainText(
			'1 trimestre simulé : accélération interrompue'
		);
		await expect(page.getByTestId('game-date')).toHaveText('T2 2000 · 25 ans');
		await expect(page.getByRole('button', { name: 'Trimestre suivant' })).toBeEnabled();
		await expect(page.getByRole('button', { name: 'Année suivante' })).toBeEnabled();
	});

	test('arrête l’accélération sur une décision et la conserve au rechargement', async ({
		page
	}) => {
		await startCareer(page, 'e2e-decision');
		// Les échéances électorales arrêtent aussi le temps : relancer jusqu'à la décision.
		const dialog = page.getByRole('dialog');
		for (let attempt = 0; attempt < 6 && !(await dialog.isVisible()); attempt += 1) {
			await page.getByRole('button', { name: 'Jusqu’à une alerte' }).click();
			await expect(page.getByTestId('acceleration-status')).not.toContainText('en cours');
		}
		await expect(dialog).toBeVisible();
		await expect(page.getByTestId('acceleration-status')).toContainText(
			'une décision attend votre réponse'
		);
		const date = await page.getByTestId('game-date').textContent();

		await page.reload();
		await page.getByRole('button', { name: 'Reprendre la carrière' }).click();
		await expect(page.getByRole('dialog')).toBeVisible();
		await expect(page.getByTestId('game-date')).toHaveText(date ?? '');
	});

	test('conserve une décision en attente au rechargement et l’applique une fois', async ({
		page
	}) => {
		await startCareer(page, 'e2e-decision');
		await advanceUntilDecision(page);
		const dialog = page.getByRole('dialog');
		const title = await dialog.getByRole('heading').textContent();
		const date = await page.getByTestId('game-date').textContent();
		await expect(page.getByRole('button', { name: 'Trimestre suivant' })).toBeDisabled();

		await page.reload();
		await page.getByRole('button', { name: 'Reprendre la carrière' }).click();
		await expect(page.getByRole('dialog').getByRole('heading')).toHaveText(title ?? '');
		await expect(page.getByTestId('game-date')).toHaveText(date ?? '');

		// La fenêtre de décision ne se ferme pas avec Échap ; le choix se fait au clavier.
		await page.keyboard.press('Escape');
		await expect(page.getByRole('dialog')).toBeVisible();
		await page.keyboard.press('Enter');
		await expect(page.getByRole('dialog')).toBeHidden();

		await page.getByRole('button', { name: 'Journal', exact: true }).click();
		await expect(page.getByText(/^Décision — /)).toHaveCount(1);
	});

	test('importe une sauvegarde et mène au bilan de fin de carrière', async ({ page }, testInfo) => {
		// Personnage très âgé à la santé minimale : le prochain trimestre est le dernier.
		const content = loadContentFromFiles();
		const base = createGame({ seed: 'e2e-fin' }, content);
		const state = { ...base, player: { ...base.player, birthTurn: turnOf(1875, 1), health: 1 } };
		const exported = exportSave(createEnvelope(state, content, '2026-11-24T10:00:00.000Z'));
		const file = testInfo.outputPath(exported.fileName);
		writeFileSync(file, exported.text);

		await page.goto('./');
		await page.getByTestId('import-input').setInputFiles(file);
		await expect(page.getByTestId('game-date')).toHaveText('T1 2000 · 125 ans');
		await page.getByRole('button', { name: 'Trimestre suivant' }).click();

		await expect(page.getByRole('heading', { name: 'Fin de carrière à 125 ans' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Trimestre suivant' })).toBeDisabled();
		await expect(page.getByText('La carrière est terminée.')).toBeVisible();

		// Une nouvelle carrière demande confirmation avant de remplacer la sauvegarde.
		await page.getByRole('main').getByRole('button', { name: 'Nouvelle carrière' }).click();
		await page.getByRole('button', { name: 'Commencer la carrière' }).click();
		await expect(
			page.getByRole('dialog', { name: 'Commencer une nouvelle carrière ?' })
		).toBeVisible();
		await page.getByRole('button', { name: 'Remplacer et commencer' }).click();
		await expect(page.getByTestId('game-date')).toHaveText('T1 2000 · 25 ans');
	});

	test('montre les relations sans dévoiler les traits cachés', async ({ page }, testInfo) => {
		const content = loadContentFromFiles();
		const base = createGame({ seed: 'e2e-relations' }, content);
		const sophie = base.characters['cast.sophie_roux']!;
		const hidden = sophie.traits.filter((trait) => !sophie.knownTraits.includes(trait));
		const state = {
			...base,
			relationships: {
				'cast.sophie_roux': {
					metTurn: 0,
					attitude: 15,
					memories: [
						{ turn: 0, text: 'Vous lui avez accordé un entretien.', tone: 'positive' as const }
					]
				}
			}
		};
		const exported = exportSave(createEnvelope(state, content, '2026-11-24T10:00:00.000Z'));
		const file = testInfo.outputPath(exported.fileName);
		writeFileSync(file, exported.text);

		await page.goto('./');
		await page.getByTestId('import-input').setInputFiles(file);
		await page.getByRole('button', { name: 'Relations', exact: true }).click();
		const card = page.getByTestId('person-cast.sophie_roux');
		await expect(card).toContainText('Sophie Roux, du Courrier du Bocage');
		await expect(card).toContainText('Attitude : favorable');
		await expect(card).toContainText('Vous lui avez accordé un entretien.');
		for (const trait of hidden) {
			await expect(card).not.toContainText(content.traits[trait]!.label);
		}
		if (hidden.length > 0) await expect(card).toContainText('encore à découvrir');
	});

	test('refuse un fichier qui n’est pas une sauvegarde, avec un message lisible', async ({
		page
	}, testInfo) => {
		const file = testInfo.outputPath('pas-une-sauvegarde.json');
		writeFileSync(file, '{"format":"autre-jeu"}');
		await page.goto('./');
		await page.getByTestId('import-input').setInputFiles(file);
		await expect(page.getByRole('alert')).toContainText(
			'Ce fichier n’est pas une sauvegarde du jeu.'
		);
	});

	test('reste lisible sans défilement horizontal en cours de partie', async ({ page }) => {
		await startCareer(page);
		for (const tab of [
			'Tableau de bord',
			'Agenda',
			'Carrière',
			'Monde politique',
			'Entourage',
			'Relations',
			'Organisation',
			'Journal'
		]) {
			await page.getByRole('button', { name: tab, exact: true }).click();
			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth
			);
			expect(overflow, tab).toBeLessThanOrEqual(0);
			await expect(page.getByRole('button', { name: 'Trimestre suivant' })).toBeInViewport();
		}
	});
});
