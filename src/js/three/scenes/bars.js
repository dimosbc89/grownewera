// Data landscape (Google Ads, SEO, eshop solution, works, eshop case). A square field of thin
// columns follows a slowly breathing terrain with a growth trend towards the back corner; the
// peaks carry lime caps and send thin signal lines up. A lime scan plane sweeps across like a live
// query and leaves a lit wake.
//   intro   columns grow out of the floor in a diagonal wave; the floor grid and corner marks draw in
//   idle    terrain breathes, the scan sweeps every few seconds, signal pulses climb the lines
//   pointer the columns under the cursor rise and light up (white to lime), easing back after
//   scroll  the camera cranes down to a grazing angle (the field becomes a skyline) while the trend
//           grows and the peaks climb
import * as THREE from 'three';
import {
  clamp, lerp, smooth, easeOutCubic, easeInOutCubic, rng, frame, shiftFrame,
  localPointer, tuneLights, addGlow, damp, look,
} from './_shared.js';

export default function build(ctx) {
  const { rig, camera, palette, motion } = ctx;
  const rand = rng(23);

  const n = ctx.quality === 'high' && !ctx.small ? 21 : ctx.small ? 14 : 17;
  const count = n * n;
  const SIZE = 3.6;
  const cell = SIZE / n;
  const BAR = cell * 0.56;

  // ---------- columns ----------
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const glow = addGlow(geo, count);
  const uniforms = {
    uLime: { value: palette.lime.clone() },
    uScanX: { value: -10 },
    uBase: { value: new THREE.Color('#060606') },
    uTop: { value: new THREE.Color('#4d4d4d') },
  };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.35, envMapIntensity: 0.35 });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aGlow;\nvarying float vGlow; varying float vLocalY; varying float vTop; varying float vH; varying float vFieldX;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vGlow = aGlow; vLocalY = position.y; vTop = step(0.5, normal.y);
        vH = instanceMatrix[1][1];
        vFieldX = (instanceMatrix * vec4(position, 1.0)).x;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uLime; uniform vec3 uBase; uniform vec3 uTop; uniform float uScanX;\nvarying float vGlow; varying float vLocalY; varying float vTop; varying float vH; varying float vFieldX;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        // dark at the floor, lighter towards the top of each column (taller columns get lighter)
        float grad = pow(vLocalY, 1.6) * (0.35 + 0.65 * clamp(vH / 2.2, 0.0, 1.0));
        diffuseColor.rgb = mix(uBase, uTop, grad);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.5), vTop * (0.35 + 0.4 * clamp(vH / 2.2, 0.0, 1.0)));`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float cap = vTop + (1.0 - vTop) * smoothstep(0.55, 1.0, vLocalY) * 0.45;
        totalEmissiveRadiance += uLime * vGlow * cap;
        // scan plane: a thin lime band where it cuts through a column
        float sd = abs(vFieldX - uScanX);
        totalEmissiveRadiance += uLime * smoothstep(0.06, 0.0, sd) * 0.9 * (0.3 + 0.7 * vLocalY);`);
  };
  mat.customProgramCacheKey = () => 'grow-bars';
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  const field = new THREE.Group();
  field.add(mesh);
  rig.add(field);

  const cols = [];
  for (let x = 0; x < n; x++) {
    for (let z = 0; z < n; z++) {
      const fx = x / (n - 1) - 0.5;
      const fz = z / (n - 1) - 0.5;
      cols.push({ x, z, fx, fz, px: fx * (SIZE - cell), pz: fz * (SIZE - cell), r: rand(), h: 0 });
    }
  }

  // ---------- floor: fine grid fading out at the edges + corner marks ----------
  const gridLines = [];
  const G = SIZE * 0.5 + 0.9;
  const gstep = cell * 2;
  for (let v = -G; v <= G + 1e-4; v += gstep) gridLines.push(-G, 0, v, G, 0, v, v, 0, -G, v, 0, G);
  const gridGeo = new THREE.BufferGeometry();
  gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridLines, 3));
  const gridMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uA: { value: 0 }, uR: { value: G } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uA; uniform float uR; varying vec3 vP; void main(){ float d = length(vP.xz) / uR; float a = uA * (1.0 - smoothstep(0.35, 1.0, d)) * 0.26; gl_FragColor = vec4(vec3(1.0) * a, a);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
    blending: THREE.AdditiveBlending,
  });
  const grid = new THREE.LineSegments(gridGeo, gridMat);
  grid.position.y = -0.002;
  field.add(grid);
  const marks = [];
  const m0 = SIZE / 2 + 0.22;
  const ml = 0.32;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    marks.push(sx * m0, 0, sz * m0, sx * (m0 - ml), 0, sz * m0, sx * m0, 0, sz * m0, sx * m0, 0, sz * (m0 - ml));
  }
  const markGeo = new THREE.BufferGeometry();
  markGeo.setAttribute('position', new THREE.Float32BufferAttribute(marks, 3));
  const markMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
  field.add(new THREE.LineSegments(markGeo, markMat));

  // ---------- scan plane ----------
  const SCAN_H = 2.6;
  const scanMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uA: { value: 0 }, uColor: { value: palette.lime.clone() } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uA; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        float fall = pow(1.0 - vUv.y, 2.2);
        float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
        float a = uA * edge * (0.14 * fall + 0.5 * smoothstep(0.035, 0.0, vUv.y));
        gl_FragColor = vec4(uColor * a, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(SIZE + 0.5, SCAN_H), scanMat);
  scan.rotation.y = Math.PI / 2;
  scan.position.y = SCAN_H / 2;
  field.add(scan);

  // ---------- signal lines from the peaks ----------
  const K = ctx.small ? 4 : ctx.quality === 'high' ? 7 : 5;
  const LINE = 1.5;
  const sigPos = new Float32Array(K * 2 * 3);
  const sigT = new Float32Array(K * 2);
  const sigSeed = new Float32Array(K * 2);
  for (let i = 0; i < K; i++) {
    sigT[i * 2] = 0;
    sigT[i * 2 + 1] = 1;
    sigSeed[i * 2] = sigSeed[i * 2 + 1] = rand();
  }
  const sigGeo = new THREE.BufferGeometry();
  sigGeo.setAttribute('position', new THREE.BufferAttribute(sigPos, 3).setUsage(THREE.DynamicDrawUsage));
  sigGeo.setAttribute('aT', new THREE.BufferAttribute(sigT, 1));
  sigGeo.setAttribute('aS', new THREE.BufferAttribute(sigSeed, 1));
  const sigMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uA: { value: 0 }, uColor: { value: palette.lime.clone() } },
    vertexShader: 'attribute float aT; attribute float aS; varying float vT; varying float vS; void main(){ vT = aT; vS = aS; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uTime; uniform float uA; uniform vec3 uColor; varying float vT; varying float vS;
      void main(){
        float p = fract(uTime * 0.45 + vS);
        float dash = smoothstep(0.1, 0.0, abs(vT - p)) * (1.0 - vT);
        float a = uA * (pow(1.0 - vT, 1.2) * 0.8 + dash * 1.6);
        gl_FragColor = vec4(uColor * a, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const signals = new THREE.LineSegments(sigGeo, sigMat);
  signals.frustumCulled = false;
  field.add(signals);
  const tagGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
  const tags = new THREE.InstancedMesh(tagGeo, new THREE.MeshBasicMaterial({ color: palette.lime }), K);
  tags.frustumCulled = false;
  field.add(tags);

  // ---------- lights ----------
  look(ctx, { exposure: 1.1 });
  tuneLights(ctx, { ambient: 0.2, key: 1.5, keyPos: [-3, 6, 4], rim: 18, rimPos: [3, 1.2, -3.5], env: 0.6 });

  // ---------- state ----------
  const pointer = localPointer(ctx);
  const raise = new Float32Array(count);
  const lit = new Float32Array(count);
  const wake = new Float32Array(count);
  const tmp = new THREE.Object3D();
  const plane = new THREE.Plane();
  const hit = new THREE.Vector3();
  const inv = new THREE.Matrix4();
  const local = new THREE.Vector3();
  const target = new THREE.Vector3();
  const up = new THREE.Vector3();
  // Signal lines stand on fixed columns (hill crests and the top of the trend), so they never jump.
  const nearest = (fx, fz) => cols.reduce((a, c) => ((c.fx - fx) ** 2 + (c.fz - fz) ** 2 < (a.fx - fx) ** 2 + (a.fz - fz) ** 2 ? c : a));
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  // Hills of the landscape (field fractions): the cores of the taller ones carry lime caps.
  const HILLS = [
    { x: 0.16, z: -0.2, s: 26, h: 0.62, lime: 1 },
    { x: -0.24, z: 0.12, s: 34, h: 0.45, lime: 0.9 },
    { x: 0.3, z: 0.3, s: 40, h: 0.3, lime: 0 },
    { x: -0.3, z: -0.32, s: 30, h: 0.38, lime: 0.8 },
  ];
  const chosen = [...HILLS.filter((hl) => hl.lime > 0).map((hl) => nearest(hl.x, hl.z)), nearest(0.5, -0.5), nearest(0.42, -0.08), nearest(0.12, -0.46), nearest(0.5, 0.2)]
    .filter((c, i, a) => a.indexOf(c) === i).slice(0, K);
  const SCAN_PERIOD = 5.2;
  const SCAN_RUN = 2.8;
  let lastScanX = -10;

  function layout(w, h) {
    frame(ctx, w, h, {
      extent: [2.9, 2.0],
      desk: { x: 0.72, y: 0.49, size: 0.64 },
      phone: { x: 0.5, y: 0.24, size: 1.0, maxH: 0.42 },
    });
    pointer.measure?.();
  }

  return {
    bloom: { strength: 0.42, radius: 0.32, threshold: 0.86 },
    resize: (w, h) => layout(w, h),
    update(time, scroll, _p, dt) {
      const T = motion ? time : 30;
      pointer.update(dt);
      const u = clamp(scroll / 0.6);
      const uu = easeInOutCubic(u);

      // Camera crane: elevated three-quarter view -> grazing skyline view.
      const elev = lerp(0.48, 0.1, uu);
      const az = lerp(0.72, 0.5, uu) + (motion ? Math.sin(T * 0.12) * 0.05 : 0);
      const dist = lerp(9, 7.6, uu);
      target.set(0, lerp(0.45, 0.75, uu), 0);
      camera.position.set(Math.sin(az) * Math.cos(elev) * dist, target.y + Math.sin(elev) * dist, Math.cos(az) * Math.cos(elev) * dist);
      camera.lookAt(target);
      field.position.y = -0.55;
      shiftFrame(ctx, 0, scroll * 0.42);

      // Pointer -> field-space point on a plane at mid-height.
      let px = 1e4;
      let pz = 1e4;
      if (pointer.on > 0.01) {
        camera.updateMatrixWorld();
        field.updateMatrixWorld();
        plane.setFromNormalAndCoplanarPoint(
          up.set(0, 1, 0).transformDirection(field.matrixWorld),
          local.set(0, 0.5, 0).applyMatrix4(field.matrixWorld),
        );
        if (pointer.ray(camera).intersectPlane(plane, hit)) {
          hit.applyMatrix4(inv.copy(field.matrixWorld).invert());
          px = hit.x;
          pz = hit.z;
        }
      }

      // Scan sweep.
      const sp = ((T - 2.2) % SCAN_PERIOD + SCAN_PERIOD) % SCAN_PERIOD;
      const scanOn = T > 2.2 && motion;
      const sx = scanOn && sp < SCAN_RUN ? lerp(-SIZE / 2 - 0.35, SIZE / 2 + 0.35, easeInOutCubic(sp / SCAN_RUN) * 0.15 + (sp / SCAN_RUN) * 0.85) : -10;
      scan.position.x = sx;
      scanMat.uniforms.uA.value = sx > -9 ? smooth(0, 0.25, sp) * smooth(SCAN_RUN, SCAN_RUN - 0.3, sp) : 0;
      uniforms.uScanX.value = sx;

      const trendK = 1 + uu * 0.9;
      const kR = motion ? damp(7, dt) : 1;
      const kL = motion ? damp(2.2, dt) : 1;
      const kW = motion ? damp(1.1, dt) : 1;
      let hmax = 0.001;
      for (let k = 0; k < HILLS.length; k++) {
        const hl = HILLS[k];
        hl.cx = hl.x + Math.sin(T * 0.13 + k * 2.1) * 0.05;
        hl.cz = hl.z + Math.cos(T * 0.11 + k * 1.7) * 0.05;
      }
      for (const c of cols) {
        const trend = Math.pow(clamp((c.fx + 0.5) * 0.55 + (0.5 - c.fz) * 0.45), 1.6);
        let hills = Math.sin(c.fx * 5.2 + T * 0.5) * Math.cos(c.fz * 4.4 - T * 0.37) * 0.16
          + Math.sin((c.fx + c.fz) * 7.5 - T * 0.8) * 0.05;
        let crest = 0;
        for (const hl of HILLS) {
          const b = Math.exp(-((c.fx - hl.cx) ** 2 + (c.fz - hl.cz) ** 2) * hl.s);
          hills += b * hl.h;
          crest = Math.max(crest, smooth(0.72, 0.97, b) * hl.lime);
        }
        c.base = Math.max(0.05, 0.14 + trend * 1.35 * trendK + hills + c.r * 0.06);
        c.crest = Math.max(crest, smooth(0.8, 0.97, trend) * 0.8);
        if (c.base > hmax) hmax = c.base;
      }
      for (let i = 0; i < count; i++) {
        const c = cols[i];
        const delay = 0.15 + ((c.x + (n - 1 - c.z)) / (2 * n)) * 1.3;
        const k = easeOutCubic((T - delay) / 0.9);
        // pointer
        const dx = c.px - px;
        const dz = c.pz - pz;
        const d = Math.sqrt(dx * dx + dz * dz) / 0.75;
        const f = d < 1 ? (1 - d * d) * (1 - d * d) * pointer.on : 0;
        raise[i] += (f * 0.85 - raise[i]) * kR;
        lit[i] = Math.max(lit[i] + (0 - lit[i]) * kL, f);
        // scan wake
        if (sx > -9 && ((c.px <= sx && c.px > lastScanX) || Math.abs(c.px - sx) < cell * 0.5)) wake[i] = 1;
        wake[i] += (0 - wake[i]) * kW;
        const hgt = (c.base + raise[i]) * k;
        c.h = hgt;
        tmp.position.set(c.px, 0, c.pz);
        tmp.scale.set(BAR, Math.max(0.002, hgt), BAR);
        tmp.updateMatrix();
        mesh.setMatrixAt(i, tmp.matrix);
        const peak = Math.max(c.crest, smooth(0.9, 0.99, c.base / hmax));
        glow.array[i] = (peak * 0.95 + lit[i] * 0.8 + wake[i] * 0.35 * (0.3 + peak)) * k;
      }
      lastScanX = sx;
      mesh.instanceMatrix.needsUpdate = true;
      glow.needsUpdate = true;

      const sigA = smooth(1.8, 2.8, T);
      for (let j = 0; j < K; j++) {
        const c = chosen[j];
        const o = j * 6;
        if (!c) {
          sigPos.fill(0, o, o + 6);
          tags.setMatrixAt(j, zero);
          continue;
        }
        sigPos[o] = c.px; sigPos[o + 1] = c.h + 0.02; sigPos[o + 2] = c.pz;
        sigPos[o + 3] = c.px; sigPos[o + 4] = c.h + LINE * (0.55 + 0.45 * sigSeed[j * 2]) * sigA; sigPos[o + 5] = c.pz;
        tmp.position.set(c.px, sigPos[o + 4], c.pz);
        tmp.scale.setScalar(sigA);
        tmp.updateMatrix();
        tags.setMatrixAt(j, tmp.matrix);
      }
      sigGeo.attributes.position.needsUpdate = true;
      tags.instanceMatrix.needsUpdate = true;
      sigMat.uniforms.uTime.value = T;
      sigMat.uniforms.uA.value = sigA;

      const fl = easeOutCubic((T - 0.1) / 1.6);
      gridMat.uniforms.uA.value = fl;
      markMat.opacity = 0.55 * fl;
      field.rotation.y = 0;
    },
    dispose() {
      pointer.dispose();
    },
  };
}
