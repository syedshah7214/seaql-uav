"""SEAQL - "Live Detection Stream" component for the Streamlit Detection Lab.

Continuously REPLAYS the real per-row predictions the model just produced (it does not
invent data): packets flow through the detection pipeline, counters tick, a rolling chart
moves and a terminal-style log scrolls. When the file ends the replay loops.
Pure HTML/CSS/JS (canvas), no external libraries.
"""
from __future__ import annotations

import json

LIVE_HTML = r"""
<!doctype html><html><head><meta charset="utf-8">
<style>
:root{--cyan:#22D3EE;--em:#34D399;--red:#FF5A76;--amber:#FBBF24;--vio:#8B5CF6;--t:#F5F9FF;--t2:#AEBBD3;--t3:#7186A8;--line:rgba(120,150,220,.16)}
*{box-sizing:border-box}html,body{margin:0;background:transparent;color:var(--t);font-family:Inter,system-ui,sans-serif}
.wrap{position:relative;border-radius:18px;padding:16px 18px;border:1px solid rgba(34,211,238,.28);
 background:radial-gradient(700px 220px at 0% 0%,rgba(34,211,238,.12),transparent 70%),radial-gradient(600px 240px at 100% 100%,rgba(16,185,129,.12),transparent 70%),linear-gradient(180deg,rgba(10,26,48,.92),rgba(8,16,34,.95));
 box-shadow:0 0 0 1px rgba(52,211,153,.06),0 20px 50px -28px rgba(34,211,238,.55);overflow:hidden}
.wrap::before{content:"";position:absolute;left:22px;right:22px;top:0;height:1px;background:linear-gradient(90deg,transparent,var(--cyan),var(--em),transparent)}
.hd{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.k{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#5EEAD4;display:flex;align-items:center;gap:8px}
.live{width:8px;height:8px;border-radius:50%;background:var(--red);box-shadow:0 0 10px var(--red);animation:bl 1.2s infinite}
@keyframes bl{50%{opacity:.25}}
.sub{font-size:11.5px;color:var(--t3);margin-top:3px}
.ctl{display:flex;gap:6px;align-items:center}
.ctl button{font:600 11.5px Inter,sans-serif;color:var(--t2);background:rgba(13,22,46,.85);border:1px solid rgba(125,160,235,.28);border-radius:8px;padding:5px 10px;cursor:pointer}
.ctl button.on{color:#fff;border-color:rgba(52,211,153,.7);background:linear-gradient(135deg,rgba(34,211,238,.25),rgba(52,211,153,.2))}
.tag{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;letter-spacing:.08em;color:var(--amber);border:1px solid rgba(251,191,36,.45);background:rgba(251,191,36,.08);padding:3px 8px;border-radius:99px}
canvas{display:block;width:100%}
.grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:12px;margin-top:10px}
.box{border:1px solid var(--line);border-radius:14px;background:rgba(9,18,38,.65);padding:10px 12px;min-width:0}
.bt{display:flex;justify-content:space-between;font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--t3);letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px}
.log{height:178px;overflow:hidden;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11.5px;line-height:1.55;color:var(--t2);
 -webkit-mask-image:linear-gradient(180deg,transparent,#000 22%);mask-image:linear-gradient(180deg,transparent,#000 22%);display:flex;flex-direction:column;justify-content:flex-end}
.log div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.log .tm{color:var(--t3)}.log .b{color:var(--em)}.log .a{color:var(--red)}.log .ok{color:#5EEAD4}.log .x{color:var(--amber)}
.stats{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-top:10px}
.st{border:1px solid var(--line);border-radius:12px;padding:8px 10px;background:rgba(13,24,48,.7);position:relative;overflow:hidden}
.st::before{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:var(--c,var(--cyan));box-shadow:0 0 10px var(--c,var(--cyan))}
.st b{display:block;font-size:19px;font-weight:800;letter-spacing:-.01em;margin-top:2px}
.st span{font-family:'JetBrains Mono',monospace;font-size:9.5px;color:var(--t3);letter-spacing:.1em;text-transform:uppercase}
@media(max-width:760px){.grid{grid-template-columns:1fr}.stats{grid-template-columns:repeat(3,minmax(0,1fr))}}
</style></head><body>
<div class="wrap">
 <div class="hd"><div><div class="k"><span class="live"></span>Live detection stream</div>
   <div class="sub">Replaying this file's real per-row predictions through the pipeline — loops continuously</div></div>
  <div class="ctl"><span class="tag">REPLAY · REAL MODEL OUTPUT</span><button id="pp">❚❚ Pause</button><button data-s="1" class="on">1×</button><button data-s="3">3×</button><button data-s="8">8×</button></div></div>
 <canvas id="pipe" height="168"></canvas>
 <div class="grid">
  <div class="box"><div class="bt"><span>Rolling attack rate · mean confidence</span><span id="win">last 60 windows</span></div><canvas id="chart" height="178"></canvas></div>
  <div class="box"><div class="bt"><span>$ tail -f detection.log</span><span id="loop">replay #1</span></div><div class="log" id="log"></div></div>
 </div>
 <div class="stats">
  <div class="st" style="--c:var(--cyan)"><span>processed</span><b id="sP">0</b></div>
  <div class="st" style="--c:var(--em)"><span>benign</span><b id="sB">0</b></div>
  <div class="st" style="--c:var(--red)"><span>attack</span><b id="sA">0</b></div>
  <div class="st" style="--c:var(--vio)"><span>mean conf.</span><b id="sC">—</b></div>
  <div class="st" style="--c:#5EEAD4"><span>accuracy so far</span><b id="sK">—</b></div>
  <div class="st" style="--c:var(--amber)"><span>rows / s</span><b id="sR">0</b></div>
 </div>
</div>
<script>
const D = __DATA__;
const R = D.rows, N = R.length, RED='#FF5A76', EM='#34D399', CY='#22D3EE', AM='#FBBF24';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isAtt = (p) => p !== 'benign';
const NODES = ['CSV row','Checks','Impute + scale','Autoencoder','5-model stack','Decision'];
let speed = 1, paused = false, idx = 0, loop = 1, lastT = performance.now(), acc = 0;
let S = {p:0,b:0,a:0,conf:0,lab:0,cor:0}, win = [], cur = {n:0,a:0,c:0}, tokens = [], nodeCount = new Array(6).fill(0), rateHist = [];
const fmt = (n) => n.toLocaleString('en-US');
const $ = (id) => document.getElementById(id);
document.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { speed = +b.dataset.s; document.querySelectorAll('[data-s]').forEach(x => x.classList.toggle('on', x === b)); });
$('pp').onclick = () => { paused = !paused; $('pp').textContent = paused ? '▶ Play' : '❚❚ Pause'; };

function fit(c){ const r = c.getBoundingClientRect(), d = devicePixelRatio || 1; const h = +c.getAttribute('height'); c.width = r.width * d; c.height = h * d; c.style.height = h + 'px'; const x = c.getContext('2d'); x.setTransform(d,0,0,d,0,0); return x; }
let px = fit($('pipe')), cx = fit($('chart'));
addEventListener('resize', () => { px = fit($('pipe')); cx = fit($('chart')); });

function nodeX(i){ const w = $('pipe').getBoundingClientRect().width; return 46 + i * (w - 46 - 190) / 5; }
const DESC = [null, '32 packet features', 'impute · RobustScaler', 'MSE + latent vector', 'RF · XGB · LGBM · ET · MLP', null];
function logLine(r){
  const t = new Date(); const tm = t.toTimeString().slice(0,8);
  const a = isAtt(r.p), lab = r.t;
  const ok = lab == null ? '' : ((isAtt(lab) === a) ? ' <span class="ok">✓ match</span>' : ' <span class="x">✗ true ' + lab + '</span>');
  const el = document.createElement('div');
  el.innerHTML = `<span class="tm">${tm}</span> row ${String(r.r).padStart(5,' ')} → <span class="${a?'a':'b'}">${a ? (r.p === 'attack' ? 'ATTACK' : r.p.toUpperCase()) : 'BENIGN'}</span> · conf ${(r.c*100).toFixed(1)}%${ok}`;
  const L = $('log'); L.appendChild(el); while (L.children.length > 14) L.removeChild(L.firstChild);
}
function step(){
  const r = R[idx];
  tokens.push({x:0, seg:0, att:isAtt(r.p), born:performance.now()});
  if (tokens.length > 90) tokens.shift();
  S.p++; if (isAtt(r.p)) S.a++; else S.b++; S.conf += r.c;
  if (r.t != null){ S.lab++; if (isAtt(r.t) === isAtt(r.p)) S.cor++; }
  cur.n++; if (isAtt(r.p)) cur.a++; cur.c += r.c;
  const W = Math.max(5, Math.round(N / 120));
  if (cur.n >= W){ win.push({a:cur.a/cur.n, c:cur.c/cur.n}); if (win.length > 60) win.shift(); cur = {n:0,a:0,c:0}; }
  if (S.p % 3 === 0 || speed < 3) logLine(r);
  nodeCount[0]++;
  idx++; if (idx >= N){ idx = 0; loop++; $('loop').textContent = 'replay #' + loop; S = {p:0,b:0,a:0,conf:0,lab:0,cor:0}; }
}
function stats(rps){
  $('sP').textContent = fmt(S.p); $('sB').textContent = fmt(S.b); $('sA').textContent = fmt(S.a);
  $('sC').textContent = S.p ? (S.conf/S.p*100).toFixed(1)+'%' : '—';
  $('sK').textContent = S.lab ? (S.cor/S.lab*100).toFixed(1)+'%' : (D.labelled ? '—' : 'no labels');
  $('sR').textContent = rps.toFixed(0);
}
function drawPipe(t){
  const c = px, w = $('pipe').getBoundingClientRect().width, y = 66;
  c.clearRect(0,0,w,168);
  const g = c.createLinearGradient(nodeX(0),0,nodeX(5),0); g.addColorStop(0,'rgba(34,211,238,.35)'); g.addColorStop(1,'rgba(52,211,153,.45)');
  c.strokeStyle = g; c.lineWidth = 2; c.beginPath(); c.moveTo(nodeX(0),y); c.lineTo(nodeX(5),y); c.stroke();
  // output branches
  c.strokeStyle='rgba(52,211,153,.35)'; c.beginPath(); c.moveTo(nodeX(5),y); c.lineTo(w-24,y-38); c.stroke();
  c.strokeStyle='rgba(255,90,118,.35)'; c.beginPath(); c.moveTo(nodeX(5),y); c.lineTo(w-24,y+38); c.stroke();
  // tokens
  for (const k of tokens){
    const sp = (reduce ? 0.004 : 0.0016) * speed * 16;
    k.x = Math.min(1.12, k.x + sp);
    let X, Y;
    if (k.x <= 1){ X = nodeX(0) + (nodeX(5)-nodeX(0)) * k.x; Y = y; }
    else { const f = (k.x-1)/0.12; X = nodeX(5) + (w-24-nodeX(5)) * f; Y = y + (k.att ? 38 : -38) * f; }
    const col = k.x > 0.82 ? (k.att ? RED : EM) : CY;
    c.fillStyle = col; c.shadowColor = col; c.shadowBlur = 10; c.beginPath(); c.arc(X, Y, 3.2, 0, 7); c.fill(); c.shadowBlur = 0;
  }
  tokens = tokens.filter(k => k.x < 1.12);
  // nodes
  NODES.forEach((n,i) => {
    const X = nodeX(i), pulse = reduce ? 0 : (Math.sin(t/400 + i) + 1) / 2;
    const last = i === 5, col = last ? EM : CY;
    c.fillStyle = 'rgba(8,30,44,.95)'; c.strokeStyle = col; c.lineWidth = 1.6;
    c.shadowColor = col; c.shadowBlur = 10 + pulse * 10; c.beginPath(); c.arc(X, y, 17, 0, 7); c.fill(); c.stroke(); c.shadowBlur = 0;
    c.fillStyle = col; c.beginPath(); c.arc(X, y, 4 + pulse*1.5, 0, 7); c.fill();
    c.fillStyle = '#AEBBD3'; c.font = '600 10.5px JetBrains Mono, monospace'; c.textAlign = 'center'; c.fillText(n, X, y + 36);
    c.fillStyle = '#F5F9FF'; c.font = '700 11px Inter, sans-serif';
    if (i === 0) c.fillText(fmt(S.p) + ' rows read', X, y + 52);
    else if (i === 5) c.fillText(fmt(S.p) + ' decided', X, y + 52);
    else { c.fillStyle = '#7186A8'; c.font = '10px Inter, sans-serif'; c.fillText(DESC[i], X, y + 52); }
  });
  c.textAlign = 'right'; c.font = '700 11px Inter, sans-serif';
  c.font = '800 13px Inter, sans-serif';
  c.fillStyle = EM; c.fillText('BENIGN ' + fmt(S.b), w - 8, y - 48);
  c.fillStyle = RED; c.fillText('ATTACK ' + fmt(S.a), w - 8, y + 60);
}
function drawChart(){
  const c = cx, w = $('chart').getBoundingClientRect().width, h = 178, pl = 30, pb = 16;
  c.clearRect(0,0,w,h);
  c.strokeStyle = 'rgba(120,150,220,.12)'; c.fillStyle = '#7186A8'; c.font = '10px JetBrains Mono, monospace'; c.textAlign = 'right';
  [0, .5, 1].forEach(v => { const Y = (h-pb) - v*(h-pb-8); c.beginPath(); c.moveTo(pl,Y); c.lineTo(w,Y); c.stroke(); c.fillText((v*100)+'%', pl-4, Y+3); });
  if (win.length < 2) return;
  const X = (i) => pl + i * (w - pl - 4) / 59;
  const line = (key, col, fill) => {
    c.beginPath(); win.forEach((p,i) => { const Y = (h-pb) - p[key]*(h-pb-8); i ? c.lineTo(X(i),Y) : c.moveTo(X(i),Y); });
    if (fill){ c.lineTo(X(win.length-1), h-pb); c.lineTo(X(0), h-pb); c.closePath();
      const g = c.createLinearGradient(0,0,0,h); g.addColorStop(0, fill); g.addColorStop(1,'rgba(0,0,0,0)'); c.fillStyle = g; c.fill();
      c.beginPath(); win.forEach((p,i) => { const Y = (h-pb) - p[key]*(h-pb-8); i ? c.lineTo(X(i),Y) : c.moveTo(X(i),Y); }); }
    c.strokeStyle = col; c.lineWidth = 2; c.shadowColor = col; c.shadowBlur = 8; c.stroke(); c.shadowBlur = 0;
    const L = win[win.length-1], Y = (h-pb) - L[key]*(h-pb-8); c.fillStyle = col; c.beginPath(); c.arc(X(win.length-1), Y, 3.5, 0, 7); c.fill();
  };
  line('a', RED, 'rgba(255,90,118,.28)'); line('c', '#A78BFA', null);
  c.textAlign = 'left'; c.font = '600 10.5px Inter, sans-serif';
  c.fillStyle = RED; c.fillText('● attack rate ' + (win[win.length-1].a*100).toFixed(0) + '%', pl+6, 12);
  c.fillStyle = '#A78BFA'; c.fillText('● mean confidence ' + (win[win.length-1].c*100).toFixed(0) + '%', pl+130, 12);
}
let rpsWin = [], frames = 0;
function frame(t){
  const dt = Math.min(100, t - lastT); lastT = t;
  if (!paused && N){
    acc += dt * speed * (D.rate / 1000);
    let n = 0; while (acc >= 1 && n < 400){ step(); acc -= 1; n++; }
    rpsWin.push([t, n]); while (rpsWin.length && t - rpsWin[0][0] > 1000) rpsWin.shift();
  }
  if (!paused || frames % 10 === 0){ drawPipe(t); drawChart(); }
  stats(rpsWin.reduce((s,x) => s + x[1], 0));
  frames++; requestAnimationFrame(frame);
}
if (N) requestAnimationFrame(frame); else $('log').textContent = 'No rows to replay.';
</script></body></html>
"""


def live_stream_html(res: dict, max_rows: int = 3000) -> str:
    rows = res.get("rows") or []
    if len(rows) > max_rows:  # even sample across the file so the replay represents all of it
        step = len(rows) / max_rows
        rows = [rows[int(i * step)] for i in range(max_rows)]
    data = {
        "rows": [{"r": r["row"], "p": r["prediction"], "c": round(float(r["confidence"]), 4), "t": r.get("true_label")} for r in rows],
        "labelled": any(r.get("true_label") is not None for r in rows),
        "rate": 22,  # rows per second at 1x
    }
    return LIVE_HTML.replace("__DATA__", json.dumps(data, separators=(",", ":")))
