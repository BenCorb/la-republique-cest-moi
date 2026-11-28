<script lang="ts">
	import { Megaphone, Minus, Plus } from '@lucide/svelte';
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

	const statusClass = {
		active: 'border-positive text-positive',
		pending: 'border-primary text-primary',
		suspended: 'border-danger text-danger'
	} as const;
</script>

{#if view}
	<div class="grid gap-5">
		<div class="flex flex-col gap-6">
			<!-- Base militante (P3-19) : effectif organique, ni acheté ni affecté tâche par tâche. -->
			<section
				class="card flex flex-col gap-3"
				aria-labelledby="activists-title"
				data-testid="activists"
			>
				<div class="flex flex-wrap items-baseline justify-between gap-2">
					<h2 id="activists-title" class="section-title flex items-center gap-2">
						<Megaphone class="size-4" aria-hidden="true" /> Base militante
					</h2>
					<span
						class="rounded border border-primary px-2 py-0.5 text-xs font-semibold text-primary"
					>
						{view.activists.tierLabel}
					</span>
				</div>
				<p class="flex flex-wrap items-baseline gap-x-3">
					<span class="font-display text-3xl font-bold tabular-nums" data-testid="activists-count">
						{view.activists.countLabel}
					</span>
					<span class="text-sm text-muted">
						sur {view.activists.capacity} places d’accueil
						{#if view.activists.next}
							· encore {view.activists.next.missing} pour « {view.activists.next.label} »
						{/if}
					</span>
				</p>
				<div
					class="h-2 overflow-hidden rounded-full bg-sidebar"
					role="meter"
					aria-label="Remplissage de la capacité d’accueil"
					aria-valuemin="0"
					aria-valuemax="100"
					aria-valuenow={view.activists.fillPercent}
				>
					<div
						class="h-full rounded-full bg-primary"
						style:width="{view.activists.fillPercent}%"
					></div>
				</div>
				<p class="text-xs text-muted">Capacité : {view.activists.capacityParts.join(' · ')}</p>
				<ul class="flex flex-col gap-0.5 text-sm">
					{#each view.activists.perks as perk (perk)}
						<li>{perk}</li>
					{/each}
				</ul>
				{#if view.activists.lastMove}
					<p class="text-xs text-muted">{view.activists.lastMove}</p>
				{/if}
				<details class="text-xs" data-testid="activist-levers">
					<summary class="cursor-pointer text-primary">Faire grandir la base militante</summary>
					<div class="mt-2 flex flex-col gap-2">
						<div>
							<h3 class="font-semibold">Ce qui fait venir des militants</h3>
							<ul class="mt-1 flex flex-col gap-0.5">
								{#each view.activists.levers.arrivals as lever (lever.text)}
									<li class={lever.sense === 'cost' ? 'text-warning' : ''}>{lever.text}</li>
								{/each}
							</ul>
						</div>
						<div>
							<h3 class="font-semibold">Ce qui les fait partir</h3>
							<ul class="mt-1 flex flex-col gap-0.5">
								{#each view.activists.levers.departures as lever (lever.text)}
									<li class={lever.sense === 'cost' ? 'text-warning' : ''}>{lever.text}</li>
								{/each}
							</ul>
						</div>
						<div>
							<h3 class="font-semibold">Augmenter durablement l’accueil</h3>
							<ul class="mt-1 flex flex-col gap-0.5">
								{#each view.activists.levers.capacity as option (option)}
									<li>{option}</li>
								{/each}
							</ul>
						</div>
					</div>
				</details>
			</section>

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
											disabled={group.release.step === null}
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
								{#if upgrade.activists}
									<li data-testid="upgrade-activists-{upgrade.id}">{upgrade.activists}</li>
								{/if}
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
									disabled={!upgrade.addable}
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
	</div>
{/if}
