/* SEAQL — operations views: Command Center, Attack Lab, Fleet, Incidents */
(function () {
  'use strict';
  const { $, $$, esc, num, pct, time, ago, hms } = S;
  const D = S.data;
  const sevIcon = { critical: 'shield-alert', high: 'shield-alert', medium: 'triangle-alert', low: 'circle-check' };

  /* ------------------------------------------------------------------ */
  /* Shared drawer (UAV inspection + incident detail)                    */
  /* ------------------------------------------------------------------ */
  let drawerUnsub = null;
  function ensureDrawer() {
    let d = $('#drawer');
    if (!d) {
      d = document.createElement('aside'); d.id = 'drawer'; d.className = 'drawer'; d.setAttribute('aria-hidden', 'true');
      d.innerHTML = '<div class="drawer-h"><h3 id="drawerTitle" style="margin:0;font-size:16px"></h3><button class="btn sm icon" id="drawerClose" aria-label="Close panel"><i data-lucide="x"></i></button></div><div class="drawer-b" id="drawerBody"></div>';
      document.body.appendChild(d);
      $('#drawerClose').addEventListener('click', S.closeDrawer);
    }
    return d;
  }
  S.closeDrawer = () => {
    const d = $('#drawer'); if (!d) return;
    d.classList.remove('open'); d.setAttribute('aria-hidden', 'true'); $('#scrim').classList.remove('show');
    if (drawerUnsub) { drawerUnsub(); drawerUnsub = null; }
  };
  function openDrawer(title, renderBody) {
    const d = ensureDrawer();
    $('#drawerBody').onclick = null;
    if (drawerUnsub) { drawerUnsub(); drawerUnsub = null; }
    $('#drawerTitle').innerHTML = title;
    const paint = () => { $('#drawerBody').innerHTML = renderBody(); S.icons(); };
    paint(); drawerUnsub = S.subscribe(paint);
    d.classList.add('open'); d.setAttribute('aria-hidden', 'false'); $('#scrim').classList.add('show');
    setTimeout(() => $('#drawerClose').focus(), 50);
  }

  function spark(arr, color, w = 380, h = 60) {
    if (!arr.length) return '';
    const max = Math.max(...arr, 1), step = w / Math.max(1, arr.length - 1);
    const pts = arr.map((v, i) => `${(i * step).toFixed(1)},${(h - 4 - (v / max) * (h - 10)).toFixed(1)}`).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:${h}px"><polyline points="0,${h} ${pts} ${w},${h}" fill="${color}" fill-opacity=".12" stroke="none"/><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2"/></svg>`;
  }

  S.openUav = (idx) => {
    openDrawer(`<span class="mono">UAV-${S.pad(idx + 1)}</span> · inspection`, () => {
      const st = S.state(); const u = st.uavs[idx];
      const col = S.COLORS[u.status];
      const ni = (D.nonIid || [])[idx];
      const incs = st.incidents.filter((i) => i.uav === u.id);
      return `
        <div style="display:flex;align-items:center;gap:14px"><div style="width:110px">${S.droneSVG(col, st.running)}</div>
          <div><div class="status-badge ${u.status}">${S.statusLabel(u.status)}</div><div class="muted" style="margin-top:6px">Cluster ${u.cluster} · FL client ${idx}</div></div></div>
        <section><h4 class="sec-t">Connection & security ${S.tag.sim}</h4>
          <dl class="kv"><dt>Connection</dt><dd><span class="dot" style="display:inline-block;margin-right:6px"></span>Connected</dd>
          <dt>Security status</dt><dd style="color:${col}">${S.statusLabel(u.status)}${u.attackType ? ' · ' + u.attackType : ''}</dd>
          <dt>Network traffic</dt><dd class="mono">${num(u.rate)} pkt/s</dd><dt>Packets observed</dt><dd class="mono">${num(u.packets)}</dd>
          <dt>Last activity</dt><dd class="mono">${time(u.lastSeen)}</dd></dl>
          <div style="margin-top:10px">${spark(u.history, col)}</div></section>
        <section><h4 class="sec-t">Attack history</h4>
          ${incs.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Incident</th><th>Type</th><th>Status</th><th>Start</th></tr></thead><tbody>${incs.map((i) => `<tr><td class="mono">${i.id}</td><td><span class="cls ${i.type === 'DoS' ? 'dos' : 'replay'}">${i.type}</span></td><td>${i.status}</td><td class="mono">${time(i.start)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><i data-lucide="shield-check"></i>No incidents recorded for this UAV in this session</div>'}
        </section>
        ${ni ? `<section><h4 class="sec-t">Local training data (non-IID) ${S.tag.verified}</h4>
          <p class="muted" style="margin:0 0 8px;font-size:12px">Real Dirichlet(α = 0.30) partition assigned to FL client ${idx} in the recorded run.</p>
          <dl class="kv"><dt>Samples</dt><dd class="mono">${num(ni.samples)}</dd><dt>Benign</dt><dd class="mono" style="color:var(--green)">${num(ni.benign)}</dd><dt>DoS</dt><dd class="mono" style="color:var(--red)">${num(ni.dos)}</dd><dt>Replay</dt><dd class="mono" style="color:var(--amber)">${num(ni.replay)}</dd></dl></section>` : ''}
        <section><h4 class="sec-t">Flight telemetry ${S.tag.sim}</h4>
          <p class="muted" style="margin:0 0 8px;font-size:12px">The dataset has no battery / GPS / altitude fields, so these values are generated for demonstration only.</p>
          <dl class="kv"><dt>Battery</dt><dd class="mono">${u.battery.toFixed(1)}%</dd><dt>Altitude</dt><dd class="mono">${u.altitude.toFixed(1)} m</dd><dt>Signal</dt><dd class="mono">${u.signal.toFixed(1)} dBm</dd></dl></section>`;
    });
  };

  S.openIncident = (id) => {
    openDrawer(`<span class="mono">${esc(id)}</span> · incident`, () => {
      const inc = S.state().incidents.find((i) => i.id === id);
      if (!inc) return '<div class="empty">Incident no longer in session (simulation was reset).</div>';
      return `<div style="display:flex;gap:8px;flex-wrap:wrap"><span class="sev ${inc.sev}">${inc.sev}</span><span class="chip ${inc.status === 'Open' ? 'red' : 'green'}">${inc.status}</span>${S.tag.sim}</div>
        <dl class="kv"><dt>Attack type</dt><dd>${inc.type}</dd><dt>Affected UAV</dt><dd class="mono">${inc.uav} (Cluster ${inc.cluster})</dd>
        <dt>Detected</dt><dd class="mono">${new Date(inc.start).toLocaleString('en-GB')}</dd><dt>Duration</dt><dd class="mono">${hms((inc.end || S.state().simNow) - inc.start)}</dd>
        <dt>Peak rate</dt><dd class="mono">${num(inc.peakRate)} pkt/s</dd><dt>Packets in incident</dt><dd class="mono">${num(inc.packets)}</dd></dl>
        <section><h4 class="sec-t">Related packet features</h4>
          <p class="muted" style="font-size:12px;margin:0 0 8px">Observed values are simulated. The benign reference is the <b>real</b> median of benign rows in Dataset_T-ITS.csv. Features are the top-ranked ones from the permutation-importance analysis.</p>
          <div class="table-wrap"><table class="t"><thead><tr><th>Feature</th><th>Observed (sim)</th><th>Benign median (real)</th></tr></thead><tbody>
          ${inc.features.map((f) => `<tr><td class="mono">${f.f}</td><td class="mono">${f.observed}</td><td class="mono">${f.benign ?? '—'}</td></tr>`).join('')}</tbody></table></div></section>
        <section><h4 class="sec-t">Event timeline</h4><ul class="timeline">${inc.events.map((e) => `<li><time>${time(e.t)}</time><span class="tl-dot"><i class="${inc.sev}"></i></span><span>${esc(e.text)}</span></li>`).join('')}</ul></section>
        <button class="btn" id="incReport"><i data-lucide="file-down"></i>Download incident report</button>`;
    });
    $('#drawerBody').onclick = (e) => { if (e.target.closest('#incReport')) incidentReport(id); };
  };

  function incidentReport(id) {
    const inc = S.state().incidents.find((i) => i.id === id); if (!inc) return;
    const txt = [`SEAQL INCIDENT REPORT — ${inc.id}`, 'Category: INTERACTIVE SIMULATION (not a real model prediction / not real UAV traffic)', '',
      `Type: ${inc.type}`, `Severity: ${inc.sev}`, `Status: ${inc.status}`, `UAV: ${inc.uav} (Cluster ${inc.cluster})`,
      `Detected: ${new Date(inc.start).toISOString()}`, `Resolved: ${inc.end ? new Date(inc.end).toISOString() : '—'}`,
      `Peak rate: ${num(inc.peakRate)} pkt/s`, `Packets: ${num(inc.packets)}`, '', 'Related packet features (observed = simulated, benign median = real dataset):',
      ...inc.features.map((f) => `  ${f.f}: observed ${f.observed} | benign median ${f.benign}`), '', 'Timeline:', ...inc.events.map((e) => `  ${new Date(e.t).toISOString()}  ${e.text}`)].join('\n');
    S.download(`${inc.id}_report.txt`, txt); S.toast('Report downloaded', `${inc.id}_report.txt`, 'ok');
  }

  /* ------------------------------------------------------------------ */
  /* 1. COMMAND CENTER                                                   */
  /* ------------------------------------------------------------------ */
  S.view('dashboard', {
    title: 'Security Command Center',
    subtitle: 'Real-time monitoring of UAV swarm cybersecurity · interactive simulation with verified research metrics',
    render(el) {
      const hb = D.hybridBinary || {};
      el.innerHTML = `
      <section class="kpis" aria-label="Key indicators">
        <article class="kpi blue"><div class="kpi-l">Total UAVs <i data-lucide="layers"></i></div><div class="kpi-v"><span class="ic">${S.droneSVG('#22B8FF', false)}</span><strong id="kTotal">8</strong></div><div class="kpi-s"><span>2 clusters · 4 + 4</span><span class="up">Cluster A · B</span></div></article>
        <article class="kpi green"><div class="kpi-l">Active UAVs <i data-lucide="wifi"></i></div><div class="kpi-v"><span class="ic"><i data-lucide="radio-tower"></i></span><strong id="kActive">8</strong><em>/ 8</em></div><div class="kpi-s"><span id="kActiveS">All nodes healthy</span></div></article>
        <article class="kpi red"><div class="kpi-l">Detected Attacks <i data-lucide="siren"></i></div><div class="kpi-v"><span class="ic"><i data-lucide="shield-alert"></i></span><strong id="kAtt">0</strong></div><div class="kpi-s"><span id="kAttS">This session</span></div></article>
        <article class="kpi green" id="kScoreCard"><div class="kpi-l">Security Score <i data-lucide="gauge"></i></div><div class="kpi-v"><span class="ic"><i data-lucide="shield-check"></i></span><strong id="kScore">—</strong><em>/ 100</em></div><div class="kpi-s"><span id="kScoreS">Simulated swarm health</span></div></article>
      </section>
      <div class="cc-grid">
        <div class="cc-left">
          <article class="panel fill" style="padding-bottom:12px">
            <div class="panel-h"><div><h2>UAV Swarm Network</h2><p>8 UAV clients → 2 cluster aggregators → global aggregator · click a drone to inspect</p></div><div class="right">${S.tag.sim}<button class="btn sm" id="ccOpen3d"><i data-lucide="rotate-3d"></i>3D view</button></div></div>
            <div class="topo" id="ccTopo"></div>
            <div class="topo-legend" style="position:static;margin-top:10px;display:inline-flex"><span><i class="lg normal"></i>Normal</span><span><i class="lg attack"></i>Under attack</span><span><i class="lg suspicious"></i>Suspicious</span><span><i class="lg training"></i>Training</span><span><i class="lg agg"></i>Aggregator</span></div>
          </article>
        </div>
        <div class="cc-right">
          <article class="panel"><div class="panel-h"><div><h2>Recent Alerts</h2><p>Generated by the simulation engine</p></div><button class="btn sm ghost" id="ccAllAlerts">View all</button></div><div class="alerts" id="ccAlerts"></div></article>
          <article class="panel"><div class="panel-h"><div><h3>Simulation Control</h3><p id="ccScen">—</p></div></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn sm" id="ccPlay"></button><button class="btn sm" id="ccReset"><i data-lucide="rotate-ccw"></i>Reset</button><button class="btn sm primary" id="ccLab"><i data-lucide="zap"></i>Attack lab</button></div>
            <div class="seg mt" role="group" aria-label="Quick scenario" id="ccQuick" style="display:flex;width:100%">${Object.entries(S.SCEN).map(([k, v]) => `<button data-k="${k}" style="flex:1">${v.name.split(' ')[0]}</button>`).join('')}</div>
          </article>
        </div>
      </div>
      <div class="grid mt" style="grid-template-columns:minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr)" id="ccRow2">
        <article class="panel"><div class="panel-h"><div><h3>Network Traffic <span class="muted" style="font-weight:500">(packets/s)</span></h3><p>Swarm-wide, last 60 s</p></div><div class="right"><span class="pill" style="padding:5px 10px" id="ccRate">—</span></div></div><div class="chart-box"><canvas id="ccTraffic" aria-label="Network traffic chart"></canvas></div></article>
        <article class="panel"><div class="panel-h"><div><h3>Threat Distribution</h3><p>Traffic windows classified (sim)</p></div></div>
          <div class="donut-wrap"><div class="donut"><canvas id="ccDonut" aria-label="Threat distribution chart"></canvas><div class="c"><div><strong id="ccWin">0</strong><small>windows</small></div></div></div>
          <div class="legend-list" id="ccLegend"></div></div></article>
        <article class="panel"><div class="panel-h"><div><h3>Model Performance</h3><p>Final hybrid model · binary test set</p></div><span class="tag verified" title="Verified experiment"><i data-lucide="badge-check"></i>Verified</span></div>
          <div class="perf"><div><small>Accuracy</small><strong>${pct(hb.accuracy)}</strong></div><div><small>Macro F1</small><strong>${pct(hb.macro_f1)}</strong></div><div><small>ROC AUC</small><strong>${pct(hb.auc)}</strong></div></div>
          <p class="muted" style="font-size:11.5px;margin:10px 0 0">Hybrid AE-Stacked Ensemble, attack-vs-benign, ${num(D.hybridBinaryConfusion?.testRows || 0)} held-out rows. Federated 3-class MLP: <b class="t2">${pct(D.federatedTest?.macroF1)}</b> macro F1 (different task).</p>
          <a class="btn sm mt" href="#/research" style="width:100%"><i data-lucide="chart-column"></i>Open research analytics</a></article>
      </div>
      <div class="grid g-2 mt">
        <article class="panel"><div class="panel-h"><div><h3>Recent Events</h3><p>Session timeline</p></div><button class="btn sm" id="ccExport"><i data-lucide="download"></i>Export log</button></div><ul class="timeline" id="ccTimeline"></ul></article>
        <article class="panel"><div class="panel-h"><div><h3>System Health</h3><p>Simulated platform indicators</p></div>${S.tag.sim}</div><div class="health" id="ccHealth"></div></article>
      </div>`;

      const topo = S.topology($('#ccTopo'), { onSelect: (i) => S.openUav(i) });
      $('#ccOpen3d').onclick = () => S.go('swarm');
      $('#ccAllAlerts').onclick = () => S.go('incidents');
      $('#ccLab').onclick = () => S.go('attack');
      $('#ccPlay').onclick = () => S.sim.toggle();
      $('#ccReset').onclick = () => S.sim.reset();
      $('#ccQuick').onclick = (e) => { const b = e.target.closest('button'); if (b) S.sim.setScenario(b.dataset.k); };
      $('#ccAlerts').onclick = (e) => { const b = e.target.closest('[data-uav]'); if (b) S.openUav(+b.dataset.uav); };
      $('#ccExport').onclick = () => {
        const st = S.state();
        S.download('seaql_simulation_event_log.csv', S.csv([['time', 'level', 'event', 'category'], ...st.timeline.map((e) => [new Date(e.t).toISOString(), e.level, e.text, 'interactive simulation'])]), 'text/csv');
        S.toast('Event log exported', 'seaql_simulation_event_log.csv', 'ok');
      };

      const tctx = $('#ccTraffic').getContext('2d');
      const traffic = S.chart($('#ccTraffic'), {
        type: 'line',
        data: { labels: [], datasets: [
          { label: 'Benign', data: [], borderColor: '#00D9FF', backgroundColor: S.gradient(tctx, 210, 'rgba(0,217,255,.35)', 'rgba(0,217,255,0)'), fill: true, tension: .35, pointRadius: 0, borderWidth: 2 },
          { label: 'Malicious', data: [], borderColor: '#FF4D6A', backgroundColor: S.gradient(tctx, 210, 'rgba(255,77,106,.25)', 'rgba(255,77,106,0)'), fill: true, tension: .35, pointRadius: 0, borderWidth: 2 },
        ] },
        options: { animation: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'top', align: 'end' } },
          scales: { x: { ticks: { maxTicksLimit: 6, maxRotation: 0 }, grid: { display: false } }, y: { beginAtZero: true, ticks: { callback: (v) => (v >= 1000 ? v / 1000 + 'k' : v) } } } },
      });
      const donut = S.chart($('#ccDonut'), {
        type: 'doughnut', data: { labels: ['Benign', 'DoS', 'Replay'], datasets: [{ data: [1, 0, 0], backgroundColor: ['#00D9FF', '#FF4D6A', '#FFC23D'], borderColor: '#0B1A30', borderWidth: 3, hoverOffset: 4 }] },
        options: { cutout: '72%', plugins: { legend: { display: false } }, animation: { duration: 400 } },
      });

      function paint(st) {
        const att = st.uavs.filter((u) => u.status === 'attack').length;
        const sus = st.uavs.filter((u) => u.status === 'suspicious').length;
        $('#kActive').textContent = 8 - att;
        $('#kActiveS').textContent = att ? `${att} compromised · ${sus} suspicious` : sus ? `${sus} suspicious` : 'All nodes healthy';
        $('#kAtt').textContent = st.incidents.length;
        const open = st.incidents.filter((i) => i.status === 'Open').length;
        $('#kAttS').textContent = `${open} open · ${st.incidents.length - open} resolved`;
        const sc = S.sim.score();
        $('#kScore').textContent = sc.toFixed(1);
        $('#kScoreCard').className = 'kpi ' + (sc >= 90 ? 'green' : sc >= 75 ? 'amber' : 'red');
        $('#kScoreS').textContent = `Severity: ${S.sim.severity()} · simulated`;
        $('#ccAlerts').innerHTML = st.alerts.length ? st.alerts.slice(0, 7).map((a) => `
          <button class="alert" data-uav="${+a.uav.slice(4) - 1}"><span class="ai ${a.sev}"><i data-lucide="${sevIcon[a.sev]}"></i></span><span><b>${esc(a.title)}</b><small>${esc(a.detail)}</small></span><time>${ago(a.t)}</time></button>`).join('')
          : '<div class="empty"><i data-lucide="shield-check"></i>No alerts — all traffic benign</div>';
        $('#ccScen').innerHTML = `${S.SCEN[st.scenario].name} · ${hms(S.sim.elapsed())} · ${st.speed}×`;
        $('#ccPlay').innerHTML = st.running ? '<i data-lucide="pause"></i>Pause' : '<i data-lucide="play"></i>Start';
        $('#ccPlay').className = 'btn sm ' + (st.running ? '' : 'success');
        $$('#ccQuick button').forEach((b) => b.classList.toggle('on', b.dataset.k === st.scenario));
        traffic.data.labels = st.traffic.map((p) => time(p.t).slice(3));
        traffic.data.datasets[0].data = st.traffic.map((p) => p.benign);
        traffic.data.datasets[1].data = st.traffic.map((p) => p.malicious);
        traffic.update('none');
        const last = st.traffic[st.traffic.length - 1] || { benign: 0, malicious: 0 };
        $('#ccRate').innerHTML = `<span class="dot ${last.malicious ? 'red' : ''}"></span>${num(last.benign + last.malicious)} pkt/s`;
        const w = st.windows, tot = w.benign + w.dos + w.replay || 1;
        donut.data.datasets[0].data = [w.benign, w.dos, w.replay]; donut.update();
        $('#ccWin').textContent = num(w.benign + w.dos + w.replay);
        $('#ccLegend').innerHTML = [['Benign', w.benign, 'normal'], ['DoS', w.dos, 'attack'], ['Replay', w.replay, 'suspicious']].map(([n, v, c]) => `<div><i class="lg ${c}"></i><span>${n}</span><b>${(v / tot * 100).toFixed(1)}%</b></div>`).join('');
        $('#ccTimeline').innerHTML = st.timeline.slice(0, 14).map((e) => `<li><time>${time(e.t)}</time><span class="tl-dot"><i class="${e.level}"></i></span><span>${esc(e.text)}</span></li>`).join('');
        const load = Math.min(100, (last.benign + last.malicious) / 180);
        const hp = [['Aggregator link', 100 - att * 4, 'g', '%'], ['Cluster A availability', 100 - st.uavs.filter((u) => u.cluster === 'A' && u.status === 'attack').length * 25, 'g', '%'],
          ['Cluster B availability', 100 - st.uavs.filter((u) => u.cluster === 'B' && u.status === 'attack').length * 25, 'g', '%'], ['Network load', load, load > 60 ? 'r' : load > 30 ? 'a' : '', '%'],
          ['Detector pipeline', st.running ? 100 : 0, st.running ? 'g' : 'a', st.running ? '% online' : ' paused']];
        $('#ccHealth').innerHTML = hp.map(([n, v, c, u]) => `<div class="hrow"><span>${n}</span><b class="mono">${Math.round(v)}${u}</b><div class="bar ${c}"><span style="width:${Math.max(2, v)}%"></span></div></div>`).join('');
        S.icons();
      }
      paint(S.state());
      const un = S.subscribe(paint);
      return () => { un(); topo.destroy(); };
    },
  });

  /* ------------------------------------------------------------------ */
  /* 3. ATTACK SIMULATION LAB                                            */
  /* ------------------------------------------------------------------ */
  S.view('attack', {
    title: 'Attack Simulation Laboratory',
    subtitle: 'Simulate cyber attacks on the UAV swarm network — illustrative events, not model predictions',
    render(el) {
      el.innerHTML = `
      <div class="note warn" style="margin-bottom:16px"><i data-lucide="flask-conical"></i><div><b>Interactive simulation.</b> Scenarios generate illustrative traffic and alerts from a scripted engine. They are not predictions of the trained model and no real packets are sent. Real model predictions are in the <a href="#/detect">AI Detection Lab</a>.</div></div>
      <div class="lab">
        <article class="panel"><div class="panel-h"><div><h2>Select Attack Scenario</h2><p>Scenario is applied when you press Start Attack</p></div></div>
          <div class="scen" role="radiogroup" aria-label="Attack scenario" id="alScen">${Object.entries(S.SCEN).map(([k, v]) => `<label><input type="radio" name="scen" value="${k}"><span><b>${v.name}</b><small>${v.desc}</small></span><span class="chip ${k === 'normal' ? 'green' : k === 'recovery' ? 'cyan' : k === 'replay' ? 'amber' : 'red'}">${k === 'normal' ? 'Baseline' : k === 'recovery' ? 'Restore' : v.sev}</span></label>`).join('')}</div></article>
        <div class="grid" style="align-content:start">
          <article class="panel"><div class="panel-h"><h2>Simulation Controls</h2>${S.tag.sim}</div>
            <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn danger" id="alStart"><i data-lucide="zap"></i>Start Attack</button><button class="btn" id="alStop"><i data-lucide="square"></i>Stop Attack</button><button class="btn blue" id="alPause"></button><button class="btn" id="alReset"><i data-lucide="rotate-ccw"></i>Reset</button></div>
            <div class="mt"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px"><label for="alSpeed">Simulation speed</label><b id="alSpeedL" class="mono">1×</b></div><input type="range" class="range" id="alSpeed" min="1" max="4" step="1" aria-valuetext="1x"></div></article>
          <article class="panel"><div class="panel-h"><h2>Simulation Status</h2><span id="alRun"></span></div>
            <dl class="status-grid" id="alStatus"></dl></article>
        </div>
      </div>
      <article class="panel mt"><div class="panel-h"><div><h3>Affected UAV Indicators</h3><p>Live node state across both clusters</p></div></div><div class="uav-mini" id="alMini"></div></article>
      <div class="grid g-2 mt">
        <article class="panel"><div class="panel-h"><div><h3>Traffic Behaviour</h3><p>Per-UAV packet rate (pkt/s) · targeted nodes highlighted</p></div></div><div class="chart-box tall"><canvas id="alChart"></canvas></div></article>
        <article class="panel"><div class="panel-h"><div><h3>Attack Timeline</h3><p>Scenario & detection events</p></div></div><ul class="timeline" id="alTl" style="max-height:280px"></ul></article>
      </div>
      <article class="panel mt"><div class="panel-h"><div><h3>Incident Details</h3><p>Incidents opened by this session</p></div><a class="btn sm" href="#/incidents"><i data-lucide="siren"></i>Incident center</a></div><div id="alInc"></div></article>`;

      let chosen = S.state().scenario;
      const radios = $$('#alScen input');
      const setRadio = () => radios.forEach((r) => (r.checked = r.value === chosen));
      setRadio();
      $('#alScen').addEventListener('change', (e) => { chosen = e.target.value; });
      $('#alStart').onclick = () => { if (chosen === 'normal' || chosen === 'recovery') { S.sim.setScenario(chosen); } else { S.sim.setScenario(chosen); S.sim.start(); } };
      $('#alStop').onclick = () => { const s = S.state().scenario; if (s === 'normal') return S.toast('No attack running', 'Swarm is already in normal state', 'info'); chosen = 'recovery'; setRadio(); S.sim.setScenario('recovery'); };
      $('#alPause').onclick = () => S.sim.toggle();
      $('#alReset').onclick = () => { S.sim.reset(); chosen = 'normal'; setRadio(); };
      const sp = $('#alSpeed'); sp.value = S.state().speed;
      sp.oninput = () => { S.sim.setSpeed(sp.value); sp.setAttribute('aria-valuetext', sp.value + 'x'); };

      const palette = ['#00D9FF', '#A15BFF', '#22E39A', '#2F7BFF', '#7DEBFF', '#C59BFF', '#14C27E', '#5B6CFF'];
      const ch = S.chart($('#alChart'), {
        type: 'line', data: { labels: [], datasets: S.state().uavs.map((u, i) => ({ label: u.id, data: [], borderColor: palette[i], pointRadius: 0, borderWidth: 1.6, tension: .3 })) },
        options: { animation: false, interaction: { mode: 'nearest', intersect: false }, plugins: { legend: { position: 'bottom', labels: { font: { size: 10.5 } } } },
          scales: { x: { display: false }, y: { type: 'logarithmic', min: 50, ticks: { callback: (v) => ([100, 1000, 10000].includes(v) ? (v >= 1000 ? v / 1000 + 'k' : v) : '') } } } },
      });
      function paint(st) {
        const sc = S.SCEN[st.scenario];
        const affected = st.uavs.filter((u) => u.status === 'attack' || u.status === 'suspicious');
        const sev = S.sim.severity();
        $('#alStatus').innerHTML = `<dt>Current Scenario</dt><dd><span class="chip ${st.scenario === 'normal' ? 'green' : st.scenario === 'recovery' ? 'cyan' : 'red'}">${sc.name}</span></dd>
          <dt>Affected UAVs</dt><dd style="color:${affected.length ? 'var(--red)' : 'var(--green)'}">${affected.length ? affected.map((u) => u.id).join(', ') : 'None'}</dd>
          <dt>Severity</dt><dd><span class="chip ${sev === 'Low' ? 'green' : sev === 'Medium' ? 'amber' : 'red'}">${sev}</span></dd>
          <dt>Elapsed Time</dt><dd class="mono" style="color:var(--red)">${hms(S.sim.elapsed())}</dd>
          <dt>Swarm traffic</dt><dd class="mono">${num((st.traffic.at(-1)?.benign || 0) + (st.traffic.at(-1)?.malicious || 0))} pkt/s</dd>
          <dt>Speed</dt><dd class="mono">${st.speed}×</dd>`;
        $('#alRun').innerHTML = st.running ? '<span class="pill live" style="padding:4px 10px"><span class="dot"></span>Running</span>' : '<span class="pill paused" style="padding:4px 10px"><span class="dot amber"></span>Paused</span>';
        $('#alPause').innerHTML = st.running ? '<i data-lucide="pause"></i>Pause' : '<i data-lucide="play"></i>Resume';
        $('#alSpeedL').textContent = st.speed + '×';
        $('#alMini').innerHTML = st.uavs.map((u) => `<div class="${u.status}" title="${u.id}: ${S.statusLabel(u.status)}"><i></i>${u.id}<br><span class="muted">${S.statusLabel(u.status)}</span></div>`).join('');
        ch.data.labels = st.uavs[0].history.map((_, i) => i);
        st.uavs.forEach((u, i) => { const ds = ch.data.datasets[i]; ds.data = u.history.slice(); const hot = u.status === 'attack' || u.status === 'suspicious'; ds.borderColor = hot ? S.COLORS[u.status] : palette[i]; ds.borderWidth = hot ? 3 : 1.4; });
        ch.update('none');
        $('#alTl').innerHTML = st.timeline.slice(0, 18).map((e) => `<li><time>${time(e.t)}</time><span class="tl-dot"><i class="${e.level}"></i></span><span>${esc(e.text)}</span></li>`).join('');
        $('#alInc').innerHTML = st.incidents.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>ID</th><th>Type</th><th>UAV</th><th>Severity</th><th>Status</th><th>Detected</th><th>Peak pkt/s</th></tr></thead><tbody>${st.incidents.slice(0, 6).map((i) => `<tr class="click" data-id="${i.id}"><td class="mono">${i.id}</td><td><span class="cls ${i.type === 'DoS' ? 'dos' : 'replay'}">${i.type}</span></td><td class="mono">${i.uav}</td><td><span class="sev ${i.sev}">${i.sev}</span></td><td>${i.status}</td><td class="mono">${time(i.start)}</td><td class="mono">${num(i.peakRate)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><i data-lucide="shield-check"></i>No incidents yet — start an attack scenario</div>';
        S.icons();
      }
      $('#alInc').onclick = (e) => { const r = e.target.closest('tr[data-id]'); if (r) S.openIncident(r.dataset.id); };
      paint(S.state());
      return S.subscribe(paint);
    },
  });

  /* ------------------------------------------------------------------ */
  /* 7. FLEET MONITORING                                                 */
  /* ------------------------------------------------------------------ */
  S.view('fleet', {
    title: 'UAV Fleet Monitoring',
    subtitle: 'Real-time status of all UAVs in the swarm — click a card for the inspection panel',
    render(el) {
      el.innerHTML = `<div class="toolbar"><div class="seg" role="group" aria-label="Filter by cluster" id="flSeg"><button data-f="all" class="on">All</button><button data-f="A">Cluster A</button><button data-f="B">Cluster B</button><button data-f="alert">Alerts only</button></div><span style="flex:1"></span>${S.tag.sim}</div>
        <div class="fleet" id="flGrid"></div>
        <article class="panel mt"><div class="panel-h"><div><h3>Fleet summary</h3><p>Packets per UAV this session</p></div></div><div class="chart-box"><canvas id="flChart"></canvas></div></article>`;
      let filter = 'all';
      $('#flSeg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; filter = b.dataset.f; $$('#flSeg button').forEach((x) => x.classList.toggle('on', x === b)); paint(S.state()); };
      $('#flGrid').onclick = (e) => { const c = e.target.closest('.ucard'); if (c) S.openUav(+c.dataset.idx); };
      $('#flGrid').onkeydown = (e) => { const c = e.target.closest('.ucard'); if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); S.openUav(+c.dataset.idx); } };
      const ch = S.chart($('#flChart'), { type: 'bar', data: { labels: S.state().uavs.map((u) => u.id), datasets: [{ label: 'Packets', data: [], backgroundColor: [], borderRadius: 6 }] },
        options: { animation: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { ticks: { callback: (v) => (v >= 1e6 ? v / 1e6 + 'M' : v >= 1000 ? v / 1000 + 'k' : v) } } } } });
      let lastKey = '';
      function paint(st) {
        const key = filter + st.uavs.map((u) => u.status + Math.round(u.rate / 50)).join();
        if (key !== lastKey) {
          lastKey = key;
          const list = st.uavs.filter((u) => filter === 'all' || (filter === 'alert' ? u.status === 'attack' || u.status === 'suspicious' : u.cluster === filter));
          $('#flGrid').innerHTML = list.length ? list.map((u) => `<article class="ucard ${u.status}" data-idx="${u.idx}" tabindex="0" role="button" aria-label="${u.id} ${S.statusLabel(u.status)}">
            <div class="art">${S.droneSVG(S.COLORS[u.status], st.running)}</div><h3>${u.id}</h3><div class="cl ${u.cluster === 'B' ? 'b' : ''}">Cluster ${u.cluster}</div>
            <div class="st"><span class="status-badge ${u.status}">● ${S.statusLabel(u.status)}</span></div>
            <div class="meta"><span>Traffic<br><b>${num(u.rate)}</b> pkt/s</span><span>Incidents<br><b>${u.incidents.length}</b></span><span>Link<br><b style="color:var(--green)">UP</b></span></div></article>`).join('')
            : '<div class="empty" style="grid-column:1/-1"><i data-lucide="shield-check"></i>No UAVs match this filter</div>';
          S.icons();
        }
        ch.data.datasets[0].data = st.uavs.map((u) => u.packets);
        ch.data.datasets[0].backgroundColor = st.uavs.map((u) => (u.status === 'normal' ? 'rgba(0,217,255,.7)' : S.COLORS[u.status]));
        ch.update('none');
      }
      paint(S.state());
      return S.subscribe(paint);
    },
  });

  /* ------------------------------------------------------------------ */
  /* 8. INCIDENT INVESTIGATION CENTER                                    */
  /* ------------------------------------------------------------------ */
  S.view('incidents', {
    title: 'Incident Investigation Center',
    subtitle: 'Search, filter and investigate security alerts raised during the simulation session',
    render(el) {
      el.innerHTML = `
      <div class="kpis" style="margin-bottom:16px">
        <article class="kpi red"><div class="kpi-l">Open incidents</div><div class="kpi-v"><span class="ic"><i data-lucide="siren"></i></span><strong id="inOpen">0</strong></div><div class="kpi-s"><span>Requires response</span></div></article>
        <article class="kpi green"><div class="kpi-l">Resolved</div><div class="kpi-v"><span class="ic"><i data-lucide="circle-check"></i></span><strong id="inRes">0</strong></div><div class="kpi-s"><span>Recovered nodes</span></div></article>
        <article class="kpi amber"><div class="kpi-l">Alerts raised</div><div class="kpi-v"><span class="ic"><i data-lucide="bell"></i></span><strong id="inAl">0</strong></div><div class="kpi-s"><span>All severities</span></div></article>
        <article class="kpi blue"><div class="kpi-l">Mean time to recover</div><div class="kpi-v"><span class="ic"><i data-lucide="clock"></i></span><strong id="inMttr">—</strong></div><div class="kpi-s"><span>Resolved incidents</span></div></article>
      </div>
      <article class="panel"><div class="panel-h"><div><h2>Security Alerts</h2><p>Every alert is generated by the simulation engine</p></div><div class="right">${S.tag.sim}<button class="btn sm" id="inCsv"><i data-lucide="download"></i>Export CSV</button><button class="btn sm" id="inRep"><i data-lucide="file-text"></i>Session report</button></div></div>
        <div class="toolbar"><div class="search"><i data-lucide="search"></i><input class="input" id="inQ" placeholder="Search UAV, type, message…" aria-label="Search alerts"></div>
          <select class="select" id="inSev" aria-label="Severity filter"><option value="">All severities</option><option>critical</option><option>high</option><option>medium</option><option>low</option></select>
          <select class="select" id="inType" aria-label="Attack type filter"><option value="">All types</option><option>DoS</option><option>Replay</option><option>Recovery</option></select></div>
        <div class="table-wrap" style="max-height:440px"><table class="t"><thead><tr><th>Timestamp</th><th>Severity</th><th>Type</th><th>Affected UAV</th><th>Alert</th><th>Details</th></tr></thead><tbody id="inBody"></tbody></table></div>
        <div class="pager" id="inCount"></div></article>
      <article class="panel mt"><div class="panel-h"><div><h3>Incidents</h3><p>Grouped attack episodes · click to investigate</p></div></div><div id="inList"></div></article>`;
      const q = $('#inQ'), sev = $('#inSev'), ty = $('#inType');
      const filtered = (st) => {
        const s = q.value.trim().toLowerCase();
        return st.alerts.filter((a) => (!sev.value || a.sev === sev.value) && (!ty.value || a.type === ty.value) && (!s || `${a.uav} ${a.type} ${a.title} ${a.detail}`.toLowerCase().includes(s)));
      };
      function paint(st) {
        const open = st.incidents.filter((i) => i.status === 'Open'), res = st.incidents.filter((i) => i.end);
        $('#inOpen').textContent = open.length; $('#inRes').textContent = res.length; $('#inAl').textContent = st.alerts.length;
        $('#inMttr').textContent = res.length ? Math.round(res.reduce((a, i) => a + (i.end - i.start), 0) / res.length / 1000) + 's' : '—';
        const rows = filtered(st);
        $('#inBody').innerHTML = rows.length ? rows.map((a) => `<tr class="click" data-uav="${+a.uav.slice(4) - 1}"><td class="mono">${new Date(a.t).toLocaleTimeString('en-GB')}</td><td><span class="sev ${a.sev}">${a.sev}</span></td><td><span class="cls ${a.type === 'DoS' ? 'dos' : a.type === 'Replay' ? 'replay' : 'benign'}">${a.type}</span></td><td class="mono">${a.uav}</td><td>${esc(a.title)}</td><td class="muted">${esc(a.detail)}</td></tr>`).join('')
          : '<tr><td colspan="6"><div class="empty"><i data-lucide="search-x"></i>No alerts match the current filters</div></td></tr>';
        $('#inCount').textContent = `${rows.length} of ${st.alerts.length} alerts`;
        $('#inList').innerHTML = st.incidents.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>ID</th><th>Type</th><th>UAV</th><th>Severity</th><th>Status</th><th>Detected</th><th>Duration</th><th>Packets</th></tr></thead><tbody>${st.incidents.map((i) => `<tr class="click" data-id="${i.id}"><td class="mono">${i.id}</td><td><span class="cls ${i.type === 'DoS' ? 'dos' : 'replay'}">${i.type}</span></td><td class="mono">${i.uav}</td><td><span class="sev ${i.sev}">${i.sev}</span></td><td><span class="chip ${i.status === 'Open' ? 'red' : 'green'}">${i.status}</span></td><td class="mono">${time(i.start)}</td><td class="mono">${hms((i.end || st.simNow) - i.start)}</td><td class="mono">${num(i.packets)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><i data-lucide="shield-check"></i>No incidents in this session</div>';
        S.icons();
      }
      [q, sev, ty].forEach((x) => x.addEventListener('input', () => paint(S.state())));
      $('#inBody').onclick = (e) => { const r = e.target.closest('tr[data-uav]'); if (r) S.openUav(+r.dataset.uav); };
      $('#inList').onclick = (e) => { const r = e.target.closest('tr[data-id]'); if (r) S.openIncident(r.dataset.id); };
      $('#inCsv').onclick = () => {
        const rows = filtered(S.state());
        S.download('seaql_alerts.csv', S.csv([['timestamp', 'severity', 'type', 'uav', 'alert', 'details', 'category'], ...rows.map((a) => [new Date(a.t).toISOString(), a.sev, a.type, a.uav, a.title, a.detail, 'interactive simulation'])]), 'text/csv');
        S.toast('Alerts exported', `${rows.length} rows → seaql_alerts.csv`, 'ok');
      };
      $('#inRep').onclick = () => {
        const st = S.state();
        const html = `<!doctype html><meta charset="utf-8"><title>SEAQL incident report</title><style>body{font-family:Segoe UI,Arial;margin:32px;color:#111}table{border-collapse:collapse;width:100%;font-size:13px}td,th{border:1px solid #ccc;padding:6px;text-align:left}th{background:#eef}.n{background:#fff4d6;padding:10px;border:1px solid #e5c56b}</style>
          <h1>SEAQL — Incident Investigation Report</h1><p>Generated ${new Date().toLocaleString()}</p><p class="n"><b>Category: Interactive simulation.</b> These incidents were produced by the dashboard's scripted simulation engine. They are not real UAV traffic and not predictions of the trained model.</p>
          <h2>Incidents (${st.incidents.length})</h2><table><tr><th>ID</th><th>Type</th><th>UAV</th><th>Severity</th><th>Status</th><th>Detected</th><th>Resolved</th><th>Peak pkt/s</th></tr>${st.incidents.map((i) => `<tr><td>${i.id}</td><td>${i.type}</td><td>${i.uav}</td><td>${i.sev}</td><td>${i.status}</td><td>${new Date(i.start).toLocaleString()}</td><td>${i.end ? new Date(i.end).toLocaleString() : '—'}</td><td>${num(i.peakRate)}</td></tr>`).join('')}</table>
          <h2>Alerts (${st.alerts.length})</h2><table><tr><th>Time</th><th>Severity</th><th>Type</th><th>UAV</th><th>Alert</th></tr>${st.alerts.map((a) => `<tr><td>${new Date(a.t).toLocaleTimeString()}</td><td>${a.sev}</td><td>${a.type}</td><td>${a.uav}</td><td>${esc(a.title)}</td></tr>`).join('')}</table>`;
        S.download('seaql_incident_report.html', html, 'text/html'); S.toast('Report downloaded', 'seaql_incident_report.html', 'ok');
      };
      paint(S.state());
      return S.subscribe(() => { if (document.activeElement !== q) paint(S.state()); else paint(S.state()); });
    },
  });
})();
