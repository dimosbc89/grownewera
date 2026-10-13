// Scroll-story particles for canvas[data-scene="story"] inside [data-story="<set>"].
//
// 8k-18k points (by tier) morph between procedural shapes, one per step, as `grow:story` events
// arrive on the canvas (detail { progress 0..1, step, steps, set }, dispatched by motion/pin.js).
// Shape sets and the step -> shape mapping live in story-shapes.js (unknown sets use `growth`).
//
// Look: soft round sprites with a hot core, white and acid lime, accumulated additively in a
// half-float buffer and then tone-mapped so dense lime stays lime (and very dense spots go white)
// instead of clipping to yellow. Depth of field and depth fade give the cloud volume; a curl-noise
// field keeps it alive. Motion: each morph is staggered per particle (delays from a noise field
// plus height, so shapes build bottom-up going down the page and top-down going back), with an
// arcing flight; a retarget mid-flight starts from where every particle is (CPU snapshot of the
// shader's maths), so fast scrolling never pops. The pointer pushes particles aside (in screen
// space, so it matches the cursor at any depth) and tints them lime; scroll speed stretches the
// cloud a little; the camera drifts with the story's progress. Reduced motion: one composed frame
// of the current step, redrawn when the step changes.
import { createStage, damp } from './core.js';
import { SETS, FLAT, FONT, sequence, makeShape } from './story-shapes.js';

const DUST = 0.07; // share of particles that never join a shape (ambient depth)
const SPREAD = 0.52; // share of a morph's duration used for the per-particle stagger
const MORPH_S = 1.9; // seconds per morph (shorter while scrolling fast)
const INTRO_S = 2.8; // first appearance: the nebula condenses into the current shape
const FLIGHT = 0.55; // arc height of a particle in flight (world units)
const DRIFT = 0.05; // resting curl-noise drift
const TAU = Math.PI * 2;

export async function mount(canvas, opts = {}) {
  const wrap = canvas.closest('[data-story]');
  const set = SETS[wrap?.dataset.story] ? wrap.dataset.story : 'growth';
  // Glyph shapes are drawn in the brand font: make sure it is loaded (it normally is: headings use it).
  try {
    await Promise.race([document.fonts?.load(`700 120px ${FONT}`), new Promise((r) => setTimeout(r, 1200))]);
  } catch {}
  return createStage(canvas, {
    ...opts,
    layout: 'center',
    track: wrap ?? canvas.parentElement,
    progress: 'through',
    post: false,
    env: false,
    lights: false,
    fov: 38,
    distance: 7.4,
    tilt: [0.22, 0.1],
    localPointer: true,
    build: (ctx) => buildStory(ctx, canvas, set),
  });
}

// ---------------------------------------------------------------- shaders
const CURL = /* glsl */ `
// Analytic curl of a two-octave trig vector potential: divergence-free (no clumping) and cheap.
vec3 curl(vec3 p, float t) {
  vec3 c = vec3(0.0);
  float f = 1.0;
  float amp = 1.0;
  for (int o = 0; o < 2; o++) {
    vec3 q = p * f;
    float ax = cos(q.y * 1.3 + q.z * 0.7 + t * 0.21);
    float ay = cos(q.z * 1.1 + q.x * 0.9 - t * 0.17);
    float az = cos(q.x * 1.2 + q.y * 0.8 + t * 0.13);
    c += amp * f * vec3(0.8 * az - 1.1 * ay, 0.7 * ax - 1.2 * az, 0.9 * ay - 1.3 * ax);
    f *= 2.1;
    amp *= 0.45;
  }
  return c;
}`;

const VERT = /* glsl */ `
attribute vec4 aFrom;
attribute vec4 aTo;
attribute vec4 aSeed;
attribute float aDelay;
uniform float uMorph, uSpread, uTime, uSize, uDrift, uFlight, uPush, uRadius, uVel, uFocus, uDof, uFar, uSpark, uAspect;
uniform vec2 uPointer;
uniform vec3 uLime, uWhite;
varying vec3 vColor;
varying float vAlpha;
varying float vCore;
${CURL}
float easeIO(float t) { return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) * 0.5; }
void main() {
  float t = clamp((uMorph - aDelay * uSpread) / (1.0 - uSpread), 0.0, 1.0);
  float e = easeIO(t);
  float fly = sin(3.14159265 * e);
  vec3 base = mix(aFrom.xyz, aTo.xyz, e);
  vec3 arc = normalize(vec3(aSeed.w - 0.5, aSeed.x - 0.3, aSeed.y - 0.5) + normalize(base + vec3(1e-4)) * 0.6);
  vec3 p = base + arc * fly * uFlight * (0.4 + aSeed.w);
  p += curl(p * 0.45, uTime) * 0.3 * (uDrift * (0.5 + aSeed.z) + fly * 0.25 * uFlight);
  p.y += uVel * (aSeed.x - 0.5) * 0.14; // scroll speed stretches the cloud
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  // Pointer: push aside in screen space (matches the cursor whatever the depth).
  vec4 clip = projectionMatrix * mv;
  vec2 dd = (clip.xy / clip.w - uPointer) * vec2(uAspect, 1.0);
  float dist = length(dd);
  float f = uPush * exp(-(dist * dist) / (uRadius * uRadius));
  mv.xy += (dd / max(dist, 1e-3)) * f * 0.55 * (0.6 + aSeed.z * 0.8);
  gl_Position = projectionMatrix * mv;
  float depth = -mv.z;
  float blur = abs(depth - uFocus) * uDof;
  gl_PointSize = max(1.0, uSize * (0.55 + aSeed.z * 0.9) * (1.0 + blur * 1.6) * (uFocus / depth));
  float accent = clamp(max(mix(aFrom.w, aTo.w, e), step(1.0 - uSpark, aSeed.y)) + f * 0.45, 0.0, 1.0);
  vColor = mix(uWhite, uLime, accent);
  float tw = 0.78 + 0.22 * sin(uTime * (0.8 + aSeed.x * 1.6) + aSeed.y * 37.0);
  float fade = smoothstep(uFocus + uFar, uFocus - 1.2, depth);
  vAlpha = tw * fade / (1.0 + blur * blur * 6.0) * mix(0.62, 1.0, accent) * (1.0 + fly * 0.35);
  vCore = 1.0 / (1.0 + blur * 5.0); // crisp cores in focus, soft discs out of it
}`;

const FRAG = /* glsl */ `
uniform float uIntensity;
varying vec3 vColor;
varying float vAlpha;
varying float vCore;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r2 = dot(c, c) * 4.0;
  if (r2 > 1.0) discard;
  float halo = 1.0 - r2;
  halo *= halo;
  float core = exp(-r2 * 9.0) * vCore;
  float a = (halo * 0.5 + core) * vAlpha * uIntensity;
  gl_FragColor = vec4(vColor * a + core * 0.3 * a, a);
}`;

// Accumulation buffer -> canvas: compress brightness, keep the hue (lime stays lime), let only
// very dense spots run to white. Output is premultiplied for the transparent canvas.
const COMPOSITE_VERT = /* glsl */ `varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const COMPOSITE_FRAG = /* glsl */ `uniform sampler2D tAcc; uniform float uExposure; varying vec2 vUv;
void main() {
  vec3 x = texture2D(tAcc, vUv).rgb * uExposure;
  float m = max(max(x.r, x.g), x.b);
  float v = 1.0 - exp(-m * 1.35);
  vec3 hue = x / max(m, 1e-4);
  vec3 col = mix(hue, vec3(1.0), smoothstep(1.6, 6.0, m) * 0.5) * v;
  gl_FragColor = vec4(col, v);
}`;

// ---------------------------------------------------------------- CPU mirror of the shader maths
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) * 0.5);
function curl(x, y, z, t, out) {
  let cx = 0; let cy = 0; let cz = 0;
  let f = 1;
  let amp = 1;
  for (let o = 0; o < 2; o++) {
    const qx = x * f; const qy = y * f; const qz = z * f;
    const ax = Math.cos(qy * 1.3 + qz * 0.7 + t * 0.21);
    const ay = Math.cos(qz * 1.1 + qx * 0.9 - t * 0.17);
    const az = Math.cos(qx * 1.2 + qy * 0.8 + t * 0.13);
    cx += amp * f * (0.8 * az - 1.1 * ay);
    cy += amp * f * (0.7 * ax - 1.2 * az);
    cz += amp * f * (0.9 * ay - 1.3 * ax);
    f *= 2.1;
    amp *= 0.45;
  }
  out[0] = cx; out[1] = cy; out[2] = cz;
}

// Smooth 3D value noise (for the stagger field).
function hash3(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, y, z) {
  const xi = Math.floor(x); const yi = Math.floor(y); const zi = Math.floor(z);
  const s = (t) => t * t * (3 - 2 * t);
  const u = s(x - xi); const v = s(y - yi); const w = s(z - zi);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
    l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v),
    w,
  );
}

// ---------------------------------------------------------------- the stage
function buildStory(ctx, canvas, set) {
  const { THREE, rig, scene, camera, renderer, small, quality, motion, invalidate, input } = ctx;
  const N = !motion ? (small ? 8000 : 12000) : quality === 'high' ? 18000 : small ? 8000 : 12000;
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // Ambient dust: fixed particles in a wide shell that never join a shape.
  const dust = new Uint8Array(N);
  let shapeCount = 0;
  for (let i = 0; i < N; i++) {
    dust[i] = rnd() < DUST ? 1 : 0;
    if (!dust[i]) shapeCount++;
  }
  const dustPos = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    if (!dust[i]) continue;
    const u = rnd() * 2 - 1;
    const th = rnd() * TAU;
    const s = Math.sqrt(1 - u * u);
    const r = 2.4 + rnd() * 2.6;
    dustPos.set([Math.cos(th) * s * r, u * r * 0.7, Math.sin(th) * s * r - 0.5, rnd() < 0.15 ? 1 : 0], i * 4);
  }

  // Shapes are generated on demand and cached; the rest of the sequence fills in during idle time.
  const cache = new Map();
  const getShape = ({ shape, variant = 0 }) => {
    const key = `${shape}:${variant}`;
    let out = cache.get(key);
    if (out) return out;
    const pts = makeShape(shape, shapeCount, 3 + shape.length * 31, variant);
    out = new Float32Array(N * 4);
    for (let i = 0, j = 0; i < N; i++) {
      if (dust[i]) out.set(dustPos.subarray(i * 4, i * 4 + 4), i * 4);
      else { out.set(pts.subarray(j * 4, j * 4 + 4), i * 4); j++; }
    }
    cache.set(key, out);
    return out;
  };

  let steps = SETS[set].length;
  let seq = sequence(set, steps);
  let step = 0;
  let current = seq[0];

  // ---------- geometry ----------
  const from = new Float32Array(N * 4);
  const to = new Float32Array(N * 4);
  const delay = new Float32Array(N);
  const seeds = new Float32Array(N * 4);
  for (let i = 0; i < N * 4; i++) seeds[i] = rnd();
  const first = getShape(current);
  to.set(first);
  from.set(motion ? getShape({ shape: 'scatter', variant: 0 }) : first);
  const geo = new THREE.BufferGeometry();
  const position = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) position.set(first.subarray(i * 4, i * 4 + 3), i * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
  const aFrom = new THREE.BufferAttribute(from, 4).setUsage(THREE.DynamicDrawUsage);
  const aTo = new THREE.BufferAttribute(to, 4).setUsage(THREE.DynamicDrawUsage);
  const aDelay = new THREE.BufferAttribute(delay, 1).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aFrom', aFrom);
  geo.setAttribute('aTo', aTo);
  geo.setAttribute('aDelay', aDelay);
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));

  const uniforms = {
    uMorph: { value: motion ? 0 : 1 },
    uSpread: { value: SPREAD },
    uTime: { value: 0 },
    uSize: { value: 2 },
    uDrift: { value: motion ? DRIFT : 0 },
    uFlight: { value: FLIGHT },
    uPush: { value: 0 },
    uRadius: { value: 0.24 },
    uVel: { value: 0 },
    uFocus: { value: 7.4 },
    uDof: { value: 0.16 },
    uFar: { value: 3.4 },
    uSpark: { value: 0.035 },
    uAspect: { value: 1 },
    uPointer: { value: new THREE.Vector2(9, 9) },
    uLime: { value: new THREE.Vector3(0.8, 1, 0) }, // #ccff00 (sRGB, like the CSS)
    uWhite: { value: new THREE.Vector3(0.93, 0.94, 0.95) },
    uIntensity: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthTest: false, depthWrite: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor, toneMapped: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  rig.add(points);

  // ---------- accumulation buffer + composite ----------
  const floatOK = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
  const acc = new THREE.WebGLRenderTarget(1, 1, {
    type: floatOK ? THREE.HalfFloatType : THREE.UnsignedByteType, depthBuffer: false, stencilBuffer: false, generateMipmaps: false,
  });
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const composite = new THREE.Mesh(tri, new THREE.ShaderMaterial({
    vertexShader: COMPOSITE_VERT, fragmentShader: COMPOSITE_FRAG,
    uniforms: { tAcc: { value: acc.texture }, uExposure: { value: 1 } },
    depthTest: false, depthWrite: false, blending: THREE.NoBlending, toneMapped: false,
  }));
  composite.frustumCulled = false;
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // ---------- morph state ----------
  let morph = motion ? 0 : 1;
  let duration = INTRO_S;
  const tmp = [0, 0, 0];
  const bounds = (arr) => {
    let lo = Infinity; let hi = -Infinity;
    for (let i = 1; i < arr.length; i += 4) { lo = Math.min(lo, arr[i]); hi = Math.max(hi, arr[i]); }
    return [lo, hi - lo || 1];
  };
  // Per-particle delays: a smooth noise field plus height (bottom-up going forward).
  const setDelays = (target, dir) => {
    const [lo, span] = bounds(target);
    const o = rnd() * 50;
    for (let i = 0; i < N; i++) {
      const x = target[i * 4]; const y = target[i * 4 + 1]; const z = target[i * 4 + 2];
      const h = (y - lo) / span;
      const n = vnoise(x * 1.1 + o, y * 1.1, z * 1.1);
      delay[i] = Math.min(1, Math.max(0, 0.55 * n + 0.45 * (dir >= 0 ? h : 1 - h) + (seeds[i * 4 + 1] - 0.5) * 0.08));
    }
  };
  setDelays(to, 1);
  // Freeze where every particle is now (same maths as the vertex shader, minus the per-frame
  // drift/pointer/scroll terms, which are applied on top either way) into `from`.
  const snapshot = () => {
    if (morph >= 1) { from.set(to); return; }
    const t0 = uniforms.uTime.value;
    for (let i = 0; i < N; i++) {
      const k = i * 4;
      const t = Math.min(1, Math.max(0, (morph - delay[i] * SPREAD) / (1 - SPREAD)));
      const e = easeIO(t);
      const fly = Math.sin(Math.PI * e);
      let bx = from[k] + (to[k] - from[k]) * e;
      let by = from[k + 1] + (to[k + 1] - from[k + 1]) * e;
      let bz = from[k + 2] + (to[k + 2] - from[k + 2]) * e;
      const accent = from[k + 3] + (to[k + 3] - from[k + 3]) * e;
      if (fly > 1e-4) {
        const bl = Math.hypot(bx + 1e-4, by + 1e-4, bz + 1e-4);
        let ax = seeds[k + 3] - 0.5 + ((bx + 1e-4) / bl) * 0.6;
        let ay = seeds[k] - 0.3 + ((by + 1e-4) / bl) * 0.6;
        let az = seeds[k + 1] - 0.5 + ((bz + 1e-4) / bl) * 0.6;
        const al = Math.hypot(ax, ay, az) || 1;
        const s = (fly * FLIGHT * (0.4 + seeds[k + 3])) / al;
        bx += ax * s; by += ay * s; bz += az * s;
        curl(bx * 0.45, by * 0.45, bz * 0.45, t0, tmp);
        const c = 0.3 * fly * 0.25 * FLIGHT;
        bx += tmp[0] * c; by += tmp[1] * c; bz += tmp[2] * c;
      }
      from[k] = bx; from[k + 1] = by; from[k + 2] = bz; from[k + 3] = accent;
    }
  };
  const retarget = (next, dir) => {
    const shape = getShape(next);
    current = next;
    if (!motion) {
      from.set(shape);
      to.set(shape);
      morph = 1;
    } else {
      snapshot();
      to.set(shape);
      setDelays(to, dir);
      morph = 0;
      duration = MORPH_S / (1 + Math.min(2, Math.abs(input.velocity.scroll)) * 0.45);
    }
    aFrom.needsUpdate = true;
    aTo.needsUpdate = true;
    aDelay.needsUpdate = true;
  };

  // Generate the rest of the sequence in idle slots, one shape per slot.
  const prefetch = () => {
    const todo = seq.find((s) => !cache.has(`${s.shape}:${s.variant}`));
    if (!todo || disposed) return;
    getShape(todo);
    if ('requestIdleCallback' in window) requestIdleCallback(prefetch, { timeout: 2000 });
    else setTimeout(prefetch, 120);
  };
  let disposed = false;
  setTimeout(prefetch, 600);

  // ---------- story events ----------
  let target = 0;
  let pp = 0;
  const onStory = (e) => {
    const d = e.detail ?? {};
    if (d.steps && d.steps !== steps) {
      steps = d.steps;
      seq = sequence(set, steps);
    }
    target = Math.min(Math.max(+d.progress || 0, 0), 1);
    const s = Math.min(Math.max(d.step | 0, 0), seq.length - 1);
    const next = seq[s];
    if (s !== step || next.shape !== current.shape || next.variant !== current.variant) {
      const dir = s >= step ? 1 : -1;
      step = s;
      retarget(next, dir);
    }
    invalidate();
  };
  canvas.addEventListener('grow:story', onStory);
  // motion/pin.js replays the current state when asked (this module loads lazily).
  canvas.dispatchEvent(new CustomEvent('grow:story-listen'));

  // ---------- framing ----------
  let fit = 1;
  let H = 1;
  const D = 7.4;
  const fovY = (camera.fov * Math.PI) / 180;
  const sizeUniforms = () => {
    const pr = renderer.getPixelRatio();
    uniforms.uSize.value = 2.5 * Math.pow(18000 / N, 0.4) * pr * Math.min(1.35, Math.max(0.8, H / 520));
  };

  let faceW = FLAT.has(current.shape) ? 1 : 0;
  let spin = faceW ? 0 : 0.5;
  let push = 0;

  return {
    resize(w, h) {
      H = h;
      const pr = renderer.getPixelRatio();
      acc.setSize(Math.max(1, Math.round(w * pr)), Math.max(1, Math.round(h * pr)));
      // Shapes span ~4.1 x 3.9 units: fill the stage without touching its edges.
      const visH = 2 * D * Math.tan(fovY / 2);
      fit = Math.min(1.1, (visH * (w / h)) / 4.7, visH / 4.7);
      rig.scale.setScalar(fit);
      uniforms.uAspect.value = w / h;
      sizeUniforms();
    },
    setQuality() { sizeUniforms(); },
    update(time, scroll, pointer, dt) {
      const live = motion && dt > 0;
      uniforms.uTime.value = motion ? time : 0;
      if (live) {
        morph = Math.min(1, morph + dt / duration);
        if (morph >= 1) duration = MORPH_S;
      }
      uniforms.uMorph.value = morph;
      pp += (target - pp) * (live ? damp(2.2, dt) : 1);

      // Flat shapes (glyphs, icons) turn to face the reader; 3D shapes turn slowly.
      const wantFace = FLAT.has(current.shape) ? 1 : 0;
      faceW += (wantFace - faceW) * (live ? damp(1.6, dt) : 1);
      if (live) {
        spin += dt * 0.13 * (1 - faceW);
        const home = Math.round(spin / TAU) * TAU;
        spin += (home - spin) * damp(2.2 * faceW, dt);
      } else if (!motion) spin = wantFace ? 0 : 0.5;
      points.rotation.y = spin + (motion ? Math.sin(time * 0.31) * 0.1 * faceW : 0);

      // Camera drifts with the story: a slow orbit and a slight dolly through the middle steps.
      const orbit = (pp - 0.5) * 0.62 * (1 - 0.55 * faceW) + (motion ? Math.sin(time * 0.11) * 0.05 : 0);
      const elev = 0.06 + 0.2 * (1 - faceW) + (0.5 - pp) * 0.12 + (motion ? Math.sin(time * 0.07) * 0.025 : 0);
      const dist = D * (1 - Math.sin(pp * Math.PI) * 0.05);
      camera.position.set(Math.sin(orbit) * Math.cos(elev) * dist, Math.sin(elev) * dist, Math.cos(orbit) * Math.cos(elev) * dist);
      camera.lookAt(0, 0, 0);
      uniforms.uFocus.value = dist;

      // Pointer (fine pointers, over the canvas) and scroll speed.
      const l = input.local;
      const wantPush = live && l.inside ? 0.45 + 0.55 * input.active : 0;
      push += (wantPush - push) * (live ? damp(3, dt) : 1);
      uniforms.uPush.value = push;
      uniforms.uPointer.value.set(l.x, l.y);
      const v = live ? Math.max(-3, Math.min(3, input.velocity.scroll)) : 0;
      uniforms.uVel.value = v;
      uniforms.uDrift.value = motion ? DRIFT * (1 + Math.abs(v) * 0.8) : 0;
    },
    render() {
      renderer.setRenderTarget(acc);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(composite, ortho);
    },
    dispose() {
      disposed = true;
      canvas.removeEventListener('grow:story', onStory);
      acc.dispose();
      tri.dispose();
      composite.material.dispose();
    },
  };
}
