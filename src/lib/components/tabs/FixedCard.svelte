<script lang="ts">
	import EffectChip from '#lib/components/common/EffectChip.svelte';
	import type { FixedLineView } from '#lib/game/app/view-model.ts';

	/** « Fixe ce trimestre » (D-02) : revenus et charges certains, hors actions du plan. */
	interface Props {
		lines: readonly FixedLineView[];
	}

	let { lines }: Props = $props();
</script>

<div class="card flex flex-col gap-2" data-testid="fixed">
	{#if lines.length === 0}
		<p class="text-sm text-muted">Aucun revenu ni charge fixe ce trimestre.</p>
	{:else}
		<ul class="flex flex-col divide-y divide-line">
			{#each lines as line (line.key)}
				<li class="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
					<span>{line.label}</span>
					<span class="flex flex-wrap gap-1.5">
						{#each line.chips as chip, index (index)}
							<EffectChip {chip} />
						{/each}
					</span>
				</li>
			{/each}
		</ul>
	{/if}
	<p class="text-xs text-muted">
		Revenus et charges certains du trimestre, hors actions du plan ; prélevés à la résolution.
	</p>
</div>
