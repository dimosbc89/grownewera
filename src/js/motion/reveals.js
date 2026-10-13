// Scroll reveals: split titles, [data-reveal], [data-stagger], [data-scrub] lead, [data-parallax]
// (including the .sec-bgnum numerals), [data-clip] wipes, illustrations, CTA and footer wordmark.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion, $, $$ } from './util.js';
import { split } from './split.js';

export function initReveals() {
  const titles = $$('[data-split]:not([data-split="hero"])');
  titles.forEach((t) => split(t));
  initIllustrations();
  if (!motion) return;

  for (const t of titles) {
    const units = $$(t.dataset.split === 'chars' ? '.c-in' : '.w-in', t);
    if (!units.length) continue;
    gsap.to(units, { y: 0, duration: 1, ease: 'expo.out', stagger: t.dataset.split === 'chars' ? 0.018 : 0.04, scrollTrigger: { trigger: t, start: 'top 88%', once: true } });
  }
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 90%',
    once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.08 }),
  });
  for (const g of $$('[data-stagger]')) {
    if (!g.children.length) continue;
    gsap.to(g.children, { opacity: 1, y: 0, duration: 0.9, ease: 'expo.out', stagger: 0.08, scrollTrigger: { trigger: g, start: 'top 88%', once: true } });
  }

  // Lead paragraph lights up word by word as it scrolls through.
  for (const lead of $$('[data-scrub]')) {
    const words = split(lead).map((w) => w.parentElement);
    if (!words.length) continue;
    gsap.to(words, { color: '#ffffff', stagger: 0.1, ease: 'none', scrollTrigger: { trigger: lead, start: 'top 82%', end: 'bottom 45%', scrub: true } });
  }

  // Scroll parallax, k = speed (-1..1) as a share of the element's own height.
  // Elements inside the horizontal reel move with the reel instead.
  for (const el of $$('[data-parallax]')) {
    if (el.closest('[data-hscroll]')) continue;
    const k = parseFloat(el.dataset.parallax) || 0.15;
    gsap.fromTo(el, { yPercent: -k * 100 }, { yPercent: k * 100, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  }

  // Section numerals fade up as their section arrives.
  for (const n of $$('.sec-bgnum')) {
    if (n.closest('[data-hscroll]')) continue; // rides the reel (motion/pin.js)
    gsap.fromTo(n, { opacity: 0 }, { opacity: 1, duration: 1.4, ease: 'power2.out', scrollTrigger: { trigger: n.parentElement, start: 'top 80%', once: true } });
  }

  // Clip-path wipe (art, map, project shots).
  for (const el of $$('[data-clip]')) {
    gsap.fromTo(el, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'expo.inOut', scrollTrigger: { trigger: el, start: 'top 88%', once: true }, onComplete: () => gsap.set(el, { clipPath: 'none' }) });
  }

  // Footer wordmark rises out of the floor.
  const word = $('[data-footer-word]');
  if (word) gsap.from(word, { yPercent: 60, scaleY: 0.6, ease: 'none', scrollTrigger: { trigger: word.parentElement, start: 'top bottom', end: 'bottom bottom', scrub: true } });

  // CTA band: copy rises in.
  for (const cta of $$('[data-cta]')) {
    const inner = $('.cta__inner', cta);
    if (inner) gsap.from(inner, { y: 80, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: cta, start: 'top 75%', once: true } });
  }
}

// SVG product shots play their CSS animation once visible.
function initIllustrations() {
  const ills = $$('.ill');
  if (!motion || !('IntersectionObserver' in window)) { ills.forEach((el) => el.classList.add('is-in')); return; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }, { threshold: 0.3 });
  ills.forEach((el) => io.observe(el));
}
