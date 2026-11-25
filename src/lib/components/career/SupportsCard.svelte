<script lang="ts">
	import Gauge from '#lib/components/common/Gauge.svelte';
	import type { SupportsView } from '#lib/game/app/view-model.ts';

	/**
	 * Soutiens (P2-07) : popularité, détail des groupes électoraux (qui la
	 * composent) et des groupes d'influence (qui ne votent pas). Données de
	 * sondage publiques.
	 */
	interface Props {
		supports: SupportsView;
	}

	let { supports }: Props = $props();
</script>

<section class="card flex flex-col gap-3 xl:col-span-2" aria-labelledby="soutiens-title">
	<h2 id="soutiens-title" class="section-title">Soutiens et popularité</h2>
	<div class="max-w-md">
		<Gauge name="Popularité" gauge={supports.popularity} />
	</div>
	<div class="grid gap-5 md:grid-cols-2">
		<div>
			<h3 class="text-xs font-semibold text-muted uppercase">Électorat</h3>
			<p class="text-xs text-muted">
				La popularité est la moyenne de ces groupes, pondérée par leur poids.
			</p>
			<ul class="mt-2 flex flex-col gap-3">
				{#each supports.electoral as group (group.id)}
					<li data-testid="support-{group.id}">
						<Gauge name="{group.label} ({group.share} % de l’électorat)" gauge={group.gauge} />
						<p class="mt-0.5 text-xs text-muted">{group.description}</p>
					</li>
				{/each}
			</ul>
		</div>
		<div>
			<h3 class="text-xs font-semibold text-muted uppercase">Appuis d’influence</h3>
			<p class="text-xs text-muted">
				Ils ne votent pas pour vous, mais ouvrent ou ferment des portes.
			</p>
			<ul class="mt-2 flex flex-col gap-3">
				{#each supports.influence as group (group.id)}
					<li data-testid="support-{group.id}">
						<Gauge name={group.label} gauge={group.gauge} />
						<p class="mt-0.5 text-xs text-muted">{group.description}</p>
					</li>
				{/each}
			</ul>
		</div>
	</div>
</section>
