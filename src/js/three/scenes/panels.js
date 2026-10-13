// Stacked UI panels (sites, landing pages, articles) floating in depth.
import { metal, edges, dust, easeOut } from '../util.js';

export default function build({ THREE, rig, small, palette }) {
  const { lime, white } = palette;
  const items = [];
  const count = small ? 5 : 7;
  for (let i = 0; i < count; i++) {
    const g = new THREE.BoxGeometry(2.3, 1.45, 0.03);
    const p = new THREE.Mesh(g, metal(new THREE.Color('#0d0d0d'), { roughness: 0.6 }));
    const front = i === count - 1;
    p.add(edges(g, front ? lime : white, front ? 0.9 : 0.35));
    // fake UI: header bar + content blocks
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.08), new THREE.MeshBasicMaterial({ color: 0x2a2a2a }));
    bar.position.set(0, 0.56, 0.02);
    p.add(bar);
    const blocks = [[-0.55, 0.15, 0.9, 0.18, i % 2 ? lime : white], [-0.55, -0.12, 0.9, 0.06, 0x555555], [-0.55, -0.25, 0.7, 0.06, 0x555555], [0.55, -0.05, 0.8, 0.7, 0x1c1c1c]];
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
}
