// Pinned and progress-driven sections: the horizontal services reel ([data-hscroll]), step
// timelines ([data-steps]), scroll stories ([data-story] -> `grow:story` on the story canvas),
// sticky stacking cards ([data-stack]) and pinned statements ([data-pin-statement]).
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion, $, $$, headerH, pad, clamp } from './util.js';

export function initPin() {
  initHScroll();
  initSteps();
  initStories();
  initStacks();
  initStatements();
}

// ---------- Horizontal pinned reel ----------
function initHScroll() {
  const mm = gsap.matchMedia();
  mm.add('(min-width: 761px) and (prefers-reduced-motion: no-preference)', () => {
    for (const hs of $$('[data-hscroll]')) {
      const track = $('.hscroll__track', hs);
      const dist = () => track.scrollWidth - innerWidth;
      const tween = gsap.to(track, {
        x: () => -dist(),
        ease: 'none',
        scrollTrigger: { trigger: hs, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1 },
      });
      for (const card of $$('.card--panel', track)) {
        gsap.from(card, {
          rotateY: -18, z: -120, opacity: 0.35, transformPerspective: 1200, ease: 'none',
          scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left right', end: 'left 55%', scrub: true },
        });
      }
      const num = $('.sec-bgnum', track);
      if (num) gsap.to(num, { xPercent: 40, ease: 'none', scrollTrigger: { trigger: num.parentElement, containerAnimation: tween, start: 'left left', end: 'right left', scrub: true } });
    }
  });
}

// ---------- Step timelines ----------
function initSteps() {
  for (const list of $$('[data-steps]')) {
    const line = $('.steps__line span', list);
    const steps = $$('.step', list);
    if (!motion) { steps.forEach((s) => s.classList.add('is-active')); continue; }
    if (line) gsap.to(line, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: list, start: 'top 65%', end: 'bottom 65%', scrub: true } });
    for (const s of steps) {
      ScrollTrigger.create({ trigger: s, start: 'top 65%', onEnter: () => s.classList.add('is-active'), onLeaveBack: () => s.classList.remove('is-active') });
    }
  }
}

// ---------- Scroll stories ----------
// Progress runs over the same range as the step line (list top/bottom at 65% of the viewport).
// `step` is the last step whose top has crossed that line. Also dispatched without motion (the
// WebGL layer then renders one still frame per change).
function initStories() {
  for (const story of $$('[data-story]')) {
    const list = $('[data-steps]', story);
    const canvas = $('canvas[data-scene="story"]', story);
    if (!list) continue;
    const steps = $$('.step', list);
    const n = steps.length;
    const count = $('[data-story-step]', story);
    let marks = steps.map((_, i) => i / n);
    let last = { step: -1, progress: -1 };
    const send = (progress) => {
      progress = clamp(progress);
      let step = 0;
      for (let i = 0; i < n; i++) if (progress + 1e-4 >= marks[i]) step = i;
      if (Math.abs(progress - last.progress) < 1e-4 && step === last.step) return;
      if (step !== last.step && count) count.textContent = pad(step + 1);
      story.style.setProperty('--story', progress.toFixed(4));
      last = { step, progress };
      canvas?.dispatchEvent(new CustomEvent('grow:story', { detail: { progress, step, steps: n, set: story.dataset.story } }));
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
      onUpdate: (self) => send(self.progress),
    });
    // The WebGL module loads lazily: replay the current state when it says it is listening.
    canvas?.addEventListener('grow:story-listen', () => { const p = last.progress; last = { step: -1, progress: -1 }; send(Math.max(p, 0)); });
  }
}

// ---------- Sticky stacking cards ----------
const STACK_SCALE = 0.92; // a covered card shrinks to this (from its top edge)
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
      // card back, since each card's visible bottom depends on its own cut.
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
      cards.forEach((card, i) => {
        const next = cards[i + 1];
        if (!next) return;
        const st = { trigger: next, start: 'top bottom', end: () => `top ${tops[i + 1] ?? 0}px`, scrub: true };
        gsap.to(card, { scale: STACK_SCALE, transformOrigin: '50% 0%', ease: 'none', scrollTrigger: st });
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
// Desktop: the section pins while its paragraphs take turns (past ones dim, the current one is
// full white). Phones / tall sections: each paragraph lights up as it crosses the middle.
function initStatements() {
  const secs = $$('[data-pin-statement]');
  if (!secs.length || !motion) return;
  const mm = gsap.matchMedia();
  mm.add({ wide: '(min-width: 900px)', narrow: '(max-width: 899.98px)' }, (c) => {
    for (const sec of secs) {
      const items = $$('.sec-body > p, .sec-body > ol > li, .sec-body > ul > li', sec);
      if (items.length < 2) continue;
      sec.classList.add('is-statement');
      const body = $('.sec-body', sec) ?? sec;
      const fits = body.offsetHeight <= innerHeight - headerH() - 64;
      if (c.conditions.wide && fits) {
        gsap.set(items, { opacity: (i) => (i ? 0.14 : 1) });
        // Centre the copy in the viewport while pinned (section padding may fall off-screen).
        const tl = gsap.timeline({
          defaults: { ease: 'none', duration: 1 },
          scrollTrigger: { trigger: body, start: 'center 55%', end: () => `+=${items.length * 55}%`, pin: sec, scrub: 0.6, anticipatePin: 1 },
        });
        items.forEach((it, i) => {
          if (!i) return;
          tl.to(items[i - 1], { opacity: 0.34 }, i - 1).fromTo(it, { opacity: 0.14, y: 14 }, { opacity: 1, y: 0 }, i - 1);
        });
        tl.to({}, { duration: 0.6 }); // hold the last line before releasing the pin
      } else {
        for (const it of items) {
          gsap.fromTo(it, { opacity: 0.16 }, { opacity: 1, ease: 'none', scrollTrigger: { trigger: it, start: 'top 82%', end: 'top 52%', scrub: true } });
        }
      }
    }
    return () => secs.forEach((s) => s.classList.remove('is-statement'));
  });
}
