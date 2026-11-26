<script lang="ts">
	import { Newspaper } from '@lucide/svelte';
	import type { GameSession } from '#lib/game/app/session.svelte.ts';

	/**
	 * Actualités (P3-08, DESIGN.md §4) : le fil de presse complet des derniers
	 * trimestres, regroupé par trimestre, avec un filtre « Vous concernant ».
	 * Une information critique se distingue par un libellé et une bordure, pas
	 * seulement par la couleur.
	 */
	interface Props {
		session: GameSession;
	}

	let { session }: Props = $props();
	const view = $derived(session.snapshot.view);
	let onlyMine = $state(false);
	const quarters = $derived(
		(view?.news ?? [])
			.map((quarter) => ({
				...quarter,
				items: onlyMine ? quarter.items.filter((item) => item.aboutPlayer) : quarter.items
			}))
			.filter((quarter) => quarter.items.length > 0)
	);
</script>

{#if view}
	<section class="card" aria-labelledby="actualites-title">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<h2 id="actualites-title" class="section-title flex items-center gap-2">
				<Newspaper class="size-4" aria-hidden="true" /> Actualités
			</h2>
			<label class="flex items-center gap-2 text-sm">
				<input type="checkbox" bind:checked={onlyMine} />
				Seulement les articles vous concernant
			</label>
		</div>
		<p class="mt-1 text-xs text-muted">
			Les vingt derniers trimestres de presse ; les plus anciens restent consultables au journal.
		</p>
		{#if quarters.length === 0}
			<p class="mt-4 text-sm text-muted">Pas encore de nouvelles.</p>
		{:else}
			{#each quarters as quarter (quarter.key)}
				<h3 class="mt-5 text-xs font-semibold text-muted uppercase">{quarter.label}</h3>
				<ul class="mt-2 grid gap-2 md:grid-cols-2">
					{#each quarter.items as item (item.key)}
						<li
							class="rounded border bg-surface px-3 py-2 text-sm {item.critical
								? 'border-l-4 border-warning'
								: 'border-line'}"
							data-testid="news-item"
						>
							<span class="block text-xs text-muted">
								{item.media}&nbsp;·&nbsp;{#if item.toneLabel}
									<span class={item.critical ? 'font-medium text-warning' : ''}>
										{item.toneLabel}
									</span>
								{:else}
									Ambiance
								{/if}
							</span>
							<span class="font-serif text-base">{item.title}</span>
							{#if item.effects}
								<span class="block text-xs text-muted">{item.effects}</span>
							{/if}
						</li>
					{/each}
				</ul>
			{/each}
		{/if}
	</section>
{/if}
