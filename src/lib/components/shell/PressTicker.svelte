<script lang="ts">
	import { ArrowRight, Newspaper } from '@lucide/svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { fly } from 'svelte/transition';
	import type { PressItemView } from '#lib/game/app/view-model.ts';

	/**
	 * Fil de presse tournant de l'en-tête (P3-13, demande du créateur) : les titres
	 * du dernier trimestre l'un après l'autre. Un titre court reste quelques
	 * secondes ; un titre long glisse jusqu'à sa fin puis cède la place au suivant.
	 * Pause au survol et au focus ; compteur « 2/3 » pour passer au titre suivant à
	 * la main. Sous `prefers-reduced-motion`, rien ne bouge seul : titre coupé avec
	 * points de suspension, compteur seul. Un clic sur le titre ouvre Actualités.
	 */
	interface Props {
		items: readonly PressItemView[];
		onOpen: () => void;
	}

	let { items, onOpen }: Props = $props();

	/** Temps de lecture d'un titre court, pauses avant et après défilement, vitesse. */
	const READ_MS = 6000;
	const HOLD_MS = 2200;
	const PIXELS_PER_SECOND = 30;

	let index = $state(0);
	/** Relance du même titre (un seul titre, trop long) à la fin de son défilement. */
	let cycle = $state(0);
	let hovered = $state(false);
	let focused = $state(false);
	let box = $state(0);
	let text = $state<HTMLElement | null>(null);
	let animation: Animation | null = null;

	const item = $derived(items[index % Math.max(1, items.length)] ?? null);
	const keys = $derived(items.map((entry) => entry.key).join('|'));
	const still = $derived(prefersReducedMotion.current);

	// Nouveau trimestre : le fil repart du premier titre.
	$effect(() => {
		void keys;
		index = 0;
	});

	$effect(() => {
		void cycle;
		void item;
		const element = text;
		if (!element || still || box === 0) return;
		const overflow = Math.max(0, element.offsetWidth - box);
		const several = items.length > 1;
		if (overflow === 0 && !several) return;
		const travel = (overflow / PIXELS_PER_SECOND) * 1000;
		const total = overflow > 0 ? HOLD_MS + travel + HOLD_MS : READ_MS;
		const shift = `translateX(${-overflow}px)`;
		animation = element.animate(
			overflow > 0
				? [
						{ transform: 'translateX(0)', offset: 0 },
						{ transform: 'translateX(0)', offset: HOLD_MS / total, easing: 'ease-in-out' },
						{ transform: shift, offset: (HOLD_MS + travel) / total },
						{ transform: shift, offset: 1 }
					]
				: [{ transform: 'none' }, { transform: 'none' }],
			{ duration: total }
		);
		if (hovered || focused) animation.pause();
		animation.onfinish = () => {
			if (several) index = (index + 1) % items.length;
			else cycle += 1;
		};
		return () => {
			animation?.cancel();
			animation = null;
		};
	});

	$effect(() => {
		if (hovered || focused) animation?.pause();
		else if (animation?.playState === 'paused') animation.play();
	});

	function next(): void {
		index = (index + 1) % items.length;
	}
</script>

{#if item}
	<div
		class="ml-auto flex max-w-[40%] min-w-0 items-center gap-2"
		data-testid="press-item"
		role="group"
		aria-label="Fil de presse du trimestre"
		onmouseenter={() => (hovered = true)}
		onmouseleave={() => (hovered = false)}
		onfocusin={() => (focused = true)}
		onfocusout={() => (focused = false)}
	>
		<button
			type="button"
			class="flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-0.5 hover:bg-sidebar"
			title="{item.media} : {item.title}"
			onclick={onOpen}
		>
			<Newspaper class="size-3.5 shrink-0 text-muted" aria-hidden="true" />
			{#key item.key}
				<span
					class="flex min-w-0 flex-1 items-center gap-2"
					in:fly={{ y: 8, duration: still ? 0 : 250 }}
				>
					<span
						class="shrink-0 font-display text-xs font-bold tracking-wide uppercase {item.critical
							? 'text-warning'
							: 'text-ink'}"
					>
						{item.media}
					</span>
					<span class="ticker -mx-3 block min-w-0 flex-1 overflow-hidden" bind:clientWidth={box}>
						<span
							bind:this={text}
							class="ticker-text inline-block px-3 font-serif whitespace-nowrap"
							data-testid="press-title"
						>
							{item.title}
						</span>
					</span>
				</span>
			{/key}
			<span class="sr-only">— lire les actualités</span>
			<ArrowRight class="ml-2 size-3.5 shrink-0 text-primary" aria-hidden="true" />
		</button>
		{#if items.length > 1}
			<button
				type="button"
				class="shrink-0 rounded border border-line px-1.5 text-xs text-muted tabular-nums hover:bg-sidebar"
				aria-label="Titre suivant ({index + 1} sur {items.length})"
				data-testid="press-next"
				onclick={next}
			>
				{index + 1}/{items.length}
			</button>
		{/if}
	</div>
{/if}

<style>
	/* Fondu aux bords, dans la marge de 12 px du texte : les lettres à l'arrêt restent nettes. */
	.ticker {
		mask-image: linear-gradient(90deg, transparent, #000 10px, #000 calc(100% - 10px), transparent);
	}

	@media (prefers-reduced-motion: reduce) {
		.ticker {
			mask-image: none;
			margin-inline: 0;
		}

		.ticker-text {
			display: block;
			padding-inline: 0;
			overflow: hidden;
			text-overflow: ellipsis;
		}
	}
</style>
