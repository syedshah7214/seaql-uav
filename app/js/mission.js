/* SEAQL v5 — UAV Mission Control (landing page)
   Abstract mission map (procedural terrain, NOT real geography / GPS), threat analytics,
   security heatmap, fleet strip, alerts and event timeline. All live values come from the
   shared simulation state in core.js; research numbers come from recorded experiment files. */
(function () {
  'use strict';
  const { $, $$, esc, num, pct, time, ago, hms } = S;
  const D = S.data;
  const W = 1000, H = 560;
  const GS = { x: 500, y: 300 };                       // ground-station / global aggregator
  const CC = { A: { x: 262, y: 255 }, B: { x: 738, y: 285 } }; // cluster relay centres
  const SRC = { x: 70, y: 500 };                        // simulated attack source (illustrative)
  const SEVC = { critical: '#FF2E55', high: '#FF8A3D', medium: '#FFC23D', low: '#22B8FF' };

  /* ---------- procedural terrain (deterministic value noise, rendered once) ---------- */
  function terrain() {
    if (S._terrain) return S._terrain;
    const w = 1000, h = 560, c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); const img = g.createImageData(w, h);
    let sd = 9001; const R = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    const N = 64, grid = Array.from({ length: N * N }, R);
    const val = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const at = (a, b) => grid[((b % N + N) % N) * N + ((a % N + N) % N)];
      const s = (t) => t * t * (3 - 2 * t); const u = s(xf), v = s(yf);
      return (at(xi, yi) * (1 - u) + at(xi + 1, yi) * u) * (1 - v) + (at(xi, yi + 1) * (1 - u) + at(xi + 1, yi + 1) * u) * v; };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let f = 0, a = 1, fr = 1 / 120, tot = 0;
      for (let o = 0; o < 4; o++) { f += val(x * fr, y * fr) * a; tot += a; a *= 0.5; fr *= 2; }
      f /= tot;
      const band = (f * 14) % 1; const line = band < 0.06 ? 1 : 0; const major = (f * 14) % 5 < 0.08 ? 1 : 0;
      const i = (y * w + x) * 4;
      const base = 10 + f * 26;
      img.data[i] = 4 + base * 0.25 + line * 10;
      img.data[i + 1] = 14 + base * 0.75 + line * 38 + major * 18;
      img.data[i + 2] = 26 + base * 1.1 + line * 52 + major * 26;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    // vignette
    const vg = g.createRadialGradient(w / 2, h / 2, 120, w / 2, h / 2, 620); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(2,6,14,.7)');
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
    S._terrain = c.toDataURL('image/jpeg', 0.85);
    return S._terrain;
  }

  // deterministic drone positions: slow orbit around the cluster relay (illustrative layout only)
  const cmap = D.clusterMap || [[0, 2, 4, 6], [1, 3, 5, 7]];
  function dronePos(u, t) {
    const k = cmap[u.cluster === 'A' ? 0 : 1].indexOf(u.idx);
    const c = CC[u.cluster];
    const a = k * (Math.PI / 2) + (u.cluster === 'A' ? 0.6 : 2.2) + t * 0.05 * (u.cluster === 'A' ? 1 : -1);
    const r = 112 + (k % 2) * 26;
    return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r * 0.72, hdg: (a * 180) / Math.PI + (u.cluster === 'A' ? 90 : -90) };
  }
  const simCoord = (p) => `${(p.x / 100).toFixed(2)} km E · ${((H - p.y) / 100).toFixed(2)} km N`;

  const droneGlyph = (col) => `<g class="mk-body"><circle r="22" fill="${col}" opacity=".13"/><g stroke="${col}" stroke-width="2.2" stroke-linecap="round"><path d="M0 0 L-9 -9 M0 0 L9 -9 M0 0 L-9 9 M0 0 L9 9"/></g>
    <g fill="none" stroke="${col}" stroke-width="1.6"><circle cx="-10" cy="-10" r="5"/><circle cx="10" cy="-10" r="5"/><circle cx="-10" cy="10" r="5"/><circle cx="10" cy="10" r="5"/></g>
    <rect x="-5" y="-5" width="10" height="10" rx="3" fill="#06121F" stroke="${col}" stroke-width="1.8"/><path d="M0 -14 L3 -9 L-3 -9 Z" fill="${col}"/></g>`;

  function spark(arr, color, h = 34) {
    if (!arr || arr.length < 2) return `<svg class="kspark" viewBox="0 0 120 ${h}"></svg>`;
    const max = Math.max(...arr), min = Math.min(...arr), rng = max - min || 1;
    const pts = arr.map((v, i) => `${(i / (arr.length - 1) * 120).toFixed(1)},${(h - 3 - (v - min) / rng * (h - 8)).toFixed(1)}`).join(' ');
    return `<svg class="kspark" viewBox="0 0 120 ${h}" preserveAspectRatio="none"><polyline points="0,${h} ${pts} 120,${h}" fill="${color}" fill-opacity=".14"/><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.8" vector-effect="non-scaling-stroke"/></svg>`;
  }

  S.view('mission', {
    title: 'UAV Mission Control',
    subtitle: 'Swarm cybersecurity command & control · simulated operations, verified research results',
    render(el) {
      const hb = D.hybridBinary || {}, ft = D.federatedTest || {}, lh = (D.liveHybrid || {}).heldout_metrics || {};
      el.innerHTML = `
      <div class="mission-bar">
        <div class="mb-left"><span class="mb-id"><i data-lucide="satellite-dish"></i>MISSION SWARM-SEC-01</span><span class="mb-chip" id="mcScenChip"></span><span class="mb-chip mono" id="mcElapsed"></span><span class="tag sim"><i data-lucide="flask-conical"></i>Interactive simulation</span></div>
        <div class="mb-right"><div class="seg seg-scen" id="mcScen" role="group" aria-label="Attack scenario">${Object.entries(S.SCEN).map(([k, v]) => `<button data-k="${k}" class="sc-${k}">${v.name.replace(' Traffic', '').replace(' Attack', '')}</button>`).join('')}</div>
          <button class="btn sm" id="mcReset"><i data-lucide="rotate-ccw"></i>Reset</button><button class="btn sm demo-cta" id="mcDemo"><i data-lucide="circle-play"></i>Start FYP Demo</button></div>
      </div>
      <div class="demo-banner" id="mcDemoBar" hidden><span class="pulse-dot"></span><span id="mcDemoText"></span><button class="btn sm ghost" id="mcDemoStop">Stop demo</button></div>
      <section class="kpis5" id="mcKpis" aria-label="Key indicators"></section>
      <div class="mc-grid">
        <article class="panel map-panel">
          <div class="panel-h"><div><h2>UAV Swarm Mission Map</h2><p>8 UAVs · 2 federated clusters · ground-station aggregator · drag to pan, scroll to zoom, click a drone</p></div>
            <div class="right"><span class="tag sim" title="Abstract sector map with simulated coordinates — not GPS"><i data-lucide="map"></i>Simulated sector · not GPS</span><a class="btn sm" href="#/swarm"><i data-lucide="rotate-3d"></i>3D view</a></div></div>
          <div class="map" id="mcMap">
            <svg id="mcSvg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Abstract mission map of the UAV swarm">
              <defs>
                <filter id="mglow" filterUnits="userSpaceOnUse" x="-100" y="-100" width="1200" height="760"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                <radialGradient id="zoneR"><stop offset="0" stop-color="#FF2E55" stop-opacity=".45"/><stop offset=".6" stop-color="#FF2E55" stop-opacity=".12"/><stop offset="1" stop-color="#FF2E55" stop-opacity="0"/></radialGradient>
                <radialGradient id="zoneA"><stop offset="0" stop-color="#FFC23D" stop-opacity=".38"/><stop offset="1" stop-color="#FFC23D" stop-opacity="0"/></radialGradient>
                <radialGradient id="gsG"><stop offset="0" stop-color="#00D9FF" stop-opacity=".5"/><stop offset="1" stop-color="#00D9FF" stop-opacity="0"/></radialGradient>
                <pattern id="mgrid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0 L0 0 0 50" fill="none" stroke="rgba(0,217,255,.07)" stroke-width="1"/></pattern>
              </defs>
              <g id="mcWorld">
                <image href="${terrain()}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none" opacity=".95"/>
                <rect width="${W}" height="${H}" fill="url(#mgrid)"/>
                ${['A', 'B'].map((c) => `<ellipse cx="${CC[c].x}" cy="${CC[c].y}" rx="168" ry="128" fill="${c === 'A' ? 'rgba(0,217,255,.045)' : 'rgba(161,91,255,.06)'}" stroke="${c === 'A' ? '#00D9FF' : '#A15BFF'}" stroke-opacity=".55" stroke-dasharray="6 6"/>
                  <text x="${CC[c].x}" y="${CC[c].y - 140}" text-anchor="middle" class="map-lbl" fill="${c === 'A' ? '#00D9FF' : '#C59BFF'}">CLUSTER ${c} SECTOR</text>`).join('')}
                <g id="mcZones"></g><g id="mcLinks"></g><g id="mcPk"></g>
                ${['A', 'B'].map((c) => `<g transform="translate(${CC[c].x} ${CC[c].y})"><circle r="11" fill="#06121F" stroke="${c === 'A' ? '#00D9FF' : '#A15BFF'}" stroke-width="2" filter="url(#mglow)"/><path d="M0 -5 L4.5 -2.5 L4.5 2.5 L0 5 L-4.5 2.5 L-4.5 -2.5 Z" fill="${c === 'A' ? '#00D9FF' : '#A15BFF'}"/><text y="25" text-anchor="middle" class="map-sm" fill="#A9BCD6">Relay ${c}</text></g>`).join('')}
                <g transform="translate(${GS.x} ${GS.y})"><circle r="70" fill="url(#gsG)"/><circle r="34" fill="none" stroke="#00D9FF" stroke-opacity=".5" ${S.reduced ? '' : 'class="pulse-ring"'}/>
                  <g filter="url(#mglow)"><path d="M0 -22 L19 -11 L0 0 L-19 -11 Z" fill="#7DF0FF"/><path d="M-19 -11 L0 0 L0 21 L-19 10 Z" fill="#0A6FD8"/><path d="M19 -11 L0 0 L0 21 L19 10 Z" fill="#0791E8"/></g>
                  <text y="42" text-anchor="middle" class="map-lbl" fill="#EAF4FF">GLOBAL AGGREGATOR</text></g>
                <g id="mcSrc"></g>
                <g id="mcDrones"></g>
              </g>
            </svg>
            <div class="map-tools"><button class="btn sm icon" id="mzIn" aria-label="Zoom in"><i data-lucide="zoom-in"></i></button><button class="btn sm icon" id="mzOut" aria-label="Zoom out"><i data-lucide="zoom-out"></i></button><button class="btn sm icon" id="mzHome" aria-label="Reset view"><i data-lucide="locate"></i></button></div>
            <div class="map-legend"><span><i class="lg normal"></i>Normal</span><span><i class="lg suspicious"></i>Suspicious</span><span><i class="lg attack"></i>Under attack</span><span><i class="lg training"></i>Training</span><span><i class="zone-key"></i>Threat zone</span></div>
            <div class="map-compass" aria-hidden="true"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="rgba(6,16,32,.7)" stroke="rgba(0,217,255,.4)"/><path d="M20 6 L24 20 L20 17 L16 20 Z" fill="#00D9FF"/><path d="M20 34 L24 20 L20 23 L16 20 Z" fill="#41597a"/><text x="20" y="5" font-size="6" fill="#A9BCD6" text-anchor="middle">N</text></svg></div>
                        <div class="map-coord mono" id="mcCoord">SIM GRID · 10.0 × 5.6 km</div>
          </div>
          <div class="map-sel" id="mcSel"></div>
        </article>
        <div class="mc-right">
          <article class="panel threat-panel" id="mcThreat"></article>
          <article class="panel"><div class="panel-h"><div><h3>Threat Alerts</h3><p>Latest simulated detections</p></div><a class="btn sm ghost" href="#/incidents">All</a></div><div class="alerts compact" id="mcAlerts"></div></article>
        </div>
      </div>
      <div class="mc-row2">
        <article class="panel"><div class="panel-h"><div><h3>Security Events Over Time</h3><p>Node-level simulated detections per second, stacked by severity</p></div>
          <div class="right"><div class="seg" id="mcRange"><button data-n="60" class="on">1m</button><button data-n="180">3m</button><button data-n="300">5m</button></div></div></div>
          <div class="chart-box"><canvas id="mcSev" aria-label="Security events over time"></canvas></div></article>
        <article class="panel"><div class="panel-h"><div><h3>UAV Communication Heatmap</h3><p>Packets/s per UAV, last 60 s (log colour scale)</p></div><span class="tag sim">Sim</span></div>
          <div class="heat-wrap"><canvas id="mcHeat" aria-label="UAV communication heatmap"></canvas><div class="heat-tip" id="mcHeatTip"></div></div>
          <div class="heat-scale"><span>~150</span><i></i><span>8k pkt/s</span></div></article>
      </div>
      <div class="mc-row3">
        <article class="panel"><div class="panel-h"><div><h3>Network Traffic</h3><p>Swarm packets/s · benign vs malicious</p></div><span class="pill" id="mcRate" style="padding:4px 10px"></span></div><div class="chart-box sm"><canvas id="mcTraffic"></canvas></div></article>
        <article class="panel"><div class="panel-h"><div><h3>Cluster Status</h3><p>Federated clusters (real membership)</p></div></div><div id="mcClusters" class="cl-grid"></div></article>
        <article class="panel"><div class="panel-h"><div><h3>Research Performance</h3><p>Recorded results · not live</p></div><span class="tag verified"><i data-lucide="badge-check"></i>Verified</span></div>
          <div class="rp">
            <div class="rp-main"><small>Final Hybrid AE-Stack · binary</small><div class="rp-nums"><span><b>${pct(hb.accuracy)}</b>Accuracy</span><span><b>${pct(hb.macro_f1)}</b>Macro F1</span><span><b>${pct(hb.auc)}</b>AUC</span></div></div>
            <div class="rp-row"><span>Federated MLP · 3-class macro F1</span><b class="c-purple">${pct(ft.macroF1)}</b></div>
            <div class="rp-row"><span>Live Hybrid model (re-trained, served) · held-out acc.</span><b class="c-cyan">${pct(lh.accuracy)}</b></div>
            <p class="muted" style="font-size:11px;margin:6px 0 0">The AI Detection Lab serves the Hybrid AE-Stacked Ensemble re-trained with the original script; Random Forest is kept as a baseline.</p>
          </div></article>
      </div>
      <article class="panel mt"><div class="panel-h"><div><h3>UAV Fleet Operations</h3><p>Security state, cluster and last activity · click for inspection</p></div><a class="btn sm ghost" href="#/fleet">Fleet monitoring</a></div><div class="fleet-strip" id="mcFleet"></div></article>
      <article class="panel mt"><div class="panel-h"><div><h3>Mission Event Timeline</h3><p>Last 2 minutes of simulated events</p></div><button class="btn sm" id="mcExport"><i data-lucide="download"></i>Export log</button></div>
        <div class="tl-track" id="mcTrack"></div><ul class="timeline tl-cols" id="mcTl"></ul></article>`;

      /* ---------- controls ---------- */
      $('#mcScen').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; if (S.demo.active) S.demo.stop(true); S.sim.setScenario(b.dataset.k); S.sim.start(); };
      $('#mcReset').onclick = () => { S.demo.stop(true); S.sim.reset(); };
      $('#mcDemo').onclick = () => S.demo.start();
      $('#mcDemoStop').onclick = () => S.demo.stop();
      $('#mcExport').onclick = () => { const st = S.state(); S.download('seaql_mission_events.csv', S.csv([['time', 'level', 'event', 'category'], ...st.timeline.map((e) => [new Date(e.t).toISOString(), e.level, e.text, 'interactive simulation'])]), 'text/csv'); S.toast('Event log exported', 'seaql_mission_events.csv', 'ok'); };
      $('#mcFleet').onclick = (e) => { const c = e.target.closest('[data-idx]'); if (c) S.openUav(+c.dataset.idx); };
      $('#mcAlerts').onclick = (e) => { const b = e.target.closest('[data-uav]'); if (b) { selected = +b.dataset.uav; paintSel(S.state()); } };

      /* ---------- map: zoom / pan / select ---------- */
      const svg = $('#mcSvg'); let vb = { x: 0, y: 0, w: W, h: H }; let selected = 2;
      const setVB = () => { vb.w = Math.max(250, Math.min(W, vb.w)); vb.h = vb.w * H / W; vb.x = Math.max(0, Math.min(W - vb.w, vb.x)); vb.y = Math.max(0, Math.min(H - vb.h, vb.y)); svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`); $('#mcCoord').textContent = `SIM GRID · zoom ${(W / vb.w).toFixed(1)}× · ${(vb.w / 100).toFixed(1)} × ${(vb.h / 100).toFixed(1)} km`; };
      const zoom = (f, cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2) => { const nw = Math.max(250, Math.min(W, vb.w * f)); vb.x = cx - (cx - vb.x) * nw / vb.w; vb.y = cy - (cy - vb.y) * nw / vb.w; vb.w = nw; setVB(); };
      $('#mzIn').onclick = () => zoom(0.75); $('#mzOut').onclick = () => zoom(1.33); $('#mzHome').onclick = () => { vb = { x: 0, y: 0, w: W, h: H }; setVB(); };
      const toWorld = (e) => { const r = svg.getBoundingClientRect(); const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const p = pt.matrixTransform(svg.getScreenCTM().inverse()); return { x: p.x, y: p.y, r }; };
      svg.addEventListener('wheel', (e) => { e.preventDefault(); const p = toWorld(e); zoom(e.deltaY > 0 ? 1.15 : 0.87, p.x, p.y); }, { passive: false });
      let drag = null;
      svg.addEventListener('pointerdown', (e) => { if (e.target.closest('.mk')) return; drag = { x: e.clientX, y: e.clientY, vx: vb.x, vy: vb.y }; svg.setPointerCapture(e.pointerId); svg.classList.add('grabbing'); });
      svg.addEventListener('pointermove', (e) => { if (!drag) return; const r = svg.getBoundingClientRect(); const k = vb.w / r.width; vb.x = drag.vx - (e.clientX - drag.x) * k; vb.y = drag.vy - (e.clientY - drag.y) * k; setVB(); });
      svg.addEventListener('pointerup', () => { drag = null; svg.classList.remove('grabbing'); });
      setVB();

      // drone markers (built once, moved every frame)
      const dronesG = $('#mcDrones');
      const st0 = S.state();
      dronesG.innerHTML = st0.uavs.map((u) => `<g class="mk" data-idx="${u.idx}" tabindex="0" role="button" aria-label="${u.id}"><g class="mk-rot" ></g><g class="mk-ring"></g><text class="mk-lbl" y="36" text-anchor="middle">${u.id}</text></g>`).join('');
      const marks = $$('#mcDrones .mk');
      dronesG.addEventListener('click', (e) => { const m = e.target.closest('.mk'); if (m) { selected = +m.dataset.idx; paintSel(S.state()); paintMarkers(S.state(), true); } });
      dronesG.addEventListener('keydown', (e) => { const m = e.target.closest('.mk'); if (m && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); selected = +m.dataset.idx; paintSel(S.state()); paintMarkers(S.state(), true); } });

      let lastKey = '';
      function paintMarkers(st, force) {
        const key = st.uavs.map((u) => u.status).join() + selected;
        if (key === lastKey && !force) return; lastKey = key;
        marks.forEach((m, i) => {
          const u = st.uavs[i]; const col = S.COLORS[u.status];
          m.querySelector('.mk-rot').innerHTML = droneGlyph(col);
          m.querySelector('.mk-ring').innerHTML = (u.status === 'attack' || u.status === 'suspicious' ? `<circle r="26" fill="none" stroke="${col}" stroke-width="2" ${S.reduced ? '' : 'class="pulse-ring"'}/>` : '') + (i === selected ? '<circle r="30" fill="none" stroke="#fff" stroke-width="1.5" stroke-dasharray="4 4" class="sel-ring"/>' : '');
          m.querySelector('.mk-lbl').setAttribute('fill', u.status === 'normal' ? '#EAF4FF' : col);
          m.setAttribute('aria-label', `${u.id}, cluster ${u.cluster}, ${S.statusLabel(u.status)}`);
        });
      }

      // animation loop: positions, routes, packets, zones
      let raf = 0, alive = true, simT = S.state().tick, lastFrame = performance.now(); const pos = [];
      const linksG = $('#mcLinks'), pkG = $('#mcPk'), zonesG = $('#mcZones'), srcG = $('#mcSrc');
      function frame(now) {
        if (!alive) return; raf = requestAnimationFrame(frame);
        const st = S.state(); const dt = Math.min(0.1, (now - lastFrame) / 1000); lastFrame = now;
        if (st.running && !S.reduced) simT += dt * st.speed;
        let links = '', pk = '', zones = '';
        st.uavs.forEach((u, i) => {
          const p = dronePos(u, simT); pos[i] = p;
          marks[i].setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(1.3)`);
          marks[i].querySelector('.mk-rot').setAttribute('transform', `rotate(${p.hdg.toFixed(0)})`);
          const c = CC[u.cluster]; const hot = u.status === 'attack' || u.status === 'suspicious';
          const col = hot ? S.COLORS[u.status] : u.cluster === 'A' ? '#00D9FF' : '#A15BFF';
          links += `<line x1="${p.x.toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${c.x}" y2="${c.y}" stroke="${col}" stroke-opacity="${hot ? .9 : .45}" stroke-width="${hot ? 2.2 : 1.4}" ${hot ? 'stroke-dasharray="6 5"' : ''} filter="url(#mglow)"/>`;
          const n = u.status === 'attack' && u.attackType === 'DoS' ? 4 : 1;
          for (let k = 0; k < n; k++) { const f = ((simT * (n > 1 ? 1.2 : 0.45)) + k / n + i * 0.13) % 1; pk += `<circle cx="${(p.x + (c.x - p.x) * f).toFixed(1)}" cy="${(p.y + (c.y - p.y) * f).toFixed(1)}" r="${hot ? 3.2 : 2.4}" fill="${hot ? col : '#7DEBFF'}" filter="url(#mglow)"/>`; }
          if (hot) {
            const pr = S.reduced ? 1 : 1 + 0.12 * Math.sin(simT * 3 + i);
            zones += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(u.status === 'attack' ? 78 : 58) * pr}" fill="url(#${u.status === 'attack' ? 'zoneR' : 'zoneA'})"/>`;
            if (u.status === 'attack') { // simulated hostile path from the illustrative attack source
              links += `<path d="M${SRC.x} ${SRC.y} Q ${(SRC.x + p.x) / 2} ${Math.min(SRC.y, p.y) - 60} ${p.x.toFixed(1)} ${p.y.toFixed(1)}" fill="none" stroke="#FF2E55" stroke-width="1.6" stroke-dasharray="3 6" stroke-opacity=".8"/>`;
            }
          }
        });
        ['A', 'B'].forEach((c, ci) => { const hot = st.uavs.some((u) => u.cluster === c && u.status === 'attack'); const col = hot ? '#FF4D6A' : ci ? '#A15BFF' : '#00D9FF';
          links += `<line x1="${CC[c].x}" y1="${CC[c].y}" x2="${GS.x}" y2="${GS.y}" stroke="${col}" stroke-opacity=".75" stroke-width="2.4" filter="url(#mglow)"/>`;
          for (let k = 0; k < 2; k++) { const f = (simT * 0.35 + k / 2 + ci * 0.25) % 1; pk += `<circle cx="${(CC[c].x + (GS.x - CC[c].x) * f).toFixed(1)}" cy="${(CC[c].y + (GS.y - CC[c].y) * f).toFixed(1)}" r="3" fill="${col}" filter="url(#mglow)"/>`; } });
        linksG.innerHTML = links; pkG.innerHTML = pk; zonesG.innerHTML = zones;
        const anyAtt = st.uavs.some((u) => u.status === 'attack');
        srcG.innerHTML = anyAtt ? `<g transform="translate(${SRC.x} ${SRC.y})"><circle r="16" fill="rgba(255,46,85,.15)" stroke="#FF2E55" stroke-width="1.6" ${S.reduced ? '' : 'class="pulse-ring"'}/><path d="M-6 -6 L6 6 M6 -6 L-6 6" stroke="#FF2E55" stroke-width="2.4"/><text y="30" text-anchor="middle" class="map-sm" fill="#FF8A9E">Attack source (simulated)</text></g>` : '';
        if (pos[selected]) $('#mcSelCoord') && ($('#mcSelCoord').textContent = simCoord(pos[selected]));
      }
      raf = requestAnimationFrame(frame);

      /* ---------- charts ---------- */
      let range = 60;
      $('#mcRange').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; range = +b.dataset.n; $$('#mcRange button').forEach((x) => x.classList.toggle('on', x === b)); paintCharts(S.state()); };
      const sctx = $('#mcSev').getContext('2d');
      const sevKeys = ['critical', 'high', 'medium', 'low'];
      const sev = S.chart($('#mcSev'), { type: 'line', data: { labels: [], datasets: sevKeys.map((k) => ({ label: k[0].toUpperCase() + k.slice(1), data: [], borderColor: SEVC[k], backgroundColor: S.gradient(sctx, 220, SEVC[k] + 'AA', SEVC[k] + '10'), fill: true, stack: 's', tension: .35, pointRadius: 0, borderWidth: 1.6 })) },
        options: { animation: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'top', align: 'end' }, tooltip: { callbacks: { footer: (items) => 'Total: ' + items.reduce((a, b) => a + b.raw, 0) + ' events/s' } } },
          scales: { x: { ticks: { maxTicksLimit: 7, maxRotation: 0 }, grid: { display: false } }, y: { stacked: true, beginAtZero: true, suggestedMax: 4, ticks: { precision: 0 }, title: { display: true, text: 'events / s' } } } } });
      const tctx = $('#mcTraffic').getContext('2d');
      const traffic = S.chart($('#mcTraffic'), { type: 'line', data: { labels: [], datasets: [
        { label: 'Benign', data: [], borderColor: '#00D9FF', backgroundColor: S.gradient(tctx, 170, 'rgba(0,217,255,.35)', 'rgba(0,217,255,0)'), fill: true, tension: .35, pointRadius: 0, borderWidth: 2 },
        { label: 'Malicious', data: [], borderColor: '#FF4D6A', backgroundColor: S.gradient(tctx, 170, 'rgba(255,77,106,.3)', 'rgba(255,77,106,0)'), fill: true, tension: .35, pointRadius: 0, borderWidth: 2 }] },
        options: { animation: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { beginAtZero: true, ticks: { maxTicksLimit: 4, callback: (v) => (v >= 1000 ? v / 1000 + 'k' : v) } } } } });

      // heatmap
      const hc = $('#mcHeat'), tip = $('#mcHeatTip');
      const heatColor = (v) => { const t = Math.max(0, Math.min(1, (Math.log10(Math.max(v, 100)) - 2.15) / (3.95 - 2.15)));
        const stops = [[0, [10, 30, 60]], [0.18, [0, 120, 200]], [0.35, [0, 217, 255]], [0.6, [255, 194, 61]], [1, [255, 46, 85]]];
        for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) { const [a, ca] = stops[i - 1], [b, cb] = stops[i]; const f = (t - a) / (b - a); return `rgb(${ca.map((c, k) => Math.round(c + (cb[k] - c) * f)).join(',')})`; }
        return 'rgb(255,46,85)'; };
      function paintHeat(st) {
        const r = hc.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
        if (!r.width) return;
        hc.width = r.width * dpr; hc.height = r.height * dpr; const g = hc.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, r.width, r.height);
        const L = 58, cols = 60, rows = 8, cw = (r.width - L) / cols, rh = (r.height - 18) / rows;
        g.font = '600 10.5px "JetBrains Mono", monospace'; g.textBaseline = 'middle';
        st.uavs.forEach((u, ri) => {
          g.fillStyle = u.status === 'normal' ? '#A9BCD6' : S.COLORS[u.status]; g.fillText(u.id, 0, ri * rh + rh / 2);
          const h = u.history.slice(-cols); const off = cols - h.length;
          h.forEach((v, ci) => { g.fillStyle = heatColor(v); g.fillRect(L + (off + ci) * cw + 0.5, ri * rh + 1.5, cw - 1, rh - 3); });
        });
        g.fillStyle = '#6F86A6'; g.font = '10px Inter'; g.textBaseline = 'top'; g.fillText('−60 s', L, r.height - 13); g.textAlign = 'right'; g.fillText('now', r.width, r.height - 13); g.textAlign = 'left';
        hc._geo = { L, cw, rh, cols };
      }
      hc.addEventListener('mousemove', (e) => {
        const gm = hc._geo; if (!gm) return; const r = hc.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
        const ci = Math.floor((x - gm.L) / gm.cw), ri = Math.floor(y / gm.rh); const u = S.state().uavs[ri];
        if (ci < 0 || !u || ci >= gm.cols) { tip.classList.remove('show'); return; }
        const h = u.history.slice(-gm.cols); const v = h[ci - (gm.cols - h.length)];
        if (v == null) { tip.classList.remove('show'); return; }
        tip.innerHTML = `<b class="mono">${u.id}</b> · ${gm.cols - ci} s ago<br><span class="mono">${num(v)} pkt/s</span>`; tip.style.left = Math.min(r.width - 130, x + 12) + 'px'; tip.style.top = Math.max(0, y - 40) + 'px'; tip.classList.add('show');
      });
      hc.addEventListener('mouseleave', () => tip.classList.remove('show'));
      const ro = new ResizeObserver(() => paintHeat(S.state())); ro.observe(hc);

      function paintCharts(st) {
        const sv = st.sev.slice(-range);
        sev.data.labels = sv.map((p) => time(p.t).slice(3)); sevKeys.forEach((k, i) => (sev.data.datasets[i].data = sv.map((p) => p[k]))); sev.update('none');
        traffic.data.labels = st.traffic.map((p) => time(p.t)); traffic.data.datasets[0].data = st.traffic.map((p) => p.benign); traffic.data.datasets[1].data = st.traffic.map((p) => p.malicious); traffic.update('none');
        const last = st.traffic.at(-1) || { benign: 0, malicious: 0 };
        $('#mcRate').innerHTML = `<span class="dot ${last.malicious ? 'red' : ''}"></span>${num(last.benign + last.malicious)} pkt/s`;
      }

      /* ---------- panels ---------- */
      function kpis(st) {
        const att = st.uavs.filter((u) => u.status === 'attack').length, sus = st.uavs.filter((u) => u.status === 'suspicious').length;
        const sevTxt = S.sim.severity(); const sc = S.sim.score(); const open = st.incidents.filter((i) => i.status === 'Open').length;
        const K = st.kpi;
        const card = (cls, icon, label, val, unit, sub, arr, col, stat) => `<article class="k5 ${cls}"><div class="k5-top"><span class="k5-ic"><i data-lucide="${icon}"></i></span><span class="k5-l">${label}</span><span class="k5-st ${stat[0]}">${stat[1]}</span></div><div class="k5-v"><strong>${val}</strong>${unit ? `<em>${unit}</em>` : ''}</div><div class="k5-b"><small>${sub}</small>${spark(arr, col)}</div></article>`;
        $('#mcKpis').innerHTML =
          card('c-cy', 'plane', 'Total UAVs', 8, '', '2 clusters · 4 + 4', Array(20).fill(8), '#00D9FF', ['ok', '● Online']) +
          card(att ? 'c-am' : 'c-gr', 'radio-tower', 'Active UAVs', 8 - att, '/ 8', att ? `${att} compromised` : 'all nodes healthy', K.active, '#22E39A', att ? ['bad', '▼ ' + att] : ['ok', '● Nominal']) +
          card(sevTxt === 'Low' ? 'c-gr' : sevTxt === 'Medium' ? 'c-am' : 'c-rd', 'shield-alert', 'Threat Level', sevTxt, '', `${att} attacking · ${sus} suspicious`, K.threat, sevTxt === 'Low' ? '#22E39A' : '#FF4D6A', sevTxt === 'Low' ? ['ok', '● Clear'] : ['bad', '▲ Active']) +
          card(sc >= 90 ? 'c-gr' : sc >= 75 ? 'c-am' : 'c-rd', 'activity', 'Network Health', sc.toFixed(1), '/ 100', 'simulated swarm score', K.health, sc >= 90 ? '#22E39A' : '#FFC23D', sc >= 90 ? ['ok', '● Good'] : ['bad', '▼ Degraded']) +
          card('c-pu', 'siren', 'Detected Attacks', st.incidents.length, '', `${open} open · ${st.incidents.length - open} resolved`, K.attacks, '#A15BFF', open ? ['bad', open + ' open'] : ['ok', '● None open']);
      }
      function threat(st) {
        const inc = st.incidents.find((i) => i.status === 'Open');
        if (!inc) {
          $('#mcThreat').innerHTML = `<div class="panel-h"><h3>Threat Detail</h3><span class="chip green">No active threat</span></div>
            <div class="empty" style="padding:16px 8px"><i data-lucide="shield-check" style="color:var(--green)"></i>All 8 UAVs within normal traffic range.<br>Launch a scenario to see detection in action.</div>
            <div class="th-actions"><button class="btn sm danger" data-sc="dos"><i data-lucide="zap"></i>Simulate DoS</button><button class="btn sm" data-sc="replay"><i data-lucide="repeat"></i>Simulate Replay</button></div>`;
        } else {
          const u = st.uavs.find((x) => x.id === inc.uav);
          $('#mcThreat').innerHTML = `<div class="panel-h"><h3>Threat Detail</h3><span class="sev ${inc.sev}">${inc.sev}</span></div>
            <div class="th-head"><span class="th-ic"><i data-lucide="${inc.type === 'DoS' ? 'zap' : 'repeat'}"></i></span><div><b>${inc.type} attack on ${inc.uav}</b><small>${inc.id} · Cluster ${inc.cluster} · ${hms(st.simNow - inc.start)} active</small></div></div>
            <dl class="kv th-kv"><dt>Current rate</dt><dd class="mono c-red">${num(u.rate)} pkt/s</dd><dt>Peak rate</dt><dd class="mono">${num(inc.peakRate)} pkt/s</dd><dt>Packets in incident</dt><dd class="mono">${num(inc.packets)}</dd>
            <dt>Indicator</dt><dd>${inc.type === 'DoS' ? 'flooding · tiny inter-arrival gaps' : 'repeated wlan.seq values'}</dd></dl>
            <div class="th-feat">${inc.features.slice(0, 3).map((f) => `<span><small>${f.f}</small><b class="mono">${f.observed}</b><em>benign med. ${f.benign ?? '—'}</em></span>`).join('')}</div>
            <p class="muted" style="font-size:10.5px;margin:6px 0 10px">Simulated incident. Benign medians are real dataset values.</p>
            <div class="th-actions"><button class="btn sm primary" data-act="lab"><i data-lucide="scan-search"></i>Open AI Detection Lab</button><button class="btn sm" data-act="inspect"><i data-lucide="crosshair"></i>Inspect ${inc.uav}</button><button class="btn sm" data-sc="recovery"><i data-lucide="shield-check"></i>Recover</button><button class="btn sm ghost" data-act="reset"><i data-lucide="rotate-ccw"></i>Reset</button></div>`;
          $('#mcThreat').dataset.uav = +inc.uav.slice(4) - 1;
        }
      }
      $('#mcThreat').onclick = (e) => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.sc) { S.demo.stop(true); S.sim.setScenario(b.dataset.sc); S.sim.start(); }
        if (b.dataset.act === 'lab') S.go('detect');
        if (b.dataset.act === 'inspect') S.openUav(+$('#mcThreat').dataset.uav);
        if (b.dataset.act === 'reset') { S.demo.stop(true); S.sim.reset(); }
      };
      function paintSel(st) {
        const u = st.uavs[selected]; const p = pos[selected] || dronePos(u, simT);
        $('#mcSel').innerHTML = `<span class="ms-id"><span class="ms-art">${S.droneSVG(S.COLORS[u.status], false)}</span><span><small>Selected UAV</small><b class="mono">${u.id}</b></span></span><span class="status-badge ${u.status}">${S.statusLabel(u.status)}</span>
          <span class="ms-f"><small>Cluster</small><b>${u.cluster} · client ${u.idx}</b></span><span class="ms-f"><small>Traffic</small><b class="mono">${num(u.rate)} pkt/s</b></span><span class="ms-f"><small>Sim position (not GPS)</small><b class="mono" id="mcSelCoord">${simCoord(p)}</b></span><span class="ms-f"><small>Last activity</small><b class="mono">${time(u.lastSeen)}</b></span>
          <button class="btn sm" id="mcSelOpen"><i data-lucide="crosshair"></i>Inspect</button>`;
        $('#mcSelOpen').onclick = () => S.openUav(selected);
      }
      function clusters(st) {
        $('#mcClusters').innerHTML = ['A', 'B'].map((c, ci) => { const m = st.uavs.filter((u) => u.cluster === c);
          return `<div class="cl-card ${ci ? 'b' : 'a'}"><div class="cl-h"><b>Cluster ${c}</b><span>${m.filter((u) => u.status === 'attack').length ? '<span class="chip red">threat</span>' : '<span class="chip green">secure</span>'}</span></div>
            <div class="cl-m">${m.map((u) => `<span class="cl-u ${u.status}" title="${u.id}: ${S.statusLabel(u.status)}"><i></i>${u.id.slice(4)}</span>`).join('')}</div>
            <small class="muted">${num(m.reduce((a, u) => a + u.rate, 0))} pkt/s · relay → aggregator</small></div>`; }).join('');
      }
      function fleet(st) {
        $('#mcFleet').innerHTML = st.uavs.map((u) => `<button class="fs-card ${u.status}" data-idx="${u.idx}"><span class="fs-art">${S.droneSVG(S.COLORS[u.status], false)}</span><span class="fs-t"><b class="mono">${u.id}</b><small class="${u.cluster === 'B' ? 'c-purple' : 'c-cyan'}">Cluster ${u.cluster}</small></span><span class="status-badge ${u.status}">${S.statusLabel(u.status)}</span>${spark(u.history.slice(-30), S.COLORS[u.status], 26)}<span class="fs-m"><span class="mono">${num(u.rate)} pkt/s</span><span>${ago(u.lastSeen)}</span></span></button>`).join('');
      }
      function timeline(st) {
        const now = st.simNow, span = 120000;
        const ev = st.timeline.filter((e) => now - e.t <= span);
        $('#mcTrack').innerHTML = `<div class="tt-axis">${[120, 90, 60, 30, 0].map((s) => `<span style="left:${100 - s / 1.2}%">${s ? '−' + s + 's' : 'now'}</span>`).join('')}</div>` +
          ev.map((e) => `<i class="tt-m ${e.level}" style="left:${100 - (now - e.t) / span * 100}%" title="${time(e.t)} · ${esc(e.text)}"></i>`).join('');
        $('#mcTl').innerHTML = st.timeline.slice(0, 8).map((e) => `<li><time>${time(e.t)}</time><span class="tl-dot"><i class="${e.level}"></i></span><span>${esc(e.text)}</span></li>`).join('');
      }
      function paint(st) {
        $$('#mcScen button').forEach((b) => b.classList.toggle('on', b.dataset.k === st.scenario));
        $('#mcScenChip').innerHTML = `<span class="dot ${st.scenario === 'normal' ? '' : st.scenario === 'recovery' ? 'amber' : 'red'}"></span>${S.SCEN[st.scenario].name}`;
        $('#mcElapsed').textContent = hms(S.sim.elapsed());
        $('#mcDemoBar').hidden = !S.demo.active; $('#mcDemoText').textContent = S.demo.text;
        $('#mcDemo').innerHTML = S.demo.active ? '<i data-lucide="rotate-ccw"></i>Restart demo' : '<i data-lucide="circle-play"></i>Start FYP Demo';
        kpis(st); threat(st); paintMarkers(st); paintSel(st); clusters(st); fleet(st); timeline(st); paintCharts(st); paintHeat(st);
        $('#mcAlerts').innerHTML = st.alerts.length ? st.alerts.slice(0, 6).map((a) => `<button class="alert" data-uav="${+a.uav.slice(4) - 1}"><span class="ai ${a.sev}"><i data-lucide="${a.sev === 'low' ? 'circle-check' : a.sev === 'medium' ? 'triangle-alert' : 'shield-alert'}"></i></span><span><b>${esc(a.title)}</b><small>${esc(a.detail)}</small></span><time>${ago(a.t)}</time></button>`).join('') : '<div class="empty"><i data-lucide="shield-check"></i>No alerts</div>';
        S.icons();
      }
      paint(S.state());
      const un = S.subscribe(paint);
      return () => { alive = false; cancelAnimationFrame(raf); un(); ro.disconnect(); };
    },
  });
})();
