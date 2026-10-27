#!/usr/bin/env node
// triklaus — validate the plan and print a compact summary. Run after every plan edit.
//   node scripts/check.mjs            summary + warnings
//   node scripts/check.mjs --weeks    also one line per week (hours, key sessions, easy share)
//   node scripts/check.mjs --week 2026-11-09   full detail of one week
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expandPlan, checkPlan, mondayOf, KIND_LABEL } from './lib/plan.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rj = async (p) => JSON.parse(await readFile(join(ROOT, p), 'utf8'));
const today = process.env.TRIKLAUS_TODAY || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const args = process.argv.slice(2);

const [athlete, plan, lib] = await Promise.all([rj('config/athlete.json'), rj('plan/plan.json'), rj('plan/library.json')]);
let P;
try { P = expandPlan(plan, lib, today); } catch (e) { console.error('✗', e.message); process.exit(1); }
const { errors, warnings } = checkPlan(P, plan, lib, athlete);
const h = (x) => x.toFixed(1).padStart(4);

for (const m of P.macros) {
  console.log(`\n■ ${m.name}  ${m.start} → ${m.end}${m.goal ? `  · ${m.goal}` : ''}`);
  for (const ms of P.mesos.filter((x) => x.macro === m.id)) {
    const ws = P.weeks.filter((W) => W.meso === ms.id);
    const hrs = ws.map((W) => W.planned.h);
    console.log(`  ├ ${ms.name.padEnd(32)} ${ms.start} ${String(ms.weeks).padStart(2)}w [${ms.pattern.join(' ')}] ${Math.min(...hrs).toFixed(0)}–${Math.max(...hrs).toFixed(0)} h  ${ms.week}`);
    if (args.includes('--weeks')) for (const W of ws) {
      const keys = W.days.flatMap((d) => d.sessions).filter((s) => s.key).map((s) => s.name).join(', ');
      console.log(`  │   ${W.w} ${KIND_LABEL[W.kind].padEnd(7)} ${h(W.planned.h)} h  easy ${Math.round(W.planned.easyShare * 100)}%  ${keys}`);
    }
  }
}
for (const e of P.events) console.log(`\n◎ ${e.priority} ${e.date} ${e.name}${e.tentative ? ' (tentative)' : ''}`);

const wi = args.indexOf('--week');
if (wi >= 0) {
  const W = P.weeks.find((x) => x.w === mondayOf(args[wi + 1]));
  if (!W) console.log('\nno such week');
  else {
    console.log(`\n▸ ${W.w} · ${W.meso} wk ${W.idx}/${W.of} (${KIND_LABEL[W.kind]}) · ${W.planned.h.toFixed(1)} h${W.note ? `\n  ${W.note}` : ''}`);
    for (const d of W.days) for (const s of d.sessions) console.log(`  ${d.day} ${s.sport.padEnd(5)} ${String(s.min).padStart(3)}′ ${s.key ? '★' : ' '} ${s.name} — ${s.set}`);
  }
}

console.log('');
for (const w of warnings) console.log('⚠', w);
for (const e of errors) console.log('✗', e);
console.log(errors.length ? `\n✗ ${errors.length} errors` : `\n✓ plan ok (${warnings.length} warnings)`);
process.exit(errors.length ? 1 : 0);
