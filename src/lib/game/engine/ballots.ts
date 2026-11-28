/**
 * Scrutins réalistes (P3-29, GDD §7.4, décisions du créateur du 27 novembre 2026).
 *
 * Chaque échéance tenue sur le territoire du joueur produit un procès-verbal
 * (`BallotReport`) où toutes les candidatures comptent, avec ou sans le joueur :
 *
 * - Candidatures : les partis dont la part nationale atteint `minPartyPerMille`
 *   (au plus `maxPartyContestants`), l'adversaire nommé du joueur à la tête de
 *   la liste de son parti, et le joueur (tête de liste, candidat dissident ou
 *   sans étiquette) ; investi, il porte la liste de son parti. Colistier, il
 *   renforce la liste de son parti et y occupe le rang fixé à la déclaration.
 * - Forces : liste d'un parti = force de base × `partyStrengthPercent` ×
 *   (part / part du premier parti)² ; adversaire nommé = sa force (P2-06) ;
 *   joueur = score de campagne (P2-03) ; puis aléa borné, tiré dans l'ordre.
 * - Premier tour : parts en ‰ (plus forts restes). Liste : élue à la majorité
 *   absolue ; sinon second tour des listes d'au moins 10 % (deux premières à
 *   défaut), fusion possible dès 5 %. Uninominal : majorité absolue et 25 %
 *   des inscrits ; sinon second tour à 12,5 % des inscrits (deux premiers à
 *   défaut). Sénatoriales : proportionnelle en un tour dès 3 sièges, sinon
 *   majoritaire à deux tours, ouvert à tous les candidats du premier.
 * - Entre les tours : le joueur qualifié ou fusionnable décide (`runoff`) ; les
 *   autres suivent leurs affinités (écart de positions ≤ `allyDistance`) : un
 *   troisième se retire ou fusionne avec un allié mieux placé, une liste
 *   fusionnable rejoint l'allié qualifié le plus proche, les autres sont
 *   éliminées. Les voix des absents se reportent selon l'affinité.
 * - Sièges : prime majoritaire à la liste en tête, puis plus forte moyenne
 *   (prime comprise) entre les listes au-dessus du seuil ; le vainqueur d'un
 *   scrutin uninominal ou majoritaire prend tous les sièges.
 *
 * Fonctions pures : aucune lecture d'horloge, tirages sur le PRNG reçu.
 */
import {
	AXIS_IDS,
	type AxisId,
	type Content,
	type ElectionDefinition,
	type RunoffDecision
} from '../content/types.ts';
import { nextInt, type RngState } from './random.ts';
import type { TerritoryState } from './territory.ts';
import type {
	BallotContestant,
	BallotReport,
	BallotShare,
	Campaign,
	PlayerState,
	WorldState
} from './state.ts';

const MILLE = 1000;

export function contestantId(number: number): string {
	return `c.${number}`;
}

// ---------------------------------------------------------------------------
// Arithmétique électorale
// ---------------------------------------------------------------------------

/** Répartit 1000 ‰ entre des poids positifs (plus forts restes, ordre stable). */
export function perMille(weights: readonly number[]): number[] {
	const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
	if (total <= 0) return weights.map((_, index) => (index === 0 ? MILLE : 0));
	const raw = weights.map((weight, index) => {
		const exact = (Math.max(0, weight) * MILLE) / total;
		return { floor: Math.floor(exact), rest: exact - Math.floor(exact), index };
	});
	let missing = MILLE - raw.reduce((sum, entry) => sum + entry.floor, 0);
	const result = raw.map((entry) => entry.floor);
	for (const entry of [...raw].sort((a, b) => b.rest - a.rest || a.index - b.index)) {
		if (missing <= 0) break;
		result[entry.index]! += 1;
		missing -= 1;
	}
	return result;
}

/** Plus forte moyenne (d'Hondt) : sièges par liste, égalités au premier rang. */
export function highestAverage(votes: readonly number[], seats: number): number[] {
	const result = votes.map(() => 0);
	for (let seat = 0; seat < seats; seat += 1) {
		let best = -1;
		let bestAverage = -1;
		votes.forEach((vote, index) => {
			if (vote <= 0) return;
			const average = vote / (result[index]! + 1);
			if (average > bestAverage) {
				bestAverage = average;
				best = index;
			}
		});
		if (best < 0) break;
		result[best]! += 1;
	}
	return result;
}

/** Écart moyen de positions entre deux étiquettes (0 à 200) ; sans étiquette : centre. */
export function partyDistance(left: string | null, right: string | null, content: Content): number {
	const position = (partyId: string | null, axis: AxisId): number =>
		partyId === null ? 0 : (content.parties[partyId]?.positions[axis] ?? 0);
	const total = AXIS_IDS.reduce(
		(sum, axis) => sum + Math.abs(position(left, axis) - position(right, axis)),
		0
	);
	return Math.round(total / AXIS_IDS.length);
}

// ---------------------------------------------------------------------------
// Lieu et sièges
// ---------------------------------------------------------------------------

/** Mode effectif d'un scrutin sur ce territoire (les sénatoriales dépendent des sièges). */
export function effectiveSystem(
	definition: ElectionDefinition,
	territory: TerritoryState,
	content: Content
): BallotReport['system'] {
	if (definition.system !== 'senate') return definition.system;
	const senate = definition.senate;
	return senate && seatsFor(definition, territory, content) >= senate.proportionalMinSeats
		? 'senate_list'
		: 'senate_majority';
}

/** Sièges à pourvoir sur le territoire du joueur. */
export function seatsFor(
	definition: ElectionDefinition,
	territory: TerritoryState,
	content: Content
): number {
	const region = content.regions[territory.regionId];
	switch (definition.system) {
		case 'single':
			return 1;
		case 'senate':
			return (
				region?.departments.find((entry) => entry.code === territory.departmentCode)?.senators ??
				definition.senate?.defaultSeats ??
				1
			);
		case 'list':
			return definition.scope === 'regional'
				? (region?.councilSeats ?? 1)
				: (content.territory.sizes.find((size) => size.id === territory.homeTown.sizeId)
						?.councilSeats ?? 1);
		default: {
			const unknown: never = definition.system;
			throw new Error(`Mode de scrutin inconnu : ${String(unknown)}`);
		}
	}
}

/** Lieu affiché au procès-verbal. */
export function placeFor(
	definition: ElectionDefinition,
	territory: TerritoryState,
	content: Content
): string {
	const region = content.regions[territory.regionId];
	const department = region?.departments.find((entry) => entry.code === territory.departmentCode);
	if (definition.scope === 'regional') return region?.name ?? territory.regionId;
	if (definition.system === 'senate') return department?.name ?? territory.departmentCode;
	if (definition.system === 'single') {
		return `circonscription de ${territory.homeTown.name} (${department?.name ?? territory.departmentCode})`;
	}
	return territory.homeTown.name;
}

/** Une candidature peut-elle prendre la forme d'une place sur une liste ? */
export function listSystem(system: BallotReport['system']): boolean {
	return system === 'list' || system === 'senate_list';
}

/**
 * Rang d'un colistier sur la liste d'un parti, fixé à la déclaration : appui
 * de l'appareil, influence et popularité ; un candidat sans carte du parti de
 * la liste est moins bien placé. Toujours derrière la tête de liste.
 */
export function colistierRank(
	seats: number,
	player: Pick<PlayerState, 'supports' | 'popularity' | 'partyId'>,
	influence: number,
	listPartyId: string,
	content: Content
): number {
	const contests = content.balance.elections.contests;
	const apparatus = player.supports[content.balance.campaigns.apparatusGroup] ?? 0;
	const outsider = player.partyId !== listPartyId ? contests.outsiderRankPenalty : 0;
	const standing = Math.min(
		100,
		Math.max(
			0,
			Math.round(apparatus * 0.5 + Math.min(100, influence) * 0.3 + player.popularity * 0.2) -
				outsider
		)
	);
	const spread = Math.floor(
		((Math.max(0, seats - 2) * contests.rankSpreadPercent) / 100) * ((100 - standing) / 100)
	);
	return Math.max(2, Math.min(Math.max(2, seats), 2 + spread));
}

/** Liste d'accueil d'un colistier : celle de son parti, sinon celle du premier parti. */
export function colistierParty(
	player: Pick<PlayerState, 'partyId'>,
	world: WorldState,
	content: Content
): string {
	if (player.partyId !== null) return player.partyId;
	return (
		[...content.partyIds].sort(
			(left, right) =>
				(world.parties[right]?.strength ?? 0) - (world.parties[left]?.strength ?? 0) ||
				left.localeCompare(right)
		)[0] ?? ''
	);
}

// ---------------------------------------------------------------------------
// Candidatures et premier tour
// ---------------------------------------------------------------------------

/** Ce que le scrutin sait de la candidature du joueur, calculé par l'appelant. */
export interface PlayerEntry {
	readonly campaign: Campaign;
	/** Score de campagne (tête de liste, candidat) ou renfort de la liste (colistier). */
	readonly weight: number;
	/** Adversaire nommé et sa force, s'il est attribué. */
	readonly opponent: {
		readonly id: string;
		readonly partyId: string | null;
		readonly weight: number;
	} | null;
}

export interface ContestInput {
	readonly definition: ElectionDefinition;
	/** Parts nationales des partis au scrutin, en % (ou forces pour un sondage). */
	readonly shares: readonly BallotShare[];
	readonly territory: TerritoryState;
	readonly entry: PlayerEntry | null;
}

interface Draft {
	readonly partyId: string | null;
	readonly leaderId: string | null;
	readonly player: boolean;
	readonly dissident: boolean;
	readonly weight: number;
}

/** Candidatures et forces avant aléa, dans l'ordre du procès-verbal. */
export function contestDrafts(input: ContestInput, content: Content): Draft[] {
	const { definition, shares, entry } = input;
	const contests = content.balance.elections.contests;
	const sorted = [...shares].sort(
		(a, b) => b.percent - a.percent || a.partyId.localeCompare(b.partyId)
	);
	const top = Math.max(1, sorted[0]?.percent ?? 1);
	const base = (definition.rivalStrength * contests.partyStrengthPercent) / 100;
	const partyWeight = (percent: number): number => base * (percent / top) ** 2;
	const campaign = entry?.campaign ?? null;
	const head = campaign !== null && campaign.role === 'head';
	const opponent = entry?.opponent ?? null;

	const selected = sorted
		.filter((share) => share.percent * 10 >= contests.minPartyPerMille)
		.slice(0, contests.maxPartyContestants)
		.map((share) => share.partyId);
	const required = [
		...(opponent?.partyId ? [opponent.partyId] : []),
		...(campaign && !head && campaign.partyId ? [campaign.partyId] : [])
	];
	for (const partyId of required) if (!selected.includes(partyId)) selected.push(partyId);
	const ordered = sorted.map((share) => share.partyId).filter((id) => selected.includes(id));

	const drafts: Draft[] = [];
	if (campaign && head) {
		drafts.push({
			partyId: campaign.partyId,
			leaderId: null,
			player: true,
			dissident: campaign.partyId !== null && !campaign.invested,
			weight: entry!.weight
		});
	}
	for (const partyId of ordered) {
		// Le joueur investi porte la liste de son parti.
		if (head && campaign.invested && campaign.partyId === partyId) continue;
		const percent = shares.find((share) => share.partyId === partyId)?.percent ?? 0;
		const led = opponent !== null && opponent.partyId === partyId;
		const colistier = campaign !== null && !head && campaign.partyId === partyId;
		drafts.push({
			partyId,
			leaderId: led ? opponent.id : null,
			player: false,
			dissident: false,
			weight: (led ? opponent.weight : partyWeight(percent)) + (colistier ? entry!.weight : 0)
		});
	}
	if (opponent && opponent.partyId === null) {
		drafts.push({
			partyId: null,
			leaderId: opponent.id,
			player: false,
			dissident: false,
			weight: opponent.weight
		});
	}
	return drafts;
}

/** Contexte des tours : mode, sièges et seuils du territoire. */
export interface ContestRules {
	readonly system: BallotReport['system'];
	readonly seats: number;
	readonly maintainPerMille: number;
	readonly mergePerMille: number;
	readonly seatMinPerMille: number;
	readonly bonusSeatsPercent: number;
	readonly firstRoundRegisteredPerMille: number;
}

export function contestRules(
	definition: ElectionDefinition,
	territory: TerritoryState,
	content: Content
): ContestRules {
	const system = effectiveSystem(definition, territory, content);
	return {
		system,
		seats: seatsFor(definition, territory, content),
		maintainPerMille: definition.maintainPerMille,
		mergePerMille: system === 'list' ? definition.mergePerMille : 0,
		seatMinPerMille: definition.seatMinPerMille,
		bonusSeatsPercent: system === 'list' ? definition.bonusSeatsPercent : 0,
		firstRoundRegisteredPerMille: definition.firstRoundRegisteredPerMille
	};
}

/** Élu au premier tour ? (`null` : second tour nécessaire) */
function firstRoundWinner(
	contestants: readonly BallotContestant[],
	rules: ContestRules,
	turnout: number
): string | null {
	const leader = [...contestants].sort((a, b) => b.firstRound - a.firstRound)[0];
	if (!leader) return null;
	if (rules.system === 'senate_list') return leader.contestantId;
	if (contestants.length === 1) return leader.contestantId;
	if (leader.firstRound <= MILLE / 2) return null;
	if (
		rules.system === 'single' &&
		leader.firstRound * turnout < rules.firstRoundRegisteredPerMille * 100
	) {
		return null;
	}
	return leader.contestantId;
}

/** Candidatures qualifiées pour le second tour (deux premières à défaut). */
export function qualifiedIds(
	contestants: readonly BallotContestant[],
	rules: ContestRules,
	turnout: number
): Set<string> {
	const byFirst = [...contestants].sort((a, b) => b.firstRound - a.firstRound);
	if (rules.system === 'senate_majority') return new Set(byFirst.map((c) => c.contestantId));
	const reaches = (contestant: BallotContestant): boolean =>
		rules.system === 'single'
			? contestant.firstRound * turnout >= rules.maintainPerMille * 100
			: contestant.firstRound >= rules.maintainPerMille;
	const qualified = byFirst.filter(reaches);
	const kept = qualified.length >= 2 ? qualified : byFirst.slice(0, 2);
	return new Set(kept.map((contestant) => contestant.contestantId));
}

/** Le joueur peut-il fusionner sa liste ? (seuil de fusion, liste qualifiée à rejoindre) */
export function canMerge(report: BallotReport, rules: ContestRules): boolean {
	if (rules.mergePerMille <= 0) return false;
	const own = report.contestants.find((contestant) => contestant.player);
	if (!own || own.firstRound < rules.mergePerMille) return false;
	return report.contestants.some(
		(contestant) => !contestant.player && contestant.status === 'qualified'
	);
}

/**
 * Premier tour : forces tirées, parts, et soit le résultat final, soit un
 * second tour qui attend la décision du joueur (`runoff_pending`), soit un
 * second tour joué aussitôt (le joueur n'y a rien à décider).
 */
export function runFirstRound(
	input: ContestInput,
	rules: ContestRules,
	rng: RngState,
	content: Content
): { report: BallotReport; rng: RngState } {
	const volatility = content.balance.campaigns.volatility;
	let current = rng;
	const drafts = contestDrafts(input, content);
	const weights = drafts.map((draft) => {
		if (volatility <= 0) return Math.max(1, draft.weight);
		const noise = nextInt(current, -volatility, volatility);
		current = noise.rng;
		return Math.max(1, draft.weight + noise.value);
	});
	const turnoutDraw = nextInt(current, input.definition.turnout.min, input.definition.turnout.max);
	current = turnoutDraw.rng;
	const turnout = turnoutDraw.value;
	const shares = perMille(weights);
	const contestants: BallotContestant[] = drafts.map((draft, index) => ({
		contestantId: contestantId(index + 1),
		partyId: draft.partyId,
		leaderId: draft.leaderId,
		player: draft.player,
		dissident: draft.dissident,
		firstRound: shares[index]!,
		secondRound: null,
		seats: 0,
		status: 'eliminated',
		mergedInto: null
	}));
	const campaign = input.entry?.campaign ?? null;
	const playerContestant =
		campaign === null
			? null
			: campaign.role === 'head'
				? (contestants.find((contestant) => contestant.player) ?? null)
				: (contestants.find(
						(contestant) => !contestant.player && contestant.partyId === campaign.partyId
					) ?? null);
	const base: BallotReport = {
		place: placeFor(input.definition, input.territory, content),
		system: rules.system,
		seats: rules.seats,
		turnout,
		contestants,
		stage: 'final',
		secondRound: false,
		winnerId: null,
		playerContestantId: playerContestant?.contestantId ?? null,
		playerRank: campaign === null ? null : campaign.role === 'head' ? 1 : campaign.listRank,
		playerElected: null
	};
	const winner = firstRoundWinner(contestants, rules, turnout);
	if (winner !== null) {
		return { report: finalize(base, rules, winner, 'first', content), rng: current };
	}
	const qualified = qualifiedIds(contestants, rules, turnout);
	const pending: BallotReport = {
		...base,
		secondRound: true,
		stage: 'runoff_pending',
		contestants: contestants.map((contestant) => ({
			...contestant,
			status: qualified.has(contestant.contestantId) ? 'qualified' : 'eliminated'
		}))
	};
	const own = pending.contestants.find((contestant) => contestant.player);
	const decides = own !== undefined && (own.status === 'qualified' || canMerge(pending, rules));
	if (decides) return { report: pending, rng: current };
	return runSecondRound(pending, rules, null, current, content);
}

// ---------------------------------------------------------------------------
// Second tour
// ---------------------------------------------------------------------------

/**
 * Second tour : décision du joueur (s'il en a une), puis retraits et fusions
 * des autres selon leurs affinités, reports des voix, aléa borné et sièges.
 */
export function runSecondRound(
	pending: BallotReport,
	rules: ContestRules,
	decision: RunoffDecision | null,
	rng: RngState,
	content: Content
): { report: BallotReport; rng: RngState } {
	const contests = content.balance.elections.contests;
	const list = rules.mergePerMille > 0;
	const status = new Map<string, BallotContestant['status']>();
	const mergedInto = new Map<string, string>();
	const byId = new Map(
		pending.contestants.map((contestant) => [contestant.contestantId, contestant])
	);
	for (const contestant of pending.contestants) {
		status.set(
			contestant.contestantId,
			contestant.status === 'qualified' ? 'qualified' : 'eliminated'
		);
	}
	const distance = (a: BallotContestant, b: BallotContestant): number =>
		partyDistance(a.partyId, b.partyId, content);
	const cordoned = (contestant: BallotContestant): boolean =>
		contestant.partyId !== null && content.parties[contestant.partyId]?.cordon === true;
	const standing = (): BallotContestant[] =>
		pending.contestants.filter((contestant) => status.get(contestant.contestantId) === 'qualified');
	let playerContestantId = pending.playerContestantId;
	let playerRank = pending.playerRank;

	// 1. Décision du joueur, tête de liste ou candidat.
	const own = pending.contestants.find((contestant) => contestant.player) ?? null;
	if (own && decision !== null) {
		if (decision === 'withdraw') {
			status.set(own.contestantId, 'withdrawn');
		} else if (decision === 'merge') {
			const partner = pending.contestants
				.filter(
					(contestant) => !contestant.player && status.get(contestant.contestantId) === 'qualified'
				)
				.sort((a, b) => distance(own, a) - distance(own, b) || b.firstRound - a.firstRound)[0];
			if (partner) {
				status.set(own.contestantId, 'qualified');
				if (own.firstRound >= partner.firstRound) {
					status.set(partner.contestantId, 'merged');
					mergedInto.set(partner.contestantId, own.contestantId);
				} else {
					status.set(own.contestantId, 'merged');
					mergedInto.set(own.contestantId, partner.contestantId);
					playerContestantId = partner.contestantId;
					playerRank = Math.min(
						Math.max(2, rules.seats),
						2 + Math.floor(partner.firstRound / Math.max(1, own.firstRound))
					);
				}
			}
		}
	}

	// 2. Les autres suivent leurs affinités : un troisième se retire (ou fusionne)
	// au profit d'un allié mieux placé ; une liste fusionnable rejoint un allié.
	const ranked = [...pending.contestants].sort((a, b) => b.firstRound - a.firstRound);
	for (const contestant of ranked) {
		if (contestant.player) continue;
		const current = status.get(contestant.contestantId);
		// Alliances entre listes de partis seulement, hors cordon et hors dissidents.
		const allies = cordoned(contestant)
			? []
			: standing().filter(
					(other) =>
						other.contestantId !== contestant.contestantId &&
						other.partyId !== null &&
						!other.dissident &&
						!cordoned(other) &&
						distance(contestant, other) <= contests.allyDistance
				);
		if (current === 'qualified') {
			const ahead = allies
				.filter((other) => other.firstRound > contestant.firstRound)
				.sort((a, b) => b.firstRound - a.firstRound)[0];
			const top2 = standing()
				.sort((a, b) => b.firstRound - a.firstRound)
				.slice(0, 2)
				.map((entry) => entry.contestantId);
			if (!ahead || top2.includes(contestant.contestantId) || standing().length <= 2) continue;
			if (list) {
				status.set(contestant.contestantId, 'merged');
				mergedInto.set(contestant.contestantId, ahead.contestantId);
			} else {
				status.set(contestant.contestantId, 'withdrawn');
			}
		} else if (list && current === 'eliminated' && contestant.firstRound >= rules.mergePerMille) {
			const ally = allies.sort((a, b) => distance(contestant, a) - distance(contestant, b))[0];
			if (ally) {
				status.set(contestant.contestantId, 'merged');
				mergedInto.set(contestant.contestantId, ally.contestantId);
			}
		}
	}

	// 3. Voix du second tour : base, fusions, reports par affinité, aléa.
	const present = standing();
	let current = rng;
	const votes = new Map<string, number>(present.map((c) => [c.contestantId, c.firstRound]));
	for (const [from, to] of mergedInto) {
		const source = byId.get(from)!;
		const target = votes.has(to) ? to : null;
		if (target === null) continue;
		votes.set(
			target,
			votes.get(target)! + (source.firstRound * contests.mergeRetentionPercent) / 100
		);
	}
	for (const contestant of pending.contestants) {
		const fate = status.get(contestant.contestantId);
		if (fate !== 'eliminated' && fate !== 'withdrawn') continue;
		const affinities = present.map((other) => {
			const gap = 200 - Math.min(200, distance(contestant, other));
			return gap * gap + 1;
		});
		const total = affinities.reduce((sum, value) => sum + value, 0);
		present.forEach((other, index) => {
			votes.set(
				other.contestantId,
				votes.get(other.contestantId)! +
					(((contestant.firstRound * contests.transferPercent) / 100) * affinities[index]!) / total
			);
		});
	}
	const swung = present.map((contestant) => {
		let value = votes.get(contestant.contestantId)!;
		if (contests.runoffSwing > 0) {
			const draw = nextInt(current, -contests.runoffSwing * 10, contests.runoffSwing * 10);
			current = draw.rng;
			value += draw.value;
		}
		return Math.max(1, value);
	});
	const second = perMille(swung);
	const secondOf = new Map(
		present.map((contestant, index) => [contestant.contestantId, second[index]!])
	);
	const winner = [...present].sort(
		(a, b) =>
			secondOf.get(b.contestantId)! - secondOf.get(a.contestantId)! || b.firstRound - a.firstRound
	)[0];
	const contestants = pending.contestants.map((contestant) => ({
		...contestant,
		status: status.get(contestant.contestantId)!,
		secondRound: secondOf.get(contestant.contestantId) ?? null,
		mergedInto: mergedInto.get(contestant.contestantId) ?? null
	}));
	const report: BallotReport = {
		...pending,
		contestants,
		playerContestantId,
		playerRank
	};
	return {
		report: finalize(report, rules, winner?.contestantId ?? null, 'second', content),
		rng: current
	};
}

/** Sièges, statuts définitifs et élection du joueur. */
function finalize(
	report: BallotReport,
	rules: ContestRules,
	winnerId: string | null,
	round: 'first' | 'second',
	content: Content
): BallotReport {
	void content;
	const share = (contestant: BallotContestant): number =>
		round === 'first' ? contestant.firstRound : (contestant.secondRound ?? 0);
	const decisive = report.contestants.filter((contestant) =>
		round === 'first' ? true : contestant.secondRound !== null
	);
	const seats = new Map<string, number>();
	if (winnerId !== null) {
		if (rules.system === 'single' || rules.system === 'senate_majority') {
			seats.set(winnerId, rules.seats);
		} else {
			const bonus = Math.ceil((rules.seats * rules.bonusSeatsPercent) / 100);
			const eligible = decisive.filter(
				(contestant) =>
					share(contestant) >= rules.seatMinPerMille || contestant.contestantId === winnerId
			);
			const distributed = highestAverage(eligible.map(share), rules.seats - bonus);
			eligible.forEach((contestant, index) => {
				seats.set(contestant.contestantId, distributed[index]!);
			});
			seats.set(winnerId, (seats.get(winnerId) ?? 0) + bonus);
		}
	}
	const contestants = report.contestants.map((contestant) => {
		const id = contestant.contestantId;
		let status = contestant.status;
		if (id === winnerId) status = 'won';
		else if (round === 'first') status = 'lost';
		else if (status === 'qualified') status = 'lost';
		return { ...contestant, seats: seats.get(id) ?? 0, status };
	});
	const mine = contestants.find(
		(contestant) => contestant.contestantId === report.playerContestantId
	);
	const own = contestants.find((contestant) => contestant.player);
	const elected =
		report.playerRank === null
			? null
			: own?.status === 'withdrawn'
				? false
				: (mine?.seats ?? 0) >= report.playerRank;
	return {
		...report,
		contestants,
		stage: 'final',
		secondRound: round === 'second',
		winnerId,
		playerElected: elected
	};
}

/** Part du joueur (ou de sa liste) au tour décisif, en % arrondi. */
export function playerFinalPercent(report: BallotReport): number | null {
	const mine = report.contestants.find(
		(contestant) => contestant.contestantId === report.playerContestantId
	);
	if (!mine) return null;
	const own = report.contestants.find((contestant) => contestant.player);
	const value =
		own?.status === 'withdrawn' ? own.firstRound : (mine.secondRound ?? mine.firstRound);
	return Math.round(value / 10);
}

/** Part du joueur (ou de sa liste) au premier tour, en % arrondi. */
export function playerFirstRoundPercent(report: BallotReport): number | null {
	const own =
		report.contestants.find((contestant) => contestant.player) ??
		report.contestants.find((contestant) => contestant.contestantId === report.playerContestantId);
	return own ? Math.round(own.firstRound / 10) : null;
}

/** Siège obtenu : majorité (liste victorieuse) ou opposition ; `null` hors liste. */
export function playerSide(report: BallotReport): 'majority' | 'opposition' | null {
	if (!listSystem(report.system) || report.playerElected !== true) return null;
	return report.playerContestantId === report.winnerId ? 'majority' : 'opposition';
}

/** Le joueur conduit-il la liste victorieuse ? (élection du maire par le conseil) */
export function playerHeadsWinner(report: BallotReport): boolean {
	return (
		report.playerElected === true &&
		report.playerRank === 1 &&
		report.playerContestantId === report.winnerId
	);
}
