# Coque d’interface et système visuel

> Fiche de fonctionnalité — état au tag `v1.0.0`. **Statut beta : en chantier (B-04).** Modèle et mode d’emploi : [README](README.md).

## Rôle dans le jeu

Ce qui est commun à tous les écrans : en-tête, onglets, alertes, carnet du plan, bandeau de sauvegarde, composants partagés et identité visuelle. Point d’entrée de tout chantier UX/UI transversal.

## Références

- GDD : §13 (interface et direction artistique)
- DESIGN : tout le document, en particulier §3, §7 et §10.10 (identité retenue)
- Historique ([archive V1](../archive/v1/), à ne lire que pour le pourquoi d’une règle) :
  - ARCHITECTURE §9.1 (interface jouable)
  - ARCHITECTURE §8.4 sexdecies (direction visuelle et composants)
  - ARCHITECTURE §8.4 septdecies (plan permanent)
  - ARCHITECTURE §8.4 terquadragesies (cohérence visuelle finale)
  - PLAYTEST (archive) : playtest B1 et B2
  - AUDIT_V1 (archive)

## Code

- Moteur (`src/lib/game/engine/`) : —
- Contenu (`src/lib/game/content/data/`) : —
- Projection (`src/lib/game/app/`, module `view/shared.ts`, `view/dashboard.ts`, `view-model.ts`) : `PlayerView`, `Alert`, `ChipView`, `TrendView` ; `app/format.ts`
- Interface (`src/lib/components/`) : `shell/*` (GameLayout, GameShell, HeaderStat, AlertBar, SaveBanner, tabs.ts), `common/*` (identity.ts, EffectChip, StatBar, ScoreBars, Sparkline…), `dashboard/*`, `routes/+page.svelte`, `routes/layout.css`
- Tests (`tests/`) : `unit/interface.test.ts`, `unit/visual-identity.test.ts`, `unit/controller.test.ts`, `e2e/game.e2e.ts`

## État V1

- Dix onglets, aucune page factice ; vérifiés à 1 100, 1 280 et 1 440 px.
- Pastilles de coûts et d’effets, barres à paliers, tuiles de ressources, alertes à trois niveaux.

## Règles en vigueur

_Audit de B-04, avant mise en œuvre ; tiré du code._

- **Coque** (`shell/GameLayout.svelte`) : hauteur de la fenêtre, seules les colonnes défilent. En-tête sur deux bandes : marque, fonction, étiquette, territoire, fil de presse tournant ; puis date et âge (avec lien « Note du … »), six indicateurs (trois ressources avec prévision, popularité, santé, stress avec prévision). Bandeau d’alertes sous l’en-tête (`AlertBar`).
- **Dix onglets** dans une colonne gauche de 200 px (`tabs.ts`) : Tableau de bord, Agenda, Carrière, Monde politique, Actualités, Entourage, Relations, Organisation, Patrimoine, Journal. Composants : `Dashboard`, `Agenda` + `PlanPanel`, `CareerPanel` (mandats, campagnes, promesses, soutiens, médias), `WorldPanel` + `InstitutionsCard`, `NewsPanel`, `EntouragePanel`, `RelationsPanel`, `Organisation`, `Wealth`, `Journal`. Aiguillage dans `routes/+page.svelte`.
- **Carnet du plan** permanent en colonne droite de 300 px dès 1 100 px (`PlanNotebook`) ; en dessous, bouton compact « Plan · n activités » qui ouvre le panneau superposé `PlanSheet` (recherche d’actions).
- **Barre du bas** (`TurnControls`) : temps utilisé, rappel des épinglages, état de sauvegarde, motif de blocage ; boutons Accueil, Exporter, Année suivante, Jusqu’à une alerte, Trimestre suivant (et Interrompre pendant une accélération).
- **Tableau de bord** : tuiles de ressources, santé et stress, exposition et justice, soutiens, tendances (`TrendsCard`), indicateurs ; résumé de période après accélération (`SpanSummary`, aussi dans la note).
- Identité visuelle : DESIGN §10.10 (tokens de `routes/layout.css`, pastilles `EffectChip`, barres `StatBar`, `TierBadge`). Vérifiée à 1 100, 1 280 et 1 440 px (tests `@layout`).

## Décisions provisoires à confirmer

- Décisions D-02 du dépouillement B-02, à appliquer par B-04 : six onglets (Trimestre, Politique, Vie privée, Mon réseau, La France, Journal) ; carnet permanent conservé à droite (délégué) ; chaque section ouvre sur un résumé d’une ligne, le détail à la demande (délégué) ; bloc « Fixe ce trimestre » (revenus et charges certains, délégué).
- Référence visuelle : [maquette de la coque](../maquettes/2026-11-28-coque-beta-v2.html), non normative pour les textes et les chiffres.

## Limites connues

- Dix onglets, dont plusieurs se recouvrent (Carrière et Monde politique, Entourage et Organisation) : retour PT-B02-002.
- Pas d’audit automatisé d’accessibilité ; zoom à 125 % non testé.

## Chantier beta

- Décisions du [dépouillement B-02](../playtests/2026-11-28-b-02-reference.md#décisions-par-retour) : D-02 (six onglets, carnet, résumé puis détail) → B-04 ; référence visuelle : [maquette de la coque](../maquettes/2026-11-28-coque-beta-v2.html).
- [x] Audit : règles en vigueur condensées ci-dessus, décisions provisoires listées (B-04)
- [ ] Problèmes UX/UI relevés (captures, retours de playtest)
- [x] Plan de consolidation validé par le créateur (28 novembre 2026, B-04) :
  - Trimestre (onglet par défaut et après chaque tour) : agenda, « Fixe ce trimestre », situation, soutiens et tendances ;
  - Politique : élections et campagnes, mandats, parti, médias ;
  - Vie privée : santé et stress, exposition et justice, patrimoine (emploi avec B-10) ;
  - Mon réseau : équipe, organisation et financement, relations ;
  - La France : contexte, partis et intentions de vote, institutions, presse ;
  - Journal ;
  - chaque section s’ouvre sur une ligne de résumé calculée par la projection, le détail à la demande ; carnet inchangé à droite.
- [ ] Mise en œuvre, tests et fiche à jour
