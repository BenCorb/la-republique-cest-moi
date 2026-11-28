/** Les six onglets de la partie (D-02) ; aucun onglet factice (DESIGN.md §3). */
export type GameTab = 'quarter' | 'politics' | 'private' | 'network' | 'france' | 'journal';

/** Libellés des onglets, partagés par la navigation et les premiers pas (P3-40). */
export const TAB_LABELS: Readonly<Record<GameTab, string>> = {
	quarter: 'Trimestre',
	politics: 'Politique',
	private: 'Vie privée',
	network: 'Mon réseau',
	france: 'La France',
	journal: 'Journal'
};
