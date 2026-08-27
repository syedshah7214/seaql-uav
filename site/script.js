let SEAQL_DATA = null;

async function loadData() {
  try {
    const res = await fetch('assets/data.json');
    SEAQL_DATA = await res.json();
  } catch (e) {
    console.error('Could not load results data', e);
    return;
  }
  buildHeroStats();
  buildDataset();
  buildDatasetFlowSVG();
  buildRoadmap();
  buildPipelineSVG();
  buildTimeline();
  buildProgressionChart();
  buildResultsTable();
  buildBaselineConfusionGrid();
  buildFederatedSection();
  buildFLArchitectureSVG();
  buildFederatedChart();
  buildNonIidChart();
  buildContinualChart();
  buildFederatedMiniTables();
  buildExplainability();
  buildInferenceDemo();
  buildXaiFlowSVG();
  buildArchitectureSVG();
  buildConfidenceMeters();
  animateGauges();
  buildObjectivesBoard();
  buildContributions();
  buildFutureWork();
  initModelComparisonToggle();
  animateStats();
  initScrollReveal();
  initActiveNav();
  initResearchAssistant();
}

// ============ Hero: UAV swarm network canvas ============
// Signature element: UAV nodes clustered around cluster-heads, all
// converging on a central aggregator (the federated learning topology
// itself), with periodic "update" pulses along the edges and an
// occasional attack packet flashing red before being caught by the
// detector ring at the server. This is literally the system's
// architecture, not decorative motion.
function initSwarmCanvas() {
  const canvas = document.getElementById('swarm-canvas');
  const ctx = canvas.getContext('2d');
  let w, h, dpr;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.offsetWidth; h = canvas.offsetHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layout();
  }
  let server, clusters, edges;
  function layout() {
    server = { x: w * 0.5, y: h * 0.22 };
    clusters = [];
    const clusterCount = 3;
    const radius = Math.min(w, h) * 0.32;
    for (let c = 0; c < clusterCount; c++) {
      const angle = (Math.PI * 2 * c) / clusterCount - Math.PI / 2 + 0.5;
      const cx = server.x + Math.cos(angle) * radius;
      const cy = server.y + Math.sin(angle) * radius * 0.9 + h * 0.28;
      const head = { x: cx, y: cy };
      const nodes = [];
      const nodeCount = 4 + (c % 2);
      for (let n = 0; n < nodeCount; n++) {
        const na = (Math.PI * 2 * n) / nodeCount + c;
        const nr = 46 + (n % 2) * 14;
        nodes.push({
          x: cx + Math.cos(na) * nr,
          y: cy + Math.sin(na) * nr * 0.7,
          isAttack: Math.random() < 0.16,
          pulsePhase: Math.random() * 1000,
        });
      }
      clusters.push({ head, nodes });
    }
  }

  resize();
  window.addEventListener('resize', resize);

  if (reduceMotion) { draw(0); return; }

  function drawNode(x, y, r, color, glow, isDrone) {
    if (glow) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
      g.addColorStop(0, color + '55');
      g.addColorStop(1, color + '00');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r * 4, 0, Math.PI * 2); ctx.fill();
    }
    if (isDrone) {
      // minimalist quadcopter glyph: center body + 4 rotor arms
      const arm = r * 2.4;
      ctx.strokeStyle = color; ctx.lineWidth = 1;
      ctx.globalAlpha = 0.8;
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([dx,dy]) => {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx*arm, y + dy*arm*0.6); ctx.stroke();
        ctx.beginPath(); ctx.arc(x + dx*arm, y + dy*arm*0.6, r*0.5, 0, Math.PI*2);
        ctx.fillStyle = color; ctx.fill();
      });
      ctx.globalAlpha = 1;
    }
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
  }

  function drawEdge(x1, y1, x2, y2, t, speed, color) {
    ctx.strokeStyle = 'rgba(108,140,255,0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    // traveling pulse
    const p = (Math.sin(t * speed) + 1) / 2;
    const px = x1 + (x2 - x1) * p;
    const py = y1 + (y2 - y1) * p;
    ctx.beginPath(); ctx.arc(px, py, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
  }

  function draw(tRaw) {
    const t = tRaw / 1000;
    ctx.clearRect(0, 0, w, h);

    clusters.forEach((cluster, ci) => {
      // client -> cluster head edges
      cluster.nodes.forEach((node, ni) => {
        const flashing = ((t * 0.6 + node.pulsePhase) % 6) < 0.5 && node.isAttack;
        drawEdge(node.x, node.y, cluster.head.x, cluster.head.y, t + ni + ci, 1.1, flashing ? '#F87171' : '#6C8CFF');
      });
      // cluster head -> server edge
      drawEdge(cluster.head.x, cluster.head.y, server.x, server.y, t + ci * 2, 0.7, '#6C8CFF');

      // draw client nodes
      cluster.nodes.forEach((node, ni) => {
        const flashing = ((t * 0.6 + node.pulsePhase) % 6) < 0.5 && node.isAttack;
        drawNode(node.x, node.y, flashing ? 4.5 : 3, flashing ? '#F87171' : '#6C8CFF', flashing, true);
        if (flashing) {
          const ringP = ((t * 0.6 + node.pulsePhase) % 0.5) / 0.5;
          ctx.beginPath();
          ctx.arc(node.x, node.y, 4 + ringP * 14, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(248,113,113,${1 - ringP})`;
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
      });

      // cluster head
      drawNode(cluster.head.x, cluster.head.y, 5, '#8FA5FF', false);
    });

    // server / aggregator
    const serverPulse = 1 + Math.sin(t * 1.4) * 0.15;
    drawNode(server.x, server.y, 8 * serverPulse, '#6C8CFF', true);
    ctx.beginPath(); ctx.arc(server.x, server.y, 13, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(108,140,255,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();

    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}

// ============ Animated hero stats ============
function animateStats() {
  document.querySelectorAll('.stat-num').forEach(el => {
    const target = parseFloat(el.dataset.count);
    const duration = 1400;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * eased).toFixed(1);
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = target.toFixed(1);
    }
    requestAnimationFrame(tick);
  });
}

// ============ Hero stat cards with icons ============
const ICONS = {
  shield: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2l8 3.5v6c0 5-3.4 8.9-8 10.5-4.6-1.6-8-5.5-8-10.5v-6L12 2z"/></svg>',
  target: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg>',
  radar: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 2v10l7 4"/></svg>',
};
function buildHeroStats() {
  const stats = [
    { icon: 'shield', value: 94.3, label: 'Accuracy, final model' },
    { icon: 'target', value: 93.3, label: 'Macro F1-score' },
    { icon: 'radar', value: 98.3, label: 'AUC (ROC)' },
  ];
  document.getElementById('hero-stats').innerHTML = stats.map(s => `
    <div class="stat-card">
      <span class="stat-icon">${ICONS[s.icon]}</span>
      <span><span class="stat-num" data-count="${s.value}">0</span><span class="stat-unit">%</span></span>
      <span class="stat-label">${s.label}</span>
    </div>`).join('');
}

// ============ Dataset flow infographic ============
function buildDatasetFlowSVG() {
  const d = SEAQL_DATA.dataset;
  const stages = [
    { label: 'Raw Dataset', sub: d.rawRows.toLocaleString() + ' rows' },
    { label: 'Cleaning', sub: '\u2212' + d.discardedRows.toLocaleString() + ' invalid' },
    { label: 'Feature Engineering', sub: d.features + ' features' },
    { label: 'Train / Val / Test Split', sub: '60 / 20 / 20' },
    { label: 'Final Dataset', sub: d.finalRows.toLocaleString() + ' rows' },
  ];
  const g = document.getElementById('dataset-flow-svg');
  const boxW = 168, boxH = 76, gap = 20, startX = 10, y = 42;
  let svg = `<defs><marker id="arrow2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#6C8CFF"/></marker></defs>`;
  stages.forEach((s, i) => {
    const x = startX + i * (boxW + gap);
    const isLast = i === stages.length - 1;
    svg += `<rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="10" fill="${isLast ? 'rgba(108,140,255,0.08)' : '#12161F'}" stroke="${isLast ? '#6C8CFF' : '#232A3A'}" stroke-width="${isLast ? 2 : 1}"/>`;
    svg += `<text x="${x + boxW/2}" y="${y + 32}" text-anchor="middle" font-size="13" font-family="IBM Plex Sans" font-weight="600" fill="${isLast ? '#6C8CFF' : '#E9ECF4'}">${s.label}</text>`;
    svg += `<text x="${x + boxW/2}" y="${y + 54}" text-anchor="middle" font-size="11" font-family="IBM Plex Mono" fill="#8B93A8">${s.sub}</text>`;
    if (!isLast) {
      const x2 = x + boxW;
      svg += `<line x1="${x2}" y1="${y + boxH/2}" x2="${x2 + gap}" y2="${y + boxH/2}" stroke="#6C8CFF" stroke-width="1.5" marker-end="url(#arrow2)"/>`;
    }
  });
  g.innerHTML = svg;
  const totalW = startX + stages.length * boxW + (stages.length - 1) * gap + 10;
  const svgEl = g.closest('svg');
  if (svgEl) {
    svgEl.setAttribute('viewBox', `0 0 ${totalW} 160`);
    svgEl.style.minWidth = totalW + 'px';
  }
}

// ============ SHAP / explainability workflow diagram ============
function buildXaiFlowSVG() {
  const stages = [
    { label: 'Input\nPacket', icon: 'M-8,-2 L8,-2 L8,6 L-8,6 Z M-8,-2 L0,-8 L8,-2' },
    { label: 'Hybrid\nModel', icon: 'circles' },
    { label: 'Prediction', icon: 'check' },
    { label: 'Explainability\nSignal', icon: 'bolt' },
    { label: 'Feature\nImportance', icon: 'bars' },
    { label: 'Final\nDecision', icon: 'shield' },
  ];
  const g = document.getElementById('xai-flow-svg');
  const boxW = 140, boxH = 84, gap = 30, startX = 10, y = 20;
  let svg = `<defs><marker id="arrow3" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#6C8CFF"/></marker></defs>`;
  const iconY = y + 22;
  stages.forEach((s, i) => {
    const x = startX + i * (boxW + gap);
    const cx = x + boxW / 2;
    const isLast = i === stages.length - 1;
    const lines = s.label.split('\n');
    svg += `<rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="9" fill="${isLast ? 'rgba(108,140,255,0.08)' : '#0A0D14'}" stroke="${isLast ? '#6C8CFF' : '#232A3A'}" stroke-width="${isLast ? 2 : 1}"/>`;
    const iconColor = isLast ? '#6C8CFF' : '#8FA5FF';
    // simple icon glyphs
    if (s.icon === 'circles') svg += `<circle cx="${cx-6}" cy="${iconY}" r="4" fill="none" stroke="${iconColor}" stroke-width="1.6"/><circle cx="${cx+6}" cy="${iconY}" r="4" fill="none" stroke="${iconColor}" stroke-width="1.6"/><line x1="${cx-2}" y1="${iconY}" x2="${cx+2}" y2="${iconY}" stroke="${iconColor}" stroke-width="1.6"/>`;
    else if (s.icon === 'check') svg += `<circle cx="${cx}" cy="${iconY}" r="9" fill="none" stroke="${iconColor}" stroke-width="1.6"/><path d="M${cx-4},${iconY} l3,3 l6,-6" fill="none" stroke="${iconColor}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
    else if (s.icon === 'bolt') svg += `<path d="M${cx+2},${iconY-9} l-7,10 h5 l-2,8 l7,-10 h-5 z" fill="none" stroke="${iconColor}" stroke-width="1.4" stroke-linejoin="round"/>`;
    else if (s.icon === 'bars') svg += `<rect x="${cx-9}" y="${iconY-2}" width="4" height="9" fill="${iconColor}"/><rect x="${cx-2}" y="${iconY-7}" width="4" height="14" fill="${iconColor}"/><rect x="${cx+5}" y="${iconY-9}" width="4" height="16" fill="${iconColor}"/>`;
    else if (s.icon === 'shield') svg += `<path d="M${cx},${iconY-9} l8,3.5 v5.5 c0,4.5 -3.4,7 -8,8.5 c-4.6,-1.5 -8,-4 -8,-8.5 v-5.5 z" fill="none" stroke="${iconColor}" stroke-width="1.6" transform="scale(0.55) translate(${cx*0.82},${iconY*0.82})"/>`;
    else svg += `<path d="M${cx-8},${iconY+6} L${cx+8},${iconY+6} L${cx+8},${iconY-2} L${cx},${iconY-9} L${cx-8},${iconY-2} Z" fill="none" stroke="${iconColor}" stroke-width="1.5" stroke-linejoin="round"/>`;
    lines.forEach((line, li) => {
      svg += `<text x="${cx}" y="${y + boxH - 18 + li*15}" text-anchor="middle" font-size="11.5" font-family="IBM Plex Sans" fill="${isLast ? '#6C8CFF' : '#E9ECF4'}">${line}</text>`;
    });
    if (!isLast) {
      const x2 = x + boxW;
      svg += `<line x1="${x2}" y1="${y + boxH/2}" x2="${x2 + gap}" y2="${y + boxH/2}" stroke="#6C8CFF" stroke-width="1.5" marker-end="url(#arrow3)"/>`;
    }
  });
  g.innerHTML = svg;
  const totalW = startX + stages.length * boxW + (stages.length - 1) * gap + 10;
  const svgEl = g.closest('svg');
  if (svgEl) {
    svgEl.setAttribute('viewBox', `0 0 ${totalW} 140`);
    svgEl.style.minWidth = totalW + 'px';
  }
}

function buildDataset() {
  const d = SEAQL_DATA.dataset;
  const statsEl = document.getElementById('dataset-stats');
  const stats = [
    { num: d.rawRows.toLocaleString(), lbl: 'Raw rows' },
    { num: d.discardedRows.toLocaleString(), lbl: 'Discarded (invalid label)' },
    { num: d.finalRows.toLocaleString(), lbl: 'Final clean rows' },
    { num: d.features, lbl: 'Usable features' },
  ];
  statsEl.innerHTML = stats.map(s => `<div class="dataset-stat"><div class="num">${s.num}</div><div class="lbl">${s.lbl}</div></div>`).join('');
  document.getElementById('dataset-steps').innerHTML = d.cleaningSteps.map(s => `<li>${s}</li>`).join('');
}

// ============ Pipeline SVG (9-stage architecture strip) ============
function buildPipelineSVG() {
  const stages = ['Dataset', 'Preprocessing', 'Baselines', 'Federated\nLearning', 'Autoencoder', 'Hybrid\nEnsemble', 'Final\nDetection'];
  const g = document.getElementById('pipeline-svg-stages');
  const boxW = 118, boxH = 64, gap = 40, startX = 20, y = 68;
  let svg = '';
  stages.forEach((s, i) => {
    const x = startX + i * (boxW + gap);
    const lines = s.split('\n');
    svg += `<rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="8" fill="#171C28" stroke="${i === stages.length - 1 ? '#6C8CFF' : '#232A3A'}" stroke-width="${i === stages.length - 1 ? 2 : 1}" ${i === stages.length - 1 ? 'class="pulse-glow"' : ''}/>`;
    lines.forEach((line, li) => {
      svg += `<text x="${x + boxW / 2}" y="${y + boxH / 2 - (lines.length - 1) * 8 + li * 16 + 4}" text-anchor="middle" font-size="12" fill="${i === stages.length - 1 ? '#6C8CFF' : '#E9ECF4'}">${line}</text>`;
    });
    if (i < stages.length - 1) {
      const x2 = x + boxW;
      svg += `<line x1="${x2}" y1="${y + boxH / 2}" x2="${x2 + gap}" y2="${y + boxH / 2}" stroke="#6C8CFF" stroke-width="1.5" marker-end="url(#arrow)"/>`;
    }
  });
  g.innerHTML = svg;
  const totalW = startX + stages.length * boxW + (stages.length - 1) * gap + 20;
  const svgEl = g.closest('svg');
  if (svgEl) {
    svgEl.setAttribute('viewBox', `0 0 ${totalW} 200`);
    svgEl.style.minWidth = totalW + 'px';
  }
}

// ============ Timeline ============
function buildTimeline() {
  const el = document.getElementById('timeline');
  el.innerHTML = SEAQL_DATA.progression.map(item => `
    <div class="tl-item ${item.n >= 6 ? 'proposed' : ''}">
      <span class="tl-num">${String(item.n).padStart(2, '0')}</span>
      <div><span class="tl-model">${item.model}</span><span class="tl-task">${item.task} · ${item.macroF1}% macro F1</span></div>
      <span class="tl-note">${item.note}</span>
    </div>`).join('');
}

// ============ Progression chart ============
function buildProgressionChart() {
  const ctx = document.getElementById('progressionChart');
  const data = SEAQL_DATA.progression;
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.model),
      datasets: [{ label: 'Macro F1-score (%)', data: data.map(d => d.macroF1), backgroundColor: data.map(d => d.n >= 6 ? '#6C8CFF' : '#3A4258'), borderRadius: 3, maxBarThickness: 46 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#171C28', titleFont: { family: 'IBM Plex Mono' }, bodyFont: { family: 'IBM Plex Mono' }, callbacks: { label: ctx => `${ctx.parsed.y}% macro F1` } } },
      scales: {
        y: { beginAtZero: true, max: 100, grid: { color: '#232A3A' }, ticks: { color: '#8B93A8', font: { family: 'IBM Plex Mono', size: 11 }, callback: v => v + '%' } },
        x: { grid: { display: false }, ticks: { color: '#8B93A8', font: { family: 'IBM Plex Sans', size: 10 }, maxRotation: 28, minRotation: 28 } }
      }
    }
  });
}

// ============ Results table (interactive Model Comparison Panel) ============
function fmt(v) { return v === null || v === undefined ? '<span class="na">—</span>' : v.toFixed(1) + '%'; }
let currentCompareMetric = 'macroF1';
function buildResultsTable() {
  const tbody = document.querySelector('#results-table tbody');
  const rows = SEAQL_DATA.resultsTable.slice().sort((a, b) => {
    const av = a[currentCompareMetric], bv = b[currentCompareMetric];
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    return bv - av;
  });
  tbody.innerHTML = rows.map(r => `
    <tr class="${r.model.includes('final') ? 'final-row' : ''}">
      <td class="model-name">${r.model}</td>
      <td class="${currentCompareMetric === 'accuracy' ? 'metric-col-active' : ''}">${fmt(r.accuracy)}</td>
      <td class="${currentCompareMetric === 'macroF1' ? 'metric-col-active' : ''}">${fmt(r.macroF1)}</td>
      <td class="${currentCompareMetric === 'weightedF1' ? 'metric-col-active' : ''}">${fmt(r.weightedF1)}</td>
      <td class="${currentCompareMetric === 'auc' ? 'metric-col-active' : ''}">${fmt(r.auc)}</td>
    </tr>`).join('');
}

function initModelComparisonToggle() {
  const controls = document.getElementById('model-compare-controls');
  if (!controls) return;
  controls.querySelectorAll('.compare-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      controls.querySelectorAll('.compare-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCompareMetric = btn.dataset.metric;
      buildResultsTable();
    });
  });
}

// ============ AI Confidence Meters (radial gauges, static test-set metrics) ============
function buildConfidenceMeters() {
  const el = document.getElementById('confidence-meters');
  if (!el || !SEAQL_DATA.finalModel) return;
  const fm = SEAQL_DATA.finalModel;
  const meters = [
    { label: 'Accuracy', value: fm.accuracy },
    { label: 'Macro F1', value: fm.macroF1 },
    { label: 'AUC (ROC)', value: fm.auc },
    { label: 'Balanced accuracy', value: fm.balancedAccuracy }
  ];
  el.innerHTML = meters.map(m => radialGauge(m.label, m.value)).join('');
}

function radialGauge(label, value) {
  const r = 52, c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const offset = c - (pct / 100) * c;
  const gaugeId = 'gauge-' + label.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  return `
    <div class="gauge-card">
      <svg viewBox="0 0 130 130" width="130" height="130" class="gauge-svg" role="img" aria-label="${label}: ${pct.toFixed(1)} percent">
        <circle cx="65" cy="65" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="10"/>
        <circle cx="65" cy="65" r="${r}" fill="none" stroke="var(--accent)" stroke-width="10"
          stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c}"
          transform="rotate(-90 65 65)" class="gauge-arc" id="${gaugeId}" data-target="${offset}"/>
        <text x="65" y="60" text-anchor="middle" class="gauge-value" font-family="var(--font-display)">${pct.toFixed(1)}%</text>
        <text x="65" y="78" text-anchor="middle" class="gauge-sublabel" font-family="var(--font-mono)">test set</text>
      </svg>
      <span class="gauge-label">${label}</span>
    </div>`;
}

function animateGauges() {
  document.querySelectorAll('.gauge-arc').forEach(arc => {
    const target = arc.getAttribute('data-target');
    requestAnimationFrame(() => requestAnimationFrame(() => { arc.style.strokeDashoffset = target; }));
  });
}
function buildObjectivesBoard() {
  const el = document.getElementById('objectives-board');
  if (!el || !SEAQL_DATA.objectives) return;
  const statusMeta = {
    achieved: { label: 'Achieved', cls: 'status-achieved', icon: '✓' },
    partial: { label: 'Partial', cls: 'status-partial', icon: '◐' },
    designed: { label: 'Designed only', cls: 'status-designed', icon: '○' }
  };
  el.innerHTML = SEAQL_DATA.objectives.map(o => {
    const meta = statusMeta[o.status] || statusMeta.designed;
    return `
    <div class="objective-card">
      <div class="objective-head">
        <span class="objective-id">O${o.id}</span>
        <span class="status-pill ${meta.cls}"><span class="status-dot"></span>${meta.icon} ${meta.label}</span>
      </div>
      <p class="objective-text">${o.text}</p>
      <p class="objective-note">${o.note}</p>
    </div>`;
  }).join('');
}
function buildBaselineConfusionGrid() {
  const el = document.getElementById('baseline-confusion-grid');
  el.innerHTML = SEAQL_DATA.baselineConfusion.map(b => `
    <div class="figure-card">
      <img src="assets/${b.img}" alt="Confusion matrix for ${b.model}" loading="lazy" decoding="async">
      <div class="fig-title">${b.model}</div>
      <figcaption>${b.note}</figcaption>
    </div>`).join('');
}

// ============ Federated learning section ============
function buildFederatedSection() {
  const f = SEAQL_DATA.federatedLearning;
  document.getElementById('federated-summary').textContent =
    `${f.clients} simulated UAV clients, grouped into ${f.clusters} clusters, trained over ${f.rounds} federated rounds under ${f.partitioning}. ${f.note}`;
}

function buildFLArchitectureSVG() {
  const f = SEAQL_DATA.federatedLearning;
  const g = document.getElementById('fl-architecture-svg');
  const serverX = 450, serverY = 40;
  const clusterY = 150;
  const cluster1X = 220, cluster2X = 680;
  let svg = `
    <circle cx="${serverX}" cy="${serverY}" r="22" fill="#171C28" stroke="#6C8CFF" stroke-width="2"/>
    <text x="${serverX}" y="${serverY+5}" text-anchor="middle" font-size="11" fill="#6C8CFF" font-family="IBM Plex Mono">Server</text>
    <circle cx="${cluster1X}" cy="${clusterY}" r="18" fill="#171C28" stroke="#8FA5FF" stroke-width="1.5"/>
    <text x="${cluster1X}" y="${clusterY+4}" text-anchor="middle" font-size="10" fill="#8FA5FF" font-family="IBM Plex Mono">Cluster A</text>
    <circle cx="${cluster2X}" cy="${clusterY}" r="18" fill="#171C28" stroke="#8FA5FF" stroke-width="1.5"/>
    <text x="${cluster2X}" y="${clusterY+4}" text-anchor="middle" font-size="10" fill="#8FA5FF" font-family="IBM Plex Mono">Cluster B</text>
    <line x1="${serverX}" y1="${serverY+22}" x2="${cluster1X}" y2="${clusterY-18}" stroke="#232A3A" stroke-width="1.5"/>
    <line x1="${serverX}" y1="${serverY+22}" x2="${cluster2X}" y2="${clusterY-18}" stroke="#232A3A" stroke-width="1.5"/>
  `;
  const half = Math.ceil(f.clients / 2);
  for (let i = 0; i < f.clients; i++) {
    const isLeft = i < half;
    const cx = isLeft ? cluster1X : cluster2X;
    const idxInCluster = isLeft ? i : i - half;
    const countInCluster = isLeft ? half : f.clients - half;
    const spread = 200;
    const x = cx - spread / 2 + (spread / (countInCluster - 1 || 1)) * idxInCluster;
    const y = 240;
    svg += `<line x1="${cx}" y1="${clusterY+18}" x2="${x}" y2="${y-10}" stroke="#232A3A" stroke-width="1"/>`;
    svg += `<rect x="${x-9}" y="${y-10}" width="18" height="18" rx="3" fill="#12161F" stroke="#3A4258" stroke-width="1"/>`;
    svg += `<text x="${x}" y="${y+22}" text-anchor="middle" font-size="8" fill="#8B93A8" font-family="IBM Plex Mono">UAV ${i+1}</text>`;
  }
  g.innerHTML = svg;
  const svgEl = g.closest('svg');
  if (svgEl) {
    svgEl.setAttribute('viewBox', '0 0 900 285');
    svgEl.style.minWidth = '760px';
  }
}

function buildFederatedChart() {
  const rounds = SEAQL_DATA.federatedLearning.roundHistory;
  new Chart(document.getElementById('federatedChart'), {
    type: 'line',
    data: {
      labels: rounds.map(r => 'Round ' + r.round),
      datasets: [
        { label: 'Validation macro F1 (%)', data: rounds.map(r => r.valF1), borderColor: '#6C8CFF', backgroundColor: 'rgba(108,140,255,0.1)', tension: 0.3, fill: true },
        { label: 'Validation accuracy (%)', data: rounds.map(r => r.valAccuracy), borderColor: '#8FA5FF', borderDash: [4,3], tension: 0.3, fill: false }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#8B93A8', font: { family: 'IBM Plex Mono', size: 10 } } } },
      scales: {
        y: { grid: { color: '#232A3A' }, ticks: { color: '#8B93A8', font: { family: 'IBM Plex Mono', size: 10 }, callback: v => v + '%' } },
        x: { grid: { display: false }, ticks: { color: '#8B93A8', font: { family: 'IBM Plex Mono', size: 10 } } }
      }
    }
  });
}

function buildNonIidChart() {
  const samples = SEAQL_DATA.federatedLearning.clientSamples;
  new Chart(document.getElementById('nonIidChart'), {
    type: 'bar',
    data: { labels: samples.map((_, i) => 'Client ' + i), datasets: [{ label: 'Samples', data: samples, backgroundColor: '#6C8CFF', borderRadius: 3 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#171C28' } },
      scales: {
        y: { grid: { color: '#232A3A' }, ticks: { color: '#8B93A8', font: { family: 'IBM Plex Mono', size: 10 } } },
        x: { grid: { display: false }, ticks: { color: '#8B93A8', font: { family: 'IBM Plex Mono', size: 10 } } }
      }
    }
  });
}

function buildContinualChart() {
  const chunks = SEAQL_DATA.continualLearning;
  new Chart(document.getElementById('continualChart'), {
    type: 'bar',
    data: {
      labels: chunks.map(c => 'Chunk ' + c.chunk),
      datasets: [
        { label: 'Before update (%)', data: chunks.map(c => c.f1Before), backgroundColor: '#3A4258', borderRadius: 3 },
        { label: 'After update (%)', data: chunks.map(c => c.f1After), backgroundColor: '#6C8CFF', borderRadius: 3 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#8B93A8', font: { family: 'IBM Plex Mono', size: 10 } } } },
      scales: {
        y: { grid: { color: '#232A3A' }, ticks: { color: '#8B93A8', font: { family: 'IBM Plex Mono', size: 10 }, callback: v => v + '%' } },
        x: { grid: { display: false }, ticks: { color: '#8B93A8', font: { family: 'IBM Plex Mono', size: 10 } } }
      }
    }
  });
}

// ============ Research Roadmap: proposal vs implementation ============
function buildRoadmap() {
  const r = SEAQL_DATA.roadmap;
  document.getElementById('roadmap-proposed').innerHTML = r.proposed.map(item => `
    <div class="roadmap-item"><h5>${item.title}</h5><p>${item.text}</p></div>`).join('');
  document.getElementById('roadmap-implemented').innerHTML = r.implemented.map(item => `
    <div class="roadmap-item"><h5><span class="roadmap-status ${item.status}"></span>${item.title}</h5><p>${item.text}</p></div>`).join('');
}

// ============ Final model architecture diagram ============
const ARCH_STAGE_DETAILS = {
  'Dataset': 'Raw capture: 54,783 packet rows. After removing rows with missing/invalid class labels (21,681 dropped), 32,558 labeled rows remain across 32 features, split benign / DoS attack / Replay.',
  'Preprocessing': 'Identifier/leakage columns (timestamp, frame number) and fully-empty or constant columns are dropped, duplicates removed, then median imputation + robust scaling — fitted only on the training split to avoid leakage.',
  'Federated Learning': 'Simulated across 8 clients in 2 clusters over 5 rounds, partitioned with Dirichlet(α = 0.30) for a deliberately severe non-IID split — stress-testing the model on realistically uneven swarm data.',
  'Autoencoder': 'Trained only on benign traffic, so it never "sees" attacks during training. Its reconstruction error and latent embedding become an anomaly signal that is fed forward as extra features.',
  'Random Forest\n(+4 more)': 'Five base learners — Random Forest, XGBoost, LightGBM, Extra Trees, and an MLP — each trained on the original 32 features plus the autoencoder\'s anomaly signal.',
  'Stacked Ensemble': 'A Logistic Regression meta-learner combines the five base learners\' outputs, correcting for cases where individual models disagree or overfit to one attack pattern.',
  'Final Detection': 'The combined system reaches 94.3% accuracy, 93.3% macro F1, and 98.3% AUC on binary (benign vs. attack) detection — the number reported throughout this site.',
};

function buildArchitectureSVG() {
  const stages = SEAQL_DATA.architecture;
  const g = document.getElementById('architecture-svg');
  const boxW = 148, boxH = 74, gap = 20, startX = 6, y = 30;
  let svg = `<defs><marker id="arrow4" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#6C8CFF"/></marker></defs>`;
  stages.forEach((s, i) => {
    const x = startX + i * (boxW + gap);
    const isLast = i === stages.length - 1;
    const lines = s.split('\n');
    svg += `<g class="arch-stage" data-stage="${i}" tabindex="0" role="button" aria-expanded="false" aria-label="${s.replace(/\n/g,' ')} — show details">
      <rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="9" fill="${isLast ? 'rgba(108,140,255,0.1)' : '#0A0D14'}" stroke="${isLast ? '#6C8CFF' : '#232A3A'}" stroke-width="${isLast ? 2 : 1}" class="arch-stage-rect ${isLast ? 'pulse-glow' : ''}"/>`;
    lines.forEach((line, li) => {
      svg += `<text x="${x + boxW/2}" y="${y + boxH/2 - (lines.length-1)*8 + li*15 + 4}" text-anchor="middle" font-size="11.5" font-family="IBM Plex Sans" font-weight="${isLast?600:400}" fill="${isLast ? '#6C8CFF' : '#E9ECF4'}" class="arch-stage-text">${line}</text>`;
    });
    svg += `</g>`;
    if (!isLast) {
      const x2 = x + boxW;
      svg += `<line x1="${x2}" y1="${y + boxH/2}" x2="${x2 + gap}" y2="${y + boxH/2}" stroke="#6C8CFF" stroke-width="1.5" marker-end="url(#arrow4)"/>`;
    }
  });
  g.innerHTML = svg;
  const totalW = startX + stages.length * boxW + (stages.length - 1) * gap + 10;
  const svgEl = g.closest('svg');
  if (svgEl) {
    svgEl.setAttribute('viewBox', `0 0 ${totalW} 150`);
    svgEl.style.minWidth = totalW + 'px';
  }

  const detailEl = document.getElementById('architecture-detail');
  const groups = g.querySelectorAll('.arch-stage');
  function activate(i) {
    groups.forEach(gr => gr.classList.remove('active'));
    groups[i].classList.add('active');
    groups.forEach(gr => gr.setAttribute('aria-expanded', 'false'));
    groups[i].setAttribute('aria-expanded', 'true');
    if (detailEl) {
      detailEl.innerHTML = `<strong>${stages[i].replace(/\n/g, ' ')}</strong> — ${ARCH_STAGE_DETAILS[stages[i]] || ''}`;
      detailEl.hidden = false;
    }
  }
  groups.forEach((gr, i) => {
    gr.addEventListener('click', () => activate(i));
    gr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(i); } });
  });
}

// ============ Mini tables under supplementary FL charts ============
function buildFederatedMiniTables() {
  const f = SEAQL_DATA.federatedLearning;
  document.getElementById('federated-mini-table').innerHTML = `
    <table class="mini-table"><thead><tr><th>Round</th><th>Train F1</th><th>Val F1</th><th>Val Acc.</th></tr></thead>
    <tbody>${f.roundHistory.map(r => `<tr><td>${r.round}</td><td>${r.trainF1}%</td><td>${r.valF1}%</td><td>${r.valAccuracy}%</td></tr>`).join('')}</tbody></table>`;

  document.getElementById('nonIid-mini-table').innerHTML = `
    <table class="mini-table"><thead><tr><th>Client</th>${f.clientSamples.map((_,i)=>`<th>${i}</th>`).join('')}</tr></thead>
    <tbody><tr><td>Samples</td>${f.clientSamples.map(s=>`<td>${s.toLocaleString()}</td>`).join('')}</tr></tbody></table>`;

  const c = SEAQL_DATA.continualLearning;
  document.getElementById('continual-mini-table').innerHTML = `
    <table class="mini-table"><thead><tr><th>Chunk</th><th>Samples</th><th>F1 Before</th><th>F1 After</th></tr></thead>
    <tbody>${c.map(ch => `<tr><td>${ch.chunk}</td><td>${ch.samples.toLocaleString()}</td><td>${ch.f1Before}%</td><td>${ch.f1After}%</td></tr>`).join('')}</tbody></table>`;
}

// ============ Active nav highlighting on scroll ============
function initActiveNav() {
  const sections = Array.from(document.querySelectorAll('main section[id], header.hero'));
  const links = document.querySelectorAll('.nav-links a[href^="#"]');
  if (!sections.length || !links.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + id));
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });
  sections.forEach(s => { if (s.id) io.observe(s); });
}

// ============ Explainability ============
function buildExplainability() {
  document.getElementById('explainability-method').textContent = SEAQL_DATA.explainability.method;
  const el = document.getElementById('xai-feature-list');
  el.classList.add('xai-explorer');
  const features = SEAQL_DATA.explainability.topFeatures.slice();
  const max = Math.max(...features.map(f => f.importance));

  el.innerHTML = `
    <div class="chart-card">
      <div class="xai-explorer-head">
        <h3>Explainability Explorer</h3>
        <div class="xai-explorer-controls">
          <input type="text" id="xai-search" class="xai-search-input" placeholder="Search a feature (e.g. wlan.seq)…" aria-label="Search features">
          <div class="xai-sort-toggle" role="group" aria-label="Sort order">
            <button type="button" class="xai-sort-btn active" data-sort="desc">High → Low</button>
            <button type="button" class="xai-sort-btn" data-sort="asc">Low → High</button>
            <button type="button" class="xai-sort-btn" data-sort="alpha">A → Z</button>
          </div>
        </div>
      </div>
      <div id="xai-feature-rows"></div>
      <p id="xai-empty-state" class="xai-empty" hidden>No feature matches that search.</p>
    </div>`;

  const rowsEl = document.getElementById('xai-feature-rows');
  const searchEl = document.getElementById('xai-search');
  const emptyEl = document.getElementById('xai-empty-state');
  const sortBtns = el.querySelectorAll('.xai-sort-btn');
  let sortMode = 'desc';

  function render() {
    const q = searchEl.value.trim().toLowerCase();
    let list = features.filter(f => f.feature.toLowerCase().includes(q));
    if (sortMode === 'desc') list.sort((a, b) => b.importance - a.importance);
    else if (sortMode === 'asc') list.sort((a, b) => a.importance - b.importance);
    else list.sort((a, b) => a.feature.localeCompare(b.feature));

    emptyEl.hidden = list.length !== 0;
    rowsEl.innerHTML = list.map((f, i) => `
      <button type="button" class="xai-feature-row" data-feature="${f.feature}" aria-expanded="false">
        <div class="xai-feature-row-top">
          <span class="xai-feature-rank">#${features.findIndex(x => x.feature === f.feature) + 1}</span>
          <span class="xai-feature-name">${f.feature}</span>
          <span class="xai-feature-pct">${f.importance.toFixed(1)}%</span>
        </div>
        <div class="xai-feature-bar-track"><div class="xai-feature-bar-fill" style="width:${(f.importance / max) * 100}%;"></div></div>
        <div class="xai-feature-detail">${xaiFeatureNote(f.feature)}</div>
      </button>`).join('');

    rowsEl.querySelectorAll('.xai-feature-row').forEach(row => {
      row.addEventListener('click', () => {
        const isOpen = row.classList.toggle('open');
        row.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });
    });
  }

  searchEl.addEventListener('input', render);
  sortBtns.forEach(btn => btn.addEventListener('click', () => {
    sortBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    sortMode = btn.dataset.sort;
    render();
  }));

  render();
}

function xaiFeatureNote(feature) {
  const notes = {
    'wlan.seq': 'Sequence-number irregularities are a hallmark of retransmitted or replayed 802.11 frames.',
    'wlan.duration': 'Anomalous duration/NAV values can indicate malformed or maliciously crafted frames.',
    'time_since_last_packet': 'Inter-arrival timing deviations are one of the few signals available for distinguishing replay-style traffic.',
    'wlan.fc.type': 'Frame-type distribution shifts flag unusual control/management traffic mixes.',
    'ip.dst': 'Destination-address concentration can indicate a flood or targeted DoS pattern.',
    'ip.id': 'IP identification-field irregularities can indicate spoofed or replayed packets.',
    'wlan.fc.subtype': 'Frame-subtype shifts help separate normal association/data traffic from attack traffic.'
  };
  return notes[feature] || 'Contributes to the permutation-importance ranking for this classification.';
}

// ============ Interactive classifier demo ============
// Not a live model call. It's a transparent weighted-sum reasoning
// tool built directly from the same permutation-importance percentages
// reported in the Explainability section — so a visitor can *feel*
// how the real reported weights combine, without us pretending the
// browser is running the actual trained ensemble.
const DEMO_PRESETS = {
  benign:  { 'wlan.seq': 8,  'wlan.duration': 10, 'time_since_last_packet': 12, 'wlan.fc.type': 6,  'ip.dst': 10, 'ip.id': 8,  'wlan.fc.subtype': 6 },
  dos:     { 'wlan.seq': 30, 'wlan.duration': 70, 'time_since_last_packet': 45, 'wlan.fc.type': 85, 'ip.dst': 90, 'ip.id': 40, 'wlan.fc.subtype': 55 },
  replay:  { 'wlan.seq': 92, 'wlan.duration': 55, 'time_since_last_packet': 85, 'wlan.fc.type': 35, 'ip.dst': 25, 'ip.id': 80, 'wlan.fc.subtype': 60 },
};

function buildInferenceDemo() {
  const panel = document.getElementById('demo-panel');
  if (!panel || !SEAQL_DATA) return;
  const features = SEAQL_DATA.explainability.topFeatures.slice().sort((a, b) => b.importance - a.importance);
  const totalWeight = features.reduce((s, f) => s + f.importance, 0);
  const state = {};
  features.forEach(f => { state[f.feature] = DEMO_PRESETS.benign[f.feature] ?? 20; });

  panel.innerHTML = `
    <div class="demo-sliders">
      <div class="demo-presets">
        <button type="button" class="demo-preset-btn" data-preset="benign">Typical benign</button>
        <button type="button" class="demo-preset-btn" data-preset="dos">DoS-like burst</button>
        <button type="button" class="demo-preset-btn" data-preset="replay">Replay-like pattern</button>
      </div>
      ${features.map(f => `
        <div class="demo-slider-row">
          <div class="demo-slider-label">
            <span class="demo-slider-name">${f.feature}</span>
            <span class="demo-slider-weight">weight ${f.importance.toFixed(1)}%</span>
            <span class="demo-slider-value" id="demo-val-${cssSafe(f.feature)}">${state[f.feature]}</span>
          </div>
          <input type="range" min="0" max="100" step="1" value="${state[f.feature]}"
                 id="demo-slider-${cssSafe(f.feature)}" data-feature="${f.feature}"
                 aria-label="${f.feature} anomaly level">
        </div>`).join('')}
    </div>
    <div class="demo-result">
      <div class="demo-verdict" id="demo-verdict">—</div>
      <div class="demo-score-track"><div class="demo-score-fill" id="demo-score-fill"></div></div>
      <div class="demo-score-label" id="demo-score-label">Weighted anomaly score</div>
      <div class="demo-drivers">
        <h4>What's driving this reading</h4>
        <div id="demo-drivers-list"></div>
      </div>
    </div>`;

  function cssSafeLocal(s) { return s.replace(/[^a-zA-Z0-9]/g, '_'); }

  function recompute() {
    let weighted = 0;
    const contributions = features.map(f => {
      const v = state[f.feature];
      const contribution = f.importance * v;
      weighted += contribution;
      return { feature: f.feature, contribution, value: v };
    });
    const score = totalWeight > 0 ? weighted / totalWeight : 0;

    const verdictEl = document.getElementById('demo-verdict');
    const fillEl = document.getElementById('demo-score-fill');
    const labelEl = document.getElementById('demo-score-label');
    const isAttack = score >= 50;
    verdictEl.textContent = isAttack ? 'Flagged: Attack-like' : 'Reads as: Benign-like';
    verdictEl.className = 'demo-verdict ' + (isAttack ? 'is-attack' : 'is-benign');
    fillEl.style.width = Math.min(100, Math.max(0, score)) + '%';
    fillEl.style.background = isAttack ? 'var(--danger)' : 'var(--success)';
    labelEl.textContent = `Weighted anomaly score: ${score.toFixed(1)} / 100`;

    const top = contributions.slice().sort((a, b) => b.contribution - a.contribution).slice(0, 3);
    document.getElementById('demo-drivers-list').innerHTML = top.map(c => `
      <div class="demo-driver-row"><span>${c.feature}</span><span>${c.value}/100</span></div>`).join('');
  }

  features.forEach(f => {
    const id = 'demo-slider-' + cssSafeLocal(f.feature);
    const slider = document.getElementById(id);
    const valEl = document.getElementById('demo-val-' + cssSafeLocal(f.feature));
    slider.addEventListener('input', () => {
      state[f.feature] = Number(slider.value);
      valEl.textContent = slider.value;
      recompute();
    });
  });

  panel.querySelectorAll('.demo-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = DEMO_PRESETS[btn.dataset.preset];
      features.forEach(f => {
        state[f.feature] = preset[f.feature] ?? state[f.feature];
        const slider = document.getElementById('demo-slider-' + cssSafeLocal(f.feature));
        const valEl = document.getElementById('demo-val-' + cssSafeLocal(f.feature));
        slider.value = state[f.feature];
        valEl.textContent = state[f.feature];
      });
      recompute();
    });
  });

  recompute();
}

function cssSafe(s) { return s.replace(/[^a-zA-Z0-9]/g, '_'); }

// ============ Contributions ============
const CONTRIB_ICONS = [
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="5" r="2.2"/><circle cx="5" cy="19" r="2.2"/><circle cx="19" cy="19" r="2.2"/><path d="M12 7v6M12 13l-5.5 4M12 13l5.5 4"/></svg>',
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M8 12l2.5 2.5L16 9"/></svg>',
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/></svg>',
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v9l6 3"/><circle cx="12" cy="12" r="9"/></svg>',
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2l7 4v6c0 5-3 8-7 10-4-2-7-5-7-10V6l7-4z"/></svg>',
];
function buildContributions() {
  const el = document.getElementById('contrib-grid');
  el.innerHTML = SEAQL_DATA.contributions.map((c, i) => `
    <div class="contrib-card">
      <div class="contrib-icon">${CONTRIB_ICONS[i % CONTRIB_ICONS.length]}</div>
      <div class="contrib-num">${String(i+1).padStart(2,'0')}</div>
      <h3>${c.title}</h3><p>${c.text}</p>
    </div>`).join('');
}

// ============ Future work ============
function buildFutureWork() {
  document.getElementById('future-list').innerHTML = SEAQL_DATA.futureWork.map(f => `<li>${f}</li>`).join('');
}

// ============ Nav / mobile menu / scroll ============
window.addEventListener('scroll', () => {
  const nav = document.getElementById('nav');
  nav.style.borderBottomColor = window.scrollY > 20 ? '#6C8CFF' : '#232A3A';
});

function initMobileMenu() {
  const burger = document.getElementById('nav-burger');
  const links = document.getElementById('nav-links');
  if (!burger || !links) return;
  burger.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    burger.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
  });
  links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    links.classList.remove('open'); burger.classList.remove('open');
  }));
}

function initScrollReveal() {
  const selectors = ['.chart-card', '.finding-card', '.metrics-grid', '.figure-row', '.figure-grid',
    '.contrib-grid', '.limitations-card', '.future-card', '.problem-list', '.timeline', '.problem-item',
    '.why-grid', '.results-table-wrap', '.dataset-grid', '.dataset-flow', '.pipeline-diagram', '.chart-grid-2', '.xai-flow', '.roadmap-grid',
    '.objectives-board', '.confidence-meters', '.xai-explorer'];
  const els = document.querySelectorAll(selectors.join(','));
  els.forEach(el => el.classList.add('reveal'));
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('in-view'); io.unobserve(entry.target); } });
  }, { threshold: 0.12 });
  els.forEach(el => io.observe(el));
}

document.addEventListener('DOMContentLoaded', () => {
  initSwarmCanvas();
  initMobileMenu();
  initIntroDrone();
  initHeroScrollShrink();
  initCursorDrone();
  loadData();
  const pdfBtn = document.getElementById('export-pdf-btn');
  if (pdfBtn) pdfBtn.addEventListener('click', () => window.print());
  initNavDropdowns();
  initScrollProgress();
});

function initScrollProgress() {
  const bar = document.getElementById('scroll-progress');
  if (!bar) return;
  function update() {
    const h = document.documentElement;
    const scrolled = h.scrollTop;
    const max = h.scrollHeight - h.clientHeight;
    bar.style.width = (max > 0 ? (scrolled / max) * 100 : 0) + '%';
  }
  document.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
}

function initNavDropdowns() {
  const dropdowns = document.querySelectorAll('.nav-dropdown');
  dropdowns.forEach(dd => {
    const toggle = dd.querySelector('.nav-dropdown-toggle');
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = dd.classList.contains('open');
      dropdowns.forEach(d => d.classList.remove('open'));
      if (!wasOpen) dd.classList.add('open');
    });
  });
  document.addEventListener('click', () => dropdowns.forEach(d => d.classList.remove('open')));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') dropdowns.forEach(d => d.classList.remove('open')); });
}

// ============ Research assistant (client-side FAQ, no external API) ============
// Deliberately not wired to any LLM: a keyword-scored match against a
// small, honestly-sourced FAQ built straight from data.json, so nothing
// here can drift from — or overstate — what's actually reported on this site.
function buildResearchKB() {
  const fm = SEAQL_DATA.finalModel;
  const ds = SEAQL_DATA.dataset;
  const fl = SEAQL_DATA.federatedLearning;
  const xai = SEAQL_DATA.explainability;
  const fw = SEAQL_DATA.futureWork;
  return [
    {
      q: 'What is the final model accuracy?',
      keywords: ['accuracy', 'result', 'performance', 'how good', 'score', 'f1', 'auc'],
      a: `The final model — ${fm.name} — reaches <strong>${fm.accuracy}% accuracy</strong>, ${fm.macroF1}% macro F1, and ${fm.auc}% AUC on binary (benign vs. attack) detection. Attack precision is ${fm.attackPrecision}% and recall ${fm.attackRecall}%.`
    },
    {
      q: 'What dataset was used?',
      keywords: ['dataset', 'data', 'rows', 'packets', 'features', 'samples'],
      a: `Starting from ${ds.rawRows.toLocaleString()} raw captured rows, ${ds.discardedRows.toLocaleString()} were dropped for missing/invalid labels, leaving ${ds.finalRows.toLocaleString()} labeled rows across ${ds.features} features, split across benign, DoS attack, and Replay traffic.`
    },
    {
      q: 'How was federated learning set up?',
      keywords: ['federated', 'fl', 'clients', 'clusters', 'non-iid', 'rounds'],
      a: `Simulated across <strong>${fl.clients} clients</strong> in ${fl.clusters} clusters over ${fl.rounds} rounds, using a ${fl.partitioning} — a deliberately hard non-IID split rather than an easy uniform one.`
    },
    {
      q: 'How is the model explained (XAI)?',
      keywords: ['explainable', 'xai', 'shap', 'interpretability', 'why', 'explain'],
      a: `${xai.method} The top contributing feature is <strong>${xai.topFeatures[0].feature}</strong> at ${xai.topFeatures[0].importance.toFixed(1)}% importance.`
    },
    {
      q: 'What are the known limitations / future work?',
      keywords: ['limitation', 'weakness', 'future', 'gap', 'problem', 'not done', 'pending'],
      a: `Honestly documented next steps: <ul style="margin:8px 0 0 18px;">${fw.map(f => `<li style="margin-bottom:6px;">${f}</li>`).join('')}</ul>`
    },
    {
      q: 'Who built this?',
      keywords: ['who', 'author', 'team', 'developer', 'made this', 'built'],
      a: `Built as a Final Year Project applying federated learning, explainable AI, and post-quantum-aware design to UAV swarm cybersecurity. Full authorship and supervision details are in the thesis document.`
    },
  ];
}

function scoreMatch(query, entry) {
  const q = query.toLowerCase();
  let score = 0;
  entry.keywords.forEach(k => { if (q.includes(k)) score += k.length; });
  if (q.includes(entry.q.toLowerCase().slice(0, 6))) score += 3;
  return score;
}

function initResearchAssistant() {
  const toggle = document.getElementById('ra-toggle');
  const panel = document.getElementById('ra-panel');
  const closeBtn = document.getElementById('ra-close');
  const chipsEl = document.getElementById('ra-chips');
  const answerEl = document.getElementById('ra-answer');
  const input = document.getElementById('ra-input');
  const askBtn = document.getElementById('ra-ask');
  if (!toggle || !panel || !SEAQL_DATA) return;

  const kb = buildResearchKB();
  chipsEl.innerHTML = kb.slice(0, 4).map((e, i) => `<button type="button" class="ra-chip" data-i="${i}">${e.q}</button>`).join('');
  answerEl.innerHTML = `<p class="ra-empty">Ask a question, or tap a suggestion above.</p>`;

  function answer(query) {
    if (!query.trim()) return;
    const scored = kb.map(e => ({ e, s: scoreMatch(query, e) })).sort((a, b) => b.s - a.s);
    const best = scored[0];
    if (!best || best.s === 0) {
      answerEl.innerHTML = `<span class="ra-q">${query}</span><p class="ra-empty">No close match in the FAQ yet — try one of the suggestions above, or check the relevant section on the page.</p>`;
      return;
    }
    answerEl.innerHTML = `<span class="ra-q">${query}</span><p>${best.e.a}</p>`;
  }

  toggle.addEventListener('click', () => {
    const isOpen = panel.hidden;
    panel.hidden = !isOpen;
    toggle.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) input.focus();
  });
  closeBtn.addEventListener('click', () => { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); });
  document.addEventListener('click', (e) => {
    if (!panel.hidden && !panel.contains(e.target) && e.target !== toggle && !toggle.contains(e.target)) {
      panel.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) {
      panel.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    }
  });
  askBtn.addEventListener('click', () => answer(input.value));
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') answer(input.value); });
  chipsEl.querySelectorAll('.ra-chip').forEach(chip => {
    chip.addEventListener('click', () => { input.value = kb[chip.dataset.i].q; answer(input.value); });
  });
}

// ============ Mini drone that smoothly follows the mouse cursor ============
function initCursorDrone() {
  if (window.matchMedia('(hover: none)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const el = document.getElementById('cursor-drone');
  if (!el) return;

  let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
  let curX = mouseX, curY = mouseY;
  let active = false;

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX; mouseY = e.clientY;
    if (!active) { active = true; el.classList.add('active'); }
  }, { passive: true });

  window.addEventListener('mouseleave', () => el.classList.remove('active'));
  window.addEventListener('mouseenter', () => { if (active) el.classList.add('active'); });

  function animate() {
    curX += (mouseX - curX) * 0.16;
    curY += (mouseY - curY) * 0.16;
    el.style.transform = `translate(${curX - 15}px, ${curY - 15}px)`;
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}

// ============ Intro drone: leaves once user starts scrolling, stays gone ============
function initIntroDrone() {
  const el = document.getElementById('intro-drone');
  if (!el) return;
  let flown = false;
  window.addEventListener('scroll', () => {
    if (!flown && window.scrollY > 60) {
      el.classList.add('fly-away');
      flown = true;
      setTimeout(() => { el.style.display = 'none'; }, 1050);
    }
  }, { passive: true });
}

// ============ Hero shrinks & rises into the header as you scroll (like a logo "docking" into the navbar) ============
function initHeroScrollShrink() {
  const heroContent = document.querySelector('.hero-content');
  const heroSection = document.querySelector('.hero');
  if (!heroContent || !heroSection) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  let ticking = false;
  function update() {
    const heroHeight = heroSection.offsetHeight;
    const progress = Math.min(Math.max(window.scrollY / (heroHeight * 0.75), 0), 1);
    const scale = 1 - progress * 0.22;
    const translateY = -progress * 70;
    const opacity = 1 - progress * 0.9;
    heroContent.style.transform = `translateY(${translateY}px) scale(${scale})`;
    heroContent.style.opacity = opacity;
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }, { passive: true });
  update();
}
