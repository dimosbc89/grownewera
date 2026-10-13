// First-visit preloader (black screen, GROW wordmark, mono % counter). Runs at most once per
// session and never holds the page for more than ~1.8s. Fires `grow:ready` on window when it
// finishes or is skipped; the hero intro waits for that (use onReady() inside the motion layer).
import { gsap } from 'gsap';
import { root, motion, $ } from './util.js';
import { lenis } from './smooth.js';

const KEY = 'grow-preloaded';
const MAX_MS = 1800;
let fired = false;

export const isReady = () => fired;
export function onReady(fn) {
  if (fired) fn();
  else addEventListener('grow:ready', () => fn(), { once: true });
}
function fire() {
  if (fired) return;
  fired = true;
  dispatchEvent(new CustomEvent('grow:ready'));
}

export function initPreloader() {
  const el = $('.preloader');
  const active = motion && el && root.classList.contains('is-loading');
  if (!active) {
    root.classList.remove('is-loading');
    el?.remove();
    // Async so every module (and the WebGL layer) has subscribed before it fires.
    queueMicrotask(fire);
    return;
  }
  try { sessionStorage.setItem(KEY, '1'); } catch {}
  lenis?.stop();

  const count = $('[data-preloader-count]', el);
  const fill = $('.preloader__bar i', el);
  const word = $('.preloader__word', el);
  const state = { p: 0 };
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    fire();
    root.classList.remove('is-loading');
    el.remove();
    lenis?.start();
  };

  const tl = gsap.timeline({ onComplete: finish });
  tl.fromTo(word, { yPercent: 110 }, { yPercent: 0, duration: 0.55, ease: 'expo.out' }, 0)
    .to(state, {
      p: 100,
      duration: 0.95,
      ease: 'power2.inOut',
      onUpdate: () => {
        count.textContent = String(Math.round(state.p)).padStart(3, '0');
        fill.style.transform = `scaleX(${(state.p / 100).toFixed(3)})`;
      },
    }, 0)
    .add(fire, 0.98) // the hero intro overlaps the exit
    .to(word, { yPercent: -110, duration: 0.45, ease: 'expo.in' }, 0.98)
    .to(el, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.65, ease: 'expo.inOut' }, 1.05);

  // The budget counts from navigation start, so a slow script load shortens the show instead of
  // extending it. Hard cap via setTimeout: background tabs throttle rAF.
  const left = Math.max(0, MAX_MS - performance.now());
  if (left < 450) {
    tl.kill();
    fire();
    gsap.to(el, { opacity: 0, duration: 0.3, onComplete: finish });
    return;
  }
  if (left < tl.duration() * 1000) tl.timeScale(Math.min(3, (tl.duration() * 1000) / Math.max(left, 1)));
  setTimeout(() => { if (!done) { tl.kill(); finish(); } }, left + 120);
}
