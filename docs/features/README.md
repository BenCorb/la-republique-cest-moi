# Fiches de fonctionnalités

Une fiche par système de jeu. C’est **le point d’entrée d’une session de travail** sur ce système : on lit `AGENTS.md`, la fiche, puis seulement les sections du GDD, de `DESIGN.md` et du code qu’elle cite. L’archive V1 n’est ouverte que pour retrouver le pourquoi d’une règle.

## Mode d’emploi

1. **Audit** (premier pas de tout chantier beta) : condenser dans « Règles en vigueur » les règles et chiffres actuels, tirés du code et des sections d’archive citées ; lister les décisions déléguées encore provisoires ; jouer le système et noter les problèmes d’UX/UI. Une fois l’audit fait, la fiche doit suffire sans l’archive.
2. **Plan** : proposer au créateur les corrections, les simplifications et la refonte d’interface ; consigner ses décisions dans la fiche (ou dans `docs/decisions/` si elles dépassent le système).
3. **Mise en œuvre** : une branche et une pull request par chantier ; tests ; fiche mise à jour dans la même pull request.
4. **Validation** : playtest ciblé (`docs/playtests/`), puis statut « consolidé ».

Statuts : **à auditer** → **audité** → **en chantier** → **consolidé**. Le statut figure en tête de fiche et dans le tableau ci-dessous ; [ROADMAP.md](../ROADMAP.md) fixe l’ordre des chantiers.

## Index

| Fiche | Système | Statut |
| --- | --- | --- |
| [tour-et-acceleration](tour-et-acceleration.md) | Boucle trimestrielle au tour par tour, note de cabinet, retraite | en chantier (B-04) |
| [agenda](agenda.md) | Plan du trimestre, actions, formats | à auditer |
| [evenements-et-contenu](evenements-et-contenu.md) | Événements, chaînes, époques, ton | à auditer |
| [economie-et-organisation](economie-et-organisation.md) | Ressources, améliorations, charges | à auditer |
| [sante-et-fin](sante-et-fin.md) | Santé, stress, causes de fin, retraite | à auditer |
| [creation-et-profil](creation-et-profil.md) | Création, territoire, ambition, premiers pas | à auditer |
| [entourage-et-recrutement](entourage-et-recrutement.md) | Postes clés, recrutement, délégation | à auditer |
| [personnages-et-relations](personnages-et-relations.md) | Personnages nommés, rivaux, relations | à auditer |
| [soutiens-et-militants](soutiens-et-militants.md) | Groupes de soutien, base militante | à auditer |
| [elections-et-mandats](elections-et-mandats.md) | Calendrier, campagnes, scrutins, mandats | à auditer |
| [partis-gouvernement-monde](partis-gouvernement-monde.md) | Partis, gouvernement, Matignon, contexte | à auditer |
| [promesses](promesses.md) | Promesses de campagne | à auditer |
| [medias-et-presse](medias-et-presse.md) | Médias, presse régionale, fil d’actualité | à auditer |
| [justice](justice.md) | Faits, dossiers, peines | à auditer |
| [patrimoine](patrimoine.md) | Actifs, train de vie | à auditer |
| [institutions](institutions.md) | Réformes institutionnelles | à auditer |
| [bilan-et-carnet](bilan-et-carnet.md) | Bilan, carnet, seed et partage | à auditer |
| [interface-coque](interface-coque.md) | Coque à six onglets, composants partagés, identité visuelle | en chantier (B-04) |
| [sauvegarde](sauvegarde.md) | Sauvegarde, refus des anciennes versions, import/export | audité (B-03 livré) |
| [equilibrage](equilibrage.md) | Simulateur, mesures, réglages | à auditer |

## Modèle d’une fiche

```markdown
# Titre

> Fiche de fonctionnalité — état au <date ou tag>. **Statut beta : …**

## Rôle dans le jeu
## Références        (GDD §, DESIGN §, archive)
## Code              (moteur, contenu, projection, interface, tests)
## État V1
## Règles en vigueur
## Décisions provisoires à confirmer
## Limites connues
## Chantier beta     (cases à cocher)
```

Garder une fiche courte : ce qui est vrai aujourd’hui, pas l’historique. Un changement de règle passe aussi par le GDD s’il touche une décision fonctionnelle validée.
