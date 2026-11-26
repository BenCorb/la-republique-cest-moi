<script lang="ts">
	import { CircleQuestionMark } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	/**
	 * Aide repliée derrière une icône « ? » (P3-26, DESIGN.md §10.4 point 4) :
	 * bouton natif, ouvert au clic ou au clavier, jamais au seul survol.
	 */
	interface Props {
		/** Sujet de l'aide, pour le nom accessible du bouton. */
		topic: string;
		children: Snippet;
	}

	let { topic, children }: Props = $props();
	let open = $state(false);
	const id = $props.id();
</script>

<span class="relative ml-auto inline-flex">
	<button
		type="button"
		class="inline-grid size-6 place-items-center rounded-full border border-line bg-surface text-muted hover:text-primary"
		aria-expanded={open}
		aria-controls="help-{id}"
		aria-label="Aide : {topic}"
		onclick={() => (open = !open)}
	>
		<CircleQuestionMark class="size-3.5" aria-hidden="true" />
	</button>
</span>
{#if open}
	<div
		id="help-{id}"
		class="basis-full rounded border border-line bg-canvas px-3 py-2 font-sans text-xs font-normal text-muted"
	>
		{@render children()}
	</div>
{/if}
