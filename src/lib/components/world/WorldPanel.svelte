<script lang="ts">
	import { Crown, LogOut, Plus } from '@lucide/svelte';
	import StatBar from '#lib/components/common/StatBar.svelte';
	import type { GameSession } from '#lib/game/app/session.svelte.ts';
	import InstitutionsCard from './InstitutionsCard.svelte';

	/**
	 * Monde politique (P2-01) : contexte national, partis et adhésion du joueur.
	 * L'adhésion et le départ s'ajoutent au plan du trimestre, comme une action.
	 */
	interface Props {
		session: GameSession;
	}

	let { session }: Props = $props();
	const view = $derived(session.snapshot.view);
	const world = $derived(view?.world ?? null);
	const accelerating = $derived(session.snapshot.acceleration?.running === true);
</script>

{#if world}
	<div class="flex flex-col gap-5">
		<section class="card" aria-labelledby="contexte-title">
			<h2 id="contexte-title" class="section-title">Contexte national</h2>
			<p class="mt-2 text-sm">
				Gouvernement conduit par <span class="font-semibold">{world.governingParty}</span>.
			</p>
			<p class="mt-1 text-sm" data-testid="era">
				Époque : <span class="font-semibold">{world.era.label}</span>
				<span class="text-muted">— {world.era.description}</span>
			</p>
			<div class="mt-3 grid gap-4 md:grid-cols-3">
				{#each world.indicators as indicator (indicator.id)}
					<StatBar name={indicator.name} gauge={indicator.gauge} />
				{/each}
			</div>
		</section>

		<section class="card" aria-labelledby="situation-politique-title">
			<h2 id="situation-politique-title" class="section-title">Votre étiquette</h2>
			<p class="mt-2 text-sm" data-testid="affiliation">{world.affiliation}</p>
			{#if world.leave}
				<div class="mt-2 flex flex-wrap items-center gap-3">
					<button
						type="button"
						class="btn-secondary btn-small"
						disabled={!world.leave.addable || accelerating}
						aria-describedby={world.leave.reason ? 'leave-reason' : undefined}
						onclick={() =>
							world.leave &&
							session.controller.addStep({ kind: 'action', id: world.leave.actionId })}
					>
						<LogOut class="size-3.5" aria-hidden="true" /> Prévoir de rendre sa carte
					</button>
					{#if world.leave.planned}
						<span class="text-xs text-muted">Départ prévu ce trimestre.</span>
					{:else if world.leave.reason}
						<span class="text-xs text-warning" id="leave-reason">{world.leave.reason}</span>
					{/if}
				</div>
			{:else if world.joinActionId}
				<p class="mt-1 text-xs text-muted">
					Adhérer : {world.joinTimeCost} pts de temps{world.joinCosts.length > 0
						? `, ${world.joinCosts.join(', ')}`
						: ''}. L’adhésion s’ajoute au plan du trimestre.
				</p>
			{/if}
		</section>

		<section aria-labelledby="partis-title">
			<h2 id="partis-title" class="section-title">Partis et intentions de vote</h2>
			<ul class="mt-3 grid gap-3 xl:grid-cols-2">
				{#each world.parties as party (party.id)}
					<li class="card flex flex-col gap-2" data-testid="party-{party.id}">
						<div class="flex items-start justify-between gap-3">
							<div>
								<h3 class="font-serif text-base">
									{party.name} <span class="text-sm text-muted">({party.acronym})</span>
								</h3>
								<p class="text-xs text-muted">{party.family}</p>
							</div>
							<span
								class="shrink-0 rounded bg-sidebar px-2 py-0.5 text-sm font-semibold tabular-nums"
							>
								≈ {party.share} %
							</span>
						</div>
						<div
							class="h-1.5 rounded-full bg-sidebar"
							role="meter"
							aria-label="Intentions de vote, {party.name}"
							aria-valuemin={0}
							aria-valuemax={100}
							aria-valuenow={party.share}
							aria-valuetext="environ {party.share} %"
						>
							<div class="h-1.5 rounded-full bg-primary" style:width="{party.share}%"></div>
						</div>
						<p class="text-sm">{party.description}</p>
						<p class="text-sm">Direction : <span class="font-medium">{party.leader}</span></p>
						<p class="text-xs text-muted">{party.positions.join(' · ')}</p>
						<div class="mt-auto flex flex-wrap items-center justify-end gap-2">
							{#if party.governing}
								<span
									class="mr-auto inline-flex items-center gap-1 text-xs font-semibold text-primary"
								>
									<Crown class="size-3.5" aria-hidden="true" /> Au gouvernement
								</span>
							{/if}
							{#if party.member}
								<span class="text-xs font-semibold">Votre parti</span>
							{:else if party.joinPlanned}
								<span class="text-xs text-muted">Adhésion prévue ce trimestre</span>
							{:else if world.joinActionId && !world.leave}
								{#if party.joinReason}
									<span class="text-xs text-warning" id="join-reason-{party.id}">
										{party.joinReason}
									</span>
								{/if}
								<button
									type="button"
									class="btn-secondary btn-small"
									disabled={!party.joinable || accelerating}
									aria-label="Prévoir l’adhésion au {party.name}"
									aria-describedby={party.joinReason ? `join-reason-${party.id}` : undefined}
									onclick={() =>
										world.joinActionId &&
										session.controller.addStep({
											kind: 'action',
											id: world.joinActionId,
											target: party.id
										})}
								>
									<Plus class="size-3.5" aria-hidden="true" /> Adhérer
								</button>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		</section>

		<InstitutionsCard {session} institutions={world.institutions} {accelerating} />
	</div>
{/if}
