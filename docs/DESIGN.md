# Fantasy Football Trade Ideator — High-Level Design

## 1. Goal

Given any Sleeper user (or league ID), analyze the league and suggest trades that
help that user's team **and** are realistic for the other manager to accept.

Final hosting target: a static site on **AWS S3 + CloudFront**, tied into the
owner's personal website (subdomain or sub-path).

## 2. Key constraints that shape the design

| Constraint | Implication |
|---|---|
| Sleeper API is public, read-only, no auth, CORS-friendly | The browser can call Sleeper directly — no backend needed for league data. |
| Sleeper asks for < 1000 calls/min, and `/players/nfl` (~5 MB) at most once per day | Cache the player DB; don't fetch it per user per visit. |
| Sleeper provides **no trade values** | Need an external value source (see §5). This is the most important design decision. |
| Host on CloudFront | Favor a static SPA. Any server logic should be small, scheduled, and write static JSON. |

## 3. Architecture

```
                     ┌──────────────────────────────┐
  Browser (SPA)      │  CloudFront  (yourdomain.com) │
  React + TS  ◀──────┤   ├─ /           → S3: app    │
      │              │   └─ /data/*     → S3: data   │
      │              └──────────────▲───────────────┘
      │                             │ writes daily
      │                   ┌─────────┴──────────┐
      │                   │ Scheduled job       │  (Lambda + EventBridge,
      │                   │  - Sleeper players  │   or a GitHub Action cron)
      │                   │  - player values    │
      │                   └────────────────────┘
      │
      └──────▶ api.sleeper.app  (user, leagues, rosters, picks — live, per user)
```

- **Frontend:** React + Vite + TypeScript SPA. Calls Sleeper directly for
  league-specific data.
- **Trade engine:** a pure TypeScript module with no UI or network code. Runs in the
  browser and gets heavy unit tests. If it later needs a server, it can move to a
  Lambda unchanged.
- **Data job:** runs once a day and publishes `players.json` (trimmed Sleeper player
  DB) and `values.json` (player and pick values) to S3, served through CloudFront.
  This keeps us within Sleeper's rate guidance and avoids CORS and key problems
  with value providers.
- **Infra as code:** AWS CDK (TypeScript). It covers the S3 buckets, the CloudFront
  distribution, the ACM cert (us-east-1), Route 53 records, and the scheduled Lambda.
- **CI/CD:** GitHub Actions authenticates to AWS with OIDC (no stored keys). Each
  run builds, tests, syncs to S3, and invalidates CloudFront.

## 4. Sleeper data we use

| Endpoint | Purpose |
|---|---|
| `GET /v1/user/{username}` | Resolve username to user_id |
| `GET /v1/user/{user_id}/leagues/nfl/{season}` | Pick a league |
| `GET /v1/league/{league_id}` | Roster slots, scoring settings, league type (dynasty, keeper, redraft), superflex |
| `GET /v1/league/{league_id}/rosters` | Who owns whom |
| `GET /v1/league/{league_id}/users` | Team names and avatars |
| `GET /v1/league/{league_id}/traded_picks` | Draft pick ownership (dynasty) |
| `GET /v1/league/{league_id}/transactions/{week}` | Past trades: manager tendencies (later phase) |
| `GET /v1/players/nfl` | Player DB (daily job only) |
| `GET /v1/players/nfl/trending/add` | Buy-low / sell-high signals (later phase) |

## 5. Player value source (decision needed)

| Option | Pros | Cons |
|---|---|---|
| **FantasyCalc API** (recommended to start) | Free JSON, supports dynasty/redraft, 1QB/SF, PPR variants, includes picks | Third-party dependency; check terms before public launch |
| KeepTradeCut | Popular, crowd-sourced | No official API; scraping raises ToS concerns |
| Sleeper projections (undocumented endpoint) | Same source as the league | Undocumented and could break; weekly projections ≠ trade value |
| Own model (projections + VORP) | Full control | Most work; best saved for a later phase |

Design the engine against a `ValueProvider` interface so the source can be swapped
or blended.

## 6. Trade engine (core logic)

1. **Normalize the league.** Read the starting slots from `roster_positions`
   (QB, RB, WR, TE, FLEX, SUPER_FLEX, and so on), the scoring format, and the
   league type.
2. **Value every asset.** Look up each player's value (and each pick's value in
   dynasty leagues), adjusted for format.
3. **Build team profiles.** For each roster:
   - Fill the optimal starting lineup. Its value is the **starter value**.
   - Bench players above replacement level count as **surplus**, by position.
   - Weak starting slots, measured against the league median, count as
     **needs**, by position.
   - Team direction (contend or rebuild) comes from record, roster age, and
     starter strength. This mainly matters in dynasty leagues.
4. **Match partners.** Look for complementary profiles: my surplus covers their
   need, and their surplus covers mine.
5. **Generate candidates.** Try 1-for-1, 2-for-1, and 2-for-2 packages (plus picks
   in dynasty) between matched teams. Prune hard to keep the search small.
6. **Score each candidate.**
   - `myGain` is the change in my starter value.
   - `theirGain` is the change in their starter value. It is the acceptance proxy.
   - `fairness` is the raw value difference, which must stay within a tolerance band.
   - Penalties apply for roster-spot overflow and for hurting a team's direction
     (for example, giving old players to a rebuilder).
   - Rank by a weighted blend. Expose the weights as user "strategy" presets:
     *Win-now*, *Rebuild*, *Fair*, and *Fleece* (lopsided but plausible).
7. **Explain.** Each suggestion includes a plain-English rationale, for example:
   "You're 3 deep at WR, they start a WR3-level TE; this upgrades your TE by X
   and their WR2 by Y."

## 7. Use cases

### MVP
- **UC1 — Find my team:** enter a Sleeper username, pick a league from the
  current season, and pick my team (default: the user's own roster).
- **UC2 — Team overview:** see my roster with values, strengths and weaknesses
  by position, and a league rank.
- **UC3 — League landscape:** see every team's profile (needs, surplus,
  contender or rebuilder) in one table.
- **UC4 — Trade suggestions:** a ranked list of trade ideas with both sides'
  gains and a rationale.
- **UC5 — Trade evaluator:** build a custom trade manually and see its value
  and impact for both teams.

### Next
- **UC6 — Target a player:** "How do I get Player X?" generates offers to that
  player's owner.
- **UC7 — Shop a player:** "Who wants Player Y?" lists the best returns across
  the league.
- **UC8 — Strategy presets and filters:** win-now or rebuild, positions to
  include or exclude, untouchable players, maximum players per side.
- **UC9 — Dynasty picks** included in packages.

### Later
- **UC10 — Manager tendencies:** use trade history to favor partners who
  actually trade.
- **UC11 — Shareable links:** a URL encodes league, team, and trade (no
  accounts needed).
- **UC12 — Buy-low / sell-high:** signals from trending data and value movement.
- **UC13 — Own valuation model:** projections plus VORP, blended with
  market values.

### Non-goals (for now)
- User accounts or login (Sleeper usernames are public; nothing to secure).
- Executing trades in Sleeper (the API is read-only).
- Platforms other than Sleeper. The data layer is still behind an adapter so
  ESPN or Yahoo could be added later.

## 8. Proposed repo layout

```
/app            React SPA (Vite + TS)
/packages/engine Trade engine: pure TS + Vitest
/packages/sleeper Typed Sleeper API client + caching
/jobs/data-sync Daily job: players.json + values.json
/infra          AWS CDK stack (S3, CloudFront, ACM, Route 53, Lambda)
/docs           Design docs
```

## 9. Plan of action

| Phase | Deliverable | Done when |
|---|---|---|
| **0. Setup** | Repo, GitHub remote, monorepo skeleton, lint/test/CI | CI is green on an empty app |
| **1. Data layer** | Typed Sleeper client; local script that dumps a real league to JSON fixtures | A real league's rosters print with player names |
| **2. Values** | `ValueProvider` interface + FantasyCalc implementation, cached | Every rostered player has a value for the league's format |
| **3. Engine v1** | Team profiles, partner matching, 1-for-1 and 2-for-1 generation and scoring, rationale; tested on fixtures | Sensible suggestions for your own league in a CLI |
| **4. UI MVP** | UC1–UC5 in the SPA | Usable locally end to end |
| **5. Deploy** | CDK stack, daily data job, GitHub Actions deploy, custom domain | Live at your domain or subdomain |
| **6. Iterate** | UC6–UC13 by priority | — |

The CLI-first approach in Phase 3 lets us tune trade quality on real leagues
before any UI work.

## 10. Open questions

1. Which league formats matter most: dynasty, redraft, or keeper? This sets the
   value source and whether picks are needed for the MVP.
2. Will it live at a subdomain (`trades.yoursite.com`) or a sub-path
   (`yoursite.com/trades`)? Where is the current site hosted, and is DNS in
   Route 53?
3. Is FantasyCalc acceptable as the starting value source?
4. Is the CDK + GitHub Actions + OIDC deploy approach acceptable, or do you
   prefer Terraform or manual deploys?
