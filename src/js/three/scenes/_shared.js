// Shared helpers for the hero scenes (scenes/*.js). Not a scene itself (three/index.js only maps
// the six scene names).
//   frame()        composition: lens shift (camera view offset) + rig scale, so the object sits right of
//                  the headline on wide screens and above / behind it on phones, at any aspect
//   localPointer() pointer in canvas NDC (not window), with presence, velocity, touch pulses and a ray
//   tuneLights()   per-scene key / rim / ambient / environment balance on the lights core.js adds
//   glowMaterial() MeshStandardMaterial with a per-instance lime glow (instanced attribute `aGlow`)
//   canvasTexture(), squarePoints(), seeded random, easing helpers
import * as THREE from 'three';
import { damp } from '../core.js';

export { damp };
export const clamp = (x, a = 0, b = 1) => Math.min(Math.max(x, a), b);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const easeOutCubic = (x) => 1 - Math.pow(1 - clamp(x), 3);
export const easeOutQuart = (x) => 1 - Math.pow(1 - clamp(x), 4);
export const easeInOutCubic = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const easeOutBack = (x, s = 1.4) => { x = clamp(x) - 1; return 1 + (s + 1) * x * x * x + s * x * x; };

// Deterministic random (mulberry32), so every visit (and both tiers) builds the same composition.
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Level of detail from the tier: 'high' 1, 'mid' ~0.65, 'low' ~0.45; phones a bit less again.
export function detail(ctx) {
  const q = ctx.quality === 'high' ? 1 : ctx.quality === 'mid' ? 0.65 : 0.45;
  return ctx.small ? q * 0.8 : q;
}

/**
 * Composition. Keeps the rig at the origin and shifts the projection (camera.setViewOffset), so the
 * camera can orbit / crane around the object while it stays where the layout wants it.
 *   extent  [rx, ry] half width / half height of the object in rig units (at rig scale 1)
 *   desk    { x, y, size }  anchor (fractions of the canvas, y from the top) and the object's
 *           height as a fraction of the canvas height, on wide canvases (aspect > 1.1)
 *   phone   { x, y, size, maxH } same for narrow canvases; size is the width as a fraction of the
 *           canvas width, capped so the height stays under maxH of the canvas height
 *   text    right edge of the headline column on wide canvases (fraction of the width); the object
 *           is pushed right of it (and shrunk if it would leave the canvas)
 *   hud     wide canvases: fit the object inside the hero's viewfinder (.hero__hud, measured on
 *           resize) instead of the `desk` box: centred in it, its height this share of the frame's
 *           height, never past the frame's right edge (falls back to `desk` when the frame is hidden)
 * Returns { wide, scale, x, y, distance } and stores it as ctx.frame (see shiftFrame()).
 */
export function frame(ctx, w, h, opts = {}) {
  const { extent = [2, 2], distance = 9, desk = {}, phone = {} } = opts;
  const { camera, rig } = ctx;
  const [rx, ry] = extent;
  const aspect = w / h;
  const wide = aspect > 1.1;
  const text = wide ? textEdge(ctx, opts.text ?? 0.52) : 0;
  // Web fonts and the intro can still move the copy: measure again once they have settled.
  if (!ctx.relayout) {
    ctx.relayout = () => {
      if (!ctx.canvas.isConnected || !ctx.frameArgs) return;
      frame(ctx, ...ctx.frameArgs);
      ctx.invalidate?.();
    };
    const later = () => setTimeout(ctx.relayout, 1400);
    if (document.fonts?.ready) document.fonts.ready.then(later, later);
    else later();
  }
  ctx.frameArgs = [w, h, opts];
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const visH = 2 * distance * tan;
  const visW = visH * aspect;
  let x;
  let y;
  let scale;
  if (wide) {
    let d = { x: 0.74, y: 0.5, size: 0.8, ...desk };
    let left = text;
    let right = 0.99;
    const box = opts.hud ? hudBox(ctx) : null;
    if (box) {
      d = { x: (box.l + box.r) / 2, y: (box.t + box.b) / 2, size: opts.hud * (box.b - box.t) };
      left = Math.max(text, box.l);
      right = box.r;
    }
    scale = (d.size * visH) / (2 * ry);
    let half = (rx * scale) / visW; // half the object's width, as a fraction of the canvas width
    // Fit between the text column (or the frame's left edge) and the right edge.
    const room = Math.max(0.05, (right - left) / 2);
    if (half > room) {
      scale *= room / half;
      half = room;
    }
    x = clamp(d.x, left + half, right - half);
    y = d.y;
  } else {
    const p = { x: 0.5, y: 0.3, size: 0.9, maxH: 0.5, ...phone };
    scale = Math.min((p.size * visW) / (2 * rx), (p.maxH * visH) / (2 * ry));
    x = p.x;
    y = p.y;
  }
  rig.position.set(0, 0, 0);
  rig.scale.setScalar(scale);
  ctx.frame = { wide, scale, x, y, distance, aspect, w, h, visH, visW, dx: 0, dy: 0 };
  camera.setViewOffset(w, h, w * (0.5 - x), h * (0.5 - y), w, h);
  return ctx.frame;
}

// The viewfinder frame (.hero__hud) as fractions of the canvas: { l, r, t, b }, or null when it is
// not shown. Layout offsets (the frame's depth translate and the canvas's intro zoom are ignored).
function hudBox(ctx) {
  const hero = ctx.canvas.closest('[data-hero]');
  const hud = hero?.querySelector(':scope > .hero__hud');
  const cw = ctx.canvas.clientWidth;
  const ch = ctx.canvas.clientHeight;
  if (!hud || !hud.offsetWidth || !hud.offsetHeight || !cw || !ch) return null;
  const l = hud.offsetLeft / cw;
  const t = hud.offsetTop / ch;
  return { l, r: l + hud.offsetWidth / cw, t, b: t + hud.offsetHeight / ch };
}

/**
 * Right edge of the hero copy (eyebrow, title, sub, buttons) as a fraction of the canvas width, from
 * the actual line boxes (a Range over the text, so a 17ch title box that wraps early does not count).
 * Read on resize only (never in the frame loop). Falls back to `fallback` when there is no copy.
 */
export function textEdge(ctx, fallback = 0.52) {
  const { canvas } = ctx;
  const hero = canvas.closest('[data-hero]');
  const cr = canvas.getBoundingClientRect();
  if (!hero || !cr.width) return fallback;
  const cw = canvas.clientWidth || cr.width;
  const left = cr.left + cr.width / 2 - cw / 2;
  let right = 0;
  const range = document.createRange();
  for (const el of hero.querySelectorAll('.hero__title, .hero__sub, .eyebrow, .hero__meta, .crumbs, .hero__cta a, .hero__cta button')) {
    if (el.closest('.hero__cta')) {
      right = Math.max(right, el.getBoundingClientRect().right);
      continue;
    }
    // text nodes only: an element box inside (a flex list, a block span) would span the column
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (!n.nodeValue.trim()) continue;
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) if (r.width) right = Math.max(right, r.right);
    }
  }
  range.detach?.();
  if (!right) return fallback;
  return clamp((right - left) / cw + 0.025, 0.3, 0.8);
}

// Move the anchor by (dx, dy) canvas fractions from where frame() put it (scroll choreography, e.g.
// letting the object lag behind the leaving hero). Cheap; skips work when nothing changed. On narrow
// canvases (phones) the object sits behind the copy anyway, so it only lags a little.
export function shiftFrame(ctx, dx = 0, dy = 0) {
  const f = ctx.frame;
  if (f && !f.wide) { dx *= 0.3; dy *= 0.3; }
  if (!f || (Math.abs(f.dx - dx) < 1e-5 && Math.abs(f.dy - dy) < 1e-5)) return;
  f.dx = dx;
  f.dy = dy;
  ctx.camera.setViewOffset(f.w, f.h, f.w * (0.5 - f.x - dx), f.h * (0.5 - f.y - dy), f.w, f.h);
}

/**
 * Pointer in the canvas's own NDC (-1..1, y up) with presence. core.js passes a window-relative,
 * slowly smoothed pointer (used for the rig tilt); local interactions need to know where the pointer
 * is over the canvas, whether it is there at all, and how fast it moves.
 *   p.x, p.y      smoothed NDC        p.vx, p.vy  velocity (NDC per second)
 *   p.on          0..1 presence (mouse in the window, or a decaying touch pulse)
 *   p.down        a mouse button / touch is pressed     p.ray(camera) -> THREE.Ray
 * Mouse and pen follow hover; a touch sets the point and a pulse that fades (never blocks scrolling).
 * The canvas rect is cached (re-measured on resize and at most every 400ms while the pointer moves),
 * never read in the frame loop.
 */
export function localPointer(ctx, { rate = 9 } = {}) {
  const { canvas, motion } = ctx;
  const p = { x: 0, y: 0, vx: 0, vy: 0, on: 0, down: false, cx: -1e4, cy: -1e4, presence: 0, pulse: 0, touch: false };
  const rect = { left: 0, top: 0, width: 1, height: 1 };
  let measuredAt = -1e9;
  let scrollAt = 0;
  const measure = () => {
    const r = canvas.getBoundingClientRect();
    // The canvas scales in from 1.08 by CSS on load: use its untransformed size around its centre.
    const cw = canvas.clientWidth || r.width;
    const ch = canvas.clientHeight || r.height;
    rect.left = r.left + r.width / 2 - cw / 2;
    rect.top = r.top + r.height / 2 - ch / 2;
    rect.width = cw || 1;
    rect.height = ch || 1;
    scrollAt = scrollY;
    measuredAt = performance.now();
  };
  const raw = { x: 0, y: 0, has: false };
  const toNdc = () => {
    const top = rect.top - (scrollY - scrollAt);
    raw.x = ((p.cx - rect.left) / rect.width) * 2 - 1;
    raw.y = -(((p.cy - top) / rect.height) * 2 - 1);
  };
  const onMove = (e) => {
    p.cx = e.clientX;
    p.cy = e.clientY;
    if (performance.now() - measuredAt > 400) measure();
    if (e.pointerType === 'touch') {
      p.touch = true;
      p.pulse = Math.max(p.pulse, 0.85);
    } else {
      p.touch = false;
      p.presence = 1;
    }
    if (!raw.has) { toNdc(); p.x = raw.x; p.y = raw.y; }
    raw.has = true;
  };
  const onDown = (e) => {
    onMove(e);
    p.down = true;
    if (e.pointerType === 'touch') p.pulse = 1;
  };
  const onUp = () => { p.down = false; };
  const onLeave = (e) => { if (!e.relatedTarget) { p.presence = 0; p.down = false; } };
  const onBlur = () => { p.presence = 0; p.down = false; };
  if (motion) {
    measure();
    addEventListener('pointermove', onMove, { passive: true });
    addEventListener('pointerdown', onDown, { passive: true });
    addEventListener('pointerup', onUp, { passive: true });
    addEventListener('pointercancel', onUp, { passive: true });
    document.addEventListener('mouseout', onLeave, { passive: true });
    addEventListener('blur', onBlur);
  }
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  p.update = (dt) => {
    if (!raw.has || !dt) return;
    toNdc();
    const k = damp(rate, dt);
    const px = p.x;
    const py = p.y;
    p.x += (raw.x - p.x) * k;
    p.y += (raw.y - p.y) * k;
    const vk = damp(8, dt);
    p.vx += ((p.x - px) / dt - p.vx) * vk;
    p.vy += ((p.y - py) / dt - p.vy) * vk;
    if (p.touch) p.pulse = Math.max(0, p.pulse - dt * (p.down ? 0.25 : 0.9));
    const target = p.touch ? p.pulse : p.presence;
    p.on += (target - p.on) * damp(p.touch ? 12 : 4, dt);
  };
  p.measure = measure;
  p.ray = (camera) => {
    ndc.set(p.x, p.y);
    ray.setFromCamera(ndc, camera);
    return ray.ray;
  };
  p.dispose = () => {
    removeEventListener('pointermove', onMove);
    removeEventListener('pointerdown', onDown);
    removeEventListener('pointerup', onUp);
    removeEventListener('pointercancel', onUp);
    document.removeEventListener('mouseout', onLeave);
    removeEventListener('blur', onBlur);
  };
  return p;
}

/**
 * Brand-true colour: ACES (core's default) pulls #ccff00 towards a pale olive-yellow and bleaches
 * bright lime to white. Khronos PBR Neutral keeps hue and saturation up to the highlights, so lime
 * reads as lime and white as white. Set before the shader compile step (build time).
 */
export function look(ctx, { exposure = 1 } = {}) {
  ctx.renderer.toneMapping = THREE.NeutralToneMapping;
  ctx.renderer.toneMappingExposure = exposure;
}

/**
 * Balance the lights core.js adds (ambient, white key, lime rim point light) and the environment
 * map for one scene. Anything left out keeps core's value.
 */
export function tuneLights(ctx, { ambient, key, keyPos, rim, rimPos, rimDistance, env } = {}) {
  const { scene } = ctx;
  for (const o of scene.children) {
    if (o.isAmbientLight && ambient != null) o.intensity = ambient;
    if (o.isDirectionalLight && !o.userData.scene) {
      if (key != null) o.intensity = key;
      if (keyPos) o.position.set(...keyPos);
    }
    if (o.isPointLight && !o.userData.scene) {
      if (rim != null) o.intensity = rim;
      if (rimPos) o.position.set(...rimPos);
      if (rimDistance != null) o.distance = rimDistance;
    }
  }
  if (env != null) scene.environmentIntensity = env;
}

/**
 * MeshStandardMaterial with a per-instance glow: emissive += glowColor * aGlow (instanced float
 * attribute; add it with addGlow(geometry, count)). Also `uDim` darkens everything (intros).
 */
export function glowMaterial(params = {}, { color = '#ccff00', key = 'glow' } = {}) {
  const mat = new THREE.MeshStandardMaterial(params);
  const uniforms = { uGlowColor: { value: new THREE.Color(color) } };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aGlow;\nvarying float vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uGlowColor;\nvarying float vGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uGlowColor * vGlow;');
  };
  mat.customProgramCacheKey = () => `grow-${key}`;
  mat.userData.uniforms = uniforms;
  return mat;
}

export function addGlow(geometry, count) {
  const a = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  a.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('aGlow', a);
  return a;
}

// A CanvasTexture drawn by `draw(g, w, h)`; sRGB, mipmapped, anisotropic where available.
export function canvasTexture(ctx, w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, ctx.renderer.capabilities.getMaxAnisotropy?.() || 1);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

/**
 * Square points (brand: zero radius) with per-point size and colour, animated in the vertex shader.
 * `body` is GLSL that may modify `vec3 pos`, `float size`, `float alpha` and `vec3 col` from the
 * attributes `position`, `aSeed` (vec4) and `aColor` (vec3), and the uniforms uTime, uScroll, uPx
 * (pixel ratio), uIntro and any `extra` uniforms (declare them in `decl`).
 */
export function squarePoints({ count, seed = 1, positions, seeds, colors, decl = '', body = '', uniforms = {}, blending = THREE.AdditiveBlending, fog = false }) {
  const g = new THREE.BufferGeometry();
  const r = rng(seed);
  const pos = positions ?? new Float32Array(count * 3);
  const sd = seeds ?? Float32Array.from({ length: count * 4 }, r);
  const col = colors ?? new Float32Array(count * 3).fill(1);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 4));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  const u = { uTime: { value: 0 }, uScroll: { value: 0 }, uPx: { value: 1 }, uIntro: { value: 0 }, ...uniforms };
  const mat = new THREE.ShaderMaterial({
    uniforms: fog ? THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]) : {},
    transparent: true,
    depthWrite: false,
    blending,
    fog,
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uScroll; uniform float uPx; uniform float uIntro;
      attribute vec4 aSeed; attribute vec3 aColor;
      varying vec3 vCol; varying float vAlpha;
      ${decl}
      #include <fog_pars_vertex>
      void main() {
        vec3 pos = position; float size = 2.0; float alpha = 1.0; vec3 col = aColor;
        ${body}
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = max(size * uPx * (8.0 / -mvPosition.z), 1.0);
        vCol = col; vAlpha = alpha;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCol; varying float vAlpha;
      #include <fog_pars_fragment>
      void main() {
        if (vAlpha <= 0.002) discard;
        gl_FragColor = vec4(vCol, vAlpha); // straight alpha: the blend multiplies by alpha
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  // Uniform objects are shared with the caller (same references), so they can be animated directly.
  Object.assign(mat.uniforms, u);
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  return pts;
}

// Brand colours as linear-space THREE.Color (renderer works in linear; sRGB output).
export const COLORS = {
  lime: new THREE.Color('#ccff00'),
  white: new THREE.Color('#ffffff'),
  grey: new THREE.Color('#bababa'),
  ink: new THREE.Color('#111111'),
};
