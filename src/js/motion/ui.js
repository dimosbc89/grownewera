// UI behaviour: FAQ accordion, filters (+ Flip), counters, legal TOC (+ reading progress),
// [data-scramble] labels, [data-strike] negatives.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion, finePointer, $, $$ } from './util.js';
import { refresh } from './smooth.js';
import { EASE } from './ease.js';
import { flipIn } from './reveals.js';
import { scramble } from './scramble.js';

export { scramble };

let inited = false;
export function initUi() {
  if (inited) return;
  inited = true;
  initFaq();
  initFilters();
  initCounters();
  initToc();
  initScramble();
  initStrike();
}

// ---------- FAQ accordion: eased height, the answer's lines follow ----------
function initFaq() {
  for (const d of $$('.faq__item')) {
    const summary = $('summary', d);
    const body = $('.faq__a', d);
    if (!summary || !body) continue;
    summary.addEventListener('click', (e) => {
      if (!motion) return;
      e.preventDefault();
      gsap.killTweensOf(body);
      const kids = [...body.children];
      gsap.killTweensOf(kids);
      if (d.open && !d._closing) {
        d._closing = true;
        d.classList.remove('is-opening');
        gsap.to(body, {
          height: 0, opacity: 0, duration: 0.5, ease: EASE.inOut,
          onComplete: () => { d.open = false; d._closing = false; gsap.set(body, { clearProps: 'all' }); refresh(); },
        });
      } else {
        d._closing = false;
        d.open = true;
        d.classList.add('is-opening');
        gsap.fromTo(body, { height: 0, opacity: 0 }, {
          height: 'auto', opacity: 1, duration: 0.75, ease: EASE.out, clearProps: 'all',
          onComplete: () => { d.classList.remove('is-opening'); refresh(); },
        });
        // Ends on an explicit opacity: 1 (only the transform is cleared), so no stylesheet
        // pre-reveal state can hide the answer once it is open.
        gsap.fromTo(kids, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: EASE.out, stagger: 0.06, delay: 0.1, clearProps: 'transform' });
      }
    });
  }
}

// ---------- Filters (projects, articles) with Flip ----------
// gsap/Flip is only fetched on pages that have a filter bar. Cards leave by folding down, the
// rest slide to their new places in a stagger, newcomers flip in. Filter lists also get the 3D
// flip-in reveal of card grids (finished at once if a filter is used before it ran).
let Flip = null;
function initFilters() {
  const bars = $$('[data-filters]');
  if (!bars.length) return;
  if (motion) import('gsap/Flip').then((m) => { Flip = m.Flip; gsap.registerPlugin(Flip); }).catch(() => {});
  const stem = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').map((w) => w.slice(0, 6)).join(' ');
  for (const bar of bars) {
    const list = bar.parentElement.querySelector('[data-filter-list]');
    if (!list || bar._growInit) continue;
    bar._growInit = true;
    let reveal = null;
    let trigger = null;
    if (motion && list.children.length) {
      const cards = [...list.children];
      gsap.set(cards, { opacity: 0 });
      trigger = ScrollTrigger.create({
        trigger: list, start: 'top 88%', once: true,
        onEnter: () => { reveal = flipIn(cards.filter((c) => !c.classList.contains('is-hidden'))); },
      });
    }
    const state = {};
    const apply = () => {
      // A filter used before the grid revealed: show it as it is now, then animate the change.
      if (trigger) { trigger.kill(); trigger = null; }
      if (reveal) { reveal.progress(1); reveal = null; }
      const cards = [...list.children];
      gsap.set(cards, { opacity: 1, y: 0, rotationX: 0 });
      const flip = motion && Flip ? Flip.getState(cards, { props: 'opacity' }) : null;
      const before = flip ? list.offsetHeight : 0;
      let shown = 0;
      for (const card of cards) {
        const okType = !state.type || state.type === '*' || card.dataset.type === '*' || card.dataset.type === state.type;
        const okSvc = !state.service || state.service === '*' || stem(card.dataset.service ?? '').includes(stem(state.service));
        const show = okType && okSvc;
        card.classList.toggle('is-hidden', !show);
        if (show) shown++;
      }
      let empty = list.parentElement.querySelector('.filters__empty');
      if (!shown && !empty) {
        empty = document.createElement('p');
        empty.className = 'filters__empty';
        empty.setAttribute('role', 'status');
        empty.textContent = list.dataset.empty || 'Δεν υπάρχουν ακόμη έργα σε αυτή την κατηγορία.';
        list.after(empty);
        if (motion) gsap.from(empty, { opacity: 0, y: 12, duration: 0.6, ease: EASE.out, delay: 0.3 });
      } else if (shown && empty) empty.remove();
      if (!flip) return refresh();
      // `absolute` lifts the cards out of the flow while they move: hold the list's height (the
      // larger of before/after) so the page below does not jump up and back.
      list.style.minHeight = `${Math.max(before, list.offsetHeight)}px`;
      Flip.from(flip, {
        duration: 0.8,
        ease: EASE.inOut,
        absolute: true,
        stagger: { each: 0.035, from: 'start' },
        onEnter: (els) => gsap.fromTo(els, { opacity: 0, y: 40, rotationX: -30, transformPerspective: 1200, transformOrigin: '50% 0%' }, { opacity: 1, y: 0, rotationX: 0, duration: 0.8, ease: EASE.expo, delay: 0.2, stagger: 0.05 }),
        onLeave: (els) => gsap.to(els, { opacity: 0, y: 30, rotationX: 24, transformPerspective: 1200, transformOrigin: '50% 100%', duration: 0.42, ease: EASE.in }),
        onComplete: () => { list.style.minHeight = ''; refresh(); },
      });
    };
    bar.addEventListener('click', (e) => {
      const chip = e.target instanceof Element && e.target.closest('.chip');
      if (!chip) return;
      for (const c of bar.querySelectorAll(`.chip[data-key="${chip.dataset.key}"]`)) {
        c.classList.toggle('is-active', c === chip);
        c.setAttribute('aria-pressed', String(c === chip));
      }
      state[chip.dataset.key] = chip.dataset.value;
      apply();
    });
  }
}

// ---------- Counters ----------
function initCounters() {
  if (!motion) return;
  for (const el of $$('[data-count]')) {
    if (el._growInit) continue;
    el._growInit = true;
    const raw = el.dataset.count;
    const m = raw.match(/[\d.,]+/);
    if (!m) continue;
    // Greek figures group thousands with dots and use a decimal comma: "25.653", "1.063.821", "2,5".
    const grouped = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(m[0]);
    const plain = grouped ? m[0].replace(/\./g, '').replace(',', '.') : m[0].replace(',', '.');
    const target = parseFloat(plain);
    const decimals = (plain.split('.')[1] || '').length;
    const group = (s) => (grouped ? s.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : s);
    const obj = { v: 0 };
    const render = () => {
      const [int, dec] = obj.v.toFixed(decimals).split('.');
      el.textContent = raw.replace(m[0], group(int) + (dec ? `,${dec}` : ''));
    };
    render();
    gsap.to(obj, {
      v: target, duration: 1.8, ease: EASE.expo,
      scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      onUpdate: render,
      onComplete: () => { el.textContent = raw; el.classList.add('is-counted'); },
    });
  }
}

// ---------- Legal TOC: current section + reading progress rule ----------
function initToc() {
  const toc = $('.legal__toc');
  const links = $$('.legal__toc a');
  if (!toc || !links.length) return;
  const targets = [];
  for (const a of links) {
    let target = null;
    try { target = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1))); } catch {}
    if (!target) continue;
    targets.push(target);
    ScrollTrigger.create({ trigger: target, start: 'top 40%', end: 'bottom 40%', onToggle: (s) => s.isActive && links.forEach((l) => l.classList.toggle('is-current', l === a)) });
  }
  if (!motion || !targets.length) return;
  const bar = document.createElement('span');
  bar.className = 'toc__progress';
  bar.setAttribute('aria-hidden', 'true');
  bar.innerHTML = '<i></i>';
  toc.prepend(bar);
  const content = targets[0].closest('.prose') ?? targets[0].parentElement;
  gsap.fromTo($('i', bar), { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: content, start: 'top 40%', end: 'bottom 60%', scrub: 0.3 } });
}

// ---------- [data-scramble] ----------
// Mono labels decode from random glyphs when they first appear and when their card/column is
// hovered. Only text nodes change; the final text is always restored exactly.
function initScramble() {
  const els = $$('[data-scramble]');
  if (!motion || !els.length) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      scramble(e.target);
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  els.forEach((el) => io.observe(el));
  if (!finePointer) return;
  for (const el of els) {
    const host = el.closest('.card, .mega__col, .mega__tile, .field, .sec-head, .legal__toc') ?? el;
    host.addEventListener('pointerenter', () => scramble(el, { duration: 450 }));
  }
}

// ---------- [data-strike] ----------
// Negative points: the ✕ draws stroke by stroke in red, then a red rule draws across the item.
function initStrike() {
  const els = $$('[data-strike]');
  if (!els.length) return;
  if (!motion) { els.forEach((el) => el.classList.add('is-struck')); return; }
  ScrollTrigger.batch(els, {
    start: 'top 82%',
    once: true,
    onEnter: (batch) => batch.forEach((el, i) => gsap.delayedCall(i * 0.14, () => el.classList.add('is-struck'))),
  });
}
