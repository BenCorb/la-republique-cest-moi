<script lang="ts">
	import { Hammer, ScrollText } from '@lucide/svelte';
	import type { GameSession } from '#lib/game/app/session.svelte.ts';
	import type { PromisesView } from '#lib/game/app/view-model.ts';

	/**
	 * Promesses (P3-04) : engagements possibles pendant une campagne, puis registre
	 * des promesses avec leur état, leur avancement et leur échéance. Engagements et
	 * réformes s'ajoutent au plan du trimestre.
	 */
	interface Props {
		session: GameSession;
		promises: PromisesView;
		accelerating: boolean;
	}

	let { session, promises, accelerating }: Props = $props();
</script>

<section class="card flex flex-col gap-3" aria-labelledby="promesses-title">
	<h2 id="promesses-title" class="section-title flex items-center gap-2">
		<ScrollText class="size-4" aria-hidden="true" /> Promesses
	</h2>
	{#if promises.offers.length > 0}
		<p class="text-xs text-muted">
			Engagements de campagne : {promises.maxPerCampaign} au plus par campagne. Une fois élu, chaque promesse
			devra être réalisée avant son échéance.
		</p>
		<ul class="flex flex-col gap-2">
			{#each promises.offers as offer (offer.promiseId)}
				<li class="rounded bg-sidebar px-3 py-2 text-sm" data-testid="offer-{offer.promiseId}">
					<div class="flex items-baseline justify-between gap-3">
						<span class="font-medium">{offer.label}</span>
						<span class="text-xs text-muted">{offer.theme}</span>
					</div>
					<p class="text-xs text-muted">{offer.description}</p>
					{#if offer.effects.length > 0}
						<p class="text-xs">À l’annonce : {offer.effects.join(' · ')}</p>
					{/if}
					<div class="mt-1 flex flex-wrap items-center justify-end gap-2">
						{#if offer.planned}
							<span class="text-xs text-muted">Engagement prévu ce trimestre.</span>
						{:else}
							{#if offer.reason}
								<span class="text-xs text-warning" id="offer-reason-{offer.promiseId}">
									{offer.reason}
								</span>
							{/if}
							<button
								type="button"
								class="btn-secondary btn-small"
								disabled={!offer.addable || accelerating}
								aria-label="Promettre : {offer.label}"
								aria-describedby={offer.reason ? `offer-reason-${offer.promiseId}` : undefined}
								onclick={() =>
									promises.pledgeActionId &&
									session.controller.addStep({
										kind: 'action',
										id: promises.pledgeActionId,
										target: offer.promiseId
									})}
							>
								S’engager
							</button>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
	{#if promises.pledges.length === 0}
		<p class="text-sm text-muted">
			Aucune promesse pour l’instant. Les engagements se prennent pendant une campagne.
		</p>
	{:else}
		<ul class="flex flex-col gap-2">
			{#each promises.pledges as pledge (pledge.pledgeId)}
				<li class="rounded border border-line p-3 text-sm" data-testid="pledge-{pledge.pledgeId}">
					<div class="flex items-baseline justify-between gap-3">
						<span class="font-medium">{pledge.label}</span>
						<span class="shrink-0 rounded bg-sidebar px-2 py-0.5 text-xs">{pledge.status}</span>
					</div>
					<p class="text-xs text-muted">{pledge.origin}</p>
					{#if pledge.inProgress}
						<div class="mt-1 flex items-center gap-2">
							<progress
								class="h-2 flex-1"
								max="100"
								value={pledge.progress}
								aria-label="Avancement : {pledge.label}"
							></progress>
							<span class="text-xs tabular-nums">{pledge.progress} / 100</span>
						</div>
						{#if pledge.amended}
							<p class="text-xs text-warning">Compromis accepté : au mieux partiellement tenue.</p>
						{/if}
					{/if}
					<p class="text-xs">{pledge.detail}</p>
					{#if pledge.inProgress && promises.prepareActionId}
						<div class="mt-1 flex flex-wrap items-center justify-end gap-2">
							{#if pledge.preparePlanned}
								<span class="text-xs text-muted">Réforme préparée ce trimestre.</span>
							{/if}
							{#if pledge.prepareReason}
								<span class="text-xs text-warning" id="prepare-reason-{pledge.pledgeId}">
									{pledge.prepareReason}
								</span>
							{/if}
							<button
								type="button"
								class="btn-secondary btn-small"
								disabled={!pledge.prepareAddable || accelerating}
								aria-label="Préparer la réforme : {pledge.label}"
								aria-describedby={pledge.prepareReason
									? `prepare-reason-${pledge.pledgeId}`
									: undefined}
								onclick={() =>
									promises.prepareActionId &&
									session.controller.addStep({
										kind: 'action',
										id: promises.prepareActionId,
										target: pledge.pledgeId
									})}
							>
								<Hammer class="size-3.5" aria-hidden="true" /> Préparer la réforme
							</button>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>
