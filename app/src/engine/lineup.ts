import { POSITIONS, type Player, type Position, type Slot } from './types';

/** Weight on the best bench player at each position: bye-week and injury cover. */
export const BENCH_WEIGHT = 0.15;

export interface Lineup {
  starters: { slot: Slot; player: Player | null }[];
  bench: Player[];
  /** Σ starter value + BENCH_WEIGHT × best bench player at each position */
  strength: number;
}

const isPosition = (pos: string): pos is Position => (POSITIONS as string[]).includes(pos);

/**
 * Best lineup by value. Slots arrive most restrictive first (see parseSlots), and each takes the
 * most valuable eligible player left, which is optimal for Sleeper's nested flex slots.
 */
export function bestLineup(players: Player[], slots: Slot[]): Lineup {
  const pool = players.filter((p) => isPosition(p.pos)).sort((a, b) => b.value - a.value);
  const used = new Set<string>();
  const starters = slots.map((slot) => {
    const player = pool.find((p) => !used.has(p.id) && slot.accepts.includes(p.pos as Position)) ?? null;
    if (player) used.add(player.id);
    return { slot, player };
  });
  const bench = players.filter((p) => !used.has(p.id));

  let strength = 0;
  for (const s of starters) strength += s.player?.value ?? 0;
  for (const pos of POSITIONS) {
    const best = pool.find((p) => p.pos === pos && !used.has(p.id));
    if (best) strength += BENCH_WEIGHT * best.value;
  }
  return { starters, bench, strength };
}

export const strength = (players: Player[], slots: Slot[]) => bestLineup(players, slots).strength;
