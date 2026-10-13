// split(el, { mode: 'words' | 'chars' }) -> the inner spans to animate.
// Words: <span class="w"><span class="w-in">word</span></span>. Chars: each .w holds
// <span class="c"><span class="c-in">x</span></span> so words never break mid-line.
// Inline <a>/<mark> inside [data-split] headings stay whole (one unit) so links keep working.
//
// Greek + chars: `text-transform: uppercase` drops the accents of a whole word (Αθήνα -> ΑΘΗΝΑ),
// but applied to one letter at a time the browser keeps them (ή alone -> Ή). So when the heading is
// uppercased by CSS, char units hold the word already uppercased with the page language
// (toLocaleUpperCase('el'), the same rules), the original copy stays the heading's aria-label and
// the units are aria-hidden. The visible result is identical to the unsplit heading.
export function split(el, { mode } = {}) {
  mode ??= el.dataset.split === 'chars' ? 'chars' : 'words';
  const sel = mode === 'chars' ? '.c-in' : '.w-in';
  if (el.dataset.splitDone) return [...el.querySelectorAll(sel)];
  el.dataset.splitDone = '1';
  let upper = false;
  let lang = 'el';
  if (mode === 'chars') {
    upper = getComputedStyle(el).textTransform === 'uppercase';
    lang = el.closest('[lang]')?.lang || 'el';
    if (!el.querySelector('a, button, input') && !el.hasAttribute('aria-label')) {
      el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    }
  }
  const labelled = mode === 'chars' && el.hasAttribute('aria-label');
  const inners = [];
  const unit = (cls, content) => {
    const outer = document.createElement('span');
    outer.className = cls;
    const inner = document.createElement('span');
    inner.className = `${cls}-in`;
    if (typeof content === 'string') inner.textContent = content;
    else inner.append(content);
    outer.append(inner);
    inners.push(inner);
    return outer;
  };
  const word = (text) => {
    if (mode !== 'chars') return unit('w', text);
    const w = document.createElement('span');
    w.className = 'w';
    if (labelled) w.setAttribute('aria-hidden', 'true');
    const shown = upper ? text.toLocaleUpperCase(lang) : text;
    // Letters with their combining marks stay one unit.
    for (const ch of shown.match(/\P{M}\p{M}*/gu) ?? []) w.append(unit('c', ch));
    return w;
  };
  // Punctuation right after an inline <mark>/<a> unit ("[κλάδος]: XX%") joins that unit, so the
  // line can not break between them (plain text would never break there either).
  const glue = (outer, punct) => {
    if (mode === 'chars') {
      const shown = upper ? punct.toLocaleUpperCase(lang) : punct;
      for (const ch of shown.match(/\P{M}\p{M}*/gu) ?? []) outer.append(unit('c', ch));
    } else outer.firstChild.append(punct);
  };
  let lastInline = null; // outer unit of the last <mark>/<a>, while it is the previous sibling
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) {
        let text = child.textContent;
        if (lastInline && lastInline === child.previousSibling) {
          const m = text.match(/^[:;,.·!?»)…%]+/);
          if (m) { glue(lastInline, m[0]); text = text.slice(m[0].length); }
        }
        lastInline = null;
        const frag = document.createDocumentFragment();
        const parts = text.split(/(\s+)/).filter(Boolean);
        for (let i = 0; i < parts.length; i++) {
          const p = parts[i];
          if (/^\s+$/.test(p)) { frag.append(' '); continue; }
          // A one-letter word (Η, Ο, Σ…) never ends a line: it travels with the next word.
          if (/^\p{L}$/u.test(p) && parts[i + 1] && /^\s+$/.test(parts[i + 1]) && parts[i + 2]) {
            frag.append(word(`${p}\u00a0${parts[i + 2]}`));
            i += 2;
            continue;
          }
          frag.append(word(p));
        }
        child.replaceWith(frag);
      } else if (child.nodeType === 1 && !child.classList.contains('w')) {
        if (child.matches('mark, a') && el.dataset.split !== undefined) {
          const holder = document.createElement('span');
          child.replaceWith(holder);
          const u = unit(mode === 'chars' ? 'c' : 'w', child);
          if (mode === 'chars') {
            const w = document.createElement('span');
            w.className = 'w';
            if (labelled) w.setAttribute('aria-hidden', 'true');
            w.append(u);
            holder.replaceWith(w);
            lastInline = w;
          } else {
            holder.replaceWith(u);
            lastInline = u;
          }
        } else { lastInline = null; walk(child); }
      }
    }
  };
  walk(el);
  return inners;
}

/** Group split units into visual lines (by their word's offsetTop). Read-only layout pass. */
export function lines(units) {
  const rows = [];
  let top = null;
  for (const u of units) {
    const w = u.closest('.w') ?? u.parentElement;
    const t = w.offsetTop;
    if (top === null || Math.abs(t - top) > 4) { rows.push([]); top = t; }
    rows[rows.length - 1].push(u);
  }
  return rows;
}
