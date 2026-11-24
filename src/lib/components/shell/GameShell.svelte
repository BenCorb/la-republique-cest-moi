<script lang="ts">
	import { Landmark } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	/**
	 * Coque desktop commune (DESIGN.md §3) : en-tête et barre d'état toujours visibles,
	 * contenu central défilant. Les zones de navigation, presse et commandes de tour
	 * seront ajoutées avec les écrans réellement implémentés (pas d'onglets factices).
	 */
	interface Props {
		children: Snippet;
		status: Snippet;
	}

	let { children, status }: Props = $props();
</script>

<a
	href="#contenu"
	class="sr-only z-10 rounded bg-primary px-4 py-2 text-surface focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
>
	Aller au contenu principal
</a>

<div class="grid h-dvh grid-rows-[auto_1fr_auto]">
	<header class="border-b border-line bg-surface">
		<div class="flex items-center gap-3 px-6 py-3">
			<Landmark class="size-6 shrink-0 text-primary" aria-hidden="true" />
			<h1 class="text-xl font-bold tracking-wide text-primary uppercase">
				La République, c’est moi !
			</h1>
		</div>
	</header>

	<main id="contenu" tabindex="-1" class="overflow-y-auto focus:outline-none">
		{@render children()}
	</main>

	<footer class="border-t border-line bg-sidebar px-6 py-2 text-sm text-muted">
		{@render status()}
	</footer>
</div>
