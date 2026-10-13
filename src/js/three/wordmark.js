// CTA 3D wordmark for canvas[data-scene="wordmark"] (STUB, to be built out into the "GROW."
// wordmark). For now: a slowly turning black box with black edges, placed clear of the CTA copy:
// right of it when the band has room, otherwise hanging off the top-right corner inside the
// band's top padding (never behind the black-on-lime buttons).
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

function buildWordmark({ THREE, rig, palette, canvas }) {
  const geo = new THREE.BoxGeometry(2.4, 2.4, 2.4);
  const box = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: palette.black, roughness: 0.4, metalness: 0.5, envMapIntensity: 0.6 }));
  box.add(edges(geo, palette.black, 0.9));
  const holder = new THREE.Group();
  holder.add(box);
  rig.add(holder);
  const band = canvas.closest('[data-cta]');
  return {
    resize(w, h, { camera }) {
      const upp = (2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / h; // world units per px at z = 0
      const copy = measureCopy(band);
      const m = Math.max(24, w * 0.04);
      const free = copy ? w - copy.right - 2 * m : 0;
      let side; // on-screen edge length (px); a turning cube reaches ~0.87 side from its centre
      let cx;
      let cy;
      if (copy && w > h && free >= 200) {
        side = Math.min(free * 0.55, h * 0.34, 280);
        cx = copy.right + m + free / 2;
        cy = h / 2;
      } else {
        side = Math.min(w * 0.2, (copy?.top ?? 96) * 0.8, 110);
        cx = w - side * 0.78;
        cy = side * 0.3;
      }
      holder.scale.setScalar((side * upp) / 2.4);
      holder.position.set((cx - w / 2) * upp, (h / 2 - cy) * upp, 0);
    },
    update(time, scroll) {
      box.rotation.set(0.5 + time * 0.22 + scroll * 1.5, time * 0.35 + scroll * 2, 0.15);
    },
  };
}

// The copy's right edge (text extents, not block boxes) and its top, in band pixels. Layout
// reads only, on resize; offsets ignore the CTA reveal's transform.
function measureCopy(band) {
  const inner = band?.querySelector('.cta__inner');
  if (!inner?.firstElementChild) return null;
  const left = band.getBoundingClientRect().left;
  const range = document.createRange();
  let right = 0;
  for (const el of inner.children) {
    const parts = el.matches('.btn-row') ? [...el.children].map((b) => b.getBoundingClientRect()) : [(range.selectNodeContents(el), range.getBoundingClientRect())];
    for (const r of parts) if (r.width) right = Math.max(right, r.right - left);
  }
  let top = 0;
  for (let el = inner.firstElementChild; el && el !== band; el = el.offsetParent) top += el.offsetTop;
  return { right, top };
}
