/* SEAQL research website — cinematic intro.
 * Full-screen "SEAQL" with a large flying drone. As the visitor scrolls, the drone climbs away,
 * the title dissolves, and the website is revealed. Respects prefers-reduced-motion. */
(function () {
  'use strict';
  const cine = document.getElementById('cine');
  if (!cine) return;
  const stage = cine.querySelector('.cine-stage');
  const drone = cine.querySelector('.cine-drone');
  const droneTilt = cine.querySelector('.cine-drone-tilt');
  const title = cine.querySelector('.cine-title');
  const fades = cine.querySelectorAll('[data-fade]');
  const platform = cine.querySelector('.cine-platform');
  const canvas = document.getElementById('cine-stars');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');
  document.body.classList.add('cine-active');

  // ---------- starfield / data particles (warp as you scroll) ----------
  let W = 0, H = 0, DPR = 1, stars = [];
  function size() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const n = Math.round(Math.min(260, (W * H) / 7000));
    stars = Array.from({ length: n }, () => newStar(true));
  }
  function newStar(any) {
    return { x: (Math.random() - 0.5) * W * 1.6, y: (Math.random() - 0.5) * H * 1.6, z: any ? Math.random() * 1 + 0.05 : 1.05,
             c: Math.random() < 0.18 ? '#A78BFA' : Math.random() < 0.5 ? '#67E8F9' : '#E2E8F0' };
  }
  size(); window.addEventListener('resize', size);

  let progress = 0, mx = 0, my = 0, tx = 0, ty = 0, raf = 0, visible = true;
  function drawStars(dt) {
    ctx.clearRect(0, 0, W, H);
    const speed = (reduce ? 0.02 : 0.06) + progress * 1.6;
    const cx = W / 2, cy = H * 0.46;
    for (const s of stars) {
      const pz = s.z; s.z -= speed * dt * 0.001;
      if (s.z <= 0.04) { Object.assign(s, newStar(false)); continue; }
      const k = 0.55 / s.z, x = cx + s.x * k * 0.6, y = cy + s.y * k * 0.6;
      if (x < -20 || x > W + 20 || y < -20 || y > H + 20) { Object.assign(s, newStar(false)); continue; }
      const a = Math.min(1, (1.1 - s.z) * 1.2);
      ctx.globalAlpha = a * (1 - progress * 0.5);
      if (progress > 0.08 && !reduce) {
        const k2 = 0.55 / pz, x2 = cx + s.x * k2 * 0.6, y2 = cy + s.y * k2 * 0.6;
        ctx.strokeStyle = s.c; ctx.lineWidth = Math.max(0.6, 1.6 - s.z); ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x, y); ctx.stroke();
      } else {
        ctx.fillStyle = s.c; ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, 1.5 - s.z), 0, 6.3); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---------- scroll choreography ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  function apply() {
    const total = cine.offsetHeight - window.innerHeight;
    progress = clamp(window.scrollY / Math.max(1, total));
    const p = progress;
    // drone climbs, grows and fades
    const d = ease(seg(p, 0.02, 0.85));
    drone.style.transform = `translate3d(${tx * 18}px, ${-d * 62}vh, 0) scale(${1 + d * 0.9})`;
    drone.style.opacity = String(1 - seg(p, 0.35, 0.8));
    droneTilt.style.transform = `rotateX(${8 + d * 24}deg) rotateZ(${tx * 4 - d * 6}deg)`;
    // title spreads apart and dissolves
    const t = ease(seg(p, 0.0, 0.7));
    title.style.transform = `translate3d(0, ${t * -6}vh, 0) scale(${1 + t * 0.55})`;
    title.style.letterSpacing = `${0.02 + t * 0.35}em`;
    title.style.opacity = String(1 - seg(p, 0.12, 0.62));
    // keep the holographic platform under the drone whatever the screen size (offsets ignore transforms)
    const ph = platform.offsetHeight || 0;
    platform.style.top = (drone.offsetTop + drone.offsetHeight * 0.70 - ph / 2) + 'px';
    platform.style.opacity = String(1 - seg(p, 0.0, 0.4));
    platform.style.transform = `translateX(-50%) scale(${1 + seg(p, 0, 0.5) * 0.4})`;
    fades.forEach((el) => { el.style.opacity = String(1 - seg(p, 0, +el.dataset.fade || 0.18)); });
    const fadeOut = seg(p, 0.72, 0.985);
    stage.style.opacity = String(1 - fadeOut);
    cine.classList.toggle('cine-done', p >= 0.985);
    document.body.classList.toggle('cine-active', p < 0.92);
    visible = p < 1;
  }

  function loop(t) {
    const dt = Math.min(64, t - (loop.last || t)); loop.last = t;
    tx += (mx - tx) * 0.06; ty += (my - ty) * 0.06;
    if (visible) { drawStars(dt); apply(); }
    raf = requestAnimationFrame(loop);
  }
  window.addEventListener('scroll', apply, { passive: true });
  window.addEventListener('mousemove', (e) => { mx = (e.clientX / window.innerWidth - 0.5) * 2; my = (e.clientY / window.innerHeight - 0.5) * 2; }, { passive: true });
  apply(); raf = requestAnimationFrame(loop);

  // skip / enter buttons
  cine.querySelectorAll('[data-enter]').forEach((b) => b.addEventListener('click', (e) => {
    e.preventDefault();
    const top = cine.offsetHeight - window.innerHeight;
    window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
  }));
  // keyboard: Enter / Space on first screen enters the site
  window.addEventListener('keydown', (e) => {
    if (progress < 0.05 && (e.key === 'Enter') && document.activeElement === document.body) {
      window.scrollTo({ top: cine.offsetHeight - window.innerHeight, behavior: reduce ? 'auto' : 'smooth' });
    }
  });
})();
