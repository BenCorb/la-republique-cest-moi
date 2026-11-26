/**
 * Table d'identité visuelle (P3-26, DESIGN.md §10.10) : une icône et une couleur
 * par ressource, jauge, groupe de soutien et thème de l'agenda, réutilisées
 * partout (en-tête, agenda, pastilles, tableau de bord). Données de présentation
 * seulement : aucune règle de jeu, aucune information absente de `PlayerView`.
 */
import {
	Briefcase,
	BriefcaseBusiness,
	Building,
	ClipboardCheck,
	Coffee,
	Coins,
	Ellipsis,
	Eye,
	Flag,
	Footprints,
	Gavel,
	Gem,
	Handshake,
	HardHat,
	HeartPulse,
	Hourglass,
	House,
	Landmark,
	Megaphone,
	Newspaper,
	PiggyBank,
	Scale,
	Shield,
	ThumbsUp,
	Users,
	Vote,
	Wallet,
	Zap
} from '@lucide/svelte';

/** Composant d'icône Lucide (même type pour toutes les icônes). */
export type IdentityIcon = typeof Zap;

export interface Identity {
	readonly icon: IdentityIcon;
	/** Variable CSS de la couleur (token `--color-res-*` ou `--color-cat-*`). */
	readonly color: string;
	/** Libellé accessible par défaut ; la vue fournit le libellé exact quand il existe. */
	readonly label: string;
}

const res = (name: string): string => `var(--color-res-${name})`;
const cat = (name: string): string => `var(--color-cat-${name})`;

/**
 * Ressources, temps et jauges. Les clés reprennent les identifiants du moteur
 * (`ResourceId`, `GaugeId`) ; `time`, `popularity`, `justice.risk` et
 * `preparation` désignent des valeurs de vue.
 */
export const RESOURCE_IDENTITY = {
	influence: { icon: Megaphone, color: res('influence'), label: 'Influence' },
	politicalBudgetCents: { icon: PiggyBank, color: res('budget'), label: 'Budget politique' },
	personalCashCents: { icon: Wallet, color: res('cash'), label: 'Argent personnel' },
	time: { icon: Hourglass, color: res('time'), label: 'Temps' },
	popularity: { icon: ThumbsUp, color: res('popularity'), label: 'Popularité' },
	'player.health': { icon: HeartPulse, color: res('health'), label: 'Santé' },
	'player.stress': { icon: Zap, color: res('stress'), label: 'Stress' },
	'player.exposure': { icon: Eye, color: res('exposure'), label: 'Exposition médiatique' },
	'justice.risk': { icon: Gavel, color: res('justice'), label: 'Risque judiciaire' },
	'player.defense': { icon: Shield, color: res('defense'), label: 'Défense' },
	preparation: {
		icon: ClipboardCheck,
		color: res('preparation'),
		label: 'Préparation de campagne'
	}
} as const satisfies Readonly<Record<string, Identity>>;

export type ResourceIdentityId = keyof typeof RESOURCE_IDENTITY;

/**
 * Groupes de soutien : icône propre, couleur de famille (électoral ou influence).
 * Les identifiants sont ceux du catalogue `supports.json` (stables).
 */
export const SUPPORT_IDENTITY: Readonly<Record<string, Identity>> = {
	'support.working_class': { icon: HardHat, color: res('electoral'), label: 'Classes populaires' },
	'support.middle_class': { icon: House, color: res('electoral'), label: 'Classes moyennes' },
	'support.wealthy': { icon: Gem, color: res('electoral'), label: 'Électeurs aisés' },
	'support.activists': { icon: Flag, color: res('influence'), label: 'Militants' },
	'support.apparatus': { icon: Building, color: res('influence'), label: 'Appareil du parti' },
	'support.business': {
		icon: BriefcaseBusiness,
		color: res('influence'),
		label: 'Milieux d’affaires'
	}
};

/** Thèmes de l'agenda (`actionCategories` du catalogue), en six familles de couleur. */
export const CATEGORY_IDENTITY: Readonly<Record<string, Identity>> = {
	activism: { icon: Footprints, color: cat('field'), label: 'Militantisme' },
	campaign: { icon: ClipboardCheck, color: cat('field'), label: 'Campagne' },
	party: { icon: Vote, color: cat('party'), label: 'Parti' },
	network: { icon: Handshake, color: cat('party'), label: 'Réseau et influence' },
	media: { icon: Newspaper, color: cat('media'), label: 'Médias' },
	political_finance: { icon: PiggyBank, color: cat('money'), label: 'Finances politiques' },
	work: { icon: Briefcase, color: cat('money'), label: 'Métier et revenus' },
	wealth: { icon: Coins, color: cat('money'), label: 'Patrimoine et train de vie' },
	personal: { icon: Coffee, color: cat('personal'), label: 'Vie personnelle' },
	organisation: { icon: Users, color: cat('institution'), label: 'Organisation et entourage' },
	mandate: { icon: Landmark, color: cat('institution'), label: 'Mandats' },
	justice: { icon: Scale, color: cat('justice'), label: 'Justice' }
};

const OTHER_CATEGORY: Identity = { icon: Ellipsis, color: cat('other'), label: 'Autres actions' };

/** Identité d'une ressource, d'une jauge ou d'un groupe ; `null` si l'identifiant est inconnu. */
export function identityOf(id: string | null | undefined): Identity | null {
	if (!id) return null;
	return (
		(RESOURCE_IDENTITY as Readonly<Record<string, Identity>>)[id] ?? SUPPORT_IDENTITY[id] ?? null
	);
}

/** Identité d'un thème de l'agenda ; « Autres actions » par défaut. */
export function categoryIdentity(id: string): Identity {
	return CATEGORY_IDENTITY[id] ?? OTHER_CATEGORY;
}
