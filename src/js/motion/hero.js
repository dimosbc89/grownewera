// Hero intro timeline (starts on `grow:ready`, fires `grow:hero-in` once the copy has landed) +
// layered scroll parallax for hero [data-depth] layers. Depth layers move through the CSS
// `translate` property (see motion.css): hero.js writes --sy, pointer.js writes --px / --py.
// GSAP folds `translate` into its transform and writes `translate: none` on any element it tweens,
// so no tween here ever targets a [data-depth] element (the copy sits in `.hero__layer` wrappers,
// and the hero canvas fades in by CSS once its first frame is drawn, see three.css).
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { root, motion, $, $$ } from './util.js';
import { split } from './split.js';
import { onReady } from './preloader.js';

const SCROLL_DEPTH = 0.35; // a depth-1 layer lags by 35% of the hero height at the end of the hero

export function initHero() {
  const hero = $('[data-hero]');
  if (!hero) return;
  const title = $('[data-split="hero"]', hero);
  const words = title ? split(title) : [];
  if (!motion) return;

  const ins = $$('[data-hero-in]', hero);
  onReady(() => {
    const tl = gsap.timeline({ delay: root.classList.contains('curtain-in') ? 0.45 : 0.15 });
    const W = { duration: 1.1, stagger: 0.045 };
    const I = { duration: 0.9, stagger: 0.08, at: words.length ? Math.max(0, W.duration + W.stagger * (words.length - 1) - 0.8) : 0 };
    if (words.length) tl.to(words, { y: 0, duration: W.duration, ease: 'expo.out', stagger: W.stagger }, 0);
    if (ins.length) tl.to(ins, { opacity: 1, y: 0, duration: I.duration, ease: 'expo.out', stagger: I.stagger }, I.at);
    const grid = $('.hero__grid', hero);
    if (grid?.children.length) tl.to(grid.children, { scaleY: 1, duration: 1.4, ease: 'expo.inOut', stagger: 0.08 }, 0);
    // `grow:hero-in`: every line is ~95% in place (expo.out), so the WebGL layer can start its
    // heavy setup (context, environment map, shader compile) without stalling the intro.
    const landed = Math.max(
      words.length ? W.stagger * (words.length - 1) + 0.5 : 0,
      ins.length ? I.at + I.stagger * (ins.length - 1) + 0.45 : 0,
    );
    tl.call(() => dispatchEvent(new CustomEvent('grow:hero-in')), null, landed);
  });

  // Copy fades and lifts as the hero leaves.
  const inner = $('.hero__inner', hero);
  if (inner) {
    gsap.to(inner, { yPercent: -12, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
  }

  // Depth layers lag behind the scroll in proportion to their depth.
  const layers = $$('[data-depth]', hero)
    .filter((el) => !el.closest('.ill'))
    .map((el) => ({ el, d: parseFloat(el.dataset.depth) || 0 }));
  if (!layers.length) return;
  let H = hero.offsetHeight;
  ScrollTrigger.create({
    trigger: hero,
    start: 'top top',
    end: 'bottom top',
    onRefresh: (self) => { H = hero.offsetHeight; apply(self.progress); },
    onUpdate: (self) => apply(self.progress),
  });
  function apply(p) {
    for (const { el, d } of layers) el.style.setProperty('--sy', `${(p * d * H * SCROLL_DEPTH).toFixed(1)}px`);
  }
}
