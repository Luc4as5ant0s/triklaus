# triklaus

Lucas's training as a continuous arc: **past** (Garmin), **present** (this week, session by session) and **future** (the plan), at three scales. Macro blocks carry a physiological goal, mesos (1–7 weeks) progress inside them, and individual sessions carry their set, target and reason. The method follows Robbie Deckard: profile LT1 / LT2 / 5′, raise the ceiling (VO2max) with easy volume and VO2 work, keep VLamax in balance, and add threshold later and in small doses.

The plan is changed **by talking to Claude** in this repo. See [`CLAUDE.md`](CLAUDE.md) for the method and the editing protocol.

- `plan/plan.json`: events, macro blocks, mesos, per-week overrides
- `plan/library.json`: session library + week templates
- `plan/decisions.md`: why the plan looks like it does (shown on the site)
- `config/athlete.json`: availability + physiology profile (null = estimated from Garmin)
- `scripts/check.mjs`: validate the plan (`--weeks`, `--week YYYY-MM-DD`)
- `scripts/build.mjs`: build `dist/index.html` (works without Garmin data)
- `scripts/sync-garmin.mjs`: pull activities from the Garmin Connect Personal API (`GARMIN_API_KEY`)

```sh
node scripts/check.mjs --weeks                                  # plan sanity
node scripts/build.mjs && xdg-open dist/index.html              # preview
node --env-file=.env scripts/sync-garmin.mjs && node scripts/build.mjs   # with your data
```

The GitHub Action syncs at 06:17 and 18:17 (Brasília) and on every push to `main` that touches `plan/`, `config/`, `scripts/` or `site/`, then deploys to GitHub Pages. Run it manually on a branch to get the built page as a `site-preview` artifact instead of deploying. Raw Garmin data stays in the Actions cache, never in the repo.

The Garmin key expires (max 1 year): generate a new one in Garmin Connect → update the `GARMIN_API_KEY` secret.
