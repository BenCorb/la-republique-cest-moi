<script lang="ts">
	import { Plus } from '@lucide/svelte';
	import type { GameSession } from '#lib/game/app/session.svelte.ts';
	import PlanPanel from './PlanPanel.svelte';

	/** Agenda (DESIGN.md §4.3) : catalogue d'actions et plan modifiable du trimestre. */
	interface Props {
		session: GameSession;
	}

	let { session }: Props = $props();
	const view = $derived(session.snapshot.view);
</script>

{#if view}
	<div class="grid gap-5 xl:grid-cols-[1fr_minmax(20rem,26rem)]">
		<section aria-labelledby="actions-title">
			<h2 id="actions-title" class="section-title">Actions possibles ce trimestre</h2>
			<ul class="mt-3 grid gap-3 2xl:grid-cols-2">
				{#each view.actions as action (action.id)}
					<li class="card flex flex-col gap-2" data-testid="action-{action.id}">
						<div class="flex items-start justify-between gap-3">
							<h3 class="font-serif text-base">{action.label}</h3>
							<span class="shrink-0 rounded bg-sidebar px-2 py-0.5 text-xs tabular-nums">
								{action.timeCost} pts de temps
							</span>
						</div>
						<p class="text-sm text-muted">{action.description}</p>
						<ul class="text-sm">
							{#each action.costs as cost (cost)}
								<li>Coût : {cost}</li>
							{/each}
							{#each action.effects as effect (effect)}
								<li>Effet : {effect}</li>
							{/each}
						</ul>
						<div class="mt-auto flex flex-col gap-2">
							{#if action.reason}
								<p class="text-xs text-warning" id="reason-{action.id}">{action.reason}</p>
							{:else if action.planned > 0}
								<p class="text-xs text-muted">Planifiée {action.planned} fois</p>
							{/if}
							<button
								type="button"
								class="btn-secondary btn-small self-end"
								disabled={!action.addable}
								aria-label="Ajouter « {action.label} » au plan"
								aria-describedby={action.reason ? `reason-${action.id}` : undefined}
								onclick={() => session.controller.addStep({ kind: 'action', id: action.id })}
							>
								<Plus class="size-3.5" aria-hidden="true" /> Ajouter
							</button>
						</div>
					</li>
				{/each}
			</ul>
		</section>
		<div class="xl:sticky xl:top-0 xl:self-start">
			<PlanPanel {session} />
		</div>
	</div>
{/if}
