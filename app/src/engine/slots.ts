import type { Position, Slot } from './types';

/** Sleeper roster_positions -> positions each accepts. K, DEF, IDP, and bench are left out. */
const SLOT_ACCEPTS: Record<string, Position[]> = {
  QB: ['QB'],
  RB: ['RB'],
  WR: ['WR'],
  TE: ['TE'],
  WRRB_FLEX: ['RB', 'WR'],
  REC_FLEX: ['WR', 'TE'],
  FLEX: ['RB', 'WR', 'TE'],
  SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
};

/** Starting slots, most restrictive first, which is the order the greedy lineup fills them. */
export function parseSlots(rosterPositions: string[]): Slot[] {
  return rosterPositions
    .filter((name) => name in SLOT_ACCEPTS)
    .map((name) => ({ name, accepts: SLOT_ACCEPTS[name] }))
    .sort((a, b) => a.accepts.length - b.accepts.length);
}
