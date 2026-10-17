export interface LeagueFormat {
  numTeams: number;
  /** points per reception: 0, 0.5, or 1 */
  ppr: number;
  /** 2 for superflex */
  numQbs: 1 | 2;
}

export interface PlayerValue {
  sleeperId: string;
  value: number;
  tier?: number;
  positionRank?: number;
  trend30Day?: number;
  /** IDs for linking out to player pages. */
  fantasyCalcId?: number;
  espnId?: string;
}

/** A source of rest-of-season trade values, keyed by Sleeper player ID. */
export interface ValueProvider {
  name: string;
  getValues(format: LeagueFormat): Promise<Map<string, PlayerValue>>;
}
