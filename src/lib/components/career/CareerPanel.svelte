<script lang="ts">
	import { CalendarClock, LogOut, Vote } from '@lucide/svelte';
	import type { GameSession } from '#lib/game/app/session.svelte.ts';
	import SupportsCard from './SupportsCard.svelte';

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
						<li class="rounded border border-line p-3" data-testid="mandate-{mandate.instanceId}">
							<div class="flex items-start justify-between gap-3">
								<h3 class="font-serif text-base">{mandate.label}</h3>
								<span class="shrink-0 rounded bg-sidebar px-2 py-0.5 text-xs tabular-nums">
									{mandate.timePerTurn} pts / trimestre
								</span>
							</div>
							<p class="text-xs text-muted">Depuis le {mandate.since} · {mandate.ends}</p>
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
				<p>Cumul : {career.maxMandates} mandats au plus.</p>
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
					</li>
				{/each}
			</ul>
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
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>
{/if}
