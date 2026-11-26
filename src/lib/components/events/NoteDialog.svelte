<script lang="ts">
	import { BookOpen, CalendarCheck, Pencil, ShoppingBag, WandSparkles } from '@lucide/svelte';
	import CalendarDate from '#lib/components/common/CalendarDate.svelte';
	import EffectChip from '#lib/components/common/EffectChip.svelte';
	import ResourceIcon from '#lib/components/common/ResourceIcon.svelte';
	import { categoryIdentity, identityOf } from '#lib/components/common/identity.ts';
	import Stamp from '#lib/components/common/Stamp.svelte';
	import SpanSummary from '#lib/components/dashboard/SpanSummary.svelte';
	import type { AccelerationStatus } from '#lib/game/app/controller.ts';
	import type { QuarterNoteView } from '#lib/game/app/view-model.ts';

	/**
	 * Note de cabinet (P3-14, PT-P3-09-015) : présentée d'office après un trimestre
	 * manuel — nouvelle date, variations nettes en tuiles, bilan des actions jouées
	 * (une ligne par action, effets réels en pastilles), retraits du plan — ou après
	 * une accélération (note de période). Le reste est au journal.
	 * Rouvrable depuis la date de l'en-tête. Échap ou « Préparer ce trimestre »
	 * la ferment ; une décision en attente s'affiche ensuite.
	 */
	interface Props {
		mode: 'quarter' | 'span';
		note: QuarterNoteView | null;
		acceleration: AccelerationStatus | null;
		decisionPending: boolean;
		onPrepare: () => void;
		onJournal: () => void;
	}

	let { mode, note, acceleration, decisionPending, onPrepare, onJournal }: Props = $props();
	let dialog: HTMLDialogElement | undefined = $state();
	let primary: HTMLButtonElement | undefined = $state();

	$effect(() => {
		if (dialog && !dialog.open) {
			dialog.showModal();
			primary?.focus();
		}
	});

	const SENSE = {
		gain: 'text-positive',
		cost: 'text-danger',
		risk: 'text-warning',
		neutral: 'text-muted'
	} as const;

	const prepareLabel = $derived(decisionPending ? 'Voir la décision' : 'Préparer ce trimestre');
</script>

<dialog
	bind:this={dialog}
	aria-labelledby="note-title"
	data-testid="quarter-note"
	class="m-auto max-h-[90dvh] w-[min(40rem,92vw)] overflow-y-auto rounded-lg border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-ink/50"
	oncancel={(event) => {
		event.preventDefault();
		onPrepare();
	}}
>
	<div class="tricolor-rule h-1" aria-hidden="true"></div>
	{#if mode === 'quarter' && note}
		<div class="note-enter flex flex-col gap-5 p-6">
			<header class="flex items-center gap-4">
				<CalendarDate label={note.dateLabel} />
				<div class="min-w-0">
					<h2 id="note-title" class="font-display text-2xl font-bold text-primary">
						Note de cabinet
					</h2>
					<p class="text-sm text-muted">Bilan du {note.endedLabel}</p>
				</div>
			</header>

			{#if note.variations}
				<dl class="grid grid-cols-3 gap-2" aria-label="Variations du trimestre">
					{#each note.variations as tile (tile.identity)}
						{@const identity = identityOf(tile.identity)}
						<div class="rounded-md border border-line bg-canvas px-3 py-2">
							<dt
								class="flex items-center gap-1.5 text-[11px] font-bold tracking-wide uppercase"
								style:color={identity?.color}
							>
								<ResourceIcon {identity} size="sm" />
								<span class="truncate">{tile.label}</span>
							</dt>
							<dd class="mt-0.5 text-xl font-bold tabular-nums {SENSE[tile.sense]}">
								{tile.value}
							</dd>
						</div>
					{/each}
				</dl>
			{/if}

			<section aria-labelledby="note-actions-title">
				<h3 id="note-actions-title" class="text-xs font-bold tracking-wider text-muted uppercase">
					Vos actions
				</h3>
				{#if note.actions.length === 0}
					<p class="mt-2 text-sm text-muted">Aucune activité ce trimestre.</p>
				{:else}
					<ul class="mt-2 flex flex-col gap-1.5">
						{#each note.actions as action (action.key)}
							{@const theme = categoryIdentity(action.category ?? 'other')}
							<li
								class="flex items-center gap-3 rounded-md border border-line px-3 py-2"
								data-testid="note-action"
							>
								<span
									class="inline-grid size-7 shrink-0 place-items-center rounded text-surface"
									style:background={action.purchase ? 'var(--color-primary)' : theme.color}
									aria-hidden="true"
								>
									{#if action.purchase}
										<ShoppingBag class="size-4" />
									{:else}
										<theme.icon class="size-4" />
									{/if}
								</span>
								<span class="min-w-0 flex-1 text-sm font-semibold">
									{action.label}
									{#if action.count > 1}
										<span class="font-normal text-muted tabular-nums">× {action.count}</span>
									{/if}
								</span>
								<span class="flex flex-wrap justify-end gap-1">
									{#each action.chips as chip, index (index)}
										<EffectChip {chip} />
									{/each}
								</span>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			{#if note.adjustments.length > 0}
				<p class="flex items-start gap-2 text-sm text-warning">
					<WandSparkles class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
					<span>Plan ajusté : {note.adjustments.join(' ; ')}</span>
				</p>
			{/if}
			{#if note.journalLines > 0}
				<p class="text-xs text-muted">
					{note.journalLines} autre{note.journalLines > 1 ? 's' : ''} fait{note.journalLines > 1
						? 's'
						: ''} du trimestre (revenus, charges, événements) au journal.
				</p>
			{/if}
		</div>
	{:else if mode === 'span' && acceleration?.summary}
		<div class="note-enter flex flex-col gap-4 p-6">
			<header class="flex items-center gap-3 border-b-2 border-double border-line pb-3">
				<CalendarCheck class="size-5 text-primary" aria-hidden="true" />
				<h2 id="note-title" class="font-display text-xl font-bold text-primary">Note de période</h2>
				<span class="ml-auto"><Stamp label="Accéléré" tone="warning" /></span>
			</header>
			<SpanSummary {acceleration} />
		</div>
	{/if}
	<!-- Bouton principal en premier dans l'ordre de tabulation, affiché à droite. -->
	<div class="flex flex-row-reverse flex-wrap gap-2 border-t border-line bg-canvas px-6 py-3">
		<button bind:this={primary} type="button" class="btn-primary" onclick={onPrepare}>
			<Pencil class="size-4" aria-hidden="true" />
			{prepareLabel}
		</button>
		<button type="button" class="btn-secondary" onclick={onJournal}>
			<BookOpen class="size-4" aria-hidden="true" /> Ouvrir le journal
		</button>
	</div>
</dialog>

<style>
	/* Seule transition de la note : la feuille se pose (coupée sous prefers-reduced-motion). */
	@media (prefers-reduced-motion: no-preference) {
		.note-enter {
			animation: note-in 0.35s ease-out both;
		}
	}

	@keyframes note-in {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
</style>
