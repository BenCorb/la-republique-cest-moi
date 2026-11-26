<script lang="ts">
	import { ArrowDown, ArrowUp, Pin, PinOff, X } from '@lucide/svelte';
	import type { GameSession } from '#lib/game/app/session.svelte.ts';

	/**
	 * Plan du trimestre (DESIGN.md §4.3) : ordre d'exécution, temps restant, coûts et
	 * effets certains, erreurs localisées, prévisions et avertissements. Aucun passage
	 * du temps : le plan n'est validé que par « Trimestre suivant ».
	 */
	interface Props {
		session: GameSession;
	}

	let { session }: Props = $props();
	const view = $derived(session.snapshot.view);
	const plan = $derived(view?.plan);
	const accelerating = $derived(session.snapshot.acceleration?.running === true);
</script>

{#if view && plan}
	<section class="card" aria-labelledby="plan-title">
		<h2 id="plan-title" class="section-title">Plan du trimestre</h2>
		<p class="mt-1 text-xs text-muted">
			Les actions épinglées sont reconduites d’un trimestre à l’autre ; désépinglez celles à ne
			faire qu’une fois. Achats et démarches sans objet ensuite (recrutement, candidature…) ne sont
			jamais reconduits.
		</p>

		<div class="mt-3">
			<div class="flex justify-between text-sm">
				<span>Temps disponible</span>
				<span class="tabular-nums" data-testid="time-remaining">
					{plan.timeRemaining} / {plan.timeAvailable} restants
				</span>
			</div>
			{#if plan.timeReserved > 0}
				<p class="text-xs text-muted" data-testid="time-reserved">
					{plan.timeReserved} points réservés par vos mandats.
				</p>
			{/if}
			<div
				class="mt-1 h-2 rounded-full bg-sidebar"
				role="meter"
				aria-label="Temps utilisé"
				aria-valuemin={0}
				aria-valuemax={plan.timeAvailable}
				aria-valuenow={plan.timeUsed}
			>
				<div
					class="h-2 rounded-full bg-primary"
					style:width="{Math.min(100, (plan.timeUsed / plan.timeAvailable) * 100)}%"
				></div>
			</div>
		</div>

		{#if plan.steps.length === 0}
			<p class="mt-4 text-sm text-muted">
				Aucune action planifiée. Un trimestre sans action est possible : le temps passe, les charges
				et la production aussi.
			</p>
		{:else}
			<ol class="mt-4 flex flex-col gap-2" aria-label="Étapes du plan">
				{#each plan.steps as step (step.index)}
					<li
						class="rounded border px-3 py-2 {step.issues.length > 0
							? 'border-danger'
							: 'border-line'}"
					>
						<div class="flex items-start gap-2">
							<span class="mt-0.5 text-xs text-muted tabular-nums">{step.index + 1}.</span>
							<div class="flex-1">
								<p class="text-sm font-medium">
									{step.kind === 'purchase' ? 'Achat : ' : ''}{step.label}
									<span class="font-normal text-muted">· {step.timeCost} pts</span>
								</p>
								{#if step.details.length > 0}
									<p class="text-xs text-muted">{step.details.join(' · ')}</p>
								{/if}
								{#if step.note}
									<p class="text-xs text-primary">{step.note}</p>
								{/if}
								{#each step.issues as issue, issueIndex (issueIndex)}
									<p class="mt-1 text-xs font-medium text-danger">Erreur : {issue}</p>
								{/each}
							</div>
							<div class="flex gap-1">
								{#if step.kind === 'action'}
									<button
										type="button"
										class="btn-secondary btn-small {step.pinned ? 'text-primary' : 'text-muted'}"
										aria-label="Reconduire « {step.label} » chaque trimestre"
										aria-pressed={step.pinned}
										title={step.pinned
											? 'Épinglée : reconduite au trimestre suivant'
											: 'Ponctuelle : retirée après ce trimestre'}
										disabled={accelerating}
										onclick={() => session.controller.togglePin(step.index)}
									>
										{#if step.pinned}
											<Pin class="size-3.5" aria-hidden="true" />
										{:else}
											<PinOff class="size-3.5" aria-hidden="true" />
										{/if}
									</button>
								{/if}
								<button
									type="button"
									class="btn-secondary btn-small"
									aria-label="Monter « {step.label} »"
									disabled={accelerating || step.index === 0}
									onclick={() => session.controller.moveStep(step.index, -1)}
								>
									<ArrowUp class="size-3.5" aria-hidden="true" />
								</button>
								<button
									type="button"
									class="btn-secondary btn-small"
									aria-label="Descendre « {step.label} »"
									disabled={accelerating || step.index === plan.steps.length - 1}
									onclick={() => session.controller.moveStep(step.index, 1)}
								>
									<ArrowDown class="size-3.5" aria-hidden="true" />
								</button>
								<button
									type="button"
									class="btn-secondary btn-small"
									aria-label="Retirer « {step.label} »"
									disabled={accelerating}
									onclick={() => session.controller.removeStep(step.index)}
								>
									<X class="size-3.5" aria-hidden="true" />
								</button>
							</div>
						</div>
					</li>
				{/each}
			</ol>
			<button
				type="button"
				class="btn-secondary btn-small mt-2"
				disabled={accelerating}
				onclick={() => session.controller.clearPlan()}
			>
				Vider le plan
			</button>
		{/if}

		{#each plan.issues as issue, index (index)}
			<p class="mt-3 text-sm font-medium text-danger">Erreur : {issue}</p>
		{/each}

		<h3 class="mt-5 text-sm font-semibold">Prévision pour ce trimestre</h3>
		<dl class="mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
			{#each plan.changes as change (change.name)}
				<dt class="text-muted">{change.name}</dt>
				<dd class="tabular-nums">{change.text}</dd>
			{/each}
			<dt class="text-muted">Stress en fin de trimestre</dt>
			<dd class="tabular-nums">{plan.stressAfter.value} · {plan.stressAfter.label}</dd>
			<dt class="text-muted">Santé en fin de trimestre</dt>
			<dd class="tabular-nums">
				{plan.healthAfter.min === plan.healthAfter.max
					? plan.healthAfter.max
					: `${plan.healthAfter.min} à ${plan.healthAfter.max}`}
			</dd>
		</dl>
		<p class="mt-1 text-xs text-muted">
			Fourchettes certaines : les effets aléatoires et le vieillissement sont tirés à la validation.
		</p>

		{#each plan.warnings as warning, index (index)}
			<p class="mt-3 rounded border-l-4 border-warning bg-canvas px-3 py-2 text-sm">
				<span class="font-semibold">Attention :</span>
				{warning}
			</p>
		{/each}
	</section>
{/if}
