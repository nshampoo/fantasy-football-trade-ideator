import { useMemo } from 'react';
import type { TeamProfile } from '../engine/profile';
import { evaluateTrade, explain, PRESETS, type PresetName } from '../engine/trades';
import type { League, Player, Team } from '../engine/types';
import { PlayerRow } from './Player';
import { TradeSummary } from './TradeCard';

export interface Draft {
  partner: number | null;
  give: string[];
  get: string[];
}

interface Props {
  league: League;
  profiles: TeamProfile[];
  me: Team;
  preset: PresetName;
  draft: Draft;
  onDraft: (d: Draft) => void;
}

function Picker({ team, picked, onToggle }: { team: Team; picked: string[]; onToggle: (id: string) => void }) {
  const players = [...team.players].sort((a, b) => b.value - a.value);
  return (
    <div className="picker">
      {players.map((p) => (
        <label key={p.id} className={`pick${picked.includes(p.id) ? ' on' : ''}`}>
          <input type="checkbox" checked={picked.includes(p.id)} onChange={() => onToggle(p.id)} />
          <PlayerRow player={p} dim={!p.value} />
        </label>
      ))}
    </div>
  );
}

export function Evaluator({ league, profiles, me, preset, draft, onDraft }: Props) {
  const them = league.teams.find((t) => t.rosterId === draft.partner) ?? null;
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const result = useMemo(() => {
    if (!them || (!draft.give.length && !draft.get.length)) return null;
    const pick = (team: Team, ids: string[]) => ids.map((id) => team.players.find((p) => p.id === id)).filter((p): p is Player => !!p);
    const e = evaluateTrade(league, me, them, pick(me, draft.give), pick(them, draft.get), PRESETS[preset]);
    e.reasons = explain(e, profiles);
    return e;
  }, [league, profiles, me, them, draft, preset]);

  return (
    <div className="evaluator">
      <div className="card">
        <label className="field">
          Trade with
          <select value={draft.partner ?? ''} onChange={(e) => onDraft({ partner: Number(e.target.value) || null, give: draft.give, get: [] })}>
            <option value="">Pick a team…</option>
            {league.teams
              .filter((t) => t.rosterId !== me.rosterId)
              .map((t) => (
                <option key={t.rosterId} value={t.rosterId}>
                  {t.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      {result && (
        <div className="card trade">
          <TradeSummary e={result} />
        </div>
      )}
      <div className="eval-cols">
        <div className="card">
          <h3>You give</h3>
          <Picker team={me} picked={draft.give} onToggle={(id) => onDraft({ ...draft, give: toggle(draft.give, id) })} />
        </div>
        <div className="card">
          <h3>You get{them ? ` from ${them.name}` : ''}</h3>
          {them ? <Picker team={them} picked={draft.get} onToggle={(id) => onDraft({ ...draft, get: toggle(draft.get, id) })} /> : <p className="muted">Pick a team first.</p>}
        </div>
      </div>
    </div>
  );
}
