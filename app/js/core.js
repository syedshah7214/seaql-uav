/* ==========================================================================
   SEAQL SOC — core: utilities, shared simulation store, router, toasts
   Everything that is "Interactive Simulation" is generated HERE, from one
   shared state, so every page shows consistent numbers.
   ========================================================================== */
(function () {
  'use strict';
  const S = (window.S = {});
  const D = (S.data = window.SEAQL_DATA || {});

  /* ---------------- utilities ---------------- */
  S.$ = (sel, root = document) => root.querySelector(sel);
  S.$$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  S.esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  S.pct = (v, d = 1) => (v == null ? '—' : (v * 100).toFixed(d) + '%');
  S.num = (v) => Math.round(v).toLocaleString('en-US');
  S.pad = (n) => String(n).padStart(2, '0');
  S.hms = (ms) => { const s = Math.floor(ms / 1000); return `${S.pad(Math.floor(s / 3600))}:${S.pad(Math.floor(s / 60) % 60)}:${S.pad(s % 60)}`; };
  S.time = (t) => new Date(t).toLocaleTimeString('en-GB', { hour12: false });
  S.ago = (t) => { const s = Math.max(0, Math.round((Date.now() - t) / 1000)); if (s < 60) return s + 's ago'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; return Math.floor(s / 3600) + ' h ago'; };
  S.icons = () => { try { window.lucide && lucide.createIcons({ attrs: { 'aria-hidden': 'true' } }); } catch (e) { /* icons are decorative */ } };
  // Backend address: '' = same server (local python backend/server.py). On Vercel, app/js/config.js sets the
  // Hugging Face Space URL, e.g. 'https://your-name-seaql-api.hf.space/'.
  S.API_BASE = (window.SEAQL_API_BASE || '').trim();
  if (S.API_BASE && !S.API_BASE.endsWith('/')) S.API_BASE += '/';
  S.api = (path) => S.API_BASE + path;
  S.reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  S.download = (name, content, type = 'text/plain') => {
    const blob = content instanceof Blob ? content : new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  S.csv = (rows) => rows.map((r) => r.map((c) => { const s = String(c ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\n');
  let seed = 1337;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const jitter = (base, spread) => base + (rnd() - 0.5) * 2 * spread;

  S.tag = {
    verified: '<span class="tag verified"><i data-lucide="badge-check"></i>Verified experiment</span>',
    sim: '<span class="tag sim"><i data-lucide="flask-conical"></i>Interactive simulation</span>',
    future: '<span class="tag future"><i data-lucide="telescope"></i>Future work</span>',
    simShort: '<span class="tag sim" title="Interactive simulation"><i data-lucide="flask-conical"></i>Simulated</span>',
    model: '<span class="tag model"><i data-lucide="cpu"></i>Real model output</span>',
  };

  /* ---------------- toasts ---------------- */
  S.toast = (title, msg = '', kind = 'info') => {
    const box = S.$('#toasts'); if (!box) return;
    const ic = { ok: 'circle-check', err: 'circle-x', warn: 'triangle-alert', info: 'info' }[kind] || 'info';
    const el = document.createElement('div');
    el.className = 'toast ' + kind; el.setAttribute('role', 'status');
    el.innerHTML = `<i data-lucide="${ic}"></i><div><b>${S.esc(title)}</b>${msg ? `<span>${S.esc(msg)}</span>` : ''}</div>`;
    box.appendChild(el); S.icons();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 3800);
  };

  /* ---------------- drone artwork ---------------- */
  const COLORS = { normal: '#22E39A', attack: '#FF4D6A', suspicious: '#FFC23D', training: '#22B8FF', offline: '#6F86A6' };
  S.COLORS = COLORS;
  S.statusLabel = (s) => ({ normal: 'Normal', attack: 'Under Attack', suspicious: 'Suspicious', training: 'Training' }[s] || s);
  S.droneSVG = (color = '#00D9FF', spin = true) => `
  <svg viewBox="0 0 120 80" aria-hidden="true">
    <defs><radialGradient id="dg${color.slice(1)}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${color}" stop-opacity=".55"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs>
    <ellipse cx="60" cy="44" rx="46" ry="26" fill="url(#dg${color.slice(1)})"/>
    <g stroke="${color}" stroke-width="3.2" stroke-linecap="round"><path d="M60 42 L24 26 M60 42 L96 26 M60 42 L28 58 M60 42 L92 58"/></g>
    <g fill="none" stroke="${color}" stroke-width="2.2" opacity=".95">
      <ellipse cx="24" cy="24" rx="15" ry="4.5" class="${spin ? 'spin' : ''}"/><ellipse cx="96" cy="24" rx="15" ry="4.5" class="${spin ? 'spin' : ''}"/>
      <ellipse cx="26" cy="58" rx="15" ry="4.5" class="${spin ? 'spin' : ''}"/><ellipse cx="94" cy="58" rx="15" ry="4.5" class="${spin ? 'spin' : ''}"/>
    </g>
    <g fill="${color}"><circle cx="24" cy="24" r="3"/><circle cx="96" cy="24" r="3"/><circle cx="26" cy="58" r="3"/><circle cx="94" cy="58" r="3"/></g>
    <rect x="47" y="33" width="26" height="18" rx="6" fill="#0A1A2E" stroke="${color}" stroke-width="2.6"/>
    <circle cx="60" cy="42" r="4" fill="${color}"/>
    <path d="M52 52 L48 62 M68 52 L72 62" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity=".7"/>
  </svg>`;
  S.logoSVG = `<svg class="brand-logo" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="lgS" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#00D9FF"/><stop offset="1" stop-color="#2F7BFF"/></linearGradient></defs>
    <path d="M24 3 L42 10 V23 C42 34 34 41.5 24 45 C14 41.5 6 34 6 23 V10 Z" fill="rgba(0,217,255,.08)" stroke="url(#lgS)" stroke-width="2.4"/>
    <g stroke="#EAF4FF" stroke-width="1.8" stroke-linecap="round"><path d="M24 24 L16 17 M24 24 L32 17 M24 24 L16 31 M24 24 L32 31"/></g>
    <g fill="none" stroke="#00D9FF" stroke-width="1.6"><circle cx="15" cy="16" r="3.2"/><circle cx="33" cy="16" r="3.2"/><circle cx="15" cy="32" r="3.2"/><circle cx="33" cy="32" r="3.2"/></g>
    <rect x="20.5" y="20.5" width="7" height="7" rx="2" fill="#00D9FF"/></svg>`;

  /* ======================================================================
     SHARED SIMULATION STATE  (Interactive Simulation — not model output)
     ====================================================================== */
  const SCEN = {
    normal: { name: 'Normal Traffic', desc: 'No attack, benign communication', targets: [], sev: 'low' },
    dos: { name: 'DoS Attack', desc: 'High-rate traffic flooding attack', targets: [2, 6], sev: 'critical', type: 'DoS' },
    replay: { name: 'Replay Attack', desc: 'Re-transmitting previously captured packets', targets: [5], sev: 'high', type: 'Replay' },
    mixed: { name: 'Mixed Attack', desc: 'DoS + Replay at the same time', targets: [2, 5, 6], sev: 'critical', type: 'Mixed' },
    recovery: { name: 'Recovery', desc: 'Isolate threats and return to normal state', targets: [], sev: 'medium' },
  };
  S.SCEN = SCEN;
  const clusterOf = (i) => ((D.clusterMap && D.clusterMap[1].includes(i)) ? 'B' : 'A');

  function freshState() {
    return {
      running: true, speed: 1, scenario: 'normal', scenarioSince: Date.now(), tick: 0, simNow: Date.now(),
      uavs: Array.from({ length: 8 }, (_, i) => ({
        idx: i, id: 'UAV-' + S.pad(i + 1), cluster: clusterOf(i), status: 'normal', attackType: null, attackAge: 0,
        rate: jitter(210, 30), packets: Math.round(jitter(42000, 6000)), lastSeen: Date.now(), history: [],
        battery: jitter(88, 8), altitude: jitter(120, 25), signal: jitter(-58, 6), trainCountdown: 0, incidents: [],
      })),
      traffic: [], windows: { benign: 0, dos: 0, replay: 0 }, alerts: [], incidents: [], timeline: [], incSeq: 0,
      totalPackets: 0, sev: [], kpi: { active: [], attacks: [], health: [], traffic: [], threat: [] }, lowTick: 0, unread: 0,
    };
  }
  let st = freshState();
  S.state = () => st;
  const subs = new Set();
  S.subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };
  const emit = () => subs.forEach((fn) => { try { fn(st); } catch (e) { console.error(e); } });

  function log(text, level = 'info', t = st.simNow) { st.timeline.unshift({ t, text, level }); st.timeline = st.timeline.slice(0, 120); if (level === 'info' || level === 'ok') st.lowTick++; }
  function alert(uav, type, sev, title, detail, t = st.simNow) {
    st.alerts.unshift({ id: 'A' + (st.alerts.length + 1) + '-' + t, t, uav: uav.id, type, sev, title, detail });
    st.alerts = st.alerts.slice(0, 80);
    if (sev !== 'low') st.unread++;
  }
  function openIncident(u, type, t) {
    st.incSeq++;
    const inc = {
      id: 'INC-' + String(st.incSeq).padStart(4, '0'), uav: u.id, cluster: u.cluster, type, start: t, end: null,
      status: 'Open', sev: type === 'DoS' ? 'critical' : 'high', peakRate: u.rate, packets: 0,
      features: simFeatures(type), events: [{ t, text: `${type === 'DoS' ? 'Packet-rate spike' : 'Duplicate sequence numbers'} observed on ${u.id}` }],
    };
    st.incidents.unshift(inc); u.incidents.push(inc.id);
    return inc;
  }
  // Simulated packet-feature readings for an incident. Benign reference values are REAL dataset medians.
  function simFeatures(type) {
    const fs = D.featureStats || {};
    const med = (f, c) => fs[f]?.byClass?.[c]?.median;
    const src = type === 'Replay' ? 'Replay' : 'DoS attack';
    return [
      { f: 'wlan.seq', observed: Math.round(jitter(med('wlan.seq', src) ?? 1000, 120)), benign: med('wlan.seq', 'benign') },
      { f: 'wlan.duration', observed: Math.round(jitter(med('wlan.duration', src) ?? 300, 12)), benign: med('wlan.duration', 'benign') },
      { f: 'time_since_last_packet', observed: +jitter(med('time_since_last_packet', src) ?? 0.003, 0.0008).toFixed(4), benign: med('time_since_last_packet', 'benign') },
      { f: 'frame.len', observed: Math.round(jitter(med('frame.len', src) ?? 100, 6)), benign: med('frame.len', 'benign') },
    ];
  }

  function step() {
    st.tick++;
    st.simNow += 1000;
    const sc = SCEN[st.scenario];
    let benignPk = 0, malPk = 0;
    st.uavs.forEach((u) => {
      const targeted = sc.targets.includes(u.idx);
      const type = st.scenario === 'mixed' ? (u.idx === 5 ? 'Replay' : 'DoS') : sc.type;
      if (targeted) {
        u.attackAge++; u.attackType = type;
        const prev = u.status;
        u.status = u.attackAge >= 3 ? 'attack' : 'suspicious';
        if (prev !== 'suspicious' && u.status === 'suspicious') {
          alert(u, type, 'medium', 'Suspicious Traffic - ' + u.id, 'Abnormal packet timing observed');
          log(`${u.id}: abnormal ${type === 'DoS' ? 'packet rate' : 'sequence pattern'} — marked suspicious`, 'medium');
        }
        if (prev !== 'attack' && u.status === 'attack') {
          const inc = openIncident(u, type, st.simNow);
          alert(u, type, inc.sev, `${type} Attack - ${u.id}`, `${inc.id} opened · cluster ${u.cluster}`);
          log(`${u.id}: ${type} attack confirmed by simulated detector — ${inc.id} opened`, inc.sev);
        }
        if (u.status === 'attack' && u.attackAge % 20 === 0) alert(u, type, 'high', `Sustained ${type} - ${u.id}`, `${Math.round(u.attackAge)} s active`);
        const target = type === 'DoS' ? jitter(7600, 450) : jitter(520, 60);
        u.rate += (target - u.rate) * 0.45;
      } else {
        if (u.status === 'attack' || u.status === 'suspicious') {
          // node leaving an attack (recovery or scenario switch)
          u.attackAge = Math.max(0, u.attackAge > 4 ? 3 : u.attackAge - 1);
          if (u.attackAge <= 0 || st.scenario !== 'recovery') {
            u.status = 'normal'; u.attackAge = 0;
            const inc = st.incidents.find((x) => x.uav === u.id && x.status === 'Open');
            if (inc) { inc.status = 'Resolved'; inc.end = st.simNow; inc.events.push({ t: st.simNow, text: `${u.id} isolated and restored to normal state` }); }
            alert(u, 'Recovery', 'low', 'Recovered - ' + u.id, 'Traffic back within normal range');
            log(`${u.id}: traffic back to normal range — node restored`, 'ok');
          } else u.status = 'suspicious';
        }
        if (u.status === 'normal' || u.status === 'training') {
          // periodic local-training windows (illustrative)
          if (u.trainCountdown > 0) { u.trainCountdown--; u.status = u.trainCountdown > 0 ? 'training' : 'normal'; }
          else if (st.tick % 37 === (u.idx * 5) % 37 && rnd() < 0.6) { u.trainCountdown = 7; u.status = 'training'; log(`${u.id}: local training window started (simulated)`, 'info'); }
        }
        u.rate += (jitter(u.status === 'training' ? 260 : 210, 35) - u.rate) * 0.5;
        u.attackType = null;
      }
      const pk = Math.max(0, Math.round(u.rate));
      u.packets += pk; u.lastSeen = st.simNow;
      if (u.status === 'attack' || u.status === 'suspicious') {
        malPk += pk; st.windows[u.attackType === 'Replay' ? 'replay' : 'dos']++;
        const inc = st.incidents.find((x) => x.uav === u.id && x.status === 'Open');
        if (inc) { inc.packets += pk; inc.peakRate = Math.max(inc.peakRate, pk); if (u.attackAge === 8) inc.events.push({ t: st.simNow, text: `Peak rate ${S.num(pk)} pkt/s recorded` }); }
      } else { benignPk += pk; st.windows.benign++; }
      u.history.push(pk); if (u.history.length > 60) u.history.shift();
      u.battery = Math.max(18, u.battery - 0.004 * (u.status === 'attack' ? 3 : 1));
      u.altitude += (rnd() - 0.5) * 1.2; u.signal += (rnd() - 0.5) * 0.6;
    });
    st.totalPackets += benignPk + malPk;
    st.traffic.push({ t: st.simNow, benign: benignPk, malicious: malPk });
    if (st.traffic.length > 60) st.traffic.shift();
    // per-second severity series (node-level simulated detections) for the events-over-time chart
    const cnt = { critical: 0, high: 0, medium: 0 };
    st.uavs.forEach((u) => { if (u.status === 'attack') cnt[u.attackType === 'DoS' ? 'critical' : 'high']++; else if (u.status === 'suspicious') cnt.medium++; });
    st.sev.push({ t: st.simNow, ...cnt, low: st.lowTick }); st.lowTick = 0;
    if (st.sev.length > 300) st.sev.shift();
    const att = st.uavs.filter((u) => u.status === 'attack').length;
    const K = st.kpi; const push = (k, v) => { K[k].push(v); if (K[k].length > 40) K[k].shift(); };
    push('active', 8 - att); push('attacks', st.incidents.length); push('health', S.sim ? S.sim.score() : 100);
    push('traffic', benignPk + malPk); push('threat', cnt.critical * 3 + cnt.high * 2 + cnt.medium);
    if (st.scenario === 'recovery' && st.uavs.every((u) => u.status === 'normal' || u.status === 'training') && st.tick - st.recoveryStartTick > 3) {
      st.scenario = 'normal'; st.scenarioSince = st.simNow; log('Recovery complete — swarm back to normal traffic', 'ok');
    }
  }

  S.sim = {
    setScenario(key, silent) {
      if (!SCEN[key] || key === st.scenario) return;
      st.scenario = key; st.scenarioSince = st.simNow; if (key === 'recovery') st.recoveryStartTick = st.tick;
      log(`Scenario changed to ${SCEN[key].name}`, key === 'normal' || key === 'recovery' ? 'ok' : SCEN[key].sev);
      if (!silent) S.toast('Scenario: ' + SCEN[key].name, key === 'normal' ? 'Benign traffic only' : 'Simulated events — not real model predictions', key === 'normal' || key === 'recovery' ? 'ok' : 'warn');
      emit();
    },
    start() { if (!st.running) { st.running = true; log('Simulation resumed', 'info'); emit(); } },
    pause() { if (st.running) { st.running = false; log('Simulation paused', 'info'); emit(); } },
    toggle() { st.running ? S.sim.pause() : S.sim.start(); },
    setSpeed(v) { st.speed = Math.max(1, Math.min(4, +v || 1)); schedule(); emit(); },
    reset() { seed = 1337; st = freshState(); st.simNow = Date.now(); log('Simulation reset — all UAVs normal', 'ok'); schedule(); emit(); S.toast('Simulation reset', 'All UAVs returned to normal', 'ok'); },
    elapsed() { return st.simNow - st.scenarioSince; },
    severity() {
      const att = st.uavs.filter((u) => u.status === 'attack').length;
      const sus = st.uavs.filter((u) => u.status === 'suspicious').length;
      if (att >= 2) return 'Critical'; if (att === 1) return 'High'; if (sus) return 'Medium'; return 'Low';
    },
    score() {
      const att = st.uavs.filter((u) => u.status === 'attack').length;
      const sus = st.uavs.filter((u) => u.status === 'suspicious').length;
      return Math.max(0, Math.min(100, 98.6 - att * 11.5 - sus * 4 - Math.min(6, st.incidents.filter((i) => i.status === 'Open').length * 1.5)));
    },
  };

  let timer = null;
  function schedule() {
    clearInterval(timer);
    timer = setInterval(() => { if (st.running) { step(); emit(); } }, 1000 / st.speed);
  }

  // Pre-roll: run a scripted demo history (normal -> replay -> recovery -> normal -> DoS in progress)
  // so the console opens populated. All of it is simulated and labelled as such.
  function preroll() {
    const script = [['normal', 70], ['replay', 22], ['recovery', 10], ['normal', 40], ['dos', 9]];
    const totalTicks = script.reduce((a, s) => a + s[1], 0);
    st.simNow = Date.now() - totalTicks * 1000;
    log('Simulation started — 8 UAVs, 2 clusters', 'info');
    script.forEach(([k, n]) => { S.sim.setScenario(k, true); for (let i = 0; i < n; i++) step(); });
  }
  preroll();
  schedule();

  /* ---------------- Chart.js defaults ---------------- */
  if (window.Chart) {
    Chart.defaults.color = '#A9BCD6';
    Chart.defaults.font.family = '"Inter", system-ui, sans-serif';
    Chart.defaults.font.size = 11.5;
    Chart.defaults.borderColor = 'rgba(80,160,230,.12)';
    Chart.defaults.plugins.legend.labels.boxWidth = 10;
    Chart.defaults.plugins.legend.labels.boxHeight = 10;
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(6,16,32,.96)';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(0,217,255,.35)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.maintainAspectRatio = false;
    if (S.reduced) Chart.defaults.animation = false;
  }
  S.charts = [];
  S.chart = (canvas, cfg) => { if (!window.Chart || !canvas) return null; const c = new Chart(canvas, cfg); S.charts.push(c); return c; };
  S.gradient = (ctx, h, c1, c2) => { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, c1); g.addColorStop(1, c2); return g; };

  /* ---------------- router ---------------- */
  const views = {};
  S.view = (name, def) => { views[name] = def; };
  S.NAV = [
    ['mission', 'Mission Control', 'satellite-dish'], ['dashboard', 'SOC Overview', 'layout-dashboard'], ['swarm', '3D UAV Swarm', 'boxes'], ['attack', 'Attack Simulation', 'zap'],
    ['detect', 'AI Detection Lab', 'scan-search'], ['federated', 'Federated Learning', 'network'], ['xai', 'Explainable AI', 'brain-circuit'],
    ['fleet', 'Fleet Monitoring', 'radar'], ['incidents', 'Incidents', 'siren'], ['research', 'Research Analytics', 'chart-column'],
    ['viva', 'Viva Mode', 'presentation'], ['about', 'Team & Docs', 'book-open'],
  ];
  let current = null, cleanup = null;
  function route() {
    const name = (location.hash.replace(/^#\/?/, '').split('?')[0]) || 'mission';
    const v = views[name] || views.mission;
    const key = views[name] ? name : 'mission';
    if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
    S.charts.forEach((c) => c.destroy()); S.charts = [];
    S.$$('.nav a').forEach((a) => { const on = a.dataset.route === key; a.classList.toggle('active', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
    S.$('#pageTitle').textContent = v.title; S.$('#pageSub').textContent = v.subtitle;
    document.title = 'SEAQL | ' + v.title;
    const host = S.$('#view');
    host.innerHTML = ''; host.className = 'view'; void host.offsetWidth; host.classList.add('view');
    current = key;
    cleanup = v.render(host) || null;
    S.icons();
    S.$('.sidebar').classList.remove('open'); S.$('#scrim').classList.remove('show');
    if (!S.firstRoute) S.firstRoute = true; else { window.scrollTo({ top: 0 }); host.focus({ preventScroll: true }); }
  }
  S.current = () => current;
  S.go = (name) => { location.hash = '#/' + name; };

  /* ---------------- shell ---------------- */
  function shell() {
    S.$('#brandLogo').innerHTML = S.logoSVG;
    S.$('#nav').innerHTML = S.NAV.map(([k, label, ic], i) => (i === 10 ? '<div class="sep" role="separator"></div>' : '') + `<a href="#/${k}" data-route="${k}"><i data-lucide="${ic}"></i><span>${label}</span></a>`).join('') +
      '<div class="sep" role="separator"></div><a href="index.html"><i data-lucide="globe"></i><span>Research Website</span></a>';
    const menu = S.$('#menuBtn'), side = S.$('.sidebar'), scrim = S.$('#scrim');
    menu.addEventListener('click', () => { side.classList.add('open'); scrim.classList.add('show'); });
    scrim.addEventListener('click', () => { side.classList.remove('open'); scrim.classList.remove('show'); S.closeDrawer && S.closeDrawer(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { side.classList.remove('open'); scrim.classList.remove('show'); S.closeDrawer && S.closeDrawer(); } });
    S.$('#simToggle').addEventListener('click', () => S.sim.toggle());
    S.$('#vivaBtn').addEventListener('click', () => S.go('viva'));
    S.$('#fsBtn').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => S.toast('Fullscreen not available', '', 'warn')); });
    document.addEventListener('fullscreenchange', () => { S.$('#fsBtn').innerHTML = document.fullscreenElement ? '<i data-lucide="minimize-2"></i>' : '<i data-lucide="maximize-2"></i>'; S.icons(); });
    const bell = S.$('#bellBtn'), pop = S.$('#notifPop');
    const paintPop = () => {
      pop.innerHTML = `<div class="np-h"><b>Notifications</b><span class="tag sim">Simulated</span></div>` + (st.alerts.length ? st.alerts.slice(0, 8).map((a) => `<button class="np-i" data-uav="${+a.uav.slice(4) - 1}"><span class="sev ${a.sev}">${a.sev}</span><span><b>${S.esc(a.title)}</b><small>${S.ago(a.t)} · ${S.esc(a.detail)}</small></span></button>`).join('') : '<div class="empty">No alerts</div>') + '<a class="np-all" href="#/incidents">Open Incident Center →</a>';
      S.icons();
    };
    bell.addEventListener('click', (e) => { e.stopPropagation(); const open = !pop.classList.contains('open'); pop.classList.toggle('open', open); bell.setAttribute('aria-expanded', open); if (open) { st.unread = 0; paintPop(); upd(); } });
    pop.addEventListener('click', (e) => { const b = e.target.closest('.np-i'); if (b && S.openUav) { pop.classList.remove('open'); S.openUav(+b.dataset.uav); } if (e.target.closest('.np-all')) pop.classList.remove('open'); });
    document.addEventListener('click', (e) => { if (!pop.contains(e.target) && e.target !== bell) pop.classList.remove('open'); });
    const upd = () => {
      const p = S.$('#simPill'), btn = S.$('#simToggle');
      const sev = S.sim.severity();
      p.className = 'pill ' + (!st.running ? 'paused' : sev === 'Critical' || sev === 'High' ? 'crit' : 'live');
      p.innerHTML = `<span class="dot ${!st.running ? 'amber' : sev === 'Critical' || sev === 'High' ? 'red' : ''}"></span>${st.running ? 'Live Simulation' : 'Simulation Paused'}`;
      btn.innerHTML = st.running ? '<i data-lucide="pause"></i><span>Pause</span>' : '<i data-lucide="play"></i><span>Start</span>';
      btn.className = 'btn sm ' + (st.running ? '' : 'success');
      const badge = S.$('#bellCount'); badge.textContent = st.unread > 9 ? '9+' : st.unread; badge.hidden = !st.unread;
      S.$('#sideStatus').innerHTML = `<div class="row"><span class="dot ${st.running ? '' : 'amber'}"></span><b>${st.running ? 'Simulation running' : 'Simulation paused'}</b></div><div style="margin-top:6px">${SCEN[st.scenario].name} · ${st.speed}× speed</div><div class="muted" style="margin-top:4px">Simulated swarm · no live UAVs</div>`;
      S.icons();
    };
    S.subscribe(upd); upd();
    setInterval(() => { S.$('#clock').textContent = new Date().toLocaleTimeString('en-GB', { hour12: false }); }, 1000);
    S.$('#clock').textContent = new Date().toLocaleTimeString('en-GB', { hour12: false });
  }

  /* ---------------- guided FYP demo (deterministic, simulated) ---------------- */
  const DEMO = [
    [0, 'normal', 'Step 1/5 · Baseline: 8 UAVs in 2 clusters exchange benign traffic with the aggregator.'],
    [6, 'dos', 'Step 2/5 · DoS flood injected on UAV-03 and UAV-07 — packet rate spikes, nodes turn amber then red.'],
    [16, null, 'Step 3/5 · Simulated detector raises critical alerts and opens incidents. Click a red drone for details.'],
    [24, 'replay', 'Step 4/5 · Replay attack on UAV-06 — repeated sequence numbers (wlan.seq, the top XAI feature).'],
    [34, 'recovery', 'Step 5/5 · Recovery: compromised nodes isolated and restored. Try real detection in the AI Detection Lab.'],
    [44, 'end', ''],
  ];
  let demoUnsub = null;
  S.demo = {
    active: false, text: '', step: -1,
    start() {
      S.demo.stop(true); S.sim.reset(); S.sim.setSpeed(1); S.demo.active = true; let t0 = st.tick; let i = 0;
      const run = () => {
        while (i < DEMO.length && st.tick - t0 >= DEMO[i][0]) {
          const [, sc, text] = DEMO[i];
          if (sc === 'end') { S.demo.stop(); S.toast('Demo complete', 'Every event shown was simulated and is reproducible', 'ok'); return; }
          if (sc) S.sim.setScenario(sc, true);
          S.demo.text = text; S.demo.step = i; i++;
        }
      };
      demoUnsub = S.subscribe(run); run(); emit();
      S.toast('FYP demo started', 'Scripted, reproducible simulation — about 45 seconds', 'info');
    },
    stop(silent) { if (demoUnsub) { demoUnsub(); demoUnsub = null; } S.demo.active = false; S.demo.text = ''; S.demo.step = -1; if (!silent) emit(); },
  };

  S.boot = () => { shell(); window.addEventListener('hashchange', route); route(); };
})();
