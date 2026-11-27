<script lang="ts">
	import type { BallotReportView } from '#lib/game/app/view-model.ts';

	/** Procès-verbal d'un scrutin (P3-29), même présentation avec ou sans le joueur. */
	let { report, compact = false }: { report: BallotReportView; compact?: boolean } = $props();
</script>

<div class="flex flex-col gap-1" data-testid="ballot-report">
	{#if !compact}
		<p class="text-xs text-muted">{report.summary}</p>
	{/if}
	<div class="overflow-x-auto">
		<table class="w-full text-xs tabular-nums">
			<caption class="sr-only">{report.title}, {report.dateLabel}</caption>
			<thead>
				<tr class="border-b border-line text-left text-muted">
					<th scope="col" class="py-1 pr-2 font-medium">Candidature</th>
					<th scope="col" class="py-1 pr-2 text-right font-medium">1er tour</th>
					{#if report.secondRound && !report.pending}
						<th scope="col" class="py-1 pr-2 text-right font-medium">2d tour</th>
					{/if}
					{#if report.showSeats}
						<th scope="col" class="py-1 pr-2 text-right font-medium">Sièges</th>
					{/if}
					<th scope="col" class="py-1 font-medium">Issue</th>
				</tr>
			</thead>
			<tbody>
				{#each report.rows as row (row.key)}
					<tr
						class="border-b border-line/60 last:border-0 {row.mine
							? 'bg-primary/10 font-semibold'
							: ''}"
					>
						<th scope="row" class="py-1 pr-2 text-left font-normal">
							<span class={row.mine ? 'font-semibold' : ''}>{row.name}</span>
							<span class="text-muted"> · {row.label}</span>
						</th>
						<td class="py-1 pr-2 text-right">{row.firstRound}</td>
						{#if report.secondRound && !report.pending}
							<td class="py-1 pr-2 text-right">{row.secondRound ?? '—'}</td>
						{/if}
						{#if report.showSeats}
							<td class="py-1 pr-2 text-right">{row.seats}</td>
						{/if}
						<td class="py-1 {row.winner ? 'font-semibold text-positive' : 'text-muted'}">
							{row.outcome}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	{#if report.verdict}
		<p class="text-xs font-medium">{report.verdict}</p>
	{/if}
</div>
