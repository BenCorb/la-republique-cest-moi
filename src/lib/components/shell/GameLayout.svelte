<script lang="ts">
	import {
		BadgeCheck,
		BookOpen,
		Briefcase,
		Calendar,
		Flag,
		Award,
		Bell,
		Landmark,
		LayoutDashboard,
		MapPin,
		Newspaper,
		Users,
		UsersRound,
		Wallet
	} from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import AlertList from '#lib/components/common/AlertList.svelte';
	import type { GameSession } from '#lib/game/app/session.svelte.ts';
	import SaveBanner from './SaveBanner.svelte';
	import HeaderStat from './HeaderStat.svelte';
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
		{ id: 'career', label: 'Carrière', icon: Award },
		{ id: 'world', label: 'Monde politique', icon: Flag },
		{ id: 'news', label: 'Actualités', icon: Newspaper },
		{ id: 'entourage', label: 'Entourage', icon: UsersRound },
		{ id: 'relations', label: 'Relations', icon: Users },
		{ id: 'organisation', label: 'Organisation', icon: Briefcase },
		{ id: 'wealth', label: 'Patrimoine', icon: Wallet },
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
		<header class="border-b border-line bg-surface">
			<div class="tricolor-rule h-1" aria-hidden="true"></div>
			<!-- Bande d'identité : marque alignée sur la navigation, puis le personnage. -->
			<div class="grid h-9 grid-cols-[200px_minmax(0,1fr)] items-center border-b border-line">
				<h1
					class="flex items-center gap-1.5 px-5 text-[11px] font-bold tracking-wider whitespace-nowrap text-primary uppercase"
				>
					<Landmark class="size-3.5 shrink-0" aria-hidden="true" />
					La République, c’est moi !
				</h1>
				<div class="flex min-w-0 items-center gap-4 px-4 text-sm">
					<span
						class="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2 py-px text-xs font-semibold text-surface"
						data-testid="header-function"
					>
						<BadgeCheck class="size-3" aria-hidden="true" />
						<span class="sr-only">Fonction</span>
						{view.career.mainFunction}
					</span>
					<span class="inline-flex shrink-0 items-center gap-1.5" data-testid="header-party">
						<Flag class="size-3.5 text-muted" aria-hidden="true" />
						<span class="text-muted">Étiquette</span>
						<span class="font-semibold">{view.world.partyAcronym ?? 'aucune'}</span>
					</span>
					<span
						class="inline-flex min-w-0 items-center gap-1.5"
						data-testid="header-territory"
						title={view.territory.description}
					>
						<MapPin class="size-3.5 shrink-0 text-muted" aria-hidden="true" />
						<span class="sr-only">Origine</span>
						<span class="truncate">
							<span class="font-semibold">{view.territory.town}</span>
							<span class="text-muted">
								({view.territory.department}, {view.territory.region})
							</span>
						</span>
					</span>
				</div>
			</div>
			<!-- Bande des indicateurs : date dans la colonne de la navigation, puis six cellules égales. -->
			<div class="grid grid-cols-[200px_minmax(0,1fr)]">
				<div class="flex flex-col justify-center gap-1 border-r border-line px-5 py-2.5">
					<p class="text-[11px] font-bold tracking-wider text-muted uppercase" aria-hidden="true">
						Trimestre
					</p>
					<p data-testid="game-date" class="leading-none">
						<span class="block font-display text-xl font-bold">{view.dateLabel}</span><span
							class="sr-only"
						>
							&nbsp;·&nbsp;
						</span><span class="mt-1 block text-xs text-muted">{view.age} ans</span>
					</p>
				</div>
				<dl
					class="grid grid-cols-6 divide-x divide-line max-[1100px]:grid-cols-3"
					aria-label="Ressources et jauges"
				>
					{#each view.resources as resource (resource.id)}
						<HeaderStat
							identity={resource.id}
							label={resource.name}
							value={resource.value}
							forecast={{ text: resource.forecast, trend: resource.trend }}
							testId="resource-{resource.id}"
						/>
					{/each}
					<HeaderStat
						identity="popularity"
						label="Popularité"
						value={String(view.supports.popularity.value)}
						gauge={view.supports.popularity}
					/>
					<HeaderStat
						identity="player.health"
						label="Santé"
						value={String(view.health.value)}
						gauge={view.health}
					/>
					<HeaderStat
						identity="player.stress"
						label="Stress"
						value={String(view.stress.value)}
						gauge={view.stress}
						gaugeForecast={view.phase === 'planning' ? view.plan.stressAfter.value : null}
					/>
				</dl>
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
				<h2 class="section-title flex items-center gap-2">
					<Bell class="size-4" aria-hidden="true" /> Alertes
				</h2>
				<div class="mt-2">
					<AlertList alerts={view.alerts} />
				</div>
				<h2 class="section-title mt-6 flex items-center gap-2">
					<Newspaper class="size-4" aria-hidden="true" /> La presse
				</h2>
				{#if view.press.length === 0}
					<p class="mt-2 text-sm text-muted">Pas encore de nouvelles.</p>
				{:else}
					<ul class="mt-2 flex flex-col gap-2.5">
						{#each view.press as item (item.key)}
							<li
								class="rounded-sm bg-surface px-3 py-2 text-sm shadow-sm shadow-ink/10 {item.critical
									? 'border-l-2 border-warning'
									: ''}"
								data-testid="press-item"
							>
								<span class="flex items-baseline justify-between gap-2 text-xs">
									<span class="font-display font-bold tracking-wide text-ink uppercase">
										{item.media}
									</span>
									<span class="shrink-0 text-muted">{item.dateLabel}</span>
								</span>
								<span class="mt-0.5 block font-serif">{item.title}</span>
								<span class="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
									<span
										class="rounded-full border px-1.5 {item.critical
											? 'border-warning text-warning'
											: 'border-line text-muted'}"
									>
										{item.toneLabel ?? 'Ambiance'}
									</span>
									{#if item.effects}<span class="text-muted">{item.effects}</span>{/if}
								</span>
							</li>
						{/each}
					</ul>
				{/if}
			</aside>
		</div>

		<TurnControls {session} {onTab} />
	</div>
{/if}
