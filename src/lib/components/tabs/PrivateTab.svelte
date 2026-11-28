<script lang="ts">
	import { Coins, HeartPulse, Scale } from '@lucide/svelte';
	import Dashboard from '#lib/components/dashboard/Dashboard.svelte';
	import Wealth from '#lib/components/wealth/Wealth.svelte';
	import type { GameSession } from '#lib/game/app/session.svelte.ts';
	import Section from './Section.svelte';

	/** Onglet Vie privée (D-02) : santé et stress, exposition et justice, patrimoine. */
	interface Props {
		session: GameSession;
	}

	let { session }: Props = $props();
	const view = $derived(session.snapshot.view);
</script>

{#if view}
	<div class="flex flex-col gap-4">
		<Section id="health" title="Santé et stress" icon={HeartPulse} summary={view.sections.health}>
			<Dashboard {session} part="health" />
		</Section>
		<Section
			id="justice"
			title="Exposition et justice"
			icon={Scale}
			summary={view.sections.justice}
		>
			<Dashboard {session} part="justice" />
		</Section>
		<Section id="wealth" title="Patrimoine" icon={Coins} summary={view.sections.wealth}>
			<Wealth {session} />
		</Section>
	</div>
{/if}
