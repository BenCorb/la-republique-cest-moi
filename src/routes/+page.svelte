<script lang="ts">
	import { onMount } from 'svelte';
	import Agenda from '#lib/components/agenda/Agenda.svelte';
	import ConfirmDialog from '#lib/components/common/ConfirmDialog.svelte';
	import Dashboard from '#lib/components/dashboard/Dashboard.svelte';
	import CareerEnd from '#lib/components/events/CareerEnd.svelte';
	import DecisionDialog from '#lib/components/events/DecisionDialog.svelte';
	import NoteDialog from '#lib/components/events/NoteDialog.svelte';
	import Journal from '#lib/components/journal/Journal.svelte';
	import NewsPanel from '#lib/components/news/NewsPanel.svelte';
	import Organisation from '#lib/components/organisation/Organisation.svelte';
	import Wealth from '#lib/components/wealth/Wealth.svelte';
	import WorldPanel from '#lib/components/world/WorldPanel.svelte';
	import CareerPanel from '#lib/components/career/CareerPanel.svelte';
	import EntouragePanel from '#lib/components/entourage/EntouragePanel.svelte';
	import RelationsPanel from '#lib/components/people/RelationsPanel.svelte';
	import GameLayout from '#lib/components/shell/GameLayout.svelte';
	import GameShell from '#lib/components/shell/GameShell.svelte';
	import HomeScreen from '#lib/components/shell/HomeScreen.svelte';
	import CreationScreen from '#lib/components/shell/CreationScreen.svelte';
	import type { GameTab } from '#lib/components/shell/tabs.ts';
	import { createBrowserSession, downloadExport } from '#lib/game/app/browser.ts';
	import type { GameSession } from '#lib/game/app/session.svelte.ts';

	/**
	 * Page unique prérendue : l'état de partie n'est lu qu'après montage, côté
	 * client (ARCHITECTURE.md §12). Les onglets ne font pas passer le temps.
	 */
	let session = $state<GameSession | null>(null);
	let tab = $state<GameTab>('dashboard');
	let confirmingNewCareer = $state(false);
	/** Écran de création ouvert, et profil choisi en attente de confirmation éventuelle. */
	let creating = $state(false);
	let chosenProfile = $state<{ origin: string; profession: string; region: string } | null>(null);

	onMount(() => {
		const browser = createBrowserSession();
		session = browser.session;
		return browser.dispose;
	});

	const snapshot = $derived(session?.snapshot ?? null);

	function startCareer(): void {
		if (session) creating = true;
	}

	function createCareer(origin: string, profession: string, region: string): void {
		if (!session) return;
		chosenProfile = { origin, profession, region };
		const result = session.controller.newCareer({ origin, profession, region });
		if (result === 'needs_confirmation') {
			confirmingNewCareer = true;
			return;
		}
		creating = false;
		tab = 'agenda';
	}

	function confirmCareer(): void {
		confirmingNewCareer = false;
		creating = false;
		session?.controller.newCareer({ ...(chosenProfile ?? {}), replaceExisting: true });
		tab = 'agenda';
	}

	function exportGame(): void {
		const exported = session?.controller.exportCurrent();
		if (exported) downloadExport(exported);
	}
</script>

{#if !session || !snapshot}
	<GameShell>
		<p class="px-6 py-12 text-center text-muted" role="status">Ouverture du cabinet…</p>
		{#snippet status()}
			<p>Chargement</p>
		{/snippet}
	</GameShell>
{:else if creating}
	{@const options = session.controller.creationOptions()}
	<CreationScreen
		origins={options.origins}
		professions={options.professions}
		regions={options.regions}
		defaults={options.defaults}
		onStart={createCareer}
		onCancel={() => (creating = false)}
	/>
{:else if snapshot.screen === 'home'}
	<HomeScreen
		{session}
		onNewCareer={startCareer}
		onImport={(text: string) => session?.controller.importFile(text)}
	/>
{:else}
	<GameLayout {session} {tab} onTab={(next: GameTab) => (tab = next)}>
		{#if snapshot.view?.summary && tab !== 'journal'}
			<CareerEnd
				summary={snapshot.view.summary}
				onNewCareer={startCareer}
				onExport={exportGame}
				onJournal={() => (tab = 'journal')}
			/>
		{:else if tab === 'dashboard'}
			<Dashboard {session} />
		{:else if tab === 'agenda'}
			<Agenda {session} />
		{:else if tab === 'career'}
			<CareerPanel {session} />
		{:else if tab === 'world'}
			<WorldPanel {session} />
		{:else if tab === 'news'}
			<NewsPanel {session} />
		{:else if tab === 'entourage'}
			<EntouragePanel {session} />
		{:else if tab === 'relations'}
			<RelationsPanel {session} />
		{:else if tab === 'organisation'}
			<Organisation {session} />
		{:else if tab === 'wealth'}
			<Wealth {session} />
		{:else}
			<Journal {session} />
		{/if}
	</GameLayout>

	<!-- Note de cabinet d'abord (P3-14), puis décision et son résultat. -->
	{#if snapshot.note && snapshot.view && !snapshot.view.summary}
		<NoteDialog
			mode={snapshot.note}
			note={snapshot.view.quarterNote}
			acceleration={snapshot.acceleration}
			decisionPending={snapshot.view.decision !== null}
			onPrepare={() => {
				session?.controller.dismissNote();
				tab = 'agenda';
			}}
			onJournal={() => {
				session?.controller.dismissNote();
				tab = 'journal';
			}}
		/>
	{:else if snapshot.view?.decision || (snapshot.outcomeOpen && snapshot.view?.lastOutcome)}
		<DecisionDialog
			decision={snapshot.view.decision}
			outcome={snapshot.outcomeOpen ? snapshot.view.lastOutcome : null}
			disabled={!snapshot.canAct}
			onChoose={(choiceId: string) => session?.controller.choose(choiceId)}
			onContinue={() => session?.controller.dismissOutcome()}
		/>
	{/if}
{/if}

{#if confirmingNewCareer}
	<ConfirmDialog
		title="Commencer une nouvelle carrière ?"
		message="La sauvegarde actuelle sera remplacée. Exportez-la d’abord si vous souhaitez la conserver."
		confirmLabel="Remplacer et commencer"
		danger
		onConfirm={confirmCareer}
		onCancel={() => (confirmingNewCareer = false)}
	/>
{/if}

{#if snapshot?.pendingImport}
	<ConfirmDialog
		title="Importer cette sauvegarde ?"
		message={`La partie importée (${snapshot.pendingImport.dateLabel}, sauvegardée le ${snapshot.pendingImport.savedAtLabel}) remplacera la partie actuelle.`}
		confirmLabel="Importer"
		danger
		onConfirm={() => {
			session?.controller.confirmImport();
			tab = 'dashboard';
		}}
		onCancel={() => session?.controller.cancelImport()}
	/>
{/if}
