// Saves a real league (Sleeper + FantasyCalc + the players on its rosters) as a test fixture.
//   npm run fixture -- <leagueId> <name>
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fetchRawLeague, leagueFormat } from '../src/load';
import { fantasyCalcUrl } from '../src/values/fantasycalc';
import { appDir, readPlayers } from './node-env';

const [leagueId, name] = process.argv.slice(2);
if (!leagueId || !name) throw new Error('usage: npm run fixture -- <leagueId> <name>');

const raw = await fetchRawLeague(leagueId);
const fantasyCalc = await (await fetch(fantasyCalcUrl(leagueFormat(raw.league)))).json();
const all = readPlayers();
const rostered = new Set(raw.rosters.flatMap((r) => r.players ?? []));
const players = Object.fromEntries([...rostered].filter((id) => all[id]).map((id) => [id, all[id]]));

const dir = join(appDir, 'src/engine/__fixtures__');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, `${name}.json`), JSON.stringify({ ...raw, fantasyCalc, players }, null, 1));
console.log(`Saved ${raw.league.name} to src/engine/__fixtures__/${name}.json`);
