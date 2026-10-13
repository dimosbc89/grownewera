// Dotted globe turned to Greece, with arcs from Athens to the rest of the country (and Europe).
import { easeOut } from '../util.js';

export default function build({ THREE, rig, small, palette }) {
  const { lime, white } = palette;
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
  globe.add(new THREE.Points(g, new THREE.PointsMaterial({ color: white, size: 0.018, transparent: true, opacity: 0.6 })));
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
  const pin = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.07), new THREE.MeshBasicMaterial({ color: lime }));
  pin.position.copy(athens);
  globe.add(pin);
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.1, 4), new THREE.MeshBasicMaterial({ color: lime, side: THREE.DoubleSide, transparent: true }));
  halo.position.copy(athens.clone().multiplyScalar(1.002));
  halo.lookAt(athens.clone().multiplyScalar(2));
  globe.add(halo);
  const cities = [[40.64, 22.94], [35.34, 25.13], [38.25, 21.73], [39.66, 20.85], [36.43, 28.22], [39.64, 22.42], [37.04, 22.11], [41.12, 25.4], [39.62, 19.92], [37.44, 25.37], [40.0, 30.0], [45.0, 15.0], [48.85, 2.35], [51.5, -0.12]];
  const arcs = cities.map(([la, lo], i) => {
    const end = ll(la, lo);
    const mid = athens.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(R + athens.distanceTo(end) * 0.45);
    const curve = new THREE.QuadraticBezierCurve3(athens, mid, end);
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(48));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: i < 10 ? lime : white, transparent: true, opacity: i < 10 ? 0.9 : 0.4 }));
    geo.setDrawRange(0, 0);
    const dot = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.035), new THREE.MeshBasicMaterial({ color: white }));
    dot.position.copy(end);
    globe.add(line, dot);
    return { geo, delay: i * 0.18 };
  });
  // Face Greece towards the camera.
  globe.rotation.y = -((23.73 + 90) * Math.PI) / 180 + Math.PI;
  globe.rotation.x = ((37.94 * Math.PI) / 180) * 0.65;
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
}
