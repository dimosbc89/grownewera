// Boot only. Motion: src/js/motion/*, WebGL: src/js/three/* (lazy), contract: docs/ARCHITECTURE.md.
import { initMotion } from './motion/index.js';
import { initThree } from './three/index.js';
import { initForm } from './form.js';
import { initCookies } from './cookies.js';

const root = document.documentElement;
const run = (name, fn) => {
  try { fn(); return true; } catch (e) { console.warn(`[grow] ${name} failed`, e); return false; }
};

// The editorial note (drafts only) sits above the hero, which reads its height (--note-h) to fit
// its first screen under it.
function noteHeight() {
  const note = document.querySelector('.draft-note');
  if (!note) return;
  const set = () => root.style.setProperty('--note-h', `${note.offsetHeight}px`);
  set();
  if ('ResizeObserver' in window) new ResizeObserver(set).observe(note);
}

// One boot per document, even if the bundle is evaluated twice. WebGL first: it only starts its
// downloads here, and they should not wait for the motion layer's setup.
if (!window.__growBooted) {
  window.__growBooted = true;
  run('note', noteHeight);
  run('three', initThree);
  if (!run('motion', initMotion)) {
    // Never leave content in its hidden pre-reveal state.
    root.classList.remove('motion', 'curtain-in', 'is-loading');
    root.classList.add('no-motion', 'motion-failed');
  }
  run('form', () => initForm(document.querySelector('[data-form]')));
  run('cookies', initCookies);
}
// Tells the <head> safety net (4s) that the page is alive, so it keeps the motion styles.
window.__growReady = true;
