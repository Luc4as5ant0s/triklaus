#!/usr/bin/env node
// triklaus — push structured workouts to intervals.icu, which syncs them on to Garmin Connect (watch) and Zwift.
//
//   node scripts/push-workout.mjs workouts.json            create (replaces a same-name workout on the same day)
//   node scripts/push-workout.mjs workouts.json --dry-run  print what would be sent
//   node scripts/push-workout.mjs --list 2026-11-05 [2026-11-11]   planned workouts in a date range
//   node scripts/push-workout.mjs --delete <eventId>
//
// workouts.json: one object or an array of
//   { "date": "2026-11-05", "type": "Run" | "Ride" | "VirtualRide" | "Swim", "name": "Hill VO2", "text": "<intervals.icu workout text>" }
// Use type "VirtualRide" for indoor rides: that is what lands in Zwift (Workouts → Custom → Intervals.icu, next 7 days).
// Workout text syntax: https://forum.intervals.icu/t/workout-builder/1163 — e.g. "Main set 3x\n- 30s 340w\n- 15s 160w".
//
// API key: ~/.config/intervals/key (or INTERVALS_API_KEY). Never commit it.
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const BASE = 'https://intervals.icu/api/v1/athlete/0';
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const KEY = (process.env.INTERVALS_API_KEY || (await readFile(join(homedir(), '.config/intervals/key'), 'utf8').catch(() => ''))).trim();
if (!KEY) { console.error('no intervals.icu API key (~/.config/intervals/key)'); process.exit(1); }
const AUTH = 'Basic ' + Buffer.from(`API_KEY:${KEY}`).toString('base64');

async function api(method, path, body) {
  // a browser-like user agent avoids Cloudflare challenges on some clients
  const r = await fetch(BASE + path, { method, headers: { Authorization: AUTH, 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 triklaus' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → HTTP ${r.status} ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : null;
}
const mins = (s) => (!s ? '?' : s < 60 || s % 60 ? (s < 60 ? `${s}″` : `${Math.floor(s / 60)}′${s % 60}″`) : `${s / 60}′`);
const summary = (e) => `${e.start_date_local.slice(0, 10)}  ${e.type.padEnd(11)} ${mins(e.moving_time).padStart(5)}  load ${String(e.icu_training_load ?? '–').padStart(3)}  ${e.name}  (id ${e.id})`;
const countSteps = (steps = []) => steps.reduce((n, s) => n + (s.steps ? (s.reps || 1) * countSteps(s.steps) : 1), 0);

if (flag('list')) {
  const from = args[args.indexOf('--list') + 1], to = args[args.indexOf('--list') + 2]?.match(/^\d{4}-/) ? args[args.indexOf('--list') + 2] : from;
  const evs = await api('GET', `/events?oldest=${from}&newest=${to}`);
  for (const e of evs.filter((x) => x.category === 'WORKOUT')) console.log(summary(e));
  process.exit(0);
}
if (flag('show')) {
  const e = await api('GET', `/events/${args[args.indexOf('--show') + 1]}`);
  console.log(summary(e));
  const sync = Object.fromEntries(Object.entries(e).filter(([k, v]) => /garmin|zwift|upload|external|indoor/i.test(k) && v != null));
  console.log('  sync fields:', JSON.stringify(sync));
  const show = (steps, ind = '  ') => { for (const s of steps || []) {
    if (s.steps) { console.log(`${ind}${s.reps}x`); show(s.steps, ind + '  '); continue; }
    const t = ['power', 'hr', 'pace', 'cadence'].filter((k) => s[k]).map((k) => `${k} ${JSON.stringify(s[k])}`).join(' ');
    console.log(`${ind}- ${mins(s.duration)}${s.ramp ? ' ramp' : ''} ${t || '(no target)'}${s.text ? `  "${s.text}"` : ''}`);
  } };
  show(e.workout_doc?.steps);
  process.exit(0);
}
if (flag('delete')) {
  const id = args[args.indexOf('--delete') + 1];
  await api('DELETE', `/events/${id}`); console.log('deleted', id); process.exit(0);
}

const file = args.find((a) => !a.startsWith('--'));
if (!file) { console.error('usage: push-workout.mjs workouts.json [--dry-run]'); process.exit(1); }
let list = JSON.parse(await readFile(file, 'utf8'));
if (!Array.isArray(list)) list = [list];

for (const w of list) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(w.date) || !w.type || !w.name || !w.text) throw new Error(`bad workout: ${JSON.stringify(w).slice(0, 120)}`);
  const body = { category: 'WORKOUT', start_date_local: `${w.date}T00:00:00`, type: w.type, name: w.name, description: w.text.trim() };
  if (flag('dry-run')) { console.log(`--- ${w.date} ${w.type} ${w.name}\n${body.description}\n`); continue; }
  // replace a previous push of the same workout instead of duplicating it
  const same = (await api('GET', `/events?oldest=${w.date}&newest=${w.date}`)).filter((e) => e.category === 'WORKOUT' && e.name === w.name);
  for (const e of same) await api('DELETE', `/events/${e.id}`);
  const created = await api('POST', '/events', body);
  const back = await api('GET', `/events/${created.id}`);
  const steps = countSteps(back.workout_doc?.steps);
  console.log(`${same.length ? '↻' : '+'} ${summary(back)}  · ${steps} steps parsed`);
  if (!steps) console.log('  ⚠ intervals.icu parsed no steps from the text: check the syntax');
}
