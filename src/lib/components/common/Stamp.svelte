<script lang="ts">
	/**
	 * Tampon de catégorie (P3-26) : URGENT, CONFIDENTIEL, CAMPAGNE… posé sur une
	 * note de service. Le mot est écrit en toutes lettres ; légère rotation.
	 */
	interface Props {
		label: string;
		tone?: 'danger' | 'primary' | 'warning' | 'positive';
	}

	let { label, tone = 'primary' }: Props = $props();
	const color = {
		danger: 'border-danger text-danger',
		primary: 'border-primary text-primary',
		warning: 'border-warning text-warning',
		positive: 'border-positive text-positive'
	} as const;
</script>

<span
	class="inline-block -rotate-2 rounded-sm border-2 px-2 font-display text-xs font-bold tracking-widest uppercase {color[
		tone
	]}"
>
	{label}
</span>
