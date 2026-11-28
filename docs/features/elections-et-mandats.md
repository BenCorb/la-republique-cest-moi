# Élections, campagnes et mandats

> Fiche de fonctionnalité — état au tag `v1.0.0`. **Statut beta : à auditer.** Modèle et mode d’emploi : [README](README.md).

## Rôle dans le jeu

Le calendrier électoral, les candidatures libres, l’investiture, la campagne, les scrutins à deux tours ou de liste et l’exercice des mandats avec le cumul.

## Références

- GDD : §7.1 à §7.4
- DESIGN : §4.6 (carrière)
- Historique ([archive V1](../archive/v1/), à ne lire que pour le pourquoi d’une règle) :
  - ARCHITECTURE §8.3 quater (calendrier et mandats)
  - ARCHITECTURE §8.3 sexies (candidatures, campagne, scrutin)
  - ARCHITECTURE §8.3 undecies (mairie et cumul)
  - ARCHITECTURE §8.4 novovicies (scrutins réalistes, procès-verbal)
  - ARCHITECTURE §8.4 trigesies (investiture nationale)
  - ARCHITECTURE §8.4 untrigesies (contre-proposition d’un candidat)

## Code

- Moteur (`src/lib/game/engine/`) : `career.ts`, `ballots.ts`
- Contenu (`src/lib/game/content/data/`) : `career.json`
- Projection (`src/lib/game/app/`, module `view/career.ts`) : `CareerView`, `BallotView`, `CampaignView`, `MandateView`, `BallotReportView`, `ballotReportView`
- Interface (`src/lib/components/`) : `career/CareerPanel.svelte`, `career/BallotReport.svelte`
- Tests (`tests/`) : `unit/career.test.ts`, `unit/campaigns.test.ts`, `unit/ballots.test.ts`, `unit/investiture.test.ts`, `scenarios/alpha.test.ts`

## État V1

- Plusieurs candidatures et deux tours ; entre-deux-tours (maintien, fusion, désistement) ; scrutins de liste et sénatoriales par grands électeurs.
- Procès-verbal commun à tous les scrutins.

## Règles en vigueur

_À condenser lors de l’audit : les règles et chiffres actuels, tirés du code et des sections d’archive ci-dessus, de façon à ne plus avoir besoin de l’archive._

## Décisions provisoires à confirmer

_À relever lors de l’audit (les « décisions déléguées, provisoires » des sections d’archive)._

## Limites connues

- Pas de présidentielle jouable, ni de départementales, ni d’outre-mer (après la V1).

## Chantier beta

- [ ] Audit : règles en vigueur condensées ci-dessus, décisions provisoires listées, partie jouée sur ce système
- [ ] Problèmes UX/UI relevés (captures, retours de playtest)
- [ ] Plan de consolidation validé par le créateur
- [ ] Mise en œuvre, tests et fiche à jour
