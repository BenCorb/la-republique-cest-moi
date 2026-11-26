<script lang="ts">
	import { BookOpen, CalendarCheck, Pencil, WandSparkles } from '@lucide/svelte';
	import CalendarDate from '#lib/components/common/CalendarDate.svelte';
	import EffectChip from '#lib/components/common/EffectChip.svelte';
	import Stamp from '#lib/components/common/Stamp.svelte';
	import SpanSummary from '#lib/components/dashboard/SpanSummary.svelte';
	import type { AccelerationStatus } from '#lib/game/app/controller.ts';
	import type { QuarterNoteView } from '#lib/game/app/view-model.ts';

	/**
	 * Note de cabinet (P3-14, PT-P3-09-015) : présentée d'office après un trimestre
	 * manuel (nouvelle date en grand, phrase d'ouverture, variations nettes, trois
	 * paragraphes courts au plus) ou après une accélération (note de période).
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
		<div class="note-enter flex flex-col gap-4 p-6">
			<header class="flex items-start gap-4 border-b-2 border-double border-line pb-4">
				<CalendarDate label={note.dateLabel} />
				<div class="min-w-0 flex-1">
					<p class="text-xs tracking-wide text-muted uppercase">
						Cabinet · bilan du {note.endedLabel}
					</p>
					<h2 id="note-title" class="mt-1 font-display text-2xl font-bold text-primary">
						Note de cabinet
					</h2>
					<p class="text-sm text-muted">Le {note.dateLabel} commence.</p>
				</div>
				<Stamp label="Note" tone="primary" />
			</header>
			<p class="font-serif text-lg leading-snug" data-testid="note-opening">{note.opening}</p>
			<div class="flex flex-wrap items-center gap-1.5">
				<span class="text-xs font-bold tracking-wide text-muted uppercase">
					{note.totals ? 'Soldes' : 'Sur le trimestre'}
				</span>
				{#each note.chips as chip, index (index)}
					<EffectChip {chip} />
				{/each}
			</div>
			{#each note.sections as section (section.title)}
				<section aria-label={section.title}>
					<h3 class="font-display text-sm font-bold tracking-wide text-primary uppercase">
						{section.title}
					</h3>
					<ul class="mt-1 flex flex-col gap-0.5 text-sm">
						{#each section.lines as line, index (index)}
							<li>{line}</li>
						{/each}
					</ul>
				</section>
			{/each}
			{#if note.adjustments.length > 0}
				<div
					class="flex gap-2 rounded border border-dashed border-warning bg-risk-soft px-3 py-2 text-sm"
				>
					<WandSparkles class="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
					<div>
						<p class="font-semibold">Plan ajusté</p>
						<ul class="text-xs">
							{#each note.adjustments as adjustment, index (index)}
								<li>{adjustment}</li>
							{/each}
						</ul>
					</div>
				</div>
			{/if}
			{#if note.more > 0}
				<p class="text-xs text-muted">
					Et {note.more} autre{note.more > 1 ? 's' : ''} ligne{note.more > 1 ? 's' : ''} au journal.
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
