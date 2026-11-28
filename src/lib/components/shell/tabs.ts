/** Écrans de la partie implémentés (aucun onglet factice, DESIGN.md §3). */
export type GameTab =
	| 'dashboard'
	| 'agenda'
	| 'career'
	| 'world'
	| 'news'
	| 'entourage'
	| 'relations'
	| 'organisation'
	| 'wealth'
	| 'journal';

/** Libellés des onglets, partagés par la navigation et les premiers pas (P3-40). */
export const TAB_LABELS: Readonly<Record<GameTab, string>> = {
	dashboard: 'Tableau de bord',
	agenda: 'Agenda',
	career: 'Carrière',
	world: 'Monde politique',
	news: 'Actualités',
	entourage: 'Entourage',
	relations: 'Relations',
	organisation: 'Organisation',
	wealth: 'Patrimoine',
	journal: 'Journal'
};
