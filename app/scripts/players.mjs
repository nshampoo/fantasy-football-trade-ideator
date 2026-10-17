// Builds public/data/players.json: Sleeper's ~5 MB /players/nfl trimmed to what the app shows.
// Sleeper asks that /players/nfl be fetched at most once a day; in production a scheduled Lambda
// writes this file instead.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { trimPlayers } from './trim-players.mjs';

const out = join(dirname(fileURLToPath(import.meta.url)), '../public/data/players.json');
const res = await fetch('https://api.sleeper.app/v1/players/nfl');
if (!res.ok) throw new Error(`Sleeper /players/nfl: HTTP ${res.status}`);
const players = trimPlayers(await res.json());
await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(players));
console.log(`Wrote ${Object.keys(players).length} players to ${out}`);
