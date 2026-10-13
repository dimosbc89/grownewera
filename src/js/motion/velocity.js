// One smoothed scroll velocity for the whole motion layer (px/s, positive = scrolling down), and the
// velocity skew on big type: skew(el, { k, max, axis }) leans an element while the page moves and
// eases it back when the scroll settles. Only elements on screen are written.
import { gsap } from 'gsap';
import { motion, touch, clamp, damp } from './util.js';

let v = 0;
let last = null;
let started = false;
const items = [];
let io = null;

/** Smoothed scroll velocity in px/s (0 without motion). */
export const velocity = () => v;

function tick(time, dtMs) {
  const dt = Math.min((dtMs || 16.7) / 1000, 0.1);
  const y = window.scrollY;
  if (last === null) last = y;
  const raw = (y - last) / dt;
  last = y;
  // Touch scrolling reports in bursts: smooth harder so the skew never jitters.
  v += (raw - v) * damp(touch ? 5 : 9, dt);
  if (Math.abs(v) < 1) v = 0;
  for (const it of items) {
    if (!it.on && !it.cur) continue;
    const target = it.on ? clamp((-v / 1000) * it.k, -it.max, it.max) : 0;
    const next = it.cur + (target - it.cur) * damp(it.rate, dt);
    const val = Math.abs(next) < 0.01 ? 0 : next;
    if (val === it.cur) continue;
    it.cur = val;
    it.set(val);
  }
}

export function initVelocity() {
  if (!motion || started) return;
  started = true;
  gsap.ticker.add(tick);
}

/**
 * Lean `el` with the scroll velocity. k: degrees per 1000 px/s, max: clamp (deg),
 * axis: 'skewY' (vertical type) or 'skewX' (horizontal tracks). The element's transform must be
 * GSAP-owned (it composes with any other GSAP tween on it); never a [data-depth] element.
 */
export function skew(el, { k = 2, max = 6, axis = 'skewY', rate = 8 } = {}) {
  if (!motion || !el || el._growSkew || el.hasAttribute('data-depth')) return;
  el._growSkew = true;
  const it = { el, k: touch ? k * 0.6 : k, max, rate, on: false, cur: 0, set: gsap.quickSetter(el, axis, 'deg') };
  items.push(it);
  io ??= new IntersectionObserver((entries) => {
    for (const e of entries) for (const i of items) if (i.el === e.target) i.on = e.isIntersecting;
  }, { rootMargin: '15% 0px' });
  io.observe(el);
}
