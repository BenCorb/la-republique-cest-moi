<script lang="ts">
	import { Mic } from '@lucide/svelte';
	import type { GameSession } from '#lib/game/app/session.svelte.ts';
	import type { MediaView } from '#lib/game/app/view-model.ts';

	/**
	 * Médias (P3-03) : ligne éditoriale, audience et relation de chaque média,
	 * interviews et déjeuners ajoutés au plan du trimestre. Les relations sont
	 * données en clair, sans chiffre.
	 */
	interface Props {
		session: GameSession;
		media: MediaView;
	}

	let { session, media }: Props = $props();
</script>

<section class="card flex flex-col gap-3" aria-labelledby="medias-title">
	<h2 id="medias-title" class="section-title flex items-center gap-2">
		<Mic class="size-4" aria-hidden="true" /> Médias
	</h2>
	<p class="text-xs text-muted">
		La presse régionale vous suit dès le début ; les médias nationaux, seulement quand votre
		exposition atteint {media.nationalExposure}. Les articles paraissent à la fin du trimestre.
	</p>
	<ul class="flex flex-col gap-2">
		{#each media.outlets as outlet (outlet.mediaId)}
			<li class="rounded border border-line p-3 text-sm" data-testid="media-{outlet.mediaId}">
				<div class="flex items-baseline justify-between gap-3">
					<span class="font-medium">{outlet.name}</span>
					<span class="shrink-0 rounded bg-sidebar px-2 py-0.5 text-xs">
						{outlet.relationLabel}
					</span>
				</div>
				<p class="text-xs text-muted">
					{outlet.kindLabel} · {outlet.audienceLabel}{#if !outlet.follows}
						· Ne vous suit pas encore{/if}
				</p>
				<p class="text-xs">{outlet.line}</p>
				{#if outlet.actions.length > 0}
					{@const reason = outlet.follows
						? outlet.actions.find((action) => !action.planned && action.reason)?.reason
						: null}
					<div class="mt-1 flex flex-wrap items-center justify-end gap-2">
						{#if reason}
							<span class="text-xs text-warning">{reason}</span>
						{/if}
						{#each outlet.actions as action (action.actionId)}
							{#if action.planned}
								<span class="text-xs text-muted">{action.label} : prévu ce trimestre.</span>
							{:else}
								<button
									type="button"
									class="btn-secondary btn-small"
									disabled={!action.addable}
									aria-label="{action.label} : {outlet.name}"
									onclick={() =>
										session.controller.addStep({
											kind: 'action',
											id: action.actionId,
											target: outlet.mediaId
										})}
								>
									{action.label}
								</button>
							{/if}
						{/each}
					</div>
				{/if}
			</li>
		{/each}
	</ul>
</section>
