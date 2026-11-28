/**
 * Projection de la coque à six onglets (fiche interface-coque, D-02) : bloc
 * « Fixe ce trimestre » et ligne de résumé de chaque section, le détail restant
 * à la demande. Aucune donnée cachée : seulement ce que les écrans montrent déjà.
 */
import type { Content, ResourceAmount } from '../../content/types.ts';
import {
	activeMandates,
	activistTier,
	mandateIncome,
	payrollCents,
	resolveEconomy,
	type GameState
} from '../../engine/index.ts';
import type { PlayerView } from '../view-model.ts';
import { amountChips, upgradeLabel, type ChipView } from './shared.ts';

/** Revenu ou charge certain du trimestre, hors actions du plan. */
export interface FixedLineView {
	readonly key: string;
	readonly label: string;
	readonly chips: readonly ChipView[];
}

/**
 * Revenus et charges certains du trimestre en préparation, dans l'ordre du tour :
 * train de vie, organisation (charges et production), indemnités, salaires de
 * l'équipe, base militante (cotisations et accueil). Les achats du plan n'y figurent pas (production à T+1).
 */
export function buildFixedLines(state: GameState, content: Content): FixedLineView[] {
	if (state.phase === 'ended') return [];
	const lines: FixedLineView[] = [];
	const economy = resolveEconomy(
		state.resources,
		state.upgrades,
		state.turn,
		content,
		state.player.lifestyle
	);

	if (economy.lifestyle.costCents > 0) {
		const label = content.lifestyles[state.player.lifestyle]?.label ?? state.player.lifestyle;
		lines.push({
			key: 'lifestyle',
			label,
			chips: amountChips(
				[{ resource: 'personalCashCents', amount: economy.lifestyle.costCents }],
				-1
			)
		});
	}

	const byUpgrade = new Map<
		string,
		{ count: number; net: Map<ResourceAmount['resource'], number> }
	>();
	for (const producer of economy.producers) {
		if (producer.status !== 'active') continue;
		const entry = byUpgrade.get(producer.upgradeId) ?? { count: 0, net: new Map() };
		entry.count += 1;
		for (const amount of producer.production) {
			entry.net.set(amount.resource, (entry.net.get(amount.resource) ?? 0) + amount.amount);
		}
		for (const amount of producer.upkeep) {
			entry.net.set(amount.resource, (entry.net.get(amount.resource) ?? 0) - amount.amount);
		}
		byUpgrade.set(producer.upgradeId, entry);
	}
	for (const [upgradeId, entry] of byUpgrade) {
		const gains = [...entry.net].flatMap(([resource, amount]) =>
			amount > 0 ? [{ resource, amount }] : []
		);
		const costs = [...entry.net].flatMap(([resource, amount]) =>
			amount < 0 ? [{ resource, amount: -amount }] : []
		);
		if (gains.length === 0 && costs.length === 0) continue;
		lines.push({
			key: `upgrade.${upgradeId}`,
			label: `${upgradeLabel(upgradeId, state, content, true)}${entry.count > 1 ? ` × ${entry.count}` : ''}`,
			chips: [...amountChips(gains, 1), ...amountChips(costs, -1)]
		});
	}

	for (const mandate of activeMandates(state.mandates)) {
		const income = mandateIncome([mandate], state.turn, content).income;
		if (income.length === 0) continue;
		const label = content.mandates[mandate.mandateId]?.label ?? mandate.mandateId;
		lines.push({
			key: `mandate.${mandate.instanceId}`,
			label: `Indemnité : ${label.toLocaleLowerCase('fr')}`,
			chips: amountChips(income, 1)
		});
	}

	const payroll = payrollCents(state.staff);
	if (payroll > 0) {
		lines.push({
			key: 'payroll',
			label: 'Salaires de l’équipe',
			chips: amountChips([{ resource: 'politicalBudgetCents', amount: payroll }], -1)
		});
	}

	// Base militante : cotisations puis frais d'accueil du palier, au budget politique.
	const dues = state.player.activists * content.balance.activists.duesCents;
	const activistUpkeep = activistTier(state.player.activists, content).upkeepCents;
	if (dues > 0 || activistUpkeep > 0) {
		lines.push({
			key: 'activists',
			label: 'Base militante : cotisations et accueil',
			chips: [
				...amountChips(dues > 0 ? [{ resource: 'politicalBudgetCents', amount: dues }] : [], 1),
				...amountChips(
					activistUpkeep > 0 ? [{ resource: 'politicalBudgetCents', amount: activistUpkeep }] : [],
					-1
				)
			]
		});
	}
	return lines;
}

/** Sections repliables des onglets ; l'agenda et le journal n'en ont pas. */
export type SectionId =
	| 'fixed'
	| 'situation'
	| 'supports'
	| 'elections'
	| 'mandates'
	| 'party'
	| 'media'
	| 'health'
	| 'justice'
	| 'wealth'
	| 'team'
	| 'organisation'
	| 'relations'
	| 'context'
	| 'parties'
	| 'institutions'
	| 'press';

const plural = (count: number, word: string, plural = `${word}s`): string =>
	`${count} ${count > 1 ? plural : word}`;

/** Ligne de résumé de chaque section, lue à partir de la vue déjà projetée. */
export function buildSectionSummaries(
	view: Omit<PlayerView, 'sections'>
): Readonly<Record<SectionId, string>> {
	const { career, world, wealth, entourage, activists } = view;
	const resources = view.resources.map((resource) => `${resource.name} ${resource.value}`);
	const open = career.calendar.filter((ballot) => ballot.campaign !== null);
	const nextBallot = career.calendar[0];
	const staffed = entourage.posts.filter((post) => post.occupant !== null).length;
	const allies = view.people.filter(
		(person) => person.active && person.attitudeTone === 'good'
	).length;
	const openCases = view.justice.cases.filter((legalCase) => !legalCase.closed).length;
	const outlets = career.media.outlets.length;
	const latest = view.news[0];

	return {
		fixed:
			view.fixed.length === 0
				? 'Aucun revenu ni charge fixe ce trimestre.'
				: `${view.fixed.map((line) => line.label).join(' · ')}.`,
		situation: `${resources.join(' · ')}.`,
		supports: `Popularité ${view.supports.popularity.value} (${view.supports.popularity.label.toLocaleLowerCase('fr')}).`,
		elections:
			open.length > 0
				? `Campagne en cours : ${open.map((ballot) => `${ballot.label} (${ballot.dateLabel})`).join(', ')}.`
				: nextBallot
					? `Prochain scrutin : ${nextBallot.label}, ${nextBallot.dateLabel}.`
					: 'Aucun scrutin annoncé.',
		mandates:
			career.mandates.length === 0
				? 'Aucun mandat en cours.'
				: `${career.mainFunction} · ${plural(career.mandates.length, 'mandat')} · ${career.reservedTime} pts réservés par trimestre.`,
		party: career.partyCareer
			? `${career.partyCareer.rank} du ${career.partyCareer.party}.`
			: `${world.affiliation.replace(/\.$/u, '')}.`,
		media: `${plural(outlets, 'média', 'médias')} · exposition nationale ${career.media.nationalExposure}.`,
		health: `Santé ${view.health.value} (${view.health.label.toLocaleLowerCase('fr')}) · stress ${view.stress.value} (${view.stress.label.toLocaleLowerCase('fr')}).`,
		justice:
			openCases > 0
				? `${plural(openCases, 'affaire en cours', 'affaires en cours')} · risque ${view.justice.risk.label.toLocaleLowerCase('fr')}.`
				: `Exposition ${view.justice.exposure.label.toLocaleLowerCase('fr')} · risque ${view.justice.risk.label.toLocaleLowerCase('fr')}.`,
		wealth: `Valeur nette ${wealth.netWorth} · ${wealth.lifestyle.label.toLocaleLowerCase('fr')}.`,
		team: `${staffed} poste${staffed > 1 ? 's' : ''} pourvu${staffed > 1 ? 's' : ''} sur ${entourage.posts.length} · masse salariale ${entourage.payroll.total}.`,
		organisation: `${activists.countLabel} · ${plural(view.producers.length, 'amélioration')}.`,
		relations: `${plural(view.people.filter((person) => person.active).length, 'personne connue', 'personnes connues')} · ${plural(allies, 'favorable')}.`,
		context: `Gouvernement : ${world.governingParty}${world.executive.cohabitation ? ', cohabitation' : ''} · ${world.era.label}.`,
		parties: `${plural(world.parties.length, 'parti')} · vous : ${world.partyAcronym ?? 'sans étiquette'}.`,
		institutions:
			world.institutions.history.length === 0
				? 'Aucune réforme depuis 2000.'
				: `Dernière réforme : ${world.institutions.history[0]!.text}`,
		press: latest
			? `${latest.label} : ${plural(latest.items.length, 'article')}.`
			: 'Aucune nouvelle pour l’instant.'
	};
}
