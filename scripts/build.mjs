#!/usr/bin/env node
// triklaus — build dist/index.html from plan/ + config/ + data/raw/garmin (no dependencies).
// Works without Garmin data too (plan only), so the plan can be previewed right after editing it.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expandPlan, checkPlan, mondayOf } from './lib/plan.mjs';
import { normalise, profileOf, readProfile, zonesOf, actualsOf, matchSessions, trendsOf } from './lib/model.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rj = async (p, d) => { try { return JSON.parse(await readFile(join(ROOT, p), 'utf8')); } catch (e) { if (d === undefined) throw e; return d; } };
const rt = async (p, d = '') => { try { return await readFile(join(ROOT, p), 'utf8'); } catch { return d; } };
const today = process.env.TRIKLAUS_TODAY || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

const athlete = await rj('config/athlete.json');
const plan = await rj('plan/plan.json');
const lib = await rj('plan/library.json');
const raw = await rj('data/raw/garmin/activities.json', []);
const zonesRaw = await rj('data/raw/garmin/hr-zones.json', []);
const gprofile = await rj('data/raw/garmin/profile.json', null);
const meta = await rj('data/raw/garmin/meta.json', null);

const P = expandPlan(plan, lib, today);
const check = checkPlan(P, plan, lib, athlete);
if (check.errors.length) { console.error('plan errors:\n  ' + check.errors.join('\n  ')); process.exit(1); }

const acts = normalise(raw);
const profile = profileOf(acts, athlete, zonesRaw, gprofile, today);
const from = athlete.historyStart || P.macros[0].start;
const actual = actualsOf(acts, from, today);
matchSessions(P.weeks, actual.sessions, today);

// History weeks (before the plan starts) exist only as actuals.
const firstPlanned = P.weeks[0].w;
const history = [];
for (let w = mondayOf(from); w < firstPlanned; ) {
  history.push({ w, end: null, meso: null, macro: P.macros.find((m) => m.past && w >= m.start && w <= m.end)?.id || null, kind: 'h', days: [] });
  const t = new Date(w + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + 7); w = t.toISOString().slice(0, 10);
}
const weeks = [...history, ...P.weeks].map((W) => ({ ...W, actual: actual.weeks[W.w] || null }));

// decisions.md → entries (## heading = date + title, body = markdown-lite)
const decisions = (await rt('plan/decisions.md')).split(/^## /m).slice(1).map((chunk) => {
  const [head, ...body] = chunk.split('\n');
  return { head: head.trim(), body: body.join('\n').trim() };
});

const data = {
  today, generatedAt: new Date().toISOString(),
  athlete: { name: athlete.name, city: athlete.city, availability: athlete.availability },
  profile, reading: readProfile(profile), zones: zonesOf(profile),
  events: P.events, macros: P.macros, mesos: P.mesos, weeks,
  trends: trendsOf(acts, profile.run.lt1Hr, from, today),
  sessions: actual.sessions.slice(-400),
  warnings: check.warnings, decisions,
  sync: meta ? { at: meta.syncedAt, n: acts.length } : null,
};

const [tpl, css, js] = await Promise.all([rt('site/index.html'), rt('site/style.css'), rt('site/app.js')]);
const json = JSON.stringify(data).replace(/</g, '\\u003c');
const html = tpl.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js).replace('"__DATA__"', () => json);
await mkdir(join(ROOT, 'dist'), { recursive: true });
await writeFile(join(ROOT, 'dist', 'index.html'), html);
console.log(`[build] dist/index.html · ${P.weeks.length} planned weeks · ${acts.length} activities · ${check.warnings.length} warnings · today ${today}`);
