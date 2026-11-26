<script lang="ts">
	import { Award, Download, RotateCcw } from '@lucide/svelte';
	import type { SummaryView } from '#lib/game/app/view-model.ts';

	/**
	 * Bilan de fin de carrière (P3-08, DESIGN.md §6) : une de journal avec la
	 * nécrologie ou la chronique judiciaire, les distinctions, les moments
	 * marquants et le parcours. Aucune récompense pour la carrière suivante.
	 */
	interface Props {
		summary: SummaryView;
		onNewCareer: () => void;
		onExport: () => void;
		onJournal: () => void;
	}

	let { summary, onNewCareer, onExport, onJournal }: Props = $props();
</script>

<article
	class="mx-auto max-w-4xl rounded-lg border-2 border-ink bg-surface p-6 md:p-8"
	aria-labelledby="end-title"
>
	<header class="border-y-4 border-double border-ink py-2 text-center">
		<p class="text-xs tracking-[0.3em] text-muted uppercase">{summary.masthead}</p>
	</header>
	<h2
		id="end-title"
		class="mt-4 text-center font-serif text-3xl leading-tight text-ink md:text-4xl"
	>
		{summary.title}
	</h2>
	<p class="mt-2 text-center text-sm text-muted" data-testid="end-dates">
		{summary.dates} — <span class="italic">{summary.cause}</span>
	</p>
	{#if summary.text}
		<p
			class="mt-5 font-serif text-lg leading-relaxed first-letter:float-left first-letter:mr-2 first-letter:font-serif first-letter:text-5xl first-letter:leading-none"
		>
			{summary.text}
		</p>
	{/if}

	{#if summary.distinctions.length > 0}
		<section class="mt-6" aria-labelledby="distinctions-title">
			<h3 id="distinctions-title" class="section-title flex items-center gap-2">
				<Award class="size-4" aria-hidden="true" /> Distinctions
			</h3>
			<ul class="mt-2 flex flex-wrap gap-2">
				{#each summary.distinctions as distinction (distinction.id)}
					<li
						class="rounded-full border border-ink bg-sidebar px-3 py-1 text-sm"
						title={distinction.description}
						data-testid="distinction-{distinction.id}"
					>
						<span class="font-semibold">{distinction.label}</span>
						<span class="sr-only"> — {distinction.description}</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<div class="mt-6 grid gap-6 border-t border-line pt-4 md:grid-cols-[1fr_1.2fr]">
		<section aria-labelledby="moments-title">
			<h3 id="moments-title" class="section-title">Moments marquants</h3>
			{#if summary.moments.length === 0}
				<p class="mt-2 text-sm text-muted">Une carrière discrète, sans fait saillant.</p>
			{:else}
				<ol class="mt-3 border-l-2 border-line pl-4">
					{#each summary.moments as moment (moment.key)}
						<li class="relative mb-3 text-sm">
							<span
								class="absolute top-1.5 -left-[1.4rem] size-2.5 rounded-full border-2 border-surface bg-ink"
								aria-hidden="true"
							></span>
							<span class="block text-xs text-muted tabular-nums">{moment.date}</span>
							{moment.text}
						</li>
					{/each}
				</ol>
			{/if}
		</section>
		<div class="flex flex-col gap-4">
			{#each summary.sections as section (section.title)}
				<section aria-label={section.title}>
					<h3 class="section-title">{section.title}</h3>
					<dl class="mt-1 grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
						{#each section.lines as line (line.label)}
							<dt class="text-muted">{line.label}</dt>
							<dd class="text-right font-medium tabular-nums">{line.value}</dd>
						{/each}
					</dl>
				</section>
			{/each}
		</div>
	</div>

	<p class="mt-6 text-sm text-muted">
		Chaque carrière est indépendante : la suivante repart de zéro, sans bonus ni héritage.
	</p>
	<div class="mt-4 flex flex-wrap justify-center gap-3">
		<button type="button" class="btn-primary" onclick={onNewCareer}>
			<RotateCcw class="size-4" aria-hidden="true" /> Nouvelle carrière
		</button>
		<button type="button" class="btn-secondary" onclick={onJournal}>Relire le journal</button>
		<button type="button" class="btn-secondary" onclick={onExport}>
			<Download class="size-4" aria-hidden="true" /> Exporter
		</button>
	</div>
</article>
