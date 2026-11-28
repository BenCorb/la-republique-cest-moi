<script lang="ts">
	import { ArrowRight, ChevronDown, ChevronUp } from '@lucide/svelte';
	import EffectChip from '#lib/components/common/EffectChip.svelte';
	import Stamp from '#lib/components/common/Stamp.svelte';
	import BallotReport from '#lib/components/career/BallotReport.svelte';
	import type { DecisionView, OutcomeView } from '#lib/game/app/view-model.ts';

	/**
	 * Décision bloquante (DESIGN.md §4.4) : fenêtre modale accessible qui interrompt
	 * la progression. Échap ne la ferme pas : il faut choisir. Chaque choix affiche
	 * ses tendances et ses coûts certains ; un choix indisponible explique pourquoi.
	 * Après le choix (P3-14), la même fenêtre présente le résultat : récit, puis
	 * cinq variations au plus avant « Détail » ; « Décision suivante » enchaîne.
	 */
	interface Props {
		decision: DecisionView | null;
		/** Résultat du choix qui vient d'être fait, à présenter avant toute suite. */
		outcome: OutcomeView | null;
		disabled: boolean;
		onChoose: (choiceId: string) => void;
		onContinue: () => void;
	}

	let { decision, outcome, disabled, onChoose, onContinue }: Props = $props();
	let dialog: HTMLDialogElement | undefined = $state();
	let continueButton: HTMLButtonElement | undefined = $state();
	let showDetail = $state(false);

	/** Variations visibles d'emblée ; le reste sous « Détail ». */
	const VISIBLE_CHIPS = 5;
	const shownChips = $derived(
		outcome ? (showDetail ? outcome.chips : outcome.chips.slice(0, VISIBLE_CHIPS)) : []
	);
	const hidden = $derived(
		outcome ? Math.max(0, outcome.chips.length - VISIBLE_CHIPS) + outcome.details.length : 0
	);

	$effect(() => {
		if (dialog && !dialog.open) dialog.showModal();
	});

	// Le résultat remplace les choix : le focus passe au bouton qui poursuit.
	$effect(() => {
		if (outcome) {
			showDetail = false;
			continueButton?.focus();
		}
	});
</script>

<dialog
	bind:this={dialog}
	aria-labelledby="decision-title"
	aria-describedby="decision-text"
	data-testid="decision-dialog"
	class="m-auto max-h-[90dvh] w-[min(44rem,92vw)] overflow-y-auto rounded-lg border border-line bg-surface p-0 text-ink shadow-lg backdrop:bg-ink/50"
	oncancel={(event) => event.preventDefault()}
>
	{#if outcome}
		<div
			class="flex items-center justify-between gap-3 border-b border-line bg-sidebar px-6 py-3 text-xs tracking-wide text-muted uppercase"
		>
			<span>Résultat · {outcome.dateLabel}</span>
			<Stamp label="Décidé" tone="positive" />
		</div>
		<div class="p-6" data-testid="decision-outcome">
			<p class="text-xs tracking-wide text-muted uppercase">{outcome.title}</p>
			<h2 id="decision-title" class="mt-1 font-display text-xl font-bold text-primary">
				« {outcome.choice} »
			</h2>
			<p id="decision-text" class="mt-3 font-serif text-lg leading-relaxed">{outcome.text}</p>
			{#if outcome.report}
				<div class="mt-4 rounded-md border border-line p-3">
					<p class="mb-1 text-sm font-semibold">{outcome.report.title}</p>
					<BallotReport report={outcome.report} />
				</div>
			{/if}
			{#if outcome.chips.length > 0}
				<div class="mt-4 flex flex-wrap gap-1.5" aria-label="Conséquences constatées">
					{#each shownChips as chip, index (index)}
						<EffectChip {chip} />
					{/each}
				</div>
			{/if}
			{#if showDetail && outcome.details.length > 0}
				<ul class="mt-3 flex list-disc flex-col gap-0.5 pl-5 text-sm text-muted">
					{#each outcome.details as detail, index (index)}
						<li>{detail}</li>
					{/each}
				</ul>
			{/if}
			{#if hidden > 0}
				<button
					type="button"
					class="mt-2 flex items-center gap-1 text-sm text-primary underline"
					aria-expanded={showDetail}
					onclick={() => (showDetail = !showDetail)}
				>
					{#if showDetail}
						<ChevronUp class="size-3.5" aria-hidden="true" /> Masquer le détail
					{:else}
						<ChevronDown class="size-3.5" aria-hidden="true" /> Détail ({hidden})
					{/if}
				</button>
			{/if}
			<div class="mt-6 flex justify-end">
				<button bind:this={continueButton} type="button" class="btn-primary" onclick={onContinue}>
					{decision ? 'Décision suivante' : 'Continuer'}
					<ArrowRight class="size-4" aria-hidden="true" />
				</button>
			</div>
		</div>
	{:else if decision}
		<div
			class="border-b border-line bg-sidebar px-6 py-3 text-xs tracking-wide text-muted uppercase"
		>
			Décision attendue{decision.remaining > 0 ? ` · encore ${decision.remaining} ensuite` : ''}
		</div>
		<div class="p-6">
			<h2 id="decision-title" class="font-serif text-2xl text-primary">{decision.title}</h2>
			<p id="decision-text" class="mt-3 leading-relaxed">{decision.text}</p>
			{#if decision.appointment}
				<p class="mt-3 font-semibold" data-testid="appointment-offer">{decision.appointment}</p>
			{/if}
			{#if decision.report}
				<div class="mt-4 rounded-md border border-line p-3">
					<p class="mb-1 text-sm font-semibold">{decision.report.title} — premier tour</p>
					<BallotReport report={decision.report} />
				</div>
			{/if}
			<ul class="mt-6 flex flex-col gap-3">
				{#each decision.choices as choice (choice.id)}
					<li>
						<button
							type="button"
							class="w-full rounded-lg border border-line px-4 py-3 text-left hover:border-primary hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:border-line disabled:hover:bg-surface"
							disabled={disabled || !choice.available}
							aria-describedby="choice-{choice.id}-details"
							onclick={() => onChoose(choice.id)}
						>
							<span class="block font-semibold">{choice.label}</span>
							<span id="choice-{choice.id}-details" class="mt-1 block text-sm text-muted">
								{#if choice.hints.length > 0}
									Tendances : {choice.hints.join(' · ')}.
								{/if}
								{#if choice.costs.length > 0}
									<span class="block">Coût certain : {choice.costs.join(', ')}.</span>
								{/if}
								{#if decision.advice && (decision.advice.choices[choice.id]?.length ?? 0) > 0}
									<span class="block text-xs" data-testid="advice-{choice.id}">
										Avis de {decision.advice.adviser}{decision.advice.quality === 'poor'
											? ' (à prendre avec prudence)'
											: ''} : {decision.advice.choices[choice.id]?.join(' ; ')}.
									</span>
								{/if}
								{#if !choice.available && choice.reason}
									<span class="block font-medium text-warning">Indisponible : {choice.reason}</span>
								{/if}
							</span>
						</button>
					</li>
				{/each}
			</ul>
			{#if disabled}
				<p class="mt-4 text-sm text-danger">
					La dernière étape n’est pas sauvegardée : réglez la sauvegarde avant de décider.
				</p>
			{/if}
		</div>
	{/if}
</dialog>
