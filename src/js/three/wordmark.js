// CTA wordmark for canvas[data-scene="wordmark"] inside the lime band ([data-cta]): an extruded,
// bevelled "GROW." in Space Grotesk 700. The outlines come from wordmark-glyphs.json, generated at
// build time from the real font by tools/wordmark-glyphs.mjs (SVG path data -> SVGLoader paths ->
// ShapePath.toShapes(), which replaced SVGLoader.createShapes() in r185 ->
// ExtrudeGeometry here). Glossy black lacquer reflecting a soft lime studio (so it belongs on the
// band), a soft contact shadow per letter, letters that drop in with a staggered spring as the band
// scrolls in, a per-letter spring tilt towards the pointer, and an occasional light sweep.
//
// Legibility first: placement is measured against the CTA copy on resize. Right of the copy when
// the band has room; otherwise small, hanging in the band's top-right padding above the eyebrow
// (never behind the black-on-lime buttons). Reduced motion: the assembled word, one still frame.
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { createStage } from './core.js';
import { clamp01 } from './util.js';
import GLYPHS from './wordmark-glyphs.json';

const EM = 1 / 1000; // glyph units -> world units (cap height 0.7)
const DEPTH = 0.2; // extrusion, in em
const SWEEP_EVERY = 7.5; // seconds between light sweeps
const SWEEP_S = 1.5;

export function mount(canvas, opts = {}) {
  return createStage(canvas, {
    ...opts,
    layout: 'center',
    track: canvas.closest('[data-cta]') ?? canvas.parentElement,
    progress: 'through',
    post: false,
    lights: false,
    env: studio,
    fov: 26,
    distance: 12,
    tilt: [0.1, 0.05],
    localPointer: true,
    build: buildWordmark,
  });
}

// A soft studio for the lacquer to reflect: near-black overhead and in front (so the faces read
// as black), the band's lime below and at grazing angles (so bevels and undersides pick it up), one
// long overhead softbox and two vertical strips for crisp highlights along the bevels.
function studio(renderer, THREE) {
  const s = new THREE.Scene();
  const sky = new THREE.SphereGeometry(10, 48, 24);
  const pos = sky.attributes.position;
  const lime = new THREE.Color('#ccff00').multiplyScalar(0.7);
  const dark = new THREE.Color('#060606');
  const col = [];
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 10;
    const z = pos.getZ(i) / 10;
    const t = clamp01((0.15 - y) / 0.85) * (z > 0 ? 1 - z * 0.6 : 1);
    c.copy(dark).lerp(lime, t * t * (3 - 2 * t));
    col.push(c.r, c.g, c.b);
  }
  sky.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  s.add(new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true })));
  const box = (w, h, power, p) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(power, power, power), side: THREE.DoubleSide }));
    m.position.set(...p);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  box(9, 1.6, 5, [0, 6.5, 4.5]);
  box(1.1, 7, 4, [-7.5, 1, 3]);
  box(0.9, 5, 2.5, [6.5, 1.5, -2.5]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(s, 0.02).texture;
  pmrem.dispose();
  s.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  return texture;
}

// Soft shadow of one glyph (canvas 2D shadowBlur works everywhere, unlike ctx.filter).
function shadowTexture(THREE, glyph) {
  const [x0, y0, x1, y1] = glyph.bbox;
  const pad = 140;
  const S = 0.25; // canvas px per glyph unit
  const w = Math.ceil((x1 - x0 + pad * 2) * S);
  const h = Math.ceil((y1 - y0 + pad * 2) * S);
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d');
  g.shadowColor = 'rgba(0,0,0,1)';
  g.shadowBlur = 16;
  g.shadowOffsetX = 4000;
  g.setTransform(S, 0, 0, S, (pad - x0) * S - 4000, (pad - y0) * S);
  g.fill(new Path2D(glyph.d));
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, w: (x1 - x0 + pad * 2) * EM, h: (y1 - y0 + pad * 2) * EM };
}

function buildWordmark(ctx) {
  const { THREE, rig, camera, canvas, motion, input } = ctx;
  const loader = new SVGLoader();
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x040404, roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.2,
  });
  // Light sweep: a soft diagonal band of light that crosses the word now and then.
  const sweep = { uSweep: { value: -99 }, uSweepAmt: { value: 0 }, uSweepAxis: { value: new THREE.Vector3(1, 0.45, 0) } };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, sweep);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSweepAxis;\nvarying float vSweep;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvSweep = dot((modelMatrix * vec4(transformed, 1.0)).xyz, uSweepAxis);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSweep;\nuniform float uSweepAmt;\nvarying float vSweep;')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        float sw = exp(-pow((vSweep - uSweep) / 0.2, 2.0)) * uSweepAmt;
        float rim = 1.0 - abs(dot(normalize(vViewPosition), normalize(vNormal)));
        gl_FragColor.rgb += vec3(sw * (0.28 + 0.72 * rim * rim));`);
  };

  const holder = new THREE.Group(); // placed and scaled on resize (screen layout)
  const word = new THREE.Group(); // the word, centred, in em units
  holder.add(word);
  rig.add(holder);
  const key = new THREE.DirectionalLight(0xffffff, 0.6);
  key.position.set(-2, 4, 5);
  rig.add(key);

  const total = GLYPHS.width * EM;
  const capH = GLYPHS.capHeight * EM;
  const letters = GLYPHS.glyphs.map((g, i) => {
    const shapes = loader.parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${g.d}"/></svg>`).paths.flatMap((p) => p.toShapes());
    const geo = new THREE.ExtrudeGeometry(shapes, {
      depth: DEPTH * 1000, bevelEnabled: true, bevelThickness: 16, bevelSize: 11, bevelOffset: -2, bevelSegments: 4, curveSegments: 10,
    });
    geo.scale(EM, -EM, -EM); // SVG is y-down; two flipped axes keep the faces' winding
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const cx = (bb.min.x + bb.max.x) / 2;
    const cy = (bb.min.y + bb.max.y) / 2;
    const cz = (bb.min.z + bb.max.z) / 2;
    geo.translate(-cx, -cy, -cz); // pivot in the letter's centre
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    const home = new THREE.Vector3(g.x * EM + cx - total / 2, cy - capH / 2, 0);
    mesh.position.copy(home);
    word.add(mesh);
    const sh = shadowTexture(THREE, g);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(sh.w, sh.h),
      new THREE.MeshBasicMaterial({ map: sh.tex, color: 0x000000, transparent: true, opacity: 0, depthWrite: false }),
    );
    shadow.renderOrder = -1;
    word.add(shadow);
    return {
      mesh, shadow, home, i,
      k: motion ? 0 : 1, v: 0, // assembly spring (0 = above the band, 1 = in place)
      rx: 0, ry: 0, vx: 0, vy: 0, // pointer tilt springs
      phase: i * 1.3,
    };
  });

  const band = canvas.closest('[data-cta]');
  let dropH = 3; // word units to start above the band's top edge
  let W = 1;
  let H = 1;
  let wordScale = 1;
  let compact = false;
  const proj = new THREE.Vector3();
  let sweepAt = -1; // time the current sweep started
  let nextSweep = 1.2;
  let landed = false;

  return {
    resize(w, h, { camera: cam }) {
      W = w;
      H = h;
      const upp = (2 * cam.position.z * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) / h; // world units per px at z = 0
      const copy = measureCopy(band);
      const m = Math.max(24, w * 0.04);
      const free = copy ? w - copy.right - 2 * m : 0;
      let wordW; // on-screen width (px)
      let cx;
      let cy;
      compact = !(copy && w > h && free >= 260);
      if (!compact) {
        wordW = Math.min(free * 0.82, 600, h * 1.1);
        cx = copy.right + m + free / 2;
        cy = h * 0.5;
      } else {
        // Hang in the top padding, right-aligned, clear of the eyebrow.
        const room = Math.max(24, (copy?.top ?? 96) - 20);
        wordW = Math.min(w * 0.36, 150, room * 3.2);
        cx = w - m - wordW / 2;
        cy = Math.max(12, (copy?.top ?? 96) * 0.48);
      }
      wordScale = (wordW * upp) / total;
      holder.scale.setScalar(wordScale);
      holder.position.set((cx - w / 2) * upp, (h / 2 - cy) * upp, 0);
      dropH = ((cy + wordW * 0.3) * upp) / wordScale + capH;
      sweep.uSweepAxis.value.set(1, 0.45, 0).normalize().divideScalar(wordScale);
    },
    update(time, scroll, pointer, dt) {
      const live = motion && dt > 0;
      const l = input.local;
      const aspect = W / H;
      let settled = true;
      for (const L of letters) {
        // Assembly: scroll-driven target, spring-followed (a little overshoot when landing). The
        // band is about a viewport tall, so the last letter lands by the time its top edge has
        // reached ~20% of the viewport (progress 0.38), i.e. while the whole band is on screen.
        const target = motion ? clamp01((scroll - 0.06 - L.i * 0.035) / 0.18) : 1;
        // Pointer tilt: letters near the pointer turn towards it (springy), plus an idle sway.
        let tx = 0;
        let ty = 0;
        if (live && l.inside && !compact) {
          proj.copy(L.mesh.position);
          L.mesh.parent.localToWorld(proj).project(camera);
          const dx = (l.x - proj.x) * aspect;
          const dy = l.y - proj.y;
          const fall = Math.exp(-(dx * dx + dy * dy) / 0.35);
          ty = THREE.MathUtils.clamp(dx * 1.3, -0.55, 0.55) * fall + input.velocity.x * 0.05 * fall;
          tx = THREE.MathUtils.clamp(-dy * 1.6, -0.45, 0.45) * fall;
        }
        if (live) {
          ty += Math.sin(time * 0.55 + L.phase) * 0.035;
          tx += Math.sin(time * 0.43 + L.phase * 1.7) * 0.02;
          // semi-implicit Euler in <= 1/60 s steps (stable at any frame rate)
          for (let t = dt; t > 1e-6; t -= 1 / 60) {
            const h = Math.min(1 / 60, t);
            L.v += ((target - L.k) * 90 - L.v * 13) * h;
            L.k += L.v * h;
            L.vx += ((tx - L.rx) * 55 - L.vx * 6.5) * h;
            L.vy += ((ty - L.ry) * 55 - L.vy * 6.5) * h;
            L.rx += L.vx * h;
            L.ry += L.vy * h;
          }
        } else L.k = target;
        if (Math.abs(L.k - 1) > 0.02) settled = false;
        const drop = 1 - L.k;
        const bob = live ? Math.sin(time * 0.8 + L.phase) * 0.012 : 0;
        L.mesh.position.set(L.home.x, L.home.y + drop * dropH + bob, L.home.z + Math.max(0, drop) * 0.8);
        L.mesh.rotation.set(L.rx - drop * 1.25, L.ry + drop * (L.i % 2 ? 0.55 : -0.55), drop * (L.i - 2) * 0.2);
        // Contact shadow: on the band behind the letter, softer and fainter while it is high.
        const up = clamp01(drop);
        L.shadow.position.set(L.home.x + 0.045 + up * 0.25, L.home.y - 0.06 - up * 0.1, -DEPTH * 0.5 - 0.06);
        L.shadow.scale.setScalar(1 + up * 0.5);
        L.shadow.material.opacity = 0.34 * clamp01(L.k) ** 2 * (1 - up);
      }
      // Light sweep: once shortly after landing, then every few seconds.
      if (live) {
        if (settled && !landed) { landed = true; nextSweep = time + 0.35; }
        if (!settled && landed && letters.every((L) => L.k < 0.5)) landed = false;
        if (landed && sweepAt < 0 && time >= nextSweep) sweepAt = time;
        if (sweepAt >= 0) {
          const p = (time - sweepAt) / SWEEP_S;
          if (p >= 1) { sweepAt = -1; nextSweep = time + SWEEP_EVERY; sweep.uSweepAmt.value = 0; }
          else {
            const base = holder.position.x / wordScale + (holder.position.y / wordScale) * 0.45;
            sweep.uSweep.value = base / Math.hypot(1, 0.45) + (p * 2 - 1) * (total * 0.75);
            sweep.uSweepAmt.value = Math.sin(p * Math.PI) * 0.8;
          }
        }
      }
      word.rotation.y = live ? Math.sin(time * 0.17) * 0.06 : -0.05;
      word.rotation.x = live ? Math.sin(time * 0.13) * 0.03 : 0.02;
    },
    dispose() {
      for (const L of letters) L.shadow.material.map?.dispose();
    },
  };
}

// The copy's right edge (text extents, not block boxes) and its top, in band pixels. Layout
// reads only, on resize; offsets ignore the CTA reveal's transform.
function measureCopy(band) {
  const inner = band?.querySelector('.cta__inner');
  if (!inner?.firstElementChild) return null;
  const left = band.getBoundingClientRect().left;
  const range = document.createRange();
  let right = 0;
  for (const el of inner.children) {
    const parts = el.matches('.btn-row') ? [...el.children].map((b) => b.getBoundingClientRect()) : [(range.selectNodeContents(el), range.getBoundingClientRect())];
    for (const r of parts) if (r.width) right = Math.max(right, r.right - left);
  }
  let top = 0;
  for (let el = inner.firstElementChild; el && el !== band; el = el.offsetParent) top += el.offsetTop;
  return { right, top };
}
