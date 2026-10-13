// Scroll-story particles for canvas[data-scene="story"] (STUB, to be built out).
// A points cloud that morphs through one shape per step as `grow:story` events arrive on the
// canvas (detail { progress 0..1, step, steps }, dispatched by motion/pin.js). The "growth" set
// goes scattered -> sphere -> helix -> bar field -> lattice -> rising arrow.
import { createStage } from './core.js';
import { easeInOut } from './util.js';

export function mount(canvas, opts = {}) {
  return createStage(canvas, {
    ...opts,
    layout: 'center',
    track: canvas.closest('[data-story]') ?? canvas.parentElement,
    progress: 'through',
    post: false,
    env: false,
    lights: false,
    fov: 38,
    distance: 7.4,
    tilt: [0.25, 0.12],
    build: (ctx) => buildStory(ctx, canvas),
  });
}

const SHAPES = {
  scatter(n, rnd) {
    const out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 2.4 * Math.cbrt(rnd());
      const u = rnd() * 2 - 1;
      const th = rnd() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      out.set([r * s * Math.cos(th), r * u, r * s * Math.sin(th)], i * 3);
    }
    return out;
  },
  sphere(n) {
    const out = new Float32Array(n * 3);
    const g = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      out.set([Math.cos(g * i) * r * 1.55, y * 1.55, Math.sin(g * i) * r * 1.55], i * 3);
    }
    return out;
  },
  helix(n, rnd) {
    const out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const a = t * Math.PI * 8 + (i % 2) * Math.PI;
      const r = 0.55 + t * 0.6 + (rnd() - 0.5) * 0.08;
      out.set([Math.cos(a) * r, (t - 0.5) * 3.6, Math.sin(a) * r], i * 3);
    }
    return out;
  },
  bars(n, rnd) {
    const out = new Float32Array(n * 3);
    const k = 9;
    for (let i = 0; i < n; i++) {
      const c = i % (k * k);
      const x = c % k;
      const z = Math.floor(c / k);
      const h = 0.25 + ((x + (k - z)) / (2 * k)) * 2.6;
      out.set([(x - (k - 1) / 2) * 0.34 + (rnd() - 0.5) * 0.06, -1.5 + rnd() * h, (z - (k - 1) / 2) * 0.34 + (rnd() - 0.5) * 0.06], i * 3);
    }
    return out;
  },
  lattice(n, rnd) {
    const out = new Float32Array(n * 3);
    const s = 1.25;
    for (let i = 0; i < n; i++) {
      // points along the 12 edges of a cube plus a few inner cross-lines
      const e = i % 15;
      const t = rnd() * 2 - 1;
      const a = e < 12 ? [[t, -1, -1], [t, 1, -1], [t, -1, 1], [t, 1, 1], [-1, t, -1], [1, t, -1], [-1, t, 1], [1, t, 1], [-1, -1, t], [1, -1, t], [-1, 1, t], [1, 1, t]][e] : [[t, t, t], [t, -t, t], [-t, t, t]][e - 12];
      out.set([a[0] * s, a[1] * s, a[2] * s], i * 3);
    }
    return out;
  },
  arrow(n, rnd) {
    const out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const head = i % 5 < 2;
      const a = rnd() * Math.PI * 2;
      if (head) {
        const h = rnd();
        const r = (1 - h) * 0.95 * Math.sqrt(rnd());
        out.set([Math.cos(a) * r, 0.55 + h * 1.25, Math.sin(a) * r], i * 3);
      } else {
        const r = 0.32 * Math.sqrt(rnd());
        out.set([Math.cos(a) * r, -1.9 + rnd() * 2.45, Math.sin(a) * r], i * 3);
      }
    }
    return out;
  },
};
const SEQUENCE = ['scatter', 'sphere', 'helix', 'bars', 'lattice', 'arrow'];

function buildStory({ THREE, rig, small, quality, palette, motion, invalidate }, canvas) {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const N = quality === 'high' ? 2600 : small ? 1100 : 1800;
  const shapes = Object.fromEntries(SEQUENCE.map((k) => [k, SHAPES[k](N, rnd)]));
  const rank = new Float32Array(N).map(() => rnd()); // decides which points turn lime
  const jitter = new Float32Array(N * 3).map(() => rnd() * Math.PI * 2);

  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: small ? 0.05 : 0.042, vertexColors: true, transparent: true, opacity: 0.95, sizeAttenuation: true, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  rig.add(points);

  // Thin ground line + frame so the stage reads as a "plot".
  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(3.6, 3.6, 3.6)),
    new THREE.LineBasicMaterial({ color: palette.white, transparent: true, opacity: 0.06 }),
  );
  rig.add(frame);

  let steps = 4;
  let target = 0;
  let p = 0;
  let limeCount = -1;
  const order = () => {
    const n = Math.max(2, steps);
    return Array.from({ length: n }, (_, k) => SEQUENCE[Math.round((k * (SEQUENCE.length - 1)) / (n - 1))]);
  };
  let seq = order();

  canvas.addEventListener('grow:story', (e) => {
    const d = e.detail ?? {};
    if (d.steps && d.steps !== steps) { steps = d.steps; seq = order(); }
    target = Math.min(Math.max(+d.progress || 0, 0), 1);
    invalidate();
  });
  // motion/pin.js replays the current state when asked (this module loads lazily).
  canvas.dispatchEvent(new CustomEvent('grow:story-listen'));

  const paint = (k) => {
    const want = Math.round(N * k);
    if (want === limeCount) return;
    limeCount = want;
    const cut = k;
    for (let i = 0; i < N; i++) {
      const c = rank[i] < cut ? palette.lime : palette.white;
      const dim = rank[i] < cut ? 1 : 0.55 + rank[i] * 0.35;
      col[i * 3] = c.r * dim;
      col[i * 3 + 1] = c.g * dim;
      col[i * 3 + 2] = c.b * dim;
    }
    geo.attributes.color.needsUpdate = true;
  };

  return {
    update(time) {
      p += (target - p) * (motion ? 0.07 : 1);
      const f = p * (seq.length - 1);
      const i0 = Math.min(Math.floor(f), seq.length - 2);
      const e = easeInOut(f - i0);
      const a = shapes[seq[i0]];
      const b = shapes[seq[i0 + 1]];
      const wob = motion ? 0.035 : 0;
      for (let i = 0; i < N * 3; i++) pos[i] = a[i] + (b[i] - a[i]) * e + Math.sin(time * 1.3 + jitter[i]) * wob;
      geo.attributes.position.needsUpdate = true;
      paint(0.1 + p * 0.45);
      points.rotation.y = time * 0.12 + p * Math.PI * 1.5;
      frame.rotation.y = points.rotation.y * 0.5;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
