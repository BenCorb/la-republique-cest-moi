<script lang="ts">
	/**
	 * Titre de presse défilant (P3-13, demande du créateur) : si le titre dépasse
	 * sa place, il glisse lentement jusqu'à sa fin puis revient, avec des pauses ;
	 * arrêt au survol et au focus. Sous `prefers-reduced-motion`, aucun défilement :
	 * le titre est coupé avec des points de suspension (texte complet en infobulle
	 * et dans Actualités).
	 */
	interface Props {
		text: string;
	}

	let { text }: Props = $props();
	let box = $state(0);
	let content = $state(0);
	const overflow = $derived(Math.max(0, Math.ceil(content - box)));
	/** Environ 30 px par seconde, plus les pauses aux deux extrémités. */
	const duration = $derived(Math.max(6, overflow / 30 + 3) * 2);
</script>

<span
	class="ticker relative block min-w-0 flex-1 overflow-hidden {overflow > 0 ? 'is-faded' : ''}"
	bind:clientWidth={box}
>
	<span
		class="ticker-text inline-block whitespace-nowrap {overflow > 0 ? 'is-scrolling' : ''}"
		style:--ticker-shift="-{overflow}px"
		style:--ticker-duration="{duration}s"
		bind:offsetWidth={content}
	>
		{text}
	</span>
</span>

<style>
	.ticker.is-faded {
		mask-image: linear-gradient(90deg, transparent, #000 10px, #000 calc(100% - 10px), transparent);
	}

	/* Marges égales au fondu : aux deux arrêts, les lettres restent hors du dégradé. */
	.ticker-text.is-scrolling {
		padding-inline: 12px;
		animation: ticker var(--ticker-duration) ease-in-out infinite;
	}

	:global(button:hover) .ticker-text,
	:global(button:focus-visible) .ticker-text {
		animation-play-state: paused;
	}

	@keyframes ticker {
		0%,
		20% {
			transform: translateX(0);
		}
		50%,
		70% {
			transform: translateX(var(--ticker-shift));
		}
		100% {
			transform: translateX(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.ticker.is-faded {
			mask-image: none;
		}

		.ticker-text.is-scrolling {
			padding-inline: 0;
			animation: none;
			display: block;
			overflow: hidden;
			text-overflow: ellipsis;
		}
	}
</style>
