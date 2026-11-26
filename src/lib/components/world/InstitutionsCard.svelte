<script lang="ts">
	import { Landmark } from '@lucide/svelte';
	import type { GameSession } from '#lib/game/app/session.svelte.ts';
	import type { InstitutionsView } from '#lib/game/app/view-model.ts';

	/**
	 * Institutions modifiables (P3-05) : régime en vigueur de chaque paramètre,
	 * réformes en attente et propositions (niveau voisin), ajoutées au plan et
	 * votées à la fin du trimestre. Les règles valent pour tous les acteurs.
	 */
	interface Props {
		session: GameSession;
		institutions: InstitutionsView;
		accelerating: boolean;
	}

	let { session, institutions, accelerating }: Props = $props();
</script>

<section class="card flex flex-col gap-3" aria-labelledby="institutions-title">
	<h2 id="institutions-title" class="section-title flex items-center gap-2">
		<Landmark class="size-4" aria-hidden="true" /> Institutions
	</h2>
	<p class="text-xs text-muted">
		Les règles valent pour tout le monde, vos adversaires compris, et survivent aux changements de
		gouvernement. Une réforme adoptée entre en vigueur au 1er janvier suivant.
	</p>
	{#if institutions.adoptionPercent !== null}
		<p class="text-sm" data-testid="reform-chance">
			Chance d’adoption d’une proposition : {institutions.adoptionPercent} %
		</p>
	{:else if institutions.lockedReason}
		<p class="text-sm text-muted">{institutions.lockedReason}</p>
	{/if}
	<ul class="flex flex-col gap-2">
		{#each institutions.parameters as parameter (parameter.parameterId)}
			<li
				class="rounded border border-line p-3 text-sm"
				data-testid="institution-{parameter.parameterId}"
			>
				<div class="flex items-baseline justify-between gap-3">
					<span class="font-medium">{parameter.label}</span>
					<span class="shrink-0 rounded bg-sidebar px-2 py-0.5 text-xs">
						{parameter.currentLabel}
					</span>
				</div>
				<p class="text-xs text-muted">{parameter.currentDescription}</p>
				<p class="text-xs" aria-label="Échelle : {parameter.label}">
					{#each parameter.levels as level, index (level.levelId)}
						{#if index > 0}<span aria-hidden="true"> · </span>{/if}
						<span class={level.current ? 'font-semibold' : 'text-muted'}>{level.label}</span>
					{/each}
				</p>
				{#if parameter.pending}
					<p class="text-xs text-warning">{parameter.pending}</p>
				{:else if institutions.adoptionPercent !== null}
					<div class="mt-1 flex flex-col gap-1">
						{#each parameter.options as option (option.levelId)}
							<div class="flex flex-wrap items-center justify-end gap-2">
								{#if option.effects.length > 0}
									<span class="text-xs text-muted">Si adoptée : {option.effects.join(' · ')}</span>
								{/if}
								{#if option.planned}
									<span class="text-xs text-muted">Proposition prévue ce trimestre.</span>
								{:else}
									{#if option.reason}
										<span class="text-xs text-warning" id="reform-reason-{option.levelId}">
											{option.reason}
										</span>
									{/if}
									<button
										type="button"
										class="btn-secondary btn-small"
										disabled={!option.addable || accelerating}
										aria-label="Proposer : {option.label}"
										aria-describedby={option.reason ? `reform-reason-${option.levelId}` : undefined}
										onclick={() =>
											institutions.actionId &&
											session.controller.addStep({
												kind: 'action',
												id: institutions.actionId,
												target: option.levelId
											})}
									>
										Proposer « {option.label} »
									</button>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</li>
		{/each}
	</ul>
	{#if institutions.history.length > 0}
		<div>
			<h3 class="text-xs font-semibold text-muted uppercase">Réformes</h3>
			<ul class="mt-1 text-xs">
				{#each institutions.history as item (item.key)}
					<li>{item.text}</li>
				{/each}
			</ul>
		</div>
	{/if}
</section>
