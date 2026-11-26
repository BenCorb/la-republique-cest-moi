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
	// Région d'origine proposée par défaut (P3-16).
	await expect(page.getByRole('combobox', { name: 'Région' })).toHaveValue('region.normandie');
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

		// Actions regroupées par thème ; compteur d'occurrences au plan.
		await expect(page.getByTestId('group-network')).toContainText('1 au plan');
		await page.getByRole('button', { name: 'Ajouter « Distribuer des tracts » au plan' }).click();
		await page
			.getByRole('button', { name: 'Retirer une occurrence de « Distribuer des tracts » du plan' })
			.click();
		await expect(page.getByTestId('time-used')).toHaveText('50/100');

		// Hors de portée : masquée, puis affichée à la demande avec son coût et son motif.
		const meeting = page.getByTestId('action-activism.public_meeting');
		await expect(meeting).toHaveCount(0);
		await page.getByRole('button', { name: /Afficher les actions hors de portée/u }).click();
		await expect(meeting).toContainText('Budget politique − 300 €');
		await expect(meeting).toContainText('Il faut au moins 10 points d’influence');
		await expect(
			page.getByRole('button', { name: 'Ajouter « Organiser une réunion publique » au plan' })
		).toHaveCount(0);

		await page.getByRole('button', { name: 'Trimestre suivant' }).click();
		await expect(page.getByTestId('game-date')).toHaveText('T2 2000 · 25 ans');
		// Gain aléatoire du free-lance et effets du territoire tiré (P3-16) : valeurs
		// attendues calculées par le même moteur et la même seed.
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
		// Influence du profil, du territoire et de la rencontre d'élus (+3).
		await expect(page.getByTestId('resource-influence')).toHaveText(
			String(expected.state.resources.influence)
		);
		// Territoire d'origine : commune tirée, département et région par défaut.
		await expect(page.getByTestId('header-territory')).toContainText(
			expected.state.player.territory.homeTown.name
		);
		await expect(page.getByTestId('header-territory')).toContainText('Normandie');
		await expect(page.getByTestId('resource-personalCashCents')).toHaveText(
			formatResource('personalCashCents', expected.state.resources.personalCashCents)
		);

		await page.getByRole('button', { name: 'Journal', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'T1 2000' })).toBeVisible();
		await expect(page.getByText('Rencontrer des élus locaux — Influence + 3')).toBeVisible();
		expect(errors).toEqual([]);
	});

	test('choisit la région d’origine à la création', async ({ page }) => {
		await page.goto('./?seed=e2e-region');
		await page.getByRole('button', { name: 'Nouvelle carrière' }).click();
		await page.getByRole('combobox', { name: 'Région' }).selectOption({ label: 'Bretagne' });
		await expect(page.getByTestId('region-departments')).toContainText('Finistère');
		await page.getByRole('button', { name: 'Commencer la carrière' }).click();
		await expect(page.getByTestId('header-territory')).toContainText('Bretagne');
		await page.getByRole('button', { name: 'Tableau de bord', exact: true }).click();
		await expect(page.getByTestId('territory')).toContainText('Votre terre d’élection');
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
		await expect(page.getByTestId('cumul')).toHaveText('Cumul : 0 mandat sur 3 au plus.');
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

		// Engagement de campagne (P3-04) : ajouté au plan, puis inscrit au registre.
		await page.getByRole('button', { name: 'Promettre : Baisser les impôts' }).click();
		await expect(page.getByTestId('offer-promise.tax_cut')).toContainText(
			'Engagement prévu ce trimestre.'
		);
		await page.getByRole('button', { name: 'Trimestre suivant' }).click();
		await settleDecisions(page);
		await page.getByRole('button', { name: 'Carrière', exact: true }).click();
		await expect(page.getByTestId('pledge-pledge.1')).toContainText('Baisser les impôts');
		await expect(page.getByTestId('pledge-pledge.1')).toContainText('Annoncée');
		await expect(page.getByTestId('pledge-pledge.1')).toContainText('À réaliser si vous êtes élu');

		// Entourage : postes verrouillés tant que l'influence manque.
		await page.getByRole('button', { name: 'Entourage', exact: true }).click();
		await expect(page.getByTestId('post-post.chief_of_staff')).toContainText(
			'Il faut au moins 15 points d’influence'
		);
	});

	test('accorde une interview et la retrouve dans le fil de presse', async ({ page }) => {
		await startCareer(page, 'e2e-medias');
		await page.getByRole('button', { name: 'Carrière', exact: true }).click();
		const bocage = page.getByTestId('media-media.bocage');
		await expect(bocage).toContainText('Le Courrier du Bocage');
		await expect(bocage).toContainText('Presse régionale');
		await expect(page.getByTestId('media-media.horizon')).toContainText('Ne vous suit pas encore');
		await expect(
			page.getByRole('button', { name: 'Accorder une interview : L’Horizon' })
		).toBeDisabled();

		// Interview au média régional : prévue au plan, publiée à la fin du trimestre.
		await page
			.getByRole('button', { name: 'Accorder une interview : Le Courrier du Bocage' })
			.click();
		await expect(bocage).toContainText('Accorder une interview : prévu ce trimestre.');
		await page.getByRole('button', { name: 'Trimestre suivant' }).click();
		await settleDecisions(page);
		const press = page.getByRole('complementary', { name: 'Alertes et presse' });
		await expect(
			press.getByTestId('press-item').filter({ hasText: 'Le Courrier du Bocage' }).first()
		).toBeVisible();
	});

	test('présente les institutions et réserve les réformes aux parlementaires', async ({ page }) => {
		await startCareer(page, 'e2e-institutions');
		await page.getByRole('button', { name: 'Monde politique', exact: true }).click();
		await expect(page.getByTestId('era')).toContainText('Années 2000');
		await expect(page.getByRole('heading', { name: 'Institutions' })).toBeVisible();
		await expect(page.getByText('Réservé aux parlementaires et aux ministres.')).toBeVisible();
		const cumul = page.getByTestId('institution-institution.cumul');
		await expect(cumul).toContainText('Cumul des mandats');
		await expect(cumul).toContainText('Cumul limité');
		await expect(page.getByTestId('institution-institution.press')).toContainText(
			'Liberté encadrée'
		);
		await expect(page.getByRole('button', { name: /^Proposer :/ })).toHaveCount(0);
	});

	test('épingle le plan, trace les tendances et ouvre les actualités', async ({ page }) => {
		await startCareer(page, 'e2e-interface');
		await page
			.getByRole('button', { name: 'Ajouter « Rencontrer des élus locaux » au plan' })
			.click();
		await page
			.getByRole('button', { name: 'Ajouter « Accepter des missions en free-lance » au plan' })
			.click();
		// Épinglées par défaut ; la seconde devient ponctuelle.
		const freelance = page.getByRole('button', {
			name: 'Reconduire « Accepter des missions en free-lance » chaque trimestre'
		});
		await expect(freelance).toHaveAttribute('aria-pressed', 'true');
		await freelance.click();
		await expect(freelance).toHaveAttribute('aria-pressed', 'false');

		await page.getByRole('button', { name: 'Trimestre suivant' }).click();
		await expect(page.getByTestId('game-date')).toHaveText('T2 2000 · 25 ans');
		await settleDecisions(page);
		await expect(page.getByTestId('time-used')).toHaveText('20/100');
		await page.getByRole('button', { name: 'Trimestre suivant' }).click();
		await expect(page.getByTestId('game-date')).toHaveText('T3 2000 · 25 ans');
		await settleDecisions(page);

		await page.getByRole('button', { name: 'Tableau de bord', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Tendances' })).toBeVisible();
		await expect(page.getByTestId('trend-influence')).toBeVisible();

		await page.getByRole('button', { name: 'Actualités', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Actualités' })).toBeVisible();
		await expect(page.getByText('Seulement les articles vous concernant')).toBeVisible();
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
		// Un événement peut survenir : il ne fait pas partie de ce parcours.
		await expect(page.getByTestId('game-date')).toHaveText('T2 2000 · 25 ans');
		await settleDecisions(page);

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
		const group = page.getByTestId('group-organization.volunteer');
		await expect(group).toContainText('Militant bénévole');
		await expect(group).toContainText('Actif ce trimestre');
		await expect(group).toContainText('Au départ : Soutien : Militants − 2');

		// Départ gratuit, effectif dès ce trimestre, annulable dans le plan.
		await page.getByRole('button', { name: 'Prévoir un départ : Militant bénévole' }).click();
		await expect(group).toContainText('1 départ prévu ce trimestre');
		await page.getByRole('button', { name: 'Trimestre suivant' }).click();
		await page.getByRole('button', { name: 'Organisation', exact: true }).click();
		await expect(group).toHaveCount(0);
		await expect(page.getByText('Personne ne travaille encore pour vous.')).toBeVisible();
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
		// Seed sans décision bloquante sur les sept premiers trimestres (catalogue P3-05).
		await startCareer(page, 'e2e-year-4');
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

		// Bilan (P3-08) : nécrologie adaptée à la cause (épuisement), distinctions et moments marquants.
		await expect(
			page.getByRole('heading', { name: 'À la tâche jusqu’au bout, à 125 ans' })
		).toBeVisible();
		await expect(page.getByTestId('end-dates')).toContainText('125 ans');
		await expect(page.getByTestId('distinction-distinction.private_life')).toContainText(
			'La Vie à côté'
		);
		await expect(page.getByRole('heading', { name: 'Moments marquants' })).toBeVisible();
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

	test('présente l’exposition, le risque judiciaire et le registre des faits', async ({
		page
	}, testInfo) => {
		const content = loadContentFromFiles();
		const base = createGame({ seed: 'e2e-justice' }, content);
		const state = {
			...base,
			player: { ...base.player, exposure: 40 },
			facts: [
				{
					factId: 'fact.1',
					offenseId: 'offense.illegal_financing',
					turn: 0,
					severity: 2,
					divertedCents: 60_000,
					authorId: null,
					accompliceIds: [],
					eventId: 'finance.generous_donor'
				}
			]
		};
		const exported = exportSave(createEnvelope(state, content, '2026-11-25T10:00:00.000Z'));
		const file = testInfo.outputPath(exported.fileName);
		writeFileSync(file, exported.text);

		await page.goto('./');
		await page.getByTestId('import-input').setInputFiles(file);
		await page.getByRole('button', { name: 'Tableau de bord', exact: true }).click();
		const card = page.getByRole('region', { name: 'Exposition et justice' });
		await expect(card.getByText('Exposition médiatique', { exact: true })).toBeVisible();
		await expect(card.getByText('Risque judiciaire', { exact: true })).toBeVisible();
		const facts = card.getByTestId('facts');
		await expect(facts.getByRole('rowheader')).toContainText('Financement occulte');
		await expect(facts).toContainText('auteur');
		await expect(card).toContainText('Fonds détournés cumulés');
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
			'Patrimoine',
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
