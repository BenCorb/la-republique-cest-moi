<script lang="ts">
	import type { GaugeDescription } from '#lib/game/app/format.ts';

	/** Jauge 0–100 : valeur, mot descriptif et barre (l'information ne dépend pas de la couleur). */
	interface Props {
		name: string;
		gauge: GaugeDescription;
		compact?: boolean;
	}

	let { name, gauge, compact = false }: Props = $props();

	const toneClass: Record<GaugeDescription['tone'], string> = {
		good: 'bg-positive',
		neutral: 'bg-primary',
		warning: 'bg-warning',
		danger: 'bg-danger'
	};
</script>

<div class={compact ? 'min-w-32' : 'w-full'}>
	<div class="flex items-baseline justify-between gap-2 text-sm">
		<span class="font-medium">{name}</span>
		<span class="tabular-nums">
			<span class="font-semibold">{gauge.value}</span>/100 · {gauge.label}
		</span>
	</div>
	<div
		class="mt-1 h-2 rounded-full bg-sidebar"
		role="meter"
		aria-label={name}
		aria-valuemin={0}
		aria-valuemax={100}
		aria-valuenow={gauge.value}
		aria-valuetext={`${gauge.value} sur 100, ${gauge.label}`}
	>
		<div class="h-2 rounded-full {toneClass[gauge.tone]}" style:width="{gauge.value}%"></div>
	</div>
</div>
