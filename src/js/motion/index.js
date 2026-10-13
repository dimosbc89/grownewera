// initMotion(): runs every motion module in a fixed order and returns { lenis, scrollTo }.
// Order matters: transitions first (curtain), smooth scroll before anything that creates
// ScrollTriggers, the preloader before the hero (which waits for `grow:ready`), pins after
// reveals so pin spacing is known, and settle() last to refresh once everything exists.
import { initSmooth, scrollTo, settle } from './smooth.js';
import { initHeader } from './header.js';
import { initPreloader } from './preloader.js';
import { initHero } from './hero.js';
import { initReveals } from './reveals.js';
import { initPin } from './pin.js';
import { initMarquees } from './marquee.js';
import { initPointer } from './pointer.js';
import { initTransitions } from './transitions.js';
import { initUi } from './ui.js';

export { scrollTo };
export { split } from './split.js';
export { onReady } from './preloader.js';

export function initMotion() {
  const { lenis } = initSmooth();
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
  return { lenis, scrollTo };
}
