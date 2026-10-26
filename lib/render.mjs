// Renders parsed doc sections into HTML. Layout is picked from the shape of the copy,
// so editing the Word doc and rebuilding keeps every page in sync.
import { SITE, CASES, ARTS, HOME_ARTS, PROJECT_ARTS, storySet } from './site.mjs';
import { illustration } from './illustrations.mjs';
import { CREATORS_FORM_ID, GROUPS as CREATOR_GROUPS } from './creators.mjs';

export const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const GREEK = /[Ͱ-Ͽἀ-῿]/;
export const isPunch = (s) => !GREEK.test(s) && s.length < 80 && !/^\[/.test(s);

// ---------- inline formatting ----------

// Phrases the doc writes as link labels at the end of a paragraph.
const TRAILING_LINKS = [
  [/Λύσεις για eshop$/i, '/lyseis/eshop/'],
  [/Λύσεις για τοπικές επιχειρήσεις$/i, '/lyseis/topikes-epixeiriseis/'],
  [/Λύσεις για B2B$/i, '/lyseis/b2b/'],
  [/Δείτε όλες τις υπηρεσίες$/, '/ypiresies/'],
  [/Όλα τα έργα$/, '/erga/'],
  [/Γνωρίστε την ομάδα$/, '/etaireia/omada/'],
  [/[Ζζ]ητήστε προσφορά$/, '/epikoinonia/#form'],
  [/Δείτε το έργο$/, null],
];

export function caseFor(text, fallback = '/erga/') {
  const n = text.match(/\[DEMO (\d)\]/);
  if (n && CASES[n[1]]) return CASES[n[1]];
  if (/eshop/i.test(text)) return CASES[1];
  if (/[Ττ]οπικ/.test(text)) return CASES[2];
  if (/B2B/.test(text)) return CASES[3];
  return fallback;
}

// The "[DEMO n]" / "[DEMO]" marker that opens a demo case-study paragraph (dropped at launch).
const DEMO_MARK = /^\[DEMO(?: \d)?\]\s*/;

export function fmt(input, ctx = {}) {
  let s = String(input);
  const tokens = [];
  const T = (html) => `\u0000${tokens.push(html) - 1}\u0000`;
  // A trailing link label, e.g. "… Λύσεις για eshop" or "… Δείτε το έργο".
  for (const [re, url] of TRAILING_LINKS) {
    const m = s.match(new RegExp(`(\\s|^)(${re.source.slice(0, -1)})(\\.?)$`, re.flags));
    if (m) {
      const href = url ?? caseFor(s, ctx.caseUrl);
      if (href === ctx.url) break;
      s = s.slice(0, m.index) + m[1] + T(`<a class="arrow-link" href="${href}">${esc(m[2])}<span class="arrow" aria-hidden="true">→</span></a>`) + m[3];
      break;
    }
  }
  s = s.replace(/hello@growagency\.online/g, (m) => T(`<a href="mailto:${m}">${m}</a>`));
  s = s.replace(/210 ?9713335/g, () => T(`<a class="nowrap" href="tel:${SITE.tel}">${SITE.phone}</a>`));
  s = s.replace(/growagency\.online/g, (m) => T(`<a href="${SITE.internationalSite}" hreflang="en" rel="noopener">${m}</a>`));
  const inline = [
    [/(σελίδα )(Η ομάδα)/, '/etaireia/omada/'],
    [/(την |η )(Πολιτική απορρήτου)/, '/politiki-aporritou/'],
    [/(Δείτε την )(Πολιτική cookies)/, '/cookies/'],
    [/(υπηρεσία )(Influencer marketing)/, '/ypiresies/influencer-marketing/'],
  ];
  for (const [re, href] of inline) {
    if (href !== ctx.url) s = s.replace(re, (_, a, b) => a + T(`<a href="${href}">${esc(b)}</a>`));
  }
  s = esc(s);
  s = s.replace(/\[[^\]]+\]/g, (m) => `<mark class="slot">${m}</mark>`);
  s = s.replace(/«…»/g, '<mark class="slot">«…»</mark>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => tokens[i]);
}

// Split "Lead sentence. Rest" or "Label: rest" (skipping abbreviations like π.χ.).
export function splitLead(text, max = 150) {
  const re = /[.:;?](\s+)/g;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > max) break;
    const before = text.slice(0, m.index + 1);
    if (/(^|[\s(])\p{L}{1,3}\.\p{L}{1,3}\.$/u.test(before) || /(^|[\s(])\p{L}\.$/u.test(before)) continue;
    const lead = text.slice(0, m.index + (text[m.index] === ':' || text[m.index] === '?' ? 1 : 0)).trim();
    return [lead.replace(/:$/, ''), text.slice(m.index + 1 + m[1].length).trim()];
  }
  return [text, ''];
}

// ---------- buttons ----------

// Anchor of the first section whose title matches (sections render as #s1, #s2 … in order;
// the filter sections of the works / blog pages render nothing and take no number).
export function sectionAnchor(page, re) {
  let n = 0;
  for (const s of page?.sections ?? []) {
    if (/^(Φίλτρα|Κατηγορίες)$/.test(s.title)) continue;
    n++;
    if (re.test(s.title)) return `#s${n}`;
  }
  return null;
}

export function buttonHref(label, page) {
  // The creators page keeps its visitors on the page: its own form and its steps section
  // (lib/creators.mjs); the CTA's "Γράψτε μας: hello@…" opens an email.
  if (page?.kind === 'creators') {
    if (/Συμπληρώστε τη φόρμα|Στείλτε/.test(label)) return `#${CREATORS_FORM_ID}`;
    if (/πώς δουλεύει/i.test(label)) return sectionAnchor(page, /^Πώς δουλεύει/) ?? `#${CREATORS_FORM_ID}`;
    if (/Γράψτε μας/.test(label)) return `mailto:${SITE.email}`;
  }
  if (/Ζητήστε|Συμπληρώστε τη φόρμα|Στείλτε/.test(label)) return '/epikoinonia/#form';
  if (/Καλέστε/.test(label)) return `tel:${SITE.tel}`;
  if (/υπηρεσίες/.test(label)) return '/ypiresies/';
  if (/έργο eshop/.test(label)) return CASES[1];
  if (/B2B έργο/.test(label)) return CASES[3];
  if (/Δείτε ένα έργο/.test(label)) return caseFor(page?.url ?? '', '/erga/');
  if (/έργα|αποτελέσματα/i.test(label)) return '/erga/';
  if (/ομάδα/.test(label)) return '/etaireia/omada/';
  if (/αρχική/.test(label)) return '/';
  return '/epikoinonia/#form';
}

export function buttons(spec, page, { size = '' } = {}) {
  if (!spec) return '';
  const labels = spec.split(' · ').map((s) => s.trim()).filter(Boolean);
  return `<div class="btn-row">${labels
    .map((l, i) => btn(l, buttonHref(l, page), i === 0 ? 'primary' : 'ghost', size))
    .join('')}</div>`;
}

export function btn(label, href, kind = 'primary', size = '') {
  const tel = href.startsWith('tel:');
  const mail = href.startsWith('mailto:');
  return `<a class="btn btn--${kind}${size ? ` btn--${size}` : ''}" href="${href}" data-magnetic${tel ? ' data-cursor="call"' : ''}>
    <span class="btn__label"><span data-text="${esc(label)}">${esc(label)}</span></span>
    <span class="btn__icon" aria-hidden="true">${tel ? '☎' : mail ? '✉' : '→'}</span></a>`;
}

// ---------- block classification ----------

const CONTACT_LABEL = /^(Τηλέφωνο|Email|Διεύθυνση|Ωράριο):/;
const NEGATIVE = /εμποδίζει|προβλήματα|Γιατί δεν|απλώς ξοδεύει|πρόκληση/;

// Layouts are keyed on the structure of the copy, not on the launch slots ([DEMO n], [ΟΝΟΜΑ], XX…),
// so filling the slots before launch keeps every card, tile and person where it is:
//   results  bold paragraphs in a results section ("Αποτελέσματα…", "Πώς φαίνεται στην πράξη",
//            "… έργο από κοντά") that open a case (not one of its "Πρόκληση: / Τι κάναμε: /
//            Αποτέλεσμα:" lines), or any paragraph still carrying a [DEMO n] marker
//   quotes   paragraphs that start with a «…» quotation (or the [DEMO – κριτική πελάτη] slot)
//   people   bold "Name · Role" lines in a people section ("Ποιος…", "Τα πρόσωπα") or [ΟΝΟΜΑ] lines
//   stats    bold " · " rows whose parts start with a number (or an XX slot)
const RESULTS_SECTION = /^Αποτελέσματα|^Πώς φαίνεται στην πράξη|^Παράδειγμα|έργο από κοντά/;
const PEOPLE_SECTION = /^Ποιος |^Ποια |^Τα πρόσωπα/;
// The lines of one case ("Η πρόκληση: …", "Τι κάναμε: …"); no \b: it only knows ASCII letters.
const CASE_LABEL = /^(Η |Το )?(Πρόκληση|Τι κάναμε|Αποτέλεσμα|Στόχος|Περίοδος|Πηγή δεδομένων|Σύνδεσμος):/i;
const QUOTE = /^«[^»]+»/;
const NUMERIC = /^(XX|X,X|[+\-−]?\d[\d.,]*|ROAS\s)/;

function kind(b, next, ctx = {}) {
  if (b.t === 'table') return 'table';
  if (b.t === 'li') return 'li';
  const x = b.x;
  const title = ctx.sectionTitle ?? '';
  if (b.b && /^\[DEMO \d\]/.test(x)) return 'result';
  if (/^\[DEMO – κριτική/.test(x) || (QUOTE.test(x) && ctx.kind !== 'legal')) return 'quote';
  if (b.b && /^\[ΟΝΟΜΑ\]/.test(x)) return 'person';
  if (/^(Όλα τα έργα|Δείτε το έργο)$/.test(x)) return 'btnlink';
  if (b.b && / · /.test(x) && x.split(' · ').filter((p) => NUMERIC.test(p.trim())).length >= 2) return 'stats';
  if (b.b && ctx.kind !== 'legal' && RESULTS_SECTION.test(title) && !CASE_LABEL.test(x)) return 'result';
  if (b.b && ctx.kind !== 'legal' && PEOPLE_SECTION.test(title) && !/^[^:]{2,45}:\s/.test(x) && x.length <= 240) return 'person';
  if (b.b) {
    const m = x.match(/^([^:]{2,45}):\s*(.+)$/s);
    if (m && !/\.\s/.test(m[1])) return 'field';
    if (/:$/.test(x)) return 'label';
    if (x.length <= 70 && !/[.:]\s/.test(x) && next && next.t === 'P' && !next.b) return 'cardtitle';
    return 'boldpara';
  }
  if (isPunch(x)) return 'punch';
  return 'p';
}

function group(blocks, ctx) {
  const out = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const k = kind(b, blocks[i + 1], ctx);
    const last = out.at(-1);
    if (k === 'li') {
      if (last?.k === 'list' && last.list === b.list) last.items.push(b);
      else out.push({ k: 'list', list: b.list, ordered: b.ordered, items: [b] });
    } else if (k === 'cardtitle') {
      const card = { title: b.x, body: [] };
      while (blocks[i + 1] && blocks[i + 1].t === 'P' && !blocks[i + 1].b) card.body.push(blocks[++i].x);
      if (last?.k === 'cards') last.items.push(card);
      else out.push({ k: 'cards', items: [card] });
    } else if (k === 'person') {
      // Bio: the [ΣΥΜΠΛΗΡΩΣΤΕ…] lines under the name, or (once filled) the one paragraph that sits
      // between this name and the next one / the end of the section.
      const p = { head: b.x, body: [] };
      const plain = (j) => blocks[j] && blocks[j].t === 'P' && !blocks[j].b;
      while (plain(i + 1) && /^\[ΣΥΜΠΛΗΡΩΣΤΕ/.test(blocks[i + 1].x)) p.body.push(blocks[++i].x);
      if (!p.body.length && plain(i + 1)) {
        const after = blocks[i + 2];
        if (!after || after.t === 'Heading2' || kind(after, blocks[i + 3], ctx) === 'person') p.body.push(blocks[++i].x);
      }
      if (last?.k === 'people') last.items.push(p);
      else out.push({ k: 'people', items: [p] });
    } else if (['result', 'quote', 'field', 'boldpara'].includes(k) && last?.k === k + 's') {
      last.items.push(b);
    } else if (['result', 'quote', 'field', 'boldpara'].includes(k)) {
      out.push({ k: k + 's', items: [b] });
    } else {
      out.push({ k, b });
    }
  }
  return out;
}

// ---------- block renderers ----------

export const pad = (n) => String(n).padStart(2, '0');

// Big outline numeral behind every .sec (motion/reveals: parallax + fade; contract: .sec-bgnum).
export const bgnum = (n, k = 0.2) => `<span class="sec-bgnum" aria-hidden="true" data-parallax="${k}">${typeof n === 'number' ? pad(n) : esc(n)}</span>`;

export function flow(blocks, ctx) {
  // A "Δείτε το έργο" button after a case card links to that case (caseFor reads ctx.lastText).
  let c = ctx;
  return group(blocks, ctx).map((g) => {
    const html = renderGroup(g, c);
    if (g.k === 'results') c = { ...c, lastText: g.items.at(-1).x };
    return html;
  }).join('\n');
}

function renderGroup(g, ctx) {
  switch (g.k) {
    case 'p':
      return `<p data-reveal>${fmt(g.b.x, ctx)}</p>`;
    case 'punch':
      return `<p class="punch" data-reveal>${esc(g.b.x)}</p>`;
    case 'label':
      return `<p class="label-line" data-reveal><strong>${fmt(g.b.x, ctx)}</strong></p>`;
    case 'btnlink':
      return `<div class="btn-row" data-reveal>${btn(g.b.x, g.b.x === 'Όλα τα έργα' ? '/erga/' : caseFor(ctx.lastText ?? '', '/erga/'), 'ghost')}</div>`;
    case 'stats':
      return statGrid(g.b.x.split(' · '), ctx);
    case 'table':
      return table(g.b.rows, ctx);
    case 'list':
      return list(g, ctx);
    case 'cards':
      return `<div class="grid grid--cards" data-stagger>${g.items
        .map((c, i) => `<article class="card card--mini" data-tilt>
          <span class="card__idx" data-scramble>${pad(i + 1)}</span>
          <h3 class="card__title">${fmt(c.title, ctx)}</h3>
          ${c.body.map((p) => `<p>${fmt(p, ctx)}</p>`).join('')}
        </article>`)
        .join('')}</div>`;
    case 'results':
      return `<div class="grid grid--results" data-stagger>${g.items
        .map((b, i) => {
          const mark = b.x.match(DEMO_MARK)?.[0].trim() ?? '';
          const [lead, rest] = splitLead(b.x.replace(DEMO_MARK, ''), 160);
          // Marker, then the kind of client named in the copy, then the i-th demo case.
          const href = caseFor(b.x, CASES[i + 1] ?? '/erga/');
          // While drafts show, the demo marker stays visible on the card so editors can find it.
          const tag = `Case study${mark && SITE.showDrafts ? ` <mark class="slot">${esc(mark)}</mark>` : ''}`;
          return `<article class="card card--result card--link" data-tilt>
            <span class="card__idx" data-scramble>${pad(i + 1)}</span>
            <span class="tag">${tag}</span>
            <h3 class="card__title">${fmt(lead, ctx)}</h3>
            ${rest ? `<p>${fmt(rest.replace(/\s*Δείτε το έργο\.?$/, ''), ctx)}</p>` : ''}
            <a class="arrow-link stretch" href="${href}">Δείτε το έργο<span class="arrow" aria-hidden="true">→</span></a>
          </article>`;
        })
        .join('')}</div>`;
    case 'quotes':
      return `<div class="grid grid--quotes" data-stagger>${g.items
        .map((b) => {
          // Slot form "[DEMO – κριτική πελάτη] «…» name, role, company" or, once filled, "«quote» name, role, company".
          const m = b.x.match(/^(\[DEMO – κριτική πελάτη\]\s*«…»|«[^»]+»)\s*(.*)$/s);
          const quote = m ? m[1] : b.x;
          const who = m ? m[2] : '';
          return `<figure class="card card--quote">
            <span class="quote-mark" aria-hidden="true">“</span>
            <blockquote><p>${fmt(quote, ctx)}</p></blockquote>
            ${who ? `<figcaption>${fmt(who, ctx)}</figcaption>` : ''}
          </figure>`;
        })
        .join('')}</div>`;
    case 'people':
      return `<div class="grid grid--people" data-stagger>${g.items
        .map((p, i) => `<article class="card card--person" data-tilt>
          <div class="avatar" aria-hidden="true"><span>${pad(i + 1)}</span></div>
          <h3 class="card__title">${fmt(p.head, ctx)}</h3>
          ${p.body.map((x) => `<p>${fmt(x, ctx)}</p>`).join('')}
        </article>`)
        .join('')}</div>`;
    case 'fields':
      return `<dl class="spec" data-stagger>${g.items
        .map((b) => {
          const [, k, v] = b.x.match(/^([^:]{2,45}):\s*(.+)$/s);
          return `<div class="spec__row"><dt>${esc(k)}</dt><dd>${fmt(v, ctx)}</dd></div>`;
        })
        .join('')}</dl>`;
    case 'boldparas': {
      const neg = NEGATIVE.test(ctx.sectionTitle ?? '');
      return `<ol class="points${neg ? ' points--neg' : ''}" data-stagger>${g.items
        .map((b, i) => {
          const [lead, rest] = splitLead(b.x);
          return `<li class="point"${neg ? ' data-strike' : ''}><span class="point__mark" aria-hidden="true">${neg ? '✕' : pad(i + 1)}</span>
            <div><h3 class="point__title">${fmt(lead, ctx)}</h3>${rest ? `<p>${fmt(rest, ctx)}</p>` : ''}</div></li>`;
        })
        .join('')}</ol>`;
    }
  }
  return '';
}

function statGrid(items, ctx) {
  return `<div class="stats" data-stagger>${items
    .map((s) => {
      const m = s.match(/^(\S*(?:XX|\d)\S*(?:\s(?:XX|X,X|[\d.,]+)\S*)?)\s+(.*)$/) || s.match(/^(ROAS (?:XX|X,X|[\d.,]+)),?\s*(.*)$/);
      const num = m ? m[1] : '';
      const label = m ? m[2] : s;
      return `<div class="stat">
        <span class="stat__num" ${/\d/.test(num) && !/X/.test(num) ? `data-count="${esc(num)}"` : ''}>${num ? fmt(num, ctx) : '—'}</span>
        <span class="stat__label">${fmt(label, ctx)}</span></div>`;
    })
    .join('')}</div>`;
}

function list(g, ctx) {
  const items = g.items.map((b) => b.x);
  const bold = g.items.every((b) => b.b);
  if (items.every((x) => CONTACT_LABEL.test(x))) {
    return `<dl class="contact-list" data-stagger>${items
      .map((x) => {
        const [, k, v] = x.match(/^([^:]+):\s*(.*)$/);
        const big = k === 'Τηλέφωνο' || k === 'Email';
        return `<div class="contact-list__row"><dt>${esc(k)}</dt><dd class="${big ? 'big' : ''}">${fmt(v, ctx)}</dd></div>`;
      })
      .join('')}</dl>`;
  }
  if (g.ordered) {
    return `<ol class="steps" data-steps>${items
      .map((x, i) => {
        const [lead, rest] = splitLead(x);
        return `<li class="step" data-reveal>
          <span class="step__num">${pad(i + 1)}</span>
          <div class="step__body"><h3 class="step__title">${fmt(lead, ctx)}</h3>${rest ? `<p>${fmt(rest, ctx)}</p>` : ''}</div>
        </li>`;
      })
      .join('')}<span class="steps__line" aria-hidden="true"><span></span></span></ol>`;
  }
  // Short result lines ("XX% περισσότερα έσοδα…") become stat tiles.
  if (bold && items.every((x) => x.length < 80 && !/\.\s/.test(x) && /XX|X,X|\d/.test(x))) return statGrid(items, ctx);
  const leads = items.map((x) => splitLead(x, 110));
  if (bold && leads.every(([, rest]) => rest)) {
    const neg = NEGATIVE.test(ctx.sectionTitle ?? '');
    return `<ul class="features${neg ? ' features--neg' : ''}" data-stagger>${leads
      .map(([lead, rest], i) => `<li class="feature"${neg ? ' data-strike' : ''}>
        <span class="feature__idx" aria-hidden="true">${neg ? '✕' : pad(i + 1)}</span>
        <h3 class="feature__title">${fmt(lead, ctx)}</h3><p>${fmt(rest, ctx)}</p></li>`)
      .join('')}</ul>`;
  }
  return `<ul class="ticks" data-stagger>${items.map((x) => `<li>${fmt(x, ctx)}</li>`).join('')}</ul>`;
}

export function table(rows, ctx) {
  const [head, ...body] = rows;
  return `<div class="table-wrap" data-reveal><table>
    <thead><tr>${head.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${body.map((r) => `<tr>${r.map((c, i) => `<td data-label="${esc(head[i])}">${fmt(c, ctx)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

// ---------- sections ----------

// Split section blocks into [intro, groups-by-H3, outro].
function byH3(blocks) {
  const intro = [];
  const groups = [];
  for (const b of blocks) {
    if (b.t === 'Heading3') groups.push({ title: b.x, blocks: [] });
    else if (groups.length) groups.at(-1).blocks.push(b);
    else intro.push(b);
  }
  // Paragraphs after the last card that clearly aren't part of it become the outro.
  let outro = [];
  if (groups.length > 1) {
    const sizes = groups.slice(0, -1).map((g) => g.blocks.length);
    const typical = Math.max(...sizes);
    const last = groups.at(-1);
    if (last.blocks.length > typical) {
      const extra = last.blocks.slice(typical);
      if (extra.every((b) => b.t === 'P' && !b.b)) {
        outro = extra;
        last.blocks = last.blocks.slice(0, typical);
      }
    }
  }
  return { intro, groups, outro };
}

// Sections that pin while their paragraphs take turns (motion/pin.js, [data-pin-statement]).
const PIN_STATEMENTS = [[/^\/$/, /^Το marketing σας φέρνει πελάτες/]];
// Card grids that become sticky stacking cards ([data-stack]) on these page kinds.
const STACK_KINDS = new Set(['service', 'solution']);
const STACK_MIN = 4;
// Scroll-story set per page ([data-story], three/story.js): see STORIES in site.mjs.

const HOME_SERVICE_LINKS = [
  [/Διαφήμιση/, '/ypiresies/google-ads/'],
  [/SEO/, '/ypiresies/proothisi-istoselidon/'],
  [/Ιστοσελίδες/, '/ypiresies/kataskevi-istoselidon/'],
  [/Social/, '/ypiresies/diaxeirisi-social-media/'],
  [/περίπτερα/, '/ypiresies/ekthesiaka-periptera/'],
];

export function section(sec, i, page, ctx) {
  ctx = { ...ctx, sectionTitle: sec.title };
  const id = `s${i + 1}`;
  let blocks = [...sec.blocks];
  let punch = '';
  if (blocks[0]?.t === 'P' && !blocks[0].b && isPunch(blocks[0].x)) punch = blocks.shift().x;

  const head = (extra = '', more = '') => `<header class="sec-head${extra}">
      <span class="sec-idx" aria-hidden="true" data-scramble>${pad(i + 1)} /</span>
      <h2 class="sec-title" data-split>${fmt(sec.title, ctx)}</h2>
      ${punch ? `<p class="punch punch--sec">${esc(punch)}</p>` : ''}${more}
    </header>`;
  const num = bgnum(i + 1, i % 2 ? -0.16 : 0.22);
  const wrap = (variant, inner, attrs = '', numeral = num) =>
    `<section class="sec sec--${variant}" id="${id}" aria-labelledby="${id}-t"${attrs}>${numeral}${inner.replace('<h2 class="sec-title"', `<h2 id="${id}-t" class="sec-title"`)}</section>`;

  // Contact form
  if (/^Φόρμα επικοινωνίας/.test(sec.title)) {
    return wrap('form', `<div class="wrap split">
      ${head(' sec-head--sticky')}
      <div class="sec-body">${flow(blocks.filter((b) => b.t === 'P' && !b.b), ctx)}${ctx.form(blocks)}</div></div>`);
  }
  // Creator sign-up form (/creators/): fields from lib/creators.mjs, messages from the section's
  // bold field lines (Συγκατάθεση, Κουμπί, Μήνυμα …).
  // The "03 / 06" progress HUD sits in the sticky heading column, never over the form's inputs
  // (creators-form.js updates [data-form-step] on desktop); the form is labelled by the h2.
  if (/^Φόρμα creators/.test(sec.title) && ctx.creatorsForm) {
    const hud = `
      <div class="form-step" aria-hidden="true"><b data-form-step>01</b> / ${pad(CREATOR_GROUPS.length)}</div>`;
    return wrap('form sec--creators', `<div class="wrap split">
      ${head(' sec-head--sticky', hud)}
      <div class="sec-body">${flow(blocks.filter((b) => b.t === 'P' && !b.b), ctx)}${ctx.creatorsForm(blocks, `${id}-t`)}</div></div>`);
  }
  // Office / map
  if (/^Το γραφείο μας/.test(sec.title)) {
    return wrap('office', `<div class="wrap split">
      <div>${head()}<div class="sec-body">${flow(blocks, ctx)}
        <div class="btn-row">${btn('Οδηγίες στον χάρτη', SITE.mapsUrl, 'ghost')}</div></div></div>
      <div class="map-card" data-clip>${illustration('map')}</div></div>`);
  }
  // Filters are rendered with the list they filter.
  if (/^(Φίλτρα|Κατηγορίες)$/.test(sec.title)) {
    ctx.filters.push(...blocks.filter((b) => /^(Ανά |Φίλτρα)/.test(b.x)).map((b) => b.x));
    return '';
  }
  if (/^Τα έργα μας$/.test(sec.title)) {
    const rows = blocks.find((b) => b.t === 'table').rows.slice(1);
    const rest = blocks.filter((b) => b.t !== 'table');
    return wrap('projects', `<div class="wrap">${head()}
      ${filterBar(ctx.filters, 'project')}
      ${flow(rest.slice(0, 1), ctx)}
      <div class="grid grid--projects" data-filter-list>${rows.map((r, n) => projectCard(r, n, ctx)).join('')}</div>
      ${flow(rest.slice(1), ctx)}</div>`);
  }
  // Published posts (content/posts/*.md; build.mjs adds this section to the blog page). The
  // filter chips come from the doc's "Φίλτρα:" line, plus any post category it does not list.
  if (sec.posts) {
    const filters = ctx.filters.splice(0).map((f) => {
      if (!/^Φίλτρα/.test(f)) return f;
      const have = f.split(' · ').map(norm);
      const extra = [...new Set(sec.posts.map((p) => p.category))].filter((c) => !have.includes(norm(c)));
      return extra.length ? `${f} · ${extra.join(' · ')}` : f;
    });
    return wrap('articles', `<div class="wrap">${head()}
      ${filterBar(filters, 'article')}
      <div class="grid grid--articles" data-filter-list data-empty="Δεν υπάρχουν ακόμη άρθρα σε αυτή την κατηγορία. Δείτε παρακάτω τα θέματα που ετοιμάζουμε.">${sec.posts.map((p, n) => postCard(p, n, ctx)).join('')}</div></div>`);
  }
  if (/^Τα πρώτα 12 άρθρα/.test(sec.title)) {
    const rows = blocks.find((b) => b.t === 'table').rows.slice(1);
    const rest = blocks.filter((b) => b.t !== 'table');
    return wrap('articles', `<div class="wrap">${head()}
      ${filterBar(ctx.filters, 'article')}
      <div class="sec-body sec-body--narrow">${flow(rest, ctx)}</div>
      <div class="grid grid--articles" data-filter-list>${rows.map((r) => articleCard(r, ctx)).join('')}</div></div>`);
  }

  const { intro, groups, outro } = byH3(blocks);

  if (groups.length && /Συχνές ερωτήσεις/.test(sec.title)) {
    // The answer sits inside a closed <details>: it has no box for the scroll reveals to measure,
    // so it carries no reveal hooks of its own (motion/ui.js animates it as the item opens).
    const answer = (blocks) => flow(blocks, ctx).replace(/ data-(reveal|stagger)\b/g, '');
    return wrap('faq', `<div class="wrap split">${head(' sec-head--sticky')}
      <div class="sec-body">${flow(intro, ctx)}
      <div class="faq">${groups
        .map((g, k) => `<details class="faq__item" data-reveal><summary><span class="faq__n" aria-hidden="true">${pad(k + 1)}</span><span class="faq__q">${fmt(g.title, ctx)}</span><i aria-hidden="true"></i></summary>
          <div class="faq__a">${answer(g.blocks)}</div></details>`)
        .join('')}</div>${flow(outro, ctx)}</div></div>`);
  }

  if (groups.length) {
    const hscroll = page.url === '/' && /^Υπηρεσίες/.test(sec.title);
    const cards = groups
      .map((g, n) => {
        const homeLink = hscroll && HOME_SERVICE_LINKS.find(([re]) => re.test(g.title))?.[1];
        const body = flow(g.blocks, { ...ctx, lastText: g.title });
        const linked = homeLink || (body.match(/class="arrow-link"/g) || []).length === 1;
        return `<article class="card${linked ? ' card--link' : ''}${hscroll ? ' card--panel' : ''}" data-tilt>
          <span class="card__idx" data-scramble>${pad(n + 1)}</span>
          ${hscroll ? `<div class="card__art" aria-hidden="true">${illustration(HOME_ARTS[n] ?? 'search', true)}</div>` : ''}
          <h3 class="card__title">${fmt(g.title, ctx)}</h3>
          <div class="card__body">${body.replace('class="arrow-link"', 'class="arrow-link stretch"')}</div>
          ${homeLink ? `<a class="arrow-link stretch" href="${homeLink}">Περισσότερα<span class="arrow" aria-hidden="true">→</span></a>` : ''}
        </article>`;
      })
      .join('');
    if (hscroll) {
      return wrap('hscroll', `<div class="hscroll" data-hscroll>
        <div class="hscroll__track">
          <div class="hscroll__intro">${num}${head()}${flow(intro, ctx)}<div class="hscroll__hint" aria-hidden="true">Scroll →</div></div>
          ${cards}
          <div class="hscroll__outro">${flow(outro, ctx)}</div>
        </div></div>`, '', '');
    }
    const cols = groups.length === 2 || groups.length === 4 ? 'grid--2' : 'grid--3';
    const stack = STACK_KINDS.has(page.kind) && groups.length >= STACK_MIN;
    return wrap(stack ? 'cards sec--stack' : 'cards', `<div class="wrap">${head(' sec-head--wide')}
      ${intro.length ? `<div class="sec-body sec-body--narrow">${flow(intro, ctx)}</div>` : ''}
      <div class="grid ${cols}${stack ? ' grid--stack' : ''}" data-stagger${stack ? ' data-stack' : ''}>${cards}</div>
      ${outro.length ? `<div class="sec-body sec-body--narrow sec-outro">${flow(outro, ctx)}</div>` : ''}</div>`);
  }

  // Plain section: sticky heading left, copy right. The first section after the hero gets
  // a scroll-scrubbed lead paragraph and an illustration.
  const first = i === 0 && page.kind !== 'legal';
  let body = blocks;
  let lead = '';
  if (first && blocks[0]?.t === 'P' && !blocks[0].b) {
    lead = `<p class="lead" data-scrub>${fmt(blocks[0].x, ctx)}</p>`;
    body = blocks.slice(1);
  }
  const artName = page.art ?? ARTS[page.url];
  const art = first && artName ? `<div class="sec-art" data-parallax="-0.12" data-clip>${illustration(artName)}</div>` : '';

  // A step list of 3+ steps becomes a scroll story: sticky heading + WebGL stage on the left,
  // the steps on the right. motion/pin.js reports progress to the canvas (`grow:story`).
  const steps = storySteps(body);
  if (steps) {
    const set = storySet(page.url);
    return wrap(first ? 'intro sec--story' : 'story', `<div class="wrap split story" data-story="${set}">
    <div class="story__aside">${head()}
      <div class="story__stage" aria-hidden="true">
        <canvas class="story__canvas" data-scene="story" aria-hidden="true"></canvas>
        <span class="story__hud"><b data-story-step>01</b><span>/${pad(steps)}</span></span>
        <span class="story__set">Fig. ${pad(i + 1)} — ${esc(set)}</span>
        <span class="story__bar"><i></i></span>
      </div>
    </div>
    <div class="sec-body">${lead}${art}${flow(body, ctx)}</div></div>`);
  }

  const statement = PIN_STATEMENTS.some(([u, t]) => u.test(page.url ?? '') && t.test(sec.title));
  let html = flow(body, ctx);
  if (statement) html = html.replace(/ data-reveal/g, ''); // motion/pin.js drives these paragraphs
  if (first || statement) {
    return wrap(first ? 'intro' : 'split sec--statement', `<div class="wrap split">${head(' sec-head--sticky')}
    <div class="sec-body">${lead}${art}${html}</div></div>`, statement ? ' data-pin-statement' : '');
  }
  // Rhythm: plain sections alternate between a sticky side heading (5/7 split) and an offset
  // layout (heading across the top, body hung from the fourth column). Wide content (team and
  // card grids, stat rows, tables) always takes the offset layout, where it gets the most width.
  const wide = /class="(grid|table-wrap|stats)[ "]/.test(html);
  page.splits = (page.splits ?? 0) + 1;
  if (wide || page.splits % 2 === 0) {
    return wrap('split sec--offset', `<div class="wrap offset">${head(' sec-head--offset')}
    <div class="sec-body">${html}</div></div>`);
  }
  return wrap('split', `<div class="wrap split">${head(' sec-head--sticky')}
    <div class="sec-body">${html}</div></div>`);
}

// Number of steps when the blocks hold an ordered list of 3+ items (else 0).
function storySteps(blocks) {
  const lists = {};
  for (const b of blocks) if (b.t === 'li' && b.ordered) lists[b.list] = (lists[b.list] ?? 0) + 1;
  return Math.max(0, ...Object.values(lists).filter((n) => n >= 3));
}

function filterBar(filters, kind) {
  if (!filters.length) return '';
  return `<div class="filters" data-filters="${kind}">${filters
    .filter((f) => !/^Κάρτα/.test(f))
    .map((f) => {
      const [, label, opts] = f.match(/^([^:]+):\s*(.*)$/);
      const key = /τύπο/.test(label) ? 'type' : 'service';
      return `<div class="filters__row" role="group" aria-label="${esc(label)}"><span class="filters__label">${esc(label)}</span>
        ${opts.split(' · ').map((o, i) => `<button type="button" class="chip${i === 0 ? ' is-active' : ''}" data-key="${key}" data-value="${i === 0 ? '*' : esc(o)}" aria-pressed="${i === 0}">${esc(o)}</button>`).join('')}
      </div>`;
    })
    .join('')}</div>`;
}

const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ');

function projectCard([title, services, result], n, ctx) {
  const href = caseFor(title);
  const type = /eshop/i.test(title) ? 'Eshop' : /Τοπική/.test(title) ? 'Τοπικές επιχειρήσεις' : 'B2B';
  return `<article class="card card--project card--link" data-tilt data-type="${esc(type)}" data-service="${esc(norm(services))}">
    <div class="card__art" aria-hidden="true" data-clip>${illustration(PROJECT_ARTS[type] ?? 'dashboard', true)}</div>
    <span class="card__idx" data-scramble>${pad(n + 1)}</span>
    <h3 class="card__title">${fmt(title, ctx)}</h3>
    <p class="card__meta">${fmt(services, ctx)}</p>
    <p class="card__result">${fmt(result, ctx)}</p>
    <a class="arrow-link stretch" href="${href}">Δείτε το έργο<span class="arrow" aria-hidden="true">→</span></a>
  </article>`;
}

function postCard(post, n, ctx) {
  return `<article class="card card--article card--link" data-tilt data-type="*" data-service="${esc(norm(post.category))}">
    <div class="card__top"><span class="tag">${esc(post.category)}</span><span class="card__idx" data-scramble>${pad(n + 1)}</span></div>
    <h3 class="card__title">${esc(post.title)}</h3>
    <p>${esc(post.excerpt)}</p>
    <p class="card__meta"><time datetime="${post.date}">${esc(post.dateText)}</time> · ${post.minutes} λεπτ${post.minutes === 1 ? 'ό' : 'ά'} ανάγνωσης</p>
    <a class="arrow-link stretch" href="${post.url}">Διαβάστε το άρθρο<span class="arrow" aria-hidden="true">→</span></a>
  </article>`;
}

function articleCard([num, title, term, cat, related], ctx) {
  return `<article class="card card--article" data-tilt data-type="*" data-service="${esc(norm(cat))}">
    <div class="card__top"><span class="tag">${esc(cat)}</span><span class="card__idx" data-scramble>${pad(num)}</span></div>
    <h3 class="card__title">${fmt(title, ctx)}</h3>
    <p class="card__meta">Όρος αναζήτησης: «${esc(term)}»</p>
    <p class="card__meta">Συνδέεται με: ${esc(related)}</p>
    <span class="soon">Σύντομα</span>
  </article>`;
}
