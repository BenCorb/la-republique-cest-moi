<script lang="ts">
	import { ChevronDown, ChevronRight, Minus, Plus } from '@lucide/svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import type { CatalogItemView } from '#lib/game/app/view-model.ts';
	import type { GameSession } from '#lib/game/app/session.svelte.ts';
	import PlanPanel from './PlanPanel.svelte';

	/**
	 * Agenda (DESIGN.md §4.3) : actions regroupées par thème en lignes compactes,
	 * plan modifiable du trimestre. Les actions hors de portée (condition non
	 * remplie) sont masquées et s'affichent à la demande ; une action bloquée ce
	 * trimestre seulement (temps, argent, limite) reste visible, grisée, avec ce qui
	 * manque.
	 */
	interface Props {
		session: GameSession;
	}

	let { session }: Props = $props();
	const view = $derived(session.snapshot.view);
	const plan = $derived(session.snapshot.plan);
	const accelerating = $derived(session.snapshot.acceleration?.running === true);
	const hiddenCount = $derived(
		view?.actionGroups.reduce((total, group) => total + group.outOfReach.length, 0) ?? 0
	);

	let showOutOfReach = $state(false);
	/** Lignes dépliées (description et détail des effets). */
	const expanded = new SvelteSet<string>();

	function toggle(id: string): void {
		if (expanded.has(id)) expanded.delete(id);
		else expanded.add(id);
	}

	/** Retire la dernière occurrence de l'action dans le plan. */
	function removeOne(id: string): void {
		const index = plan.findLastIndex((step) => step.kind === 'action' && step.id === id);
		if (index >= 0) session.controller.removeStep(index);
	}

	function summary(action: CatalogItemView): string {
		return [`${action.timeCost} pts`, ...action.costs, ...action.effects.slice(0, 2)].join(' · ');
	}
</script>

{#snippet row(action: CatalogItemView, reachable: boolean)}
	{@const open = expanded.has(action.id)}
	<li
		class="flex items-start gap-2 border-t border-line py-2 first:border-t-0"
		data-testid="action-{action.id}"
	>
		<button
			type="button"
			class="mt-0.5 shrink-0 rounded p-0.5 text-muted hover:bg-sidebar"
			aria-expanded={open}
			aria-label="{open ? 'Masquer' : 'Afficher'} le détail de « {action.label} »"
			onclick={() => toggle(action.id)}
		>
			{#if open}
				<ChevronDown class="size-4" aria-hidden="true" />
			{:else}
				<ChevronRight class="size-4" aria-hidden="true" />
			{/if}
		</button>
		<div class="min-w-0 flex-1">
			<p class="text-sm">
				<span class="font-medium {action.addable ? '' : 'text-muted'}">{action.label}</span>
				<span class="text-xs text-muted">· {summary(action)}</span>
			</p>
			{#if open}
				<p class="mt-1 text-sm text-muted">{action.description}</p>
				<ul class="mt-1 text-xs">
					{#each action.costs as cost (cost)}
						<li>Coût : {cost}</li>
					{/each}
					{#each action.effects as effect (effect)}
						<li>Effet : {effect}</li>
					{/each}
				</ul>
			{/if}
			{#if action.reason}
				<p class="text-xs text-warning" id="reason-{action.id}">{action.reason}</p>
			{/if}
		</div>
		{#if reachable}
			<div class="flex shrink-0 items-center gap-1">
				{#if action.planned > 0}
					<button
						type="button"
						class="btn-secondary btn-small"
						disabled={accelerating}
						aria-label="Retirer une occurrence de « {action.label} » du plan"
						onclick={() => removeOne(action.id)}
					>
						<Minus class="size-3.5" aria-hidden="true" />
					</button>
					<span
						class="min-w-6 text-center text-sm tabular-nums"
						aria-label="Planifiée {action.planned} fois"
					>
						{action.planned}
					</span>
				{/if}
				<button
					type="button"
					class="btn-secondary btn-small"
					disabled={!action.addable || accelerating}
					aria-label="Ajouter « {action.label} » au plan"
					aria-describedby={action.reason ? `reason-${action.id}` : undefined}
					onclick={() => session.controller.addStep({ kind: 'action', id: action.id })}
				>
					<Plus class="size-3.5" aria-hidden="true" />
				</button>
			</div>
		{/if}
	</li>
{/snippet}

{#if view}
	<div class="grid gap-5 xl:grid-cols-[1fr_minmax(20rem,26rem)]">
		<section aria-labelledby="actions-title" class="flex flex-col gap-3">
			<h2 id="actions-title" class="section-title">Actions possibles ce trimestre</h2>
			{#each view.actionGroups.filter((group) => group.actions.length > 0) as group (group.id)}
				{@const planned = group.actions.reduce((total, action) => total + action.planned, 0)}
				<details open class="card py-2" data-testid="group-{group.id}">
					<summary class="cursor-pointer py-1 font-serif text-base">
						{group.label}
						<span class="font-sans text-xs text-muted">
							· {group.actions.length} action{group.actions.length > 1 ? 's' : ''}{planned > 0
								? ` · ${planned} au plan`
								: ''}
						</span>
					</summary>
					<ul class="mt-1">
						{#each group.actions as action (action.id)}
							{@render row(action, true)}
						{/each}
					</ul>
				</details>
			{/each}

			{#if hiddenCount > 0}
				<button
					type="button"
					class="self-start text-sm text-primary underline"
					aria-expanded={showOutOfReach}
					onclick={() => (showOutOfReach = !showOutOfReach)}
				>
					{showOutOfReach ? 'Masquer' : 'Afficher'} les actions hors de portée ({hiddenCount})
				</button>
				{#if showOutOfReach}
					<section class="card py-2" aria-label="Actions hors de portée" data-testid="out-of-reach">
						{#each view.actionGroups.filter((group) => group.outOfReach.length > 0) as group (group.id)}
							<h3 class="mt-2 text-xs font-semibold text-muted uppercase">{group.label}</h3>
							<ul>
								{#each group.outOfReach as action (action.id)}
									{@render row(action, false)}
								{/each}
							</ul>
						{/each}
					</section>
				{/if}
			{/if}
		</section>
		<div class="xl:sticky xl:top-0 xl:self-start">
			<PlanPanel {session} />
		</div>
	</div>
{/if}
