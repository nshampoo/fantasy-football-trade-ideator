import type { TeamProfile } from '../engine/profile';
import type { Player } from '../engine/types';
import { fmt, record } from './format';
import { Grades } from './Grades';
import { PlayerRow } from './Player';

interface Props {
  profile: TeamProfile;
  teams: number;
  untouchable: Set<string>;
  onToggleUntouchable: (id: string) => void;
  onShop: (p: Player) => void;
}

export function TeamView({ profile, teams, untouchable, onToggleUntouchable, onShop }: Props) {
  const surplusIds = new Set(profile.surplus.map((s) => s.player.id));
  const actions = (p: Player) =>
    p.value > 0 && (
      <>
        <button
          type="button"
          className={`icon-btn${untouchable.has(p.id) ? ' on' : ''}`}
          aria-pressed={untouchable.has(p.id)}
          title={untouchable.has(p.id) ? 'Untouchable: never offered' : 'Mark untouchable'}
          onClick={() => onToggleUntouchable(p.id)}
        >
          {untouchable.has(p.id) ? '🔒' : '🔓'}
        </button>
        <button type="button" className="text-btn" onClick={() => onShop(p)}>
          Shop
        </button>
      </>
    );
  const bench = [...profile.lineup.bench].sort((a, b) => b.value - a.value);

  return (
    <div className="team-view">
      <div className="card summary">
        <div>
          <span className="big">#{profile.rank}</span>
          <span className="muted">
            {' '}
            of {teams} by lineup value · {fmt(profile.strength)} · {record(profile.team)}
          </span>
        </div>
        <Grades profile={profile} />
        {profile.needs.length > 0 && (
          <p className="small">
            Needs: <strong>{profile.needs.join(', ')}</strong>
          </p>
        )}
        {profile.surplus.length > 0 && (
          <p className="small">
            Trade chips: {profile.surplus.slice(0, 4).map((s) => s.player.name).join(', ')}{' '}
            <span className="muted">(worth more in a trade than in your lineup)</span>
          </p>
        )}
      </div>
      <div className="card">
        <h3>Starters</h3>
        {profile.lineup.starters.map(({ slot, player }, i) =>
          player ? (
            <PlayerRow key={i} slot={slot.name.replace('SUPER_FLEX', 'SF').replace('WRRB_FLEX', 'W/R').replace('REC_FLEX', 'W/T')} player={player} actions={actions(player)} />
          ) : (
            <div key={i} className="player empty-slot">
              <span className="slot">{slot.name}</span> Empty
            </div>
          ),
        )}
        <h3>Bench</h3>
        {bench.map((p) => (
          <PlayerRow key={p.id} slot={surplusIds.has(p.id) ? 'CHIP' : 'BN'} player={p} actions={actions(p)} dim={!p.value} />
        ))}
      </div>
    </div>
  );
}
