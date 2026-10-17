import type { NflState, SleeperLeague, SleeperRoster, SleeperUser } from './types';

const BASE = 'https://api.sleeper.app/v1';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`Sleeper ${path}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export const sleeper = {
  state: () => get<NflState>('/state/nfl'),
  /** null when no such username exists. */
  user: (usernameOrId: string) => get<SleeperUser | null>(`/user/${encodeURIComponent(usernameOrId)}`),
  leagues: (userId: string, season: string) => get<SleeperLeague[]>(`/user/${userId}/leagues/nfl/${season}`),
  league: (leagueId: string) => get<SleeperLeague>(`/league/${leagueId}`),
  rosters: (leagueId: string) => get<SleeperRoster[]>(`/league/${leagueId}/rosters`),
  users: (leagueId: string) => get<SleeperUser[]>(`/league/${leagueId}/users`),
};

export const isRedraft = (league: SleeperLeague) => league.settings.type === 0;

export const avatarUrl = (avatar: string | null) =>
  avatar ? `https://sleepercdn.com/avatars/thumbs/${avatar}` : null;
