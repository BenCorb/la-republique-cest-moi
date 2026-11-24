<script lang="ts">
	import type { GameSession } from '#lib/game/app/session.svelte.ts';
	import type { JournalLine } from '#lib/game/app/view-model.ts';

	/** Journal (DESIGN.md §4, §5) : trimestres résolus et décisions, du plus récent au plus ancien. */
	interface Props {
		session: GameSession;
	}

	let { session }: Props = $props();
	const view = $derived(session.snapshot.view);

	const kindLabels: Record<JournalLine['kind'], string> = {
		step: 'Agenda',
		economy: 'Organisation',
		wellbeing: 'Santé',
		world: 'Politique',
		people: 'Relations',
		event: 'Nouvelle',
		decision: 'Décision',
		end: 'Fin'
	};
</script>

{#if view}
	<section aria-labelledby="journal-title">
		<h2 id="journal-title" class="section-title">Journal de carrière</h2>
		{#if view.journal.length === 0}
			<p class="mt-2 text-sm text-muted">Le journal se remplira au fil des trimestres.</p>
		{:else}
			<ol class="mt-3 flex flex-col gap-3">
				{#each view.journal as quarter (quarter.key)}
					<li class="card">
						<h3 class="font-serif font-semibold">{quarter.label}</h3>
						<ul class="mt-2 flex flex-col gap-1 text-sm">
							{#each quarter.lines as line, index (index)}
								<li class="grid grid-cols-[7rem_1fr] gap-2">
									<span class="text-xs text-muted">{kindLabels[line.kind]}</span>
									<span>{line.text}</span>
								</li>
							{/each}
						</ul>
					</li>
				{/each}
			</ol>
		{/if}
	</section>
{/if}
