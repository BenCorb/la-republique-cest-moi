# La République, c’est moi ! — Feuille de route beta

**Mise à jour : 28 novembre 2026.** Phases 0 à 3 terminées : V1 livrée (tag `v1.0.0`, PR #45). Historique complet : [archive/v1/ROADMAP.md](archive/v1/ROADMAP.md).

Ce document est la **source de vérité de l’avancement**. Une case n’est cochée que lorsque son critère est vérifié.

## 1. Objectif de la beta

Consolider le jeu existant **fonctionnalité par fonctionnalité** et retravailler l’UX/UI, sans élargir le périmètre. Chaque chantier part d’une fiche ([features/](features/README.md)) : audit, plan validé par le créateur, mise en œuvre, playtest ciblé. Les nouveautés de « l’après V1 » (§4) n’entrent qu’après décision explicite.

Contraintes inchangées : `AGENTS.md`. Sauvegardes conservées depuis la V1 : toute évolution de l’état exige une migration testée (ARCHITECTURE §10).

## 2. État

**Chantier en cours :** B-00 (réorganisation du dépôt).
**Prochaine étape :** B-01, puis B-02.

| ID | Chantier | Fiche(s) | Critère de fin | État |
| --- | --- | --- | --- | --- |
| B-00 | Réorganisation du dépôt pour la beta | — | Documents dans `docs/`, archive V1, fiches, `npm run verify` ; CI verte | en cours |
| B-01 | Découpage de `app/view-model.ts` par système | interface-coque | Un module de projection par système, `projectView` inchangé ; tous les tests passent sans modification de comportement | à faire |
| B-02 | Playtest de référence de la V1 | equilibrage, evenements-et-contenu | Carrière complète chronométrée ; relecture du ton ; retours triés par fiche | à faire |
| B-03 | Consolidation : coque d’interface et système visuel | interface-coque | Fiche consolidée | à faire |
| B-04 | Consolidation : agenda et actions | agenda | Fiche consolidée | à faire |
| B-05 | Consolidation : tour, accélération, note de cabinet | tour-et-acceleration | Fiche consolidée | à faire |
| B-06 | Consolidation : création, profil, premiers pas | creation-et-profil | Fiche consolidée | à faire |
| B-07 | Consolidation : élections, campagnes, mandats | elections-et-mandats | Fiche consolidée | à faire |
| B-08 | Consolidation : entourage et recrutement | entourage-et-recrutement | Fiche consolidée | à faire |
| B-09 | Consolidation : justice | justice | Fiche consolidée | à faire |
| … | Fiches suivantes, dans l’ordre décidé après B-02 | | | |

Ordre de B-03 à B-09 : **proposition, à confirmer par le créateur après le playtest de référence** (B-02). Il suit le parcours du joueur : ce qu’il voit en permanence, puis ce qu’il manipule chaque trimestre, puis les systèmes qui structurent une carrière. « Fiche consolidée » signifie : audit fait, décisions provisoires tranchées ou reconduites explicitement, problèmes d’UX/UI traités, tests à jour, playtest ciblé passé.

## 3. Méthode d’un chantier

1. Branche `feat/b-NN-<fiche>` (ou `fix/…`, `refactor/…`) depuis `main` à jour.
2. **Audit** de la fiche (premier commit, documentaire) : règles en vigueur, décisions provisoires, problèmes d’UX/UI.
3. **Plan** soumis au créateur ; décisions consignées dans la fiche.
4. Mise en œuvre par petits commits (`Refs: B-NN`), tests, fiche et documents à jour dans la même pull request.
5. `npm run verify` puis `npm run test:e2e` si l’interface ou la sauvegarde change ; CI verte ; fusion « squash ».
6. Playtest ciblé (`docs/playtests/`) ; la fiche passe à « consolidé ».

## 4. Après la V1 (hors beta sauf décision)

Présidentielle et ses mécaniques ; scission et création de parti ; activités parallèles (consultant, auteur, chroniqueur) ; déménagement, parachutage, grandes villes et départementales ; outre-mer ; plusieurs médias par région ; trafic d’influence ; délégation complète des tâches de l’organisation ; débauchage par un rival et réputation d’employeur.

**Hors périmètre :** version mobile dédiée, multijoueur, comptes, stockage serveur, IA générative en cours de partie, méta-progression, prestige, gestion exhaustive d’un pays ou d’entreprises.

## 5. Décisions attendues du créateur

- Ordre des chantiers B-03 et suivants (après B-02).
- Version affichée de la beta (`package.json` est encore en `0.0.1`).
- Déplacement du dépôt local hors de `~/Documents` (iCloud).
