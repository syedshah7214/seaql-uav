/* SEAQL — original hero artwork (SVG): 3D-style quadcopter, holographic globe, light platform.
   Pure SVG + CSS animation (no images, no WebGL) so it is light on student laptops. */
(function () {
  'use strict';
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  /* ---------- quadcopter ---------- */
  const hubs = { bl: [150, 112, 84, 19], br: [450, 112, 84, 19], fl: [108, 198, 100, 23], fr: [492, 198, 100, 23] };
  const rotor = (k) => {
    const [x, y, rx, ry] = hubs[k];
    return `<g class="rotor">
      <ellipse cx="${x}" cy="${y - 12}" rx="${rx}" ry="${ry}" fill="url(#dRotor)"/>
      <ellipse cx="${x}" cy="${y - 12}" rx="${rx}" ry="${ry}" fill="none" stroke="#8BE9F7" stroke-opacity=".35" stroke-width="1"/>
      <g transform="translate(${x} ${y - 12}) scale(1 ${(ry / rx).toFixed(3)})"><g class="blades">
        <rect x="${-rx + 6}" y="-3.2" width="${2 * rx - 12}" height="6.4" rx="3.2" fill="#C9D6FF" opacity=".55"/>
        <rect x="-3.2" y="${-rx + 6}" width="6.4" height="${2 * rx - 12}" rx="3.2" fill="#C9D6FF" opacity=".25"/></g></g>
    </g>`;
  };
  const motor = (k, glow) => {
    const [x, y] = hubs[k];
    return `<g>
      <ellipse cx="${x}" cy="${y + 12}" rx="17" ry="5" fill="#0B0F2A"/>
      <rect x="${x - 17}" y="${y - 6}" width="34" height="18" fill="url(#dMotor)"/>
      <ellipse cx="${x}" cy="${y + 3}" rx="17.5" ry="5" fill="none" stroke="${glow}" stroke-width="2" opacity=".9"/>
      <ellipse cx="${x}" cy="${y - 6}" rx="17" ry="5" fill="#9AA8F0"/>
      <ellipse cx="${x}" cy="${y - 6}" rx="7" ry="2.4" fill="#2A2F6B"/>
      <rect x="${x - 2.5}" y="${y - 14}" width="5" height="8" rx="2" fill="#B9C4FF"/>
      <circle cx="${x}" cy="${y + 16}" r="9" fill="url(#dTip${glow === '#22D3EE' ? 'C' : 'P'})"/>
    </g>`;
  };
  const arm = (x1, y1, k) => {
    const [x2, y2] = hubs[k];
    return `<g stroke-linecap="round"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#1A1E4D" stroke-width="15"/>
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="url(#dArm)" stroke-width="11"/>
      <line x1="${x1}" y1="${y1 - 4}" x2="${x2}" y2="${y2 - 4}" stroke="#A9B6FF" stroke-opacity=".55" stroke-width="1.4"/></g>`;
  };

  S.heroDroneSVG = () => `
  <svg class="hd-drone" viewBox="0 0 600 270" aria-hidden="true">
    <defs>
      <radialGradient id="dRotor"><stop offset="0" stop-color="#22D3EE" stop-opacity=".22"/><stop offset=".7" stop-color="#6D8BFF" stop-opacity=".10"/><stop offset="1" stop-color="#8B5CF6" stop-opacity="0"/></radialGradient>
      <linearGradient id="dMotor" x1="0" x2="1"><stop offset="0" stop-color="#14183D"/><stop offset=".45" stop-color="#6E7BD9"/><stop offset=".6" stop-color="#3B4396"/><stop offset="1" stop-color="#11153A"/></linearGradient>
      <linearGradient id="dArm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4C55B8"/><stop offset="1" stop-color="#20245C"/></linearGradient>
      <linearGradient id="dTop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EEF1FF"/><stop offset=".45" stop-color="#A99BFF"/><stop offset="1" stop-color="#5440C8"/></linearGradient>
      <linearGradient id="dSide" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3D2E9C"/><stop offset="1" stop-color="#140F3E"/></linearGradient>
      <linearGradient id="dCanopy" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".85"/><stop offset=".5" stop-color="#C6BCFF" stop-opacity=".55"/><stop offset="1" stop-color="#7C6CF6" stop-opacity=".3"/></linearGradient>
      <radialGradient id="dLens" cx="40%" cy="38%"><stop offset="0" stop-color="#E9FDFF"/><stop offset=".35" stop-color="#22D3EE"/><stop offset="1" stop-color="#062A55"/></radialGradient>
      <radialGradient id="dTipC"><stop offset="0" stop-color="#8BE9F7"/><stop offset=".35" stop-color="#22D3EE" stop-opacity=".7"/><stop offset="1" stop-color="#22D3EE" stop-opacity="0"/></radialGradient>
      <radialGradient id="dTipP"><stop offset="0" stop-color="#E1D5FF"/><stop offset=".35" stop-color="#8B5CF6" stop-opacity=".7"/><stop offset="1" stop-color="#8B5CF6" stop-opacity="0"/></radialGradient>
      <radialGradient id="dUnder"><stop offset="0" stop-color="#22D3EE" stop-opacity=".55"/><stop offset="1" stop-color="#22D3EE" stop-opacity="0"/></radialGradient>
    </defs>
    <!-- back rotors, arms, motors -->
    ${rotor('bl')}${rotor('br')}
    ${arm(262, 146, 'bl')}${arm(338, 146, 'br')}
    ${motor('bl', '#8B5CF6')}${motor('br', '#8B5CF6')}
    <!-- body -->
    <g transform="translate(300 172) scale(1.45) translate(-300 -172)">
    <ellipse cx="300" cy="214" rx="70" ry="16" fill="url(#dUnder)"/>
    <g stroke-linecap="round" stroke="#2A2F6B" stroke-width="4" fill="none"><path d="M274 194 L262 236"/><path d="M326 194 L338 236"/></g>
    <g stroke-linecap="round" stroke-width="4"><line x1="240" y1="238" x2="284" y2="238" stroke="#2A2F6B"/><line x1="316" y1="238" x2="360" y2="238" stroke="#2A2F6B"/>
      <line x1="240" y1="238" x2="250" y2="238" stroke="#22D3EE"/><line x1="350" y1="238" x2="360" y2="238" stroke="#22D3EE"/></g>
    <polygon points="250,176 350,176 338,198 262,198" fill="url(#dSide)"/>
    <polygon points="236,150 268,126 332,126 364,150 350,177 250,177" fill="url(#dTop)"/>
    <polygon points="236,150 250,177 262,198 256,178" fill="#2C2180" opacity=".8"/>
    <polygon points="364,150 350,177 338,198 344,178" fill="#2C2180" opacity=".8"/>
    <polygon points="262,146 283,133 317,133 338,146 329,161 271,161" fill="url(#dCanopy)"/>
    <path d="M271 161 L329 161" stroke="#FFFFFF" stroke-opacity=".6"/>
    <path d="M283 133 L276 150 M317 133 L324 150" stroke="#5440C8" stroke-opacity=".5"/>
    <path d="M252 172 L348 172" stroke="#22D3EE" stroke-width="2.4" class="led"/>
    <rect x="270" y="181" width="14" height="4" rx="2" fill="#22D3EE" class="led"/><rect x="316" y="181" width="14" height="4" rx="2" fill="#22D3EE" class="led"/>
    <rect x="288" y="197" width="24" height="8" rx="3" fill="#1A1E4D"/>
    <circle cx="300" cy="214" r="14" fill="#0E1238" stroke="#4C55B8" stroke-width="2"/>
    <circle cx="300" cy="214" r="7.5" fill="url(#dLens)"/><circle cx="297" cy="211" r="2" fill="#fff"/>
    </g>
    <!-- front arms, motors, rotors -->
    ${arm(254, 168, 'fl')}${arm(346, 168, 'fr')}
    ${motor('fl', '#22D3EE')}${motor('fr', '#22D3EE')}
    ${rotor('fl')}${rotor('fr')}
  </svg>`;

  /* ---------- light platform + beam ---------- */
  S.heroPlatformSVG = () => `
  <svg class="hd-platform" viewBox="0 0 600 170" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
    <defs>
      <linearGradient id="pBeam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22D3EE" stop-opacity=".55"/><stop offset="1" stop-color="#22D3EE" stop-opacity=".04"/></linearGradient>
      <radialGradient id="pPool"><stop offset="0" stop-color="#22D3EE" stop-opacity=".55"/><stop offset=".5" stop-color="#3A7BFF" stop-opacity=".18"/><stop offset="1" stop-color="#8B5CF6" stop-opacity="0"/></radialGradient>
    </defs>
    <polygon points="268,0 332,0 412,132 188,132" fill="url(#pBeam)" class="beam"/>
    <ellipse cx="300" cy="132" rx="250" ry="38" fill="url(#pPool)"/>
    <g fill="none">
      <ellipse cx="300" cy="132" rx="230" ry="34" stroke="#6D8BFF" stroke-opacity=".35" stroke-width="1.2"/>
      <ellipse cx="300" cy="132" rx="180" ry="27" stroke="#22D3EE" stroke-opacity=".6" stroke-width="1.6" stroke-dasharray="10 7" class="ring-a"/>
      <ellipse cx="300" cy="132" rx="130" ry="19" stroke="#8BE9F7" stroke-opacity=".85" stroke-width="2"/>
      <ellipse cx="300" cy="132" rx="84" ry="12" stroke="#22D3EE" stroke-width="2.4" class="ring-b"/>
      <ellipse cx="300" cy="132" rx="40" ry="6" stroke="#E9FDFF" stroke-width="2"/>
      <ellipse cx="300" cy="132" rx="84" ry="12" stroke="#22D3EE" stroke-width="1.5" class="ring-pulse"/>
    </g>
  </svg>`;

  /* ---------- holographic globe ---------- */
  // pseudo-continents as blobs on an equirectangular strip (W = 400); dots drift horizontally
  const blobs = [[60, 70, 42, 28], [95, 120, 22, 34], [175, 60, 60, 24], [205, 105, 26, 30], [250, 140, 18, 14], [300, 70, 44, 30], [345, 140, 26, 16], [20, 150, 14, 10]];
  let dots = '';
  for (let x = 0; x < 400; x += 7) for (let y = 14; y < 196; y += 7) {
    const inLand = blobs.some(([bx, by, rx, ry]) => ((x - bx) / rx) ** 2 + ((y - by) / ry) ** 2 < 1);
    if (inLand && rnd() > 0.12) dots += `<circle cx="${x}" cy="${y}" r="${(1.3 + rnd() * 0.7).toFixed(2)}"/>`;
  }
  S.heroGlobeSVG = () => `
  <svg class="hd-globe" viewBox="0 0 220 220" aria-hidden="true">
    <defs>
      <radialGradient id="gFill" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#2A47B8" stop-opacity=".85"/><stop offset=".55" stop-color="#16206A" stop-opacity=".85"/><stop offset="1" stop-color="#2B135E" stop-opacity=".9"/></radialGradient>
      <linearGradient id="gRim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22D3EE"/><stop offset="1" stop-color="#8B5CF6"/></linearGradient>
      <clipPath id="gClip"><circle cx="110" cy="110" r="96"/></clipPath>
    </defs>
    <circle cx="110" cy="110" r="104" fill="none" stroke="url(#gRim)" stroke-opacity=".25" stroke-width="10"/>
    <circle cx="110" cy="110" r="96" fill="url(#gFill)"/>
    <g clip-path="url(#gClip)">
      <g class="g-dots" fill="#8BE9F7" opacity=".85"><g>${dots}</g><g transform="translate(400 0)">${dots}</g></g>
      <g fill="none" stroke="#8BE9F7" stroke-opacity=".22" stroke-width=".8">
        ${[-60, -30, 0, 30, 60].map((d) => { const y = 110 + 96 * Math.sin(d * Math.PI / 180); const r = 96 * Math.cos(d * Math.PI / 180); return `<ellipse cx="110" cy="${y.toFixed(1)}" rx="${r.toFixed(1)}" ry="${(r * 0.12).toFixed(1)}"/>`; }).join('')}
        ${[20, 45, 70, 96].map((rx) => `<ellipse cx="110" cy="110" rx="${rx}" ry="96"/>`).join('')}
      </g>
      <ellipse cx="80" cy="70" rx="60" ry="40" fill="#FFFFFF" opacity=".06"/>
    </g>
    <circle cx="110" cy="110" r="96" fill="none" stroke="url(#gRim)" stroke-width="1.6"/>
  </svg>`;

  S.heroParticles = (n = 28) => Array.from({ length: n }, () => {
    const s = (1 + rnd() * 2.4).toFixed(1);
    return `<i style="left:${(rnd() * 100).toFixed(1)}%;top:${(rnd() * 100).toFixed(1)}%;width:${s}px;height:${s}px;animation-delay:${(rnd() * 4).toFixed(2)}s;animation-duration:${(2.5 + rnd() * 3).toFixed(2)}s;background:${rnd() > 0.5 ? '#8BE9F7' : '#C4B5FD'}"></i>`;
  }).join('');
})();
