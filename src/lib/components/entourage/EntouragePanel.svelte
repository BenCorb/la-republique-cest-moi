<script lang="ts">
	import { Lock, UserMinus, UserPlus } from '@lucide/svelte';
	import type { GameSession } from '#lib/game/app/session.svelte.ts';

	/**
	 * Entourage (P2-05) : postes clés, titulaires et missions persistantes,
	 * candidats présélectionnés (CV : compétence et traits connus). Embauche et
	 * renvoi s'ajoutent au plan ; le changement de mission est immédiat.
	 */
	interface Props {
		session: GameSession;
	}

	let { session }: Props = $props();
	const entourage = $derived(session.snapshot.view?.entourage ?? null);
	const planning = $derived(session.snapshot.view?.phase === 'planning');
	const accelerating = $derived(session.snapshot.acceleration?.running === true);

	const toneClass = {
		good: 'text-positive',
		neutral: 'text-ink',
		warning: 'text-warning',
		danger: 'text-danger'
	} as const;
</script>

{#if entourage}
	<div class="flex flex-col gap-5">
		<p class="text-sm text-muted">
			Un collaborateur embauché travaille à partir du trimestre suivant ; son salaire est prélevé
			sur le budget politique, et un salaire impayé suspend sa mission et entame sa loyauté.
			{#if entourage.timeBonus > 0}
				Ce trimestre, votre entourage vous rend {entourage.timeBonus} points de temps.
			{/if}
		</p>
		<ul class="grid gap-4 xl:grid-cols-2">
			{#each entourage.posts as post (post.id)}
				<li class="card flex flex-col gap-3" data-testid="post-{post.id}">
					<div class="flex items-start justify-between gap-3">
						<div>
							<h2 class="font-serif text-lg">{post.label}</h2>
							<p class="text-xs text-muted">{post.description}</p>
						</div>
						<span class="shrink-0 rounded bg-sidebar px-2 py-0.5 text-xs">{post.salary}</span>
					</div>

					{#if post.occupant}
						{@const occupant = post.occupant}
						<div class="rounded border border-line p-3">
							<div class="flex items-baseline justify-between gap-3">
								<h3 class="font-medium">{occupant.name}, {occupant.age} ans</h3>
								<span class="text-sm font-semibold {toneClass[occupant.attitudeTone]}">
									Attitude : {occupant.attitude.toLowerCase()}
								</span>
							</div>
							<p class="text-xs text-muted">
								{occupant.since}{occupant.producing
									? ''
									: ' · au travail dès le trimestre prochain'}
							</p>
							<p class="text-sm">
								Compétence : <span class="font-medium">{occupant.competence.label}</span>
								{#if occupant.knownTraits.length > 0}· {occupant.knownTraits.join(' · ')}{/if}
								{#if occupant.unknownTraits > 0}
									<span class="text-xs text-muted">
										— {occupant.unknownTraits} trait{occupant.unknownTraits > 1 ? 's' : ''} encore à découvrir
									</span>
								{/if}
							</p>
							<fieldset class="mt-2">
								<legend class="text-xs font-semibold text-muted uppercase">Mission</legend>
								<div class="mt-1 flex flex-col gap-1">
									{#each occupant.missions as mission (mission.id)}
										<label class="flex items-start gap-2 text-sm">
											<input
												type="radio"
												name="mission-{post.id}"
												checked={mission.active}
												disabled={!planning || accelerating}
												onchange={() =>
													session.controller.assignMission(occupant.characterId, mission.id)}
											/>
											<span>
												<span class="font-medium">{mission.label}</span>
												<span class="block text-xs text-muted">{mission.description}</span>
											</span>
										</label>
									{/each}
								</div>
							</fieldset>
							{#if entourage.dismissActionId}
								<div class="mt-2 flex flex-wrap items-center justify-end gap-2">
									{#if occupant.dismissPlanned}
										<span class="text-xs text-muted">Départ prévu ce trimestre.</span>
									{:else}
										{#if occupant.dismissReason}
											<span class="text-xs text-warning">{occupant.dismissReason}</span>
										{/if}
										<button
											type="button"
											class="btn-secondary btn-small"
											disabled={!occupant.dismissable || accelerating}
											aria-label="Prévoir le départ de {occupant.name}"
											onclick={() =>
												entourage.dismissActionId &&
												session.controller.addStep({
													kind: 'action',
													id: entourage.dismissActionId,
													target: occupant.characterId
												})}
										>
											<UserMinus class="size-3.5" aria-hidden="true" /> Se séparer
										</button>
									{/if}
								</div>
							{/if}
						</div>
					{:else if post.lockedReason}
						<p class="flex items-center gap-2 text-sm text-muted">
							<Lock class="size-4" aria-hidden="true" />
							{post.lockedReason}
						</p>
					{:else if post.candidates.length === 0}
						<p class="text-sm text-muted">Des candidatures arriveront au prochain trimestre.</p>
					{:else}
						<ul class="flex flex-col gap-2">
							{#each post.candidates as candidate (candidate.characterId)}
								<li
									class="rounded bg-sidebar p-3 text-sm"
									data-testid="candidate-{candidate.characterId}"
								>
									<div class="flex items-baseline justify-between gap-3">
										<span class="font-medium">{candidate.name}, {candidate.age} ans</span>
										<span class="text-xs">Compétence : {candidate.competence.label}</span>
									</div>
									<p class="text-xs text-muted">
										{candidate.profile}{candidate.knownTraits.length > 0
											? ` · ${candidate.knownTraits.join(' · ')}`
											: ''}{candidate.unknownTraits > 0
											? ` · ${candidate.unknownTraits} trait${candidate.unknownTraits > 1 ? 's' : ''} inconnu${candidate.unknownTraits > 1 ? 's' : ''}`
											: ''}
									</p>
									<div class="mt-2 flex flex-wrap items-center justify-end gap-2">
										{#if candidate.planned}
											<span class="text-xs text-muted">Recrutement prévu ce trimestre.</span>
										{:else}
											{#if candidate.reason}
												<span class="text-xs text-warning">{candidate.reason}</span>
											{/if}
											<button
												type="button"
												class="btn-secondary btn-small"
												disabled={!candidate.hireable || accelerating}
												aria-label="Prévoir le recrutement de {candidate.name}"
												onclick={() =>
													entourage.hireActionId &&
													session.controller.addStep({
														kind: 'action',
														id: entourage.hireActionId,
														target: candidate.characterId
													})}
											>
												<UserPlus class="size-3.5" aria-hidden="true" /> Recruter
											</button>
										{/if}
									</div>
								</li>
							{/each}
						</ul>
					{/if}
				</li>
			{/each}
		</ul>
		{#if entourage.former.length > 0}
			<section class="card" aria-labelledby="anciens-title">
				<h2 id="anciens-title" class="section-title">Anciens collaborateurs</h2>
				<ul class="mt-2 text-sm">
					{#each entourage.former as former, index (index)}
						<li>{former.name} — {former.post}, {former.period}</li>
					{/each}
				</ul>
			</section>
		{/if}
	</div>
{/if}
