<script lang="ts">
	/**
	 * Variation affichée brièvement à côté d'une valeur (P3-26, DESIGN.md §10.4) :
	 * apparaît à chaque changement de `value`, puis reste lisible. Sous
	 * `prefers-reduced-motion`, aucune animation : le texte est simplement là.
	 */
	interface Props {
		/** Texte de la variation (« +3 ») ; rien si `null`. */
		text: string | null;
		tone?: 'gain' | 'cost' | 'neutral';
	}

	let { text, tone = 'neutral' }: Props = $props();
	const color = { gain: 'text-positive', cost: 'text-danger', neutral: 'text-muted' } as const;
</script>

{#if text}
	{#key text}
		<span class="delta-flash text-xs font-semibold tabular-nums {color[tone]}">{text}</span>
	{/key}
{/if}

<style>
	@media (prefers-reduced-motion: no-preference) {
		.delta-flash {
			display: inline-block;
			animation: delta-rise 1.2s ease-out both;
		}
	}

	@keyframes delta-rise {
		0% {
			opacity: 0;
			transform: translateY(6px);
		}
		30% {
			opacity: 1;
			transform: none;
		}
		100% {
			opacity: 1;
		}
	}
</style>
