# Playtests

Un fichier par session : `AAAA-MM-JJ-sujet.md` (par exemple `2026-12-02-agenda.md`). Les playtests de la V1 (P1-10, alpha, P3-09, B1, B2) sont archivés dans [archive/v1/PLAYTEST.md](../archive/v1/PLAYTEST.md).

Chaque retour porte un identifiant stable (`PT-<sujet>-NNN`) et finit dans la fiche du système concerné (« Chantier beta ») ou dans une décision. Un playtest clos n’est plus modifié.

## Modèle

```markdown
# Playtest — <sujet> (<date>)

- **Version :** commit ou tag, seed
- **Fiche(s) visée(s) :** …
- **Objectif :** ce qu’on veut vérifier

## Protocole
Durée, profil de départ, consignes, ce qui est chronométré.

## Retours
| ID | Écran | Constat | Gravité | Suite (fiche / décision) |
| --- | --- | --- | --- | --- |

## Conclusion
Ce qui est validé, ce qui repart en chantier.
```
