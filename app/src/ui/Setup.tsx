import { useState, type FormEvent } from 'react';
import { isRedraft } from '../sleeper/client';
import type { SleeperLeague } from '../sleeper/types';
import { parseLeagueId } from './data';

const TYPES = ['Redraft', 'Keeper', 'Dynasty'];

export function FindForm({ initial, onUser, onLeague }: { initial?: string; onUser: (u: string) => void; onLeague: (id: string) => void }) {
  const [value, setValue] = useState(initial ?? '');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!v) return;
    const leagueId = parseLeagueId(v);
    if (leagueId) onLeague(leagueId);
    else onUser(v);
  };
  return (
    <form className="find" onSubmit={submit}>
      <label htmlFor="who" className="sr-only">
        Sleeper username or league ID
      </label>
      <input id="who" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Sleeper username or league ID" autoComplete="off" autoCapitalize="off" spellCheck={false} />
      <button type="submit">Go</button>
    </form>
  );
}

export function LeagueList({ leagues, onPick }: { leagues: SleeperLeague[]; onPick: (id: string) => void }) {
  if (!leagues.length) return <p className="empty card">No leagues this season.</p>;
  return (
    <div className="league-list">
      {leagues.map((l) => {
        const ok = isRedraft(l);
        return (
          <button key={l.league_id} type="button" className="card league-pick" disabled={!ok} onClick={() => onPick(l.league_id)}>
            <strong>{l.name}</strong>
            <span className="muted small">
              {TYPES[l.settings.type] ?? 'League'} · {l.total_rosters} teams{!ok && ' · redraft only for now'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
