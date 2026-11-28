# Guide commun de contenu

Règles valables pour **tout** texte de jeu : événements, choix, actions, presse, promesses, améliorations, nécrologies, personnages. À lire avant toute commande ([BRIEF.md](BRIEF.md)). La fiche du type (§9), quand elle existe, précise le format et prime sur ce guide pour ce type.

## 1. Rôle du contenu

Le contenu **raconte** (la carrière se lit dans les événements, la presse et le journal), **crée des choix** (chaque dilemme expose un arbitrage où chaque option coûte quelque chose) et **porte la satire** (les mécanismes et contradictions du pouvoir, pas des personnes). Il est écrit à l’avance, déclaratif, et s’adapte au contexte par des variables et des conditions (GDD §11).

## 2. Ton

**Le contraste entre un langage administratif, posé, et une situation absurde.** Phrases courtes, chute en fin de phrase, doubles sens, contradictions ; le narrateur ne rit jamais de sa propre blague. Le joueur est vouvoyé (« vous », « votre ») ; les récits de résultat sont à la deuxième personne. Les médias fictifs ont chacun leur voix (`media.json`, champ `line`).

### Exemples réussis (catalogue)

| Identifiant | Extrait | Pourquoi ça marche |
| --- | --- | --- |
| `campaign.anonymous_leaflet` (événement) | « un appartement à Paris, un chalet à la montagne et un avis sur tout ». Seul le dernier point est exact. | Énumération, puis chute sèche qui retourne l’accusation. |
| `institutions.transparency_audit` (événement) | […] dont un appartement que vous aviez, de bonne foi, oublié de posséder. | Formule administrative (« de bonne foi ») appliquée à une absurdité ; satire judiciaire sans désigner de coupable. |
| `mandate.council_tribune` (action) | relus par le cabinet du maire qui y cherche la diffamation. Il n’en trouve pas, de justesse. | Procédure ordinaire, sous-entendu en trois mots. |
| `headline.promise_kept_satire` (presse) | « {subject} » : un élu tient une promesse, une enquête est ouverte | Inversion de la norme, au format exact d’un titre de presse. |
| `media.horizon` (média) | Ses lecteurs le citent plus souvent qu’ils ne le lisent. | Caractérise un média fictif par un trait social, sans viser de titre réel. |

### Contre-exemples (rédigés pour ce guide, à ne pas reproduire)

| Défaut | Contre-exemple | Pourquoi c’est raté |
| --- | --- | --- |
| Trop appuyé | « Le maire, cet incroyable menteur, ment encore une fois de façon totalement absurde, LOL ! » | La blague est expliquée et criée ; plus de contraste, plus de chute. |
| Insulte gratuite | « Les militants du Front du Non, ces abrutis, collent leurs affiches à l’envers. » | Insulte un camp au lieu de montrer une contradiction ; la satire devient mépris. |
| Clin d’œil à une personne réelle | « Un ancien Premier ministre à la pipe célèbre vous conseille de “ne jamais rien lâcher”. » | Il faut connaître une personnalité réelle pour comprendre, et on lui prête un rôle. |
| Morale imposée | Choix : « Refuser l’enveloppe, comme tout élu honnête » / « Accepter l’enveloppe et trahir vos électeurs ». | Le texte dit quelle est la bonne réponse ; le choix n’est plus un arbitrage. |
| Plat | « Une réunion a lieu. Vous y assistez. Cela se passe bien. » | Ni situation, ni enjeu, ni chute : rien à raconter, rien à décider. |

## 3. Langue et identifiants

- **Textes en français**, typographie française telle que le catalogue la pratique : apostrophe courbe `’` (jamais `'`), guillemets « » avec une espace simple à l’intérieur, espace simple avant `: ; ! ?`, heures « 20 h » ou « 6 h 12 », milliers séparés par une espace simple (« 2 000 tracts »). Le catalogue n’emploie pas d’espace insécable : ne pas en introduire dans un lot isolé. **Identifiants et clés en anglais.**
- **Format** : `famille.nom` en minuscules, chiffres et `_` (`CONTENT_ID_PATTERN` : `^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$`). Un troisième segment décline une entrée : `promise.tax_cut.municipal`, `mission.chief.agenda`, `engagement.union.shift`. Les identifiants de choix sont locaux à l’événement, un seul mot (`thank`, `defy`, `renounce`).
- **Préfixe = la famille de l’entrée** :
  - catalogues de référence : `support.`, `trait.`, `party.`, `media.`, `headline.`, `promise.`, `theme.`, `offense.`, `mandate.`, `election.`, `portfolio.`, `post.`, `mission.`, `profile.`, `origin.`, `engagement.`, `ambition.`, `region.`, `lifestyle.`, `era.`, `obituary.`, `distinction.`, `institution.`, `cast.`, `tier.`, `family.` (familles d’actions) ;
  - actions et améliorations : préfixe du domaine (`mandate.`, `activism.`, `media.`, `party.`, `campaign.`, `staff.`, `personal.`, `organization.`, `communication.`, `network.`, `wealth.`, `government.`, `matignon.`, `justice.`, `lifestyle.`, `engagement.<parcours>.`) ;
  - événements : préfixe du fichier ou du sujet (`press.`, `family.`, `epoch.`, `promise.`, `mandate.`, `relations.`…) ; deux cas à part : `chain.` pour une chaîne sur plusieurs événements, `unique.` pour une scène qui n’arrive qu’une fois par carrière.
- **Stabilité** : les sauvegardes référencent les identifiants. Un identifiant publié ne se renomme pas, ne se supprime pas et **ne se réutilise jamais** pour une autre entrée, même après retrait. Corriger un texte ne change pas son identifiant.
- **Variables** : seulement `{role}`, en minuscules, et seulement les rôles que le type sait résoudre (déclarés dans `actors` pour un événement, ou fournis par le moteur : `{subject}` en presse, `{promise}`, `{place}`, `{years}`…). Copier les variables d’une entrée voisine ; la validation refuse toute autre accolade.

## 4. Interdits

1. **Personnes réelles identifiables** : aucune, ni nommée ni reconnaissable par un détail (fonction datée, tic, surnom, physique). Partis, médias et institutions peuvent évoquer clairement des réalités françaises (GDD §8.1) ; les personnes, jamais. Aucun comportement répréhensible attribué à une figure réelle. Les institutions réelles (Élysée, Matignon, Bercy, Sénat) restent des lieux, sans titulaire nommé.
2. **Stéréotypes** liés à une origine (géographique, nationale, sociale), un genre ou une religion, y compris sous forme d’accent, de prénom « typé » ou de trait de caractère attribué à un groupe.
3. **Lien entre un nom ou une origine et un rôle, un trait ou une affaire** : un prénom, un patronyme ou une origine ne détermine jamais qui est corrompu, compétent, ridicule ou victime (D-09). Les noms des personnages fixes et générés sont tirés indépendamment des rôles.
4. **Jauge morale** : aucun texte ne note la vertu du joueur ni ne la présente comme une valeur (« votre intégrité baisse »).
5. **Information cachée révélée** : un texte visible ne dévoile ni trait caché, ni loyauté réelle, ni fait judiciaire non découvert, ni tirage futur, ni date d’une règle à venir. Les aperçus de choix (`hints`) donnent des tendances, pas des chiffres.
6. **Réponse morale imposée** : un choix expose une décision ; chaque option a un coût, aucune n’est « la bonne ». Un dilemme bloquant garde une option de repli toujours disponible.
7. **Génération de texte en cours de partie** : aucun texte produit à la volée ; tout est écrit, relu et validé avant publication.
8. **Anachronismes** : rien d’une époque ultérieure (réseau Piaf, assistant automatique…) hors de son époque (`era.*`, GDD §8.3).

## 5. Longueurs

Mesurées le 28 novembre 2026 sur `main` (`f114dfa`), en caractères Unicode, variables `{…}` comprises telles qu’écrites. **Norme : viser la médiane ; au-delà du 90ᵉ centile, justifier ; ne jamais dépasser le maximum.**

| Type de texte | Champ | n | Médiane | 90ᵉ c. | Max |
| --- | --- | ---: | ---: | ---: | ---: |
| Titre d’événement | `events[].title` | 165 | 24 | 35 | 56 |
| Texte d’événement | `events[].text` | 165 | 168 | 205 | 305 |
| Libellé de choix | `choices[].label` | 269 | 29 | 44 | 66 |
| Aperçu de choix (par ligne, 2 lignes en médiane, 3 au plus) | `choices[].hints[]` | 495 | 22 | 35 | 58 |
| Récit de résultat (conséquence, une phrase) | `choices[].outcome[]` | 115 | 103 | 154 | 208 |
| Souvenir de relation | `effects[].memory` | 71 | 44 | 58 | 74 |
| Titre de presse | `headlines[].text` | 150 | 66 | 85 | 112 |
| Libellé d’action | `actions[].label` | 117 | 29 | 40 | 48 |
| Description d’action | `actions[].description` | 117 | 133 | 164 | 292 |
| Raison d’indisponibilité | `actions[].unavailableReason` | 87 | 33 | 79 | 117 |
| Libellé de promesse | `promises[].label` | 22 | 42 | 52 | 57 |
| Description de promesse | `promises[].description` | 22 | 166 | 190 | 199 |
| Libellé d’amélioration | `upgrades[].label` | 16 | 31 | 47 | 49 |
| Description d’amélioration | `upgrades[].description` | 16 | 136 | 199 | 260 |
| Description de média | `media[].description` | 17 | 158 | 169 | 181 |
| Description de trait | `traits[].description` | 10 | 41 | 56 | 60 |
| Titre de nécrologie | `obituaries[].headline` | 17 | 48 | 60 | 63 |
| Texte de nécrologie | `obituaries[].text` | 17 | 219 | 249 | 281 |

Structure observée : 2 choix par dilemme en médiane, 4 au plus ; un récit de résultat est une seule phrase (DESIGN §4.4 autorise trois phrases au plus) ; 56 événements sur 165 sont des brèves sans choix.

Mesure refaite par un script Node jetable, hors dépôt, qui lit les catalogues de `src/lib/game/content/data/`, compte `[...texte].length` par champ et calcule médiane, 90ᵉ centile et maximum. Pour la refaire, le recopier dans un dossier temporaire :

```js
// node mesure.mjs src/lib/game/content/data
import fs from 'node:fs';
import path from 'node:path';
const dir = process.argv[2];
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const events = fs.readdirSync(path.join(dir, 'events')).flatMap((f) => read('events/' + f).events);
const choices = events.flatMap((e) => e.choices ?? []);
const sets = {
	'events.title': events.map((e) => e.title),
	'events.text': events.map((e) => e.text),
	'choices.label': choices.map((c) => c.label),
	'choices.hints': choices.flatMap((c) => c.hints ?? []),
	'choices.outcome': choices.flatMap((c) => c.outcome ?? []),
	'effects.memory': choices.flatMap((c) => (c.effects ?? []).map((e) => e.memory).filter(Boolean)),
	'headlines.text': read('media.json').headlines.map((h) => h.text),
	'actions.description': read('actions.json').actions.map((a) => a.description)
	// … même principe pour les autres champs du tableau
};
for (const [name, texts] of Object.entries(sets)) {
	const l = texts.map((t) => [...t].length).sort((a, b) => a - b);
	const n = l.length;
	const median = n % 2 ? l[(n - 1) / 2] : Math.round((l[n / 2 - 1] + l[n / 2]) / 2);
	console.log(name, n, median, l[Math.ceil(0.9 * n) - 1], l[n - 1]);
}
```

## 6. Effets et équilibrage

- **Seulement les opérations déclaratives déjà utilisées** dans le catalogue du type (schémas : `src/lib/game/content/schemas.ts`). Opérations courantes du contenu : `addSupport` (groupe), `addResource` (`influence`, `politicalBudgetCents`, `personalCashCents`), `addResourceRandom` (min..max), `addStat` (`player.stress`, `player.exposure`, `player.health`, `player.defense`), `addRelation` (rôle, avec `memory` facultatif), `addMediaRelation`, `addIndicator` (`economy`, `socialClimate`, `stability`), `addPartyStrength`, `recordFact` (infraction, gravité, complices), `prepareCampaign`, `advancePromise`, `familyAttitude`. Les autres opérations (`hireStaff`, `grantMandate`, `declareCandidacy`…) appartiennent à la mécanique d’un système : ne les employer que si une entrée voisine du même domaine le fait déjà. Aucun `eval`, aucune opération nouvelle sans chantier moteur.
- **Montants en centimes** (`…Cents`) : 150 000 = 1 500 €.
- **Rester dans les barèmes des entrées voisines** : choisir trois entrées du même type et du même domaine, reprendre leurs ordres de grandeur ; une nouvelle entrée n’est ni la plus rentable ni la moins rentable de son domaine. Repères actuels pour un choix d’événement (valeur absolue, médiane / max) : soutien d’un groupe 2 / 6, influence 2 / 5, exposition 4 / 8, stress 2 / 25, relation 10 / 25, relation média 6 / 15, indicateur national 2 / 3.
- **Tentation** : un choix opportuniste apporte un avantage tangible et inscrit un fait (`recordFact`) que la justice et la presse exploiteront ; il n’est jamais puni immédiatement par principe (GDD §1.3).
- **Les barèmes vont changer** : B-08 recale tous les montants sur des valeurs réalistes (et livre `npm run content:report`, qui mesurera le rendement par point de temps et les volumes par thème) ; B-12 transforme les effets d’actions en fourchettes. Ne pas anticiper ces chantiers : écrire au barème actuel, B-08 recalera tout le catalogue d’un coup.

## 7. Procédure

1. Vérifier que le chantier de contenu est ouvert (`docs/ROADMAP.md` §2) et qu’aucune pull request ouverte ne touche les mêmes fichiers (`gh pr list`, `gh pr diff <n> --name-only`).
2. Branche depuis `main` à jour : `feat/b-<nn>-<sujet>` (par exemple `feat/b-16a-medias-breves`).
3. Ajouter les entrées dans le catalogue concerné, sans reformater le reste ; vérifier que l’idée n’existe pas déjà (recherche dans le catalogue).
4. Faire passer `npm run content:validate`, `npm run test` et `npm run lint` (et `npm run content:report` dès qu’il existe). Ne jamais annoncer une commande non lancée.
5. Commit `feat(content): …` (description en français, à l’impératif), pied `Refs: B-<nn>`.
6. Pull request vers `main` : liste des entrées (identifiant, titre, résumé d’une ligne), échantillon de relecture (§8), commandes et résultats, doutes (barème, idée voisine, format deviné). Ne pas fusionner : le créateur relit.

## 8. Relecture par échantillon (D-12)

- Le créateur relit **toujours** les contenus sensibles : justice, origines sociales, noms de personnes, groupes de population.
- Ailleurs, **une entrée sur cinq**, tirée au sort ; la pull request indique la méthode (par exemple, rang de l’entrée modulo 5 égal au dernier chiffre du numéro de pull request).
- Si l’échantillon révèle un problème de ton, **le lot entier est corrigé**, pas seulement les entrées relues.

## 9. Fiches par type

| Fiche | Type de contenu | Livrée avec | D’ici là |
| --- | --- | --- | --- |
| `actions.md` | Actions d’agenda (cartes, formats, types, rotation) | B-11 | Déduire le format de trois actions voisines dans `actions.json` |
| `promesses.md` | Promesses et déclinaisons par thème, scrutin et couleur | B-14 | Trois promesses voisines dans `promises.json` |
| `emplois.md` | Offres d’emploi par parcours, emplois de complaisance | B-10, puis B-16c | Pas de format existant : attendre B-10 |
| `origines.md` | Événements et textes propres à une origine | B-13, puis B-16c | Trois événements voisins ; `profiles.json` pour les origines |
| Noms | Prénoms, noms, liste d’exclusion de personnalités réelles | B-07 | `world.json` (`names`) et `cast.json` ; ne pas ajouter de noms avant B-07 |
| Événements, presse | Événements, brèves, titres de presse | aucune fiche prévue (B-16a utilise les formats V1) | Trois entrées voisines dans `events/*.json` ou `media.json` (`headlines`, par angle et ton) |

Pour tout type sans fiche : choisir trois entrées existantes du même type et du même domaine, et en copier la structure, les champs, les longueurs et les barèmes.
