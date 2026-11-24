<script lang="ts">
	import type { GameSession } from '#lib/game/app/session.svelte.ts';

	/**
	 * Relations (P2-04) : personnages rencontrés, tendance de leur attitude,
	 * traits connus et souvenirs. Les traits cachés et l'attitude chiffrée ne sont
	 * jamais affichés.
	 */
	interface Props {
		session: GameSession;
	}

	let { session }: Props = $props();
	const people = $derived(session.snapshot.view?.people ?? []);

	const toneClass = {
		good: 'text-positive',
		neutral: 'text-ink',
		warning: 'text-warning',
		danger: 'text-danger'
	} as const;
</script>

<section aria-labelledby="relations-title">
	<h2 id="relations-title" class="section-title">Relations</h2>
	{#if people.length === 0}
		<p class="mt-2 text-sm text-muted">
			Vous n’avez encore croisé personne de marquant. Les événements vous feront rencontrer des
			journalistes, des donateurs, des militants… qui se souviendront de vous.
		</p>
	{:else}
		<ul class="mt-3 grid gap-3 xl:grid-cols-2">
			{#each people as person (person.id)}
				<li
					class="card flex flex-col gap-2 {person.active ? '' : 'opacity-75'}"
					data-testid="person-{person.id}"
				>
					<div class="flex items-start justify-between gap-3">
						<div>
							<h3 class="font-serif text-base">{person.name}</h3>
							<p class="text-xs text-muted">
								{person.role} · {person.age} ans · {person.status}
							</p>
						</div>
						<span class="shrink-0 text-sm font-semibold {toneClass[person.attitudeTone]}">
							Attitude : {person.attitude.toLowerCase()}
						</span>
					</div>
					<p class="text-sm">
						{#if person.knownTraits.length === 0}
							<span class="text-muted">Aucun trait connu.</span>
						{:else}
							{#each person.knownTraits as trait, index (trait.label)}
								<span class="font-medium" title={trait.description}>{trait.label}</span>{index <
								person.knownTraits.length - 1
									? ' · '
									: ''}
							{/each}
						{/if}
						{#if person.unknownTraits > 0}
							<span class="text-xs text-muted">
								— {person.unknownTraits} trait{person.unknownTraits > 1 ? 's' : ''} encore à découvrir
							</span>
						{/if}
					</p>
					{#if person.memories.length > 0}
						<div>
							<h4 class="text-xs font-semibold text-muted uppercase">Ce dont on se souvient</h4>
							<ul class="mt-1 flex flex-col gap-0.5 text-sm">
								{#each person.memories as memory, index (index)}
									<li><span class="text-muted">{memory.dateLabel} —</span> {memory.text}</li>
								{/each}
							</ul>
						</div>
					{/if}
					<p class="mt-auto text-xs text-muted">{person.metLabel}</p>
				</li>
			{/each}
		</ul>
	{/if}
</section>
