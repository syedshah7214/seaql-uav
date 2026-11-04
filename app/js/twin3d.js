/* SEAQL — 3D UAV Swarm Digital Twin (Three.js r160, no build step).
   Falls back to the 2D SVG topology when WebGL is not available. */
(function () {
  'use strict';
  const { $, $$, num, time, esc } = S;

  function webglOK() {
    try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; }
  }
  function glowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'); const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  S.view('swarm', {
    title: '3D UAV Swarm Visualization',
    subtitle: 'Interactive digital twin of 8 UAVs in 2 clusters · drag to rotate, scroll to zoom, right-drag to pan, click a drone',
    render(el) {
      el.innerHTML = `
      <div class="twin">
        <div class="stage3d" id="tw">
          <span class="cluster-chip a">Cluster A</span><span class="cluster-chip b">Cluster B</span>
          <div class="stage-tools"><button class="btn sm" id="twRot" aria-pressed="true"><i data-lucide="rotate-3d"></i>Rotate</button><button class="btn sm icon" id="twIn" aria-label="Zoom in"><i data-lucide="zoom-in"></i></button><button class="btn sm icon" id="twOut" aria-label="Zoom out"><i data-lucide="zoom-out"></i></button><button class="btn sm" id="twReset"><i data-lucide="rotate-ccw"></i>Reset</button></div>
          <div id="twLabels"></div>
          <div class="stage-legend"><span><i class="lg normal"></i>Normal</span><span><i class="lg attack"></i>Under Attack</span><span><i class="lg suspicious"></i>Suspicious</span><span><i class="lg training"></i>Training</span></div>
        </div>
        <div class="grid" style="align-content:start">
          <article class="panel"><div class="panel-h"><h2>UAV Details</h2>${S.tag.simShort}</div><div id="twDet"></div></article>
          <article class="panel"><div class="panel-h"><h3>Swarm</h3></div><div id="twSum"></div>
            <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn sm danger" id="twAtk"><i data-lucide="zap"></i>Inject DoS</button><button class="btn sm" id="twRec"><i data-lucide="shield-check"></i>Recover</button><button class="btn sm" id="twSimReset"><i data-lucide="rotate-ccw"></i>Reset sim</button></div></article>
        </div>
      </div>`;
      let selected = 2;
      const det = () => {
        const st = S.state(); const u = st.uavs[selected];
        $('#twDet').innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><b class="mono" style="font-size:18px">${u.id}</b><span class="status-badge ${u.status}">${S.statusLabel(u.status)}</span></div>
          <dl class="kv"><dt>Cluster</dt><dd>${u.cluster}</dd><dt>Status</dt><dd style="color:${S.COLORS[u.status]}">${u.attackType && u.status !== 'normal' ? u.attackType + ' detected' : S.statusLabel(u.status)}</dd>
          <dt>Traffic</dt><dd class="mono">${num(u.rate)} pkt/s</dd><dt>Last seen</dt><dd class="mono">${time(u.lastSeen)}</dd><dt>Incidents</dt><dd class="mono">${u.incidents.length}</dd></dl>
          <button class="btn primary mt" style="width:100%" id="twLogs"><i data-lucide="file-text"></i>View Logs</button>`;
        const counts = { normal: 0, attack: 0, suspicious: 0, training: 0 }; st.uavs.forEach((x) => counts[x.status]++);
        $('#twSum').innerHTML = `<dl class="kv"><dt>Scenario</dt><dd>${S.SCEN[st.scenario].name}</dd><dt>Normal</dt><dd style="color:var(--green)">${counts.normal}</dd><dt>Under attack</dt><dd style="color:var(--red)">${counts.attack}</dd><dt>Suspicious</dt><dd style="color:var(--amber)">${counts.suspicious}</dd><dt>Training</dt><dd style="color:var(--cyan-2)">${counts.training}</dd></dl>`;
        $('#twLogs').onclick = () => S.openUav(selected);
        S.icons();
      };
      $('#twAtk').onclick = () => S.sim.setScenario('dos');
      $('#twRec').onclick = () => S.sim.setScenario('recovery');
      $('#twSimReset').onclick = () => S.sim.reset();

      if (!window.THREE || !webglOK()) {
        // ---------- 2D fallback ----------
        const stage = $('#tw'); stage.querySelectorAll('.stage-tools,.cluster-chip').forEach((n) => n.remove());
        const host = document.createElement('div'); host.className = 'topo'; host.style.height = '100%'; stage.prepend(host);
        const note = document.createElement('div'); note.className = 'note warn'; note.style.cssText = 'position:absolute;top:12px;left:12px;right:12px;z-index:3';
        note.innerHTML = '<i data-lucide="triangle-alert"></i><div>WebGL is not available in this browser, so a lightweight 2D view is shown instead.</div>'; stage.appendChild(note);
        const topo = S.topology(host, { onSelect: (i) => { selected = i; det(); } });
        det(); const un = S.subscribe(det);
        return () => { un(); topo.destroy(); };
      }

      /* ---------------- Three.js scene ---------------- */
      const stage = $('#tw');
      const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      stage.prepend(renderer.domElement);
      renderer.domElement.setAttribute('aria-label', '3D view of the UAV swarm. Use the buttons to rotate, zoom or reset.');
      renderer.domElement.setAttribute('role', 'img');
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x060a18);
      scene.fog = new THREE.FogExp2(0x060a18, 0.028);
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
      scene.add(new THREE.AmbientLight(0x6fa8ff, 0.8));
      const dl = new THREE.DirectionalLight(0xffffff, 1.1); dl.position.set(6, 14, 8); scene.add(dl);
      const cl = new THREE.PointLight(0x22d3ee, 40, 30, 1.6); cl.position.set(0, 3, 0); scene.add(cl);
      const glowTex = glowTexture();
      const disposables = [glowTex];
      const mat = (o) => { const m = new THREE.MeshStandardMaterial(o); disposables.push(m); return m; };
      const geo = (g) => { disposables.push(g); return g; };

      // floor grid + halo
      const grid = new THREE.GridHelper(60, 60, 0x0e6aa8, 0x0b3a66); grid.material.transparent = true; grid.material.opacity = 0.45; scene.add(grid); disposables.push(grid.geometry, grid.material);
      const halo = new THREE.Mesh(geo(new THREE.CircleGeometry(16, 64)), new THREE.MeshBasicMaterial({ color: 0x0066ff, transparent: true, opacity: 0.08 })); halo.rotation.x = -Math.PI / 2; halo.position.y = 0.01; scene.add(halo); disposables.push(halo.material);

      // aggregator
      const agg = new THREE.Group(); scene.add(agg);
      const cube = new THREE.Mesh(geo(new THREE.BoxGeometry(1.7, 1.7, 1.7)), mat({ color: 0x0a7fd8, emissive: 0x00a8ff, emissiveIntensity: 0.55, metalness: 0.3, roughness: 0.25 }));
      cube.position.y = 1.6; agg.add(cube);
      const edges = new THREE.LineSegments(geo(new THREE.EdgesGeometry(cube.geometry)), new THREE.LineBasicMaterial({ color: 0x9ff3ff })); edges.position.copy(cube.position); agg.add(edges); disposables.push(edges.material);
      const aggGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x22d3ee, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false })); aggGlow.scale.set(7, 7, 1); aggGlow.position.y = 1.6; agg.add(aggGlow); disposables.push(aggGlow.material);
      const rings = [1.6, 2.3].map((r, i) => { const m = new THREE.Mesh(geo(new THREE.TorusGeometry(r, 0.025, 8, 96)), new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.6 - i * 0.2 })); m.rotation.x = Math.PI / 2; m.position.y = 0.12 + i * 0.05; agg.add(m); disposables.push(m.material); return m; });

      // clusters
      const CL = { A: new THREE.Vector3(-7, 0, 0.4), B: new THREE.Vector3(7, 0, 0.4) };
      const CCOL = { A: 0x22d3ee, B: 0x8b5cf6 };
      const hubs = {};
      Object.entries(CL).forEach(([k, c]) => {
        const pts = []; for (let i = 0; i <= 96; i++) { const a = (i / 96) * Math.PI * 2; pts.push(new THREE.Vector3(c.x + Math.cos(a) * 4.4, 0.05, c.z + Math.sin(a) * 3.6)); }
        const loop = new THREE.Line(geo(new THREE.BufferGeometry().setFromPoints(pts)), new THREE.LineDashedMaterial({ color: CCOL[k], dashSize: 0.35, gapSize: 0.2, transparent: true, opacity: 0.7 }));
        loop.computeLineDistances(); scene.add(loop); disposables.push(loop.material);
        const disc = new THREE.Mesh(geo(new THREE.CircleGeometry(1, 48)), new THREE.MeshBasicMaterial({ color: CCOL[k], transparent: true, opacity: 0.05 }));
        disc.scale.set(4.4, 3.6, 1); disc.rotation.x = -Math.PI / 2; disc.position.set(c.x, 0.02, c.z); scene.add(disc); disposables.push(disc.material);
        const hub = new THREE.Mesh(geo(new THREE.OctahedronGeometry(0.42)), mat({ color: CCOL[k], emissive: CCOL[k], emissiveIntensity: 0.8 }));
        hub.position.set(c.x, 1.05, c.z); scene.add(hub); hubs[k] = hub;
        const hg = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: CCOL[k], transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })); hg.scale.set(2.4, 2.4, 1); hub.add(hg); disposables.push(hg.material);
      });

      // drones
      const bodyMat = mat({ color: 0x0c1a2e, metalness: 0.6, roughness: 0.35 });
      const armMat = mat({ color: 0x8fa9c8, metalness: 0.7, roughness: 0.3 });
      const armGeo = geo(new THREE.BoxGeometry(1.45, 0.06, 0.08));
      const rotorGeo = geo(new THREE.CylinderGeometry(0.34, 0.34, 0.015, 24));
      const hubGeo = geo(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 10));
      const drones = S.state().uavs.map((u) => {
        const g = new THREE.Group();
        const order = (S.data.clusterMap || [[0, 2, 4, 6], [1, 3, 5, 7]])[u.cluster === 'A' ? 0 : 1].indexOf(u.idx);
        const a = (order / 4) * Math.PI * 2 + (u.cluster === 'A' ? Math.PI / 4 : Math.PI / 4 + 0.2);
        const c = CL[u.cluster];
        g.position.set(c.x + Math.cos(a) * 3.1, 2.3 + (order % 2) * 0.7, c.z + Math.sin(a) * 2.5);
        g.userData = { idx: u.idx, base: g.position.y, phase: u.idx * 0.9 };
        g.scale.setScalar(1.25);
        const body = new THREE.Mesh(geo(new THREE.BoxGeometry(0.62, 0.2, 0.62)), bodyMat); g.add(body);
        const statusMat = new THREE.MeshStandardMaterial({ color: 0x34d399, emissive: 0x34d399, emissiveIntensity: 1.2 }); disposables.push(statusMat);
        const top = new THREE.Mesh(geo(new THREE.BoxGeometry(0.36, 0.08, 0.36)), statusMat); top.position.y = 0.13; g.add(top);
        const a1 = new THREE.Mesh(armGeo, armMat); a1.rotation.y = Math.PI / 4; g.add(a1);
        const a2 = new THREE.Mesh(armGeo, armMat); a2.rotation.y = -Math.PI / 4; g.add(a2);
        const rotors = [];
        [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([x, z]) => {
          const rm = new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.4, side: THREE.DoubleSide }); disposables.push(rm);
          const r = new THREE.Mesh(rotorGeo, rm); r.position.set(x * 0.51, 0.1, z * 0.51); g.add(r); rotors.push(r);
          const h = new THREE.Mesh(hubGeo, armMat); h.position.set(x * 0.51, 0.04, z * 0.51); g.add(h);
        });
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x34d399, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })); glow.scale.set(3.2, 3.2, 1); g.add(glow); disposables.push(glow.material);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xff5a76, transparent: true, opacity: 0 }); disposables.push(ringMat);
        const ring = new THREE.Mesh(geo(new THREE.TorusGeometry(0.9, 0.03, 8, 64)), ringMat); ring.rotation.x = Math.PI / 2; g.add(ring);
        const selRing = new THREE.Mesh(geo(new THREE.TorusGeometry(0.75, 0.025, 8, 64)), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })); selRing.rotation.x = Math.PI / 2; selRing.position.y = -0.25; g.add(selRing); disposables.push(selRing.material);
        // stem (shadow line to floor)
        const stem = new THREE.Line(geo(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.15, 0), new THREE.Vector3(0, -g.position.y, 0)])), new THREE.LineBasicMaterial({ color: 0x1d5a8a, transparent: true, opacity: 0.5 })); g.add(stem); disposables.push(stem.material);
        // hit box for raycasting
        const hit = new THREE.Mesh(geo(new THREE.SphereGeometry(0.95, 8, 8)), new THREE.MeshBasicMaterial({ visible: false })); hit.userData.idx = u.idx; g.add(hit); disposables.push(hit.material);
        scene.add(g);
        return { g, statusMat, rotors, glow, ring, selRing, hit, idx: u.idx };
      });

      // links (drone -> hub, hub -> aggregator) + packets
      const links = [];
      const mkLink = (from, to, color, key) => {
        const lgeo = geo(new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]));
        const lm = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 }); disposables.push(lm);
        const line = new THREE.Line(lgeo, lm); scene.add(line);
        const pk = []; for (let i = 0; i < 6; i++) { const pm = new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }); disposables.push(pm); const s = new THREE.Sprite(pm); s.scale.set(0.38, 0.38, 1); scene.add(s); pk.push(s); }
        const L = { line, lm, from, to, pk, key, t0: Math.random() }; links.push(L); return L;
      };
      const aggPos = new THREE.Vector3(0, 1.6, 0);
      const hubLinks = {};
      Object.entries(hubs).forEach(([k, h]) => { hubLinks[k] = mkLink(h.position, aggPos, CCOL[k], 'hub' + k); });
      drones.forEach((d) => { d.link = mkLink(d.g.position.clone(), hubs[S.state().uavs[d.idx].cluster].position, 0x22d3ee, 'd' + d.idx); });

      // HTML labels
      const labelHost = $('#twLabels');
      const labels = drones.map((d) => { const l = document.createElement('div'); l.className = 'label3d'; l.textContent = S.state().uavs[d.idx].id; labelHost.appendChild(l); return l; });
      const aggLabel = document.createElement('div'); aggLabel.className = 'label3d agg'; aggLabel.textContent = 'Aggregator'; labelHost.appendChild(aggLabel);

      // camera controls (orbit/zoom/pan)
      const HOME = { r: 20, theta: 0.0, phi: 0.92, target: new THREE.Vector3(0, 1.4, 0) };
      const cam = { r: HOME.r, theta: HOME.theta, phi: HOME.phi, target: HOME.target.clone() };
      let auto = !S.reduced, dragging = null, last = [0, 0], moved = 0;
      const applyCam = () => {
        cam.phi = Math.max(0.25, Math.min(1.45, cam.phi)); cam.r = Math.max(8, Math.min(40, cam.r));
        camera.position.set(cam.target.x + cam.r * Math.sin(cam.phi) * Math.sin(cam.theta), cam.target.y + cam.r * Math.cos(cam.phi), cam.target.z + cam.r * Math.sin(cam.phi) * Math.cos(cam.theta));
        camera.lookAt(cam.target);
      };
      const cv = renderer.domElement;
      cv.addEventListener('contextmenu', (e) => e.preventDefault());
      cv.addEventListener('pointerdown', (e) => { dragging = e.button === 2 || e.shiftKey ? 'pan' : 'rot'; last = [e.clientX, e.clientY]; moved = 0; cv.setPointerCapture(e.pointerId); });
      cv.addEventListener('pointermove', (e) => {
        if (!dragging) { hover(e); return; }
        const dx = e.clientX - last[0], dy = e.clientY - last[1]; last = [e.clientX, e.clientY]; moved += Math.abs(dx) + Math.abs(dy);
        if (dragging === 'rot') { cam.theta -= dx * 0.006; cam.phi -= dy * 0.005; }
        else { const right = new THREE.Vector3().subVectors(camera.position, cam.target).cross(camera.up).normalize(); cam.target.addScaledVector(right, dx * 0.02 * cam.r / 20); cam.target.y += dy * 0.02 * cam.r / 20; }
        applyCam();
      });
      cv.addEventListener('pointerup', (e) => { if (moved < 5) pick(e); dragging = null; });
      cv.addEventListener('wheel', (e) => { e.preventDefault(); cam.r *= e.deltaY > 0 ? 1.08 : 0.92; applyCam(); }, { passive: false });
      const setAuto = (v) => { auto = v; $('#twRot').setAttribute('aria-pressed', v); $('#twRot').classList.toggle('primary', v); };
      setAuto(auto);
      $('#twRot').onclick = () => setAuto(!auto);
      $('#twIn').onclick = () => { cam.r *= 0.85; applyCam(); };
      $('#twOut').onclick = () => { cam.r *= 1.15; applyCam(); };
      $('#twReset').onclick = () => { Object.assign(cam, { r: HOME.r, theta: HOME.theta, phi: HOME.phi, target: HOME.target.clone() }); applyCam(); S.toast('View reset', 'Camera returned to default position', 'info'); };

      const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
      const hits = drones.map((d) => d.hit);
      function cast(e) { const r = cv.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); return ray.intersectObjects(hits)[0]; }
      function pick(e) { const h = cast(e); if (h) { selected = h.object.userData.idx; det(); } }
      function hover(e) { cv.style.cursor = cast(e) ? 'pointer' : 'grab'; }

      // status -> visuals
      const col = (s) => new THREE.Color(S.COLORS[s]);
      function sync(st) {
        drones.forEach((d) => {
          const u = st.uavs[d.idx]; const c = col(u.status);
          d.statusMat.color.copy(c); d.statusMat.emissive.copy(c);
          d.glow.material.color.copy(c); d.rotors.forEach((r) => r.material.color.copy(c));
          d.status = u.status; d.type = u.attackType;
          const lc = u.status === 'normal' ? new THREE.Color(0x22d3ee) : c;
          d.link.lm.color.copy(lc); d.link.pk.forEach((p) => p.material.color.copy(lc));
          d.link.fast = u.status === 'attack' && u.attackType === 'DoS';
          d.link.lm.opacity = u.status === 'normal' ? 0.45 : 0.9;
        });
        Object.entries(hubLinks).forEach(([k, L]) => {
          const hot = st.uavs.some((u) => u.cluster === k && u.status === 'attack');
          const c = hot ? new THREE.Color(0xff5a76) : new THREE.Color(CCOL[k]);
          L.lm.color.copy(c); L.pk.forEach((p) => p.material.color.copy(c));
        });
        det();
      }
      sync(S.state());
      const un = S.subscribe(sync);

      // resize
      const resize = () => { const w = stage.clientWidth, h = stage.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
      const ro = new ResizeObserver(resize); ro.observe(stage); resize(); applyCam();

      // animation loop
      let raf = 0, alive = true; const clock = new THREE.Clock(); const v = new THREE.Vector3();
      function frame() {
        if (!alive) return;
        raf = requestAnimationFrame(frame);
        const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
        const running = S.state().running;
        if (auto && !dragging) { cam.theta += dt * 0.12; applyCam(); }
        cube.rotation.y += dt * 0.4; edges.rotation.y = cube.rotation.y;
        rings.forEach((r, i) => { r.scale.setScalar(1 + 0.06 * Math.sin(t * 2 + i)); });
        aggGlow.material.opacity = 0.6 + 0.15 * Math.sin(t * 2.2);
        drones.forEach((d) => {
          const ud = d.g.userData;
          if (running && !S.reduced) d.g.position.y = ud.base + Math.sin(t * 1.4 + ud.phase) * 0.12;
          if (running) d.rotors.forEach((r) => (r.rotation.y += dt * 40));
          const hot = d.status === 'attack' || d.status === 'suspicious';
          if (hot) { const k = (t * 0.9 + ud.phase) % 1; d.ring.scale.setScalar(1 + k * 2.2); d.ring.material.opacity = (1 - k) * 0.9; d.ring.material.color.set(S.COLORS[d.status]); }
          else d.ring.material.opacity = 0;
          d.glow.material.opacity = hot ? 0.55 + 0.35 * Math.abs(Math.sin(t * 5)) : 0.5;
          d.selRing.material.opacity = d.idx === selected ? 0.9 : 0; d.selRing.rotation.z += dt;
          d.link.from.copy(d.g.position);
          const pos = d.link.line.geometry.attributes.position; pos.setXYZ(0, d.g.position.x, d.g.position.y, d.g.position.z); pos.needsUpdate = true;
        });
        links.forEach((L) => {
          const speed = L.fast ? 1.6 : 0.45; const n = L.fast ? 6 : 2;
          L.pk.forEach((p, i) => {
            if (i >= n) { p.visible = false; return; }
            const k = ((running ? t : 0) * speed + i / n + L.t0) % 1;
            v.lerpVectors(L.from, L.to, k); p.position.copy(v); p.visible = true;
          });
        });
        renderer.render(scene, camera);
        // labels
        const w = stage.clientWidth, h = stage.clientHeight;
        drones.forEach((d, i) => {
          v.copy(d.g.position); v.y += 1.15; v.project(camera);
          const l = labels[i]; const vis = v.z < 1;
          l.style.display = vis ? '' : 'none';
          l.style.left = ((v.x + 1) / 2) * w + 'px'; l.style.top = ((1 - v.y) / 2) * h + 'px';
          l.style.color = d.status === 'normal' ? '' : S.COLORS[d.status];
          l.style.borderColor = d.idx === selected ? 'var(--cyan)' : '';
        });
        v.set(0, -0.2, 0); v.project(camera);
        aggLabel.style.left = ((v.x + 1) / 2) * w + 'px'; aggLabel.style.top = ((1 - v.y) / 2) * h + 'px';
      }
      frame();
      const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); } else if (alive) { clock.getDelta(); frame(); } };
      document.addEventListener('visibilitychange', onVis);

      return () => {
        alive = false; cancelAnimationFrame(raf); un(); ro.disconnect(); document.removeEventListener('visibilitychange', onVis);
        disposables.forEach((x) => { try { x.dispose(); } catch (e) { /* noop */ } });
        renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss();
      };
    },
  });
})();
