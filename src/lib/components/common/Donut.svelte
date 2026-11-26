<script lang="ts">
	/**
	 * Anneau de proportions (P3-14) : duel électoral, bilan de victoires… Le texte
	 * central et le libellé accessible donnent les valeurs : la couleur ne porte
	 * jamais seule l'information.
	 */
	interface Segment {
		readonly value: number;
		readonly color: string;
		readonly label: string;
	}

	interface Props {
		segments: readonly Segment[];
		/** Texte au centre (« 52 % »). */
		center: string;
		label: string;
		size?: number;
	}

	let { segments, center, label, size = 72 }: Props = $props();
	const RADIUS = 15.915; // circonférence de 100 : les valeurs sont des pourcentages.
	const total = $derived(segments.reduce((sum, segment) => sum + segment.value, 0) || 1);
	const arcs = $derived.by(() => {
		let offset = 25; // départ à midi
		return segments.map((segment) => {
			const length = (segment.value / total) * 100;
			const arc = { ...segment, length, offset };
			offset -= length;
			return arc;
		});
	});
</script>

<svg width={size} height={size} viewBox="0 0 36 36" role="img" aria-label={label} class="shrink-0">
	<circle cx="18" cy="18" r={RADIUS} fill="none" stroke="var(--color-sidebar)" stroke-width="5" />
	{#each arcs as arc, index (index)}
		{#if arc.length > 0}
			<circle
				cx="18"
				cy="18"
				r={RADIUS}
				fill="none"
				stroke={arc.color}
				stroke-width="5"
				stroke-dasharray="{arc.length} {100 - arc.length}"
				stroke-dashoffset={arc.offset}
			/>
		{/if}
	{/each}
	<text
		x="18"
		y="18"
		text-anchor="middle"
		dominant-baseline="central"
		font-size="7.5"
		font-weight="700"
		fill="var(--color-ink)"
	>
		{center}
	</text>
</svg>
