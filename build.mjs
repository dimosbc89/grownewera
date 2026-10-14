// Static site build: content/copy.json -> dist/**/index.html, plus bundled JS/CSS.
//   npm run copy    re-extract the copy from content/site-copy.docx
//   npm run build   build to dist/
//   npm run dev     build, then rebuild on change (serve dist/ with `npm run preview`)
//   node build.mjs --out <dir>   build somewhere else (parallel work: one dir per agent)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { loadContent } from './lib/content.mjs';
import { loadPosts } from './lib/posts.mjs';
import { SITE, ARTS, SCENES } from './lib/site.mjs';
import { esc, fmt, flow, section, bgnum } from './lib/render.mjs';
import { skipLink, header, hero, marquee, ctaBand, footer, cookieBanner, form, notFound, preloader } from './lib/layout.mjs';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
// Sources resolve against this file's directory, so the build works from any working directory;
// --out resolves against the working directory like any CLI path (default: <repo>/dist).
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const outArg = flag('--out', null);
const OUT = outArg ? path.resolve(outArg) : path.join(ROOT, 'dist');
const watch = argv.includes('--watch');
checkOut(OUT);
process.chdir(ROOT);

// The output dir is wiped on every build. Only allow <repo>/dist, a folder inside <repo>/.builds/,
// or a path outside the repo that is missing, empty or holds a previous build (assets/ + 404.html).
// Never the filesystem root, the repo, one of its ancestors or anything else inside the repo.
function checkOut(out) {
  const refuse = (why) => {
    console.error(`Refusing to build into ${out}: ${why}`);
    process.exit(1);
  };
  const inside = (child, parent) => {
    const rel = path.relative(parent, child);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
  };
  const real = (p) => { try { return fs.realpathSync(p); } catch { return p; } };
  const o = real(out);
  const r = real(ROOT);
  if (path.parse(o).root === o) refuse('it is the filesystem root');
  if (o === r || inside(r, o)) refuse('it is the repository or one of its parents');
  if (inside(o, r) && o !== path.join(r, 'dist') && !inside(o, path.join(r, '.builds'))) {
    refuse('inside the repository only dist/ and .builds/<name>/ are build folders');
  }
  if (!fs.existsSync(o)) return;
  if (!fs.statSync(o).isDirectory()) refuse('it is a file');
  const entries = fs.readdirSync(o);
  const previous = entries.includes('404.html') && fs.existsSync(path.join(o, 'assets')) && fs.statSync(path.join(o, 'assets')).isDirectory();
  if (entries.length && !previous) refuse('the folder is not empty and does not hold a previous build (assets/ + 404.html)');
}

const KIND = (url) =>
  url === '/' ? 'home'
  : url === '/ypiresies/' ? 'services'
  : url.startsWith('/ypiresies/') ? 'service'
  : url.startsWith('/lyseis/') ? 'solution'
  : url === '/erga/' ? 'works'
  : url.startsWith('/erga/') ? 'case'
  : url === '/etaireia/' ? 'company'
  : url === '/etaireia/omada/' ? 'team'
  : url === '/epikoinonia/' ? 'contact'
  : url === '/blog/' ? 'blog'
  : url.startsWith('/blog/') ? 'post'
  : 'legal';

function jsonLd(page, faqs) {
  const org = {
    '@type': 'ProfessionalService',
    '@id': `${SITE.domain}/#org`,
    name: SITE.name,
    url: `${SITE.domain}/`,
    slogan: SITE.tagline,
    telephone: '+30 210 9713335',
    email: SITE.email,
    address: { '@type': 'PostalAddress', streetAddress: SITE.street, postalCode: SITE.postcode.replace(' ', ''), addressLocality: SITE.city, addressRegion: SITE.region, addressCountry: 'GR' },
    areaServed: { '@type': 'Country', name: 'Greece' },
    sameAs: [SITE.internationalSite],
  };
  const graph = [org];
  if (page.trail) {
    // A crumb without a page of its own (Λύσεις) is visible text only: it has no `item` URL to list.
    const crumbs = page.trail.filter(([, u], i) => u || i === page.trail.length - 1);
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map(([name, u], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${SITE.domain}${u ?? page.url}` })),
    });
  }
  if (page.kind === 'service' && page.meta['Primary term']) {
    graph.push({ '@type': 'Service', name: page.meta['Primary term'], provider: { '@id': org['@id'] }, areaServed: org.areaServed, url: `${SITE.domain}${page.url}` });
  }
  if (page.kind === 'post') {
    const url = `${SITE.domain}${page.url}`;
    graph.push({
      '@type': 'BlogPosting',
      '@id': `${url}#post`,
      headline: page.post.title,
      description: page.post.description,
      datePublished: page.post.date,
      dateModified: page.post.date,
      inLanguage: 'el',
      url,
      mainEntityOfPage: url,
      ...(page.post.cover ? { image: `${SITE.domain}${page.post.cover}` } : {}),
      author: { '@id': org['@id'] },
      publisher: { '@id': org['@id'] },
      isPartOf: { '@type': 'Blog', '@id': `${SITE.domain}/blog/#blog`, name: 'GROW Agency Blog' },
    });
  }
  if (faqs.length) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    });
  }
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
}

// Runs before first paint: js/no-js, motion/no-motion, the page-transition curtain, and the
// once-per-session preloader (`is-loading`). Safety net: if main.js has not booted after 4s
// (window.__growReady), fall back to the static, fully visible page.
const HEAD_SCRIPT = `(function(d){var c=d.classList,s=null;c.replace('no-js','js');var m=!matchMedia('(prefers-reduced-motion: reduce)').matches;c.add(m?'motion':'no-motion');try{s=window.sessionStorage}catch(e){}try{if(s&&s.getItem('grow-curtain')){c.add('curtain-in');s.removeItem('grow-curtain')}else if(m&&s&&!s.getItem('grow-preloaded')){c.add('is-loading')}}catch(e){}setTimeout(function(){if(!window.__growReady){c.remove('motion','curtain-in','is-loading');c.add('no-motion')}},4000)})(document.documentElement)`;

function doc(page, main, shared, assets) {
  const title = page.meta['Title tag'] ?? `${page.name} – GROW Agency`;
  const desc = page.meta['Meta description'] ?? '';
  const canonical = `${SITE.domain}${page.url ?? '/404.html'}`;
  const noindex = page.kind === 'case' || page.url == null;
  // The hero scene's module graph, preloaded by three/index.js on the `high` tier.
  const scene = page.url == null ? 'blocks' : SCENES[page.url];
  const glPreload = scene ? assets.gl[scene] : null;
  // The home page (the international site's home) and posts translated from it have an English
  // equivalent; the other pages list the Greek self-reference alone.
  const alternates = [`<link rel="alternate" hreflang="el" href="${canonical}">`];
  const en = page.url === '/' ? `${SITE.internationalSite}/` : page.post?.source;
  if (en) alternates.push(`<link rel="alternate" hreflang="en" href="${esc(en)}">`);
  const ogImage = page.post?.cover ? `${SITE.domain}${page.post.cover}` : `${SITE.domain}/og.png`;
  return `<!doctype html>
<html lang="el" class="no-js${SITE.showDrafts ? ' show-drafts' : ''}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex, follow">' : ''}
<link rel="canonical" href="${canonical}">
${alternates.join('\n')}
<meta name="theme-color" content="#000000">
<meta name="color-scheme" content="dark">
<meta property="og:type" content="${page.kind === 'post' ? 'article' : 'website'}">
<meta property="og:locale" content="el_GR">
<meta property="og:site_name" content="GROW Agency">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${ogImage}">
${page.kind === 'post' ? `<meta property="article:published_time" content="${page.post.date}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.png" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
${assets.fonts.map((f) => `<link rel="preload" href="${f}" as="font" type="font/woff2" crossorigin>`).join('\n')}
<link rel="stylesheet" href="${assets.css}">
${glPreload?.length ? `<meta name="gl-preload" content="${glPreload.join(' ')}">` : ''}
<script>${HEAD_SCRIPT}</script>
<script type="module" src="${assets.js}"></script>
<script type="application/ld+json">${jsonLd(page, page.faqs ?? [])}</script>
</head>
<body data-kind="${page.kind}">
${preloader()}
${skipLink()}
${cookieBanner(shared)}
${header(page)}
<main id="main">
${main}
</main>
${footer(shared, page)}
<div class="cursor" aria-hidden="true"><span class="cursor__dot"></span><span class="cursor__ring"><span class="cursor__label"></span></span></div>
<div class="curtain" aria-hidden="true"><span class="curtain__logo">GROW<i>.</i></span></div>
<div class="grain" aria-hidden="true"></div>
</body>
</html>
`;
}

function renderPage(page, shared, assets) {
  page.kind = KIND(page.url);
  page.art = ARTS[page.url]; // illustration per page: lib/site.mjs
  const ctx = { url: page.url, kind: page.kind, filters: [], form: (blocks) => form(shared, blocks) };

  // FAQ entries for structured data.
  page.faqs = [];
  for (const s of page.sections) {
    if (!/Συχνές ερωτήσεις/.test(s.title)) continue;
    let q = null;
    for (const b of s.blocks) {
      if (b.t === 'Heading3') page.faqs.push((q = [b.x, '']));
      else if (q && b.x) q[1] += (q[1] ? ' ' : '') + b.x;
    }
  }

  const parts = [hero(page, ctx)];
  if (page.kind !== 'legal' && page.kind !== 'post') parts.push(marquee(page.meta.Punchline ?? page.hero?.Eyebrow));
  if (SITE.showDrafts && page.notes.length) {
    parts.splice(0, 0, `<div class="draft-note" role="note"><span>Σημείωση</span>${page.notes.map((n) => fmt(n)).join(' ')}</div>`);
  }
  if (page.heroExtra?.length) {
    parts.push(`<section class="sec sec--note">${bgnum('00', 0.18)}<div class="wrap"><div class="sec-body sec-body--narrow">${flow(page.heroExtra, ctx)}</div></div></section>`);
  }

  if (page.kind === 'legal') {
    const secs = page.sections;
    parts.push(`<section class="sec sec--legal">${bgnum(secs.length, 0.12)}<div class="wrap legal">
      <nav class="legal__toc" aria-label="Περιεχόμενα"><span class="mega__label" data-scramble>Περιεχόμενα</span><ol>
        ${secs.map((s, i) => `<li><a href="#l${i + 1}">${esc(s.title)}</a></li>`).join('')}</ol></nav>
      <article class="legal__body prose">
        ${secs.map((s, i) => `<h2 id="l${i + 1}">${fmt(s.title, ctx)}</h2>${flow(s.blocks.filter((b) => b.t !== 'Heading3'), ctx).replace(/ data-(reveal|stagger|tilt|strike|scramble)/g, '')}`).join('\n')}
      </article></div></section>`);
  } else if (page.kind === 'post') {
    // Blog post: the legal pages' reading layout (sticky contents + numbered h2s), with the
    // cover above the text and a link back to the index below it.
    const p = page.post;
    parts.push(`<section class="sec sec--legal sec--post">${bgnum(p.toc.length || 1, 0.12)}<div class="wrap legal">
      <nav class="legal__toc" aria-label="Περιεχόμενα"><span class="mega__label" data-scramble>Περιεχόμενα</span><ol>
        ${p.toc.map(([id, t]) => `<li><a href="#${id}">${esc(t)}</a></li>`).join('')}</ol></nav>
      <article class="legal__body prose post">
        ${p.cover ? `<figure class="post__cover" data-clip><img src="${esc(p.cover)}" alt="${esc(p.coverAlt)}" width="1600" height="900" loading="eager" fetchpriority="high"></figure>` : ''}
        <div class="post__body">${p.html}</div>
        <footer class="post__foot">
          <span class="post__meta">Δημοσιεύθηκε <time datetime="${p.date}">${esc(p.dateText)}</time>${p.source ? ` · <a href="${esc(p.source)}" hreflang="en" rel="noopener">Read it in English</a>` : ''}</span>
          <a class="arrow-link" href="/blog/">Όλα τα άρθρα<span class="arrow" aria-hidden="true">→</span></a>
        </footer>
      </article></div></section>`);
  } else {
    let n = 0;
    for (const s of page.sections) {
      const html = section(s, n, page, ctx);
      if (html) {
        parts.push(html);
        n++;
      }
    }
  }

  const band = page.cta ?? { team: shared.bands[0], blog: shared.bands[1], post: shared.bands[1], legal: shared.bands[2] }[page.kind];
  parts.push(ctaBand(band, page, ctx));
  const html = parts.join('\n');
  checkLayout(page, html);
  return doc(page, html, shared, assets);
}

// Layouts are chosen from the shape of the copy (lib/render.mjs). These are the blocks each page
// kind is expected to end up with; a copy edit that loses one is reported, not shipped silently.
const EXPECT = {
  home: { 'card--result': 'case-study cards (Αποτελέσματα)', 'card--quote': 'testimonial cards (Τι λένε οι πελάτες μας)' },
  service: { 'card--result': 'case-study cards (Αποτελέσματα…)', 'card--person': 'the person card (Ποιος…)', 'card--quote': 'testimonial cards (Τι λένε οι πελάτες μας)' },
  solution: { 'card--result': 'the case-study card' },
  case: { 'card--quote': 'the testimonial card (Τι είπε ο πελάτης)' },
  company: { 'class="stat"': 'stat tiles (Η GROW σε αριθμούς)' },
  team: { 'card--person': 'person cards (Τα πρόσωπα)' },
};
function checkLayout(page, html) {
  for (const [needle, what] of Object.entries(EXPECT[page.kind] ?? {})) {
    if (!html.includes(needle)) console.warn(`[layout] ${page.url}: expected ${what} but the copy no longer renders any. Check the section's shape (README, "Change the copy").`);
  }
}

async function bundle() {
  const result = await esbuild.build({
    absWorkingDir: ROOT,
    entryPoints: { main: 'src/js/main.js', style: 'src/css/main.css' },
    outdir: `${OUT}/assets`,
    bundle: true,
    minify: true,
    splitting: true,
    format: 'esm',
    target: ['es2020', 'safari15'],
    entryNames: '[name]-[hash]',
    chunkNames: 'chunks/[name]-[hash]',
    assetNames: 'fonts/[name]-[hash]',
    loader: { '.woff2': 'file', '.woff': 'file' },
    metafile: true,
    legalComments: 'none',
  });
  const url = (f) => '/' + path.relative(OUT, f).split(path.sep).join('/');
  const outs = Object.keys(result.metafile.outputs).map(url);
  // Static import closure of a lazily imported module (its chunk + every chunk it imports).
  const outputs = result.metafile.outputs;
  const closure = (entry) => {
    const start = Object.keys(outputs).find((k) => outputs[k].entryPoint === entry);
    const seen = new Set();
    const walk = (k) => {
      if (!k || seen.has(k) || !outputs[k]) return;
      seen.add(k);
      for (const im of outputs[k].imports) if (im.kind === 'import-statement') walk(im.path);
    };
    walk(start);
    return [...seen].map(url);
  };
  const gl = {};
  for (const name of ['helix', 'bars', 'orb', 'panels', 'blocks', 'globe']) {
    gl[name] = [...new Set([...closure('src/js/three/core.js'), ...closure(`src/js/three/scenes/${name}.js`)])];
  }
  // Preload the fonts every page paints above the fold: the Greek heading face (Manrope: Space
  // Grotesk has no Greek), Space Grotesk for the Latin heading words, Inter for the Greek body.
  const PRELOAD = ['manrope-greek', 'space-grotesk-latin', 'inter-greek', 'inter-latin'];
  return {
    js: outs.find((f) => /\/main-[^/]+\.js$/.test(f)),
    css: outs.find((f) => /\/style-[^/]+\.css$/.test(f)),
    fonts: PRELOAD.map((name) => outs.find((f) => new RegExp(`/${name}-wght-normal-[^/]+\\.woff2$`).test(f))).filter(Boolean),
    gl,
  };
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

async function build() {
  const t0 = Date.now();
  fs.rmSync(OUT, { recursive: true, force: true });
  const assets = await bundle();
  const { pages, shared } = loadContent('content/copy.json');
  const posts = loadPosts('content/posts');

  // Published posts open the blog index (after the doc's filter section, which feeds their
  // filter bar); the doc's topic proposal follows them.
  const blog = pages.find((p) => p.url === '/blog/');
  if (blog && posts.length) {
    const i = blog.sections.findIndex((s) => /^Τα πρώτα 12 άρθρα/.test(s.title));
    const proposal = i >= 0 ? blog.sections.splice(i, 1) : [];
    const at = blog.sections.findIndex((s) => /^(Φίλτρα|Κατηγορίες)$/.test(s.title)) + 1;
    blog.sections.splice(at, 0, { title: 'Τα άρθρα μας', blocks: [], posts }, ...proposal);
  }

  for (const page of pages) {
    if (!page.url) throw new Error(`Page "${page.name}" has no URL in its SEO table`);
    write(path.join(OUT, page.url, 'index.html'), renderPage(page, shared, assets));
  }
  for (const post of posts) {
    const page = {
      name: post.title,
      url: post.url,
      post,
      meta: { 'Title tag': `${post.title} – GROW Agency`, 'Meta description': post.description, H1: post.title },
      hero: { Eyebrow: post.category, H1: post.title, 'Εισαγωγή': post.excerpt },
      updatedTop: `${post.dateText} · ${post.minutes} λεπτ${post.minutes === 1 ? 'ό' : 'ά'} ανάγνωσης`,
      notes: [],
      sections: [],
      cta: null,
    };
    write(path.join(OUT, post.url, 'index.html'), renderPage(page, shared, assets));
    pages.push(page);
  }
  const notFoundMeta = { 'Title tag': 'Η σελίδα δεν βρέθηκε – GROW Agency', 'Meta description': shared.notFound._[0] ?? '' };
  write(path.join(OUT, '404.html'), doc({ name: '404', meta: notFoundMeta, kind: '404', url: null }, notFound(shared), shared, assets));

  const today = new Date().toISOString().slice(0, 10);
  const indexable = pages.filter((p) => p.kind !== 'case');
  write(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexable.map((p) => `  <url><loc>${SITE.domain}${p.url}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`);
  write(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE.domain}/sitemap.xml\n`);
  fs.cpSync('src/static', OUT, { recursive: true });
  const hash = crypto.createHash('md5').update(JSON.stringify(assets)).digest('hex').slice(0, 6);
  console.log(`Built ${pages.length} pages + 404 in ${Date.now() - t0}ms (${hash})`);
}

await build();

if (watch) {
  let timer;
  const rebuild = () => {
    clearTimeout(timer);
    timer = setTimeout(() => build().catch((e) => console.error(e.message)), 120);
  };
  for (const dir of ['src', 'lib', 'content']) fs.watch(dir, { recursive: true }, rebuild);
  console.log('Watching src/, lib/, content/ …');
}
