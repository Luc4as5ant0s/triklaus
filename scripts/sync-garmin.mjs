#!/usr/bin/env node
// triklaus — Garmin Connect Personal API sync (no dependencies, Node >= 18).
//
//   GARMIN_API_KEY=... node scripts/sync-garmin.mjs            # incremental
//   GARMIN_API_KEY=... node scripts/sync-garmin.mjs --full     # whole history
//   flags: --fit (also download .FIT files)  --fit-limit=N (default 150 per run)
//          --wellness (HRV + sleep)  --days=N (wellness lookback, default 60; --full uses 400)
//   Raw data contains GPS + health data: keep it OUT of a public repo (the workflow uses the Actions cache).
//
// Writes to data/raw/garmin/:
//   activities.json        all activity summaries, keyed by activityId (newest first)
//   fit/<activityId>.zip   original device file (GPS, HR, power, cadence, laps…)
//   hrv.json, sleep.json   daily summaries keyed by calendarDate
//   hr-zones.json, profile.json
//   meta.json              last sync info

import { mkdir, readFile, writeFile, rename, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data', 'raw', 'garmin');
const BASE = process.env.GARMIN_BASE || 'https://personal.connectapi.garmin.com';
const KEY = process.env.GARMIN_API_KEY;

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? Number(a.split('=')[1]) : d; };
const FULL = flag('full');
const FIT = flag('fit');
const WELLNESS = flag('wellness');
const FIT_LIMIT = opt('fit-limit', 150);
const DAYS = opt('days', FULL ? 400 : 60);
const OVERLAP_DAYS = 3; // re-fetch recent activities so edits (name, type) are picked up

if (!KEY) { console.error('GARMIN_API_KEY is not set'); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 864e5);
const log = (...m) => console.log('[garmin]', ...m);

async function exists(p) { try { await access(p); return true; } catch { return false; } }
async function readJson(p, fallback) { try { return JSON.parse(await readFile(p, 'utf8')); } catch { return fallback; } }
async function writeAtomic(p, data) {
  await mkdir(dirname(p), { recursive: true });
  const tmp = `${p}.tmp`;
  await writeFile(tmp, typeof data === 'string' || data instanceof Uint8Array ? data : JSON.stringify(data, null, 2));
  await rename(tmp, p);
}

// ---- auth: key -> 24h access token (no refresh tokens; just ask again) ----
async function getToken() {
  // Note: sending "Accept: application/json" returns 406. The token comes back as text/plain (a JWT).
  const r = await fetch(`${BASE}/personalapitoken-service/personal-api/personal-api-key/token`, {
    method: 'POST', headers: { Authorization: `ApiKey ${KEY}` },
  });
  const body = await r.text();
  if (!r.ok) throw new Error(`token request failed: HTTP ${r.status} ${body.slice(0, 200)}`);
  const token = body.trim().replace(/^"|"$/g, '');
  try {
    const { exp } = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    log(`token ok, expires ${new Date(exp * 1000).toISOString()}`);
  } catch { /* not fatal */ }
  return token;
}

let TOKEN;
async function api(path, { binary = false, tries = 5 } = {}) {
  for (let i = 1; ; i++) {
    const r = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (r.ok) return binary ? new Uint8Array(await r.arrayBuffer()) : r.json();
    if (r.status === 401 && i === 1) { TOKEN = await getToken(); continue; }
    if ((r.status === 429 || r.status >= 500) && i < tries) {
      const wait = Number(r.headers.get('retry-after')) * 1000 || 2 ** i * 1000;
      log(`HTTP ${r.status} on ${path}, retry in ${wait / 1000}s`);
      await sleep(wait); continue;
    }
    if (r.status === 404 || r.status === 204) return null;
    throw new Error(`GET ${path} -> HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  }
}

// ---- activities ----
async function syncActivities() {
  const file = join(OUT, 'activities.json');
  const known = new Map((await readJson(file, [])).map((a) => [a.activityId, a]));
  const newestKnown = [...known.values()].reduce((m, a) => (a.startTimeGMT > m ? a.startTimeGMT : m), '');
  const cutoff = FULL || !newestKnown ? '' : iso(addDays(new Date(newestKnown.replace(' ', 'T') + 'Z'), -OVERLAP_DAYS));

  let added = 0, updated = 0;
  for (let start = 0; ; start += 100) {
    const q = new URLSearchParams({ start, limit: 100, sortOrder: 'desc', excludeChildren: 'false' });
    if (cutoff) q.set('startDate', cutoff);
    const page = (await api(`/activitylist-service/activities/search/activities?${q}`)) || [];
    for (const a of page) { known.has(a.activityId) ? updated++ : added++; known.set(a.activityId, a); }
    if (page.length < 100) break;
    await sleep(300);
  }
  const all = [...known.values()].sort((a, b) => (a.startTimeGMT < b.startTimeGMT ? 1 : -1));
  await writeAtomic(file, all);
  log(`activities: ${all.length} total (+${added} new, ${updated} refreshed)`);
  return all;
}

async function syncFitFiles(activities) {
  if (!FIT) return;
  let n = 0;
  for (const a of activities) {
    if (n >= FIT_LIMIT) { log(`fit: hit --fit-limit=${FIT_LIMIT}, rest next run`); break; }
    if (a.isManualActivity || a.manualActivity) continue;
    const p = join(OUT, 'fit', `${a.activityId}.zip`);
    if (await exists(p)) continue;
    const bin = await api(`/download-service/files/activity/${a.activityId}`, { binary: true });
    if (bin) { await writeAtomic(p, bin); n++; }
    await sleep(400);
  }
  log(`fit: ${n} downloaded`);
}

// ---- wellness (date-range endpoints, chunked) ----
async function byDateChunks(file, days, chunk, fetchChunk) {
  const store = await readJson(join(OUT, file), {});
  const today = new Date();
  for (let from = addDays(today, -days); from <= today; from = addDays(from, chunk)) {
    const to = addDays(from, chunk - 1) > today ? today : addDays(from, chunk - 1);
    for (const row of (await fetchChunk(iso(from), iso(to))) || []) {
      const d = row.calendarDate || row.dailySleepDTO?.calendarDate;
      if (d) store[d] = row;
    }
    await sleep(300);
  }
  await writeAtomic(join(OUT, file), store);
  log(`${file}: ${Object.keys(store).length} days`);
}

async function main() {
  TOKEN = await getToken();
  const activities = await syncActivities();
  await syncFitFiles(activities);

  if (WELLNESS) {
  await byDateChunks('hrv.json', DAYS, 28, async (f, t) => (await api(`/hrv-service/hrv/daily/${f}/${t}`))?.hrvSummaries);
  await byDateChunks('sleep.json', DAYS, 31, async (f, t) => {
    const r = await api(`/sleep-service/sleep/dailySleepSummariesByDate?startDate=${f}&endDate=${t}`);
    return Array.isArray(r) ? r : r?.dailySleepSummaries || r?.sleepSummaries || [];
  });
  }

  await writeAtomic(join(OUT, 'hr-zones.json'), await api('/biometric-service/heartRateZones/v2?generateDefaults=false'));
  await writeAtomic(join(OUT, 'profile.json'), await api('/userprofile-service/userprofile/settings'));
  await writeAtomic(join(OUT, 'meta.json'), { source: 'garmin-personal-api', syncedAt: new Date().toISOString(), full: FULL, activities: activities.length });
  log('done');
}

main().catch((e) => { console.error('[garmin] FAILED:', e.message); process.exit(1); });
