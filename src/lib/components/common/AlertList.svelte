<script lang="ts">
	import { Info, OctagonExclamationPoint, TriangleExclamationPoint } from '@lucide/svelte';
	import type { Alert } from '#lib/game/app/view-model.ts';

	/**
	 * Alertes à trois niveaux visuels (P3-26, DESIGN.md §10.6) : critique en aplat,
	 * à traiter encadrée, information discrète. Chaque niveau a son icône et son
	 * mot : la couleur ne porte jamais seule le sens.
	 */
	interface Props {
		alerts: readonly Alert[];
	}

	let { alerts }: Props = $props();

	const LEVELS = {
		danger: {
			word: 'Urgent',
			icon: OctagonExclamationPoint,
			box: 'bg-danger text-surface',
			accent: 'text-surface'
		},
		warning: {
			word: 'À traiter',
			icon: TriangleExclamationPoint,
			box: 'border border-l-4 border-warning bg-surface text-ink',
			accent: 'text-warning'
		},
		info: {
			word: 'Information',
			icon: Info,
			box: 'border border-line text-muted',
			accent: 'text-primary'
		}
	} as const;
</script>

{#if alerts.length === 0}
	<p class="text-sm text-muted">Aucune alerte.</p>
{:else}
	<ul class="flex flex-col gap-1.5">
		{#each alerts as alert, index (index)}
			{@const level = LEVELS[alert.level]}
			<li
				class="grid grid-cols-[auto_minmax(0,1fr)] gap-2 rounded px-3 py-2 text-sm leading-snug {level.box}"
				data-level={alert.level}
			>
				<level.icon class="mt-0.5 size-4 shrink-0 {level.accent}" aria-hidden="true" />
				<p>
					<span class="block text-[11px] font-bold tracking-wider uppercase {level.accent}">
						{level.word}<span class="sr-only"> :</span>
					</span>
					{alert.text}
				</p>
			</li>
		{/each}
	</ul>
{/if}
