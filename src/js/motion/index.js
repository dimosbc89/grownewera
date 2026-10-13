// initMotion(): runs every motion module in a fixed order and returns { lenis, scrollTo }.
// Order matters: smooth scroll before anything that creates ScrollTriggers, transitions early (the
// arrival curtain is on screen), the preloader before the hero (which waits for `grow:ready`), the
// hero before pointer.js (it may add the trust strip's depth), pins after reveals so pin spacing is
// known, and settle() last to refresh once everything exists. Safe to call twice: the second call
// returns the first result (every module also guards its own elements).
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
  initReveals();
  initPin();
  initMarquees();
  initPointer();
  initUi();
  settle();
  return booted;
}
