// triklaus — expand plan/plan.json + plan/library.json into dated weeks and sessions, and check them.
// Pure functions, no I/O. Every number on the site traces back to here or to model.mjs.

const DAY = 864e5;
export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const toDay = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
export const fromDay = (t) => new Date(t).toISOString().slice(0, 10);
export const addDays = (s, n) => fromDay(toDay(s) + n * DAY);
export const mondayOf = (s) => { const t = toDay(s); return fromDay(t - ((new Date(t).getUTCDay() + 6) % 7) * DAY); };
export const isMonday = (s) => new Date(toDay(s)).getUTCDay() === 1;

// Load factor per week kind. i = index of this build/peak week inside its block (0, 1, 2…).
const FACTOR = { b: (i) => 1 + 0.07 * Math.min(i, 3), p: (i) => 1 + 0.07 * Math.min(i, 3), r: () => 0.6, t: () => 0.8, x: () => 0.5, race: () => 0.4 };
const TAPER = [0.8, 0.65, 0.5];
export const KIND_LABEL = { b: 'build', p: 'peak', r: 'recover', t: 'test', tp: 'taper', race: 'race', x: 'reset' };

const round5 = (m) => Math.max(5, Math.round(m / 5) * 5);

// Resolve one template entry ("id" or { id, min, set }) into a concrete session for a week of a given kind.
function sessionFor(entry, lib, kind, i, tpIdx) {
  const ref = typeof entry === 'string' ? { id: entry } : entry;
  const base = lib.sessions[ref.id];
  if (!base) throw new Error(`unknown session "${ref.id}"`);
  const s = { id: ref.id, sport: base.sport, name: base.name, zone: base.zone, key: !!base.key, test: !!base.test, race: !!base.race,
    set: base.set || '', how: base.how || '', why: base.why || '', q: base.q || 0 };
  const minBase = ref.min ?? base.min;
  const f = kind === 'tp' ? TAPER[Math.min(tpIdx, TAPER.length - 1)] : FACTOR[kind](i);

  if (base.steps && !base.test && !base.race) {
    // key session with progression
    let step;
    if (kind === 'b' || kind === 'p') step = base.steps[Math.min(i, base.steps.length - 1)];
    else if (kind === 'r' || kind === 'race' || kind === 'x') { if (base.recover === null) return null; step = base.recover || base.steps[0]; }
    else step = base.steps[0]; // test / taper: the shortest version
    s.set = step.set; s.q = step.q ?? 0;
    s.min = round5(kind === 'tp' || kind === 'r' || kind === 'race' ? minBase * Math.max(f, 0.7) : minBase);
  } else if (base.key || base.test || base.race || base.sport === 'rest') {
    s.min = minBase; // tests, races and fixed sessions are not scaled
  } else {
    s.min = minBase ? round5(minBase * f) : 0;
  }
  if (ref.fixed) s.min = ref.min;
  if (ref.set) s.set = ref.set;
  if (ref.name) s.name = ref.name;
  return s;
}

export function expandPlan(plan, lib, today) {
  const macros = plan.macros.map((m) => ({ ...m }));
  const byMacro = Object.fromEntries(macros.map((m) => [m.id, m]));
  const weeks = [];
  const mesos = plan.mesos.map((ms) => {
    const end = addDays(ms.start, ms.pattern.length * 7 - 1);
    return { ...ms, end, weeks: ms.pattern.length };
  });

  for (const ms of mesos) {
    const tpl = lib.weeks[ms.week];
    if (!tpl) throw new Error(`meso "${ms.id}": unknown week template "${ms.week}"`);
    let bi = 0, ti = 0;
    ms.pattern.forEach((kind, k) => {
      const w = addDays(ms.start, k * 7);
      const i = kind === 'b' || kind === 'p' ? bi++ : 0;
      const tpIdx = kind === 'tp' ? ti++ : ti;
      const ov = (plan.weeks || {})[w] || {};
      const days = DAYS.map((d, di) => {
        // explicit durations in a week override are taken literally; template durations scale with the week kind
        const entries = ov.days && ov.days[d] ? ov.days[d].map((e) => (typeof e === 'object' && e.min != null ? { ...e, fixed: true } : e)) : tpl[d] || [];
        return { day: d, date: addDays(w, di), sessions: entries.map((e) => sessionFor(e, lib, kind, i, tpIdx)).filter(Boolean) };
      });
      weeks.push({ w, end: addDays(w, 6), meso: ms.id, macro: ms.macro, kind, idx: k + 1, of: ms.pattern.length, note: ov.note || '', days });
    });
  }

  // derived totals per week
  for (const W of weeks) {
    const by = { swim: 0, bike: 0, run: 0, other: 0 };
    const q = {};
    let keys = 0, n = 0;
    for (const d of W.days) for (const s of d.sessions) {
      if (s.sport === 'rest') continue;
      n++;
      if (s.sport === 'tri') { by.swim += 35; by.bike += s.min * 0.53; by.run += s.min * 0.35; }
      else by[s.sport] = (by[s.sport] || 0) + s.min;
      if (s.q && !s.race) q[s.zone] = (q[s.zone] || 0) + s.q;
      if (s.key) keys++;
    }
    const total = Object.values(by).reduce((a, b) => a + b, 0);
    const hard = Object.values(q).reduce((a, b) => a + b, 0);
    W.planned = { n, h: total / 60, by: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, v / 60])), q, keys, easyShare: total ? 1 - hard / total : 1 };
  }

  for (const m of macros) {
    if (m.past) continue;
    const own = mesos.filter((x) => x.macro === m.id);
    m.start = own[0]?.start; m.end = own.at(-1)?.end;
  }
  return { macros, mesos, weeks, events: plan.events || [], byMacro };
}

// Guardrails. Errors break the build; warnings show on the site and in `npm run check`.
export function checkPlan(P, plan, lib, athlete) {
  const errors = [], warnings = [];
  const [minH, maxH] = athlete.availability?.weeklyHours || [0, 99];

  // structure
  P.mesos.forEach((m, k) => {
    if (!isMonday(m.start)) errors.push(`meso ${m.id}: start ${m.start} is not a Monday`);
    if (!P.byMacro[m.macro]) errors.push(`meso ${m.id}: unknown macro "${m.macro}"`);
    const prev = P.mesos[k - 1];
    if (prev && addDays(prev.end, 1) !== m.start) errors.push(`meso ${m.id} starts ${m.start}, but ${prev.id} ends ${prev.end} (blocks must be contiguous)`);
    for (const c of m.pattern) if (!(c in FACTOR) && c !== 'tp') errors.push(`meso ${m.id}: unknown week kind "${c}"`);
  });
  for (const w of Object.keys(plan.weeks || {})) {
    if (w.startsWith('_')) continue;
    if (!isMonday(w)) errors.push(`week override ${w} is not a Monday`);
    if (!P.weeks.find((W) => W.w === w)) warnings.push(`week override ${w} is outside every block`);
  }

  // load & recovery
  let streak = 0, lastBuild = null, sinceBuild = 0;
  for (const W of P.weeks) {
    const h = W.planned.h;
    const all = W.days.flatMap((d) => d.sessions);
    if ((W.kind === 'b' || W.kind === 'p') && (h < minH * 0.8 || h > maxH)) warnings.push(`${W.w}: ${h.toFixed(1)} h planned, outside availability ${minH}–${maxH} h`);
    if (W.kind === 'b' || W.kind === 'p') {
      // ramp vs the previous build week, only when it was recent (after a reset, volume restarts)
      if (lastBuild && sinceBuild <= 2 && h > lastBuild * 1.12) warnings.push(`${W.w}: ${Math.round((h / lastBuild - 1) * 100)}% more than the previous build week (keep ramps ≤ ~10%)`);
      lastBuild = h; sinceBuild = 0; streak++;
      if (streak > 3) warnings.push(`${W.w}: ${streak} loading weeks in a row without a recovery/test week`);
    } else { streak = 0; sinceBuild++; }
    if (W.kind === 'race') continue;
    const vo2 = all.filter((s) => s.key && (s.zone === 'VO2' || s.zone === 'VO2s') && !s.test).length;
    const keys = all.filter((s) => s.key && !s.test && !s.race && s.sport !== 'swim').length; // swim quality is cheap
    if (vo2 > 3) warnings.push(`${W.w}: ${vo2} VO2 sessions (Deckard builds toward more, but > 3 needs very good recovery)`);
    if (keys > 3) warnings.push(`${W.w}: ${keys} bike/run key sessions`);
    const mins = W.planned.h * 60;
    const hard = ['T', 'VO2', 'VO2s'].reduce((a, z) => a + (W.planned.q[z] || 0), 0);
    if (W.planned.easyShare < 0.7) warnings.push(`${W.w}: only ${Math.round(W.planned.easyShare * 100)}% of time under LT1 (keep ≥ ~70%, ~80–90% in ceiling blocks)`);
    if (mins && W.kind !== 'tp' && hard / mins > 0.12) warnings.push(`${W.w}: ${Math.round((hard / mins) * 100)}% of time at or above LT2 (keep ≤ ~10–12%)`);
    for (const d of W.days) {
      const k = d.sessions.filter((s) => s.key && !s.test).length;
      if (k > 1) warnings.push(`${d.date}: two key sessions on the same day`);
    }
  }

  // A races need a taper/race week
  for (const e of P.events) {
    if (e.past) continue;
    const W = P.weeks.find((x) => e.date >= x.w && e.date <= x.end);
    if (!W) { warnings.push(`event ${e.id} (${e.date}) is outside the plan`); continue; }
    if (e.priority === 'A' && W.kind !== 'race') warnings.push(`A race ${e.id} is in a "${W.kind}" week, expected "race"`);
  }
  return { errors, warnings };
}
