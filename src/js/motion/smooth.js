// Lenis smooth scrolling + ScrollTrigger glue. `lenis` is a live binding (null without motion).
// settle() runs once every module has created its triggers, then keeps the trigger positions true
// while the page settles: fonts, images, WebGL canvases drawing their first frame and any change
// in the page height (FAQ, filters, a WebGL fallback swapping in its CSS chart) end in one
// debounced, idle-time ScrollTrigger.refresh().
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion, headerH, $$ } from './util.js';

gsap.registerPlugin(ScrollTrigger);
// Mobile browsers resize the viewport as their toolbars show/hide: do not refresh on that.
ScrollTrigger.config({ ignoreMobileResize: true });

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

// Settling work (late fonts, canvases, height changes) waits for a quiet moment.
let soon = 0;
export function refreshSoon(ms = 180) {
  clearTimeout(soon);
  soon = setTimeout(() => {
    if ('requestIdleCallback' in window) requestIdleCallback(() => refresh(), { timeout: 400 });
    else refresh();
  }, ms);
}

let settled = false;
// Called once every module has created its triggers. Pins were created per module, not in page
// order, so sort them by position first: each trigger then accounts for the pin spacing above it.
export function settle() {
  if (settled) return;
  settled = true;
  ScrollTrigger.sort();
  ScrollTrigger.refresh();
  if (location.hash && location.hash.length > 1) setTimeout(() => scrollTo(location.hash, { force: true }), 400);
  document.fonts?.ready.then(() => refresh());
  document.fonts?.addEventListener?.('loadingdone', () => refreshSoon());
  addEventListener('load', () => refresh(), { once: true });
  for (const img of document.images) if (!img.complete) img.addEventListener('load', () => refreshSoon(), { once: true });
  watchCanvases();
  watchHeight();
}

// A WebGL canvas drawing its first frame (data-ready) or falling back to its CSS stage.
function watchCanvases() {
  const canvases = $$('canvas[data-scene]');
  if (!canvases.length || !('MutationObserver' in window)) return;
  const mo = new MutationObserver((list) => {
    for (const m of list) if (m.attributeName === 'data-ready') { refreshSoon(); mo.disconnect(); mo.takeRecords(); watchRest(); return; }
  });
  // One refresh for the first canvas, one more once every canvas has settled.
  const watchRest = () => {
    const left = canvases.filter((c) => c.isConnected && !c.dataset.ready);
    if (!left.length) return;
    const rest = new MutationObserver(() => {
      if (left.every((c) => !c.isConnected || c.dataset.ready)) { rest.disconnect(); refreshSoon(); }
    });
    left.forEach((c) => rest.observe(c, { attributes: true, attributeFilter: ['data-ready'] }));
  };
  canvases.forEach((c) => mo.observe(c, { attributes: true, attributeFilter: ['data-ready'] }));
}

// Any change of the document height after the last refresh (ignores the pin spacing a refresh adds).
function watchHeight() {
  if (!('ResizeObserver' in window)) return;
  let known = document.body.offsetHeight;
  ScrollTrigger.addEventListener('refresh', () => { known = document.body.offsetHeight; });
  new ResizeObserver((entries) => {
    const h = entries[0]?.borderBoxSize?.[0]?.blockSize ?? document.body.offsetHeight;
    if (Math.abs(h - known) > 2) { known = h; refreshSoon(240); }
  }).observe(document.body);
}
