# Décisions durables

Une décision qui dépasse un seul système (convention de travail, choix technique transversal, arbitrage du créateur sur la vision) tient dans un fichier court et numéroté : `NNNN-sujet-court.md`. Une décision propre à un système va dans sa fiche ([features/](../features/README.md)).

Ne jamais réécrire une décision acceptée : en écrire une nouvelle qui la remplace et mettre à jour le statut de l’ancienne.

## Modèle

```markdown
# NNNN — Titre

- **Date :** AAAA-MM-JJ
- **Statut :** proposée | acceptée | remplacée par NNNN
- **Décidée par :** créateur | déléguée (provisoire)

## Contexte
## Décision
## Conséquences
```

## Index

| N° | Décision | Statut |
| --- | --- | --- |
| [0001](0001-organisation-beta.md) | Organisation du dépôt et du travail pour la beta | acceptée ; conservation des sauvegardes remplacée par 0002 |
| [0002](0002-sauvegardes-beta.md) | Sauvegardes non conservées pendant la beta | acceptée |
