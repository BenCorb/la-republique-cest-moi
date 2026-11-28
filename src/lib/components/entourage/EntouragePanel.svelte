<script lang="ts">
	import { Coffee, FileSearch, Lock, Search, UserMinus, UserPlus } from '@lucide/svelte';
	import type { GameSession } from '#lib/game/app/session.svelte.ts';

	/**
	 * Entourage (P2-05, P3-20) : attractivité de la carrière et masse salariale,
	 * postes clés, titulaires (salaire convenu) et missions persistantes, candidats
	 * présélectionnés (compétence, traits connus, salaire demandé), entretien
	 * approfondi et trois offres avec l'intérêt estimé du candidat. Offres et
	 * renvoi s'ajoutent au plan ; le candidat ne répond qu'en fin de trimestre.
	 * Recrutement II (P3-21) : recherche à trois niveaux pour un poste vacant
	 * (trait public facultatif), vérification de dossier (indices, jamais de
	 * certitude), progression des collaborateurs et prétention actuelle.
	 */
	interface Props {
		session: GameSession;
	}

	let { session }: Props = $props();
	const entourage = $derived(session.snapshot.view?.entourage ?? null);
	const planning = $derived(session.snapshot.view?.phase === 'planning');

	/** Trait exigé par la prochaine recherche, par poste (brouillon d'interface). */
	let soughtTrait = $state<Record<string, string>>({});
	const searchTarget = (postId: string, traitAllowed: boolean): string => {
		const trait = soughtTrait[postId] ?? '';
		return traitAllowed && trait !== '' ? `${postId}/${trait}` : postId;
	};

	const toneClass = {
		good: 'text-positive',
		neutral: 'text-ink',
		warning: 'text-warning',
		danger: 'text-danger'
	} as const;
</script>

{#if entourage}
	<div class="flex flex-col gap-5">
		<section
			class="card flex flex-wrap items-start justify-between gap-4"
			data-testid="recruitment-summary"
		>
			<div>
				<h2 class="section-title">Attractivité de votre équipe</h2>
				<p class="mt-1 font-display text-xl font-bold text-primary" data-testid="attractiveness">
					{entourage.attractiveness.label}
				</p>
				<p class="text-xs text-muted">{entourage.attractiveness.factors.join(' · ')}</p>
			</div>
			<div class="text-right">
				<h2 class="section-title">Masse salariale</h2>
				<p class="mt-1 font-semibold tabular-nums" data-testid="payroll">
					{entourage.payroll.total}
				</p>
				{#if entourage.payroll.covered}
					<p class="text-xs text-muted">{entourage.payroll.covered}</p>
				{/if}
			</div>
		</section>
		<p class="text-sm text-muted">
			Un collaborateur embauché travaille à partir du trimestre suivant ; son salaire convenu est
			prélevé sur le budget politique, et un salaire impayé suspend sa mission et entame sa loyauté.
			Un candidat peut décliner votre offre : il répond en fin de trimestre, selon l’attractivité de
			votre équipe, l’offre et vos entretiens. Une prime n’est versée que s’il accepte.
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
									: ' · au travail dès le trimestre prochain'} · {occupant.salary}
							</p>
							{#if occupant.asked || occupant.progressing}
								<p class="text-xs text-muted" data-testid="progression">
									{occupant.progressing
										? 'Progresse en poste'
										: 'Au sommet de son art'}{occupant.asked
										? ` · vaudrait désormais ${occupant.asked}`
										: ''}
								</p>
							{/if}
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
												disabled={!planning}
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
											disabled={!occupant.dismissable}
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
									<p class="mt-1 text-xs">Salaire demandé : {candidate.asked}</p>
									{#if candidate.counter}
										<p class="mt-1 text-xs font-medium text-warning" data-testid="counter-offer">
											{candidate.counter}
										</p>
									{/if}
									{#if candidate.hints !== null}
										<p class="mt-1 text-xs" data-testid="hints">
											<span class="font-semibold">Références :</span>
											{candidate.hints.length > 0
												? `on lui prête ${candidate.hints.map((hint) => hint.toLowerCase()).join(', ')} (indices, à confirmer)`
												: 'rien de particulier à signaler, ce qui ne prouve rien'}
										</p>
									{:else if entourage.vetActionId}
										<div class="mt-1 flex flex-wrap items-center justify-between gap-2">
											<span class="text-xs text-muted">
												{candidate.vetPlanned
													? 'Vérification du dossier prévue ce trimestre'
													: 'Dossier non vérifié'}
											</span>
											{#if !candidate.vetPlanned}
												<button
													type="button"
													class="btn-secondary btn-small"
													disabled={!candidate.vettable}
													title={candidate.vetReason ?? undefined}
													aria-label="Vérifier le dossier de {candidate.name}"
													onclick={() =>
														entourage.vetActionId &&
														session.controller.addStep({
															kind: 'action',
															id: entourage.vetActionId,
															target: candidate.characterId
														})}
												>
													<FileSearch class="size-3.5" aria-hidden="true" /> Vérifier
												</button>
											{/if}
										</div>
									{/if}
									{#if entourage.interviewActionId}
										<div class="mt-2 flex flex-wrap items-center justify-between gap-2">
											<span class="text-xs text-muted">
												{candidate.interviews > 0
													? `${candidate.interviews} entretien${candidate.interviews > 1 ? 's' : ''} approfondi${candidate.interviews > 1 ? 's' : ''} mené${candidate.interviews > 1 ? 's' : ''}`
													: 'Pas encore reçu en entretien approfondi'}{candidate.interviewPlanned
													? ' · entretien prévu ce trimestre'
													: ''}
											</span>
											<button
												type="button"
												class="btn-secondary btn-small"
												disabled={!candidate.interviewable}
												title={candidate.interviewReason ?? undefined}
												aria-label="Prévoir un entretien approfondi avec {candidate.name}"
												onclick={() =>
													entourage.interviewActionId &&
													session.controller.addStep({
														kind: 'action',
														id: entourage.interviewActionId,
														target: candidate.characterId
													})}
											>
												<Coffee class="size-3.5" aria-hidden="true" /> Entretien
											</button>
										</div>
									{/if}
									<ul class="mt-2 grid gap-1.5" aria-label="Offres possibles à {candidate.name}">
										{#each candidate.offers as offer (offer.actionId)}
											<li
												class="flex flex-wrap items-center justify-between gap-2 rounded border border-line bg-surface px-2 py-1.5"
												data-testid="offer-{offer.offer}"
											>
												<span class="min-w-0">
													<span class="font-medium">{offer.label}</span>
													<span class="text-xs text-muted">
														· {offer.salary}{offer.bonus ? ` · ${offer.bonus}` : ''}
													</span>
													<span class="block text-xs font-semibold {toneClass[offer.interestTone]}">
														Intérêt estimé : {offer.interest.toLowerCase()}
													</span>
													{#if offer.reason && !offer.planned}
														<span class="block text-xs text-warning">{offer.reason}</span>
													{/if}
												</span>
												{#if offer.planned}
													<span class="text-xs text-muted">Offre prévue ce trimestre.</span>
												{:else if !candidate.planned}
													<button
														type="button"
														class="btn-secondary btn-small"
														disabled={!offer.addable}
														aria-label="{offer.label} à {candidate.name}"
														onclick={() =>
															session.controller.addStep({
																kind: 'action',
																id: offer.actionId,
																target: candidate.characterId
															})}
													>
														<UserPlus class="size-3.5" aria-hidden="true" /> Proposer
													</button>
												{/if}
											</li>
										{/each}
									</ul>
								</li>
							{/each}
						</ul>
					{/if}
					{#if post.search}
						{@const search = post.search}
						<section
							class="rounded border border-dashed border-line p-3"
							aria-label="Recherche de candidats : {post.label}"
							data-testid="search-{post.id}"
						>
							<h3 class="flex items-center gap-1.5 text-xs font-semibold text-muted uppercase">
								<Search class="size-3.5" aria-hidden="true" /> Rechercher des candidats
							</h3>
							{#if search.inProgress}
								<p class="mt-1 text-sm">
									{search.inProgress.label} en cours, {search.inProgress.due}.
								</p>
							{:else}
								<label class="mt-2 flex flex-wrap items-center gap-2 text-xs">
									<span>Trait recherché (recherche ciblée ou chasse de tête)</span>
									<select
										class="rounded border border-line bg-surface px-1.5 py-0.5"
										bind:value={soughtTrait[post.id]}
										disabled={!planning}
									>
										<option value="">Aucun</option>
										{#each search.traits as trait (trait.id)}
											<option value={trait.id}>{trait.label}</option>
										{/each}
									</select>
								</label>
								<ul class="mt-2 grid gap-1.5">
									{#each search.options as option (option.actionId)}
										{@const withTrait = option.traitAllowed && (soughtTrait[post.id] ?? '') !== ''}
										<li
											class="flex flex-wrap items-center justify-between gap-2 rounded bg-sidebar px-2 py-1.5"
											data-testid="search-{option.level}"
										>
											<span class="min-w-0 text-xs">
												<span class="text-sm font-medium">{option.label}</span>
												<span class="text-muted">
													· {option.cost} · {option.time} pts de temps · {option.due}
												</span>
												<span class="block">
													{withTrait ? option.chanceWithTrait : option.chance}{option.vetted
														? ' · dossiers vérifiés'
														: ''} · {option.refund}
												</span>
												{#if option.reason && !option.planned}
													<span class="block text-warning">{option.reason}</span>
												{/if}
											</span>
											{#if option.planned}
												<span class="text-xs text-muted">Prévue ce trimestre.</span>
											{:else}
												<button
													type="button"
													class="btn-secondary btn-small"
													disabled={!option.addable}
													aria-label="{option.label} pour le poste {post.label}"
													onclick={() =>
														session.controller.addStep({
															kind: 'action',
															id: option.actionId,
															target: searchTarget(post.id, option.traitAllowed)
														})}
												>
													<Search class="size-3.5" aria-hidden="true" /> Lancer
												</button>
											{/if}
										</li>
									{/each}
								</ul>
							{/if}
						</section>
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
