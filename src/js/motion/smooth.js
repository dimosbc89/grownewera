// Lenis smooth scrolling + ScrollTrigger glue. `lenis` is a live binding (null without motion).
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion, headerH } from './util.js';

gsap.registerPlugin(ScrollTrigger);

export let lenis = null;

export function initSmooth() {
  if (motion && !lenis) {
    lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  return { lenis, scrollTo };
}

// Resolve "#id" safely (ids like "#1a" are not valid CSS selectors).
const resolve = (target) => {
  if (typeof target !== 'string') return target;
  if (target.startsWith('#')) {
    try { return document.getElementById(decodeURIComponent(target.slice(1))); } catch { return null; }
  }
  try { return document.querySelector(target); } catch { return null; }
};

export function scrollTo(target, opts = {}) {
  const el = resolve(target);
  if (!el && typeof target !== 'number') return;
  if (lenis) lenis.scrollTo(el ?? target, { offset: -headerH() - 16, duration: 1.2, ...opts });
  else if (el) el.scrollIntoView({ behavior: motion ? 'smooth' : 'auto' });
  else window.scrollTo(0, target);
}

let queued = 0;
// Debounced ScrollTrigger.refresh(), for content that changes height (FAQ, filters, fonts).
export function refresh(now = false) {
  if (now) return ScrollTrigger.refresh();
  cancelAnimationFrame(queued);
  queued = requestAnimationFrame(() => ScrollTrigger.refresh());
}

// Called once every module has created its triggers. Pins were created per module, not in page
// order, so sort them by position first: each trigger then accounts for the pin spacing above it.
export function settle() {
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
  if (location.hash && location.hash.length > 1) setTimeout(() => scrollTo(location.hash), 400);
  document.fonts?.ready.then(() => refresh());
  addEventListener('load', () => refresh());
}
