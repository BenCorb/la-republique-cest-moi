<script lang="ts">
	import { X } from '@lucide/svelte';
	import type { AccelerationStatus } from '#lib/game/app/controller.ts';

	/**
	 * Résumé groupé d'une accélération (DESIGN.md §5, P2-09) : pourquoi le temps
	 * s'est arrêté, variations nettes, faits marquants, puis le détail trimestre
	 * par trimestre, replié.
	 */
	interface Props {
		acceleration: AccelerationStatus;
		/** Absent dans la note de période (P3-14), qui a ses propres boutons. */
		onDismiss?: () => void;
	}

	let { acceleration, onDismiss }: Props = $props();
	const summary = $derived(acceleration.summary);
</script>

{#if summary}
	<section
		class="flex flex-col gap-3 {onDismiss ? 'card lg:col-span-2' : ''}"
		aria-labelledby="span-title"
		data-testid="span-summary"
	>
		<div class="flex items-start justify-between gap-3">
			<div>
				<h2 id="span-title" class="section-title">
					{summary.turns} trimestre{summary.turns > 1 ? 's' : ''} simulé{summary.turns > 1
						? 's'
						: ''}
					{summary.period}
				</h2>
				<p class="text-sm text-primary" data-testid="span-stop">{acceleration.message}</p>
			</div>
			{#if onDismiss}
				<button
					type="button"
					class="btn-secondary btn-small"
					aria-label="Masquer le résumé"
					onclick={onDismiss}
				>
					<X class="size-3.5" aria-hidden="true" />
				</button>
			{/if}
		</div>
		{#if acceleration.alerts.length > 1}
			<ul class="flex flex-col gap-1 text-sm text-warning">
				{#each acceleration.alerts as alert, index (index)}
					<li>{alert}</li>
				{/each}
			</ul>
		{/if}
		<dl class="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3 lg:grid-cols-6">
			{#each summary.changes as change (change.name)}
				<div>
					<dt class="text-xs text-muted">{change.name}</dt>
					<dd class="font-medium tabular-nums">{change.text}</dd>
				</div>
			{/each}
		</dl>
		<p class="text-xs text-muted">
			{summary.events} événement{summary.events > 1 ? 's' : ''} · {summary.decisions}
			décision{summary.decisions > 1 ? 's' : ''}
		</p>
		{#if summary.highlights.length > 0}
			<ul class="flex list-disc flex-col gap-1 pl-5 text-sm">
				{#each summary.highlights as highlight, index (index)}
					<li>{highlight}</li>
				{/each}
				{#if summary.moreHighlights > 0}
					<li class="list-none text-xs text-muted">
						… et {summary.moreHighlights} autre{summary.moreHighlights > 1 ? 's' : ''} : voir le détail.
					</li>
				{/if}
			</ul>
		{:else}
			<p class="text-sm text-muted">Aucun fait marquant pour votre carrière.</p>
		{/if}
		<details class="text-sm">
			<summary class="cursor-pointer text-primary">Détail trimestre par trimestre</summary>
			<div class="mt-2 flex flex-col gap-3">
				{#each summary.quarters as quarter (quarter.key)}
					<div>
						<h3 class="font-medium">{quarter.label}</h3>
						<ul class="flex flex-col gap-0.5 text-muted">
							{#each quarter.lines as line, index (index)}
								<li>{line.text}</li>
							{/each}
						</ul>
					</div>
				{/each}
			</div>
		</details>
	</section>
{/if}
