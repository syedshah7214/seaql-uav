/* SEAQL — 2D glowing swarm topology (SVG). Used on the Command Center and as
   the WebGL fallback for the 3D digital twin. Reads the shared simulation state. */
(function () {
  'use strict';
  const W = 900, H = 430, CX = 450, CY = 212;
  const HUB = { A: [258, 212], B: [642, 212] };
  // Cluster A = clients 0,2,4,6 ; Cluster B = 1,3,5,7 (cluster_map in uav_fl_project.py)
  const POS = {};
  const ang = { A: [128, 162, 198, 232], B: [52, 18, -18, -52] };
  ['A', 'B'].forEach((c) => (S.data.clusterMap || [[0, 2, 4, 6], [1, 3, 5, 7]])[c === 'A' ? 0 : 1].forEach((idx, k) => {
    const a = (ang[c][k] * Math.PI) / 180;
    POS[idx] = [CX + Math.cos(a) * 365, CY - Math.sin(a) * 158];
  }));

  function drone(color, spin) {
    const sp = spin && !S.reduced ? 'spin' : '';
    return `<g class="float">
      <ellipse cx="0" cy="2" rx="40" ry="22" fill="${color}" opacity=".16" filter="url(#blur8)"/>
      <g stroke="${color}" stroke-width="2.6" stroke-linecap="round"><path d="M0 0 L-19 -11 M0 0 L19 -11 M0 0 L-17 11 M0 0 L17 11"/></g>
      <g fill="none" stroke="${color}" stroke-width="1.8"><ellipse class="${sp}" cx="-20" cy="-12" rx="11" ry="3.4"/><ellipse class="${sp}" cx="20" cy="-12" rx="11" ry="3.4"/><ellipse class="${sp}" cx="-18" cy="12" rx="11" ry="3.4"/><ellipse class="${sp}" cx="18" cy="12" rx="11" ry="3.4"/></g>
      <rect x="-9" y="-6.5" width="18" height="13" rx="4" fill="#0A1228" stroke="${color}" stroke-width="2"/>
      <circle r="3" fill="${color}"/>
    </g>`;
  }

  S.topology = function (host, opts = {}) {
    host.innerHTML = `<svg class="net" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="UAV swarm network topology">
      <defs>
        <filter id="glow" filterUnits="userSpaceOnUse" x="-50" y="-50" width="1000" height="530"><feGaussianBlur stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="blur8"><feGaussianBlur stdDeviation="8"/></filter>
        <radialGradient id="aggGlow"><stop offset="0" stop-color="#22D3EE" stop-opacity=".55"/><stop offset="1" stop-color="#22D3EE" stop-opacity="0"/></radialGradient>
        <linearGradient id="cubeTop" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#8BE9F7"/><stop offset="1" stop-color="#22D3EE"/></linearGradient>
      </defs>
      <g id="tpLinks"></g><g id="tpPackets"></g>
      <g id="tpHubs"></g>
      <g transform="translate(${CX} ${CY})" id="tpAgg"></g>
      <g id="tpNodes"></g>
    </svg><div class="topo-tip" id="tpTip"></div>`;
    const svg = host.querySelector('svg');
    const tip = host.querySelector('#tpTip');

    // aggregator (isometric cube)
    host.querySelector('#tpAgg').innerHTML = `
      <circle r="92" fill="url(#aggGlow)"/>
      <ellipse rx="64" ry="20" cy="40" fill="none" stroke="#22D3EE" stroke-opacity=".35" stroke-width="1.4"/>
      <ellipse rx="44" ry="13" cy="40" fill="none" stroke="#22D3EE" stroke-opacity=".55" stroke-width="1.4" ${S.reduced ? '' : 'class="pulse-ring"'}/>
      <g filter="url(#glow)">
        <path d="M0 -38 L33 -20 L0 -2 L-33 -20 Z" fill="url(#cubeTop)"/>
        <path d="M-33 -20 L0 -2 L0 36 L-33 18 Z" fill="#0A6FD8"/>
        <path d="M33 -20 L0 -2 L0 36 L33 18 Z" fill="#0791E8"/>
        <g stroke="#CFF7FD" stroke-opacity=".7" stroke-width="1"><path d="M-22 -2 L-22 24 M-11 4 L-11 30 M22 -2 L22 24 M11 4 L11 30"/><path d="M-22 -26 L11 -8 M-11 -32 L22 -14"/></g>
      </g>
      <text y="66" text-anchor="middle" fill="#F5F9FF" font-size="13" font-weight="700" font-family="Inter">Global Aggregator</text>`;

    host.querySelector('#tpHubs').innerHTML = ['A', 'B'].map((c) => {
      const [x, y] = HUB[c]; const col = c === 'A' ? '#22D3EE' : '#8B5CF6';
      return `<g transform="translate(${x} ${y})"><circle r="17" fill="#0A1228" stroke="${col}" stroke-width="1.8" filter="url(#glow)"/>
        <path d="M0 -8 L7 -4 L7 4 L0 8 L-7 4 L-7 -4 Z" fill="${col}" opacity=".9"/>
        <text y="34" text-anchor="middle" fill="${col}" font-size="11" font-weight="700" font-family="Inter">Cluster ${c}</text></g>`;
    }).join('');

    let lastKey = '';
    function render(st) {
      const key = st.uavs.map((u) => u.status).join(',') + '|' + st.running;
      // live tooltip numbers update every tick; geometry only when statuses change
      if (tip.dataset.idx) fillTip(st.uavs[+tip.dataset.idx]);
      if (key === lastKey) return; lastKey = key;
      const links = [], packets = [];
      ['A', 'B'].forEach((c) => {
        const [hx, hy] = HUB[c];
        const anyAttack = st.uavs.some((u) => u.cluster === c && (u.status === 'attack'));
        const col = anyAttack ? '#FF5A76' : '#22D3EE';
        links.push(`<path id="tpL${c}" class="link ${S.reduced ? '' : 'flow'}" d="M${hx} ${hy} L${CX} ${CY}" stroke="${col}" stroke-opacity=".75" filter="url(#glow)"/>`);
        if (st.running && !S.reduced) packets.push(pk(`tpL${c}`, col, 1.6, 0), pk(`tpL${c}`, col, 1.6, 0.8));
      });
      st.uavs.forEach((u) => {
        const [x, y] = POS[u.idx]; const [hx, hy] = HUB[u.cluster];
        const col = S.COLORS[u.status];
        const d = `M${x.toFixed(1)} ${y.toFixed(1)} L${hx} ${hy}`;
        links.push(`<path id="tpP${u.idx}" class="link ${S.reduced ? '' : 'flow'}" d="${d}" stroke="${u.status === 'normal' ? '#22D3EE' : col}" stroke-opacity="${u.status === 'normal' ? .55 : .85}" filter="url(#glow)"/>`);
        if (st.running && !S.reduced) {
          const n = u.status === 'attack' && u.attackType === 'DoS' ? 5 : 2;
          for (let i = 0; i < n; i++) packets.push(pk(`tpP${u.idx}`, u.status === 'normal' || u.status === 'training' ? '#8BE9F7' : col, n > 2 ? 0.9 : 2.2, (i * (n > 2 ? 0.9 : 2.2)) / n));
        }
      });
      // intra-cluster mesh (neighbouring drones)
      ['A', 'B'].forEach((c, ci) => {
        const ids = (S.data.clusterMap || [[0, 2, 4, 6], [1, 3, 5, 7]])[ci];
        for (let k = 0; k < ids.length - 1; k++) {
          const [x1, y1] = POS[ids[k]], [x2, y2] = POS[ids[k + 1]];
          links.push(`<path class="link" d="M${x1} ${y1} L${x2} ${y2}" stroke="${c === 'A' ? '#22D3EE' : '#8B5CF6'}" stroke-opacity=".18" stroke-dasharray="2 6"/>`);
        }
      });
      svg.querySelector('#tpLinks').innerHTML = links.join('');
      svg.querySelector('#tpPackets').innerHTML = packets.join('');
      svg.querySelector('#tpNodes').innerHTML = st.uavs.map((u) => {
        const [x, y] = POS[u.idx]; const col = S.COLORS[u.status];
        const ring = u.status === 'attack' || u.status === 'suspicious'
          ? `<circle r="30" fill="none" stroke="${col}" stroke-width="2" ${S.reduced ? '' : 'class="pulse-ring"'}/>` : '';
        return `<g class="node" data-idx="${u.idx}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(1.25)" tabindex="0" role="button" aria-label="${u.id}, cluster ${u.cluster}, ${u.status}">
          ${ring}<circle class="halo" r="34" fill="transparent"/>
          ${drone(col, st.running)}
          <text y="42" text-anchor="middle" fill="${u.status === 'normal' ? '#F5F9FF' : col}" font-size="12" font-weight="700" font-family="JetBrains Mono">${u.id}</text></g>`;
      }).join('');
    }
    function pk(path, color, dur, begin) {
      return `<circle r="3.2" fill="${color}" filter="url(#glow)"><animateMotion dur="${dur}s" begin="${begin.toFixed(2)}s" repeatCount="indefinite"><mpath href="#${path}"/></animateMotion></circle>`;
    }
    function fillTip(u) {
      tip.innerHTML = `<b style="font-family:var(--mono)">${u.id}</b> <span class="status-badge ${u.status}" style="margin-left:6px">${label(u.status)}</span>
        <div class="kv" style="margin-top:8px;font-size:12px"><dt>Cluster</dt><dd>${u.cluster}</dd><dt>Traffic</dt><dd>${S.num(u.rate)} pkt/s</dd><dt>Last seen</dt><dd>${S.time(u.lastSeen)}</dd></div>
        <div class="muted" style="margin-top:6px;font-size:10.5px">Simulated values · click for details</div>`;
    }
    const label = S.statusLabel;
    function showTip(g) {
      const idx = +g.dataset.idx; tip.dataset.idx = idx; fillTip(S.state().uavs[idx]);
      const r = host.getBoundingClientRect(), b = g.getBoundingClientRect();
      let left = b.left - r.left + b.width / 2 + 18, top = b.top - r.top - 10;
      if (left + 190 > r.width) left = b.left - r.left - 200;
      tip.style.left = Math.max(6, left) + 'px'; tip.style.top = Math.max(6, Math.min(top, r.height - 130)) + 'px';
      tip.classList.add('show');
    }
    function hideTip() { tip.classList.remove('show'); delete tip.dataset.idx; }
    svg.addEventListener('mouseover', (e) => { const g = e.target.closest('.node'); if (g) showTip(g); });
    svg.addEventListener('mouseout', (e) => { const g = e.target.closest('.node'); if (g && !g.contains(e.relatedTarget)) hideTip(); });
    svg.addEventListener('focusin', (e) => { const g = e.target.closest('.node'); if (g) showTip(g); });
    svg.addEventListener('focusout', hideTip);
    const pick = (e) => { const g = e.target.closest('.node'); if (g && opts.onSelect) { hideTip(); opts.onSelect(+g.dataset.idx); } };
    svg.addEventListener('click', pick);
    svg.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(e); } });

    render(S.state());
    const unsub = S.subscribe(render);
    return { destroy: unsub };
  };
})();
