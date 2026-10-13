// split(el, { mode: 'words' | 'chars' }) -> the inner spans to animate.
// Words: <span class="w"><span class="w-in">word</span></span>. Chars: each .w holds
// <span class="c"><span class="c-in">x</span></span> so words never break mid-line.
// Inline <a>/<mark> inside [data-split] headings stay whole (one unit) so links keep working.
export function split(el, { mode } = {}) {
  mode ??= el.dataset.split === 'chars' ? 'chars' : 'words';
  const sel = mode === 'chars' ? '.c-in' : '.w-in';
  if (el.dataset.splitDone) return [...el.querySelectorAll(sel)];
  el.dataset.splitDone = '1';
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
    for (const ch of Array.from(text)) w.append(unit('c', ch));
    return w;
  };
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        for (const p of child.textContent.split(/(\s+)/)) {
          if (!p) continue;
          if (/^\s+$/.test(p)) frag.append(' ');
          else frag.append(word(p));
        }
        child.replaceWith(frag);
      } else if (child.nodeType === 1 && !child.classList.contains('w')) {
        if (child.matches('mark, a') && el.dataset.split !== undefined) {
          const holder = document.createElement('span');
          child.replaceWith(holder);
          holder.replaceWith(unit(mode === 'chars' ? 'c' : 'w', child));
        } else walk(child);
      }
    }
  };
  walk(el);
  return inners;
}
