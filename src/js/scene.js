// WebGL hero scenes. One renderer per page; each mode builds a small object graph in brand
// colours and exposes update(time, scroll, pointer). Rendering pauses when the hero is off-screen.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const LIME = new THREE.Color('#ccff00');
const WHITE = new THREE.Color('#ffffff');
const INK = new THREE.Color('#111111');

export function mount(canvas, mode, { motion, finePointer }) {
  const hero = canvas.closest('[data-hero]');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 5, 4);
  scene.add(key);
  const rim = new THREE.PointLight(LIME, 30, 20);
  rim.position.set(-3, 1, -2);
  scene.add(rim);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0, 9);
  const rig = new THREE.Group();
  scene.add(rig);

  const small = innerWidth < 760;
  const build = MODES[mode] ?? MODES.helix;
  const world = build(rig, { small, camera });

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  if (finePointer) {
    addEventListener('pointermove', (e) => {
      pointer.tx = (e.clientX / innerWidth) * 2 - 1;
      pointer.ty = (e.clientY / innerHeight) * 2 - 1;
    }, { passive: true });
  }

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // Keep the object to the right of the headline on wide screens, centred on phones.
    const wide = camera.aspect > 1.1;
    rig.position.x = wide ? Math.min(3, 0.9 + camera.aspect * 0.95) : 0;
    rig.position.y = wide ? -0.15 : 1.2;
    rig.scale.setScalar(wide ? 1 : 0.82);
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(hero);

  const clock = new THREE.Clock();
  let scroll = 0;
  const frame = () => {
    if (!visible || document.hidden) return;
    const t = motion ? clock.getElapsedTime() : 2.5;
    const r = hero.getBoundingClientRect();
    scroll += (Math.min(Math.max(-r.top / r.height, 0), 1) - scroll) * 0.12;
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    rig.rotation.y = pointer.x * 0.35;
    rig.rotation.x = pointer.y * 0.18;
    world.update(t, scroll, pointer);
    renderer.render(scene, camera);
  };
  if (motion) renderer.setAnimationLoop(frame);
  else { frame(); new ResizeObserver(frame).observe(canvas); }
}

// ---------- helpers ----------

function edges(geo, color = WHITE, opacity = 0.35) {
  return new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}
const metal = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55, ...extra });
const easeOut = (x) => 1 - Math.pow(1 - Math.min(Math.max(x, 0), 1), 3);

function dust(count, spread) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * spread;
    pos[i * 3 + 1] = (Math.random() - 0.5) * spread;
    pos[i * 3 + 2] = (Math.random() - 0.5) * spread;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: WHITE, size: 0.018, transparent: true, opacity: 0.55, sizeAttenuation: true }));
}

const tmp = new THREE.Object3D();

// ---------- modes ----------

const MODES = {
  // Double helix of blocks that grows taller (and limer) towards the top: "grow on purpose".
  helix(rig, { small }) {
    const count = small ? 140 : 240;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.InstancedMesh(geo, metal(WHITE), count);
    const data = [];
    for (let i = 0; i < count; i++) {
      const t = i / count;
      const strand = i % 2;
      const lime = t > 0.55 && Math.random() < t * 0.8;
      mesh.setColorAt(i, lime ? LIME : Math.random() < 0.15 ? WHITE : INK);
      data.push({ t, strand, s: 0.07 + t * 0.16 + Math.random() * 0.04, spin: Math.random() * Math.PI });
    }
    rig.add(mesh);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 5, 6), new THREE.MeshBasicMaterial({ color: LIME }));
    rig.add(core);
    const d = dust(small ? 120 : 260, 9);
    rig.add(d);
    return {
      update(time, scroll) {
        for (let i = 0; i < count; i++) {
          const p = data[i];
          const a = p.t * Math.PI * 7 + p.strand * Math.PI + time * 0.35;
          const rad = (0.45 + p.t * 0.85) * (1 + scroll * 1.4);
          tmp.position.set(Math.cos(a) * rad, (p.t - 0.5) * 4.6 + Math.sin(time + p.t * 9) * 0.05, Math.sin(a) * rad);
          tmp.rotation.set(p.spin + time * 0.4, a, p.spin);
          const grow = easeOut(time * 0.6 - p.t * 1.2 + 0.2);
          tmp.scale.setScalar(p.s * grow);
          tmp.updateMatrix();
          mesh.setMatrixAt(i, tmp.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        d.rotation.y = time * 0.03;
      },
    };
  },

  // A field of data columns; the wave of growth rolls across it, peaks light up lime.
  bars(rig, { small, camera }) {
    const n = small ? 10 : 14;
    const count = n * n;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const mesh = new THREE.InstancedMesh(geo, metal(WHITE, { roughness: 0.5 }), count);
    const colors = [];
    const field = new THREE.Group();
    field.add(mesh);
    const grid = new THREE.GridHelper(n * 0.32, n, 0x333333, 0x222222);
    grid.position.y = -1.2;
    field.add(grid);
    rig.add(field);
    camera.position.set(0, 3.2, 8.2);
    camera.lookAt(0, -0.2, 0);
    const color = new THREE.Color();
    return {
      update(time, scroll) {
        let i = 0;
        for (let x = 0; x < n; x++) {
          for (let z = 0; z < n; z++) {
            const fx = x / (n - 1) - 0.5;
            const fz = z / (n - 1) - 0.5;
            const trend = (fx + 0.5) * 0.6 + (0.5 - fz) * 0.6;
            const wave = Math.sin(fx * 6 + time * 1.2) * Math.cos(fz * 5 - time * 0.8) * 0.35;
            const h = Math.max(0.04, (0.2 + trend * 1.6 + wave) * easeOut(time * 0.5 - (x + z) * 0.03) * (1 + scroll));
            tmp.position.set(fx * n * 0.32, -1.2, fz * n * 0.32);
            tmp.rotation.set(0, 0, 0);
            tmp.scale.set(0.22, h, 0.22);
            tmp.updateMatrix();
            mesh.setMatrixAt(i, tmp.matrix);
            color.copy(h > 1.55 ? LIME : h > 1.0 ? WHITE : INK);
            if (!colors[i] || !colors[i].equals(color)) { mesh.setColorAt(i, color); colors[i] = color.clone(); mesh.instanceColor.needsUpdate = true; }
            i++;
          }
        }
        mesh.instanceMatrix.needsUpdate = true;
        field.rotation.y = -0.6 + Math.sin(time * 0.15) * 0.15;
      },
    };
  },

  // A liquid orb (noise-displaced), wireframe shell and orbiting "notifications".
  orb(rig, { small }) {
    const mat = metal(new THREE.Color('#0b0b0b'), { roughness: 0.18, metalness: 0.9 });
    const uniforms = { uTime: { value: 0 }, uAmp: { value: 0.28 } };
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\nuniform float uTime; uniform float uAmp;\n${NOISE}`)
        .replace('#include <begin_vertex>', `float n = snoise(normal * 1.4 + vec3(uTime * 0.35));\nvec3 transformed = position + normal * n * uAmp;`)
        .replace('#include <beginnormal_vertex>', `vec3 objectNormal = normal;`);
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>\nfloat fres = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 2.5);\ngl_FragColor.rgb += vec3(0.8, 1.0, 0.0) * fres * 0.9;`,
      );
    };
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, small ? 48 : 96), mat);
    rig.add(orb);
    const shell = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(2.05, 1)), new THREE.LineBasicMaterial({ color: WHITE, transparent: true, opacity: 0.14 }));
    rig.add(shell);
    const sats = [];
    for (let i = 0; i < 7; i++) {
      const g = new THREE.BoxGeometry(0.16, 0.16, 0.16);
      const m = new THREE.Mesh(g, metal(i % 3 === 0 ? WHITE : LIME, { emissive: i % 3 === 0 ? 0x000000 : LIME, emissiveIntensity: 0.4 }));
      m.add(edges(g, WHITE, 0.6));
      m.userData = { r: 2.2 + Math.random() * 0.6, s: 0.3 + Math.random() * 0.4, o: Math.random() * 6.28, tilt: (Math.random() - 0.5) * 1.4 };
      sats.push(m);
      rig.add(m);
    }
    rig.add(dust(small ? 100 : 200, 9));
    return {
      update(time, scroll) {
        uniforms.uTime.value = time;
        uniforms.uAmp.value = 0.22 + scroll * 0.5 + Math.sin(time * 0.7) * 0.04;
        orb.rotation.y = time * 0.15;
        shell.rotation.set(time * 0.05, -time * 0.08, 0);
        const s = easeOut(time * 0.7);
        orb.scale.setScalar(s);
        shell.scale.setScalar(s * (1 + scroll * 0.3));
        for (const m of sats) {
          const { r, s: sp, o, tilt } = m.userData;
          const a = time * sp + o;
          m.position.set(Math.cos(a) * r, Math.sin(a * 1.3) * tilt, Math.sin(a) * r);
          m.rotation.set(a, a * 0.7, 0);
        }
      },
    };
  },

  // Stacked UI panels (sites, landing pages, articles) floating in depth.
  panels(rig, { small }) {
    const items = [];
    const count = small ? 5 : 7;
    for (let i = 0; i < count; i++) {
      const g = new THREE.BoxGeometry(2.3, 1.45, 0.03);
      const p = new THREE.Mesh(g, metal(new THREE.Color('#0d0d0d'), { roughness: 0.6 }));
      p.add(edges(g, i === count - 1 ? LIME : WHITE, i === count - 1 ? 0.9 : 0.35));
      // fake UI: header bar + content blocks
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.08), new THREE.MeshBasicMaterial({ color: 0x2a2a2a }));
      bar.position.set(0, 0.56, 0.02);
      p.add(bar);
      const blocks = [[-0.55, 0.15, 0.9, 0.18, i % 2 ? LIME : WHITE], [-0.55, -0.12, 0.9, 0.06, 0x555555], [-0.55, -0.25, 0.7, 0.06, 0x555555], [0.55, -0.05, 0.8, 0.7, 0x1c1c1c]];
      for (const [x, y, w, h, c] of blocks) {
        const b = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c }));
        b.position.set(x, y, 0.021);
        p.add(b);
      }
      p.userData = { i, base: new THREE.Vector3((i - count / 2) * 0.35, (i - count / 2) * -0.22, (i - count / 2) * 0.55) };
      items.push(p);
      rig.add(p);
    }
    rig.add(dust(small ? 80 : 160, 8));
    rig.rotation.order = 'YXZ';
    return {
      update(time, scroll) {
        for (const p of items) {
          const { i, base } = p.userData;
          const intro = easeOut(time * 0.8 - i * 0.12);
          p.position.set(base.x * (1 + scroll * 0.8), base.y + Math.sin(time * 0.8 + i) * 0.06 + (1 - intro) * -3, base.z * (1 + scroll * 1.6));
          p.rotation.set(-0.12, -0.55 + Math.sin(time * 0.3 + i * 0.4) * 0.05, 0.04);
          p.scale.setScalar(intro);
        }
      },
    };
  },

  // Scattered cubes assemble into a rising stair-tower (exhibition stand / B2B build).
  blocks(rig, { small }) {
    const targets = [];
    const n = small ? 5 : 6;
    for (let x = 0; x < n; x++) for (let z = 0; z < n; z++) {
      const h = Math.max(1, Math.round((x + (n - z)) * 0.6 + (Math.random() < 0.2 ? 1 : 0)));
      for (let y = 0; y < h; y++) targets.push(new THREE.Vector3(x - n / 2 + 0.5, y, z - n / 2 + 0.5));
    }
    const count = targets.length;
    const geo = new THREE.BoxGeometry(0.92, 0.92, 0.92);
    const mesh = new THREE.InstancedMesh(geo, metal(WHITE, { roughness: 0.4 }), count);
    const maxY = Math.max(...targets.map((t) => t.y));
    const starts = targets.map(() => new THREE.Vector3((Math.random() - 0.5) * 16, (Math.random() - 0.2) * 12, (Math.random() - 0.5) * 10));
    const delays = targets.map((t) => t.y * 0.08 + Math.random() * 0.4);
    targets.forEach((t, i) => mesh.setColorAt(i, t.y === maxY || (t.y > maxY - 2 && Math.random() < 0.5) ? LIME : Math.random() < 0.25 ? WHITE : INK));
    const group = new THREE.Group();
    group.scale.setScalar(small ? 0.36 : 0.4);
    group.position.y = -1.2;
    group.rotation.set(0.45, 0.78, 0);
    group.add(mesh);
    rig.add(group);
    rig.add(dust(small ? 80 : 160, 9));
    const v = new THREE.Vector3();
    return {
      update(time, scroll) {
        for (let i = 0; i < count; i++) {
          const k = easeOut((time - delays[i]) * 0.55);
          v.lerpVectors(starts[i], targets[i], k);
          v.addScaledVector(targets[i], scroll * 0.9);
          tmp.position.copy(v);
          tmp.rotation.set((1 - k) * 3 + scroll * i * 0.01, (1 - k) * 2, 0);
          tmp.scale.setScalar(1);
          tmp.updateMatrix();
          mesh.setMatrixAt(i, tmp.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        group.rotation.y = 0.78 + time * 0.08;
      },
    };
  },

  // Dotted globe turned to Greece, with arcs from Athens to the rest of the country.
  globe(rig, { small }) {
    const R = 1.9;
    const pts = small ? 1400 : 2600;
    const pos = new Float32Array(pts * 3);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < pts; i++) {
      const y = 1 - (i / (pts - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = golden * i;
      pos.set([Math.cos(th) * r * R, y * R, Math.sin(th) * r * R], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const globe = new THREE.Group();
    globe.add(new THREE.Points(g, new THREE.PointsMaterial({ color: WHITE, size: 0.018, transparent: true, opacity: 0.6 })));
    globe.add(new THREE.Mesh(new THREE.SphereGeometry(R * 0.985, 48, 48), new THREE.MeshBasicMaterial({ color: 0x000000 })));
    for (let k = -2; k <= 2; k++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R * Math.cos(k * 0.4), 0.002, 4, 128), new THREE.MeshBasicMaterial({ color: 0x333333 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = R * Math.sin(k * 0.4);
      globe.add(ring);
    }
    const ll = (lat, lon, r = R) => {
      const phi = (90 - lat) * (Math.PI / 180);
      const th = (lon + 180) * (Math.PI / 180);
      return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
    };
    const athens = ll(37.94, 23.73);
    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.07), new THREE.MeshBasicMaterial({ color: LIME }));
    pin.position.copy(athens);
    globe.add(pin);
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.1, 4), new THREE.MeshBasicMaterial({ color: LIME, side: THREE.DoubleSide, transparent: true }));
    halo.position.copy(athens.clone().multiplyScalar(1.002));
    halo.lookAt(athens.clone().multiplyScalar(2));
    globe.add(halo);
    const cities = [[40.64, 22.94], [35.34, 25.13], [38.25, 21.73], [39.66, 20.85], [36.43, 28.22], [39.64, 22.42], [37.04, 22.11], [41.12, 25.4], [39.62, 19.92], [37.44, 25.37], [40.0, 30.0], [45.0, 15.0], [48.85, 2.35], [51.5, -0.12]];
    const arcs = cities.map(([la, lo], i) => {
      const end = ll(la, lo);
      const mid = athens.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(R + athens.distanceTo(end) * 0.45);
      const curve = new THREE.QuadraticBezierCurve3(athens, mid, end);
      const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(48));
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: i < 10 ? LIME : WHITE, transparent: true, opacity: i < 10 ? 0.9 : 0.4 }));
      geo.setDrawRange(0, 0);
      const dot = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.035), new THREE.MeshBasicMaterial({ color: WHITE }));
      dot.position.copy(end);
      globe.add(line, dot);
      return { geo, delay: i * 0.18 };
    });
    // Face Greece towards the camera.
    globe.rotation.y = -((23.73 + 90) * Math.PI) / 180 + Math.PI;
    globe.rotation.x = (37.94 * Math.PI) / 180 * 0.65;
    const spin = new THREE.Group();
    spin.add(globe);
    rig.add(spin);
    return {
      update(time, scroll) {
        spin.rotation.y = Math.sin(time * 0.25) * 0.35 + scroll * 1.2;
        for (const a of arcs) a.geo.setDrawRange(0, Math.floor(49 * easeOut((time - 0.6 - a.delay) * 0.7)));
        const p = (time * 0.8) % 1;
        halo.scale.setScalar(1 + p * 2.5);
        halo.material.opacity = 1 - p;
        spin.scale.setScalar(easeOut(time * 0.7) * (1 + scroll * 0.25));
      },
    };
  },
};

// Ashima simplex noise (MIT) for the orb.
const NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;
