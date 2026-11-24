<script lang="ts">
	import { Info, OctagonExclamationPoint, TriangleExclamationPoint } from '@lucide/svelte';
	import type { Alert } from '#lib/game/app/view-model.ts';

	interface Props {
		alerts: readonly Alert[];
	}

	let { alerts }: Props = $props();

	const prefix: Record<Alert['level'], string> = {
		danger: 'Urgent',
		warning: 'Attention',
		info: 'Information'
	};
</script>

{#if alerts.length === 0}
	<p class="text-sm text-muted">Aucune alerte.</p>
{:else}
	<ul class="flex flex-col gap-2">
		{#each alerts as alert, index (index)}
			<li
				class="flex gap-2 rounded border-l-4 bg-surface px-3 py-2 text-sm leading-snug {alert.level ===
				'danger'
					? 'border-danger'
					: alert.level === 'warning'
						? 'border-warning'
						: 'border-primary'}"
			>
				{#if alert.level === 'danger'}
					<OctagonExclamationPoint class="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
				{:else if alert.level === 'warning'}
					<TriangleExclamationPoint
						class="mt-0.5 size-4 shrink-0 text-warning"
						aria-hidden="true"
					/>
				{:else}
					<Info class="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
				{/if}
				<span><span class="font-semibold">{prefix[alert.level]} :</span> {alert.text}</span>
			</li>
		{/each}
	</ul>
{/if}
