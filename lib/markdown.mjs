// Parses a content/*.md page into the flat block list the Word doc produces (content/copy.json:
// tools/extract-copy.py), so lib/content.mjs builds pages from either source the same way.
//   '# ' / '## ' / '### '   Heading1 / Heading2 / Heading3
//   '- '                    li, ordered: false  (one `list` id per contiguous list)
//   '1. '                   li, ordered: true
//   | a | b |               table { rows } (the |---| separator row is skipped)
//   anything else           P (consecutive lines join into one paragraph; a blank line ends it)
// Bold: a paragraph or item that opens with **…** is bold (b: true) with the asterisks stripped,
// so '**Eyebrow:** text' becomes the field line 'Eyebrow: text' exactly as the doc delivers it;
// a paragraph wrapped entirely in ** is bold too. Inline ** anywhere else is just dropped (the
// doc extraction keeps no inline runs either).
const HEADING = /^(#{1,3})\s+(.*)$/;
const ITEM = /^(?:[-*]|\d+[.)])\s+(.*)$/;
const ORDERED = /^\d+[.)]\s/;
const RULE = /^\|?\s*:?-{2,}/;

const plain = (s) => s.replace(/\*\*/g, '').trim();

// Leading **lead** (or a whole-bold line) -> { x, b }.
function emph(s) {
  const m = s.match(/^\*\*(.+?)\*\*(.*)$/s);
  if (m) return { x: plain(m[1] + m[2]), b: true };
  return { x: plain(s), b: false };
}

function cells(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => plain(c));
}

export function parseMarkdown(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let para = [];
  let list = null; // { id, ordered } of the list being read
  let lists = 0;
  const flush = () => {
    if (!para.length) return;
    const { x, b } = emph(para.join(' '));
    if (x) blocks.push({ t: 'P', b, x });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      flush();
      list = null;
      continue;
    }
    let m;
    if ((m = line.match(HEADING))) {
      flush();
      list = null;
      blocks.push({ t: `Heading${m[1].length}`, b: false, x: plain(m[2]) });
      continue;
    }
    if (line.startsWith('|')) {
      flush();
      list = null;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const row = lines[i].trim();
        if (!RULE.test(row)) rows.push(cells(row));
        i++;
      }
      i--;
      if (rows.length) blocks.push({ t: 'table', rows });
      continue;
    }
    if ((m = line.match(ITEM))) {
      flush();
      const ordered = ORDERED.test(line);
      if (!list || list.ordered !== ordered) list = { id: ++lists, ordered };
      const { x, b } = emph(m[1]);
      blocks.push({ t: 'li', b, x, list: list.id, ordered });
      continue;
    }
    list = null;
    para.push(line);
  }
  flush();
  return blocks;
}
