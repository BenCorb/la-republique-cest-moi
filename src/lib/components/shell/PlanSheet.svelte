<script lang="ts">
	import { Plus, Search, X } from '@lucide/svelte';
	import PlanPanel from '#lib/components/agenda/PlanPanel.svelte';
	import EffectChip from '#lib/components/common/EffectChip.svelte';
	import TimeChip from '#lib/components/common/TimeChip.svelte';
	import { categoryIdentity } from '#lib/components/common/identity.ts';
	import type { GameSession } from '#lib/game/app/session.svelte.ts';

	/**
	 * Panneau « Modifier le plan » (P3-13) : feuille latérale modale (`<dialog>`)
	 * superposée à l'onglet courant, qui n'est ni changé ni défilé. Plan détaillé
	 * (ordre, épingles, prévisions) et ajout d'une activité générique par recherche
	 * dans le catalogue groupé. Échap ou « Fermer » rendent le contexte précédent.
	 */
	interface Props {
		session: GameSession;
		open: boolean;
		focusSearch: boolean;
		onClose: () => void;
	}

	let { session, open, focusSearch, onClose }: Props = $props();
	const view = $derived(session.snapshot.view);
	const locked = $derived(
		session.snapshot.acceleration?.running === true || view?.phase !== 'planning'
	);

	let dialog = $state<HTMLDialogElement | null>(null);
	let search = $state<HTMLInputElement | null>(null);
	let query = $state('');

	/** Comparaison sans casse ni accents (« reunion » trouve « Réunion »). */
	const fold = (text: string): string =>
		text
			.normalize('NFD')
			.replace(/\p{Diacritic}/gu, '')
			.toLocaleLowerCase('fr-FR');

	const groups = $derived.by(() => {
		const needle = fold(query.trim());
		return (view?.actionGroups ?? [])
			.map((group) => ({
				...group,
				matches: group.actions.filter(
					(action) =>
						needle === '' ||
						fold(action.label).includes(needle) ||
						fold(group.label).includes(needle)
				)
			}))
			.filter((group) => group.matches.length > 0);
	});

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			dialog.showModal();
			if (focusSearch) search?.focus();
		} else if (!open && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	class="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-[min(34rem,100vw)] max-w-none border-l border-line bg-canvas p-0 text-ink shadow-xl backdrop:bg-ink/30"
	aria-labelledby="plan-sheet-title"
	data-testid="plan-sheet"
	onclose={onClose}
>
	{#if open && view}
		<div class="flex h-full flex-col">
			<div class="flex items-center gap-2 border-b border-line bg-surface px-5 py-3">
				<h2 id="plan-sheet-title" class="section-title">Modifier le plan</h2>
				<span class="text-sm text-muted">{view.dateLabel}</span>
				<button
					type="button"
					class="btn-secondary btn-small ml-auto"
					onclick={() => dialog?.close()}
				>
					<X class="size-3.5" aria-hidden="true" /> Fermer
				</button>
			</div>
			<div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
				{#if locked}
					<p class="rounded border border-line bg-surface px-3 py-2 text-sm text-muted">
						{session.snapshot.acceleration?.running
							? 'Accélération en cours : le plan ne peut pas être modifié.'
							: 'Le plan se modifie pendant la préparation du trimestre.'}
					</p>
				{/if}
				<div class="rounded-md border border-line bg-surface p-4">
					<PlanPanel {session} />
				</div>

				<section
					class="rounded-md border border-line bg-surface p-4"
					aria-labelledby="plan-add-title"
				>
					<h3 id="plan-add-title" class="section-title">Ajouter une activité</h3>
					<label class="mt-2 flex items-center gap-2 rounded border border-line bg-canvas px-2">
						<Search class="size-4 shrink-0 text-muted" aria-hidden="true" />
						<span class="sr-only">Rechercher une activité</span>
						<input
							bind:this={search}
							bind:value={query}
							type="search"
							id="plan-search"
							class="w-full bg-transparent py-1.5 text-sm outline-none"
							placeholder="Rechercher (tracts, collecte, repos…)"
							autocomplete="off"
						/>
					</label>
					<p class="mt-1 text-xs text-muted">
						Candidatures, promesses, recrues et biens s’ajoutent depuis leur écran.
					</p>
					{#if groups.length === 0}
						<p class="mt-3 text-sm text-muted">Aucune activité ne correspond.</p>
					{/if}
					{#each groups as group (group.id)}
						{@const identity = categoryIdentity(group.id)}
						<h4
							class="mt-3 flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase"
							style:color={identity.color}
						>
							<identity.icon class="size-3.5" aria-hidden="true" />
							{group.label}
						</h4>
						<ul class="mt-1">
							{#each group.matches as action (action.id)}
								<li class="flex items-center gap-2 border-t border-line py-1.5 first:border-t-0">
									<div class="min-w-0 flex-1">
										<p class="text-sm font-medium {action.addable ? '' : 'text-muted'}">
											{action.label}
										</p>
										<div class="mt-0.5 flex flex-wrap gap-1">
											<TimeChip points={action.timeCost} />
											{#each action.costChips as chip, index (index)}
												<EffectChip {chip} />
											{/each}
											{#each action.effectChips.slice(0, 2) as chip, index (index)}
												<EffectChip {chip} />
											{/each}
										</div>
										{#if action.reason}
											<p class="text-xs text-warning" id="sheet-reason-{action.id}">
												{action.reason}
											</p>
										{/if}
									</div>
									{#if action.planned > 0}
										<span class="text-xs text-muted tabular-nums">× {action.planned}</span>
									{/if}
									<button
										type="button"
										class="btn-secondary btn-small"
										disabled={!action.addable || locked}
										aria-label="Ajouter « {action.label} » au plan"
										aria-describedby={action.reason ? `sheet-reason-${action.id}` : undefined}
										onclick={() => session.controller.addStep({ kind: 'action', id: action.id })}
									>
										<Plus class="size-3.5" aria-hidden="true" />
									</button>
								</li>
							{/each}
						</ul>
					{/each}
				</section>
			</div>
		</div>
	{/if}
</dialog>
