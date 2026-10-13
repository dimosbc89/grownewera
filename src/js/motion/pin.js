// Pinned and progress-driven sections: the horizontal services reel ([data-hscroll]), step
// timelines ([data-steps]), scroll stories ([data-story] -> `grow:story` on the story canvas),
// sticky stacking cards ([data-stack]) and pinned statements ([data-pin-statement]).
// Pins (ScrollTrigger `pin`) only run with a fine pointer: on touch screens the reel becomes a
// native horizontal swipe (tablets; phones get the stacked list from sections.css) and statements
// light up paragraph by paragraph without pinning. CSS sticky (stacks, story aside) stays on all.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion, touch, busy, $, $$, headerH, pad, clamp } from './util.js';
import { EASE } from './ease.js';
import { skew } from './velocity.js';

const FINE = '(hover: hover) and (pointer: fine)';
const COARSE = '(hover: none), (pointer: coarse)';

export function initPin() {
  initHScroll();
  initSteps();
  initStories();
  initStacks();
  initStatements();
}

const hud = (cls, html) => {
  const el = document.createElement('div');
  el.className = cls;
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = html;
  return el;
};

// ---------- Horizontal pinned reel ----------
// Pinned on desktop: cards swing in (3D) as they enter, lean with the scroll velocity, and a HUD
// (card counter + progress rule) rides the bottom edge. Touch tablets swipe it natively.
function initHScroll() {
  const reels = $$('[data-hscroll]');
  if (!reels.length || !motion) return;
  const mm = gsap.matchMedia();
  mm.add(`(min-width: 761px) and ${FINE}`, () => {
    const undo = [];
    for (const hs of reels) {
      const track = $('.hscroll__track', hs);
      if (!track) continue;
      const cards = $$('.card--panel', track);
      const hint = $('.hscroll__hint', hs);
      const ui = hud('hscroll__hud', `<span class="hscroll__count"><b>01</b><span>/${pad(cards.length)}</span></span><span class="hscroll__bar"><i></i></span>`);
      hs.append(ui);
      const num = $('b', ui);
      const fill = $('.hscroll__bar i', ui);
      let marks = [];
      let cur = -1;
      const dist = () => track.scrollWidth - innerWidth;
      const update = (p) => {
        fill.style.transform = `scaleX(${p.toFixed(4)})`;
        let idx = 0;
        for (let i = 0; i < marks.length; i++) if (p >= marks[i]) idx = i;
        if (idx !== cur) {
          const dir = idx > cur ? 1 : -1;
          cur = idx;
          num.textContent = pad(idx + 1);
          gsap.fromTo(num, { yPercent: 70 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.45, ease: EASE.out, overwrite: true });
        }
        hint?.classList.toggle('is-gone', p > 0.03);
        ui.classList.toggle('is-on', p > 0.001 && p < 0.999);
      };
      const tween = gsap.to(track, {
        x: () => -dist(),
        ease: 'none',
        scrollTrigger: {
          trigger: hs, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1,
          // A card counts once its centre passes the middle of the screen.
          onRefresh: (self) => {
            const d = Math.max(1, dist());
            marks = cards.map((c) => clamp((c.offsetLeft + c.offsetWidth / 2 - innerWidth / 2) / d, 0, 1));
            update(self.progress);
          },
          onUpdate: (self) => update(self.progress),
        },
      });
      for (const card of cards) {
        gsap.from(card, {
          rotateY: -24, z: -160, opacity: 0.3, transformPerspective: 1200, transformOrigin: '0% 50%', ease: 'none',
          scrollTrigger: {
            trigger: card, containerAnimation: tween, start: 'left right', end: 'left 55%', scrub: true,
            // Pointer tilt waits until the card has swung in (both write rotations).
            onUpdate: (self) => (self.progress < 1 ? busy.add(card) : busy.delete(card)),
          },
        });
        skew(card, { k: 2.6, max: 7, axis: 'skewX' });
      }
      const bg = $('.sec-bgnum', track);
      if (bg) gsap.to(bg, { xPercent: 40, ease: 'none', scrollTrigger: { trigger: bg.parentElement, containerAnimation: tween, start: 'left left', end: 'right left', scrub: true } });
      undo.push(() => { ui.remove(); hint?.classList.remove('is-gone'); });
    }
    return () => undo.forEach((f) => f());
  });
  // Touch tablets: no pin, the reel scrolls sideways under the finger (snapping to cards).
  mm.add('(min-width: 761px) and (hover: none), (min-width: 761px) and (pointer: coarse)', () => {
    reels.forEach((hs) => hs.classList.add('is-swipe'));
    return () => reels.forEach((hs) => hs.classList.remove('is-swipe'));
  });
}

// ---------- Step timelines ----------
// One trigger per list: the rule draws over the list's pass across 65% of the viewport and a step
// is reached (.is-active) once its top crosses that line. Measured on the list, not on the steps:
// a step's own box is still offset by its fade-up reveal when the triggers are measured.
function initSteps() {
  for (const list of $$('[data-steps]')) {
    if (list._growInit) continue;
    list._growInit = true;
    const line = $('.steps__line span', list);
    const steps = $$('.step', list);
    if (!motion) { steps.forEach((s) => s.classList.add('is-active')); continue; }
    if (line) gsap.to(line, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: list, start: 'top 65%', end: 'bottom 65%', scrub: 0.3 } });
    let marks = steps.map(() => 0);
    const apply = (self) => {
      const reached = self.isActive || self.progress > 0;
      steps.forEach((s, i) => s.classList.toggle('is-active', reached && self.progress + 1e-4 >= marks[i]));
    };
    ScrollTrigger.create({
      trigger: list,
      start: 'top 65%',
      end: 'bottom 65%',
      onRefresh: (self) => { const h = list.offsetHeight || 1; marks = steps.map((s) => s.offsetTop / h); apply(self); },
      onUpdate: apply,
    });
  }
}

// ---------- Scroll stories ----------
// Progress runs over the same range as the step line (list top/bottom at 65% of the viewport).
// `step` is the last step whose top has crossed that line (marks are measured relative to the
// list, the steps' offset parent). One dispatch per frame at most, only when something changed;
// also dispatched without motion (the WebGL layer then renders one still frame per change).
// The current step is emphasised (.is-current), the HUD counter rolls and a progress rule fills.
function initStories() {
  for (const story of $$('[data-story]')) {
    if (story._growInit) continue;
    story._growInit = true;
    const list = $('[data-steps]', story);
    const canvas = $('canvas[data-scene="story"]', story);
    if (!list) continue;
    const steps = $$('.step', list);
    const n = steps.length;
    const count = $('[data-story-step]', story);
    const stage = $('.story__stage', story);
    // The markup's own progress rule (.story__bar, scaleX(var(--story))) wins; else add one.
    let fill = null;
    if (stage && motion && !$('.story__bar', stage)) {
      const bar = hud('story__progress', '<i></i>');
      stage.append(bar);
      fill = $('i', bar);
    }
    let marks = steps.map((_, i) => i / n);
    let last = { step: -1, progress: -1 };
    const send = (progress) => {
      progress = clamp(progress);
      let step = 0;
      for (let i = 0; i < n; i++) if (progress + 1e-4 >= marks[i]) step = i;
      if (Math.abs(progress - last.progress) < 1e-4 && step === last.step) return;
      if (step !== last.step) {
        steps.forEach((s, i) => s.classList.toggle('is-current', i === step));
        if (count) {
          count.textContent = pad(step + 1);
          if (motion && last.step >= 0) {
            const dir = step > last.step ? 1 : -1;
            gsap.fromTo(count, { yPercent: 80 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.5, ease: EASE.out, overwrite: true });
          }
        }
      }
      story.style.setProperty('--story', progress.toFixed(4));
      if (fill) fill.style.transform = `scaleX(${progress.toFixed(4)})`;
      last = { step, progress };
      canvas?.dispatchEvent(new CustomEvent('grow:story', { detail: { progress, step, steps: n, set: story.dataset.story } }));
    };
    let queued = null;
    const queue = (p) => {
      if (queued === null) requestAnimationFrame(() => { const q = queued; queued = null; send(q); });
      queued = p;
    };
    ScrollTrigger.create({
      trigger: list,
      start: 'top 65%',
      end: 'bottom 65%',
      onRefresh: (self) => {
        const h = list.offsetHeight || 1;
        marks = steps.map((s) => s.offsetTop / h);
        send(self.progress);
      },
      onUpdate: (self) => queue(self.progress),
    });
    // The WebGL module loads lazily: replay the current state when it says it is listening.
    canvas?.addEventListener('grow:story-listen', () => { const p = last.progress; last = { step: last.step, progress: -1 }; send(Math.max(p, 0)); });
  }
}

// ---------- Sticky stacking cards ----------
const STACK_SCALE = 0.92; // a covered card shrinks to this (from its top edge)
const STACK_TILT = -5; // ...and tilts back (deg, about its top edge)
function initStacks() {
  const grids = $$('[data-stack]');
  if (!grids.length) return;
  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    const cleanups = [];
    for (const grid of grids) {
      const cards = [...grid.children];
      if (cards.length < 2) continue;
      grid.classList.add('is-stacked');
      const shades = cards.map((card) => {
        const s = document.createElement('i');
        s.className = 'stack__shade';
        s.setAttribute('aria-hidden', 'true');
        card.append(s);
        return s;
      });
      // Sticky offsets: fan out a little, and let cards taller than the viewport scroll fully
      // into view before they stick (otherwise their bottom would never be visible).
      // Cuts: a card taller than the one that settles on it would show its lower body below it
      // (and through the gaps between the later cards), so as the next card settles, the covered
      // card's bottom is clipped back to the next card's settled bottom. Computed from the last
      // card back, since each card's visible bottom depends on its own cut. (The tilt-back only
      // shrinks a covered card further, so its cut edge stays hidden.)
      // Holds: at the end of the grid a sticky card leaves when its bottom meets the grid's
      // bottom, so a tall card would leave before the cards on top of it and slide its body out
      // above the stack. It is held in place (translated down by exactly the distance it is
      // pushed up) until the card on top of it leaves, so the stack departs top card first.
      const tops = [];
      const heights = [];
      const cuts = [];
      const holds = [];
      let padB = 0;
      const setTops = () => {
        const base = headerH() + 24;
        cards.forEach((c, i) => { heights[i] = c.offsetHeight; }); // read everything, then write
        padB = parseFloat(getComputedStyle(grid).paddingBottom) || 0;
        cards.forEach((c, i) => {
          tops[i] = Math.round(Math.min(base + i * 14, innerHeight - heights[i] - 24));
          c.style.top = `${tops[i]}px`;
        });
        let below = Infinity; // settled visible bottom (viewport px) of the card after i
        let leave = Infinity; // grid bottom (viewport px) at which the card after i leaves
        for (let i = cards.length - 1; i >= 0; i--) {
          const keep = Math.min(heights[i], (below - tops[i]) / STACK_SCALE);
          cuts[i] = Math.max(0, Math.floor(heights[i] - keep));
          below = tops[i] + (i === cards.length - 1 ? heights[i] : STACK_SCALE * keep);
          const natural = tops[i] + heights[i];
          holds[i] = Math.max(0, natural - leave);
          leave = Math.min(natural, leave);
        }
      };
      setTops();
      ScrollTrigger.addEventListener('refreshInit', setTops);
      // Negative insets keep the card's upward shadow; only the bottom edge is ever clipped.
      const clip = (px) => `inset(-120px -120px ${px}px -120px)`;
      const tilt = touch ? STACK_TILT * 0.5 : STACK_TILT;
      cards.forEach((card, i) => {
        const next = cards[i + 1];
        if (!next) return;
        const st = { trigger: next, start: 'top bottom', end: () => `top ${tops[i + 1] ?? 0}px`, scrub: true };
        gsap.to(card, { scale: STACK_SCALE, rotationX: tilt, transformPerspective: 1600, transformOrigin: '50% 0%', ease: 'none', scrollTrigger: st });
        gsap.to(shades[i], { opacity: 0.62, ease: 'none', scrollTrigger: { ...st } });
        // Two or more cards behind: darker still, so the fanned edges read as depth.
        const after = cards[i + 2];
        if (after) {
          gsap.fromTo(shades[i], { opacity: 0.62 }, {
            opacity: 0.86, ease: 'none', immediateRender: false,
            scrollTrigger: { trigger: after, start: 'top bottom', end: () => `top ${tops[i + 2] ?? 0}px`, scrub: true },
          });
        }
        // The cut starts once the next card's top has passed this card's bottom, so the receding
        // edge always stays at or below the incoming card's top edge.
        gsap.fromTo(card, { clipPath: clip(0) }, {
          clipPath: () => clip(cuts[i]),
          ease: 'none',
          immediateRender: false,
          scrollTrigger: {
            trigger: next,
            start: () => `top ${Math.round(Math.min(innerHeight, tops[i] + STACK_SCALE * heights[i]))}px`,
            end: () => `top ${tops[i + 1] ?? 0}px`,
            scrub: true,
            invalidateOnRefresh: true,
          },
        });
        // yPercent, not y: the grid's [data-stagger] reveal tweens `y` on the same cards.
        gsap.fromTo(card, { yPercent: 0 }, {
          yPercent: () => (holds[i] / (heights[i] || 1)) * 100,
          ease: 'none',
          immediateRender: false,
          scrollTrigger: {
            trigger: grid,
            start: () => `bottom ${tops[i] + heights[i] + padB}px`,
            end: () => `bottom ${tops[i] + heights[i] + padB - Math.max(1, holds[i])}px`,
            scrub: true,
            invalidateOnRefresh: true,
          },
        });
      });
      cleanups.push(() => {
        ScrollTrigger.removeEventListener('refreshInit', setTops);
        grid.classList.remove('is-stacked');
        shades.forEach((s) => s.remove());
        cards.forEach((c) => (c.style.top = ''));
      });
    }
    return () => cleanups.forEach((f) => f());
  });
}

// ---------- Pinned statements ----------
// Each paragraph's first sentence is its key phrase (wrapped in .stmt-key, text untouched).
// Desktop (fine pointer, copy fits the screen): the section pins while the paragraphs take turns:
// the current one is full white with its key phrase swept in lime, past ones dim back with their
// key phrase left lime, upcoming ones wait faint; a HUD by the heading counts 01/04 and fills a
// rule. Touch / small / tall: each paragraph lights up as it crosses the middle of the screen.
function keyPhrase(p) {
  if (p.querySelector('.stmt-key')) return;
  const first = [...p.childNodes].find((n) => n.nodeType === 3 && n.data.trim());
  if (!first || first !== p.firstChild) return;
  const m = first.data.match(/^[\s\S]*?[.:;!?](?=\s|$)/);
  if (!m || m[0].length > 140) return;
  first.splitText(m[0].length);
  const key = document.createElement('span');
  key.className = 'stmt-key';
  first.replaceWith(key);
  key.append(first);
}

function initStatements() {
  const secs = $$('[data-pin-statement]');
  if (!secs.length || !motion) return;
  const mm = gsap.matchMedia();
  mm.add({ pin: `(min-width: 900px) and ${FINE}`, plain: `(max-width: 899.98px), ${COARSE}` }, (c) => {
    const undo = [];
    for (const sec of secs) {
      const items = $$('.sec-body > p, .sec-body > ol > li, .sec-body > ul > li', sec);
      if (items.length < 2) continue;
      items.forEach((it) => it.matches('p') && keyPhrase(it));
      sec.classList.add('is-statement');
      const body = $('.sec-body', sec) ?? sec;
      const head = $('.sec-head', sec);
      const fits = body.offsetHeight <= innerHeight - headerH() - 64;
      let cur = -2;
      const setCurrent = (idx) => {
        if (idx === cur) return;
        cur = idx;
        items.forEach((it, i) => {
          it.classList.toggle('is-current', i === idx);
          it.classList.toggle('is-past', i < idx);
        });
      };
      if (c.conditions.pin && fits) {
        const ui = hud('stmt-hud', `<span class="stmt-hud__n"><b>01</b><span>/${pad(items.length)}</span></span><span class="stmt-hud__bar"><i></i></span>`);
        head?.append(ui);
        const num = $('b', ui);
        const fill = $('.stmt-hud__bar i', ui);
        gsap.set(items, { opacity: (i) => (i ? 0.14 : 1) });
        setCurrent(0);
        const tl = gsap.timeline({
          defaults: { ease: 'none', duration: 1 },
          scrollTrigger: {
            trigger: body, start: 'center 55%', end: () => `+=${items.length * 60}%`, pin: sec, scrub: 0.7, anticipatePin: 1,
            onUpdate: (self) => {
              fill.style.transform = `scaleX(${self.progress.toFixed(4)})`;
              // Paragraph i is current from its turn's midpoint (the hold at the end counts too).
              const t = self.progress * tl.duration();
              const idx = clamp(Math.floor(t + 0.5), 0, items.length - 1);
              if (idx !== cur) {
                const dir = idx > cur ? 1 : -1;
                setCurrent(idx);
                num.textContent = pad(idx + 1);
                gsap.fromTo(num, { yPercent: 70 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.45, ease: EASE.out, overwrite: true });
              }
            },
            onToggle: (self) => ui.classList.toggle('is-on', self.isActive),
          },
        });
        items.forEach((it, i) => {
          if (!i) return;
          tl.to(items[i - 1], { opacity: 0.3, y: -6 }, i - 1)
            .fromTo(it, { opacity: 0.14, y: 22 }, { opacity: 1, y: 0 }, i - 1);
        });
        tl.to({}, { duration: 0.6 }); // hold the last line before releasing the pin
        undo.push(() => ui.remove());
      } else {
        for (const [i, it] of items.entries()) {
          gsap.fromTo(it, { opacity: 0.16 }, { opacity: 1, ease: 'none', scrollTrigger: { trigger: it, start: 'top 82%', end: 'top 52%', scrub: true } });
          ScrollTrigger.create({
            trigger: it, start: 'top 55%', end: 'bottom 45%',
            onToggle: (self) => { if (self.isActive) setCurrent(i); else if (self.direction < 0 && i === cur) setCurrent(i - 1); },
          });
        }
      }
      undo.push(() => { setCurrent(-1); items.forEach((it) => it.classList.remove('is-current', 'is-past')); });
    }
    return () => { secs.forEach((s) => s.classList.remove('is-statement')); undo.forEach((f) => f()); };
  });
}
