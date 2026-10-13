// Hero intro timeline (starts on `grow:ready`) + layered scroll parallax for hero [data-depth]
// layers. Depth layers move through the CSS `translate` property (see motion.css), so they never
// fight GSAP tweens on `transform`: hero.js writes --sy, pointer.js writes --px / --py.
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

  const stage = $('.hero__stage', hero);
  const ins = $$('[data-hero-in]', hero);
  onReady(() => {
    const tl = gsap.timeline({ delay: root.classList.contains('curtain-in') ? 0.45 : 0.15 });
    if (words.length) tl.to(words, { y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.045 });
    if (ins.length) tl.to(ins, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.08 }, words.length ? '-=0.8' : 0);
    if (stage) tl.from(stage, { opacity: 0, scale: 1.08, duration: 1.8, ease: 'power2.out' }, 0);
    const grid = $('.hero__grid', hero);
    if (grid?.children.length) tl.to(grid.children, { scaleY: 1, duration: 1.4, ease: 'expo.inOut', stagger: 0.08 }, 0);
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
