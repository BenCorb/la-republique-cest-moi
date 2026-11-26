<script lang="ts">
	import {
		BadgeCheck,
		BookOpen,
		ClipboardList,
		Briefcase,
		Calendar,
		Flag,
		Award,
		Landmark,
		LayoutDashboard,
		MapPin,
		Newspaper,
		OctagonExclamationPoint,
		Users,
		UsersRound,
		Wallet
	} from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import AlertBar from './AlertBar.svelte';
	import type { GameSession } from '#lib/game/app/session.svelte.ts';
	import SaveBanner from './SaveBanner.svelte';
	import HeaderStat from './HeaderStat.svelte';
	import PlanNotebook from './PlanNotebook.svelte';
	import PlanSheet from './PlanSheet.svelte';
	import PressTicker from './PressTicker.svelte';
	import { quarterHeadlines } from './press-rotation.ts';
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
	/** Panneau « Modifier le plan » (P3-13) : superposé, sans changer d'onglet ni de défilement. */
	let planOpen = $state(false);
	let planSearch = $state(false);
	function openPlan(focusSearch: boolean): void {
		planSearch = focusSearch;
		planOpen = true;
	}
	/** Fil tournant de l'en-tête : titres du dernier trimestre publié (P3-13). */
	const headlines = $derived(quarterHeadlines(view?.press ?? []));

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
	<!--
		Coque à la hauteur exacte de la fenêtre : seules les colonnes défilent. Les zones
		défilantes sont « relative » pour contenir les éléments absolus (textes « sr-only »
		des pastilles), qui sinon allongent le document et font défiler toute la page.
	-->
	<div class="relative grid h-dvh grid-rows-[auto_auto_1fr_auto] overflow-hidden">
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
					<PressTicker items={headlines} onOpen={() => onTab('news')} />
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
					{#if view.quarterNote && view.phase !== 'ended'}
						<button
							type="button"
							class="self-start text-xs text-primary underline"
							data-testid="reopen-note"
							onclick={() => session.controller.openQuarterNote()}
						>
							Note du {view.quarterNote.endedLabel}
						</button>
					{/if}
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
		<AlertBar alerts={view.alerts} />

		<div class="grid min-h-0 grid-cols-[200px_1fr] min-[1100px]:grid-cols-[200px_1fr_300px]">
			<nav
				aria-label="Écrans de la partie"
				class="relative min-h-0 overflow-y-auto border-r border-line bg-sidebar p-3"
			>
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

			<main
				id="contenu"
				tabindex="-1"
				class="relative min-h-0 overflow-y-auto p-5 focus:outline-none"
			>
				<SaveBanner {session} />
				{@render children()}
			</main>

			<aside
				class="relative hidden min-h-0 overflow-y-auto border-l border-line bg-sidebar p-4 min-[1100px]:block"
				aria-label="Plan du trimestre"
			>
				<PlanNotebook {session} onEdit={openPlan} />
			</aside>
		</div>

		<div>
			<!-- Sous 1 100 px, la colonne du carnet disparaît : le plan reste à un clic (P3-13). -->
			<div class="border-t border-line bg-surface px-5 py-2 min-[1100px]:hidden">
				<button
					type="button"
					class="btn-secondary w-full justify-between"
					data-testid="plan-compact"
					onclick={() => openPlan(false)}
				>
					<span class="flex items-center gap-2">
						<ClipboardList class="size-4" aria-hidden="true" />
						Plan · {view.plan.steps.length} activité{view.plan.steps.length > 1 ? 's' : ''} · {view
							.plan.timeUsed}/{view.plan.timeAvailable}
					</span>
					{#if !view.plan.valid}
						<span class="flex items-center gap-1 text-danger">
							<OctagonExclamationPoint class="size-4" aria-hidden="true" /> À corriger
						</span>
					{:else if view.plan.adjustments.length > 0}
						<span class="text-xs text-warning">Plan ajusté</span>
					{/if}
				</button>
			</div>
			<TurnControls {session} {onTab} />
		</div>
		<PlanSheet
			{session}
			open={planOpen}
			focusSearch={planSearch}
			onClose={() => (planOpen = false)}
		/>
	</div>
{/if}
