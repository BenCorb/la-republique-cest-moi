<script lang="ts">
	/**
	 * Courbe simple des derniers trimestres (P3-26, reprise de P3-08) : aire
	 * légère, trait et point final ; résumé accessible fourni par la vue.
	 */
	interface Props {
		points: readonly number[];
		color: string;
		label: string;
		height?: number;
	}

	let { points, color, label, height = 36 }: Props = $props();
	const WIDTH = 120;

	const coords = $derived.by(() => {
		const min = Math.min(...points);
		const max = Math.max(...points);
		const span = max - min || 1;
		const step = points.length > 1 ? WIDTH / (points.length - 1) : 0;
		return points.map((value, index) => ({
			x: index * step,
			y: height - 3 - ((value - min) / span) * (height - 6)
		}));
	});
	const line = $derived(coords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
	const last = $derived(coords.at(-1));
</script>

{#if points.length > 1 && last}
	<svg
		class="block w-full"
		{height}
		viewBox="0 0 {WIDTH} {height}"
		preserveAspectRatio="none"
		role="img"
		aria-label={label}
	>
		<line x1="0" x2={WIDTH} y1={height - 1} y2={height - 1} stroke="var(--color-line)" />
		<polygon points="0,{height} {line} {WIDTH},{height}" fill={color} opacity="0.12" />
		<polyline
			points={line}
			fill="none"
			stroke={color}
			stroke-width="2"
			vector-effect="non-scaling-stroke"
		/>
		<circle cx={last.x - 1.5} cy={last.y} r="2.5" fill={color} />
	</svg>
{/if}
