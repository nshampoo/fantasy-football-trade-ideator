import type { LeagueFormat, PlayerValue, ValueProvider } from './types';

interface FantasyCalcEntry {
  player: { sleeperId: string | null; name: string; position: string };
  value: number;
  positionRank: number;
  trend30Day: number;
  maybeTier: number | null;
}

/** Snap to the PPR values FantasyCalc supports. */
const pprParam = (ppr: number) => (ppr >= 0.75 ? 1 : ppr >= 0.25 ? 0.5 : 0);

export function fantasyCalcUrl(format: LeagueFormat): string {
  const q = new URLSearchParams({
    isDynasty: 'false',
    numQbs: String(format.numQbs),
    numTeams: String(format.numTeams),
    ppr: String(pprParam(format.ppr)),
  });
  return `https://api.fantasycalc.com/values/current?${q}`;
}

export function parseFantasyCalc(entries: FantasyCalcEntry[]): Map<string, PlayerValue> {
  const values = new Map<string, PlayerValue>();
  for (const e of entries) {
    if (!e.player.sleeperId) continue;
    values.set(e.player.sleeperId, {
      sleeperId: e.player.sleeperId,
      value: e.value,
      tier: e.maybeTier ?? undefined,
      positionRank: e.positionRank,
      trend30Day: e.trend30Day,
    });
  }
  return values;
}

/** Redraft values from fantasycalc.com. */
export const fantasyCalc: ValueProvider = {
  name: 'FantasyCalc',
  async getValues(format) {
    const res = await fetch(fantasyCalcUrl(format));
    if (!res.ok) throw new Error(`FantasyCalc: HTTP ${res.status}`);
    return parseFantasyCalc(await res.json());
  },
};
