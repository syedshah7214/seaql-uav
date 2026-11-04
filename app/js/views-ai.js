/* SEAQL — AI views: Detection Lab (real model via local backend), Federated Learning, Explainable AI */
(function () {
  'use strict';
  const { $, $$, esc, num, pct } = S;
  const D = S.data;
  const CLS_COLOR = { benign: '#22E39A', 'DoS attack': '#FF4D6A', Replay: '#FFC23D' };
  const clsKey = (c) => (c === 'benign' ? 'benign' : c === 'Replay' ? 'replay' : 'dos');

  /* ------------------------------------------------------------------ */
  /* 4. AI INTRUSION DETECTION LAB                                       */
  /* ------------------------------------------------------------------ */
  // Two real models are served by backend/server.py:
  //   hybrid = the FYP model (Hybrid AE-Stacked Ensemble, binary benign/attack)  [default]
  //   rf     = Random Forest 3-class baseline
  const MODELS = {
    hybrid: { label: 'Hybrid AE-Stacked Ensemble', short: 'Hybrid AE-Stack', sub: 'FYP model · binary', sample: 'app/samples/hybrid_heldout_test_sample.csv' },
    rf: { label: 'Random Forest (3-class)', short: 'Random Forest', sub: 'baseline · 3-class', sample: 'app/samples/uav_traffic_test_sample.csv' },
  };
  const ORDER = ['benign', 'DoS attack', 'Replay', 'attack'];
  const NICE = { benign: 'Benign', 'DoS attack': 'DoS', Replay: 'Replay', attack: 'Attack' };
  const LONG = { benign: 'Benign (Normal)', 'DoS attack': 'DoS Attack', Replay: 'Replay Attack', attack: 'Attack (DoS / Replay)' };
  CLS_COLOR.attack = '#FF4D6A';
  const kOf = (c) => (c === 'attack' ? 'dos' : clsKey(c));
  const pv = (p, c) => (p && Number.isFinite(p[c]) ? p[c] : 0);
  const lastResult = {};
  let currentModel = 'hybrid';

  S.view('detect', {
    title: 'AI Intrusion Detection Laboratory',
    subtitle: 'Run the trained models on UAV network traffic (CSV) — real predictions from the local Python backend',
    render(el) {
      el.innerHTML = `
      <div class="model-switch" role="radiogroup" aria-label="Detection model" id="dtModels">
        ${Object.entries(MODELS).map(([k, m]) => `<button role="radio" data-m="${k}" class="ms-btn ${k}"><span class="ms-ic"><i data-lucide="${k === 'hybrid' ? 'brain-circuit' : 'trees'}"></i></span><span><b>${m.label}</b><small>${m.sub}</small></span><span class="ms-state" data-state="${k}"><span class="spinner"></span></span></button>`).join('')}
      </div>
      <div class="grid mt" style="grid-template-columns:minmax(0,1.3fr) minmax(0,1fr)" id="dtTop">
        <article class="panel"><div class="panel-h"><div><h2>Upload Dataset (CSV)</h2><p>Packet-level rows with the same columns as Dataset_T-ITS.csv · optional <code>class</code> column enables evaluation</p></div><span id="dtStatus"></span></div>
          <div class="drop" id="dtDrop"><i data-lucide="upload-cloud" class="big"></i><div><b>Drop a CSV file here</b><div class="muted" style="font-size:12px">or choose a file · max 25 MB / 100,000 rows</div></div></div>
          <div class="file-row mt"><label class="btn" for="dtFile"><i data-lucide="folder-open"></i>Choose File</label><input type="file" id="dtFile" accept=".csv,text/csv" class="sr-only"><span class="file-name" id="dtName">No file selected</span><button class="btn primary" id="dtRun" disabled><i data-lucide="play"></i>Run Detection</button></div>
          <div class="file-row mt"><button class="btn sm" id="dtSample"><i data-lucide="database"></i><span id="dtSampleL">Load held-out test sample</span></button><a class="btn sm ghost" id="dtSampleDl" download><i data-lucide="download"></i>Download sample</a><a class="btn sm ghost" href="app/samples/uav_traffic_unlabeled_sample.csv" download><i data-lucide="download"></i>Unlabelled sample</a></div>
          <div id="dtMsg" class="mt"></div></article>
        <article class="panel"><div class="panel-h"><h2>Model Card</h2><span id="dtModelTag"></span></div><div id="dtModel"><div class="empty"><div class="spinner"></div>Checking backend…</div></div></article>
      </div>
      <article class="panel mt" id="dtCmp" hidden></article>
      <div id="dtOut"></div>`;
      let text = null, fname = '', health = null, cards = {};
      const msg = (html, kind = 'info') => { $('#dtMsg').innerHTML = html ? `<div class="note ${kind}"><i data-lucide="${kind === 'err' ? 'circle-x' : kind === 'warn' ? 'triangle-alert' : kind === 'ok' ? 'circle-check' : 'info'}"></i><div>${html}</div></div>` : ''; S.icons(); };
      const ready = (k) => health && health.models && health.models[k] && health.models[k].status === 'ready';
      const setRunState = () => { $('#dtRun').disabled = !(text && ready(currentModel)); };
      const setFile = (t, n) => { text = t; fname = n; $('#dtName').textContent = n + ` · ${(t.length / 1024).toFixed(0)} KB`; setRunState(); msg(''); };
      const readFile = (f) => {
        if (!f) return;
        if (!/\.csv$/i.test(f.name) && f.type !== 'text/csv') { msg(`<b>${esc(f.name)}</b> is not a CSV file. Please choose a .csv file.`, 'err'); return; }
        if (f.size > 25 * 1024 * 1024) { msg('File is larger than 25 MB.', 'err'); return; }
        const r = new FileReader(); r.onload = () => setFile(String(r.result), f.name); r.onerror = () => msg('Could not read the file.', 'err'); r.readAsText(f);
      };
      $('#dtFile').onchange = (e) => readFile(e.target.files[0]);
      const drop = $('#dtDrop');
      ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
      ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
      drop.addEventListener('drop', (e) => readFile(e.dataTransfer.files[0]));
      $('#dtSample').onclick = async () => {
        const url = MODELS[currentModel].sample;
        try { const r = await fetch(url); if (!r.ok) throw new Error(r.status); setFile(await r.text(), url.split('/').pop()); if (ready(currentModel)) run(); }
        catch (e) { msg('Sample file could not be loaded. Open the dashboard through <code>python backend\\server.py</code> (not by double-clicking the HTML file).', 'err'); }
      };
      $('#dtRun').onclick = () => run();
      $('#dtModels').onclick = (e) => { const b = e.target.closest('[data-m]'); if (b) selectModel(b.dataset.m); };

      function selectModel(k) {
        currentModel = k;
        $$('#dtModels [data-m]').forEach((b) => { const on = b.dataset.m === k; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
        $('#dtSampleL').textContent = k === 'hybrid' ? 'Load hybrid held-out test sample (2,000 labelled rows)' : 'Load RF held-out test sample (2,000 labelled rows)';
        $('#dtSampleDl').href = MODELS[k].sample;
        paintStatus(); modelCard(); setRunState();
        $('#dtOut').innerHTML = '';
        if (lastResult[k]) renderResult(lastResult[k]);
      }
      function paintStatus() {
        Object.keys(MODELS).forEach((k) => {
          const st = health?.models?.[k]?.status || (health ? 'error' : 'offline');
          $(`[data-state="${k}"]`).innerHTML = st === 'ready' ? '<span class="dot"></span>Ready' : st === 'training' ? '<span class="spinner"></span>Training' : st === 'loading' ? '<span class="spinner"></span>Loading' : '<span class="dot red"></span>' + (st === 'offline' ? 'Offline' : 'Unavailable');
        });
        const st = health?.models?.[currentModel]?.status;
        $('#dtStatus').innerHTML = !health ? '<span class="pill crit"><span class="dot red"></span>Backend offline</span>'
          : st === 'ready' ? '<span class="pill live"><span class="dot"></span>Model ready</span>'
            : st === 'error' ? '<span class="pill crit"><span class="dot red"></span>Model unavailable</span>' : '<span class="pill paused"><span class="dot amber"></span>Model loading…</span>';
      }

      async function checkBackend() {
        try {
          health = await fetch(S.api('api/health'), { cache: 'no-store' }).then((r) => r.json());
          if (!health.models) health.models = { rf: { status: health.model_loaded ? 'ready' : 'loading' }, hybrid: { status: 'error', error: 'Backend is from an older version — restart backend\\server.py.' } };
          try { cards = await fetch(S.api('api/models'), { cache: 'no-store' }).then((r) => r.json()); } catch (e) { cards = {}; }
          paintStatus(); modelCard(); comparison(); setRunState();
          if (['loading', 'training'].includes(health.models.hybrid.status) || health.models.rf.status === 'loading') setTimeout(() => { if (S.current() === 'detect') checkBackend(); }, 4000);
        } catch (e) { health = null; paintStatus(); modelCard(); setRunState(); }
      }
      const offNote = `<div class="note err" style="margin-bottom:12px"><i data-lucide="plug-zap"></i><div><b>Python backend not reachable${S.API_BASE ? ` at <code>${esc(S.API_BASE)}</code>` : ''}.</b> Predictions need the model server. Locally, run <code>python backend\\server.py</code> in PowerShell and open <code>http://localhost:8000/dashboard.html</code>. On the hosted site, set the backend URL in <code>app/js/config.js</code>. No predictions are faked while it is offline.</div></div>`;
      function modelCard() {
        const k = currentModel, st = health?.models?.[k];
        $('#dtModelTag').innerHTML = st?.status === 'ready' ? S.tag.model : '';
        if (!health) { $('#dtModel').innerHTML = offNote; S.icons(); return; }
        if (st?.status !== 'ready') {
          $('#dtModel').innerHTML = st?.status === 'error' ? `<div class="note err"><i data-lucide="circle-x"></i><div>${esc(st.error || 'Model unavailable')}</div></div>`
            : `<div class="empty"><div class="spinner"></div>${st?.status === 'training' ? 'The Hybrid model is being trained with the original research script (several minutes on first run)…' : 'Loading model…'}</div>`;
          S.icons(); return;
        }
        if (k === 'hybrid') {
          const c = cards.hybrid || {}, m = c.heldout_metrics || {}, t = c.thesis_recorded_metrics || {};
          $('#dtModel').innerHTML = `<dl class="kv"><dt>Model</dt><dd>Hybrid AE-Stacked Ensemble</dd><dt>Task</dt><dd>binary · benign vs attack</dd>
            <dt>Pipeline</dt><dd>impute → RobustScaler → AE features → 5-model stack</dd><dt>Base learners</dt><dd>RF · XGBoost · LightGBM · ExtraTrees · MLP</dd><dt>Meta-learner</dt><dd>Logistic Regression</dd>
            <dt>Held-out accuracy</dt><dd class="c-cyan">${pct(m.accuracy)}</dd><dt>Held-out macro F1</dt><dd class="c-cyan">${pct(m.macro_f1)}</dd><dt>Held-out ROC AUC</dt><dd class="c-cyan">${pct(m.auc)}</dd></dl>
            <p class="muted" style="font-size:11.5px;margin:10px 0 0">Measured by <code>backend/train_hybrid.py</code>, which calls the original <code>uav_fl_hybrid_model_binary.py</code> functions (seed 42, ${num(c.split?.test || 0)} held-out rows). Thesis-recorded run: ${pct(t.accuracy)} acc · ${pct(t.macro_f1)} F1 · ${pct(t.auc)} AUC.</p>`;
        } else {
          const m = cards.rf || D.localModel || {};
          $('#dtModel').innerHTML = `<dl class="kv"><dt>Model</dt><dd>Random Forest · 3-class baseline</dd><dt>Classes</dt><dd>benign · DoS attack · Replay</dd><dt>Preprocessing</dt><dd>median impute → RobustScaler(10–90)</dd>
            <dt>Held-out accuracy</dt><dd class="c-cyan">${pct(m.accuracy)}</dd><dt>Held-out macro F1</dt><dd class="c-cyan">${pct(m.macro_f1)}</dd><dt>Macro OvR AUC</dt><dd>${pct(m.macro_ovr_auc)}</dd><dt>Binary view accuracy</dt><dd>${pct(m.binary_view?.accuracy)}</dd></dl>
            <p class="muted" style="font-size:11.5px;margin:10px 0 0">Baseline for comparison: the repo's Random Forest retrained with identical preprocessing (${num(m.test_rows || 0)} held-out rows, seed 42).</p>`;
        }
        S.icons();
      }
      function comparison() {
        const h = cards.hybrid?.heldout_metrics, t = cards.hybrid?.thesis_recorded_metrics, r = cards.rf;
        if (!h && !r) { $('#dtCmp').hidden = true; return; }
        $('#dtCmp').hidden = false;
        $('#dtCmp').innerHTML = `<div class="panel-h"><div><h3>Model comparison — held-out test results</h3><p>Each model on its own held-out split (seed 42). Binary and 3-class tasks are not directly comparable.</p></div>${S.tag.verified}</div>
          <div class="table-wrap"><table class="t"><thead><tr><th>Model</th><th>Task</th><th>Source</th><th>Accuracy</th><th>Macro F1</th><th>ROC AUC</th></tr></thead><tbody>
          ${h ? `<tr class="sel"><td><b>Hybrid AE-Stacked Ensemble</b> <span class="chip cyan">live · FYP model</span></td><td>binary</td><td>this backend's saved model</td><td class="mono c-cyan">${pct(h.accuracy)}</td><td class="mono c-cyan">${pct(h.macro_f1)}</td><td class="mono c-cyan">${pct(h.auc)}</td></tr>` : ''}
          ${t ? `<tr><td>Hybrid AE-Stacked Ensemble</td><td>binary</td><td>thesis run (recorded CSV)</td><td class="mono">${pct(t.accuracy)}</td><td class="mono">${pct(t.macro_f1)}</td><td class="mono">${pct(t.auc)}</td></tr>` : ''}
          ${r ? `<tr><td>Random Forest <span class="chip">live · baseline</span></td><td>3-class</td><td>this backend's saved model</td><td class="mono">${pct(r.accuracy)}</td><td class="mono">${pct(r.macro_f1)}</td><td class="mono">${pct(r.macro_ovr_auc)} <span class="muted">(OvR)</span></td></tr>
          <tr><td>Random Forest — binary view</td><td>binary (derived)</td><td>this backend's saved model</td><td class="mono">${pct(r.binary_view?.accuracy)}</td><td class="mono">${pct(r.binary_view?.macro_f1)}</td><td class="mono">${pct(r.binary_view?.auc)}</td></tr>` : ''}
          </tbody></table></div>`;
        S.icons();
      }

      async function run() {
        if (!text) return;
        if (!health) { msg('Backend is offline — start <code>python backend\\server.py</code>.', 'err'); return; }
        const k = currentModel;
        $('#dtRun').disabled = true; $('#dtRun').innerHTML = '<span class="spinner"></span>Running…';
        msg(k === 'hybrid' ? 'Running the Hybrid AE-Stacked Ensemble (5 base learners) — large files can take a few seconds…' : '');
        const t0 = performance.now();
        try {
          const r = await fetch(S.api('api/predict?model=' + k), { method: 'POST', headers: { 'Content-Type': 'text/csv' }, body: text });
          const raw = await r.text();
          let j;
          try { j = JSON.parse(raw); }
          catch (pe) { throw new Error(r.ok ? 'The server returned a response that is not valid JSON. Restart the backend with the latest backend\\server.py.' : `Server error (HTTP ${r.status}).`); }
          if (!r.ok || !j || !j.ok) throw new Error((j && j.error) || 'HTTP ' + r.status);
          if (!Array.isArray(j.rows) || !Array.isArray(j.classes) || !j.counts) throw new Error('The server response is missing prediction data.');
          j.fname = fname; j.ms = performance.now() - t0; j.key = k; lastResult[k] = j;
          if (currentModel === k) renderResult(j);
          S.toast('Detection complete', `${num(j.total)} rows classified by ${MODELS[k].short}`, 'ok');
        } catch (e) {
          $('#dtOut').innerHTML = ''; delete lastResult[k];   // never leave stale results under an error
          msg(`<b>Detection failed:</b> ${esc(e.message)}`, 'err'); S.toast('Detection failed', e.message, 'err');
        } finally { $('#dtRun').innerHTML = '<i data-lucide="play"></i>Run Detection'; setRunState(); S.icons(); }
      }

      function renderResult(j) {
        const binary = j.classes.includes('attack');
        const notes = [`<b>${esc(MODELS[j.key || 'rf'].label)}</b> processed <b>${esc(j.fname)}</b> in ${(j.ms / 1000).toFixed(2)} s — ${num(j.total)} rows classified.`, ...(j.warnings || []).map(esc)];
        msg(notes.join('<br>'), j.warnings?.length ? 'warn' : 'ok');
        const ev = j.evaluation;
        const hasLabelCol = !!j.labels;
        const order = ORDER.filter((c) => j.classes.includes(c));
        const ix = order.map((c) => j.classes.indexOf(c));
        const n = order.length;
        const cmHtml = ev ? `<div class="cm" style="grid-template-columns:70px repeat(${n},1fr)"><div></div>${order.map((c) => `<div class="hd">${NICE[c]}</div>`).join('')}
          ${ix.map((ri, i) => { const row = ix.map((ci) => ev.confusion_matrix[ri][ci]); const tot = row.reduce((x, y) => x + y, 0) || 1; return `<div class="hd" style="justify-content:end">${NICE[order[i]]}</div>` + row.map((v, k) => `<div class="cell" style="${binary ? 'height:64px;font-size:16px;' : ''}background:${i === k ? `rgba(0,217,255,${0.25 + 0.6 * v / tot})` : `rgba(47,123,255,${0.06 + 0.4 * v / tot})`};color:${i === k ? '#03121F' : 'var(--text)'}">${num(v)}</div>`).join(''); }).join('')}</div>
          <p class="muted" style="font-size:11.5px;margin:8px 0 0">Rows = true label from the file${binary ? ' (DoS attack / Replay → Attack)' : ''} · columns = model prediction · ${num(ev.rows_evaluated)} rows with a valid label</p>`
          : `<div class="empty"><i data-lucide="tag"></i>${hasLabelCol ? 'The <code>class</code> column has no labels this model can be scored against, so no metrics can be computed.' : 'The file has no <code>class</code> column, so no confusion matrix or metrics can be computed.'}<br>Predictions below are still real model outputs.</div>`;
        const by3 = ev?.by_true_3class;
        const L = j.labels;
        const probHead = binary ? 'P(attack)' : 'Probabilities (benign / DoS / Replay)';
        $('#dtOut').innerHTML = `
        <div class="grid g-2 mt">
          <article class="panel"><div class="panel-h"><h2>Detection Results</h2>${S.tag.model}</div>
            <dl class="status-grid"><dt>Model</dt><dd>${esc(MODELS[j.key || 'rf'].short)} · ${binary ? 'binary' : '3-class'}</dd><dt>Total Samples</dt><dd class="mono">${num(j.total)}</dd>
            ${order.map((c) => `<dt><span class="cls ${kOf(c)}">${LONG[c]}</span></dt><dd class="mono">${num(j.counts[c] || 0)} (${j.total ? ((j.counts[c] || 0) / j.total * 100).toFixed(1) : '0.0'}%)</dd>`).join('')}
            ${L ? `<dt>Ground-truth labels</dt><dd class="mono">${num(L.valid)} valid · ${num(L.missing)} empty${L.invalid ? ` · ${num(L.invalid)} invalid` : ''}</dd>` : '<dt>Ground-truth labels</dt><dd class="mono muted">none (unlabelled file)</dd>'}
            ${ev ? `<dt>Accuracy (labelled rows)</dt><dd class="mono c-cyan">${pct(ev.accuracy)}</dd><dt>Macro F1 (labelled rows)</dt><dd class="mono c-cyan">${pct(ev.macro_f1)}</dd>
              ${binary ? `<dt>ROC AUC</dt><dd class="mono c-cyan">${ev.binary_auc == null ? '<span class="muted" title="' + esc(ev.auc_note || '') + '">n/a</span>' : pct(ev.binary_auc)}</dd>
                <dt>Attack precision / recall</dt><dd class="mono">${pct(ev.per_class?.attack?.precision)} / ${pct(ev.per_class?.attack?.recall)}</dd>`
              : `<dt>Macro OvR AUC</dt><dd class="mono">${ev.macro_ovr_auc == null ? '<span class="muted" title="' + esc(ev.auc_note || '') + '">n/a</span>' : pct(ev.macro_ovr_auc)}</dd>
              <dt>Attack-vs-benign AUC</dt><dd class="mono">${ev.binary_auc == null ? '<span class="muted">n/a</span>' : pct(ev.binary_auc)}</dd>`}` : ''}</dl>
            <div class="chart-box sm mt"><canvas id="dtBar"></canvas></div></article>
          <article class="panel"><div class="panel-h"><h2>Confusion Matrix</h2>${ev ? `<span class="muted" style="font-size:12px">${num(ev.rows_evaluated)} labelled rows</span>` : ''}</div>${cmHtml}
            ${by3 ? `<h4 class="sec-t mt">Detection by original attack type</h4><div class="by3">${Object.entries(by3).map(([c, v]) => { const tot = v.predicted_benign + v.predicted_attack || 1; const good = c === 'benign' ? v.predicted_benign : v.predicted_attack;
              return `<div><span class="cls ${kOf(c)}">${LONG[c]}</span><div class="by3-bar"><i style="width:${(good / tot * 100).toFixed(1)}%;background:${c === 'benign' ? '#22E39A' : '#00D9FF'}"></i></div><b class="mono">${(good / tot * 100).toFixed(1)}%</b><small class="muted">${c === 'benign' ? 'kept benign' : 'detected'} · ${num(good)} / ${num(tot)}</small></div>`; }).join('')}</div>` : ''}
            <div class="note mt"><i data-lucide="info"></i><div>${binary ? 'The FYP model answers the operational question “is this traffic an attack?”. DoS and Replay are merged into <b>Attack</b> because they overlap heavily at packet level.' : 'DoS and Replay overlap heavily at packet-feature level — the same ~72–77% 3-class ceiling reported in the thesis.'}${ev && j.total > 20000 ? ' <b>Note:</b> if this file is the full Dataset_T-ITS.csv, about 60% of its rows were used to train the model, so these metrics are optimistic. The unbiased held-out score is on the model card.' : ''}</div></div></article>
        </div>
        <article class="panel mt"><div class="panel-h"><div><h2>Predictions</h2><p>Per-row class and confidence from the ${esc(MODELS[j.key || 'rf'].short)} · “Line” = line number in your CSV</p></div>
          <div class="right"><select class="select" id="dtF" aria-label="Filter predictions"><option value="">All predictions</option>${order.map((c) => `<option value="${c}">${LONG[c]}</option>`).join('')}${ev ? '<option value="__wrong">Misclassified only</option>' : ''}${L && (L.missing || L.invalid) ? '<option value="__nolabel">Rows without a valid label</option>' : ''}</select><button class="btn sm" id="dtExport"><i data-lucide="download"></i>Export CSV</button></div></div>
          <div class="table-wrap" style="max-height:460px"><table class="t"><thead><tr><th>Line</th><th>Prediction</th><th>Confidence</th><th>${probHead}</th>${hasLabelCol ? '<th>True label</th><th>Match</th>' : ''}</tr></thead><tbody id="dtRows"></tbody></table></div>
          <div class="pager"><span id="dtPg"></span><button class="btn sm icon" id="dtPrev" aria-label="Previous page"><i data-lucide="chevron-left"></i></button><button class="btn sm icon" id="dtNext" aria-label="Next page"><i data-lucide="chevron-right"></i></button></div></article>`;
        S.chart($('#dtBar'), { type: 'bar', data: { labels: order.map((c) => NICE[c]), datasets: [{ data: order.map((c) => j.counts[c] || 0), backgroundColor: order.map((c) => CLS_COLOR[c]), borderRadius: 6 }] },
          options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(80,160,230,.08)' } }, y: { grid: { display: false } } } } });
        let page = 0; const PS = 50;
        const rowsF = () => { const f = $('#dtF').value; return j.rows.filter((r) => !f || (f === '__wrong' ? r.true_label != null && r.true_label !== r.prediction : f === '__nolabel' ? r.true_label == null : r.prediction === f)); };
        const probCell = (p) => binary
          ? `<div style="display:flex;align-items:center;gap:10px"><div class="prob"><span style="width:${pv(p, 'attack') * 100}%;background:#FF4D6A"></span></div><span class="mono muted" style="font-size:11px">${pv(p, 'attack').toFixed(3)}</span></div>`
          : `<div style="display:flex;align-items:center;gap:10px"><div class="prob"><span style="width:${pv(p, 'benign') * 100}%;background:#22E39A"></span><span style="width:${pv(p, 'DoS attack') * 100}%;background:#FF4D6A"></span><span style="width:${pv(p, 'Replay') * 100}%;background:#FFC23D"></span></div><span class="mono muted" style="font-size:11px">${pv(p, 'benign').toFixed(2)} / ${pv(p, 'DoS attack').toFixed(2)} / ${pv(p, 'Replay').toFixed(2)}</span></div>`;
        const paint = () => {
          const rows = rowsF(); const pages = Math.max(1, Math.ceil(rows.length / PS)); page = Math.min(page, pages - 1);
          $('#dtRows').innerHTML = rows.slice(page * PS, page * PS + PS).map((r) => {
            const tl = r.true_label;
            return `<tr><td class="mono">${r.row}</td><td><span class="cls ${kOf(r.prediction)}">${LONG[r.prediction] || esc(r.prediction)}</span></td><td class="mono">${Number.isFinite(r.confidence) ? (r.confidence * 100).toFixed(1) + '%' : '—'}</td><td>${probCell(r.probabilities)}</td>
            ${hasLabelCol ? (tl == null ? '<td><span class="muted">no label</span></td><td class="muted">—</td>' : `<td><span class="cls ${kOf(tl)}">${NICE[tl] || esc(tl)}</span></td><td>${tl === r.prediction ? '<span style="color:var(--green)">✓</span>' : '<span style="color:var(--red)">✗</span>'}</td>`) : ''}</tr>`;
          }).join('') || `<tr><td colspan="6"><div class="empty">No rows match this filter</div></td></tr>`;
          $('#dtPg').textContent = `Page ${page + 1} of ${pages} · ${num(rows.length)} rows`;
        };
        $('#dtF').onchange = () => { page = 0; paint(); };
        $('#dtPrev').onclick = () => { page = Math.max(0, page - 1); paint(); };
        $('#dtNext').onclick = () => { page++; paint(); };
        $('#dtExport').onclick = () => {
          const head = ['csv_line', 'model', 'prediction', 'confidence', ...j.classes.map((c) => 'p_' + c.replace(' ', '_').toLowerCase())].concat(hasLabelCol ? ['true_label'] : []);
          S.download(`seaql_predictions_${j.key || 'rf'}.csv`, S.csv([head, ...j.rows.map((r) => [r.row, j.key || 'rf', r.prediction, r.confidence, ...j.classes.map((c) => pv(r.probabilities, c))].concat(hasLabelCol ? [r.true_label ?? ''] : []))]), 'text/csv');
          S.toast('Predictions exported', `seaql_predictions_${j.key || 'rf'}.csv`, 'ok');
        };
        paint(); S.icons();
      }
      selectModel(currentModel);
      checkBackend();
    },
  });

  /* ------------------------------------------------------------------ */
  /* 5. FEDERATED LEARNING CONTROL ROOM                                  */
  /* ------------------------------------------------------------------ */
  S.view('federated', {
    title: 'Federated Learning Control Room',
    subtitle: 'Hierarchical FL across 8 UAV clients in 2 clusters — animated replay of the recorded experiment',
    render(el) {
      const R = D.federatedRounds || [], cfg = D.config || {}, ft = D.federatedTest || {};
      const full = R[0]?.fullBytes || 0, topk = R[0]?.topkBytes || 0;
      const saving = full ? 1 - topk / full : 0;
      const cm = D.clusterMap || [[0, 2, 4, 6], [1, 3, 5, 7]];
      const NI = D.nonIid || [];
      const cmlp = (D.centralTest || []).find((r) => r.model.startsWith('MLP')) || {};
      const STAGES = ['Broadcast global model', `Local training (${cfg.local_epochs} epoch)`, `Top-k (${cfg.compression_topk}) upload`, 'Cluster aggregation', 'Global aggregation'];
      const clientCard = (c) => { const n = NI[c] || { samples: 0, benign: 0, dos: 0, replay: 0 }; const t = n.samples || 1;
        return `<div class="flc" data-c="${c}"><div class="flc-h"><span class="flc-ic">${S.droneSVG(cm[1].includes(c) ? '#A15BFF' : '#00D9FF', false)}</span><span><b class="mono">UAV-${S.pad(c + 1)}</b><small>Client ${c} · ${num(n.samples)} samples</small></span><span class="flc-st" data-st>Idle</span></div>
          <div class="flc-bar" title="Benign ${n.benign} · DoS ${n.dos} · Replay ${n.replay}"><span style="width:${n.benign / t * 100}%;background:#22E39A"></span><span style="width:${n.dos / t * 100}%;background:#FF4D6A"></span><span style="width:${n.replay / t * 100}%;background:#FFC23D"></span></div>
          <div class="flc-p"><span data-p style="width:0%"></span></div></div>`; };
      el.innerHTML = `
      <div class="note" style="margin-bottom:14px"><i data-lucide="history"></i><div><b>Animated replay of a recorded run.</b> All numbers come from <code>federated_round_history.csv</code>, <code>federated_test_metrics.csv</code> and <code>non_iid_client_distribution.csv</code>. No training is executed in the browser.</div></div>
      <section class="kpis5">
        ${[['c-cy', 'plane', 'UAV clients', '8', '2 clusters × 4'], ['c-pu', 'git-merge', 'Training rounds', R.length, `${cfg.local_epochs} local epoch / round`], ['c-gr', 'target', 'Federated macro F1', pct(ft.macroF1), `3-class test · centralized MLP ${pct(cmlp.macroF1)}`], ['c-am', 'shrink', 'Upload per round', '−' + (saving * 100).toFixed(1) + '%', `${(full / topk).toFixed(1)}× smaller (top-k ${cfg.compression_topk})`], ['c-rd', 'shuffle', 'Non-IID partition', 'α ' + cfg.dirichlet_alpha, 'Dirichlet label skew']]
          .map(([c, ic, l, v, sub]) => `<article class="k5 ${c}"><div class="k5-top"><span class="k5-ic"><i data-lucide="${ic}"></i></span><span class="k5-l">${l}</span><span class="tag verified" style="padding:2px 6px">Rec.</span></div><div class="k5-v"><strong>${v}</strong></div><div class="k5-b"><small>${sub}</small></div></article>`).join('')}
      </section>
      <article class="panel fl2"><div class="panel-h"><div><h2>Federated Training Topology</h2><p>Clients train locally → cluster relays average updates → global aggregator (weighted FedAvg)</p></div>
        <div class="right"><span class="chip cyan" id="flRoundTag">Round ${R.length} / ${R.length}</span><button class="btn sm primary" id="flPlay"><i data-lucide="play"></i>Replay training</button><button class="btn sm" id="flStep"><i data-lucide="skip-forward"></i>Next round</button><button class="btn sm" id="flReset"><i data-lucide="rotate-ccw"></i>Reset</button></div></div>
        <div class="fl-topo" id="flTopo">
          <div class="fl-col a"><div class="fl-colh"><b>Cluster A</b><small>${cm[0].map((c) => 'UAV-' + S.pad(c + 1)).join(' · ')}</small></div>${cm[0].map(clientCard).join('')}</div>
          <div class="fl-mid"><svg id="flSvg"></svg>
            <div class="fl-orb" id="flOrb"><div class="orb-rings"><i></i><i></i><i></i></div><div class="orb-core"><i data-lucide="brain-circuit"></i></div><b>Global model</b><small class="mono" id="flOrbF1">val F1 —</small></div>
            <div class="fl-relay a" id="flRelA">Agg A</div><div class="fl-relay b" id="flRelB">Agg B</div></div>
          <div class="fl-col b"><div class="fl-colh"><b>Cluster B</b><small>${cm[1].map((c) => 'UAV-' + S.pad(c + 1)).join(' · ')}</small></div>${cm[1].map(clientCard).join('')}</div>
        </div>
        <div class="fl-legend"><span><i style="background:#22E39A"></i>Benign</span><span><i style="background:#FF4D6A"></i>DoS</span><span><i style="background:#FFC23D"></i>Replay</span><span class="muted">· bar = each client's real local class mix</span></div>
      </article>
      <article class="panel mt"><div class="panel-h"><div><h3>Five-Round Training Timeline</h3><p>Stage of the current round, and the recorded validation macro F1 after each round</p></div></div>
        <div class="fl-stages" id="flStages">${STAGES.map((s, i) => `<span>${i + 1} · ${s}</span>`).join('')}</div>
        <div class="fl-rounds" id="flRounds">${R.map((r) => `<div class="flr" data-r="${r.round}"><i></i><b>Round ${r.round}</b><span class="mono">val F1 ${pct(r.valMacroF1)}</span><small class="mono">acc ${pct(r.valAccuracy)} · ${num(r.topkBytes / 1024)} KB</small></div>`).join('')}</div></article>
      <div class="grid g-2 mt">
        <article class="panel"><div class="panel-h"><div><h3>Macro F1 per Round</h3><p>Recorded training & validation macro F1 (3-class)</p></div>${S.tag.verified}</div><div class="chart-box tall"><canvas id="flF1"></canvas></div></article>
        <article class="panel"><div class="panel-h"><div><h3>Non-IID Data Distribution (α = ${cfg.dirichlet_alpha})</h3><p>Real per-client class counts from the Dirichlet partition</p></div>${S.tag.verified}</div><div class="chart-box tall"><canvas id="flNiid"></canvas></div></article>
      </div>
      <div class="grid g-2 mt">
        <article class="panel"><div class="panel-h"><div><h3>Communication Compression</h3><p>Upload size per round for all 8 clients (recorded)</p></div>${S.tag.verified}</div>
          <div class="cmp"><div class="cmp-row"><span>Full model update</span><div class="cmp-bar"><i style="width:100%" class="full"></i></div><b class="mono">${num(full / 1024)} KB</b></div>
            <div class="cmp-row"><span>Top-k ${cfg.compression_topk} sparse update</span><div class="cmp-bar"><i style="width:${(topk / full * 100).toFixed(1)}%" class="tk" id="flTk"></i></div><b class="mono c-cyan">${num(topk / 1024)} KB</b></div>
            <div class="cmp-big"><strong>${(full / topk).toFixed(1)}×</strong><span>smaller uploads · ${(saving * 100).toFixed(1)}% less traffic per round · ${num((full - topk) * R.length / 1024)} KB saved over ${R.length} rounds</span></div>
            <p class="muted" style="font-size:11.5px;margin:0">Top-k keeps the 25% largest parameter changes plus their indices (${num(ft.parameters || 0)} parameters in the MLP).</p></div></article>
        <article class="panel"><div class="panel-h"><h3>Privacy, Security & Limitations</h3></div>
          <div class="pl-grid">
            <div><h4 class="sec-t">Implemented ${S.tag.verified}</h4><ul class="limits ok">
              <li><i data-lucide="check"></i><span>Raw packet data stays on each client; only model updates are shared (FL design, simulated on one machine)</span></li>
              <li><i data-lucide="check"></i><span>Hierarchical weighted FedAvg (client → cluster → global)</span></li>
              <li><i data-lucide="check"></i><span>Top-k (25%) update compression</span></li>
              <li><i data-lucide="check"></i><span>SHA3-256 update digest timed at ${(D.securityOverhead?.[0]?.signMs ?? 0).toFixed(3)} ms (integrity check, not a signature)</span></li></ul></div>
            <div><h4 class="sec-t">Not implemented ${S.tag.future}</h4><ul class="limits">
              <li><i data-lucide="x"></i><span>Post-quantum signatures (ML-DSA / Kyber): not executed, liboqs absent</span></li>
              <li><i data-lucide="x"></i><span>Secure aggregation / homomorphic encryption</span></li>
              <li><i data-lucide="x"></i><span>Differential privacy noise</span></li>
              <li><i data-lucide="x"></i><span>Real distributed UAV devices; only 5 rounds; 3-class macro F1 ${pct(ft.macroF1)}</span></li></ul></div>
          </div></article>
      </div>`;

      // ----- topology connectors (redrawn on resize so geometry matches the cards) -----
      const topo = $('#flTopo'), svg = $('#flSvg'), mid = topo.querySelector('.fl-mid');
      let geo = null;
      function layout() {
        const mr = mid.getBoundingClientRect(); if (!mr.width) return;
        svg.setAttribute('viewBox', `0 0 ${mr.width} ${mr.height}`);
        const cy = (c) => { const r = topo.querySelector(`.flc[data-c="${c}"]`).getBoundingClientRect(); return r.top + r.height / 2 - mr.top; };
        const relA = { x: mr.width * 0.22, y: mr.height / 2 }, relB = { x: mr.width * 0.78, y: mr.height / 2 }, orb = { x: mr.width / 2, y: mr.height / 2 };
        $('#flRelA').style.left = relA.x + 'px'; $('#flRelB').style.left = relB.x + 'px';
        geo = { relA, relB, orb, a: cm[0].map((c) => ({ c, y: cy(c) })), b: cm[1].map((c) => ({ c, y: cy(c) })), w: mr.width };
        let p = '';
        geo.a.forEach((n) => (p += `<path id="flpa${n.c}" d="M0 ${n.y} C ${relA.x * 0.6} ${n.y}, ${relA.x * 0.5} ${relA.y}, ${relA.x} ${relA.y}" class="fl-ln a"/>`));
        geo.b.forEach((n) => (p += `<path id="flpb${n.c}" d="M${mr.width} ${n.y} C ${mr.width - (mr.width - relB.x) * 0.6} ${n.y}, ${relB.x + (mr.width - relB.x) * 0.5} ${relB.y}, ${relB.x} ${relB.y}" class="fl-ln b"/>`));
        p += `<path id="flgA" d="M${relA.x} ${relA.y} L${orb.x - 60} ${orb.y}" class="fl-ln g"/><path id="flgB" d="M${relB.x} ${relB.y} L${orb.x + 60} ${orb.y}" class="fl-ln g"/><g id="flPk"></g>`;
        svg.innerHTML = p; paintStage();
      }
      const ro = new ResizeObserver(layout); ro.observe(topo);

      const f1 = S.chart($('#flF1'), { type: 'line', data: { labels: R.map((r) => 'R' + r.round), datasets: [
        { label: 'Validation macro F1', data: [], borderColor: '#00D9FF', backgroundColor: 'rgba(0,217,255,.15)', fill: true, tension: .3, pointRadius: 5, pointBackgroundColor: '#00D9FF' },
        { label: 'Train macro F1', data: [], borderColor: '#A15BFF', borderDash: [5, 4], tension: .3, pointRadius: 4, pointBackgroundColor: '#A15BFF' },
        { label: `Final test (${pct(ft.macroF1)})`, data: R.map(() => ft.macroF1), borderColor: '#22E39A', borderDash: [2, 4], pointRadius: 0, borderWidth: 1.5 }] },
        options: { scales: { y: { min: 0.4, max: 0.7, ticks: { callback: (v) => (v * 100).toFixed(0) + '%' } } }, plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${(c.raw * 100).toFixed(1)}%` } } } } });
      S.chart($('#flNiid'), { type: 'bar', data: { labels: NI.map((c) => 'UAV-' + S.pad(c.client + 1)), datasets: [
        { label: 'Benign', data: NI.map((c) => c.benign), backgroundColor: '#22E39A' }, { label: 'DoS', data: NI.map((c) => c.dos), backgroundColor: '#FF4D6A' }, { label: 'Replay', data: NI.map((c) => c.replay), backgroundColor: '#FFC23D' }] },
        options: { scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true } } } });

      // ----- replay engine -----
      let round = R.length, stage = 4, timer = null, sub = 0;
      const stageEls = $$('#flStages span');
      const ST_LABEL = ['Receiving', 'Training', 'Uploading', 'Uploaded', 'Synced'];
      function paintStage() {
        stageEls.forEach((s, i) => { s.classList.toggle('on', i === stage && !!timer); s.classList.toggle('done', i < stage || (i === stage && !timer)); });
        $$('.flc').forEach((c) => {
          c.classList.toggle('train', stage === 1 && !!timer); c.classList.toggle('up', stage === 2 && !!timer);
          c.querySelector('[data-st]').textContent = round === 0 ? 'Idle' : ST_LABEL[stage];
          c.querySelector('[data-p]').style.width = (round === 0 ? 0 : stage >= 2 ? 100 : stage === 1 ? Math.min(100, sub * 34) : 0) + '%';
        });
        $('#flRelA').classList.toggle('hot', stage === 3 && !!timer); $('#flRelB').classList.toggle('hot', stage === 3 && !!timer);
        $('#flOrb').classList.toggle('hot', stage === 4 && !!timer);
        const pk = $('#flPk'); if (!pk || !geo) return; let h = '';
        if (timer && !S.reduced) {
          const mk = (id, col, rev) => `<circle r="4" fill="${col}" filter="drop-shadow(0 0 4px ${col})"><animateMotion dur="1.1s" repeatCount="indefinite" ${rev ? 'keyPoints="1;0" keyTimes="0;1" calcMode="linear"' : ''}><mpath href="#${id}"/></animateMotion></circle>`;
          if (stage === 0) { cm[0].forEach((c) => (h += mk('flpa' + c, '#00D9FF', true))); cm[1].forEach((c) => (h += mk('flpb' + c, '#00D9FF', true))); h += mk('flgA', '#00D9FF', true) + mk('flgB', '#00D9FF', true); }
          if (stage === 2) { cm[0].forEach((c) => (h += mk('flpa' + c, '#A15BFF'))); cm[1].forEach((c) => (h += mk('flpb' + c, '#A15BFF'))); }
          if (stage === 4) h += mk('flgA', '#22E39A') + mk('flgB', '#22E39A');
        }
        pk.innerHTML = h;
      }
      function paint() {
        $('#flRoundTag').textContent = `Round ${round} / ${R.length}`;
        const done = R.slice(0, stage === 4 ? round : round - 1);
        f1.data.datasets[0].data = done.map((r) => r.valMacroF1); f1.data.datasets[1].data = done.map((r) => r.trainMacroF1); f1.update();
        $('#flOrbF1').textContent = done.length ? 'val F1 ' + pct(done.at(-1).valMacroF1) : 'val F1 —';
        $$('#flRounds .flr').forEach((n) => { const r = +n.dataset.r; n.classList.toggle('done', r <= done.length); n.classList.toggle('cur', r === round && !!timer); });
        paintStage();
      }
      let tick = 0;
      function advance() {
        tick++; sub++;
        if (stage === 1 && sub < 3) { paintStage(); return; } // training lasts a little longer
        sub = 0;
        if (round === 0) { round = 1; stage = 0; }
        else if (stage < 4) stage++;
        else if (round < R.length) { round++; stage = 0; }
        else { stop(); S.toast('Replay finished', `${R.length} rounds · federated test macro F1 ${pct(ft.macroF1)}`, 'ok'); return; }
        paint();
      }
      function stop() { clearInterval(timer); timer = null; $('#flPlay').innerHTML = '<i data-lucide="play"></i>Replay training'; S.icons(); paint(); }
      $('#flPlay').onclick = () => {
        if (timer) return stop();
        if (round === R.length && stage === 4) { round = 0; stage = -1; }
        timer = setInterval(advance, 750); advance();
        $('#flPlay').innerHTML = '<i data-lucide="pause"></i>Pause replay'; S.icons();
      };
      $('#flStep').onclick = () => { if (timer) stop(); if (round < R.length) round++; stage = 4; paint(); };
      $('#flReset').onclick = () => { if (timer) stop(); round = 0; stage = -1; paint(); };
      paint();
      return () => { clearInterval(timer); ro.disconnect(); };
    },
  });

  /* ------------------------------------------------------------------ */
  /* 6. EXPLAINABLE AI INVESTIGATION CENTER                              */
  /* ------------------------------------------------------------------ */
  S.view('xai', {
    title: 'Explainable AI Investigation Center',
    subtitle: 'Understand why the model detects an attack — global feature importance and real feature behaviour',
    render(el) {
      const X = (D.xai || []).slice().sort((a, b) => b.importance - a.importance);
      const tot = X.reduce((a, b) => a + b.importance, 0) || 1;
      const FS = D.featureStats || {};
      const share = (f) => { const r = X.find((x) => x.feature === f); return r ? (r.importance / tot * 100).toFixed(0) + '%' : '—'; };
      el.innerHTML = `
      <div class="xai-top">
        <article class="panel"><div class="panel-h"><div><h2>Feature Importance (Permutation)</h2><p>Mean drop in macro F1 when a feature is shuffled · Random Forest, 3-class, test set</p></div>${S.tag.verified}</div><div class="chart-box xl"><canvas id="xaiBar"></canvas></div></article>
        <article class="panel"><div class="panel-h"><h2>Explanation Summary</h2></div>
          <ul class="checks">
            <li><i data-lucide="circle-check"></i><span><b>wlan.seq</b> has the highest impact (${share('wlan.seq')} of total importance). Sequence-number patterns differ strongly between benign, DoS and replayed frames.</span></li>
            <li><i data-lucide="circle-check"></i><span><b>wlan.duration</b> indicates abnormal medium-reservation time — attack frames have a median of ${FS['wlan.duration']?.byClass?.['DoS attack']?.median ?? '—'} µs vs ${FS['wlan.duration']?.byClass?.benign?.median ?? '—'} µs for benign.</span></li>
            <li><i data-lucide="circle-check"></i><span><b>time_since_last_packet</b> captures traffic burst behaviour — attack traffic arrives about ${FS.time_since_last_packet ? Math.round(FS.time_since_last_packet.byClass.benign.median / FS.time_since_last_packet.byClass['DoS attack'].median) : '—'}× faster than benign traffic (median gap).</span></li>
          </ul>
          <div class="callout">These features collectively indicate DoS or Replay attack patterns.</div>
          <div class="note warn mt"><i data-lucide="info"></i><div><b>Method:</b> ${esc(X[0]?.method || 'permutation importance')}. SHAP was planned but the <code>shap</code> package was not installed in the recorded run, so the pipeline used permutation importance. This is <b>not</b> SHAP.</div></div>
          <button class="btn mt" id="xaiDl" style="width:100%"><i data-lucide="file-down"></i>Download explanation report</button></article>
      </div>
      <h3 style="margin:22px 0 12px;font-size:15px">Top-feature analysis <span class="muted" style="font-weight:500;font-size:12.5px">— distribution of each feature by class, computed from the full Dataset_T-ITS.csv (${num(D.dataAudit?.valid_labeled_rows || 0)} labelled rows)</span></h3>
      <div class="grid g-3" id="xaiFeat"></div>
      <div class="grid g-2 mt">
        <article class="panel"><div class="panel-h"><div><h3>Global explanation</h3><p>Cumulative importance — how many features explain the decision</p></div>${S.tag.verified}</div><div class="chart-box"><canvas id="xaiCum"></canvas></div></article>
        <article class="panel"><div class="panel-h"><h3>Local (per-packet) explanation</h3>${S.tag.future}</div>
          <p class="t2" style="font-size:13px;margin-top:0">Per-prediction explanations (SHAP/LIME values for one packet) are <b>not implemented</b>: the recorded run did not execute SHAP, so no local attributions exist yet. Showing them here would be invented. (The hybrid model itself is now saved and served in the AI Detection Lab, so SHAP can be added on top of it.)</p>
          <ul class="limits"><li><i data-lucide="arrow-right"></i><span>Planned: install <code>shap</code> and compute TreeSHAP for the RF/XGBoost/LightGBM members of the saved stack.</span></li><li><i data-lucide="arrow-right"></i><span>Planned: show a waterfall chart for any row selected in the AI Detection Lab.</span></li></ul></article>
      </div>`;
      S.chart($('#xaiBar'), { type: 'bar', data: { labels: X.map((x) => x.feature), datasets: [{ data: X.map((x) => x.importance), backgroundColor: X.map((_, i) => (i < 3 ? '#00D9FF' : i < 6 ? 'rgba(0,217,255,.6)' : 'rgba(47,123,255,.55)')), borderRadius: 4 }] },
        options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `Δ macro F1: ${c.raw.toFixed(4)}` } } }, scales: { y: { grid: { display: false }, ticks: { font: { family: 'JetBrains Mono', size: 11 } } }, x: { title: { display: true, text: 'Permutation importance (mean macro-F1 drop)' } } } } });
      let acc = 0;
      S.chart($('#xaiCum'), { type: 'line', data: { labels: X.map((_, i) => i + 1), datasets: [{ label: 'Cumulative share of importance', data: X.map((x) => (acc += x.importance) / tot), borderColor: '#A15BFF', backgroundColor: 'rgba(161,91,255,.15)', fill: true, tension: .3, pointRadius: 3 }] },
        options: { scales: { y: { min: 0, max: 1, ticks: { callback: (v) => v * 100 + '%' } }, x: { title: { display: true, text: 'Top-N features' } } }, plugins: { legend: { display: false } } } });
      const feats = [['wlan.seq', 'MAC sequence number', 'Replay re-sends captured frames, so sequence numbers repeat or jump; flooding produces long monotonic runs.'],
        ['wlan.duration', 'NAV duration (µs)', 'Attack frames reserve the channel for longer, starving other UAVs of airtime.'],
        ['time_since_last_packet', 'Inter-arrival gap (s)', 'Bursts of packets with tiny gaps are characteristic of DoS flooding and fast replay.']];
      $('#xaiFeat').innerHTML = feats.map(([f, sub, why], i) => {
        const s = FS[f]?.byClass || {};
        return `<article class="panel feat-card"><div class="panel-h"><div><h4>${f}</h4><p>${sub} · rank #${i + 1}</p></div><span class="chip cyan">${share(f)}</span></div>
          <div class="stat3">${['benign', 'DoS attack', 'Replay'].map((c) => `<div><small style="color:${CLS_COLOR[c]}">${c === 'DoS attack' ? 'DoS' : c} median</small><b>${s[c] ? +s[c].median.toPrecision(4) : '—'}</b></div>`).join('')}</div>
          <div class="chart-box sm"><canvas id="xf${i}"></canvas></div><p class="muted" style="font-size:12px;margin:10px 0 0">${why}</p></article>`;
      }).join('');
      feats.forEach(([f], i) => {
        const st = FS[f]; if (!st) return;
        const lab = st.edges.slice(0, -1).map((e) => +e.toPrecision(3));
        S.chart($('#xf' + i), { type: 'line', data: { labels: lab, datasets: ['benign', 'DoS attack', 'Replay'].map((c) => ({ label: c, data: st.byClass[c].hist, borderColor: CLS_COLOR[c], backgroundColor: CLS_COLOR[c] + '22', fill: true, tension: .35, pointRadius: 0, borderWidth: 2 })) },
          options: { plugins: { legend: { position: 'bottom', labels: { font: { size: 10 } } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${(c.raw * 100).toFixed(1)}% of rows` } } }, scales: { x: { ticks: { maxTicksLimit: 5, font: { size: 10 } }, grid: { display: false } }, y: { ticks: { callback: (v) => Math.round(v * 100) + '%', font: { size: 10 } } } } } });
      });
      $('#xaiDl').onclick = () => {
        const lines = ['# SEAQL — Explainable AI report', '', `Generated: ${new Date().toISOString()}`, '', 'Category: VERIFIED EXPERIMENT (recorded outputs in seaql-repo/results/metrics/xai_feature_importance.csv)', '',
          `Method: ${X[0]?.method}. Model: Random Forest (3-class), held-out test set. This is permutation importance, NOT SHAP.`, '', '## Feature importance (mean macro-F1 drop when shuffled)', '', '| Rank | Feature | Importance | Share |', '|---|---|---|---|',
          ...X.map((x, i) => `| ${i + 1} | ${x.feature} | ${x.importance.toFixed(4)} | ${(x.importance / tot * 100).toFixed(1)}% |`), '', '## Top feature behaviour by class (full dataset, medians)', '',
          '| Feature | Benign | DoS attack | Replay |', '|---|---|---|---|', ...feats.map(([f]) => `| ${f} | ${FS[f]?.byClass.benign.median} | ${FS[f]?.byClass['DoS attack'].median} | ${FS[f]?.byClass.Replay.median} |`), '',
          '## Limitations', '', '- Global explanation only; local (per-packet) explanations are future work.', '- DoS and Replay overlap at packet level, which limits 3-class separability (~72–77% macro F1).'];
        S.download('seaql_xai_report.md', lines.join('\n'), 'text/markdown');
        S.download('seaql_feature_importance.csv', S.csv([['rank', 'feature', 'importance', 'method'], ...X.map((x, i) => [i + 1, x.feature, x.importance, x.method])]), 'text/csv');
        S.toast('Report downloaded', 'seaql_xai_report.md + seaql_feature_importance.csv', 'ok');
      };
    },
  });
})();
