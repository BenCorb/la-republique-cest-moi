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

export const RESOURCE_NAMES: { readonly [K in ResourceId]: string } = {
	influence: 'Influence',
	politicalBudgetCents: 'Budget politique',
	personalCashCents: 'Argent personnel'
};

export const GAUGE_NAMES: { readonly [K in GaugeId]: string } = {
	'player.health': 'Santé',
	'player.stress': 'Stress'
};

export type GaugeTone = 'good' | 'neutral' | 'warning' | 'danger';

export interface GaugeDescription {
	readonly value: number;
	readonly label: string;
	readonly tone: GaugeTone;
}

/** Santé : mot descriptif et tonalité ; aucun seuil caché n'est révélé. */
export function describeHealth(value: number): GaugeDescription {
	if (value >= 75) return { value, label: 'Bonne', tone: 'good' };
	if (value >= 50) return { value, label: 'Correcte', tone: 'neutral' };
	if (value >= 25) return { value, label: 'Fragile', tone: 'warning' };
	return { value, label: 'Critique', tone: 'danger' };
}

export function describeStress(value: number): GaugeDescription {
	if (value < 30) return { value, label: 'Serein', tone: 'good' };
	if (value < 50) return { value, label: 'Tendu', tone: 'neutral' };
	if (value < 70) return { value, label: 'Sous pression', tone: 'warning' };
	return { value, label: 'Épuisé', tone: 'danger' };
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
	if (value >= 70) return { value, label: labels[4], tone: 'good' };
	if (value >= 55) return { value, label: labels[3], tone: 'good' };
	if (value >= 45) return { value, label: labels[2], tone: 'neutral' };
	if (value >= 30) return { value, label: labels[1], tone: 'warning' };
	return { value, label: labels[0], tone: 'danger' };
}

/** Popularité : synthèse publique des soutiens électoraux. */
export function describePopularity(value: number): GaugeDescription {
	if (value >= 65) return { value, label: 'Éclatante', tone: 'good' };
	if (value >= 50) return { value, label: 'Solide', tone: 'good' };
	if (value >= 35) return { value, label: 'Honorable', tone: 'neutral' };
	if (value >= 20) return { value, label: 'Discrète', tone: 'warning' };
	return { value, label: 'Confidentielle', tone: 'danger' };
}

/** Soutien d'un groupe, d'après les sondages publics. */
export function describeSupport(value: number): GaugeDescription {
	if (value >= 60) return { value, label: 'Très fort', tone: 'good' };
	if (value >= 40) return { value, label: 'Fort', tone: 'good' };
	if (value >= 25) return { value, label: 'Moyen', tone: 'neutral' };
	if (value >= 10) return { value, label: 'Faible', tone: 'warning' };
	return { value, label: 'Très faible', tone: 'danger' };
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
