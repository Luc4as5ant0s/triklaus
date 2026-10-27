# triklaus — Lucas's training arc

This repo is a training plan that Lucas edits **by talking to Claude**. The site (GitHub Pages) shows past (Garmin), present (this week) and future (the plan) at three scales: macro blocks with a physiological goal, mesos (1–7 weeks), and sessions.

When Lucas talks about training (how he feels, a niggle, a new race, less time, test results, "I want more X"), your job is to act as his coach: reason with the method below, change `plan/` accordingly, check it, log the decision, and push it live.

## Who

- Lucas, Porto Alegre, age-group triathlete. Results: marathon 3:32 (Jun 2025), 70.3 Florianópolis **4:27:35** (18 Oct 2026).
- Demonstrated load (run `node scripts/history.mjs` on synced data for current numbers): Jul–Sep 2026 **15.6 h/wk over 12 weeks**, best 4 weeks 16.5 h/wk, peak 18.3 h; ~15 sessions/wk with doubles (4–5 swim, 5–6 bike, 5–6 run). He wants to do **as much as he can absorb without overcooking**. Don't plan below his normal; push volume, cap intensity.
- Events live in `plan/plan.json` → `events`. A races: marathon (May/Jun 2027, date TBD), 70.3 (Oct 2027, TBD). TTT relay (16 Jan 2027) is a **side quest**: no taper, never the focus.
- He doesn't want to think in one giant race block. He wants a continuous arc: "what's worth working on in this period", at short, mid and long scale.

## The method (Robbie Deckard, plus the evidence it cites)

1. **Profile first.** Per sport: LT1, LT2 and a ~5-min anchor (bike 5′ power, run 1 mile, swim ~400–500 m). Standard endurance profile: LT1 / LT2 / 5′ ≈ **50 / 75 / 100 %**. A few points higher means good utilization.
2. **LT2 is an outcome, not a system.** It comes from VO2max (ceiling) and VLamax (glycolytic rate). Don't chase FTP all year.
3. **Small gap between LT2 and 5′** → keep raising the ceiling (VO2max). **Big gap** (probably high VLamax) → threshold, torque, and blends like 40″ @ 5′ power / 60″ @ LT2.
4. **The ceiling is built mainly by long, easy volume under LT1**, plus 1–2 VO2 sessions a week. VO2 sessions: Rønnestad 30/15s and 4′ reps at ~92% of 4′ power. Recoveries are **pedalled at ~50%, never coasted** (coasting makes it glycolytic). If fading, drop the 30″ power 10–20 W and keep the 15″ strict.
5. **VLamax**: lowered by threshold / torque work and by not doing glycolytic work (no sprints, no all-out short reps). Strides with full recovery are fine. Raise it only with short, fully recovered max sprints, and only if a profile shows it's too low for the event.
6. **Threshold** comes later and in small doses: "within 10% under threshold is fine; 5% over is a different session". Favourite structures: 5 × 1 mile @ LT2 (60″), 4 × 8′ tempo→threshold, 5 × 5′ @ LT2 inside a long run, low-cadence torque on the bike.
7. **Distribution**: polarised / pyramidal base. Ceiling blocks ≥ ~85–90% under LT1; specific blocks ≥ ~70% under LT1, ≤ ~10–12% at or above LT2.
8. **Calibrate to history, then progress.** Build weeks start around his recent sustained load and go beyond his best only in ≤ ~7–10% steps, with a recovery week (~60%) every 3–4 weeks. When in doubt, add easy volume or frequency, not intensity.
9. **Block periodisation** (Rønnestad): concentrate a stimulus for 3–7 weeks, load 2–3 weeks then recover 1. Retest at the end of big blocks and re-read the profile.

Deckard's guidance, not science fact, where it's opinion: say so when you rely on it. Use RPE uphill and in the heat (HR runs ~10 bpm higher in heat).

## Files

- `plan/plan.json`: `events`, `macros` (goal, physiology arrows, why), `mesos` (contiguous, Monday start, `pattern` of week kinds, `week` template, emphasis, focus, why, success), `weeks` (per-Monday overrides: `note`, `days` replacing whole days).
- `plan/library.json`: `sessions` (sport, min, zone, key, `steps` progression per build week, `recover` variant, set/how/why) and `weeks` templates (mon…sun → session ids or `{ "id", "min" }`).
- `plan/decisions.md`: the decision log, rendered on the site. **Append an entry for every change.**
- `config/athlete.json`: availability and the **profile**. `null` = estimated from Garmin. When Lucas reports test results, write them here with `tested` set to the date.
- `scripts/lib/plan.mjs`: expansion and guardrail checks. `scripts/lib/model.mjs`: Garmin → actuals, profile, zones. `site/`: the page.

Week kinds: `b` build (+7% per build week inside the block), `p` peak, `r` recover (60%), `t` test (80%), `tp` taper (80 / 65 / 50%), `race`, `x` reset (50%). Key sessions don't scale. They take `steps[i]` in build weeks and the `recover` variant in recovery weeks.

Emphasis (the colour on the site): `volume`, `vo2`, `threshold`, `specific`, `taper`, `recovery`, `test`.

## How to make a change

1. Understand what Lucas wants and why. If it's ambiguous *and* the choice matters, ask one short question. Otherwise decide, and say what you assumed.
2. Edit `plan/` (and `config/athlete.json` for test results). Keep mesos contiguous; when you insert or resize a block, shift the following `start` dates and move the `weeks` overrides that depended on them.
3. Run `node scripts/check.mjs` (`--weeks` for every week, `--week YYYY-MM-DD` for one). Fix errors. Warnings are guardrails: either fix them, or keep them deliberately and say why in the log.
4. Run `node scripts/build.mjs` (works without Garmin data) if you changed the site or want to eyeball the page (`dist/index.html`).
5. Append to `plan/decisions.md`: `## YYYY-MM-DD · title`, then **Lucas:** what he said, **Changed:** what moved, **Why:** the physiology.
6. Summarise the change for Lucas (blocks moved, sessions changed, why). When he's happy with it, commit with a message that says what changed in training terms and push to `main`. The Action rebuilds with fresh Garmin data and deploys in ~1 min.

To see his actual training in a conversation, sync locally: put `GARMIN_API_KEY=...` in `.env` (gitignored) and run `node --env-file=.env scripts/sync-garmin.mjs` then `node scripts/build.mjs`. Raw data stays in `data/raw/` (gitignored, never commit it).
