// Scattered cubes assemble into a rising stair-tower (exhibition stand / B2B build).
import { metal, dust, easeOut } from '../util.js';

export default function build({ THREE, rig, small, palette }) {
  const { lime, white, ink } = palette;
  const targets = [];
  const n = small ? 5 : 6;
  for (let x = 0; x < n; x++) {
    for (let z = 0; z < n; z++) {
      const h = Math.max(1, Math.round((x + (n - z)) * 0.6 + (Math.random() < 0.2 ? 1 : 0)));
      for (let y = 0; y < h; y++) targets.push(new THREE.Vector3(x - n / 2 + 0.5, y, z - n / 2 + 0.5));
    }
  }
  const count = targets.length;
  const geo = new THREE.BoxGeometry(0.92, 0.92, 0.92);
  const mesh = new THREE.InstancedMesh(geo, metal(white, { roughness: 0.4 }), count);
  const maxY = Math.max(...targets.map((t) => t.y));
  const starts = targets.map(() => new THREE.Vector3((Math.random() - 0.5) * 16, (Math.random() - 0.2) * 12, (Math.random() - 0.5) * 10));
  const delays = targets.map((t) => t.y * 0.08 + Math.random() * 0.4);
  targets.forEach((t, i) => mesh.setColorAt(i, t.y === maxY || (t.y > maxY - 2 && Math.random() < 0.5) ? lime : Math.random() < 0.25 ? white : ink));
  const group = new THREE.Group();
  group.scale.setScalar(small ? 0.36 : 0.4);
  group.position.y = -1.2;
  group.rotation.set(0.45, 0.78, 0);
  group.add(mesh);
  rig.add(group);
  rig.add(dust(small ? 80 : 160, 9));
  const v = new THREE.Vector3();
  const tmp = new THREE.Object3D();
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
}
