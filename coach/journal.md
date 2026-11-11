# Coach journal

Check-ins, newest at the bottom: what Lucas reported, what the data said, what we did. Plan changes are also logged in `plan/decisions.md`.

## 2026-11-04 · Coach set-up

**Lucas:** wants a coach he can talk to from his phone. Everything should land in triklaus, workouts should go straight to Zwift and Garmin, and over time the coaching should explain his strengths, weaknesses and how he adapts.

**Data:** intervals.icu connected (Garmin workouts upload on, Zwift workouts upload on). Its activity and wellness history is still empty, so the import is pending. Tomorrow: 3 × 10 × 30/30 in Zwift (345 / 160 W). Friday: LT1 ride.

**Did:** first athlete model in `coach/athlete.md`; `scripts/coach-data.mjs` briefing; this journal.

## 2026-11-05 · 30/30s done, feels great, wants a VO2 run tomorrow

**Lucas:** did the 3 × 10 × 30/30 on Zwift today and feels really good. Asked whether a VO2 run tomorrow is reasonable.

**Data:**
- **Today:** 64′ indoor, 245 W NP, avg HR 151, so completed.
- **Easy runs drifting:** since 28 Oct, 5 of 10 runs averaged 159–165 bpm, at or above the estimated LT1 (~162). Garmin HR Z1–2 share was 37% (wk of 26 Oct) and 45% (this week).
- **No swims** since Florianópolis (18 Oct).
- **Tests not done:** no 5′ bike test or 20′ TT on record, and the mile is unclear (31 Oct: 74′ run, avg HR 165).
- **Recovery:** sleep 5h58 last night (score 67), RHR 43 vs 41 on the previous two days, HRV 92 (no baseline yet). intervals.icu still has no activity history.

**Did:**
- Yes to a VO2 run tomorrow (Fri 6 Nov), as controlled hills: 5 × 3′ uphill at RPE 8–9, stopping at 3 reps if his legs are flat. Conditions: ≥ 7 h sleep tonight and a normal-feeling warm-up.
- Friday's LT1 ride removed from Zwift; hills pushed to Garmin.
- Weekend stays: Saturday long ride and Sunday long run, both genuinely easy (run HR < ~155).
- **To raise next:** pull easy runs back under LT1, restart swimming, schedule the 5′ / 20′ / mile tests.

## 2026-11-06 · Track 10 × 200 instead of hills

**Lucas:** went to a track instead of hills and did 10 × 200 m on / 200 m off. Asked whether he overdid it.

**Data (intervals.icu laps):**
- **Warm-up:** 6 km at 5:25–5:40/km, HR 130–154. Properly easy.
- **Reps (9 clean 200 m splits):** 35–38 s each (≈ 2:56–3:05/km), with no fade.
- **HR:** rep average climbed 155 → 189; peaks of 199–200 from rep 4 on. The 200 m jogs (70–80 s) stayed at 173–187 bpm.
- **Logged:** RPE 8, feel "good". Cool-down 3.5 km at HR 160.
- **Recovery:** 8h33 sleep (score 84), HRV 98 (92 the day before), resting HR 44 (41 → 43 → 44 over three days).

**Read:**
- **Not overdone in volume:** ~5–6 min of fast running, perfectly even, felt good.
- **The pace was the issue:** ~3:00/km is roughly 800–1500 m race pace, well above VO2max pace. So it was a glycolytic session, the kind this block avoids (it pushes VLamax the wrong way), with VO2 time only because the short jogs kept HR at 175–200.
- **Back-to-back:** coming the day after the 30/30s, that's two hard days in a row. The fast track running is new load for calves and Achilles.

**Did:**
- Weekend is easy only: Sat 3h ride at 140–185 W with no brick run; Sun long run cut to 80′ at HR ≤ ~155, plus an easy swim. Both pushed to Garmin.
- Next week tests the profile instead of guessing: Tue 5′ bike all-out (Zwift), Thu 1-mile TT on the track; 20′ TT the week after.
- **For future VO2 runs:** reps at ~vVO2 pace (3′ reps around mile-to-3k effort, or 200s at ~42–44 s), not 35–36 s.

## 2026-11-10 · Planning the week's hard sessions

**Lucas:** after the 10 × 200 he did a long run Saturday, a long ride plus a run Sunday, an easy run Monday, and rides today. Asked which days should be VO2 (ride today? run tomorrow? ride Thursday?).

**Data:**
- **Sat:** run 1h54, HR 155, feel 4/5 ("poor"). Prescribed was an 80′ run on Sunday.
- **Sun:** ride 4h28, NP 196 W (above the ~185 W cap), EF 1.33, **aerobic decoupling 16.2%**; plus a 50′ run at HR 136.
- **Mon:** run 1h13, HR 140.
- **Today:** resting HR 39 (the lowest this month), HRV 95 (range 92–100), sleep 7h47 (score 93). Recovered. intervals.icu's fitness/fatigue numbers are meaningless until the history is imported.

**Did (this week's hard days):**
- **Tue:** 5′ bike test (Zwift). This is today's VO2 ride.
- **Wed:** no VO2 run: easy run + 6 strides, plus a swim. A hard Wednesday would spoil Thursday's test and repeat last week's back-to-back pattern.
- **Thu:** 1-mile TT. This is the week's VO2 run.
- **Fri:** 30/15s 3 × 11 at 345 / 160 W, only if Friday morning's resting HR and HRV are normal and his legs are OK; otherwise a 90′ LT1 ride. The 30/15 targets get re-anchored once Tuesday's 5′ result is in.
- **Weekend:** easy, with rides ≤ ~185 W and fuelling 60–90 g/h.
- **Asked Lucas:** fuelling and heat on Sunday's 4h28, to explain the decoupling.

## 2026-11-10 · No formal tests; choppy months ahead

**Lucas:** not in the mood for testing. The coming months will be choppy: travel where he'll only run, some really big volume weeks, little structure. He'd test only if it really matters.

**Read:** it doesn't matter now. The block's direction (ceiling: VO2 plus easy volume) wouldn't change with the result. Training data already re-estimates the profile (best 5′/20′ power; the 200s showed run speed). VO2 work runs fine on capped targets plus RPE.

**Did:**
- Tests removed from Garmin/Zwift.
- Week rebuilt: Tue 30/15s 3 × 11 (345 / 160 W); Wed easy + strides; Thu 6 × 800 at 3:30–3:40/km (never faster; 2′ jog); Fri LT1 ride 90′ at 170–185 W; weekend easy.
- The February retest is now optional: only if it changes the marathon block.
- Preference and travel context added to the athlete model.
- **Asked Lucas:** travel dates and big-volume weeks, so the plan can carry run-only weeks.

## 2026-11-11 · Missed Tuesday's ride: VO2 ride today, tough run tomorrow

**Lucas:** couldn't ride on Tuesday. Today: VO2 ride plus an easy run. Tomorrow: the hard run.

**Did:** 30/15s 3 × 11 moved Tue → Wed in Zwift. Thursday's 6 × 800 (cap 3:30/km) and Friday's LT1 ride are unchanged. That makes Wed → Thu back-to-back hard days (bike then run), the same pattern he absorbed on 5–6 Nov. Friday stays steady and the weekend stays easy.
