# Playtests — La République, c’est moi !

Ce document consigne les essais humains. Les simulations CPU mesurent la cohérence et les dérives
des règles ; elles ne permettent pas de conclure qu’une carrière est agréable ou dure 45–60 minutes.

## P1-10 — Validation humaine du prototype

**Statut : session terminée et validée le 24 novembre 2026.** Le créateur a joué une carrière
complète avec la seed prévue jusqu’au bilan de fin.

### Protocole

1. Ouvrir une nouvelle carrière avec `?seed=playtest-p1-10` afin de rendre la session rejouable.
2. Jouer jusqu’au bilan, sans consulter les données internes ni les effets cachés.
3. Utiliser librement « Trimestre suivant », « Année suivante » et « Jusqu’à une alerte » ; noter
   les moments où l’accélération s’arrête trop souvent, trop tard ou sans raison comprise.
4. Mesurer le temps actif approximatif, hors installation et pauses longues.
5. Exporter la sauvegarde finale si une anomalie doit être reproduite.

### Résultats

- **Testeur et parcours :** créateur du jeu, carrière complète jusqu’au bilan avec
  `playtest-p1-10` dans le navigateur intégré. La durée active, l’âge et la cause de fin n’ont pas
  été chronométrés ou relevés ; la cible de 45–60 minutes reste donc à mesurer lors de P3-09.
- **Fonctionnement :** aucun bug rencontré. Les boutons sont réactifs, les fenêtres de décision
  s’affichent correctement et les actions essayées produisent le résultat attendu.
- **Base produit :** impression générale positive ; le prototype constitue une base solide et la
  boucle peut être menée de bout en bout.
- **Rythme et cohérence du plan :** après « Trimestre suivant », le plan est vidé, tandis que
  « Année suivante » et « Jusqu’à une alerte » conservent le plan récurrent. Cette différence est
  comprise techniquement mais ressentie comme incohérente et oblige à répéter les mêmes clics.
- **Lisibilité :** l’interface est jugée lourde et trop textuelle. Pour la V1, réduire les textes
  permanents, déplacer les explications secondaires vers des infobulles ou une aide contextuelle et
  rendre la composition du trimestre plus graphique.
- **Navigation :** étudier un espace de planification plus direct, éventuellement un onglet dédié,
  afin d’éviter de faire défiler la page pour retrouver l’agenda.
- **Réglage :** aucun signal du playtest ne justifie d’annuler le passage provisoire de
  `ordinaryEventChance` à `0,30`.

### Décision P1-10

P1-10 est validée : lots seedés, rapports JSON/CSV, invariants et fins analysés, puis carrière
humaine complète documentée. Le réglage `ordinaryEventChance = 0,30` est conservé provisoirement.
La dette UX n’empêche pas la validation du prototype : elle est reportée explicitement à P3-08 et
sera réévaluée par les playtests de P3-09.

## Alpha — Validation humaine avant la phase 3

**Statut : à jouer (prévu le 26 novembre 2026).** Version publiée :
https://bencorb.github.io/la-republique-cest-moi/ (`main`, règles `0.17.0`).

### Objectif

Vérifier, avant d’ajouter les systèmes de la phase 3, que le cœur de l’alpha tient en partie
réelle : rythme, lisibilité des nouveaux écrans et intérêt des choix de carrière. L’alpha est
jetable (décision du 25 novembre 2026) : une mise à jour peut rendre ces parties illisibles ;
exporter la sauvegarde pour garder une trace.

### Protocole

1. Jouer **deux carrières** aux profils contrastés, chacune avec une seed rejouable :
   - `?seed=playtest-alpha-1` : origine et profession au choix, en visant une carrière élective
     (candidatures, mandats, cumul) ;
   - `?seed=playtest-alpha-2` : un profil opposé, en jouant plutôt l’organisation, l’entourage
     ou la famille.
2. Jouer jusqu’au bilan si possible, sinon au moins 40 ans de carrière ; ne pas consulter les
   données internes.
3. Utiliser librement les trois commandes d’avance ; noter chaque arrêt d’accélération ressenti
   comme inutile, trop tardif ou incompris.
4. Chronométrer le temps actif (hors pauses) ; relever l’âge, la cause de fin et le sommet de
   carrière au bilan.
5. Exporter la sauvegarde finale ou celle d’une anomalie, avec la date de jeu concernée.

### Points à observer

| Sujet        | Question                                                                                                 | Mesure CPU de référence                                       |
| ------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Rythme       | « Jusqu’à une alerte » s’arrête-t-il trop souvent pour les élections ?                                   | ≈ 25 arrêts d’élection par carrière avec un plan vide (P2-09) |
| Durée        | Une carrière entre-t-elle dans 45–60 minutes actives ?                                                   | 174 trimestres, 34 décisions par carrière (P2-10)             |
| Création     | Les origines et professions donnent-elles des débuts différents et lisibles ?                            | —                                                             |
| Carrière     | Candidature, campagne, sondages et résultat sont-ils compréhensibles ? La défaite est-elle surmontable ? | —                                                             |
| Entourage    | Recrutement, missions et conseils sont-ils utiles et lisibles ?                                          | —                                                             |
| Famille      | La vie de famille apparaît-elle assez ?                                                                  | ≈ 0,1 enfant par carrière en simulation (P2-08)               |
| Organisation | Le regroupement et le départ d’un militant suffisent-ils ?                                               | —                                                             |
| Plan         | Le plan reconduit convient-il, ou faut-il épingler les tâches une par une ?                              | —                                                             |
| Répétition   | Des événements reviennent-ils trop souvent ?                                                             | 8 occurrences au plus par carrière (P2-10)                    |
| Satire       | Le ton des partis et des événements fonctionne-t-il ? Des textes à revoir ?                              | —                                                             |

### Résultats

_À compléter après la session : testeur, seeds, durée, âge et cause de fin, sommet de carrière,
bugs, irritants classés (bloquant, gênant, mineur) et décisions._
