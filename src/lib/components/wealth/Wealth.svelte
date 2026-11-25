<script lang="ts">
	import { Minus, Plus } from '@lucide/svelte';
	import PlanPanel from '#lib/components/agenda/PlanPanel.svelte';
	import type { GameSession } from '#lib/game/app/session.svelte.ts';

	/**
	 * Patrimoine (DESIGN.md §4.6, P3-02) : valeur nette séparée des liquidités, train
	 * de vie, biens possédés avec valeur, revenu et revente, biens achetables. Tout
	 * est payé sur l'argent personnel, jamais sur le budget politique.
	 */
	interface Props {
		session: GameSession;
	}

	let { session }: Props = $props();
	const view = $derived(session.snapshot.view);
	const wealth = $derived(view?.wealth ?? null);
	const accelerating = $derived(session.snapshot.acceleration?.running === true);
</script>

{#if view && wealth}
	<div class="grid gap-5 xl:grid-cols-[1fr_minmax(20rem,26rem)]">
		<div class="flex flex-col gap-6">
			<section class="card" aria-labelledby="networth-title">
				<h2 id="networth-title" class="section-title">Valeur nette</h2>
				<dl class="mt-3 grid grid-cols-3 gap-3 text-sm">
					<div>
						<dt class="text-muted">Argent personnel</dt>
						<dd class="font-semibold tabular-nums">{wealth.cash}</dd>
					</div>
					<div>
						<dt class="text-muted">Biens</dt>
						<dd class="font-semibold tabular-nums">{wealth.assetsValue}</dd>
					</div>
					<div>
						<dt class="text-muted">Total</dt>
						<dd class="font-semibold tabular-nums" data-testid="net-worth">{wealth.netWorth}</dd>
					</div>
				</dl>
				<p class="mt-2 text-xs text-muted">
					Le budget politique n’en fait pas partie. La valeur des biens évolue chaque trimestre avec
					la conjoncture et un peu de hasard.
				</p>
			</section>

			<section class="card flex flex-col gap-2" aria-labelledby="lifestyle-title">
				<h2 id="lifestyle-title" class="section-title">Train de vie</h2>
				<p class="text-sm">
					<span class="font-medium" data-testid="lifestyle">{wealth.lifestyle.label}</span>
					— {wealth.lifestyle.cost} par trimestre.
				</p>
				<p class="text-sm text-muted">{wealth.lifestyle.description}</p>
				<p class="text-xs text-muted">
					Payé avant tout le reste sur l’argent personnel. Faute de fonds, retour au train de vie le
					plus sobre, avec du stress en prime.
				</p>
				<div class="flex flex-wrap gap-2">
					{#each wealth.lifestyleActions as action (action.id)}
						{#if !action.outOfReach}
							<button
								type="button"
								class="btn-secondary btn-small"
								disabled={!action.addable || accelerating}
								title={action.reason ?? action.description}
								onclick={() => session.controller.addStep({ kind: 'action', id: action.id })}
							>
								{action.label}
							</button>
						{/if}
					{/each}
				</div>
			</section>

			<section aria-labelledby="assets-title">
				<h2 id="assets-title" class="section-title">Vos biens</h2>
				{#if wealth.owned.length === 0}
					<p class="mt-2 text-sm text-muted">Aucun bien pour l’instant.</p>
				{:else}
					<ul class="mt-3 grid gap-2" data-testid="assets">
						{#each wealth.owned as asset (asset.instanceId)}
							<li class="card flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
								<span class="font-medium">{asset.label}</span>
								<span class="text-sm tabular-nums">Valeur : {asset.value}</span>
								<span class="text-sm text-muted">
									{asset.lost
										? 'Perte totale'
										: asset.income === null
											? 'Rapporte à partir du trimestre prochain'
											: `Revenu : ${asset.income} par trimestre`}
								</span>
								<span class="text-xs text-muted">acquis au {asset.acquired}</span>
								<div class="ml-auto flex items-center gap-2">
									{#if asset.sale.reason}
										<span class="text-xs text-muted">{asset.sale.reason}</span>
									{/if}
									<button
										type="button"
										class="btn-secondary btn-small"
										disabled={asset.sale.step === null || accelerating}
										aria-label="Vendre : {asset.label}, pour {asset.proceeds}"
										onclick={() => asset.sale.step && session.controller.addStep(asset.sale.step)}
									>
										<Minus class="size-3.5" aria-hidden="true" /> Vendre ({asset.proceeds})
									</button>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section aria-labelledby="offers-title">
				<h2 id="offers-title" class="section-title">Investir</h2>
				<ul class="mt-3 grid gap-3 2xl:grid-cols-2">
					{#each wealth.offers as offer (offer.id)}
						<li class="card flex flex-col gap-2" data-testid="offer-{offer.id}">
							<h3 class="font-serif text-base">{offer.label}</h3>
							<p class="text-sm text-muted">{offer.description}</p>
							<ul class="text-sm">
								<li>Prix : {offer.costs.join(', ')}</li>
								<li>
									Charges par trimestre : {offer.upkeep.length > 0
										? offer.upkeep.join(', ')
										: 'aucune'}
								</li>
								{#each offer.effects as effect (effect)}
									<li>{effect}</li>
								{/each}
								<li>Possédés : {offer.owned} / {offer.maxOwned}</li>
							</ul>
							<div class="mt-auto flex flex-col gap-2">
								{#if offer.reason}
									<p class="text-xs text-warning" id="reason-{offer.id}">{offer.reason}</p>
								{/if}
								<button
									type="button"
									class="btn-secondary btn-small self-end"
									disabled={!offer.addable || accelerating}
									aria-label="Planifier l’achat « {offer.label} »"
									aria-describedby={offer.reason ? `reason-${offer.id}` : undefined}
									onclick={() => session.controller.addStep({ kind: 'purchase', id: offer.id })}
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
