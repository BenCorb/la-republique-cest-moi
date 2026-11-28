<script lang="ts">
	import { Download, House, LogOut, Play, Undo2 } from '@lucide/svelte';
	import { downloadExport } from '#lib/game/app/browser.ts';
	import type { GameSession } from '#lib/game/app/session.svelte.ts';
	import { formatSavedAt } from '#lib/game/app/format.ts';
	import type { GameTab } from './tabs.ts';

	/**
	 * Barre du bas (DESIGN.md §3, D-07, D-08) : retraite à gauche, loin de l'avance ;
	 * temps, épinglages, état de sauvegarde ; un seul bouton d'avance, « Trimestre
	 * suivant ».
	 */
	interface Props {
		session: GameSession;
		onTab: (tab: GameTab) => void;
	}

	let { session, onTab }: Props = $props();
	const snapshot = $derived(session.snapshot);
	const view = $derived(snapshot.view);
	const retirement = $derived(view?.plan.retirement ?? null);

	const blockedReason = $derived.by(() => {
		if (!view) return null;
		if (view.phase === 'ended') return 'La carrière est terminée.';
		if (view.phase === 'decision') return 'Une décision attend votre réponse.';
		if (!snapshot.canAct) return 'La dernière étape n’est pas sauvegardée.';
		if (!view.plan.valid) return 'Le plan du trimestre contient des erreurs (voir le carnet).';
		return null;
	});

	const saveText = $derived.by(() => {
		const status = snapshot.saveStatus;
		if (!status) return 'Sauvegarde en attente';
		switch (status.kind) {
			case 'saved':
				return `Sauvegardé le ${formatSavedAt(status.savedAt)}`;
			case 'failed':
				return snapshot.continuingUnsaved
					? 'Partie non sauvegardée (choix explicite)'
					: 'Échec de la sauvegarde';
			case 'unavailable':
				return 'Sauvegarde indisponible dans ce navigateur';
			case 'conflict':
				return 'Modifiée dans un autre onglet';
		}
	});

	/** Rappel : seules les activités épinglées sont répétées au trimestre suivant (P3-11). */
	const repeatText = $derived.by(() => {
		if (!view) return '';
		const total = view.plan.steps.length;
		if (total === 0) return 'Aucune activité prévue';
		const activities = `${total} activité${total > 1 ? 's' : ''} ce trimestre`;
		const pinned = view.plan.pinnedCount;
		if (pinned === 0) return `${activities}, aucune répétée ensuite`;
		if (pinned === total) return `${activities}, toutes répétées ensuite`;
		return `${activities}, dont ${pinned} répétée${pinned > 1 ? 's' : ''} ensuite`;
	});

	let confirmRetire: HTMLDialogElement | undefined = $state();

	/** Annonce confirmée (D-08) : la retraite entre au plan, effet à la fin du trimestre. */
	function announceRetirement(): void {
		confirmRetire?.close();
		if (retirement) session.controller.addStep({ kind: 'action', id: retirement.actionId });
	}

	function cancelRetirement(): void {
		if (retirement?.planIndex !== null && retirement?.planIndex !== undefined) {
			session.controller.removeStep(retirement.planIndex);
		}
	}

	function commit(): void {
		if (session.controller.commitTurn()) onTab('quarter');
	}
</script>

{#if view}
	<footer class="flex flex-wrap items-center gap-4 border-t border-line bg-sidebar px-5 py-3">
		{#if retirement && view.phase !== 'ended'}
			{#if retirement.planIndex !== null}
				<p class="flex items-center gap-2 text-sm text-danger" data-testid="retirement-announced">
					Retraite annoncée : effet à la fin du trimestre.
					<button
						type="button"
						class="btn-secondary btn-small"
						disabled={view.phase !== 'planning'}
						onclick={cancelRetirement}
					>
						<Undo2 class="size-3.5" aria-hidden="true" /> Renoncer
					</button>
				</p>
			{:else}
				<button
					type="button"
					class="btn-secondary btn-small"
					disabled={!retirement.addable}
					title={retirement.reason ?? undefined}
					onclick={() => confirmRetire?.showModal()}
				>
					<LogOut class="size-3.5" aria-hidden="true" /> Se retirer de la vie politique
				</button>
			{/if}
		{/if}
		<p class="text-sm tabular-nums">
			Temps utilisé : <span class="font-semibold" data-testid="time-used">
				{view.plan.timeUsed}/{view.plan.timeAvailable}
			</span>
		</p>
		<p class="text-sm text-muted" data-testid="plan-repeat">{repeatText}</p>
		<p class="text-sm text-muted" data-testid="save-status" aria-live="polite">{saveText}</p>
		{#if blockedReason}
			<p class="text-sm text-warning" id="advance-blocked">{blockedReason}</p>
		{/if}
		<div class="ml-auto flex gap-2">
			<button type="button" class="btn-secondary" onclick={() => session.controller.leave()}>
				<House class="size-4" aria-hidden="true" /> Accueil
			</button>
			<button
				type="button"
				class="btn-secondary"
				onclick={() => {
					const exported = session.controller.exportCurrent();
					if (exported) downloadExport(exported);
				}}
			>
				<Download class="size-4" aria-hidden="true" /> Exporter
			</button>
			<button
				type="button"
				class="btn-primary"
				disabled={blockedReason !== null}
				aria-describedby={blockedReason ? 'advance-blocked' : undefined}
				onclick={commit}
			>
				<Play class="size-4" aria-hidden="true" /> Trimestre suivant
			</button>
		</div>
	</footer>
	<dialog
		bind:this={confirmRetire}
		aria-labelledby="retire-title"
		data-testid="retire-dialog"
		class="m-auto w-[min(32rem,92vw)] rounded-lg border border-line bg-surface p-5 text-ink shadow-lg backdrop:bg-ink/50"
	>
		<h2 id="retire-title" class="font-serif text-xl font-semibold">Quitter la vie politique ?</h2>
		<p class="mt-3 text-sm leading-relaxed">
			Votre carrière s’achèvera à la fin de ce trimestre : votre plan est encore joué, puis tous vos
			mandats sont rendus et le bilan s’ouvre. Vous pouvez y renoncer tant que le trimestre n’est
			pas joué.
		</p>
		<div class="mt-5 flex justify-end gap-2">
			<button type="button" class="btn-secondary" onclick={() => confirmRetire?.close()}>
				Rester en politique
			</button>
			<button type="button" class="btn-danger" onclick={announceRetirement}>
				Annoncer ma retraite
			</button>
		</div>
	</dialog>
{/if}
