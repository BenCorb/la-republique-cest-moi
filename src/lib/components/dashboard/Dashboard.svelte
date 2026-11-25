<script lang="ts">
	import Gauge from '#lib/components/common/Gauge.svelte';
	import SpanSummary from './SpanSummary.svelte';
	import type { GameSession } from '#lib/game/app/session.svelte.ts';

	/**
	 * Tableau de bord (DESIGN.md §4.2) : ressources et variation prévue, budgets
	 * séparés, santé et stress expliqués, organisation et dernier trimestre.
	 */
	interface Props {
		session: GameSession;
	}

	let { session }: Props = $props();
	const view = $derived(session.snapshot.view);
	const acceleration = $derived(session.snapshot.acceleration);
	const lastQuarter = $derived(view?.journal[0] ?? null);
	const active = $derived(
		view?.producers.filter((producer) => producer.status === 'active').length ?? 0
	);
	const suspended = $derived(
		view?.producers.filter((producer) => producer.status === 'suspended').length ?? 0
	);
</script>

{#if view}
	<div class="grid gap-5 lg:grid-cols-2">
		{#if acceleration && !acceleration.running && acceleration.summary}
			<SpanSummary {acceleration} onDismiss={() => session.controller.dismissAcceleration()} />
		{/if}
		<section class="card" aria-labelledby="situation-title">
			<h2 id="situation-title" class="section-title">Situation</h2>
			<table class="mt-3 w-full text-sm">
				<thead>
					<tr class="text-left text-muted">
						<th class="pb-1 font-normal">Ressource</th>
						<th class="pb-1 text-right font-normal">Actuel</th>
						<th class="pb-1 text-right font-normal">Prévu ce trimestre</th>
					</tr>
				</thead>
				<tbody>
					{#each view.resources as resource (resource.id)}
						<tr class="border-t border-line">
							<th scope="row" class="py-1.5 text-left font-medium">{resource.name}</th>
							<td class="py-1.5 text-right tabular-nums">{resource.value}</td>
							<td class="py-1.5 text-right text-muted tabular-nums">{resource.forecast}</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<p class="mt-2 text-xs text-muted">
				Le budget politique finance l’organisation ; l’argent personnel reste le vôtre. Ils ne se
				mélangent pas.
			</p>
		</section>

		<section class="card flex flex-col gap-4" aria-labelledby="sante-title">
			<h2 id="sante-title" class="section-title">Santé et stress</h2>
			<Gauge name="Santé" gauge={view.health} />
			<Gauge name="Stress" gauge={view.stress} />
			<p class="text-xs text-muted">
				Un trimestre trop chargé fait monter le stress ; un stress élevé use la santé. Le repos et
				les vacances aident à récupérer.
			</p>
		</section>

		<section class="card flex flex-col gap-1 lg:col-span-2" aria-labelledby="profil-title">
			<h2 id="profil-title" class="section-title">Profil</h2>
			<p class="text-sm" data-testid="profile">
				{view.profile.origin} · {view.profile.profession} · {view.profile.family}
			</p>
		</section>

		<section class="card flex flex-col gap-3" aria-labelledby="national-title">
			<h2 id="national-title" class="section-title">Contexte national</h2>
			<p class="text-sm">
				Gouvernement : <span class="font-semibold">{view.world.governingParty}</span> · Vous :
				<span class="font-semibold">{view.world.affiliation}</span>
			</p>
			{#each view.world.indicators as indicator (indicator.id)}
				<Gauge name={indicator.name} gauge={indicator.gauge} />
			{/each}
		</section>

		<section class="card" aria-labelledby="orga-title">
			<h2 id="orga-title" class="section-title">Organisation</h2>
			{#if view.producers.length === 0}
				<p class="mt-2 text-sm text-muted">Aucune amélioration pour l’instant.</p>
			{:else}
				<p class="mt-2 text-sm">
					{view.producers.length} amélioration(s) : {active} active(s){suspended > 0
						? `, ${suspended} suspendue(s) faute de trésorerie`
						: ''}.
				</p>
			{/if}
		</section>

		<section class="card" aria-labelledby="last-title">
			<h2 id="last-title" class="section-title">
				{lastQuarter ? `Dernier trimestre (${lastQuarter.label})` : 'Premier trimestre'}
			</h2>
			{#if lastQuarter}
				<ul class="mt-2 flex flex-col gap-1 text-sm">
					{#each lastQuarter.lines as line, index (index)}
						<li>{line.text}</li>
					{/each}
				</ul>
			{:else}
				<p class="mt-2 text-sm text-muted">
					Votre carrière commence. Préparez votre premier trimestre dans l’agenda.
				</p>
			{/if}
		</section>
	</div>
{/if}
