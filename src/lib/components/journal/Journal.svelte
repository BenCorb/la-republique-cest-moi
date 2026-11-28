<script lang="ts">
	import {
		Calendar,
		Flag,
		Gavel,
		HeartPulse,
		Landmark,
		Newspaper,
		Briefcase,
		Users,
		CircleStop
	} from '@lucide/svelte';
	import CalendarDate from '#lib/components/common/CalendarDate.svelte';
	import type { GameSession } from '#lib/game/app/session.svelte.ts';
	import type { JournalLine } from '#lib/game/app/view-model.ts';

	/** Journal (DESIGN.md §4, §5) : trimestres résolus et décisions, du plus récent au plus ancien. */
	interface Props {
		session: GameSession;
	}

	let { session }: Props = $props();
	const view = $derived(session.snapshot.view);

	/** Rubrique de chaque ligne (P3-27) : icône et couleur d'identité, libellé toujours écrit. */
	const kinds: Record<
		JournalLine['kind'],
		{ label: string; icon: typeof Calendar; color: string }
	> = {
		step: { label: 'Agenda', icon: Calendar, color: 'var(--color-res-time)' },
		economy: { label: 'Organisation', icon: Briefcase, color: 'var(--color-res-budget)' },
		wellbeing: { label: 'Santé', icon: HeartPulse, color: 'var(--color-res-health)' },
		world: { label: 'Politique', icon: Flag, color: 'var(--color-res-influence)' },
		people: { label: 'Relations', icon: Users, color: 'var(--color-res-popularity)' },
		career: { label: 'Carrière', icon: Landmark, color: 'var(--color-primary)' },
		event: { label: 'Nouvelle', icon: Newspaper, color: 'var(--color-res-exposure)' },
		decision: { label: 'Décision', icon: Gavel, color: 'var(--color-res-justice)' },
		end: { label: 'Fin', icon: CircleStop, color: 'var(--color-danger)' }
	};
</script>

{#if view}
	<section aria-labelledby="journal-title">
		<h2 id="journal-title" class="section-title">Journal de carrière</h2>
		{#if view.journal.length === 0}
			<p class="mt-2 text-sm text-muted">Le journal se remplira au fil des trimestres.</p>
		{:else}
			<ol class="mt-3 flex flex-col gap-3">
				{#each view.journal as quarter (quarter.key)}
					<li class="card">
						<div class="flex items-center gap-3">
							{#if /^T\d \d{4}$/u.test(quarter.label)}
								<span aria-hidden="true"><CalendarDate label={quarter.label} /></span>
								<h3 class="sr-only">{quarter.label}</h3>
							{:else}
								<h3 class="font-serif font-semibold">{quarter.label}</h3>
							{/if}
						</div>
						<ul class="mt-2 flex flex-col gap-1 text-sm">
							{#each quarter.lines as line, index (index)}
								{@const kind = kinds[line.kind]}
								{@const Icon = kind.icon}
								<li class="grid grid-cols-[8rem_1fr] items-start gap-2">
									<span
										class="inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-white"
										style="background-color: {kind.color}"
									>
										<Icon class="size-3" aria-hidden="true" />
										{kind.label}
									</span>
									<span>{line.text}</span>
								</li>
							{/each}
						</ul>
					</li>
				{/each}
			</ol>
		{/if}
	</section>
{/if}
