<script lang="ts">
	import { BookMarked, Trash2 } from '@lucide/svelte';
	import { logbookDistinctions } from '#lib/game/app/logbook.ts';
	import type { LogbookEntry } from '#lib/game/app/view-model.ts';

	/** Carnet des carrières (P3-41) : affichage seul, supprimable. */
	interface Props {
		entries: readonly LogbookEntry[];
		onRemove: (id: string | null) => void;
	}

	let { entries, onRemove }: Props = $props();
	const distinctions = $derived(logbookDistinctions(entries));
</script>

<section class="card p-6" aria-labelledby="carnet-titre" data-testid="logbook">
	<h2 id="carnet-titre" class="section-title flex items-center gap-2">
		<BookMarked class="size-4" aria-hidden="true" /> Carnet des carrières
	</h2>
	{#if entries.length === 0}
		<p class="mt-2 text-sm text-muted">
			Vos carrières terminées s’inscriront ici : nécrologie, plus haute fonction, ambition et
			distinctions. Le carnet reste dans ce navigateur.
		</p>
	{:else}
		{#if distinctions.length > 0}
			<p class="mt-2 text-sm">
				<span class="text-muted">Distinctions déjà obtenues :</span>
				{distinctions
					.map((entry) => (entry.count > 1 ? `${entry.label} (×${entry.count})` : entry.label))
					.join(' · ')}
			</p>
		{/if}
		<ul class="mt-3 flex flex-col gap-3">
			{#each entries as entry (entry.id)}
				<li class="rounded border border-line p-3" data-testid="logbook-entry">
					<div class="flex items-start justify-between gap-3">
						<div>
							<p class="font-serif font-semibold">{entry.headline}</p>
							<p class="text-xs text-muted">{entry.dates} · {entry.cause}</p>
							<p class="mt-1 text-sm">
								Plus haute fonction : {entry.office}{entry.ambition
									? ` · Ambition : ${entry.ambition}`
									: ''}
							</p>
							{#if entry.distinctions.length > 0}
								<p class="text-xs">{entry.distinctions.map((item) => item.label).join(' · ')}</p>
							{/if}
							<p class="mt-1 font-mono text-xs text-muted">Seed : {entry.seed}</p>
						</div>
						<button
							type="button"
							class="rounded p-1 text-muted hover:text-danger"
							aria-label="Retirer cette carrière du carnet"
							onclick={() => onRemove(entry.id)}
						>
							<Trash2 class="size-4" aria-hidden="true" />
						</button>
					</div>
				</li>
			{/each}
		</ul>
		<button type="button" class="btn-secondary btn-small mt-3" onclick={() => onRemove(null)}>
			Vider le carnet
		</button>
	{/if}
</section>
