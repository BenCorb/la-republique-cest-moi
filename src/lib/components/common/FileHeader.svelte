<script lang="ts">
	import type { Snippet } from 'svelte';
	import Stamp from './Stamp.svelte';

	/**
	 * En-tête de note de service (P3-26) : service émetteur, date, objet et tampon
	 * de catégorie. Sert aux décisions, résultats et notes de trimestre (P3-14).
	 */
	interface Props {
		service: string;
		date: string;
		title: string;
		stamp?: { label: string; tone?: 'danger' | 'primary' | 'warning' | 'positive' } | null;
		titleId?: string;
		children?: Snippet;
	}

	let { service, date, title, stamp = null, titleId, children }: Props = $props();
</script>

<header class="border-b-2 border-double border-line pb-2">
	<div class="tricolor-rule mb-2 h-1 w-16 rounded-full" aria-hidden="true"></div>
	<div class="flex items-start justify-between gap-3">
		<p class="text-xs tracking-wide text-muted uppercase">{service} · {date}</p>
		{#if stamp}<Stamp label={stamp.label} tone={stamp.tone ?? 'primary'} />{/if}
	</div>
	<h2 id={titleId} class="mt-1 font-display text-xl font-bold text-primary">{title}</h2>
	{@render children?.()}
</header>
