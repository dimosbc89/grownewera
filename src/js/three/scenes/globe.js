// Dotted globe (ChatGPT ads, local business, team, contact, local case). Land drawn in rows of
// square dots (Natural Earth mask), turned to Greece; lime arcs leave Athens for Greek cities (white
// ones for European hubs) with pulses running along them; a lime atmosphere rim and an Athens beacon.
//   intro   the globe fades up dot row by dot row while turning in to Greece; arcs draw out of Athens
//   idle    slow sway, pulses travel the arcs and flash the cities they reach, the beacon ripples
//   pointer hovering over the globe and moving drags it round (press and drag for direct control);
//           it keeps spinning with inertia, then eases back to Greece
//   scroll  zooms in on Greece: the world dots give way to a fine dot map of Greece and the Aegean,
//           Athens comes to the centre and the Greek arcs fill the view
import * as THREE from 'three';
import {
  clamp, lerp, smooth, easeOutCubic, easeInOutCubic, rng, detail, frame, shiftFrame,
  localPointer, tuneLights, squarePoints, damp, look,
} from './_shared.js';
import { WORLD, GREECE, GREECE_COUNTRY, decodeMask } from './_land.js';

const ATHENS = [37.98, 23.73];
const GREEK = [[40.64, 22.94], [35.34, 25.13], [38.25, 21.73], [39.66, 20.85], [36.43, 28.22], [39.64, 22.42], [37.04, 22.11], [40.85, 25.87], [39.62, 19.92], [37.45, 25.33], [35.51, 24.02], [39.36, 22.94], [38.9, 22.43], [36.9, 27.29]];
const WORLDWIDE = [[51.5, -0.12], [52.52, 13.4], [48.86, 2.35], [45.46, 9.19], [35.17, 33.36], [40.42, -3.7], [59.33, 18.07], [55.75, 37.62], [25.2, 55.27], [30.04, 31.24], [48.2, 16.37], [41.01, 28.98]];

export default function build(ctx) {
  const { rig, camera, renderer, palette, motion } = ctx;
  const lod = detail(ctx);
  const rand = rng(17);
  const R = 1.55;
  const D2R = Math.PI / 180;

  // lat/lon -> unit vector (lon 0 at +z... chosen so +x is east of the prime meridian on the front)
  const ll = (lat, lon, r = 1, out = new THREE.Vector3()) => {
    const phi = (90 - lat) * D2R;
    const th = (lon + 180) * D2R;
    return out.set(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
  };

  // ---------- dots ----------
  const world = decodeMask(WORLD);
  const greece = decodeMask(GREECE);
  const landAt = (mask, M, lat, lon) => {
    const x = Math.floor((lon - M.lon0) / M.res);
    const y = Math.floor((M.lat0 - lat) / M.res);
    if (x < 0 || y < 0 || x >= M.w || y >= M.h) return 0;
    return mask[y * M.w + x];
  };
  const step = lerp(2.1, 1.15, clamp((lod - 0.35) / 0.65));
  const wpos = [];
  const wseed = [];
  const athensV = ll(ATHENS[0], ATHENS[1]);
  for (let lat = -84; lat <= 84; lat += step) {
    const n = Math.max(1, Math.round((360 / step) * Math.cos(lat * D2R)));
    for (let j = 0; j < n; j++) {
      const lon = -180 + ((j + 0.5) * 360) / n;
      if (!landAt(world, WORLD, lat, lon)) continue;
      const v = ll(lat, lon, R * 1.002);
      wpos.push(v.x, v.y, v.z);
      // seed: x = row phase for the intro, y = random, z = cos(angle to Athens)
      wseed.push((90 - lat) / 180, rand(), v.clone().normalize().dot(athensV), 0);
    }
  }
  // uBoost: without bloom (mid / low tiers) the dots need a little more presence
  const boost = (q) => (q === 'high' ? 1 : 1.45);
  const dotUniforms = { uZoom: { value: 0 }, uLime: { value: palette.lime.clone() }, uBoost: { value: boost(ctx.quality) } };
  const worldDots = squarePoints({
    count: wpos.length / 3,
    positions: new Float32Array(wpos),
    seeds: new Float32Array(wseed),
    decl: 'uniform float uZoom; uniform vec3 uLime; uniform float uBoost;',
    body: /* glsl */ `
      float rowIn = smoothstep(aSeed.x * 0.9, aSeed.x * 0.9 + 0.12, uIntro);
      float near = smoothstep(0.985, 0.999, aSeed.z);
      size = 2.2 + near * 0.7;
      // the fine map of Greece takes over within ~5.5 degrees of Athens as the camera zooms in
      float inner = smoothstep(0.9948, 0.9962, aSeed.z);
      alpha = rowIn * (0.3 + near * 0.3) * (1.0 - inner * smoothstep(0.2, 0.55, uZoom)) * (1.0 - smoothstep(0.75, 1.0, uZoom) * 0.65);
      col = mix(vec3(0.85), uLime, near * 0.55);
      alpha = min(1.0, alpha * uBoost);
    `,
    uniforms: dotUniforms,
    blending: THREE.NormalBlending,
  });
  // Fine Greece map (fades in as the camera zooms in): Greece bright, its neighbours dim.
  const greeceOnly = decodeMask(GREECE_COUNTRY);
  const gpos = [];
  const gseed = [];
  const gstep = ctx.quality === 'high' && !ctx.small ? 0.13 : 0.19;
  for (let lat = GREECE.lat0 - gstep / 2; lat > GREECE.lat0 - GREECE.h * GREECE.res; lat -= gstep) {
    const lstep = gstep / Math.cos(lat * D2R);
    for (let lon = GREECE.lon0 + lstep / 2; lon < GREECE.lon0 + GREECE.w * GREECE.res; lon += lstep) {
      if (!landAt(greece, GREECE, lat, lon)) continue;
      const v = ll(lat, lon, R * 1.003);
      gpos.push(v.x, v.y, v.z);
      gseed.push(landAt(greeceOnly, GREECE, lat, lon), rand(), v.clone().normalize().dot(athensV), 0);
    }
  }
  const greeceDots = squarePoints({
    count: gpos.length / 3,
    positions: new Float32Array(gpos),
    seeds: new Float32Array(gseed),
    decl: 'uniform float uZoom; uniform float uBoost;',
    body: /* glsl */ `
      size = 1.6 + uZoom * 0.9;
      alpha = smoothstep(0.25, 0.6, uZoom) * smoothstep(0.9948, 0.9962, aSeed.z) * mix(0.2, 0.75 + aSeed.y * 0.15, aSeed.x);
      col = mix(vec3(0.8), vec3(0.95), aSeed.x);
      alpha = min(1.0, alpha * uBoost);
    `,
    uniforms: dotUniforms,
    blending: THREE.NormalBlending,
  });

  const globe = new THREE.Group();
  globe.add(worldDots, greeceDots);

  // Ocean: black core that hides the far side, with a faint lime rim.
  const oceanMat = new THREE.ShaderMaterial({
    uniforms: { uLime: { value: palette.lime.clone() }, uA: { value: 0 } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uLime; uniform float uA; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - max(dot(vN, vV), 0.0), 3.0); gl_FragColor = vec4(uLime * f * 0.06 * uA + vec3(0.004), 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
  });
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(R * 0.995, 64, 48), oceanMat));

  // Graticule: faint parallels and meridians.
  const grat = [];
  const seg = 96;
  for (let lat = -60; lat <= 60; lat += 30) {
    for (let i = 0; i < seg; i++) grat.push(...ll(lat, (i / seg) * 360 - 180, R * 1.001).toArray(), ...ll(lat, ((i + 1) / seg) * 360 - 180, R * 1.001).toArray());
  }
  for (let lon = -180; lon < 180; lon += 30) {
    for (let i = 0; i < seg / 2; i++) grat.push(...ll(-90 + (i / (seg / 2)) * 180, lon, R * 1.001).toArray(), ...ll(-90 + ((i + 1) / (seg / 2)) * 180, lon, R * 1.001).toArray());
  }
  const gratGeo = new THREE.BufferGeometry();
  gratGeo.setAttribute('position', new THREE.Float32BufferAttribute(grat, 3));
  const gratMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
  globe.add(new THREE.LineSegments(gratGeo, gratMat));

  // Atmosphere: back-side fresnel shell.
  const atmoMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uA: { value: 0 }, uColor: { value: palette.lime.clone().lerp(palette.white, 0.25) } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float uA; uniform vec3 uColor; varying vec3 vN; varying vec3 vV; void main(){ float d = dot(vN, vV); float a = pow(smoothstep(0.0, -0.58, d), 3.5) * uA * 0.16; gl_FragColor = vec4(uColor * a, a);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
  });
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.2, 64, 48), atmoMat);

  // ---------- arcs ----------
  const targets = [...GREEK.map((c) => ({ c, greek: true })), ...WORLDWIDE.map((c) => ({ c, greek: false }))];
  const SEGS = 64;
  const arcPos = [];
  const arcT = [];
  const arcS = [];
  const arcs = [];
  const A = ll(ATHENS[0], ATHENS[1], R);
  targets.forEach(({ c, greek }, k) => {
    const B = ll(c[0], c[1], R);
    const dist = A.distanceTo(B);
    const mid = A.clone().add(B).multiplyScalar(0.5);
    const lift = R + dist * (greek ? 0.95 : 0.5);
    const ctrl = mid.clone().normalize().multiplyScalar(lift);
    const curve = new THREE.QuadraticBezierCurve3(A.clone(), ctrl, B.clone());
    const pts = curve.getPoints(SEGS);
    for (let i = 0; i < SEGS; i++) {
      arcPos.push(...pts[i].toArray(), ...pts[i + 1].toArray());
      arcT.push(i / SEGS, (i + 1) / SEGS);
      arcS.push(k, k);
    }
    arcs.push({ curve, greek, B, delay: (greek ? 0.9 : 1.6) + (k % 7) * 0.12 + rand() * 0.2, speed: greek ? 0.42 + rand() * 0.2 : 0.26 + rand() * 0.1, phase: rand(), hit: 0 });
  });
  const arcGeo = new THREE.BufferGeometry();
  arcGeo.setAttribute('position', new THREE.Float32BufferAttribute(arcPos, 3));
  arcGeo.setAttribute('aT', new THREE.Float32BufferAttribute(arcT, 1));
  arcGeo.setAttribute('aK', new THREE.Float32BufferAttribute(arcS, 1));
  const ARCN = arcs.length;
  const arcMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uDraw: { value: new Float32Array(ARCN) },
      uHead: { value: new Float32Array(ARCN) },
      uGreek: { value: new Float32Array(arcs.map((a) => (a.greek ? 1 : 0))) },
      uLime: { value: palette.lime.clone() },
      uFadeWorld: { value: 1 },
    },
    vertexShader: `attribute float aT; attribute float aK; varying float vT; varying float vK; void main(){ vT = aT; vK = aK; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float uDraw[${ARCN}]; uniform float uHead[${ARCN}]; uniform float uGreek[${ARCN}]; uniform vec3 uLime; uniform float uFadeWorld; varying float vT; varying float vK;
      void main(){
        int k = int(vK + 0.5);
        float draw = uDraw[k]; float head = uHead[k]; float greek = uGreek[k];
        if (vT > draw) discard;
        float d = head - vT;
        float tail = d >= 0.0 ? exp(-d * 9.0) * step(d, 0.4) : 0.0;
        float base = mix(0.2, 0.5, greek);
        float a = (base + tail * 1.1) * mix(uFadeWorld, 1.0, greek);
        vec3 c = mix(vec3(0.9), uLime, greek);
        gl_FragColor = vec4(c * a, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const arcLines = new THREE.LineSegments(arcGeo, arcMat);
  arcLines.frustumCulled = false;
  globe.add(arcLines);

  // pulse heads (squares) + city markers
  const heads = squarePoints({
    count: ARCN,
    positions: new Float32Array(ARCN * 3),
    seeds: new Float32Array(arcs.flatMap((a) => [a.greek ? 1 : 0, 0, 0, 0])),
    body: 'size = 3.2 + aSeed.x * 1.4; col = mix(vec3(0.95), vec3(0.604, 1.0, 0.0), aSeed.x) * 1.4; alpha = aSeed.y;',
  });
  heads.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
  heads.geometry.attributes.aSeed.setUsage(THREE.DynamicDrawUsage);
  globe.add(heads);
  const cityPos = new Float32Array(ARCN * 3);
  arcs.forEach((a, i) => cityPos.set(a.B.clone().multiplyScalar(1.004).toArray(), i * 3));
  const cities = squarePoints({
    count: ARCN,
    positions: cityPos,
    seeds: new Float32Array(arcs.flatMap((a) => [a.greek ? 1 : 0, 0, 0, 0])),
    body: 'size = 2.6 + aSeed.y * 3.0 + aSeed.x * 0.6; col = mix(vec3(0.9), vec3(0.604, 1.0, 0.0), aSeed.x) * (1.0 + aSeed.y * 0.6); alpha = aSeed.z;',
  });
  cities.geometry.attributes.aSeed.setUsage(THREE.DynamicDrawUsage);
  globe.add(cities);

  // Athens beacon: bright square, a beam along the normal, ripples on the surface.
  const beacon = new THREE.Group();
  beacon.position.copy(A);
  beacon.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), A.clone().normalize());
  const pin = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.045), new THREE.MeshBasicMaterial({ color: palette.lime }));
  pin.position.y = 0.02;
  beacon.add(pin);
  const beamMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uA: { value: 0 }, uColor: { value: palette.lime.clone() } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uA; uniform vec3 uColor; varying vec2 vUv; void main(){ float a = uA * pow(1.0 - vUv.y, 1.6) * (1.0 - abs(vUv.x - 0.5) * 2.0); gl_FragColor = vec4(uColor * a, a);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
  });
  const BEAM = 0.55;
  const ZOOM = 9;
  for (let k = 0; k < 2; k++) {
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(0.03, BEAM), beamMat);
    beam.position.y = BEAM / 2;
    beam.rotation.y = (k * Math.PI) / 2;
    beacon.add(beam);
  }
  const rippleMat = () => new THREE.MeshBasicMaterial({ color: palette.lime, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const ripples = [0, 1].map(() => {
    const r = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.058, 48), rippleMat());
    r.rotation.x = -Math.PI / 2;
    r.position.y = 0.004;
    beacon.add(r);
    return r;
  });
  globe.add(beacon);

  // Orientation: Athens faces the camera, a little above the centre.
  const yaw = Math.atan2(A.x, A.z);
  const latTilt = ATHENS[0] * D2R;
  const spin = new THREE.Group(); // pointer drag + idle sway
  const zoomer = new THREE.Group(); // scroll zoom
  spin.add(globe);
  zoomer.add(spin, atmo);
  rig.add(zoomer);

  // ---------- lights ----------
  look(ctx, { exposure: 1.05 });
  tuneLights(ctx, { ambient: 0, key: 0, rim: 0, env: 0 });

  // ---------- state ----------
  const pointer = localPointer(ctx);
  const drag = { yaw: 0, pitch: 0, vy: 0, vx: 0 };
  const tmp = new THREE.Vector3();
  const centre = new THREE.Vector3();
  const edge = new THREE.Vector3();
  const athW = new THREE.Vector3();
  const e = new THREE.Euler(0, 0, 0, 'XYZ');
  const target = new THREE.Vector3();
  const headPos = heads.geometry.attributes.position;
  const headSeed = heads.geometry.attributes.aSeed;
  const citySeed = cities.geometry.attributes.aSeed;

  function layout(w, h) {
    frame(ctx, w, h, {
      extent: [R * 1.22, R * 1.22],
      desk: { x: 0.74, y: 0.5, size: 0.74 },
      phone: { x: 0.5, y: 0.24, size: 0.86, maxH: 0.44 },
    });
    const px = renderer.getPixelRatio() * Math.min(1, ctx.frame.scale + 0.15);
    for (const p of [worldDots, greeceDots, heads, cities]) p.material.uniforms.uPx.value = px;
    pointer.measure?.();
  }

  return {
    bloom: { strength: 0.4, radius: 0.35, threshold: 0.86 },
    resize: (w, h) => layout(w, h),
    update(time, scroll, _p, dt) {
      const T = motion ? time : 30;
      pointer.update(dt);
      const u = clamp(scroll / 0.62);
      const uu = easeInOutCubic(u);

      target.set(0, 0, 0);
      camera.position.set(0, 0, 9);
      camera.lookAt(target);
      camera.updateMatrixWorld();
      shiftFrame(ctx, 0, scroll * 0.3);

      // Drag: hover movement over the globe adds spin; pressing drags directly; inertia + spring home.
      zoomer.updateMatrixWorld();
      centre.setFromMatrixPosition(zoomer.matrixWorld).project(camera);
      edge.set(R, 0, 0).applyMatrix4(zoomer.matrixWorld).project(camera);
      const aspect = ctx.frame?.aspect || 1;
      const rad = Math.abs(edge.x - centre.x) * aspect;
      const dx = (pointer.x - centre.x) * aspect;
      const dy = pointer.y - centre.y;
      const over = pointer.on * smooth(rad * 1.25, rad * 0.85, Math.sqrt(dx * dx + dy * dy));
      if (motion && dt) {
        const gain = (pointer.down ? 2.6 : 0.9) * over;
        drag.vy += pointer.vx * gain * dt * 2.2;
        drag.vx -= pointer.vy * gain * dt * 1.4;
        drag.vy *= Math.exp(-dt * (pointer.down ? 6 : 1.6));
        drag.vx *= Math.exp(-dt * (pointer.down ? 6 : 1.6));
        drag.yaw += drag.vy * dt;
        drag.pitch += drag.vx * dt;
        const home = over > 0.2 || pointer.down ? 0.15 : 0.9;
        drag.yaw -= drag.yaw * damp(home, dt);
        drag.pitch -= drag.pitch * damp(home * 1.4, dt);
        drag.pitch = clamp(drag.pitch, -0.6, 0.6);
      }

      // Orientation: turn in during the intro, sway, drag; zoom straightens Athens to the centre.
      const turnIn = easeOutCubic(T / 2.6);
      const sway = motion ? Math.sin(T * 0.21) * 0.16 * (1 - uu) : 0;
      const tiltK = lerp(0.62, 1, uu);
      e.set(latTilt * tiltK + drag.pitch * (1 - uu), -yaw + (1 - turnIn) * 1.4 + sway + drag.yaw * (1 - uu), 0);
      spin.quaternion.setFromEuler(e);

      // Zoom towards Athens.
      const z = Math.exp(Math.log(ZOOM) * uu);
      zoomer.scale.setScalar(z * lerp(0.86, 1, easeOutCubic(T / 1.6)));
      athW.copy(A).applyQuaternion(spin.quaternion);
      // keep Athens in front of the camera at a fixed depth while the globe grows behind it
      zoomer.position.set(-athW.x * z * uu, -athW.y * z * uu, (1.25 - athW.z * z) * uu);
      dotUniforms.uZoom.value = uu;
      worldDots.material.uniforms.uIntro.value = smooth(0, 2.2, T) * 1.15;
      worldDots.material.uniforms.uTime.value = T;
      oceanMat.uniforms.uA.value = smooth(0.2, 1.8, T) * (1 - uu * 0.6);
      atmoMat.uniforms.uA.value = smooth(0.4, 2.2, T) * (1 - uu);
      gratMat.opacity = 0.06 * smooth(0.6, 2.4, T) * (1 - uu);
      arcMat.uniforms.uFadeWorld.value = 1 - smooth(0.2, 0.7, uu);

      // Arcs + pulses.
      for (let i = 0; i < ARCN; i++) {
        const a = arcs[i];
        const draw = easeInOutCubic((T - a.delay) / 1.1);
        arcMat.uniforms.uDraw.value[i] = draw;
        const p = draw >= 1 ? ((T - a.delay - 1.1) * a.speed + a.phase) % 1.25 : draw;
        const head = Math.min(p, 1);
        arcMat.uniforms.uHead.value[i] = draw >= 1 ? p : draw;
        a.curve.getPoint(head, tmp);
        headPos.setXYZ(i, tmp.x, tmp.y, tmp.z);
        const vis = (a.greek ? 1 : 1 - smooth(0.2, 0.7, uu)) * (draw > 0 ? 1 : 0);
        headSeed.setY(i, (p <= 1 ? 1 : 0) * vis * (a.greek ? 1 : 0.7));
        // flash the city when a pulse lands
        const landed = draw >= 1 && p >= 1;
        if (landed && !a.landed) a.hit = 1;
        a.landed = landed;
        a.hit = Math.max(0, a.hit - (dt || 0) * 1.5);
        citySeed.setY(i, a.hit);
        citySeed.setZ(i, smooth(0.85, 1, draw) * vis);
      }
      headPos.needsUpdate = true;
      headSeed.needsUpdate = true;
      citySeed.needsUpdate = true;

      // Beacon.
      const bOn = smooth(0.8, 1.8, T);
      beamMat.uniforms.uA.value = bOn * (0.9 + Math.sin(T * 3) * 0.1);
      pin.scale.setScalar(bOn * (1 + uu * 0.3));
      beacon.scale.setScalar(1 / Math.exp(Math.log(ZOOM) * uu * 0.8));
      ripples.forEach((r, k) => {
        const ph = ((T * 0.5 + k / 2) % 1 + 1) % 1;
        r.scale.setScalar(0.6 + ph * 3.2);
        r.material.opacity = bOn * Math.pow(1 - ph, 1.5) * 0.55;
      });
      for (const p of [worldDots, greeceDots, heads, cities]) p.material.uniforms.uIntro.value = smooth(0, 2.2, T) * 1.15;
    },
    setQuality(q) {
      dotUniforms.uBoost.value = boost(q);
    },
    dispose() {
      pointer.dispose();
    },
  };
}
