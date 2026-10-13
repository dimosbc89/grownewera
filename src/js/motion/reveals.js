// Scroll reveals:
//   [data-split] titles     rise line by line out of a mask, leaning (skewX) with the scroll
//                           velocity of the moment they enter, then settle upright
//   [data-reveal]           fade-up, batched
//   [data-stagger] grids    card grids (.card / .stat children) flip in in 3D, ordered by row and
//                           column, and their columns drift at slightly different speeds while the
//                           grid crosses the viewport (aligned at mid-screen); other lists fade up
//   [data-scrub]            lead paragraph lights up word by word (opacity) while scrolling
//   [data-parallax]         scroll parallax; .sec-bgnum numerals also wipe in, drift sideways and
//                           lean with the scroll velocity
//   [data-clip]             brutalist block wipe: a lime block sweeps in, then off, uncovering it
//   [data-cta]              the band grows out of a small lime square (clip-path, scrubbed), then
//                           its copy rises; .is-open once it is mostly open (the 3D wordmark shows)
//   [data-footer-word]      the footer wordmark rises letter by letter out of the floor (scrubbed)
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion, touch, busy, $, $$, clamp } from './util.js';
import { split, lines } from './split.js';
import { EASE } from './ease.js';
import { velocity, skew } from './velocity.js';

const DRIFT = 34; // px offset per column step at the viewport edges

export function initReveals() {
  initIllustrations();
  if (!motion) return;
  initTitles();
  // A jump (hash link, End key, scrollbar drag) can enter dozens at once: the ones already above
  // the screen show at once, the visible ones share a short stagger.
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 90%',
    once: true,
    onEnter: (els) => {
      const past = els.filter((el) => el.getBoundingClientRect().bottom < 0);
      const vis = els.filter((el) => !past.includes(el));
      if (past.length) gsap.set(past, { opacity: 1, y: 0 });
      if (vis.length) gsap.to(vis, { opacity: 1, y: 0, duration: 1, ease: EASE.out, stagger: Math.min(0.08, 0.6 / vis.length) });
    },
  });
  initGroups();
  initScrub();
  initParallax();
  initNumerals();
  initClips();
  initCta();
  initFooterWord();
}

// ---------- Titles: lines out of a mask, leaning with the scroll velocity ----------
function revealTitle(t, units, { delay = 0 } = {}) {
  const rows = lines(units);
  const v = velocity();
  const lean = (v >= 0 ? -1 : 1) * (4 + Math.min(Math.abs(v) / 380, 9)) * (touch ? 0.6 : 1);
  const tl = gsap.timeline({ delay, onComplete: () => t.classList.add('is-in') });
  rows.forEach((row, i) => {
    tl.fromTo(row, { yPercent: 112, y: 0, skewX: lean }, { yPercent: 0, skewX: 0, duration: 1.15, ease: EASE.expo, stagger: 0.025 }, i * 0.085);
  });
  return tl;
}

function initTitles() {
  for (const t of $$('[data-split]:not([data-split="hero"])')) {
    if (t._growInit) continue;
    t._growInit = true;
    const units = split(t);
    if (!units.length) continue;
    const cta = t.closest('[data-cta]');
    ScrollTrigger.create({
      trigger: cta ?? t,
      start: cta ? 'top 38%' : 'top 88%',
      once: true,
      onEnter: () => revealTitle(t, units, { delay: cta ? 0.05 : 0 }),
    });
  }
}

// ---------- [data-stagger]: 3D flip-in card grids with column drift, fade-up lists ----------
function initGroups() {
  for (const g of $$('[data-stagger]')) {
    if (g._growInit || !g.children.length) continue;
    g._growInit = true;
    const items = [...g.children];
    const cards = items.every((el) => el.matches('.card, .stat'));
    if (g.hasAttribute('data-stack')) {
      // Opacity only: pin.js owns the stacking cards' transforms (scale, tilt, hold).
      gsap.to(items, { opacity: 1, duration: 1, ease: EASE.out, stagger: 0.075, scrollTrigger: { trigger: g, start: 'top 88%', once: true } });
      continue;
    }
    if (!cards) {
      gsap.to(items, { opacity: 1, y: 0, duration: 1, ease: EASE.out, stagger: 0.075, scrollTrigger: { trigger: g, start: 'top 88%', once: true } });
      continue;
    }
    ScrollTrigger.create({ trigger: g, start: 'top 86%', once: true, onEnter: () => flipIn(items) });
    if (g.matches('.grid')) drift(g, items);
  }
}

// Order by row, then column (layout read once, at the moment the grid enters).
function order(items) {
  const lefts = items.map((el) => el.offsetLeft);
  const tops = items.map((el) => el.offsetTop);
  const cols = [...new Set(lefts)].sort((a, b) => a - b);
  const rows = [...new Set(tops)].sort((a, b) => a - b);
  return items.map((_, i) => ({ col: cols.indexOf(lefts[i]), row: rows.indexOf(tops[i]) }));
}

export function flipIn(items, { delay = 0 } = {}) {
  const pos = order(items);
  items.forEach((el) => busy.add(el));
  return gsap.fromTo(items, {
    opacity: 0, y: touch ? 40 : 80, rotationX: touch ? -16 : -42, transformPerspective: 1400, transformOrigin: '50% 0%',
  }, {
    opacity: 1, y: 0, rotationX: 0, duration: 1.25, ease: EASE.expo,
    delay: (i) => delay + pos[i].row * 0.13 + pos[i].col * 0.085,
    onComplete() { items.forEach((el) => busy.delete(el)); },
  });
}

// Columns drift at different speeds (yPercent: the reveal owns `y`): offset ±DRIFT per column step
// from the middle column at the viewport edges, zero (a clean grid) when the grid is mid-screen.
function drift(g, items) {
  const set = items.map((el) => gsap.quickSetter(el, 'yPercent'));
  let cols = [];
  let hs = [];
  let n = 1;
  let dirty = false;
  const measure = () => {
    const lefts = items.map((el) => el.offsetLeft);
    const uniq = [...new Set(lefts)].sort((a, b) => a - b);
    cols = lefts.map((l) => uniq.indexOf(l));
    hs = items.map((el) => el.offsetHeight || 1);
    n = uniq.length;
  };
  const update = (p) => {
    if (n < 2) {
      if (dirty) { set.forEach((s) => s(0)); dirty = false; }
      return;
    }
    const k = (0.5 - p) * 2;
    const amp = DRIFT * (touch ? 0.5 : 1);
    items.forEach((el, i) => set[i]((((cols[i] - (n - 1) / 2) * amp * k) / hs[i]) * 100));
    dirty = true;
  };
  ScrollTrigger.create({
    trigger: g,
    start: 'top bottom',
    end: 'bottom top',
    onRefresh: (self) => { measure(); update(self.progress); },
    onUpdate: (self) => update(self.progress),
  });
}

// ---------- [data-scrub] lead ----------
function initScrub() {
  for (const lead of $$('[data-scrub]')) {
    if (lead._growInit) continue;
    lead._growInit = true;
    const words = split(lead).map((w) => w.parentElement);
    if (!words.length) continue;
    gsap.fromTo(words, { opacity: 0.16 }, {
      opacity: 1, stagger: 0.12, ease: 'none',
      scrollTrigger: { trigger: lead, start: 'top 82%', end: 'bottom 48%', scrub: 0.4 },
    });
  }
}

// ---------- [data-parallax] ----------
// k = speed (-1..1) as a share of the element's own height. Elements inside the horizontal reel
// move with the reel instead.
function initParallax() {
  for (const el of $$('[data-parallax]')) {
    if (el.closest('[data-hscroll]') || el._growPar) continue;
    el._growPar = true;
    const k = parseFloat(el.dataset.parallax) || 0.15;
    gsap.fromTo(el, { yPercent: -k * 100 }, { yPercent: k * 100, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  }
}

// ---------- .sec-bgnum: wipe up, drift sideways, lean with the velocity ----------
function initNumerals() {
  for (const n of $$('.sec-bgnum')) {
    if (n._growInit) continue;
    n._growInit = true;
    const sec = n.closest('.sec') ?? n.parentElement;
    gsap.fromTo(n, { opacity: 0, clipPath: 'inset(100% 0% 0% 0%)' }, {
      opacity: 1, clipPath: 'inset(0% 0% 0% 0%)', duration: 1.6, ease: EASE.inOut,
      scrollTrigger: { trigger: sec, start: 'top 78%', once: true },
      onComplete: () => gsap.set(n, { clearProps: 'clipPath' }),
    });
    if (n.closest('[data-hscroll]')) continue; // rides the reel (motion/pin.js)
    const dir = parseFloat(n.dataset.parallax) < 0 ? -1 : 1;
    gsap.fromTo(n, { xPercent: 7 * dir }, { xPercent: -7 * dir, ease: 'none', scrollTrigger: { trigger: n.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
    skew(n, { k: 2.2, max: 7, axis: 'skewY' });
  }
}

// ---------- [data-clip]: lime block wipe ----------
// Illustrations inside start their own build as the wipe runs: IntersectionObserver counts the
// clip, so under a brisk scroll the observer alone could miss them and leave their layers hidden.
function initClips() {
  for (const el of $$('[data-clip]')) {
    if (el._growInit) continue;
    el._growInit = true;
    const ills = el.matches('.ill') ? [el] : $$('.ill', el);
    const cover = document.createElement('i');
    cover.className = 'clip-cover';
    cover.setAttribute('aria-hidden', 'true');
    el.append(cover);
    const tl = gsap.timeline({ paused: true });
    tl.fromTo(el, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.75, ease: EASE.inOut }, 0)
      .add(() => ills.forEach(showIll), 0.3)
      .fromTo(cover, { scaleX: 1 }, { scaleX: 0, transformOrigin: '100% 50%', duration: 0.8, ease: EASE.inOut, immediateRender: false }, 0.68)
      .add(() => { gsap.set(el, { clearProps: 'clipPath' }); el.classList.add('is-clipped'); cover.remove(); });
    gsap.set(el, { clipPath: 'inset(0% 100% 0% 0%)' });
    ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => tl.play() });
  }
}

// ---------- [data-cta]: the band grows out of a lime square ----------
function initCta() {
  for (const cta of $$('[data-cta]')) {
    if (cta._growInit) continue;
    cta._growInit = true;
    const square = () => {
      const W = cta.offsetWidth;
      const H = cta.offsetHeight;
      const s = clamp(W * 0.12, 72, 150);
      const top = clamp(H * 0.08, 24, 72);
      const side = (W - s) / 2;
      return `inset(${top}px ${side.toFixed(1)}px ${(H - top - s).toFixed(1)}px ${side.toFixed(1)}px)`;
    };
    // .is-open once the square has grown into most of the band: the 3D wordmark (three.css) only
    // shows from then on, so its letters never drop through the small square.
    gsap.fromTo(cta, { clipPath: square }, {
      clipPath: 'inset(0px 0px 0px 0px)', ease: 'power2.inOut',
      scrollTrigger: { trigger: cta, start: 'top 86%', end: 'top 20%', scrub: 0.6, invalidateOnRefresh: true },
      onUpdate() { cta.classList.toggle('is-open', this.progress() > 0.6); },
    });
    const bg = $('.cta__bg span', cta);
    if (bg) skew(bg, { k: 2, max: 6, axis: 'skewX' });
    const inner = $('.cta__inner', cta);
    if (!inner) continue;
    const parts = [...inner.children].filter((el) => !el.matches('[data-split]'));
    if (parts.length) gsap.fromTo(parts, { y: 60, opacity: 0 }, {
      y: 0, opacity: 1, duration: 1.1, ease: EASE.out, stagger: 0.09,
      scrollTrigger: { trigger: cta, start: 'top 38%', once: true },
    });
  }
}

// ---------- [data-footer-word]: letters rise out of the floor ----------
function initFooterWord() {
  const word = $('[data-footer-word]');
  if (!word || word._growInit) return;
  word._growInit = true;
  const units = [];
  const unit = () => {
    const c = document.createElement('span');
    c.className = 'fw-c';
    units.push(c);
    return c;
  };
  for (const node of [...word.childNodes]) {
    if (node.nodeType === 3) {
      const frag = document.createDocumentFragment();
      for (const ch of Array.from(node.textContent)) if (ch.trim()) { const c = unit(); c.textContent = ch; frag.append(c); }
      node.replaceWith(frag);
    } else {
      const c = unit();
      node.replaceWith(c);
      c.append(node);
    }
  }
  gsap.fromTo(units, { yPercent: 104 }, {
    yPercent: 0, ease: 'none', stagger: 0.1,
    scrollTrigger: { trigger: word.parentElement, start: 'top bottom', end: 'bottom bottom', scrub: 0.8 },
  });
  skew(word, { k: 1.6, max: 5, axis: 'skewX' });
}

// SVG product shots play their CSS animation once visible: 30% in view (or 30% of the viewport
// for tall ones), or already scrolled past when a fast scroll skipped that moment, so they are
// never left hidden. ([data-clip] wrappers also start them when their wipe starts, see above.)
let illObserver = null;
function showIll(el) {
  el.classList.add('is-in');
  illObserver?.unobserve(el);
}
function initIllustrations() {
  const ills = $$('.ill');
  if (!motion || !('IntersectionObserver' in window)) { ills.forEach((el) => el.classList.add('is-in')); return; }
  illObserver ??= new IntersectionObserver((entries) => {
    for (const e of entries) {
      const r = e.boundingClientRect;
      const top = e.rootBounds?.top ?? 0;
      const past = r.bottom <= top; // scrolled by above the viewport between two observations
      const enough = e.intersectionRatio >= 0.3 || e.intersectionRect.height >= innerHeight * 0.3;
      if (enough || past) showIll(e.target);
    }
  }, { threshold: [0, 0.1, 0.2, 0.3] });
  ills.forEach((el) => illObserver.observe(el));
  // A fast scroll can carry one from below the screen to above it between two observations (no
  // intersection change is reported then): when the scroll settles, show any that were passed.
  ScrollTrigger.addEventListener('scrollEnd', () => {
    for (const el of ills) if (!el.classList.contains('is-in') && el.getBoundingClientRect().top < innerHeight * 0.7) showIll(el);
  });
}
