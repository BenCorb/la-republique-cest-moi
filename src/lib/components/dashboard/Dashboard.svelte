<script lang="ts">
	import {
		Activity,
		Briefcase,
		CalendarCheck,
		Flag,
		Gavel,
		IdCard,
		Scale,
		Users
	} from '@lucide/svelte';
	import HelpTip from '#lib/components/common/HelpTip.svelte';
	import ResourceTile from '#lib/components/common/ResourceTile.svelte';
	import StatBar from '#lib/components/common/StatBar.svelte';
	import TierBadge from '#lib/components/common/TierBadge.svelte';
	import TrendsCard from './TrendsCard.svelte';
	import type { GameSession } from '#lib/game/app/session.svelte.ts';

	/**
	 * Tableau de bord (DESIGN.md §4.2, style P3-26) : tuiles de ressources avec
	 * flux prévu et courbe, jauges à paliers, soutiens, justice, dernier
	 * trimestre. Les explications sont repliées derrière « ? ».
	 */
	interface Props {
		session: GameSession;
	}

	let { session }: Props = $props();
	const view = $derived(session.snapshot.view);
	const lastQuarter = $derived(view?.journal[0] ?? null);
	const active = $derived(
		view?.producers.filter((producer) => producer.status === 'active').length ?? 0
	);
	const suspended = $derived(
		view?.producers.filter((producer) => producer.status === 'suspended').length ?? 0
	);
	const trendOf = (id: string) => view?.trends.find((trend) => trend.id === id) ?? null;
	const gaugeTrends = $derived(
		view?.trends.filter((trend) => !view.resources.some((resource) => resource.id === trend.id)) ??
			[]
	);
	const toneColor = {
		good: 'var(--color-positive)',
		neutral: 'var(--color-muted)',
		warning: 'var(--color-warning)',
		danger: 'var(--color-danger)'
	} as const;
</script>

{#snippet title(id: string, text: string, icon: typeof Activity)}
	{@const Icon = icon}
	<h2 {id} class="section-title flex items-center gap-2">
		<Icon class="size-4" aria-hidden="true" />
		{text}
	</h2>
{/snippet}

{#if view}
	<div class="grid gap-4 lg:grid-cols-3">
		{#each view.resources as resource (resource.id)}
			{@const trend = trendOf(resource.id)}
			<section
				class="card"
				aria-label={resource.name}
				data-testid={trend ? `trend-${resource.id}` : undefined}
			>
				<ResourceTile {resource} size="large" {trend} />
			</section>
		{/each}
		<p class="-mt-2 text-xs text-muted lg:col-span-3">
			Le budget politique finance l’organisation ; l’argent personnel reste le vôtre.
		</p>

		<section class="card flex flex-col gap-4" aria-labelledby="sante-title">
			<div class="flex flex-wrap items-center gap-2">
				{@render title('sante-title', 'État personnel', Activity)}
				<HelpTip topic="santé et stress">
					Un trimestre trop chargé fait monter le stress ; un stress élevé use la santé. Le repos et
					les vacances aident à récupérer.
				</HelpTip>
			</div>
			<StatBar name="Santé" gauge={view.health} identity="player.health" scale />
			<StatBar
				name="Stress"
				gauge={view.stress}
				identity="player.stress"
				forecast={view.phase === 'planning' ? view.plan.stressAfter.value : null}
				scale
			/>
		</section>

		<section class="card flex flex-col gap-4" aria-labelledby="justice-title">
			<div class="flex flex-wrap items-center gap-2">
				{@render title('justice-title', 'Exposition et justice', Scale)}
				<HelpTip topic="exposition et justice">
					Vos fonctions et vos campagnes vous mettent en vue ; l’exposition retombe peu à peu. Le
					risque judiciaire vient des faits inscrits au registre : il baisse avec le temps jusqu’à
					la prescription, et l’exposition l’amplifie{view.justice.exposureBonus > 0
						? ` (+ ${view.justice.exposureBonus} aujourd’hui)`
						: ''}. Ce n’est ni une enquête ni une culpabilité.
					{#if view.justice.cases.length > 0}
						Préparez votre défense (agenda, conseil juridique) : elle pèse sur le classement et sur
						le jugement, et s’use avec le temps.
					{/if}
				</HelpTip>
			</div>
			<StatBar
				name="Exposition médiatique"
				gauge={view.justice.exposure}
				identity="player.exposure"
			/>
			<StatBar name="Risque judiciaire" gauge={view.justice.risk} identity="justice.risk" />
			{#if view.justice.cases.some((legalCase) => !legalCase.closed)}
				<StatBar name="Défense" gauge={view.justice.defense} identity="player.defense" />
			{/if}
			{#if view.justice.ineligibleUntil}
				<p class="text-sm font-semibold text-danger" data-testid="ineligible">
					Inéligible jusqu’au {view.justice.ineligibleUntil} : aucune candidature ni fonction.
				</p>
			{/if}
			{#if view.justice.cases.length > 0}
				<ul class="flex flex-col gap-2 text-sm" data-testid="cases">
					{#each view.justice.cases as legalCase (legalCase.key)}
						<li class="flex gap-2 border-t border-line pt-2" class:text-muted={legalCase.closed}>
							<Gavel class="mt-0.5 size-3.5 shrink-0 text-res-justice" aria-hidden="true" />
							<span>
								<span class="font-medium">{legalCase.offense}</span>
								({legalCase.defendant}, révélé au {legalCase.opened}) : {legalCase.status}{legalCase.due
									? `, échéance au ${legalCase.due}`
									: ''}{legalCase.sentence ? ` — ${legalCase.sentence}` : ''}.
							</span>
						</li>
					{/each}
				</ul>
			{/if}
			{#if view.justice.facts.length === 0}
				<p class="text-xs text-muted" data-testid="facts-empty">Aucun fait inscrit au registre.</p>
			{:else}
				<div class="text-sm">
					<table class="w-full text-sm" data-testid="facts">
						<caption class="sr-only">Registre des faits</caption>
						<thead>
							<tr class="text-left text-xs text-muted">
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
					<p class="mt-1 text-xs text-muted">Fonds détournés cumulés : {view.justice.diverted}.</p>
				</div>
			{/if}
		</section>

		<section class="card flex flex-col gap-3" aria-labelledby="soutiens-dash-title">
			{@render title('soutiens-dash-title', 'Soutiens', Users)}
			<StatBar
				name="Popularité"
				gauge={view.supports.popularity}
				identity="popularity"
				size="compact"
			/>
			<ul class="flex flex-col gap-2">
				{#each [...view.supports.electoral, ...view.supports.influence] as group (group.id)}
					<li>
						<StatBar name={group.label} gauge={group.gauge} identity={group.id} size="compact" />
					</li>
				{/each}
			</ul>
		</section>

		<div class="lg:col-span-3">
			<TrendsCard trends={gaugeTrends} />
		</div>

		<section class="card lg:col-span-2" aria-labelledby="last-title">
			{@render title(
				'last-title',
				lastQuarter ? `Dernier trimestre (${lastQuarter.label})` : 'Premier trimestre',
				CalendarCheck
			)}
			{#if lastQuarter}
				<ul class="mt-2 flex flex-col gap-1 text-sm">
					{#each lastQuarter.lines as line, index (index)}
						<li class="flex gap-2">
							<span class="mt-2 size-1.5 shrink-0 rounded-full bg-line" aria-hidden="true"></span>
							{line.text}
						</li>
					{/each}
				</ul>
			{:else}
				<p class="mt-2 text-sm text-muted">
					Votre carrière commence. Préparez votre premier trimestre dans l’agenda.
				</p>
			{/if}
		</section>

		<section class="card flex flex-col gap-3" aria-labelledby="national-title">
			{@render title('national-title', 'Contexte national', Flag)}
			<p class="text-sm">
				Gouvernement : <span class="font-semibold">{view.world.governingParty}</span> · Vous :
				<span class="font-semibold">{view.world.affiliation}</span>
			</p>
			<ul class="flex flex-col gap-1.5 text-sm">
				{#each view.world.indicators as indicator (indicator.id)}
					<li class="flex items-center justify-between gap-2">
						<span>{indicator.name}</span>
						<span class="flex items-center gap-1.5 tabular-nums">
							<TierBadge label={indicator.gauge.label} color={toneColor[indicator.gauge.tone]} />
							<span class="text-xs text-muted">{indicator.gauge.value}</span>
						</span>
					</li>
				{/each}
			</ul>
		</section>

		<section class="card flex flex-col gap-2 lg:col-span-2" aria-labelledby="profil-title">
			{@render title('profil-title', 'Profil', IdCard)}
			<p class="text-sm" data-testid="profile">
				{view.profile.origin} · {view.profile.profession} · {view.profile.family}
			</p>
			<p class="text-sm" data-testid="territory">
				<span class="text-muted">Votre terre d’élection :</span>
				<span class="font-semibold">{view.territory.town}</span>, {view.territory.description.toLocaleLowerCase(
					'fr'
				)} ({view.territory.department}, {view.territory.region}).
			</p>
		</section>

		<section class="card flex flex-col gap-2" aria-labelledby="orga-title">
			{@render title('orga-title', 'Organisation', Briefcase)}
			{#if view.producers.length === 0}
				<p class="text-sm text-muted">Aucune amélioration pour l’instant.</p>
			{:else}
				<p class="text-sm">
					{view.producers.length} amélioration(s) : {active} active(s){suspended > 0
						? `, ${suspended} suspendue(s) faute de trésorerie`
						: ''}.
				</p>
			{/if}
		</section>
	</div>
{/if}
