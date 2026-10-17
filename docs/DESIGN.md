# Fantasy Football Trade Ideator — Design

## 1. Goal

Given a Sleeper username, pick one of that user's leagues and a team, and suggest
trades that help the team **and** that the other manager could plausibly accept.

Scope for now: **redraft leagues only.**

Hosted at **shampoe.com/trades/**, using the same pattern as the other apps on
shampoe.com (see §3).

## 2. Decisions

| Decision | Choice | Why |
|---|---|---|
| League format | Redraft only | Current need; no draft picks or age modeling |
| Player values | [FantasyCalc](https://fantasycalc.com) redraft values | Owner's preferred site. JSON API, CORS `*`, includes `sleeperId`, adjusts for team count and PPR |
| Frontend | React + Vite + TypeScript, static build | Fits S3 + CloudFront; no server |
| Trade engine | Pure TypeScript inside the app (`app/src/engine`), Vitest | Runs in the browser; easy to test and tune |
| Hosting | Own S3 + CloudFront stack (CDK), proxied by shampoe.com at `/trades/app/` | Same as Epic Planner, Citi Bike, and Volo |
| Deploy | `AWS_PROFILE=personal npm run deploy` from `infra/` | Same as the other repos |

## 3. Architecture

```
shampoe.com (personal-website repo)
  ├─ /trades/        story page (how and why)
  ├─ /trades/open/   site header + iframe of /trades/app/
  └─ /trades/app/*  ──proxy, prefix stripped──▶  this repo's CloudFront ──▶ S3 (app build)
                                                                 └─ /data/players.json
Browser (the app)
  ├─▶ api.sleeper.app        user, leagues, league settings, rosters, users   (live)
  ├─▶ api.fantasycalc.com    redraft values for the league's format          (live)
  └─▶ ./data/players.json    trimmed Sleeper player DB: id → name/pos/team
```

- Both external APIs allow browser calls from any origin, so the app fetches
  directly. Neither needs a key.
- **players.json:** Sleeper's `/players/nfl` is about 5 MB, and Sleeper asks apps
  to fetch it at most once a day. A small scheduled Lambda (daily, or weekly during
  the season) trims it to the fields we use and writes it to the app bucket. Until
  that exists, `npm run players` builds the same file locally.
- **players.json schedule:** the job runs once a day at about 6 pm ET, after
  Friday's final injury designations. The file is about 180 KB (about 45 KB
  gzipped) with `Cache-Control: max-age=3600`. Being up to a day old is fine:
  values come live from FantasyCalc, which also carries name, position, and team
  for every valued player. players.json only fills in unvalued players, injury
  tags, and ESPN IDs. The UI shows an "as of" time.
- **Player deep links:** every player in a trade idea links to live pages for
  news, injuries, and value history. These cover anything newer than the daily
  file.
  - FantasyCalc: `fantasycalc.com/players/{slug}-{fcId}`
  - ESPN: `espn.com/nfl/player/_/id/{espnId}`
  - FantasyPros: `fantasypros.com/nfl/players/{slug}.php`. The slug is a best
    guess and right for about 85% of players; misses land on FantasyPros
    search. It becomes exact once DynastyProcess IDs are cached.
  - Sleeper: `sleeper.com/players/nfl/{id}`
  - Once Sleeper projections are in (Phase 3.5), they also bring near-live
    injury status and team for projected players.
- **Relative paths everywhere:** the app is served under `/trades/app/` with the
  prefix stripped, so the Vite `base` is `./`. The app has no client-side routes;
  state lives in the query string.
- **Cache-Control on every file:** shampoe.com's proxy only caches files that set
  Cache-Control.

## 4. Data sources

### Sleeper
| Endpoint | Use |
|---|---|
| `GET /v1/state/nfl` | Current season and week |
| `GET /v1/user/{username}` | Username → user_id |
| `GET /v1/user/{user_id}/leagues/nfl/{season}` | The user's leagues (keep `settings.type === 0`, which is redraft) |
| `GET /v1/league/{id}` | `roster_positions`, `scoring_settings.rec`, `total_rosters` |
| `GET /v1/league/{id}/rosters` | Players per team, record, points for |
| `GET /v1/league/{id}/users` | Team names and avatars |

### FantasyCalc
`GET https://api.fantasycalc.com/values/current?isDynasty=false&numQbs={1|2}&numTeams={n}&ppr={0|0.5|1}`

| Parameter | Taken from |
|---|---|
| `numQbs` | 2 if `roster_positions` has `SUPER_FLEX`, otherwise 1 |
| `numTeams` | `total_rosters` |
| `ppr` | `scoring_settings.rec` |

The response covers about 200 QB/RB/WR/TE players, each with `value`, `sleeperId`,
and `maybeTier`. Players not listed (deep bench, K, DEF) count as replacement level
(value 0). The provider sits behind a `ValueProvider` interface so it can be
swapped or blended later.

### Additional free value sources (planned, Phase 3.5)

| Source | What it is | Access | How it becomes a value |
|---|---|---|---|
| **FantasyCalc** (current) | Market value from real trades | Browser, CORS `*` | Used as-is |
| **Sleeper projections** | Sleeper's weekly projected stats and points. `GET api.sleeper.app/projections/nfl/{season}/{week}?season_type=regular&position[]=…` (undocumented) | Browser, CORS `*` | Sum the remaining weeks and score them with **this league's** `scoring_settings` to get points over replacement at each position, then scale to FantasyCalc units |
| **FantasyPros ECR**, republished daily by [DynastyProcess](https://github.com/dynastyprocess/data) (`db_fpecr_latest.csv`, with `db_playerids.csv` mapping IDs to `sleeper_id`) | Expert consensus rest-of-season rankings | GitHub raw files, not CORS-safe, so the daily job caches them in `/data/` | Map rank to value with a fitted curve (rank → FantasyCalc value at that rank) |

How the sources combine:
- **Blended value** = a weighted average of the normalized sources. This becomes
  the engine's `value`. Weights are adjustable in the UI.
- **Disagreement** = projection value or expert value ÷ market value. Players far
  above 1 are **buy-low** targets; players far below 1 are **sell-high**
  candidates. The engine can then favor trades that receive buy-low players and
  send sell-high ones, and the rationale can say why ("Projections like him 30%
  more than the trade market").

Check each source's terms before the public launch. All of these are fine for
personal use; the DynastyProcess data repackages FantasyPros rankings.

## 5. Trade engine

### Team model
1. **Optimal lineup:** greedily fill the strict slots (QB, RB, WR, TE) with the
   best available players, then the flex slots (FLEX, WRRB_FLEX, REC_FLEX,
   SUPER_FLEX) from what remains. K, DEF, and IDP slots are ignored.
2. **Team strength** = Σ starter value + a small weight (about 0.15) × the best
   bench player at each position. The bench term rewards bye-week and injury
   depth.
3. **Needs and surplus by position:** compare each starting slot to the league
   median at that slot. A slot well below the median is a **need**. A bench
   player who would start on a median team is **surplus**.

### Candidate generation
- Only pair teams that complement each other: my surplus covers their need, or
  the reverse.
- Package shapes: 1-for-1, 2-for-1, and 1-for-2. Add 2-for-2 if the results stay fast.
- Prune to reasonable players: skip value-0 players, and only consider receiving
  players who would start for me.
- Roster size: the side receiving more players drops its lowest-value bench player.

### Scoring
- `myGain` = Δ my team strength.
- `theirGain` = Δ their team strength.
- `valueBalance` = the raw FantasyCalc value each side receives versus gives,
  with a consolidation premium for the side getting the best player in uneven
  packages (FantasyCalc's calculator does the same).
- Keep the trade only if `myGain > 0` and the other team plausibly accepts:
  `theirGain ≥ 0` or the value balance is in their favor.
- Rank by `myGain + λ·theirGain`. Presets:
  - **Fair:** λ = 1. Win-win trades.
  - **Balanced:** λ = 0.5.
  - **Aggressive:** λ = 0.1, with a value floor so offers aren't insulting.

### Explanation
Each idea carries a short rationale built from the needs and surplus data, for
example: *"You start a below-median TE and have a WR surplus; they're thin at WR.
+820 to your lineup, +310 to theirs."*

## 6. Use cases

### MVP
- **UC1 — Find my team:** enter a username, pick a redraft league, and pick a
  team (defaults to the user's own).
- **UC2 — Team overview:** roster with values, optimal lineup, and needs and
  surplus by position compared with the league.
- **UC3 — League landscape:** every team's strength and positional grades in one table.
- **UC4 — Trade ideas:** a ranked list with both sides' gains and a rationale.
  The strategy preset can be changed.
- **UC5 — Trade evaluator:** pick players from each side and see the value
  balance and lineup impact.

### Next
- **UC6 — Target a player:** offers to get a specific player.
- **UC7 — Shop a player:** the best returns across the league for one of my players.
- **UC8 — Filters:** untouchable players, positions to include or exclude,
  maximum players per side.
- **UC9 — Shareable links:** the query string encodes league, team, and trade.

### Later
- **UC10 — Manager tendencies:** use trade history to favor managers who
  actually trade.
- **UC11 — Bye weeks and schedule:** weight upcoming bye weeks for contenders.
- **UC12 — Dynasty and keeper support:** add picks and age.

### Non-goals
Accounts, executing trades (Sleeper's API is read-only), and platforms other
than Sleeper.

## 7. Repo layout

```
app/                 Vite + React + TS
  src/sleeper/       Typed Sleeper client
  src/values/        ValueProvider + FantasyCalc
  src/engine/        Lineup, team profiles, trade generation, scoring (+ tests)
  src/ui/            Components
  src/load.ts        Sleeper + values + players.json → engine League
  public/data/       players.json (generated, git-ignored)
  scripts/           players.mjs (builds players.json), ideas.ts (CLI), fixture.ts (saves test fixtures)
infra/               CDK: S3 + CloudFront + players.json Lambda
docs/                This file
```

## 8. Plan of action

| Phase | Deliverable | Done when |
|---|---|---|
| 0. Setup ✅ | Repo, GitHub, design | Pushed |
| 1. Data ✅ | Sleeper client, FantasyCalc provider, players.json script, fixtures from a real league | Real league rosters print with names and values |
| 2. Engine v1 ✅ | Lineup, profiles, 1-for-1 and 2-for-1 generation, scoring, rationale; tests; CLI | Sensible ideas for both test leagues in the terminal |
| 3. UI MVP ✅ | UC1–UC5, plus target and shop a player (UC6, UC7) and untouchables (part of UC8) | Usable locally (`npm run dev`) |
| 3.5. More value sources | Sleeper projections → league-scored value; FantasyPros ECR via DynastyProcess; blended value plus buy-low/sell-high signal | Ideas cite disagreement between sources |
| 4. Deploy ✅ | CDK stack + players Lambda; then the shampoe.com repo adds `trades` to `apps` plus `site/trades/` pages | Live at shampoe.com/trades/ |
| 5. Iterate | UC6+ | — |
