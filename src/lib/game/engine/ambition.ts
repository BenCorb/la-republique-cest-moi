/**
 * Ambition de départ (P3-38, recommandation B6 de l'audit) : facultative,
 * choisie à la création, sans aucun bonus. Constatée après chaque commande
 * (objectif atteint, trahison), rappelée au dossier et jugée au bilan.
 */
import type { Content } from '../content/types.ts';
import { evaluateCondition } from './conditions.ts';
import type { GameState } from './state.ts';

export type AmbitionVerdict = 'achieved' | 'missed' | 'betrayed' | 'pending';

/**
 * Constate l'ambition après une commande : trahison définitive, objectif
 * atteint (sauf s'il ne se juge qu'en fin de carrière). Sans changement,
 * l'état est rendu tel quel.
 */
export function updateAmbition(state: GameState, content: Content): GameState {
	const ambition = state.player.ambition;
	if (!ambition || ambition.betrayedTurn !== null) return state;
	const definition = content.ambitions[ambition.ambitionId];
	if (!definition) return state;
	let next = ambition;
	if (definition.betrayal && evaluateCondition(state, definition.betrayal)) {
		next = { ...next, betrayedTurn: state.turn };
	} else if (
		next.achievedTurn === null &&
		!definition.judgeAtEnd &&
		evaluateCondition(state, definition.goal)
	) {
		next = { ...next, achievedTurn: state.turn };
	}
	return next === ambition ? state : { ...state, player: { ...state.player, ambition: next } };
}

/** Jugement de l'ambition : en cours de carrière, puis atteinte, manquée ou trahie. */
export function ambitionVerdict(state: GameState, content: Content): AmbitionVerdict | null {
	const ambition = state.player.ambition;
	if (!ambition) return null;
	if (ambition.betrayedTurn !== null) return 'betrayed';
	if (ambition.achievedTurn !== null) return 'achieved';
	const definition = content.ambitions[ambition.ambitionId];
	if (state.end === null) return 'pending';
	return definition?.judgeAtEnd && evaluateCondition(state, definition.goal)
		? 'achieved'
		: 'missed';
}
