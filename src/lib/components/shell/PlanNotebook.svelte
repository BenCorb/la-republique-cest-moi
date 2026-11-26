<script lang="ts">
	import {
		ClipboardList,
		OctagonExclamationPoint,
		Pencil,
		Pin,
		Plus,
		TriangleExclamationPoint,
		WandSparkles,
		X
	} from '@lucide/svelte';
	import TimeBar from '#lib/components/agenda/TimeBar.svelte';
	import { categoryIdentity } from '#lib/components/common/identity.ts';
	import type { GameSession } from '#lib/game/app/session.svelte.ts';

	/**
	 * Carnet du trimestre (P3-13, PT-P3-09-012) : sommaire opérationnel du plan,
	 * présent dans tous les onglets. Ordre, nom, temps, épingle et retrait par
	 * ligne, erreurs sur la ligne concernée, temps restant annoncé. Le détail
	 * (ordre, prévisions, ajout) s'ouvre dans le panneau « Modifier le plan ».
	 */
	interface Props {
		session: GameSession;
		onEdit: (focusSearch: boolean) => void;
	}

	let { session, onEdit }: Props = $props();
	const view = $derived(session.snapshot.view);
	const plan = $derived(view?.plan);
	/** Modifications fermées pendant l'accélération ou une décision bloquante. */
	const locked = $derived(
		session.snapshot.acceleration?.running === true || view?.phase !== 'planning'
	);
</script>

{#if view && plan}
	<section class="flex flex-col gap-2" aria-labelledby="carnet-title" data-testid="plan-notebook">
		<h2 id="carnet-title" class="section-title flex items-center gap-2">
			<ClipboardList class="size-4" aria-hidden="true" /> Plan du trimestre
		</h2>
		<p
			class="flex items-baseline gap-1.5 text-sm text-muted tabular-nums"
			aria-live="polite"
			data-testid="time-remaining"
		>
			<span class="text-2xl leading-none font-bold text-res-time">{plan.timeRemaining}</span>
			restants sur {plan.timeAvailable}
		</p>
		<TimeBar {plan} thin />
		{#if plan.timeReserved > 0}
			<p class="text-xs text-muted" data-testid="time-reserved">
				{plan.timeReserved} points réservés par vos mandats.
			</p>
		{/if}

		{#if plan.adjustments.length > 0}
			<div
				class="flex gap-2 rounded border border-dashed border-warning bg-risk-soft px-2.5 py-1.5 text-xs"
				role="status"
				data-testid="plan-adjustments"
			>
				<WandSparkles class="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />
				<div>
					<p class="font-semibold">Plan ajusté</p>
					<ul>
						{#each plan.adjustments as adjustment, index (index)}
							<li>{adjustment}</li>
						{/each}
					</ul>
				</div>
			</div>
		{/if}

		{#if plan.steps.length === 0}
			<div class="rounded border border-dashed border-line px-3 py-3 text-center">
				<p class="text-sm text-muted">Aucune activité ce trimestre.</p>
				<button
					type="button"
					class="btn-secondary btn-small mt-2"
					disabled={locked}
					onclick={() => onEdit(true)}
				>
					<Plus class="size-3.5" aria-hidden="true" /> Ajouter une activité
				</button>
			</div>
		{:else}
			<ol class="flex flex-col gap-1" aria-label="Activités du trimestre">
				{#each plan.steps as step (step.index)}
					{@const identity = categoryIdentity(step.category ?? 'other')}
					{@const error = step.issues[0]}
					<li
						class="flex overflow-hidden rounded border bg-surface {error
							? 'border-danger'
							: 'border-line'}"
						data-testid="notebook-step"
					>
						<span class="w-1 shrink-0" style:background={identity.color} aria-hidden="true"></span>
						<div class="min-w-0 flex-1 py-1 pr-1 pl-2">
							<div class="flex items-center gap-1.5">
								<span class="text-xs text-muted tabular-nums">{step.index + 1}.</span>
								<span class="min-w-0 flex-1 truncate text-sm font-medium" title={step.label}>
									{step.kind === 'purchase' ? 'Achat : ' : ''}{step.label}
								</span>
								<span class="text-xs text-muted tabular-nums">{step.timeCost}</span>
								{#if step.kind === 'action'}
									<button
										type="button"
										class="grid size-6 place-items-center rounded hover:bg-sidebar disabled:opacity-50 {step.pinned
											? 'text-primary'
											: 'text-muted'}"
										aria-label={step.pinned
											? `« ${step.label} » épinglée : répétée chaque trimestre`
											: `Épingler « ${step.label} » : répéter chaque trimestre`}
										aria-pressed={step.pinned}
										title={step.pinned
											? 'Épinglée : répétée chaque trimestre'
											: 'Épingler : répéter chaque trimestre'}
										disabled={locked}
										onclick={() => session.controller.togglePin(step.index)}
									>
										<Pin class="size-3.5 {step.pinned ? 'fill-current' : ''}" aria-hidden="true" />
									</button>
								{:else}
									<span class="size-6" aria-hidden="true"></span>
								{/if}
								<button
									type="button"
									class="grid size-6 place-items-center rounded text-muted hover:bg-sidebar hover:text-danger disabled:opacity-50"
									aria-label="Retirer « {step.label} »"
									title="Retirer"
									disabled={locked}
									onclick={() => session.controller.removeStep(step.index)}
								>
									<X class="size-3.5" aria-hidden="true" />
								</button>
							</div>
							{#if error}
								<p class="flex items-start gap-1 pb-0.5 text-xs text-danger">
									<OctagonExclamationPoint class="mt-0.5 size-3 shrink-0" aria-hidden="true" />
									{error}
								</p>
							{/if}
						</div>
					</li>
				{/each}
			</ol>
		{/if}

		{#each plan.issues as issue, index (index)}
			<p class="text-xs font-medium text-danger">Erreur : {issue}</p>
		{/each}
		{#if plan.warnings.length > 0}
			<p class="flex items-start gap-1 text-xs text-warning">
				<TriangleExclamationPoint class="mt-0.5 size-3 shrink-0" aria-hidden="true" />
				<span>
					{plan.warnings[0]}{plan.warnings.length > 1
						? ` (et ${plan.warnings.length - 1} autre${plan.warnings.length > 2 ? 's' : ''})`
						: ''}
				</span>
			</p>
		{/if}

		<button type="button" class="btn-secondary w-full" onclick={() => onEdit(false)}>
			<Pencil class="size-4" aria-hidden="true" /> Modifier le plan
		</button>
	</section>
{/if}
