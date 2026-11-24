<script lang="ts">
	import {
		BookOpen,
		Briefcase,
		Calendar,
		Landmark,
		LayoutDashboard,
		Newspaper
	} from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import AlertList from '#lib/components/common/AlertList.svelte';
	import Gauge from '#lib/components/common/Gauge.svelte';
	import type { GameSession } from '#lib/game/app/session.svelte.ts';
	import SaveBanner from './SaveBanner.svelte';
	import type { GameTab } from './tabs.ts';
	import TurnControls from './TurnControls.svelte';

	/**
	 * Coque de partie (DESIGN.md §3) : en-tête avec date, âge, ressources et jauges ;
	 * navigation à gauche ; contenu central défilant ; alertes et presse à droite
	 * (repliées dans le contenu sous 1 100 px) ; barre d'avance toujours visible.
	 */
	interface Props {
		session: GameSession;
		tab: GameTab;
		onTab: (tab: GameTab) => void;
		children: Snippet;
	}

	let { session, tab, onTab, children }: Props = $props();
	const view = $derived(session.snapshot.view);

	const tabs: { id: GameTab; label: string; icon: typeof Calendar }[] = [
		{ id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
		{ id: 'agenda', label: 'Agenda', icon: Calendar },
		{ id: 'organisation', label: 'Organisation', icon: Briefcase },
		{ id: 'journal', label: 'Journal', icon: BookOpen }
	];
</script>

<a
	href="#contenu"
	class="sr-only z-20 rounded bg-primary px-4 py-2 text-surface focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
>
	Aller au contenu principal
</a>

{#if view}
	<div class="grid h-dvh grid-rows-[auto_1fr_auto]">
		<header class="border-b border-line bg-surface px-5 py-3">
			<div class="flex flex-wrap items-center gap-x-6 gap-y-2">
				<div class="flex items-center gap-2">
					<Landmark class="size-5 shrink-0 text-primary" aria-hidden="true" />
					<h1 class="text-base font-bold tracking-wide text-primary uppercase">
						La République, c’est moi !
					</h1>
				</div>
				<p class="font-serif text-lg" data-testid="game-date">
					<span class="font-semibold">{view.dateLabel}</span> · {view.age} ans
				</p>
				<dl class="flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label="Ressources">
					{#each view.resources as resource (resource.id)}
						<div class="flex items-baseline gap-1.5">
							<dt class="text-muted">{resource.name}</dt>
							<dd class="font-semibold tabular-nums" data-testid="resource-{resource.id}">
								{resource.value}
							</dd>
						</div>
					{/each}
				</dl>
				<div class="ml-auto flex gap-5">
					<Gauge name="Santé" gauge={view.health} compact />
					<Gauge name="Stress" gauge={view.stress} compact />
				</div>
			</div>
		</header>

		<div class="grid min-h-0 grid-cols-[200px_1fr] min-[1100px]:grid-cols-[200px_1fr_280px]">
			<nav aria-label="Écrans de la partie" class="border-r border-line bg-sidebar p-3">
				<ul class="flex flex-col gap-1">
					{#each tabs as item (item.id)}
						<li>
							<button
								type="button"
								class="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm {tab ===
								item.id
									? 'bg-primary text-surface'
									: 'hover:bg-surface'}"
								aria-current={tab === item.id ? 'page' : undefined}
								onclick={() => onTab(item.id)}
							>
								<item.icon class="size-4 shrink-0" aria-hidden="true" />
								{item.label}
							</button>
						</li>
					{/each}
				</ul>
			</nav>

			<main id="contenu" tabindex="-1" class="min-h-0 overflow-y-auto p-5 focus:outline-none">
				<SaveBanner {session} />
				<section class="mb-4 min-[1100px]:hidden" aria-label="Alertes">
					<AlertList alerts={view.alerts} />
				</section>
				{@render children()}
			</main>

			<aside
				class="hidden min-h-0 overflow-y-auto border-l border-line bg-sidebar p-4 min-[1100px]:block"
				aria-label="Alertes et presse"
			>
				<h2 class="section-title">Alertes</h2>
				<div class="mt-2">
					<AlertList alerts={view.alerts} />
				</div>
				<h2 class="section-title mt-6 flex items-center gap-2">
					<Newspaper class="size-4" aria-hidden="true" /> La presse
				</h2>
				{#if view.press.length === 0}
					<p class="mt-2 text-sm text-muted">Pas encore de nouvelles.</p>
				{:else}
					<ul class="mt-2 flex flex-col gap-2">
						{#each view.press as item (item.key)}
							<li class="rounded bg-surface px-3 py-2 text-sm">
								<span class="block text-xs text-muted">{item.dateLabel}</span>
								<span class="font-serif">{item.title}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</aside>
		</div>

		<TurnControls {session} {onTab} />
	</div>
{/if}
