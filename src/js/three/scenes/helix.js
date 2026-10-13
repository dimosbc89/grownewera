// Double helix of blocks that grows taller (and limer) towards the top: "grow on purpose".
import { metal, dust, easeOut } from '../util.js';

export default function build({ THREE, rig, small, palette }) {
  const { lime, white, ink } = palette;
  const count = small ? 140 : 240;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.InstancedMesh(geo, metal(white), count);
  const data = [];
  for (let i = 0; i < count; i++) {
    const t = i / count;
    const strand = i % 2;
    const isLime = t > 0.55 && Math.random() < t * 0.8;
    mesh.setColorAt(i, isLime ? lime : Math.random() < 0.15 ? white : ink);
    data.push({ t, strand, s: 0.07 + t * 0.16 + Math.random() * 0.04, spin: Math.random() * Math.PI });
  }
  rig.add(mesh);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 5, 6), new THREE.MeshBasicMaterial({ color: lime }));
  rig.add(core);
  const d = dust(small ? 120 : 260, 9);
  rig.add(d);
  const tmp = new THREE.Object3D();
  return {
    update(time, scroll) {
      for (let i = 0; i < count; i++) {
        const p = data[i];
        const a = p.t * Math.PI * 7 + p.strand * Math.PI + time * 0.35;
        const rad = (0.45 + p.t * 0.85) * (1 + scroll * 1.4);
        tmp.position.set(Math.cos(a) * rad, (p.t - 0.5) * 4.6 + Math.sin(time + p.t * 9) * 0.05, Math.sin(a) * rad);
        tmp.rotation.set(p.spin + time * 0.4, a, p.spin);
        tmp.scale.setScalar(p.s * easeOut(time * 0.6 - p.t * 1.2 + 0.2));
        tmp.updateMatrix();
        mesh.setMatrixAt(i, tmp.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      d.rotation.y = time * 0.03;
    },
  };
}
