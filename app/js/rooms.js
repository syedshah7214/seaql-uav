/* SEAQL — "rooms": every module gets its own art direction (banner artwork, palette, chart colours)
   while keeping the SEAQL brand (logo, sidebar, typography, buttons). Visual only. */
(function () {
  'use strict';
  const D = S.data;
  const pct = S.pct, num = S.num;
  const L = D.liveHybrid || {}, HM = L.heldout_metrics || {};

  /* chart colour remap per room: brand cyan / purple -> the room's accent pair.
     Status colours (red / green / amber) are never remapped, so their meaning stays the same. */
  S.PAL = {
    detect: { '34,211,238': '34,211,238', '139,92,246': '52,211,153' },
    federated: { '34,211,238': '96,165,250', '139,92,246': '139,92,246' },
    swarm: { '34,211,238': '34,211,238', '139,92,246': '59,130,246' },
    attack: { '34,211,238': '148,163,184', '139,92,246': '251,146,60' },
    xai: { '34,211,238': '45,212,191', '139,92,246': '167,139,250' },
    fleet: { '34,211,238': '125,211,252', '139,92,246': '52,211,153' },
    incidents: { '34,211,238': '253,164,175', '139,92,246': '190,24,93' },
    research: { '34,211,238': '129,140,248', '139,92,246': '232,121,249' },
  };
  const HEX = { '#22D3EE': '34,211,238', '#8B5CF6': '139,92,246' };
  const hex = (rgb) => '#' + rgb.split(',').map((n) => (+n).toString(16).padStart(2, '0')).join('').toUpperCase();
  S.recolor = (v) => {
    const pal = S.PAL[S.current && S.current()];
    if (!pal || typeof v !== 'string') return v;
    let out = v.replace(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g, (m, r, g, b) => { const k = `${r},${g},${b}`; return pal[k] ? m.replace(`${r},${g},${b}`, pal[k]).replace(/,\s*(?=\d)/g, ',') : m; });
    out = out.replace(/#22D3EE|#8B5CF6/gi, (m) => { const k = HEX[m.toUpperCase()]; return pal[k] ? hex(pal[k]) : m; });
    return out;
  };
  const deep = (o) => { if (Array.isArray(o)) return o.map(deep); if (o && typeof o === 'object' && o.constructor === Object) { const r = {}; for (const k in o) r[k] = deep(o[k]); return r; } return S.recolor(o); };
  const chart0 = S.chart, grad0 = S.gradient;
  S.chart = (canvas, cfg) => { if (cfg && cfg.data && cfg.data.datasets) cfg.data.datasets = cfg.data.datasets.map((d) => { const n = {}; for (const k in d) n[k] = (k === 'data') ? d[k] : deep(d[k]); return n; }); return chart0(canvas, cfg); };
  S.gradient = (ctx, h, c1, c2) => grad0(ctx, h, S.recolor(c1), S.recolor(c2));

  /* ---------- banner artwork ---------- */
  const ART = {
    detect: () => {
      const st = ['CSV', 'Impute + scale', 'Autoencoder', '5-model stack', 'Meta LR', 'Benign / Attack'];
      return `<svg viewBox="0 0 620 120" class="ra ra-detect"><defs><linearGradient id="rdL" x1="0" x2="1"><stop stop-color="#22D3EE"/><stop offset="1" stop-color="#34D399"/></linearGradient></defs>
        <line x1="40" y1="52" x2="580" y2="52" stroke="url(#rdL)" stroke-width="2" stroke-opacity=".5"/>
        ${st.map((t, i) => { const x = 40 + i * 108; return `<g><circle cx="${x}" cy="52" r="${i === 5 ? 16 : 12}" fill="#06151C" stroke="${i === 5 ? '#34D399' : '#22D3EE'}" stroke-width="2"/><circle cx="${x}" cy="52" r="4" fill="${i === 5 ? '#34D399' : '#22D3EE'}"/><text x="${x}" y="92" text-anchor="middle">${t}</text></g>`; }).join('')}
        <circle class="pk" cx="40" cy="52" r="5" fill="#E0FFF6"/><circle class="pk d2" cx="40" cy="52" r="4" fill="#8BE9F7"/></svg>`;
    },
    federated: () => {
      const cl = [[110, 40], [110, 80], [70, 25], [70, 60], [70, 95], [150, 25], [150, 60], [150, 95]];
      const pts = [[60, 20], [60, 100], [140, 15], [140, 105], [480, 20], [480, 100], [400, 15], [400, 105]];
      return `<svg viewBox="0 0 540 120" class="ra ra-fl"><defs><radialGradient id="rfG"><stop stop-color="#C4B5FD"/><stop offset=".5" stop-color="#8B5CF6" stop-opacity=".6"/><stop offset="1" stop-color="#3B82F6" stop-opacity="0"/></radialGradient></defs>
        <circle cx="270" cy="60" r="46" fill="url(#rfG)"/>
        ${pts.map(([x, y], i) => `<line x1="${x}" y1="${y}" x2="${i < 4 ? 160 : 380}" y2="60" class="up" style="animation-delay:${i * .25}s"/>`).join('')}
        <line x1="160" y1="60" x2="248" y2="60" class="up g"/><line x1="380" y1="60" x2="292" y2="60" class="up g" style="animation-delay:.6s"/>
        ${pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="#0B1236" stroke="#60A5FA" stroke-width="2"/>`).join('')}
        <circle cx="160" cy="60" r="11" fill="#140F3E" stroke="#A78BFA" stroke-width="2.4"/><circle cx="380" cy="60" r="11" fill="#140F3E" stroke="#A78BFA" stroke-width="2.4"/>
        <polygon points="270,38 289,49 289,71 270,82 251,71 251,49" fill="#1E1B4B" stroke="#E9D5FF" stroke-width="2.4"/><circle cx="270" cy="60" r="6" fill="#E9D5FF"/></svg>`;
      void cl;
    },
    swarm: () => `<div class="ra ra-radar"><span class="sweep"></span>${[[30, 40], [62, 28], [70, 62], [42, 72], [24, 58], [55, 46], [78, 40], [36, 22]].map(([x, y], i) => `<i style="left:${x}%;top:${y}%;animation-delay:${i * .45}s"></i>`).join('')}</div>`,
    attack: () => `<svg viewBox="0 0 560 120" class="ra ra-atk"><defs><linearGradient id="raL" x1="0" x2="1"><stop stop-color="#F59E0B"/><stop offset="1" stop-color="#F43F5E"/></linearGradient></defs>
        <path d="M0 70 L120 70 L140 70 L150 40 L162 100 L174 20 L186 92 L198 60 L220 70 L330 70 L344 58 L356 82 L368 70 L560 70" fill="none" stroke="url(#raL)" stroke-width="2.4" class="ecg"/>
        <g transform="translate(470 60)"><circle r="20" class="ring" fill="none" stroke="#F43F5E"/><circle r="20" class="ring r2" fill="none" stroke="#F59E0B"/>
        <path d="M0 -22 L18 -14 V2 C18 14 9 21 0 25 C-9 21 -18 14 -18 2 V-14 Z" fill="#2A0A14" stroke="#FB7185" stroke-width="2"/><path d="M0 -8 V6 M0 11 V12" stroke="#FCD34D" stroke-width="3" stroke-linecap="round"/></g></svg>`,
    xai: () => `<svg viewBox="0 0 520 120" class="ra ra-xai">${(D.xai || []).slice(0, 8).map((x, i) => { const w = Math.max(14, (x.importance / ((D.xai || [])[0]?.importance || 1)) * 300); return `<g><text x="0" y="${16 + i * 13}">${x.feature}</text><rect x="150" y="${7 + i * 13}" width="${w.toFixed(0)}" height="8" rx="4" class="bar" style="animation-delay:${i * .08}s"/></g>`; }).join('')}</svg>`,
    fleet: () => `<div class="ra ra-fleet">${['normal', 'normal', 'attack', 'training', 'normal', 'normal', 'attack', 'normal'].map((s, i) => `<span class="${S.state().uavs[i]?.status || s}">${S.droneSVG(S.COLORS[S.state().uavs[i]?.status || s], false)}<b>UAV-${S.pad(i + 1)}</b></span>`).join('')}</div>`,
    incidents: () => `<div class="ra ra-inc">${['critical', 'high', 'medium', 'low'].map((s, i) => `<div class="${s}" style="animation-delay:${i * .12}s"><i></i><b></b><em></em></div>`).join('')}</div>`,
    research: () => { const R = D.centralTest || []; return `<svg viewBox="0 0 520 120" class="ra ra-res"><defs><linearGradient id="rrL" x1="0" x2="1"><stop stop-color="#818CF8"/><stop offset="1" stop-color="#E879F9"/></linearGradient></defs>
        ${[20, 50, 80, 110].map((y) => `<line x1="30" y1="${y}" x2="510" y2="${y}" stroke="#818CF8" stroke-opacity=".12"/>`).join('')}
        <path d="M30 98 C110 90 140 60 210 58 S330 30 400 26 S480 14 510 12" fill="none" stroke="url(#rrL)" stroke-width="2.6" class="draw"/>
        ${R.slice(0, 4).map((r, i) => `<g><rect x="${60 + i * 120}" y="${110 - (r.macroF1 || 0) * 100}" width="34" height="${(r.macroF1 || 0) * 100}" rx="5" fill="#818CF8" fill-opacity="${.25 + i * .1}"/></g>`).join('')}
        ${[[210, 58], [400, 26], [510, 12]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.5" fill="#F5D0FE"/>`).join('')}</svg>`; },
    about: () => `<svg viewBox="0 0 520 110" class="ra ra-about">${['Proposal', 'Dataset', 'Baselines', 'Federated', 'Hybrid', 'Platform'].map((t, i) => `<g><circle cx="${40 + i * 88}" cy="46" r="${i === 5 ? 9 : 7}" fill="${i === 5 ? '#C4B5FD' : '#0F172A'}" stroke="#C4B5FD" stroke-width="2"/><text x="${40 + i * 88}" y="80" text-anchor="middle">${t}</text></g>`).join('')}<line x1="47" y1="46" x2="473" y2="46" stroke="#94A3B8" stroke-opacity=".5" stroke-dasharray="3 5"/></svg>`,
  };

  const ROOMS = {
    swarm: { n: '01', name: 'Aerospace Mission Control', icon: 'orbit', facts: () => ['8 UAVs · 2 clusters', 'Three.js digital twin', 'Drag · zoom · inspect'] },
    attack: { n: '02', name: 'Cyber Defense Laboratory', icon: 'zap', facts: () => ['DoS · Replay · Mixed · Recovery', 'Scripted, illustrative threats', 'No real packets sent'] },
    detect: { n: '03', name: 'AI Diagnostic Laboratory', icon: 'scan-search', facts: () => [`Hybrid AE-Stack · acc ${pct(HM.accuracy, 2)}`, `ROC AUC ${pct(HM.auc, 2)}`, 'Random Forest baseline'] },
    federated: { n: '04', name: 'Distributed AI Research Lab', icon: 'network', facts: () => [`${D.config?.n_clients || 8} clients · ${D.config?.n_clusters || 2} clusters`, `${(D.federatedRounds || []).length} rounds · Dirichlet α ${D.config?.dirichlet_alpha}`, `FL macro F1 ${pct(D.federatedTest?.macroF1)}`] },
    xai: { n: '05', name: 'AI Interpretation Studio', icon: 'brain-circuit', facts: () => ['Permutation importance (implemented)', `Top feature: ${(D.xai || [])[0]?.feature || '—'}`, 'SHAP = future work'] },
    fleet: { n: '06', name: 'UAV Operations Center', icon: 'radar', facts: () => ['8 fleet cards · live status', 'Click a UAV for details', 'Telemetry is simulated'] },
    incidents: { n: '07', name: 'Security Operations Center', icon: 'siren', facts: () => ['Incident queue · severity', 'Filters · CSV export', 'Simulation-generated'] },
    research: { n: '08', name: 'Scientific Research Platform', icon: 'flask-conical', facts: () => [`${num(D.dataAudit?.final_rows || 0)} labelled rows`, `${(D.centralTest || []).length} centralized models`, 'Recorded experiment outputs'] },
    about: { n: '10', name: 'About & Documentation', icon: 'book-open', facts: () => ['BSIT FYP · Bahria University', 'Supervisor: Ms. Munaza Sher', `Team of ${S.TEAM.length}`] },
  };
  S.roomBanner = (key) => {
    const r = ROOMS[key]; if (!r) return '';
    return `<section class="room room-${key}" aria-label="${S.esc(r.name)}">
      <div class="room-t"><span class="room-k"><i data-lucide="${r.icon}"></i>Room ${r.n} · ${r.name}</span>
        <div class="room-f">${r.facts().map((f) => `<span>${S.esc(f)}</span>`).join('')}</div></div>
      <div class="room-art" aria-hidden="true">${ART[key] ? ART[key]() : ''}</div></section>`;
  };
})();
