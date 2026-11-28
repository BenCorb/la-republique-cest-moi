<script lang="ts">
	import { Gauge, Scale, Users } from '@lucide/svelte';
	import Agenda from '#lib/components/agenda/Agenda.svelte';
	import SupportsCard from '#lib/components/career/SupportsCard.svelte';
	import Dashboard from '#lib/components/dashboard/Dashboard.svelte';
	import type { GameSession } from '#lib/game/app/session.svelte.ts';
	import FixedCard from './FixedCard.svelte';
	import Section from './Section.svelte';

	/** Onglet Trimestre (D-02) : agenda, fixe du trimestre, situation, soutiens. */
	interface Props {
		session: GameSession;
	}

	let { session }: Props = $props();
	const view = $derived(session.snapshot.view);
</script>

{#if view}
	<div class="flex flex-col gap-4">
		<Agenda {session} />
		<Section
			id="fixed"
			title="Fixe ce trimestre"
			icon={Scale}
			summary={view.sections.fixed}
			initiallyOpen
		>
			<FixedCard lines={view.fixed} />
		</Section>
		<Section id="situation" title="Situation" icon={Gauge} summary={view.sections.situation}>
			<Dashboard {session} part="situation" />
		</Section>
		<Section
			id="supports"
			title="Soutiens et tendances"
			icon={Users}
			summary={view.sections.supports}
		>
			<div class="flex flex-col gap-4">
				<SupportsCard supports={view.supports} />
				<Dashboard {session} part="trends" />
			</div>
		</Section>
	</div>
{/if}
