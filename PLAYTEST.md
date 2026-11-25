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

#### Retours en cours de session

- **Mairie et conseil municipal (26 novembre 2026, gênant).** Être à la fois maire et membre du
  conseil municipal est voulu (le maire est élu par le conseil parmi ses membres), mais le jeu
  compte deux mandats dans le cumul (2 places sur 3) et les affiche séparément. Correction
  retenue pour la série de corrections du playtest : compter « conseil municipal + mairie » pour
  un seul mandat dans le cumul et les afficher ensemble (« Mairie (et siège au conseil
  municipal) »). Temps réservé et indemnités restent cumulés.
- **Composer le plan est trop laborieux (26 novembre 2026, gênant).** L’agenda affiche une
  longue liste de cartes (≈ 18 actions), chacune avec description, coûts et effets, dans un ordre
  sans logique visible. Les actions inaccessibles y figurent aussi : actions des autres
  professions, actions de parti sans adhésion, actions de campagne sans candidature. Trouver
  l’action voulue demande de parcourir toute la liste. Pistes proposées :
  1. **Masquer ce qui est hors de portée.** Une action dont la condition n’est pas remplie
     (`condition_not_met` : autre profession, pas d’adhésion, pas de campagne, pas de mandat)
     disparaît de la liste ; un lien « Afficher les actions indisponibles » la montre à la
     demande, avec son motif. Une action seulement bloquée ce trimestre (temps, argent, limite
     atteinte) reste visible mais grisée, avec ce qui manque.
  2. **Regrouper par thème**, groupes déclarés dans le catalogue (`category` de chaque action) et
     repliables : militantisme, parti, campagne, réseau, finances politiques, revenus et métier,
     vie personnelle. Un groupe sans action disponible est masqué.
  3. **Lignes compactes** au lieu de cartes : nom, temps, coût et effet principal sur une ligne,
     bouton « + » ; description et détail des effets au survol ou en dépliant. Compteur
     « − 2 + » pour les actions répétables.
  4. Plus tard (P3-08) : épinglage des étapes du plan, aide contextuelle, composition plus
     graphique du trimestre.

  Recommandation : faire 1 à 3 dans la série de corrections du playtest (interface et catalogue,
  sans changement de règle) ; 4 reste en P3-08.

- **Budget politique trop difficile à faire grossir (26 novembre 2026, gênant).** Constat
  chiffré :
  - recettes avant un mandat national : collecte de 100 à 400 € pour 25 points de temps
    (influence 5 requise), fichier de donateurs à 120 € par trimestre (un seul), don depuis
    l’argent personnel (1 € pour 1 €), mission de collecte du trésorier (1 500 € à compétence 60,
    pour 1 000 € de salaire) ;
  - les mandats locaux (conseil municipal, mairie, conseil régional) et le ministère ne
    rapportent aucun budget politique ; seuls l’Assemblée (5 000 € par trimestre) et le Sénat
    (3 000 €) en rapportent ;
  - dépenses courantes de 300 à 1 500 € : réunion publique, meeting, salaires de l’entourage,
    attaché de presse ;
  - en simulation (P2-10), le budget est le goulot d’étranglement jusqu’au premier mandat
    national, puis déborde : budget final médian ≈ 45 000 € pour les stratégies élues, 430 €
    pour la stratégie patrimoniale, en charges impayées les trois quarts du temps.

  Pistes (réglages provisoires, à choisir) :
  1. **Moyens des mandats locaux** : mairie 600 €, conseil régional 300 €, conseil municipal 50 €
     par trimestre.
  2. **Remboursement des frais de campagne** : à partir de 5 % des voix, une partie des dépenses
     de campagne est remboursée après le scrutin (règle française, matière à satire).
  3. **Dotation du parti** : un adhérent investi reçoit une aide de campagne de son parti,
     selon la force de celui-ci.
  4. **Gala de levée de fonds** : action de milieu de carrière (influence 20) rapportant 1 000 à
     3 000 €, avec un risque d’événement sur les donateurs.
  5. **Collecte proportionnée** : son rendement croît avec l’influence ou le soutien des
     militants.
  6. **Trésorier plus rentable** : mission de collecte portée à 2 500 €.

  Recommandation : 1, 2 et 4 corrigent la marche d’escalier entre le début de carrière et le
  premier mandat national, sans rendre le budget gratuit ; vérifier ensuite par simulation que
  les charges impayées baissent sans que le budget déborde davantage.
