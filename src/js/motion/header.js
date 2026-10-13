// Sticky header (hide on scroll down), reading progress bar, mega menus, mobile menu.
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { finePointer, $, $$ } from './util.js';
import { lenis } from './smooth.js';

export function initHeader() {
  const header = $('[data-header]');
  if (!header) return;
  const bar = $('[data-progress]');

  // Scroll state without layout reads: ScrollTrigger knows the max scroll from its last refresh.
  let top = null;
  let hidden = null;
  const setState = (y, dir) => {
    const isTop = y < 10;
    if (isTop !== top) header.classList.toggle('is-top', (top = isTop));
    const menuOpen = header.querySelector('[aria-expanded="true"]');
    const hide = y > 240 && dir > 0 && !menuOpen;
    if (hide !== hidden && (dir !== 0 || hide === false)) header.classList.toggle('is-hidden', (hidden = hide));
  };
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      if (bar) bar.style.transform = `scaleX(${self.progress.toFixed(4)})`;
      // A refresh measures with the page scrolled to the top: that is not where the visitor is.
      if (!ScrollTrigger.isRefreshing) setState(self.scroll(), self.direction);
    },
    onRefresh: (self) => {
      if (bar) bar.style.transform = `scaleX(${self.progress.toFixed(4)})`;
      setState(window.scrollY, 0);
    },
  });
  setState(window.scrollY, 0);

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
    header.classList.remove('is-hidden');
    hidden = false;
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

  // Mobile menu
  const mToggle = $('.menu-toggle');
  const mnav = $('#mnav');
  // While the full-screen menu is open the page behind it is inert: Tab stays in the header + menu
  // instead of landing on links hidden under the overlay.
  const behind = () => $$('body > :is(main, .site-footer, .skip, [data-cookie])');
  const setMobile = (on) => {
    if (!mToggle || !mnav) return;
    mToggle.setAttribute('aria-expanded', String(on));
    mToggle.querySelector('.menu-toggle__label').textContent = on ? 'Κλείσιμο' : 'Μενού';
    behind().forEach((el) => el.toggleAttribute('inert', on));
    if (on) {
      mnav.hidden = false;
      requestAnimationFrame(() => mnav.classList.add('is-open'));
      lenis?.stop();
      document.body.style.overflow = 'hidden';
    } else {
      mnav.classList.remove('is-open');
      setTimeout(() => mToggle.getAttribute('aria-expanded') === 'false' && (mnav.hidden = true), 600);
      lenis?.start();
      document.body.style.overflow = '';
    }
  };
  mToggle?.addEventListener('click', () => setMobile(mToggle.getAttribute('aria-expanded') !== 'true'));
  // A link in the menu closes it first (before the page transition / same-page jump handles the
  // click on the document), so a jump on this page is not blocked by the scroll lock.
  mnav?.addEventListener('click', (e) => {
    if (e.target instanceof Element && e.target.closest('a[href]') && mToggle?.getAttribute('aria-expanded') === 'true') setMobile(false);
  });

  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const openBtn = toggles.find((b) => b.getAttribute('aria-expanded') === 'true');
    if (openBtn) { close(openBtn); openBtn.focus(); }
    if (mToggle?.getAttribute('aria-expanded') === 'true') { setMobile(false); mToggle.focus(); }
  });
}
