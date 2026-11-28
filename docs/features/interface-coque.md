# Coque d’interface et système visuel

> Fiche de fonctionnalité — état au tag `v1.0.0`. **Statut beta : en chantier (B-04, en revue).** Modèle et mode d’emploi : [README](README.md).

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
- Projection (`src/lib/game/app/`, modules `view/shared.ts`, `view/shell.ts`, `view/dashboard.ts`, `view-model.ts`) : `PlayerView` (`fixed`, `sections`), `Alert`, `ChipView`, `TrendView` ; `app/format.ts`
- Interface (`src/lib/components/`) : `shell/*` (GameLayout, GameShell, HeaderStat, AlertBar, SaveBanner, TurnControls, tabs.ts), `tabs/*` (QuarterTab, PoliticsTab, PrivateTab, NetworkTab, FranceTab, Section, FixedCard, sections.svelte.ts), `common/*` (identity.ts, EffectChip, StatBar, ScoreBars, Sparkline…), `dashboard/*`, `routes/+page.svelte`, `routes/layout.css`
- Tests (`tests/`) : `unit/interface.test.ts`, `unit/shell-view.test.ts`, `unit/visual-identity.test.ts`, `unit/controller.test.ts`, `e2e/game.e2e.ts`

## État V1

- Dix onglets, aucune page factice ; vérifiés à 1 100, 1 280 et 1 440 px.
- Pastilles de coûts et d’effets, barres à paliers, tuiles de ressources, alertes à trois niveaux.

## Règles en vigueur

- **Coque** (`shell/GameLayout.svelte`) : hauteur de la fenêtre, seules les colonnes défilent. En-tête sur deux bandes : marque, fonction, étiquette, territoire, fil de presse tournant (son clic ouvre La France, section Presse dépliée) ; puis date et âge (lien « Note du … »), six indicateurs. Bandeau d’alertes sous l’en-tête (`AlertBar`).
- **Six onglets** (D-02, `tabs.ts`), dans une colonne gauche de 200 px ; Trimestre par défaut et après chaque tour :
  - **Trimestre** : agenda, puis sections « Fixe ce trimestre », « Situation » (ressources, dernier trimestre, profil, organisation), « Soutiens et tendances » ;
  - **Politique** : « Élections et campagnes » (calendrier, candidatures, campagnes, résultats, promesses), « Mandats », « Parti » (étiquette, adhésion ou départ, carrière dans le parti), « Médias » ;
  - **Vie privée** : « Santé et stress », « Exposition et justice », « Patrimoine » ;
  - **Mon réseau** : « Équipe », « Organisation et financement », « Relations » ;
  - **La France** : « Contexte national », « Partis et intentions de vote », « Institutions », « Presse » ;
  - **Journal**.
- **Sections** (`tabs/Section.svelte`) : titre et une ligne de résumé calculée par la projection (`PlayerView.sections`, `app/view/shell.ts`) ; le détail se déplie à la demande ; l’état déplié survit au changement d’onglet pendant la session (état d’interface, hors sauvegarde). « Fixe ce trimestre » est déplié d’office.
- **« Fixe ce trimestre »** (`PlayerView.fixed`) : revenus et charges certains du trimestre en préparation, hors actions du plan, dans l’ordre du tour : train de vie, organisation (production nette par amélioration active), indemnités de mandat, salaires de l’équipe, base militante (cotisations et accueil). Vide une fois la carrière terminée.
- **Carnet du plan** permanent en colonne droite de 300 px dès 1 100 px (`PlanNotebook`) ; en dessous, bouton compact qui ouvre le panneau `PlanSheet`.
- **Barre du bas** (`TurnControls`) : à gauche « Se retirer de la vie politique » (ou « Retraite annoncée… Renoncer ») ; temps utilisé, rappel des épinglages, état de sauvegarde, motif de blocage ; Accueil, Exporter, « Trimestre suivant ».
- Identité visuelle : DESIGN §10.10 (tokens de `routes/layout.css`, pastilles `EffectChip`, barres `StatBar`, `TierBadge`). Vérifiée à 1 100, 1 280 et 1 440 px (tests `@layout`).

## Décisions provisoires à confirmer

- Répartition des sections entre onglets (B-04, déléguée, provisoire) : exposition et justice dans Vie privée ; médias dans Politique ; soutiens dans Trimestre ; étiquette du joueur dans Politique, liste des partis dans La France.
- Sections repliées par défaut sauf « Fixe ce trimestre » ; résumés en une ligne tronquée (B-04, délégué).
- « Fixe ce trimestre » ne compte pas les missions de l’équipe ni les effets d’événements, incertains (B-04, délégué).
- Carnet du plan conservé en colonne droite (D-02, délégué).

## Limites connues

- Les cartes d’un panneau gardent leur propre titre sous celui de la section (titres en double, par exemple « Institutions ») : à reprendre avec l’agenda en cartes (B-11).
- La maquette prévoit des onglets avec pastilles d’alerte : non livrées.
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
- [x] Mise en œuvre, tests et fiche à jour (B-04)
