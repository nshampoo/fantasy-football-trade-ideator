import type { PlayerDb } from '../sleeper/types';

export interface Players {
  db: PlayerDb;
  /** When the daily job last wrote the file. */
  updated: Date | null;
}

let players: Promise<Players> | null = null;

/** The trimmed Sleeper player list, fetched once per visit. */
export function loadPlayers(): Promise<Players> {
  players ??= fetch('./data/players.json')
    .then(async (res) => {
      if (!res.ok) throw new Error(`Couldn't load the player list (HTTP ${res.status}).`);
      const modified = res.headers.get('last-modified');
      return { db: (await res.json()) as PlayerDb, updated: modified ? new Date(modified) : null };
    })
    .catch((e) => {
      players = null;
      throw e;
    });
  return players;
}

/** A league ID typed directly, or pulled from a pasted sleeper.com/leagues/<id>/... link. */
export function parseLeagueId(input: string): string | null {
  const s = input.trim();
  const fromUrl = s.match(/leagues\/(\d{10,})/);
  if (fromUrl) return fromUrl[1];
  return /^\d{10,}$/.test(s) ? s : null;
}
