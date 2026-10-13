// UI behaviour: FAQ accordion, filters (+ Flip), counters, legal TOC, [data-scramble] labels,
// [data-strike] negatives.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion, finePointer, $, $$ } from './util.js';
import { refresh } from './smooth.js';

export function initUi() {
  initFaq();
  initFilters();
  initCounters();
  initToc();
  initScramble();
  initStrike();
}

// ---------- FAQ accordion with eased height ----------
function initFaq() {
  for (const d of $$('.faq__item')) {
    const summary = $('summary', d);
    const body = $('.faq__a', d);
    if (!summary || !body) continue;
    summary.addEventListener('click', (e) => {
      if (!motion) return;
      e.preventDefault();
      if (d.open) {
        gsap.to(body, { height: 0, opacity: 0, duration: 0.45, ease: 'power3.inOut', onComplete: () => { d.open = false; gsap.set(body, { clearProps: 'all' }); refresh(); } });
      } else {
        d.open = true;
        gsap.from(body, { height: 0, opacity: 0, duration: 0.6, ease: 'expo.out', clearProps: 'all', onComplete: () => refresh() });
      }
    });
  }
}

// ---------- Filters (projects, articles) with Flip ----------
// gsap/Flip is only fetched on pages that have a filter bar.
let Flip = null;
function initFilters() {
  const bars = $$('[data-filters]');
  if (!bars.length) return;
  if (motion) import('gsap/Flip').then((m) => { Flip = m.Flip; gsap.registerPlugin(Flip); }).catch(() => {});
  const stem = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').map((w) => w.slice(0, 6)).join(' ');
  for (const bar of bars) {
    const list = bar.parentElement.querySelector('[data-filter-list]');
    if (!list) continue;
    const state = {};
    const apply = () => {
      const cards = [...list.children];
      const flip = motion && Flip ? Flip.getState(cards, { props: 'opacity' }) : null;
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
        empty.textContent = 'Δεν υπάρχουν ακόμη έργα σε αυτή την κατηγορία.';
        list.after(empty);
      } else if (shown && empty) empty.remove();
      if (!flip) return refresh();
      Flip.from(flip, {
        duration: 0.7,
        ease: 'expo.inOut',
        absolute: true,
        stagger: 0.04,
        onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 0.6, ease: 'expo.out', delay: 0.15 }),
        onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.92, duration: 0.4, ease: 'power2.in' }),
        onComplete: () => refresh(),
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
    const raw = el.dataset.count;
    const m = raw.match(/[\d.,]+/);
    if (!m) continue;
    const target = parseFloat(m[0].replace(',', '.'));
    const decimals = (m[0].split(/[.,]/)[1] || '').length;
    const obj = { v: 0 };
    gsap.to(obj, {
      v: target, duration: 1.8, ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      onUpdate: () => (el.textContent = raw.replace(m[0], obj.v.toFixed(decimals).replace('.', ','))),
    });
  }
}

// ---------- Legal TOC ----------
function initToc() {
  const links = $$('.legal__toc a');
  for (const a of links) {
    let target = null;
    try { target = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1))); } catch {}
    if (!target) continue;
    ScrollTrigger.create({ trigger: target, start: 'top 40%', end: 'bottom 40%', onToggle: (s) => s.isActive && links.forEach((l) => l.classList.toggle('is-current', l === a)) });
  }
}

// ---------- [data-scramble] ----------
// Mono labels decode from random glyphs when they first appear and when their card/column is
// hovered. Only plain-text labels are touched; the final text is always restored exactly.
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=<>/_';
const KEEP = /[\s/·.:,–-]/;
export function scramble(el, { duration = 650 } = {}) {
  if (!motion || el.children.length) return;
  const final = (el.dataset.scrambleText ??= el.textContent);
  const chars = Array.from(final);
  cancelAnimationFrame(el._scrambleRaf);
  const t0 = performance.now();
  let lastSwap = 0;
  const tick = (now) => {
    const t = Math.min(1, (now - t0) / duration);
    if (t < 1 && now - lastSwap < 40) { el._scrambleRaf = requestAnimationFrame(tick); return; }
    lastSwap = now;
    const fixed = Math.floor(t * chars.length);
    el.textContent = t >= 1 ? final : chars.map((ch, i) => (i < fixed || KEEP.test(ch) ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join('');
    if (t < 1) el._scrambleRaf = requestAnimationFrame(tick);
  };
  el._scrambleRaf = requestAnimationFrame(tick);
}

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
// Negative points: a red rule draws across the item and the ✕ spins in.
function initStrike() {
  const els = $$('[data-strike]');
  if (!els.length) return;
  if (!motion) { els.forEach((el) => el.classList.add('is-struck')); return; }
  ScrollTrigger.batch(els, {
    start: 'top 82%',
    once: true,
    onEnter: (batch) => batch.forEach((el, i) => gsap.delayedCall(i * 0.12, () => el.classList.add('is-struck'))),
  });
}
