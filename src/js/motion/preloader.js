// First-visit preloader, one orchestrated moment that hands over to the hero intro:
//   1. the GROW. wordmark rises letter by letter while the mono counter runs 000 -> 100
//   2. a lime block wipes across the wordmark and takes it away
//   3. the black screen lifts as four columns on the hero's grid lines (lime leading edges),
//      left to right; `grow:ready` fires as they start, so the hero title rises through the gaps.
// Runs at most once per session. The cover starts lifting ~1.3s after navigation start and is gone
// by ~2.4s; a late script load compresses the show instead of extending it. Fires `grow:ready` on
// window when it lifts or is skipped (use onReady() inside the motion layer).
import { gsap } from 'gsap';
import { root, motion, $, makeColumns } from './util.js';
import { lenis } from './smooth.js';
import { EASE } from './ease.js';
import { scramble } from './scramble.js';

const KEY = 'grow-preloaded';
const MAX_MS = 2500;
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

// GROW<i>.</i> -> one masked unit per letter (the lime dot stays one unit).
function splitWord(word) {
  const units = [];
  const wrap = (content) => {
    const c = document.createElement('span');
    c.className = 'pl-c';
    const inner = document.createElement('span');
    inner.className = 'pl-c-in';
    c.append(inner);
    units.push(inner);
    return [c, inner];
  };
  for (const node of [...word.childNodes]) {
    if (node.nodeType === 3) {
      const frag = document.createDocumentFragment();
      for (const ch of Array.from(node.textContent)) {
        if (!ch.trim()) continue;
        const [c, inner] = wrap();
        inner.textContent = ch;
        frag.append(c);
      }
      node.replaceWith(frag);
    } else {
      const [c, inner] = wrap();
      node.replaceWith(c);
      inner.append(node);
    }
  }
  return units;
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
  if (el._growInit) return;
  el._growInit = true;
  try { sessionStorage.setItem(KEY, '1'); } catch {}
  lenis?.stop();
  el.style.animation = 'none'; // the CSS failsafe is for a script that never takes over

  const count = $('[data-preloader-count]', el);
  const fill = $('.preloader__bar i', el);
  const bar = $('.preloader__bar', el);
  const word = $('.preloader__word', el);
  const foot = $('.preloader__foot', el);
  const tag = $('.preloader__tag', el);
  const mid = $('.preloader__mid', el);

  const colsHost = document.createElement('div');
  colsHost.className = 'preloader__cols';
  el.prepend(colsHost);
  const cols = makeColumns(colsHost, 'preloader__col');
  el.classList.add('has-cols');
  const letters = word ? splitWord(word) : [];
  word?.classList.add('is-split');
  const wipe = document.createElement('i');
  wipe.className = 'preloader__wipe';
  wipe.setAttribute('aria-hidden', 'true');
  word?.append(wipe);

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
  const release = () => { fire(); lenis?.start(); };

  gsap.set(letters, { yPercent: 105, rotateX: -70, transformPerspective: 500, transformOrigin: '50% 100%' });
  const tl = gsap.timeline({ onComplete: finish });
  tl.to(letters, { yPercent: 0, rotateX: 0, duration: 0.75, ease: EASE.expo, stagger: 0.055 }, 0.02)
    .add(() => scramble(tag, { duration: 700 }), 0.05)
    .to(state, {
      p: 100,
      duration: 1.0,
      ease: 'power2.inOut',
      onUpdate: () => {
        if (count) count.textContent = String(Math.round(state.p)).padStart(3, '0');
        if (fill) fill.style.transform = `scaleX(${(state.p / 100).toFixed(3)})`;
      },
    }, 0)
    // Wordmark wipe: a lime block covers the letters, they go, the block leaves to the right.
    .fromTo(wipe, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 0.3, ease: EASE.inOut }, 0.95)
    .set(letters, { opacity: 0 }, 1.25)
    .set(wipe, { transformOrigin: '100% 50%' }, 1.25)
    .to(wipe, { scaleX: 0, duration: 0.3, ease: EASE.inOut }, 1.25)
    .to(foot, { opacity: 0, y: 12, duration: 0.35, ease: EASE.in }, 1.05)
    .to(bar, { scaleX: 0, transformOrigin: '100% 50%', duration: 0.4, ease: EASE.inOut }, 1.05)
    // The lift: the hero intro starts with it.
    .add(() => { el.classList.add('is-lifting'); release(); }, 1.27)
    .set(mid, { opacity: 0 }, 1.56)
    .to(cols, { yPercent: -100, duration: 0.9, ease: EASE.lift, stagger: 0.07 }, 1.27);

  // The budget counts from navigation start, so a slow script load shortens the show instead of
  // extending it. Hard cap via setTimeout: background tabs throttle rAF.
  const left = Math.max(0, MAX_MS - performance.now());
  if (left < 600) {
    tl.kill();
    fire();
    lenis?.start();
    gsap.to(el, { opacity: 0, duration: 0.3, onComplete: finish });
    return;
  }
  if (left < tl.duration() * 1000) tl.timeScale(Math.min(3, (tl.duration() * 1000) / Math.max(left, 1)));
  setTimeout(() => { if (!done) { tl.kill(); finish(); } }, left + 150);
}
