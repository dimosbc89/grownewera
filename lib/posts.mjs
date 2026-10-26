// Blog posts: content/posts/<slug>.md -> /blog/<slug>/. Each file opens with a front matter
// block (title, date, category, excerpt, cover, source) and continues in a small Markdown
// subset: ## / ### headings, paragraphs, - and 1. lists (one nested level), > quotes, ---,
// **bold**, *italic* and [links](url).
import fs from 'node:fs';
import path from 'node:path';
import { esc } from './render.mjs';

const MONTHS = ['Ιανουαρίου', 'Φεβρουαρίου', 'Μαρτίου', 'Απριλίου', 'Μαΐου', 'Ιουνίου', 'Ιουλίου', 'Αυγούστου', 'Σεπτεμβρίου', 'Οκτωβρίου', 'Νοεμβρίου', 'Δεκεμβρίου'];
export const dateText = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

export function loadPosts(dir) {
  if (!fs.existsSync(dir)) return [];
  const posts = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => parsePost(path.join(dir, f), f.slice(0, -3)));
  // Newest first.
  return posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

function parsePost(file, slug) {
  const src = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const m = src.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`${file}: missing front matter`);
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (kv) meta[kv[1]] = kv[2].trim().replace(/^"(.*)"$/, '$1');
  }
  for (const k of ['title', 'date', 'category', 'excerpt']) {
    if (!meta[k]) throw new Error(`${file}: front matter needs "${k}"`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) throw new Error(`${file}: date must be YYYY-MM-DD`);
  const body = m[2].trim();
  const { html, toc } = markdown(body);
  const words = body.replace(/[#>*\-\[\]()`]/g, ' ').split(/\s+/).filter(Boolean).length;
  return {
    slug,
    url: `/blog/${slug}/`,
    title: meta.title,
    date: meta.date,
    dateText: dateText(meta.date),
    category: meta.category,
    excerpt: meta.excerpt,
    cover: meta.cover || null,
    coverAlt: meta.cover_alt || meta.title,
    // The English original, listed as the page's hreflang="en" alternate.
    source: meta.source || null,
    description: meta.description || meta.excerpt,
    minutes: Math.max(1, Math.round(words / 180)),
    html,
    toc,
  };
}

// ---------- Markdown subset ----------

function inline(s) {
  const tokens = [];
  const T = (html) => `\u0000${tokens.push(html) - 1}\u0000`;
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, href) => {
    const ext = /^https?:\/\//.test(href) && !href.startsWith('https://marketingagencygreece.online');
    return T(`<a href="${esc(href)}"${ext ? ' rel="noopener"' : ''}>${esc(text)}</a>`);
  });
  s = esc(s);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => tokens[i]);
}

export function markdown(src) {
  const lines = src.split('\n');
  const out = [];
  const toc = [];
  let i = 0;
  const para = [];
  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    para.length = 0;
  };
  const listItems = (ordered) => {
    // "- item" / "1. item", with "  - sub" lines nested under the item before them.
    const re = ordered ? /^\d+\.\s+(.*)$/ : /^[-*]\s+(.*)$/;
    const items = [];
    while (i < lines.length) {
      const m = lines[i].match(re);
      if (m) {
        items.push({ text: m[1], subs: [] });
        i++;
      } else if (items.length && /^\s{2,}[-*]\s+/.test(lines[i])) {
        items.at(-1).subs.push(lines[i].replace(/^\s+[-*]\s+/, ''));
        i++;
      } else break;
    }
    const tag = ordered ? 'ol' : 'ul';
    return `<${tag} class="post-${tag}">${items
      .map((it) => `<li>${inline(it.text)}${it.subs.length ? `<ul class="post-ul">${it.subs.map((s) => `<li>${inline(s)}</li>`).join('')}</ul>` : ''}</li>`)
      .join('')}</${tag}>`;
  };
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      flushPara();
      i++;
      continue;
    }
    const h = line.match(/^(##|###)\s+(.*)$/);
    if (h) {
      flushPara();
      const level = h[1].length;
      const text = h[2].replace(/\*\*/g, '').trim();
      if (level === 2) {
        const id = `p${toc.length + 1}`;
        toc.push([id, text]);
        out.push(`<h2 id="${id}">${inline(text)}</h2>`);
      } else out.push(`<h3>${inline(text)}</h3>`);
      i++;
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      flushPara();
      out.push('<hr>');
      i++;
      continue;
    }
    if (/^>\s?/.test(line)) {
      flushPara();
      const q = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i].replace(/^>\s?/, '')), i++;
      out.push(`<blockquote class="post-quote"><p>${inline(q.join(' '))}</p></blockquote>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      flushPara();
      out.push(listItems(false));
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      flushPara();
      out.push(listItems(true));
      continue;
    }
    para.push(line.trim());
    i++;
  }
  flushPara();
  return { html: out.join('\n'), toc };
}
