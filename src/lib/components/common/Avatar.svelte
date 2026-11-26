<script lang="ts">
	/**
	 * Médaillon d'une personne (P3-26, DESIGN.md §10.4 point 6) : initiales sur une
	 * couleur stable dérivée de l'identifiant, liseré selon le rôle. Aucun visage,
	 * aucune information cachée : seuls le nom et le rôle publics sont utilisés.
	 */
	interface Props {
		id: string;
		name: string;
		role?: 'family' | 'party' | 'rival' | 'staff' | 'media' | 'other';
		size?: 'sm' | 'md';
	}

	let { id, name, role = 'other', size = 'md' }: Props = $props();

	/** Teintes sombres (texte clair ≥ 4,5:1), choisies par hachage de l'identifiant. */
	const HUES = [
		'#33557a',
		'#6d3fa6',
		'#0f6e66',
		'#7a5b00',
		'#a3326e',
		'#4b5e8a',
		'#2f6b3a',
		'#6b4a33'
	];
	const RING = {
		family: 'var(--color-res-health)',
		party: 'var(--color-primary)',
		rival: 'var(--color-danger)',
		staff: 'var(--color-res-budget)',
		media: 'var(--color-res-exposure)',
		other: 'var(--color-line)'
	} as const;

	const background = $derived.by(() => {
		let hash = 0;
		for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
		return HUES[hash % HUES.length]!;
	});
	const initials = $derived(
		name
			.split(/[\s-]+/)
			.filter((part) => /^\p{Lu}/u.test(part))
			.slice(0, 2)
			.map((part) => part[0])
			.join('') || name.slice(0, 1).toLocaleUpperCase('fr-FR')
	);
</script>

<span
	class="inline-grid shrink-0 place-items-center rounded-full font-bold text-surface ring-2 ring-offset-1 ring-offset-surface {size ===
	'sm'
		? 'size-7 text-xs'
		: 'size-10 text-sm'}"
	style:background
	style:--tw-ring-color={RING[role]}
	aria-hidden="true"
>
	{initials}
</span>
