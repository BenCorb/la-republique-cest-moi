<script lang="ts">
	import { Dices } from '@lucide/svelte';
	import type { ChipView } from '#lib/game/app/view-model.ts';
	import { identityOf } from './identity.ts';
	import ResourceIcon from './ResourceIcon.svelte';

	/**
	 * Pastille de coût ou d'effet (P3-26, DESIGN.md §10.4) : l'icône porte la
	 * couleur de la ressource, le fond et le chiffre portent le sens (gain, coût,
	 * risque). Le dé signale une fourchette. La phrase complète reste lisible par
	 * les lecteurs d'écran : le sens ne dépend jamais de la seule couleur.
	 */
	interface Props {
		chip: ChipView;
	}

	let { chip }: Props = $props();
	const identity = $derived(identityOf(chip.identity));

	const tone = {
		gain: 'border-gain-line bg-gain-soft text-positive',
		cost: 'border-cost-line bg-cost-soft text-danger',
		risk: 'border-risk-line bg-risk-soft text-warning',
		neutral: 'border-line bg-surface text-ink'
	} as const;
</script>

<span
	class="inline-flex max-w-full items-center gap-1 rounded-full border px-1.5 py-px text-xs font-semibold whitespace-nowrap tabular-nums {tone[
		chip.sense
	]}"
	title={chip.text}
	data-sense={chip.sense}
>
	<span class="sr-only">{chip.text}{chip.variable ? ' (variable)' : ''}</span>
	{#if identity}
		<ResourceIcon {identity} size="sm" />
		<span aria-hidden="true">{chip.value}</span>
	{:else}
		<span class="truncate font-medium" aria-hidden="true">{chip.value}</span>
	{/if}
	{#if chip.variable}
		<Dices class="size-3 text-muted" aria-hidden="true" />
	{/if}
</span>
