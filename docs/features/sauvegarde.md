# Sauvegarde, import et export

> Fiche de fonctionnalité — état au 28 novembre 2026 (audit de B-03). **Statut beta : en chantier (B-03).** Modèle et mode d’emploi : [README](README.md).

## Rôle dans le jeu

La fiabilité de la partie : sauvegarde automatique après chaque transition, copie précédente, onglets concurrents, export et import JSON, migrations.

## Références

- GDD : —
- DESIGN : §4.1 (reprise, import)
- Historique ([archive V1](../archive/v1/), à ne lire que pour le pourquoi d’une règle) :
  - ARCHITECTURE §10.1 (sauvegarde locale)
  - ARCHITECTURE §8.4 quinquadragesies (premier format conservé)

## Code

- Moteur (`src/lib/game/engine/`) : —
- Contenu (`src/lib/game/content/data/`) : —
- Projection (`src/lib/game/app/view-model.ts`) : `app/controller.ts`, `app/browser.ts`
- Interface (`src/lib/components/`) : `shell/SaveBanner.svelte`, `shell/HomeScreen.svelte`
- Tests (`tests/`) : `unit/persistence.test.ts`, `unit/controller.test.ts`, `scenarios/save-resume.test.ts`, `fixtures/save-v1.json`
- Persistance : `persistence/` (envelope, migrations, state-schema, local-storage, import-export). Contrat : ARCHITECTURE §10.

## État V1

- `SAVE_VERSION = 2`, premier format conservé ; toute évolution de l’état passe par une migration testée.

## Règles en vigueur

_Audit de B-03, avant mise en œuvre ; tiré du code et d’ARCHITECTURE §10._

- **Enveloppe** : `format: 'republique-save'`, `saveVersion` (`SAVE_VERSION = 2`), `rulesVersion` et `contentVersion` (informatifs), `savedAt` (affichage seulement, jamais lu par la simulation : aucune progression hors ligne), `state` complet (PRNG, décisions en attente, journal).
- **Lecture validée, dans l’ordre, sans aucune réparation** : taille ≤ 5 Mo (`too_large`) → JSON (`unreadable`) → format (`wrong_format`) → version → schéma Zod strict, invariants, références au catalogue (`invalid_state`, `incompatible_content`).
  - version future : refus `future_version`, sauvegarde non modifiée ;
  - version 1 (préversion : prototype, alpha, rush) : refus `outdated_rules` avec message « préversion » ;
  - version ancienne ≥ 2 : chaîne de migrations `N → N+1` (`migrations.ts`, vide), refus `unsupported_version` si un maillon manque. **Contraire à la décision 0002** : c’est ce que B-03 remplace ;
  - même version mais `rulesVersion` différente et état invalide : refus `outdated_rules` (« autre version de développement »), filet hérité de l’alpha.
- **Stockage** (`localStorage`) : clés `la-republique-cest-moi:save` et `:save:previous`. Avant écriture, la sauvegarde courante valide devient la copie précédente. Une sauvegarde existante illisible, incompatible ou future n’est jamais écrasée sans `overwriteUnreadable`, donné seulement après confirmation du joueur (nouvelle carrière ou import). À la lecture, une courante illisible cède la place à la copie précédente valide, avec avertissement. Quota et échecs d’écriture remontent (`quota_exceeded`, `storage_unavailable`, `write_failed`).
- **Accueil** : une sauvegarde inutilisable est signalée (`role="alert"`, message de l’erreur, « conservée telle quelle ») ; « Reprendre » disparaît ; **aucun export de la sauvegarde refusée n’est proposé** (l’export n’existe qu’en cours de partie, `exportCurrent`).
- **Export / import** : fichier `la-republique-cest-moi-AAAA-Tn.json` ; l’import applique la même validation, n’écrit rien sans confirmation si une partie existe ; un refus s’affiche en avis d’erreur.
- **Contrôleur** : autosauvegarde après nouvelle partie, tour, choix et fin ; conflit d’onglets (événement `storage`) bloque toute écriture et transition jusqu’au rechargement ; jamais de double résolution d’un tour ou d’un choix bloquant (scénario `save-resume`).
- **Sauvegarde témoin** `tests/fixtures/save-v1.json` (version 2, tour 10) : un test exige qu’elle reste lisible sans migration, ce que la décision 0002 abandonne.

## Décisions provisoires à confirmer

- Filet `outdated_rules` sur `rulesVersion` (hérité de P2-10) : garde un message lisible si une évolution de l’état oubliait d’incrémenter `SAVE_VERSION`. Conservé par B-03.
- Repli sur la copie précédente quand la courante est illisible (P1-07). Conservé.
- Pendant la beta : décision 0002 (sauvegardes non conservées, refus avec message, export et nouvelle partie).

## Limites connues

- Pas d’export d’une sauvegarde refusée depuis l’accueil (à corriger par B-03, décision 0002).
- Le texte de pied de l’accueil parle encore de l’« Alpha ».

## Chantier beta

- Décisions du [dépouillement B-02](../playtests/2026-11-28-b-02-reference.md#décisions-par-retour) : décision 0002 (sauvegardes non conservées pendant la beta) → B-03.
- [x] Audit : règles en vigueur condensées ci-dessus, décisions provisoires listées (partie non rejouée : le système se vérifie par les tests unitaires et E2E de sauvegarde)
- [ ] Problèmes UX/UI relevés (captures, retours de playtest)
- [ ] Plan de consolidation validé par le créateur
- [ ] Mise en œuvre, tests et fiche à jour
