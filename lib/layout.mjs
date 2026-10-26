// Page shell: <head>, header + mega menu, hero, CTA band, footer, cookie banner, form.
import { SITE, SERVICE_GROUPS, SOLUTIONS, MAIN_NAV, SHORT, SCENES } from './site.mjs';
import { esc, fmt, buttons, btn, pad } from './render.mjs';
import { CREATORS_FORM_ID, CREATORS_MAIL_SUBJECT, CHANNELS, GROUPS } from './creators.mjs';

export const logo = (tag = true) => `<span class="logo">
  <span class="logo__word"><b>GROW</b><span>AGENCY.</span></span>
  ${tag ? '<span class="logo__tag">Media that matters</span>' : ''}
</span>`;

const ARROW = '<span class="arrow" aria-hidden="true">→</span>';

export const skipLink = () => '<a class="skip" href="#main">Μετάβαση στο περιεχόμενο</a>';

export function header(page) {
  const cur = page.url ?? '';
  // aria-current="page" only on the link to this very page; a parent section's link is "true".
  const active = (u) => (u && cur === u ? ' aria-current="page"' : u && u !== '/' && cur.startsWith(u) ? ' aria-current="true"' : '');
  const servicesMega = `<div class="mega" id="mega-services" hidden>
    <div class="mega__inner wrap">
      ${SERVICE_GROUPS.map((g, i) => `<div class="mega__col">
        <span class="mega__label" data-scramble>${String(i + 1).padStart(2, '0')} / ${esc(g.label)}</span>
        <ul>${g.items.map(([l, u]) => `<li><a href="${u}"${active(u)}>${esc(l)}${ARROW}</a></li>`).join('')}</ul></div>`).join('')}
      <a class="mega__all" href="/ypiresies/">Όλες οι υπηρεσίες${ARROW}</a>
    </div></div>`;
  const solutionsMega = `<div class="mega mega--sm" id="mega-solutions" hidden>
    <div class="mega__inner wrap">
      ${SOLUTIONS.map(([l, u], i) => `<a class="mega__tile" href="${u}"${active(u)}><span class="mega__label" data-scramble>${String(i + 1).padStart(2, '0')}</span><span class="mega__tile-t">${esc(l)}</span>${ARROW}</a>`).join('')}
    </div></div>`;

  const items = MAIN_NAV.map(([label, url, mega]) => {
    if (mega) {
      const id = `mega-${mega}`;
      const isActive = mega === 'services' ? cur.startsWith('/ypiresies/') : cur.startsWith('/lyseis/');
      return `<li class="nav__item has-mega"><button class="nav__link" type="button" aria-expanded="false" aria-controls="${id}"${isActive ? ' data-active' : ''}>${esc(label)}<i aria-hidden="true">+</i></button>${mega === 'services' ? servicesMega : solutionsMega}</li>`;
    }
    return `<li class="nav__item"><a class="nav__link" href="${url}"${active(url)}>${esc(label)}</a></li>`;
  }).join('');

  // data-lenis-prevent: the page scroll is locked while the menu is open (motion/header.js), but
  // the menu's own overflow scroll must keep working under touch.
  const mobile = `<div class="mnav" id="mnav" hidden data-lenis-prevent>
    <div class="mnav__inner">
      <nav aria-label="Μενού κινητού"><ul class="mnav__list">
        <li><a href="/ypiresies/">Υπηρεσίες</a>
          <ul class="mnav__sub">${SERVICE_GROUPS.flatMap((g) => g.items).map(([l, u]) => `<li><a href="${u}">${esc(l)}</a></li>`).join('')}</ul></li>
        <li><span class="mnav__head">Λύσεις</span>
          <ul class="mnav__sub">${SOLUTIONS.map(([l, u]) => `<li><a href="${u}">${esc(l)}</a></li>`).join('')}</ul></li>
        ${MAIN_NAV.filter(([, u]) => u && u !== '/ypiresies/').map(([l, u]) => `<li><a href="${u}">${esc(l)}</a></li>`).join('')}
        <li><a href="/creators/"${active('/creators/')}>${esc(SHORT['/creators/'])}</a></li>
      </ul></nav>
      <div class="mnav__foot">
        ${btn('Ζητήστε προσφορά', '/epikoinonia/#form')}
        <a class="mnav__tel" href="tel:${SITE.tel}">${SITE.phone}</a>
      </div>
    </div></div>`;

  return `<header class="site-header" data-header>
  <div class="site-header__bar wrap">
    <a class="site-header__brand" href="/" aria-label="GROW Agency, αρχική">${logo(false)}</a>
    <nav class="nav" aria-label="Κύριο μενού"><ul class="nav__list">${items}</ul></nav>
    <div class="site-header__cta">
      ${btn('Ζητήστε προσφορά', '/epikoinonia/#form', 'primary', 'sm')}
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="mnav"><span class="menu-toggle__label">Μενού</span><span class="menu-toggle__bars" aria-hidden="true"><i></i><i></i></span></button>
    </div>
  </div>
  <div class="progress" aria-hidden="true"><span data-progress></span></div>
</header>
${mobile}`;
}

export function breadcrumbs(page) {
  if (!page.url || page.url === '/') return '';
  const trail = [['Αρχική', '/']];
  if (page.url.startsWith('/ypiresies/') && page.url !== '/ypiresies/') trail.push(['Υπηρεσίες', '/ypiresies/']);
  if (page.url.startsWith('/lyseis/')) trail.push(['Λύσεις', null]);
  if (page.url.startsWith('/erga/') && page.url !== '/erga/') trail.push(['Έργα', '/erga/']);
  if (page.url === '/etaireia/omada/') trail.push(['Η εταιρεία', '/etaireia/']);
  trail.push([SHORT[page.url] ?? page.name, null]);
  page.trail = trail;
  return `<nav class="crumbs" aria-label="Breadcrumb"><ol>${trail
    .map(([l, u], i) => `<li>${u ? `<a href="${u}">${esc(l)}</a>` : `<span${i === trail.length - 1 ? ' aria-current="page"' : ''}>${esc(l)}</span>`}</li>`)
    .join('')}</ol></nav>`;
}

// The hero's trust strip is its foreground depth layer: it runs slightly ahead of the scroll
// (negative depth; motion/hero.js tweens only the inner .marquee__track).
export function trust(spec, depth = -0.14) {
  if (!spec) return '';
  const items = spec.split(' · ');
  const row = items.map((t) => `<li class="trust__item">${/^\[/.test(t) ? fmt(t) : `<span class="trust__badge" aria-hidden="true">✓</span>${esc(t)}`}</li>`).join('');
  return `<div class="trust" data-marquee="0.6" data-depth="${depth}"><div class="marquee__track"><ul class="trust__list">${row}</ul><ul class="trust__list" aria-hidden="true">${row}</ul></div></div>`;
}

// Hero parallax layers ([data-depth], 0 = still, 1 = full; motion/hero.js + motion/pointer.js).
// GSAP folds the CSS `translate` that carries the depth into its own transform (and writes
// `translate: none`) on any element it tweens, so depth never sits on a tweened element: the intro
// tweens [data-hero-in] inside a `.hero__layer` wrapper, and the canvas fades in by CSS.
const DEPTH = { stage: 0.6, hud: 0.34, grid: 0.22, title: 0.06, sub: 0.12, buttons: 0.18 };
const layer = (depth, inner) => `<div class="hero__layer" data-depth="${depth}">${inner}</div>`;
const heroStage = (scene) => `<div class="hero__stage" aria-hidden="true" data-depth="${DEPTH.stage}"><canvas class="hero__canvas" data-scene="${scene}" aria-hidden="true"></canvas></div>`;
const heroGrid = `<div class="hero__grid" aria-hidden="true" data-depth="${DEPTH.grid}"><i></i><i></i><i></i><i></i></div>`;
// Viewfinder around the 3D stage (desktop): corner ticks and a figure caption. Hidden when the
// stage falls back (.hero__stage.is-static) and on phones, where the stage is a backdrop.
const heroHud = (scene, fig) => `<div class="hero__hud" aria-hidden="true" data-depth="${DEPTH.hud}">
    <i></i><i></i><i></i><i></i><span class="hero__fig">Fig. ${fig} / ${esc(scene)}</span></div>`;

const ALL_SERVICES = SERVICE_GROUPS.flatMap((g) => g.items.map(([, u]) => [u, g.label]));
const COORDS = '37.93° N · 23.73° E · Άγιος Δημήτριος, Αθήνα';
// The copy promises a reply within one working day on these pages (contact page, service CTAs).
const promisesReply = (page) => /μία εργάσιμη μέρα/.test(JSON.stringify([page.sections, page.cta, page.hero]));

// Mono data strip along the bottom of the hero (decorative: every value is also in the copy, the
// nav or the footer). Cells: scroll cue, where the page sits (index, group, tags), reply time
// when the copy states it, phone on the contact page, the office coordinates.
function heroData(page) {
  const cell = (k, v, cls = '') => `<span class="hero__cell${cls}"><span class="hero__k">${k}</span><span class="hero__v">${v}</span></span>`;
  const cells = [`<span class="hero__cell hero__cell--cue"><span class="scroll-cue"><i></i>Scroll</span></span>`];
  const svc = ALL_SERVICES.findIndex(([u]) => u === page.url);
  const sol = SOLUTIONS.findIndex(([, u]) => u === page.url);
  if (page.kind === 'home' || page.kind === 'services') {
    cells.push(cell('Scope', SERVICE_GROUPS.map((g) => `<b>${esc(g.label)}</b>`).join(''), ' hero__cell--tags'));
  } else if (svc >= 0) {
    cells.push(cell(`N° ${String(svc + 1).padStart(2, '0')}/${ALL_SERVICES.length}`, esc(ALL_SERVICES[svc][1])));
  } else if (sol >= 0) {
    cells.push(cell(`N° ${String(sol + 1).padStart(2, '0')}/${String(SOLUTIONS.length).padStart(2, '0')}`, 'Λύσεις'));
  } else if (page.kind === 'case') {
    cells.push(cell('Case', esc(SHORT[page.url] ?? page.name)));
  }
  if (page.kind === 'contact') cells.push(cell('Tel', SITE.phone));
  if (promisesReply(page)) cells.push(cell('Reply', '1 εργάσιμη'));
  // The creators page promises an answer within five working days and costs the creator nothing.
  if (page.kind === 'creators') cells.push(cell('Reply', '5 εργάσιμες'), cell('Cost', '0€'));
  cells.push(cell('HQ', `<span class="coords">${COORDS}</span>`, ' hero__cell--hq'));
  return `<div class="hero__foot hero__data wrap" aria-hidden="true">${cells.join('')}</div>`;
}

export function hero(page, ctx) {
  const h = page.hero ?? {};
  const scene = SCENES[page.url];
  const title = h.H1 ?? page.meta.H1 ?? page.name;
  const sub = h['Υπότιτλος'] ?? h['Εισαγωγή'];
  const eyebrow = h.Eyebrow ?? page.meta.Punchline;
  const simple = page.kind === 'legal';
  const crumbs = breadcrumbs(page);
  const fig = String(Object.keys(SCENES).indexOf(page.url) + 1).padStart(2, '0');
  return `<section class="hero hero--${page.kind ?? 'page'}${simple ? ' hero--simple' : ''}${scene ? '' : ' hero--flat'}" data-hero>
  ${scene ? heroStage(scene) : ''}
  ${heroGrid}
  ${scene ? heroHud(scene, fig) : ''}
  ${crumbs ? `<div class="wrap hero__top">${crumbs}</div>` : ''}
  <div class="wrap hero__inner">
    ${eyebrow ? `<p class="eyebrow" data-hero-in><span class="eyebrow__dot" aria-hidden="true"></span>${fmt(eyebrow, ctx)}</p>` : ''}
    <h1 class="hero__title" data-split="hero" data-depth="${DEPTH.title}">${fmt(title, ctx)}</h1>
    ${sub ? layer(DEPTH.sub, `<p class="hero__sub" data-hero-in>${fmt(sub, ctx)}</p>`) : ''}
    ${h['Κουμπιά'] ? layer(DEPTH.buttons, `<div class="hero__cta" data-hero-in>${buttons(h['Κουμπιά'], page)}</div>`) : ''}
    ${page.updatedTop ? `<p class="hero__meta" data-hero-in>${esc(page.updatedTop)}</p>` : ''}
  </div>
  ${simple ? '' : heroData(page)}
  ${trust(h['Trust strip'])}
</section>`;
}

export function marquee(text) {
  // Editorial notes in brackets after the punchline ("… (δική μας πρόταση)") never reach the type.
  text = (text ?? '').replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (!text) return '';
  const unit = `<span>${esc(text)}</span><span class="marquee__star" aria-hidden="true">✳</span>`;
  return `<div class="big-marquee" aria-hidden="true" data-marquee="1"><div class="marquee__track">${unit.repeat(6)}</div></div>`;
}

export function ctaBand(cta, page, ctx) {
  if (!cta || !(cta['Τίτλος'] || cta.body?.length)) return '';
  const btns = cta['Κουμπιά'] ?? cta['Κουμπί'];
  // .cta__inner holds the copy only: three/wordmark.js measures its children to keep the 3D
  // wordmark clear of it. Decorative rows sit outside it.
  return `<section class="cta" aria-labelledby="cta-t" data-cta>
  <div class="cta__bg" aria-hidden="true"><span data-parallax="0.25">${esc(cta.Punchline ?? "Let's grow.")}</span></div>
  <div class="cta__stage" aria-hidden="true"><canvas class="cta__canvas" data-scene="wordmark" aria-hidden="true"></canvas></div>
  <div class="wrap cta__rail" aria-hidden="true"><span>GROW Agency — Media that matters</span><span>${esc(SITE.phone)} · ${esc(SITE.email)}</span><span class="coords">${COORDS}</span></div>
  <div class="wrap cta__inner">
    ${cta.Punchline ? `<p class="eyebrow eyebrow--dark"><span class="eyebrow__dot" aria-hidden="true"></span>${esc(cta.Punchline)}</p>` : ''}
    <h2 class="cta__title" id="cta-t" data-split>${fmt(cta['Τίτλος'] ?? '', ctx)}</h2>
    ${cta.body.map((p) => `<p class="cta__body">${fmt(p, ctx)}</p>`).join('')}
    ${buttons(btns, page)}
    ${cta.intl ? `<p class="cta__intl" lang="en">${fmt(cta.intl, ctx)}</p>` : ''}
  </div>
</section>`;
}

export function footer(shared, page) {
  const f = shared.footer;
  const legal = (f['Νομική γραμμή'] ?? '').split(' · ');
  const legalLinks = { 'Πολιτική απορρήτου': '/politiki-aporritou/', 'Όροι χρήσης': '/oroi-xrisis/', 'Πολιτική cookies': '/cookies/' };
  return `<footer class="site-footer">
  <div class="wrap">
    <div class="site-footer__top">
      <div class="site-footer__brand">
        ${logo(true)}
        <p>${fmt(f['Κείμενο brand'] ?? '')}</p>
        <ul class="badges">${(f.Partners ?? '').split(' · ').map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
      </div>
      <nav class="site-footer__col" aria-label="Υπηρεσίες"><h2>Υπηρεσίες</h2><ul>
        ${SERVICE_GROUPS.flatMap((g) => g.items).map(([l, u]) => `<li><a href="${u}">${esc(l)}</a></li>`).join('')}
        <li><a href="/ypiresies/">Όλες οι υπηρεσίες</a></li></ul></nav>
      <nav class="site-footer__col" aria-label="Εταιρεία"><h2>Εταιρεία</h2><ul>
        <li><a href="/etaireia/">Η εταιρεία</a></li><li><a href="/etaireia/omada/">Η ομάδα</a></li>
        <li><a href="/erga/">Έργα</a></li><li><a href="/blog/">Blog</a></li>
        <li><a href="/creators/">${esc(SHORT['/creators/'])}</a></li></ul>
        <h2>Λύσεις</h2><ul>${SOLUTIONS.map(([l, u]) => `<li><a href="${u}">${esc(l)}</a></li>`).join('')}</ul></nav>
      <div class="site-footer__col"><h2>Επικοινωνία</h2>
        <address>
          <a href="${SITE.mapsUrl}" rel="noopener">${esc(SITE.street)}, ${esc(SITE.postcode)} ${esc(SITE.city)}</a>
          <a class="big" href="tel:${SITE.tel}">${SITE.phone}</a>
          <a class="big" href="mailto:${SITE.email}">${SITE.email}</a>
        </address>
        <a class="arrow-link" href="/epikoinonia/#form">Στείλτε μας μήνυμα${ARROW}</a>
        <p class="site-footer__reviews">Κριτικές: ${fmt(f['Κριτικές'] ?? '')}</p>
      </div>
    </div>
    <p class="site-footer__intl" lang="en">${fmt(f['Για διεθνή brands'] ?? '')}</p>
  </div>
  <div class="site-footer__word" aria-hidden="true"><span data-footer-word>GROW<i>.</i></span></div>
  <div class="wrap site-footer__legal">
    <p>${legal.map((l) => (legalLinks[l] ? `<a href="${legalLinks[l]}">${esc(l)}</a>` : fmt(l))).join('<span aria-hidden="true"> · </span>')}</p>
    <button type="button" class="linkish" data-cookie-open>Ρυθμίσεις cookies</button>
    ${page.updated ? `<p>Τελευταία ενημέρωση: ${esc(page.updated)}</p>` : ''}
  </div>
</footer>`;
}

export function cookieBanner(shared) {
  const c = shared.cookie;
  const text = c._[0] ?? '';
  return `<div class="cookie" role="dialog" aria-modal="false" aria-labelledby="cookie-t" data-cookie data-lenis-prevent hidden>
  <h2 id="cookie-t" class="cookie__t">Cookies</h2>
  <p>${fmt(text, { url: '' })}</p>
  <form class="cookie__prefs" data-cookie-prefs hidden>
    <label class="switch"><input type="checkbox" checked disabled> <span>Απαραίτητα</span></label>
    <label class="switch"><input type="checkbox" name="analytics"> <span>Στατιστικά</span></label>
    <label class="switch"><input type="checkbox" name="marketing"> <span>Marketing</span></label>
  </form>
  <div class="cookie__btns">
    <button type="button" class="btn btn--primary btn--sm" data-consent="all"><span class="btn__label"><span data-text="Αποδοχή όλων">Αποδοχή όλων</span></span></button>
    <button type="button" class="btn btn--ghost btn--sm" data-consent="none"><span class="btn__label"><span data-text="Απόρριψη">Απόρριψη</span></span></button>
    <button type="button" class="btn btn--ghost btn--sm" data-consent="prefs"><span class="btn__label"><span data-text="Ρυθμίσεις">Ρυθμίσεις</span></span></button>
  </div>
</div>`;
}

// The contact form. Copy comes from the shared "Φόρμα επικοινωνίας" block, overridden
// by the contact page's own field list where it has one.
export function form(shared, blocks = []) {
  const f = shared.form;
  const find = (re) => blocks.map((b) => b.x).find((x) => re.test(x));
  const opts = (find(/^Υπηρεσία που σας ενδιαφέρει/) ?? '').replace(/^[^:]+:\s*/, '').split(' · ').filter(Boolean);
  const placeholder = (find(/^Μήνυμα \(placeholder\)/) ?? '').replace(/^[^:]+:\s*/, '').replace(/^«|»$/g, '') || f['Placeholder μηνύματος'];
  const consent = (find(/^Συγκατάθεση:/) ?? '').replace(/^[^:]+:\s*/, '') || f['Checkbox συγκατάθεσης'];
  const submit = (find(/^Κουμπί:/) ?? '').replace(/^[^:]+:\s*/, '') || f['Κουμπί'];
  // Without an endpoint the form posts to a mailto: URL (text/plain), so it still opens the
  // visitor's email app without JavaScript; src/js/form.js takes over (validation, mailto body)
  // and switches native validation off itself. Field errors: inline, from data-err-*.
  const action = SITE.formEndpoint || `mailto:${SITE.email}`;
  return `<form class="form" id="form" data-form action="${esc(action)}" method="post"${SITE.formEndpoint ? '' : ' enctype="text/plain"'}
    data-success="${esc(f['Μήνυμα επιτυχίας'])}" data-error="${esc(f['Μήνυμα σφάλματος'])}" data-mailto="${SITE.email}"
    data-err-required="Υποχρεωτικό πεδίο" data-err-email="Γράψτε ένα έγκυρο email" data-err-consent="Χρειάζεται η συγκατάθεσή σας">
  <div class="form__grid">
    <label class="field"><span class="field__l" data-scramble>Όνομα</span><input name="name" autocomplete="name" required><span class="field__line" aria-hidden="true"></span></label>
    <label class="field"><span class="field__l" data-scramble>Τηλέφωνο</span><input name="phone" type="tel" autocomplete="tel" inputmode="tel" required><span class="field__line" aria-hidden="true"></span></label>
    <label class="field field--full"><span class="field__l" data-scramble>Email</span><input name="email" type="email" autocomplete="email" required><span class="field__line" aria-hidden="true"></span></label>
    <fieldset class="field field--full field--chips"><legend class="field__l" data-scramble>Υπηρεσία που σας ενδιαφέρει</legend>
      <div class="opts">${opts.map((o, i) => `<label class="opt"><input type="checkbox" name="service" value="${esc(o)}"><span>${esc(o)}</span></label>`).join('')}</div>
    </fieldset>
    <label class="field field--full"><span class="field__l" data-scramble>Μήνυμα</span><textarea name="message" rows="4" placeholder="${esc(placeholder)}" required></textarea><span class="field__line" aria-hidden="true"></span></label>
    <label class="check field--full"><input type="checkbox" name="consent" required><span class="check__box" aria-hidden="true"></span><span>${fmt(consent, { url: '' })}</span></label>
    <input type="text" name="_gotcha" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">
  </div>
  <div class="form__foot">
    <button class="btn btn--primary btn--lg" type="submit" data-magnetic><span class="btn__label"><span data-text="${esc(submit)}">${esc(submit)}</span></span><span class="btn__icon" aria-hidden="true">→</span></button>
    <p class="form__status" role="status" aria-live="polite"></p>
  </div>
</form>`;
}

// The creator sign-up form (/creators/). Fields and options: lib/creators.mjs (GROUPS, CHANNELS);
// consent, button and messages: the bold field lines of the page's "Φόρμα creators" section,
// falling back to the shared contact-form copy. Same action / mailto behaviour as form():
// without an endpoint the markup posts to mailto: (text/plain, so it works without JS) and
// src/js/creators-form.js takes over with validation and a readable mail body.
export function creatorsForm(shared, blocks = []) {
  const f = shared.form;
  const field = (re) => (blocks.map((b) => b.x).find((x) => re.test(x)) ?? '').replace(/^[^:]+:\s*/, '');
  const consent = field(/^Συγκατάθεση:/) || f['Checkbox συγκατάθεσης'];
  const submit = field(/^Κουμπί:/) || f['Κουμπί'];
  const success = field(/^Μήνυμα επιτυχίας:/) || f['Μήνυμα επιτυχίας'];
  const error = field(/^Μήνυμα σφάλματος:/) || f['Μήνυμα σφάλματος'];
  const noChannel = field(/^Μήνυμα χωρίς κανάλι:/) || 'Συμπληρώστε τουλάχιστον ένα κανάλι με τον αριθμό των followers.';
  const action = SITE.formEndpoint || `mailto:${SITE.email}`;
  const total = pad(GROUPS.length);
  const REQ = '<span class="req" aria-hidden="true">*</span>';
  const hint = (id, text) => (text ? `<span class="field__hint" id="${id}-h">${esc(text)}</span>` : '');
  const describe = (id, text) => (text ? ` aria-describedby="${id}-h"` : '');

  // Text-like inputs and textareas. The label and the hint sit outside the control's box so the
  // lime focus line (.field__line) runs under the control itself.
  const input = (x, full) => {
    const id = `cf-${x.name}`;
    const attrs = [
      x.autocomplete ? `autocomplete="${x.autocomplete}"` : '',
      x.inputmode ? `inputmode="${x.inputmode}"` : '',
      x.placeholder ? `placeholder="${esc(x.placeholder)}"` : '',
      x.required ? 'required' : '',
      describe(id, x.hint).trim(),
    ].filter(Boolean).join(' ');
    const control = x.type === 'textarea'
      ? `<textarea id="${id}" name="${x.name}" rows="${x.rows ?? 3}" ${attrs}></textarea>`
      : `<input id="${id}" name="${x.name}" type="${x.type}" ${attrs}>`;
    return `<div class="field${full ? ' field--full' : ''}" data-label="${esc(x.label)}">
      <label class="field__l" for="${id}" data-scramble>${esc(x.label)}${x.required ? REQ : ''}</label>
      <span class="field__in">${control}<span class="field__line" aria-hidden="true"></span></span>
      ${hint(id, x.hint)}</div>`;
  };

  // Chips: checkboxes, or radios when the field takes one answer (single: true). A required radio
  // group carries `required` on its inputs (native validation without JS); a required checkbox
  // group is checked by creators-form.js (data-required: at least one).
  const chips = (x) => {
    const id = `cf-${x.name}`;
    const type = x.single ? 'radio' : 'checkbox';
    return `<fieldset class="field field--full field--chips${x.single ? ' field--single' : ''}" id="${id}" data-chips data-label="${esc(x.label)}"${x.required ? ' data-required' : ''}${describe(id, x.hint)}>
      <legend class="field__l" data-scramble>${esc(x.label)}${x.required ? REQ : ''}</legend>
      ${hint(id, x.hint)}
      <div class="opts${x.single ? ' opts--single' : ''}">${x.options
        .map((o) => `<label class="opt"><input type="${type}" name="${x.name}" value="${esc(o)}"${x.single && x.required ? ' required' : ''}><span>${esc(o)}</span></label>`)
        .join('')}</div>
    </fieldset>`;
  };

  // Channels: one row per platform (handle or link + followers); the last row names its platform.
  const channels = () => {
    const cell = (name, label, placeholder, extra = '') => `<label class="field"><span class="field__l sr">${esc(label)}</span>
        <span class="field__in"><input name="${name}" type="text" placeholder="${esc(placeholder)}" autocomplete="off" ${extra}><span class="field__line" aria-hidden="true"></span></span></label>`;
    const rows = CHANNELS.map((c) => {
      const name = c.nameField
        ? cell(`ch_${c.key}_name`, c.label, c.placeholder, 'class="chrow__name-in"')
        : `<span class="chrow__name">${esc(c.label)}</span>`;
      return `<div class="chrow${c.nameField ? ' chrow--other' : ''}" data-chrow data-label="${esc(c.label)}">
        ${name}
        ${cell(`ch_${c.key}`, `${c.label}: handle ή link`, c.nameField ? '@username ή link' : c.placeholder, 'autocapitalize="none" spellcheck="false" data-handle')}
        ${cell(`ch_${c.key}_followers`, `${c.label}: followers`, 'Followers', 'inputmode="numeric" data-followers')}
      </div>`;
    }).join('');
    return `<fieldset class="field field--full channels" id="cf-channels" data-channels data-err-channel="${esc(noChannel)}">
      <legend class="field__l" data-scramble>Κανάλια${REQ}</legend>
      <div class="chrows">
        <div class="chrow chrow--head" aria-hidden="true"><span>Κανάλι</span><span>Handle / link</span><span>Followers</span></div>
        ${rows}
      </div>
    </fieldset>`;
  };

  // A group's fields: text inputs pair up in the two-column grid; one left on its own, chips,
  // textareas, links and the channel block take the full width.
  const grid = (g) => {
    const half = (x) => ['text', 'email', 'tel'].includes(x.type);
    const out = [];
    if (g.type === 'channels') out.push(channels());
    for (let i = 0; i < g.fields.length; i++) {
      const x = g.fields[i];
      if (x.type === 'chips') { out.push(chips(x)); continue; }
      let run = 0;
      if (half(x)) { let j = i; while (g.fields[j] && half(g.fields[j])) { run++; j++; } }
      out.push(input(x, !half(x) || run === 1));
      if (run > 1) { for (let k = 1; k < run; k++) out.push(input(g.fields[i + k], false)); i += run - 1; }
    }
    return out.join('\n');
  };

  // data-label / data-group carry the plain titles for the mail body (creators-form.js): the
  // visible labels are [data-scramble] and may be mid-animation when the form is submitted.
  const groups = GROUPS.map((g, i) => `<section class="fgroup" id="cf-g-${g.id}" aria-labelledby="cf-g-${g.id}-t" data-group="${pad(i + 1)}" data-label="${esc(g.title)}">
    <header class="fgroup__head">
      <span class="fgroup__n" data-scramble>${pad(i + 1)} / ${total}</span>
      <div><h3 class="fgroup__t" id="cf-g-${g.id}-t">${esc(g.title)}</h3>${g.hint ? `<p class="fgroup__hint">${esc(g.hint)}</p>` : ''}</div>
    </header>
    <div class="form__grid">${grid(g)}</div>
  </section>`).join('\n');

  return `<form class="form form--creators" id="${CREATORS_FORM_ID}" data-form="creators" action="${esc(action)}" method="post"${SITE.formEndpoint ? '' : ' enctype="text/plain"'}
    data-success="${esc(success)}" data-error="${esc(error)}" data-mailto="${SITE.email}" data-subject="${esc(CREATORS_MAIL_SUBJECT)}"
    data-err-required="Υποχρεωτικό πεδίο" data-err-email="Γράψτε ένα έγκυρο email" data-err-consent="Χρειάζεται η συγκατάθεσή σας"
    data-err-choice="Διαλέξτε μία επιλογή" data-err-choices="Διαλέξτε τουλάχιστον μία επιλογή">
  <div class="form__progress" aria-hidden="true"><span><b data-form-step>01</b> / ${total}</span></div>
  <p class="form__legend">${REQ} Υποχρεωτικό πεδίο</p>
  ${groups}
  <div class="fgroup fgroup--consent">
    <label class="check"><input type="checkbox" name="consent" required><span class="check__box" aria-hidden="true"></span><span>${fmt(consent, { url: '' })}</span></label>
    <input type="text" name="_gotcha" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">
  </div>
  <div class="form__foot">
    <button class="btn btn--primary btn--lg" type="submit" data-magnetic><span class="btn__label"><span data-text="${esc(submit)}">${esc(submit)}</span></span><span class="btn__icon" aria-hidden="true">→</span></button>
    <p class="form__status" role="status" aria-live="polite"></p>
  </div>
</form>`;
}

export function notFound(shared) {
  const n = shared.notFound;
  return `<section class="hero hero--404" data-hero>
  ${heroStage('blocks')}
  ${heroGrid}
  ${heroHud('blocks', '404')}
  <div class="wrap hero__inner">
    <p class="eyebrow" data-hero-in><span class="eyebrow__dot" aria-hidden="true"></span>Error 404</p>
    <h1 class="hero__title" data-split="hero" data-depth="${DEPTH.title}">${esc(n['Τίτλος'])}</h1>
    ${layer(DEPTH.sub, `<p class="hero__sub" data-hero-in>${esc(n._[0] ?? '')}</p>`)}
    ${layer(DEPTH.buttons, `<div class="hero__cta" data-hero-in>${buttons(n['Κουμπιά'], {})}</div>`)}
  </div></section>`;
}

// First-visit preloader (motion/preloader.js). Hidden unless <html> has `js motion is-loading`,
// which the <head> script sets once per session.
export function preloader() {
  return `<div class="preloader" aria-hidden="true">
  <div class="preloader__mid"><span class="preloader__word">GROW<i>.</i></span></div>
  <div class="preloader__foot wrap"><span class="preloader__tag">Media that matters</span><span class="preloader__count"><b data-preloader-count>000</b>%</span></div>
  <span class="preloader__bar"><i></i></span>
</div>`;
}
