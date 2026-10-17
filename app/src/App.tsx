import { useMemo, useState } from 'react';
import { profileLeague } from './engine/profile';
import type { TradeEval } from './engine/trades';
import type { Player } from './engine/types';
import { loadLeague } from './load';
import { sleeper } from './sleeper/client';
import { loadPlayers } from './ui/data';
import { Evaluator, type Draft } from './ui/Evaluator';
import { useAsync, useParams, useUntouchable, type Tab } from './ui/hooks';
import { Ideas, type Focus } from './ui/Ideas';
import { LeagueView } from './ui/LeagueView';
import { FindForm, LeagueList } from './ui/Setup';
import { TeamView } from './ui/TeamView';
import { fantasyCalc } from './values/fantasycalc';

const TAB_LABELS: Record<Tab, string> = { ideas: 'Trade ideas', team: 'My team', league: 'League', evaluate: 'Evaluator' };

export default function App() {
  const [params, set] = useParams();
  const players = useAsync('players', loadPlayers);
  const nfl = useAsync('nfl', sleeper.state);
  const user = useAsync(params.u ? `user:${params.u.toLowerCase()}` : null, () => sleeper.user(params.u!));
  const leagues = useAsync(user.data && nfl.data ? `leagues:${user.data.user_id}:${nfl.data.league_season}` : null, () =>
    sleeper.leagues(user.data!.user_id, nfl.data!.league_season),
  );
  const league = useAsync(params.l && players.data ? `league:${params.l}` : null, () => loadLeague(params.l!, fantasyCalc, players.data!.db));

  const [untouchable, toggleUntouchable] = useUntouchable(params.l);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [draft, setDraft] = useState<Draft>({ partner: null, give: [], get: [] });

  const profiles = useMemo(() => (league.data ? profileLeague(league.data) : []), [league.data]);
  const myRosterId = params.t ?? league.data?.teams.find((t) => user.data && t.ownerId === user.data.user_id)?.rosterId;
  const me = league.data?.teams.find((t) => t.rosterId === myRosterId);
  const myProfile = profiles.find((p) => p.team.rosterId === myRosterId);

  const pickLeague = (l: string) => {
    set({ l, t: undefined, tab: 'ideas' });
    setFocus(null);
    setDraft({ partner: null, give: [], get: [] });
  };
  const focusOn = (f: Focus) => {
    setFocus(f);
    set({ tab: 'ideas' });
  };
  const adjust = (e: TradeEval) => {
    setDraft({ partner: e.them.rosterId, give: e.give.map((p) => p.id), get: e.get.map((p) => p.id) });
    set({ tab: 'evaluate' });
  };
  const error = players.error ?? nfl.error ?? user.error ?? leagues.error ?? league.error;

  return (
    <div className="app">
      <header className="top">
        <h1>Trade Ideator</h1>
        <FindForm
          key={params.u ?? ''}
          initial={params.u}
          onUser={(u) => {
            set({ u, l: undefined, t: undefined });
            setFocus(null);
          }}
          onLeague={pickLeague}
        />
      </header>

      {error && <p className="error card">{error.message}</p>}
      {params.u && user.data === null && <p className="error card">No Sleeper user named “{params.u}”.</p>}

      {!params.u && !params.l && (
        <section className="card intro">
          <p>
            Enter your Sleeper username to pick a redraft league. Trade Ideator values every player with <a href="https://fantasycalc.com" target="_blank" rel="noopener noreferrer">FantasyCalc</a>, works out each team's best lineup, and
            looks for trades that improve yours while still making sense for the other manager.
          </p>
        </section>
      )}

      {params.u && !params.l && (leagues.loading || user.loading ? <p className="muted">Loading leagues…</p> : leagues.data && <LeagueList leagues={leagues.data} onPick={pickLeague} />)}

      {params.l && league.loading && <p className="muted">Loading league and values…</p>}

      {league.data && (
        <>
          <div className="league-bar">
            <div>
              <h2>{league.data.name}</h2>
              <span className="muted small">{league.data.format}</span>
            </div>
            <label className="field">
              Your team
              <select value={myRosterId ?? ''} onChange={(e) => { set({ t: Number(e.target.value) }); setFocus(null); setDraft({ partner: null, give: [], get: [] }); }}>
                {myRosterId === undefined && <option value="">Pick a team…</option>}
                {league.data.teams.map((t) => (
                  <option key={t.rosterId} value={t.rosterId}>
                    {t.name}
                    {t.name !== t.ownerName ? ` (${t.ownerName})` : ''}
                  </option>
                ))}
              </select>
            </label>
            {params.u && (
              <button type="button" className="text-btn" onClick={() => set({ l: undefined, t: undefined })}>
                ← Other leagues
              </button>
            )}
          </div>

          {me && myProfile && (
            <>
              <nav className="tabs" aria-label="Views">
                {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
                  <button key={t} type="button" className={params.tab === t ? 'on' : ''} aria-current={params.tab === t ? 'page' : undefined} onClick={() => set({ tab: t })}>
                    {TAB_LABELS[t]}
                  </button>
                ))}
              </nav>
              {params.tab === 'ideas' && (
                <Ideas
                  league={league.data}
                  myRosterId={me.rosterId}
                  preset={params.preset}
                  onPreset={(preset) => set({ preset })}
                  untouchable={untouchable}
                  focus={focus}
                  onClearFocus={() => setFocus(null)}
                  onAdjust={adjust}
                />
              )}
              {params.tab === 'team' && (
                <TeamView
                  profile={myProfile}
                  teams={league.data.teams.length}
                  untouchable={untouchable}
                  onToggleUntouchable={toggleUntouchable}
                  onShop={(player: Player) => focusOn({ kind: 'shop', player })}
                />
              )}
              {params.tab === 'league' && <LeagueView profiles={profiles} myRosterId={me.rosterId} onTarget={(player) => focusOn({ kind: 'target', player })} />}
              {params.tab === 'evaluate' && <Evaluator league={league.data} profiles={profiles} me={me} preset={params.preset} draft={draft} onDraft={setDraft} />}
            </>
          )}
        </>
      )}

      <footer className="foot muted small">
        Values from <a href="https://fantasycalc.com" target="_blank" rel="noopener noreferrer">FantasyCalc</a> (redraft), live. Rosters from Sleeper, live.
        {players.data?.updated && <> Player info as of {players.data.updated.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}; player links have the latest news.</>}
        {' '}Gains are in FantasyCalc value points.
      </footer>
    </div>
  );
}
