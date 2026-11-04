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
  const stTag = (s) => (s === 'verified' ? S.tag.verified : s === 'future' ? S.tag.future : '<span class="tag sim" style="color:#7DEBFF;border-color:rgba(0,217,255,.35);background:rgba(0,217,255,.06)"><i data-lucide="circle-dashed"></i>Partially achieved</span>');

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
        <article class="panel" style="border-color:rgba(161,91,255,.4)"><div class="panel-h"><div><h2>Federated (FL) · Hierarchical MLP</h2><p>3-class · 8 clients · 5 rounds · α = ${D.config?.dirichlet_alpha}</p></div>${S.tag.verified}</div>
          <div class="metric-band" style="grid-template-columns:repeat(3,1fr)"><div><small>Macro F1</small><strong class="c-purple">${pct(ft.macroF1)}</strong></div><div><small>Accuracy</small><strong>${pct(ft.accuracy)}</strong></div><div><small>Macro AUC</small><strong>${pct(ft.auc)}</strong></div></div></article>
      </div>
      <div class="note warn mt"><i data-lucide="scale"></i><div><b>Read these separately.</b> The 94.3% / 93.3% figures are a <b>binary</b> task; the 59.7% federated figure is a <b>3-class</b> task. The fair centralized-vs-federated comparison is the same MLP on the same 3-class task: <b>${pct(mlp.macroF1)}</b> centralized vs <b>${pct(ft.macroF1)}</b> federated.</div></div>
      <div class="grid mt rs-row">
        <article class="panel"><div class="panel-h"><div><h3>Centralized vs Federated — Macro F1</h3><p>Colour shows the task: binary vs 3-class</p></div></div><div class="chart-box tall"><canvas id="rsCmp"></canvas></div></article>
        <article class="panel"><div class="panel-h"><div><h3>Dataset Class Distribution</h3><p>After cleaning & de-duplication</p></div>${S.tag.verified}</div>
          <div class="donut-wrap rs-donut"><div class="donut"><canvas id="rsCls"></canvas><div class="c"><div><strong>${num(totalRows)}</strong><small>samples</small></div></div></div>
          <div class="legend-list">${[['benign', '#22E39A'], ['DoS attack', '#FF4D6A'], ['Replay', '#FFC23D']].map(([c, col]) => `<div><i class="lg" style="background:${col};box-shadow:0 0 8px ${col}"></i><span>${c === 'benign' ? 'Benign' : c === 'DoS attack' ? 'DoS' : 'Replay'}</span><b>${(cd[c] / totalRows * 100).toFixed(1)}%</b></div>`).join('')}</div></div>
          <dl class="kv mt" style="font-size:12px"><dt>Raw rows</dt><dd class="mono">${num(D.dataAudit?.raw_rows || 0)}</dd><dt>Valid labelled rows</dt><dd class="mono">${num(D.dataAudit?.valid_labeled_rows || 0)}</dd><dt>Final rows (de-duplicated)</dt><dd class="mono">${num(D.dataAudit?.final_rows || 0)}</dd><dt>Features</dt><dd class="mono">${D.dataAudit?.features}</dd></dl></article>
      </div>
      <article class="panel mt"><div class="panel-h"><div><h3>Model Comparison — 3-class, held-out test</h3><p>Accuracy · precision · recall · F1 · ROC AUC</p></div><div class="right"><div class="seg" id="rsSeg"><button class="on" data-m="Random Forest">Random Forest</button><button data-m="MLP (early stopping)">MLP</button><button data-m="Logistic Regression">Logistic Reg.</button></div></div></div>
        <div class="grid" style="grid-template-columns:minmax(0,1.75fr) minmax(0,1fr)" id="rsCmpGrid">
          <div class="table-wrap"><table class="t"><thead><tr><th>Model</th><th>Task</th><th>Accuracy</th><th>Balanced acc.</th><th>Macro F1</th><th>Weighted F1</th><th>ROC AUC</th><th>Train time</th></tr></thead><tbody>
          ${ctest.map((r) => `<tr><td>${r.model}</td><td>3-class</td><td class="mono">${pct(r.accuracy)}</td><td class="mono">${pct(r.balancedAccuracy)}</td><td class="mono c-cyan">${pct(r.macroF1)}</td><td class="mono">${pct(r.weightedF1)}</td><td class="mono">${pct(r.auc)}</td><td class="mono">${r.trainSeconds?.toFixed(1)} s</td></tr>`).join('')}
          <tr><td>Hierarchical Federated MLP</td><td>3-class (FL)</td><td class="mono">${pct(ft.accuracy)}</td><td class="mono">${pct(ft.balancedAccuracy)}</td><td class="mono c-purple">${pct(ft.macroF1)}</td><td class="mono">${pct(ft.weightedF1)}</td><td class="mono">${pct(ft.auc)}</td><td class="mono">—</td></tr>
          <tr><td>Autoencoder (benign-only)</td><td>binary anomaly</td><td class="mono">${pct(D.autoencoder?.accuracy)}</td><td class="mono">${pct(D.autoencoder?.balancedAccuracy)}</td><td class="mono">F1 ${pct(D.autoencoder?.f1)}</td><td class="mono">—</td><td class="mono">${pct(D.autoencoder?.auc)}</td><td class="mono">—</td></tr>
          <tr><td><b>Hybrid AE-Stacked Ensemble</b> <span class="muted">(thesis run)</span></td><td>binary</td><td class="mono c-green">${pct(hb.accuracy)}</td><td class="mono">${pct(hb.balanced_accuracy)}</td><td class="mono c-green">${pct(hb.macro_f1)}</td><td class="mono">—</td><td class="mono">${pct(hb.auc)}</td><td class="mono">—</td></tr>${D.liveHybrid ? `<tr><td><b>Hybrid AE-Stacked Ensemble</b> <span class="chip cyan">v6 re-run · served live</span></td><td>binary</td><td class="mono c-green">${pct(D.liveHybrid.heldout_metrics.accuracy)}</td><td class="mono">${pct(D.liveHybrid.heldout_metrics.balanced_accuracy)}</td><td class="mono c-green">${pct(D.liveHybrid.heldout_metrics.macro_f1)}</td><td class="mono">—</td><td class="mono">${pct(D.liveHybrid.heldout_metrics.auc)}</td><td class="mono">—</td></tr>` : ''}</tbody></table></div>
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
        datasets: [{ data: [hb.macro_f1, rf.macroF1, mlp.macroF1, ft.macroF1], backgroundColor: ['#00D9FF', 'rgba(91,108,255,.85)', 'rgba(91,108,255,.6)', '#A15BFF'], borderRadius: 8, barPercentage: .62 }] },
        options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => 'Macro F1 ' + (c.raw * 100).toFixed(1) + '%' } } }, scales: { y: { min: 0, max: 1, ticks: { callback: (v) => v.toFixed(1) } }, x: { grid: { display: false } } } },
        plugins: [{ id: 'vals', afterDatasetsDraw(c) { const { ctx } = c; ctx.save(); ctx.fillStyle = '#EAF4FF'; ctx.font = '700 12px Inter'; ctx.textAlign = 'center'; c.getDatasetMeta(0).data.forEach((b, i) => ctx.fillText(c.data.datasets[0].data[i].toFixed(3), b.x, b.y - 8)); ctx.restore(); } }] });
      S.chart($('#rsCls'), { type: 'doughnut', data: { labels: ['Benign', 'DoS', 'Replay'], datasets: [{ data: [cd.benign, cd['DoS attack'], cd.Replay], backgroundColor: ['#22E39A', '#FF4D6A', '#FFC23D'], borderColor: '#0B1A30', borderWidth: 3 }] }, options: { cutout: '70%', plugins: { legend: { display: false } } } });
      const prChart = S.chart($('#rsPr'), { type: 'bar', data: { labels: ['Benign', 'DoS', 'Replay'], datasets: [{ label: 'Precision', data: [], backgroundColor: '#00D9FF', borderRadius: 5 }, { label: 'Recall', data: [], backgroundColor: '#A15BFF', borderRadius: 5 }, { label: 'F1', data: [], backgroundColor: '#22E39A', borderRadius: 5 }] },
        options: { scales: { y: { min: 0, max: 1 }, x: { grid: { display: false } } } } });
      const setPr = (m) => { const r = D.classReports?.[m]; if (!r) return; $('#rsSel').textContent = m; ['precision', 'recall', 'f1'].forEach((k, i) => (prChart.data.datasets[i].data = ['benign', 'DoS attack', 'Replay'].map((c) => r[c][k]))); prChart.update(); };
      setPr('Random Forest');
      $('#rsSeg').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; $$('#rsSeg button').forEach((x) => x.classList.toggle('on', x === b)); setPr(b.dataset.m); };
      if (cm) {
        const m = cm.matrix, lab = ['Benign', 'Attack'];
        $('#rsCm').innerHTML = `<div class="cm" style="grid-template-columns:90px 1fr 1fr;max-width:420px"><div></div><div class="hd">Pred. Benign</div><div class="hd">Pred. Attack</div>${m.map((row, i) => `<div class="hd" style="justify-content:end">True ${lab[i]}</div>${row.map((v, k) => `<div class="cell" style="height:62px;font-size:16px;background:${i === k ? 'rgba(0,217,255,.75)' : 'rgba(47,123,255,.18)'};color:${i === k ? '#03121F' : 'var(--text)'}">${num(v)}</div>`).join('')}`).join('')}</div>
          <p class="muted" style="font-size:12px;margin:12px 0 0">Attack rows broken down by original label: DoS ${num(cm.by3class['DoS attack'].attack)} detected / ${num(cm.by3class['DoS attack'].benign)} missed · Replay ${num(cm.by3class.Replay.attack)} detected / ${num(cm.by3class.Replay.benign)} missed.</p>`;
      }
      const prog = D.progression || [];
      S.chart($('#rsProg'), { type: 'bar', data: { labels: prog.map((p) => p.model.replace('Hybrid AE-Stacked Ensemble', 'Hybrid AE-Stack').replace(' (FINAL)', ' ★')), datasets: [{ data: prog.map((p) => p.macroF1), backgroundColor: prog.map((p) => (p.task.startsWith('binary') ? '#00D9FF' : '#5B6CFF')), borderRadius: 5 }] },
        options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${prog[c.dataIndex].task}: ${c.raw}% — ${prog[c.dataIndex].note}` } } }, scales: { x: { min: 0, max: 100, ticks: { callback: (v) => v + '%' } }, y: { grid: { display: false }, ticks: { font: { size: 10.5 } } } } } });
      S.chart($('#rsAe'), { type: 'line', data: { labels: (D.aeHistory || []).map((r) => r.epoch), datasets: [{ label: 'Train', data: D.aeHistory.map((r) => r.train), borderColor: '#00D9FF', pointRadius: 2, tension: .3 }, { label: 'Validation (benign)', data: D.aeHistory.map((r) => r.val), borderColor: '#A15BFF', pointRadius: 2, tension: .3 }] },
        options: { scales: { y: { type: 'logarithmic', ticks: { callback: (v) => { const e = Math.log10(v); return Number.isInteger(e) ? '1e' + e : ''; } } }, x: { title: { display: true, text: 'Epoch' } } } } });
      S.chart($('#rsFl'), { type: 'line', data: { labels: (D.federatedRounds || []).map((r) => 'R' + r.round), datasets: [{ label: 'Val macro F1', data: D.federatedRounds.map((r) => r.valMacroF1), borderColor: '#00D9FF', pointRadius: 4, tension: .3 }, { label: 'Val accuracy', data: D.federatedRounds.map((r) => r.valAccuracy), borderColor: '#22E39A', pointRadius: 4, tension: .3 }] },
        options: { scales: { y: { min: 0.45, max: 0.7 } } } });
      S.chart($('#rsCl'), { type: 'bar', data: { labels: (D.continual || []).map((r) => 'Chunk ' + r.chunk), datasets: [{ label: 'Before update', data: D.continual.map((r) => r.before), backgroundColor: 'rgba(161,91,255,.7)', borderRadius: 4 }, { label: 'After update', data: D.continual.map((r) => r.after), backgroundColor: '#00D9FF', borderRadius: 4 }] },
        options: { scales: { y: { min: 0.5, max: 0.8 }, x: { grid: { display: false } } } } });
    },
  });

  /* ------------------------------------------------------------------ */
  /* 10. VIVA PRESENTATION MODE                                          */
  /* ------------------------------------------------------------------ */
  const hb = D.hybridBinary || {}, ft = D.federatedTest || {}, cd = D.classDistribution || {};
  const li = (arr) => `<ul class="pts">${arr.map((t) => `<li><i data-lucide="chevron-right"></i><span>${t}</span></li>`).join('')}</ul>`;
  const cmlp = (D.centralTest || []).find((r) => r.model.startsWith('MLP')) || {};
  const crf = (D.centralTest || []).find((r) => r.model === 'Random Forest') || {};
  const da = D.dataAudit || {};
  // ---- research diagrams (inline SVG, drawn from real numbers) ----
  const dArch = () => `<svg class="vd" viewBox="0 0 520 360"><defs><marker id="va" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#00D9FF"/></marker></defs>
    ${[0, 1, 2, 3].map((k) => `<g transform="translate(${30 + k * 58} 300)"><rect x="-24" y="-16" width="48" height="32" rx="8" class="vd-n a"/><text y="5" class="vd-t">U${['01', '03', '05', '07'][k]}</text></g>`).join('')}
    ${[0, 1, 2, 3].map((k) => `<g transform="translate(${316 + k * 58} 300)"><rect x="-24" y="-16" width="48" height="32" rx="8" class="vd-n b"/><text y="5" class="vd-t">U${['02', '04', '06', '08'][k]}</text></g>`).join('')}
    ${[0, 1, 2, 3].map((k) => `<path d="M${30 + k * 58} 284 L117 222" class="vd-l" marker-end="url(#va)"/><path d="M${316 + k * 58} 284 L403 222" class="vd-l b" marker-end="url(#va)"/>`).join('')}
    <g transform="translate(117 205)"><circle r="20" class="vd-n a"/><text y="4" class="vd-t">Agg A</text></g><g transform="translate(403 205)"><circle r="20" class="vd-n b"/><text y="4" class="vd-t">Agg B</text></g>
    <path d="M135 195 L238 128" class="vd-l" marker-end="url(#va)"/><path d="M385 195 L282 128" class="vd-l b" marker-end="url(#va)"/>
    <g transform="translate(260 105)"><circle r="34" fill="url(#vg)"/><circle r="34" fill="none" stroke="#7DF0FF" stroke-width="2"/><text y="-2" class="vd-t" style="font-size:12px">Global</text><text y="13" class="vd-t" style="font-size:11px">model</text></g>
    <radialGradient id="vg"><stop stop-color="#3FE6FF"/><stop offset="1" stop-color="#3A1E9A"/></radialGradient>
    <text x="260" y="40" class="vd-c">weighted FedAvg · top-k 25% uploads</text><text x="117" y="345" class="vd-c" fill="#00D9FF">Cluster A</text><text x="403" y="345" class="vd-c" fill="#C59BFF">Cluster B</text>
    <text x="260" y="250" class="vd-c" style="font-size:10px">raw packets never leave the UAV</text></svg>`;
  const dData = () => { const st = [['Raw rows', da.raw_rows], ['Valid labels', da.valid_labeled_rows], ['De-duplicated', da.final_rows]]; const mx = st[0][1] || 1;
    return `<div class="vfun">${st.map(([l, v], k) => `<div class="vf" style="width:${40 + 60 * v / mx}%"><b>${num(v || 0)}</b><span>${l}</span></div>`).join('')}</div>
    <div class="vbars">${[['Benign', cd.benign, '#22E39A'], ['DoS attack', cd['DoS attack'], '#FF4D6A'], ['Replay', cd.Replay, '#FFC23D']].map(([l, v, c]) => `<div><span>${l}</span><i style="width:${(v / (da.final_rows || 1) * 100 * 2).toFixed(0)}%;background:${c}"></i><b class="mono">${num(v || 0)}</b></div>`).join('')}</div>`; };
  const dModel = () => `<div class="vstack"><div class="vs-in">32 packet features<small>imputed · RobustScaler · SMOTE (train only)</small></div><div class="vs-ar">↓</div>
    <div class="vs-ae">Autoencoder (benign-only) → anomaly features</div><div class="vs-ar">↓</div>
    <div class="vs-base">${['Random Forest', 'XGBoost', 'LightGBM', 'Extra Trees', 'MLP'].map((m) => `<span>${m}</span>`).join('')}</div><div class="vs-ar">↓</div>
    <div class="vs-meta">Logistic-regression meta-learner → <b>attack / benign</b></div></div>`;
  const dFl = () => { const R = D.federatedRounds || []; return `<div class="vfl">${R.map((r) => `<div><i style="height:${((r.valMacroF1 - 0.4) / 0.3 * 100).toFixed(0)}%"></i><b class="mono">${pct(r.valMacroF1)}</b><span>R${r.round}</span></div>`).join('')}</div><p class="vcap">Validation macro F1 per round (recorded) · final test ${pct(ft.macroF1)}</p>`; };
  const dXai = () => { const X = (D.xai || []).slice(0, 6), mx = X[0]?.importance || 1; return `<div class="vbars x">${X.map((x) => `<div><span class="mono">${x.feature}</span><i style="width:${(x.importance / mx * 100).toFixed(0)}%"></i><b class="mono">${x.importance.toFixed(3)}</b></div>`).join('')}</div><p class="vcap">Permutation importance (mean macro-F1 drop) · Random Forest, test set</p>`; };
  const dRes = () => `<div class="big-stat"><div><small>Accuracy</small><strong>${pct(hb.accuracy)}</strong></div><div><small>Macro F1</small><strong style="color:var(--green)">${pct(hb.macro_f1)}</strong></div><div><small>ROC AUC</small><strong>${pct(hb.auc)}</strong></div></div>
    <div class="vbars r">${[['Hybrid AE-Stack · binary', hb.macro_f1, '#00D9FF'], ['Random Forest · 3-class', crf.macroF1, '#5B6CFF'], ['Federated MLP · 3-class', ft.macroF1, '#A15BFF'], ['Centralized MLP · 3-class', cmlp.macroF1, '#5B6CFF']].map(([l, v, c]) => `<div><span>${l}</span><i style="width:${(v * 100).toFixed(0)}%;background:${c}"></i><b class="mono">${pct(v)}</b></div>`).join('')}</div><p class="vcap">Macro F1 · binary and 3-class are different tasks</p>`;
  const dThreat = () => `<svg class="vd" viewBox="0 0 520 330">${[[150, 120], [260, 80], [370, 120], [200, 220], [320, 220]].map(([x, y], k) => `<g transform="translate(${x} ${y})" class="${k === 1 || k === 4 ? 'vd-hot' : ''}"><circle r="26" fill="${k === 1 || k === 4 ? 'rgba(255,46,85,.18)' : 'rgba(0,217,255,.1)'}" stroke="${k === 1 || k === 4 ? '#FF4D6A' : '#00D9FF'}" stroke-width="2"/><path d="M-9 -9L9 9M9 -9L-9 9" stroke="${k === 1 || k === 4 ? '#FF4D6A' : '#00D9FF'}" stroke-width="2.4" stroke-linecap="round"/><rect x="-5" y="-5" width="10" height="10" rx="2" fill="#06121F" stroke="${k === 1 || k === 4 ? '#FF4D6A' : '#00D9FF'}" stroke-width="2"/></g>`).join('')}
    <path d="M150 120 L260 80 L370 120 L320 220 L200 220 Z" fill="none" stroke="rgba(0,217,255,.35)" stroke-dasharray="4 5"/>
    <g transform="translate(470 40)"><circle r="20" fill="rgba(255,46,85,.15)" stroke="#FF2E55" stroke-width="2"/><text y="5" class="vd-t" fill="#FF8A9E">DoS</text></g><path d="M452 50 Q 360 40 284 72" fill="none" stroke="#FF2E55" stroke-width="2" stroke-dasharray="5 5"/>
    <g transform="translate(470 290)"><circle r="20" fill="rgba(255,194,61,.15)" stroke="#FFC23D" stroke-width="2"/><text y="5" class="vd-t" fill="#FFC23D">Replay</text></g><path d="M452 282 Q 400 250 344 228" fill="none" stroke="#FFC23D" stroke-width="2" stroke-dasharray="5 5"/>
    <text x="40" y="310" class="vd-c" style="text-anchor:start">flooding exhausts the shared channel · replayed frames deceive the swarm</text></svg>`;
  const SLIDES = [
    { k: 'FYP Demonstration', h: '<h2 class="hero">SEAQL</h2>', lead: 'Scalable, Explainable, and Adaptive Quantum-Resilient Federated Learning for UAV Swarm Cybersecurity', extra: '<div class="mt" style="display:flex;gap:10px;flex-wrap:wrap"><span class="pill live"><span class="dot"></span>BS Information Technology · Bahria University, Lahore Campus</span><span class="pill">Supervisor: Ms. Munaza Sher</span><span class="pill">Project BSIT-S26-013</span></div>', vis: () => `<svg class="drone-hero" viewBox="0 0 120 80">${S.droneSVG('#00D9FF').replace(/<\/?svg[^>]*>/g, '')}</svg>` },
    { k: 'Research problem', h: '<h2>UAV swarms talk over open wireless links</h2>', lead: 'Surveillance, disaster-response and logistics swarms depend on real-time radio links that attackers can flood or replay.', extra: li(['<b>DoS flooding</b> exhausts the channel and each UAV\'s processing budget', '<b>Replay attacks</b> re-transmit captured legitimate frames', 'Centralized IDS needs all raw traffic in one place — privacy and bandwidth cost', 'Security decisions are rarely explainable to operators']), vis: dThreat },
    { k: 'Proposed architecture', h: '<h2>Hierarchical, federated, explainable</h2>', lead: 'Each UAV trains locally; cluster aggregators combine updates; a global aggregator builds the shared model.', extra: li(['Three tiers: UAV client → cluster aggregator → global aggregator', 'Top-k (25%) compressed updates reduce radio traffic', 'Hybrid detector + permutation-importance explanations']), vis: dArch },
    { k: 'Dataset & preprocessing', h: '<h2>Real packet capture</h2>', lead: `Dataset_T-ITS.csv: ${num(da.raw_rows || 0)} raw rows → ${num(da.final_rows || 0)} clean, labelled, de-duplicated rows with ${da.features} numeric features.`, extra: li(['Dropped leakage-prone identifiers (timestamp_c, frame.number)', 'Train-only median imputation + RobustScaler (10–90)', 'Stratified 60 / 20 / 20 split, seed 42', 'SMOTE applied to the training split only']), vis: dData },
    { k: 'Models', h: '<h2>Hybrid AE-Stacked Ensemble</h2>', lead: 'An autoencoder trained on benign traffic adds anomaly signals; five diverse learners are stacked by a logistic-regression meta-learner.', extra: li(['Baselines: Logistic Regression, MLP, Random Forest, Autoencoder', 'DoS vs Replay overlap caps every 3-class model near 72–77% macro F1', 'Final framing: binary attack-vs-benign detection']), vis: dModel },
    { k: 'Federated training', h: '<h2>Privacy-preserving training</h2>', lead: `8 clients, 2 clusters, ${ft.rounds} rounds under strongly non-IID data (Dirichlet α = ${D.config?.dirichlet_alpha}).`, extra: li([`Federated MLP ${pct(ft.macroF1)} vs centralized MLP ${pct(cmlp.macroF1)} macro F1 — same 3-class task`, 'Top-k compression halves upload size per round (50.0%)', 'Raw packet data never leaves the client']), vis: dFl },
    { k: 'Explainability', h: '<h2>Why was it flagged?</h2>', lead: 'Permutation importance ranks the packet fields that drive the decision.', extra: li(['<b>wlan.seq</b> — sequence anomalies, the top feature', '<b>wlan.duration</b> — abnormal channel reservation', '<b>time_since_last_packet</b> — burst behaviour', 'SHAP was planned but not executed — this is not SHAP']), vis: dXai },
    { k: 'Results', h: '<h2>Final model: binary attack detection</h2>', lead: `Hybrid AE-Stack on ${num(D.hybridBinaryConfusion?.testRows || 0)} held-out test rows.`, extra: li([`Attack precision ${pct(hb.attack_precision)} · attack recall ${pct(hb.attack_recall)}`, 'Binary and 3-class results are reported separately', `AI Detection Lab serves this model, re-trained with the original script: ${pct(D.liveHybrid?.heldout_metrics?.accuracy)} acc · ${pct(D.liveHybrid?.heldout_metrics?.macro_f1)} F1 · ${pct(D.liveHybrid?.heldout_metrics?.auc)} AUC on its held-out split`]) + '<a class="btn mt" href="#/research"><i data-lucide="chart-column"></i>Full analytics</a>', vis: dRes },
    { k: 'Live demonstration', h: '<h2>See it working</h2>', lead: 'Mission Control replays a scripted, reproducible attack; the AI Detection Lab runs real predictions on uploaded CSV traffic.', extra: '<div class="mt" style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn demo-cta" href="#/mission" id="vivaDemo"><i data-lucide="circle-play"></i>Run FYP demo</a><a class="btn primary" href="#/detect"><i data-lucide="scan-search"></i>AI Detection Lab</a><a class="btn" href="#/swarm"><i data-lucide="rotate-3d"></i>3D swarm</a></div>' + li(['Simulation events are labelled <b>Interactive simulation</b>', `Detection Lab: Hybrid AE-Stack (binary, ${pct(D.liveHybrid?.heldout_metrics?.accuracy)} held-out acc.) with Random Forest as a 3-class baseline`]), vis: () => S.droneSVG('#FF4D6A') },
    { k: 'Limitations', h: '<h2>What the evidence does not show</h2>', lead: '', extra: li(LIMITS.slice(0, 6)), vis: () => `<div class="big-stat"><div><small>3-class ceiling</small><strong style="color:var(--amber)">~72–77%</strong></div><div><small>FL rounds</small><strong>${ft.rounds}</strong></div><div><small>PQC executed</small><strong style="color:var(--red)">No</strong></div></div>` },
    { k: 'Future work', h: '<h2>Next steps</h2>', lead: '', extra: li(['Execute ML-DSA / Kyber with liboqs and measure overhead', 'SHAP TreeExplainer for per-packet explanations', 'Federated runs on real companion computers', 'Scale to 50–100+ clients; measure latency and energy']), vis: () => `<div class="flow">${['Post-quantum security', 'SHAP on the live model', 'Local explanations', 'Real devices', 'Scale & energy'].map((t, k) => `<div><i>${k + 1}</i>${t}</div>`).join('')}</div>` },
    { k: 'Thank you', h: '<h2 class="hero" style="font-size:56px">Questions?</h2>', lead: 'SEAQL — federated, explainable intrusion detection for UAV swarms.', extra: `<div class="mt" style="display:flex;gap:10px;flex-wrap:wrap">${S.tag.verified}${S.tag.sim}${S.tag.model}${S.tag.future}</div><p class="muted mt" style="font-size:13px">Every number on screen is labelled by evidence type.</p>`, vis: () => S.logoSVG.replace('class="brand-logo"', 'style="width:70%;max-width:280px;filter:drop-shadow(0 0 30px rgba(0,217,255,.5))"') },
  ];
  S.view('viva', {
    title: 'FYP Viva Presentation Mode',
    subtitle: 'A guided demonstration of the complete project · use ← → keys, F for fullscreen',
    render(el) {
      el.innerHTML = `<section class="viva" id="viva" aria-roledescription="carousel" aria-label="Viva presentation"><div class="viva-stage" id="vivaStage" aria-live="polite"></div>
        <div class="viva-bar"><span class="mono t2" id="vivaN" style="min-width:92px"></span><div class="progress"><span id="vivaP"></span></div>
          <button class="btn" id="vivaRestart" aria-label="Restart"><i data-lucide="rotate-ccw"></i><span class="hide-sm">Restart</span></button><button class="btn" id="vivaFs" aria-label="Fullscreen"><i data-lucide="maximize"></i></button><button class="btn" id="vivaPrev"><i data-lucide="chevron-left"></i>Previous</button><button class="btn primary" id="vivaNext">Next<i data-lucide="chevron-right"></i></button></div></section>
        <div class="viva-idx mt" id="vivaIdx"></div>`;
      let i = 0;
      const show = () => {
        const s = SLIDES[i];
        const stg = $('#vivaStage'); stg.classList.remove('enter'); void stg.offsetWidth; stg.classList.add('enter');
        stg.innerHTML = `<div><div class="kicker">${String(i + 1).padStart(2, '0')} · ${s.k}</div>${s.h}${s.lead ? `<p class="lead">${s.lead}</p>` : ''}${s.extra || ''}</div><div class="visual">${s.vis()}</div>`;
        $('#vivaN').textContent = `Slide ${i + 1} of ${SLIDES.length}`;
        $('#vivaP').style.width = ((i + 1) / SLIDES.length) * 100 + '%';
        $('#vivaPrev').disabled = i === 0; $('#vivaNext').innerHTML = i === SLIDES.length - 1 ? 'Finish<i data-lucide="check"></i>' : 'Next<i data-lucide="chevron-right"></i>';
        $$('#vivaIdx button').forEach((b, k) => b.classList.toggle('primary', k === i));
        const dm = $('#vivaDemo'); if (dm) dm.onclick = (e) => { e.preventDefault(); S.go('mission'); setTimeout(() => S.demo.start(), 300); };
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
  const TEAM = [
    { name: 'Arooba Mansoor', role: 'Team member', id: '03-135231-009' },
    // { name: 'Group member name', role: 'Team member', id: 'Enrollment no.' },
  ];
  S.view('about', {
    title: 'Team & Documentation',
    subtitle: 'Project information, objectives, architecture and technology stack',
    render(el) {
      el.innerHTML = `
      <div class="grid" style="grid-template-columns:minmax(0,1.3fr) minmax(0,1fr)" id="abTop">
        <article class="panel"><div class="panel-h"><div><h2>Project</h2></div><span class="chip cyan">BSIT-S26-013</span></div>
          <h3 style="margin:0 0 6px;font-size:19px;line-height:1.35">Scalable, Explainable, and Adaptive Quantum-Resilient Federated Learning for Non-IID UAV Swarm Cybersecurity</h3>
          <dl class="kv mt"><dt>University</dt><dd>Bahria University, Lahore Campus</dd><dt>Program</dt><dd>BS Information Technology — Final Year Project</dd><dt>Supervisor</dt><dd>Ms. Munaza Sher</dd><dt>Repository</dt><dd><a href="https://github.com/syedshah7214/seaql-uav" target="_blank" rel="noopener">github.com/syedshah7214/seaql-uav ↗</a></dd></dl></article>
        <article class="panel"><div class="panel-h"><h2>Team</h2><span class="muted" style="font-size:12px">edit TEAM in app/js/views-research.js</span></div>
          <div class="grid" style="gap:10px">${TEAM.map((t) => `<div style="display:flex;gap:12px;align-items:center;padding:12px;border:1px solid var(--line);border-radius:11px"><span class="ic" style="width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:rgba(0,217,255,.12);color:var(--cyan);font-weight:800">${esc(t.name.split(' ').map((p) => p[0]).join('').slice(0, 2))}</span><div><b>${esc(t.name)}</b><div class="muted" style="font-size:12px">${esc(t.role)}${t.id ? ' · ' + esc(t.id) : ''}</div></div></div>`).join('')}
          <div style="display:flex;gap:12px;align-items:center;padding:12px;border:1px solid var(--line);border-radius:11px"><span style="width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:rgba(161,91,255,.14);color:#C59BFF"><i data-lucide="graduation-cap"></i></span><div><b>Ms. Munaza Sher</b><div class="muted" style="font-size:12px">Supervisor</div></div></div></div></article>
      </div>
      <article class="panel mt"><div class="panel-h"><div><h3>Research objectives — status</h3><p>Honest status of each objective against the recorded evidence</p></div></div>${OBJECTIVES.map(([t, s, d]) => `<div class="obj"><b>${t}</b>${stTag(s)}<p>${d}</p></div>`).join('')}</article>
      <div class="grid g-2 mt">
        <article class="panel"><div class="panel-h"><h3>System architecture</h3></div>
          <div class="flow"><div><i>UI</i>dashboard.html — 11-module SOC (vanilla JS, Chart.js, Three.js, Lucide)</div><div><i>SIM</i>app/js/core.js — one shared simulation state for every page</div><div><i>API</i>backend/server.py — Python std-lib server + <code>/api/predict</code></div><div><i>ML</i>backend/train_hybrid.py — trains &amp; saves the FYP Hybrid AE-Stack by calling uav_fl_hybrid_model_binary.py; backend/train_model.py — RF baseline</div><div><i>DATA</i>backend/build_dashboard_data.py — recorded metrics → app/data/seaql-data.js</div><div><i>R&amp;D</i>seaql-repo/src — original research pipeline (PyTorch, XGBoost, LightGBM)</div></div></article>
        <article class="panel"><div class="panel-h"><h3>Technology stack</h3></div>
          <div style="display:flex;flex-wrap:wrap;gap:8px">${['Python 3', 'scikit-learn', 'PyTorch', 'XGBoost', 'LightGBM', 'imbalanced-learn (SMOTE)', 'pandas / NumPy', 'Chart.js 4', 'Three.js r160', 'Lucide icons', 'HTML5 / CSS3 / ES2020', 'Python http.server API', 'NumPy AE inference'].map((t) => `<span class="chip cyan">${t}</span>`).join('')}</div>
          <h4 class="sec-t mt">Documentation</h4>
          <div style="display:flex;flex-wrap:wrap;gap:8px"><a class="btn sm" href="index.html"><i data-lucide="globe"></i>Research website</a><a class="btn sm" href="documentation.html"><i data-lucide="book-open"></i>Documentation</a><a class="btn sm" href="readme.html"><i data-lucide="file-text"></i>README</a><a class="btn sm" href="https://github.com/syedshah7214/seaql-uav" target="_blank" rel="noopener"><i data-lucide="github"></i>GitHub</a></div>
          <p class="muted" style="font-size:12px;margin-top:12px">Thesis chapters: <code>seaql-repo/docs/</code></p></article>
      </div>
      <div class="grid g-2 mt">
        <article class="panel"><div class="panel-h"><h3>Project limitations</h3></div><ul class="limits">${LIMITS.slice(0, 6).map((l) => `<li><i data-lucide="triangle-alert"></i><span>${l}</span></li>`).join('')}</ul></article>
        <article class="panel"><div class="panel-h"><h3>Future improvements</h3>${S.tag.future}</div><ul class="limits">${['Execute ML-DSA / Kyber with liboqs and report signing/verification overhead', 'Add SHAP TreeExplainer for per-packet explanations', 'Run FL across real devices (e.g. Raspberry Pi / companion computers)', 'Scale experiments to 50–100+ simulated UAV clients', 'Measure detection latency and energy per update'].map((l) => `<li><i data-lucide="arrow-right" style="color:#C59BFF"></i><span>${l}</span></li>`).join('')}</ul></article>
      </div>`;
    },
  });
})();
