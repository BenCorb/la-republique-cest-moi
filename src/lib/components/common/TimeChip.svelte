<script lang="ts">
	import ResourceIcon from './ResourceIcon.svelte';

	/** Pastille de temps (P3-26) : sablier et points de temps, sans jugement de sens. */
	interface Props {
		points: number;
	}

	let { points }: Props = $props();
</script>

<span
	class="inline-flex items-center gap-1 rounded-full border border-line bg-canvas px-1.5 py-px text-xs font-semibold whitespace-nowrap text-res-time tabular-nums"
	title="{points} points de temps"
>
	<span class="sr-only">{points} points de temps</span>
	<ResourceIcon identity="time" size="sm" />
	<span aria-hidden="true">{points}</span>
</span>
