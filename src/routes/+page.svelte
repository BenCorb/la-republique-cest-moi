<script lang="ts">
	import { Info } from '@lucide/svelte';
	import GameShell from '#lib/components/shell/GameShell.svelte';
	import { RULES_VERSION } from '#lib/game/engine/index.ts';
</script>

<GameShell>
	<div class="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
		<section class="rounded-lg border border-line bg-surface p-8" aria-labelledby="accueil-titre">
			<h2 id="accueil-titre" class="text-2xl text-primary">Le cabinet ouvre bientôt</h2>
			<p class="mt-4 leading-relaxed">
				Les fondations techniques du jeu sont en place. La première carrière jouable — un personnage
				de 25 ans, au premier trimestre 2000 — arrivera avec le prototype.
			</p>

			<details class="mt-6 rounded border border-line bg-canvas">
				<summary class="flex cursor-pointer items-center gap-2 px-4 py-3 font-medium">
					<Info class="size-4 shrink-0 text-primary" aria-hidden="true" />
					À propos de cette version
				</summary>
				<div class="border-t border-line px-4 py-3 text-sm leading-relaxed text-muted">
					<p>
						Aucune partie n’est encore jouable : pas de création de carrière, pas de sauvegarde. Le
						site fonctionne entièrement dans le navigateur, sans compte ni serveur.
					</p>
					<p class="mt-2">
						Version des règles : <span class="tabular-nums">{RULES_VERSION}</span>
					</p>
				</div>
			</details>
		</section>
	</div>

	{#snippet status()}
		<p>Phase 0 — fondations techniques · Aucune partie en cours</p>
	{/snippet}
</GameShell>
