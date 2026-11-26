<script lang="ts">
	import { TrendingUp } from '@lucide/svelte';
	import ResourceIcon from '#lib/components/common/ResourceIcon.svelte';
	import Sparkline from '#lib/components/common/Sparkline.svelte';
	import { identityOf } from '#lib/components/common/identity.ts';
	import type { TrendView } from '#lib/game/app/view-model.ts';

	/**
	 * Tendances des derniers trimestres (P3-08, style P3-26) : une courbe par jauge
	 * aux couleurs de son identité, valeur actuelle et variation en texte (jamais
	 * la seule couleur). Les ressources ont leur courbe dans leur tuile.
	 */
	interface Props {
		trends: readonly TrendView[];
	}

	let { trends }: Props = $props();

	/** Les identifiants de tendance des jauges diffèrent de ceux de la table d'identité. */
	const IDENTITY: Readonly<Record<string, string>> = {
		popularity: 'popularity',
		health: 'player.health',
		stress: 'player.stress'
	};

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
		<ul class="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-3">
			{#each trends as trend (trend.id)}
				{@const identity = identityOf(IDENTITY[trend.id] ?? trend.id)}
				<li class="flex flex-col gap-1" data-testid="trend-{trend.id}">
					<p class="flex items-center gap-1.5 text-sm">
						<ResourceIcon {identity} size="md" />
						<span class="text-muted">{trend.label}</span>
						<span class="ml-auto font-semibold tabular-nums">{trend.current}</span>
						{#if trend.change}
							<span class="text-xs tabular-nums {tone[trend.mood]}">({trend.change})</span>
						{/if}
					</p>
					<Sparkline
						points={trend.points}
						color={identity?.color ?? 'var(--color-primary)'}
						label={trend.description}
						height={28}
					/>
				</li>
			{/each}
		</ul>
		<p class="mt-2 text-xs text-muted">Valeurs en fin de trimestre, sur trois ans au plus.</p>
	{/if}
</section>
