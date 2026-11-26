/**
 * Formatage français des valeurs affichées (DESIGN.md §7) : euros et nombres en
 * `fr-FR`, signes explicites pour les variations, jauges décrites par un mot en
 * plus du nombre (jamais par la seule couleur).
 */
import type { GaugeId, IndicatorId, ResourceId } from '../content/types.ts';

const euros = new Intl.NumberFormat('fr-FR', {
	style: 'currency',
	currency: 'EUR',
	maximumFractionDigits: 0
});
const integers = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export function formatMoney(cents: number): string {
	return euros.format(Math.round(cents / 100));
}

export function formatNumber(value: number): string {
	return integers.format(value);
}

/** Valeur d'une ressource dans son unité. */
export function formatResource(resource: ResourceId, value: number): string {
	return resource === 'influence' ? formatNumber(value) : formatMoney(value);
}

/** Variation signée : « + 3 », « − 120 € », « 0 ». */
export function formatDelta(resource: ResourceId, delta: number): string {
	if (delta === 0) return resource === 'influence' ? '0' : formatMoney(0);
	const sign = delta > 0 ? '+' : '−';
	return `${sign} ${formatResource(resource, Math.abs(delta))}`;
}

/** Fourchette signée : « + 2 à + 6 » ou valeur unique. */
export function formatRange(resource: ResourceId, min: number, max: number): string {
	return min === max
		? formatDelta(resource, min)
		: `${formatDelta(resource, min)} à ${formatDelta(resource, max)}`;
}

export function formatGaugeDelta(delta: number): string {
	return delta > 0 ? `+ ${delta}` : delta < 0 ? `− ${Math.abs(delta)}` : '0';
}

/**
 * Variation compacte pour les pastilles (P3-26) : « +3 », « −20 € », « +1–3 »,
 * « −2 à +3 » si la fourchette change de signe. Le texte complet reste fourni à côté.
 */
export function formatCompactRange(resource: ResourceId | null, min: number, max: number): string {
	const unit = (value: number): string =>
		resource === null || resource === 'influence' ? formatNumber(value) : formatMoney(value);
	const signed = (value: number): string =>
		value > 0 ? `+${unit(value)}` : value < 0 ? `−${unit(-value)}` : unit(0);
	if (min === max) return signed(min);
	if (min < 0 && max > 0) return `${signed(min)} à ${signed(max)}`;
	const sign = min + max > 0 ? '+' : '−';
	const [low, high] = min + max > 0 ? [min, max] : [-max, -min];
	if (resource === null || resource === 'influence')
		return `${sign}${formatNumber(low)}–${formatNumber(high)}`;
	return `${sign}${formatNumber(Math.round(low / 100))}–${formatMoney(high)}`;
}

export const RESOURCE_NAMES: { readonly [K in ResourceId]: string } = {
	influence: 'Influence',
	politicalBudgetCents: 'Budget politique',
	personalCashCents: 'Argent personnel'
};

export const GAUGE_NAMES: { readonly [K in GaugeId]: string } = {
	'player.health': 'Santé',
	'player.stress': 'Stress',
	'player.exposure': 'Exposition médiatique',
	'player.defense': 'Défense'
};

export type GaugeTone = 'good' | 'neutral' | 'warning' | 'danger';

export interface GaugeDescription {
	readonly value: number;
	readonly label: string;
	readonly tone: GaugeTone;
	/** Paliers publics de la jauge, du plus bas au plus haut (repères des barres, P3-26). */
	readonly tiers: readonly GaugeTier[];
}

/** Palier d'une jauge : seuil d'entrée (inclus), mot et tonalité. */
export interface GaugeTier {
	readonly from: number;
	readonly label: string;
	readonly tone: GaugeTone;
}

type TierTable = readonly (readonly [from: number, label: string, tone: GaugeTone])[];

/** Décrit une valeur d'après une table de paliers croissants (le premier part de 0). */
function describeTiers(value: number, table: TierTable): GaugeDescription {
	const tiers = table.map(([from, label, tone]) => ({ from, label, tone }));
	const current = tiers.findLast((tier) => value >= tier.from) ?? tiers[0]!;
	return { value, label: current.label, tone: current.tone, tiers };
}

const HEALTH_TIERS: TierTable = [
	[0, 'Critique', 'danger'],
	[25, 'Fragile', 'warning'],
	[50, 'Correcte', 'neutral'],
	[75, 'Bonne', 'good']
];
const STRESS_TIERS: TierTable = [
	[0, 'Serein', 'good'],
	[30, 'Tendu', 'neutral'],
	[50, 'Sous pression', 'warning'],
	[70, 'Épuisé', 'danger']
];
const EXPOSURE_TIERS: TierTable = [
	[0, 'Discrète', 'neutral'],
	[15, 'Remarquée', 'neutral'],
	[35, 'En vue', 'warning'],
	[60, 'Sous les projecteurs', 'warning']
];
const DEFENSE_TIERS: TierTable = [
	[0, 'Improvisée', 'neutral'],
	[15, 'Préparée', 'neutral'],
	[40, 'Solide', 'good'],
	[70, 'Redoutable', 'good']
];
const RISK_TIERS: TierTable = [
	[0, 'Nul', 'good'],
	[1, 'Faible', 'neutral'],
	[20, 'Notable', 'warning'],
	[45, 'Élevé', 'danger']
];
const POPULARITY_TIERS: TierTable = [
	[0, 'Confidentielle', 'danger'],
	[20, 'Discrète', 'warning'],
	[35, 'Honorable', 'neutral'],
	[50, 'Solide', 'good'],
	[65, 'Éclatante', 'good']
];
const SUPPORT_TIERS: TierTable = [
	[0, 'Très faible', 'danger'],
	[10, 'Faible', 'warning'],
	[25, 'Moyen', 'neutral'],
	[40, 'Fort', 'good'],
	[60, 'Très fort', 'good']
];
const COMPETENCE_TIERS: TierTable = [
	[0, 'Très faible', 'danger'],
	[25, 'Faible', 'warning'],
	[40, 'Moyenne', 'neutral'],
	[60, 'Bonne', 'good'],
	[75, 'Excellente', 'good']
];

/** Santé : mot descriptif et tonalité ; aucun seuil caché n'est révélé. */
export function describeHealth(value: number): GaugeDescription {
	return describeTiers(value, HEALTH_TIERS);
}

export function describeStress(value: number): GaugeDescription {
	return describeTiers(value, STRESS_TIERS);
}

/** Exposition médiatique (P3-01) : la visibilité, ni bonne ni mauvaise en soi. */
export function describeExposure(value: number): GaugeDescription {
	return describeTiers(value, EXPOSURE_TIERS);
}

/** Préparation de la défense (P3-01). */
export function describeDefense(value: number): GaugeDescription {
	return describeTiers(value, DEFENSE_TIERS);
}

/** Risque judiciaire (P3-01) : exposition aux enquêtes, pas culpabilité. */
export function describeJudicialRisk(value: number): GaugeDescription {
	return describeTiers(value, RISK_TIERS);
}

export const INDICATOR_NAMES: { readonly [K in IndicatorId]: string } = {
	economy: 'Économie',
	socialClimate: 'Climat social',
	stability: 'Stabilité du gouvernement'
};

const INDICATOR_LABELS: {
	readonly [K in IndicatorId]: readonly [string, string, string, string, string];
} = {
	economy: ['En crise', 'Morose', 'Hésitante', 'Solide', 'Florissante'],
	socialClimate: ['Explosif', 'Tendu', 'Grincheux', 'Calme', 'Apaisé'],
	stability: ['Au bord de la crise', 'Chancelante', 'Fragile', 'Solide', 'Inébranlable']
};

/** Indicateur national : mot descriptif et tonalité (les chiffres restent publics). */
export function describeIndicator(indicator: IndicatorId, value: number): GaugeDescription {
	const labels = INDICATOR_LABELS[indicator];
	return describeTiers(value, [
		[0, labels[0], 'danger'],
		[30, labels[1], 'warning'],
		[45, labels[2], 'neutral'],
		[55, labels[3], 'good'],
		[70, labels[4], 'good']
	]);
}

/** Popularité : synthèse publique des soutiens électoraux. */
export function describePopularity(value: number): GaugeDescription {
	return describeTiers(value, POPULARITY_TIERS);
}

/** Soutien d'un groupe, d'après les sondages publics. */
export function describeSupport(value: number): GaugeDescription {
	return describeTiers(value, SUPPORT_TIERS);
}

/** Compétence d'un collaborateur ou d'un candidat (visible sur le CV). */
export function describeCompetence(value: number): GaugeDescription {
	return describeTiers(value, COMPETENCE_TIERS);
}

/** Position qualitative d'un parti sur un axe, sans chiffre (GDD §3.2). */
export function describeAxisPosition(value: number, negative: string, positive: string): string {
	if (value <= -60) return `très ${negative}`;
	if (value <= -20) return `plutôt ${negative}`;
	if (value < 20) return 'modéré';
	if (value < 60) return `plutôt ${positive}`;
	return `très ${positive}`;
}

/** Date et heure d'une sauvegarde (métadonnée d'interface). */
export function formatSavedAt(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return 'date inconnue';
	return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(date);
}
