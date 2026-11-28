<script lang="ts">
	import { Building, Handshake, UsersRound } from '@lucide/svelte';
	import EntouragePanel from '#lib/components/entourage/EntouragePanel.svelte';
	import Organisation from '#lib/components/organisation/Organisation.svelte';
	import RelationsPanel from '#lib/components/people/RelationsPanel.svelte';
	import type { GameSession } from '#lib/game/app/session.svelte.ts';
	import Section from './Section.svelte';

	/** Onglet Mon réseau (D-02) : équipe, organisation et financement, relations. */
	interface Props {
		session: GameSession;
	}

	let { session }: Props = $props();
	const view = $derived(session.snapshot.view);
</script>

{#if view}
	<div class="flex flex-col gap-4">
		<Section id="team" title="Équipe" icon={UsersRound} summary={view.sections.team}>
			<EntouragePanel {session} />
		</Section>
		<Section
			id="organisation"
			title="Organisation et financement"
			icon={Building}
			summary={view.sections.organisation}
		>
			<Organisation {session} />
		</Section>
		<Section id="relations" title="Relations" icon={Handshake} summary={view.sections.relations}>
			<RelationsPanel {session} />
		</Section>
	</div>
{/if}
