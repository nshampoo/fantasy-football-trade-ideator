import { useCallback, useEffect, useState } from 'react';
import type { PresetName } from '../engine/trades';
import { PRESETS } from '../engine/trades';

export interface Async<T> {
  data?: T;
  error?: Error;
  loading: boolean;
}

/** Runs `fn` whenever `key` changes (never while it's null) and keeps the latest result. */
export function useAsync<T>(key: string | null, fn: () => Promise<T>): Async<T> {
  const [state, setState] = useState<{ key: string | null; data?: T; error?: Error }>({ key: null });
  useEffect(() => {
    if (key === null) return;
    let live = true;
    fn().then(
      (data) => live && setState({ key, data }),
      (error: Error) => live && setState({ key, error }),
    );
    return () => {
      live = false;
    };
    // fn is recreated every render; key says when its inputs changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const current = key !== null && state.key === key;
  return { data: current ? state.data : undefined, error: current ? state.error : undefined, loading: key !== null && !current };
}

export type Tab = 'ideas' | 'team' | 'league' | 'evaluate';
const TABS: Tab[] = ['ideas', 'team', 'league', 'evaluate'];

/** App state that belongs in the link: who, which league, which team, and the view. */
export interface Params {
  /** Sleeper username */
  u?: string;
  /** league ID */
  l?: string;
  /** roster ID */
  t?: number;
  tab: Tab;
  preset: PresetName;
}

function read(): Params {
  const q = new URLSearchParams(location.search);
  const tab = q.get('tab') as Tab;
  const preset = q.get('preset') as PresetName;
  const t = Number(q.get('t'));
  return {
    u: q.get('u') || undefined,
    l: q.get('l') || undefined,
    t: Number.isInteger(t) && t > 0 ? t : undefined,
    tab: TABS.includes(tab) ? tab : 'ideas',
    preset: preset in PRESETS ? preset : 'balanced',
  };
}

function write(p: Params) {
  const q = new URLSearchParams();
  if (p.u) q.set('u', p.u);
  if (p.l) q.set('l', p.l);
  if (p.t) q.set('t', String(p.t));
  if (p.tab !== 'ideas') q.set('tab', p.tab);
  if (p.preset !== 'balanced') q.set('preset', p.preset);
  const s = q.toString();
  history.replaceState(null, '', s ? `?${s}` : location.pathname);
}

export function useParams(): [Params, (patch: Partial<Params>) => void] {
  const [params, setParams] = useState(read);
  const update = useCallback((patch: Partial<Params>) => {
    setParams((prev) => {
      const next = { ...prev, ...patch };
      write(next);
      return next;
    });
  }, []);
  return [params, update];
}

/** Players kept out of every idea, remembered per league in this browser. */
export function useUntouchable(leagueId: string | undefined): [Set<string>, (id: string) => void] {
  const key = `untouchable:${leagueId}`;
  const [ids, setIds] = useState<{ key: string; set: Set<string> }>({ key: '', set: new Set() });
  let set = ids.set;
  if (ids.key !== key) {
    try {
      set = new Set(JSON.parse(localStorage.getItem(key) ?? '[]'));
    } catch {
      set = new Set();
    }
    setIds({ key, set });
  }
  const toggle = useCallback(
    (id: string) =>
      setIds((prev) => {
        const next = new Set(prev.set);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        try {
          localStorage.setItem(key, JSON.stringify([...next]));
        } catch {
          /* no storage: still works for this visit */
        }
        return { key, set: next };
      }),
    [key],
  );
  return [set, toggle];
}
