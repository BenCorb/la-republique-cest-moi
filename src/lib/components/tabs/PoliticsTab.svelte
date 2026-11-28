<script lang="ts">
	import { Flag, Landmark, Newspaper, Vote } from '@lucide/svelte';
	import CareerPanel from '#lib/components/career/CareerPanel.svelte';
	import WorldPanel from '#lib/components/world/WorldPanel.svelte';
	import type { GameSession } from '#lib/game/app/session.svelte.ts';
	import Section from './Section.svelte';

	/** Onglet Politique (D-02) : élections et campagnes en tête, mandats, parti, médias. */
	interface Props {
		session: GameSession;
	}

	let { session }: Props = $props();
	const view = $derived(session.snapshot.view);
</script>

{#if view}
	<div class="flex flex-col gap-4">
		<Section
			id="elections"
			title="Élections et campagnes"
			icon={Vote}
			summary={view.sections.elections}
		>
			<CareerPanel {session} part="elections" />
		</Section>
		<Section id="mandates" title="Mandats" icon={Landmark} summary={view.sections.mandates}>
			<CareerPanel {session} part="mandates" />
		</Section>
		<Section id="party" title="Parti" icon={Flag} summary={view.sections.party}>
			<div class="flex flex-col gap-4">
				<WorldPanel {session} part="affiliation" />
				<CareerPanel {session} part="party" />
			</div>
		</Section>
		<Section id="media" title="Médias" icon={Newspaper} summary={view.sections.media}>
			<CareerPanel {session} part="media" />
		</Section>
	</div>
{/if}
