<script lang="ts">
	import { Download, RefreshCw, X } from '@lucide/svelte';
	import { downloadExport } from '#lib/game/app/browser.ts';
	import type { GameSession } from '#lib/game/app/session.svelte.ts';

	/**
	 * Erreurs lisibles (DESIGN.md §7) : échec de sauvegarde avec réessai, export ou
	 * poursuite explicite ; conflit d'onglets ; refus de commande avec ses motifs.
	 */
	interface Props {
		session: GameSession;
	}

	let { session }: Props = $props();
	const snapshot = $derived(session.snapshot);
	const status = $derived(snapshot.saveStatus);

	function exportNow(): void {
		const exported = session.controller.exportCurrent();
		if (exported) downloadExport(exported);
	}
</script>

{#if status?.kind === 'failed' && !snapshot.continuingUnsaved}
	<div role="alert" class="mb-4 rounded-lg border border-danger bg-surface p-4">
		<p class="font-semibold text-danger">La partie n’a pas été sauvegardée.</p>
		<p class="mt-1 text-sm">{status.error.message}</p>
		<div class="mt-3 flex flex-wrap gap-2">
			<button type="button" class="btn-primary" onclick={() => session.controller.retrySave()}>
				<RefreshCw class="size-4" aria-hidden="true" /> Réessayer
			</button>
			<button type="button" class="btn-secondary" onclick={exportNow}>
				<Download class="size-4" aria-hidden="true" /> Exporter la partie
			</button>
			<button
				type="button"
				class="btn-secondary"
				onclick={() => session.controller.continueWithoutSaving()}
			>
				Continuer sans sauvegarder
			</button>
		</div>
	</div>
{:else if status?.kind === 'conflict'}
	<div role="alert" class="mb-4 rounded-lg border border-warning bg-surface p-4">
		<p class="font-semibold text-warning">La partie a été modifiée dans un autre onglet.</p>
		<p class="mt-1 text-sm">
			Pour ne pas écraser cette progression, rechargez la partie avant de continuer.
		</p>
		<button type="button" class="btn-primary mt-3" onclick={() => session.controller.reload()}>
			<RefreshCw class="size-4" aria-hidden="true" /> Recharger la partie
		</button>
	</div>
{:else if status?.kind === 'unavailable'}
	<p class="mb-4 rounded border-l-4 border-warning bg-surface px-3 py-2 text-sm">
		Le stockage de ce navigateur est indisponible : la partie sera perdue en quittant la page.
		Exportez-la pour la conserver.
	</p>
{/if}

{#if snapshot.notice}
	<div
		role={snapshot.notice.level === 'error' ? 'alert' : 'status'}
		class="mb-4 flex gap-3 rounded-lg border bg-surface p-4 {snapshot.notice.level === 'error'
			? 'border-danger'
			: 'border-warning'}"
	>
		<div class="flex-1">
			<p class="font-semibold">{snapshot.notice.text}</p>
			{#if snapshot.notice.details.length > 0}
				<ul class="mt-2 list-disc pl-5 text-sm">
					{#each snapshot.notice.details as detail, index (index)}
						<li>{detail}</li>
					{/each}
				</ul>
			{/if}
		</div>
		<button
			type="button"
			class="btn-secondary btn-small self-start"
			aria-label="Fermer le message"
			onclick={() => session.controller.dismissNotice()}
		>
			<X class="size-4" aria-hidden="true" />
		</button>
	</div>
{/if}
