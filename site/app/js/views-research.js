/* SEAQL — Research Analytics, Viva Presentation Mode, Team & Documentation */
(function () {
  'use strict';
  const { $, $$, esc, num, pct } = S;
  const D = S.data;

  const LIMITS = [
    'DoS and Replay overlap heavily at packet-feature level; every 3-class model tested is capped near 72–77% macro F1.',
    'The headline 94.3% accuracy is for binary attack-vs-benign detection, not 3-class classification.',
    'Federated learning was simulated on one machine (8 virtual clients, 5 rounds); the federated MLP reaches 59.7% macro F1 (3-class).',
    'Post-quantum signatures (ML-DSA / Dilithium) were not executed — liboqs was not installed; only a SHA3-256 update digest was timed.',
    'Explainability uses permutation importance; SHAP was planned but not executed in the recorded run.',
    'No real UAV hardware, flight telemetry or 100+ node scalability tests; latency and energy were not measured.',
    'The autoencoder loss is on unscaled byte-level magnitudes (values ≈1e13–1e16), so absolute loss values are not comparable across runs.',
  ];
  const OBJECTIVES = [
    ['Hierarchical FL architecture (clients → cluster → global)', 'verified', 'Implemented and run: 8 clients, 2 clusters, weighted FedAvg, 5 rounds.'],
    ['Non-IID-aware aggregation under heterogeneity', 'partial', 'Run under Dirichlet α = 0.30; macro F1 59.7% — matches centralized MLP (59.4%) but below tree ensembles.'],
    ['Post-quantum cryptography in the FL pipeline', 'future', 'Designed; real ML-DSA benchmark not executed (python-oqs/liboqs absent). SHA3-256 integrity digest measured at 0.20 ms.'],
    ['Explainable anomaly detection', 'partial', 'Global permutation importance computed; SHAP/LIME local explanations not executed.'],
    ['Federated continual learning', 'verified', 'Replay-buffer experiment over 5 data chunks recorded (macro F1 after update 0.70–0.74).'],
    ['Validation vs baselines (accuracy, overhead, latency, energy)', 'partial', 'Accuracy and communication overhead measured; latency and energy not measured.'],
  ];
  const stTag = (s) => (s === 'verified' ? S.tag.verified : s === 'future' ? S.tag.future : '<span class="tag sim" style="color:#8BE9F7;border-color:rgba(34,211,238,.35);background:rgba(34,211,238,.06)"><i data-lucide="circle-dashed"></i>Partially achieved</span>');

  /* ------------------------------------------------------------------ */
  /* 9. RESEARCH ANALYTICS                                               */
  /* ------------------------------------------------------------------ */
  S.view('research', {
    title: 'Research Analytics',
    subtitle: 'Experimental results and performance evaluation — all values from recorded experiment outputs',
    render(el) {
      const hb = D.hybridBinary || {}, ft = D.federatedTest || {}, cd = D.classDistribution || {};
      const ctest = D.centralTest || [];
      const rf = ctest.find((r) => r.model === 'Random Forest') || {}, mlp = ctest.find((r) => r.model.startsWith('MLP')) || {}, lr = ctest.find((r) => r.model.startsWith('Logistic')) || {};
      const totalRows = Object.values(cd).reduce((a, b) => a + b, 0);
      const cm = D.hybridBinaryConfusion;
      el.innerHTML = `
      <div class="rs-kpis">
        <article class="panel"><div class="panel-h"><div><h2>Centralized (Binary) · Final Hybrid AE-Stacked Ensemble</h2><p>Attack-vs-benign · ${num(cm?.testRows || 0)} held-out test rows · SMOTE on training split only</p></div>${S.tag.verified}</div>
          <div class="metric-band"><div><small>Accuracy</small><strong class="c-cyan">${pct(hb.accuracy)}</strong></div><div><small>Macro F1</small><strong class="c-green">${pct(hb.macro_f1)}</strong></div><div><small>ROC AUC</small><strong class="c-cyan">${pct(hb.auc)}</strong></div><div><small>Attack precision</small><strong>${pct(hb.attack_precision)}</strong></div><div><small>Attack recall</small><strong>${pct(hb.attack_recall)}</strong></div></div></article>
        <article class="panel" style="border-color:rgba(139,92,246,.4)"><div class="panel-h"><div><h2>Federated (FL) · Hierarchical MLP</h2><p>3-class · 8 clients · 5 rounds · α = ${D.config?.dirichlet_alpha}</p></div>${S.tag.verified}</div>
          <div class="metric-band" style="grid-template-columns:repeat(3,1fr)"><div><small>Macro F1</small><strong class="c-purple">${pct(ft.macroF1)}</strong></div><div><small>Accuracy</small><strong>${pct(ft.accuracy)}</strong></div><div><small>Macro AUC</small><strong>${pct(ft.auc)}</strong></div></div></article>
      </div>
      <div class="note warn mt"><i data-lucide="scale"></i><div><b>Read these separately.</b> The 94.3% / 93.3% figures are a <b>binary</b> task; the 59.7% federated figure is a <b>3-class</b> task. The fair centralized-vs-federated comparison is the same MLP on the same 3-class task: <b>${pct(mlp.macroF1)}</b> centralized vs <b>${pct(ft.macroF1)}</b> federated.</div></div>
      <div class="grid mt rs-row">
        <article class="panel"><div class="panel-h"><div><h3>Centralized vs Federated — Macro F1</h3><p>Colour shows the task: binary vs 3-class</p></div></div><div class="chart-box tall"><canvas id="rsCmp"></canvas></div></article>
        <article class="panel"><div class="panel-h"><div><h3>Dataset Class Distribution</h3><p>After cleaning & de-duplication</p></div>${S.tag.verified}</div>
          <div class="donut-wrap rs-donut"><div class="donut"><canvas id="rsCls"></canvas><div class="c"><div><strong>${num(totalRows)}</strong><small>samples</small></div></div></div>
          <div class="legend-list">${[['benign', '#34D399'], ['DoS attack', '#FF5A76'], ['Replay', '#FBBF24']].map(([c, col]) => `<div><i class="lg" style="background:${col};box-shadow:0 0 8px ${col}"></i><span>${c === 'benign' ? 'Benign' : c === 'DoS attack' ? 'DoS' : 'Replay'}</span><b>${(cd[c] / totalRows * 100).toFixed(1)}%</b></div>`).join('')}</div></div>
          <dl class="kv mt" style="font-size:12px"><dt>Raw rows</dt><dd class="mono">${num(D.dataAudit?.raw_rows || 0)}</dd><dt>Valid labelled rows</dt><dd class="mono">${num(D.dataAudit?.valid_labeled_rows || 0)}</dd><dt>Final rows (de-duplicated)</dt><dd class="mono">${num(D.dataAudit?.final_rows || 0)}</dd><dt>Features</dt><dd class="mono">${D.dataAudit?.features}</dd></dl></article>
      </div>
      <article class="panel mt"><div class="panel-h"><div><h3>Model Comparison — 3-class, held-out test</h3><p>Accuracy · precision · recall · F1 · ROC AUC</p></div><div class="right"><div class="seg" id="rsSeg"><button class="on" data-m="Random Forest">Random Forest</button><button data-m="MLP (early stopping)">MLP</button><button data-m="Logistic Regression">Logistic Reg.</button></div></div></div>
        <div class="grid" style="grid-template-columns:minmax(0,1.75fr) minmax(0,1fr)" id="rsCmpGrid">
          <div class="table-wrap"><table class="t"><thead><tr><th>Model</th><th>Task</th><th>Accuracy</th><th>Balanced acc.</th><th>Macro F1</th><th>Weighted F1</th><th>ROC AUC</th><th>Train time</th></tr></thead><tbody>
          ${ctest.map((r) => `<tr><td>${r.model}</td><td>3-class</td><td class="mono">${pct(r.accuracy)}</td><td class="mono">${pct(r.balancedAccuracy)}</td><td class="mono c-cyan">${pct(r.macroF1)}</td><td class="mono">${pct(r.weightedF1)}</td><td class="mono">${pct(r.auc)}</td><td class="mono">${r.trainSeconds?.toFixed(1)} s</td></tr>`).join('')}
          <tr><td>Hierarchical Federated MLP</td><td>3-class (FL)</td><td class="mono">${pct(ft.accuracy)}</td><td class="mono">${pct(ft.balancedAccuracy)}</td><td class="mono c-purple">${pct(ft.macroF1)}</td><td class="mono">${pct(ft.weightedF1)}</td><td class="mono">${pct(ft.auc)}</td><td class="mono">—</td></tr>
          <tr><td>Autoencoder (benign-only)</td><td>binary anomaly</td><td class="mono">${pct(D.autoencoder?.accuracy)}</td><td class="mono">${pct(D.autoencoder?.balancedAccuracy)}</td><td class="mono">F1 ${pct(D.autoencoder?.f1)}</td><td class="mono">—</td><td class="mono">${pct(D.autoencoder?.auc)}</td><td class="mono">—</td></tr>
          <tr><td><b>Hybrid AE-Stacked Ensemble</b> <span class="muted">(thesis run)</span></td><td>binary</td><td class="mono c-green">${pct(hb.accuracy)}</td><td class="mono">${pct(hb.balanced_accuracy)}</td><td class="mono c-green">${pct(hb.macro_f1)}</td><td class="mono">—</td><td class="mono">${pct(hb.auc)}</td><td class="mono">—</td></tr>${D.liveHybrid ? `<tr><td><b>Hybrid AE-Stacked Ensemble</b> <span class="chip cyan">re-run · served live</span></td><td>binary</td><td class="mono c-green">${pct(D.liveHybrid.heldout_metrics.accuracy)}</td><td class="mono">${pct(D.liveHybrid.heldout_metrics.balanced_accuracy)}</td><td class="mono c-green">${pct(D.liveHybrid.heldout_metrics.macro_f1)}</td><td class="mono">—</td><td class="mono">${pct(D.liveHybrid.heldout_metrics.auc)}</td><td class="mono">—</td></tr>` : ''}</tbody></table></div>
          <div><h4 class="sec-t">Per-class precision / recall · <span id="rsSel">Random Forest</span></h4><div class="chart-box"><canvas id="rsPr"></canvas></div></div>
        </div></article>
      <div class="grid g-2 mt">
        <article class="panel"><div class="panel-h"><div><h3>Confusion Matrix — Final Hybrid (Binary)</h3><p>Rebuilt from hybrid_binary_secondary_3class_breakdown.csv</p></div>${S.tag.verified}</div><div id="rsCm"></div></article>
        <article class="panel"><div class="panel-h"><div><h3>Model Progression</h3><p>Macro F1 across the research iterations (thesis record)</p></div></div><div class="chart-box tall"><canvas id="rsProg"></canvas></div></article>
      </div>
      <div class="grid g-3 mt">
        <article class="panel"><div class="panel-h"><div><h3>Training Progress — Autoencoder</h3><p>Reconstruction loss (log scale)</p></div></div><div class="chart-box"><canvas id="rsAe"></canvas></div></article>
        <article class="panel"><div class="panel-h"><div><h3>Training Progress — Federated</h3><p>Validation macro F1 & accuracy per round</p></div></div><div class="chart-box"><canvas id="rsFl"></canvas></div></article>
        <article class="panel"><div class="panel-h"><div><h3>Continual Learning</h3><p>Macro F1 before vs after each update</p></div></div><div class="chart-box"><canvas id="rsCl"></canvas></div></article>
      </div>
      <div class="grid g-2 mt">
        <article class="panel"><div class="panel-h"><div><h3>Communication & Security Overhead</h3></div>${S.tag.verified}</div>
          <dl class="kv"><dt>Full model upload / round (8 clients)</dt><dd class="mono">${num((D.federatedRounds?.[0]?.fullBytes || 0) / 1024)} KB</dd><dt>Top-k (25%) upload / round</dt><dd class="mono c-green">${num((D.federatedRounds?.[0]?.topkBytes || 0) / 1024)} KB</dd><dt>Reduction</dt><dd class="mono c-green">${(100 * (1 - (D.federatedRounds?.[0]?.topkBytes || 0) / (D.federatedRounds?.[0]?.fullBytes || 1))).toFixed(1)}%</dd>
          ${(D.securityOverhead || []).map((s) => `<dt>${esc(s.mechanism)}</dt><dd class="mono">${s.available ? (s.signMs?.toFixed(3) + ' ms') : '<span class="tag future">Not executed</span>'}</dd>`).join('')}</dl></article>
        <article class="panel"><div class="panel-h"><h3>Research Limitations</h3></div><ul class="limits">${LIMITS.map((l) => `<li><i data-lucide="triangle-alert"></i><span>${l}</span></li>`).join('')}</ul></article>
      </div>
      <article class="panel mt"><div class="panel-h"><div><h3>Recorded Figures</h3><p>Original figures generated by the research scripts</p></div></div>
        <div class="fig-grid">${[['hybrid_binary_confusion_matrix', 'Hybrid binary confusion matrix'], ['confusion_random_forest', 'Random Forest (3-class)'], ['confusion_hierarchical_fl', 'Hierarchical federated MLP'], ['confusion_mlp_early_stopping', 'MLP (early stopping)'], ['federated_convergence', 'Federated convergence'], ['hybrid_binary_vs_baseline_comparison', 'Hybrid vs baseline (binary)']].map(([f, c]) => `<figure><img src="assets/${f}.webp" alt="${c}" loading="lazy"><figcaption>${c}</figcaption></figure>`).join('')}</div></article>`;

      S.chart($('#rsCmp'), { type: 'bar', data: { labels: ['Centralized\n(Binary hybrid)', 'Centralized RF\n(3-class)', 'Centralized MLP\n(3-class)', 'Federated MLP\n(3-class, α=0.30)'].map((l) => l.split('\n')),
        datasets: [{ data: [hb.macro_f1, rf.macroF1, mlp.macroF1, ft.macroF1], backgroundColor: ['#22D3EE', 'rgba(124,108,246,.85)', 'rgba(124,108,246,.6)', '#8B5CF6'], borderRadius: 8, barPercentage: .62 }] },
        options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => 'Macro F1 ' + (c.raw * 100).toFixed(1) + '%' } } }, scales: { y: { min: 0, max: 1, ticks: { callback: (v) => v.toFixed(1) } }, x: { grid: { display: false } } } },
        plugins: [{ id: 'vals', afterDatasetsDraw(c) { const { ctx } = c; ctx.save(); ctx.fillStyle = '#F5F9FF'; ctx.font = '700 12px Inter'; ctx.textAlign = 'center'; c.getDatasetMeta(0).data.forEach((b, i) => ctx.fillText(c.data.datasets[0].data[i].toFixed(3), b.x, b.y - 8)); ctx.restore(); } }] });
      S.chart($('#rsCls'), { type: 'doughnut', data: { labels: ['Benign', 'DoS', 'Replay'], datasets: [{ data: [cd.benign, cd['DoS attack'], cd.Replay], backgroundColor: ['#34D399', '#FF5A76', '#FBBF24'], borderColor: '#0E1834', borderWidth: 3 }] }, options: { cutout: '70%', plugins: { legend: { display: false } } } });
      const prChart = S.chart($('#rsPr'), { type: 'bar', data: { labels: ['Benign', 'DoS', 'Replay'], datasets: [{ label: 'Precision', data: [], backgroundColor: '#22D3EE', borderRadius: 5 }, { label: 'Recall', data: [], backgroundColor: '#8B5CF6', borderRadius: 5 }, { label: 'F1', data: [], backgroundColor: '#34D399', borderRadius: 5 }] },
        options: { scales: { y: { min: 0, max: 1 }, x: { grid: { display: false } } } } });
      const setPr = (m) => { const r = D.classReports?.[m]; if (!r) return; $('#rsSel').textContent = m; ['precision', 'recall', 'f1'].forEach((k, i) => (prChart.data.datasets[i].data = ['benign', 'DoS attack', 'Replay'].map((c) => r[c][k]))); prChart.update(); };
      setPr('Random Forest');
      $('#rsSeg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; $$('#rsSeg button').forEach((x) => x.classList.toggle('on', x === b)); setPr(b.dataset.m); };
      if (cm) {
        const m = cm.matrix, lab = ['Benign', 'Attack'];
        $('#rsCm').innerHTML = `<div class="cm" style="grid-template-columns:90px 1fr 1fr;max-width:420px"><div></div><div class="hd">Pred. Benign</div><div class="hd">Pred. Attack</div>${m.map((row, i) => `<div class="hd" style="justify-content:end">True ${lab[i]}</div>${row.map((v, k) => `<div class="cell" style="height:62px;font-size:16px;background:${i === k ? 'rgba(34,211,238,.75)' : 'rgba(91,124,250,.18)'};color:${i === k ? '#050B1A' : 'var(--text)'}">${num(v)}</div>`).join('')}`).join('')}</div>
          <p class="muted" style="font-size:12px;margin:12px 0 0">Attack rows broken down by original label: DoS ${num(cm.by3class['DoS attack'].attack)} detected / ${num(cm.by3class['DoS attack'].benign)} missed · Replay ${num(cm.by3class.Replay.attack)} detected / ${num(cm.by3class.Replay.benign)} missed.</p>`;
      }
      const prog = D.progression || [];
      S.chart($('#rsProg'), { type: 'bar', data: { labels: prog.map((p) => p.model.replace('Hybrid AE-Stacked Ensemble', 'Hybrid AE-Stack').replace(' (FINAL)', ' ★')), datasets: [{ data: prog.map((p) => p.macroF1), backgroundColor: prog.map((p) => (p.task.startsWith('binary') ? '#22D3EE' : '#7C6CF6')), borderRadius: 5 }] },
        options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${prog[c.dataIndex].task}: ${c.raw}% — ${prog[c.dataIndex].note}` } } }, scales: { x: { min: 0, max: 100, ticks: { callback: (v) => v + '%' } }, y: { grid: { display: false }, ticks: { font: { size: 10.5 } } } } } });
      S.chart($('#rsAe'), { type: 'line', data: { labels: (D.aeHistory || []).map((r) => r.epoch), datasets: [{ label: 'Train', data: D.aeHistory.map((r) => r.train), borderColor: '#22D3EE', pointRadius: 2, tension: .3 }, { label: 'Validation (benign)', data: D.aeHistory.map((r) => r.val), borderColor: '#8B5CF6', pointRadius: 2, tension: .3 }] },
        options: { scales: { y: { type: 'logarithmic', ticks: { callback: (v) => { const e = Math.log10(v); return Number.isInteger(e) ? '1e' + e : ''; } } }, x: { title: { display: true, text: 'Epoch' } } } } });
      S.chart($('#rsFl'), { type: 'line', data: { labels: (D.federatedRounds || []).map((r) => 'R' + r.round), datasets: [{ label: 'Val macro F1', data: D.federatedRounds.map((r) => r.valMacroF1), borderColor: '#22D3EE', pointRadius: 4, tension: .3 }, { label: 'Val accuracy', data: D.federatedRounds.map((r) => r.valAccuracy), borderColor: '#34D399', pointRadius: 4, tension: .3 }] },
        options: { scales: { y: { min: 0.45, max: 0.7 } } } });
      S.chart($('#rsCl'), { type: 'bar', data: { labels: (D.continual || []).map((r) => 'Chunk ' + r.chunk), datasets: [{ label: 'Before update', data: D.continual.map((r) => r.before), backgroundColor: 'rgba(139,92,246,.7)', borderRadius: 4 }, { label: 'After update', data: D.continual.map((r) => r.after), backgroundColor: '#22D3EE', borderRadius: 4 }] },
        options: { scales: { y: { min: 0.5, max: 0.8 }, x: { grid: { display: false } } } } });
    },
  });

  /* ------------------------------------------------------------------ */
  /* 10. VIVA PRESENTATION MODE                                          */
  /* ------------------------------------------------------------------ */
  const hb = D.hybridBinary || {}, ft = D.federatedTest || {}, cd = D.classDistribution || {};
  const li = (arr) => `<ul class="pts">${arr.map((t) => `<li><i data-lucide="chevron-right"></i><span>${t}</span></li>`).join('')}</ul>`;
  const SLIDES = [
    { k: 'FYP Demonstration', h: '<h2 class="hero">SEAQL</h2>', lead: 'Scalable, Explainable, and Adaptive Quantum-Resilient Federated Learning for UAV Swarm Cybersecurity', extra: '<div class="mt" style="display:flex;gap:10px;flex-wrap:wrap"><span class="pill live"><span class="dot"></span>BS Information Technology · Bahria University, Lahore Campus</span><span class="pill">Supervisor: Ms. Munaza Sher</span></div>', vis: () => `<svg class="drone-hero" viewBox="0 0 120 80">${S.droneSVG('#22D3EE').replace(/<\/?svg[^>]*>/g, '')}</svg>` },
    { k: 'Research problem', h: '<h2>UAV swarms talk over open wireless links</h2>', lead: 'Surveillance, disaster-response and logistics swarms depend on real-time radio links that attackers can flood or replay.', extra: li(['<b>DoS flooding</b> exhausts the channel and the UAV\'s processing budget', '<b>Replay attacks</b> re-transmit captured legitimate frames to deceive the swarm', 'Centralized IDS needs all raw traffic in one place — a privacy and bandwidth problem for swarms', 'Security decisions are rarely explainable to operators']), vis: () => '<div class="big-stat"><div><small>Attack types studied</small><strong>2</strong></div><div><small>Packet features</small><strong>32</strong></div><div><small>Labelled rows</small><strong>' + num(D.dataAudit?.final_rows || 0) + '</strong></div></div>' },
    { k: 'Proposed architecture', h: '<h2>Hierarchical, federated, explainable</h2>', lead: 'Each UAV trains locally; cluster aggregators combine updates; a global aggregator builds the shared model.', extra: '', vis: () => '<div class="flow"><div><i>1</i>8 UAV clients train on their own traffic (raw data never leaves)</div><div><i>2</i>Top-k (25%) compressed updates → cluster aggregators A &amp; B</div><div><i>3</i>Weighted FedAvg at cluster level, then global level</div><div><i>4</i>Centralized research model: Autoencoder features + 5-model stacking ensemble</div><div><i>5</i>Permutation-importance explanations for operators</div></div>' },
    { k: 'Dataset & preprocessing', h: '<h2>Real packet capture: Dataset_T-ITS.csv</h2>', lead: `${num(D.dataAudit?.raw_rows || 0)} raw rows → ${num(D.dataAudit?.final_rows || 0)} clean, de-duplicated, labelled rows with ${D.dataAudit?.features} numeric features.`, extra: li(['Removed rows with missing/invalid labels and exact duplicates', 'Dropped leakage-prone identifiers (timestamp_c, frame.number)', 'Train-only median imputation + RobustScaler (10–90 quantiles)', 'Stratified 60 / 20 / 20 split, seed 42; SMOTE on training split only']), vis: () => `<div class="big-stat"><div><small>Benign</small><strong style="color:var(--green)">${num(cd.benign || 0)}</strong></div><div><small>DoS attack</small><strong style="color:var(--red)">${num(cd['DoS attack'] || 0)}</strong></div><div><small>Replay</small><strong style="color:var(--amber)">${num(cd.Replay || 0)}</strong></div></div>` },
    { k: 'UAV swarm simulation', h: '<h2>A digital twin of the swarm</h2>', lead: 'The 3D twin and command center visualise 8 UAVs in 2 clusters, with live status, traffic and alerts.', extra: li(['Scenarios: Normal, DoS, Replay, Mixed, Recovery', 'One shared simulation state drives every page', 'Clearly labelled <b>Interactive simulation</b> — not real UAVs, not model output']) + '<div class="mt" style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn primary" href="#/swarm"><i data-lucide="rotate-3d"></i>Open 3D twin</a><a class="btn" href="#/attack"><i data-lucide="zap"></i>Attack lab</a></div>', vis: () => S.droneSVG('#FF5A76') },
    { k: 'Attack detection demo', h: '<h2>Real predictions on held-out traffic</h2>', lead: 'The AI Detection Lab sends a CSV to the local Python backend, which runs the saved Hybrid AE-Stacked Ensemble (binary benign / attack) trained with the original research script; Random Forest is kept as a 3-class baseline.', extra: li(['Upload any packet CSV or use the 2,000-row held-out sample', 'Per-row prediction and P(attack); confusion matrix and detection per attack type when labels exist', `Held-out macro F1 ${pct(D.liveHybrid?.heldout_metrics?.macro_f1)} · ROC AUC ${pct(D.liveHybrid?.heldout_metrics?.auc)} (binary)`]) + '<a class="btn primary mt" href="#/detect"><i data-lucide="scan-search"></i>Open detection lab</a>', vis: () => `<div class="big-stat"><div><small>Hybrid accuracy</small><strong>${pct(D.liveHybrid?.heldout_metrics?.accuracy)}</strong></div><div><small>Hybrid macro F1</small><strong>${pct(D.liveHybrid?.heldout_metrics?.macro_f1)}</strong></div><div><small>Held-out rows</small><strong>${num(D.liveHybrid?.split?.test || 0)}</strong></div></div>` },
    { k: 'Federated learning', h: '<h2>Privacy-preserving training</h2>', lead: `8 clients, 2 clusters, 5 rounds under strongly non-IID data (Dirichlet α = ${D.config?.dirichlet_alpha}).`, extra: li([`Federated MLP test macro F1 <b>${pct(ft.macroF1)}</b> vs centralized MLP <b>${pct((D.centralTest || []).find((r) => r.model.startsWith('MLP'))?.macroF1)}</b> — no accuracy lost by federating`, 'Top-k compression halves upload size per round (50.0%)', 'Raw packet data never leaves the UAV']), vis: () => `<div class="big-stat"><div><small>FL macro F1</small><strong style="color:#B9A2FF">${pct(ft.macroF1)}</strong></div><div><small>Rounds</small><strong>${ft.rounds}</strong></div><div><small>Upload saving</small><strong style="color:var(--green)">50%</strong></div></div>` },
    { k: 'Explainable AI', h: '<h2>Why was it flagged?</h2>', lead: 'Permutation importance shows which packet fields drive the decision.', extra: li(['<b>wlan.seq</b> — sequence-number anomalies (top feature)', '<b>wlan.duration</b> — abnormal channel reservation', '<b>time_since_last_packet</b> — burst behaviour', 'Method is permutation importance (SHAP planned, not executed)']), vis: () => `<div class="flow">${(D.xai || []).slice(0, 5).map((x, i) => `<div><i>${i + 1}</i><span class="mono" style="flex:1">${x.feature}</span><b class="mono c-cyan">${x.importance.toFixed(3)}</b></div>`).join('')}</div>` },
    { k: 'Experimental results', h: '<h2>Final model: binary attack detection</h2>', lead: 'Hybrid AE-Stacked Ensemble (autoencoder features + RF, XGBoost, LightGBM, Extra Trees, MLP → logistic-regression meta-learner).', extra: li(['3-class DoS vs Replay is capped at ~72–77% macro F1 by feature overlap (confirmed across 3 architectures)', 'Binary framing avoids that overlap and is the operational question: “is this traffic an attack?”']) + '<a class="btn mt" href="#/research"><i data-lucide="chart-column"></i>Full analytics</a>', vis: () => `<div class="big-stat"><div><small>Accuracy</small><strong>${pct(hb.accuracy)}</strong></div><div><small>Macro F1</small><strong style="color:var(--green)">${pct(hb.macro_f1)}</strong></div><div><small>ROC AUC</small><strong>${pct(hb.auc)}</strong></div></div>` },
    { k: 'Contributions & limitations', h: '<h2>What we delivered — honestly</h2>', lead: '', extra: `<div class="grid g-2" style="gap:12px"><div>${S.tag.verified}${li(['Hierarchical FL pipeline under non-IID data', 'Hybrid AE-stack: 94.3% acc / 93.3% macro F1 (binary)', 'Continual-learning and compression experiments', 'Interactive SOC platform serving the saved Hybrid model'])}</div><div>${S.tag.future}${li(['Real post-quantum signatures (ML-DSA)', 'SHAP / local explanations', 'Real UAV hardware & 100+ node scale', 'Latency and energy measurement'])}</div></div>`, vis: () => S.logoSVG.replace('class="brand-logo"', 'style="width:70%;max-width:280px;filter:drop-shadow(0 0 30px rgba(34,211,238,.5))"') },
  ];
  S.view('viva', {
    title: 'FYP Viva Presentation Mode',
    subtitle: 'A guided demonstration of the complete project · use ← → keys, F for fullscreen',
    render(el) {
      el.innerHTML = `<section class="viva" id="viva" aria-roledescription="carousel" aria-label="Viva presentation"><div class="viva-stage" id="vivaStage" aria-live="polite"></div>
        <div class="viva-bar"><span class="mono t2" id="vivaN" style="min-width:92px"></span><div class="progress"><span id="vivaP"></span></div>
          <button class="btn" id="vivaRestart" aria-label="Restart"><i data-lucide="rotate-ccw"></i><span class="hide-sm">Restart</span></button><button class="btn" id="vivaFs" aria-label="Fullscreen"><i data-lucide="maximize"></i></button><button class="btn" id="vivaPrev"><i data-lucide="chevron-left"></i>Previous</button><button class="btn primary" id="vivaNext">Next<i data-lucide="chevron-right"></i></button></div></section>
        <div class="grid g-4 mt" id="vivaIdx"></div>`;
      let i = 0;
      const show = () => {
        const s = SLIDES[i];
        $('#vivaStage').innerHTML = `<div><div class="kicker">${String(i + 1).padStart(2, '0')} · ${s.k}</div>${s.h}${s.lead ? `<p class="lead">${s.lead}</p>` : ''}${s.extra || ''}</div><div class="visual">${s.vis()}</div>`;
        $('#vivaN').textContent = `Slide ${i + 1} of ${SLIDES.length}`;
        $('#vivaP').style.width = ((i + 1) / SLIDES.length) * 100 + '%';
        $('#vivaPrev').disabled = i === 0; $('#vivaNext').innerHTML = i === SLIDES.length - 1 ? 'Finish<i data-lucide="check"></i>' : 'Next<i data-lucide="chevron-right"></i>';
        $$('#vivaIdx button').forEach((b, k) => b.classList.toggle('primary', k === i));
        S.icons();
      };
      $('#vivaIdx').innerHTML = SLIDES.map((s, k) => `<button class="btn sm" data-k="${k}" style="justify-content:flex-start">${k + 1}. ${s.k}</button>`).join('');
      $('#vivaIdx').onclick = (e) => { const b = e.target.closest('button'); if (b) { i = +b.dataset.k; show(); } };
      $('#vivaPrev').onclick = () => { if (i > 0) { i--; show(); } };
      $('#vivaNext').onclick = () => { if (i < SLIDES.length - 1) { i++; show(); } else S.toast('Presentation complete', 'Press Restart to begin again', 'ok'); };
      $('#vivaRestart').onclick = () => { i = 0; show(); };
      $('#vivaFs').onclick = () => { const v = $('#viva'); if (document.fullscreenElement) document.exitFullscreen(); else v.requestFullscreen && v.requestFullscreen().catch(() => S.toast('Fullscreen not available', '', 'warn')); };
      const key = (e) => { if (/input|select|textarea/i.test(e.target.tagName)) return; if (e.key === 'ArrowRight' || e.key === 'PageDown') $('#vivaNext').click(); else if (e.key === 'ArrowLeft' || e.key === 'PageUp') $('#vivaPrev').click(); else if (e.key.toLowerCase() === 'f') $('#vivaFs').click(); };
      document.addEventListener('keydown', key);
      show();
      return () => { document.removeEventListener('keydown', key); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
    },
  });

  /* ------------------------------------------------------------------ */
  /* 11. TEAM & DOCUMENTATION                                            */
  /* ------------------------------------------------------------------ */
  // Only verified team details are listed. Add your group member here:
  const TEAM = S.TEAM;
  S.view('about', {
    title: 'Team & Documentation',
    subtitle: 'Project information, objectives, architecture and technology stack',
    render(el) {
      el.innerHTML = `
      <div class="grid" style="grid-template-columns:minmax(0,1.3fr) minmax(0,1fr)" id="abTop">
        <article class="panel"><div class="panel-h"><div><h2>Project</h2></div><span class="chip cyan">BSIT-S26-013</span></div>
          <h3 style="margin:0 0 6px;font-size:19px;line-height:1.35">Scalable, Explainable, and Adaptive Quantum-Resilient Federated Learning for Non-IID UAV Swarm Cybersecurity</h3>
          <dl class="kv mt"><dt>University</dt><dd>Bahria University, Lahore Campus</dd><dt>Program</dt><dd>BS Information Technology — Final Year Project</dd><dt>Supervisor</dt><dd>Ms. Munaza Sher</dd><dt>Repository</dt><dd><a href="https://github.com/syedshah7214/seaql-uav" target="_blank" rel="noopener">github.com/syedshah7214/seaql-uav ↗</a></dd></dl></article>
        <article class="panel"><div class="panel-h"><h2>Team</h2><span class="muted" style="font-size:12px">BSIT · Bahria University, Lahore</span></div>
          <div class="team-cards">${TEAM.map((t) => `<div class="tcard"><span class="tav">${esc(t.name.split(' ').map((p) => p[0]).join('').slice(0, 2))}</span><div><b>${esc(t.name)}</b><small>${esc(t.role)}${t.id ? ' · ' + esc(t.id) : ''}</small></div></div>`).join('')}
          <div class="tcard sup"><span class="tav"><i data-lucide="graduation-cap"></i></span><div><b>Ms. Munaza Sher</b><small>Supervisor</small></div></div></div></article>
      </div>
      <article class="panel mt"><div class="panel-h"><div><h3>Project timeline</h3><p>Milestones in the order the work was built (no dates claimed)</p></div></div>
        <ol class="ptl">${[['Problem & literature review', 'UAV swarm threats: DoS flooding and replay', 'done'], ['Dataset audit & preprocessing', `Dataset_T-ITS.csv → ${S.num(D.dataAudit?.final_rows || 0)} clean labelled rows`, 'done'], ['Centralized baselines', 'Random Forest, MLP, Logistic Regression (3-class)', 'done'], ['Hierarchical federated learning', `8 clients · 2 clusters · ${(D.federatedRounds || []).length} rounds · non-IID`, 'done'], ['Hybrid AE-Stacked Ensemble', `Binary detection · ${S.pct(D.liveHybrid?.heldout_metrics?.accuracy, 2)} held-out accuracy`, 'done'], ['SOC platform & Viva mode', 'Detection Lab serving the saved model, simulation, XAI', 'done'], ['Post-quantum signatures & SHAP', 'Planned — not executed', 'future']].map(([t, d, st], i) => `<li class="${st}"><span class="n">${i + 1}</span><div><b>${t}</b><small>${d}</small></div></li>`).join('')}</ol></article>
      <article class="panel mt"><div class="panel-h"><div><h3>Research objectives — status</h3><p>Honest status of each objective against the recorded evidence</p></div></div>${OBJECTIVES.map(([t, s, d]) => `<div class="obj"><b>${t}</b>${stTag(s)}<p>${d}</p></div>`).join('')}</article>
      <div class="grid g-2 mt">
        <article class="panel"><div class="panel-h"><h3>System architecture</h3></div>
          <div class="flow"><div><i>UI</i>dashboard.html — 11-module SOC (vanilla JS, Chart.js, Three.js, Lucide)</div><div><i>SIM</i>app/js/core.js — one shared simulation state for every page</div><div><i>API</i>backend/server.py — Python std-lib server + <code>/api/predict</code></div><div><i>ML</i>backend/train_hybrid.py — trains &amp; saves the FYP Hybrid AE-Stack by calling uav_fl_hybrid_model_binary.py; backend/train_model.py — RF baseline</div><div><i>DATA</i>backend/build_dashboard_data.py — recorded metrics → app/data/seaql-data.js</div><div><i>R&amp;D</i>seaql-repo/src — original research pipeline (PyTorch, XGBoost, LightGBM)</div></div></article>
        <article class="panel"><div class="panel-h"><h3>Technology stack</h3></div>
          <div style="display:flex;flex-wrap:wrap;gap:8px">${['Python 3', 'scikit-learn', 'PyTorch', 'XGBoost', 'LightGBM', 'imbalanced-learn (SMOTE)', 'pandas / NumPy', 'Chart.js 4', 'Three.js r160', 'Lucide icons', 'HTML5 / CSS3 / ES2020', 'Python http.server API'].map((t) => `<span class="chip cyan">${t}</span>`).join('')}</div>
          <h4 class="sec-t mt">Documentation</h4>
          <div style="display:flex;flex-wrap:wrap;gap:8px"><a class="btn sm" href="index.html"><i data-lucide="globe"></i>Research website</a><a class="btn sm" href="documentation.html"><i data-lucide="book-open"></i>Documentation</a><a class="btn sm" href="readme.html"><i data-lucide="file-text"></i>README</a><a class="btn sm" href="https://github.com/syedshah7214/seaql-uav" target="_blank" rel="noopener"><i data-lucide="github"></i>GitHub</a></div>
          <p class="muted" style="font-size:12px;margin-top:12px">Thesis chapters: <code>seaql-repo/docs/</code></p></article>
      </div>
      <div class="grid g-2 mt">
        <article class="panel"><div class="panel-h"><h3>Project limitations</h3></div><ul class="limits">${LIMITS.slice(0, 6).map((l) => `<li><i data-lucide="triangle-alert"></i><span>${l}</span></li>`).join('')}</ul></article>
        <article class="panel"><div class="panel-h"><h3>Future improvements</h3>${S.tag.future}</div><ul class="limits">${['Execute ML-DSA / Kyber with liboqs and report signing/verification overhead', 'Add SHAP TreeExplainer for per-packet explanations', 'Run FL across real devices (e.g. Raspberry Pi / companion computers)', 'Scale experiments to 50–100+ simulated UAV clients', 'Measure detection latency and energy per update'].map((l) => `<li><i data-lucide="arrow-right" style="color:#B9A2FF"></i><span>${l}</span></li>`).join('')}</ul></article>
      </div>`;
    },
  });
})();
