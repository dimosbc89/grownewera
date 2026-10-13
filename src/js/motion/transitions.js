// Page transitions: a lime curtain covers the page on internal navigation and lifts on arrival
// (the `curtain-in` class is set by the <head> script from sessionStorage). Same-page hash links
// scroll smoothly instead.
import { gsap } from 'gsap';
import { root, motion, $ } from './util.js';
import { scrollTo } from './smooth.js';

export function initTransitions() {
  const curtain = $('.curtain');
  if (!curtain) return;
  if (root.classList.contains('curtain-in')) {
    gsap.fromTo(curtain, { yPercent: 0 }, {
      yPercent: -100, duration: 0.9, ease: 'expo.inOut', delay: 0.05,
      onComplete: () => { root.classList.remove('curtain-in'); gsap.set(curtain, { yPercent: 100 }); },
    });
  }
  addEventListener('pageshow', (e) => {
    if (e.persisted) { curtain.classList.remove('is-on'); gsap.set(curtain, { yPercent: 100 }); }
  });
  if (!motion) return;
  document.addEventListener('click', (e) => {
    const a = e.target instanceof Element && e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank' || a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return;
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
