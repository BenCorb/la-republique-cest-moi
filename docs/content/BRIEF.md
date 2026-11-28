# Modèle de commande de contenu

Prompt générique à donner à un agent (Codex, Claude ou autre) pour produire du contenu de jeu. Remplacer les champs `{…}`, puis copier le bloc entier.

**Statut : provisoire.** Rédigé au dépouillement B-02 (décision D-12). Tant que le guide commun (`docs/content/README.md`) et les fiches par type n’existent pas, l’agent déduit le format des entrées existantes. Le chantier B-06 révisera ce modèle pour renvoyer au guide commun.

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
2. Lis, s’ils existent : docs/content/README.md (guide commun) et la fiche du type,
   docs/content/<type>.md. Ils priment sur tout ce qui suit.
3. Sinon, appuie-toi sur :
   - le ton : docs/DESIGN.md §8 ; les règles de fiction : docs/GAME_DESIGN.md
     (paragraphe sur les noms fictifs et la satire judiciaire) ;
   - le format : le catalogue concerné dans src/lib/game/content/data/
     et ses types et schémas (src/lib/game/content/types.ts, schemas.ts) ;
   - la fiche du système concerné (docs/features/), et ses décisions du dépouillement B-02
     (docs/playtests/2026-11-28-b-02-reference.md, « Décisions par retour »).
4. Choisis 3 entrées existantes du même type et du même domaine comme modèles.
   Note leurs longueurs de texte, leurs coûts et leurs effets : ce sont tes barèmes.

## Règles d’écriture
- Textes en français, identifiants en anglais, stables et uniques, au format des voisins.
  Ne réutilise ni ne renomme jamais un identifiant existant.
- Humour : le contraste entre langage administratif et situations absurdes ; phrases courtes,
  doubles sens, contradictions. Pas d’insulte gratuite, pas de réponse morale imposée :
  un choix expose une décision, chaque option a un coût.
- Univers fictif : partis, médias, personnes et lieux inventés. Aucune personne réelle
  identifiable ; aucun comportement criminel attribué à une figure réelle.
- Aucun stéréotype lié à une origine, un genre ou une religion. Un nom ou une origine ne
  détermine jamais un rôle, un trait ou une affaire.
- Pas de jauge morale, aucune information cachée révélée dans un texte visible.
- Effets : seulement les opérations déclaratives déjà utilisées dans le catalogue. Coûts et
  effets dans les fourchettes de tes modèles ; un nouveau contenu ne doit être ni le plus
  rentable ni le moins rentable de son domaine.
- Variété : pas deux entrées sur la même idée ; vérifie que l’idée n’existe pas déjà
  (recherche dans le catalogue).

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
   - **à relire par le créateur** : toutes les entrées sensibles (justice, origines sociales,
     noms, groupes de population), plus un tirage au sort d’une entrée sur cinq parmi les
     autres, en indiquant comment tu as tiré ;
   - les commandes exécutées et leurs résultats ;
   - les doutes : barème incertain, idée proche d’une entrée existante, format deviné.
6. Si le relecteur signale un problème de ton sur l’échantillon, corrige le lot entier.

Ne modifie ni le moteur, ni l’interface, ni les règles. Ne fusionne pas, ne déploie pas.
```

## Exemple de commande remplie (vague 1)

- `{TYPE}` : brèves de presse
- `{NOMBRE}` : 12
- `{DOMAINE}` : presse locale, vie municipale
- `{CONTRAINTES}` : époque 2000–2010, ton de la presse régionale, aucune brève sur le joueur
- `{CHANTIER}` : B-16a

## Quand lancer quoi

Voir [ROADMAP](../ROADMAP.md) §2 : vague 1 (B-16a) après B-06, vague 2 (B-16b) après B-08 et B-11, vague 3 (B-16c) après B-10, B-13 et B-14. Deux agents ne travaillent jamais sur les mêmes fichiers en même temps.
