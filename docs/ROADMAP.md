# La République, c’est moi ! — Feuille de route beta

**Mise à jour : 28 novembre 2026.** Phases 0 à 3 terminées : V1 livrée (tag `v1.0.0`, PR #45). Historique complet : [archive/v1/ROADMAP.md](archive/v1/ROADMAP.md).

Ce document est la **source de vérité de l’avancement**. Une case n’est cochée que lorsque son critère est vérifié.

## 1. Objectif de la beta

Consolider le jeu existant et retravailler l’UX/UI. Chaque chantier part d’une fiche ([features/](features/README.md)) : audit, plan validé par le créateur, mise en œuvre, playtest ciblé. Les nouveautés de « l’après V1 » (§4) n’entrent qu’après décision explicite.

**Beta v2** : le jalon qui applique les décisions du playtest de référence B-02 ([dépouillement](playtests/2026-11-28-b-02-reference.md#dépouillement-après-la-session), décisions D-01 à D-12). Il rend le jeu plus lisible (six onglets, démarches sans temps, agenda en cartes), plus incertain et plus rejouable (fourchettes lues par l’entourage, rotation, promesses tirées), plus réaliste (montants, emploi, financement, origines) et purement au tour par tour. Il se termine par un playtest chronométré (B-18). Référence visuelle approuvée par le créateur : [maquette de la coque](maquettes/2026-11-28-coque-beta-v2.html) (textes et chiffres d’exemple).

Contraintes : `AGENTS.md`. Sauvegardes : non conservées pendant la beta, sans migration ([décision 0002](decisions/0002-sauvegardes-beta.md)).

## 2. État

**Chantier en cours :** aucun ; B-02 dépouillé (décisions D-01 à D-12).
**Prochaine étape :** B-03 (sauvegardes de beta), puis B-04, B-05 et B-11, qui livrent ensemble la refonte visuelle. B-06 et B-07 peuvent avancer en parallèle (fichiers distincts).

| ID | Chantier | Fiche(s) | Décisions | Dépend de | Critère de fin | État |
| --- | --- | --- | --- | --- | --- | --- |
| B-00 | Réorganisation du dépôt pour la beta | — | — | — | Documents dans `docs/`, archive V1, fiches, `npm run verify` ; CI verte | fait (PR #46) |
| B-01 | Découpage de `app/view-model.ts` par système | interface-coque | — | — | Un module de projection par système, `projectView` inchangé ; tous les tests passent sans modification de comportement | fait (PR #47) |
| B-02 | Playtest de référence de la V1 | toutes | D-01 à D-12 | — | Retours triés par fiche, décisions consignées, plan de la beta v2 ; chronométrage reporté à B-18 | fait (dépouillé) |
| **Lot 1 — Fondations** | | | | | | |
| B-03 | Sauvegardes de beta | sauvegarde | 0002 | — | Une sauvegarde d’ancienne version est refusée avec message, export et nouvelle partie, sans écriture ; tests de persistance à jour | à faire |
| B-04 | Coque à six onglets et tour par tour | interface-coque, tour-et-acceleration | D-02 (coque), D-07, D-08 (bouton) | B-03 | Six onglets ; carnet permanent ; « Fixe ce trimestre » ; résumé puis détail ; « Accélérer » et « Année suivante » retirés de l’interface (moteur conservé pour la simulation) ; bouton de retraite ; GDD §2 et §2.3 réécrits ; e2e à jour | à faire |
| B-05 | Démarches sans temps | agenda, tour-et-acceleration | D-02 (démarches), D-08 | B-04 | Liste des démarches sortie de l’agenda ; application à la résolution dans l’ordre du tour ; annulation avant le tour ; « Démarches signées » au carnet ; retraite en démarche | à faire |
| B-11 | Agenda en cartes | agenda | D-02 (cartes, épingles) | B-05 | Sept thèmes, cinq cartes au gabarit unique, panneau de détail, icône par action, types (toujours là, contexte, rotation, ce trimestre), rotation seedée, règles d’épinglage ; `docs/content/actions.md` | à faire |
| B-06 | Guide commun de contenu et modèle de commande | evenements-et-contenu | D-12 | — | `docs/content/README.md` (ton, langue, interdits, longueurs, procédure, relecture par échantillon) et `docs/content/BRIEF.md` | à faire |
| B-07 | Nom du personnage et diversité des noms | creation-et-profil, personnages-et-relations | D-09 | B-03 | Prénom, nom et accord à la création, tirage seedé ; catalogue élargi et diversifié ; exclusion des personnalités réelles validée ; textes à la 3ᵉ personne accordés | à faire |
| **Lot 2 — Économie** | | | | | | |
| B-08 | Montants réalistes | economie-et-organisation, patrimoine, equilibrage | D-11 (montants, frais du député), D-12 (rapport) | B-05 | Barème trimestriel sourcé ; coût de la vie ; salaires de l’équipe ; frais de mandat et crédit collaborateurs ; `npm run content:report` (rendement par point de temps, volumes par thème) | à faire |
| B-09 | Financement politique | economie-et-organisation, partis-gouvernement-monde, justice | D-11 (parti, prêts), D-04 | B-08 | Dotation du parti et rallonge ; reversement des indemnités ; prêts de campagne et personnel ; plafond des dons légaux ; payer de sa poche avec fait de financement occulte | à faire |
| B-10 | Emploi | patrimoine, creation-et-profil | D-05 | B-05, B-08 | Offres selon parcours ; mi-temps ou plein temps réservé comme un mandat ; préavis d’un trimestre ; emplois de complaisance ; fin à la nomination au gouvernement | à faire |
| **Lot 3 — Effets et profils** | | | | | | |
| B-12 | Effets incertains et prévision par l’entourage | agenda, entourage-et-recrutement | D-03 | B-08, B-11 | Fourchettes ; lecture par poste (direction et intensité sans titulaire) ; compétence qui resserre la fourchette et améliore le résultat ; « la dernière fois » | à faire |
| B-13 | Origines | creation-et-profil | D-10 | B-08, B-10, B-12 | Revenu de famille, biens, train de vie naturel et déclassement, bonus de famille d’actions, lecture d’une ressource, plafonds et événements propres, affaires héritées | à faire |
| **Lot 4 — Campagnes** | | | | | | |
| B-14 | Promesses tirées | promesses | D-06 | B-05 | Déclinaisons par thème, scrutin et couleur politique ; quatre thèmes tirés à la déclaration ; annonce en démarche ; `docs/content/promesses.md` | à faire |
| B-15 | Fusions de listes | elections-et-mandats | D-01 | B-05 | Choix du partenaire ; acceptation ou refus ; une tentative ; veto du parti ; coût d’une fusion contre-nature | à faire |
| **Lot 5 — Contenu et validation** | | | | | | |
| B-16 | Production de contenu | evenements-et-contenu | D-12 | B-06, B-11, B-13, B-14 | Rotation remplie dans chaque thème, opportunités, emplois, événements d’origine, promesses ; fiches par type ; relecture par échantillon faite | à faire |
| B-17 | Équilibrage de la beta v2 | equilibrage | — | B-08 à B-16 | Simulation sur les nouvelles règles ; écart entre origines jouable ; accès à Matignon tranché ; durée simulée dans 60–90 min | à faire |
| B-18 | Playtest de la beta v2 | toutes | — | B-17 | Deux carrières chronométrées (milieu populaire, grande bourgeoisie) ; retours triés par fiche | à faire |

**Ordre et dépendances (délégué, provisoire, à valider par le créateur).** D’abord ce qui change la forme de tout le reste : sauvegardes, coque, démarches, puis l’agenda en cartes, avancé dans le lot 1 pour livrer d’un bloc la refonte visuelle (décision déléguée au 28 novembre 2026 : les cartes lisent les montants du catalogue, que B-08 recalera sans les refaire). Puis l’économie, parce que ses barèmes conditionnent l’emploi, les origines, les fourchettes et le rapport d’équilibrage. Puis les effets incertains et les origines, les campagnes, et enfin le contenu en volume, l’équilibrage et le playtest. Chaque chantier commence par l’audit de sa fiche (§3) : les fiches qu’il touche en sortent consolidées.

**Hors beta v2.** Les fiches peu touchées par B-02 (justice hors D-04, institutions, médias et presse, santé et fin, bilan et carnet, soutiens et militants, sauvegarde hors B-03) seront consolidées après la beta v2, dans un ordre fixé après B-18.

## 3. Méthode d’un chantier

1. Branche `<type>/b-NN-<sujet>` depuis `main` à jour.
2. **Audit** de la fiche (premier commit, documentaire) : règles en vigueur, décisions provisoires, problèmes d’UX/UI, décisions B-02 qui la concernent.
3. **Plan** soumis au créateur ; décisions consignées dans la fiche.
4. Mise en œuvre par petits commits (`Refs: B-NN`), tests, fiche et documents à jour dans la même pull request.
5. `npm run verify` puis `npm run test:e2e` si l’interface ou la sauvegarde change ; CI verte ; fusion « squash ».
6. Playtest ciblé (`docs/playtests/`) ; la fiche passe à « consolidé ».

## 4. Après la V1 (hors beta sauf décision)

Présidentielle et ses mécaniques ; scission et création de parti ; activités parallèles autres que l’emploi (consultant, auteur, chroniqueur ; l’emploi entre dans la beta, D-05) ; déménagement, parachutage, grandes villes et départementales ; outre-mer ; plusieurs médias par région ; trafic d’influence ; délégation complète des tâches de l’organisation ; débauchage par un rival et réputation d’employeur.

Ajouts du dépouillement B-02 : montages financiers élaborés (association écran, prête-noms ; D-04) ; plusieurs tentatives de fusion (D-01) ; générateur de squelettes de contenu (D-12).

**Hors périmètre :** version mobile dédiée, multijoueur, comptes, stockage serveur, IA générative en cours de partie, méta-progression, prestige, gestion exhaustive d’un pays ou d’entreprises.

## 5. Décisions attendues du créateur

- Validation de l’ordre des chantiers B-03 à B-18 (§2).
- Agenda (D-02) : la déclaration de candidature devient-elle une démarche sans temps ? Opportunités « ce trimestre seulement » dès B-11 ? Recherche de secours « toutes les actions » ?
- Accès à Matignon (décision provisoire du protocole B-02, à trancher en B-17).
- Version affichée de la beta (`package.json` est encore en `0.0.1`) ; proposition : `0.2.0` au terme de la beta v2.
- Déplacement du dépôt local hors de `~/Documents` (iCloud) : des copies « nom 2.ext » apparaissent encore dans `build/`.
