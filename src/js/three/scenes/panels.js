// Floating browser windows (content marketing, website build, eshop build, blog). A cascade of
// windows whose pages are wireframe UIs drawn on canvases (landing hero with a lime CTA, product
// grid, checkout, article, analytics; no text) floats in depth, with the mobile version of the
// landing page standing in front.
//   intro   windows slide up into the cascade one by one and their pages "load" top to bottom
//   idle    gentle float, a glass sheen drifts across; a small cursor works the front page and
//           clicks its lime CTA
//   pointer depth parallax per window; the window under the cursor tilts towards it, lifts, gets a
//           lime outline and a soft spotlight where the cursor is
//   scroll  the cascade assembles into one full page (the windows become its sections, their
//           browser bars fold away) with the phone beside it
import * as THREE from 'three';
import {
  clamp, lerp, smooth, easeOutCubic, easeInOutCubic, frame, shiftFrame,
  localPointer, tuneLights, canvasTexture, damp, look, rng,
} from './_shared.js';

const BG = '#0b0b0b';
const BAR = '#161616';
const L1 = '#2b2b2b';
const L2 = '#3c3c3c';
const L3 = '#6a6a6a';
const L4 = '#cfcfcf';
const LIME = '#ccff00';

const CHROME = 0.075; // browser bar height as a fraction of the page

function chrome(g, W, H) {
  const ch = H * CHROME;
  g.fillStyle = BAR;
  g.fillRect(0, 0, W, ch);
  const s = ch * 0.26;
  ['#3a3a3a', '#3a3a3a', '#3a3a3a'].forEach((c, i) => { g.fillStyle = c; g.fillRect(ch * 0.4 + i * s * 1.8, ch / 2 - s / 2, s, s); });
  g.fillStyle = '#232323';
  g.fillRect(W * 0.3, ch * 0.24, W * 0.4, ch * 0.52);
  g.fillStyle = LIME;
  g.fillRect(W * 0.3 + ch * 0.2, ch / 2 - s * 0.3, s * 0.6, s * 0.6);
  g.fillStyle = '#3a3a3a';
  g.fillRect(W * 0.3 + ch * 0.55, ch / 2 - 1, W * 0.16, 2);
}
function nav(g, W, H, y, u) {
  g.fillStyle = L4;
  g.fillRect(W * 0.05, y, 46 * u, 10 * u);
  for (let i = 0; i < 4; i++) { g.fillStyle = L3; g.fillRect(W * 0.46 + i * 52 * u, y + 2 * u, 34 * u, 5 * u); }
  g.fillStyle = LIME;
  g.fillRect(W * 0.95 - 64 * u, y - 6 * u, 64 * u, 22 * u);
  g.fillStyle = L1;
  g.fillRect(0, y + 26 * u, W, 1 * u);
}
function textLines(g, x, y, w, n, u, color = L2, h = 5, gap = 9) {
  g.fillStyle = color;
  for (let i = 0; i < n; i++) g.fillRect(x, y + i * gap * u, w * (i === n - 1 ? 0.6 : 0.92 + ((i * 37) % 9) / 100), h * u);
}
function img(g, x, y, w, h, u, accent, seed = 1) {
  const r = rng(seed);
  const grd = g.createLinearGradient(x, y, x + w, y + h);
  grd.addColorStop(0, '#242424');
  grd.addColorStop(1, '#121212');
  g.fillStyle = grd;
  g.fillRect(x, y, w, h);
  g.fillStyle = '#323232';
  g.fillRect(x + w * 0.12, y + h * 0.5, w * 0.5, h * 0.36);
  g.fillStyle = accent ? LIME : '#4a4a4a';
  const s = Math.min(w, h) * (0.22 + r() * 0.08);
  g.fillRect(x + w * (0.58 + r() * 0.1), y + h * (0.16 + r() * 0.1), s, s);
  g.strokeStyle = '#3e3e3e';
  g.lineWidth = 1.5 * u;
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}
function button(g, x, y, w, h, u, fill = LIME) {
  if (fill) { g.fillStyle = fill; g.fillRect(x, y, w, h); g.fillStyle = BG; g.fillRect(x + w * 0.18, y + h / 2 - 2 * u, w * 0.5, 4 * u); g.fillRect(x + w - h * 0.62, y + h / 2 - 2 * u, h * 0.28, 4 * u); } else {
    g.strokeStyle = L3; g.lineWidth = 1.5 * u; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); g.fillStyle = L3; g.fillRect(x + w * 0.18, y + h / 2 - 2 * u, w * 0.5, 4 * u);
  }
}

const PAGES = {
  landing(g, W, H, u) {
    nav(g, W, H, H * CHROME + 22 * u, u);
    const y0 = H * 0.22;
    g.fillStyle = LIME; g.fillRect(W * 0.05, y0, 8 * u, 8 * u);
    g.fillStyle = L3; g.fillRect(W * 0.05 + 14 * u, y0 + 1 * u, 90 * u, 6 * u);
    g.fillStyle = '#e6e6e6';
    [0.5, 0.42, 0.46].forEach((w, i) => g.fillRect(W * 0.05, y0 + 24 * u + i * 40 * u, W * w, 28 * u));
    textLines(g, W * 0.05, y0 + 152 * u, W * 0.4, 3, u, L2, 6, 13);
    button(g, W * 0.05, y0 + 206 * u, 150 * u, 38 * u, u);
    button(g, W * 0.05 + 162 * u, y0 + 206 * u, 130 * u, 38 * u, u, null);
    img(g, W * 0.6, y0, W * 0.35, H * 0.52, u, true, 3);
    for (let i = 0; i < 4; i++) {
      g.fillStyle = L1; g.fillRect(W * 0.05 + i * W * 0.225, H * 0.86, W * 0.2, 1 * u);
      g.fillStyle = i === 0 ? LIME : L3; g.fillRect(W * 0.05 + i * W * 0.225, H * 0.88, 40 * u, 14 * u);
      g.fillStyle = L2; g.fillRect(W * 0.05 + i * W * 0.225, H * 0.88 + 22 * u, W * 0.14, 5 * u);
    }
  },
  shop(g, W, H, u) {
    nav(g, W, H, H * CHROME + 22 * u, u);
    const y0 = H * 0.2;
    g.fillStyle = '#e6e6e6'; g.fillRect(W * 0.05, y0, W * 0.3, 20 * u);
    for (let i = 0; i < 5; i++) { g.strokeStyle = i === 1 ? LIME : L2; g.lineWidth = 1.5 * u; g.strokeRect(W * 0.05 + i * 86 * u + 0.5, y0 + 34 * u, 76 * u, 22 * u); }
    const cw = (W * 0.9 - 2 * 18 * u) / 3;
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        const x = W * 0.05 + c * (cw + 18 * u);
        const y = y0 + 74 * u + r * H * 0.36;
        img(g, x, y, cw, H * 0.2, u, r === 0 && c === 1, 10 + r * 3 + c);
        g.fillStyle = L3; g.fillRect(x, y + H * 0.2 + 10 * u, cw * 0.6, 6 * u);
        g.fillStyle = L4; g.fillRect(x, y + H * 0.2 + 24 * u, cw * 0.25, 9 * u);
        g.fillStyle = (r + c) % 3 === 0 ? LIME : L2; g.fillRect(x + cw - 30 * u, y + H * 0.2 + 12 * u, 30 * u, 22 * u);
        if ((r + c) % 3 === 0) { g.fillStyle = BG; g.fillRect(x + cw - 20 * u, y + H * 0.2 + 22 * u, 10 * u, 2 * u); g.fillRect(x + cw - 16 * u, y + H * 0.2 + 18 * u, 2 * u, 10 * u); }
      }
    }
  },
  checkout(g, W, H, u) {
    nav(g, W, H, H * CHROME + 22 * u, u);
    const y0 = H * 0.2;
    for (let i = 0; i < 3; i++) {
      g.fillStyle = i < 2 ? LIME : L2; g.fillRect(W * 0.05 + i * 120 * u, y0, 20 * u, 20 * u);
      g.fillStyle = i < 1 ? LIME : L2; g.fillRect(W * 0.05 + 28 * u + i * 120 * u, y0 + 9 * u, 82 * u, 2 * u);
    }
    for (let i = 0; i < 5; i++) {
      const y = y0 + 46 * u + i * 56 * u;
      const half = i === 2 || i === 3;
      g.fillStyle = L3; g.fillRect(W * 0.05, y, 70 * u, 5 * u);
      g.strokeStyle = i === 1 ? LIME : L2; g.lineWidth = 1.5 * u;
      g.strokeRect(W * 0.05 + 0.5, y + 12 * u, (half ? W * 0.24 : W * 0.5) - 1, 28 * u);
      if (half) g.strokeRect(W * 0.31 + 0.5, y + 12 * u, W * 0.24 - 1, 28 * u);
    }
    const sx = W * 0.62;
    g.fillStyle = '#121212'; g.fillRect(sx, y0 + 40 * u, W * 0.33, H * 0.6);
    g.strokeStyle = L1; g.lineWidth = 1.5 * u; g.strokeRect(sx + 0.5, y0 + 40 * u + 0.5, W * 0.33 - 1, H * 0.6 - 1);
    for (let i = 0; i < 3; i++) {
      img(g, sx + 14 * u, y0 + 56 * u + i * 50 * u, 38 * u, 38 * u, u, i === 0, 30 + i);
      g.fillStyle = L3; g.fillRect(sx + 62 * u, y0 + 62 * u + i * 50 * u, 80 * u, 5 * u);
      g.fillStyle = L4; g.fillRect(sx + W * 0.33 - 54 * u, y0 + 62 * u + i * 50 * u, 40 * u, 7 * u);
    }
    g.fillStyle = L1; g.fillRect(sx + 14 * u, y0 + 216 * u, W * 0.33 - 28 * u, 1 * u);
    g.fillStyle = L4; g.fillRect(sx + 14 * u, y0 + 230 * u, 60 * u, 9 * u); g.fillRect(sx + W * 0.33 - 84 * u, y0 + 228 * u, 70 * u, 12 * u);
    button(g, sx + 14 * u, y0 + 260 * u, W * 0.33 - 28 * u, 40 * u, u);
  },
  article(g, W, H, u) {
    nav(g, W, H, H * CHROME + 22 * u, u);
    const y0 = H * 0.2;
    g.fillStyle = LIME; g.fillRect(W * 0.2, y0, 60 * u, 8 * u);
    g.fillStyle = '#e6e6e6';
    g.fillRect(W * 0.2, y0 + 22 * u, W * 0.6, 22 * u);
    g.fillRect(W * 0.2, y0 + 52 * u, W * 0.44, 22 * u);
    g.fillStyle = L3; g.fillRect(W * 0.2, y0 + 88 * u, 140 * u, 5 * u);
    img(g, W * 0.2, y0 + 110 * u, W * 0.6, H * 0.28, u, false, 44);
    textLines(g, W * 0.2, y0 + 126 * u + H * 0.28, W * 0.6, 6, u, L2, 5, 12);
  },
  stats(g, W, H, u) {
    const ch = H * CHROME;
    g.fillStyle = '#101010'; g.fillRect(0, ch, W * 0.17, H - ch);
    for (let i = 0; i < 6; i++) { g.fillStyle = i === 1 ? LIME : L2; g.fillRect(W * 0.03, ch + 30 * u + i * 30 * u, i === 1 ? 8 * u : W * 0.1, 6 * u); }
    const x0 = W * 0.21;
    const kw = (W * 0.75 - 3 * 14 * u) / 4;
    for (let i = 0; i < 4; i++) {
      const x = x0 + i * (kw + 14 * u);
      g.strokeStyle = L1; g.lineWidth = 1.5 * u; g.strokeRect(x + 0.5, ch + 24 * u + 0.5, kw - 1, 70 * u);
      g.fillStyle = L3; g.fillRect(x + 12 * u, ch + 38 * u, kw * 0.4, 5 * u);
      g.fillStyle = i === 0 ? LIME : L4; g.fillRect(x + 12 * u, ch + 54 * u, kw * 0.55, 18 * u);
    }
    const cy = ch + 110 * u;
    const chH = H - cy - 24 * u;
    g.strokeStyle = L1; g.strokeRect(x0 + 0.5, cy + 0.5, W * 0.75 - 1, chH - 1);
    for (let i = 1; i < 4; i++) { g.fillStyle = '#1b1b1b'; g.fillRect(x0, cy + (chH * i) / 4, W * 0.75, 1 * u); }
    const n = 14;
    for (let i = 0; i < n; i++) {
      const bh = chH * (0.14 + 0.62 * Math.pow(i / (n - 1), 1.5) + 0.07 * Math.sin(i * 1.9));
      g.fillStyle = i >= n - 3 ? '#3a3a3a' : '#262626';
      g.fillRect(x0 + 16 * u + i * ((W * 0.75 - 32 * u) / n), cy + chH - bh, ((W * 0.75 - 32 * u) / n) * 0.55, bh - 1);
    }
    g.strokeStyle = LIME; g.lineWidth = 3 * u; g.beginPath();
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const y = cy + chH * (0.82 - 0.66 * Math.pow(t, 1.7) - 0.05 * Math.sin(t * 9));
      const x = x0 + 16 * u + t * (W * 0.75 - 32 * u);
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.stroke();
  },
};

// Mobile version of the landing page (portrait, status bar instead of a browser bar).
function mobile(g, W, H, u) {
  g.fillStyle = BG;
  g.fillRect(0, 0, W, H);
  g.fillStyle = BAR;
  g.fillRect(0, 0, W, H * 0.045);
  g.fillStyle = L3;
  g.fillRect(W * 0.07, H * 0.017, 26 * u, 8 * u);
  g.fillRect(W * 0.8, H * 0.017, 30 * u, 8 * u);
  const y0 = H * 0.075;
  g.fillStyle = L4;
  g.fillRect(W * 0.07, y0, 70 * u, 14 * u);
  g.fillStyle = L3;
  for (let i = 0; i < 3; i++) g.fillRect(W * 0.93 - 34 * u, y0 + i * 8 * u, 34 * u, 3 * u);
  g.fillStyle = L1;
  g.fillRect(0, y0 + 32 * u, W, 1.5 * u);
  const y1 = H * 0.17;
  g.fillStyle = LIME; g.fillRect(W * 0.07, y1, 10 * u, 10 * u);
  g.fillStyle = L3; g.fillRect(W * 0.07 + 18 * u, y1 + 2 * u, 110 * u, 6 * u);
  g.fillStyle = '#e6e6e6';
  [0.82, 0.7, 0.78].forEach((w, i) => g.fillRect(W * 0.07, y1 + 26 * u + i * 44 * u, W * w, 32 * u));
  textLines(g, W * 0.07, y1 + 168 * u, W * 0.86, 3, u, L2, 7, 16);
  button(g, W * 0.07, y1 + 228 * u, W * 0.86, 52 * u, u);
  img(g, W * 0.07, y1 + 300 * u, W * 0.86, H * 0.25, u, true, 7);
  for (let i = 0; i < 2; i++) {
    const x = W * 0.07 + i * W * 0.45;
    const y = y1 + 316 * u + H * 0.25;
    g.strokeStyle = L1; g.lineWidth = 2 * u; g.strokeRect(x + 0.5, y + 0.5, W * 0.41, H * 0.12);
    g.fillStyle = i ? L3 : LIME; g.fillRect(x + 12 * u, y + 14 * u, 34 * u, 18 * u);
    g.fillStyle = L2; g.fillRect(x + 12 * u, y + 44 * u, W * 0.25, 6 * u);
  }
}

const ORDER = ['landing', 'shop', 'checkout', 'article', 'stats', 'landing'];

export default function build(ctx) {
  const { rig, camera, palette, motion } = ctx;
  const COUNT = ctx.small ? 4 : 5;
  const PW = 2.5;
  const PH = 1.6;
  const MW = 0.74; // mobile mockup
  const MH = 1.5;
  const hq = ctx.quality === 'high' && !ctx.small;
  const texW = hq ? 1024 : 640;
  const texH = Math.round(texW * (PH / PW));

  const textures = {};
  const tex = (name) => (textures[name] ??= canvasTexture(ctx, texW, texH, (g, W, H) => {
    const u = W / 900;
    g.fillStyle = BG;
    g.fillRect(0, 0, W, H);
    PAGES[name](g, W, H, u);
    chrome(g, W, H);
  }));
  const mobileTex = canvasTexture(ctx, hq ? 400 : 280, hq ? 810 : 567, (g, W, H) => mobile(g, W, H, W / 400));

  // Page material: map + load wipe + glass sheen + spotlight + folding the browser bar away.
  const makeMat = (map, aspect, bar) => {
    const uniforms = {
      uReveal: { value: 0 },
      uHi: { value: new THREE.Vector2(0.5, 0.5) },
      uHiAmt: { value: 0 },
      uDim: { value: 1 },
      uChrome: { value: 1 },
      uAspect: { value: aspect },
      uBar: { value: bar },
      uSheen: { value: 0 },
    };
    const m = new THREE.MeshBasicMaterial({ map, toneMapped: false });
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uReveal; uniform vec2 uHi; uniform float uHiAmt; uniform float uDim; uniform float uChrome; uniform float uAspect; uniform float uBar; uniform float uSheen;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          float loaded = step(1.0 - uReveal * 1.08, vMapUv.y + 0.04 * step(vMapUv.y, 1.0 - uBar));
          vec3 bg = vec3(0.0037);
          diffuseColor.rgb = mix(bg, diffuseColor.rgb, loaded);
          // fold the browser bar away when the windows join into one page
          float inBar = step(1.0 - uBar, vMapUv.y);
          diffuseColor.rgb = mix(diffuseColor.rgb, bg, inBar * (1.0 - uChrome));
          vec2 d = (vMapUv - uHi) * vec2(uAspect, 1.0);
          float spot = exp(-dot(d, d) * 7.0) * uHiAmt;
          // glass: a soft sheen band drifting across, and a faint top-left lift
          float band = vMapUv.x * 0.7 + vMapUv.y * 0.5 - uSheen;
          float sheen = exp(-band * band * 60.0) * 0.035 + (1.0 - vMapUv.x) * vMapUv.y * 0.012;
          diffuseColor.rgb = diffuseColor.rgb * (uDim + spot * 0.08) + vec3(0.016) * spot + vec3(sheen) * uDim;`);
    };
    m.customProgramCacheKey = () => 'grow-panel';
    m.userData.uniforms = uniforms;
    return m;
  };

  const sideMat = new THREE.MeshStandardMaterial({ color: '#121212', roughness: 0.6, metalness: 0.3 });
  const deck = new THREE.Group();
  rig.add(deck);
  const panels = [];
  const addPanel = (map, w, h, opts) => {
    const face = makeMat(map, w / h, opts.mobile ? 0 : CHROME);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), [sideMat, sideMat, sideMat, sideMat, face, sideMat]);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, h)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, toneMapped: false }));
    edge.position.z = 0.016;
    mesh.add(edge);
    const holder = new THREE.Group();
    holder.add(mesh);
    deck.add(holder);
    const p = { holder, mesh, edge, w, h, u: face.userData.uniforms, tilt: new THREE.Vector2(), hover: 0, ...opts };
    panels.push(p);
    return p;
  };
  // Windows, back to front: a cascade from back-right-high to front-left-low.
  for (let i = 0; i < COUNT; i++) {
    const j = COUNT - 1 - i; // 0 = front
    addPanel(tex(ORDER[j % ORDER.length]), PW, PH, {
      deck: new THREE.Vector3(j * 0.5, j * 0.34, -j * 0.85),
      depth: (i + 1) / COUNT,
      phase: i * 1.37,
      delay: 0.1 + j * 0.16,
      section: j,
    });
  }
  const front = panels[COUNT - 1];
  // Mobile mockup in front of the landing window, to its right.
  addPanel(mobileTex, MW, MH, {
    deck: new THREE.Vector3(PW * 0.5 + 0.3, -0.28, 1.05),
    depth: 1.2,
    phase: 2.4,
    delay: 0.75,
    mobile: true,
  });
  // Recentre the cascade.
  const centre = new THREE.Vector3();
  panels.forEach((p) => centre.add(p.deck));
  centre.divideScalar(panels.length);
  panels.forEach((p) => p.deck.sub(centre));

  // Cursor that works the front page (a small arrow + click ripple).
  const curTex = canvasTexture(ctx, 64, 64, (g) => {
    g.fillStyle = '#f2f2f2';
    g.strokeStyle = '#000';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(8, 4); g.lineTo(8, 50); g.lineTo(20, 39); g.lineTo(29, 58); g.lineTo(37, 54); g.lineTo(28, 36); g.lineTo(44, 36);
    g.closePath(); g.stroke(); g.fill();
  });
  const cursor = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.14), new THREE.MeshBasicMaterial({ map: curTex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  cursor.geometry.translate(0.07 - 0.0175, -0.07 + 0.009, 0);
  front.mesh.add(cursor);
  const ripple = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(0.2, 0.2)),
    new THREE.LineBasicMaterial({ color: palette.lime, transparent: true, opacity: 0, toneMapped: false }),
  );
  front.mesh.add(ripple);
  // Cursor path in page uv: hero headline -> CTA (click) -> image -> back.
  const stops = [[0.32, 0.52], [0.13, 0.44], [0.13, 0.44], [0.75, 0.55], [0.5, 0.15], [0.32, 0.52]];
  const uvToLocal = (x, y, out) => out.set((x - 0.5) * PW, (y - 0.5) * PH, 0.03);

  // ---------- lights ----------
  look(ctx, { exposure: 1.05 });
  tuneLights(ctx, { ambient: 0.3, key: 1.2, rim: 14, env: 0.5 });

  // ---------- state ----------
  const pointer = localPointer(ctx);
  const raycaster = new THREE.Raycaster();
  const meshes = panels.map((p) => p.mesh);
  const ndc = new THREE.Vector2();
  const pagePos = new THREE.Vector3();
  const v = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const lime = palette.lime.clone();
  const white = new THREE.Color(0xffffff);
  const qDeck = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.08, -0.52, 0.02));
  const qPage = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.06, -0.3, 0));
  const qPhone = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.04, -0.62, 0));
  const e = new THREE.Euler();
  const target = new THREE.Vector3();
  const PAGE_S = 0.6; // scale of the assembled page
  let hovered = -1;

  function layout(w, h) {
    frame(ctx, w, h, {
      extent: [2.8, 2.0],
      desk: { x: 0.735, y: 0.5, size: 0.76 },
      phone: { x: 0.5, y: 0.24, size: 1.0, maxH: 0.4 },
    });
    pointer.measure?.();
  }

  return {
    bloom: { strength: 0.35, radius: 0.3, threshold: 0.92 },
    resize: (w, h) => layout(w, h),
    update(time, scroll, sp, dt) {
      const T = motion ? time : 30;
      pointer.update(dt);
      const u = clamp(scroll / 0.6);

      target.set(0, 0, 0);
      camera.position.set(0, 0, 9);
      camera.lookAt(target);
      camera.updateMatrixWorld();
      shiftFrame(ctx, 0, scroll * 0.38);

      // Which panel is under the pointer.
      hovered = -1;
      let hitUv = null;
      if (pointer.on > 0.05) {
        ndc.set(pointer.x, pointer.y);
        raycaster.setFromCamera(ndc, camera);
        deck.updateMatrixWorld(true);
        const hits = raycaster.intersectObjects(meshes, false);
        const h = hits.find((x) => x.face && x.face.materialIndex === 4);
        if (h) {
          hovered = meshes.indexOf(h.object);
          hitUv = h.uv;
        }
      }

      const kk = motion ? damp(6, dt) : 1;
      const sheen = motion ? ((T * 0.08) % 1.6) - 0.2 : 0.4;
      for (let i = 0; i < panels.length; i++) {
        const p = panels[i];
        const kin = easeOutCubic((T - p.delay) / 1.1);
        // deck pose with pointer parallax (nearer panels move more) and float
        const par = (0.25 + p.depth) * 0.22;
        v.copy(p.deck);
        v.x += sp.x * par;
        v.y -= sp.y * par * 0.7;
        v.y += Math.sin(T * 0.7 + p.phase) * 0.04 - (1 - kin) * 2.2;
        v.z -= (1 - kin) * 0.8;
        // page pose: the windows become the sections of one page (landing on top); the phone
        // stands beside it showing the same page
        let gi;
        if (p.mobile) {
          pagePos.set(PW * PAGE_S * 0.5 + 0.55, 0.15, 0.75);
          gi = easeInOutCubic(smooth(0.1, 0.8, u));
          p.holder.quaternion.slerpQuaternions(qDeck, qPhone, gi);
        } else {
          pagePos.set(-0.25, ((COUNT - 1) / 2 - p.section) * PH * 0.985 * PAGE_S, 0.4);
          gi = easeInOutCubic(smooth(p.section * 0.05, 0.7 + p.section * 0.05, u));
          p.holder.quaternion.slerpQuaternions(qDeck, qPage, gi);
        }
        p.holder.position.lerpVectors(v, pagePos, gi);
        p.holder.scale.setScalar(lerp(1, p.mobile ? 0.85 : PAGE_S, gi) * (0.4 + 0.6 * kin));

        // hover tilt / lift / spotlight
        const on = i === hovered ? 1 : 0;
        p.hover += (on - p.hover) * kk;
        if (on && hitUv) {
          p.tilt.x += ((hitUv.y - 0.5) * -0.32 - p.tilt.x) * kk;
          p.tilt.y += ((hitUv.x - 0.5) * 0.4 - p.tilt.y) * kk;
          p.u.uHi.value.lerp(hitUv, motion ? damp(14, dt) : 1);
        } else {
          p.tilt.multiplyScalar(1 - kk);
        }
        p.mesh.quaternion.setFromEuler(e.set(p.tilt.x * p.hover, p.tilt.y * p.hover, 0));
        p.mesh.position.z = p.hover * 0.18 * (1 - gi);
        p.u.uHiAmt.value = p.hover;
        p.u.uReveal.value = smooth(p.delay + 0.35, p.delay + 1.25, T);
        p.u.uChrome.value = p.mobile ? 1 : 1 - smooth(0.5, 0.95, gi) * (p.section > 0 ? 1 : 0);
        p.u.uDim.value = lerp(p.mobile ? 1 : 0.62 + 0.38 * p.depth, 1, gi) * (1 - (hovered >= 0 && i !== hovered ? 0.12 : 0));
        p.u.uSheen.value = sheen - p.depth * 0.15;
        p.edge.material.color.copy(white).lerp(lime, p.hover);
        p.edge.material.opacity = (0.16 + 0.5 * p.hover + (p === front || p.mobile ? 0.12 : 0)) * kin * (1 - gi * 0.6);
      }

      // Front-page cursor loop (8s): glide between stops, click the CTA.
      const cyc = ((((T - 2.2) / 8) % 1) + 1) % 1;
      const segs = stops.length - 1;
      const f = cyc * segs;
      const si = clamp(Math.floor(f), 0, segs - 1);
      const sf = easeInOutCubic(f - si);
      const a = stops[si];
      const b = stops[si + 1];
      uvToLocal(lerp(a[0], b[0], sf), lerp(a[1], b[1], sf), v2);
      cursor.position.copy(v2);
      const showCur = motion && T > 2.2 ? smooth(0, 0.04, cyc) * smooth(1, 0.96, cyc) * (1 - u * 3) * (1 - front.hover) : 0;
      cursor.material.opacity = clamp(showCur);
      const click = si === 1 ? sf : 0;
      uvToLocal(0.13, 0.44, ripple.position);
      ripple.position.z = 0.025;
      ripple.scale.setScalar(0.4 + click * 1.4);
      ripple.material.opacity = click > 0 ? (1 - click) * clamp(showCur) : 0;
      cursor.scale.setScalar(click > 0 && click < 0.25 ? 0.85 : 1);
    },
    dispose() {
      pointer.dispose();
    },
  };
}
