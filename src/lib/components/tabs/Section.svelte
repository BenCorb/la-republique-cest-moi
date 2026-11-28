<script lang="ts">
	import { ChevronDown, ChevronRight } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import type { SectionId } from '#lib/game/app/view-model.ts';
	import { isOpen, setOpen } from './sections.svelte.ts';

	/**
	 * Section d'onglet (D-02) : titre et résumé d'une ligne, détail à la demande.
	 * L'état déplié reste le même d'un onglet à l'autre pendant la session.
	 */
	interface Props {
		id: SectionId;
		title: string;
		icon: typeof ChevronDown;
		summary: string;
		/** Dépliée par défaut (« Fixe ce trimestre »). */
		initiallyOpen?: boolean;
		children: Snippet;
	}

	let { id, title, icon: Icon, summary, initiallyOpen = false, children }: Props = $props();
	const open = $derived(isOpen(id, initiallyOpen));
</script>

<section class="flex flex-col gap-3" aria-labelledby="section-{id}" data-testid="section-{id}">
	<h2 id="section-{id}" class="m-0">
		<button
			type="button"
			class="flex w-full items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-left hover:border-primary"
			aria-expanded={open}
			aria-controls="section-{id}-body"
			onclick={() => setOpen(id, !open)}
		>
			{#if open}
				<ChevronDown class="size-4 shrink-0 text-muted" aria-hidden="true" />
			{:else}
				<ChevronRight class="size-4 shrink-0 text-muted" aria-hidden="true" />
			{/if}
			<Icon class="size-4 shrink-0 text-primary" aria-hidden="true" />
			<span class="font-display text-base font-bold text-primary">{title}</span>
			<span class="min-w-0 flex-1 truncate text-sm text-muted" data-testid="section-summary-{id}">
				{summary}
			</span>
		</button>
	</h2>
	{#if open}
		<div id="section-{id}-body">
			{@render children()}
		</div>
	{/if}
</section>
