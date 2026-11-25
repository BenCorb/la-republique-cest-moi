<script lang="ts">
	import { Play, RotateCcw, Upload } from '@lucide/svelte';
	import type { GameSession } from '#lib/game/app/session.svelte.ts';
	import GameShell from './GameShell.svelte';
	import SaveBanner from './SaveBanner.svelte';

	/**
	 * Accueil (DESIGN.md §4.1) : reprendre (mis en évidence, avec dates), nouvelle
	 * carrière, import. Toute sauvegarde existante, lisible ou non, n'est remplacée
	 * qu'après confirmation (gérée par la page).
	 */
	interface Props {
		session: GameSession;
		onNewCareer: () => void;
		onImport: (text: string) => void;
	}

	let { session, onNewCareer, onImport }: Props = $props();
	const home = $derived(session.snapshot.home);
	let fileInput: HTMLInputElement | undefined = $state();

	async function readFile(event: Event): Promise<void> {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (file) onImport(await file.text());
	}
</script>

<GameShell>
	<div class="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
		<SaveBanner {session} />

		<section class="card p-8" aria-labelledby="accueil-titre">
			<h2 id="accueil-titre" class="text-2xl text-primary">Votre carrière politique</h2>
			<p class="mt-3 leading-relaxed">
				Vous avez 25 ans, quelques économies et beaucoup d’ambition. Nous sommes au premier
				trimestre 2000 : chaque tour représente trois mois, le temps n’avance que lorsque vous le
				décidez.
			</p>

			{#if home.existing}
				<div class="mt-6 rounded border border-primary bg-canvas p-4">
					<p class="font-medium">
						Carrière en cours : {home.existing.dateLabel}{home.existing.ended ? ' (terminée)' : ''}
					</p>
					<p class="text-sm text-muted">Sauvegardée le {home.existing.savedAtLabel}</p>
					<button
						type="button"
						class="btn-primary mt-3"
						onclick={() => session.controller.resume()}
					>
						<Play class="size-4" aria-hidden="true" />
						{home.existing.ended ? 'Voir le bilan' : 'Reprendre la carrière'}
					</button>
				</div>
			{/if}

			{#if home.unreadable}
				<div role="alert" class="mt-6 rounded border border-danger bg-canvas p-4 text-sm">
					<p class="font-semibold text-danger">{home.unreadable.message}</p>
					<p class="mt-1">
						Elle est conservée telle quelle. Elle ne sera remplacée que si vous commencez une
						nouvelle carrière ou importez une sauvegarde, après confirmation.
					</p>
				</div>
			{/if}

			{#if !home.storageAvailable}
				<p class="mt-6 rounded border-l-4 border-warning bg-canvas px-3 py-2 text-sm">
					Ce navigateur ne permet pas d’enregistrer la partie (navigation privée ou stockage
					bloqué). Vous pourrez jouer et exporter, mais pas reprendre plus tard.
				</p>
			{/if}

			<div class="mt-6 flex flex-wrap gap-3">
				<button
					type="button"
					class={home.existing ? 'btn-secondary' : 'btn-primary'}
					onclick={onNewCareer}
				>
					<RotateCcw class="size-4" aria-hidden="true" /> Nouvelle carrière
				</button>
				<button type="button" class="btn-secondary" onclick={() => fileInput?.click()}>
					<Upload class="size-4" aria-hidden="true" /> Importer une sauvegarde
				</button>
				<input
					bind:this={fileInput}
					type="file"
					accept="application/json,.json"
					class="sr-only"
					tabindex="-1"
					aria-label="Fichier de sauvegarde à importer"
					data-testid="import-input"
					onchange={readFile}
				/>
			</div>
		</section>
	</div>

	{#snippet status()}
		<p>Alpha · une carrière complète, sauvegardée dans ce navigateur</p>
	{/snippet}
</GameShell>
