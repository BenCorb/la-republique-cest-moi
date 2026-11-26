<script lang="ts">
	import type { PlanView } from '#lib/game/app/view-model.ts';
	import { planSegments } from './plan-segments.ts';

	/**
	 * Barre de temps du plan (P3-26) : segments par thème, temps des mandats
	 * hachuré, légende facultative. Le texte du compteur est donné à côté par
	 * l'appelant ; la barre porte aussi une valeur accessible.
	 */
	interface Props {
		plan: PlanView;
		legend?: boolean;
		thin?: boolean;
	}

	let { plan, legend = false, thin = false }: Props = $props();
	const segments = $derived(planSegments(plan));
</script>

<div
	class="flex gap-0.5 overflow-hidden rounded bg-sidebar {thin ? 'h-2' : 'h-4'}"
	role="meter"
	aria-label="Temps utilisé"
	aria-valuemin={0}
	aria-valuemax={plan.timeAvailable}
	aria-valuenow={plan.timeUsed}
	aria-valuetext="{plan.timeUsed} points utilisés sur {plan.timeAvailable}"
>
	{#each segments as segment (segment.key)}
		<span
			class="block h-full {segment.reserved ? 'plan-reserved' : ''}"
			style:width="{segment.width}%"
			style:background={segment.reserved ? undefined : segment.color}
			title="{segment.label} : {segment.points}"
		></span>
	{/each}
</div>
{#if legend && segments.length > 0}
	<ul class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted">
		{#each segments as segment (segment.key)}
			<li class="flex items-center gap-1">
				<span
					class="inline-block size-2.5 rounded-sm {segment.reserved ? 'plan-reserved' : ''}"
					style:background={segment.reserved ? undefined : segment.color}
					aria-hidden="true"
				></span>
				{segment.label}
				{segment.points}
			</li>
		{/each}
	</ul>
{/if}
