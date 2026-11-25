<script lang="ts">
	import { Minus, Plus } from '@lucide/svelte';
	import PlanPanel from '#lib/components/agenda/PlanPanel.svelte';
	import type { GameSession } from '#lib/game/app/session.svelte.ts';

	/**
	 * Organisation (DESIGN.md §4.5) : éléments possédés regroupés par type, avec leur
	 * statut, leurs charges et leur production cumulées ce trimestre, et le départ d'un
	 * exemplaire ; améliorations achetables. Un achat rejoint le plan et produit au
	 * trimestre suivant ; un départ prend effet dès ce trimestre.
	 */
	interface Props {
		session: GameSession;
	}

	let { session }: Props = $props();
	const view = $derived(session.snapshot.view);
	const accelerating = $derived(session.snapshot.acceleration?.running === true);

	const statusClass = {
		active: 'border-positive text-positive',
		pending: 'border-primary text-primary',
		suspended: 'border-danger text-danger'
	} as const;
</script>

{#if view}
	<div class="grid gap-5 xl:grid-cols-[1fr_minmax(20rem,26rem)]">
		<div class="flex flex-col gap-6">
			<section aria-labelledby="producers-title">
				<h2 id="producers-title" class="section-title">Votre organisation</h2>
				{#if view.organisation.length === 0}
					<p class="mt-2 text-sm text-muted">
						Personne ne travaille encore pour vous. Les achats ci-dessous produisent à partir du
						trimestre suivant.
					</p>
				{:else}
					<ul class="mt-3 grid gap-2">
						{#each view.organisation as group (group.upgradeId)}
							<li class="card flex flex-col gap-2 py-3" data-testid="group-{group.upgradeId}">
								<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
									<span class="font-medium">
										{group.label}{group.owned + group.pending > 1
											? ` × ${group.owned + group.pending - group.releasesPlanned}`
											: ''}
									</span>
									{#each [['active', group.active, 'Actif ce trimestre'], ['pending', group.pending, 'Actif à partir du trimestre prochain'], ['suspended', group.suspended, 'Suspendu : charges non couvertes']] as const as [status, count, text] (status)}
										{#if count > 0}
											<span
												class="rounded border px-2 py-0.5 text-xs font-medium {statusClass[status]}"
											>
												{text}{group.owned + group.pending > 1 ? ` × ${count}` : ''}
											</span>
										{/if}
									{/each}
								</div>
								<p class="text-sm text-muted">
									{[
										...group.upkeep.map((item) => `Charges : ${item}`),
										...group.production.map((item) => `Production : ${item}`)
									].join(' · ') || 'Aucune charge ni production ce trimestre.'}
								</p>
								{#if group.release}
									<div class="flex flex-wrap items-center justify-end gap-2">
										{#if group.releasesPlanned > 0}
											<span class="text-xs text-muted">
												{group.releasesPlanned} départ{group.releasesPlanned > 1 ? 's' : ''} prévu{group.releasesPlanned >
												1
													? 's'
													: ''} ce trimestre (annulable dans le plan).
											</span>
										{/if}
										{#if group.release.reason}
											<span class="text-xs text-warning">{group.release.reason}</span>
										{:else if group.releaseEffects.length > 0}
											<span class="text-xs text-muted">
												Au départ : {group.releaseEffects.join(', ')}
											</span>
										{/if}
										<button
											type="button"
											class="btn-secondary btn-small"
											disabled={group.release.step === null || accelerating}
											aria-label="Prévoir un départ : {group.label}"
											onclick={() =>
												group.release?.step && session.controller.addStep(group.release.step)}
										>
											<Minus class="size-3.5" aria-hidden="true" /> Se séparer d’un exemplaire
										</button>
									</div>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section aria-labelledby="upgrades-title">
				<h2 id="upgrades-title" class="section-title">Développer l’organisation</h2>
				<ul class="mt-3 grid gap-3 2xl:grid-cols-2">
					{#each view.upgrades as upgrade (upgrade.id)}
						<li class="card flex flex-col gap-2" data-testid="upgrade-{upgrade.id}">
							<div class="flex items-start justify-between gap-3">
								<h3 class="font-serif text-base">{upgrade.label}</h3>
								<span class="shrink-0 text-xs text-muted">{upgrade.family}</span>
							</div>
							<p class="text-sm text-muted">{upgrade.description}</p>
							<ul class="text-sm">
								<li>Financé par : {upgrade.treasury}</li>
								<li>Temps : {upgrade.timeCost} pts</li>
								<li>Prix : {upgrade.costs.length > 0 ? upgrade.costs.join(', ') : 'aucun'}</li>
								<li>
									Charges par trimestre : {upgrade.upkeep.length > 0
										? upgrade.upkeep.join(', ')
										: 'aucune'}
								</li>
								<li>Production par trimestre : {upgrade.effects.join(', ')}</li>
								<li>Possédés : {upgrade.owned} / {upgrade.maxOwned}</li>
							</ul>
							<div class="mt-auto flex flex-col gap-2">
								{#if upgrade.reason}
									<p class="text-xs text-warning" id="reason-{upgrade.id}">{upgrade.reason}</p>
								{:else}
									<p class="text-xs text-muted">Actif à partir du trimestre prochain.</p>
								{/if}
								<button
									type="button"
									class="btn-secondary btn-small self-end"
									disabled={!upgrade.addable || accelerating}
									aria-label="Planifier l’achat « {upgrade.label} »"
									aria-describedby={upgrade.reason ? `reason-${upgrade.id}` : undefined}
									onclick={() => session.controller.addStep({ kind: 'purchase', id: upgrade.id })}
								>
									<Plus class="size-3.5" aria-hidden="true" /> Planifier l’achat
								</button>
							</div>
						</li>
					{/each}
				</ul>
			</section>
		</div>
		<div class="xl:sticky xl:top-0 xl:self-start">
			<PlanPanel {session} />
		</div>
	</div>
{/if}
