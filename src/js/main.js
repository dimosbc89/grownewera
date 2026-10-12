import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initForm } from './form.js';
import { initCookies } from './cookies.js';

gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;
const motion = root.classList.contains('motion');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const headerH = () => $('[data-header]')?.offsetHeight ?? 72;

// ---------- Smooth scroll ----------
let lenis = null;
if (motion) {
  lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
const scrollTo = (target) => {
  if (lenis) lenis.scrollTo(target, { offset: -headerH() - 16, duration: 1.2 });
  else (typeof target === 'string' ? $(target) : target)?.scrollIntoView({ behavior: 'smooth' });
};

// ---------- Word splitting (keeps links / marks intact) ----------
function split(el) {
  if (el.dataset.splitDone) return [];
  el.dataset.splitDone = '1';
  const words = [];
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) {
        const parts = child.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        for (const p of parts) {
          if (!p) continue;
          if (/^\s+$/.test(p)) { frag.append(' '); continue; }
          const w = document.createElement('span');
          w.className = 'w';
          const inner = document.createElement('span');
          inner.className = 'w-in';
          inner.textContent = p;
          w.append(inner);
          frag.append(w);
          words.push(inner);
        }
        child.replaceWith(frag);
      } else if (child.nodeType === 1 && !child.classList.contains('w')) {
        if (child.matches('mark, a') && el.dataset.split !== undefined) {
          // Treat inline elements as one word so they don't break mid-element.
          const w = document.createElement('span');
          w.className = 'w';
          const inner = document.createElement('span');
          inner.className = 'w-in';
          child.replaceWith(w);
          inner.append(child);
          w.append(inner);
          words.push(inner);
        } else walk(child);
      }
    }
  };
  walk(el);
  return words;
}

// ---------- Header, progress, menus ----------
function initHeader() {
  const header = $('[data-header]');
  const bar = $('[data-progress]');
  let last = 0;
  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle('is-top', y < 10);
    const menuOpen = header.querySelector('[aria-expanded="true"]');
    header.classList.toggle('is-hidden', y > 240 && y > last && !menuOpen);
    last = y;
    const max = document.documentElement.scrollHeight - innerHeight;
    if (bar) bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Mega menus
  const toggles = $$('.has-mega > button');
  const close = (btn) => {
    btn.setAttribute('aria-expanded', 'false');
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    panel.classList.remove('is-open');
    setTimeout(() => btn.getAttribute('aria-expanded') === 'false' && (panel.hidden = true), 500);
  };
  const open = (btn) => {
    toggles.forEach((b) => b !== btn && close(b));
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => panel.classList.add('is-open'));
  };
  for (const btn of toggles) {
    const li = btn.parentElement;
    btn.addEventListener('click', () => (btn.getAttribute('aria-expanded') === 'true' ? close(btn) : open(btn)));
    if (finePointer) {
      let t;
      li.addEventListener('pointerenter', () => { clearTimeout(t); t = setTimeout(() => open(btn), 80); });
      li.addEventListener('pointerleave', () => { clearTimeout(t); t = setTimeout(() => close(btn), 220); });
    }
    li.addEventListener('focusout', (e) => !li.contains(e.relatedTarget) && close(btn));
  }
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const openBtn = toggles.find((b) => b.getAttribute('aria-expanded') === 'true');
    if (openBtn) { close(openBtn); openBtn.focus(); }
    if (mToggle?.getAttribute('aria-expanded') === 'true') setMobile(false);
  });

  // Mobile menu
  const mToggle = $('.menu-toggle');
  const mnav = $('#mnav');
  const setMobile = (on) => {
    mToggle.setAttribute('aria-expanded', String(on));
    mToggle.querySelector('.menu-toggle__label').textContent = on ? 'Κλείσιμο' : 'Μενού';
    if (on) { mnav.hidden = false; requestAnimationFrame(() => mnav.classList.add('is-open')); lenis?.stop(); document.body.style.overflow = 'hidden'; }
    else { mnav.classList.remove('is-open'); setTimeout(() => mToggle.getAttribute('aria-expanded') === 'false' && (mnav.hidden = true), 600); lenis?.start(); document.body.style.overflow = ''; }
  };
  mToggle?.addEventListener('click', () => setMobile(mToggle.getAttribute('aria-expanded') !== 'true'));
}

// ---------- Hero intro ----------
function initHero() {
  const hero = $('[data-hero]');
  if (!hero) return;
  const title = $('[data-split="hero"]', hero);
  const words = title ? split(title) : [];
  if (!motion) return;
  const tl = gsap.timeline({ delay: root.classList.contains('curtain-in') ? 0.45 : 0.15 });
  tl.to(words, { y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.045 })
    .to($$('[data-hero-in]', hero), { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.08 }, '-=0.8');
  const stage = $('.hero__stage', hero);
  if (stage) {
    tl.from(stage, { opacity: 0, scale: 1.08, duration: 1.8, ease: 'power2.out' }, 0);
    gsap.to(stage, { yPercent: 18, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
  }
  gsap.to($('.hero__inner', hero), { yPercent: -12, opacity: 0.2, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
}

// ---------- Scroll reveals ----------
function initReveals() {
  const titles = $$('[data-split]:not([data-split="hero"])');
  titles.forEach((t) => split(t));
  if (!motion) return;

  for (const t of titles) {
    gsap.to($$('.w-in', t), { y: 0, duration: 1, ease: 'expo.out', stagger: 0.04, scrollTrigger: { trigger: t, start: 'top 88%', once: true } });
  }
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 90%',
    once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.08 }),
  });
  for (const g of $$('[data-stagger]')) {
    gsap.to(g.children, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: g, start: 'top 88%', once: true } });
  }

  // Lead paragraph lights up word by word as it scrolls through.
  for (const lead of $$('[data-scrub]')) {
    const words = split(lead).map((w) => w.parentElement);
    gsap.to(words, { color: '#ffffff', stagger: 0.1, ease: 'none', scrollTrigger: { trigger: lead, start: 'top 82%', end: 'bottom 45%', scrub: true } });
  }

  for (const el of $$('[data-parallax]')) {
    const k = parseFloat(el.dataset.parallax) || 0.15;
    gsap.fromTo(el, { yPercent: -k * 100 }, { yPercent: k * 100, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  }

  // Footer wordmark rises out of the floor.
  const word = $('[data-footer-word]');
  if (word) gsap.from(word, { yPercent: 60, scaleY: 0.6, ease: 'none', scrollTrigger: { trigger: word.parentElement, start: 'top bottom', end: 'bottom bottom', scrub: true } });

  // CTA band: title scale + background text drift.
  for (const cta of $$('[data-cta]')) {
    gsap.from($('.cta__inner', cta), { y: 80, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: cta, start: 'top 75%', once: true } });
  }
}

// ---------- Illustrations: play when visible ----------
function initIllustrations() {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }, { threshold: 0.3 });
  $$('.ill').forEach((el) => (motion ? io.observe(el) : el.classList.add('is-in')));
}

// ---------- Marquees (velocity-reactive) ----------
function initMarquees() {
  for (const m of $$('[data-marquee]')) {
    const track = $('.marquee__track', m);
    const speed = parseFloat(m.dataset.marquee) || 1;
    if (!motion) continue;
    const tween = gsap.to(track, { xPercent: -50, ease: 'none', duration: 38 / speed, repeat: -1 });
    let dir = 1;
    ScrollTrigger.create({
      trigger: m, start: 'top bottom', end: 'bottom top',
      onUpdate: (self) => {
        const v = self.getVelocity();
        if (v) dir = v > 0 ? 1 : -1;
        const boost = Math.min(Math.abs(v) / 300, 6);
        gsap.to(tween, { timeScale: dir * (1 + boost), duration: 0.2, overwrite: true });
        gsap.to(tween, { timeScale: dir, duration: 1, delay: 0.2 });
      },
    });
  }
}

// ---------- Horizontal pinned scroll ----------
function initHScroll() {
  const mm = gsap.matchMedia();
  mm.add('(min-width: 761px) and (prefers-reduced-motion: no-preference)', () => {
    for (const hs of $$('[data-hscroll]')) {
      const track = $('.hscroll__track', hs);
      const dist = () => track.scrollWidth - innerWidth;
      const tween = gsap.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: { trigger: hs, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1 },
      });
      for (const card of $$('.card--panel', track)) {
        gsap.from(card, {
          rotateY: -18, z: -120, opacity: 0.35, transformPerspective: 1200, ease: 'none',
          scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left right', end: 'left 55%', scrub: true },
        });
      }
    }
  });
}

// ---------- Steps timeline ----------
function initSteps() {
  for (const list of $$('[data-steps]')) {
    const line = $('.steps__line span', list);
    const steps = $$('.step', list);
    if (!motion) { steps.forEach((s) => s.classList.add('is-active')); continue; }
    gsap.to(line, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: list, start: 'top 65%', end: 'bottom 65%', scrub: true } });
    for (const s of steps) ScrollTrigger.create({ trigger: s, start: 'top 65%', onEnter: () => s.classList.add('is-active'), onLeaveBack: () => s.classList.remove('is-active') });
  }
}

// ---------- Counters ----------
function initCounters() {
  for (const el of $$('[data-count]')) {
    const raw = el.dataset.count;
    const m = raw.match(/[\d.,]+/);
    if (!m || !motion) continue;
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

// ---------- FAQ accordion with eased height ----------
function initFaq() {
  for (const d of $$('.faq__item')) {
    const summary = $('summary', d);
    const body = $('.faq__a', d);
    summary.addEventListener('click', (e) => {
      if (!motion) return;
      e.preventDefault();
      if (d.open) {
        gsap.to(body, { height: 0, opacity: 0, duration: 0.45, ease: 'power3.inOut', onComplete: () => { d.open = false; gsap.set(body, { clearProps: 'all' }); ScrollTrigger.refresh(); } });
      } else {
        d.open = true;
        gsap.from(body, { height: 0, opacity: 0, duration: 0.6, ease: 'expo.out', clearProps: 'all', onComplete: () => ScrollTrigger.refresh() });
      }
    });
  }
}

// ---------- Filters (projects, articles) ----------
function initFilters() {
  for (const bar of $$('[data-filters]')) {
    const list = bar.parentElement.querySelector('[data-filter-list]');
    if (!list) continue;
    const state = {};
    const stem = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').map((w) => w.slice(0, 6)).join(' ');
    const apply = () => {
      let shown = 0;
      for (const card of list.children) {
        const okType = !state.type || state.type === '*' || card.dataset.type === '*' || card.dataset.type === state.type;
        const okSvc = !state.service || state.service === '*' || stem(card.dataset.service).includes(stem(state.service));
        const show = okType && okSvc;
        card.classList.toggle('is-hidden', !show);
        if (show) shown++;
      }
      if (motion) gsap.fromTo([...list.children].filter((c) => !c.classList.contains('is-hidden')), { opacity: 0, y: 20 }, { opacity: 1, y: 0, stagger: 0.05, duration: 0.5, ease: 'expo.out' });
      let empty = list.parentElement.querySelector('.filters__empty');
      if (!shown && !empty) {
        empty = document.createElement('p');
        empty.className = 'filters__empty';
        empty.textContent = 'Δεν υπάρχουν ακόμη έργα σε αυτή την κατηγορία.';
        list.after(empty);
      } else if (shown && empty) empty.remove();
      ScrollTrigger.refresh();
    };
    bar.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
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

// ---------- Micro-interactions (pointer only) ----------
function initPointer() {
  if (!finePointer || !motion) return;
  root.classList.add('has-cursor');
  const cursor = $('.cursor');
  const dot = $('.cursor__dot', cursor);
  const ring = $('.cursor__ring', cursor);
  const label = $('.cursor__label', cursor);
  const dx = gsap.quickTo(dot, 'x', { duration: 0.08 });
  const dy = gsap.quickTo(dot, 'y', { duration: 0.08 });
  const rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' });
  const ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' });
  let seen = false;
  addEventListener('pointermove', (e) => {
    if (!seen) { seen = true; gsap.set([dot, ring], { x: e.clientX, y: e.clientY }); gsap.to(cursor, { opacity: 1, duration: 0.3 }); }
    dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
  }, { passive: true });
  document.addEventListener('pointerover', (e) => {
    const t = e.target;
    const card = t.closest('.card--link, .mega__tile');
    const call = t.closest('[data-cursor="call"]');
    const link = t.closest('a, button, summary, label.opt, .chip');
    const text = t.closest('input, textarea');
    cursor.classList.toggle('is-label', !!(card || call));
    cursor.classList.toggle('is-link', !!link && !card && !call);
    cursor.classList.toggle('is-text', !!text);
    label.textContent = call ? 'Κλήση' : card ? 'Δείτε' : '';
  });
  document.addEventListener('pointerleave', () => gsap.to(cursor, { opacity: 0, duration: 0.2 }));
  document.addEventListener('pointerenter', () => gsap.to(cursor, { opacity: 1, duration: 0.2 }));

  // Magnetic buttons
  for (const el of $$('[data-magnetic]')) {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * 0.25);
      yTo((e.clientY - r.top - r.height / 2) * 0.35);
    });
    el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  }

  // Card tilt + spotlight
  for (const card of $$('[data-tilt]')) {
    const rX = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3' });
    const rY = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3' });
    gsap.set(card, { transformPerspective: 900 });
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', `${px * 100}%`);
      card.style.setProperty('--my', `${py * 100}%`);
      rY((px - 0.5) * 7);
      rX((0.5 - py) * 7);
    });
    card.addEventListener('pointerleave', () => { rX(0); rY(0); });
  }
}

// ---------- Page transitions ----------
function initTransitions() {
  const curtain = $('.curtain');
  if (root.classList.contains('curtain-in')) {
    gsap.fromTo(curtain, { yPercent: 0 }, { yPercent: -100, duration: 0.9, ease: 'expo.inOut', delay: 0.05, onComplete: () => { root.classList.remove('curtain-in'); gsap.set(curtain, { yPercent: 100 }); } });
  }
  addEventListener('pageshow', (e) => { if (e.persisted) { curtain.classList.remove('is-on'); gsap.set(curtain, { yPercent: 100 }); } });
  if (!motion) return;
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank' || a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.hash) {
      e.preventDefault();
      scrollTo(url.hash);
      history.replaceState(null, '', url.hash);
      return;
    }
    if (url.pathname === location.pathname) return;
    e.preventDefault();
    try { sessionStorage.setItem('grow-curtain', '1'); } catch {}
    curtain.classList.add('is-on');
    gsap.fromTo(curtain, { yPercent: 100 }, { yPercent: 0, duration: 0.6, ease: 'expo.inOut', onComplete: () => (location.href = url.href) });
  });
}

// ---------- Legal TOC ----------
function initToc() {
  const links = $$('.legal__toc a');
  if (!links.length) return;
  for (const a of links) {
    const target = $(a.getAttribute('href'));
    ScrollTrigger.create({ trigger: target, start: 'top 40%', end: 'bottom 40%', onToggle: (s) => s.isActive && links.forEach((l) => l.classList.toggle('is-current', l === a)) });
  }
}

// ---------- 3D ----------
function initScenes() {
  const canvas = $('canvas[data-scene]');
  if (!canvas) return;
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) { canvas.parentElement.remove(); return; }
  import('./scene.js').then(({ mount }) => mount(canvas, canvas.dataset.scene, { motion, finePointer })).catch(() => canvas.parentElement.remove());
}

// ---------- Boot ----------
initTransitions();
initHeader();
initHero();
initReveals();
initIllustrations();
initMarquees();
initHScroll();
initSteps();
initCounters();
initFaq();
initFilters();
initPointer();
initToc();
initForm($('[data-form]'));
initCookies();
initScenes();
window.__growReady = true;

if (location.hash) setTimeout(() => scrollTo(location.hash), 400);
document.fonts?.ready.then(() => ScrollTrigger.refresh());
addEventListener('load', () => ScrollTrigger.refresh());
