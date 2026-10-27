// triklaus — curate raw Garmin activities into the public site model.
// Everything here is transparent on purpose: each number on the site is computed below.
// Only aggregates leave this file — no GPS, no names, no device IDs.

const DAY = 864e5;
export const SPORTS = ['swim', 'bike', 'run'];

export function sportOf(typeKey = '') {
  const k = typeKey.toLowerCase();
  if (k.includes('swim')) return 'swim';
  if (k.includes('cycl') || k.includes('ride') || k.includes('bik')) return 'bike';
  if (k.includes('run') || k.includes('trail')) return 'run';
  return 'other';
}

const dateOf = (local) => local.slice(0, 10); // "YYYY-MM-DD HH:MM:SS" → local date
const toDay = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const fromDay = (t) => new Date(t).toISOString().slice(0, 10);
export const mondayOf = (s) => { const t = toDay(s); const dow = (new Date(t).getUTCDay() + 6) % 7; return fromDay(t - dow * DAY); };
const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);

// ---- thresholds: configured, or estimated from the data (and flagged as such) ----
export function thresholds(acts, athlete, zones, today) {
  const recent = acts.filter((a) => toDay(a.date) >= toDay(today) - 42 * DAY);
  const est = {};
  let ftp = athlete.ftp;
  if (!ftp) {
    // Garmin summaries carry the power curve up to 10 min; FTP ≈ 90% of best 10-min power
    const best10 = Math.max(0, ...recent.filter((a) => a.sport === 'bike').map((a) => a.p10 || 0));
    ftp = best10 ? Math.round(best10 * 0.9) : 200;
    est.ftp = best10 ? '90% × best 10 min (42 d)' : 'default';
  }
  let lthr = athlete.lthr;
  if (!lthr) {
    const z = (zones || []).find((z) => z.sport === 'RUNNING') || (zones || []).find((z) => z.sport === 'DEFAULT');
    lthr = z?.lactateThresholdHeartRateUsed || (z?.maxHeartRateUsed ? Math.round(z.maxHeartRateUsed * 0.89) : 170);
    est.lthr = z?.lactateThresholdHeartRateUsed ? 'Garmin HR zones' : '89% × max HR';
  }
  let css = athlete.cssPer100m; // seconds per 100 m
  if (!css) {
    const paces = recent.filter((a) => a.sport === 'swim' && a.km > 0.4).map((a) => a.sec / (a.km * 10));
    const best = paces.sort((a, b) => a - b).slice(0, 3);
    css = best.length ? Math.round(median(best)) : 120;
    est.css = best.length ? 'median of 3 fastest swims (42 d)' : 'default';
  }
  let easyHr = athlete.easyHrCeiling;
  if (!easyHr) { easyHr = Math.round(lthr * 0.85); est.easyHr = '85% × LTHR'; }
  return { ftp, lthr, css, easyHr, est };
}

// ---- load per activity: hours × IF² × 100 (swim: IF³) ----
function loadOf(a, t) {
  const h = a.sec / 3600;
  let IF = null, basis = null;
  if (a.sport === 'bike' && (a.np || a.avgPower)) { IF = (a.np || a.avgPower) / t.ftp; basis = a.np ? 'NP/FTP' : 'avgP/FTP'; }
  else if (a.sport === 'swim' && a.km > 0) { IF = t.css / (a.sec / (a.km * 10)); return { load: h * IF ** 3 * 100, IF, basis: 'CSS/pace' }; }
  else if (a.avgHR) { IF = a.avgHR / t.lthr; basis = 'HR/LTHR'; }
  if (IF == null) return { load: h * 0.5 ** 2 * 100, IF: null, basis: 'default' };
  return { load: h * IF ** 2 * 100, IF, basis };
}

export function buildModel({ raw, athlete, blocks, zones, today }) {
  // 1. normalise (skip multisport parents — their legs come through as children)
  const acts = raw
    .filter((a) => !(a.isParent || a.parent))
    .map((a) => ({
      id: a.activityId,
      date: dateOf(a.startTimeLocal),
      sport: sportOf(a.activityType?.typeKey),
      type: a.activityType?.typeKey,
      indoor: /indoor|virtual|treadmill|lap_swim/.test(a.activityType?.typeKey || ''),
      race: a.eventType?.typeKey === 'race',
      sec: a.movingDuration || a.duration || 0,
      km: (a.distance || 0) / 1000,
      elev: a.elevationGain || 0,
      avgHR: a.averageHR || null,
      avgPower: a.avgPower || null,
      np: a.normPower || null,
      p10: a.maxAvgPower_600 || null,
      curve: [1, 5, 30, 60, 120, 300, 600].map((s) => a[`maxAvgPower_${s}`] || null),
      garminLoad: a.activityTrainingLoad || null,
    }))
    .filter((a) => a.sec > 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const t = thresholds(acts, athlete, zones, today);
  for (const a of acts) Object.assign(a, loadOf(a, t));

  // 2. daily load → capacity (42 d EWMA), fatigue (7 d EWMA), readiness = capacity − fatigue
  const first = acts.length ? acts[0].date : today;
  const daily = new Map();
  for (const a of acts) daily.set(a.date, (daily.get(a.date) || 0) + a.load);
  const series = [];
  let ctl = 0, atl = 0;
  for (let d = toDay(first); d <= toDay(today); d += DAY) {
    const k = fromDay(d), L = daily.get(k) || 0;
    ctl += (L - ctl) / 42; atl += (L - atl) / 7;
    series.push({ d: k, load: Math.round(L), cap: r1(ctl), fat: r1(atl), ready: r1(ctl - atl) });
  }

  // 3. weeks
  const weeks = new Map();
  for (const a of acts) {
    const w = mondayOf(a.date);
    if (!weeks.has(w)) weeks.set(w, { w, swim: { h: 0, km: 0, n: 0 }, bike: { h: 0, km: 0, n: 0 }, run: { h: 0, km: 0, n: 0 }, other: { h: 0, km: 0, n: 0 }, load: 0, longRun: 0 });
    const W = weeks.get(w), s = W[a.sport];
    s.h += a.sec / 3600; s.km += a.km; s.n++; W.load += a.load;
    if (a.sport === 'run') W.longRun = Math.max(W.longRun, a.km);
  }
  const weekList = [...weeks.values()].sort((a, b) => (a.w < b.w ? -1 : 1)).map((W) => {
    for (const s of [...SPORTS, 'other']) { W[s].h = r1(W[s].h); W[s].km = r1(W[s].km); }
    W.load = Math.round(W.load); W.longRun = r1(W.longRun); return W;
  });

  // 4. run aerobic efficiency: (m/min)/avgHR on easy runs, rolling 3-week median
  const easyRuns = acts.filter((a) => a.sport === 'run' && a.avgHR && a.avgHR <= t.easyHr && a.km >= 3);
  const eff = [];
  for (const W of weekList) {
    const end = toDay(W.w) + 7 * DAY, start = end - 21 * DAY;
    const xs = easyRuns.filter((a) => toDay(a.date) >= start && toDay(a.date) < end).map((a) => (a.km * 1000 / (a.sec / 60)) / a.avgHR);
    if (xs.length) eff.push({ w: W.w, v: Math.round(median(xs) * 1000) / 1000, n: xs.length });
  }

  // 5. bike power curve: best of last 42 days vs season
  const durs = [1, 5, 30, 60, 120, 300, 600];
  const bestCurve = (list) => durs.map((_, i) => Math.max(0, ...list.map((a) => a.curve[i] || 0)) || null);
  const bikes = acts.filter((a) => a.sport === 'bike');
  const powerCurve = { durs, recent: bestCurve(bikes.filter((a) => toDay(a.date) >= toDay(today) - 42 * DAY)), season: bestCurve(bikes.filter((a) => a.date >= athlete.seasonStart)) };

  // 6. blocks + gateway evaluation
  const capOn = (d) => (series.find((s) => s.d === d) || series.at(-1) || { cap: 0 }).cap;
  const blockList = blocks.map((b) => {
    const inB = acts.filter((a) => a.date >= b.start && a.date <= b.end);
    const wk = weekList.filter((W) => W.w >= mondayOf(b.start) && W.w <= b.end);
    const evalDate = today < b.end ? today : b.end;
    const metrics = {
      run_long_km: r1(Math.max(0, ...inB.filter((a) => a.sport === 'run').map((a) => a.km))),
      run_week_km: r1(Math.max(0, ...wk.map((W) => W.run.km))),
      bike_week_h: r1(Math.max(0, ...wk.map((W) => W.bike.h))),
      swim_week_km: r1(Math.max(0, ...wk.map((W) => W.swim.km))),
      capacity: capOn(evalDate),
    };
    const c = b.criterion;
    const val = c ? metrics[c.metric] : null;
    const pass = c && val != null ? (c.op === '<=' ? val <= c.value : val >= c.value) : null;
    const state = today < b.start ? 'future' : today > b.end ? 'done' : 'active';
    return { ...b, state, metrics, gateway: c ? { ...c, actual: val, pass } : null,
      totals: { h: r1(inB.reduce((s, a) => s + a.sec, 0) / 3600), n: inB.length, load: Math.round(inB.reduce((s, a) => s + a.load, 0)) } };
  });

  // 7. season totals
  const season = acts.filter((a) => a.date >= athlete.seasonStart);
  const tot = Object.fromEntries(SPORTS.map((s) => {
    const xs = season.filter((a) => a.sport === s);
    return [s, { h: r1(xs.reduce((x, a) => x + a.sec, 0) / 3600), km: r1(xs.reduce((x, a) => x + a.km, 0)), n: xs.length }];
  }));

  const recentActs = acts.slice(-12).reverse().map((a) => ({
    date: a.date, sport: a.sport, type: a.type, indoor: a.indoor, race: a.race,
    min: Math.round(a.sec / 60), km: r1(a.km), avgHR: a.avgHR, np: a.np, load: Math.round(a.load), basis: a.basis,
  }));

  return {
    generatedAt: new Date().toISOString(), today,
    athlete: { name: athlete.name, city: athlete.city, goal: athlete.goal, seasonStart: athlete.seasonStart, stravaUrl: athlete.stravaUrl },
    thresholds: t, series, weeks: weekList, efficiency: eff, powerCurve, blocks: blockList, totals: tot,
    recent: recentActs, counts: { all: acts.length, season: season.length, since: acts[0]?.date || null },
  };
}
