// Liquid orb (Facebook/Instagram, TikTok, social media, influencer). A black-chrome liquid sphere
// (noise displacement, normals recomputed per vertex by finite differences) with an iridescent
// lime/white fresnel and lime light glowing up from its troughs; "post" tiles (mini feed UIs drawn
// on canvases: photo post, video, like, comment, stats; no text) orbit it and get liked.
//   intro   the orb swells from a drop, tiles fly in from behind onto their orbits
//   idle    the surface flows, tiles orbit, now and then a tile pops and a lime heart floats up
//   pointer the surface is pulled towards the cursor (a soft bulge that follows it); tiles near the
//           cursor lean towards it and lift
//   scroll  the tiles leave their orbits and settle into a 3-column feed grid in front of the orb,
//           which sinks back and dims
import * as THREE from 'three';
import {
  clamp, lerp, smooth, easeOutCubic, easeInOutCubic, easeOutBack, rng, frame, shiftFrame,
  localPointer, tuneLights, canvasTexture, damp, look,
} from './_shared.js';
import { NOISE } from '../util.js';

const INK = '#0b0b0b';
const LINE = '#2c2c2c';
const MID = '#5c5c5c';
const SOFT = '#9a9a9a';
const LIME = '#ccff00';

// ---------- icons (zero radius, 2px rules) ----------
function heart(g, x, y, s, fill) {
  g.beginPath();
  g.moveTo(x, y + s * 0.32);
  g.bezierCurveTo(x, y - s * 0.05, x - s * 0.5, y - s * 0.05, x - s * 0.5, y + s * 0.28);
  g.bezierCurveTo(x - s * 0.5, y + s * 0.55, x - s * 0.15, y + s * 0.7, x, y + s * 0.88);
  g.bezierCurveTo(x + s * 0.15, y + s * 0.7, x + s * 0.5, y + s * 0.55, x + s * 0.5, y + s * 0.28);
  g.bezierCurveTo(x + s * 0.5, y - s * 0.05, x, y - s * 0.05, x, y + s * 0.32);
  g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); } else g.stroke();
}
function bubble(g, x, y, s, fill) {
  g.beginPath();
  g.moveTo(x - s * 0.5, y);
  g.lineTo(x + s * 0.5, y);
  g.lineTo(x + s * 0.5, y + s * 0.62);
  g.lineTo(x - s * 0.05, y + s * 0.62);
  g.lineTo(x - s * 0.32, y + s * 0.88);
  g.lineTo(x - s * 0.32, y + s * 0.62);
  g.lineTo(x - s * 0.5, y + s * 0.62);
  g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); } else g.stroke();
}
function plane(g, x, y, s) {
  g.beginPath();
  g.moveTo(x - s * 0.5, y + s * 0.38);
  g.lineTo(x + s * 0.5, y);
  g.lineTo(x - s * 0.1, y + s * 0.85);
  g.lineTo(x - s * 0.18, y + s * 0.5);
  g.closePath();
  g.stroke();
}
function play(g, x, y, s, fill) {
  g.beginPath();
  g.moveTo(x - s * 0.36, y - s * 0.46);
  g.lineTo(x + s * 0.48, y);
  g.lineTo(x - s * 0.36, y + s * 0.46);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
}
function lines(g, x, y, widths, h, gap, color = LINE) {
  g.fillStyle = color;
  widths.forEach((w, i) => g.fillRect(x, y + i * (h + gap), w, h));
}

// Abstract "photo": grey gradient field with a few hard-edged shapes.
function photo(g, x, y, w, h, r, accent) {
  const grd = g.createLinearGradient(x, y, x + w, y + h);
  grd.addColorStop(0, '#2a2a2a');
  grd.addColorStop(1, '#0f0f0f');
  g.fillStyle = grd;
  g.fillRect(x, y, w, h);
  g.fillStyle = '#3d3d3d';
  g.fillRect(x + w * (0.1 + r() * 0.2), y + h * (0.45 + r() * 0.2), w * 0.55, h * 0.35);
  g.fillStyle = accent ? LIME : '#6e6e6e';
  const s = w * (0.16 + r() * 0.1);
  g.fillRect(x + w * (0.55 + r() * 0.2), y + h * (0.12 + r() * 0.15), s, s);
  g.strokeStyle = '#4a4a4a';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x, y + h * 0.82);
  g.lineTo(x + w * 0.35, y + h * 0.62);
  g.lineTo(x + w * 0.6, y + h * 0.74);
  g.lineTo(x + w, y + h * 0.5);
  g.stroke();
}

const VARIANTS = ['post', 'video', 'like', 'comment', 'stats', 'post2'];
function drawTile(g, W, H, kind, seed) {
  const r = rng(seed);
  const u = W / 256;
  g.fillStyle = INK;
  g.fillRect(0, 0, W, H);
  g.lineWidth = 2 * u;
  g.strokeStyle = '#3a3a3a';
  g.strokeRect(u, u, W - 2 * u, H - 2 * u);
  const pad = 16 * u;
  if (kind === 'post' || kind === 'post2') {
    g.fillStyle = kind === 'post' ? LIME : SOFT;
    g.fillRect(pad, pad, 22 * u, 22 * u);
    lines(g, pad + 32 * u, pad + 3 * u, [70 * u, 42 * u], 6 * u, 6 * u, MID);
    photo(g, pad, pad + 34 * u, W - 2 * pad, H * 0.56, r, kind === 'post');
    const iy = pad + 44 * u + H * 0.56;
    g.strokeStyle = '#d8d8d8';
    g.lineWidth = 2.4 * u;
    heart(g, pad + 11 * u, iy, 22 * u, kind === 'post' ? LIME : null);
    bubble(g, pad + 46 * u, iy + 2 * u, 20 * u);
    plane(g, pad + 80 * u, iy + 1 * u, 20 * u);
    lines(g, pad, iy + 30 * u, [120 * u, 84 * u], 6 * u, 7 * u);
  } else if (kind === 'video') {
    photo(g, 0, 0, W, H, r, false);
    const grd = g.createLinearGradient(0, H * 0.5, 0, H);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, 'rgba(0,0,0,0.85)');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#3a3a3a';
    g.lineWidth = 2 * u;
    g.strokeRect(u, u, W - 2 * u, H - 2 * u);
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(W / 2 - 34 * u, H * 0.42 - 34 * u, 68 * u, 68 * u);
    play(g, W / 2 + 3 * u, H * 0.42, 40 * u, '#ececec');
    g.strokeStyle = '#d8d8d8';
    g.lineWidth = 2.4 * u;
    heart(g, W - pad - 12 * u, H * 0.55, 22 * u, LIME);
    bubble(g, W - pad - 12 * u, H * 0.55 + 36 * u, 20 * u);
    g.fillStyle = '#3a3a3a';
    g.fillRect(pad, H - pad - 4 * u, W - 2 * pad, 4 * u);
    g.fillStyle = LIME;
    g.fillRect(pad, H - pad - 4 * u, (W - 2 * pad) * 0.42, 4 * u);
    lines(g, pad, H - pad - 34 * u, [110 * u, 70 * u], 6 * u, 7 * u, MID);
  } else if (kind === 'like') {
    g.fillStyle = LIME;
    g.fillRect(pad, pad, W - 2 * pad, H * 0.5);
    heart(g, W / 2, pad + H * 0.1, 70 * u, INK);
    g.fillStyle = INK;
    g.fillRect(W / 2 - 30 * u, pad + H * 0.38, 60 * u, 8 * u);
    for (let i = 0; i < 3; i++) {
      const y = pad + H * 0.56 + i * 36 * u;
      g.fillStyle = i === 0 ? SOFT : '#4a4a4a';
      g.fillRect(pad, y, 22 * u, 22 * u);
      lines(g, pad + 32 * u, y + 3 * u, [(110 - i * 20) * u, (70 - i * 10) * u], 6 * u, 5 * u);
    }
  } else if (kind === 'comment') {
    g.strokeStyle = LIME;
    g.lineWidth = 3 * u;
    bubble(g, W / 2, pad + 10 * u, 90 * u);
    for (let i = 0; i < 4; i++) {
      const y = pad + 118 * u + i * 40 * u;
      g.fillStyle = i % 2 ? '#4a4a4a' : SOFT;
      g.fillRect(pad, y, 20 * u, 20 * u);
      lines(g, pad + 30 * u, y + 2 * u, [(150 - i * 18) * u, (96 - i * 12) * u], 6 * u, 5 * u, i === 0 ? MID : LINE);
    }
  } else if (kind === 'stats') {
    lines(g, pad, pad, [90 * u], 8 * u, 0, MID);
    const n = 7;
    const bw = (W - 2 * pad) / n;
    for (let i = 0; i < n; i++) {
      const hh = H * (0.12 + Math.pow((i + 1) / n, 1.6) * 0.5 + r() * 0.05);
      g.fillStyle = i === n - 1 ? LIME : i > n - 4 ? '#5e5e5e' : '#333333';
      g.fillRect(pad + i * bw + bw * 0.18, H * 0.78 - hh, bw * 0.64, hh);
    }
    g.fillStyle = '#3a3a3a';
    g.fillRect(pad, H * 0.78, W - 2 * pad, 2 * u);
    g.strokeStyle = LIME;
    g.lineWidth = 3 * u;
    g.beginPath();
    g.moveTo(W - pad - 34 * u, pad + 26 * u);
    g.lineTo(W - pad - 8 * u, pad);
    g.moveTo(W - pad - 24 * u, pad);
    g.lineTo(W - pad - 8 * u, pad);
    g.lineTo(W - pad - 8 * u, pad + 16 * u);
    g.stroke();
    lines(g, pad, H * 0.84, [120 * u, 70 * u], 6 * u, 7 * u);
  }
}

export default function build(ctx) {
  const { rig, camera, renderer, palette, motion } = ctx;
  const rand = rng(41);
  const R = 1.05;

  // ---------- orb ----------
  const seg = ctx.quality === 'high' && !ctx.small ? [176, 132] : ctx.small ? [96, 72] : [128, 96];
  const orbGeo = new THREE.SphereGeometry(1, seg[0], seg[1]);
  const ou = {
    uTime: { value: 0 },
    uAmp: { value: 1 },
    uR: { value: R },
    uPull: { value: new THREE.Vector3(0, 0, 1) },
    uPullAmt: { value: 0 },
    uLime: { value: palette.lime.clone() },
    uGlow: { value: 1 },
  };
  const orbMat = new THREE.MeshStandardMaterial({ color: '#333333', roughness: 0.12, metalness: 1, envMapIntensity: 0.85 });
  orbMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, ou);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform float uAmp; uniform float uR; uniform vec3 uPull; uniform float uPullAmt;
        varying float vDisp;
        ${NOISE}
        float dispAt(vec3 n) {
          float d = snoise(n * 0.95 + vec3(0.0, uTime * 0.18, uTime * 0.09)) * 0.13
                  + snoise(n * 1.9 - vec3(uTime * 0.23, 0.0, uTime * 0.13)) * 0.025;
          float k = max(dot(n, uPull), 0.0);
          d += uPullAmt * (pow(k, 7.0) * 0.42 + pow(k, 2.0) * 0.05);
          return d * uAmp;
        }
        vec3 surf(vec3 n) { return n * (uR + dispAt(n)); }`)
      .replace('#include <beginnormal_vertex>', `
        vec3 nrm = normalize(position);
        vec3 helper = abs(nrm.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
        vec3 t1 = normalize(cross(nrm, helper));
        vec3 t2 = cross(nrm, t1);
        float eps = 0.012;
        vec3 p0 = surf(nrm);
        vec3 p1 = surf(normalize(nrm + t1 * eps));
        vec3 p2 = surf(normalize(nrm + t2 * eps));
        vec3 objectNormal = normalize(cross(p1 - p0, p2 - p0));
        if (dot(objectNormal, nrm) < 0.0) objectNormal = -objectNormal;
        vDisp = (length(p0) - uR) / max(uAmp, 0.001);`)
      .replace('#include <begin_vertex>', 'vec3 transformed = p0;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uLime; uniform float uGlow; uniform float uTime; varying float vDisp;')
      .replace('#include <opaque_fragment>', `
        vec3 vdir = normalize(vViewPosition);
        float fr = 1.0 - clamp(dot(normal, vdir), 0.0, 1.0);
        // lime <-> white iridescence along the rim, shifting with the surface and time
        float band = 0.5 + 0.5 * sin(fr * 9.0 + vDisp * 26.0 - uTime * 0.7);
        vec3 irid = mix(uLime, vec3(0.9), band * 0.6);
        outgoingLight += irid * pow(fr, 4.2) * 1.1 * uGlow;
        // a faint lime light from inside, strongest in the troughs facing the viewer
        float trough = smoothstep(-0.02, -0.15, vDisp);
        outgoingLight += uLime * trough * pow(1.0 - fr, 2.0) * 0.07 * uGlow;
        #include <opaque_fragment>`);
  };
  orbMat.customProgramCacheKey = () => 'grow-orb';
  const orb = new THREE.Mesh(orbGeo, orbMat);
  const orbGroup = new THREE.Group();
  orbGroup.add(orb);
  rig.add(orbGroup);

  // Soft lime aura behind the orb (camera-facing).
  const auraMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uA: { value: 0 }, uColor: { value: palette.lime.clone() } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uA; uniform vec3 uColor; varying vec2 vUv; void main(){ float d = length(vUv - 0.5) * 2.0; float a = uA * pow(max(1.0 - d, 0.0), 2.6) * 0.32; gl_FragColor = vec4(uColor * a, a);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
  });
  const aura = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 5.2), auraMat);
  orbGroup.add(aura);

  // Orbit guides: two thin ellipses.
  const guides = [];
  for (const [rx, tilt, tw] of [[1.85, 0.32, -0.25], [2.22, -0.18, 0.4]]) {
    const pts = new THREE.EllipseCurve(0, 0, rx, rx, 0, Math.PI * 2).getPoints(160).map((p) => new THREE.Vector3(p.x, 0, p.y));
    const gl = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
    gl.rotation.set(tilt, 0, tw);
    guides.push(gl);
    rig.add(gl);
  }

  // ---------- tiles ----------
  const TILES = ctx.small ? 6 : ctx.quality === 'high' ? 9 : 7;
  const texW = ctx.quality === 'high' ? 320 : 224;
  const texH = Math.round(texW * 1.25);
  const textures = VARIANTS.map((kind, i) => canvasTexture(ctx, texW, texH, (g, W, H) => drawTile(g, W, H, kind, 100 + i)));
  const TW = 0.68;
  const TH = TW * 1.25;
  const tileGeo = new THREE.PlaneGeometry(TW, TH);
  const tiles = [];
  for (let i = 0; i < TILES; i++) {
    const m = new THREE.MeshBasicMaterial({ map: textures[i % textures.length], transparent: true, opacity: 0, side: THREE.DoubleSide, toneMapped: false });
    const mesh = new THREE.Mesh(tileGeo, m);
    const ring = i % 2;
    mesh.userData = {
      ring,
      r: ring ? 2.22 : 1.85,
      tilt: ring ? -0.18 : 0.32,
      tw: ring ? 0.4 : -0.25,
      phase: (i / TILES) * Math.PI * 2 + rand() * 0.4,
      speed: (ring ? 0.09 : 0.13) * (rand() < 0.5 ? 1 : 1),
      bob: rand() * 6.28,
      pop: 0,
      hover: 0,
      delay: 0.5 + i * 0.12,
    };
    tiles.push(mesh);
    rig.add(mesh);
  }
  // Floating hearts (likes).
  const heartTex = canvasTexture(ctx, 128, 128, (g, W) => {
    g.fillStyle = LIME;
    g.fillRect(W * 0.14, W * 0.14, W * 0.72, W * 0.72);
    heart(g, W / 2, W * 0.26, W * 0.5, INK);
  });
  const hearts = Array.from({ length: 4 }, () => {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ map: heartTex, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
    s.userData = { t: 1e3, from: new THREE.Vector3() };
    rig.add(s);
    return s;
  });

  // ---------- lights ----------
  look(ctx, { exposure: 1.05 });
  tuneLights(ctx, { ambient: 0.05, key: 1.6, keyPos: [3, 4, 5], rim: 22, rimPos: [-2.6, 1.6, -1.6], env: 0.9 });

  // ---------- state ----------
  const pointer = localPointer(ctx);
  const pullDir = new THREE.Vector3(0, 0, 1);
  const tmpV = new THREE.Vector3();
  const tmpV2 = new THREE.Vector3();
  const inv = new THREE.Matrix4();
  const localRay = new THREE.Ray();
  const sphere = new THREE.Sphere(new THREE.Vector3(), R * 1.05);
  const proj = new THREE.Vector3();
  const camLocal = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const eul = new THREE.Euler();
  const target = new THREE.Vector3();
  let pullAmt = 0;
  let nextPop = 2.8;
  let heartIdx = 0;
  const gridCols = 3;

  function layout(w, h) {
    frame(ctx, w, h, {
      extent: [2.75, 2.35],
      desk: { x: 0.745, y: 0.5, size: 0.84 },
      phone: { x: 0.5, y: 0.24, size: 1.05, maxH: 0.5 },
    });
    pointer.measure?.();
  }

  return {
    bloom: { strength: 0.45, radius: 0.38, threshold: 0.86 },
    resize: (w, h) => layout(w, h),
    update(time, scroll, _p, dt) {
      const T = motion ? time : 30;
      pointer.update(dt);
      const u = clamp(scroll / 0.6);
      const uu = easeInOutCubic(u);

      target.set(0, 0, 0);
      camera.position.set(0, 0, 9);
      camera.lookAt(target);
      camera.updateMatrixWorld();
      shiftFrame(ctx, 0, scroll * 0.38);

      // Orb: swells in, flows, sinks back with scroll.
      const sw = easeOutBack((T - 0.05) / 1.4, 1.2);
      const os = Math.max(0.001, sw) * lerp(1, 0.62, uu);
      orbGroup.scale.setScalar(os);
      orbGroup.position.set(0, lerp(0, 0.1, uu), lerp(0, -1.2, uu));
      orb.rotation.y = T * 0.08;
      ou.uTime.value = T;
      ou.uAmp.value = (0.55 + 0.45 * smooth(0.3, 1.8, T)) * (1 + Math.sin(T * 0.6) * 0.06);
      ou.uGlow.value = lerp(1, 0.55, uu) * smooth(0.2, 1.4, T);
      aura.quaternion.copy(camera.quaternion);
      auraMat.uniforms.uA.value = smooth(0.4, 2.2, T) * lerp(1, 0.5, uu);

      // Pointer pull: direction in orb space towards the cursor ray.
      let want = 0;
      if (pointer.on > 0.01) {
        orb.updateMatrixWorld();
        inv.copy(orb.matrixWorld).invert();
        localRay.copy(pointer.ray(camera)).applyMatrix4(inv);
        const d = localRay.distanceToPoint(tmpV.set(0, 0, 0));
        // towards where the ray meets the orb, or (missing it) the ray's closest approach
        if (!localRay.intersectSphere(sphere, tmpV2)) localRay.closestPointToPoint(tmpV.set(0, 0, 0), tmpV2);
        tmpV.copy(tmpV2).normalize();
        want = smooth(R * 2.3, R * 0.9, d) * pointer.on;
        pullDir.lerp(tmpV, motion ? damp(6, dt) : 1).normalize();
      }
      pullAmt += (want - pullAmt) * (motion ? damp(want > pullAmt ? 3.5 : 2, dt) : 1);
      ou.uPull.value.copy(pullDir);
      ou.uPullAmt.value = pullAmt;

      // Tiles: orbit -> feed grid.
      const rows = Math.ceil(TILES / gridCols);
      const aspect = ctx.frame?.aspect || 1.6;
      if (motion && T > nextPop && u < 0.3) {
        const tile = tiles[Math.floor(rand() * TILES)];
        tile.userData.pop = 1;
        const hs = hearts[heartIdx++ % hearts.length];
        hs.userData.t = 0;
        hs.userData.from.copy(tile.position);
        nextPop = T + 1.3 + rand() * 1.6;
      }
      camLocal.copy(camera.position);
      for (let i = 0; i < TILES; i++) {
        const tile = tiles[i];
        const d = tile.userData;
        const kin = easeOutCubic((T - d.delay) / 1.3);
        const a = d.phase + T * d.speed * (1 - uu) - (1 - kin) * 2.2;
        const rr = d.r + (1 - kin) * 2.5;
        tmpV.set(Math.cos(a) * rr, Math.sin(T * 0.5 + d.bob) * 0.06, Math.sin(a) * rr);
        eul.set(d.tilt, 0, d.tw);
        tmpV.applyEuler(eul);
        // grid slot
        const c = i % gridCols;
        const rI = Math.floor(i / gridCols);
        tmpV2.set((c - (gridCols - 1) / 2) * (TW + 0.1), ((rows - 1) / 2 - rI) * (TH + 0.1), 1.0);
        const gi = easeInOutCubic(smooth(i * 0.035, 0.62 + i * 0.035, u));
        tile.position.lerpVectors(tmpV, tmpV2, gi);
        // hover: screen distance to the pointer
        proj.copy(tile.position).applyMatrix4(rig.matrixWorld).project(camera);
        const dx = (proj.x - pointer.x) * aspect;
        const dy = proj.y - pointer.y;
        const hd = Math.sqrt(dx * dx + dy * dy);
        const hv = smooth(0.32, 0.08, hd) * pointer.on;
        d.hover += (hv - d.hover) * (motion ? damp(6, dt) : 1);
        d.pop = Math.max(0, d.pop - (dt || 0) * 1.6);
        // face the camera, leaning with the orbit and towards the pointer
        tile.lookAt(camLocal);
        q.setFromEuler(eul.set(-dy * d.hover * 0.9, dx * d.hover * 0.9 + Math.sin(a) * 0.35 * (1 - gi), 0));
        tile.quaternion.multiply(q);
        const popS = 1 + Math.sin(Math.min(1, 1 - d.pop) * Math.PI) * 0.14 * (d.pop > 0 ? 1 : 0);
        tile.scale.setScalar(Math.max(0.001, kin) * popS * (1 + d.hover * 0.12) * lerp(1, 1.12, gi));
        // tiles behind the orb dim a little
        const behind = smooth(0.2, -1.2, tile.position.z) * (1 - gi);
        tile.material.opacity = kin * (1 - behind * 0.45);
      }
      for (const hs of hearts) {
        const ht = hs.userData.t;
        if (ht > 1.6) { hs.material.opacity = 0; continue; }
        hs.userData.t += dt || 0;
        hs.position.copy(hs.userData.from);
        hs.position.y += 0.5 + easeOutCubic(ht / 1.6) * 0.7;
        hs.position.z += 0.05;
        hs.quaternion.copy(camera.quaternion);
        hs.scale.setScalar(easeOutBack(ht / 0.35) * (1 - smooth(1.1, 1.6, ht) * 0.3));
        hs.material.opacity = smooth(0, 0.15, ht) * (1 - smooth(1.0, 1.6, ht));
      }
      const gA = smooth(0.8, 2.4, T) * (1 - uu);
      guides[0].material.opacity = 0.12 * gA;
      guides[1].material.opacity = 0.08 * gA;
    },
    dispose() {
      pointer.dispose();
    },
  };
}
