// The subset of Sleeper's API responses this app reads. https://docs.sleeper.com

export interface NflState {
  season: string;
  week: number;
  season_type: string;
}

export interface SleeperUser {
  user_id: string;
  username?: string;
  display_name: string;
  avatar: string | null;
  metadata?: { team_name?: string } | null;
}

export interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  status: string;
  total_rosters: number;
  roster_positions: string[];
  scoring_settings: Record<string, number>;
  /** settings.type: 0 redraft, 1 keeper, 2 dynasty */
  settings: { type: number; [key: string]: number };
  avatar: string | null;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string | null;
  players: string[] | null;
  starters: string[] | null;
  reserve: string[] | null;
  settings: { wins: number; losses: number; ties: number; fpts?: number; fpts_decimal?: number };
}

/** One entry of public/data/players.json, trimmed from Sleeper's /players/nfl. */
export interface PlayerInfo {
  /** name */
  n: string;
  /** position */
  p: string;
  /** NFL team, or null for free agents */
  t: string | null;
  /** injury status, e.g. "Questionable", "IR" */
  i?: string;
}

export type PlayerDb = Record<string, PlayerInfo>;
