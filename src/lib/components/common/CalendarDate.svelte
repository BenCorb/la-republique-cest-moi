<script lang="ts">
	/**
	 * Date mise en forme de feuillet de calendrier (P3-26) : trimestre en bandeau,
	 * année en grand. La transition de trimestre reste à P3-14 ; le libellé
	 * complet est fourni pour les lecteurs d'écran par l'appelant.
	 */
	interface Props {
		/** « T2 2004 ». */
		label: string;
	}

	let { label }: Props = $props();
	const parts = $derived.by(() => {
		const [quarter = label, year = ''] = label.split(' ');
		return { quarter, year };
	});
</script>

<span
	class="inline-flex min-w-16 flex-col items-center overflow-hidden rounded-md border border-line bg-surface"
	aria-hidden="true"
>
	<span class="w-full bg-primary text-center font-display text-sm leading-5 font-bold text-surface">
		{parts.quarter}
	</span>
	<span class="px-2 font-display text-xl leading-7 font-bold tabular-nums">{parts.year}</span>
</span>
