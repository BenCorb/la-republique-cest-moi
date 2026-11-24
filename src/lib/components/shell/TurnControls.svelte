<script lang="ts">
	import { Download, House, Play } from '@lucide/svelte';
	import { downloadExport } from '#lib/game/app/browser.ts';
	import type { GameSession } from '#lib/game/app/session.svelte.ts';
	import { formatSavedAt } from '#lib/game/app/format.ts';
	import type { GameTab } from './tabs.ts';

	/** Barre d'avance (DESIGN.md §3, §5) : temps, état de sauvegarde, validation du trimestre. */
	interface Props {
		session: GameSession;
		onTab: (tab: GameTab) => void;
	}

	let { session, onTab }: Props = $props();
	const snapshot = $derived(session.snapshot);
	const view = $derived(snapshot.view);

	const blockedReason = $derived.by(() => {
		if (!view) return null;
		if (view.phase === 'ended') return 'La carrière est terminée.';
		if (view.phase === 'decision') return 'Une décision attend votre réponse.';
		if (!snapshot.canAct) return 'La dernière étape n’est pas sauvegardée.';
		if (!view.plan.valid) return 'Le plan du trimestre contient des erreurs (voir l’agenda).';
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

	function commit(): void {
		if (session.controller.commitTurn()) onTab('dashboard');
		else onTab('agenda');
	}
</script>

{#if view}
	<footer class="flex flex-wrap items-center gap-4 border-t border-line bg-sidebar px-5 py-3">
		<p class="text-sm tabular-nums">
			Temps utilisé : <span class="font-semibold" data-testid="time-used">
				{view.plan.timeUsed}/{view.plan.timeAvailable}
			</span>
		</p>
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
{/if}
