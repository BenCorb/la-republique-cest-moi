# Audit du projet avant le rush V1

**Date :** 27 novembre 2026. **Branche :** `feat/v1-rush` (règles `0.39.0`).
**Statut :** document de travail. Les recommandations ne sont pas des décisions : chaque point
marqué « décision » attend l'accord du créateur avant d'entrer dans `ROADMAP.md` ou `GAME_DESIGN.md`.

**Objectif rappelé par le créateur :** la V1 est une bêta à faire jouer à des amis. Il faut pouvoir
aller au bout d'une partie, s'amuser, relancer une deuxième carrière qui ne ressemble pas à la
première, et vivre des trajectoires politiques très différentes.

## 1. Méthode

- Relecture de `GAME_DESIGN.md`, `ROADMAP.md`, des décisions de `ARCHITECTURE.md` §8.4 et des limites
  connues (§15), et des retours de `PLAYTEST.md`.
- Inventaire des catalogues : 56 actions, 125 événements, 14 améliorations, 6 fonctions, 4 scrutins.
- Simulation de 60 carrières (`npm run simulate -- --runs 60 --seed audit --strategy all`), puis
  mesure de la taille des sauvegardes (`npm run benchmark`).
- Recherche sur des jeux du même genre (sources en fin de document).

## 2. Synthèse

Le socle est solide : moteur déterministe, aucune violation d'invariant sur 60 carrières, systèmes
riches (justice, presse, promesses, réformes, entourage, militants, territoire). Les manques
tiennent moins aux systèmes qu'à **ce que le joueur fait et vise au quotidien** :

1. **Peu de choses à faire, et presque rien de propre à son mandat.** Un maire, un député et un
   ministre disposent des mêmes actions ; seuls la démission et les deux actions de réforme dépendent
   du mandat. C'est le retour PT-B2-002, déjà rattaché à P3-24.
2. **Pas de sommet de carrière.** La fonction la plus haute est le ministère (15 carrières sur 60) ;
   ni Premier ministre, ni présidentielle, alors que le concept du GDD (§1.1) annonce qu'« un
   personnage peut devenir président ».
3. **Pas de prise en main.** Aucun tutoriel ni objectif de départ : un ami qui découvre le jeu ne
   sait pas par où commencer.
4. **La tentation est trop rare.** En moyenne moins d'une affaire par carrière, trois condamnations
   sur 60 carrières : le pilier « Tentation » (GDD §1.3) pèse peu.
5. **Les parties sont trop longues.** Durée active estimée : médiane 75 minutes, plus de
   100 minutes pour les stratégies patrimoniale et mixte, contre une cible de 45 à 60 minutes. On ne
   peut pas non plus arrêter sa carrière quand on le décide.
6. **L'argent n'a plus d'usage en fin de carrière.** Fortune médiane 615 000 €, et jusqu'à 3,8 M€.

## 3. Ce que font bien les jeux comparables

| Jeu                                     | Ce qui marche                                                                                                                                                        | Chez nous                                                                     | Écart                                                                                  |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Suzerain** (gouvernement narratif)    | Chaque choix a un coût ; les conséquences s'accumulent au fil des choix ; des conseillers expliquent les options ; sauvegarde automatique, pas de retour en arrière. | Dilemmes, conseils selon la compétence, sauvegarde unique.                    | Peu de décisions de gouvernement propres au mandat.                                    |
| **Reigns** (cartes)                     | Un geste simple aux conséquences lourdes ; pioche pondérée qui écarte les cartes hors contexte et récentes ; plusieurs fins à découvrir.                             | Pioche pondérée et anti-répétition (P3-15), nécrologies et distinctions.      | Distinctions découvertes seulement à la fin, sans collection ni envie de les chercher. |
| **Crusader Kings III** (récit émergent) | Récit émergent né des systèmes ; personnages qui ont leurs ambitions ; tutoriel qui montre l'interface petit à petit.                                                | Personnages, relations, monde autonome.                                       | Pas d'objectif facultatif, pas de tutoriel ; rivaux et dirigeants de parti peu actifs. |
| **BitLife** (simulateur de vie)         | Des « rubans » récompensent des façons de vivre et poussent à rejouer autrement ; hasard et ton léger.                                                               | Distinctions de fin de carrière.                                              | Pas de collection des distinctions entre parties ; pas de fin de carrière choisie.     |
| **Democracy 4** (politiques publiques)  | Électeurs répartis en groupes ; chaque mesure fait des gagnants et des perdants ; les groupes satisfaits finissent par tenir leurs acquis pour dus.                  | Trois électorats et trois appuis, soutiens qui reviennent vers une référence. | Suffisant pour la V1 ; l'usure des acquis peut attendre.                               |
| **The Political Machine** (campagne)    | Accessible et satirique. **Défaut relevé :** une stratégie dominante s'installe et la rejouabilité s'effondre.                                                       | Satire, stratégies simulées.                                                  | À surveiller : la stratégie ambitieuse finit toujours député ou sénateur.              |

**Ce qu'on en retient :**

- les mêmes règles doivent produire des parties différentes, sans laisser s'installer une stratégie
  dominante ;
- des objectifs facultatifs donnent envie de rejouer autrement, sans méta-progression ;
- le jeu s'apprend par étapes, pas d'un bloc ;
- chaque fonction occupée doit offrir des choix qui lui sont propres.

## 4. Constats détaillés

### 4.1 Contenu et choix du quotidien

- **Actions :** 56 au catalogue. Une fois retirées les actions de recrutement, les formats d'action,
  le train de vie et les actions réservées à un autre terrain, il en reste une quinzaine par
  trimestre. Aucune action d'exécutif local (budget, inauguration, arbitrage d'un permis), aucune
  action parlementaire (question au gouvernement, amendement, travail de circonscription), aucune
  action ministérielle.
- **Formats d'action promis mais non planifiés :** le GDD (§5.1) et la ROADMAP (§5.2) annoncent la
  collecte et le meeting en trois formats « ensuite », mais aucune tâche ne les porte.
- **Activités parallèles** (GDD §7.1 : consultant, auteur, chroniqueur) : seules les actions de
  terrain d'engagement existent.
- **Presse répétitive :** la même manchette reparaît en moyenne 132 fois par carrière ; le titre
  d'interview neutre jusqu'à 107 fois. Plusieurs titres ne sont jamais utilisés (élections perdues,
  train de vie). P3-24 prévoit déjà de diversifier la presse.
- **Événements répétitifs :** la demande d'augmentation d'un collaborateur revient jusqu'à 20 fois
  par carrière (348 occurrences au total) ; les dilemmes de promesse jusqu'à 6 fois. Trois événements
  ne sont jamais atteints (`institutions.list_rank`, `media.owner_scoop`, `relations.grudge_portrait`).

### 4.2 Carrière et objectifs

- **Sommet de carrière absent :** voir §2. Le gouvernement suit les législatives, sans présidentielle
  ni cohabitation (ARCHITECTURE §15.2).
- **Un seul adversaire, un seul tour :** P3-29 affichera des résultats complets, mais son critère
  porte sur l'affichage. Il faut préciser si le calcul du score reste un duel ou si plusieurs
  candidats y prennent part (décision).
- **Rivaux et dirigeants de parti peu actifs :** les dirigeants de parti n'apparaissent que dans les
  textes, sans agir (ARCHITECTURE §15.2). P3-34 (carrière partisane) en fera en partie des acteurs.
- **Pas de fin choisie :** le concept permet de « renoncer à la politique » (GDD §1.1), mais une
  carrière ne s'arrête qu'à la mort ou sur condamnation grave. C'est aussi le moyen le plus simple
  de raccourcir une partie.
- **Pas d'objectifs :** l'ambition est libre (pilier 1), ce qui convient à un joueur averti ; un
  débutant a besoin de repères.

### 4.3 Équilibrage (simulation de 60 carrières)

| Mesure                       | Valeur                                                                                         | Commentaire                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Durée active estimée         | médiane 75 min ; ambitieuse 51, prudente 74, aléatoire 68, mixte 102, patrimoniale 106         | Au-dessus de la cible de 45–60 min ; à chronométrer en P3-09.                                    |
| Interventions significatives | médiane 112 par carrière                                                                       | Beaucoup d'arrêts : à réduire pour tenir la durée.                                               |
| Fin de carrière              | 33 morts naturelles, 27 problèmes de santé                                                     | Aucune fin judiciaire ni fin choisie.                                                            |
| Plus haute fonction          | ministre 15, député 18, maire 9, sénateur 8, conseil régional 6, aucune 3, conseil municipal 1 | Diversité correcte, mais rien au-dessus du ministère.                                            |
| Promesses abandonnées        | jusqu'à 30 par carrière (ambitieuse)                                                           | Trop de promesses impossibles à tenir ; le rappel « promesse trahie ailleurs » revient 125 fois. |
| Affaires du joueur           | 0 à 3, souvent 0 ; 3 condamnations sur 60 carrières                                            | Tentation trop rare : seuls huit choix opportunistes en créent.                                  |
| Fortune finale               | médiane 615 000 €, maximum 3,8 M€                                                              | L'argent n'a plus d'usage en fin de carrière.                                                    |
| Partis                       | PS et RPR (24 chacun)                                                                          | Effet des stratégies simulées, pas un défaut du jeu.                                             |

### 4.4 Cohérence des documents

- **`GAME_DESIGN.md`** :
  - l'en-tête dit encore « version 0.1, cadrage initial, avant prototype » ;
  - §3.2 annonce qu'on peut « fonder un mouvement », alors que la scission est reportée après la
    V1 ;
  - §7.3 (« liberté de candidature ») doit être aligné sur l'investiture décidée pour P3-30 ;
  - §5.3 (délégation des actions récurrentes) et §8.1–8.2 (fusions, scissions et créations de
    partis) ne sont pas implémentés : à marquer comme reportés après la V1 ;
  - §7.4 annonce des débats, qui n'existent qu'en événement de campagne.
- **`ARCHITECTURE.md` §15** : la version des règles indiquée (`0.32.0`) est périmée (`0.39.0`) ;
  les limites connues datent de l'alpha et sont à mettre à jour en P3-10.

### 4.5 Technique et diffusion

- **Taille des sauvegardes :** 455 Ko pour 84 trimestres (271 Ko avant la phase 3), 974 Ko pour 223
  trimestres. Avec la copie de secours, une longue carrière approche 2 Mo, pour un quota usuel de
  5 Mo. P3-29 (résultat détaillé de chaque scrutin) et les vagues de contenu vont encore l'alourdir :
  à mesurer dans chaque tâche.
- **Diffusion aux amis :**
  - le paramètre `?seed=` n'est pas documenté pour les joueurs ;
  - sans JavaScript, la page reste bloquée sur l'écran de chargement (pas de message `<noscript>`) ;
  - mise en page non vérifiée sous 1 100 px de large ;
  - aucun moyen intégré de renvoyer un retour ;
  - format de sauvegarde encore jetable (P3-10 prévoit la migration).
- **Dépôt :** dans `~/Documents`, donc potentiellement synchronisé par iCloud ; aucune copie
  « nom 2 » trouvée aujourd'hui.

## 5. Recommandations triées

Taille : S (quelques heures), M (une tâche), L (plusieurs sessions).

### 5.1 Indispensable à la bêta V1

| Réf. | Proposition                                                                                                                                                                                                                                                                                 | Taille | Où                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------ |
| A1   | **Premiers pas guidés :** trois à cinq objectifs facultatifs pour les premiers trimestres (adhérer ou rester indépendant, réunir un noyau militant, se présenter aux municipales…), qu'on peut masquer, avec une aide contextuelle sur les écrans clés ; l'interface se dévoile par étapes. | M      | Nouvelle tâche, avant P3-27    |
| A2   | **Fin de carrière choisie :** action « Se retirer de la vie politique », confirmée, qui mène au bilan avec une nécrologie adaptée. Elle permet aussi de raccourcir une partie.                                                                                                              | S      | Nouvelle tâche (petite)        |
| A3   | **Actions propres aux mandats**, dans le paquet PT-B2-002 : au moins deux actions par fonction (maire, conseil régional, député, sénateur, ministre).                                                                                                                                       | M      | P3-24 (préciser le critère)    |
| A4   | **Plus de tentation :** davantage de choix opportunistes liés aux fonctions (marchés, emplois, financement de campagne), pour que les affaires et la justice comptent dans une carrière sur deux.                                                                                           | M      | P3-24 (préciser le critère)    |
| A5   | **Durée et nombre d'arrêts :** viser 45–60 min, réduire les arrêts d'accélération inutiles et revoir le nombre de promesses abandonnées.                                                                                                                                                    | M      | P3-09 (déjà prévu, à préciser) |
| A6   | **Presse et événements moins répétitifs :** interviews et demandes d'augmentation ; utiliser les titres jamais affichés.                                                                                                                                                                    | M      | P3-24                          |
| A7   | **Préparer la diffusion :** message `<noscript>`, seed documentée, vérification à 1 100 px, taille des sauvegardes mesurée.                                                                                                                                                                 | S      | P3-10                          |

### 5.2 Souhaitable en V1 (forte valeur pour rejouer et comparer)

| Réf. | Proposition                                                                                                                                                                                                                                   | Taille | Où                         |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------- |
| B1   | **Sommet de carrière** (décision) : nomination au poste de Premier ministre par événement, et présidentielle simplifiée tous les cinq ans, qui exige une stature nationale et s'appuie sur le résultat multi-candidats de P3-29.              | L      | Nouvelle tâche après P3-30 |
| B2   | **Carnet des carrières :** archive locale des carrières terminées (nécrologie, plus haute fonction, distinctions) et liste des distinctions déjà obtenues. Simple affichage, sans bonus : la règle « pas de méta-progression » est respectée. | S      | Nouvelle tâche, ou P3-27   |
| B3   | **Même seed entre amis :** bouton « Rejouer cette partie » et affichage de la seed dans le bilan, pour que plusieurs joueurs comparent leurs carrières sur le même monde.                                                                     | S      | P3-10                      |
| B4   | **Exporter un retour :** bouton qui télécharge la sauvegarde accompagnée d'une note libre, à envoyer au créateur. Aucun serveur nécessaire.                                                                                                   | S      | P3-10                      |
| B5   | **Débouchés pour l'argent en fin de carrière :** formats de collecte et de meeting (prévus mais jamais planifiés), mécénat ou fondation, rachat d'un média.                                                                                   | M      | P3-24 ou nouvelle tâche    |
| B6   | **Ambition de départ facultative** (décision) : à la création, choisir une ambition (« Maire à vie », « Ministre », « Fortune », « Les mains propres »), rappelée dans le bilan. Une variante plus légère de B2.                              | S      | Création, P3-24            |

### 5.3 Après la V1

- Scission et création de parti, fusions et alliances (décision déjà prise : après la V1).
- Délégation complète des actions récurrentes (GDD §5.3).
- Activités parallèles : consultant, auteur, chroniqueur.
- Seconds tours et cohabitation, si B1 n'en a pas besoin.
- Usure des acquis des groupes électoraux, à la manière de Democracy 4.
- Son et musique, portraits.
- Déménagement, parachutage, outre-mer, plusieurs médias par région (déjà listés dans la ROADMAP).

## 6. Décisions demandées au créateur

1. **B1, sommet de carrière :** Premier ministre et présidentielle en V1, ou report assumé (et
   modification du concept dans le GDD §1.1) ?
2. **P3-29 :** le calcul du score reste un duel et seul l'affichage montre toutes les candidatures,
   ou plusieurs candidats prennent part au calcul ?
3. **A1, A2 et les recommandations B à retenir :** les inscrire comme nouvelles tâches du rush (avec
   leur ordre).
4. **Mise à jour du GDD :** autoriser une passe de mise en cohérence (§4.4), sans changer de
   décision, en début de rush.

## Sources

- Suzerain : [Gaming Trend](https://gamingtrend.com/reviews/youve-got-my-vote-suzerain-review/),
  [Vice](https://www.vice.com/en/article/suzerain-game-review/),
  [Wikipédia](<https://www.Wikipedia.org/wiki/Suzerain_(video_game)>),
  [articy](https://www.articy.com/en/?p=4725).
- Reigns : [PC Gamer](https://pcgamer.com/how-reigns-and-its-forthcoming-sequel-make-their-tinderocracy-work),
  [Game Developer, narration adaptative](https://gamedeveloper.com/design/game-design-deep-dive-creating-an-adaptive-narrative-in-i-reigns-i-),
  [TechRaptor](https://techraptor.net/content/reigns-review-addicted-death).
- Crusader Kings III : [PC Gamer](https://pcgamer.com/crusader-kings-3-review),
  [AV Club](https://www.avclub.com/crusader-kings-iii-emergent-narrative),
  [Game Developer, tutoriel](https://gamedeveloper.com/design/deep-dive-refreshing-the-crusader-kings-iii-tutorial-mode-through-optimized-ux).
- BitLife : [Gamezebo](https://www.gamezebo.com/walkthroughs/bitlife-life-simulator-achievements-list-all-63-achievements-and-how-to-get-them/),
  [Gameluster](https://gameluster.com/?p=32010).
- Democracy 4 : [guide de jeu](https://gameplay.tips/guides/8590-democracy-4.html),
  [blog du concepteur](https://positech.co.uk/cliffsblog/category/game-design/page/5).
- The Political Machine : [Softpedia 2016](https://www.softpedia.com/reviews/games/pc/the-political-machine-2016-review-500164.shtml),
  [New Game Network 2020](https://www.newgamenetwork.com/article/2281/the-political-machine-2020-review).
- Prise en main : [Roblox, onboarding](https://create.roblox.com/docs/production/game-design/onboarding),
  [Wayline](https://www.wayline.io/blog/tutorials-onboarding-funnel-not-faq).
