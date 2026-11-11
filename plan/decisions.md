# Decisions

Newest at the bottom. Each entry: what Lucas said, what changed, and why (with the physiology behind it).

## 2026-10-27 · From a TTT countdown to a continuous training arc

**Lucas:** wants a training visualizer for the past, present and future, with large blocks that have physiological goals, mid blocks, and individual sessions, adjusted by talking it through. He likes Robbie Deckard's approach (VO2max / VLamax, blocks built on the athlete's physiology, not threshold all year). No hard focus right now: a long base that raises the aerobic ceiling. Marathon in May/June 2027 and a 70.3 in October 2027. TTT (Jan 2027) is a side quest.

**Changed:** the whole plan. Five macro blocks: Raise the ceiling (Oct–Feb), Convert for the marathon (Feb–Jun), Reset (Jun), Half-distance (Jul–Oct), Off-season. Each is split into 1–7 week mesos with 3:1-style loading.

**Why:**
- Deckard: LT2 is an *outcome* of VO2max and VLamax, not a system you train directly. Build the ceiling first; long, easy work under LT1 is the main lever, plus 1–2 VO2 sessions a week (30/15s with pedalled recoveries).
- From Garmin data (last 90 d): 5′ = 321 W, LT2 ≈ 90% of best 20′ = 250 W, so LT2 sits at ~78% of 5′, a touch above the ~75% "standard" profile. The gap isn't big, so threshold work buys little now and the ceiling is the bottleneck. These are *estimates*; the first two weeks test them (5′ bike, 20′ bike, 1 mile, 400 m swim).
- Bike volume fell from ~9 h to 2 h/week in October, so the first block reloads volume before any VO2 block.
- Threshold arrives in the marathon block, where it does double duty: it raises LT2 utilization and lowers VLamax, both of which a marathon wants.
- The 70.3 build opens with Deckard's 7-week bike VO2max block. He places it "right after a main race when there's a long runway", then converts it with torque and threshold work.
- Race dates are placeholders (first Sunday of June; 17 Oct) until races are picked.

## 2026-10-27 · Sized to what Lucas actually does

**Lucas:** the first version underestimated him. Look at his past volume and his recent 70.3; he wants to do as much as he can absorb without overcooking, and expected more sessions.

**Changed:**
- Every week template rebuilt around ~14–15 sessions with daily doubles: 4 swims, 4–5 rides, 5–6 runs, 1 strength. Build weeks start at **~15–16 h** and progress in ≤ 7%/week steps to **~18 h** (holiday volume) and **~19.6 h** (durability, early Feb); recovery weeks ~60% (9–10 h). Availability set to 13–20 h.
- Order inside "Raise the ceiling": recover & profile (1 wk) → **VO2max block right away** (Nov) → big easy volume (Dec, Christmas = recovery week) → holiday volume + TTT → durability → retest.
- Marathon block keeps triathlon volume (~14–16 h, 6 runs ≈ 70–85 km/wk); post-marathon reset is ~5 h/wk then a recovery-sized week before volume returns.
- Past races (marathon 3:32 in Jun 2025, Osório 3:18, 70.3 Florianópolis 4:27:35) are on the timeline; history now starts June 2025.

**Why:**
- Garmin history (`scripts/history.mjs`): Jul–Sep 2026 averaged **15.6 h/wk over 12 weeks**, best 4 weeks **16.5 h/wk**, peak week 18.3 h, ~15 sessions/wk. The first plan's 12–15 h with ~11 sessions sat *below* his normal. October's drop was the 70.3 taper and recovery, not a collapse.
- Deckard: easy volume under LT1 is the main ceiling lever and the hardest thing to overdo, so volume is where "as much as possible" goes. Intensity stays capped (1–3 key sessions, ≥ 85–90% under LT1 in ceiling blocks), which is what keeps it from overcooking.
- Deckard places a VO2 block "right after a main race when there's a long runway". Florianópolis was 18 Oct, so it comes first.
- The progression goes past his previous best only in small steps (16.0 → 17.1 → 18.2 h; 17.3 → 18.7 → 19.6 h) with a recovery week after every 3 build weeks. If HRV, sleep or motivation sag, the fix is to drop the third build week to recovery, not to cut the key sessions.

## 2026-11-04 · Thursday's VO2 moves to the bike: 3 × 10 × 30/30

**Lucas:** tomorrow he'll do the classic 3 × 10 × 30″ on / 30″ off on the trainer, in Zwift.

**Changed:** Thu 5 Nov: hill VO2 run (5 × 3′) → bike VO2 30/30s (new library session `bike-vo2-3030`), plus the easy swim. Sent to Zwift through intervals.icu: ons 345 W, offs 160 W pedalled, 4′ easy between sets (64′). The hill run was removed from the Garmin calendar.

**Why:** both target the ceiling, so the week's VO2 dose is unchanged; doing both on one day would be two key sessions. The ons sit at ~107% of 5′ power (321 W), slightly above the 30/15 range because the 30″ rest is longer. The offs are pedalled at ~50% (Deckard: never coast, or it turns glycolytic).

## 2026-11-05 · Hill VO2 run the day after the 30/30s

**Lucas:** felt really good after the 30/30s and wanted a VO2 run the next day.

**Changed:** Fri 6 Nov: LT1 ride → hill VO2 run (5 × 3′ uphill, RPE 8–9) plus an easy swim. The LT1 ride is dropped this week.

**Why:** inside a VO2 block, stacking VO2 sessions on consecutive days is what Rønnestad-style high-intensity blocks do, and going bike then run spreads the muscular load. Hills keep the VO2 stimulus with low impact. Guardrails: ≥ 7 h sleep, a normal warm-up, and stop at 3 reps if his legs are flat. The weekend stays easy to absorb it.

## 2026-11-06 · Easy weekend after two hard days; profile tests next week

**Lucas:** did a track 10 × 200 / 200 (≈ 3:00/km) instead of the hill VO2. Asked whether he overdid it and what's next.

**Changed:**
- Sat 7 Nov: long ride without the brick run.
- Sun 8 Nov: long run 100′ → 80′, plus an easy swim.
- Week of 9 Nov: Tue 30/15s → **5′ bike test**; Thu hill VO2 → **1-mile TT**.

**Why:**
- The 200s were glycolytic: well above VO2max pace, on top of yesterday's 30/30s. The fix is easy volume now, not more intensity.
- The tests have been pending since October, and Friday's speed suggests the estimated run anchors (vVO2 ≈ 3:37/km, mile ≈ 5:49) are too conservative. Real anchors set the right pace for the rest of the VO2 block.
- Both tests are VO2-level efforts, so the block's stimulus is kept.

## 2026-11-10 · Week 2 of the VO2 block: tests as the VO2 work, 30/15s Friday

**Lucas:** wanted this week's hard rides and runs planned.

**Changed:**
- Tue: 5′ bike test (unchanged).
- Wed: easy run + strides, plus a swim.
- Thu: mile TT (unchanged).
- Fri: LT1 ride → **30/15s 3 × 11**, conditional on Friday morning's markers.

**Why:**
- Three hard days, spread Tue / Thu / Fri. Thu–Fri is run then bike, and Lucas has absorbed that pattern before (5–6 Nov).
- The two tests double as the week's VO2 sessions and give real anchors, so the rest of the block isn't built on estimates.
- No hard Wednesday, so the mile isn't run on tired legs.
- The weekend stays easy because Sunday's 4h28 ride showed 16% decoupling.

## 2026-11-10 · Drop the formal tests; VO2 work by caps and RPE

**Lucas:** doesn't want to test now. Choppy months ahead (run-only travel, big unstructured volume weeks).

**Changed:**
- Tue 5′ test → **30/15s 3 × 11**.
- Thu mile TT → **6 × 800 @ 3:30–3:40/km**.
- Fri 30/15s → **LT1 ride 90′**.
- The Feb retest is optional.

**Why:** a test is worth its cost only when its result changes a decision. This block's direction doesn't depend on it, and the profile keeps updating from training data. The check flags a 14% ramp vs last week's *plan*; that's kept deliberately, because last week's plan was cut short while Lucas actually trained more (4h28 ride, 1h54 run).

## 2026-11-11 · 30/15s moved to Wednesday

**Lucas:** missed Tuesday's ride; will do it today, with the hard run tomorrow.

**Changed:** Tue → no session; Wed: 30/15s 3 × 11 + easy run with strides + swim.

**Why:** keeps both of the week's VO2 sessions. Wed bike → Thu run is the bike-then-run back-to-back he handled on 5–6 Nov, and the steady Friday plus easy weekend absorb it.

## 2026-11-11 · +1 h easy after the 30/15s

**Lucas:** wanted to add an easy hour to the ride.

**Changed:** Wed: 30/15s 3 × 11 + 60′ easy at 150–175 W (~110′ total). Week ≈ 16.6 h, inside the 13–20 h range.

**Why:** easy volume under LT1 is the block's main lever and the hardest thing to overdo. Riding it after the intervals trains endurance on tired legs, the gap Sunday's decoupling flagged. It's low impact, so it doesn't cost Thursday's 800s if fuelling is good.
