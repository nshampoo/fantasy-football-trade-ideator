import { strength } from './lineup';
import { NEED_THRESHOLD, profileLeague, type TeamProfile } from './profile';
import type { League, Player, Position, Team } from './types';

/**
 * Package value: (Σ vᵢ^α)^(1/α). With α > 1 one star beats two halves, the way trade calculators
 * add a consolidation premium: two 4000s ≈ 6800, short of one 8000.
 */
export const PACKAGE_EXPONENT = 1.3;
export const packageValue = (players: Player[]) =>
  Math.pow(players.reduce((s, p) => s + Math.pow(p.value, PACKAGE_EXPONENT), 0), 1 / PACKAGE_EXPONENT);

export interface Preset {
  label: string;
  /** Weight on the other team's lineup gain in the ranking. */
  lambda: number;
  /** Least package value they must get back, as a share of what they give. */
  minFairness: number;
  /** Most lineup strength they can lose, as a share of their strength. */
  maxTheirLoss: number;
}

export const PRESETS = {
  fair: { label: 'Fair', lambda: 1, minFairness: 0.95, maxTheirLoss: 0 },
  balanced: { label: 'Balanced', lambda: 0.5, minFairness: 0.9, maxTheirLoss: 0.01 },
  aggressive: { label: 'Aggressive', lambda: 0.1, minFairness: 0.8, maxTheirLoss: 0.03 },
} satisfies Record<string, Preset>;
export type PresetName = keyof typeof PRESETS;

/** Never suggest paying more than this share over what comes back, by package value. */
export const MAX_OVERPAY = 1.15;

export interface TradeEval {
  me: Team;
  them: Team;
  give: Player[];
  get: Player[];
  myBefore: number;
  myAfter: number;
  theirBefore: number;
  theirAfter: number;
  myGain: number;
  theirGain: number;
  /** Package value they get ÷ package value they give: above 1 means I overpay. */
  fairness: number;
  /** Players each side drops to stay at roster size. */
  myDrops: Player[];
  theirDrops: Player[];
  score: number;
  reasons: string[];
}

/** Roster after a trade, cutting its least valuable non-incoming players to keep the roster size. */
export function rosterAfter(players: Player[], out: Player[], incoming: Player[]) {
  const outIds = new Set(out.map((p) => p.id));
  const kept = players.filter((p) => !outIds.has(p.id));
  const extra = incoming.length - out.length;
  const drops = extra > 0 ? [...kept].sort((a, b) => a.value - b.value).slice(0, extra) : [];
  const dropIds = new Set(drops.map((p) => p.id));
  return { roster: [...kept.filter((p) => !dropIds.has(p.id)), ...incoming], drops };
}

export function evaluateTrade(league: League, me: Team, them: Team, give: Player[], get: Player[], preset: Preset = PRESETS.balanced): TradeEval {
  const myBefore = strength(me.players, league.slots);
  const theirBefore = strength(them.players, league.slots);
  const mine = rosterAfter(me.players, give, get);
  const theirs = rosterAfter(them.players, get, give);
  const myAfter = strength(mine.roster, league.slots);
  const theirAfter = strength(theirs.roster, league.slots);
  const myGain = myAfter - myBefore;
  const theirGain = theirAfter - theirBefore;
  return {
    me, them, give, get,
    myBefore, myAfter, theirBefore, theirAfter, myGain, theirGain,
    fairness: packageValue(give) / Math.max(packageValue(get), 1),
    myDrops: mine.drops,
    theirDrops: theirs.drops,
    score: myGain + preset.lambda * theirGain,
    reasons: [],
  };
}

const acceptable = (e: TradeEval, preset: Preset) =>
  e.myGain > 0 &&
  e.fairness >= preset.minFairness &&
  e.fairness <= MAX_OVERPAY &&
  e.theirGain >= -preset.maxTheirLoss * e.theirBefore;

function combos<T>(items: T[], max: number): T[][] {
  const out: T[][] = items.map((x) => [x]);
  if (max >= 2) for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) out.push([items[i], items[j]]);
  return out;
}

export interface SuggestOptions {
  preset?: PresetName;
  /** Most players either side sends. */
  maxPerSide?: 1 | 2;
  /** Allow 2-for-2 packages (slower). */
  allowTwoForTwo?: boolean;
  /** Players to keep out of every idea. */
  untouchable?: string[];
  /** Only ideas that bring back one of these players. */
  targets?: string[];
  /** Only ideas that send one of these players. */
  shopping?: string[];
  perPartner?: number;
  limit?: number;
  /** Players considered per side, by value. */
  candidates?: number;
}

export interface Suggestions {
  profiles: TeamProfile[];
  ideas: TradeEval[];
}

export function suggestTrades(league: League, myRosterId: number, opts: SuggestOptions = {}): Suggestions {
  const preset = PRESETS[opts.preset ?? 'balanced'];
  const { maxPerSide = 2, allowTwoForTwo = false, perPartner = 3, limit = 30, candidates = 10 } = opts;
  const untouchable = new Set(opts.untouchable);
  const targets = opts.targets?.length ? new Set(opts.targets) : null;
  const shopping = opts.shopping?.length ? new Set(opts.shopping) : null;

  const profiles = profileLeague(league);
  const me = league.teams.find((t) => t.rosterId === myRosterId);
  if (!me) throw new Error(`No roster ${myRosterId} in league`);
  const myStrength = strength(me.players, league.slots);

  const myChips = me.players
    .filter((p) => p.value > 0 && !untouchable.has(p.id))
    .sort((a, b) => b.value - a.value)
    .slice(0, candidates);

  const ideas: TradeEval[] = [];
  for (const them of league.teams) {
    if (them.rosterId === myRosterId) continue;
    // Only players who would improve my lineup are worth asking for.
    const wanted = them.players
      .filter((p) => p.value > 0 && !untouchable.has(p.id))
      .filter((p) => strength([...me.players, p], league.slots) > myStrength)
      .sort((a, b) => b.value - a.value)
      .slice(0, candidates);

    const found: TradeEval[] = [];
    for (const get of combos(wanted, maxPerSide)) {
      if (targets && !get.some((p) => targets.has(p.id))) continue;
      const getValue = packageValue(get);
      for (const give of combos(myChips, maxPerSide)) {
        if (give.length === 2 && get.length === 2 && !allowTwoForTwo) continue;
        if (shopping && !give.some((p) => shopping.has(p.id))) continue;
        // Cheap value check before the lineup math.
        const fairness = packageValue(give) / getValue;
        if (fairness < preset.minFairness || fairness > MAX_OVERPAY) continue;
        const e = evaluateTrade(league, me, them, give, get, preset);
        if (acceptable(e, preset)) found.push(e);
      }
    }
    found.sort((a, b) => b.score - a.score);
    ideas.push(...distinct(found).slice(0, perPartner));
  }

  ideas.sort((a, b) => b.score - a.score);
  const top = ideas.slice(0, limit);
  for (const e of top) e.reasons = explain(e, profiles);
  return { profiles, ideas: top };
}

/** Drop ideas that ask for the same players as a better one with this partner. */
function distinct(sorted: TradeEval[]): TradeEval[] {
  const seen = new Set<string>();
  return sorted.filter((e) => {
    const key = e.get.map((p) => p.id).sort().join(',');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const positions = (players: Player[]) => [...new Set(players.map((p) => p.pos as Position))];

export function explain(e: TradeEval, profiles: TeamProfile[]): string[] {
  const mine = profiles.find((p) => p.team.rosterId === e.me.rosterId)!;
  const theirs = profiles.find((p) => p.team.rosterId === e.them.rosterId)!;
  const reasons: string[] = [];
  for (const pos of positions(e.get)) {
    const g = mine.grades[pos];
    if (g && g.vsMedian < NEED_THRESHOLD) reasons.push(`Your ${pos} starters are at ${pct(g.vsMedian)} of the league median.`);
  }
  const surplusIds = new Set(mine.surplus.map((s) => s.player.id));
  const benchGive = e.give.filter((p) => surplusIds.has(p.id));
  if (benchGive.length) reasons.push(`${benchGive.map((p) => p.name).join(' and ')} ${benchGive.length > 1 ? 'are' : 'is'} worth more in a trade than in your lineup.`);
  for (const pos of positions(e.give)) {
    const g = theirs.grades[pos];
    if (g && g.vsMedian < NEED_THRESHOLD) reasons.push(`${e.them.name} is thin at ${pos} (${pct(g.vsMedian)} of median).`);
  }
  if (e.get.length < e.give.length) reasons.push('Consolidates depth into a better starter.');
  if (e.get.length > e.give.length) reasons.push('Turns one player into more starting depth.');
  return reasons;
}
