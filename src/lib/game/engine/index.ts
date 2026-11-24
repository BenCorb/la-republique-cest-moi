/**
 * API publique du moteur de simulation.
 *
 * Le moteur est du TypeScript pur : il ne dépend ni de Svelte, ni du DOM, ni du
 * stockage navigateur, ni du réseau, ni de l'horloge réelle, ni de `Math.random()`
 * (voir ARCHITECTURE.md §2 et §6). Ces frontières sont vérifiées par
 * `tests/unit/engine-boundaries.test.ts`.
 *
 * Phase 0 : seul l'identifiant de version des règles existe. L'état, le calendrier,
 * le PRNG et les commandes arrivent avec P1-01.
 */

/** Version des règles du moteur, enregistrée plus tard dans les sauvegardes. */
export const RULES_VERSION = '0.0.0';
