<script lang="ts">
	// Police de titrage auto-hébergée : un seul fichier, sous-ensemble latin, graisse 700.
	import '@fontsource/zilla-slab/latin-700.css';
	import './layout.css';
	import { asset } from '$app/paths';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<title>La République, c’est moi !</title>
	<!-- Fichier de `static/` : `asset()` applique le base path (GitHub Pages en sous-répertoire). -->
	<link rel="icon" type="image/svg+xml" href={asset('favicon.svg')} />
</svelte:head>

{@render children()}
