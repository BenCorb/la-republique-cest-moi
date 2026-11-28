<script lang="ts">
	import Avatar from '#lib/components/common/Avatar.svelte';
	import TierBadge from '#lib/components/common/TierBadge.svelte';
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

	/** Palier d'attitude (P3-27) : le mot est écrit, la couleur le souligne. */
	const toneColor = {
		good: 'var(--color-positive)',
		neutral: 'var(--color-res-time)',
		warning: 'var(--color-warning)',
		danger: 'var(--color-danger)'
	} as const;

	/** Liseré du médaillon selon le rôle public. */
	function ringOf(role: string): 'family' | 'party' | 'rival' | 'staff' | 'media' | 'other' {
		const lower = role.toLocaleLowerCase('fr');
		if (lower.startsWith('famille')) return 'family';
		if (lower.includes('adversaire') || lower.includes('rival')) return 'rival';
		if (lower.includes('journal') || lower.includes('presse')) return 'media';
		if (lower.includes('parti') || lower.includes('dirigeant')) return 'party';
		if (lower.includes('collabor') || lower.includes('équipe')) return 'staff';
		return 'other';
	}
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
					<div class="flex items-start gap-3">
						<Avatar id={person.id} name={person.name} role={ringOf(person.role)} />
						<div class="flex-1">
							<h3 class="font-serif text-base">{person.name}</h3>
							<p class="text-xs text-muted">
								{person.role} · {person.age} ans · {person.status}
							</p>
						</div>
						<span class="shrink-0" title="Attitude envers vous">
							<TierBadge
								label={`Attitude : ${person.attitude.toLowerCase()}`}
								color={toneColor[person.attitudeTone]}
							/>
						</span>
					</div>
					<ul class="flex flex-wrap gap-1.5 text-xs" aria-label="Traits">
						{#each person.knownTraits as trait (trait.label)}
							<li
								class="rounded-full border border-line bg-surface px-2 py-0.5 font-medium"
								title={trait.description}
							>
								{trait.label}
							</li>
						{/each}
						{#each Array.from({ length: person.unknownTraits }, (_, index) => index) as index (index)}
							<li
								class="rounded-full border border-dashed border-line px-2 py-0.5 text-muted"
								title="Trait encore à découvrir"
							>
								?<span class="sr-only"> trait encore à découvrir</span>
							</li>
						{/each}
						{#if person.knownTraits.length === 0 && person.unknownTraits === 0}
							<li class="text-muted">Aucun trait connu.</li>
						{/if}
					</ul>
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
