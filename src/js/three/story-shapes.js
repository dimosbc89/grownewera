// Procedural target shapes for the scroll-story particles (story.js). Every generator fills
// `count` points as [x, y, z, accent] (accent 0 = white, 1 = acid lime) inside a ~3.8 unit box,
// y up. Icons and glyphs are drawn on an offscreen 2D canvas (the brand font for text) and sampled
// from the filled pixels, edges weighted so outlines read crisply; 3D forms are sampled from
// surfaces. No three.js here: plain arrays, so this stays cheap to generate in idle time.

// Shape sets per [data-story] value. Steps map onto these in order (see sequence()).
export const SETS = {
  growth: ['scatter', 'sphere', 'rings', 'barGrid', 'helixArrow', 'growWord'],
  ads: ['search', 'funnel', 'bars', 'target', 'euro'],
  seo: ['scatter', 'pages', 'stairs', 'podium', 'lineChart'],
  build: ['browser', 'layout', 'bag', 'check'],
  social: ['phone', 'heart', 'network', 'play'],
  booth: ['floorGrid', 'booth', 'crowd', 'arrowUpRight'],
  company: ['sphere', 'pillars', 'gGlyph'],
  contact: ['globe', 'pin', 'envelope'],
  case: ['bars', 'arrowUp', 'percent'],
};

// Steps -> shapes: fewer steps than shapes pick evenly spread shapes (always starting on the first);
// more steps cycle through the set (each repeat is a variant: turned and re-dealt); the last step
// always ends on the set's last shape.
export function sequence(set, steps) {
  const shapes = SETS[set] ?? SETS.growth;
  const n = Math.max(1, steps | 0);
  const last = shapes[shapes.length - 1];
  if (n === 1) return [{ shape: last, variant: 0 }];
  const pool = shapes.slice(0, -1);
  const out = [];
  if (!pool.length) {
    for (let k = 0; k < n - 1; k++) out.push({ shape: last, variant: n - 1 - k });
  } else if (n - 1 <= pool.length) {
    for (let k = 0; k < n - 1; k++) {
      out.push({ shape: pool[n === 2 ? 0 : Math.round((k * (pool.length - 1)) / (n - 2))], variant: 0 });
    }
  } else {
    for (let k = 0; k < n - 1; k++) out.push({ shape: pool[k % pool.length], variant: Math.floor(k / pool.length) });
  }
  out.push({ shape: last, variant: 0 });
  return out;
}

// Flat shapes (icons, glyphs) turn to face the camera; the others may spin slowly.
export const FLAT = new Set([
  'scatter', 'rings', 'growWord', 'search', 'bars', 'target', 'euro', 'pages', 'podium', 'lineChart', 'browser', 'layout',
  'bag', 'check', 'phone', 'heart', 'play', 'arrowUpRight', 'gGlyph', 'pin', 'envelope', 'arrowUp', 'percent', 'pillars',
]);

export const FONT = '"Space Grotesk Variable", "Space Grotesk", "Manrope Variable", "Arial Black", sans-serif';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------- point buffer
function buffer(count) {
  const out = new Float32Array(count * 4);
  let i = 0;
  return {
    out,
    get full() { return i >= count; },
    get left() { return count - i; },
    add(x, y, z, a = 0) {
      if (i >= count) return;
      out[i * 4] = x; out[i * 4 + 1] = y; out[i * 4 + 2] = z; out[i * 4 + 3] = a;
      i++;
    },
    // Fill whatever is left by cycling through the points already placed, with a little jitter.
    finish(rnd) {
      const have = i;
      if (!have) { while (i < count) this.add((rnd() - 0.5) * 3, (rnd() - 0.5) * 3, (rnd() - 0.5) * 3); return out; }
      for (let k = 0; i < count; k++) {
        const j = (k % have) * 4;
        this.add(out[j] + (rnd() - 0.5) * 0.03, out[j + 1] + (rnd() - 0.5) * 0.03, out[j + 2] + (rnd() - 0.5) * 0.03, out[j + 3]);
      }
      return out;
    },
  };
}

// Split `count` over weighted parts: parts = [[weight, fn(n)], ...].
function parts(count, list) {
  const total = list.reduce((s, [w]) => s + w, 0);
  let used = 0;
  list.forEach(([w, fn], k) => {
    const n = k === list.length - 1 ? count - used : Math.round((count * w) / total);
    used += n;
    if (n > 0) fn(n);
  });
}

// ---------------------------------------------------------------- 3D primitives
function line(b, n, a, c, { jitter = 0.012, accent = 0 } = {}, rnd) {
  for (let k = 0; k < n; k++) {
    const t = rnd();
    b.add(a[0] + (c[0] - a[0]) * t + (rnd() - 0.5) * jitter, a[1] + (c[1] - a[1]) * t + (rnd() - 0.5) * jitter, a[2] + (c[2] - a[2]) * t + (rnd() - 0.5) * jitter, accent);
  }
}

// Points on the surface of an axis-aligned box (centre c, size s), with edges emphasised.
function box(b, n, c, s, { edge = 0.45, accent = 0 } = {}, rnd) {
  const [sx, sy, sz] = s;
  const areas = [sy * sz, sy * sz, sx * sz, sx * sz, sx * sy, sx * sy];
  const sum = areas.reduce((p, v) => p + v, 0) || 1;
  for (let k = 0; k < n; k++) {
    let x; let y; let z;
    if (rnd() < edge) {
      // one of the 12 edges
      const e = (rnd() * 12) | 0;
      const t = rnd() - 0.5;
      const u = (e & 1) ? 0.5 : -0.5;
      const v = (e & 2) ? 0.5 : -0.5;
      if (e < 4) [x, y, z] = [t, u, v];
      else if (e < 8) [x, y, z] = [u, t, v];
      else [x, y, z] = [u, v, t];
    } else {
      let r = rnd() * sum;
      let f = 0;
      while (f < 5 && r > areas[f]) r -= areas[f++];
      const p = rnd() - 0.5;
      const q = rnd() - 0.5;
      const side = f & 1 ? 0.5 : -0.5;
      if (f < 2) [x, y, z] = [side, p, q];
      else if (f < 4) [x, y, z] = [p, side, q];
      else [x, y, z] = [p, q, side];
    }
    b.add(c[0] + x * sx, c[1] + y * sy, c[2] + z * sz, typeof accent === 'function' ? accent(y + 0.5) : accent);
  }
}

function ring(b, n, { r = 1, y = 0, z = 0, w = 0.03, plane = 'xy', accent = 0, from = 0, to = TAU } = {}, rnd) {
  for (let k = 0; k < n; k++) {
    const a = from + (to - from) * rnd();
    const rr = r + (rnd() - 0.5) * w;
    const d = (rnd() - 0.5) * w;
    if (plane === 'xy') b.add(Math.cos(a) * rr, y + Math.sin(a) * rr, z + d, accent);
    else b.add(Math.cos(a) * rr, y + d, z + Math.sin(a) * rr, accent);
  }
}

function sphereSurface(b, n, r, { accent = 0, shell = 0.02, c = [0, 0, 0] } = {}, rnd) {
  for (let k = 0; k < n; k++) {
    const u = rnd() * 2 - 1;
    const th = rnd() * TAU;
    const s = Math.sqrt(1 - u * u);
    const rr = r + (rnd() - 0.5) * shell;
    b.add(c[0] + Math.cos(th) * s * rr, c[1] + u * rr, c[2] + Math.sin(th) * s * rr, accent);
  }
}

// ---------------------------------------------------------------- 2D canvas masks
let scratch = null;
const SIZE = 384;
// Draws with `draw(g, S)` on an S x S canvas: red marks the shape, blue (in addition) its lime
// accent. Returns { fill: [px...], edge: [px...], acc: Uint8Array, S } (pixel indices).
function mask(draw) {
  if (!scratch) {
    scratch = document.createElement('canvas');
    scratch.width = SIZE;
    scratch.height = SIZE;
  }
  const g = scratch.getContext('2d', { willReadFrequently: true });
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, SIZE, SIZE);
  g.lineCap = 'butt';
  g.lineJoin = 'miter';
  g.fillStyle = 'rgb(255,0,0)';
  g.strokeStyle = 'rgb(255,0,0)';
  draw(g, SIZE);
  const d = g.getImageData(0, 0, SIZE, SIZE).data;
  const on = new Uint8Array(SIZE * SIZE);
  const acc = new Uint8Array(SIZE * SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) {
    on[i] = d[i * 4 + 3] > 110 && d[i * 4] > 110 ? 1 : 0;
    acc[i] = d[i * 4 + 2] > 110 ? 1 : 0;
  }
  const fill = [];
  const edge = [];
  for (let y = 1; y < SIZE - 1; y++) {
    for (let x = 1; x < SIZE - 1; x++) {
      const i = y * SIZE + x;
      if (!on[i]) continue;
      if (!on[i - 1] || !on[i + 1] || !on[i - SIZE] || !on[i + SIZE]) edge.push(i);
      else fill.push(i);
    }
  }
  return { fill, edge, acc, S: SIZE };
}

// Samples a mask into the buffer: `size` = world width of the S px canvas, `depth` = slab
// thickness (front face denser), `edge` = share of points on the outline.
function fromMask(b, n, m, { size = 3.8, depth = 0.22, edge = 0.5, dy = 0, dz = 0, accent = null } = {}, rnd) {
  const { fill, edge: rim, acc, S } = m;
  if (!fill.length && !rim.length) return;
  const k = size / S;
  for (let j = 0; j < n; j++) {
    const onEdge = rim.length && (rnd() < edge || !fill.length);
    const list = onEdge ? rim : fill;
    const i = list[(rnd() * list.length) | 0];
    const px = (i % S) + rnd();
    const py = ((i / S) | 0) + rnd();
    let z;
    if (onEdge) z = (rnd() - 0.5) * depth;
    else z = (rnd() < 0.78 ? 0.5 : -0.5) * depth + (rnd() - 0.5) * depth * 0.15;
    const a = accent ? accent(px / S, py / S, acc[i], onEdge) : acc[i];
    b.add((px - S / 2) * k, (S / 2 - py) * k + dy, z + dz, a);
  }
}

// Text in the brand font, scaled to fit `fit` (0..1) of the canvas width.
function text(g, S, str, { weight = 700, fit = 0.9, maxH = 0.7, y = 0.5, accentFrom = Infinity, track = -0.02 } = {}) {
  let px = 200;
  g.font = `${weight} ${px}px ${FONT}`;
  const w0 = measure(g, str, px * track);
  px = Math.min((px * S * fit) / w0, S * maxH);
  g.font = `${weight} ${px}px ${FONT}`;
  g.textBaseline = 'alphabetic';
  const chars = [...str];
  const total = measure(g, str, px * track);
  let x = (S - total) / 2;
  const base = S * y + px * 0.35;
  chars.forEach((ch, i) => {
    g.fillStyle = i >= accentFrom ? 'rgb(255,0,255)' : 'rgb(255,0,0)';
    g.fillText(ch, x, base);
    x += g.measureText(ch).width + px * track;
  });
}
function measure(g, str, track) {
  let w = 0;
  for (const ch of str) w += g.measureText(ch).width + track;
  return w - track;
}

const LIME = 'rgb(255,0,255)';

// ---------------------------------------------------------------- generators
// (count, rnd) -> Float32Array(count * 4)
const G = {
  // A drifting, slightly flattened nebula: the "before" state.
  scatter(count, rnd) {
    const b = buffer(count);
    for (let k = 0; k < count; k++) {
      const arm = rnd() < 0.55;
      if (arm) {
        // loose spiral arms, like a galaxy seen at an angle
        const t = rnd();
        const a = t * 5.2 + (k % 3) * (TAU / 3) + (rnd() - 0.5) * 0.7;
        const r = 0.25 + t * 2.1;
        // disk tilted ~50deg towards the viewer (scatter faces the camera like the flat shapes)
        const dx = Math.cos(a) * r;
        const dz = Math.sin(a) * r;
        const th = (rnd() - 0.5) * 0.35 * (1.2 - t);
        b.add(dx, dz * 0.64 + th * 0.77, -dz * 0.77 + th * 0.64, 0);
      } else {
        const u = rnd() * 2 - 1;
        const th = rnd() * TAU;
        const s = Math.sqrt(1 - u * u);
        const r = 0.6 + 2.2 * Math.sqrt(rnd());
        b.add(Math.cos(th) * s * r, u * r * 0.55, Math.sin(th) * s * r * 0.8, 0);
      }
    }
    return b.finish(rnd);
  },

  sphere(count, rnd) {
    const b = buffer(count);
    parts(count, [
      [0.78, (n) => {
        const g = Math.PI * (3 - Math.sqrt(5));
        for (let i = 0; i < n; i++) {
          const y = 1 - ((i + 0.5) / n) * 2;
          const r = Math.sqrt(1 - y * y);
          const R = 1.5 + (rnd() - 0.5) * 0.025;
          b.add(Math.cos(g * i) * r * R, y * R, Math.sin(g * i) * r * R, 0);
        }
      }],
      // a tilted lime orbit
      [0.16, (n) => {
        for (let i = 0; i < n; i++) {
          const a = rnd() * TAU;
          const r = 2.05 + (rnd() - 0.5) * 0.05;
          const x = Math.cos(a) * r;
          const z = Math.sin(a) * r;
          b.add(x, z * 0.28 + x * 0.12, z * 0.96, 1);
        }
      }],
      [0.06, (n) => sphereSurface(b, n, 0.35, { shell: 0.5, accent: 1 }, rnd)],
    ]);
    return b.finish(rnd);
  },

  rings(count, rnd) {
    const b = buffer(count);
    const R = [0.42, 0.86, 1.3, 1.74];
    parts(count, [
      ...R.map((r, i) => [r * (i === 3 ? 1.1 : 1), (n) => ring(b, n, { r, z: -i * 0.18, w: 0.05, accent: i === 1 ? 1 : 0 }, rnd)]),
      [0.18, (n) => { for (let k = 0; k < n; k++) { const a = rnd() * TAU; const r = 0.17 * Math.sqrt(rnd()); b.add(Math.cos(a) * r, Math.sin(a) * r, 0.08, 1); } }],
      // crosshair ticks
      [0.22, (n) => {
        const t = [[[-2.05, 0, 0], [-1.5, 0, 0]], [[1.5, 0, 0], [2.05, 0, 0]], [[0, -2.05, 0], [0, -1.5, 0]], [[0, 1.5, 0], [0, 2.05, 0]]];
        parts(n, t.map(([a, c]) => [1, (m) => line(b, m, a, c, {}, rnd)]));
      }],
    ]);
    return b.finish(rnd);
  },

  // ads "target": rings with a dart in the bullseye
  target(count, rnd) {
    const b = buffer(count);
    parts(count, [
      [0.78, (n) => {
        const R = [0.45, 0.9, 1.35, 1.8];
        parts(n, [
          ...R.map((r, i) => [r, (m) => ring(b, m, { r, w: 0.05, z: 0, accent: 0 }, rnd)]),
          [0.25, (m) => { for (let k = 0; k < m; k++) { const a = rnd() * TAU; const r = 0.2 * Math.sqrt(rnd()); b.add(Math.cos(a) * r, Math.sin(a) * r, 0.02, 1); } }],
        ]);
      }],
      // the dart: shaft from the upper right into the centre, with fins
      [0.22, (n) => parts(n, [
        [0.6, (m) => line(b, m, [0.05, 0.05, 0.1], [1.25, 1.25, 1.1], { accent: 1, jitter: 0.03 }, rnd)],
        [0.2, (m) => line(b, m, [1.1, 1.1, 0.95], [1.5, 0.95, 1.2], { accent: 1, jitter: 0.02 }, rnd)],
        [0.2, (m) => line(b, m, [1.1, 1.1, 0.95], [0.95, 1.5, 1.2], { accent: 1, jitter: 0.02 }, rnd)],
      ])],
    ]);
    return b.finish(rnd);
  },

  barGrid(count, rnd) {
    const b = buffer(count);
    const nx = 7;
    const nz = 5;
    const bars = [];
    for (let x = 0; x < nx; x++) {
      for (let z = 0; z < nz; z++) {
        const h = 0.25 + ((x / (nx - 1)) * 0.75 + (1 - z / (nz - 1)) * 0.25) * 2.75 * (0.82 + 0.18 * Math.sin(x * 1.7 + z));
        bars.push({ x: (x - (nx - 1) / 2) * 0.5, z: (z - (nz - 1) / 2) * 0.5, h });
      }
    }
    const maxH = Math.max(...bars.map((q) => q.h));
    parts(count, [
      [0.92, (n) => parts(n, bars.map((q) => [q.h + 0.3, (m) => box(b, m, [q.x, -1.55 + q.h / 2, q.z], [0.3, q.h, 0.3], {
        edge: 0.55, accent: q.h > maxH * 0.78 ? (t) => (t > 0.45 ? 1 : 0) : 0,
      }, rnd)]))],
      // floor plate outline
      [0.08, (n) => box(b, n, [0, -1.6, 0], [3.7, 0.01, 2.7], { edge: 1 }, rnd)],
    ]);
    return b.finish(rnd);
  },

  // a double helix rising into a lime arrowhead
  helixArrow(count, rnd) {
    const b = buffer(count);
    parts(count, [
      [0.66, (n) => {
        for (let k = 0; k < n; k++) {
          const t = rnd();
          const strand = k & 1;
          const a = t * TAU * 2.6 + strand * Math.PI;
          const r = 0.42 + t * 0.38;
          const y = -1.85 + t * 2.75;
          b.add(Math.cos(a) * r + (rnd() - 0.5) * 0.05, y, Math.sin(a) * r + (rnd() - 0.5) * 0.05, t > 0.8 ? 1 : 0);
        }
      }],
      // rungs
      [0.12, (n) => {
        for (let k = 0; k < n; k++) {
          const i = (rnd() * 14) | 0;
          const t = (i + 0.5) / 14;
          const a = t * TAU * 2.6;
          const r = 0.42 + t * 0.38;
          const y = -1.85 + t * 2.75;
          const s = rnd() * 2 - 1;
          b.add(Math.cos(a) * r * s, y, Math.sin(a) * r * s, 0);
        }
      }],
      // arrowhead: a lime cone drawn mostly by its rim and eight ribs, lightly filled
      [0.2, (n) => {
        for (let k = 0; k < n; k++) {
          const q = rnd();
          let a = rnd() * TAU;
          let h = Math.sqrt(rnd());
          if (q < 0.3) h = 1 - rnd() * 0.03; // base rim
          else if (q < 0.62) a = Math.round((a / TAU) * 8) * (TAU / 8) + (rnd() - 0.5) * 0.04; // ribs
          const r = 1.05 * h;
          b.add(Math.cos(a) * r, 2.0 - h * 1.05, Math.sin(a) * r, 1);
        }
      }],
    ]);
    return b.finish(rnd);
  },

  growWord(count, rnd) {
    const b = buffer(count);
    const m = mask((g, S) => text(g, S, 'GROW.', { fit: 0.94, accentFrom: 4, y: 0.5 }));
    fromMask(b, count, m, { size: 4.1, depth: 0.32, edge: 0.42 }, rnd);
    return b.finish(rnd);
  },

  gGlyph(count, rnd) {
    const b = buffer(count);
    const m = mask((g, S) => text(g, S, 'G', { fit: 0.7, maxH: 0.82, y: 0.47 }));
    fromMask(b, count, m, { size: 3.9, depth: 0.42, edge: 0.5, accent: (u, v, a, rim) => (rim && rnd() < 0.85 ? 1 : 0) }, rnd);
    return b.finish(rnd);
  },

  euro(count, rnd) {
    const b = buffer(count);
    const m = mask((g, S) => text(g, S, '€', { fit: 0.62, maxH: 0.85, y: 0.46 }));
    fromMask(b, count, m, { size: 3.8, depth: 0.4, edge: 0.5, accent: () => 1 }, rnd);
    return b.finish(rnd);
  },

  percent(count, rnd) {
    const b = buffer(count);
    const m = mask((g, S) => text(g, S, '%', { fit: 0.66, maxH: 0.85, y: 0.46 }));
    fromMask(b, count, m, { size: 3.8, depth: 0.4, edge: 0.5, accent: (u, v) => (v < 0.5 && u > 0.45 ? 1 : 0) }, rnd);
    return b.finish(rnd);
  },

  search(count, rnd) {
    const b = buffer(count);
    const m = mask((g, S) => {
      const w = S * 0.9;
      const h = S * 0.17;
      const x = (S - w) / 2;
      const y = S * 0.42;
      g.lineWidth = S * 0.012;
      g.strokeRect(x, y, w, h);
      // typed query: three word blocks + caret
      g.fillRect(x + S * 0.05, y + h * 0.42, S * 0.17, h * 0.16);
      g.fillRect(x + S * 0.25, y + h * 0.42, S * 0.12, h * 0.16);
      g.fillRect(x + S * 0.4, y + h * 0.42, S * 0.2, h * 0.16);
      g.fillStyle = LIME;
      g.fillRect(x + S * 0.63, y + h * 0.22, S * 0.008, h * 0.56);
      // magnifier (lime) at the right end
      g.strokeStyle = LIME;
      g.lineWidth = S * 0.016;
      g.beginPath();
      g.arc(x + w - S * 0.1, y + h * 0.46, h * 0.24, 0, TAU);
      g.stroke();
      g.beginPath();
      g.moveTo(x + w - S * 0.1 + h * 0.17, y + h * 0.63);
      g.lineTo(x + w - S * 0.1 + h * 0.36, y + h * 0.82);
      g.stroke();
      // results below
      g.fillStyle = 'rgb(255,0,0)';
      for (let i = 0; i < 3; i++) {
        g.fillRect(x, y + h * (1.5 + i * 0.75), w * (0.62 - i * 0.12), h * 0.12);
        g.fillRect(x, y + h * (1.75 + i * 0.75), w * (0.4 - i * 0.06), h * 0.07);
      }
    });
    fromMask(b, count, m, { size: 4, depth: 0.2, edge: 0.55, dy: 0.25 }, rnd);
    return b.finish(rnd);
  },

  funnel(count, rnd) {
    const b = buffer(count);
    const top = 1.25;
    const neck = -0.75;
    parts(count, [
      // conical wall with horizontal bands
      [0.6, (n) => {
        for (let k = 0; k < n; k++) {
          const band = rnd() < 0.55;
          let t = rnd();
          if (band) t = Math.round(t * 6) / 6 + (rnd() - 0.5) * 0.012;
          const y = neck + (top - neck) * t;
          const r = 0.28 + t * 1.45;
          const a = rnd() * TAU;
          b.add(Math.cos(a) * r, y, Math.sin(a) * r, 0);
        }
      }],
      // spout
      [0.1, (n) => { for (let k = 0; k < n; k++) { const a = rnd() * TAU; b.add(Math.cos(a) * 0.28, neck - rnd() * 0.75, Math.sin(a) * 0.28, 0); } }],
      // leads pouring in at the top, converted (lime) drops coming out of the bottom
      [0.18, (n) => { for (let k = 0; k < n; k++) { const a = rnd() * TAU; const r = 1.6 * Math.sqrt(rnd()); b.add(Math.cos(a) * r, top + 0.15 + rnd() * 0.45, Math.sin(a) * r, 0); } }],
      [0.12, (n) => { for (let k = 0; k < n; k++) { const a = rnd() * TAU; const r = 0.12 * Math.sqrt(rnd()); b.add(Math.cos(a) * r, -1.6 - rnd() * 0.5, Math.sin(a) * r, 1); } }],
    ]);
    return b.finish(rnd);
  },

  bars(count, rnd) {
    const b = buffer(count);
    const H = [0.55, 0.95, 0.8, 1.45, 1.95, 2.8];
    parts(count, [
      ...H.map((h, i) => [h + 0.4, (n) => box(b, n, [-1.6 + i * 0.64, -1.45 + h / 2, 0], [0.42, h, 0.42], { edge: 0.6, accent: i === H.length - 1 ? 1 : 0 }, rnd)]),
      [0.5, (n) => line(b, n, [-2.05, -1.47, 0], [2.05, -1.47, 0], {}, rnd)],
    ]);
    return b.finish(rnd);
  },

  pages(count, rnd) {
    const b = buffer(count);
    const m = mask((g, S) => {
      const cw = S * 0.26;
      const ch = S * 0.34;
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) {
          const x = S * 0.07 + c * S * 0.31;
          const y = S * 0.12 + r * S * 0.41;
          const lime = r === 0 && c === 2;
          g.fillStyle = lime ? LIME : 'rgb(255,0,0)';
          g.strokeStyle = g.fillStyle;
          g.lineWidth = S * 0.008;
          g.strokeRect(x, y, cw, ch);
          g.fillRect(x + cw * 0.12, y + ch * 0.12, cw * 0.5, ch * 0.08);
          for (let l = 0; l < 4; l++) g.fillRect(x + cw * 0.12, y + ch * (0.34 + l * 0.14), cw * (0.76 - (l % 2) * 0.2), ch * 0.04);
        }
      }
    });
    // pages fanned on a slight tilt, each row at its own depth
    fromMask(b, count, m, { size: 4.1, depth: 0.1, edge: 0.6 }, rnd);
    const out = b.finish(rnd);
    for (let i = 0; i < count; i++) out[i * 4 + 2] += out[i * 4 + 1] * -0.25 + out[i * 4] * 0.08;
    return out;
  },

  stairs(count, rnd) {
    const b = buffer(count);
    const n = 6;
    parts(count, Array.from({ length: n }, (_, i) => [1 + i * 0.35, (m) => {
      const h = 0.45 + i * 0.45;
      box(b, m, [-1.5 + i * 0.6, -1.6 + h / 2, 0], [0.58, h, 1], { edge: 0.6, accent: i === n - 1 ? (t) => (t > 0.85 ? 1 : 0) : 0 }, rnd);
    }]));
    return b.finish(rnd);
  },

  podium(count, rnd) {
    const b = buffer(count);
    parts(count, [
      [1.2, (n) => box(b, n, [-1.2, -1.35, 0], [1.15, 0.9, 1], { edge: 0.6 }, rnd)],
      [1.6, (n) => box(b, n, [0, -1.0, 0], [1.15, 1.6, 1], { edge: 0.6, accent: (t) => (t > 0.94 ? 1 : 0) }, rnd)],
      [1.0, (n) => box(b, n, [1.2, -1.5, 0], [1.15, 0.6, 1], { edge: 0.6 }, rnd)],
      [1.7, (n) => {
        const m = mask((g, S) => text(g, S, '#1', { fit: 0.6, maxH: 0.5, y: 0.5, accentFrom: 1 }));
        fromMask(b, n, m, { size: 3.0, depth: 0.25, edge: 0.5, dy: 1.15 }, rnd);
      }],
    ]);
    return b.finish(rnd);
  },

  lineChart(count, rnd) {
    const b = buffer(count);
    const P = [[-1.8, -1.25], [-1.1, -0.9], [-0.45, -1.0], [0.2, -0.2], [0.85, -0.35], [1.75, 1.25]];
    parts(count, [
      [0.16, (n) => parts(n, [[1, (m) => line(b, m, [-2, -1.6, 0], [2, -1.6, 0], {}, rnd)], [0.8, (m) => line(b, m, [-2, -1.6, 0], [-2, 1.6, 0], {}, rnd)]])],
      // gridlines, faint (few points)
      [0.08, (n) => parts(n, [0, 1, 2].map((i) => [1, (m) => line(b, m, [-2, -0.8 + i * 0.8, -0.05], [2, -0.8 + i * 0.8, -0.05], { jitter: 0.004 }, rnd)]))],
      [0.46, (n) => parts(n, P.slice(1).map((p, i) => [Math.hypot(p[0] - P[i][0], p[1] - P[i][1]), (m) => line(b, m, [P[i][0], P[i][1], 0], [p[0], p[1], 0], { jitter: 0.045, accent: 1 }, rnd)]))],
      [0.12, (n) => parts(n, P.map(([x, y], i) => [i === P.length - 1 ? 2.5 : 1, (m) => ring(b, m, { r: i === P.length - 1 ? 0.14 : 0.08, w: 0.05, z: 0.02 }, rnd) || shift(b, m, x, y)]))],
      // area under the curve
      [0.18, (n) => {
        for (let k = 0; k < n; k++) {
          const x = -1.8 + rnd() * 3.55;
          let s = 0;
          while (s < P.length - 2 && x > P[s + 1][0]) s++;
          const t = (x - P[s][0]) / (P[s + 1][0] - P[s][0]);
          const top = P[s][1] + (P[s + 1][1] - P[s][1]) * t;
          b.add(x, -1.6 + (top + 1.6) * Math.pow(rnd(), 0.6), -0.08 + (rnd() - 0.5) * 0.1, 0);
        }
      }],
    ]);
    return b.finish(rnd);
  },

  browser(count, rnd) {
    const b = buffer(count);
    const m = mask((g, S) => {
      const x = S * 0.04;
      const y = S * 0.15;
      const w = S * 0.92;
      const h = S * 0.68;
      g.lineWidth = S * 0.01;
      g.strokeRect(x, y, w, h);
      g.fillRect(x, y + h * 0.12, w, S * 0.006);
      for (let i = 0; i < 3; i++) {
        g.fillStyle = i === 0 ? LIME : 'rgb(255,0,0)';
        g.beginPath();
        g.arc(x + S * (0.035 + i * 0.03), y + h * 0.06, S * 0.009, 0, TAU);
        g.fill();
      }
      g.fillStyle = 'rgb(255,0,0)';
      g.lineWidth = S * 0.005;
      g.strokeRect(x + w * 0.2, y + h * 0.025, w * 0.6, h * 0.07);
      // hero block, headline lines, cards
      g.fillRect(x + w * 0.06, y + h * 0.22, w * 0.5, h * 0.07);
      g.fillRect(x + w * 0.06, y + h * 0.33, w * 0.36, h * 0.07);
      g.fillStyle = LIME;
      g.fillRect(x + w * 0.06, y + h * 0.47, w * 0.16, h * 0.08);
      g.fillStyle = 'rgb(255,0,0)';
      g.lineWidth = S * 0.005;
      g.strokeRect(x + w * 0.62, y + h * 0.2, w * 0.32, h * 0.36);
      for (let i = 0; i < 3; i++) g.strokeRect(x + w * (0.06 + i * 0.3), y + h * 0.66, w * 0.28, h * 0.27);
    });
    fromMask(b, count, m, { size: 4.1, depth: 0.12, edge: 0.6, dy: 0.1 }, rnd);
    return b.finish(rnd);
  },

  layout(count, rnd) {
    const b = buffer(count);
    const m = mask((g, S) => {
      const gap = S * 0.025;
      const x = S * 0.06;
      const w = S * 0.88;
      let y = S * 0.1;
      g.fillRect(x, y, w, S * 0.06);
      y += S * 0.06 + gap;
      g.fillRect(x, y, w * 0.6, S * 0.28);
      g.fillStyle = LIME;
      g.fillRect(x + w * 0.6 + gap, y, w * 0.4 - gap, S * 0.28);
      g.fillStyle = 'rgb(255,0,0)';
      y += S * 0.28 + gap;
      const cw = (w - gap * 2) / 3;
      for (let i = 0; i < 3; i++) g.fillRect(x + i * (cw + gap), y, cw, S * 0.22);
      y += S * 0.22 + gap;
      g.fillRect(x, y, w, S * 0.08);
    });
    fromMask(b, count, m, { size: 4, depth: 0.16, edge: 0.55 }, rnd);
    const out = b.finish(rnd);
    // lift each block a little off the page: depth by block row
    for (let i = 0; i < count; i++) out[i * 4 + 2] += Math.sin(out[i * 4 + 1] * 2.2) * 0.12;
    return out;
  },

  bag(count, rnd) {
    const b = buffer(count);
    const m = mask((g, S) => {
      g.beginPath();
      g.moveTo(S * 0.22, S * 0.36);
      g.lineTo(S * 0.78, S * 0.36);
      g.lineTo(S * 0.84, S * 0.88);
      g.lineTo(S * 0.16, S * 0.88);
      g.closePath();
      g.fill();
      g.strokeStyle = LIME;
      g.lineWidth = S * 0.035;
      g.beginPath();
      g.arc(S * 0.5, S * 0.36, S * 0.15, Math.PI, TAU);
      g.stroke();
      g.globalCompositeOperation = 'destination-out';
      g.fillRect(S * 0.3, S * 0.48, S * 0.4, S * 0.02);
      g.globalCompositeOperation = 'source-over';
    });
    fromMask(b, count, m, { size: 3.9, depth: 0.5, edge: 0.5, dy: 0.15 }, rnd);
    return b.finish(rnd);
  },

  check(count, rnd) {
    const b = buffer(count);
    const m = mask((g, S) => {
      g.lineWidth = S * 0.02;
      g.strokeRect(S * 0.12, S * 0.12, S * 0.76, S * 0.76);
      g.strokeStyle = LIME;
      g.lineWidth = S * 0.09;
      g.beginPath();
      g.moveTo(S * 0.27, S * 0.5);
      g.lineTo(S * 0.44, S * 0.67);
      g.lineTo(S * 0.75, S * 0.32);
      g.stroke();
    });
    fromMask(b, count, m, { size: 4, depth: 0.3, edge: 0.45 }, rnd);
    return b.finish(rnd);
  },

  phone(count, rnd) {
    const b = buffer(count);
    const m = mask((g, S) => {
      const w = S * 0.46;
      const h = S * 0.9;
      const x = (S - w) / 2;
      const y = S * 0.05;
      g.lineWidth = S * 0.014;
      g.strokeRect(x, y, w, h);
      g.fillRect(x + w * 0.38, y + h * 0.025, w * 0.24, h * 0.018);
      // a post: avatar, image, like + lines
      g.beginPath();
      g.arc(x + w * 0.16, y + h * 0.1, w * 0.05, 0, TAU);
      g.fill();
      g.fillRect(x + w * 0.26, y + h * 0.09, w * 0.4, h * 0.02);
      g.lineWidth = S * 0.006;
      g.strokeRect(x + w * 0.08, y + h * 0.15, w * 0.84, h * 0.42);
      g.fillStyle = LIME;
      g.beginPath();
      g.arc(x + w * 0.14, y + h * 0.62, w * 0.04, 0, TAU);
      g.fill();
      g.fillStyle = 'rgb(255,0,0)';
      for (let i = 0; i < 4; i++) g.fillRect(x + w * 0.08, y + h * (0.68 + i * 0.06), w * (0.8 - (i % 2) * 0.3), h * 0.015);
    });
    fromMask(b, count, m, { size: 4, depth: 0.26, edge: 0.6 }, rnd);
    return b.finish(rnd);
  },

  heart(count, rnd) {
    const b = buffer(count);
    const s = 1.7;
    // the classic heart curve: x = 16 sin^3 t, y = 13 cos t - 5 cos 2t - 2 cos 3t - cos 4t
    const curve = (t) => [Math.sin(t) ** 3, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16];
    parts(count, [
      // lime outline, slightly doubled for a bevelled edge
      [0.42, (n) => {
        for (let k = 0; k < n; k++) {
          const [x, y] = curve(rnd() * TAU);
          const w = 1 - rnd() * 0.04;
          b.add(x * s * w, (y + 0.15) * s * w, (rnd() - 0.5) * 0.3, 1);
        }
      }],
      // puffy body: the outline scaled towards an inner centre (the heart is star-shaped around
      // it), deeper in the middle; white with lime sparks
      [0.58, (n) => {
        for (let k = 0; k < n; k++) {
          const [x, y] = curve(rnd() * TAU);
          const u = Math.sqrt(rnd());
          const cy = -0.25;
          const z = (rnd() < 0.8 ? 1 : -1) * 0.55 * Math.sqrt(1 - u * u);
          b.add(x * u * s, (cy + (y - cy) * u + 0.15) * s, z, rnd() < 0.18 ? 1 : 0);
        }
      }],
    ]);
    return b.finish(rnd);
  },

  network(count, rnd) {
    const b = buffer(count);
    const nodes = [];
    for (let i = 0; i < 16; i++) {
      const u = rnd() * 2 - 1;
      const th = rnd() * TAU;
      const s = Math.sqrt(1 - u * u);
      const r = i === 0 ? 0 : 1.1 + rnd() * 0.75;
      nodes.push([Math.cos(th) * s * r, u * r * 0.9, Math.sin(th) * s * r]);
    }
    const edges = [];
    nodes.forEach((a, i) => {
      const near = nodes.map((c, j) => [j, Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2])]).filter(([j]) => j !== i).sort((p, q) => p[1] - q[1]).slice(0, 3);
      for (const [j] of near) if (i < j || !edges.some(([p, q]) => p === j && q === i)) edges.push([i, j]);
      if (i) edges.push([0, i]);
    });
    parts(count, [
      [0.45, (n) => parts(n, nodes.map((c, i) => [i === 0 ? 2.5 : 1, (m) => sphereSurface(b, m, i === 0 ? 0.3 : 0.12, { c, shell: 0.06, accent: i === 0 || i % 4 === 1 ? 1 : 0 }, rnd)]))],
      [0.55, (n) => parts(n, edges.map(([i, j]) => [1, (m) => line(b, m, nodes[i], nodes[j], { jitter: 0.012 }, rnd)]))],
    ]);
    return b.finish(rnd);
  },

  play(count, rnd) {
    const b = buffer(count);
    const m = mask((g, S) => {
      g.lineWidth = S * 0.025;
      g.beginPath();
      g.arc(S / 2, S / 2, S * 0.4, 0, TAU);
      g.stroke();
      g.fillStyle = LIME;
      g.beginPath();
      g.moveTo(S * 0.41, S * 0.32);
      g.lineTo(S * 0.68, S * 0.5);
      g.lineTo(S * 0.41, S * 0.68);
      g.closePath();
      g.fill();
    });
    fromMask(b, count, m, { size: 4, depth: 0.36, edge: 0.45 }, rnd);
    return b.finish(rnd);
  },

  floorGrid(count, rnd) {
    const b = buffer(count);
    const n = 9;
    const s = 3.8;
    parts(count, [
      ...Array.from({ length: n }, (_, i) => [1, (m) => line(b, m, [-s / 2 + (i * s) / (n - 1), -1.2, -s / 2], [-s / 2 + (i * s) / (n - 1), -1.2, s / 2], { jitter: 0.012 }, rnd)]),
      ...Array.from({ length: n }, (_, i) => [1, (m) => line(b, m, [-s / 2, -1.2, -s / 2 + (i * s) / (n - 1)], [s / 2, -1.2, -s / 2 + (i * s) / (n - 1)], { jitter: 0.012 }, rnd)]),
      // the booth's footprint marked in lime
      [3, (m) => box(b, m, [0.2, -1.2, -0.2], [1.9, 0.01, 1.4], { edge: 0.85, accent: 1 }, rnd)],
    ]);
    return b.finish(rnd);
  },

  booth(count, rnd) {
    const b = buffer(count);
    parts(count, [
      [0.08, (n) => box(b, n, [0, -1.25, 0], [3.4, 0.05, 2.4], { edge: 1 }, rnd)],
      [0.3, (n) => box(b, n, [0, 0, -1.1], [3.2, 2.5, 0.1], { edge: 0.4 }, rnd)], // back wall
      [0.16, (n) => box(b, n, [-1.55, 0, -0.35], [0.1, 2.5, 1.5], { edge: 0.45 }, rnd)], // side wall
      [0.16, (n) => box(b, n, [0, 1.05, -1.02], [2.4, 0.42, 0.08], { edge: 0.55, accent: 1 }, rnd)], // header sign
      [0.2, (n) => box(b, n, [0.55, -0.8, 0.5], [1.3, 0.9, 0.55], { edge: 0.5, accent: (t) => (t > 0.9 ? 1 : 0) }, rnd)], // counter
      [0.1, (n) => box(b, n, [-0.8, -0.1, -0.95], [0.9, 1.1, 0.04], { edge: 0.8 }, rnd)], // screen
    ]);
    const out = b.finish(rnd);
    return out;
  },

  crowd(count, rnd) {
    const b = buffer(count);
    const people = [];
    for (let i = 0; i < 26; i++) {
      const a = rnd() * TAU;
      const r = 0.7 + Math.sqrt(rnd()) * 1.3;
      people.push([Math.cos(a) * r, Math.sin(a) * r * 0.8 + 0.3]);
    }
    parts(count, [
      [0.22, (n) => box(b, n, [0, -0.6, -0.9], [1.8, 1.4, 0.3], { edge: 0.6, accent: (t) => (t > 0.8 ? 1 : 0) }, rnd)],
      [0.12, (n) => ring(b, n, { r: 1.85, y: -1.3, plane: 'xz', w: 0.04 }, rnd)],
      ...people.map(([x, z], i) => [1, (n) => {
        // a person: body column + head
        for (let k = 0; k < n; k++) {
          const head = rnd() < 0.3;
          const a = rnd() * TAU;
          if (head) b.add(x + Math.cos(a) * 0.08, -0.55 + Math.sin(a) * 0.08, z + (rnd() - 0.5) * 0.12, i % 5 === 0 ? 1 : 0);
          else b.add(x + Math.cos(a) * 0.1 * Math.sqrt(rnd()), -1.3 + rnd() * 0.6, z + Math.sin(a) * 0.1, i % 5 === 0 ? 1 : 0);
        }
      }]),
    ]);
    return b.finish(rnd);
  },

  arrowUpRight(count, rnd) {
    const b = buffer(count);
    const m = mask((g, S) => {
      g.translate(S / 2, S / 2);
      g.rotate(Math.PI / 4);
      g.fillStyle = LIME;
      arrowPath(g, S);
      g.fill();
    });
    fromMask(b, count, m, { size: 3.9, depth: 0.4, edge: 0.45 }, rnd);
    return b.finish(rnd);
  },

  arrowUp(count, rnd) {
    const b = buffer(count);
    const m = mask((g, S) => {
      g.translate(S / 2, S / 2);
      arrowPath(g, S);
      g.fill();
    });
    fromMask(b, count, m, { size: 3.9, depth: 0.42, edge: 0.45, accent: (u, v) => (v < 0.45 ? 1 : 0) }, rnd);
    return b.finish(rnd);
  },

  // five columns rising left to right on a plinth, their tops joined by a lime growth line
  pillars(count, rnd) {
    const b = buffer(count);
    const n = 5;
    const H = [1.5, 1.85, 2.2, 2.55, 2.9];
    const X = H.map((_, i) => -1.6 + i * 0.8);
    parts(count, [
      [0.1, (m) => box(b, m, [0, -1.62, 0], [4, 0.16, 0.9], { edge: 0.7 }, rnd)],
      ...H.map((h, i) => [h, (m) => {
        const x = X[i];
        for (let k = 0; k < m; k++) {
          const q = rnd();
          let a = rnd() * TAU;
          let t = rnd();
          if (q < 0.18) t = rnd() < 0.5 ? 0 : 1; // base and capital rings
          else if (q < 0.55) a = Math.round((a / TAU) * 10) * (TAU / 10); // flutes
          const r = 0.22 + (q < 0.18 ? 0.05 : 0);
          b.add(x + Math.cos(a) * r, -1.54 + t * h, Math.sin(a) * r, i === n - 1 && t > 0.75 ? 1 : 0);
        }
      }]),
      [0.9, (m) => parts(m, H.slice(1).map((h, i) => [1, (k) => line(b, k, [X[i], -1.54 + H[i] + 0.25, 0], [X[i + 1], -1.54 + h + 0.25, 0], { accent: 1, jitter: 0.03 }, rnd)]))],
    ]);
    return b.finish(rnd);
  },

  globe(count, rnd) {
    const b = buffer(count);
    const R = 1.65;
    parts(count, [
      // parallels
      [0.38, (n) => parts(n, [-60, -30, 0, 30, 60].map((lat) => [Math.cos((lat * Math.PI) / 180), (m) => {
        const phi = (lat * Math.PI) / 180;
        ring(b, m, { r: R * Math.cos(phi), y: R * Math.sin(phi), plane: 'xz', w: 0.03 }, rnd);
      }]))],
      // meridians
      [0.42, (n) => parts(n, Array.from({ length: 8 }, (_, i) => [1, (m) => {
        const lon = (i / 8) * Math.PI;
        for (let k = 0; k < m; k++) {
          const a = rnd() * TAU;
          const x = Math.cos(a) * R;
          b.add(x * Math.cos(lon), Math.sin(a) * R, x * Math.sin(lon), 0);
        }
      }]))],
      // Athens, glowing
      [0.08, (n) => {
        const lat = (38 * Math.PI) / 180;
        const lon = (24 * Math.PI) / 180 + 0.6;
        const c = [R * Math.cos(lat) * Math.cos(lon), R * Math.sin(lat), R * Math.cos(lat) * Math.sin(lon)];
        sphereSurface(b, n, 0.1, { c, shell: 0.12, accent: 1 }, rnd);
      }],
      [0.12, (n) => ring(b, n, { r: R * 1.32, plane: 'xz', w: 0.02, accent: 0 }, rnd)],
    ]);
    return b.finish(rnd);
  },

  pin(count, rnd) {
    const b = buffer(count);
    parts(count, [
      [0.85, (n) => {
        const m = mask((g, S) => {
          g.fillStyle = LIME;
          g.beginPath();
          g.arc(S / 2, S * 0.36, S * 0.25, Math.PI * 0.82, Math.PI * 2.18);
          g.lineTo(S / 2, S * 0.9);
          g.closePath();
          g.fill();
          g.globalCompositeOperation = 'destination-out';
          g.beginPath();
          g.arc(S / 2, S * 0.36, S * 0.1, 0, TAU);
          g.fill();
          g.globalCompositeOperation = 'source-over';
        });
        fromMask(b, n, m, { size: 3.6, depth: 0.5, edge: 0.45, dy: 0.25 }, rnd);
      }],
      [0.15, (n) => ring(b, n, { r: 0.55, y: -1.45, plane: 'xz', w: 0.04 }, rnd)],
    ]);
    return b.finish(rnd);
  },

  envelope(count, rnd) {
    const b = buffer(count);
    const m = mask((g, S) => {
      const x = S * 0.07;
      const y = S * 0.22;
      const w = S * 0.86;
      const h = S * 0.56;
      g.lineWidth = S * 0.016;
      g.strokeRect(x, y, w, h);
      g.strokeStyle = LIME;
      g.lineWidth = S * 0.02;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + w / 2, y + h * 0.58);
      g.lineTo(x + w, y);
      g.stroke();
      g.strokeStyle = 'rgb(255,0,0)';
      g.lineWidth = S * 0.01;
      g.beginPath();
      g.moveTo(x, y + h);
      g.lineTo(x + w * 0.38, y + h * 0.45);
      g.moveTo(x + w, y + h);
      g.lineTo(x + w * 0.62, y + h * 0.45);
      g.stroke();
    });
    fromMask(b, count, m, { size: 4, depth: 0.24, edge: 0.55 }, rnd);
    return b.finish(rnd);
  },
};

// lineChart helper: move the last m points added (a ring at the origin) to (x, y).
function shift(b, m, x, y) {
  const out = b.out;
  const end = b.out.length / 4 - b.left;
  for (let i = end - m; i < end; i++) { out[i * 4] += x; out[i * 4 + 1] += y; }
  return true;
}

function arrowPath(g, S) {
  const s = S * 0.42;
  g.beginPath();
  g.moveTo(0, -s);
  g.lineTo(s * 0.72, -s * 0.22);
  g.lineTo(s * 0.24, -s * 0.22);
  g.lineTo(s * 0.24, s);
  g.lineTo(-s * 0.24, s);
  g.lineTo(-s * 0.24, -s * 0.22);
  g.lineTo(-s * 0.72, -s * 0.22);
  g.closePath();
}

/**
 * Generates a shape for `count` particles. Points are sorted bottom-to-top (with a little x and
 * noise), so particle i lands in a similar region of every shape and morphs read as flows rather
 * than explosions. `variant` (a repeat while cycling) turns the shape and re-deals the points.
 */
export function makeShape(name, count, seed = 1, variant = 0) {
  let s = (seed * 9301 + 49297 + variant * 7919) % 233280 || 1;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const gen = G[name] ?? G.scatter;
  const pts = gen(count, rnd);
  // Frame: centre the bounding box and shrink anything larger than the stage's safe box.
  if (name !== 'scatter') {
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < count; i++) {
      for (let a = 0; a < 3; a++) {
        const v = pts[i * 4 + a];
        if (v < lo[a]) lo[a] = v;
        if (v > hi[a]) hi[a] = v;
      }
    }
    const k = Math.min(1, 4.2 / (hi[0] - lo[0] || 1), 3.8 / (hi[1] - lo[1] || 1), 4.2 / (hi[2] - lo[2] || 1));
    const c = lo.map((v, a) => (v + hi[a]) / 2);
    for (let i = 0; i < count; i++) for (let a = 0; a < 3; a++) pts[i * 4 + a] = (pts[i * 4 + a] - c[a]) * k;
  }
  // sort by a mostly vertical key
  const idx = new Uint32Array(count).map((_, i) => i);
  const key = new Float32Array(count);
  const shuffle = variant ? 0.9 : 0.12;
  for (let i = 0; i < count; i++) key[i] = pts[i * 4 + 1] + pts[i * 4] * 0.18 + pts[i * 4 + 2] * 0.06 + (rnd() - 0.5) * shuffle;
  idx.sort((a, c) => key[a] - key[c]);
  const out = new Float32Array(count * 4);
  const turn = variant ? (variant * 1.1) % TAU : 0;
  const c = Math.cos(turn);
  const sn = Math.sin(turn);
  for (let i = 0; i < count; i++) {
    const j = idx[i] * 4;
    const x = pts[j];
    const z = pts[j + 2];
    out[i * 4] = FLAT.has(name) ? x : x * c - z * sn;
    out[i * 4 + 1] = pts[j + 1];
    out[i * 4 + 2] = FLAT.has(name) ? z : x * sn + z * c;
    out[i * 4 + 3] = pts[j + 3];
  }
  return out;
}
