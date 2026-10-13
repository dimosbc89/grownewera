// Growth spiral (home, company). Rounded blocks wind up a widening spiral, getting longer as they
// climb; the leading blocks at the top glow lime and a stream of particles rises through the core.
//   intro   blocks fly in and lock into place from the base up; the lime tip flashes on arrival
//   idle    slow turn, a lime signal climbs the spiral every few seconds, breathing particles
//   pointer blocks near the cursor slide outward along their length and light up lime (trail fades)
//   scroll  the spiral uncoils from the base into an ascending bar chart (stacks of the same
//           blocks, the lime tip on the tallest bar) while the camera rises; a lime trend line draws
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  clamp, lerp, smooth, easeOutCubic, easeInOutCubic, rng, detail, frame, shiftFrame,
  localPointer, tuneLights, glowMaterial, addGlow, squarePoints, damp, look,
} from './_shared.js';

export default function build(ctx) {
  const { rig, camera, renderer, palette, motion } = ctx;
  const lod = detail(ctx);
  const rand = rng(7);

  // ---------- layout ----------
  const N = Math.max(56, Math.round(128 * lod));
  const TURNS = 3.3;
  const Y0 = -2.05;
  const Y1 = 2.05;
  const per = N / TURNS; // blocks per turn
  const step = (Math.PI * 2) / per;
  const HEAT = 0.74; // from here up the blocks warm from graphite to lime; the last ones glow
  const blocks = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const rIn = 0.3 + 0.3 * t;
    const L = 0.5 + 0.86 * t;
    const rc = rIn + L / 2;
    const w = Math.min(step * rc * 0.7, 0.16);
    // Mostly graphite, every fifth block white (a light thread winding up), lime towards the tip.
    const heat = smooth(HEAT, 0.97, t);
    const kind = heat > 0.5 ? 2 : i % 5 === 2 ? 1 : 0;
    blocks.push({ t, a: t * TURNS * Math.PI * 2, rc, L, w, kind, y: lerp(Y0, Y1, t), heat, spin: rand() * Math.PI * 2, jitter: rand() });
  }

  // Bar chart the spiral uncoils into: C columns of stacked blocks, heights growing.
  const C = ctx.small ? 8 : 10;
  const weights = Array.from({ length: C }, (_, c) => Math.pow(c + 1.2, 1.35));
  const sumW = weights.reduce((s, x) => s + x, 0);
  const heights = weights.map((x) => Math.max(2, Math.round((x / sumW) * N)));
  let diff = N - heights.reduce((s, x) => s + x, 0);
  for (let c = C - 1; diff !== 0; c = (c - 1 + C) % C) { heights[c] += Math.sign(diff); diff -= Math.sign(diff); }
  const COL_GAP = 2.75 / C;
  const SLAB = 0.108;
  const CHART_Y0 = -1.75;
  {
    let i = 0;
    for (let c = 0; c < C; c++) {
      for (let k = 0; k < heights[c]; k++, i++) {
        const b = blocks[i];
        b.col = c;
        b.cx = (c - (C - 1) / 2) * COL_GAP;
        b.cy = CHART_Y0 + (k + 0.5) * SLAB;
        b.cz = -0.15 + (c / (C - 1)) * 0.1;
      }
    }
  }
  const tops = heights.map((hgt, c) => new THREE.Vector3((c - (C - 1) / 2) * COL_GAP, CHART_Y0 + hgt * SLAB + 0.22, -0.15 + (c / (C - 1)) * 0.1));

  // ---------- blocks ----------
  const geo = new RoundedBoxGeometry(1, 0.1, 0.11, 3, 0.028);
  const glow = addGlow(geo, N);
  const mat = glowMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.5, envMapIntensity: 0.4 }, { key: 'helix' });
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  const graphite = new THREE.Color('#1c1c1c');
  const white = new THREE.Color('#b8b8b8');
  const limeBase = palette.lime.clone().multiplyScalar(0.3);
  const col = new THREE.Color();
  blocks.forEach((b, i) => mesh.setColorAt(i, col.copy(b.kind === 1 && b.heat < 0.2 ? white : graphite).lerp(limeBase, b.heat)));
  const spiral = new THREE.Group();
  spiral.add(mesh);
  rig.add(spiral);

  // Hairline axis, brightening towards the top.
  const axisMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uA: { value: 0 }, uColor: { value: palette.lime.clone() } },
    vertexShader: 'varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uA; uniform vec3 uColor; varying float vY; void main(){ float a = smoothstep(0.0,1.0,vY) * uA; gl_FragColor = vec4(uColor * a, a);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
  });
  const axis = new THREE.Mesh(new THREE.PlaneGeometry(0.012, Y1 - Y0 + 0.9), axisMat);
  axis.position.y = (Y0 + Y1) / 2 + 0.35;
  spiral.add(axis);

  // Rising particle stream through the core and around the spiral.
  const P = Math.round(760 * lod);
  const pcol = new Float32Array(P * 3);
  for (let i = 0; i < P; i++) {
    const c = rand() < 0.28 ? palette.lime : palette.white;
    const k = c === palette.lime ? 0.9 : 0.45;
    pcol.set([c.r * k, c.g * k, c.b * k], i * 3);
  }
  const stream = squarePoints({
    count: P,
    seed: 11,
    colors: pcol,
    decl: 'uniform float uFade;',
    body: /* glsl */ `
      float speed = 0.05 + aSeed.z * 0.07 + uScroll * 0.12;
      float life = fract(aSeed.x + uTime * speed);
      float y = mix(-2.5, 2.9, life);
      float t = clamp((y + 2.05) / 4.1, 0.0, 1.0);
      float inner = step(0.45, aSeed.w);
      float r = mix(0.06 + aSeed.y * 0.32 * (0.6 + t), 0.65 + t * 0.9 + aSeed.y * 0.55, 1.0 - inner);
      float a = aSeed.y * 40.0 + life * 7.0 + uTime * (0.25 + inner * 0.3);
      pos = vec3(cos(a) * r, y, sin(a) * r);
      size = 1.2 + aSeed.w * 2.1;
      alpha = sin(life * 3.14159) * uIntro * uFade * (0.2 + 0.4 * inner);
    `,
    uniforms: { uFade: { value: 1 } },
  });
  spiral.add(stream);

  // Chart furniture: baseline rule and a lime trend line through the column tops.
  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(C * COL_GAP + 0.6, 0.006),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }),
  );
  base.position.set(0, CHART_Y0 - 0.02, 0.6);
  rig.add(base);
  const trendCurve = new THREE.CatmullRomCurve3(tops, false, 'catmullrom', 0.2);
  const trendPts = trendCurve.getPoints(C * 12);
  const trendGeo = new THREE.BufferGeometry().setFromPoints(trendPts);
  const trend = new THREE.Line(trendGeo, new THREE.LineBasicMaterial({ color: palette.lime, transparent: true, opacity: 0.95 }));
  trendGeo.setDrawRange(0, 0);
  rig.add(trend);
  const nodeGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
  const nodes = new THREE.InstancedMesh(nodeGeo, new THREE.MeshBasicMaterial({ color: palette.lime }), C);
  nodes.frustumCulled = false;
  rig.add(nodes);

  // ---------- lights ----------
  look(ctx, { exposure: 1.1 });
  tuneLights(ctx, { ambient: 0.16, key: 1.7, keyPos: [4, 6, 5], rim: 22, rimPos: [-3.2, 1.5, -2.2], env: 0.7 });

  // ---------- interaction / state ----------
  const pointer = localPointer(ctx);
  const push = new Float32Array(N);
  const lit = new Float32Array(N);
  const v = new THREE.Vector3();
  const pS = new THREE.Vector3();
  const pC = new THREE.Vector3();
  const qS = new THREE.Quaternion();
  const qC = new THREE.Quaternion();
  const qT = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const Y = new THREE.Vector3(0, 1, 0);
  const X = new THREE.Vector3(1, 0, 0);
  const tmpQ = new THREE.Quaternion();
  const qChart = new THREE.Quaternion().setFromAxisAngle(Y, -Math.PI / 2);
  const proj = new THREE.Vector3();
  const camTarget = new THREE.Vector3();
  let spin = 0;

  function layout(w, h) {
    frame(ctx, w, h, {
      extent: [1.85, 2.3],
      desk: { x: 0.75, y: 0.52, size: 0.74 },
      hud: 0.8, // inside the viewfinder: the top coil and the rising stream stay within its ticks
      phone: { x: 0.5, y: 0.27, size: 0.95, maxH: 0.56 },
    });
    stream.material.uniforms.uPx.value = renderer.getPixelRatio() * ctx.frame.scale;
    pointer.measure?.();
  }

  return {
    bloom: { strength: 0.4, radius: 0.35, threshold: 0.88 },
    resize: (w, h) => layout(w, h),
    update(time, scroll, _p, dt) {
      const T = motion ? time : 30; // still frames (reduced motion) show the finished state
      const k = motion ? 1 : 0;
      pointer.update(dt);
      const u = clamp(scroll / 0.62);
      const uu = easeInOutCubic(u);

      // Camera: rises and swings a little as the spiral uncoils; the anchor drifts down so the
      // object stays in view while the hero leaves.
      const elev = lerp(0.07, 0.5, uu);
      const az = lerp(0, -0.38, uu);
      const dist = lerp(9, 9.6, uu);
      camTarget.set(0, lerp(0.05, 0.25, uu), 0);
      camera.position.set(Math.sin(az) * Math.cos(elev) * dist, Math.sin(elev) * dist + camTarget.y, Math.cos(az) * Math.cos(elev) * dist);
      camera.lookAt(camTarget);
      camera.updateMatrixWorld();
      shiftFrame(ctx, 0, scroll * 0.4);

      // Spin: fast while arriving, slow at rest, stopping as it uncoils.
      const arrive = easeOutCubic(T / 3.2);
      spin += dt * (0.16 + (1 - arrive) * 1.6) * (1 - uu);
      spiral.rotation.y = motion ? spin - (1 - arrive) * 1.2 : 0.6;

      // Signal climbing the spiral every 3.6s.
      const sig = ((T - 2.4) / 3.6) % 1;
      const sigOn = T > 2.4 ? 1 : 0;

      const pk = motion ? damp(9, dt) : 1;
      const lk = motion ? damp(2.6, dt) : 1;
      const wide = ctx.frame?.wide;
      const aspect = ctx.frame?.aspect || 1;
      const reach = wide ? 0.2 : 0.32;
      for (let i = 0; i < N; i++) {
        const b = blocks[i];
        // intro: from the base up
        const tin = 0.12 + b.t * 1.55;
        const kin = easeOutCubic((T - tin) / 0.95);
        // uncoil: from the base up, staggered
        const ui = easeInOutCubic(smooth(b.t * 0.42, b.t * 0.42 + 0.58, u));

        // spiral pose
        const a = b.a + b.jitter * 0.02;
        const out = push[i] * (1 - ui);
        const r = b.rc + out + (1 - kin) * (1.6 + b.jitter * 1.2);
        pS.set(Math.cos(a) * r, b.y - (1 - kin) * (0.9 + b.jitter), Math.sin(a) * r);
        qS.setFromAxisAngle(Y, -a);
        if (kin < 1) qS.multiply(tmpQ.setFromAxisAngle(X, (1 - kin) * (2.5 + b.spin)));

        // chart pose (in spiral space: undo the spiral's turn so the chart faces the camera)
        pC.set(b.cx, b.cy + push[i] * 0.6, b.cz).applyAxisAngle(Y, -spiral.rotation.y);
        qC.copy(qChart).premultiply(tmpQ.setFromAxisAngle(Y, -spiral.rotation.y));

        v.lerpVectors(pS, pC, ui);
        v.y += Math.sin(ui * Math.PI) * 0.35; // lift while travelling
        qT.slerpQuaternions(qS, qC, ui);
        const sk = 0.25 + 0.75 * kin;
        sc.set(b.L * sk, sk, (b.w / 0.11) * lerp(1, Math.min(2.4, (COL_GAP * 0.74) / b.w), ui) * sk);
        m.compose(v, qT, sc);
        mesh.setMatrixAt(i, m);

        // pointer: screen-space distance to the block
        let f = 0;
        if (pointer.on > 0.01 && kin > 0.5) {
          proj.copy(v).applyMatrix4(spiral.matrixWorld).project(camera);
          const dx = (proj.x - pointer.x) * aspect;
          const dy = proj.y - pointer.y;
          const d = Math.sqrt(dx * dx + dy * dy) / reach;
          f = d < 1 ? (1 - d * d) * (1 - d * d) * pointer.on : 0;
        }
        push[i] += (f * 0.42 - push[i]) * pk;
        lit[i] = Math.max(lit[i] + (0 - lit[i]) * lk, f);

        // glow: lime tip (with arrival flash), climbing signal, pointer trail
        const s = sigOn ? Math.exp(-Math.pow((b.t - (sig * 1.3 - 0.15)) / 0.035, 2)) : 0;
        const tip = Math.pow(smooth(0.9, 1, b.t), 2);
        let g = 0.04 * b.heat + 0.42 * tip;
        g += Math.max(0, 1 - Math.abs(T - tin - 0.75) * 1.8) * 0.6 * tip * k; // arrival flash
        g = g * kin * (1 - ui * 0.5) + s * 0.5 + lit[i] * 0.85;
        glow.array[i] = g;
      }
      mesh.instanceMatrix.needsUpdate = true;
      glow.needsUpdate = true;

      axisMat.uniforms.uA.value = 0.55 * easeOutCubic((T - 0.4) / 1.5) * (1 - uu);
      const su = stream.material.uniforms;
      su.uTime.value = T;
      su.uScroll.value = scroll;
      su.uIntro.value = easeOutCubic((T - 0.3) / 2);
      su.uFade.value = 1 - uu * 0.85;

      // chart furniture
      const cu = smooth(0.55, 1, u);
      base.material.opacity = 0.28 * cu;
      trendGeo.setDrawRange(0, Math.floor(trendPts.length * smooth(0.7, 1, u)));
      for (let c = 0; c < C; c++) {
        const on = smooth(0.7 + (c / C) * 0.28, 0.74 + (c / C) * 0.28, u);
        m.compose(tops[c], tmpQ.identity(), sc.setScalar(on));
        nodes.setMatrixAt(c, m);
      }
      nodes.instanceMatrix.needsUpdate = true;
    },
    setQuality(q) {
      // On a tier drop, thin the particle stream.
      stream.geometry.setDrawRange(0, q === 'high' ? P : Math.round(P * 0.6));
    },
    dispose() {
      pointer.dispose();
    },
  };
}
