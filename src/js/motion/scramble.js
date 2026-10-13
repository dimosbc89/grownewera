// Text scramble: the text decodes left to right from random mono glyphs. Works on mixed content
// (only text nodes change, so inline marks/links/icons keep their place) and always restores the
// exact original text. Used by [data-scramble] labels (motion/ui.js), the hero eyebrow and the
// preloader tag. No-op without motion.
import { motion } from './util.js';

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=<>/_';
const KEEP = /[\s/·.:,;–—()«»\-]/;
const originals = new WeakMap();

function textNodes(el) {
  const out = [];
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (/\S/.test(originals.get(n) ?? n.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  while (tw.nextNode()) out.push(tw.currentNode);
  return out;
}

export function scramble(el, { duration = 650, delay = 0 } = {}) {
  if (!motion || !el) return;
  const nodes = textNodes(el);
  if (!nodes.length) return;
  const finals = nodes.map((n) => {
    if (!originals.has(n)) originals.set(n, n.data);
    return Array.from(originals.get(n));
  });
  const total = finals.reduce((a, c) => a + c.length, 0) || 1;
  cancelAnimationFrame(el._scrambleRaf);
  clearTimeout(el._scrambleWait);
  const run = () => {
    const t0 = performance.now();
    let lastSwap = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / duration);
      if (t < 1 && now - lastSwap < 45) { el._scrambleRaf = requestAnimationFrame(tick); return; }
      lastSwap = now;
      const fixed = Math.floor(t * total);
      let k = 0;
      nodes.forEach((n, j) => {
        const chars = finals[j];
        n.data = t >= 1
          ? originals.get(n)
          : chars.map((ch) => (k++ < fixed || KEEP.test(ch) ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join('');
      });
      if (t < 1) el._scrambleRaf = requestAnimationFrame(tick);
    };
    el._scrambleRaf = requestAnimationFrame(tick);
  };
  if (delay > 0) el._scrambleWait = setTimeout(run, delay * 1000);
  else run();
}
