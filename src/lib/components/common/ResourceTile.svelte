<script lang="ts">
	import { ArrowDown, ArrowRight, ArrowUp } from '@lucide/svelte';
	import type { ResourceView, TrendView } from '#lib/game/app/view-model.ts';
	import { identityOf } from './identity.ts';
	import DeltaFlash from './DeltaFlash.svelte';
	import ResourceIcon from './ResourceIcon.svelte';
	import Sparkline from './Sparkline.svelte';

	/**
	 * Tuile de ressource non bornée (P3-26) : icône d'identité, chiffre fort,
	 * flèche et texte de la variation prévue ; en grand format, courbe des
	 * derniers trimestres quand la vue la fournit.
	 */
	interface Props {
		resource: ResourceView;
		size?: 'header' | 'large';
		trend?: TrendView | null;
	}

	let { resource, size = 'header', trend = null }: Props = $props();
	const identity = $derived(identityOf(resource.id));
	const arrow = $derived(
		resource.trend > 0
			? { icon: ArrowUp, tone: 'text-positive', flash: 'gain' as const }
			: resource.trend < 0
				? { icon: ArrowDown, tone: 'text-danger', flash: 'cost' as const }
				: { icon: ArrowRight, tone: 'text-muted', flash: 'neutral' as const }
	);
</script>

{#if size === 'header'}
	<div
		class="flex min-w-34 items-center gap-2 rounded-md border border-line bg-canvas py-1 pr-3 pl-1.5"
	>
		<ResourceIcon {identity} disc size="md" />
		<dl class="leading-tight">
			<dt class="sr-only">{resource.name}</dt>
			<dd class="text-base font-bold tabular-nums" data-testid="resource-{resource.id}">
				{resource.value}
			</dd>
			<dd class="flex items-center gap-0.5 text-xs tabular-nums {arrow.tone}">
				<arrow.icon class="size-3" aria-hidden="true" />
				<span class="sr-only">Prévu ce trimestre :</span>
				<DeltaFlash text={resource.forecast} tone={arrow.flash} />
			</dd>
		</dl>
	</div>
{:else}
	<div class="flex flex-col gap-2">
		<div class="flex items-center gap-3">
			<ResourceIcon {identity} disc size="lg" />
			<div class="min-w-0">
				<p class="text-xs font-semibold tracking-wide text-muted uppercase">{resource.name}</p>
				<p class="text-2xl leading-none font-bold tabular-nums">{resource.value}</p>
				<p class="mt-0.5 flex items-center gap-0.5 text-sm tabular-nums {arrow.tone}">
					<arrow.icon class="size-3.5" aria-hidden="true" />
					<span>{resource.forecast} <span class="text-muted">prévu</span></span>
				</p>
			</div>
		</div>
		{#if trend}
			<Sparkline
				points={trend.points}
				color={identity?.color ?? 'var(--color-primary)'}
				label={trend.description}
			/>
		{/if}
	</div>
{/if}
