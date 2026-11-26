<script lang="ts">
	/**
	 * Barres de sondage ou de résultat (P3-26) : une barre par candidat ou liste,
	 * valeur ou fourchette publique écrite à côté (jamais d'issue certaine).
	 */
	interface ScoreRow {
		readonly key: string;
		readonly label: string;
		/** Pourcentage affiché (résultat) ou milieu de fourchette (sondage). */
		readonly value: number;
		readonly range?: { readonly min: number; readonly max: number } | null;
		readonly color?: string;
		readonly highlight?: boolean;
	}

	interface Props {
		rows: readonly ScoreRow[];
		label: string;
	}

	let { rows, label }: Props = $props();
	const clamp = (value: number): number => Math.max(0, Math.min(100, value));
</script>

<ul class="flex flex-col gap-1.5" aria-label={label}>
	{#each rows as row (row.key)}
		<li class="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 text-sm">
			<span class="truncate {row.highlight ? 'font-semibold' : ''}">{row.label}</span>
			<span class="relative h-3 overflow-hidden rounded-sm bg-sidebar" aria-hidden="true">
				{#if row.range}
					<span
						class="absolute inset-y-0 opacity-30"
						style:left="{clamp(row.range.min)}%"
						style:width="{clamp(row.range.max) - clamp(row.range.min)}%"
						style:background={row.color ?? 'var(--color-primary)'}
					></span>
				{/if}
				<span
					class="absolute inset-y-0 left-0"
					style:width="{clamp(row.value)}%"
					style:background={row.color ?? 'var(--color-primary)'}
					style:opacity={row.range ? 0.85 : 1}
				></span>
			</span>
			<span class="text-right tabular-nums">
				{row.range ? `${row.range.min}–${row.range.max} %` : `${row.value} %`}
			</span>
		</li>
	{/each}
</ul>
