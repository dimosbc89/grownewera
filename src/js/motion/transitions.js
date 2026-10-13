// Page transitions: a brutalist four-column lime wipe on the site grid, carrying the next page's
// name. Leaving: the columns rise from the floor left to right, the destination's path (mono) and
// name (display) rise in, then the browser navigates (the page was prefetched on hover / click).
// Arriving: the <head> script has already put the lime curtain over the page (`curtain-in`, from
// sessionStorage `grow-curtain`); this module rebuilds the same frame (name read from sessionStorage
// `grow-curtain-label`), lets the name go and lifts the columns, and the hero intro rises behind
// them. Same-page hash links scroll smoothly instead.
import { gsap } from 'gsap';
import { root, motion, finePointer, $, $$, makeColumns } from './util.js';
import { scrollTo } from './smooth.js';
import { EASE } from './ease.js';

const LABEL_KEY = 'grow-curtain-label';
let inited = false;

const norm = (path) => (path.endsWith('/') ? path : `${path}/`);

// A short, human name for a path, taken from the navigation already on the page (mobile menu,
// mega menus, footer, breadcrumbs), else from the clicked link's card title or own text.
function nameFor(url, link) {
  const path = norm(url.pathname);
  const counts = new Map();
  for (const a of $$('.mnav a[href], .mega a[href], .nav a[href], .site-footer a[href], .crumbs a[href]')) {
    let p;
    try { p = norm(new URL(a.href, location.href).pathname); } catch { continue; }
    if (p !== path) continue;
    const t = (a.firstChild?.nodeType === 3 ? a.firstChild.data : a.textContent).replace(/\s+/g, ' ').trim();
    if (t && t.length <= 40) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  if (counts.size) return [...counts.keys()].sort((a, b) => a.length - b.length)[0];
  const title = link?.closest('.card')?.querySelector('.card__title')?.textContent.replace(/\s+/g, ' ').trim();
  if (title && title.length <= 64) return title;
  const own = link?.textContent.replace(/[→↗☎]/g, '').replace(/\s+/g, ' ').trim();
  return own && own.length <= 40 ? own : 'GROW.';
}

function buildFrame(curtain) {
  let frame = $('.curtain__frame', curtain);
  if (frame) return frame;
  frame = document.createElement('div');
  frame.className = 'curtain__frame';
  const cols = document.createElement('div');
  cols.className = 'curtain__cols';
  const label = document.createElement('div');
  label.className = 'curtain__label';
  label.innerHTML = '<span class="curtain__path"><span></span></span><span class="curtain__name"><span></span></span>';
  frame.append(cols, label);
  curtain.append(frame);
  return frame;
}

function layout(curtain, { name = '', path = '' } = {}) {
  const frame = buildFrame(curtain);
  const host = $('.curtain__cols', frame);
  host.replaceChildren();
  const cols = makeColumns(host, 'curtain__col');
  const label = $('.curtain__label', frame);
  $('.curtain__path > span', label).textContent = path ? `→ ${path}` : '';
  $('.curtain__name > span', label).textContent = name;
  label.hidden = !name;
  curtain.classList.add('has-cols');
  return { cols, path: $('.curtain__path > span', label), name: $('.curtain__name > span', label), label };
}

export function initTransitions() {
  const curtain = $('.curtain');
  if (!curtain || inited) return;
  inited = true;

  if (root.classList.contains('curtain-in')) {
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(LABEL_KEY) || 'null'); sessionStorage.removeItem(LABEL_KEY); } catch {}
    const done = () => {
      root.classList.remove('curtain-in');
      curtain.classList.remove('is-on', 'has-cols');
      gsap.set(curtain, { clearProps: 'all' });
    };
    if (!motion) { done(); } else {
      const f = layout(curtain, saved ?? {});
      gsap.set(f.cols, { scaleY: 1, transformOrigin: '50% 0%' });
      const tl = gsap.timeline({ delay: 0.08, onComplete: done });
      if (saved?.name) {
        tl.to([f.name, f.path], { yPercent: -110, duration: 0.5, ease: EASE.in, stagger: 0.04 }, 0.05);
      }
      tl.to(f.cols, { scaleY: 0, duration: 0.85, ease: EASE.lift, stagger: 0.065 }, saved?.name ? 0.28 : 0.05);
    }
  }
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    curtain.classList.remove('is-on', 'has-cols');
    root.classList.remove('curtain-in');
    gsap.set(curtain, { clearProps: 'all' });
    $('.curtain__frame', curtain)?.remove();
  });
  if (!motion) return;

  // Warm the cache for internal pages under the pointer, so the wipe lands on a ready page.
  const prefetched = new Set();
  const prefetch = (url) => {
    const key = url.pathname;
    if (prefetched.has(key) || key === location.pathname) return;
    prefetched.add(key);
    const l = document.createElement('link');
    l.rel = 'prefetch';
    l.href = url.pathname;
    document.head.append(l);
  };
  const internal = (a) => {
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return null;
    let url;
    try { url = new URL(a.href, location.href); } catch { return null; }
    if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return null;
    return url;
  };
  if (finePointer) {
    let t = 0;
    document.addEventListener('pointerover', (e) => {
      const a = e.target instanceof Element && e.target.closest('a[href]');
      clearTimeout(t);
      const url = a && internal(a);
      if (url && url.pathname !== location.pathname) t = setTimeout(() => prefetch(url), 80);
    });
  }

  let leaving = false;
  document.addEventListener('click', (e) => {
    const a = e.target instanceof Element && e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const url = internal(a);
    if (!url) return;
    if (url.pathname === location.pathname && url.hash) {
      e.preventDefault();
      scrollTo(url.hash);
      history.replaceState(null, '', url.hash);
      return;
    }
    if (url.pathname === location.pathname) return;
    e.preventDefault();
    if (leaving) return;
    leaving = true;
    prefetch(url);
    const label = { name: nameFor(url, a), path: norm(url.pathname) };
    try {
      sessionStorage.setItem('grow-curtain', '1');
      sessionStorage.setItem(LABEL_KEY, JSON.stringify(label));
    } catch {}
    const f = layout(curtain, label);
    curtain.classList.add('is-on');
    gsap.set(curtain, { y: 0, yPercent: 0 }); // y: 0 drops the CSS translateY(100%), read as px
    gsap.set(f.cols, { scaleY: 0, transformOrigin: '50% 100%' });
    gsap.set([f.name, f.path], { yPercent: 110 });
    const go = () => { location.href = url.href; };
    gsap.timeline()
      .to(f.cols, { scaleY: 1, duration: 0.62, ease: EASE.wipe, stagger: 0.06 }, 0)
      .to([f.path, f.name], { yPercent: 0, duration: 0.6, ease: EASE.expo, stagger: 0.05 }, 0.32)
      .call(go, null, 0.84);
    // Never strand the visitor under the curtain (a blocked navigation, a slow tab).
    setTimeout(() => { leaving = false; }, 4000);
  });
}
