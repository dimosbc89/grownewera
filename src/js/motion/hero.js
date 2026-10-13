// Hero: the intro (starts on `grow:ready`, fires `grow:hero-in` once the copy has landed), layered
// scroll parallax for the hero [data-depth] layers, and the title's exit.
//   Intro: grid lines draw up behind the lifting preloader/curtain columns, the title rises char by
//   char with a slight 3D rotateX, the eyebrow decodes (scramble), crumbs, subtitle, buttons (wiped
//   in), trust strip and scroll cue cascade after it.
//   Scroll: depth layers lag in proportion to their depth (stage, grid, title, sub, buttons; the
//   trust strip runs ahead as the foreground); as the hero leaves the copy fades and the title
//   lingers while it compresses towards its top edge, leaning and squashing a little more under a
//   fast scroll, then easing back (velocity-aware, frame-rate independent).
// Depth layers move through the CSS `translate` property (see motion.css): hero.js writes --sy,
// pointer.js writes --px / --py. GSAP folds `translate` into its transform and writes
// `translate: none` on any element it tweens, so no tween here ever targets a [data-depth] element:
// the title animates its chars and an inner `.hero__title-in` wrapper, the copy animates inside
// `.hero__layer` wrappers, and the hero canvas fades in by CSS (three.css).
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { root, motion, touch, $, $$, clamp, damp } from './util.js';
import { split } from './split.js';
import { onReady } from './preloader.js';
import { EASE } from './ease.js';
import { scramble } from './scramble.js';
import { velocity } from './velocity.js';

const SCROLL_DEPTH = 0.35; // a depth-1 layer lags by 35% of the hero height at the end of the hero
const TRUST_DEPTH = -0.14; // the trust strip is the foreground: it runs slightly ahead

export function initHero() {
  const hero = $('[data-hero]');
  if (!hero || hero._growInit) return;
  hero._growInit = true;
  if (!motion) return;

  const wasLoading = root.classList.contains('is-loading');
  const curtain = root.classList.contains('curtain-in');
  const title = $('[data-split="hero"]', hero);
  let titleIn = null;
  let chars = [];
  if (title) {
    // The h1 carries [data-depth]: the exit transform goes on an inner wrapper.
    titleIn = document.createElement('span');
    titleIn.className = 'hero__title-in';
    titleIn.append(...title.childNodes);
    title.append(titleIn);
    chars = split(title, { mode: 'chars' });
  }
  const trust = $('.trust', hero);
  if (trust && !trust.hasAttribute('data-depth')) trust.dataset.depth = String(TRUST_DEPTH);

  const ins = $$('[data-hero-in]', hero);
  const eyebrow = ins.find((el) => el.matches('.eyebrow'));
  const cta = $('.hero__cta', hero);
  const btns = cta ? $$('.btn', cta) : [];
  const crumbs = $$('.crumbs li', hero);
  const foot = $('.hero__foot', hero);
  const trustTrack = trust ? $('.marquee__track', trust) : null;
  const grid = $('.hero__grid', hero);
  const lines = grid ? [...grid.children] : [];

  // Hidden until the intro (CSS covers chars, [data-hero-in] and the grid before first paint).
  // y: 0 drops the CSS pre-paint offset (translateY(118%)), which GSAP would otherwise read as px.
  if (chars.length) gsap.set(chars, { y: 0, yPercent: 118, rotateX: -62, opacity: 0, transformPerspective: 640, transformOrigin: '50% 100%' });
  if (crumbs.length) gsap.set(crumbs, { opacity: 0, x: -10 });
  if (foot) gsap.set(foot, { opacity: 0 });
  if (trustTrack) gsap.set(trustTrack, { yPercent: 100, opacity: 0 });
  if (btns.length) gsap.set(btns, { clipPath: 'inset(0% 100% 0% 0%)' });
  // Under the preloader / arrival curtain the header bar drops in with the copy.
  const headerBar = wasLoading || curtain ? $('.site-header__bar') : null;
  if (headerBar) gsap.set(headerBar, { yPercent: -100, opacity: 0 });

  onReady(() => {
    const tl = gsap.timeline({ delay: wasLoading ? 0.1 : curtain ? 0.34 : 0.06 });
    if (lines.length) tl.to(lines, { scaleY: 1, duration: 1.3, ease: EASE.inOut, stagger: 0.07 }, 0);
    if (headerBar) tl.to(headerBar, { yPercent: 0, opacity: 1, duration: 1, ease: EASE.expo, clearProps: 'transform,opacity' }, 0.4);
    const each = chars.length ? Math.min(0.026, 1.05 / chars.length) : 0;
    const charsEnd = chars.length ? 0.05 + each * (chars.length - 1) : 0;
    if (chars.length) {
      tl.to(chars, { yPercent: 0, rotateX: 0, opacity: 1, duration: 1.15, ease: EASE.expo, stagger: each }, 0.05);
      tl.add(() => title.classList.add('is-in'), charsEnd + 1.15);
    }
    if (crumbs.length) tl.to(crumbs, { opacity: 1, x: 0, duration: 0.7, ease: EASE.out, stagger: 0.06 }, 0.1);
    if (eyebrow) {
      tl.to(eyebrow, { opacity: 1, y: 0, duration: 0.8, ease: EASE.out }, 0.12);
      tl.add(() => scramble(eyebrow, { duration: 900 }), 0.12);
    }
    // Sub, buttons and meta cascade in as the title lands.
    const rest = ins.filter((el) => el !== eyebrow);
    const at = chars.length ? Math.max(0.35, charsEnd - 0.25) : 0.25;
    if (rest.length) tl.to(rest, { opacity: 1, y: 0, duration: 0.95, ease: EASE.out, stagger: 0.11 }, at);
    const ctaAt = at + 0.11 * Math.max(0, rest.indexOf(cta));
    if (btns.length) {
      tl.to(btns, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.85, ease: EASE.inOut, stagger: 0.1, clearProps: 'clipPath' }, ctaAt + 0.05);
    }
    if (trustTrack) tl.to(trustTrack, { yPercent: 0, opacity: 1, duration: 0.9, ease: EASE.out }, ctaAt + 0.2);
    if (foot) tl.to(foot, { opacity: 1, duration: 0.8, ease: 'power1.out' }, ctaAt + 0.3);
    // `grow:hero-in`: every line is ~95% in place (expo out), so the WebGL layer can start its
    // heavy setup (context, environment map, shader compile) without stalling the intro.
    const landed = Math.max(charsEnd + 0.5, rest.length ? at + 0.11 * (rest.length - 1) + 0.45 : 0);
    tl.call(() => dispatchEvent(new CustomEvent('grow:hero-in')), null, landed);
  });

  // Copy fades as the hero leaves (opacity only: the layers inside carry the depth).
  const inner = $('.hero__inner', hero);
  if (inner) gsap.to(inner, { opacity: 0.12, ease: 'power1.in', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });

  // Depth layers lag behind the scroll in proportion to their depth.
  const layers = $$('[data-depth]', hero)
    .filter((el) => !el.closest('.ill'))
    .map((el) => ({ el, d: parseFloat(el.dataset.depth) || 0 }));
  let H = hero.offsetHeight;
  const st = ScrollTrigger.create({
    trigger: hero,
    start: 'top top',
    end: 'bottom top',
    onRefresh: (self) => { H = hero.offsetHeight; apply(self.progress); },
    onUpdate: (self) => apply(self.progress),
  });
  function apply(p) {
    for (const { el, d } of layers) el.style.setProperty('--sy', `${(p * d * H * SCROLL_DEPTH).toFixed(1)}px`);
  }

  // Title exit: compress to the top edge, linger, lean with the velocity; eased every frame.
  if (!titleIn) return;
  gsap.set(titleIn, { transformOrigin: '0% 0%' });
  const setS = gsap.quickSetter(titleIn, 'scaleY');
  const setY = gsap.quickSetter(titleIn, 'y', 'px');
  const setK = gsap.quickSetter(titleIn, 'skewY', 'deg');
  const cur = { s: 1, y: 0, k: 0 };
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);
  const lean = touch ? 0.5 : 1;
  gsap.ticker.add((time, dtMs) => {
    if (!visible && cur.s === 1 && !cur.k) return;
    const dt = Math.min((dtMs || 16.7) / 1000, 0.1);
    const p = st.progress;
    const v = visible ? velocity() : 0;
    // The title lingers (lags the scroll a little more than its depth layer) while it folds
    // towards its top edge; a fast scroll squashes it a touch further.
    const ts = 1 - 0.42 * p - Math.min(Math.abs(v) / 14000, 0.07) * lean;
    const ty = p * H * 0.1;
    const tk = clamp(-v / 1400, -2.6, 2.6) * lean;
    const k = damp(10, dt);
    const s = cur.s + (ts - cur.s) * k;
    const y = cur.y + (ty - cur.y) * k;
    const sk = cur.k + (tk - cur.k) * damp(7, dt);
    if (Math.abs(s - cur.s) < 1e-4 && Math.abs(y - cur.y) < 0.05 && Math.abs(sk - cur.k) < 1e-3) return;
    cur.s = Math.abs(s - 1) < 1e-4 ? 1 : s;
    cur.y = y;
    cur.k = Math.abs(sk) < 1e-3 ? 0 : sk;
    setS(cur.s); setY(cur.y); setK(cur.k);
  });
}
