// A field of data columns; a wave of growth rolls across it and the peaks light up lime.
import { metal, easeOut } from '../util.js';

export default function build({ THREE, rig, small, camera, palette }) {
  const { lime, white, ink } = palette;
  const n = small ? 10 : 14;
  const count = n * n;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.translate(0, 0.5, 0);
  const mesh = new THREE.InstancedMesh(geo, metal(white, { roughness: 0.5 }), count);
  const field = new THREE.Group();
  field.add(mesh);
  const grid = new THREE.GridHelper(n * 0.32, n, 0x333333, 0x222222);
  grid.position.y = -1.2;
  field.add(grid);
  rig.add(field);
  camera.position.set(0, 3.2, 8.2);
  camera.lookAt(0, -0.2, 0);
  const tmp = new THREE.Object3D();
  const color = new THREE.Color();
  const colors = [];
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
          tmp.scale.set(0.22, h, 0.22);
          tmp.updateMatrix();
          mesh.setMatrixAt(i, tmp.matrix);
          color.copy(h > 1.55 ? lime : h > 1.0 ? white : ink);
          if (!colors[i] || !colors[i].equals(color)) {
            mesh.setColorAt(i, color);
            colors[i] = color.clone();
            mesh.instanceColor.needsUpdate = true;
          }
          i++;
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
      field.rotation.y = -0.6 + Math.sin(time * 0.15) * 0.15;
    },
  };
}
