<script lang="ts">
	import {
		BookOpen,
		CalendarCheck,
		Flag,
		Gavel,
		Landmark,
		Pencil,
		Scale,
		Sparkles,
		Trophy,
		Users,
		Vote,
		WandSparkles,
		X
	} from '@lucide/svelte';
	import Donut from '#lib/components/common/Donut.svelte';
	import ScoreBars from '#lib/components/common/ScoreBars.svelte';
	import CalendarDate from '#lib/components/common/CalendarDate.svelte';
	import ResourceIcon from '#lib/components/common/ResourceIcon.svelte';
	import { identityOf } from '#lib/components/common/identity.ts';
	import Stamp from '#lib/components/common/Stamp.svelte';
	import SpanSummary from '#lib/components/dashboard/SpanSummary.svelte';
	import type { AccelerationStatus } from '#lib/game/app/controller.ts';
	import type { NoteHighlightView, QuarterNoteView } from '#lib/game/app/view-model.ts';

	/**
	 * Note de cabinet (P3-14, PT-P3-09-015) : présentée d'office après un trimestre
	 * manuel — nouvelle date, statistiques (variation et valeur atteinte), faits
	 * marquants (résultats d'élection avec graphique et bilan électoral, alternance,
	 * mandats, partis, justice, entourage, événements) — ou après une accélération
	 * (note de période). Le reste est au journal.
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

	const SENSE_TITLE = {
		gain: 'text-positive',
		cost: 'text-danger',
		risk: 'text-warning',
		neutral: 'text-ink'
	} as const;

	/** Icône et couleur de chaque type de fait marquant. */
	const KINDS: Record<NoteHighlightView['kind'], { icon: typeof Trophy; color: string }> = {
		victory: { icon: Trophy, color: 'var(--color-positive)' },
		defeat: { icon: X, color: 'var(--color-danger)' },
		ballot: { icon: Vote, color: 'var(--color-primary)' },
		mandate: { icon: Landmark, color: 'var(--color-primary)' },
		party: { icon: Flag, color: 'var(--color-cat-party)' },
		justice: { icon: Gavel, color: 'var(--color-res-justice)' },
		people: { icon: Users, color: 'var(--color-cat-personal)' },
		event: { icon: Sparkles, color: 'var(--color-cat-media)' },
		institution: { icon: Scale, color: 'var(--color-cat-institution)' }
	};

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

			<section aria-labelledby="note-stats-title">
				<h3 id="note-stats-title" class="text-xs font-bold tracking-wider text-muted uppercase">
					{note.first ? 'Votre point de départ' : 'Vos statistiques sur le trimestre'}
				</h3>
				<dl class="mt-2 grid grid-cols-3 gap-2">
					{#each note.variations as tile (tile.identity)}
						{@const identity = identityOf(tile.identity)}
						<div class="rounded-md border border-line bg-canvas px-3 py-2" data-testid="note-stat">
							<dt
								class="flex items-center gap-1.5 text-[11px] font-bold tracking-wide uppercase"
								style:color={identity?.color}
							>
								<ResourceIcon {identity} size="sm" />
								<span class="truncate">{tile.label}</span>
							</dt>
							<dd class="mt-0.5 flex items-baseline justify-between gap-2 tabular-nums">
								{#if tile.change !== null}
									<span class="text-xl font-bold {SENSE[tile.sense]}">{tile.change}</span>
									<span class="text-xs text-muted">→ {tile.value}</span>
								{:else}
									<span class="text-xl font-bold text-ink">{tile.value}</span>
								{/if}
							</dd>
						</div>
					{/each}
				</dl>
			</section>

			<section aria-labelledby="note-facts-title">
				<h3 id="note-facts-title" class="text-xs font-bold tracking-wider text-muted uppercase">
					Ce qui s’est passé
				</h3>
				{#if note.highlights.length === 0}
					<p class="mt-2 text-sm text-muted">
						Rien de marquant : la République a tourné sans vous ce trimestre.
					</p>
				{:else}
					<ul class="mt-2 flex flex-col gap-2">
						{#each note.highlights as fact (fact.key)}
							{@const look = KINDS[fact.kind]}
							<li
								class="rounded-md border px-3 py-2.5 {fact.kind === 'victory'
									? 'border-gain-line bg-gain-soft'
									: fact.kind === 'defeat'
										? 'border-cost-line bg-cost-soft'
										: 'border-line bg-surface'}"
								data-testid="note-fact"
								data-kind={fact.kind}
							>
								<div class="flex items-start gap-3">
									<span
										class="inline-grid size-8 shrink-0 place-items-center rounded-full text-surface"
										style:background={look.color}
										aria-hidden="true"
									>
										<look.icon class="size-4" />
									</span>
									<div class="min-w-0 flex-1">
										<p class="text-sm font-bold {SENSE_TITLE[fact.tone]}">{fact.title}</p>
										<p class="mt-0.5 text-sm">{fact.text}</p>
										{#if fact.chart?.kind === 'shares'}
											<div class="mt-2">
												<ScoreBars
													label="Résultats du scrutin"
													rows={fact.chart.rows.map((row) => ({
														key: row.label,
														label: row.mine ? `${row.label} (vous)` : row.label,
														value: row.percent,
														color: row.mine ? 'var(--color-primary)' : 'var(--color-muted)',
														highlight: row.mine
													}))}
												/>
											</div>
										{/if}
									</div>
									{#if fact.chart?.kind === 'duel'}
										<div class="flex shrink-0 flex-col items-center gap-0.5">
											<Donut
												segments={[
													{
														value: fact.chart.playerPercent,
														color:
															fact.kind === 'victory'
																? 'var(--color-positive)'
																: 'var(--color-danger)',
														label: 'Vous'
													},
													{
														value: 100 - fact.chart.playerPercent,
														color: 'var(--color-muted)',
														label: fact.chart.rival
													}
												]}
												center="{fact.chart.playerPercent} %"
												label="Vous {fact.chart.playerPercent} %, {fact.chart.rival} {100 -
													fact.chart.playerPercent} %"
											/>
											<span class="max-w-28 text-center text-[11px] leading-tight text-muted">
												vs {fact.chart.rival}
											</span>
										</div>
									{/if}
								</div>
								{#if fact.record && fact.record.won + fact.record.lost > 0}
									{@const total = fact.record.won + fact.record.lost}
									<div
										class="mt-2 flex items-center gap-3 border-t border-line pt-2"
										data-testid="note-record"
									>
										<Donut
											size={44}
											segments={[
												{
													value: fact.record.won,
													color: 'var(--color-positive)',
													label: 'Victoires'
												},
												{ value: fact.record.lost, color: 'var(--color-danger)', label: 'Défaites' }
											]}
											center="{fact.record.won}/{total}"
											label="{fact.record.won} victoire(s), {fact.record.lost} défaite(s)"
										/>
										<p class="text-xs text-muted">
											Bilan électoral de votre carrière :
											<span class="font-semibold text-positive">
												{fact.record.won} victoire{fact.record.won > 1 ? 's' : ''}
											</span>
											·
											<span class="font-semibold text-danger">
												{fact.record.lost} défaite{fact.record.lost > 1 ? 's' : ''}
											</span>
										</p>
									</div>
								{/if}
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
					Et {note.journalLines} autre{note.journalLines > 1 ? 's' : ''} ligne{note.journalLines > 1
						? 's'
						: ''} au journal (revenus, charges, presse).
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
