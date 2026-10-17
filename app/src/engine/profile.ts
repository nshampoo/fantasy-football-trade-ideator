import { bestLineup, strength, type Lineup } from './lineup';
import { POSITIONS, type League, type Player, type Position, type Team } from './types';

export interface PositionGrade {
  /** Value of this team's starters at the position (flex starters included). */
  score: number;
  /** score ÷ league median score at the position; 1 is average. */
  vsMedian: number;
}

export interface TeamProfile {
  team: Team;
  lineup: Lineup;
  strength: number;
  rank: number;
  grades: Record<Position, PositionGrade>;
  /** Positions well below the league median. */
  needs: Position[];
  /** Players worth more in a trade than to this lineup, best chips first. */
  surplus: { player: Player; marginal: number }[];
}

export const NEED_THRESHOLD = 0.85;
/** A player is surplus when losing them costs this lineup less than this share of their value. */
export const SURPLUS_THRESHOLD = 0.5;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** How much this team's strength drops without the player. */
export function marginalValue(team: Team, player: Player, league: League, base?: number): number {
  const before = base ?? strength(team.players, league.slots);
  return before - strength(team.players.filter((p) => p.id !== player.id), league.slots);
}

export function profileLeague(league: League): TeamProfile[] {
  const lineups = league.teams.map((t) => bestLineup(t.players, league.slots));
  const scores = lineups.map((l) => {
    const byPos = Object.fromEntries(POSITIONS.map((p) => [p, 0])) as Record<Position, number>;
    for (const s of l.starters) if (s.player) byPos[s.player.pos as Position] += s.player.value;
    return byPos;
  });
  const medians = Object.fromEntries(POSITIONS.map((p) => [p, median(scores.map((s) => s[p]))])) as Record<Position, number>;

  const profiles = league.teams.map((team, i): TeamProfile => {
    const lineup = lineups[i];
    const grades = Object.fromEntries(
      POSITIONS.map((p) => [p, { score: scores[i][p], vsMedian: medians[p] ? scores[i][p] / medians[p] : 1 }]),
    ) as Record<Position, PositionGrade>;
    const surplus = team.players
      .filter((p) => p.value > 0)
      .map((player) => ({ player, marginal: marginalValue(team, player, league, lineup.strength) }))
      .filter((s) => s.marginal < SURPLUS_THRESHOLD * s.player.value)
      .sort((a, b) => b.player.value - b.marginal - (a.player.value - a.marginal));
    return {
      team,
      lineup,
      strength: lineup.strength,
      rank: 0,
      grades,
      needs: POSITIONS.filter((p) => medians[p] > 0 && grades[p].vsMedian < NEED_THRESHOLD),
      surplus,
    };
  });
  [...profiles].sort((a, b) => b.strength - a.strength).forEach((p, i) => (p.rank = i + 1));
  return profiles;
}
