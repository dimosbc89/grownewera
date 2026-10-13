// Building blocks (services index, exhibition stands, B2B, 404). Cubes fly in and assemble a stepped
// exhibition-stand structure on a floor: stepped back wall, side wall, plinth, counter and a lime
// topped totem and a floating header beam, under a lime spotlight that throws shadows (high / mid).
//   intro   cubes tumble in from above and lock into place, lowest layers first
//   idle    the spot breathes and the camera drifts; now and then a single cube lifts, glows, settles
//   pointer cubes near the cursor are pushed away from it (and tip), springing back
//   scroll  the stand opens into an exploded view (every cube moves out from the centre, like an
//           axonometric assembly drawing), then the cubes travel into one solid stepped monolith with
//           a lime crown
import * as THREE from 'three';
import {
  clamp, lerp, smooth, easeOutCubic, easeInOutCubic, rng, frame, shiftFrame,
  localPointer, tuneLights, addGlow, glowMaterial, look,
} from './_shared.js';

export default function build(ctx) {
  const { rig, camera, renderer, palette, motion } = ctx;
  const rand = rng(5);
  const hq = ctx.quality === 'high' && !ctx.small;
  const S = 0.34; // cube pitch
  const C = S * 0.9; // cube size

  // ---------- structure (voxel layout, y up, z towards the viewer) ----------
  const cells = [];
  const add = (x, y, z, kind = 0) => cells.push({ x, y, z, kind });
  const W = hq ? 9 : 7; // stand width
  const D = hq ? 6 : 5; // depth
  // plinth (one layer)
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) add(x, 0, z, 0);
  // stepped back wall
  const wall = hq ? [3, 4, 5, 6, 6, 5, 4, 5, 6] : [3, 4, 5, 5, 4, 5, 6];
  for (let x = 0; x < W; x++) for (let y = 1; y <= wall[x]; y++) add(x, y, 0, y === wall[x] && x === 3 ? 2 : 0);
  // side wall stepping down to the front
  for (let z = 1; z < D - 1; z++) for (let y = 1; y <= Math.max(1, 4 - z); y++) add(0, y, z, 0);
  // counter
  const cx0 = Math.floor(W / 2) - 1;
  for (let x = cx0; x < cx0 + 3; x++) { add(x, 1, D - 2, 1); add(x, 2, D - 2, x === cx0 + 1 ? 2 : 1); }
  // totem (front right), lime crown
  const tz = D - 2;
  for (let y = 1; y <= (hq ? 5 : 4); y++) add(W - 1, y, tz, y === (hq ? 5 : 4) ? 2 : 1);
  // fascia: a floating header beam over the wall
  const fy = Math.max(...wall) + 2;
  for (let x = 1; x < W - 1; x++) add(x, fy, 0, x === Math.floor(W / 2) ? 2 : 1);

  const N = cells.length;
  const cxm = (W - 1) / 2;
  const czm = (D - 1) / 2;
  const maxY = Math.max(...cells.map((c) => c.y));
  const blocks = cells.map((c, i) => ({
    ...c,
    home: new THREE.Vector3((c.x - cxm) * S, c.y * S + C / 2, (c.z - czm) * S),
    from: new THREE.Vector3((rand() - 0.5) * 9, 4 + rand() * 5, (rand() - 0.3) * 6),
    spinFrom: new THREE.Euler(rand() * 6, rand() * 6, rand() * 6),
    delay: 0.1 + (c.y / maxY) * 1.2 + rand() * 0.35,
    burst: new THREE.Vector3(),
    mono: new THREE.Vector3(),
    tumble: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(),
    seed: rand(),
    i,
  }));

  // Burst directions: away from the stand's centre, with spread.
  const centre = new THREE.Vector3(0, (maxY * S) / 2, 0);
  for (const b of blocks) {
    b.burst.copy(b.home).sub(centre).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.3 + b.seed * 0.1, 0));
  }
  // Monolith: a stepped tower (k x k layers shrinking upwards), filled bottom-up in a spiral order.
  {
    const slots = [];
    const k = Math.ceil(Math.sqrt(N / 5.5));
    for (let y = 0; slots.length < N; y++) {
      const kk = Math.max(1, k - Math.floor(y / 3));
      for (let x = 0; x < kk && slots.length < N; x++) for (let z = 0; z < kk && slots.length < N; z++) slots.push(new THREE.Vector3((x - (kk - 1) / 2) * S, y * S + C / 2, (z - (kk - 1) / 2) * S));
    }
    const order = blocks.slice().sort((a, b) => a.home.y - b.home.y || a.seed - b.seed);
    order.forEach((b, j) => b.mono.copy(slots[j]));
    const top = Math.max(...slots.map((s) => s.y));
    for (const b of blocks) b.monoTop = b.mono.y > top - S * 0.5;
  }

  // ---------- meshes ----------
  const geo = new THREE.BoxGeometry(C, C, C);
  const glow = addGlow(geo, N);
  const mat = glowMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.25, envMapIntensity: 0.45 }, { key: 'blocks' });
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  const graphite = new THREE.Color('#1d1d1d');
  const white = new THREE.Color('#a3a3a3');
  const limeBase = palette.lime.clone().multiplyScalar(0.62);
  const limeDeep = palette.lime.clone().multiplyScalar(0.36);
  blocks.forEach((b, i) => mesh.setColorAt(i, b.kind === 2 ? limeBase : b.kind === 1 ? white : graphite));
  const stand = new THREE.Group();
  stand.add(mesh);
  rig.add(stand);

  // Thin edge lines on every cube (brutalist rules), as one instanced line set.
  const edgeGeo = new THREE.EdgesGeometry(geo);
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1 });
  const edgeLines = [];
  if (hq) {
    // A merged line geometry updated per frame would cost too much; edges only on the lime / white cubes.
    for (const b of blocks) {
      if (b.kind === 0) continue;
      const l = new THREE.LineSegments(edgeGeo, edgeMat);
      l.matrixAutoUpdate = false;
      stand.add(l);
      edgeLines.push([b.i, l]);
    }
  }

  // Floor: receives the shadows, fades out radially.
  const floorMat = new THREE.MeshStandardMaterial({ color: '#0c0c0c', roughness: 0.85, metalness: 0 });
  floorMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vFl;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFl = position.xy;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vFl;')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        float fd = length(vFl) / 4.2;
        float gx = abs(fract(vFl.x / ${S.toFixed(3)} + 0.5) - 0.5) * ${S.toFixed(3)};
        float gy = abs(fract(vFl.y / ${S.toFixed(3)} + 0.5) - 0.5) * ${S.toFixed(3)};
        float gl = (1.0 - smoothstep(0.0, 0.006, min(gx, gy))) * 0.05 * (1.0 - smoothstep(0.2, 0.7, fd));
        gl_FragColor.rgb += vec3(gl);
        gl_FragColor.rgb *= 1.0 - smoothstep(0.35, 1.0, fd);`);
  };
  floorMat.customProgramCacheKey = () => 'grow-floor';
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  stand.add(floor);

  // Lime spotlight with soft shadows (shadow maps on high/mid, none on phones), plus a visible cone.
  const spot = new THREE.SpotLight(palette.lime, 0, 14, 0.3, 0.85, 1.2);
  spot.userData.scene = true;
  spot.position.set(-0.9, 5.2, 2.9);
  spot.target.position.set(0, 0.2, 0.95);
  stand.add(spot, spot.target);
  const shadows = !ctx.small && ctx.quality !== 'low';
  if (shadows) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    spot.castShadow = true;
    spot.shadow.mapSize.set(hq ? 1024 : 512, hq ? 1024 : 512);
    spot.shadow.bias = -0.0008;
    spot.shadow.normalBias = 0.02;
    spot.shadow.radius = 4;
    spot.shadow.camera.near = 1;
    spot.shadow.camera.far = 12;
  }
  const coneMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uA: { value: 0 }, uColor: { value: palette.lime.clone() } },
    vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = uv.y; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float uA; uniform vec3 uColor; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(abs(dot(vN, vV)), 1.5); float a = uA * f * pow(vY, 1.8) * 0.07; gl_FragColor = vec4(uColor * a, a);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
  });
  const coneLen = 5.2;
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 1.45, coneLen, 40, 1, true), coneMat);
  cone.geometry.translate(0, -coneLen / 2, 0);
  cone.geometry.rotateX(-Math.PI / 2); // points along -z... re-aimed below
  stand.add(cone);
  {
    const dir = new THREE.Vector3().subVectors(spot.target.position, spot.position).normalize();
    cone.position.copy(spot.position);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  }

  // ---------- lights ----------
  look(ctx, { exposure: 1.08 });
  tuneLights(ctx, { ambient: 0.22, key: 1.25, keyPos: [3.5, 5, 4], rim: 16, rimPos: [-3, 2, -2.5], env: 0.55 });

  // ---------- state ----------
  const pointer = localPointer(ctx);
  const off = blocks.map(() => new THREE.Vector3());
  const offV = blocks.map(() => new THREE.Vector3());
  const lift = new Float32Array(N);
  const pos = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const q2 = new THREE.Quaternion();
  const e = new THREE.Euler();
  const one = new THREE.Vector3(1, 1, 1);
  const m = new THREE.Matrix4();
  const inv = new THREE.Matrix4();
  const localRay = new THREE.Ray();
  const target = new THREE.Vector3();
  let nextLift = 3.5;
  let liftIdx = -1;
  let liftT = 0;

  function layout(w, h) {
    frame(ctx, w, h, {
      extent: [2.2, 2.0],
      desk: { x: 0.74, y: 0.5, size: 0.74 },
      phone: { x: 0.5, y: 0.24, size: 1.0, maxH: 0.42 },
    });
    pointer.measure?.();
  }

  return {
    bloom: { strength: 0.35, radius: 0.35, threshold: 0.9 },
    resize: (w, h) => layout(w, h),
    update(time, scroll, _p, dt) {
      const T = motion ? time : 30;
      pointer.update(dt);
      const u = clamp(scroll / 0.62);

      const elev = lerp(0.42, 0.55, easeInOutCubic(u));
      const az = 0.62 + (motion ? Math.sin(T * 0.1) * 0.06 : 0) + u * 0.5;
      const dist = 9;
      target.set(0, lerp(0.35, -0.25, easeInOutCubic(smooth(0.3, 0.8, u))), 0);
      camera.position.set(Math.sin(az) * Math.cos(elev) * dist, target.y + Math.sin(elev) * dist, Math.cos(az) * Math.cos(elev) * dist);
      camera.lookAt(target);
      camera.updateMatrixWorld();
      stand.position.y = -1.05;
      shiftFrame(ctx, 0, scroll * 0.45);

      // scroll phases: exploded view (0..0.35), re-form as a monolith (0.3..0.8)
      const bu = easeOutCubic(smooth(0, 0.35, u));
      const mu = easeInOutCubic(smooth(0.3, 0.8, u));

      // pointer ray in stand space
      let rayOn = false;
      if (pointer.on > 0.01) {
        stand.updateMatrixWorld();
        localRay.copy(pointer.ray(camera)).applyMatrix4(inv.copy(stand.matrixWorld).invert());
        rayOn = true;
      }

      // idle: one cube lifts and settles now and then
      if (motion && T > nextLift && u < 0.05) {
        liftIdx = Math.floor(rand() * N);
        liftT = 0;
        nextLift = T + 2.2 + rand() * 2;
      }
      liftT += dt || 0;

      const ks = motion ? Math.min(dt, 0.05) : 0;
      for (let i = 0; i < N; i++) {
        const b = blocks[i];
        const kin = easeOutCubic((T - b.delay) / 1.05);
        // arrive: fall from `from` with a short settle bounce
        pos.lerpVectors(b.from, b.home, kin);
        pos.y += Math.sin(Math.min(1, kin) * Math.PI) * 0.25 * (1 - kin);
        // scroll: burst then monolith
        pos.addScaledVector(b.burst, bu * (1 - mu));
        if (mu > 0) pos.lerp(b.mono, mu);

        // pointer push: spring towards a displaced target
        let push = 0;
        if (rayOn && kin > 0.9) {
          localRay.closestPointToPoint(pos, tmp);
          const dd = tmp.distanceTo(pos);
          const r = 0.75;
          if (dd < r) {
            push = (1 - dd / r) ** 2 * pointer.on;
            tmp.subVectors(pos, tmp).normalize();
            tmp.y = Math.abs(tmp.y) * 0.6 + 0.4; // push away and up
          }
        }
        if (motion) {
          // critically damped-ish spring on the offset
          const want = push > 0 ? tmp.multiplyScalar(push * 0.38) : tmp.set(0, 0, 0);
          offV[i].addScaledVector(want.sub(off[i]), ks * 90).multiplyScalar(Math.exp(-ks * 14));
          off[i].addScaledVector(offV[i], ks);
        }
        pos.add(off[i]);
        // idle lift
        let lf = 0;
        if (i === liftIdx) lf = Math.sin(clamp(liftT / 1.6) * Math.PI) * 0.22 * (1 - u);
        pos.y += lf;
        lift[i] = lf;

        const travel = Math.sin(mu * Math.PI); // cubes turn a quarter while travelling to the monolith
        const spin = (1 - kin) * 2.6 + travel * (0.6 + b.seed * 0.8);
        e.set(b.spinFrom.x * spin * 0.4, b.spinFrom.y * spin * 0.4, b.spinFrom.z * spin * 0.4);
        q.setFromEuler(e);
        if (off[i].lengthSq() > 1e-6) q.multiply(q2.setFromAxisAngle(b.tumble, off[i].length() * 1.4));
        const sc = Math.max(0.001, 0.3 + 0.7 * kin);
        m.compose(pos, q, tmp.copy(one).multiplyScalar(sc));
        mesh.setMatrixAt(i, m);

        // colour: the stand's own palette, then in the monolith graphite with a lime crown
        const tone = mu > 0.5 ? (b.monoTop ? 3 : 0) : b.kind;
        let g = b.kind === 2 ? 0.16 * (1 - mu) : 0;
        if (b.monoTop) g += 0.06 * smooth(0.6, 1, mu);
        g += push * 0.9 + lf * 2.5;
        glow.array[i] = g * kin;
        if (tone !== b.tone) {
          b.tone = tone;
          mesh.setColorAt(i, tone === 2 ? limeBase : tone === 3 ? limeDeep : tone === 1 ? white : graphite);
          mesh.instanceColor.needsUpdate = true;
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
      glow.needsUpdate = true;
      for (const [i, l] of edgeLines) mesh.getMatrixAt(i, l.matrix);
      edgeMat.opacity = 0.18 + 0.2 * bu * (1 - mu);

      const lit = smooth(0.6, 2.4, T);
      spot.intensity = (30 + Math.sin(T * 0.9) * 3) * lit * (1 - mu * 0.7);
      coneMat.uniforms.uA.value = lit * (1 - u * 0.5);
    },
    dispose() {
      pointer.dispose();
    },
  };
}
