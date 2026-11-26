<script lang="ts">
	/**
	 * Palier qualitatif coloré (P3-26) : compétence, implantation, jauge… Le mot
	 * est toujours écrit ; la couleur ne fait que le souligner.
	 */
	interface Props {
		label: string;
		/** Couleur CSS du fond (texte clair dessus, ≥ 4,5:1 avec les tokens d'identité). */
		color?: string;
	}

	let { label, color = 'var(--color-primary)' }: Props = $props();
</script>

<span
	class="inline-block rounded-sm px-1.5 text-[11px] leading-5 font-bold whitespace-nowrap text-surface"
	style:background={color}
>
	{label}
</span>
