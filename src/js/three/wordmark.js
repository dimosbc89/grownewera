// CTA 3D wordmark for canvas[data-scene="wordmark"] (STUB, to be built out into the "GROW."
// wordmark). For now: a slowly turning black box with black edges, set behind the CTA copy.
import { createStage } from './core.js';
import { edges } from './util.js';

export function mount(canvas, opts = {}) {
  return createStage(canvas, {
    ...opts,
    layout: 'center',
    track: canvas.closest('[data-cta]') ?? canvas.parentElement,
    progress: 'through',
    post: false,
    fov: 30,
    distance: 11,
    tilt: [0.2, 0.1],
    build: buildWordmark,
  });
}

function buildWordmark({ THREE, rig, palette }) {
  const geo = new THREE.BoxGeometry(2.4, 2.4, 2.4);
  const box = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: palette.black, roughness: 0.4, metalness: 0.5, envMapIntensity: 0.6 }));
  box.add(edges(geo, palette.black, 0.9));
  const holder = new THREE.Group();
  holder.add(box);
  rig.add(holder);
  return {
    resize(w, h) {
      const aspect = w / h;
      const wide = aspect > 1.2;
      holder.position.set(wide ? Math.min(aspect * 1.55, 4.6) : 1.1, wide ? 0 : -1.6, 0);
      holder.scale.setScalar(wide ? 0.78 : 0.55);
    },
    update(time, scroll) {
      box.rotation.set(0.5 + time * 0.22 + scroll * 1.5, time * 0.35 + scroll * 2, 0.15);
    },
  };
}
