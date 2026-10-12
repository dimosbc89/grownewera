// Static site build: content/copy.json -> dist/**/index.html, plus bundled JS/CSS.
//   npm run copy    re-extract the copy from content/site-copy.docx
//   npm run build   build to dist/
//   npm run dev     build, then rebuild on change (serve dist/ with `npm run preview`)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as esbuild from 'esbuild';
import { loadContent } from './lib/content.mjs';
import { SITE, SCENES } from './lib/site.mjs';
import { esc, fmt, flow, section } from './lib/render.mjs';
import { header, hero, marquee, ctaBand, footer, cookieBanner, form, notFound } from './lib/layout.mjs';

const OUT = 'dist';
const watch = process.argv.includes('--watch');

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
  : 'legal';

const ART = {
  '/': 'dashboard', '/ypiresies/': 'dashboard',
  '/ypiresies/google-ads/': 'search', '/ypiresies/facebook-instagram-ads/': 'social',
  '/ypiresies/tiktok-ads/': 'social', '/ypiresies/chatgpt-ads/': 'chat',
  '/ypiresies/proothisi-istoselidon/': 'seo', '/ypiresies/content-marketing/': 'web',
  '/ypiresies/kataskevi-istoselidon/': 'web', '/ypiresies/kataskevi-eshop/': 'web',
  '/ypiresies/diaxeirisi-social-media/': 'social', '/ypiresies/influencer-marketing/': 'social',
  '/ypiresies/ekthesiaka-periptera/': 'booth', '/lyseis/eshop/': 'dashboard',
  '/lyseis/topikes-epixeiriseis/': 'map', '/lyseis/b2b/': 'booth',
  '/erga/demo-eshop/': 'dashboard', '/erga/demo-topiki-epixeirisi/': 'map', '/erga/demo-b2b/': 'booth',
  '/etaireia/': 'dashboard',
};

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
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: page.trail.map(([name, u], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${SITE.domain}${u ?? page.url}` })),
    });
  }
  if (page.kind === 'service' && page.meta['Primary term']) {
    graph.push({ '@type': 'Service', name: page.meta['Primary term'], provider: { '@id': org['@id'] }, areaServed: org.areaServed, url: `${SITE.domain}${page.url}` });
  }
  if (faqs.length) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    });
  }
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
}

function doc(page, main, shared, assets) {
  const title = page.meta['Title tag'] ?? `${page.name} – GROW Agency`;
  const desc = page.meta['Meta description'] ?? '';
  const canonical = `${SITE.domain}${page.url ?? '/404.html'}`;
  const noindex = page.kind === 'case' || page.url == null;
  return `<!doctype html>
<html lang="el" class="no-js${SITE.showDrafts ? ' show-drafts' : ''}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex, follow">' : ''}
<link rel="canonical" href="${canonical}">
<link rel="alternate" hreflang="el" href="${canonical}">
<link rel="alternate" hreflang="en" href="${SITE.internationalSite}/">
<meta name="theme-color" content="#000000">
<meta name="color-scheme" content="dark">
<meta property="og:type" content="website">
<meta property="og:locale" content="el_GR">
<meta property="og:site_name" content="GROW Agency">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SITE.domain}/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.png" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="${assets.font}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${assets.css}">
<script>(function(d){var c=d.classList;c.replace('no-js','js');c.add(matchMedia('(prefers-reduced-motion: reduce)').matches?'no-motion':'motion');try{if(sessionStorage.getItem('grow-curtain')){c.add('curtain-in');sessionStorage.removeItem('grow-curtain')}}catch(e){}setTimeout(function(){if(!window.__growReady){c.remove('motion','curtain-in');c.add('no-motion')}},4000)})(document.documentElement)</script>
<script type="module" src="${assets.js}"></script>
<script type="application/ld+json">${jsonLd(page, page.faqs ?? [])}</script>
</head>
<body data-kind="${page.kind}">
${header(page)}
<main id="main">
${main}
</main>
${footer(shared, page)}
${cookieBanner(shared)}
<div class="cursor" aria-hidden="true"><span class="cursor__dot"></span><span class="cursor__ring"><span class="cursor__label"></span></span></div>
<div class="curtain" aria-hidden="true"><span class="curtain__logo">GROW<i>.</i></span></div>
<div class="grain" aria-hidden="true"></div>
</body>
</html>
`;
}

function renderPage(page, shared, assets) {
  page.kind = KIND(page.url);
  page.art = ART[page.url];
  const ctx = { url: page.url, filters: [], form: (blocks) => form(shared, blocks) };

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
  if (page.kind !== 'legal') parts.push(marquee(page.meta.Punchline ?? page.hero?.Eyebrow));
  if (SITE.showDrafts && page.notes.length) {
    parts.splice(0, 0, `<div class="draft-note" role="note"><span>Σημείωση</span>${page.notes.map((n) => fmt(n)).join(' ')}</div>`);
  }
  if (page.heroExtra?.length) {
    parts.push(`<section class="sec sec--note"><div class="wrap"><div class="sec-body sec-body--narrow">${flow(page.heroExtra, ctx)}</div></div></section>`);
  }

  if (page.kind === 'legal') {
    const secs = page.sections;
    parts.push(`<section class="sec sec--legal"><div class="wrap legal">
      <nav class="legal__toc" aria-label="Περιεχόμενα"><span class="mega__label">Περιεχόμενα</span><ol>
        ${secs.map((s, i) => `<li><a href="#l${i + 1}">${esc(s.title)}</a></li>`).join('')}</ol></nav>
      <article class="legal__body prose">
        ${secs.map((s, i) => `<h2 id="l${i + 1}">${fmt(s.title, ctx)}</h2>${flow(s.blocks.filter((b) => b.t !== 'Heading3'), ctx).replace(/ data-(reveal|stagger|tilt)/g, '')}`).join('\n')}
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

  const band = page.cta ?? { team: shared.bands[0], blog: shared.bands[1], legal: shared.bands[2] }[page.kind];
  parts.push(ctaBand(band, page, ctx));
  return doc(page, parts.join('\n'), shared, assets);
}

async function bundle() {
  const result = await esbuild.build({
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
  const outs = Object.keys(result.metafile.outputs).map((f) => '/' + path.relative(OUT, f).split(path.sep).join('/'));
  return {
    js: outs.find((f) => /\/main-[^/]+\.js$/.test(f)),
    css: outs.find((f) => /\/style-[^/]+\.css$/.test(f)),
    font: outs.find((f) => /space-grotesk-latin-wght-normal-[^/]+\.woff2$/.test(f)),
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
  for (const page of pages) {
    if (!page.url) throw new Error(`Page "${page.name}" has no URL in its SEO table`);
    write(path.join(OUT, page.url, 'index.html'), renderPage(page, shared, assets));
  }
  write(path.join(OUT, '404.html'), doc({ name: '404', meta: { 'Title tag': 'Η σελίδα δεν βρέθηκε – GROW Agency' }, kind: '404', url: null }, notFound(shared), shared, assets));

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
