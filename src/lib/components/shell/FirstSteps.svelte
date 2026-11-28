<script lang="ts">
	import { Compass, X } from '@lucide/svelte';
	import type { FirstStepsView } from '#lib/game/app/view-model.ts';
	import { TAB_LABELS, type GameTab } from './tabs.ts';

	/**
	 * Premiers pas guidés (P3-40) : carte complète à l’onglet Trimestre, bulle sur
	 * l'onglet où agir. Aucun effet de jeu ; masquable, réactivable à l'accueil.
	 */
	interface Props {
		steps: FirstStepsView;
		tab: GameTab;
		onTab: (tab: GameTab) => void;
		onHide: () => void;
	}

	let { steps, tab, onTab, onHide }: Props = $props();
	const current = $derived(steps.current);
	const full = $derived(tab === 'quarter');
</script>

{#if current && (full || current.tab === tab)}
	<aside
		class="mb-4 rounded-lg border border-primary/40 bg-primary/5 p-4"
		aria-label="Premiers pas"
		data-testid={full ? 'first-steps' : 'first-steps-bubble'}
	>
		<div class="flex items-start gap-3">
			<Compass class="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
			<div class="flex-1">
				<p class="text-xs font-semibold tracking-wide text-primary uppercase">
					Premiers pas · {steps.doneCount + 1}/{steps.steps.length}
				</p>
				<p class="mt-1 font-semibold">{current.label}</p>
				<p class="mt-1 text-sm text-muted">{current.hint}</p>
				{#if full}
					<ol class="mt-3 flex flex-col gap-1 text-sm">
						{#each steps.steps as step (step.id)}
							<li class={step.done ? 'text-muted line-through' : ''}>
								{step.done ? '✓' : '·'}
								{step.label}
							</li>
						{/each}
					</ol>
					{#if current.tab !== tab}
						<button
							type="button"
							class="btn-secondary btn-small mt-3"
							onclick={() => onTab(current.tab)}
						>
							Aller à : {TAB_LABELS[current.tab]}
						</button>
					{/if}
				{/if}
			</div>
			<button
				type="button"
				class="rounded p-1 text-muted hover:text-ink"
				aria-label="Masquer les premiers pas"
				onclick={onHide}
			>
				<X class="size-4" aria-hidden="true" />
			</button>
		</div>
	</aside>
{/if}
