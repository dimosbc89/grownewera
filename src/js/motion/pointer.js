// Pointer micro-interactions (fine pointers only, except the scroll drift inside illustrations):
//   cursor        lime dot + trailing ring that stretches along its own velocity; contextual
//                 states: links (ring opens), magnetic buttons (ring gives way to the button),
//                 cards ("Δείτε"), phone links ("Κλήση"), external links (↗), FAQ (+ / −),
//                 text fields (caret); turns black over lime (CTA band, primary buttons)
//   [data-magnetic] the button leans towards the pointer, its label a little further (inner
//                 parallax), and springs back elastically on leave
//   [data-tilt]   3D tilt + spotlight vars (--mx/--my, see components.css)
//   [data-depth]  pointer parallax (--px/--py) for every depth layer on screen; inside
//                 illustrations also scroll drift (--sy, all devices). Hero layers get --sy from
//                 hero.js.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { root, motion, finePointer, busy, $, $$, damp } from './util.js';

const AMP_HTML = 34; // px at depth 1
const AMP_SVG = 14; // SVG user units at depth 1
const AMP_SVG_SCROLL = 18;
let inited = false;

export function initPointer() {
  if (!motion || inited) return;
  inited = true;
  initDepth();
  if (!finePointer) return;
  initCursor();
  initMagnetic();
  initTilt();
}

// An FAQ item counts as closed as soon as it starts closing (motion/ui.js).
const isOpen = (d) => d.open && !d._closing;

function initCursor() {
  const cursor = $('.cursor');
  if (!cursor) return;
  root.classList.add('has-cursor');
  const dot = $('.cursor__dot', cursor);
  const ring = $('.cursor__ring', cursor);
  const label = $('.cursor__label', cursor);
  const dx = gsap.quickSetter(dot, 'x', 'px');
  const dy = gsap.quickSetter(dot, 'y', 'px');
  const set = {
    x: gsap.quickSetter(ring, 'x', 'px'),
    y: gsap.quickSetter(ring, 'y', 'px'),
    r: gsap.quickSetter(ring, 'rotation', 'deg'),
    sx: gsap.quickSetter(ring, 'scaleX'),
    sy: gsap.quickSetter(ring, 'scaleY'),
  };
  const p = { x: -200, y: -200 };
  const r = { x: -200, y: -200, s: 0, a: 0, press: 1 };
  let seen = false;
  let down = false;
  let labelled = false;
  addEventListener('pointermove', (e) => {
    if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    p.x = e.clientX;
    p.y = e.clientY;
    dx(p.x); dy(p.y);
    if (!seen) { seen = true; r.x = p.x; r.y = p.y; gsap.to(cursor, { opacity: 1, duration: 0.3 }); }
  }, { passive: true });
  addEventListener('pointerdown', () => { down = true; }, { passive: true });
  addEventListener('pointerup', () => { down = false; }, { passive: true });
  gsap.ticker.add((time, dtMs) => {
    if (!seen) return;
    const dt = Math.min((dtMs || 16.7) / 1000, 0.1);
    const px = r.x;
    const py = r.y;
    r.x += (p.x - r.x) * damp(13, dt);
    r.y += (p.y - r.y) * damp(13, dt);
    const vx = (r.x - px) / dt;
    const vy = (r.y - py) / dt;
    const speed = Math.hypot(vx, vy);
    // Stretch along the motion (not while the ring carries a label).
    const s = labelled ? 0 : Math.min(speed / 2600, 0.42);
    r.s += (s - r.s) * damp(12, dt);
    if (speed > 60 && !labelled) r.a = (Math.atan2(vy, vx) * 180) / Math.PI;
    r.press += ((down ? 0.78 : 1) - r.press) * damp(16, dt);
    set.x(r.x); set.y(r.y);
    set.r(r.s > 0.01 ? r.a : 0);
    set.sx((1 + r.s) * r.press);
    set.sy((1 - r.s * 0.55) * r.press);
  });
  let last = null;
  document.addEventListener('pointerover', (e) => {
    const t = e.target;
    if (!(t instanceof Element) || t === last) return;
    last = t;
    const card = t.closest('.card--link, .mega__tile');
    const call = t.closest('[data-cursor="call"]');
    const link = t.closest('a, button, summary, label.opt, .chip, label.check');
    const mag = t.closest('[data-magnetic]');
    const text = t.closest('input, textarea');
    const faq = t.closest('.faq__item summary');
    let ext = false;
    if (link?.matches('a[href]')) {
      try { const u = new URL(link.href, location.href); ext = /^https?:$/.test(u.protocol) && u.origin !== location.origin; } catch {}
    }
    let tag = '';
    if (call) tag = 'Κλήση';
    else if (card) tag = 'Δείτε';
    else if (faq) tag = isOpen(faq.parentElement) ? '−' : '+';
    else if (ext) tag = '↗';
    labelled = !!tag;
    cursor.classList.toggle('is-label', labelled);
    cursor.classList.toggle('is-glyph', labelled && tag.length === 1);
    cursor.classList.toggle('is-btn', !!mag && !labelled);
    cursor.classList.toggle('is-link', !!link && !labelled && !mag);
    cursor.classList.toggle('is-text', !!text);
    cursor.classList.toggle('is-dark', !!t.closest('.cta, .btn--primary, .chip.is-active, .draft-note, .opt input:checked + span'));
    label.textContent = tag;
  });
  // FAQ: flip the glyph as it opens/closes under the pointer.
  document.addEventListener('click', (e) => {
    const s = e.target instanceof Element && e.target.closest('.faq__item summary');
    if (s && labelled) setTimeout(() => { label.textContent = isOpen(s.parentElement) ? '−' : '+'; }, 30);
  });
  document.addEventListener('pointerleave', () => gsap.to(cursor, { opacity: 0, duration: 0.2 }));
  document.addEventListener('pointerenter', () => seen && gsap.to(cursor, { opacity: 1, duration: 0.2 }));
}

function initMagnetic() {
  for (const el of $$('[data-magnetic]')) {
    if (el._growMag) continue;
    el._growMag = true;
    const inner = $('.btn__label', el);
    const sx = gsap.quickSetter(el, 'x', 'px');
    const sy = gsap.quickSetter(el, 'y', 'px');
    const ix = inner ? gsap.quickSetter(inner, 'x', 'px') : null;
    const iy = inner ? gsap.quickSetter(inner, 'y', 'px') : null;
    const m = { x: 0, y: 0 };
    const apply = () => {
      sx(m.x); sy(m.y);
      if (ix) { ix(m.x * 0.42); iy(m.y * 0.42); }
    };
    let rect = null;
    el.addEventListener('pointerenter', () => { rect = null; });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      rect ??= el.getBoundingClientRect();
      // The rect was read with the current offset applied: measure from the resting centre.
      const cx = rect.left - m.x + rect.width / 2;
      const cy = rect.top - m.y + rect.height / 2;
      gsap.to(m, { x: (e.clientX - cx) * 0.28, y: (e.clientY - cy) * 0.38, duration: 0.5, ease: 'power3.out', overwrite: true, onUpdate: apply });
    });
    el.addEventListener('pointerleave', () => {
      rect = null;
      gsap.to(m, { x: 0, y: 0, duration: 1.1, ease: 'elastic.out(1, 0.38)', overwrite: true, onUpdate: apply });
    });
  }
}

function initTilt() {
  // Rects are cached per card and re-read only after the page has scrolled.
  let epoch = 0;
  addEventListener('scroll', () => epoch++, { passive: true });
  // Stacking cards are skipped: pin.js scrubs their rotationX (the tilt-back), and a pointer tilt
  // on the exposed edge of a covered card would overwrite it.
  for (const card of $$('[data-tilt]')) {
    if (card._growTilt || card.closest('[data-stack]')) continue;
    card._growTilt = true;
    const rX = gsap.quickTo(card, 'rotationX', { duration: 0.7, ease: 'power3' });
    const rY = gsap.quickTo(card, 'rotationY', { duration: 0.7, ease: 'power3' });
    gsap.set(card, { transformPerspective: 900 });
    let rect = null;
    let seen = -1;
    let tilted = false;
    card.addEventListener('pointermove', (e) => {
      if (!rect || seen !== epoch) { rect = card.getBoundingClientRect(); seen = epoch; }
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      card.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
      card.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
      if (busy.has(card)) return; // still flipping/swinging in: its reveal owns the rotation
      tilted = true;
      rY((px - 0.5) * 7);
      rX((0.5 - py) * 7);
    });
    card.addEventListener('pointerleave', () => {
      rect = null;
      if (!tilted) return;
      tilted = false;
      rX(0); rY(0);
    });
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
  gsap.ticker.add((time, dtMs) => {
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    if (Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4) return;
    const k = damp(4.2, Math.min((dtMs || 16.7) / 1000, 0.1));
    p.x += dx * k;
    p.y += dy * k;
    for (const it of items) {
      if (!it.on) continue;
      const a = (it.svg ? AMP_SVG : AMP_HTML) * it.d;
      it.el.style.setProperty('--px', `${(-p.x * a).toFixed(2)}px`);
      it.el.style.setProperty('--py', `${(-p.y * a).toFixed(2)}px`);
    }
  });
}
