# Sauvegarde, import et export

> Fiche de fonctionnalité — état au 28 novembre 2026 (B-03). **Statut beta : en chantier (B-03, en revue).** Modèle et mode d’emploi : [README](README.md).

## Rôle dans le jeu

La fiabilité de la partie : sauvegarde automatique après chaque transition, copie précédente, onglets concurrents, export et import JSON, refus explicite des sauvegardes d’une autre version.

## Références

- GDD : —
- DESIGN : §4.1 (reprise, import)
- Décision : [0002](../decisions/0002-sauvegardes-beta.md) (sauvegardes non conservées pendant la beta)
- Historique ([archive V1](../archive/v1/), à ne lire que pour le pourquoi d’une règle) : ARCHITECTURE §10.1 (sauvegarde locale), §8.4 quinquadragesies (format de la V1)

## Code

- Persistance : `persistence/` (envelope, state-schema, local-storage, import-export). Contrat : ARCHITECTURE §10.
- Contrôleur : `app/controller.ts` (`readHome`, `newCareer`, `importFile`, `exportRefused`), `app/browser.ts` (téléchargement)
- Interface (`src/lib/components/`) : `shell/HomeScreen.svelte`, `shell/SaveBanner.svelte`
- Tests (`tests/`) : `unit/persistence.test.ts`, `unit/controller.test.ts`, `scenarios/save-resume.test.ts`, `scenarios/alpha.test.ts`, `e2e/game.e2e.ts` (sauvegarde ancienne, import, export), `fixtures/save-v1.json`

## Règles en vigueur

- **Enveloppe** : `format: 'republique-save'`, `saveVersion` (`SAVE_VERSION = 2`, format de la V1), `rulesVersion` et `contentVersion` (informatifs), `savedAt` (affichage seulement : aucune progression hors ligne), `state` complet (PRNG, décisions en attente, journal).
- **Pendant la beta, toute évolution de `GameState` incrémente `SAVE_VERSION`, sans migration** (décision 0002).
- **Lecture validée, dans l’ordre, sans aucune réparation** : taille ≤ 5 Mo (`too_large`) → JSON (`unreadable`) → format (`wrong_format`) → version → schéma Zod strict, invariants, références au catalogue (`invalid_state`, `incompatible_content`). Contrôle de la version :
  - future : `future_version`, « Cette sauvegarde provient d’une version plus récente du jeu. Elle n’a pas été modifiée. » ;
  - 1 (préversion : prototype, alpha, rush) : `outdated_rules`, message « préversion » ;
  - de 2 (`FIRST_BETA_SAVE_VERSION`) à `SAVE_VERSION − 1` : **`previous_version`**, « Cette partie vient d’une version précédente de la beta et ne peut plus être chargée. Elle n’a pas été modifiée. » Le refus intervient avant toute lecture de l’état ;
  - même version mais `rulesVersion` différente et état invalide : `outdated_rules` (« autre version de développement »), filet si un changement de l’état oubliait d’incrémenter `SAVE_VERSION`.
- **Stockage** (`localStorage`) : clés `la-republique-cest-moi:save` et `:save:previous`. Avant écriture, la sauvegarde courante valide devient la copie précédente. Lire ne modifie jamais le stockage. Une sauvegarde existante refusée (illisible, ancienne, future) n’est remplacée qu’avec `overwriteUnreadable`, donné seulement après confirmation du joueur (nouvelle carrière ou import) ; seule la courante est alors remplacée, la copie précédente refusée reste intacte. À la lecture, une courante refusée cède la place à la copie précédente valide, avec avertissement. Quota et échecs d’écriture remontent (`quota_exceeded`, `storage_unavailable`, `write_failed`).
- **Accueil** : une sauvegarde refusée s’affiche en alerte (message de l’erreur, « conservée telle quelle : vous pouvez l’exporter pour la garder ») ; « Reprendre » disparaît ; **« Exporter cette sauvegarde »** télécharge le texte stocké, octet pour octet (`la-republique-cest-moi-sauvegarde-v<N>.json`, ou `-illisible.json`) ; « Nouvelle carrière » demande confirmation avant de la remplacer.
- **Export / import** : en partie, `la-republique-cest-moi-AAAA-Tn.json`. L’import applique la même validation : une ancienne version est refusée avec le même message, en avis d’erreur, sans rien écrire ; une sauvegarde valide n’est importée qu’après confirmation si une partie existe.
- **Contrôleur** : autosauvegarde après nouvelle partie, tour, choix et fin ; conflit d’onglets (événement `storage`) bloque toute écriture et transition jusqu’au rechargement ; jamais de double résolution d’un tour ou d’un choix bloquant (scénario `save-resume`).
- **Sauvegarde témoin** `tests/fixtures/save-v1.json` (partie réelle, version 2, tour 10) : les tests la lisent avec une version courante simulée à `SAVE_VERSION + 1` et vérifient le refus `previous_version`, le message, l’absence d’écriture, l’export à l’identique et l’import refusé. Tant que `SAVE_VERSION` vaut sa version, un garde-fou vérifie aussi qu’elle reste lisible (un changement d’état sans incrément est ainsi détecté).

## Décisions provisoires à confirmer

- **Migrations supprimées** (décision déléguée, provisoire, B-03) : `persistence/migrations.ts` est retiré plutôt que neutralisé. La chaîne était vide, sans aucune migration écrite ; la garder obligeait à entretenir du code et des tests morts pendant toute la beta. Le mécanisme (fonctions pures `N → N+1`, refus si un maillon manque) se retrouve dans l’historique Git (fichier supprimé par B-03) et sera réintroduit au passage en 1.0 publique, depuis la première version conservée.
- **Sauvegarde témoin conservée** (décision déléguée, provisoire, B-03) : `save-v1.json` reste le cas « ancienne version refusée, sans écriture », grâce à la version courante injectable (`ReadOptions.saveVersion`, réservée aux tests). Une partie réelle couvre mieux le refus qu’une enveloppe fabriquée, et le test continue de valoir après chaque incrément.
- **Export de la sauvegarde refusée** (décision déléguée, provisoire, B-03) : texte brut, sans validation ; nom tiré de `saveVersion` lu dans le texte. Proposé pour toute sauvegarde refusée, pas seulement les anciennes versions.
- **E2E** : seule la préversion produit aujourd’hui une ancienne version dans le navigateur (`SAVE_VERSION = 2`) ; le test E2E l’utilise pour le parcours refus, export, import refusé, nouvelle partie. Le message « version précédente de la beta » est couvert par les tests unitaires.
- Filet `outdated_rules` sur `rulesVersion` (P2-10) et repli sur la copie précédente (P1-07) : conservés.

## Limites connues

- Une sauvegarde refusée reste dans le stockage jusqu’à une nouvelle carrière ou un import confirmé ; la copie précédente refusée n’est jamais nettoyée.

## Chantier beta

- Décisions du [dépouillement B-02](../playtests/2026-11-28-b-02-reference.md#décisions-par-retour) : décision 0002 (sauvegardes non conservées pendant la beta) → B-03.
- [x] Audit : règles en vigueur condensées ci-dessus, décisions provisoires listées (partie non rejouée : le système se vérifie par les tests unitaires et E2E de sauvegarde)
- [ ] Problèmes UX/UI relevés (captures, retours de playtest)
- [x] Plan de consolidation : la décision 0002 en tient lieu pour B-03
- [x] Mise en œuvre, tests et fiche à jour (B-03)
