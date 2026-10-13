// Shared flags and tiny DOM helpers for the motion layer (no side effects).
export const root = document.documentElement;
// The <head> script sets `motion` or `no-motion` from prefers-reduced-motion before first paint.
export const motion = root.classList.contains('motion');
export const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const headerH = () => $('[data-header]')?.offsetHeight ?? 72;
export const pad = (n) => String(n).padStart(2, '0');
export const clamp = (v, a = 0, b = 1) => Math.min(Math.max(v, a), b);
