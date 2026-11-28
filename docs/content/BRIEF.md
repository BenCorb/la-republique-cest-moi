# Modèle de commande de contenu

Prompt générique à donner à un agent (Codex, Claude ou autre) pour produire du contenu de jeu. Remplacer les champs `{…}`, puis copier le bloc entier.

**Statut : en vigueur depuis B-06.** Les règles d’écriture (ton, langue, identifiants, interdits, longueurs, effets, procédure, relecture) sont dans le [guide commun](README.md) ; ce modèle ne fixe que la commande, les vérifications et la livraison. Les fiches par type arrivent avec le chantier de leur système (guide §9).

```text
Tu travailles sur « La République, c’est moi ! » (dépôt BenCorb/la-republique-cest-moi).
Tâche : produire du contenu de jeu.

## Commande
- Type de contenu : {TYPE}  (ex. événements, brèves de presse, actions, promesses, offres d’emploi)
- Nombre : {NOMBRE}
- Domaine / thème : {DOMAINE}  (ex. Médias, campagne municipale, vie de section)
- Contraintes particulières : {CONTRAINTES}  (ex. époque 2000–2010, type de carte « Rotation », origine « milieu populaire », « aucun choix opportuniste »)
- Chantier : {CHANTIER}  (ex. B-16a)

## Avant d’écrire
1. Lis AGENTS.md, puis docs/ROADMAP.md §2 : vérifie que le chantier {CHANTIER} est ouvert
   et qu’aucune pull request en cours ne modifie les fichiers que tu vas toucher
   (`gh pr list`, puis `gh pr diff <n> --name-only`). Si c’est le cas, arrête-toi et signale-le.
2. Lis d’abord docs/content/README.md (guide commun) en entier, puis la fiche du type,
   docs/content/<type>.md, si elle existe (guide §9). Ils priment sur ce modèle.
3. Lis le catalogue concerné dans src/lib/game/content/data/, ses types et schémas
   (src/lib/game/content/types.ts, schemas.ts) et la fiche du système (docs/features/).
4. Choisis 3 entrées existantes du même type et du même domaine comme modèles.
   Note leurs longueurs, leurs coûts et leurs effets : ce sont tes barèmes (guide §5 et §6).
5. Vérifie que chaque idée n’existe pas déjà (recherche dans le catalogue).

## Écriture
Applique le guide commun. Ne modifie ni le moteur, ni l’interface, ni les règles,
ni les entrées existantes : un texte existant raté se signale dans la pull request.

## Livraison
1. Branche `feat/{chantier-en-minuscules}-{sujet-court}` depuis `main` à jour
   (ex. `feat/b-16a-medias-breves`).
2. Ajoute les entrées dans les fichiers du catalogue concerné, sans reformater le reste.
3. Exécute et fais passer : `npm run content:validate`, `npm run test`, `npm run lint`.
   Si `npm run content:report` existe, exécute-le et corrige ce qu’il signale.
   Ne prétends pas qu’une commande a réussi sans l’avoir lancée.
4. Commit au format Conventional Commits, description en français à l’impératif :
   `feat(content): ajouter {NOMBRE} {TYPE} ({DOMAINE})`, pied `Refs: {CHANTIER}`.
5. Ouvre une pull request (brouillon) avec :
   - la liste des entrées ajoutées (identifiant, titre, une ligne de résumé) ;
   - **à relire par le créateur** (guide §8) : toutes les entrées sensibles (justice,
     origines sociales, noms, groupes de population), plus un tirage au sort d’une entrée
     sur cinq parmi les autres, en indiquant comment tu as tiré ;
   - les commandes exécutées et leurs résultats ;
   - les doutes : barème incertain, idée proche d’une entrée existante, format deviné.

## Relecture
Si le relecteur signale un problème de ton sur l’échantillon, corrige le lot entier.
Ne fusionne pas, ne déploie pas.
```

## Exemple de commande remplie (vague 1)

- `{TYPE}` : brèves de presse
- `{NOMBRE}` : 12
- `{DOMAINE}` : presse locale, vie municipale
- `{CONTRAINTES}` : époque 2000–2010, ton de la presse régionale, aucune brève sur le joueur
- `{CHANTIER}` : B-16a

## Quand lancer quoi

Voir [ROADMAP](../ROADMAP.md) §2 : vague 1 (B-16a) après B-06, vague 2 (B-16b) après B-08 et B-11, vague 3 (B-16c) après B-10, B-13 et B-14. Deux agents ne travaillent jamais sur les mêmes fichiers en même temps.
