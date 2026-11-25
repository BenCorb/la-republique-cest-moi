<script lang="ts">
	import { ArrowLeft, Play } from '@lucide/svelte';
	import type { ProfileOptionView } from '#lib/game/app/view-model.ts';
	import GameShell from './GameShell.svelte';

	/**
	 * Création du personnage (P2-08) : origine et profession, chacune avec ses
	 * arbitrages de départ. L'âge reste fixé à 25 ans dans l'alpha. Aucun profil
	 * n'est présenté comme meilleur qu'un autre.
	 */
	interface Props {
		origins: readonly ProfileOptionView[];
		professions: readonly ProfileOptionView[];
		defaults: { readonly origin: string; readonly profession: string };
		onStart: (origin: string, profession: string) => void;
		onCancel: () => void;
	}

	let { origins, professions, defaults, onStart, onCancel }: Props = $props();
	// Valeurs de départ figées à l'ouverture de l'écran ; le joueur les modifie ensuite.
	const initial = (() => ({ ...defaults }))();
	let origin = $state(initial.origin);
	let profession = $state(initial.profession);
</script>

<GameShell>
	<div class="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
		<section class="card p-6" aria-labelledby="creation-titre">
			<h2 id="creation-titre" class="text-2xl text-primary">Qui êtes-vous ?</h2>
			<p class="mt-2 text-sm leading-relaxed">
				Vous avez 25 ans au premier trimestre 2000. Votre milieu et votre métier vous donnent des
				appuis et des handicaps : aucun parcours n’est meilleur qu’un autre, ils mènent ailleurs.
			</p>
		</section>

		<fieldset class="card p-6">
			<legend class="section-title px-1">Origine</legend>
			<div class="mt-2 grid gap-3 md:grid-cols-2">
				{#each origins as option (option.id)}
					<label
						class="flex cursor-pointer gap-3 rounded border p-3 {origin === option.id
							? 'border-primary bg-sidebar'
							: 'border-line'}"
					>
						<input type="radio" name="origin" value={option.id} bind:group={origin} />
						<span>
							<span class="block font-semibold">{option.label}</span>
							<span class="block text-sm text-muted">{option.description}</span>
							{#if option.effects.length > 0}
								<span class="mt-1 block text-xs">{option.effects.join(' · ')}</span>
							{/if}
						</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<fieldset class="card p-6">
			<legend class="section-title px-1">Profession avant la politique</legend>
			<div class="mt-2 grid gap-3 md:grid-cols-2">
				{#each professions as option (option.id)}
					<label
						class="flex cursor-pointer gap-3 rounded border p-3 {profession === option.id
							? 'border-primary bg-sidebar'
							: 'border-line'}"
					>
						<input type="radio" name="profession" value={option.id} bind:group={profession} />
						<span>
							<span class="block font-semibold">{option.label}</span>
							<span class="block text-sm text-muted">{option.description}</span>
							{#if option.effects.length > 0}
								<span class="mt-1 block text-xs">{option.effects.join(' · ')}</span>
							{/if}
						</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<div class="flex flex-wrap justify-end gap-3">
			<button type="button" class="btn-secondary" onclick={onCancel}>
				<ArrowLeft class="size-4" aria-hidden="true" /> Retour
			</button>
			<button type="button" class="btn-primary" onclick={() => onStart(origin, profession)}>
				<Play class="size-4" aria-hidden="true" /> Commencer la carrière
			</button>
		</div>
	</div>
	{#snippet status()}
		<p>Création du personnage · l’âge de départ reste fixé à 25 ans</p>
	{/snippet}
</GameShell>
