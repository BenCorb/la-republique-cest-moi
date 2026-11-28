/**
 * Projection de la création de partie, du territoire et des premiers pas (fiche creation-et-profil).
 *
 * Partie de la projection publique (`PlayerView`, ARCHITECTURE.md §9) : fonctions pures,
 * sans PRNG ni information cachée. Point d’entrée : `../view-model.ts`.
 */
import type { Condition, Content, Effect } from '../../content/types.ts';
import type { GameState } from '../../engine/index.ts';
import { effectRange, placeOf } from '../../engine/index.ts';
import { describeEffect, joinFrench } from './shared.ts';

/** Territoire d'origine (P3-16), affiché dans l'en-tête et au bilan. */
export interface TerritoryView {
	readonly town: string;
	/** « Petite ville ouvrière et rurale ». */
	readonly description: string;
	readonly department: string;
	readonly region: string;
}

/** Territoire d'origine : commune, taille et traits, département et région (P3-16). */
export function buildTerritory(state: GameState, content: Content): TerritoryView {
	const { territory } = state.player;
	const size = content.territory.sizes.find((entry) => entry.id === territory.homeTown.sizeId);
	const traits = territory.homeTown.traitIds.map(
		(id) => content.territory.traits.find((trait) => trait.id === id)?.label ?? id
	);
	const sizeLabel = size?.label ?? territory.homeTown.sizeId;
	return {
		town: territory.homeTown.name,
		description: traits.length > 0 ? `${sizeLabel} ${joinFrench(traits)}` : sizeLabel,
		department: placeOf('national', territory, content),
		region: placeOf('regional', territory, content)
	};
}

/** Option de création : libellé, description et effets de départ lisibles. */
export interface ProfileOptionView {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly effects: readonly string[];
	/** Actions propres ouvertes par ce choix (terrain d'engagement, P3-17). */
	readonly actions: readonly string[];
}

/** Région proposée à la création (P3-16) : nom et départements, la commune étant tirée. */
export interface RegionOptionView {
	readonly id: string;
	readonly name: string;
	readonly departments: string;
}

/** Terrain d'engagement exigé par une condition, au premier niveau ou dans un « tous » (P3-24). */
export function engagementOf(condition: Condition | undefined): string | null {
	if (!condition) return null;
	if (condition.op === 'engagement') return condition.engagement;
	if (condition.op === 'all') {
		for (const inner of condition.conditions) {
			const found = engagementOf(inner);
			if (found) return found;
		}
	}
	return null;
}

/** Étape des premiers pas (P3-40). */
export interface FirstStepView {
	readonly id: string;
	readonly label: string;
	readonly hint: string;
	/** Onglet où agir. */
	readonly tab: 'agenda' | 'world' | 'career' | 'dashboard';
	readonly done: boolean;
}

/** Premiers pas guidés (P3-40) : objectifs successifs lus dans l'état, sans effet de jeu. */
export interface FirstStepsView {
	readonly steps: readonly FirstStepView[];
	/** Étape en cours, `null` une fois tout accompli. */
	readonly current: FirstStepView | null;
	readonly doneCount: number;
}

export function buildFirstSteps(state: GameState, content: Content): FirstStepsView {
	const quarters = state.history.filter((entry) => entry.type === 'turn.resolved').length;
	const municipal = state.campaigns.some(
		(campaign) => content.elections[campaign.electionId]?.scope === 'local'
	);
	const steps: FirstStepView[] = [
		{
			id: 'plan',
			label: 'Composer un premier trimestre',
			hint: 'Choisissez deux ou trois activités dans l’agenda, puis validez « Trimestre suivant ».',
			tab: 'agenda',
			done: quarters >= 1
		},
		{
			id: 'party',
			label: 'Adhérer à un parti ou rester indépendant',
			hint: 'Dans « Monde politique », comparez les partis : une carte ouvre l’investiture et l’appareil, l’indépendance garde les mains libres.',
			tab: 'world',
			done: state.player.affiliations.length > 0 || quarters >= 6
		},
		{
			id: 'activists',
			label: 'Réunir un noyau militant',
			hint: 'Tracts, réunion de section et marché du dimanche font venir des militants ; un local les retient.',
			tab: 'agenda',
			done: state.player.activists >= 25
		},
		{
			id: 'municipal',
			label: 'Préparer les municipales',
			hint: 'Dans l’onglet Carrière, conduisez votre liste ou demandez une place sur celle d’un parti avant la clôture des candidatures.',
			tab: 'career',
			done: municipal
		},
		{
			id: 'pledge',
			label: 'Prendre un engagement de campagne',
			hint: 'Une promesse par scrutin au moins : elle vous suivra une fois élu, et même après.',
			tab: 'career',
			done: state.promises.length > 0
		},
		{
			id: 'ballot',
			label: 'Passer l’épreuve du scrutin',
			hint: 'Préparez la campagne (porte-à-porte, meetings), puis découvrez le procès-verbal au soir du vote.',
			tab: 'dashboard',
			done: state.campaigns.some((campaign) => campaign.resultTurn !== null)
		}
	];
	const current = steps.find((step) => !step.done) ?? null;
	return { steps, current, doneCount: steps.filter((step) => step.done).length };
}

export function creationOptions(content: Content): {
	readonly origins: readonly ProfileOptionView[];
	readonly engagements: readonly ProfileOptionView[];
	readonly regions: readonly RegionOptionView[];
	readonly ambitions: readonly {
		readonly id: string;
		readonly label: string;
		readonly description: string;
	}[];
	readonly defaults: Content['defaultProfile'];
} {
	const option = (entry: {
		id: string;
		label: string;
		description: string;
		effects: readonly Effect[];
	}): ProfileOptionView => ({
		id: entry.id,
		label: entry.label,
		description: entry.description,
		effects: entry.effects.map((effect) => describeEffect(effectRange(effect), content)),
		actions: content.actionIds
			.map((id) => content.actions[id]!)
			.filter((action) => engagementOf(action.requires) === entry.id)
			.map((action) => action.label)
	});
	return {
		origins: content.originIds.map((id) => option(content.origins[id]!)),
		engagements: content.engagementIds.map((id) => option(content.engagements[id]!)),
		ambitions: content.ambitionIds.map((id) => {
			const ambition = content.ambitions[id]!;
			return { id, label: ambition.label, description: ambition.description };
		}),
		regions: content.regionIds.map((id) => {
			const region = content.regions[id]!;
			return {
				id,
				name: region.name,
				departments: region.departments.map((department) => department.name).join(', ')
			};
		}),
		defaults: content.defaultProfile
	};
}
