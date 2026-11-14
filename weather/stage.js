/* ==========================================================================
   THE STAGE — backdrops, sky and live weather effects.
   Backdrops are 1600x900 SVGs with transparent holes (windows, open sky)
   so the real-weather sky and particles behind them show through.
   ========================================================================== */

const SKIES = {
  day: {
    clear:   ['#3f8fdc', '#bfe3ff'],
    cloudy:  ['#8796a5', '#d3dae0'],
    fog:     ['#b4babf', '#e2e5e6'],
    drizzle: ['#6c7782', '#a9b2ba'],
    rain:    ['#55606b', '#949ea7'],
    snow:    ['#9fb0c0', '#eef3f7'],
    thunder: ['#2f3542', '#69707d'],
  },
  night: {
    clear:   ['#070d24', '#24345e'],
    cloudy:  ['#141924', '#363e4e'],
    fog:     ['#2a2f37', '#4d535c'],
    drizzle: ['#151a22', '#353c48'],
    rain:    ['#10141b', '#2e3540'],
    snow:    ['#1d2533', '#4a5568'],
    thunder: ['#0b0d13', '#262b36'],
  },
};

function paintSky(skyEl, wx) {
  const set = wx.isDay ? SKIES.day : SKIES.night;
  const [a, b] = set[wx.cat === 'night' ? 'clear' : wx.cat] || set.cloudy;
  skyEl.style.background = `linear-gradient(180deg, ${a} 0%, ${b} 75%)`;

  const clouds = {
    clear: wx.code === 1 ? 2 : 0, night: 1, cloudy: wx.code === 2 ? 3 : 6,
    fog: 3, drizzle: 6, rain: 7, snow: 6, thunder: 7,
  }[wx.cat] ?? 4;
  const dark = ['rain', 'thunder', 'drizzle'].includes(wx.cat) || wx.code === 3;

  let html = '';
  if (wx.isDay && ['clear', 'cloudy'].includes(wx.cat) && wx.code !== 3) html += '<div class="sun"></div>';
  if (!wx.isDay) {
    html += '<div class="moon"></div>';
    if (wx.cat === 'night' || wx.cat === 'clear') {
      for (let i = 0; i < 60; i++) {
        html += `<i class="star" style="left:${(i * 37.7) % 100}%;top:${(i * 23.3) % 55}%;animation-delay:${(i % 7) * 0.4}s"></i>`;
      }
    }
  }
  for (let i = 0; i < clouds; i++) {
    const top = 4 + ((i * 17) % 38);
    const scale = 0.7 + ((i * 7) % 5) / 6;
    const dur = 70 + ((i * 13) % 50);
    html += `<div class="cloud ${dark ? 'dark' : ''}" style="top:${top}%;--s:${scale};animation-duration:${dur}s;animation-delay:-${(i * 19) % dur}s"></div>`;
  }
  skyEl.innerHTML = html;
}

/* ---------------- Particles ---------------- */

class WeatherFX {
  constructor(back, front) {
    this.back = back; this.front = front;
    this.parts = [];
    this.fog = [];
    this.running = false;
    this.useFront = true;
    this.onLightning = null;
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const c of [this.back, this.front]) {
      const r = c.getBoundingClientRect();
      c.width = Math.max(1, r.width * dpr);
      c.height = Math.max(1, r.height * dpr);
    }
    this.w = this.back.width; this.h = this.back.height;
  }

  configure(wx, outdoor) {
    this.resize();
    this.useFront = outdoor;
    this.wx = wx;
    this.parts = [];
    this.fog = [];
    const slant = Math.min(wx.wind / 40, 1) * 0.5;
    this.slant = slant;
    let n = 0, kind = null;
    if (wx.cat === 'rain') { kind = 'rain'; n = wx.code >= 65 || wx.code === 82 ? 380 : 230; }
    else if (wx.cat === 'thunder') { kind = 'rain'; n = 360; }
    else if (wx.cat === 'drizzle') { kind = 'drizzle'; n = 200; }
    else if (wx.cat === 'snow') { kind = 'snow'; n = wx.code === 75 || wx.code === 86 ? 260 : 160; }
    this.kind = kind;
    for (let i = 0; i < n; i++) this.parts.push(this.spawn(true));
    if (wx.cat === 'fog') {
      for (let i = 0; i < 14; i++) {
        this.fog.push({ x: Math.random(), y: 0.25 + Math.random() * 0.7, r: 0.18 + Math.random() * 0.25, v: (0.00004 + Math.random() * 0.00008) * (Math.random() < 0.5 ? -1 : 1) });
      }
    }
    this.nextBolt = performance.now() + 5000 + Math.random() * 6000;
    if (!this.running) { this.running = true; this.last = performance.now(); requestAnimationFrame(t => this.tick(t)); }
  }

  spawn(anywhere) {
    const front = this.useFront && Math.random() < 0.35;
    return {
      x: Math.random() * 1.3 - 0.15,
      y: anywhere ? Math.random() : -0.05 - Math.random() * 0.1,
      z: front ? 1 : 0.45 + Math.random() * 0.4,
      front,
      wob: Math.random() * Math.PI * 2,
    };
  }

  tick(t) {
    const dt = Math.min(50, t - this.last); this.last = t;
    const bctx = this.back.getContext('2d');
    const fctx = this.front.getContext('2d');
    bctx.clearRect(0, 0, this.w, this.h);
    fctx.clearRect(0, 0, this.w, this.h);
    const W = this.w, H = this.h;

    for (const p of this.parts) {
      const ctx = p.front ? fctx : bctx;
      if (this.kind === 'rain' || this.kind === 'drizzle') {
        const speed = (this.kind === 'rain' ? 0.0016 : 0.0008) * p.z;
        p.y += speed * dt; p.x += speed * this.slant * dt;
        const len = (this.kind === 'rain' ? 0.045 : 0.014) * p.z;
        ctx.strokeStyle = `rgba(210,225,240,${this.kind === 'rain' ? 0.35 + p.z * 0.25 : 0.35})`;
        ctx.lineWidth = (this.kind === 'rain' ? 1.4 : 1) * p.z * (W / 900);
        ctx.beginPath();
        ctx.moveTo(p.x * W, p.y * H);
        ctx.lineTo((p.x - len * this.slant) * W, (p.y - len) * H);
        ctx.stroke();
      } else if (this.kind === 'snow') {
        p.wob += dt * 0.002;
        p.y += 0.00012 * p.z * dt;
        p.x += (Math.sin(p.wob) * 0.00008 + this.slant * 0.00012) * dt;
        ctx.fillStyle = `rgba(255,255,255,${0.55 + p.z * 0.4})`;
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, (2 + p.z * 3) * (W / 1200), 0, Math.PI * 2);
        ctx.fill();
      }
      if (p.y > 1.05 || p.x > 1.2) Object.assign(p, this.spawn(false));
    }

    for (const f of this.fog) {
      f.x += f.v * dt;
      if (f.x > 1.4) f.x = -0.4; if (f.x < -0.4) f.x = 1.4;
      for (const [ctx, alpha] of [[bctx, 0.55], ...(this.useFront ? [[fctx, 0.28]] : [])]) {
        const g = ctx.createRadialGradient(f.x * W, f.y * H, 0, f.x * W, f.y * H, f.r * W);
        g.addColorStop(0, `rgba(235,238,240,${alpha})`);
        g.addColorStop(1, 'rgba(235,238,240,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
    }

    if (this.wx && this.wx.cat === 'thunder' && t > this.nextBolt) {
      this.nextBolt = t + 7000 + Math.random() * 9000;
      this.onLightning && this.onLightning();
    }
    requestAnimationFrame(tt => this.tick(tt));
  }
}

/* ---------------- Backdrops ---------------- */

function holePath(x, y, w, h) {
  return `M0 0 H1600 V900 H0 Z M${x} ${y} V${y + h} H${x + w} V${y} Z`;
}

const BACKDROPS = {
  studio: (c) => `
    <defs>
      <linearGradient id="bdWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#121a2c"/><stop offset="1" stop-color="#1d2a45"/></linearGradient>
      <linearGradient id="bdFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b3754"/><stop offset="1" stop-color="#0c111d"/></linearGradient>
    </defs>
    <path d="${holePath(400, 50, 800, 380)}" fill="url(#bdWall)" fill-rule="evenodd"/>
    ${[60, 180, 1420, 1540].map(x => `<rect x="${x - 6}" y="60" width="12" height="640" rx="6" fill="#c9a659" opacity=".14"/>`).join('')}
    <rect x="392" y="42" width="816" height="396" rx="10" fill="none" stroke="#0a0e18" stroke-width="16"/>
    <rect x="392" y="42" width="816" height="396" rx="10" fill="none" stroke="#c9a659" stroke-width="3" opacity=".6"/>
    <rect x="420" y="364" width="420" height="54" rx="6" fill="#8c1c2b" opacity=".92"/>
    <text x="440" y="400" font-family="Limelight, serif" font-size="30" fill="#f3e9d2">LIVE · ${escapeXML(c.city.toUpperCase()).slice(0, 18)}</text>
    <rect x="1030" y="70" width="150" height="80" rx="8" fill="#0a0e18" opacity=".7"/>
    <text x="1105" y="126" text-anchor="middle" font-family="Limelight, serif" font-size="44" fill="#f3e9d2">${escapeXML(c.temp)}</text>
    <rect x="0" y="700" width="1600" height="200" fill="url(#bdFloor)"/>
    <path d="M0 700 H1600" stroke="#c9a659" stroke-width="3" opacity=".4"/>
    <polygon points="300,0 380,0 620,900 60,900" fill="#fff6dc" opacity=".05"/>
    <polygon points="1220,0 1300,0 1540,900 980,900" fill="#fff6dc" opacity=".05"/>
    <g transform="translate(120 140)" opacity=".85">
      <circle r="62" fill="none" stroke="#c9a659" stroke-width="4"/>
      <text y="14" text-anchor="middle" font-family="Limelight, serif" font-size="40" fill="#c9a659">TWU</text>
    </g>`,

  castle: () => {
    let merlons = '';
    for (let x = 0; x < 1600; x += 130) merlons += `<rect x="${x}" y="600" width="78" height="70" fill="#8a8274"/>`;
    let bricks = '';
    for (let row = 0; row < 6; row++) {
      const y = 670 + row * 40;
      bricks += `<path d="M0 ${y} H1600" stroke="#6d665a" stroke-width="2"/>`;
      for (let x = (row % 2) * 60; x < 1600; x += 120) bricks += `<path d="M${x} ${y} V${y + 40}" stroke="#6d665a" stroke-width="2"/>`;
    }
    return `
      <path d="M0 640 Q200 560 420 610 T860 590 T1300 600 T1600 580 V900 H0 Z" fill="#4f6a5a" opacity=".75"/>
      <path d="M0 670 Q300 620 600 650 T1200 640 T1600 650 V900 H0 Z" fill="#3c5547" opacity=".8"/>
      ${merlons}
      <rect x="0" y="668" width="1600" height="232" fill="#8a8274"/>
      ${bricks}
      <rect x="1468" y="250" width="10" height="420" fill="#3a2f22"/>
      <g class="flag"><path d="M1478 256 Q1540 236 1600 262 L1600 352 Q1540 326 1478 346 Z" fill="#1d1a24"/>
        <path d="M1508 280 l14 28 l14 -28 l-14 12 Z" fill="#c9a659"/></g>`;
  },

  field: () => `
    <path d="M0 600 Q260 520 560 580 T1100 560 T1600 590 V900 H0 Z" fill="#7aa35b"/>
    <path d="M0 680 Q400 610 800 670 T1600 650 V900 H0 Z" fill="#5b8a3f"/>
    <path d="M0 780 Q500 740 1000 770 T1600 760 V900 H0 Z" fill="#4c7834"/>
    <ellipse cx="760" cy="850" rx="260" ry="34" fill="#6b4f2c" opacity=".55"/>
    ${[...Array(14)].map((_, i) => `<rect x="${i * 120 + 10}" y="640" width="12" height="80" fill="#6b4f2c"/>`).join('')}
    <path d="M0 660 H1600 M0 694 H1600" stroke="#6b4f2c" stroke-width="7"/>
    <rect x="1440" y="380" width="34" height="300" fill="#5a3f26"/>
    <circle cx="1456" cy="360" r="110" fill="#3f6b2c"/><circle cx="1390" cy="410" r="70" fill="#467a32"/><circle cx="1520" cy="420" r="72" fill="#3a6229"/>
    <g transform="translate(1250 600) scale(.6)">
      <ellipse cx="0" cy="0" rx="60" ry="40" fill="#f4f1ea"/><circle cx="-52" cy="-10" r="22" fill="#2b2b2b"/>
      <rect x="-34" y="26" width="8" height="30" fill="#2b2b2b"/><rect x="24" y="26" width="8" height="30" fill="#2b2b2b"/></g>`,

  ministry: () => `
    <defs><linearGradient id="bdWood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3b2a1e"/><stop offset=".5" stop-color="#4a3526"/><stop offset="1" stop-color="#3b2a1e"/></linearGradient></defs>
    <path d="${holePath(560, 100, 480, 380)}" fill="url(#bdWood)" fill-rule="evenodd"/>
    ${[...Array(16)].map((_, i) => `<path d="M${i * 100 + 50} 0 V780" stroke="#2c1f15" stroke-width="3" opacity=".6"/>`).join('')}
    <rect x="540" y="80" width="520" height="420" fill="none" stroke="#e8e0cc" stroke-width="22"/>
    <path d="M800 100 V480 M560 290 H1040" stroke="#e8e0cc" stroke-width="12"/>
    <rect x="600" y="28" width="400" height="40" rx="4" fill="#c9a659"/>
    <text x="800" y="56" text-anchor="middle" font-family="Playfair Display, serif" font-size="20" font-weight="700" fill="#2c1f15">DEPT. OF UNFORESEEN PRECIPITATION</text>
    <rect x="140" y="130" width="200" height="240" fill="#c9a659"/><rect x="156" y="146" width="168" height="208" fill="#7d93a8"/>
    <ellipse cx="240" cy="250" rx="56" ry="30" fill="#f4f4f4"/><ellipse cx="210" cy="240" rx="30" ry="24" fill="#f4f4f4"/><ellipse cx="268" cy="236" rx="34" ry="28" fill="#f4f4f4"/>
    <circle cx="226" cy="244" r="3" fill="#222"/><circle cx="256" cy="244" r="3" fill="#222"/><path d="M228 258 Q241 252 254 258" stroke="#222" stroke-width="3" fill="none"/>
    <rect x="180" y="380" width="120" height="26" fill="#c9a659"/><text x="240" y="399" text-anchor="middle" font-family="Playfair Display, serif" font-size="15" font-weight="700" fill="#2c1f15">OUR FOUNDER</text>
    <rect x="1300" y="470" width="190" height="310" fill="#6f7a6a"/>
    ${[0, 1, 2].map(i => `<rect x="1316" y="${490 + i * 96}" width="158" height="80" fill="#7d8877" stroke="#56604f" stroke-width="3"/><rect x="1370" y="${520 + i * 96}" width="50" height="10" rx="4" fill="#c9c3a6"/>`).join('')}
    <rect x="1330" y="430" width="120" height="40" fill="#e8e0cc"/><rect x="1340" y="420" width="100" height="14" fill="#f4efe2"/>
    <rect x="0" y="780" width="1600" height="120" fill="#2f4a3a"/>
    <path d="M0 780 H1600" stroke="#1f3328" stroke-width="10"/>`,

  pier: () => `
    <defs><linearGradient id="bdSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f6e86"/><stop offset="1" stop-color="#1e3f52"/></linearGradient></defs>
    <rect x="0" y="540" width="1600" height="220" fill="url(#bdSea)"/>
    ${[580, 620, 660, 700].map((y, i) => `<path class="wave" style="animation-delay:-${i}s" d="M0 ${y} Q40 ${y - 8} 80 ${y} T160 ${y} T240 ${y} T320 ${y} T400 ${y} T480 ${y} T560 ${y} T640 ${y} T720 ${y} T800 ${y} T880 ${y} T960 ${y} T1040 ${y} T1120 ${y} T1200 ${y} T1280 ${y} T1360 ${y} T1440 ${y} T1520 ${y} T1600 ${y} T1680 ${y}" stroke="#a9cad8" stroke-width="2.5" fill="none" opacity=".45"/>`).join('')}
    <rect x="0" y="740" width="1600" height="160" fill="#8a6a46"/>
    ${[...Array(20)].map((_, i) => `<path d="M0 ${750 + i * 8} H1600" stroke="#6e5234" stroke-width="2" opacity=".5"/>`).join('')}
    ${[...Array(21)].map((_, i) => `<rect x="${i * 80}" y="660" width="8" height="84" fill="#e8e0cc"/>`).join('')}
    <path d="M0 660 H1600 M0 700 H1600" stroke="#e8e0cc" stroke-width="8"/>
    ${[90, 1500].map(x => `<rect x="${x}" y="300" width="16" height="440" fill="#1f3d3a"/><circle cx="${x + 8}" cy="290" r="26" fill="#fff4c2" opacity=".9"/><path d="M${x - 22} 270 h60 l-10 -20 h-40 Z" fill="#1f3d3a"/>`).join('')}
    <g transform="translate(1180 640)"><ellipse cx="0" cy="0" rx="22" ry="14" fill="#f4f4f4"/><circle cx="18" cy="-12" r="9" fill="#f4f4f4"/><path d="M26 -12 l12 3 l-12 3 Z" fill="#e8a33a"/><path d="M-10 -4 l-26 -8 l12 14 Z" fill="#9aa3ab"/></g>`,

  parlour: () => `
    <defs><pattern id="bdPaper" width="60" height="60" patternUnits="userSpaceOnUse"><rect width="60" height="60" fill="#5d2a33"/><rect width="30" height="60" fill="#682f39"/><circle cx="15" cy="30" r="4" fill="#c9a659" opacity=".35"/></pattern></defs>
    <path d="${holePath(1020, 110, 380, 460)}" fill="url(#bdPaper)" fill-rule="evenodd"/>
    <rect x="1004" y="94" width="412" height="492" fill="none" stroke="#f1e6cf" stroke-width="22"/>
    <path d="M1210 110 V570 M1020 340 H1400" stroke="#f1e6cf" stroke-width="10"/>
    <path d="M960 70 Q1000 300 990 620 L1060 620 Q1040 300 1040 70 Z M1460 70 Q1420 300 1430 620 L1360 620 Q1380 300 1380 70 Z" fill="#8c1c2b"/>
    <rect x="950" y="56" width="520" height="22" rx="10" fill="#c9a659"/>
    <rect x="530" y="140" width="250" height="300" fill="#c9a659"/><rect x="548" y="158" width="214" height="264" fill="#2c2420"/>
    <ellipse cx="655" cy="270" rx="56" ry="68" fill="#d9b08c"/><path d="M600 250 Q655 160 710 250 Q690 200 655 196 Q620 200 600 250 Z" fill="#e8e8e8"/>
    <path d="M620 300 Q655 330 690 300 Q680 360 655 364 Q630 360 620 300 Z" fill="#e8e8e8"/>
    <circle cx="634" cy="262" r="5" fill="#222"/><circle cx="676" cy="262" r="5" fill="#222"/>
    <rect x="480" y="560" width="350" height="230" fill="#e9dfc7"/><rect x="460" y="540" width="390" height="30" fill="#d8ccb0"/>
    <rect x="550" y="620" width="210" height="170" fill="#1c1410"/>
    <path class="fire" d="M590 790 Q600 700 640 740 Q650 660 680 730 Q700 690 720 790 Z" fill="#e8742a"/>
    <path class="fire" d="M615 790 Q630 740 650 760 Q665 720 690 790 Z" fill="#f6c34a"/>
    <rect x="620" y="490" width="70" height="50" rx="10" fill="#3a2a1a"/><circle cx="655" cy="514" r="18" fill="#f1e6cf"/><path d="M655 514 V502 M655 514 H665" stroke="#222" stroke-width="2.5"/>
    <rect x="0" y="790" width="1600" height="110" fill="#5a3b24"/>
    ${[...Array(16)].map((_, i) => `<path d="M${i * 100} 790 V900" stroke="#46301d" stroke-width="3"/>`).join('')}
    <ellipse cx="800" cy="860" rx="560" ry="34" fill="#7a2230" opacity=".8"/>`,
};

function escapeXML(s) {
  return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/* ---------------- Props for absurd interruptions ---------------- */
const PROPS = {
  fish: `<g class="prop prop-fish"><g transform="translate(-60 -24)">
      <ellipse cx="60" cy="24" rx="54" ry="22" fill="#8fb3c4"/><path d="M110 24 L146 0 L140 24 L146 48 Z" fill="#6f95a8"/>
      <circle cx="26" cy="18" r="6" fill="#fff"/><circle cx="25" cy="18" r="3" fill="#111"/><path d="M8 30 Q16 34 22 30" stroke="#3b5b6a" stroke-width="3" fill="none"/>
      <path d="M50 10 Q60 24 50 38 M70 10 Q80 24 70 38" stroke="#6f95a8" stroke-width="3" fill="none"/></g></g>`,
  sheep: `<g class="prop prop-sheep"><g class="sheep-body">
      <ellipse cx="0" cy="0" rx="90" ry="58" fill="#f6f3ec"/>
      ${[-60, -20, 20, 60].map(x => `<circle cx="${x}" cy="-44" r="26" fill="#f6f3ec"/>`).join('')}
      <ellipse cx="-92" cy="-20" rx="30" ry="36" fill="#2b2b2b"/><circle cx="-102" cy="-28" r="6" fill="#fff"/><circle cx="-104" cy="-28" r="3" fill="#111"/>
      <rect x="-56" y="40" width="14" height="56" fill="#2b2b2b"/><rect x="40" y="40" width="14" height="56" fill="#2b2b2b"/></g></g>`,
};
