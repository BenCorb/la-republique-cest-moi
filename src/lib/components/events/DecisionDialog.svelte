<script lang="ts">
	import type { DecisionView } from '#lib/game/app/view-model.ts';

	/**
	 * Décision bloquante (DESIGN.md §4.4) : fenêtre modale accessible qui interrompt
	 * la progression. Échap ne la ferme pas : il faut choisir. Chaque choix affiche
	 * ses tendances et ses coûts certains ; un choix indisponible explique pourquoi.
	 */
	interface Props {
		decision: DecisionView;
		disabled: boolean;
		onChoose: (choiceId: string) => void;
	}

	let { decision, disabled, onChoose }: Props = $props();
	let dialog: HTMLDialogElement | undefined = $state();

	$effect(() => {
		if (dialog && !dialog.open) dialog.showModal();
	});
</script>

<dialog
	bind:this={dialog}
	aria-labelledby="decision-title"
	aria-describedby="decision-text"
	class="m-auto w-[min(44rem,92vw)] rounded-lg border border-line bg-surface p-0 text-ink shadow-lg backdrop:bg-ink/50"
	oncancel={(event) => event.preventDefault()}
>
	<div class="border-b border-line bg-sidebar px-6 py-3 text-xs tracking-wide text-muted uppercase">
		Décision attendue{decision.remaining > 0 ? ` · encore ${decision.remaining} ensuite` : ''}
	</div>
	<div class="p-6">
		<h2 id="decision-title" class="font-serif text-2xl text-primary">{decision.title}</h2>
		<p id="decision-text" class="mt-3 leading-relaxed">{decision.text}</p>
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
</dialog>
