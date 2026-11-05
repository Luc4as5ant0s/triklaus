#!/usr/bin/env node
// triklaus — coach briefing from intervals.icu: what was done, how it went, how he's recovering, what's planned.
// Read this at the start of every coaching conversation (see CLAUDE.md → Coaching).
//
//   node scripts/coach-data.mjs              last 14 days + next 7
//   node scripts/coach-data.mjs --days 42    longer look back (trends)
//   node scripts/coach-data.mjs --json       raw-ish JSON instead of the text report
//
// API key: INTERVALS_API_KEY or ~/.config/intervals/key.
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? Number(args[i + 1]) : d; };
const DAYS = opt('days', 14);
const KEY = (process.env.INTERVALS_API_KEY || (await readFile(join(homedir(), '.config/intervals/key'), 'utf8').catch(() => ''))).trim();
if (!KEY) { console.error('no intervals.icu API key (INTERVALS_API_KEY or ~/.config/intervals/key)'); process.exit(1); }
const AUTH = 'Basic ' + Buffer.from(`API_KEY:${KEY}`).toString('base64');
const api = async (path) => {
  const r = await fetch('https://intervals.icu/api/v1/athlete/0' + path, { headers: { Authorization: AUTH, 'User-Agent': 'Mozilla/5.0 triklaus' } });
  if (!r.ok) throw new Error(`GET ${path} → HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
};

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const shift = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const from = shift(today, -DAYS), to = shift(today, 7);

const [acts, well, events] = await Promise.all([
  api(`/activities?oldest=${from}&newest=${today}`),
  api(`/wellness?oldest=${from}&newest=${today}`),
  api(`/events?oldest=${from}&newest=${to}`),
]);

if (args.includes('--json')) { console.log(JSON.stringify({ today, acts, well, events }, null, 1)); process.exit(0); }

const n = (x, d = 0) => (x == null || Number.isNaN(x) ? '–' : Number(x).toFixed(d));
const hm = (s) => (s ? `${Math.floor(s / 3600)}h${String(Math.round((s % 3600) / 60)).padStart(2, '0')}` : '–');
const pace = (mps) => (mps ? `${Math.floor(1000 / mps / 60)}:${String(Math.round((1000 / mps) % 60)).padStart(2, '0')}/km` : '');

console.log(`# Coach briefing · ${today} · last ${DAYS} d, next 7 d\n`);

console.log('## Activities (done)');
console.log('date        type          time   load  IF    EF     decpl  avgHR  power/pace           RPE feel  name');
for (const a of [...acts].sort((x, y) => (x.start_date_local < y.start_date_local ? -1 : 1))) {
  const pw = a.icu_weighted_avg_watts || a.icu_average_watts;
  const pp = pw ? `${pw} W NP` : pace(a.average_speed);
  console.log([a.start_date_local.slice(0, 10), (a.type || '').padEnd(12), hm(a.moving_time).padStart(6), n(a.icu_training_load).padStart(5),
    n(a.icu_intensity != null ? a.icu_intensity / 100 : null, 2).padStart(5), n(a.icu_efficiency_factor, 2).padStart(6), (a.decoupling != null ? n(a.decoupling, 1) + '%' : '–').padStart(6),
    n(a.average_heartrate).padStart(6), pp.padEnd(20), n(a.icu_rpe).padStart(3), n(a.feel).padStart(5), (a.name || '').slice(0, 40)].join(' '));
}
if (!acts.length) console.log('(none: if the history is missing, import it in intervals.icu → Settings → Garmin)');

console.log('\n## Recovery (wellness)');
console.log('date        HRV   RHR  sleep  score  fitness fatigue form   notes');
for (const w of well) {
  const form = w.ctl != null && w.atl != null ? w.ctl - w.atl : null;
  const subj = ['soreness', 'fatigue', 'stress', 'mood', 'motivation', 'injury'].filter((k) => w[k] != null).map((k) => `${k} ${w[k]}`).join(', ');
  console.log([w.id, n(w.hrv).padStart(4), n(w.restingHR).padStart(4), hm(w.sleepSecs).padStart(6), n(w.sleepScore).padStart(6),
    n(w.ctl, 1).padStart(8), n(w.atl, 1).padStart(7), n(form, 1).padStart(5), ' ' + subj].join(' '));
}
const hrvs = well.map((w) => w.hrv).filter(Boolean);
if (hrvs.length >= 7) {
  const last7 = hrvs.slice(-7), base = hrvs.slice(0, -7);
  const avg = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
  console.log(`HRV 7-d mean ${n(avg(last7), 1)}${base.length ? ` vs earlier ${n(avg(base), 1)}` : ''}`);
}

console.log('\n## Planned workouts (intervals.icu calendar → Garmin / Zwift)');
const doneDays = new Set(acts.map((a) => a.start_date_local.slice(0, 10) + (a.type || '').replace('Virtual', '')));
for (const e of events.filter((x) => x.category === 'WORKOUT').sort((x, y) => (x.start_date_local < y.start_date_local ? -1 : 1))) {
  const d = e.start_date_local.slice(0, 10);
  const status = d > today ? 'upcoming' : doneDays.has(d + (e.type || '').replace('Virtual', '')) ? 'done' : d === today ? 'today' : 'missed?';
  console.log(`${d}  ${(e.type || '').padEnd(12)} ${hm(e.moving_time).padStart(6)}  ${status.padEnd(8)} ${e.name}`);
}
const notes = events.filter((x) => x.category === 'NOTE');
if (notes.length) { console.log('\n## Notes on the calendar'); for (const e of notes) console.log(`${e.start_date_local.slice(0, 10)}  ${e.name}: ${(e.description || '').slice(0, 200)}`); }
