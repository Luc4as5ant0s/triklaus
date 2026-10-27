#!/usr/bin/env node
// triklaus — build dist/index.html from data/raw/garmin + config (no dependencies).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildModel, mondayOf, SPORTS } from './lib/model.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rj = async (p, d) => { try { return JSON.parse(await readFile(join(ROOT, p), 'utf8')); } catch { return d; } };
const today = process.env.TRIKLAUS_TODAY || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

const raw = await rj('data/raw/garmin/activities.json', []);
const athlete = await rj('config/athlete.json', {});
const { blocks } = await rj('config/blocks.json', { blocks: [] });
const zones = await rj('data/raw/garmin/hr-zones.json', []);
const M = buildModel({ raw, athlete, blocks, zones, today });

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const T = (pt, en) => `<span class="pt">${pt}</span><span class="en">${en ?? pt}</span>`;
const TS = (pt, en) => `<tspan class="pt">${pt}</tspan><tspan class="en">${en ?? pt}</tspan>`; // SVG-safe
const SPS = { swim: TS('Natação', 'Swim'), bike: TS('Bike', 'Bike'), run: TS('Corrida', 'Run') };
const DAY = 864e5;
const dnum = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const fmtD = (s, lang) => new Date(dnum(s)).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dD = (s) => T(fmtD(s, 'pt'), fmtD(s, 'en'));
const n1 = (x) => (x == null ? '–' : (Math.round(x * 10) / 10).toString());
const hm = (h) => `${Math.floor(h)}h${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
const SP = { swim: T('Natação', 'Swim'), bike: T('Bike', 'Bike'), run: T('Corrida', 'Run'), other: T('Outros', 'Other') };
const SPC = { swim: 'var(--swim)', bike: 'var(--bike)', run: 'var(--run)', other: 'var(--muted)' };
const pace = (secPer100) => `${Math.floor(secPer100 / 60)}:${String(Math.round(secPer100 % 60)).padStart(2, '0')}`;

const goal = M.athlete.goal || {};
const daysToGoal = goal.date ? Math.round((dnum(goal.date) - dnum(today)) / DAY) : null;
const now = M.series.at(-1) || { cap: 0, fat: 0, ready: 0 };
const curBlock = M.blocks.find((b) => b.state === 'active');

// ---------- process map (BPMN-ish swimlanes × weeks) ----------
function processMap() {
  const start = mondayOf(M.athlete.seasonStart || M.counts.since || today);
  const end = mondayOf(goal.date || today);
  const weeks = [];
  for (let t = dnum(start); t <= dnum(end); t += 7 * DAY) weeks.push(new Date(t).toISOString().slice(0, 10));
  const byW = new Map(M.weeks.map((W) => [W.w, W]));
  const L = 74, top = 54, laneH = 46, cw = 26, W = L + weeks.length * cw + 40, H = top + laneH * 3 + 30;
  const x = (w) => L + weeks.indexOf(w) * cw;
  const xd = (d) => L + ((dnum(d) - dnum(start)) / (7 * DAY)) * cw;
  const maxH = Object.fromEntries(SPORTS.map((s) => [s, Math.max(1, ...M.weeks.map((W) => W[s].h))]));
  let g = '';
  // blocks (phases)
  for (const b of M.blocks) {
    const x0 = Math.max(L, xd(b.start)), x1 = Math.min(L + weeks.length * cw, xd(b.end) + cw / 7);
    if (x1 <= x0) continue;
    g += `<rect x="${x0}" y="${top - 8}" width="${x1 - x0}" height="${laneH * 3 + 16}" rx="8" class="phase ${b.state}"/>`;
    g += `<text x="${x0 + 6}" y="${top - 16}" class="phase-label">${TS(esc(b.name_pt), esc(b.name_en))}</text>`;
    if (b.gateway) {
      const gx = x1, gy = top + laneH * 1.5, s = 9;
      const st = b.gateway.pass ? 'pass' : b.state === 'done' ? 'fail' : 'pending';
      g += `<g class="gw ${st}"><title>${esc(b.gateway.label_en)} — ${n1(b.gateway.actual)}</title><path class="dm" d="M${gx} ${gy - s}L${gx + s} ${gy}L${gx} ${gy + s}L${gx - s} ${gy}Z"/>${st === 'pass' ? `<path class="tick" d="M${gx - 4} ${gy}l3 3l5 -6"/>` : ''}</g>`;
    }
  }
  // lanes
  SPORTS.forEach((s, i) => {
    const y = top + i * laneH;
    g += `<line x1="${L}" x2="${L + weeks.length * cw}" y1="${y + laneH}" y2="${y + laneH}" class="lane-line"/>`;
    g += `<text x="${L - 10}" y="${y + laneH / 2 + 4}" text-anchor="end" class="lane-label">${SPS[s]}</text>`;
    for (const w of weeks) {
      const Wd = byW.get(w); const h = Wd ? Wd[s].h : 0;
      const bh = h ? Math.max(3, (h / maxH[s]) * (laneH - 12)) : 0;
      if (bh) g += `<rect x="${x(w) + 5}" y="${y + laneH - 4 - bh}" width="${cw - 10}" height="${bh}" rx="3" fill="${SPC[s]}"><title>${w} · ${hm(h)} · ${n1(Wd[s].km)} km</title></rect>`;
      else if (w > today) g += `<rect x="${x(w) + 5}" y="${y + laneH - 7}" width="${cw - 10}" height="3" rx="1.5" class="future-tick"/>`;
    }
  });
  // start / end events + token
  const ly = top + laneH * 1.5;
    g += `<g class="ev"><circle cx="${L + weeks.length * cw + 18}" cy="${ly}" r="13" class="end"/><text x="${L + weeks.length * cw + 18}" y="${ly + 4}" text-anchor="middle" class="end-t">${esc(goal.short || '🏁')}</text></g>`;
  if (today >= start && today <= goal.date) {
    const tx = xd(today);
    g += `<line x1="${tx}" x2="${tx}" y1="${top - 4}" y2="${top + laneH * 3 + 4}" class="token-line"/><circle cx="${tx}" cy="${top + laneH * 3 + 12}" r="6" class="token"/><text x="${tx}" y="${top + laneH * 3 + 28}" text-anchor="middle" class="token-t">${TS('hoje', 'today')}</text>`;
  }
  // month ticks
  let lastM = '';
  for (const w of weeks) { const m = w.slice(0, 7); if (m !== lastM) { lastM = m; g += `<text x="${x(w)}" y="${H - 0}" class="month">${TS(fmtD(w, 'pt').split(' ')[1] || '', fmtD(w, 'en').split(' ')[1] || '')}</text>`; } }
  return `<div class="scroll"><svg viewBox="0 0 ${W} ${H + 6}" width="${W}" height="${H + 6}" class="map" role="img" aria-label="Season process map">${g}</svg></div>`;
}

// ---------- load chart ----------
function loadChart() {
  const S = M.series.slice(-140); if (S.length < 2) return '';
  const W = 720, H = 220, P = { l: 34, r: 10, t: 10, b: 24 };
  const ys = S.flatMap((s) => [s.cap, s.fat, s.ready]); const lo = Math.min(0, ...ys), hi = Math.max(10, ...ys) * 1.08;
  const X = (i) => P.l + (i / (S.length - 1)) * (W - P.l - P.r), Y = (v) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
  const line = (k) => S.map((s, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(s[k]).toFixed(1)}`).join('');
  const area = `${line('ready')}L${X(S.length - 1)} ${Y(0)}L${X(0)} ${Y(0)}Z`;
  let grid = ''; const step = hi > 80 ? 20 : 10;
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) grid += `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${P.l - 6}" y="${Y(v) + 4}" text-anchor="end" class="axis">${v}</text>`;
  let ticks = ''; S.forEach((s, i) => { if (s.d.endsWith('-01')) ticks += `<text x="${X(i)}" y="${H - 6}" class="axis">${TS(fmtD(s.d, 'pt').split(' ')[1], fmtD(s.d, 'en').split(' ')[1])}</text>`; });
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Capacity, fatigue and readiness">${grid}${ticks}<path d="${area}" class="ready-a"/><path d="${line('fat')}" class="fat-l"/><path d="${line('cap')}" class="cap-l"/></svg>
  <div class="legend"><span><i style="background:var(--cap)"></i>${T('Capacidade (42 d)', 'Capacity (42 d)')}</span><span><i style="background:var(--fat)"></i>${T('Fadiga (7 d)', 'Fatigue (7 d)')}</span><span><i style="background:var(--ready)"></i>${T('Prontidão', 'Readiness')}</span></div>`;
}

function effChart() {
  const E = M.efficiency.slice(-26); if (E.length < 2) return `<p class="muted">${T('Poucos treinos fáceis ainda.', 'Not enough easy runs yet.')}</p>`;
  const W = 340, H = 120, P = 18; const vs = E.map((e) => e.v); const lo = Math.min(...vs) * 0.97, hi = Math.max(...vs) * 1.03;
  const X = (i) => P + (i / (E.length - 1)) * (W - 2 * P), Y = (v) => P / 2 + (1 - (v - lo) / (hi - lo)) * (H - P * 1.5);
  const d = E.map((e, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(e.v).toFixed(1)}`).join('');
  const delta = ((E.at(-1).v / E[0].v - 1) * 100);
  return `<div class="big">${E.at(-1).v.toFixed(3)} <small class="${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)}%</small></div>
  <svg viewBox="0 0 ${W} ${H}" class="chart small"><path d="${d}" class="run-l"/>${E.map((e, i) => `<circle cx="${X(i)}" cy="${Y(e.v)}" r="2.5" class="run-d"><title>${e.w}: ${e.v} (${e.n})</title></circle>`).join('')}</svg>
  <p class="note">${T('metros/min ÷ FC média, corridas fáceis (FC ≤ ' + M.thresholds.easyHr + '), mediana de 3 semanas. Subir = mais rápido com o mesmo coração.', 'metres/min ÷ avg HR on easy runs (HR ≤ ' + M.thresholds.easyHr + '), 3-week median. Up = faster for the same heart.')}</p>`;
}

function powerChart() {
  const { durs, recent, season } = M.powerCurve; if (!season.some(Boolean)) return `<p class="muted">${T('Sem dados de potência.', 'No power data.')}</p>`;
  const W = 340, H = 140, P = { l: 34, r: 8, t: 8, b: 22 };
  const hi = Math.max(...season.filter(Boolean)) * 1.08, lo = 0;
  const X = (i) => P.l + (i / (durs.length - 1)) * (W - P.l - P.r), Y = (v) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
  const path = (arr) => arr.map((v, i) => (v ? `${i && arr[i - 1] ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}` : '')).join('');
  const lab = (s) => (s < 60 ? s + 's' : s / 60 + 'm');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart small">${durs.map((s, i) => `<text x="${X(i)}" y="${H - 6}" text-anchor="middle" class="axis">${lab(s)}</text>`).join('')}
  <path d="${path(season)}" class="season-l"/><path d="${path(recent)}" class="bike-l"/>${recent.map((v, i) => (v ? `<circle cx="${X(i)}" cy="${Y(v)}" r="2.5" class="bike-d"><title>${lab(durs[i])}: ${v} W</title></circle>` : '')).join('')}</svg>
  <div class="legend"><span><i style="background:var(--bike)"></i>${T('Últimos 42 d', 'Last 42 d')}</span><span><i style="background:var(--line)"></i>${T('Temporada', 'Season')}</span></div>`;
}

function blockCards() {
  return M.blocks.map((b) => {
    const g = b.gateway; const st = g ? (g.pass ? 'pass' : b.state === 'done' ? 'fail' : 'pending') : '';
    const retro = b.retro && (b.retro.keep?.length || b.retro.drop?.length || b.retro.try?.length)
      ? `<div class="retro">${['keep', 'drop', 'try'].map((k) => `<div><b>${{ keep: T('Manter', 'Keep'), drop: T('Largar', 'Drop'), try: T('Testar', 'Try') }[k]}</b><ul>${(b.retro[k] || []).map((x) => `<li>${esc(x)}</li>`).join('') || '<li class="muted">–</li>'}</ul></div>`).join('')}</div>` : '';
    return `<article class="block ${b.state}">
      <header><span class="state">${{ done: T('Concluído', 'Done'), active: T('Em andamento', 'In progress'), future: T('Próximo', 'Upcoming') }[b.state]}</span><h3>${T(esc(b.name_pt), esc(b.name_en))}</h3><p class="muted">${dD(b.start)} → ${dD(b.end)} · ${T(esc(b.focus_pt), esc(b.focus_en))}</p></header>
      ${b.state !== 'future' ? `<p class="kv"><span>${hm(b.totals.h)}</span><span>${b.totals.n} ${T('treinos', 'sessions')}</span><span>${T('carga', 'load')} ${b.totals.load}</span></p>` : ''}
      ${g ? `<div class="gate ${st}"><span class="dia"></span><div><b>${T(esc(g.label_pt), esc(g.label_en))}</b><br><span class="muted">${T('atual', 'actual')}: ${n1(g.actual)}</span></div></div>` : ''}
      ${retro}</article>`;
  }).join('');
}

function recentList() {
  return M.recent.map((a) => `<li><span class="dot" style="background:${SPC[a.sport]}"></span><span class="d">${dD(a.date)}</span><span class="s">${SP[a.sport]}${a.indoor ? ` <small class="muted">${a.sport === 'swim' ? T('piscina', 'pool') : T('indoor', 'indoor')}</small>` : ''}${a.race ? ` <small class="tag">${T('prova', 'race')}</small>` : ''}</span><span class="m">${a.km ? n1(a.km) + ' km · ' : ''}${a.min} min</span><span class="l" title="${a.basis}">${a.load}</span></li>`).join('');
}

const t = M.thresholds; const est = (k) => (t.est[k] ? ` <small class="est" title="${esc(t.est[k])}">est.</small>` : '');
const tiles = SPORTS.map((s) => `<div class="tile" style="--c:${SPC[s]}"><span class="label">${SP[s]}</span><b>${hm(M.totals[s].h)}</b><span class="muted">${n1(M.totals[s].km)} km · ${M.totals[s].n}×</span></div>`).join('');
const readyTxt = now.ready > 5 ? T('descansado', 'fresh') : now.ready < -20 ? T('carregado', 'loaded') : T('equilibrado', 'balanced');

const html = `<!doctype html>
<html lang="pt-BR" data-lang="pt">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>triklaus — ${esc(M.athlete.name)}</title>
<meta name="description" content="${esc(M.athlete.name)} — ${esc(goal.name || 'triathlon')} · training as a process">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><path d='M16 3 29 16 16 29 3 16Z' fill='%23ff6a3d'/></svg>">
<style>
:root{--bg:#f6f4ef;--card:#fff;--ink:#16181d;--muted:#6b6f78;--line:#d9d6ce;--swim:#2a7de1;--bike:#e8a317;--run:#e5533d;--cap:#2a7de1;--fat:#e5533d;--ready:#3aa76d;--accent:#ff6a3d;--phase:#ebe7de;--phase-a:#ffe9df}
@media (prefers-color-scheme:dark){:root{--bg:#0f1115;--card:#171a20;--ink:#eceae4;--muted:#9097a3;--line:#2c313a;--phase:#1d2128;--phase-a:#2b1f1a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
html[data-lang=pt] .en,html[data-lang=en] .pt{display:none}
.wrap{max-width:1080px;margin:0 auto;padding:0 16px}
nav{display:flex;justify-content:space-between;align-items:center;padding:18px 0}
.logo{font-weight:800;letter-spacing:.04em;display:flex;gap:8px;align-items:center}.logo i{width:14px;height:14px;background:var(--accent);transform:rotate(45deg);display:inline-block;border-radius:2px}
.lang button{background:none;border:1px solid var(--line);color:var(--muted);padding:4px 10px;border-radius:99px;cursor:pointer;font:inherit;font-size:13px}
html[data-lang=pt] .lang [data-l=pt],html[data-lang=en] .lang [data-l=en]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.hero{display:grid;grid-template-columns:1.4fr 1fr;gap:24px;padding:24px 0 8px;align-items:end}
.hero h1{font-size:clamp(30px,6vw,54px);line-height:1.02;margin:0 0 12px;letter-spacing:-.02em}
.hero h1 em{font-style:normal;color:var(--accent)}
.count{background:var(--card);border-radius:16px;padding:18px;border:1px solid var(--line)}
.count .n{font-size:56px;font-weight:800;line-height:1;letter-spacing:-.03em}
.stats{display:flex;gap:18px;margin-top:12px;flex-wrap:wrap}.stats div{display:flex;flex-direction:column}.stats b{font-size:22px}
section{margin:36px 0}h2{font-size:13px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin:0 0 12px}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px}
.scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
.map text{fill:var(--ink);font-size:12px}.map .lane-label{font-weight:600}.map .month,.map .token-t{fill:var(--muted);font-size:11px}
.phase{fill:var(--phase)}.phase.active{fill:var(--phase-a)}.phase-label{font-size:12px;font-weight:700}
.lane-line{stroke:var(--line)}.future-tick{fill:var(--line)}
.gw .dm{fill:var(--card);stroke:var(--muted);stroke-width:2}.gw.pass .dm{fill:var(--ready);stroke:var(--ready)}.gw.fail .dm{stroke:var(--fat)}.gw .tick{fill:none;stroke:#fff;stroke-width:2}
.end{fill:var(--card);stroke:var(--ink);stroke-width:4}.end-t{font-size:9px!important;font-weight:800}
.token-line{stroke:var(--accent);stroke-width:2;stroke-dasharray:3 3}.token{fill:var(--accent)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.chart{width:100%;height:auto;display:block}.chart .grid{stroke:var(--line)}.chart .axis{fill:var(--muted);font-size:11px}
.cap-l{fill:none;stroke:var(--cap);stroke-width:2.5}.fat-l{fill:none;stroke:var(--fat);stroke-width:1.5;opacity:.8}.ready-a{fill:var(--ready);opacity:.18}
.run-l{fill:none;stroke:var(--run);stroke-width:2.5}.run-d{fill:var(--run)}.bike-l{fill:none;stroke:var(--bike);stroke-width:2.5}.bike-d{fill:var(--bike)}.season-l{fill:none;stroke:var(--line);stroke-width:2;stroke-dasharray:4 3}
.legend{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--muted);margin-top:6px}.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}
.tile{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--c);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column}.tile b{font-size:24px}.label{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
.muted{color:var(--muted)}.note{font-size:12px;color:var(--muted);margin:6px 0 0}.big{font-size:28px;font-weight:800}.big small{font-size:13px}.up{color:var(--ready)}.down{color:var(--fat)}
.blocks{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
.block{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px}.block.active{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}.block.future{opacity:.75}
.block h3{margin:4px 0 2px;font-size:17px}.block p{margin:0;font-size:13px}.state{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--accent);font-weight:700}
.kv{display:flex;gap:10px;margin-top:8px!important;flex-wrap:wrap}.kv span{background:var(--bg);border-radius:6px;padding:2px 8px}
.gate{display:flex;gap:10px;align-items:center;margin-top:10px;font-size:13px}.dia{width:14px;height:14px;transform:rotate(45deg);border:2px solid var(--muted);flex:none}.gate.pass .dia{background:var(--ready);border-color:var(--ready)}.gate.fail .dia{border-color:var(--fat)}
.retro{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:10px;font-size:12px}.retro ul{margin:2px 0 0;padding-left:14px}
.recent{list-style:none;margin:0;padding:0}.recent li{display:grid;grid-template-columns:12px 64px 1fr auto 44px;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid var(--line);font-size:14px}.recent li:last-child{border:0}
.dot{width:10px;height:10px;border-radius:50%}.recent .l{text-align:right;font-variant-numeric:tabular-nums;color:var(--muted)}.recent .d{color:var(--muted)}.tag{background:var(--accent);color:#fff;border-radius:4px;padding:0 5px}
.method{font-size:13px}.method code{background:var(--bg);padding:1px 6px;border-radius:5px}.est{color:var(--accent);font-weight:700}
dl{display:grid;grid-template-columns:auto 1fr;gap:4px 14px;margin:0}dt{color:var(--muted)}dd{margin:0}
footer{padding:30px 0 50px;color:var(--muted);font-size:12px}
@media (max-width:760px){.hero,.grid2{grid-template-columns:1fr}.grid3{grid-template-columns:1fr 1fr 1fr;gap:8px}.tile b{font-size:18px}.recent li{grid-template-columns:10px 54px 1fr auto 36px;gap:8px;font-size:13px}}
</style>
</head>
<body>
<div class="wrap">
<nav><div class="logo"><i></i>TRIKLAUS</div><div class="lang"><button data-l="pt">PT</button> <button data-l="en">EN</button></div></nav>

<header class="hero">
  <div>
    <p class="muted">${esc(M.athlete.name)} · ${esc(M.athlete.city || '')}</p>
    <h1>${T('Treino como <em>processo</em>.', 'Training as a <em>process</em>.')}</h1>
    <p>${T('Cada bloco tem um critério de saída. Cada semana é uma etapa. A linha de chegada é ', 'Every block has an exit criterion. Every week is a step. The end event is ')}<b>${esc(goal.name || '')}</b>.</p>
  </div>
  <div class="count">
    ${daysToGoal != null && daysToGoal >= 0 ? `<div class="n">${daysToGoal}</div><div>${T('dias até', 'days to')} <b>${esc(goal.short || goal.name)}</b> · ${dD(goal.date)}</div>` : `<div class="n">🏁</div>`}
    <p class="note">${T(esc(goal.detail_pt || ''), esc(goal.detail_en || ''))}</p>
    <div class="stats">
      <div><b style="color:var(--cap)">${n1(now.cap)}</b><span class="note">${T('capacidade', 'capacity')}</span></div>
      <div><b style="color:var(--fat)">${n1(now.fat)}</b><span class="note">${T('fadiga', 'fatigue')}</span></div>
      <div><b style="color:var(--ready)">${now.ready > 0 ? '+' : ''}${n1(now.ready)}</b><span class="note">${T('prontidão', 'readiness')} · ${readyTxt}</span></div>
    </div>
  </div>
</header>

<section>
  <h2>${T('Mapa da temporada', 'Season map')}</h2>
  <div class="card">${processMap()}
  <p class="note">${T('Raias = modalidades · colunas = semanas · faixas = blocos · ◇ = critério de saída do bloco · ● laranja = hoje · ◎ = prova-alvo. Altura da barra = horas na semana.', 'Lanes = sports · columns = weeks · bands = blocks · ◇ = block exit gateway · orange ● = today · ◎ = goal race. Bar height = weekly hours.')}</p></div>
</section>

<section>
  <h2>${T('Temporada até agora', 'Season so far')}</h2>
  <div class="grid3">${tiles}</div>
</section>

<section>
  <h2>${T('Capacidade × fadiga', 'Capacity × fatigue')}</h2>
  <div class="card">${loadChart()}</div>
</section>

<section class="grid2">
  <div><h2>${T('Eficiência aeróbica (corrida)', 'Aerobic efficiency (run)')}</h2><div class="card">${effChart()}</div></div>
  <div><h2>${T('Curva de potência (bike)', 'Power curve (bike)')}</h2><div class="card">${powerChart()}</div></div>
</section>

<section>
  <h2>${T('Blocos', 'Blocks')}</h2>
  <div class="blocks">${blockCards()}</div>
</section>

<section>
  <h2>${T('Últimos treinos', 'Latest sessions')}</h2>
  <div class="card"><ul class="recent">${recentList()}</ul><p class="note">${T('Número à direita = carga do treino.', 'Number on the right = session load.')}</p></div>
</section>

<section class="method">
  <h2>${T('Método (sem caixa-preta)', 'Method (no black box)')}</h2>
  <div class="card grid2">
    <div>
      <p>${T('Carga', 'Load')} = <code>${T('horas', 'hours')} × IF² × 100</code></p>
      <p>Bike: <code>IF = NP / FTP</code> · ${T('Corrida', 'Run')}: <code>IF = ${T('FC média', 'avg HR')} / LTHR</code> · ${T('Natação', 'Swim')}: <code>(CSS / pace)³</code></p>
      <p>${T('Capacidade = média exponencial de 42 dias da carga diária; fadiga = 7 dias; prontidão = capacidade − fadiga.', 'Capacity = 42-day exponential average of daily load; fatigue = 7 days; readiness = capacity − fatigue.')}</p>
    </div>
    <dl>
      <dt>FTP</dt><dd>${t.ftp} W${est('ftp')}</dd>
      <dt>LTHR</dt><dd>${t.lthr} bpm${est('lthr')}</dd>
      <dt>CSS</dt><dd>${pace(t.css)} /100 m${est('css')}</dd>
      <dt>${T('Teto FC fácil', 'Easy HR ceiling')}</dt><dd>${t.easyHr} bpm${est('easyHr')}</dd>
    </dl>
  </div>
</section>

<footer>${T('Dados: Garmin Connect · atualizado', 'Data: Garmin Connect · updated')} ${new Date(M.generatedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} · ${M.counts.all} ${T('atividades desde', 'activities since')} ${M.counts.since ? dD(M.counts.since) : '–'}${M.athlete.stravaUrl ? ` · <a href="${esc(M.athlete.stravaUrl)}">Strava</a>` : ''}</footer>
</div>
<script>
(function(){var h=document.documentElement,k='triklaus-lang';function set(l){h.dataset.lang=l;h.lang=l==='pt'?'pt-BR':'en';try{localStorage.setItem(k,l)}catch(e){}}
var s=null;try{s=localStorage.getItem(k)}catch(e){}set(s||((navigator.language||'').indexOf('pt')===0?'pt':'en'));
document.querySelectorAll('.lang button').forEach(function(b){b.onclick=function(){set(b.dataset.l)}});
var sc=document.querySelector('.scroll'),tk=document.querySelector('.token');if(sc&&tk){sc.scrollLeft=Math.max(0,tk.getAttribute('cx')-sc.clientWidth*0.6)}})();
</script>
</body></html>`;

await mkdir(join(ROOT, 'dist'), { recursive: true });
await writeFile(join(ROOT, 'dist', 'index.html'), html);
console.log(`[build] dist/index.html · ${M.counts.all} activities · capacity ${now.cap} · ${(html.length / 1024).toFixed(0)} KB`);
