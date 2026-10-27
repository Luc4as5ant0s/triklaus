// triklaus — Garmin activities → actuals, physiology profile and zones.
// Everything is transparent on purpose: each number on the site is computed here or in plan.mjs.
// Only aggregates and per-session summaries leave this file — no GPS, no names, no device IDs.
import { toDay, fromDay, addDays, mondayOf } from './plan.mjs';

const DAY = 864e5;
export const SPORTS = ['swim', 'bike', 'run'];

export function sportOf(typeKey = '') {
  const k = typeKey.toLowerCase();
  if (k.includes('swim')) return 'swim';
  if (k.includes('cycl') || k.includes('ride') || k.includes('bik')) return 'bike';
  if (k.includes('run') || k.includes('trail')) return 'run';
  if (k.includes('strength') || k.includes('fitness') || k.includes('yoga')) return 'other';
  return 'other';
}

const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
// "4:35" → 275 s ; 275 → "4:35"
export const parseMMSS = (s) => { if (s == null) return null; if (typeof s === 'number') return s; const [m, x] = String(s).split(':').map(Number); return m * 60 + (x || 0); };
export const mmss = (sec) => { if (sec == null || !isFinite(sec)) return '–'; const r = Math.round(sec); return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`; };

export function normalise(raw) {
  return raw
    .filter((a) => !(a.isParent || a.parent))
    .map((a) => {
      const sport = sportOf(a.activityType?.typeKey);
      const sec = a.movingDuration || a.duration || 0;
      const z = [1, 2, 3, 4, 5].map((i) => a[`hrTimeInZone_${i}`] || 0);
      return {
        id: a.activityId,
        date: (a.startTimeLocal || '').slice(0, 10),
        sport, type: a.activityType?.typeKey || '',
        indoor: /indoor|virtual|treadmill|lap_swim/.test(a.activityType?.typeKey || ''),
        race: a.eventType?.typeKey === 'race',
        sec, km: (a.distance || 0) / 1000,
        avgHR: a.averageHR || null,
        avgPower: a.avgPower || null, np: a.normPower || null,
        p5: a.maxAvgPower_300 || null, p10: a.maxAvgPower_600 || null, p20: a.maxAvgPower_1200 || null,
        vo2: a.vO2MaxValue || null,
        hrz: z.some(Boolean) ? z : null,
        aTE: a.aerobicTrainingEffect || null, anTE: a.anaerobicTrainingEffect || null,
      };
    })
    .filter((a) => a.sec > 0 && a.date)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

// ---- Deckard profile: LT1, LT2, 5′ per sport. Configured values win; otherwise estimated (and flagged). ----
export function profileOf(acts, athlete, zones, gprofile, today) {
  const P = athlete.profile || {};
  const since = (d) => acts.filter((a) => toDay(a.date) >= toDay(today) - d * DAY);
  const est = {};
  const cfg = (o, k) => (o && o[k] != null ? o[k] : null);

  // bike
  const rides = since(90).filter((a) => a.sport === 'bike');
  const best = (k) => Math.max(0, ...rides.map((a) => a[k] || 0)) || null;
  let p5 = cfg(P.bike, 'p5W'); if (p5 == null) { p5 = best('p5'); est.p5W = 'best 5′ power, last 90 d'; }
  let lt2W = cfg(P.bike, 'lt2W');
  if (lt2W == null) {
    const b20 = best('p20'), b10 = best('p10');
    lt2W = b20 ? Math.round(b20 * 0.9) : b10 ? Math.round(b10 * 0.86) : null;
    est.lt2W = b20 ? '90% × best 20′ (Deckard), last 90 d' : '86% × best 10′, last 90 d';
  }
  let lt1W = cfg(P.bike, 'lt1W'); if (lt1W == null && lt2W) { lt1W = Math.round(lt2W * 0.75); est.lt1W = '75% × LT2 (typical; confirm with a lactate test)'; }

  // run
  const z = (zones || []).find((x) => x.sport === 'RUNNING') || (zones || []).find((x) => x.sport === 'DEFAULT');
  const ud = gprofile?.userData || {};
  let lt2Hr = cfg(P.run, 'lt2Hr');
  if (lt2Hr == null) {
    lt2Hr = ud.lactateThresholdHeartRate || z?.lactateThresholdHeartRateUsed || (z?.maxHeartRateUsed ? Math.round(z.maxHeartRateUsed * 0.89) : null);
    est.lt2Hr = ud.lactateThresholdHeartRate || z?.lactateThresholdHeartRateUsed ? 'Garmin lactate threshold HR' : '89% × max HR';
  }
  let lt1Hr = cfg(P.run, 'lt1Hr'); if (lt1Hr == null && lt2Hr) { lt1Hr = Math.round(lt2Hr * 0.85); est.lt1Hr = '85% × LT2 HR'; }
  const vo2run = ud.vo2MaxRunning || median(since(42).filter((a) => a.sport === 'run' && a.vo2).map((a) => a.vo2));
  // Daniels: VO2 = −4.60 + 0.182258·v + 0.000104·v² (v in m/min) → velocity at VO2max
  const vV = vo2run ? (-0.182258 + Math.sqrt(0.182258 ** 2 + 4 * 0.000104 * (vo2run + 4.6))) / (2 * 0.000104) : null;
  const paceAt = (frac) => (vV ? 60000 / (vV * frac) : null); // s/km
  let mile = parseMMSS(cfg(P.run, 'mile'));
  if (mile == null && vV) { mile = Math.round(1609 / (vV * 1.0) * 60); est.mile = `from Garmin VO2max ${r1(vo2run)} (Daniels vVO2max)`; }
  let lt2Pace = parseMMSS(cfg(P.run, 'lt2Pace'));
  if (lt2Pace == null) {
    let s = ud.lactateThresholdSpeed; if (s && s < 1) s *= 10; // Garmin stores LT speed in m/s ×0.1 on some accounts
    if (s) { lt2Pace = Math.round(1000 / s); est.lt2Pace = 'Garmin lactate threshold speed'; }
    else if (vV) { lt2Pace = Math.round(paceAt(0.88)); est.lt2Pace = '88% of vVO2max (Daniels T pace)'; }
  }
  let lt1Pace = parseMMSS(cfg(P.run, 'lt1Pace'));
  if (lt1Pace == null && lt1Hr) {
    const xs = since(42).filter((a) => a.sport === 'run' && !a.indoor && a.avgHR && a.km >= 5 && a.avgHR >= lt1Hr - 6 && a.avgHR <= lt1Hr + 2).map((a) => a.sec / a.km);
    if (xs.length >= 3) { lt1Pace = Math.round(median(xs)); est.lt1Pace = `median pace of ${xs.length} outdoor runs at ~LT1 HR, last 42 d`; }
    else if (vV) { lt1Pace = Math.round(paceAt(0.75)); est.lt1Pace = '75% of vVO2max'; }
  }

  // swim
  let css = parseMMSS(cfg(P.swim, 'css'));
  if (css == null) {
    const paces = since(60).filter((a) => a.sport === 'swim' && a.km > 0.4).map((a) => a.sec / (a.km * 10)).sort((a, b) => a - b).slice(0, 3);
    css = paces.length ? Math.round(median(paces)) : null; est.css = 'median of 3 fastest swims (avg pace), last 60 d';
  }
  let t400 = parseMMSS(cfg(P.swim, 't400'));

  return {
    bike: { lt1W, lt2W, p5W: p5, tested: P.bike?.tested || null, source: P.bike?.source || null },
    run: { lt1Hr, lt2Hr, lt1Pace, lt2Pace, mile, vo2: r1(vo2run), vVO2Pace: paceAt(1), tested: P.run?.tested || null, source: P.run?.source || null },
    swim: { css, t400, tested: P.swim?.tested || null, source: P.swim?.source || null },
    est,
  };
}

// Deckard's reading: LT1 / LT2 / 5′ ≈ 50 / 75 / 100 % is a standard endurance profile.
export function readProfile(pr) {
  const b = pr.bike;
  if (!b.p5W || !b.lt2W) return null;
  const lt2 = b.lt2W / b.p5W, lt1 = b.lt1W ? b.lt1W / b.p5W : null;
  let verdict;
  if (lt2 >= 0.8) verdict = 'Utilization is already high, so the gap between threshold and ceiling is small. Raising the ceiling (VO2max) is the cheapest gain; threshold work comes later, in small doses.';
  else if (lt2 >= 0.72) verdict = 'Standard profile. Build the ceiling first, then threshold converts it.';
  else verdict = 'Big gap between threshold and ceiling, which suggests a high VLamax. Threshold and torque work, plus 40″@5′ / 60″@LT2 blends, before more VO2.';
  return { lt1: r1(lt1 * 100), lt2: r1(lt2 * 100), verdict };
}

// Zone table, resolved per sport. Each value is a display string.
export function zonesOf(pr) {
  const b = pr.bike, r = pr.run, s = pr.swim;
  const W = (lo, hi) => (lo && hi ? `${Math.round(lo)}–${Math.round(hi)} W` : '–');
  const pace = (sec) => (sec ? `${mmss(sec)}/km` : null);
  const pr2 = (a, b2) => (a && b2 ? `${mmss(a)}–${mmss(b2)}/km` : '–');
  const hr = (lo, hi) => (lo && hi ? `${Math.round(lo)}–${Math.round(hi)} bpm` : '–');
  const css = s.css;
  const sw = (lo, hi) => (css ? `${mmss(css + lo)}–${mmss(css + hi)}/100 m` : '–');
  const vv = r.vVO2Pace || (r.mile ? r.mile / 1.609 : null);
  return [
    { z: 'E', name: 'Easy · under LT1', bike: b.lt1W ? `< ${b.lt1W} W` : '–', run: r.lt1Hr ? `HR < ${r.lt1Hr}${r.lt1Pace ? ` · slower than ${pace(r.lt1Pace)}` : ''}` : '–', swim: sw(6, 12), note: 'Where ~85–90% of the time goes. Talk in full sentences.' },
    { z: 'LT1', name: 'Steady · top of easy', bike: W(b.lt1W * 0.9, b.lt1W), run: r.lt1Hr ? hr(r.lt1Hr - 6, r.lt1Hr) : '–', swim: sw(4, 6), note: 'Fat-max territory. The ceiling session for the bike.' },
    { z: 'MP', name: 'Marathon pace', bike: '–', run: r.lt2Pace ? `${pr2(r.lt2Pace * 1.05, r.lt2Pace * 1.08)} · HR ${r.lt1Hr ? `${r.lt1Hr + 4}–${r.lt2Hr - 8}` : '–'}` : '–', swim: '–', note: 'Between LT1 and LT2. Refined from the marathon block.' },
    { z: 'RP', name: '70.3 race pace', bike: W(b.lt2W * 0.78, b.lt2W * 0.85), run: r.lt2Pace ? pr2(r.lt2Pace * 1.06, r.lt2Pace * 1.1) : '–', swim: sw(2, 4), note: 'Specific to the half.' },
    { z: 'ST', name: 'Sub-threshold · tempo', bike: W(b.lt2W * 0.85, b.lt2W * 0.92), run: r.lt2Pace ? pr2(r.lt2Pace * 1.02, r.lt2Pace * 1.05) : '–', swim: sw(1, 3), note: 'Threshold stimulus without sitting on threshold (torque work, MP→LT2 tempo).' },
    { z: 'T', name: 'Threshold · LT2', bike: W(b.lt2W * 0.9, b.lt2W), run: r.lt2Pace ? `${pr2(r.lt2Pace, r.lt2Pace * 1.03)} · HR ${r.lt2Hr ? hr(r.lt2Hr - 6, r.lt2Hr).replace(' bpm', '') : '–'}` : '–', swim: sw(-2, 2), note: '"Within 10% under is fine; 5% over is a different session" (Deckard). RPE 7–8.' },
    { z: 'VO2', name: 'VO2max · 3–5′ reps', bike: W(b.p5W * 0.92, b.p5W * 0.98), run: vv ? `${pr2(vv * 0.98, vv * 1.04)} · RPE 8–9` : 'RPE 8–9', swim: s.t400 ? `${mmss(s.t400 / 4)}/100 m` : sw(-6, -3), note: '~92% of 4′ power (Deckard). Hard but controlled.' },
    { z: 'VO2s', name: 'VO2 · 30/15 ons', bike: W(b.p5W * 1.05, b.p5W * 1.15), run: 'RPE 9', swim: '–', note: '15″ off pedalled at ~50% of 5′ power, never coast.' },
    { z: 'S', name: 'Strides / sprint', bike: '–', run: '≈ mile pace, relaxed', swim: '–', note: 'Short, full recovery, so no glycolytic build-up.' },
  ];
}

export function actualsOf(acts, from, today) {
  const list = acts.filter((a) => a.date >= from && a.date <= today);
  const weeks = {};
  for (const a of list) {
    const w = mondayOf(a.date);
    const W = (weeks[w] ||= { w, h: 0, by: { swim: 0, bike: 0, run: 0, other: 0 }, km: { swim: 0, bike: 0, run: 0 }, hrz: [0, 0, 0, 0, 0], n: 0 });
    W.h += a.sec / 3600; W.by[a.sport] = (W.by[a.sport] || 0) + a.sec / 3600; W.n++;
    if (W.km[a.sport] != null) W.km[a.sport] += a.km;
    if (a.hrz) a.hrz.forEach((s, i) => (W.hrz[i] += s));
  }
  for (const W of Object.values(weeks)) {
    W.h = r1(W.h); for (const k in W.by) W.by[k] = r1(W.by[k]); for (const k in W.km) W.km[k] = r1(W.km[k]);
    const t = W.hrz.reduce((x, y) => x + y, 0);
    W.easyShare = t ? r1(((W.hrz[0] + W.hrz[1]) / t) * 100) : null; // Garmin Z1–2 ≈ under LT1
    delete W.hrz;
  }
  const sessions = list.map((a) => ({ id: a.id, d: a.date, s: a.sport, min: Math.round(a.sec / 60), km: r1(a.km), hr: a.avgHR ? Math.round(a.avgHR) : null,
    np: a.np ? Math.round(a.np) : null, indoor: a.indoor, race: a.race }));
  return { weeks, sessions };
}

// Mark planned sessions done using same-day, same-sport activities (greedy, in order).
export function matchSessions(weeks, sessions, today) {
  const byDate = {};
  for (const s of sessions) (byDate[s.d] ||= []).push({ ...s, used: false });
  for (const W of weeks) for (const d of W.days) {
    const pool = byDate[d.date] || [];
    for (const s of d.sessions) {
      if (s.sport === 'rest') continue;
      const sp = s.sport === 'tri' ? null : s.sport === 'other' ? 'other' : s.sport;
      const hit = pool.find((a) => !a.used && (sp == null || a.s === sp));
      if (hit) { hit.used = true; s.done = { min: hit.min, km: hit.km, hr: hit.hr, np: hit.np }; }
      else if (d.date < today) s.missed = true;
    }
    d.extra = pool.filter((a) => !a.used).map(({ used, ...a }) => a);
  }
}

// VO2max trend (Garmin's own estimate, per activity) and run aerobic efficiency.
export function trendsOf(acts, lt1Hr, from, today) {
  const vo2 = { run: [], bike: [] };
  for (const a of acts) if (a.vo2 && a.date >= from && (a.sport === 'run' || a.sport === 'bike')) vo2[a.sport].push({ d: a.date, v: a.vo2 });
  const dedupe = (xs) => Object.values(Object.fromEntries(xs.map((x) => [x.d, x])));
  const easy = acts.filter((a) => a.sport === 'run' && a.avgHR && lt1Hr && a.avgHR <= lt1Hr && a.km >= 3);
  const eff = [];
  for (let w = mondayOf(from); w <= mondayOf(today); w = addDays(w, 7)) {
    const end = toDay(w) + 7 * DAY, start = end - 21 * DAY;
    const xs = easy.filter((a) => toDay(a.date) >= start && toDay(a.date) < end).map((a) => (a.km * 1000) / (a.sec / 60) / a.avgHR);
    if (xs.length) eff.push({ d: w, v: Math.round(median(xs) * 1000) / 1000, n: xs.length });
  }
  return { vo2: { run: dedupe(vo2.run), bike: dedupe(vo2.bike) }, eff };
}
