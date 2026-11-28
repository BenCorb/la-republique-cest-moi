<script lang="ts">
	import { ArrowLeft, Play } from '@lucide/svelte';
	import type { ProfileOptionView, RegionOptionView } from '#lib/game/app/view-model.ts';
	import GameShell from './GameShell.svelte';

	/**
	 * Création du personnage (P2-08, P3-17) : origine sociale et terrain
	 * d'engagement (ce qui a mené à la politique), chacun avec ses arbitrages de
	 * départ, puis région d'origine (P3-16) : le département et la
	 * commune, fictive, sont tirés au lancement. L'âge reste fixé à 25 ans. Aucun
	 * profil n'est présenté comme meilleur qu'un autre.
	 */
	interface Props {
		origins: readonly ProfileOptionView[];
		engagements: readonly ProfileOptionView[];
		regions: readonly RegionOptionView[];
		defaults: { readonly origin: string; readonly engagement: string; readonly region: string };
		ambitions: readonly {
			readonly id: string;
			readonly label: string;
			readonly description: string;
		}[];
		onStart: (origin: string, engagement: string, region: string, ambition: string | null) => void;
		onCancel: () => void;
	}

	let { origins, engagements, regions, ambitions, defaults, onStart, onCancel }: Props = $props();
	// Valeurs de départ figées à l'ouverture de l'écran ; le joueur les modifie ensuite.
	const initial = (() => ({ ...defaults }))();
	let origin = $state(initial.origin);
	let engagement = $state(initial.engagement);
	let region = $state(initial.region);
	/** Ambition de départ (P3-38), facultative : chaîne vide pour « aucune ». */
	let ambition = $state('');
	const regionDetail = $derived(regions.find((entry) => entry.id === region));
</script>

<GameShell>
	<div class="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-10">
		<section class="card p-6" aria-labelledby="creation-titre">
			<h2 id="creation-titre" class="text-2xl text-primary">Qui êtes-vous ?</h2>
			<p class="mt-2 text-sm leading-relaxed">
				Vous avez 25 ans au premier trimestre 2000. Votre milieu et le terrain où vous avez pris
				goût à la chose publique vous donnent des appuis et des handicaps : aucun parcours n’est
				meilleur qu’un autre, ils mènent ailleurs.
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
			<legend class="section-title px-1">Terrain d’engagement</legend>
			<p class="mt-1 text-sm text-muted">
				Là où vous avez fait vos armes. Il vous laisse une activité modestement payée et des actions
				propres dans l’agenda.
			</p>
			<div class="mt-2 grid gap-3 md:grid-cols-2">
				{#each engagements as option (option.id)}
					<label
						class="flex cursor-pointer gap-3 rounded border p-3 {engagement === option.id
							? 'border-primary bg-sidebar'
							: 'border-line'}"
					>
						<input type="radio" name="engagement" value={option.id} bind:group={engagement} />
						<span>
							<span class="block font-semibold">{option.label}</span>
							<span class="block text-sm text-muted">{option.description}</span>
							{#if option.effects.length > 0}
								<span class="mt-1 block text-xs">{option.effects.join(' · ')}</span>
							{/if}
							{#if option.actions.length > 0}
								<span class="mt-1 block text-xs text-muted" data-testid="engagement-actions">
									Actions : {option.actions.join(' · ')}
								</span>
							{/if}
						</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<fieldset class="card p-6">
			<legend class="section-title px-1">Région d’origine</legend>
			<p class="mt-1 text-sm text-muted">
				Vous grandissez dans une commune de cette région ; son département, son nom et son caractère
				vous seront révélés au lancement.
			</p>
			<label class="mt-3 flex flex-col gap-1 text-sm md:max-w-sm">
				<span class="font-semibold">Région</span>
				<select class="rounded border border-line bg-surface px-3 py-2" bind:value={region}>
					{#each regions as option (option.id)}
						<option value={option.id}>{option.name}</option>
					{/each}
				</select>
			</label>
			{#if regionDetail}
				<p class="mt-2 text-xs text-muted" data-testid="region-departments">
					Départements : {regionDetail.departments}
				</p>
			{/if}
		</fieldset>

		{#if ambitions.length > 0}
			<fieldset class="card p-6" data-testid="ambitions">
				<legend class="section-title px-1">Ambition (facultative)</legend>
				<p class="mt-1 text-sm text-muted">
					Un cap pour la carrière, sans aucun avantage : il est rappelé au dossier et jugé au bilan.
				</p>
				<div class="mt-3 grid gap-2 md:grid-cols-2">
					<label class="flex cursor-pointer gap-3 rounded border border-line p-3">
						<input type="radio" name="ambition" value="" bind:group={ambition} />
						<span class="font-semibold">Aucune, on verra bien</span>
					</label>
					{#each ambitions as option (option.id)}
						<label class="flex cursor-pointer gap-3 rounded border border-line p-3">
							<input type="radio" name="ambition" value={option.id} bind:group={ambition} />
							<span>
								<span class="block font-semibold">{option.label}</span>
								<span class="block text-xs text-muted">{option.description}</span>
							</span>
						</label>
					{/each}
				</div>
			</fieldset>
		{/if}

		<div class="flex flex-wrap justify-end gap-3">
			<button type="button" class="btn-secondary" onclick={onCancel}>
				<ArrowLeft class="size-4" aria-hidden="true" /> Retour
			</button>
			<button
				type="button"
				class="btn-primary"
				onclick={() => onStart(origin, engagement, region, ambition === '' ? null : ambition)}
			>
				<Play class="size-4" aria-hidden="true" /> Commencer la carrière
			</button>
		</div>
	</div>
	{#snippet status()}
		<p>Création du personnage · l’âge de départ reste fixé à 25 ans</p>
	{/snippet}
</GameShell>
