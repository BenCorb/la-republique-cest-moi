<script lang="ts">
	import { TrendingUp } from '@lucide/svelte';
	import type { TrendView } from '#lib/game/app/view-model.ts';

	/**
	 * Tendances des derniers trimestres (P3-08, DESIGN.md §4.2) : une courbe
	 * simple par ressource ou jauge, avec la valeur actuelle et la variation en
	 * texte (jamais la seule couleur). Les données viennent de la vue.
	 */
	interface Props {
		trends: readonly TrendView[];
	}

	let { trends }: Props = $props();

	const WIDTH = 120;
	const HEIGHT = 28;

	function path(points: readonly number[]): string {
		const min = Math.min(...points);
		const max = Math.max(...points);
		const span = max - min || 1;
		const step = points.length > 1 ? WIDTH / (points.length - 1) : 0;
		return points
			.map((value, index) => {
				const x = index * step;
				const y = HEIGHT - 2 - ((value - min) / span) * (HEIGHT - 4);
				return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
			})
			.join(' ');
	}

	const tone = {
		good: 'text-positive',
		bad: 'text-danger',
		neutral: 'text-muted'
	} as const;
</script>

<section class="card" aria-labelledby="tendances-title">
	<h2 id="tendances-title" class="section-title flex items-center gap-2">
		<TrendingUp class="size-4" aria-hidden="true" /> Tendances
	</h2>
	{#if trends.length === 0}
		<p class="mt-2 text-sm text-muted">Les tendances apparaîtront après quelques trimestres.</p>
	{:else}
		<ul class="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
			{#each trends as trend (trend.id)}
				<li class="flex items-center gap-3" data-testid="trend-{trend.id}">
					<div class="min-w-0 flex-1">
						<p class="text-xs text-muted">{trend.label}</p>
						<p class="text-sm font-medium tabular-nums">
							{trend.current}
							{#if trend.change}
								<span class="text-xs {tone[trend.mood]}">({trend.change})</span>
							{/if}
						</p>
					</div>
					<svg
						class="shrink-0 {tone[trend.mood]}"
						width={WIDTH}
						height={HEIGHT}
						viewBox="0 0 {WIDTH} {HEIGHT}"
						role="img"
						aria-label={trend.description}
					>
						<path d={path(trend.points)} fill="none" stroke="currentColor" stroke-width="1.75" />
					</svg>
				</li>
			{/each}
		</ul>
		<p class="mt-2 text-xs text-muted">Valeurs en fin de trimestre, sur trois ans au plus.</p>
	{/if}
</section>
