// A liquid orb (noise-displaced, lime fresnel rim), a wireframe shell and orbiting "notifications".
import { metal, edges, dust, easeOut, NOISE } from '../util.js';

export default function build({ THREE, rig, small, palette }) {
  const { lime, white } = palette;
  const mat = metal(new THREE.Color('#0b0b0b'), { roughness: 0.18, metalness: 0.9 });
  const uniforms = { uTime: { value: 0 }, uAmp: { value: 0.28 } };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uTime; uniform float uAmp;\n${NOISE}`)
      .replace('#include <begin_vertex>', 'float n = snoise(normal * 1.4 + vec3(uTime * 0.35));\nvec3 transformed = position + normal * n * uAmp;')
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = normal;');
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      '#include <dithering_fragment>\nfloat fres = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 2.5);\ngl_FragColor.rgb += vec3(0.8, 1.0, 0.0) * fres * 0.9;',
    );
  };
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, small ? 48 : 96), mat);
  rig.add(orb);
  const shell = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(2.05, 1)),
    new THREE.LineBasicMaterial({ color: white, transparent: true, opacity: 0.14 }),
  );
  rig.add(shell);
  const sats = [];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    const accent = i % 3 !== 0;
    const m = new THREE.Mesh(g, metal(accent ? lime : white, { emissive: accent ? lime : 0x000000, emissiveIntensity: 0.4 }));
    m.add(edges(g, white, 0.6));
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
}
