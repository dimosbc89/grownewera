// Boot only. Motion: src/js/motion/*, WebGL: src/js/three/* (lazy), contract: docs/ARCHITECTURE.md.
import { initMotion } from './motion/index.js';
import { initThree } from './three/index.js';
import { initForm } from './form.js';
import { initCookies } from './cookies.js';

const root = document.documentElement;
const run = (name, fn) => {
  try { fn(); return true; } catch (e) { console.warn(`[grow] ${name} failed`, e); return false; }
};

if (!run('motion', initMotion)) {
  // Never leave content in its hidden pre-reveal state.
  root.classList.remove('motion', 'curtain-in', 'is-loading');
  root.classList.add('no-motion');
}
run('three', initThree);
run('form', () => initForm(document.querySelector('[data-form]')));
run('cookies', initCookies);
// Tells the <head> safety net (4s) that the page is alive, so it keeps the motion styles.
window.__growReady = true;
