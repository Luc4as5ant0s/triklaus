#!/usr/bin/env node
// triklaus — training history summary (aggregates only), used to calibrate the plan to what Lucas has actually done.
//   node scripts/history.mjs            (needs data/raw/garmin/activities.json)
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalise } from './lib/model.mjs';
import { mondayOf, addDays } from './lib/plan.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const raw = JSON.parse(await readFile(join(ROOT, 'data/raw/garmin/activities.json'), 'utf8'));
const acts = normalise(raw);
const f1 = (x) => (Math.round(x * 10) / 10).toFixed(1);
const hm = (s) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(Math.round(s % 60)).padStart(2, '0')}`;

// weeks
const W = {};
for (const a of acts) {
  const w = mondayOf(a.date);
  const x = (W[w] ||= { w, h: 0, swim: 0, bike: 0, run: 0, other: 0, n: { swim: 0, bike: 0, run: 0, other: 0 }, runKm: 0, longRun: 0, longRide: 0 });
  x.h += a.sec / 3600; x[a.sport] += a.sec / 3600; x.n[a.sport]++;
  if (a.sport === 'run') { x.runKm += a.km; x.longRun = Math.max(x.longRun, a.sec / 60); }
  if (a.sport === 'bike') x.longRide = Math.max(x.longRide, a.sec / 60);
}
const first = mondayOf(acts[0].date), last = mondayOf(acts.at(-1).date);
const weeks = [];
for (let w = first; w <= last; w = addDays(w, 7)) weeks.push(W[w] || { w, h: 0, swim: 0, bike: 0, run: 0, other: 0, n: { swim: 0, bike: 0, run: 0, other: 0 }, runKm: 0, longRun: 0, longRide: 0 });

console.log(`activities ${acts.length}, ${first} → ${last}, ${weeks.length} weeks\n`);
console.log('== per quarter: avg h/wk (swim/bike/run) · max week · avg sessions/wk (sw/bk/rn/other) · run km/wk');
const q = {};
for (const x of weeks) { const k = `${x.w.slice(0, 4)}Q${Math.floor((+x.w.slice(5, 7) - 1) / 3) + 1}`; (q[k] ||= []).push(x); }
for (const [k, xs] of Object.entries(q)) {
  const avg = (f) => xs.reduce((s, x) => s + f(x), 0) / xs.length;
  console.log(`${k}  ${f1(avg((x) => x.h)).padStart(5)} h (${f1(avg((x) => x.swim))}/${f1(avg((x) => x.bike))}/${f1(avg((x) => x.run))})  max ${f1(Math.max(...xs.map((x) => x.h))).padStart(5)}  ses ${f1(avg((x) => x.n.swim))}/${f1(avg((x) => x.n.bike))}/${f1(avg((x) => x.n.run))}/${f1(avg((x) => x.n.other))}  run ${f1(avg((x) => x.runKm))} km`);
}

console.log('\n== best rolling 4-week and 8-week average h/wk');
for (const n of [4, 8, 12]) {
  let best = 0, at = null;
  for (let i = n - 1; i < weeks.length; i++) { const s = weeks.slice(i - n + 1, i + 1).reduce((a, x) => a + x.h, 0) / n; if (s > best) { best = s; at = weeks[i - n + 1].w; } }
  console.log(`${n} wk: ${f1(best)} h/wk from ${at}`);
}

console.log('\n== top 12 weeks');
for (const x of [...weeks].sort((a, b) => b.h - a.h).slice(0, 12))
  console.log(`${x.w} ${f1(x.h).padStart(5)} h  sw ${f1(x.swim)} bk ${f1(x.bike)} rn ${f1(x.run)} (${f1(x.runKm)} km)  n ${x.n.swim}/${x.n.bike}/${x.n.run}/${x.n.other}  long run ${Math.round(x.longRun)}′ ride ${Math.round(x.longRide)}′`);

console.log('\n== last 26 weeks');
for (const x of weeks.slice(-26))
  console.log(`${x.w} ${f1(x.h).padStart(5)} h  sw ${f1(x.swim)} bk ${f1(x.bike)} rn ${f1(x.run)} (${f1(x.runKm)} km)  n ${x.n.swim}/${x.n.bike}/${x.n.run}/${x.n.other}  long run ${Math.round(x.longRun)}′ ride ${Math.round(x.longRide)}′`);

console.log('\n== races and multisport events');
const parents = raw.filter((a) => a.isParent || /multi_sport|triathlon/i.test(a.activityType?.typeKey || '') || a.eventType?.typeKey === 'race');
for (const a of parents.sort((x, y) => (x.startTimeLocal < y.startTimeLocal ? -1 : 1)))
  console.log(`${a.startTimeLocal?.slice(0, 10)}  ${a.activityType?.typeKey}  ${a.eventType?.typeKey || ''}  ${hm(a.duration || 0)}  ${f1((a.distance || 0) / 1000)} km  HR ${Math.round(a.averageHR || 0)}  NP ${a.normPower || '-'}  "${(a.activityName || '').slice(0, 40)}"`);

console.log('\n== long sessions: runs ≥ 2h, rides ≥ 4h (last 18 months)');
const cut = addDays(last, -548);
for (const a of acts.filter((a) => a.date >= cut && ((a.sport === 'run' && a.sec >= 7200) || (a.sport === 'bike' && a.sec >= 14400))))
  console.log(`${a.date} ${a.sport} ${hm(a.sec)} ${f1(a.km)} km HR ${Math.round(a.avgHR || 0)} NP ${a.np || '-'}`);
