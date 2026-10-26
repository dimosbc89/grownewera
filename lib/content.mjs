// Turns content/copy.json (flat blocks from the Word doc) into pages and sections. Markdown pages
// (content/*.md, lib/markdown.mjs) go through the same pagesFromBlocks().
import fs from 'node:fs';

const FIELD = /^([^:]{2,40}):\s*(.*)$/s;

export function loadContent(file) {
  const all = pagesFromBlocks(JSON.parse(fs.readFileSync(file, 'utf8')));
  // all[0] is the doc's own title and editorial notes.
  const pages = [];
  let shared = null;
  for (const page of all.slice(1)) {
    if (page.name.startsWith('Κοινά στοιχεία')) shared = page;
    else pages.push(page);
  }
  return { pages, shared: parseShared(shared) };
}

// Flat blocks (the doc's copy.json or a content/*.md page, lib/markdown.mjs) -> one page per
// Heading1. Blocks before the first Heading2 are the page's editorial notes.
export function pagesFromBlocks(blocks) {
  const raw = [];
  let cur = null;
  for (const b of blocks) {
    if (b.t === 'Heading1') {
      cur = { name: b.x, blocks: [] };
      raw.push(cur);
    } else if (cur) cur.blocks.push(b);
  }
  return raw.map(toPage);
}

function toPage({ name, blocks }) {
  const notes = [];
  const sections = [];
  let sec = null;
  for (const b of blocks) {
    if (b.t === 'Heading2') {
      sec = { title: b.x, blocks: [] };
      sections.push(sec);
    } else if (sec) sec.blocks.push(b);
    else notes.push(b.x);
  }
  const page = { name, notes, sections, meta: {}, hero: null, cta: null, updated: null };

  const seo = takeSection(page, 'SEO');
  if (seo) {
    const table = seo.blocks.find((b) => b.t === 'table');
    for (const [k, v] of table?.rows.slice(1) ?? []) page.meta[k] = v;
  }
  page.url = page.meta.URL || null;

  const hero = takeSection(page, 'Hero');
  if (hero) {
    page.hero = {};
    page.heroExtra = [];
    for (const b of hero.blocks) {
      const m = b.b && b.x.match(FIELD);
      if (m) page.hero[m[1]] = m[2];
      else page.heroExtra.push(b);
    }
  }

  // The closing CTA: either its own section or trailing "Punchline: … / Τίτλος: …" fields.
  const ctaSec = takeSection(page, 'Τελικό CTA');
  const ctaBlocks = ctaSec ? ctaSec.blocks : [];
  for (const s of page.sections) {
    // The shared page's "CTA bands" section is a list of bands, not this page's closing CTA.
    if (s.title === 'CTA bands') continue;
    const i = s.blocks.findIndex((b) => b.b && /^Punchline:/.test(b.x));
    if (i >= 0) ctaBlocks.push(...s.blocks.splice(i));
  }
  if (ctaBlocks.length) page.cta = parseCta(ctaBlocks, page);

  return page;
}

function parseCta(blocks, page) {
  const cta = { body: [] };
  for (const b of blocks) {
    const m = b.b && b.x.match(FIELD);
    if (m && /^(Punchline|Τίτλος|Κουμπιά|Κουμπί)$/.test(m[1])) cta[m[1]] = m[2];
    else if (m && m[1] === 'Τελευταία ενημέρωση') page.updated = m[2];
    // The creators page's one-line English note for creators abroad (a small line in the band).
    else if (m && m[1] === 'Διεθνείς creators') cta.intl = m[2];
    else cta.body.push(b.x);
  }
  return cta;
}

function takeSection(page, title) {
  const i = page.sections.findIndex((s) => s.title === title);
  return i < 0 ? null : page.sections.splice(i, 1)[0];
}

function parseShared(page) {
  const get = (title) => page.sections.find((s) => s.title === title)?.blocks ?? [];
  const fields = (blocks) => {
    const o = { _: [] };
    for (const b of blocks) {
      const m = b.x?.match(FIELD);
      if (m) o[m[1]] = m[2];
      else if (b.x) o._.push(b.x);
    }
    return o;
  };
  // CTA bands: "Band N: …" paragraphs split the list.
  const bands = [];
  for (const b of get('CTA bands')) {
    if (/^Band \d/.test(b.x)) bands.push({ body: [] });
    else if (bands.length) {
      const m = b.x.match(FIELD);
      if (m && /^(Punchline|Τίτλος|Κουμπί|Κουμπιά)$/.test(m[1])) bands.at(-1)[m[1]] = m[2];
      else bands.at(-1).body.push(b.x);
    }
  }
  return {
    footer: fields(get('Footer')),
    bands,
    form: fields(get('Φόρμα επικοινωνίας')),
    cookie: fields(get('Cookie banner')),
    notFound: fields(get('Σελίδα 404')),
    logo: fields(get('Logo lockup')),
  };
}
