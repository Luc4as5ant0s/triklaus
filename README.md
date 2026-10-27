# triklaus

Lucas's season as a process: swimlanes = sports, columns = weeks, bands = blocks, ◇ = exit gateways, ◎ = goal race (TTT, 16 Jan 2027).

- `config/athlete.json` — goal, thresholds (null = estimated from data)
- `config/blocks.json` — training blocks, exit criteria, retrospectives (keep / drop / try)
- `scripts/sync-garmin.mjs` — pulls activities from the Garmin Connect Personal API (secret `GARMIN_API_KEY`)
- `scripts/build.mjs` + `scripts/lib/model.mjs` — builds `dist/index.html` (no dependencies)

GitHub Action syncs at 06:17 and 18:17 (Brasília) and deploys to GitHub Pages. Raw data stays in the Actions cache, never in the repo.

The Garmin key expires (max 1 year): generate a new one in Garmin Connect → update the `GARMIN_API_KEY` secret.
