<script lang="ts">
	import {
		ChevronDown,
		ChevronUp,
		Info,
		OctagonExclamationPoint,
		TriangleExclamationPoint
	} from '@lucide/svelte';
	import AlertList from '#lib/components/common/AlertList.svelte';
	import type { Alert } from '#lib/game/app/view-model.ts';

	/**
	 * Bandeau d'alertes sous l'en-tête (P3-13, retour du créateur) : sur toute la
	 * largeur, au-dessus de tous les onglets. Les urgences sont écrites en entier ;
	 * « à traiter » aussi s'il n'y en a qu'une ; sinon, et pour les informations,
	 * une pastille à compteur ouvre la liste en surimpression (Échap la referme).
	 */
	interface Props {
		alerts: readonly Alert[];
	}

	let { alerts }: Props = $props();
	let expanded = $state<'warning' | 'info' | null>(null);

	const danger = $derived(alerts.filter((alert) => alert.level === 'danger'));
	const warning = $derived(alerts.filter((alert) => alert.level === 'warning'));
	const info = $derived(alerts.filter((alert) => alert.level === 'info'));
	const opened = $derived(
		expanded === 'warning' ? warning : expanded === 'info' ? info : ([] as Alert[])
	);

	function toggle(level: 'warning' | 'info'): void {
		expanded = expanded === level ? null : level;
	}
</script>

<svelte:window
	onkeydown={(event: KeyboardEvent) => {
		if (event.key === 'Escape') expanded = null;
	}}
/>

<section
	class="relative z-20 border-b border-line bg-surface"
	aria-label="Alertes"
	data-testid="alert-bar"
>
	<div class="flex min-h-10 flex-wrap items-center gap-2 px-5 py-1.5 text-sm">
		{#if alerts.length === 0}
			<p class="flex items-center gap-1.5 text-muted">
				<Info class="size-4" aria-hidden="true" /> Aucune alerte.
			</p>
		{/if}
		{#each danger as alert, index (index)}
			<p
				class="flex min-w-0 items-center gap-2 rounded bg-danger px-2.5 py-1 font-medium text-surface"
			>
				<OctagonExclamationPoint class="size-4 shrink-0" aria-hidden="true" />
				<span class="text-[11px] font-bold tracking-wider uppercase">
					Urgent<span class="sr-only"> :</span>
				</span>
				<span>{alert.text}</span>
			</p>
		{/each}
		{#if warning.length === 1 && danger.length === 0}
			<p
				class="flex min-w-0 items-center gap-2 rounded border border-l-4 border-warning px-2.5 py-0.5"
			>
				<TriangleExclamationPoint class="size-4 shrink-0 text-warning" aria-hidden="true" />
				<span class="text-[11px] font-bold tracking-wider text-warning uppercase">
					À traiter<span class="sr-only"> :</span>
				</span>
				<span>{warning[0]!.text}</span>
			</p>
		{:else if warning.length > 0}
			<button
				type="button"
				class="flex items-center gap-1.5 rounded border border-warning px-2.5 py-0.5 font-semibold text-warning hover:bg-risk-soft"
				aria-expanded={expanded === 'warning'}
				aria-controls="alert-bar-list"
				onclick={() => toggle('warning')}
			>
				<TriangleExclamationPoint class="size-4" aria-hidden="true" />
				{warning.length} à traiter
				{#if expanded === 'warning'}<ChevronUp
						class="size-3.5"
						aria-hidden="true"
					/>{:else}<ChevronDown class="size-3.5" aria-hidden="true" />{/if}
			</button>
		{/if}
		{#if info.length > 0}
			<button
				type="button"
				class="flex items-center gap-1.5 rounded border border-line px-2.5 py-0.5 text-muted hover:bg-sidebar"
				aria-expanded={expanded === 'info'}
				aria-controls="alert-bar-list"
				onclick={() => toggle('info')}
			>
				<Info class="size-4 text-primary" aria-hidden="true" />
				{info.length} information{info.length > 1 ? 's' : ''}
				{#if expanded === 'info'}<ChevronUp
						class="size-3.5"
						aria-hidden="true"
					/>{:else}<ChevronDown class="size-3.5" aria-hidden="true" />{/if}
			</button>
		{/if}
	</div>
	{#if opened.length > 0}
		<div
			id="alert-bar-list"
			class="absolute top-full left-5 mt-1 max-h-[60vh] w-[min(40rem,calc(100vw-2.5rem))] overflow-y-auto rounded-md border border-line bg-canvas p-2 shadow-lg"
		>
			<AlertList alerts={opened} />
		</div>
	{/if}
</section>
