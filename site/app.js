// triklaus — client renderer. All data comes from window.TRIKLAUS (built by scripts/build.mjs).
(function () {
  const D = window.TRIKLAUS;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const DAY = 864e5;
  const toDay = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  const fromDay = (t) => new Date(t).toISOString().slice(0, 10);
  const addDays = (s, n) => fromDay(toDay(s) + n * DAY);
  const mondayOf = (s) => { const t = toDay(s); return fromDay(t - ((new Date(t).getUTCDay() + 6) % 7) * DAY); };
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmt = (s, year) => `${+s.slice(8, 10)} ${MON[+s.slice(5, 7) - 1]}${year ? ` ${s.slice(0, 4)}` : ''}`;
  const hrs = (h) => (h == null ? '–' : h < 1 ? `${Math.round(h * 60)}′` : `${Math.floor(h)}h${String(Math.round((h % 1) * 60)).padStart(2, '0')}`);
  const mins = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m}′`);
  const daysTo = (d) => Math.round((toDay(d) - toDay(D.today)) / DAY);

  const KIND = { b: 'build', p: 'peak', r: 'recover', t: 'test', tp: 'taper', race: 'race', x: 'reset', h: 'history' };
  const PAT = { b: 'B', p: 'P', r: 'R', t: 'T', tp: 'Tp', race: '◎', x: '–' };
  const ZONE_EMPH = { E: 'volume', LT1: 'volume', VO2: 'vo2', VO2s: 'vo2', T: 'threshold', ST: 'threshold', MP: 'specific', RP: 'specific', S: 'test' };
  const EMPH_NAME = { volume: 'Aerobic volume (under LT1)', vo2: 'VO2max', threshold: 'Threshold (LT2)', specific: 'Race-specific', taper: 'Taper / race', recovery: 'Recovery / reset', test: 'Test', history: 'Before the plan' };
  const SPORT = { swim: 'SWIM', bike: 'BIKE', run: 'RUN', other: 'GYM', tri: 'TRI', rest: 'REST' };
  const cvar = (e) => `var(--e-${e || 'history'})`;

  const mesoById = Object.fromEntries(D.mesos.map((m) => [m.id, m]));
  const macroById = Object.fromEntries(D.macros.map((m) => [m.id, m]));
  const zoneBy = Object.fromEntries(D.zones.map((z) => [z.z, z]));
  const weeks = D.weeks;
  const emphOf = (W) => (W.meso ? mesoById[W.meso].emphasis : 'history');
  const curIdx = Math.max(0, weeks.findIndex((W) => W.w === mondayOf(D.today)));
  const actualByDate = {};
  for (const s of D.sessions) (actualByDate[s.d] ||= []).push(s);

  const state = { sel: curIdx, zoom: 'months' };
  try { state.zoom = localStorage.getItem('triklaus-zoom') || 'months'; } catch (e) { /* storage blocked */ }

  // ------------------------------------------------------------------ page
  const cur = weeks[curIdx];
  const curMeso = cur.meso ? mesoById[cur.meso] : null;
  const curMacro = cur.macro ? macroById[cur.macro] : null;
  const nextA = D.events.filter((e) => e.priority === 'A' && e.date >= D.today).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  const vo2Last = D.trends.vo2.run.at(-1);

  document.getElementById('app').innerHTML = `
  <div class="top"><div class="wrap">
    <div class="brand"><span class="lbl">triklaus · ${esc(D.athlete.name)} · ${esc(D.athlete.city)}</span>
      <button class="theme" id="theme" title="Toggle light / dark">◐ theme</button></div>
    <div class="hero"><h1>Training, past → future</h1>
      <p>Large blocks with a physiological goal, mid blocks that progress, and the sessions inside them. Built around raising the aerobic ceiling (VO2max) and keeping VLamax in balance, not chasing threshold all year.</p></div>
    <div class="stats">
      <div class="stat"><div class="lbl">Now</div><div class="v">${esc(curMacro ? curMacro.name : '—')}</div>
        <div class="s">${curMeso ? `${esc(curMeso.name)} · week ${cur.idx}/${cur.of} · ${KIND[cur.kind]}` : ''}</div></div>
      <div class="stat"><div class="lbl">This week</div><div class="v"><span class="num">${hrs(cur.actual?.h || 0)}</span> <span class="muted">/ ${hrs(cur.planned?.h)}</span></div>
        <div class="s">done / planned · ${(cur.days || []).flatMap((d) => d.sessions).filter((s) => s.key).length} key sessions</div></div>
      <div class="stat"><div class="lbl">Next A race</div><div class="v">${nextA ? `${esc(nextA.short)} <span class="num">${daysTo(nextA.date)} d</span>` : '—'}</div>
        <div class="s">${nextA ? `${fmt(nextA.date, true)}${nextA.tentative ? ' · tentative' : ''}` : ''}</div></div>
      <div class="stat"><div class="lbl">Ceiling</div><div class="v">${vo2Last ? `<span class="num">${vo2Last.v}</span> <span class="muted" style="font-size:13px">VO2max run (Garmin)</span>` : `<span class="num">${D.profile.bike.p5W || '–'} W</span>`}</div>
        <div class="s">5′ power ${D.profile.bike.p5W || '–'} W · LT2 ≈ ${D.reading ? D.reading.lt2 + '% of it' : '–'}</div></div>
    </div>
  </div></div>

  <section id="arc"><div class="wrap">
    <header><div><div class="lbl">Long · mid · short</div><h2>The arc</h2></div>
      <div class="zoom" role="group" aria-label="Zoom">
        <button data-z="season">Season</button><button data-z="months">6 months</button><button data-z="weeks">Weeks</button></div></header>
    <div class="tl"><div class="tl-scroll" id="tl-scroll"></div>
      <div class="legend" id="tl-legend"></div></div>
  </div></section>

  <section id="week"><div class="wrap" id="week-body"></div></section>

  <section id="blocks"><div class="wrap">
    <header><div><div class="lbl">Macro → meso</div><h2>Blocks</h2></div>
      <span class="muted" style="font-size:13px">B build · R recover · T test · P peak · Tp taper · ◎ race · – reset</span></header>
    <div id="blocks-body"></div>
  </div></section>

  <section id="physio"><div class="wrap">
    <header><div><div class="lbl">What the blocks are built on</div><h2>Physiology</h2></div></header>
    <div class="grid3" id="profile"></div>
    <div class="grid2" style="margin-top:14px" id="trends"></div>
  </div></section>

  <section id="zones"><div class="wrap">
    <header><div><div class="lbl">Resolved from the profile</div><h2>Zones</h2></div></header>
    <div class="tbl-wrap"><table class="tbl" id="zones-tbl"></table></div>
  </div></section>

  <section id="log"><div class="wrap">
    <header><div><div class="lbl">Why the plan looks like this</div><h2>Decisions</h2></div></header>
    <div class="grid2" style="align-items:start">
      <div class="log" id="log-body"></div>
      <div>
        <div class="how"><div class="lbl">Change the plan</div>
          <p style="margin:6px 0 0">Talk to Claude in the <code>triklaus</code> repo. Thoughts, goals, niggles, a new race, less time: it reshapes the blocks, checks them against the method, logs the decision here, and the site redeploys.</p>
          <ul><li><code>"knee's sore, swap hills for bike"</code></li><li><code>"marathon is 13 June"</code></li><li><code>"5′ test: 334 W, mile 5:21"</code></li><li><code>"I only have 9 h next week"</code></li></ul></div>
        <div id="warn" style="margin-top:14px"></div>
      </div>
    </div>
  </div></section>

  <footer><div class="wrap">${D.sync ? `Garmin data synced ${esc(D.sync.at.slice(0, 16).replace('T', ' '))} UTC · ${D.sync.n} activities` : 'No Garmin data in this build (plan only)'} · built ${esc(D.generatedAt.slice(0, 16).replace('T', ' '))} UTC · method: Deckard (VO2max / VLamax / LT1 / LT2), Rønnestad block periodisation.</div></footer>`;

  // theme toggle (per-viewer convenience only)
  const root = document.documentElement;
  try { const t = localStorage.getItem('triklaus-theme'); if (t) root.dataset.theme = t; } catch (e) { /* ignore */ }
  $('#theme').onclick = () => {
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('triklaus-theme', root.dataset.theme); } catch (e) { /* ignore */ }
  };

  // ------------------------------------------------------------------ tooltip
  const tip = $('#tip');
  const showTip = (html, ev) => {
    tip.innerHTML = html; tip.hidden = false;
    const r = tip.getBoundingClientRect();
    let x = ev.clientX + 14, y = ev.clientY + 14;
    if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - 14;
    if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - 14;
    tip.style.left = Math.max(8, x) + 'px'; tip.style.top = Math.max(8, y) + 'px';
  };
  const hideTip = () => { tip.hidden = true; };
  const row = (a, b) => `<div class="row"><span>${a}</span><span>${b}</span></div>`;

  // ------------------------------------------------------------------ timeline
  function drawTimeline() {
    const sc = $('#tl-scroll');
    const cw = sc.clientWidth || 900;
    const n = weeks.length;
    const pxw = state.zoom === 'season' ? Math.max(5, cw / n) : state.zoom === 'months' ? Math.max(14, cw / 26) : Math.max(cw / 7, 112);
    const dayMode = pxw >= 84;
    const W = Math.ceil(n * pxw);
    const Y = { ev: 4, mac: 30, mesoY: 86, bar0: 128, base: 300, ax: 316 }; // bars live between bar0 and base
    const H = 336, BH = Y.base - Y.bar0;
    document.querySelectorAll('.zoom button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.z === state.zoom)));

    // scale
    let ymax;
    if (dayMode) {
      ymax = 60;
      for (const Wk of weeks) for (const d of Wk.days || []) {
        ymax = Math.max(ymax, d.sessions.reduce((a, s) => a + (s.min || 0), 0), (actualByDate[d.date] || []).reduce((a, s) => a + s.min, 0));
      }
      ymax = Math.ceil(ymax / 60) * 60;
    } else {
      ymax = Math.max(5, ...weeks.map((Wk) => Math.max(Wk.actual?.h || 0, Wk.planned?.h || 0)));
      ymax = Math.ceil(ymax / 5) * 5;
    }
    const yv = (v) => Y.base - (Math.min(v, ymax) / ymax) * BH;
    const xOfDate = (d) => {
      const i = weeks.findIndex((Wk) => d >= Wk.w && d <= addDays(Wk.w, 6));
      if (i < 0) return null;
      return (i + (toDay(d) - toDay(weeks[i].w)) / DAY / 7) * pxw;
    };
    const bar = (x, y, w, h, r) => { r = Math.min(r, w / 2, h); return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; };
    const fit = (txt, px, cw2) => { const max = Math.floor(px / cw2); return txt.length <= max ? txt : max > 3 ? txt.slice(0, max - 1) + '…' : ''; };

    let s = '';
    // grid
    const step = dayMode ? 60 : 5;
    for (let v = step; v <= ymax; v += step) s += `<line x1="0" x2="${W}" y1="${yv(v)}" y2="${yv(v)}" stroke="var(--grid)" stroke-width="1"/>`;
    s += `<line x1="0" x2="${W}" y1="${Y.base}" y2="${Y.base}" stroke="var(--line)"/>`;

    // macro bands
    for (const m of D.macros) {
      const i0 = weeks.findIndex((Wk) => Wk.w >= mondayOf(m.start));
      const i1 = weeks.findIndex((Wk) => Wk.w > m.end);
      if (i0 < 0) continue;
      const x = i0 * pxw + 1, w = ((i1 < 0 ? n : i1) - i0) * pxw - 2;
      const e = m.past ? 'history' : m.emphasis;
      s += `<g><rect x="${x}" y="${Y.mac}" width="${w}" height="50" rx="8" fill="${cvar(e)}" fill-opacity=".12"/>
        <rect x="${x}" y="${Y.mac}" width="4" height="50" rx="2" fill="${cvar(e)}"/>
        <text class="t-macro" x="${x + 12}" y="${Y.mac + 21}">${esc(fit(m.name, w - 16, 7.4))}</text>
        <text class="t-goal" x="${x + 12}" y="${Y.mac + 38}">${esc(fit(m.goal || '', w - 16, 5.9))}</text></g>`;
    }
    // meso bands
    for (const ms of D.mesos) {
      const i0 = weeks.findIndex((Wk) => Wk.w === ms.start);
      if (i0 < 0) continue;
      const x = i0 * pxw + 1, w = ms.weeks * pxw - 2;
      s += `<g class="meso-band" data-m="${ms.id}" style="cursor:pointer"><rect x="${x}" y="${Y.mesoY}" width="${w}" height="28" rx="6" fill="${cvar(ms.emphasis)}" fill-opacity=".28"/>
        <text class="t-meso" x="${x + 8}" y="${Y.mesoY + 18}">${esc(fit(ms.name, w - 12, 6.3))}</text></g>`;
    }

    // weeks
    weeks.forEach((Wk, i) => {
      const x = i * pxw, e = emphOf(Wk);
      const gap = pxw > 8 ? 2 : 1;
      let g = `<rect class="hit" x="${x}" y="${Y.mesoY - 2}" width="${pxw}" height="${Y.ax - Y.mesoY + 6}" fill="transparent"/>`;
      if (!dayMode) {
        const bw = pxw - gap;
        if (Wk.planned) {
          const ph = Wk.planned.h;
          if (Wk.w > D.today || !Wk.actual) { // future / not yet trained: planned as a light bar with a solid top edge
            g += `<path d="${bar(x + gap / 2, yv(ph), bw, Y.base - yv(ph), 4)}" fill="${cvar(e)}" fill-opacity=".3"/>`;
            g += `<rect x="${x + gap / 2}" y="${yv(ph)}" width="${bw}" height="2" fill="${cvar(e)}"/>`;
          }
        }
        if (Wk.actual && Wk.w <= D.today) {
          const ah = Wk.actual.h;
          if (Wk.planned && Wk.w === mondayOf(D.today)) g += `<path d="${bar(x + gap / 2, yv(Wk.planned.h), bw, Y.base - yv(Wk.planned.h), 4)}" fill="${cvar(e)}" fill-opacity=".3"/>`;
          g += `<path d="${bar(x + gap / 2, yv(ah), bw, Y.base - yv(ah), 4)}" fill="${cvar(e)}"/>`;
          if (Wk.planned && Wk.w < mondayOf(D.today)) g += `<rect x="${x + gap / 2}" y="${yv(Wk.planned.h) - 1}" width="${bw}" height="2" fill="var(--text-primary)" opacity=".55"/>`;
        }
      } else {
        // day mode: each day = stacked sessions (planned, tinted) with actual minutes solid beside it
        const dw = pxw / 7;
        for (let k = 0; k < 7; k++) {
          const date = addDays(Wk.w, k), dx = x + k * dw;
          const planned = (Wk.days && Wk.days[k]) ? Wk.days[k].sessions.filter((ss) => ss.min) : [];
          const act = actualByDate[date] || [];
          const pw = act.length || date <= D.today ? (dw - 3) / 2 : dw - 3;
          let y = Y.base;
          for (const ss of planned) {
            const hgt = (ss.min / ymax) * BH;
            g += `<rect x="${dx + 1.5}" y="${y - hgt + 1}" width="${pw}" height="${Math.max(1, hgt - 2)}" rx="2" fill="${cvar(ZONE_EMPH[ss.zone] || 'test')}" fill-opacity="${ss.key ? .55 : .3}"/>`;
            y -= hgt;
          }
          if (date <= D.today) {
            let ya = Y.base;
            for (const a of act) {
              const hgt = (a.min / ymax) * BH;
              g += `<rect x="${dx + 1.5 + (planned.length ? pw : 0)}" y="${ya - hgt + 1}" width="${pw}" height="${Math.max(1, hgt - 2)}" rx="2" fill="var(--text-primary)" fill-opacity=".75"/>`;
              ya -= hgt;
            }
          }
          s += `<text class="t-axis" x="${dx + dw / 2}" y="${Y.base + 12}" text-anchor="middle">${'MTWTFSS'[k]}</text>`;
        }
      }
      s += `<g class="wk${i === state.sel ? ' sel' : ''}" data-i="${i}">${g}</g>`;
      // axis
      if (dayMode) s += `<text class="t-axis" x="${x + 4}" y="${Y.ax + 12}">${fmt(Wk.w)}</text><line x1="${x}" x2="${x}" y1="${Y.bar0 - 6}" y2="${Y.base}" stroke="var(--grid)"/>`;
      else {
        const prev = i ? weeks[i - 1].w : null;
        if (!prev || prev.slice(5, 7) !== Wk.w.slice(5, 7) || (i === 0)) {
          const first = addDays(Wk.w, 6).slice(0, 7);
          const mon = MON[+first.slice(5, 7) - 1];
          const label = first.slice(5, 7) === '01' || i === 0 ? `${mon} ’${first.slice(2, 4)}` : mon;
          if (state.zoom !== 'season' || +first.slice(5, 7) % 2 === 1 || first.slice(5, 7) === '01') s += `<text class="t-axis" x="${x + 2}" y="${Y.ax}">${label}</text>`;
        }
      }
    });

    // events
    for (const ev of D.events) {
      const x = xOfDate(ev.date); if (x == null) continue;
      const a = ev.priority === 'A';
      s += `<line x1="${x}" x2="${x}" y1="${Y.ev + 16}" y2="${Y.base}" stroke="var(--text-primary)" stroke-width="1" stroke-dasharray="${a ? '0' : '3 3'}" opacity="${a ? .8 : .45}"/>
        <path d="M${x},${Y.ev + 3} l6,6 l-6,6 l-6,-6Z" fill="${a ? 'var(--text-primary)' : 'var(--surface-1)'}" stroke="var(--text-primary)" stroke-width="1.5"/>
        <text class="t-ev" x="${x + 10}" y="${Y.ev + 14}">${esc(ev.short)}${ev.tentative ? '?' : ''}</text>`;
    }
    // today
    const tx = xOfDate(D.today);
    if (tx != null) s += `<line x1="${tx}" x2="${tx}" y1="${Y.mesoY - 4}" y2="${Y.base + 2}" stroke="var(--accent)" stroke-width="2"/>
      <rect x="${tx - 22}" y="${Y.base + 3}" width="44" height="15" rx="7" fill="var(--accent)"/><text x="${tx}" y="${Y.base + 14}" text-anchor="middle" style="font:700 9px var(--mono);fill:#fff">TODAY</text>`;

    sc.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Training timeline: blocks and weekly hours, past actual and future planned">${s}</svg>`;
    // y-axis labels pinned to the visible left edge
    let ax = '';
    for (let v = step; v <= ymax; v += step) ax += `<div style="position:absolute;left:6px;top:${yv(v) - 7}px" class="lbl">${dayMode ? v / 60 + 'h' : v + 'h'}</div>`;
    let ov = $('#tl-axis'); if (!ov) { ov = document.createElement('div'); ov.id = 'tl-axis'; ov.style.cssText = 'position:absolute;inset:0 auto auto 0;pointer-events:none;'; $('.tl').appendChild(ov); }
    ov.innerHTML = ax;

    const L = $('#tl-legend');
    const used = new Set(weeks.map(emphOf));
    L.innerHTML = Object.entries(EMPH_NAME).filter(([k]) => used.has(k)).map(([k, v]) => `<span><i class="sw" style="background:${cvar(k)}"></i>${v}</span>`).join('') +
      (dayMode ? `<span><i class="sw" style="background:var(--text-primary);opacity:.75"></i>done (min/day)</span><span class="muted">tinted = planned, by session zone</span>`
        : `<span><i class="sw" style="background:var(--text-secondary)"></i>solid = done</span><span><i class="sw" style="background:var(--text-secondary);opacity:.3"></i>light = planned</span><span><i class="sw" style="background:var(--text-primary);height:3px;opacity:.55"></i>plan, for past weeks</span>`) +
      `<span>◆ A race · ◇ C race · ? tentative</span>`;

    // interaction
    sc.querySelectorAll('.wk').forEach((g) => {
      const i = +g.dataset.i, Wk = weeks[i];
      g.addEventListener('mousemove', (ev) => showTip(weekTip(Wk), ev));
      g.addEventListener('mouseleave', hideTip);
      g.addEventListener('click', () => { selectWeek(i, true); });
    });
    sc.querySelectorAll('.meso-band').forEach((g) => g.addEventListener('click', () => {
      const i = weeks.findIndex((Wk) => Wk.meso === g.dataset.m); if (i >= 0) selectWeek(i, true);
    }));
    return { pxw };
  }

  function weekTip(Wk) {
    const ms = Wk.meso ? mesoById[Wk.meso] : null;
    let t = `<b>${fmt(Wk.w)} – ${fmt(addDays(Wk.w, 6))}</b><div class="muted">${ms ? `${esc(ms.name)} · wk ${Wk.idx}/${Wk.of} · ${KIND[Wk.kind]}` : 'Before the plan'}</div>`;
    if (Wk.planned) t += row('Planned', hrs(Wk.planned.h));
    if (Wk.actual) t += row('Done', hrs(Wk.actual.h));
    for (const sp of ['swim', 'bike', 'run']) {
      const p = Wk.planned?.by[sp], a = Wk.actual?.by[sp];
      if (p || a) t += row(SPORT[sp].toLowerCase(), `${p != null ? hrs(p) : ''}${p != null && a != null ? ' → ' : ''}${a != null ? hrs(a) : ''}`);
    }
    const keys = (Wk.days || []).flatMap((d) => d.sessions).filter((s) => s.key).map((s) => s.name);
    if (keys.length) t += `<div style="margin-top:6px">★ ${keys.map(esc).join(' · ')}</div>`;
    return t;
  }

  function scrollTimelineTo(i, pxw) {
    const sc = $('#tl-scroll');
    sc.scrollLeft = Math.max(0, i * pxw - sc.clientWidth * (state.zoom === 'weeks' ? 0.15 : 0.35));
  }

  // ------------------------------------------------------------------ week view
  function sessionCard(s, date) {
    if (s.sport === 'rest') return `<div class="ses rest"><div class="nm muted">Rest</div></div>`;
    const z = zoneBy[s.zone];
    const target = z ? (s.sport === 'tri' ? '' : z[s.sport] && z[s.sport] !== '–' ? ` · ${z[s.sport]}` : '') : '';
    let st = '';
    if (s.done) st = `<div class="st ok">✓ ${mins(s.done.min)}${s.done.km ? ` · ${s.done.km} km` : ''}${s.done.hr ? ` · ${s.done.hr} bpm` : ''}${s.done.np ? ` · ${s.done.np} W NP` : ''}</div>`;
    else if (s.missed) st = `<div class="st miss">✗ not logged</div>`;
    return `<div class="ses${s.key ? ' key' : ''}" style="--z:${cvar(ZONE_EMPH[s.zone] || 'test')}" tabindex="0">
      <div class="sp"><span>${SPORT[s.sport] || s.sport} · ${mins(s.min)}</span><span>${s.race ? '◎ RACE' : s.test ? 'TEST' : s.key ? '★ KEY' : ''}</span></div>
      <div class="nm">${esc(s.name)}</div>
      <div class="zn">${esc(s.zone)}${esc(target)}</div>${st}
      <div class="det">${s.set ? `<p><b>Set</b> ${esc(s.set)}</p>` : ''}${s.how ? `<p><b>How</b> ${esc(s.how)}</p>` : ''}${s.why ? `<p><b>Why</b> ${esc(s.why)}</p>` : ''}${z ? `<p class="muted">${esc(z.name)}: ${esc(z.note)}</p>` : ''}</div>
    </div>`;
  }

  function renderWeek() {
    const i = state.sel, Wk = weeks[i];
    const ms = Wk.meso ? mesoById[Wk.meso] : null, mc = Wk.macro ? macroById[Wk.macro] : null;
    const isCur = i === curIdx;
    const days = [];
    for (let k = 0; k < 7; k++) {
      const date = addDays(Wk.w, k);
      const d = Wk.days && Wk.days[k];
      let body = '';
      if (d) {
        body = d.sessions.map((s) => sessionCard(s, date)).join('') || '<div class="muted" style="font-size:12px">—</div>';
        if (d.extra && d.extra.length) body += d.extra.map((a) => `<div class="extra">+ ${SPORT[a.s] || a.s} ${mins(a.min)}${a.km ? ` · ${a.km} km` : ''} (unplanned)</div>`).join('');
      } else {
        const acts = actualByDate[date] || [];
        body = acts.map((a) => `<div class="ses" style="--z:var(--e-history)"><div class="sp"><span>${SPORT[a.s] || a.s} · ${mins(a.min)}</span><span>${a.race ? '◎' : ''}</span></div>
          <div class="nm">${a.km ? a.km + ' km' : SPORT[a.s]}</div><div class="zn">${a.hr ? a.hr + ' bpm' : ''}${a.np ? ` · ${a.np} W NP` : ''}${a.indoor ? ' · indoor' : ''}</div></div>`).join('') || '<div class="muted" style="font-size:12px">—</div>';
      }
      days.push(`<div class="day${date === D.today ? ' today' : date < D.today ? ' past' : ''}"><h4><span>${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][k]}</span><span>${fmt(date)}</span></h4>${body}</div>`);
    }
    const P = Wk.planned, A = Wk.actual;
    const sum = [];
    if (P) sum.push(`Planned <b>${hrs(P.h)}</b>`);
    if (A) sum.push(`Done <b>${hrs(A.h)}</b>`);
    for (const sp of ['swim', 'bike', 'run']) {
      const p = P?.by[sp], a = A?.by[sp];
      if (p || a) sum.push(`${SPORT[sp].toLowerCase()} <b>${p ? hrs(p) : ''}${p && a != null ? ' → ' : ''}${a != null ? hrs(a) : ''}</b>`);
    }
    if (P) sum.push(`Planned under LT1 <b>${Math.round(P.easyShare * 100)}%</b>`);
    if (A && A.easyShare != null) sum.push(`Garmin HR Z1–2 <b>${A.easyShare}%</b>`);

    $('#week-body').innerHTML = `
      <div class="wk-head"><div class="wk-title"><div class="lbl">${isCur ? 'This week' : Wk.w < weeks[curIdx].w ? 'Past week' : 'Planned week'}</div>
        <h3>${fmt(Wk.w)} – ${fmt(addDays(Wk.w, 6), true)}</h3>
        <div class="sub">${mc ? `${esc(mc.name)} › ` : ''}${ms ? `<b>${esc(ms.name)}</b> · week ${Wk.idx} of ${Wk.of} · ${KIND[Wk.kind]}` : 'Before the plan: Garmin activities only'}</div></div>
        <div class="nav"><button id="wk-prev" ${i === 0 ? 'disabled' : ''}>‹ prev</button><button id="wk-now" ${isCur ? 'disabled' : ''}>today</button><button id="wk-next" ${i === weeks.length - 1 ? 'disabled' : ''}>next ›</button></div></div>
      <div class="wk-sum">${sum.join('')}</div>
      ${Wk.note ? `<div class="wk-note">${esc(Wk.note)}</div>` : ms && Wk.idx === 1 ? `<div class="wk-note"><b>${esc(ms.name)}:</b> ${esc(ms.focus)}</div>` : ''}
      <div class="days">${days.join('')}</div>
      <p class="muted" style="font-size:12px;margin-top:10px">Tap a session for the set, the how and the why. Left edge colour = the system it targets; thick edge = key session.</p>`;
    $('#wk-prev').onclick = () => selectWeek(i - 1);
    $('#wk-next').onclick = () => selectWeek(i + 1);
    $('#wk-now').onclick = () => selectWeek(curIdx);
    document.querySelectorAll('#week-body .ses:not(.rest)').forEach((el) => {
      const t = () => el.classList.toggle('open');
      el.addEventListener('click', t);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t(); } });
    });
  }

  let TL = { pxw: 20 };
  function selectWeek(i, jump) {
    state.sel = Math.max(0, Math.min(weeks.length - 1, i));
    document.querySelectorAll('#tl-scroll .wk').forEach((g) => g.classList.toggle('sel', +g.dataset.i === state.sel));
    renderWeek();
    if (jump) $('#week').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ------------------------------------------------------------------ blocks
  function renderBlocks() {
    const out = [];
    for (const m of D.macros) {
      const e = m.past ? 'history' : m.emphasis;
      const isNow = cur.macro === m.id;
      const arrows = { up: '↑', hold: '→', down: '↓' };
      const phys = m.physiology ? Object.entries(m.physiology).map(([k, v]) => `<span class="chip ${v === 'up' ? 'up' : ''}">${{ vo2max: 'VO2max', vlamax: 'VLamax', lt1: 'LT1', lt2: 'LT2' }[k]} ${arrows[v]}</span>`).join('') : '';
      const ws = weeks.filter((Wk) => Wk.macro === m.id);
      let mh = `<div class="mh" style="--c:${cvar(e)}"><div><div class="lbl">${fmt(m.start, true)} → ${fmt(m.end, true)} · ${ws.length} wk${isNow ? ' · now' : ''}</div><h3>${esc(m.name)}</h3><div class="goal">${esc(m.goal || '')}</div></div>
        <div class="phys">${phys}</div><div class="why">${esc(m.why || '')}</div></div>`;
      if (m.past) {
        const tot = ws.reduce((a, Wk) => a + (Wk.actual?.h || 0), 0);
        mh += ws.length ? `<div class="meso" style="--c:${cvar(e)};cursor:default"><div class="dt">${ws.length} weeks of Garmin data</div><div class="fc">${hrs(tot / ws.length)} per week on average</div><div></div></div>` : '';
      }
      const mesos = D.mesos.filter((x) => x.macro === m.id).map((ms) => {
        const mw = weeks.filter((Wk) => Wk.meso === ms.id);
        const hs = mw.map((Wk) => Wk.planned.h);
        const now = cur.meso === ms.id;
        return `<div class="meso${now ? ' now' : ''}" data-m="${ms.id}" style="--c:${cvar(ms.emphasis)}">
          <div><div class="nm"><i class="dot" style="background:${cvar(ms.emphasis)}"></i> ${esc(ms.name)}</div><div class="dt">${fmt(ms.start)} → ${fmt(ms.end)} · ${ms.weeks} wk</div></div>
          <div><div class="fc">${esc(ms.focus)}</div>${ms.why ? `<div class="wy">${esc(ms.why)}</div>` : ''}${ms.success ? `<div class="sx">Done when: ${esc(ms.success)}</div>` : ''}</div>
          <div><div class="pat">${ms.pattern.map((k, j) => `<i class="${k}${now && cur.idx === j + 1 ? ' now' : ''}" title="${KIND[k]}">${PAT[k]}</i>`).join('')}</div>
            <div class="hrs">${Math.round(Math.min(...hs))}–${Math.round(Math.max(...hs))} h/wk</div></div></div>`;
      }).join('');
      out.push(`<div class="macro${isNow ? ' now' : ''}">${mh}${mesos}</div>`);
    }
    $('#blocks-body').innerHTML = out.join('');
    document.querySelectorAll('#blocks-body .meso[data-m]').forEach((el) => el.addEventListener('click', () => {
      const ms = el.dataset.m;
      const i = cur.meso === ms ? curIdx : weeks.findIndex((Wk) => Wk.meso === ms);
      selectWeek(i, true); scrollTimelineTo(i, TL.pxw);
    }));
  }

  // ------------------------------------------------------------------ physiology
  const estB = (k) => (D.profile.est[k] ? `<span class="est" title="${esc(D.profile.est[k])}">est.</span>` : '');
  const mmss = (sec) => { if (sec == null) return '–'; const r = Math.round(sec); return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`; };

  function bullet(items, refs, label) {
    // horizontal scale 0–110% of the anchor; refs = Deckard's standard profile ticks
    const Wd = 520, x = (p) => 10 + (p / 110) * (Wd - 20);
    let s = `<line x1="${x(0)}" x2="${x(110)}" y1="44" y2="44" stroke="var(--line)" stroke-width="6" stroke-linecap="round"/>`;
    for (const r of refs) s += `<line x1="${x(r.p)}" x2="${x(r.p)}" y1="34" y2="54" stroke="var(--text-muted)" stroke-dasharray="2 2"/><text x="${x(r.p)}" y="70" text-anchor="middle">${r.t}</text>`;
    for (const it of items) if (it.p != null) s += `<circle cx="${x(it.p)}" cy="44" r="7" fill="${it.c}" stroke="var(--surface-1)" stroke-width="2"/><text x="${x(it.p)}" y="24" text-anchor="middle" style="fill:var(--text-primary);font-weight:600">${it.t}</text>`;
    return `<div class="chart" aria-label="${esc(label)}"><svg viewBox="0 0 ${Wd} 80">${s}</svg></div>`;
  }

  function renderProfile() {
    const b = D.profile.bike, r = D.profile.run, sw = D.profile.swim, rd = D.reading;
    const pct = (v, a) => (v && a ? Math.round((v / a) * 1000) / 10 : null);
    const bikeCard = `<div class="card"><div class="lbl">Bike · anchored on 5′ power</div><h3>LT1 / LT2 / 5′ = ${rd ? `${Math.round(rd.lt1)} / ${Math.round(rd.lt2)} / 100%` : '–'}</h3>
      ${bullet([{ p: pct(b.lt1W, b.p5W), t: `LT1 ${b.lt1W ?? '–'} W`, c: cvar('volume') }, { p: pct(b.lt2W, b.p5W), t: `LT2 ${b.lt2W ?? '–'} W`, c: cvar('threshold') }, { p: b.p5W ? 100 : null, t: `5′ ${b.p5W ?? '–'} W`, c: cvar('vo2') }],
        [{ p: 50, t: 'std 50' }, { p: 75, t: 'std 75' }, { p: 100, t: '100' }], 'Bike profile as % of 5-minute power')}
      <div class="verdict">${rd ? esc(rd.verdict) : 'Needs a 5′ and a 20′ effort to read the profile.'}</div>
      <dl class="kv"><dt>5′ power${estB('p5W')}</dt><dd>${b.p5W ?? '–'} W</dd><dt>LT2${estB('lt2W')}</dt><dd>${b.lt2W ?? '–'} W</dd><dt>LT1${estB('lt1W')}</dt><dd>${b.lt1W ?? '–'} W</dd>
      <dt>Tested</dt><dd>${b.tested ? esc(b.tested) : 'not yet'}</dd></dl></div>`;
    const sp = (pace) => (pace ? 1000 / pace : null);
    const vv = r.vVO2Pace || (r.mile ? r.mile / 1.609 : null);
    const runCard = `<div class="card"><div class="lbl">Run · anchored on mile / vVO2max speed</div><h3>LT2 at ${vv && r.lt2Pace ? Math.round((sp(r.lt2Pace) / sp(vv)) * 100) + '% of vVO2max' : '–'}</h3>
      ${bullet([{ p: r.lt1Pace && vv ? (sp(r.lt1Pace) / sp(vv)) * 100 : null, t: `LT1 ${mmss(r.lt1Pace)}`, c: cvar('volume') }, { p: r.lt2Pace && vv ? (sp(r.lt2Pace) / sp(vv)) * 100 : null, t: `LT2 ${mmss(r.lt2Pace)}`, c: cvar('threshold') }, { p: vv ? 100 : null, t: `vVO2 ${mmss(vv)}`, c: cvar('vo2') }], [], 'Run profile as % of speed at VO2max')}
      <div class="verdict">The 1 mile test replaces the estimate. A small LT2 gap means keep building the ceiling.</div>
      <dl class="kv"><dt>LT1 HR${estB('lt1Hr')}</dt><dd>${r.lt1Hr ?? '–'} bpm</dd><dt>LT2 HR${estB('lt2Hr')}</dt><dd>${r.lt2Hr ?? '–'} bpm</dd>
      <dt>LT1 pace${estB('lt1Pace')}</dt><dd>${mmss(r.lt1Pace)}/km</dd><dt>LT2 pace${estB('lt2Pace')}</dt><dd>${mmss(r.lt2Pace)}/km</dd>
      <dt>Mile${estB('mile')}</dt><dd>${mmss(r.mile)}</dd><dt>Garmin VO2max</dt><dd>${r.vo2 ?? '–'}</dd></dl></div>`;
    const swimCard = `<div class="card"><div class="lbl">Swim</div><h3>CSS ${mmss(sw.css)}/100 m</h3>
      <dl class="kv"><dt>CSS${estB('css')}</dt><dd>${mmss(sw.css)}/100 m</dd><dt>400 m TT</dt><dd>${sw.t400 ? mmss(sw.t400) : 'not yet'}</dd><dt>Tested</dt><dd>${sw.tested ? esc(sw.tested) : 'not yet'}</dd></dl>
      <div class="verdict">Deckard profiles the swim with a ~500 yd TT. Here a 400 + 200 also gives CSS.</div>
      <div class="verdict" style="margin-top:14px"><b>est.</b> = estimated from Garmin data; hover for the method. Tests in the Profile block replace them.</div></div>`;
    $('#profile').innerHTML = bikeCard + runCard + swimCard;
  }

  function lineChart(pts, { title, sub, unit, fmtV = (v) => v, color }) {
    if (pts.length < 2) return `<div class="card"><div class="lbl">${esc(sub)}</div><h3>${esc(title)}</h3><p class="muted">Not enough Garmin data in this build yet.</p></div>`;
    const Wd = 560, Hh = 170, L = 8, R = 44, T = 14, B = 22;
    const xs = pts.map((p) => toDay(p.d)), ys = pts.map((p) => p.v);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    let y0 = Math.min(...ys), y1 = Math.max(...ys); const pad = (y1 - y0) * 0.15 || 1; y0 -= pad; y1 += pad;
    const X = (t) => L + ((t - x0) / (x1 - x0 || 1)) * (Wd - L - R), Yv = (v) => T + (1 - (v - y0) / (y1 - y0)) * (Hh - T - B);
    let s = '';
    for (let k = 0; k <= 3; k++) { const v = y0 + ((y1 - y0) * k) / 3; s += `<line x1="${L}" x2="${Wd - R}" y1="${Yv(v)}" y2="${Yv(v)}" stroke="var(--grid)"/><text x="${Wd - R + 6}" y="${Yv(v) + 3}">${fmtV(v)}</text>`; }
    const months = new Set();
    for (const p of pts) { const m = p.d.slice(0, 7); if (!months.has(m)) { months.add(m); const t = toDay(m + '-01'); if (t >= x0) s += `<text x="${X(t)}" y="${Hh - 6}">${MON[+m.slice(5, 7) - 1]}</text>`; } }
    s += `<path d="${pts.map((p, k) => `${k ? 'L' : 'M'}${X(toDay(p.d)).toFixed(1)},${Yv(p.v).toFixed(1)}`).join('')}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`;
    const last = pts.at(-1);
    s += `<circle cx="${X(toDay(last.d))}" cy="${Yv(last.v)}" r="4.5" fill="${color}" stroke="var(--surface-1)" stroke-width="2"/>`;
    s += `<line class="cross" x1="0" x2="0" y1="${T}" y2="${Hh - B}" stroke="var(--text-muted)" visibility="hidden"/><circle class="cdot" r="4" fill="${color}" visibility="hidden"/>`;
    s += `<rect class="hov" x="${L}" y="0" width="${Wd - L - R}" height="${Hh}" fill="transparent"/>`;
    const first = pts[0], d = last.v - first.v;
    const id = 'lc' + Math.random().toString(36).slice(2, 8);
    setTimeout(() => {
      const svg = document.getElementById(id); if (!svg) return;
      const cross = svg.querySelector('.cross'), dot = svg.querySelector('.cdot');
      svg.querySelector('.hov').addEventListener('mousemove', (ev) => {
        const r = svg.getBoundingClientRect(); const mx = ((ev.clientX - r.left) / r.width) * Wd;
        let best = pts[0]; for (const p of pts) if (Math.abs(X(toDay(p.d)) - mx) < Math.abs(X(toDay(best.d)) - mx)) best = p;
        const bx = X(toDay(best.d)), by = Yv(best.v);
        cross.setAttribute('x1', bx); cross.setAttribute('x2', bx); cross.setAttribute('visibility', 'visible');
        dot.setAttribute('cx', bx); dot.setAttribute('cy', by); dot.setAttribute('visibility', 'visible');
        showTip(`<b>${fmt(best.d, true)}</b>${row(esc(title), fmtV(best.v) + (unit ? ' ' + unit : ''))}${best.n ? row('runs in window', best.n) : ''}`, ev);
      });
      svg.querySelector('.hov').addEventListener('mouseleave', () => { cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); hideTip(); });
    });
    return `<div class="card"><div class="lbl">${esc(sub)}</div><h3>${esc(title)}: <span class="num">${fmtV(last.v)}</span> <span class="muted" style="font-size:13px;font-weight:500">${d >= 0 ? '▲' : '▼'} ${fmtV(Math.abs(d))} since ${fmt(first.d)}</span></h3>
      <div class="chart"><svg id="${id}" viewBox="0 0 ${Wd} ${Hh}" role="img" aria-label="${esc(title)} over time">${s}</svg></div></div>`;
  }

  function renderTrends() {
    const v = D.trends.vo2.run;
    $('#trends').innerHTML =
      lineChart(v, { title: 'VO2max (run)', sub: 'The ceiling · Garmin estimate per run', unit: 'ml/kg/min', fmtV: (x) => (Math.round(x * 10) / 10).toString(), color: cvar('vo2') }) +
      lineChart(D.trends.eff, { title: 'Aerobic efficiency', sub: 'Easy runs under LT1 HR · m/min ÷ bpm, 3-wk median', unit: '', fmtV: (x) => x.toFixed(3), color: cvar('volume') });
  }

  // ------------------------------------------------------------------ zones, log, warnings
  function renderZones() {
    $('#zones-tbl').innerHTML = `<thead><tr><th>Zone</th><th>Bike</th><th>Run</th><th>Swim</th><th>Notes</th></tr></thead><tbody>` +
      D.zones.map((z) => `<tr><td><i class="dot" style="background:${cvar(ZONE_EMPH[z.z] || 'test')}"></i> <b class="mono">${esc(z.z)}</b><div class="muted" style="font-size:12px">${esc(z.name)}</div></td>
        <td class="num mono">${esc(z.bike)}</td><td class="num mono">${esc(z.run)}</td><td class="num mono">${esc(z.swim)}</td><td class="sec">${esc(z.note)}</td></tr>`).join('') + '</tbody>';
  }
  const md = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').split(/\n{2,}/).map((p) => (/^- /m.test(p) ? `<ul>${p.split('\n').map((l) => `<li>${l.replace(/^- /, '')}</li>`).join('')}</ul>` : `<p>${p.replace(/\n/g, ' ')}</p>`)).join('');
  function renderLog() {
    $('#log-body').innerHTML = D.decisions.length ? [...D.decisions].reverse().map((d) => `<article><h3>${esc(d.head)}</h3><div class="body">${md(d.body)}</div></article>`).join('') : '<p class="muted">No decisions logged yet.</p>';
    $('#warn').innerHTML = D.warnings.length ? `<div class="card"><div class="lbl">Plan checks</div><ul class="warn">${D.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>`
      : `<div class="card"><div class="lbl">Plan checks</div><p class="warn" style="margin:6px 0 0">All guardrails pass: ramps, recovery weeks, intensity distribution, key-session count.</p></div>`;
  }

  // ------------------------------------------------------------------ boot
  document.querySelectorAll('.zoom button').forEach((b) => b.addEventListener('click', () => {
    state.zoom = b.dataset.z;
    try { localStorage.setItem('triklaus-zoom', state.zoom); } catch (e) { /* ignore */ }
    TL = drawTimeline(); scrollTimelineTo(state.sel, TL.pxw);
  }));
  TL = drawTimeline();
  scrollTimelineTo(curIdx, TL.pxw);
  renderWeek(); renderBlocks(); renderProfile(); renderTrends(); renderZones(); renderLog();
  let rz; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { TL = drawTimeline(); }, 150); });
})();
