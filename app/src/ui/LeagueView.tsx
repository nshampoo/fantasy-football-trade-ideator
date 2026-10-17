import { Fragment, useState } from 'react';
import type { TeamProfile } from '../engine/profile';
import { POSITIONS, type Player } from '../engine/types';
import { fmt, gradeTone, pct, record } from './format';
import { Avatar, PlayerRow } from './Player';

interface Props {
  profiles: TeamProfile[];
  myRosterId: number;
  onTarget: (p: Player) => void;
}

export function LeagueView({ profiles, myRosterId, onTarget }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  const sorted = [...profiles].sort((a, b) => a.rank - b.rank);
  return (
    <div className="card league">
      <p className="muted small">Lineup value by team, with each position's starters against the league median. Open a team to target its players.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th className="num">Lineup</th>
              {POSITIONS.map((p) => (
                <th key={p} className="num">
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const mine = p.team.rosterId === myRosterId;
              const isOpen = open === p.team.rosterId;
              return (
                <Fragment key={p.team.rosterId}>
                  <tr className={`${mine ? 'mine' : ''} ${isOpen ? 'open' : ''}`}>
                    <td>{p.rank}</td>
                    <td>
                      <button type="button" className="team-btn" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : p.team.rosterId)}>
                        <Avatar avatar={p.team.avatar} name={p.team.name} />
                        <span>
                          <span className="tname">{p.team.name}</span>
                          <span className="muted small"> {record(p.team)}</span>
                        </span>
                      </button>
                    </td>
                    <td className="num">{fmt(p.strength)}</td>
                    {POSITIONS.map((pos) => (
                      <td key={pos} className={`num grade-cell ${gradeTone(p.grades[pos].vsMedian)}`}>
                        {pct(p.grades[pos].vsMedian)}
                      </td>
                    ))}
                  </tr>
                  {isOpen && (
                    <tr className="roster-row">
                      <td colSpan={3 + POSITIONS.length}>
                        {[...p.team.players]
                          .sort((a, b) => b.value - a.value)
                          .map((pl) => (
                            <PlayerRow
                              key={pl.id}
                              player={pl}
                              dim={!pl.value}
                              actions={
                                !mine && pl.value > 0 ? (
                                  <button type="button" className="text-btn" onClick={() => onTarget(pl)}>
                                    Target
                                  </button>
                                ) : undefined
                              }
                            />
                          ))}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
