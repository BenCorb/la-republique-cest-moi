/**
 * Utilitaires partagés par les projections : pastilles de coûts et d’effets, libellés communs, descriptions d’effets, noms des élections et mandats, rôles des personnes.
 *
 * Partie de la projection publique (`PlayerView`, ARCHITECTURE.md §9) : fonctions pures,
 * sans PRNG ni information cachée. Point d’entrée : `../view-model.ts`.
 */
import type {
	ActionFormat,
	Content,
	GaugeId,
	PartyPosture,
	PromiseDefinition,
	PromiseMode,
	PromiseStatus,
	ResourceAmount,
	ResourceId,
	RunoffDecision,
	SearchLevel
} from '../../content/types.ts';
import { PROMISE_PLACE_VARIABLE, REGIONAL_ANCHOR, RESOURCE_IDS } from '../../content/types.ts';
import type {
	Article,
	Ballot,
	BallotReport,
	CampaignStatus,
	CareerParts,
	EffectRange,
	EventRecord,
	GameState,
	InvestitureRequest,
	MandateEndReason,
	PartyRank,
	PeopleChange,
	PoliticalChange,
	PromiseChange,
	ResourceChange,
	StaffLeaveReason,
	WellbeingSource
} from '../../engine/index.ts';
import {
	ageAt,
	displayName,
	formatTurn,
	livingChildren,
	placeOf,
	regionalMedia,
	renderTemplate
} from '../../engine/index.ts';
import {
	GAUGE_NAMES,
	INDICATOR_NAMES,
	RESOURCE_NAMES,
	describeCompetence,
	formatCompactRange,
	formatDelta,
	formatGaugeDelta,
	formatMoney,
	formatRange,
	formatResource
} from '../format.ts';
import type { StaffPersonView } from './entourage.ts';
import type { PersonView } from './people.ts';

export interface ResourceView {
	readonly id: ResourceId;
	readonly name: string;
	readonly value: string;
	/** Variation prévue sur le trimestre (plan, charges et production). */
	readonly forecast: string;
	/** Sens de la variation prévue (flèche de la tuile) : hausse, stable, baisse. */
	readonly trend: -1 | 0 | 1;
}

/** Sens d'une pastille pour le joueur (P3-26) : gain, coût, risque ou neutre. */
export type ChipSense = 'gain' | 'cost' | 'risk' | 'neutral';

/**
 * Pastille de coût ou d'effet (P3-26, DESIGN.md §10.4) : identité visuelle,
 * valeur compacte et sens, plus la phrase complète pour l'accessibilité et le
 * détail. Construite à partir des seuls effets certains déjà affichés.
 */
export interface ChipView {
	/** Clé de la table d'identité (ressource, jauge, groupe) ; `null` : pastille de texte. */
	readonly identity: string | null;
	/** « +1–3 », « −20 € » ; la phrase complète si `identity` est `null`. */
	readonly value: string;
	readonly sense: ChipSense;
	/** Fourchette : la valeur finale dépend du tirage. */
	readonly variable: boolean;
	/** Phrase complète (« Budget politique − 20 € »). */
	readonly text: string;
}

export interface Alert {
	readonly level: 'danger' | 'warning' | 'info';
	readonly text: string;
}

export const FAMILY_LABELS: Readonly<Record<string, string>> = {
	organization: 'Organisation',
	communication: 'Communication',
	network: 'Réseau',
	personal: 'Vie personnelle'
};

export const SOURCE_LABELS: { readonly [K in WellbeingSource]: string } = {
	workload: 'charge de travail',
	comfort: 'confort',
	recovery: 'récupération',
	high_stress: 'stress élevé',
	calm: 'calme retrouvé',
	ageing: 'âge'
};

export const CAUSE_LABELS = {
	health_failure: 'Épuisement : la santé a fini par céder.',
	natural_causes: 'Mort naturelle.',
	prison: 'Condamnation définitive à de la prison ferme.',
	retirement: 'Retraite choisie : vous quittez la vie politique.'
} as const;

export function amounts(list: readonly ResourceAmount[], sign: 1 | -1): string[] {
	return list.map(
		(amount) =>
			`${RESOURCE_NAMES[amount.resource]} ${formatDelta(amount.resource, sign * amount.amount)}`
	);
}

export function senseOf(direction: number): ChipSense {
	return direction > 0 ? 'gain' : direction < 0 ? 'cost' : 'neutral';
}

/** Coûts ou productions en pastilles (P3-26), dans l'ordre d'`amounts`. */
export function amountChips(list: readonly ResourceAmount[], sign: 1 | -1): ChipView[] {
	return list.map((amount) => {
		const delta = sign * amount.amount;
		return {
			identity: amount.resource,
			value: formatCompactRange(amount.resource, delta, delta),
			sense: senseOf(delta),
			variable: false,
			text: `${RESOURCE_NAMES[amount.resource]} ${formatDelta(amount.resource, delta)}`
		};
	});
}

/** Pastille de texte (effet qualitatif : adhésion, mandat, promesse…). */
export function textChip(text: string, sense: ChipSense = 'neutral'): ChipView {
	return { identity: null, value: text, sense, variable: false, text };
}

/**
 * Effet en pastille (P3-26) : même source que `describeEffect`, donc rien de plus
 * que les effets certains déjà annoncés. Une hausse du stress est un coût ;
 * l'exposition reste neutre (ni bonne ni mauvaise en soi, §8.4 bis).
 */
export function effectChip(range: EffectRange, content: Content): ChipView {
	const text = describeEffect(range, content);
	switch (range.kind) {
		case 'resource':
			return {
				identity: range.resource,
				value: formatCompactRange(range.resource, range.min, range.max),
				sense: senseOf(range.min + range.max),
				variable: range.min !== range.max,
				text
			};
		case 'gauge': {
			const direction = Math.sign(range.min);
			const sense =
				range.gauge === 'player.exposure'
					? 'neutral'
					: senseOf(range.gauge === 'player.stress' ? -direction : direction);
			return {
				identity: range.gauge,
				value: formatCompactRange(null, range.min, range.min),
				sense,
				variable: false,
				text
			};
		}
		case 'support':
			return {
				identity: range.group,
				value: formatCompactRange(null, range.value, range.value),
				sense: senseOf(range.value),
				variable: false,
				text
			};
		case 'preparation':
			return {
				identity: 'preparation',
				value: formatCompactRange(null, range.value, range.value),
				sense: 'gain',
				variable: false,
				text
			};
		case 'fact':
			return { identity: 'justice.risk', value: 'Risque', sense: 'risk', variable: false, text };
		case 'media':
			return textChip(text, range.change === 'interview' ? 'neutral' : senseOf(range.value));
		default:
			return textChip(text);
	}
}

const PARTY_REFERENCE_LABELS: Readonly<Record<string, string>> = {
	governing: 'parti au gouvernement',
	player: 'votre parti',
	opposition: 'premier parti d’opposition',
	target: 'parti choisi'
};

/** Carrière partisane (P3-34). */
export const PARTY_POSTURE_LABELS: Readonly<Record<PartyPosture, string>> = {
	unity: 'Rassemblement',
	apparatus: 'Appareil',
	rupture: 'Rupture'
};
export const PARTY_RANK_LABELS: Readonly<Record<PartyRank, string>> = {
	member: 'Militant',
	cadre: 'Cadre du parti',
	leader: 'Chef du parti'
};
const PARTY_RANK_REASONS: Readonly<
	Record<Extract<PoliticalChange, { kind: 'partyRank' }>['reason'], string>
> = {
	promotion: 'promotion : vous devenez cadre du parti',
	congress_won: 'congrès gagné : vous prenez la tête du parti',
	congress_lost: 'congrès perdu : la direction vous échappe',
	ousted: 'congrès perdu : vous êtes renversé de la direction',
	confirmed: 'congrès : votre direction est reconduite'
};

/** Étapes d'une investiture, au journal (P3-30). */
export const INVESTITURE_STATUS_TEXT: Readonly<Record<InvestitureRequest['status'], string>> = {
	pending: 'investiture demandée au parti',
	granted: 'investiture accordée : candidature déposée sous l’étiquette du parti',
	refused: 'investiture refusée par le parti',
	dissident: 'candidature dissidente, sans étiquette ni moyens du parti',
	renounced: 'renoncement à la candidature, discipline saluée par l’appareil'
};

/** Issue d'une candidature après le second tour (P3-29). */
const RUNOFF_OUTCOMES: Readonly<Record<Exclude<CampaignStatus, 'running'>, string>> = {
	won: 'élu',
	lost: 'battu',
	withdrawn: 'retrait',
	disqualified: 'candidature invalidée'
};

/** Décisions d'entre-deux-tours (P3-29). */
const RUNOFF_LABELS: Readonly<Record<RunoffDecision, string>> = {
	maintain: 'Maintien au second tour',
	merge: 'Fusion des listes',
	withdraw: 'Retrait au profit d’un autre'
};

export function partyLabel(party: string | null, content: Content): string {
	if (party === null) return 'votre parti';
	return content.parties[party]?.name ?? PARTY_REFERENCE_LABELS[party] ?? party;
}

export function describeEffect(range: EffectRange, content: Content): string {
	switch (range.kind) {
		case 'resource':
			return `${RESOURCE_NAMES[range.resource]} ${formatRange(range.resource, range.min, range.max)}`;
		case 'gauge':
			return `${GAUGE_NAMES[range.gauge]} ${formatGaugeDelta(range.min)}`;
		case 'indicator':
			return `${INDICATOR_NAMES[range.indicator]} ${formatGaugeDelta(range.value)}`;
		case 'support':
			return `Soutien : ${content.supportGroups[range.group]?.label ?? range.group} ${formatGaugeDelta(range.value)}`;
		case 'partyStrength':
			return `Intentions de vote (${partyLabel(range.party, content)}) ${formatGaugeDelta(range.value)}`;
		case 'affiliation':
			return range.change === 'join'
				? `Adhésion : ${partyLabel(range.party, content)}`
				: 'Départ de votre parti';
		case 'people':
			return 'Relation avec un personnage';
		case 'mandate':
			return range.change === 'grant'
				? `Mandat : ${content.mandates[range.mandate]?.label ?? range.mandate}`
				: range.mandate === 'target'
					? 'Fin du mandat choisi'
					: `Fin du mandat : ${content.mandates[range.mandate]?.label ?? range.mandate}`;
		case 'earlyElection':
			return `Élection anticipée : ${content.elections[range.election]?.label ?? range.election}`;
		case 'candidacy':
			return 'Candidature déposée';
		case 'runoff':
			return RUNOFF_LABELS[range.decision];
		case 'appointment':
			return range.decision === 'accept' ? 'Entrée au gouvernement' : 'Proposition déclinée';
		case 'retire':
			return 'Fin de carrière : retraite de la vie politique';
		case 'partyBid':
			return `Candidature à la direction : ${PARTY_POSTURE_LABELS[range.posture]}`;
		case 'rally':
			return `Ralliements au congrès + ${range.value}`;
		case 'investiture':
			return range.decision === 'request'
				? 'Demande d’investiture'
				: range.decision === 'dissident'
					? 'Candidature dissidente'
					: 'Renoncement à la candidature';
		case 'fact':
			return `Fait inscrit au registre : ${content.offenses[range.offense]?.label ?? range.offense}`;
		case 'lifestyle':
			return content.lifestyles[range.lifestyle]?.label ?? range.lifestyle;
		case 'family':
			return range.change === 'attitude'
				? `Famille ${range.value > 0 ? 'apaisée' : 'agacée'}`
				: 'Vie de famille';
		case 'staff':
			return STAFF_CHANGE_LABELS[range.change];
		case 'release':
			return 'Départ de l’organisation';
		case 'preparation':
			return `Préparation de campagne + ${range.value}`;
		case 'advance':
			return `Avance de ${formatMoney(range.valueCents)}, remboursée à partir de ${content.balance.campaigns.advanceRepayMinPercent} % des voix`;
		case 'promise':
			return range.change === 'make'
				? 'Engagement inscrit au registre des promesses'
				: range.change === 'advance'
					? `Avancement de la promesse + ${range.value}`
					: range.change === 'amend'
						? 'Promesse amendée'
						: 'Promesse abandonnée';
		case 'reform':
			return 'Réforme soumise au vote à la fin du trimestre';
		case 'media':
			return range.change === 'interview'
				? 'Interview publiée à la fin du trimestre'
				: `Relation (${range.media === 'target' ? 'média choisi' : (content.media[range.media]?.name ?? range.media)}) ${formatGaugeDelta(range.value)}`;
	}
}

/** Étapes d'une promesse, en clair (journal). */
const PROMISE_CHANGE_LABELS: { readonly [K in PromiseChange]: string } = {
	made: 'engagement pris',
	started: 'élu, place à la réalisation',
	limited: 'élu sans le levier annoncé : au mieux partiellement tenue',
	lapsed: 'élection perdue, promesse sans lendemain',
	amended: 'compromis : au mieux partiellement tenue',
	kept: 'promesse tenue',
	partial: 'promesse partiellement tenue',
	abandoned: 'promesse abandonnée',
	recalled: 'promesse rappelée en campagne'
};

/** Formats d'une action à l'échelle, en clair (P3-23). */
export const ACTION_FORMAT_LABELS: { readonly [K in ActionFormat]: string } = {
	modest: 'Modeste',
	sustained: 'Soutenu',
	major: 'Majeur'
};

/** Avance personnelle d'une campagne et son sort (P3-23), en clair. */
export function advanceLabel(
	campaign: GameState['campaigns'][number],
	content: Content
): string | null {
	if (campaign.advanceCents === 0) return null;
	const amount = formatMoney(campaign.advanceCents);
	const threshold = content.balance.campaigns.advanceRepayMinPercent;
	if (campaign.status === 'running') {
		return `Avance personnelle : ${amount}, rendue à partir de ${threshold} % des voix`;
	}
	const repaid = campaign.status !== 'disqualified' && (campaign.playerPercent ?? 0) >= threshold;
	return `Avance personnelle : ${amount}, ${repaid ? 'rendue après le scrutin' : 'perdue'}`;
}

/** Façons de tenir une promesse, en clair (P3-22). */
const PROMISE_MODE_LABELS: { readonly [K in PromiseMode]: string } = {
	decide: 'décider et réaliser',
	carry: 'porter et voter'
};

/** États d'une promesse, en clair (registre). */
export const PROMISE_STATUS_LABELS: { readonly [K in PromiseStatus]: string } = {
	announced: 'Annoncée',
	in_progress: 'En cours',
	kept: 'Tenue',
	partial: 'Partiellement tenue',
	abandoned: 'Abandonnée'
};

export function politicsText(changes: readonly PoliticalChange[], content: Content): string {
	return changes
		.map((change) => {
			switch (change.kind) {
				case 'indicator':
					return `${INDICATOR_NAMES[change.indicator]} ${formatGaugeDelta(change.delta)}`;
				case 'partyStrength':
					return `${content.parties[change.partyId]?.acronym ?? change.partyId} ${formatGaugeDelta(change.delta)}`;
				case 'joined':
					return `adhésion au ${content.parties[change.partyId]?.name ?? change.partyId}`;
				case 'left':
					return `départ du ${content.parties[change.partyId]?.name ?? change.partyId}`;
				case 'support':
					return `${content.supportGroups[change.groupId]?.label ?? change.groupId} ${formatGaugeDelta(change.delta)}`;
				case 'mandateStarted':
					return `entrée en fonction : ${content.mandates[change.mandateId]?.label ?? change.mandateId}`;
				case 'mandateEnded':
					return `fin de mandat (${MANDATE_END_LABELS[change.reason]}) : ${content.mandates[change.mandateId]?.label ?? change.mandateId}`;
				case 'candidacy':
					return change.invested
						? 'candidature déposée avec l’investiture du parti'
						: 'candidature déposée sans investiture';
				case 'investiture':
					return INVESTITURE_STATUS_TEXT[change.status];
				case 'appointment':
					return `${change.status === 'offered' ? 'proposition d’entrée au gouvernement' : change.status === 'accepted' ? 'entrée au gouvernement' : 'proposition du gouvernement déclinée'} : ${change.portfolio ? (content.portfolios[change.portfolio]?.title ?? change.portfolio) : (content.mandates[change.mandateId]?.label ?? change.mandateId).toLocaleLowerCase('fr')}`;
				case 'partyRank':
					return `${PARTY_RANK_REASONS[change.reason]} (${content.parties[change.partyId]?.acronym ?? change.partyId})`;
				case 'partyBid':
					return `candidature à la direction, ligne du ${PARTY_POSTURE_LABELS[change.posture].toLocaleLowerCase('fr')} (${change.rallies} ralliement(s))`;
				case 'runoff':
					return `second tour : ${RUNOFF_OUTCOMES[change.status]}${change.playerPercent === null ? '' : ` (${change.playerPercent} %)`}`;
				case 'preparation':
					return `préparation de campagne + ${change.delta}`;
				case 'campaignAdvance':
					return `avance personnelle de ${formatMoney(change.cents)} à la campagne`;
				case 'familyJoined':
					return change.relation === 'partner'
						? 'une nouvelle vie à deux'
						: 'une naissance dans la famille';
				case 'separated':
					return 'une séparation';
				case 'hired':
					return `embauche au poste « ${content.posts[change.postId]?.label ?? change.postId} »`;
				case 'hireRefused':
					return change.counterCents === null
						? `le candidat décline le poste « ${content.posts[change.postId]?.label ?? change.postId} » et quitte la présélection`
						: `le candidat décline le poste « ${content.posts[change.postId]?.label ?? change.postId} », mais accepterait ${formatResource('politicalBudgetCents', change.counterCents)} par trimestre`;
				case 'interviewed':
					return `entretien approfondi pour le poste « ${content.posts[change.postId]?.label ?? change.postId} »`;
				case 'searchOrdered':
					return `${SEARCH_LABELS[change.level].toLowerCase()} pour le poste « ${content.posts[change.postId]?.label ?? change.postId} », résultat au ${formatTurn(change.dueTurn)}`;
				case 'vetted':
					return `dossier vérifié pour le poste « ${content.posts[change.postId]?.label ?? change.postId} »`;
				case 'raiseGranted':
					return `salaire porté à ${formatResource('politicalBudgetCents', change.salaryCents)} par trimestre`;
				case 'staffLeft':
					return `départ du poste « ${content.posts[change.postId]?.label ?? change.postId} » (${STAFF_LEAVE_LABELS[change.reason]})`;
				case 'earlyElection':
					return `${content.elections[change.electionId]?.label ?? change.electionId} anticipées au ${formatTurn(change.turn)}`;
				case 'fact':
					return `fait inscrit au registre : ${content.offenses[change.offenseId]?.label ?? change.offenseId}`;
				case 'promise':
					return `« ${content.promises[change.promiseId]?.label ?? change.promiseId} » : ${PROMISE_CHANGE_LABELS[change.change]}`;
				case 'promiseProgress':
					return `« ${content.promises[change.promiseId]?.label ?? change.promiseId} » : avancement + ${change.delta}`;
				case 'mediaRelation':
					return `relation avec ${content.media[change.mediaId]?.name ?? change.mediaId} ${change.delta > 0 ? 'améliorée' : 'dégradée'}`;
				case 'interview':
					return `interview accordée à ${content.media[change.mediaId]?.name ?? change.mediaId}`;
				case 'reform': {
					const parameter =
						content.institutionParameters[change.parameterId]?.label ?? change.parameterId;
					const level = levelOf(change.levelId, content)?.label ?? change.levelId;
					const who = change.origin === 'government' ? 'le gouvernement' : 'vous';
					return change.change === 'proposed'
						? `réforme proposée — ${parameter} : « ${level} »`
						: change.change === 'adopted'
							? `réforme adoptée (${who}) — ${parameter} : « ${level} »`
							: change.change === 'rejected'
								? `réforme rejetée — ${parameter} : « ${level} »`
								: `entrée en vigueur — ${parameter} : « ${level} »`;
				}
			}
		})
		.join(', ');
}

export const STAFF_LEAVE_LABELS: { readonly [K in StaffLeaveReason]: string } = {
	resigned: 'démission',
	dismissed: 'renvoi',
	poached: 'débauchage',
	retired: 'retraite',
	died: 'décès'
};

export const MANDATE_END_LABELS: { readonly [K in MandateEndReason]: string } = {
	term: 'fin du terme',
	resigned: 'démission',
	government_change: 'changement de gouvernement',
	replaced: 'remplacé par une fonction incompatible',
	removed: 'retrait'
};

/** Résultat d'un scrutin en une ligne : trois premières parts. */
export const REPORT_SYSTEMS: Readonly<Record<BallotReport['system'], string>> = {
	list: 'scrutin de liste à deux tours, prime majoritaire',
	single: 'scrutin uninominal à deux tours',
	senate_list: 'grands électeurs, scrutin de liste à la proportionnelle',
	senate_majority: 'grands électeurs, scrutin majoritaire à deux tours'
};

export function formatPerMille(value: number): string {
	return `${(value / 10).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

export function sharesText(ballot: Ballot, content: Content): string {
	return (ballot.shares ?? [])
		.slice(0, 3)
		.map(
			(share) => `${content.parties[share.partyId]?.acronym ?? share.partyId} ${share.percent} %`
		)
		.join(' · ');
}

export function peopleText(
	changes: readonly PeopleChange[],
	state: GameState,
	content: Content
): string {
	return changes
		.flatMap((change) => {
			const character = state.characters[change.characterId];
			if (!character) return [];
			if (change.kind === 'revealed') {
				const trait = content.traits[change.traitId]?.label ?? change.traitId;
				return [`vous découvrez chez ${displayName(character)} : ${trait}`];
			}
			return [];
		})
		.join(', ');
}

/** Pluriel simple d'un effectif (« 1 militant », « 12 militants »). */
export function activistsWord(count: number): string {
	return `${count} militant${count > 1 ? 's' : ''}`;
}

export function joinParts(...parts: string[]): string {
	return parts.filter((part) => part.length > 0).join(' ; ');
}

/** Disponibilité d'une étape supplémentaire, évaluée par la prévision du moteur. */
const STAFF_CHANGE_LABELS: Readonly<
	Record<Extract<EffectRange, { kind: 'staff' }>['change'], string>
> = {
	hire: 'Embauche',
	replace: 'Embauche à la place du titulaire, renvoyé',
	shortlist: 'Candidature ajoutée à la présélection',
	dismiss: 'Renvoi',
	leave: 'Départ d’un collaborateur',
	interview: 'Entretien approfondi : le candidat se laisse convaincre',
	search: 'Recherche de candidats, résultat à l’échéance',
	vet: 'Dossier vérifié : des indices, pas des certitudes',
	raise: 'Salaire porté au niveau de sa compétence'
};

/** Liste française : « a, b et c ». */
export function joinFrench(items: readonly string[]): string {
	if (items.length <= 1) return items[0] ?? '';
	return `${items.slice(0, -1).join(', ')} et ${items.at(-1)!}`;
}

/**
 * Nom localisé d'un scrutin (P3-16) : la commune pour les municipales, la
 * région pour les régionales, le département (la circonscription) sinon.
 */
export function electionName(electionId: string, state: GameState, content: Content): string {
	const election = content.elections[electionId];
	if (!election) return electionId;
	return `${election.label} (${placeOf(election.scope, state.player.territory, content)})`;
}

/** Nom localisé d'un mandat (P3-16) : selon le scrutin qui y mène ; sans lieu pour un ministère. */
export function mandateName(
	mandateId: string,
	state: GameState,
	content: Content,
	portfolio: string | null = null
): string {
	const mandate = content.mandates[mandateId];
	if (!mandate) return mandateId;
	// Ministre (P3-35) : le portefeuille nomme la fonction.
	const ministry = portfolio ? content.portfolios[portfolio] : undefined;
	if (ministry)
		return `Ministre — ${ministry.title.charAt(0).toUpperCase()}${ministry.title.slice(1)}`;
	const election = mandate.election ? content.elections[mandate.election] : undefined;
	return election
		? `${mandate.label} (${placeOf(election.scope, state.player.territory, content)})`
		: mandate.label;
}

export function eventTitle(
	eventId: string,
	actors: Readonly<Record<string, string>>,
	state: GameState,
	content: Content
): string {
	const definition = content.events[eventId];
	return definition ? renderTemplate(definition.title, actors, content, state.characters) : eventId;
}

/** Niveaux de recherche de candidats (P3-21). */
export const SEARCH_LABELS: Readonly<Record<SearchLevel, string>> = {
	simple: 'Recherche simple',
	targeted: 'Recherche ciblée',
	headhunt: 'Chasse de tête'
};

/** Chance d'aboutir d'une recherche, en mots (valeur d'équilibrage, pas un tirage). */
export function findChanceLabel(percent: number): string {
	if (percent >= 85) return 'Aboutit presque toujours';
	if (percent >= 65) return 'Aboutit le plus souvent';
	if (percent >= 45) return 'Issue incertaine';
	return 'Rarement concluante';
}

// -- Résultats et note de cabinet (P3-14) -----------------------------------

/** Empreinte stable d'un texte (choix déterministe d'une variante, sans hasard de jeu). */
export function textHash(text: string): number {
	let hash = 0x811c9dc5;
	for (let index = 0; index < text.length; index += 1) {
		hash ^= text.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash;
}

function resourceChips(changes: readonly ResourceChange[]): ChipView[] {
	return changes.map((change) => ({
		identity: change.resource,
		value: formatCompactRange(change.resource, change.delta, change.delta),
		sense: senseOf(change.delta),
		variable: false,
		text: `${RESOURCE_NAMES[change.resource]} ${formatDelta(change.resource, change.delta)}`
	}));
}

function gaugeChip(gauge: GaugeId, delta: number): ChipView {
	return {
		identity: gauge,
		value: formatCompactRange(null, delta, delta),
		sense:
			gauge === 'player.exposure' ? 'neutral' : senseOf(gauge === 'player.stress' ? -delta : delta),
		variable: false,
		text: `${GAUGE_NAMES[gauge]} ${formatGaugeDelta(delta)}`
	};
}

/**
 * Pastilles des effets réellement appliqués par une décision ou un événement
 * (P3-14, PT-B1-003) : ressources, jauges, soutiens, préparation et faits, puis
 * phrases pour les autres conséquences. Lit uniquement l'entrée propre à la
 * source : rien d'un autre poste du trimestre, rien de caché ni de différé.
 */
export function effectChips(
	entry: Pick<EventRecord, 'changes' | 'gauges' | 'politics' | 'people'>,
	state: GameState,
	content: Content
): { chips: ChipView[]; details: string[] } {
	const chips: ChipView[] = [
		...resourceChips(entry.changes),
		...entry.gauges.map((change) => gaugeChip(change.gauge, change.delta))
	];
	const details: string[] = [];
	for (const change of entry.politics) {
		if (change.kind === 'support')
			chips.push({
				identity: change.groupId,
				value: formatCompactRange(null, change.delta, change.delta),
				sense: senseOf(change.delta),
				variable: false,
				text: `${content.supportGroups[change.groupId]?.label ?? change.groupId} ${formatGaugeDelta(change.delta)}`
			});
		else if (change.kind === 'preparation')
			chips.push({
				identity: 'preparation',
				value: formatCompactRange(null, change.delta, change.delta),
				sense: senseOf(change.delta),
				variable: false,
				text: `Préparation de campagne ${formatGaugeDelta(change.delta)}`
			});
		else if (change.kind === 'fact')
			chips.push({
				identity: 'justice.risk',
				value: 'Risque',
				sense: 'risk',
				variable: false,
				text: politicsText([change], content)
			});
		else details.push(lowerFirstUpper(politicsText([change], content)));
	}
	const people = peopleText(entry.people, state, content);
	if (people) details.push(lowerFirstUpper(people));
	return { chips, details };
}

export function lowerFirstUpper(text: string): string {
	return text.charAt(0).toLocaleUpperCase('fr-FR') + text.slice(1);
}

function lowerFirst(text: string): string {
	return text.charAt(0).toLocaleLowerCase('fr-FR') + text.slice(1);
}

/** Sujet d'un article, tel qu'il est cité dans le titre (`{subject}`). */
function articleSubject(article: Article, state: GameState, content: Content): string {
	const id = article.subjectId;
	if (id === null) return '';
	switch (article.topic) {
		case 'justice': {
			const legalCase = state.cases.find((entry) => entry.caseId === id);
			const fact = state.facts.find((entry) => entry.factId === legalCase?.factId);
			const label = fact ? content.offenses[fact.offenseId]?.label : undefined;
			return label ? lowerFirst(label) : 'justice';
		}
		case 'promise': {
			const pledge = state.promises.find((entry) => entry.pledgeId === id);
			return pledge ? (content.promises[pledge.promiseId]?.label ?? pledge.promiseId) : id;
		}
		case 'election': {
			const campaign = state.campaigns.find((entry) => entry.campaignId === id);
			return campaign ? electionName(campaign.electionId, state, content) : id;
		}
		default:
			return content.media[id]?.name ?? id;
	}
}

/** « de » suivi d'un mot, avec élision devant une voyelle (« d’emploi fictif »). */
export function ofWord(word: string): string {
	return /^[aeiouyàâäéèêëîïôöûü]/i.test(word) ? `d’${word}` : `de ${word}`;
}

/** Titre d'un article : gabarit du catalogue, variables résolues. */
export function articleTitle(article: Article, state: GameState, content: Content): string {
	const headline = content.headlines.find((entry) => entry.id === article.headlineId);
	if (!headline) return article.headlineId;
	const subject = articleSubject(article, state, content);
	const media = content.media[article.mediaId]?.name ?? article.mediaId;
	return headline.text
		.replaceAll('de {subject}', ofWord(subject))
		.replaceAll('{subject}', subject)
		.replaceAll('{media}', media);
}

/**
 * Libellé d'une amélioration ou d'un actif ; le rachat du quotidien régional
 * (rôle `regional_anchor`, P3-18) prend le nom du titre de la région du joueur.
 */
export function upgradeLabel(
	upgradeId: string,
	state: GameState,
	content: Content,
	owned: boolean
): string {
	const definition = content.upgrades[upgradeId];
	if (!definition) return upgradeId;
	if (definition.asset?.media === REGIONAL_ANCHOR) {
		const name = regionalMedia(state.player.territory.regionId, content)?.name;
		if (name) return owned ? name : `Racheter ${name}`;
	}
	return owned ? (definition.ownedLabel ?? definition.label) : definition.label;
}

/** Relation d'un média, en clair (aucun chiffre affiché). */
export function mediaRelationLabel(relation: number): string {
	if (relation >= 50) return 'Très bienveillant';
	if (relation >= 20) return 'Bienveillant';
	if (relation > -20) return 'Neutre';
	if (relation > -50) return 'Réservé';
	return 'Hostile';
}

/** Somme des montants par ressource, dans l'ordre des ressources. */
export function sumAmounts(lists: readonly (readonly ResourceAmount[])[]): ResourceAmount[] {
	return RESOURCE_IDS.flatMap((resource) => {
		const amount = lists
			.flat()
			.filter((item) => item.resource === resource)
			.reduce((sum, item) => sum + item.amount, 0);
		return amount === 0 ? [] : [{ resource, amount }];
	});
}

export function careerPartsOf(state: GameState): CareerParts {
	return {
		mandates: state.mandates,
		ballots: state.ballots,
		campaigns: state.campaigns,
		institutions: state.institutions,
		promises: state.promises,
		investitures: state.investitures,
		appointment: state.appointment
	};
}

export function levelOf(levelId: string, content: Content) {
	const parameterId = content.institutionLevels[levelId]?.parameterId;
	return parameterId
		? content.institutionParameters[parameterId]?.levels.find((level) => level.id === levelId)
		: undefined;
}

/** Lien familial d'un personnage généré (étiquette `kin`), sans accord de genre. */
const KIN_LABELS: Readonly<Record<string, string>> = {
	partner: 'Famille — vie commune',
	former_partner: 'Famille — ancienne relation',
	child: 'Famille — enfant',
	parent: 'Famille — parent',
	sibling: 'Famille — fratrie'
};

export function roleOf(tags: readonly string[]): string {
	if (tags.includes('kin')) {
		const relation = tags.find((tag) => Object.hasOwn(KIN_LABELS, tag));
		return relation ? KIN_LABELS[relation]! : 'Famille';
	}
	if (tags.includes('staff')) return 'Entourage';
	return ROLE_LABELS[tags[0] ?? ''] ?? 'Connaissance';
}

const ROLE_LABELS: Readonly<Record<string, string>> = {
	medical: 'Santé',
	journalist: 'Presse',
	family: 'Famille',
	friend: 'Amitiés',
	business: 'Affaires',
	donor: 'Affaires',
	politician: 'Vie politique locale',
	rival: 'Vie politique locale',
	party_official: 'Parti',
	party_leader: 'Direction de parti',
	volunteer: 'Militants'
};

export function describeAttitude(attitude: number): Pick<PersonView, 'attitude' | 'attitudeTone'> {
	if (attitude >= 40) return { attitude: 'Très favorable', attitudeTone: 'good' };
	if (attitude >= 10) return { attitude: 'Favorable', attitudeTone: 'good' };
	if (attitude > -10) return { attitude: 'Neutre', attitudeTone: 'neutral' };
	if (attitude > -40) return { attitude: 'Réservée', attitudeTone: 'warning' };
	return { attitude: 'Hostile', attitudeTone: 'danger' };
}

/** Description d'une promesse, `{place}` remplacé par le lieu de son scrutin (P3-22). */
export function promiseDescription(
	definition: PromiseDefinition,
	state: GameState,
	content: Content
): string {
	const scope = content.elections[definition.election]?.scope ?? 'local';
	const place = placeOf(scope, state.player.territory, content);
	return definition.description.replaceAll(`{${PROMISE_PLACE_VARIABLE}}`, place);
}

/** Pouvoir qui permet de tenir la promesse : « Levier : Mairie (Montvérel) — décider ». */
export function leverLabel(
	definition: PromiseDefinition,
	state: GameState,
	content: Content
): string {
	const seats = definition.lever.map((mandateId) => mandateName(mandateId, state, content));
	return `Levier : ${seats.join(' ou ')} — ${PROMISE_MODE_LABELS[definition.mode]}`;
}

export function personOf(state: GameState, characterId: string, content: Content): StaffPersonView {
	const character = state.characters[characterId]!;
	return {
		characterId,
		name: displayName(character),
		age: ageAt(character.birthTurn, state.turn),
		competence: describeCompetence(character.competence),
		knownTraits: character.knownTraits.map((trait) => content.traits[trait]?.label ?? trait),
		unknownTraits: character.traits.length - character.knownTraits.length
	};
}

export function describeFamily(state: GameState): string {
	const partner = state.player.family.partnerId ? 'en couple' : 'célibataire';
	const children = livingChildren(state.player, state.characters).length;
	return children === 0 ? partner : `${partner}, ${children} enfant${children > 1 ? 's' : ''}`;
}
