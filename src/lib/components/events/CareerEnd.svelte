<script lang="ts">
	import { Download, RotateCcw } from '@lucide/svelte';
	import type { SummaryView } from '#lib/game/app/view-model.ts';

	/** Bilan de fin de carrière (DESIGN.md §6, version prototype). */
	interface Props {
		summary: SummaryView;
		onNewCareer: () => void;
		onExport: () => void;
		onJournal: () => void;
	}

	let { summary, onNewCareer, onExport, onJournal }: Props = $props();
</script>

<article
	class="mx-auto max-w-2xl rounded-lg border-2 border-ink bg-surface p-8"
	aria-labelledby="end-title"
>
	<p class="text-center text-xs tracking-[0.3em] text-muted uppercase">
		Le Courrier du Bocage · Nécrologie
	</p>
	<h2 id="end-title" class="mt-3 text-center font-serif text-3xl text-ink">{summary.title}</h2>
	<p class="mt-2 text-center font-serif text-lg text-muted italic">{summary.cause}</p>
	<dl class="mt-6 grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 border-t border-line pt-4 text-sm">
		{#each summary.lines as line (line.label)}
			<dt class="text-muted">{line.label}</dt>
			<dd class="text-right font-medium tabular-nums">{line.value}</dd>
		{/each}
	</dl>
	<p class="mt-6 text-sm text-muted">
		Chaque carrière est indépendante : la suivante repart de zéro, sans bonus ni héritage.
	</p>
	<div class="mt-6 flex flex-wrap justify-center gap-3">
		<button type="button" class="btn-primary" onclick={onNewCareer}>
			<RotateCcw class="size-4" aria-hidden="true" /> Nouvelle carrière
		</button>
		<button type="button" class="btn-secondary" onclick={onJournal}>Relire le journal</button>
		<button type="button" class="btn-secondary" onclick={onExport}>
			<Download class="size-4" aria-hidden="true" /> Exporter
		</button>
	</div>
</article>
