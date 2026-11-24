/**
 * Formatage français des valeurs affichées (DESIGN.md §7) : euros et nombres en
 * `fr-FR`, signes explicites pour les variations, jauges décrites par un mot en
 * plus du nombre (jamais par la seule couleur).
 */
import type { GaugeId, ResourceId } from '../content/types.ts';

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

/** Date et heure d'une sauvegarde (métadonnée d'interface). */
export function formatSavedAt(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return 'date inconnue';
	return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(date);
}
