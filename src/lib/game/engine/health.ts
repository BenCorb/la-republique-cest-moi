/**
 * Santé, stress, vieillissement et décès (ARCHITECTURE.md §5.1 étape 4, §8.2).
 *
 * Appliqué une fois par trimestre, à la frontière T/T+1, avec l'âge atteint en T,
 * dans un ordre fixe dont chaque contribution est journalisée :
 *   1. stress : + charge de travail (temps utilisé au-delà du seuil),
 *      puis − récupération naturelle ;
 *   2. santé : − perte si le stress est élevé, sinon + récupération si le stress
 *      est bas, sans dépasser le plafond de la tranche d'âge ;
 *   3. vieillissement : tirage, perte de santé selon la tranche d'âge ;
 *   4. décès : santé nulle, sinon tirage du risque de la tranche d'âge (multiplié
 *      si la santé est fragile).
 * Les étapes 1–2 sont déterministes et servent aussi à la prévision. Les
 * probabilités ne sont jamais exposées au joueur. Modèle de jeu, sans prétention
 * médicale ; tous les paramètres sont des hypothèses de `balance.json`.
 */
import type { AgeBand, WellbeingBalance } from '../content/types.ts';
import { ageAt, type Turn } from './calendar.ts';
import { applyGauge } from './effects.ts';
import { nextFloat, type RngState } from './random.ts';
import type {
	DeathCause,
	PlayerState,
	WellbeingContribution,
	WellbeingRecord,
	WellbeingSource
} from './state.ts';
import type { GaugeId } from '../content/types.ts';

export function ageBandFor(age: number, wellbeing: WellbeingBalance): AgeBand {
	let current = wellbeing.ageBands[0];
	for (const band of wellbeing.ageBands) {
		if (band.fromAge <= age) current = band;
	}
	if (!current) throw new Error('Aucune tranche d’âge définie.');
	return current;
}

export function workloadStress(timeUsed: number, wellbeing: WellbeingBalance): number {
	const excess = Math.max(0, timeUsed - wellbeing.workloadThreshold);
	return Math.floor(excess / 10) * wellbeing.workloadStressPer10Points;
}

interface Gauges {
	health: number;
	stress: number;
}

class ContributionLog {
	readonly entries: WellbeingContribution[] = [];

	apply(
		gauges: Gauges,
		gauge: Extract<GaugeId, 'player.health' | 'player.stress'>,
		source: WellbeingSource,
		delta: number
	): void {
		const key = gauge === 'player.health' ? 'health' : 'stress';
		const { value, applied } = applyGauge(gauges[key], delta);
		gauges[key] = value;
		if (applied !== 0) this.entries.push({ source, gauge, delta: applied });
	}
}

/** Étapes déterministes 1–2, communes à la prévision et à la résolution. */
function settleGauges(
	player: PlayerState,
	timeUsed: number,
	band: AgeBand,
	wellbeing: WellbeingBalance,
	log: ContributionLog,
	comfort: number
): Gauges {
	const gauges: Gauges = { health: player.health, stress: player.stress };
	log.apply(gauges, 'player.stress', 'workload', workloadStress(timeUsed, wellbeing));
	// Confort (P3-02) : train de vie et biens qui apaisent, ou dépense impayée.
	log.apply(gauges, 'player.stress', 'comfort', comfort);
	log.apply(gauges, 'player.stress', 'recovery', -wellbeing.stressRecoveryPerTurn);
	if (gauges.stress >= wellbeing.highStressThreshold) {
		log.apply(gauges, 'player.health', 'high_stress', -wellbeing.highStressHealthLoss);
	} else if (gauges.stress < wellbeing.calmStressThreshold && gauges.health < band.maxHealth) {
		const gain = Math.min(wellbeing.calmHealthGain, band.maxHealth - gauges.health);
		log.apply(gauges, 'player.health', 'calm', gain);
	}
	return gauges;
}

export interface WellbeingForecast {
	/** Stress certain à la fin du trimestre. */
	readonly stress: number;
	/** Santé de fin de trimestre : fourchette, le vieillissement étant incertain. */
	readonly health: { readonly min: number; readonly max: number };
	/** Contributions certaines (charge, récupération, stress élevé, calme). */
	readonly contributions: readonly WellbeingContribution[];
}

/** Prévision pure, sans tirage ni probabilité exposée. */
export function forecastWellbeing(
	player: PlayerState,
	timeUsed: number,
	turn: Turn,
	wellbeing: WellbeingBalance,
	comfort = 0
): WellbeingForecast {
	const band = ageBandFor(ageAt(player.birthTurn, turn), wellbeing);
	const log = new ContributionLog();
	const gauges = settleGauges(player, timeUsed, band, wellbeing, log, comfort);
	const possibleLoss = band.ageingChance > 0 ? band.ageingHealthLoss : 0;
	return {
		stress: gauges.stress,
		health: { min: applyGauge(gauges.health, -possibleLoss).value, max: gauges.health },
		contributions: log.entries
	};
}

export interface WellbeingResolution {
	readonly player: PlayerState;
	readonly rng: RngState;
	readonly record: WellbeingRecord;
}

export function resolveWellbeing(
	player: PlayerState,
	timeUsed: number,
	turn: Turn,
	rng: RngState,
	wellbeing: WellbeingBalance,
	comfort = 0
): WellbeingResolution {
	const band = ageBandFor(ageAt(player.birthTurn, turn), wellbeing);
	const log = new ContributionLog();
	const gauges = settleGauges(player, timeUsed, band, wellbeing, log, comfort);
	let currentRng = rng;

	// 3. Vieillissement.
	if (band.ageingChance > 0 && band.ageingHealthLoss > 0) {
		const draw = nextFloat(currentRng);
		currentRng = draw.rng;
		if (draw.value < band.ageingChance) {
			log.apply(gauges, 'player.health', 'ageing', -band.ageingHealthLoss);
		}
	}

	// 4. Décès.
	let deathCause: DeathCause | null = null;
	if (gauges.health <= 0) {
		deathCause = 'health_failure';
	} else {
		const multiplier =
			gauges.health < wellbeing.fragileHealthThreshold ? wellbeing.fragileMortalityMultiplier : 1;
		const chance = Math.min(1, band.mortalityChance * multiplier);
		if (chance > 0) {
			const draw = nextFloat(currentRng);
			currentRng = draw.rng;
			if (draw.value < chance) deathCause = 'natural_causes';
		}
	}

	return {
		player: { ...player, health: gauges.health, stress: gauges.stress },
		rng: currentRng,
		record: { contributions: log.entries, deathCause }
	};
}
