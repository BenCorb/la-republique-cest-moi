<script lang="ts">
	import { Flag, Gavel, Globe, Newspaper } from '@lucide/svelte';
	import NewsPanel from '#lib/components/news/NewsPanel.svelte';
	import WorldPanel from '#lib/components/world/WorldPanel.svelte';
	import type { GameSession } from '#lib/game/app/session.svelte.ts';
	import Section from './Section.svelte';

	/** Onglet La France (D-02) : contexte, partis et intentions de vote, institutions, presse. */
	interface Props {
		session: GameSession;
	}

	let { session }: Props = $props();
	const view = $derived(session.snapshot.view);
</script>

{#if view}
	<div class="flex flex-col gap-4">
		<Section id="context" title="Contexte national" icon={Globe} summary={view.sections.context}>
			<WorldPanel {session} part="context" />
		</Section>
		<Section
			id="parties"
			title="Partis et intentions de vote"
			icon={Flag}
			summary={view.sections.parties}
		>
			<WorldPanel {session} part="parties" />
		</Section>
		<Section
			id="institutions"
			title="Institutions"
			icon={Gavel}
			summary={view.sections.institutions}
		>
			<WorldPanel {session} part="institutions" />
		</Section>
		<Section id="press" title="Presse" icon={Newspaper} summary={view.sections.press}>
			<NewsPanel {session} />
		</Section>
	</div>
{/if}
