// Prints a league's team profiles and trade ideas for one team.
//   npm run ideas -- <sleeper username | league id> [team name or owner, default: the user's team] [fair|balanced|aggressive]
import { buildLeague, fetchRawLeague, leagueFormat } from '../src/load';
import { profileLeague } from '../src/engine/profile';
import { PRESETS, suggestTrades, type PresetName } from '../src/engine/trades';
import { POSITIONS } from '../src/engine/types';
import { isRedraft, sleeper } from '../src/sleeper/client';
import { fantasyCalc } from '../src/values/fantasycalc';
import { readPlayers } from './node-env';

const [who, teamQuery, presetArg = 'balanced'] = process.argv.slice(2);
if (!who) throw new Error('usage: npm run ideas -- <username|leagueId> [team] [preset]');
const preset = presetArg as PresetName;
if (!(preset in PRESETS)) throw new Error(`preset must be one of ${Object.keys(PRESETS).join(', ')}`);

let leagueIds: string[];
let userId: string | undefined;
if (/^\d{10,}$/.test(who)) leagueIds = [who];
else {
  const user = await sleeper.user(who);
  if (!user) throw new Error(`No Sleeper user ${who}`);
  userId = user.user_id;
  const { season } = await sleeper.state();
  leagueIds = (await sleeper.leagues(user.user_id, season)).filter(isRedraft).map((l) => l.league_id);
}

const players = readPlayers();
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const sign = (n: number) => (n >= 0 ? '+' : '') + fmt(n);

for (const leagueId of leagueIds) {
  const raw = await fetchRawLeague(leagueId);
  const league = buildLeague(raw, await fantasyCalc.getValues(leagueFormat(raw.league)), players);
  const q = teamQuery?.toLowerCase();
  const me = league.teams.find((t) => (q ? t.name.toLowerCase().includes(q) || t.ownerName.toLowerCase().includes(q) : t.ownerId === userId)) ?? league.teams[0];

  console.log(`\n=== ${league.name} (${league.teams.length} teams) · ideas for ${me.name} · ${PRESETS[preset].label} ===\n`);
  console.log('Rank  Team                          Strength   ' + POSITIONS.map((p) => p.padStart(5)).join(' ') + '   Needs');
  for (const p of profileLeague(league).sort((a, b) => a.rank - b.rank)) {
    const marker = p.team.rosterId === me.rosterId ? '*' : ' ';
    const grades = POSITIONS.map((pos) => `${Math.round(p.grades[pos].vsMedian * 100)}%`.padStart(5)).join(' ');
    console.log(`${marker}${String(p.rank).padStart(3)}  ${p.team.name.slice(0, 28).padEnd(28)}  ${fmt(p.strength).padStart(8)}   ${grades}   ${p.needs.join(', ')}`);
  }

  const { ideas } = suggestTrades(league, me.rosterId, { preset, limit: 12 });
  console.log(`\nTop ${ideas.length} ideas:\n`);
  for (const [i, e] of ideas.entries()) {
    const names = (ps: typeof e.give) => ps.map((p) => `${p.name} (${p.pos} ${fmt(p.value)})`).join(' + ');
    console.log(`${String(i + 1).padStart(2)}. with ${e.them.name}`);
    console.log(`    give ${names(e.give)}`);
    console.log(`    get  ${names(e.get)}`);
    console.log(`    you ${sign(e.myGain)} · them ${sign(e.theirGain)} · value they get ${Math.round(e.fairness * 100)}%`);
    for (const r of e.reasons) console.log(`    - ${r}`);
  }
}
