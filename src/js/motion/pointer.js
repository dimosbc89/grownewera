// Pointer micro-interactions: custom cursor, [data-magnetic], [data-tilt] (+ spotlight vars),
// and [data-depth] parallax. Depth layers get --px/--py from the pointer (fine pointers only) and,
// inside illustrations, --sy from scroll (all devices). Hero layers get --sy from hero.js.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { root, motion, finePointer, $, $$ } from './util.js';

const AMP_HTML = 26; // px at depth 1
const AMP_SVG = 14; // SVG user units at depth 1
const AMP_SVG_SCROLL = 18;

export function initPointer() {
  if (!motion) return;
  initDepth();
  if (!finePointer) return;
  initCursor();
  initMagnetic();
  initTilt();
}

function initCursor() {
  const cursor = $('.cursor');
  if (!cursor) return;
  root.classList.add('has-cursor');
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
    if (!(t instanceof Element)) return;
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
}

function initMagnetic() {
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
}

function initTilt() {
  // Rects are cached per card and re-read only after the page has scrolled.
  let epoch = 0;
  addEventListener('scroll', () => epoch++, { passive: true });
  for (const card of $$('[data-tilt]')) {
    const rX = gsap.quickTo(card, 'rotationX', { duration: 0.6, ease: 'power3' });
    const rY = gsap.quickTo(card, 'rotationY', { duration: 0.6, ease: 'power3' });
    gsap.set(card, { transformPerspective: 900 });
    let rect = null;
    let seen = -1;
    card.addEventListener('pointermove', (e) => {
      if (!rect || seen !== epoch) { rect = card.getBoundingClientRect(); seen = epoch; }
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      card.style.setProperty('--mx', `${px * 100}%`);
      card.style.setProperty('--my', `${py * 100}%`);
      rY((px - 0.5) * 7);
      rX((0.5 - py) * 7);
    });
    card.addEventListener('pointerleave', () => { rect = null; rX(0); rY(0); });
  }
}

// ---------- [data-depth] ----------
function initDepth() {
  const items = $$('[data-depth]').map((el) => ({
    el,
    d: parseFloat(el.dataset.depth) || 0,
    svg: el instanceof SVGElement,
    on: false,
  }));
  if (!items.length) return;

  // Only layers on screen are updated.
  const byHost = new Map();
  for (const it of items) {
    const host = it.svg ? it.el.ownerSVGElement ?? it.el : it.el;
    if (!byHost.has(host)) byHost.set(host, []);
    byHost.get(host).push(it);
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) for (const it of byHost.get(e.target) ?? []) it.on = e.isIntersecting;
  }, { rootMargin: '10% 0px' });
  byHost.forEach((_, host) => io.observe(host));

  // Scroll drift inside illustrations (works on touch screens too).
  for (const [host, list] of byHost) {
    if (!(host instanceof SVGSVGElement) || host.closest('[data-hscroll]')) continue;
    ScrollTrigger.create({
      trigger: host,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: (self) => {
        const k = (0.5 - self.progress) * 2;
        for (const it of list) it.el.style.setProperty('--sy', `${(k * it.d * AMP_SVG_SCROLL).toFixed(2)}px`);
      },
    });
  }

  if (!finePointer) return;
  const p = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', (e) => {
    p.tx = (e.clientX / innerWidth) * 2 - 1;
    p.ty = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });
  gsap.ticker.add(() => {
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    if (Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4) return;
    p.x += dx * 0.07;
    p.y += dy * 0.07;
    for (const it of items) {
      if (!it.on) continue;
      const a = (it.svg ? AMP_SVG : AMP_HTML) * it.d;
      it.el.style.setProperty('--px', `${(-p.x * a).toFixed(2)}px`);
      it.el.style.setProperty('--py', `${(-p.y * a).toFixed(2)}px`);
    }
  });
}
