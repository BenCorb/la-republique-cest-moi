<script lang="ts">
	import { ArrowDown, ArrowUp, ClipboardList, Pin, WandSparkles, X } from '@lucide/svelte';
	import EffectChip from '#lib/components/common/EffectChip.svelte';
	import HelpTip from '#lib/components/common/HelpTip.svelte';
	import ResourceIcon from '#lib/components/common/ResourceIcon.svelte';
	import StatBar from '#lib/components/common/StatBar.svelte';
	import TimeChip from '#lib/components/common/TimeChip.svelte';
	import { categoryIdentity } from '#lib/components/common/identity.ts';
	import { describeHealth } from '#lib/game/app/format.ts';
	import type { GameSession } from '#lib/game/app/session.svelte.ts';

	/**
	 * Plan du trimestre (DESIGN.md §4.3, style P3-26) : temps restant en grand,
	 * barre de temps segmentée par thème (temps des mandats hachuré), étapes en
	 * pastilles, erreurs localisées, prévisions et avertissements. Aucun passage
	 * du temps : le plan n'est validé que par « Trimestre suivant ».
	 */
	interface Props {
		session: GameSession;
	}

	let { session }: Props = $props();
	const view = $derived(session.snapshot.view);
	const plan = $derived(view?.plan);
	const accelerating = $derived(session.snapshot.acceleration?.running === true);

	/** Segments de la barre de temps : un par thème, dans l'ordre d'apparition, puis les mandats. */
	const segments = $derived.by(() => {
		if (!plan) return [];
		const total = plan.timeAvailable + plan.timeReserved || 1;
		const byCategory: { key: string; label: string; color: string; points: number }[] = [];
		for (const step of plan.steps) {
			if (step.timeCost <= 0) continue;
			const key = step.category ?? 'other';
			const identity = categoryIdentity(key);
			const existing = byCategory.find((segment) => segment.key === key);
			if (existing) existing.points += step.timeCost;
			else
				byCategory.push({
					key,
					label: identity.label,
					color: identity.color,
					points: step.timeCost
				});
		}
		return [
			...byCategory.map((segment) => ({
				...segment,
				width: (segment.points / total) * 100,
				reserved: false
			})),
			...(plan.timeReserved > 0
				? [
						{
							key: 'reserved',
							label: 'Mandats (réservé)',
							color: 'var(--color-muted)',
							points: plan.timeReserved,
							width: (plan.timeReserved / total) * 100,
							reserved: true
						}
					]
				: [])
		];
	});
	const healthForecast = $derived(
		plan ? Math.round((plan.healthAfter.min + plan.healthAfter.max) / 2) : null
	);
</script>

{#if view && plan}
	<section class="card flex flex-col gap-3" aria-labelledby="plan-title">
		<div class="flex flex-wrap items-center gap-2">
			<h2 id="plan-title" class="section-title flex items-center gap-2">
				<ClipboardList class="size-4" aria-hidden="true" /> Plan du trimestre
			</h2>
			<HelpTip topic="plan du trimestre">
				Chaque activité ne vaut que pour ce trimestre. Épinglez celles à répéter chaque trimestre ;
				les achats ne se répètent jamais. Une activité devenue impossible est retirée du plan.
			</HelpTip>
		</div>

		<div>
			<p class="flex items-baseline gap-1.5">
				<ResourceIcon identity="time" size="lg" />
				<span
					class="text-3xl leading-none font-bold text-res-time tabular-nums"
					data-testid="time-remaining"
				>
					{plan.timeRemaining}<span class="sr-only"> / {plan.timeAvailable} restants</span>
				</span>
				<span class="text-sm text-muted" aria-hidden="true">
					restants sur {plan.timeAvailable}
				</span>
			</p>
			<div
				class="mt-2 flex h-4 gap-0.5 overflow-hidden rounded bg-sidebar"
				role="meter"
				aria-label="Temps utilisé"
				aria-valuemin={0}
				aria-valuemax={plan.timeAvailable}
				aria-valuenow={plan.timeUsed}
				aria-valuetext="{plan.timeUsed} points utilisés sur {plan.timeAvailable}"
			>
				{#each segments as segment (segment.key)}
					<span
						class="block h-full {segment.reserved ? 'plan-reserved' : ''}"
						style:width="{segment.width}%"
						style:background={segment.reserved ? undefined : segment.color}
						title="{segment.label} : {segment.points}"
					></span>
				{/each}
			</div>
			{#if segments.length > 0}
				<ul class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted">
					{#each segments as segment (segment.key)}
						<li class="flex items-center gap-1">
							<span
								class="inline-block size-2.5 rounded-sm {segment.reserved ? 'plan-reserved' : ''}"
								style:background={segment.reserved ? undefined : segment.color}
								aria-hidden="true"
							></span>
							{segment.label}
							{segment.points}
						</li>
					{/each}
				</ul>
			{/if}
			{#if plan.timeReserved > 0}
				<p class="sr-only" data-testid="time-reserved">
					{plan.timeReserved} points réservés par vos mandats.
				</p>
			{/if}
		</div>

		{#if plan.adjustments.length > 0}
			<div
				class="flex gap-2 rounded border border-dashed border-warning bg-risk-soft px-3 py-2 text-sm"
				role="status"
				data-testid="plan-adjustments"
			>
				<WandSparkles class="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
				<div>
					<p class="font-semibold">Plan ajusté</p>
					<ul class="mt-1 text-xs">
						{#each plan.adjustments as adjustment, index (index)}
							<li>{adjustment}</li>
						{/each}
					</ul>
				</div>
			</div>
		{/if}

		{#if plan.steps.length === 0}
			<p class="text-sm text-muted">
				Aucune action planifiée. Un trimestre sans action est possible : le temps passe, les charges
				et la production aussi.
			</p>
		{:else}
			<ol class="flex flex-col gap-1.5" aria-label="Étapes du plan">
				{#each plan.steps as step (step.index)}
					{@const identity = categoryIdentity(step.category ?? 'other')}
					<li
						class="flex overflow-hidden rounded border bg-surface {step.issues.length > 0
							? 'border-danger'
							: 'border-line'}"
					>
						<span class="w-1 shrink-0" style:background={identity.color} aria-hidden="true"></span>
						<div class="flex min-w-0 flex-1 items-start gap-2 px-2.5 py-1.5">
							<span class="mt-0.5 text-xs text-muted tabular-nums">{step.index + 1}.</span>
							<div class="min-w-0 flex-1">
								<p class="text-sm font-semibold">
									{step.kind === 'purchase' ? 'Achat : ' : ''}{step.label}
								</p>
								<div class="mt-0.5 flex flex-wrap gap-1">
									<TimeChip points={step.timeCost} />
									{#each step.chips as chip, chipIndex (chipIndex)}
										<EffectChip {chip} />
									{/each}
								</div>
								{#if step.note}
									<p class="mt-0.5 text-xs text-primary">{step.note}</p>
								{/if}
								{#each step.issues as issue, issueIndex (issueIndex)}
									<p class="mt-1 text-xs font-medium text-danger">Erreur : {issue}</p>
								{/each}
							</div>
							<div class="flex gap-1">
								{#if step.kind === 'action'}
									<button
										type="button"
										class="btn-secondary btn-small {step.pinned
											? 'border-primary text-primary'
											: 'text-muted opacity-70'}"
										aria-label={step.pinned
											? `« ${step.label} » épinglée : répétée chaque trimestre`
											: `Épingler « ${step.label} » : répéter chaque trimestre`}
										aria-pressed={step.pinned}
										title={step.pinned
											? 'Épinglée : répétée chaque trimestre'
											: 'Épingler : répéter chaque trimestre'}
										disabled={accelerating}
										onclick={() => session.controller.togglePin(step.index)}
									>
										<Pin class="size-3.5 {step.pinned ? 'fill-current' : ''}" aria-hidden="true" />
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
				class="btn-secondary btn-small self-start"
				disabled={accelerating}
				onclick={() => session.controller.clearPlan()}
			>
				Vider le plan
			</button>
		{/if}

		{#each plan.issues as issue, index (index)}
			<p class="text-sm font-medium text-danger">Erreur : {issue}</p>
		{/each}

		<div class="border-t border-line pt-3">
			<h3 class="text-xs font-bold tracking-wider text-muted uppercase">
				Prévu en fin de trimestre
			</h3>
			<div class="mt-2 flex flex-wrap gap-1">
				{#each plan.changeChips as chip, index (index)}
					<EffectChip {chip} />
				{/each}
			</div>
			<div class="mt-3 grid gap-3">
				<StatBar
					name="Stress"
					gauge={view.stress}
					identity="player.stress"
					forecast={plan.stressAfter.value}
					size="compact"
				/>
				<StatBar
					name="Santé"
					gauge={view.health}
					identity="player.health"
					forecast={healthForecast}
					size="compact"
				/>
			</div>
			<p class="sr-only">
				Stress en fin de trimestre : {plan.stressAfter.value}, {plan.stressAfter.label}. Santé en
				fin de trimestre : {plan.healthAfter.min === plan.healthAfter.max
					? plan.healthAfter.max
					: `${plan.healthAfter.min} à ${plan.healthAfter.max}`}, {describeHealth(
					plan.healthAfter.min
				).label}.
			</p>
			<p class="mt-2 flex items-center gap-1 text-xs text-muted">
				Fourchettes certaines ; les effets marqués d’un dé sont tirés à la validation.
			</p>
		</div>

		{#each plan.warnings as warning, index (index)}
			<p class="rounded border border-l-4 border-warning bg-surface px-3 py-2 text-sm">
				<span class="font-semibold text-warning">Attention :</span>
				{warning}
			</p>
		{/each}
	</section>
{/if}
