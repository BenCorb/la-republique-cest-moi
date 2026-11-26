<script lang="ts">
	import type { GaugeDescription } from '#lib/game/app/format.ts';
	import { identityOf } from './identity.ts';
	import ResourceIcon from './ResourceIcon.svelte';
	import TierBadge from './TierBadge.svelte';

	/**
	 * Barre bornée 0–100 (P3-26, remplace `Gauge`) : valeur, mot du palier,
	 * repères de seuil publics et, en option, la variation prévue « fantôme »
	 * (prévision du plan, jamais un tirage). Le texte suffit sans la couleur.
	 */
	interface Props {
		name: string;
		gauge: GaugeDescription;
		/** Clé d'identité (couleur et icône) ; sinon couleur de la tonalité. */
		identity?: string | null;
		/** Valeur prévue en fin de trimestre (barre hachurée). */
		forecast?: number | null;
		size?: 'compact' | 'regular';
		/** Mots des paliers sous la barre. */
		scale?: boolean;
	}

	let {
		name,
		gauge,
		identity = null,
		forecast = null,
		size = 'regular',
		scale = false
	}: Props = $props();
	const resolved = $derived(identityOf(identity));
	const toneColor = {
		good: 'var(--color-positive)',
		neutral: 'var(--color-primary)',
		warning: 'var(--color-warning)',
		danger: 'var(--color-danger)'
	} as const;
	const color = $derived(resolved?.color ?? toneColor[gauge.tone]);
	const clamp = (value: number): number => Math.max(0, Math.min(100, value));
	const ghost = $derived.by(() => {
		if (forecast === null || forecast === gauge.value) return null;
		const low = clamp(Math.min(forecast, gauge.value));
		const high = clamp(Math.max(forecast, gauge.value));
		return { left: low, width: high - low, rising: forecast > gauge.value };
	});
	const ticks = $derived(gauge.tiers.slice(1).filter((tier) => tier.from >= 5));
	const valueText = $derived(
		`${gauge.value} sur 100, ${gauge.label}${forecast !== null && forecast !== gauge.value ? `, ${forecast} prévu en fin de trimestre` : ''}`
	);
</script>

<div class={size === 'compact' ? 'w-full min-w-36' : 'w-full'}>
	<div class="flex items-center justify-between gap-2 text-sm">
		<span class="flex min-w-0 items-center gap-1.5 font-semibold" style:color={resolved?.color}>
			{#if resolved}<ResourceIcon
					identity={resolved}
					size={size === 'compact' ? 'sm' : 'md'}
				/>{/if}
			<span class={resolved ? '' : 'text-ink'}>{name}</span>
		</span>
		<span class="flex shrink-0 items-center gap-1.5 tabular-nums">
			{#if size === 'regular'}
				<TierBadge label={gauge.label} {color} />
			{/if}
			<span class="font-semibold">
				{gauge.value}{#if ghost}<span class="font-normal text-muted"> → {forecast}</span>{/if}
			</span>
		</span>
	</div>
	<div
		class="relative mt-1 overflow-hidden rounded-full bg-sidebar {size === 'compact'
			? 'h-2.5'
			: 'h-3'}"
		role="meter"
		aria-label={name}
		aria-valuemin={0}
		aria-valuemax={100}
		aria-valuenow={gauge.value}
		aria-valuetext={valueText}
	>
		<div
			class="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
			style:width="{clamp(gauge.value)}%"
			style:background={color}
		></div>
		{#if ghost}
			<div
				class="statbar-ghost absolute inset-y-0"
				style:left="{ghost.left}%"
				style:width="{ghost.width}%"
				style:color
			></div>
		{/if}
		{#each ticks as tick (tick.from)}
			<span class="absolute inset-y-0 w-0.5 bg-surface" style:left="{tick.from}%"></span>
		{/each}
	</div>
	{#if size === 'compact'}
		<p class="mt-0.5 text-[11px] leading-tight text-muted">{gauge.label}</p>
	{/if}
	{#if scale}
		<div class="mt-0.5 flex justify-between gap-1 text-[11px] text-muted" aria-hidden="true">
			{#each gauge.tiers as tier (tier.from)}
				<span class={tier.label === gauge.label ? 'font-semibold text-ink' : ''}>{tier.label}</span>
			{/each}
		</div>
	{/if}
</div>

<style>
	.statbar-ghost {
		background: repeating-linear-gradient(135deg, currentColor 0 3px, transparent 3px 6px);
		opacity: 0.5;
	}
</style>
