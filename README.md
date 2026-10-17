# Fantasy Football Trade Ideator

Analyzes a Sleeper redraft league and suggests trades for a chosen team, using
[FantasyCalc](https://fantasycalc.com) values. It will live at shampoe.com/trades/.

See [docs/DESIGN.md](docs/DESIGN.md) for the design and roadmap.

## Develop

```
cd app
npm install
npm run players            # builds public/data/players.json from Sleeper (at most once a day)
npm test
npm run ideas -- shampoe   # trade ideas in the terminal for a Sleeper username or league ID
npm run dev
```

`npm run ideas -- <username|leagueId> [team or owner] [fair|balanced|aggressive]`

`npm run fixture -- <leagueId> <name>` saves a league as a test fixture.

## Deploy

```
cd infra
npm install
AWS_PROFILE=personal npm run deploy
```

`npm run deploy` builds the app, then deploys the `TradeIdeatorSite` stack: a private S3 bucket
behind CloudFront, and the `Players` Lambda that writes `data/players.json` every day at 6 pm
New York time (and once on each deploy that changes it). Deploys never touch `data/`.

shampoe.com serves the stack's CloudFront domain (the `CloudFrontDomain` output) at
`/trades/app/` through the `apps` list in the personal-website repo's `infra/bin/infra.ts`.

| Path | What |
| --- | --- |
| `app/` | The app (Vite + React + TS) |
| `jobs/players/` | Daily Lambda: Sleeper `/players/nfl` → `data/players.json` (`trim.mjs` is shared with `app/scripts/players.mjs`) |
| `infra/` | CDK stack |
| `docs/DESIGN.md` | Design and roadmap |
