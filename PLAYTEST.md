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
