// Post-processing for the `high` tier (hero stages): one small, hand-rolled pipeline instead of
// EffectComposer, so every pass is ours to tune. Loaded on demand by core.js; never in the main
// bundle.
//
//   1. scene -> HDR target (HalfFloat, WebGL2 MSAA x4): crisp edges, highlights above 1.0 survive
//   2. bloom: prefilter (soft-knee threshold on the brightest channel, weighted by saturation so
//      the acid-lime accents and emissive bits glow while lit white/grey surfaces barely do;
//      Karis average against fireflies) -> 13-tap downsample chain -> tent upsample chain
//   3. final pass to the canvas: very subtle radial chromatic aberration towards the edges,
//      bloom add, soft vignette, the renderer's tone mapping + sRGB output (same as the plain
//      path, so tiers match), then fine luminance-weighted film grain and dithering
//
// The old pipeline passed every pixel above the threshold through at full HDR brightness, so the
// bright white faces of the bars/blocks scenes bloomed into a white wash. The prefilter below only
// passes the *excess* over the threshold, scaled by colourfulness.
//
// Scenes tune bloom by returning `bloom: { strength, radius, threshold, white }` from build(ctx)
// (read every frame, so it can be animated). See docs/ARCHITECTURE.md.
import * as THREE from 'three';

export const BLOOM = {
  strength: 0.8, // how much of the blurred excess is added back (0..~2)
  radius: 0.65, // 0..1: weight of the wider mip levels (0.3 tight halo .. 1 wide haze)
  threshold: 0.72, // HDR brightness (max channel, linear) where glow starts; soft knee below it
  white: 0.1, // 0..1: how much unsaturated (white/grey) highlights may glow, relative to lime
};
const KNEE = 0.45; // fraction of the threshold over which the soft knee eases in
const FX = { grain: 0.035, aberration: 0.0032, vignette: 0.28 };
const MAX_LEVELS = 6;

// True when the GPU can render to half-float targets (practically every WebGL2 device). Without
// it, core.js renders directly (no bloom).
export const supportsPost = (renderer) => renderer.capabilities.isWebGL2 !== false
  && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));

const VERT = /* glsl */ `varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// 13-tap "Call of Duty" downsample (Jimenez 2014). With PREFILTER: Karis-weighted groups (no
// fireflies) and the threshold curve.
const DOWN = /* glsl */ `uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
#ifdef PREFILTER
uniform vec4 uCurve; // threshold, threshold - knee, 2 * knee, 0.25 / knee
uniform float uWhite;
float karis(vec3 c) { return 1.0 / (1.0 + max(max(c.r, c.g), c.b)); }
#endif
vec3 tap(vec2 o) { return texture2D(tSrc, vUv + o * uTexel).rgb; }
void main() {
  vec3 a = tap(vec2(-2.0, 2.0)), b = tap(vec2(0.0, 2.0)), c = tap(vec2(2.0, 2.0));
  vec3 d = tap(vec2(-2.0, 0.0)), e = tap(vec2(0.0)), f = tap(vec2(2.0, 0.0));
  vec3 g = tap(vec2(-2.0, -2.0)), h = tap(vec2(0.0, -2.0)), i = tap(vec2(2.0, -2.0));
  vec3 j = tap(vec2(-1.0, 1.0)), k = tap(vec2(1.0, 1.0)), l = tap(vec2(-1.0, -1.0)), m = tap(vec2(1.0, -1.0));
#ifdef PREFILTER
  vec3 g0 = (a + b + d + e) * 0.25, g1 = (b + c + e + f) * 0.25, g2 = (d + e + g + h) * 0.25, g3 = (e + f + h + i) * 0.25, g4 = (j + k + l + m) * 0.25;
  float w0 = karis(g0), w1 = karis(g1), w2 = karis(g2), w3 = karis(g3), w4 = karis(g4);
  vec3 col = (g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4 * 4.0) / (w0 + w1 + w2 + w3 + w4 * 4.0);
  col = min(col, vec3(32.0));
  float br = max(max(col.r, col.g), col.b);
  float soft = clamp(br - uCurve.y, 0.0, uCurve.z);
  soft = soft * soft * uCurve.w;
  col *= max(soft, br - uCurve.x) / max(br, 1e-4);
  float sat = (br - min(min(col.r, col.g), col.b)) / max(br, 1e-4);
  col *= mix(uWhite, 1.0, smoothstep(0.15, 0.75, sat));
#else
  vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
#endif
  gl_FragColor = vec4(col, 1.0);
}`;

// 3x3 tent upsample of the smaller level, added to this level's downsample.
const UP = /* glsl */ `uniform sampler2D tSrc; uniform sampler2D tBase; uniform vec2 uTexel; uniform float uRadius; varying vec2 vUv;
void main() {
  vec4 o = vec4(uTexel, -uTexel.x, 0.0);
  vec3 s = texture2D(tSrc, vUv - o.xy).rgb + texture2D(tSrc, vUv - o.wy).rgb * 2.0 + texture2D(tSrc, vUv - o.zy).rgb
    + texture2D(tSrc, vUv + o.zw).rgb * 2.0 + texture2D(tSrc, vUv).rgb * 4.0 + texture2D(tSrc, vUv + o.xw).rgb * 2.0
    + texture2D(tSrc, vUv + o.zy).rgb + texture2D(tSrc, vUv + o.wy).rgb * 2.0 + texture2D(tSrc, vUv + o.xy).rgb;
  gl_FragColor = vec4(texture2D(tBase, vUv).rgb + s * (uRadius / 16.0), 1.0);
}`;

// Final pass to the canvas. ShaderMaterial (not Raw): three injects the renderer's tone mapping and
// output colour space for the null render target, exactly like OutputPass.
const FINAL = /* glsl */ `uniform sampler2D tScene; uniform sampler2D tBloom;
uniform float uBloom; uniform float uGrain; uniform float uAberration; uniform float uVignette;
uniform float uTime; uniform vec2 uAspect;
varying vec2 vUv;
float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
void main() {
  vec2 d = vUv - 0.5;
  float r2 = dot(d * uAspect, d * uAspect);
  vec3 col;
  if (uAberration > 0.0) {
    vec2 off = d * smoothstep(0.12, 0.9, r2) * uAberration; // zero in the middle, a hair at the edges
    col = vec3(texture2D(tScene, vUv - off).r, texture2D(tScene, vUv).g, texture2D(tScene, vUv + off).b);
  } else col = texture2D(tScene, vUv).rgb;
  col += texture2D(tBloom, vUv).rgb * uBloom;
  col *= 1.0 - uVignette * smoothstep(0.12, 0.62, r2);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  // Grain lives in the lit parts (the page's own CSS grain covers the blacks), plus 1/255 dither.
  float n = hash(gl_FragCoord.xy + fract(uTime * 7.31) * 517.0) - 0.5;
  float lum = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  gl_FragColor.rgb += n * (uGrain * smoothstep(0.02, 0.3, lum) * (1.1 - lum) + 1.0 / 255.0);
}`;

function target(w, h, opts = {}) {
  return new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false, ...opts,
  });
}

/**
 * @param {object} o
 *   renderer, scene, camera; width/height in CSS px (the renderer's pixel ratio is applied)
 *   bloom    initial bloom settings (BLOOM defaults); `params` may be swapped per frame in render()
 *   effects  false: MSAA + tone mapping only (an automatic tier drop keeps edges smooth this way,
 *            since a post-processed stage's context is created without its own antialiasing)
 */
export function createPost({ renderer, scene, camera, width, height, effects = true }) {
  const samples = Math.min(4, renderer.capabilities.maxSamples || 4);
  const sceneRT = target(1, 1, { samples, depthBuffer: true });
  const downs = [];
  const ups = [];
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(tri);
  quad.frustumCulled = false;
  const shader = (fragmentShader, uniforms, defines = {}) => new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader, uniforms, defines, depthTest: false, depthWrite: false, toneMapped: false,
  });
  const prefilter = shader(DOWN, {
    tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uCurve: { value: new THREE.Vector4() }, uWhite: { value: BLOOM.white },
  }, { PREFILTER: '' });
  const down = shader(DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
  const up = shader(UP, { tSrc: { value: null }, tBase: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: BLOOM.radius } });
  const final = shader(FINAL, {
    tScene: { value: sceneRT.texture }, tBloom: { value: null }, uBloom: { value: 0 }, uGrain: { value: 0 },
    uAberration: { value: 0 }, uVignette: { value: 0 }, uTime: { value: 0 }, uAspect: { value: new THREE.Vector2(1, 1) },
  });
  final.toneMapped = true; // the renderer's tone mapping + sRGB happen here, once
  const black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  black.needsUpdate = true;

  let W = 1;
  let H = 1;
  let ratio = renderer.getPixelRatio();
  let fade = 0; // effects ease in over ~1.2s, together with the canvas fade-in
  let on = effects;
  const merged = { ...BLOOM };

  function layout() {
    const w = Math.max(1, Math.round(W * ratio));
    const h = Math.max(1, Math.round(H * ratio));
    sceneRT.setSize(w, h);
    // Mip chain from half resolution down to ~12px.
    let n = 0;
    let lw = Math.max(1, w >> 1);
    let lh = Math.max(1, h >> 1);
    while (n < MAX_LEVELS && Math.min(lw, lh) >= 12) {
      if (!downs[n]) downs[n] = target(lw, lh);
      else downs[n].setSize(lw, lh);
      if (n > 0) {
        if (!ups[n - 1]) ups[n - 1] = target(1, 1);
        ups[n - 1].setSize(downs[n - 1].width, downs[n - 1].height);
      }
      n++;
      lw = Math.max(1, lw >> 1);
      lh = Math.max(1, lh >> 1);
    }
    for (const rt of downs.splice(n)) rt.dispose();
    for (const rt of ups.splice(Math.max(0, n - 1))) rt.dispose();
    final.uniforms.uAspect.value.set(Math.max(1, w / h), Math.max(1, h / w));
  }

  function pass(material, rt) {
    quad.material = material;
    renderer.setRenderTarget(rt);
    renderer.render(quad, cam);
  }

  function bloomPass(params) {
    const k = Math.max(params.threshold, 1e-3);
    const knee = k * KNEE + 1e-4;
    prefilter.uniforms.uCurve.value.set(k, k - knee, knee * 2, 0.25 / knee);
    prefilter.uniforms.uWhite.value = params.white;
    prefilter.uniforms.tSrc.value = sceneRT.texture;
    prefilter.uniforms.uTexel.value.set(1 / sceneRT.width, 1 / sceneRT.height);
    pass(prefilter, downs[0]);
    for (let i = 1; i < downs.length; i++) {
      down.uniforms.tSrc.value = downs[i - 1].texture;
      down.uniforms.uTexel.value.set(1 / downs[i - 1].width, 1 / downs[i - 1].height);
      pass(down, downs[i]);
    }
    const radius = THREE.MathUtils.clamp(params.radius, 0.05, 1);
    up.uniforms.uRadius.value = radius;
    let src = downs[downs.length - 1];
    for (let i = downs.length - 2; i >= 0; i--) {
      up.uniforms.tSrc.value = src.texture;
      up.uniforms.tBase.value = downs[i].texture;
      up.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      pass(up, ups[i]);
      src = ups[i];
    }
    // Normalise by the summed level weights so `strength` means the same at any size.
    let norm = 0;
    for (let i = 0; i < downs.length; i++) norm += radius ** i;
    return { texture: src.texture, norm };
  }

  layout();
  return {
    get effects() { return on; },
    setEffects(v) { on = !!v; },
    setSize(w, h) { W = w; H = h; layout(); },
    setPixelRatio(r) { ratio = r; layout(); },
    /**
     * @param {number} t   seconds (grain animation)
     * @param {number} dt  seconds since the last frame (0 for still frames: effects at full)
     * @param {object} [params] bloom settings, merged over BLOOM
     */
    render(t, dt = 1 / 60, params = BLOOM) {
      const p = !params || params === BLOOM ? BLOOM : Object.assign(Object.assign(merged, BLOOM), params);
      fade = dt ? Math.min(1, fade + dt / 1.2) : 1;
      const k = on ? fade * fade * (3 - 2 * fade) : 0;
      renderer.setRenderTarget(sceneRT);
      renderer.clear();
      renderer.render(scene, camera);
      if (k > 0 && p.strength > 0 && downs.length) {
        const b = bloomPass(p);
        final.uniforms.tBloom.value = b.texture;
        final.uniforms.uBloom.value = (p.strength * k) / b.norm;
      } else {
        final.uniforms.tBloom.value = black;
        final.uniforms.uBloom.value = 0;
      }
      final.uniforms.uGrain.value = FX.grain * k;
      final.uniforms.uAberration.value = FX.aberration * k;
      final.uniforms.uVignette.value = FX.vignette * (on ? 1 : 0.6);
      final.uniforms.uTime.value = t;
      pass(final, null);
    },
    dispose() {
      sceneRT.dispose();
      for (const rt of [...downs, ...ups]) rt.dispose();
      for (const m of [prefilter, down, up, final]) m.dispose();
      tri.dispose();
      black.dispose();
    },
  };
}
