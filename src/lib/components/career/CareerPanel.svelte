<script lang="ts">
	import BallotReport from './BallotReport.svelte';
	import { CalendarClock, LogOut, Megaphone, Vote } from '@lucide/svelte';
	import type { GameSession } from '#lib/game/app/session.svelte.ts';
	import SupportsCard from './SupportsCard.svelte';
	import PromisesCard from './PromisesCard.svelte';
	import MediaCard from './MediaCard.svelte';

	/**
	 * Carrière (P2-02) : mandats en cours et leur coût en temps, règles du cumul,
	 * calendrier électoral et derniers résultats. La démission s'ajoute au plan.
	 */
	interface Props {
		session: GameSession;
	}

	let { session }: Props = $props();
	const career = $derived(session.snapshot.view?.career ?? null);
	const supports = $derived(session.snapshot.view?.supports ?? null);
	const accelerating = $derived(session.snapshot.acceleration?.running === true);
</script>

{#if career}
	<div class="grid gap-5 xl:grid-cols-2">
		{#if supports}
			<SupportsCard {supports} />
		{/if}
		<section class="card flex flex-col gap-3" aria-labelledby="mandats-title">
			<h2 id="mandats-title" class="section-title">Mandats</h2>
			<p class="text-sm" data-testid="main-function">
				Fonction principale : <span class="font-semibold">{career.mainFunction}</span>
			</p>
			{#if career.mandates.length === 0}
				<p class="text-sm text-muted">
					Aucun mandat pour l’instant. Les sièges se libèrent parfois en cours de route ; les
					candidatures aux élections viendront ensuite.
				</p>
			{:else}
				<p class="text-xs text-muted">
					Vos mandats réservent {career.reservedTime} points de temps par trimestre.
				</p>
				<ul class="flex flex-col gap-3">
					{#each career.mandates as mandate (mandate.instanceId)}
						<li
							class="rounded border border-line p-3 {mandate.within ? 'ml-6 border-dashed' : ''}"
							data-testid="mandate-{mandate.instanceId}"
						>
							<div class="flex items-start justify-between gap-3">
								<h3 class="font-serif text-base">{mandate.label}</h3>
								<span class="shrink-0 rounded bg-sidebar px-2 py-0.5 text-xs tabular-nums">
									{mandate.timePerTurn} pts / trimestre
								</span>
							</div>
							<p class="text-xs text-muted">Depuis le {mandate.since} · {mandate.ends}</p>
							{#if mandate.within}
								<p class="text-xs text-muted">
									Exercée au sein du mandat « {mandate.within} » : ne compte pas à part dans le cumul.
								</p>
							{/if}
							<ul class="mt-1 text-sm">
								{#each mandate.income as income (income)}
									<li>Chaque trimestre : {income}</li>
								{/each}
								{#if mandate.stressPerTurn > 0}
									<li>Stress + {mandate.stressPerTurn} par trimestre</li>
								{/if}
							</ul>
							{#if career.resignActionId}
								<div class="mt-2 flex flex-wrap items-center justify-end gap-2">
									{#if mandate.resignPlanned}
										<span class="text-xs text-muted">Démission prévue ce trimestre.</span>
									{:else}
										{#if mandate.resignReason}
											<span class="text-xs text-warning" id="resign-{mandate.instanceId}">
												{mandate.resignReason}
											</span>
										{/if}
										<button
											type="button"
											class="btn-secondary btn-small"
											disabled={!mandate.resignable || accelerating}
											aria-label="Prévoir la démission : {mandate.label}"
											aria-describedby={mandate.resignReason
												? `resign-${mandate.instanceId}`
												: undefined}
											onclick={() =>
												career.resignActionId &&
												session.controller.addStep({
													kind: 'action',
													id: career.resignActionId,
													target: mandate.instanceId
												})}
										>
											<LogOut class="size-3.5" aria-hidden="true" /> Démissionner
										</button>
									{/if}
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
			<div class="text-xs text-muted">
				<p data-testid="cumul">
					Cumul : {career.cumulCount} mandat{career.cumulCount > 1 ? 's' : ''} sur {career.maxMandates}
					au plus.
				</p>
				{#if career.incompatibilities.length > 0}
					<p>Incompatibles : {career.incompatibilities.join(' ; ')}.</p>
				{/if}
				{#if career.prerequisites.length > 0}
					<p>Prérequis : {career.prerequisites.join(' ; ')}.</p>
				{/if}
			</div>
			{#if career.pastMandates.length > 0}
				<div>
					<h3 class="text-xs font-semibold text-muted uppercase">Mandats passés</h3>
					<ul class="mt-1 text-sm">
						{#each career.pastMandates as past, index (index)}
							<li>{past.label} — {past.period}</li>
						{/each}
					</ul>
				</div>
			{/if}
		</section>

		<PromisesCard {session} promises={career.promises} {accelerating} />

		<MediaCard {session} media={career.media} {accelerating} />

		<section class="card flex flex-col gap-3" aria-labelledby="calendrier-title">
			<h2 id="calendrier-title" class="section-title flex items-center gap-2">
				<CalendarClock class="size-4" aria-hidden="true" /> Calendrier électoral
			</h2>
			<ul class="flex flex-col gap-2">
				{#each career.calendar as ballot (ballot.ballotId)}
					<li class="rounded bg-sidebar px-3 py-2 text-sm" data-testid="ballot-{ballot.ballotId}">
						<div class="flex items-baseline justify-between gap-3">
							<span class="font-medium">
								{ballot.label}{ballot.early ? ' (anticipées)' : ''}
							</span>
							<span class="tabular-nums">{ballot.dateLabel}</span>
						</div>
						<p class="text-xs text-muted">
							{ballot.turnsLeft === 0
								? 'Scrutin à la fin de ce trimestre'
								: `Dans ${ballot.turnsLeft} trimestre${ballot.turnsLeft > 1 ? 's' : ''}`} ·
							{ballot.filing}{ballot.endsMandate ? ' · Votre mandat arrive à son terme' : ''}
						</p>
						<p class="text-xs">Enjeu : {ballot.stake}</p>
						{#if ballot.refund}
							<p class="text-xs text-muted">{ballot.refund}</p>
						{/if}
						{#if ballot.campaign}
							<div
								class="mt-2 rounded bg-surface p-2"
								data-testid="campaign-{ballot.campaign.campaignId}"
							>
								<p class="text-xs font-semibold">
									Candidature déposée · {ballot.campaign.investiture}
								</p>
								<p class="text-xs text-muted">
									{ballot.campaign.declared} · Préparation : {ballot.campaign.preparation}
								</p>
								<p class="text-xs" data-testid="opponent-{ballot.campaign.campaignId}">
									Adversaire : {ballot.campaign.opponent ?? 'connu au prochain trimestre'}
								</p>
								{#if ballot.campaign.poll}
									<p class="text-xs" data-testid="poll-{ballot.campaign.campaignId}">
										Sondage : entre {ballot.campaign.poll.min} % et {ballot.campaign.poll.max} % face
										à l’adversaire principal. Un sondage n’est pas un résultat.
									</p>
								{/if}
								{#if ballot.campaign.advance}
									<p class="text-xs" data-testid="advance-{ballot.campaign.campaignId}">
										{ballot.campaign.advance}
									</p>
								{/if}
								{#if ballot.campaign.advanceOffers.length > 0}
									<div
										class="mt-1 flex flex-col gap-1"
										data-testid="advance-offers-{ballot.campaign.campaignId}"
									>
										<p class="text-xs text-muted">
											Avancer des fonds personnels (une avance par campagne, rendue à partir d’un
											score honorable, perdue sinon) :
										</p>
										<div class="flex flex-wrap gap-1">
											{#each ballot.campaign.advanceOffers as offer (offer.actionId)}
												{@const campaignId = ballot.campaign.campaignId}
												{#if offer.planned}
													<span class="text-xs text-muted">
														{offer.label} : prévue ce trimestre.
													</span>
												{:else}
													<button
														type="button"
														class="btn-secondary btn-small"
														disabled={!offer.addable || accelerating}
														title={offer.reason ?? offer.label}
														aria-label="{offer.label} ({ballot.label})"
														onclick={() =>
															session.controller.addStep({
																kind: 'action',
																id: offer.actionId,
																target: campaignId
															})}
													>
														{offer.format} · {offer.label}
													</button>
												{/if}
											{/each}
										</div>
										{#each ballot.campaign.advanceOffers.filter((offer) => offer.reason && !offer.planned) as offer (offer.actionId)}
											<p class="text-xs text-muted">{offer.format} : {offer.reason}</p>
										{/each}
									</div>
								{/if}
							</div>
						{:else if career.declareActionId}
							<div class="mt-2 flex flex-wrap items-center justify-end gap-2">
								{#if ballot.candidacyPlanned}
									<span class="text-xs text-muted">Candidature prévue ce trimestre.</span>
								{:else}
									{#if ballot.candidacyReason}
										<span class="text-xs text-warning" id="candidacy-{ballot.ballotId}">
											{ballot.candidacyReason}
										</span>
									{/if}
									<button
										type="button"
										class="btn-secondary btn-small"
										disabled={!ballot.candidacyAddable || accelerating}
										aria-label="Prévoir la candidature : {ballot.label} du {ballot.dateLabel}"
										aria-describedby={ballot.candidacyReason
											? `candidacy-${ballot.ballotId}`
											: undefined}
										onclick={() =>
											career.declareActionId &&
											session.controller.addStep({
												kind: 'action',
												id: career.declareActionId,
												target: ballot.ballotId
											})}
									>
										<Megaphone class="size-3.5" aria-hidden="true" /> Se présenter
									</button>
									{#if ballot.investiture}
										{@const investiture = ballot.investiture}
										<div class="flex w-full flex-col items-end gap-1" data-testid="investiture">
											<p class="text-xs">
												<span class="font-semibold">{investiture.appraisal}</span>
												<span class="text-muted">
													— {investiture.factors
														.map((factor) => `${factor.favorable ? '+' : '−'} ${factor.label}`)
														.join(' · ')}
												</span>
											</p>
											{#if investiture.status}
												<p class="text-xs text-muted">{investiture.status}</p>
											{:else}
												<button
													type="button"
													class="btn-secondary btn-small"
													disabled={!investiture.addable || investiture.planned || accelerating}
													title={investiture.reason ?? undefined}
													aria-label="Demander l’investiture : {ballot.label} du {ballot.dateLabel}"
													onclick={() =>
														session.controller.addStep({
															kind: 'action',
															id: investiture.actionId,
															target: ballot.ballotId
														})}
												>
													{investiture.planned ? 'Investiture demandée' : 'Demander l’investiture'}
												</button>
											{/if}
										</div>
									{/if}
									{#if ballot.listPlace}
										{@const place = ballot.listPlace}
										<button
											type="button"
											class="btn-secondary btn-small"
											disabled={!place.addable || place.planned || accelerating}
											title={place.reason ?? undefined}
											aria-label="Demander une place sur une liste : {ballot.label} du {ballot.dateLabel}"
											onclick={() =>
												session.controller.addStep({
													kind: 'action',
													id: place.actionId,
													target: ballot.ballotId
												})}
										>
											{place.planned ? 'Place demandée' : 'Demander une place sur une liste'}
										</button>
									{/if}
								{/if}
							</div>
						{/if}
					</li>
				{/each}
			</ul>
			<p class="text-xs text-muted">
				Se déclarer tôt laisse le temps de préparer la campagne, mais expose plus longtemps aux
				coups durs ; se déclarer tard limite la préparation. Porte-à-porte et meetings de campagne
				s’ajoutent depuis l’agenda.
			</p>
			{#if career.pastCampaigns.length > 0}
				<h3 class="section-title mt-2">Vos campagnes</h3>
				<ul class="flex flex-col gap-1 text-sm">
					{#each career.pastCampaigns as campaign (campaign.campaignId)}
						<li>
							<span class="font-medium">{campaign.label}, {campaign.dateLabel}</span> — {campaign.outcome}
							{#if campaign.advance}
								<span class="text-xs text-muted"> · {campaign.advance}</span>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
			<h3 class="section-title mt-2 flex items-center gap-2">
				<Vote class="size-4" aria-hidden="true" /> Derniers résultats
			</h3>
			{#if career.results.length === 0}
				<p class="text-sm text-muted">Aucun scrutin depuis le début de votre carrière.</p>
			{:else}
				<ul class="flex flex-col gap-2 text-sm">
					{#each career.results as result (result.ballotId)}
						<li>
							<span class="font-medium">
								{result.label}{result.early ? ' (anticipées)' : ''}, {result.dateLabel}
							</span>
							— en tête : {result.winner}
							<span class="block text-xs text-muted">{result.shares}</span>
							{#if result.report}
								<details class="mt-1">
									<summary class="cursor-pointer text-xs text-primary">
										Procès-verbal — {result.report.title}
									</summary>
									<div class="mt-1"><BallotReport report={result.report} /></div>
								</details>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>
{/if}
