<script lang="ts">
	import Gauge from '#lib/components/common/Gauge.svelte';
	import SpanSummary from './SpanSummary.svelte';
	import TrendsCard from './TrendsCard.svelte';
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

		<div class="lg:col-span-2">
			<TrendsCard trends={view.trends} />
		</div>

		<section class="card flex flex-col gap-4 lg:col-span-2" aria-labelledby="justice-title">
			<h2 id="justice-title" class="section-title">Exposition et justice</h2>
			<div class="grid gap-4 sm:grid-cols-2">
				<Gauge name="Exposition médiatique" gauge={view.justice.exposure} />
				<Gauge name="Risque judiciaire" gauge={view.justice.risk} />
				{#if view.justice.cases.some((legalCase) => !legalCase.closed)}
					<Gauge name="Défense" gauge={view.justice.defense} />
				{/if}
			</div>
			{#if view.justice.ineligibleUntil}
				<p class="text-sm font-semibold text-danger" data-testid="ineligible">
					Inéligible jusqu’au {view.justice.ineligibleUntil} : aucune candidature ni fonction.
				</p>
			{/if}
			{#if view.justice.cases.length > 0}
				<ul class="flex flex-col gap-2 text-sm" data-testid="cases">
					{#each view.justice.cases as legalCase (legalCase.key)}
						<li class="border-t border-line pt-2" class:text-muted={legalCase.closed}>
							<span class="font-medium">{legalCase.offense}</span>
							({legalCase.defendant}, révélé au {legalCase.opened}) : {legalCase.status}{legalCase.due
								? `, échéance au ${legalCase.due}`
								: ''}{legalCase.sentence ? ` — ${legalCase.sentence}` : ''}.
						</li>
					{/each}
				</ul>
				<p class="text-xs text-muted">
					Préparez votre défense (agenda, conseil juridique) : elle pèse sur le classement et sur le
					jugement, et s’use avec le temps.
				</p>
			{/if}
			<p class="text-xs text-muted">
				Vos fonctions et vos campagnes vous mettent en vue ; l’exposition retombe peu à peu. Le
				risque judiciaire vient des faits inscrits au registre : il baisse avec le temps jusqu’à la
				prescription, et l’exposition l’amplifie{view.justice.exposureBonus > 0
					? ` (+ ${view.justice.exposureBonus} aujourd’hui)`
					: ''}. Ce n’est ni une enquête ni une culpabilité.
			</p>
			{#if view.justice.facts.length === 0}
				<p class="text-sm text-muted" data-testid="facts-empty">Aucun fait inscrit au registre.</p>
			{:else}
				<table class="w-full text-sm" data-testid="facts">
					<caption class="sr-only">Registre des faits</caption>
					<thead>
						<tr class="text-left text-muted">
							<th class="pb-1 font-normal">Date</th>
							<th class="pb-1 font-normal">Fait</th>
							<th class="pb-1 font-normal">Rôle</th>
							<th class="pb-1 text-right font-normal">Risque</th>
						</tr>
					</thead>
					<tbody>
						{#each view.justice.facts as fact (fact.key)}
							<tr class="border-t border-line">
								<td class="py-1.5 tabular-nums">{fact.dateLabel}</td>
								<th scope="row" class="py-1.5 text-left font-medium">
									{fact.offense} <span class="font-normal text-muted">({fact.severity})</span>
								</th>
								<td class="py-1.5">{fact.involvement}</td>
								<td class="py-1.5 text-right tabular-nums">
									{fact.inCase
										? 'en justice'
										: fact.prescribed
											? 'prescrit'
											: `+ ${fact.riskPoints}`}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
				<p class="text-xs text-muted">Fonds détournés cumulés : {view.justice.diverted}.</p>
			{/if}
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
