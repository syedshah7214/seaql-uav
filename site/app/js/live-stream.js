/* SEAQL — Live Detection Stream (frontend, no backend needed).
 * Continuously REPLAYS the saved Hybrid model's real held-out predictions (app/data/heldout-stream.js):
 * packets flow through the pipeline, counters tick, a rolling chart moves and a terminal log scrolls.
 * Nothing is invented: every row shown is a real prediction recorded on the held-out test set. */
(function () {
  'use strict';
  const CSS = `
  .ls{position:relative;border-radius:18px;padding:16px 18px;border:1px solid rgba(34,211,238,.28);overflow:hidden;
    background:radial-gradient(700px 220px at 0% 0%,rgba(34,211,238,.12),transparent 70%),radial-gradient(600px 240px at 100% 100%,rgba(16,185,129,.12),transparent 70%),linear-gradient(180deg,rgba(10,26,48,.92),rgba(8,16,34,.95));
    box-shadow:0 0 0 1px rgba(52,211,153,.06),0 20px 50px -28px rgba(34,211,238,.55);margin-bottom:16px}
  .ls::before{content:"";position:absolute;left:22px;right:22px;top:0;height:1px;background:linear-gradient(90deg,transparent,#22D3EE,#34D399,transparent)}
  .ls-hd{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
  .ls-k{font-family:var(--mono,ui-monospace),monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#5EEAD4;display:flex;align-items:center;gap:8px;font-weight:600}
  .ls-live{width:8px;height:8px;border-radius:50%;background:#FF5A76;box-shadow:0 0 10px #FF5A76;animation:lsbl 1.2s infinite}
  @keyframes lsbl{50%{opacity:.25}}
  .ls-sub{font-size:12px;color:var(--text-3,#7186A8);margin-top:3px}
  .ls-ctl{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
  .ls-ctl button{font:600 11.5px inherit;font-family:inherit;color:var(--text-2,#AEBBD3);background:rgba(13,22,46,.85);border:1px solid rgba(125,160,235,.28);border-radius:8px;padding:5px 10px;cursor:pointer}
  .ls-ctl button.on{color:#fff;border-color:rgba(52,211,153,.7);background:linear-gradient(135deg,rgba(34,211,238,.25),rgba(52,211,153,.2))}
  .ls-tag{font-family:var(--mono,ui-monospace),monospace;font-size:10px;font-weight:700;letter-spacing:.08em;color:#FBBF24;border:1px solid rgba(251,191,36,.45);background:rgba(251,191,36,.08);padding:3px 8px;border-radius:99px}
  .ls canvas{display:block;width:100%}
  .ls-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:12px;margin-top:10px}
  .ls-box{border:1px solid var(--line,rgba(120,150,220,.16));border-radius:14px;background:rgba(9,18,38,.65);padding:10px 12px;min-width:0}
  .ls-bt{display:flex;justify-content:space-between;gap:8px;font-family:var(--mono,ui-monospace),monospace;font-size:10.5px;color:var(--text-3,#7186A8);letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px}
  .ls-log{height:190px;overflow:hidden;font-family:var(--mono,ui-monospace),monospace;font-size:11.5px;line-height:1.6;color:var(--text-2,#AEBBD3);display:flex;flex-direction:column;justify-content:flex-end;
    -webkit-mask-image:linear-gradient(180deg,transparent,#000 22%);mask-image:linear-gradient(180deg,transparent,#000 22%)}
  .ls-log div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ls-log .tm{color:#7186A8}.ls-log .b{color:#34D399}.ls-log .a{color:#FF5A76}.ls-log .ok{color:#5EEAD4}.ls-log .x{color:#FBBF24}
  .ls-stats{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-top:10px}
  .ls-st{border:1px solid var(--line,rgba(120,150,220,.16));border-radius:12px;padding:8px 10px;background:rgba(13,24,48,.7);position:relative;overflow:hidden}
  .ls-st::before{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:var(--c);box-shadow:0 0 10px var(--c)}
  .ls-st b{display:block;font-size:19px;font-weight:800;letter-spacing:-.01em;margin-top:2px;color:var(--text,#F5F9FF)}
  .ls-st span{font-family:var(--mono,ui-monospace),monospace;font-size:9.5px;color:#7186A8;letter-spacing:.1em;text-transform:uppercase}
  @media(max-width:860px){.ls-grid{grid-template-columns:minmax(0,1fr)}.ls-stats{grid-template-columns:repeat(3,minmax(0,1fr))}}`;

  function injectCss() { if (document.getElementById('lsCss')) return; const s = document.createElement('style'); s.id = 'lsCss'; s.textContent = CSS; document.head.appendChild(s); }
  const TRUE = ['benign', 'DoS attack', 'Replay'];
  const NODES = ['CSV row', 'Checks', 'Impute + scale', 'Autoencoder', '5-model stack', 'Decision'];
  const DESC = [null, '32 packet features', 'impute · RobustScaler', 'MSE + latent vector', 'RF · XGB · LGBM · ET · MLP', null];
  const RED = '#FF5A76', EM = '#34D399', CY = '#22D3EE', VI = '#A78BFA';
  const fmt = (n) => n.toLocaleString('en-US');

  // Mounts the stream into `host`; returns a stop() function. Stops by itself when host leaves the DOM.
  S.liveStream = function (host, opts = {}) {
    injectCss();
    const src = window.SEAQL_STREAM;
    if (!src || !src.rows || !src.rows.length) { host.innerHTML = ''; return () => {}; }
    // shuffle order once (deterministic) so attacks and benign rows interleave like live traffic
    const R = src.rows.slice(); let seed = 42; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let i = R.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [R[i], R[j]] = [R[j], R[i]]; }
    const N = R.length, reduce = !!S.reduced;
    host.innerHTML = `<article class="ls" aria-label="Live detection stream">
      <div class="ls-hd"><div><div class="ls-k"><span class="ls-live"></span>Live detection stream</div>
        <div class="ls-sub">${opts.subtitle || 'Replaying the saved Hybrid model’s real held-out predictions (6,621 rows) through the pipeline — loops continuously'}</div></div>
        <div class="ls-ctl"><span class="ls-tag">REPLAY · REAL MODEL OUTPUT</span><button data-a="pp">❚❚ Pause</button><button data-s="1" class="on">1×</button><button data-s="3">3×</button><button data-s="8">8×</button></div></div>
      <canvas data-c="pipe" height="168"></canvas>
      <div class="ls-grid">
        <div class="ls-box"><div class="ls-bt"><span>Rolling attack rate · mean confidence</span><span>last 60 windows</span></div><canvas data-c="chart" height="190"></canvas></div>
        <div class="ls-box"><div class="ls-bt"><span>$ tail -f detection.log</span><span data-v="loop">replay #1</span></div><div class="ls-log" data-v="log"></div></div>
      </div>
      <div class="ls-stats">
        <div class="ls-st" style="--c:${CY}"><span>processed</span><b data-v="p">0</b></div>
        <div class="ls-st" style="--c:${EM}"><span>benign</span><b data-v="b">0</b></div>
        <div class="ls-st" style="--c:${RED}"><span>attack</span><b data-v="a">0</b></div>
        <div class="ls-st" style="--c:#8B5CF6"><span>mean conf.</span><b data-v="c">—</b></div>
        <div class="ls-st" style="--c:#5EEAD4"><span>accuracy so far</span><b data-v="k">—</b></div>
        <div class="ls-st" style="--c:#FBBF24"><span>rows / s</span><b data-v="r">0</b></div>
      </div></article>`;
    const q = (s) => host.querySelector(s), V = (k) => q(`[data-v="${k}"]`);
    const cvP = q('[data-c="pipe"]'), cvC = q('[data-c="chart"]');
    let speed = 1, paused = false, idx = 0, loop = 1, lastT = performance.now(), acc = 0, raf = 0, alive = true;
    let St = { p: 0, b: 0, a: 0, conf: 0, cor: 0 }, win = [], cur = { n: 0, a: 0, c: 0 }, tokens = [], rps = [];
    host.querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => { speed = +b.dataset.s; host.querySelectorAll('[data-s]').forEach((x) => x.classList.toggle('on', x === b)); }));
    q('[data-a="pp"]').onclick = (e) => { paused = !paused; e.currentTarget.textContent = paused ? '▶ Play' : '❚❚ Pause'; };

    function fit(c) { const r = c.getBoundingClientRect(), d = window.devicePixelRatio || 1, h = +c.getAttribute('height'); c.width = Math.max(1, r.width * d); c.height = h * d; c.style.height = h + 'px'; const x = c.getContext('2d'); x.setTransform(d, 0, 0, d, 0, 0); return x; }
    let px = fit(cvP), cx = fit(cvC);
    const onResize = () => { px = fit(cvP); cx = fit(cvC); };
    window.addEventListener('resize', onResize);
    const W = () => cvP.getBoundingClientRect().width;
    const nodeX = (i) => { const w = W(); return 46 + i * (w - 46 - (w < 600 ? 120 : 190)) / 5; };

    function logLine(r) {
      const att = r[2] === 1, tr = TRUE[r[1]], trueAtt = r[1] !== 0, conf = att ? r[3] : 1 - r[3];
      const ok = trueAtt === att ? '<span class="ok">✓ match</span>' : `<span class="x">✗ true ${tr}</span>`;
      const el = document.createElement('div');
      el.innerHTML = `<span class="tm">${new Date().toTimeString().slice(0, 8)}</span> pkt ${String(r[0]).padStart(5, ' ')} → <span class="${att ? 'a' : 'b'}">${att ? 'ATTACK' : 'BENIGN'}</span> · conf ${(conf * 100).toFixed(1)}% ${ok}`;
      const L = V('log'); L.appendChild(el); while (L.children.length > 15) L.removeChild(L.firstChild);
    }
    function step() {
      const r = R[idx], att = r[2] === 1, conf = att ? r[3] : 1 - r[3];
      tokens.push({ x: 0, att }); if (tokens.length > 90) tokens.shift();
      St.p++; att ? St.a++ : St.b++; St.conf += conf; if ((r[1] !== 0) === att) St.cor++;
      cur.n++; if (att) cur.a++; cur.c += conf;
      if (cur.n >= 24) { win.push({ a: cur.a / cur.n, c: cur.c / cur.n }); if (win.length > 60) win.shift(); cur = { n: 0, a: 0, c: 0 }; }
      if (speed < 3 || St.p % 3 === 0) logLine(r);
      if (++idx >= N) { idx = 0; loop++; V('loop').textContent = 'replay #' + loop; St = { p: 0, b: 0, a: 0, conf: 0, cor: 0 }; }
    }
    function drawPipe(t) {
      const c = px, w = W(), y = 66; c.clearRect(0, 0, w, 168);
      const g = c.createLinearGradient(nodeX(0), 0, nodeX(5), 0); g.addColorStop(0, 'rgba(34,211,238,.35)'); g.addColorStop(1, 'rgba(52,211,153,.45)');
      c.strokeStyle = g; c.lineWidth = 2; c.beginPath(); c.moveTo(nodeX(0), y); c.lineTo(nodeX(5), y); c.stroke();
      c.strokeStyle = 'rgba(52,211,153,.35)'; c.beginPath(); c.moveTo(nodeX(5), y); c.lineTo(w - 24, y - 38); c.stroke();
      c.strokeStyle = 'rgba(255,90,118,.35)'; c.beginPath(); c.moveTo(nodeX(5), y); c.lineTo(w - 24, y + 38); c.stroke();
      for (const k of tokens) {
        if (!paused) k.x = Math.min(1.12, k.x + (reduce ? 0.06 : 0.026) * speed);
        let X, Y; if (k.x <= 1) { X = nodeX(0) + (nodeX(5) - nodeX(0)) * k.x; Y = y; } else { const f = (k.x - 1) / 0.12; X = nodeX(5) + (w - 24 - nodeX(5)) * f; Y = y + (k.att ? 38 : -38) * f; }
        const col = k.x > 0.82 ? (k.att ? RED : EM) : CY;
        c.fillStyle = col; c.shadowColor = col; c.shadowBlur = 10; c.beginPath(); c.arc(X, Y, 3.2, 0, 7); c.fill(); c.shadowBlur = 0;
      }
      tokens = tokens.filter((k) => k.x < 1.12);
      NODES.forEach((n, i) => {
        const X = nodeX(i), p = reduce ? 0 : (Math.sin(t / 400 + i) + 1) / 2, col = i === 5 ? EM : CY;
        c.fillStyle = 'rgba(8,30,44,.95)'; c.strokeStyle = col; c.lineWidth = 1.6; c.shadowColor = col; c.shadowBlur = 10 + p * 10;
        c.beginPath(); c.arc(X, y, 17, 0, 7); c.fill(); c.stroke(); c.shadowBlur = 0;
        c.fillStyle = col; c.beginPath(); c.arc(X, y, 4 + p * 1.5, 0, 7); c.fill();
        c.textAlign = 'center'; c.fillStyle = '#AEBBD3'; c.font = '600 10.5px "JetBrains Mono", monospace'; c.fillText(n, X, y + 36);
        if (i === 0 || i === 5) { c.fillStyle = '#F5F9FF'; c.font = '700 11px Inter, sans-serif'; c.fillText(fmt(St.p) + (i ? ' decided' : ' rows read'), X, y + 52); }
        else if (w > 700) { c.fillStyle = '#7186A8'; c.font = '10px Inter, sans-serif'; c.fillText(DESC[i], X, y + 52); }
      });
      c.textAlign = 'right'; c.font = '800 13px Inter, sans-serif';
      c.fillStyle = EM; c.fillText('BENIGN ' + fmt(St.b), w - 8, y - 48);
      c.fillStyle = RED; c.fillText('ATTACK ' + fmt(St.a), w - 8, y + 60);
    }
    function drawChart() {
      const c = cx, w = cvC.getBoundingClientRect().width, h = 190, pl = 32, pb = 14; c.clearRect(0, 0, w, h);
      c.strokeStyle = 'rgba(120,150,220,.12)'; c.fillStyle = '#7186A8'; c.font = '10px "JetBrains Mono", monospace'; c.textAlign = 'right';
      [0, 0.5, 1].forEach((v) => { const Y = h - pb - v * (h - pb - 22); c.beginPath(); c.moveTo(pl, Y); c.lineTo(w, Y); c.stroke(); c.fillText(v * 100 + '%', pl - 4, Y + 3); });
      if (win.length < 2) return;
      const X = (i) => pl + (i + (60 - win.length)) * (w - pl - 6) / 59, Yv = (v) => h - pb - v * (h - pb - 22);
      const path = (k) => { c.beginPath(); win.forEach((p, i) => (i ? c.lineTo(X(i), Yv(p[k])) : c.moveTo(X(i), Yv(p[k])))); };
      path('a'); c.lineTo(X(win.length - 1), h - pb); c.lineTo(X(0), h - pb); c.closePath();
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,90,118,.30)'); g.addColorStop(1, 'rgba(255,90,118,0)'); c.fillStyle = g; c.fill();
      [['a', RED], ['c', VI]].forEach(([k, col]) => { path(k); c.strokeStyle = col; c.lineWidth = 2; c.shadowColor = col; c.shadowBlur = 8; c.stroke(); c.shadowBlur = 0;
        const L = win[win.length - 1]; c.fillStyle = col; c.beginPath(); c.arc(X(win.length - 1), Yv(L[k]), 3.5, 0, 7); c.fill(); });
      const L = win[win.length - 1]; c.textAlign = 'left'; c.font = '600 10.5px Inter, sans-serif';
      c.fillStyle = RED; c.fillText('● attack rate ' + (L.a * 100).toFixed(0) + '%', pl + 6, 11);
      c.fillStyle = VI; c.fillText('● mean confidence ' + (L.c * 100).toFixed(0) + '%', pl + 130, 11);
    }
    function stats(r) {
      V('p').textContent = fmt(St.p); V('b').textContent = fmt(St.b); V('a').textContent = fmt(St.a);
      V('c').textContent = St.p ? (St.conf / St.p * 100).toFixed(1) + '%' : '—';
      V('k').textContent = St.p ? (St.cor / St.p * 100).toFixed(1) + '%' : '—';
      V('r').textContent = r.toFixed(0);
    }
    function frame(t) {
      if (!alive) return;
      if (!host.isConnected) { stop(); return; }
      const dt = Math.min(100, t - lastT); lastT = t;
      if (!paused) { acc += dt * speed * (22 / 1000); let n = 0; while (acc >= 1 && n < 400) { step(); acc -= 1; n++; } rps.push([t, n]); }
      while (rps.length && t - rps[0][0] > 1000) rps.shift();
      if (!document.hidden) { drawPipe(t); drawChart(); stats(rps.reduce((s, x) => s + x[1], 0)); }
      raf = requestAnimationFrame(frame);
    }
    function stop() { alive = false; cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); }
    // pre-warm: replay the first windows instantly so the chart is full from the first frame
    const quiet = speed; speed = 9; for (let i = 0; i < 60 * 24; i++) step(); speed = quiet;
    St = { p: 0, b: 0, a: 0, conf: 0, cor: 0 }; tokens = [];
    raf = requestAnimationFrame(frame);
    return stop;
  };
})();
