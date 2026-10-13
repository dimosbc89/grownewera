// Shared flags and tiny DOM helpers for the motion layer (no side effects).
export const root = document.documentElement;
// The <head> script sets `motion` or `no-motion` from prefers-reduced-motion before first paint.
export const motion = root.classList.contains('motion');
export const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
// Touch-first devices (phones, tablets): lighter variants, no ScrollTrigger pins.
export const touch = !finePointer;
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const headerH = () => $('[data-header]')?.offsetHeight ?? 72;
export const pad = (n) => String(n).padStart(2, '0');
export const clamp = (v, a = 0, b = 1) => Math.min(Math.max(v, a), b);
// Frame-rate independent smoothing factor: x += (target - x) * damp(rate, dt).
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
// Elements mid-reveal (3D flip-in): pointer tilt leaves them alone until the reveal is done.
export const busy = new WeakSet();

/**
 * x edges (viewport px) of the four brutalist columns the preloader and the page transition wipe
 * with: the hero's 4-column grid lines (`.hero__grid i`), the outer columns running to the screen
 * edges, so a lifting column lands exactly on a grid line. Equal quarters when there is no hero.
 */
export function gridEdges() {
  const W = root.clientWidth || innerWidth;
  const lines = $$('.hero__grid i').map((i) => i.getBoundingClientRect().left);
  if (lines.length === 4 && lines[3] > lines[1]) return [0, lines[1], lines[2], lines[3], W].map(Math.round);
  return [0, W / 4, W / 2, (W * 3) / 4, W].map(Math.round);
}

/** Fill `host` with four absolutely positioned columns on gridEdges(); returns them. */
export function makeColumns(host, cls) {
  const edges = gridEdges();
  const cols = [];
  for (let i = 0; i < 4; i++) {
    const c = document.createElement('i');
    c.className = cls;
    c.setAttribute('aria-hidden', 'true');
    // 1px overlap so no hairline of the page shows between two columns.
    c.style.left = `${edges[i] - (i ? 1 : 0)}px`;
    if (i < 3) c.style.width = `${edges[i + 1] - edges[i] + (i ? 1 : 0)}px`;
    else c.style.right = '0px';
    host.append(c);
    cols.push(c);
  }
  return cols;
}
