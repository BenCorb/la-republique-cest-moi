<script lang="ts">
	import { ArrowDown, ArrowRight, ArrowUp } from '@lucide/svelte';
	import DeltaFlash from '#lib/components/common/DeltaFlash.svelte';
	import ResourceIcon from '#lib/components/common/ResourceIcon.svelte';
	import { identityOf } from '#lib/components/common/identity.ts';
	import type { GaugeDescription } from '#lib/game/app/format.ts';

	/**
	 * Cellule de l'en-tête (P3-26) : même gabarit pour chaque indicateur, sur trois
	 * lignes de hauteur fixe — libellé à icône, valeur forte (et mot du palier),
	 * puis variation prévue (ressource) ou barre à paliers (jauge).
	 */
	interface Props {
		identity: string;
		label: string;
		value: string;
		/** Ressource non bornée : variation prévue et son sens. */
		forecast?: { readonly text: string; readonly trend: -1 | 0 | 1 } | null;
		/** Jauge 0–100 : palier, repères et prévision éventuelle. */
		gauge?: GaugeDescription | null;
		gaugeForecast?: number | null;
		testId?: string;
	}

	let {
		identity,
		label,
		value,
		forecast = null,
		gauge = null,
		gaugeForecast = null,
		testId
	}: Props = $props();
	const resolved = $derived(identityOf(identity));
	const color = $derived(resolved?.color ?? 'var(--color-primary)');
	const arrow = $derived(
		!forecast || forecast.trend === 0
			? { icon: ArrowRight, tone: 'text-muted', flash: 'neutral' as const }
			: forecast.trend > 0
				? { icon: ArrowUp, tone: 'text-positive', flash: 'gain' as const }
				: { icon: ArrowDown, tone: 'text-danger', flash: 'cost' as const }
	);
	const clamp = (n: number): number => Math.max(0, Math.min(100, n));
	const ghost = $derived.by(() => {
		if (!gauge || gaugeForecast === null || gaugeForecast === gauge.value) return null;
		const low = clamp(Math.min(gaugeForecast, gauge.value));
		return { left: low, width: clamp(Math.max(gaugeForecast, gauge.value)) - low };
	});
</script>

<div class="flex min-w-0 flex-col justify-center gap-1 px-3.5 py-2.5">
	<dt class="flex items-center gap-1.5 text-[11px] font-bold tracking-wide uppercase" style:color>
		<ResourceIcon identity={resolved} size="sm" />
		<span class="truncate">{label}</span>
	</dt>
	<dd class="flex items-baseline justify-between gap-2 leading-none">
		<span class="text-xl font-bold tabular-nums" data-testid={testId}>{value}</span>
		{#if gauge}
			<span class="flex min-w-0 items-baseline gap-1 text-xs text-muted">
				{#if ghost}<span class="shrink-0 tabular-nums">→ {gaugeForecast}</span><span
						aria-hidden="true"
					>
						·
					</span>{/if}
				<span class="truncate">{gauge.label}</span>
			</span>
		{/if}
	</dd>
	<dd class="flex h-4 items-center">
		{#if gauge}
			<div
				class="relative h-1.5 w-full overflow-hidden rounded-full bg-sidebar"
				role="meter"
				aria-label={label}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={gauge.value}
				aria-valuetext="{gauge.value} sur 100, {gauge.label}{ghost
					? `, ${gaugeForecast} prévu en fin de trimestre`
					: ''}"
			>
				<div
					class="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
					style:width="{clamp(gauge.value)}%"
					style:background={color}
				></div>
				{#if ghost}
					<div
						class="header-ghost absolute inset-y-0"
						style:left="{ghost.left}%"
						style:width="{ghost.width}%"
						style:color
					></div>
				{/if}
				{#each gauge.tiers.slice(1).filter((tier) => tier.from >= 5) as tier (tier.from)}
					<span class="absolute inset-y-0 w-0.5 bg-surface" style:left="{tier.from}%"></span>
				{/each}
			</div>
		{:else if forecast}
			<span class="flex items-center gap-0.5 text-xs tabular-nums {arrow.tone}">
				<arrow.icon class="size-3" aria-hidden="true" />
				<span class="sr-only">Prévu ce trimestre :</span>
				<DeltaFlash text={forecast.text} tone={arrow.flash} />
				<span class="text-muted">prévu</span>
			</span>
		{/if}
	</dd>
</div>

<style>
	.header-ghost {
		background: repeating-linear-gradient(135deg, currentColor 0 3px, transparent 3px 6px);
		opacity: 0.5;
	}
</style>
