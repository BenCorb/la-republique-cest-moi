<script lang="ts">
	import { ChevronDown, ChevronRight, Lock, Minus, Plus } from '@lucide/svelte';
	import EffectChip from '#lib/components/common/EffectChip.svelte';
	import TimeChip from '#lib/components/common/TimeChip.svelte';
	import { categoryIdentity } from '#lib/components/common/identity.ts';
	import { SvelteSet } from 'svelte/reactivity';
	import type { CatalogItemView } from '#lib/game/app/view-model.ts';
	import type { GameSession } from '#lib/game/app/session.svelte.ts';

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

	/** Effets montrés sur la ligne repliée ; les autres apparaissent au dépliage. */
	const ROW_EFFECTS = 3;
</script>

{#snippet row(action: CatalogItemView, reachable: boolean)}
	{@const open = expanded.has(action.id)}
	<li
		class="flex items-start gap-2 border-t border-line px-3 py-2 first:border-t-0"
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
			<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
				<span class="text-sm font-semibold {action.addable ? '' : 'text-muted'}">
					{action.label}
				</span>
				<span class="flex flex-wrap gap-1">
					<TimeChip points={action.timeCost} />
					{#each action.costChips as chip, index (index)}
						<EffectChip {chip} />
					{/each}
					{#each open ? action.effectChips : action.effectChips.slice(0, ROW_EFFECTS) as chip, index (index)}
						<EffectChip {chip} />
					{/each}
					{#if !open && action.effectChips.length > ROW_EFFECTS}
						<span class="self-center text-xs text-muted">
							+{action.effectChips.length - ROW_EFFECTS}
						</span>
					{/if}
				</span>
			</div>
			{#if open}
				<p class="mt-1 text-sm text-muted">{action.description}</p>
			{/if}
			{#if action.fieldBonus}
				<p class="mt-0.5 text-xs text-primary" data-testid="field-bonus-{action.id}">
					{action.fieldBonus}
				</p>
			{/if}
			{#if action.reason}
				<p class="mt-0.5 flex items-center gap-1 text-xs text-warning" id="reason-{action.id}">
					<Lock class="size-3 shrink-0" aria-hidden="true" />
					{action.reason}
				</p>
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
	<div class="grid gap-5">
		<section aria-labelledby="actions-title" class="flex min-w-0 flex-col gap-3">
			<h2 id="actions-title" class="section-title">Actions possibles ce trimestre</h2>
			{#each view.actionGroups.filter((group) => group.actions.length > 0) as group (group.id)}
				{@const planned = group.actions.reduce((total, action) => total + action.planned, 0)}
				{@const identity = categoryIdentity(group.id)}
				<details
					open
					class="rounded-md border border-line bg-surface"
					data-testid="group-{group.id}"
				>
					<summary
						class="flex cursor-pointer items-center gap-2 border-b border-line px-3 py-2 marker:content-none"
					>
						<span
							class="inline-grid size-6 shrink-0 place-items-center rounded text-surface"
							style:background={identity.color}
							aria-hidden="true"
						>
							<identity.icon class="size-3.5" />
						</span>
						<span class="font-display text-base font-bold">{group.label}</span>
						<span class="ml-auto text-xs text-muted">
							{group.actions.length} action{group.actions.length > 1 ? 's' : ''}{planned > 0
								? ` · ${planned} au plan`
								: ''}
						</span>
					</summary>
					<ul>
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
					<section
						class="rounded-md border border-line bg-surface py-2"
						aria-label="Actions hors de portée"
						data-testid="out-of-reach"
					>
						{#each view.actionGroups.filter((group) => group.outOfReach.length > 0) as group (group.id)}
							<h3 class="mt-2 px-3 text-xs font-semibold text-muted uppercase">{group.label}</h3>
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
	</div>
{/if}
