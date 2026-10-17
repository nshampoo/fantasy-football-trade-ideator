import { parseSlots } from './engine/slots';
import type { League, Player, Team } from './engine/types';
import { sleeper } from './sleeper/client';
import type { PlayerDb, SleeperLeague, SleeperRoster, SleeperUser } from './sleeper/types';
import type { LeagueFormat, PlayerValue, ValueProvider } from './values/types';

export interface RawLeague {
  league: SleeperLeague;
  rosters: SleeperRoster[];
  users: SleeperUser[];
}

export const fetchRawLeague = async (leagueId: string): Promise<RawLeague> => {
  const [league, rosters, users] = await Promise.all([sleeper.league(leagueId), sleeper.rosters(leagueId), sleeper.users(leagueId)]);
  return { league, rosters, users };
};

export const leagueFormat = (league: SleeperLeague): LeagueFormat => ({
  numTeams: league.total_rosters,
  ppr: league.scoring_settings.rec ?? 0,
  numQbs: league.roster_positions.includes('SUPER_FLEX') ? 2 : 1,
});

export function buildLeague(raw: RawLeague, values: Map<string, PlayerValue>, players: PlayerDb): League {
  const usersById = new Map(raw.users.map((u) => [u.user_id, u]));
  const player = (id: string): Player => {
    const info = players[id];
    return {
      id,
      name: info?.n ?? id,
      pos: info?.p ?? '?',
      team: info?.t ?? null,
      injury: info?.i,
      value: values.get(id)?.value ?? 0,
    };
  };
  const teams = raw.rosters.map((r): Team => {
    const owner = r.owner_id ? usersById.get(r.owner_id) : undefined;
    return {
      rosterId: r.roster_id,
      ownerId: r.owner_id,
      name: owner?.metadata?.team_name || owner?.display_name || `Team ${r.roster_id}`,
      ownerName: owner?.display_name ?? 'Unowned',
      avatar: owner?.avatar ?? null,
      players: (r.players ?? []).map(player),
      wins: r.settings.wins,
      losses: r.settings.losses,
      ties: r.settings.ties,
      pointsFor: (r.settings.fpts ?? 0) + (r.settings.fpts_decimal ?? 0) / 100,
    };
  });
  return { id: raw.league.league_id, name: raw.league.name, season: raw.league.season, slots: parseSlots(raw.league.roster_positions), teams };
}

export async function loadLeague(leagueId: string, provider: ValueProvider, players: PlayerDb): Promise<League> {
  const raw = await fetchRawLeague(leagueId);
  return buildLeague(raw, await provider.getValues(leagueFormat(raw.league)), players);
}
