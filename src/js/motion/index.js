// initMotion(): runs every motion module in a fixed order and returns { lenis, scrollTo }.
// Order matters: smooth scroll before anything that creates ScrollTriggers, transitions early (the
// arrival curtain is on screen), the preloader before the hero (which waits for `grow:ready`), the
// hero before pointer.js (it may add the trust strip's depth), pins after reveals so pin spacing is
// known, and settle() last to refresh once everything exists. Safe to call twice: the second call
// returns the first result (every module also guards its own elements).
//
// Boot in two phases, so the first screen never waits for the whole page's choreography:
//   now     smooth scroll, transitions, header, preloader, hero (what the first screen needs)
//   later   reveals, pins, marquees, pointer, UI, then settle(): below-the-fold work, one module per
//           task (the browser paints in between), started once the hero copy has landed
//           (`grow:hero-in`), at the visitor's first scroll / key / touch, when the page opens
//           scrolled (hash, restored position) or without the intro (reduced motion), else after
//           2.5s at the latest. Its content stays in the pre-reveal state until then.
import { initSmooth, scrollTo, settle } from './smooth.js';
import { initVelocity } from './velocity.js';
import { initHeader } from './header.js';
import { initPreloader } from './preloader.js';
import { initHero } from './hero.js';
import { initReveals } from './reveals.js';
import { initPin } from './pin.js';
import { initMarquees } from './marquee.js';
import { initPointer } from './pointer.js';
import { initTransitions } from './transitions.js';
import { initUi } from './ui.js';
import { root, motion } from './util.js';
import './ease.js';

export { scrollTo };
export { split } from './split.js';
export { onReady } from './preloader.js';

let booted = null;

export function initMotion() {
  if (booted) return booted;
  const { lenis } = initSmooth();
  booted = { lenis, scrollTo };
  initVelocity();
  initTransitions();
  initHeader();
  initPreloader();
  initHero();
  later([initReveals, initPin, initMarquees, initPointer, initUi, settle]);
  return booted;
}

const INPUT = ['wheel', 'touchstart', 'keydown', 'pointerdown', 'scroll'];
const nextTask = (fn) => (window.scheduler?.postTask ? scheduler.postTask(fn, { priority: 'user-visible' }) : setTimeout(fn, 0));

function later(steps) {
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    INPUT.forEach((t) => removeEventListener(t, start, true));
    run(0);
  };
  const run = (i) => {
    if (i >= steps.length) return;
    try {
      steps[i]();
    } catch (e) {
      // Never leave content in its hidden pre-reveal state (as main.js does for the first phase).
      console.warn('[grow] motion failed', e);
      root.classList.remove('motion', 'curtain-in', 'is-loading');
      root.classList.add('no-motion', 'motion-failed');
      return;
    }
    nextTask(() => run(i + 1));
  };
  const intro = motion && document.querySelector('[data-hero] [data-split="hero"]');
  if (!intro || location.hash.length > 1 || scrollY > 0) { nextTask(start); return; }
  addEventListener('grow:hero-in', start, { once: true });
  INPUT.forEach((t) => addEventListener(t, start, { capture: true, passive: true, once: true }));
  addEventListener('grow:ready', () => setTimeout(start, 2500), { once: true });
  setTimeout(start, 6000);
}
