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
