// Landing pages (content/landings/*.html): a design kept exactly as drawn, with the site's own
// motion on top. Same modules as the main site (smooth scroll, split titles, reveals, 3D card
// flip-in + drift, tilt, magnetic buttons, cursor, scramble labels, counters, countdown), driven by
// the same data-* hooks; none of the site's layout CSS, so the design's inline styles are untouched.
// Plus the cookie consent + GA and a small handler for the design's demo form.
import { initSmooth, settle, jumpTo, refreshSoon } from './motion/smooth.js';
import { initVelocity } from './motion/velocity.js';
import { initReveals } from './motion/reveals.js';
import { initPointer } from './motion/pointer.js';
import { initUi } from './motion/ui.js';
import { root } from './motion/util.js';
import './motion/ease.js';
import { initCookies } from './cookies.js';
import { initAnalytics } from './analytics.js';

const run = (name, fn) => {
  try { fn(); return true; } catch (e) { console.warn(`[grow] ${name} failed`, e); return false; }
};

// Same-page links ("#times", "#demo") glide there with the smooth scroll.
function initAnchors() {
  document.addEventListener('click', (e) => {
    const a = e.target instanceof Element && e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href').length < 2 || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
    if (!jumpTo(a.getAttribute('href'))) return;
    e.preventDefault();
    history.replaceState(null, '', a.getAttribute('href'));
  });
}

// The design's demo form: name and email are needed (plus phone or email to reach them back),
// then the visitor's email app opens with the request filled in, or it posts to the endpoint when
// the site has one (build-time `action`). Errors and the result show in a line under the button.
function initLandingForm() {
  const form = document.querySelector('form[data-landing-form]');
  if (!form) return;
  form.noValidate = true;
  const btn = form.querySelector('[type="submit"]');
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.style.cssText = 'margin: 0; font-size: 14px; line-height: 1.5';
  status.hidden = true; // takes no room in the form's flex gap until there is something to say
  btn.after(status);
  const say = (msg, ok) => { status.hidden = false; status.textContent = msg; status.style.color = ok ? '#CCFF00' : '#FF3D2E'; };
  const field = (name) => form.elements.namedItem(name);
  const flag = (el, bad) => {
    if (!el) return;
    el.style.borderColor = bad ? '#FF3D2E' : '';
    if (bad) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
  };
  form.addEventListener('input', (e) => { if (e.target.getAttribute?.('aria-invalid')) flag(e.target, false); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = field('name');
    const email = field('email');
    const bad = [];
    if (!name.value.trim()) bad.push(name);
    if (!/^\S+@\S+\.\S+$/.test(email.value.trim())) bad.push(email);
    [name, email].forEach((el) => flag(el, bad.includes(el)));
    if (bad.length) {
      say(bad.includes(email) && email.value.trim() ? 'Γράψτε ένα έγκυρο email.' : 'Συμπληρώστε ονοματεπώνυμο και email.', false);
      bad[0].focus();
      return;
    }
    const data = new FormData(form);
    const action = form.getAttribute('action') || '';
    if (/^https?:|^\//.test(action)) {
      try {
        const res = await fetch(action, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(res.status);
        form.reset();
        say('Ευχαριστούμε! Θα σας καλέσουμε για να κλείσουμε το demo.', true);
      } catch {
        say(`Κάτι πήγε στραβά. Γράψτε μας στο ${form.dataset.mailto} ή καλέστε στο 210 9713335.`, false);
      }
      return;
    }
    const type = data.get('type');
    const body = [
      `Ονοματεπώνυμο: ${data.get('name')}`, `Επιχείρηση: ${data.get('company') || '-'}`,
      `Email: ${data.get('email')}`, `Τηλέφωνο: ${data.get('phone') || '-'}`,
      `Είδος επιχείρησης: ${type && type !== 'Επιλέξτε' ? type : '-'}`, '',
      `Πώς κλείνουμε ραντεβού σήμερα: ${data.get('message') || '-'}`,
    ].join('\n');
    location.href = `mailto:${form.dataset.mailto}?subject=${encodeURIComponent(`${form.dataset.subject} – ${data.get('name')}`)}&body=${encodeURIComponent(body)}`;
    say(`Ανοίγει το email σας με το αίτημα έτοιμο. Αν δεν άνοιξε, γράψτε μας στο ${form.dataset.mailto} ή καλέστε στο 210 9713335.`, true);
  });
}

// Calendly inline booking (iframe[data-calendly], "Book a call"): the frame takes the height the
// booking page reports (it grows on phones and on the details step), and a booked call is sent to
// GA as a lead, which only exists once the visitor has allowed statistics cookies.
function initCalendly() {
  const frames = [...document.querySelectorAll('iframe[data-calendly]')];
  if (!frames.length) return;
  addEventListener('message', (e) => {
    if (e.origin !== 'https://calendly.com' || typeof e.data?.event !== 'string') return;
    const frame = frames.find((f) => f.contentWindow === e.source);
    if (!frame) return;
    if (e.data.event === 'calendly.page_height') {
      const h = parseInt(e.data.payload?.height, 10);
      if (h > 400 && Math.abs(h - frame.offsetHeight) > 4) { frame.style.height = `${h}px`; refreshSoon(); }
    } else if (e.data.event === 'calendly.event_scheduled') {
      window.gtag?.('event', 'generate_lead', { method: 'calendly', page_path: location.pathname });
    }
  });
}

if (!window.__growBooted) {
  window.__growBooted = true;
  const motionOk = run('motion', () => {
    initSmooth();
    initVelocity();
    initReveals();
    initPointer();
    initUi();
    settle();
  });
  if (!motionOk) {
    root.classList.remove('motion');
    root.classList.add('no-motion', 'motion-failed');
  }
  run('anchors', initAnchors);
  run('form', initLandingForm);
  run('calendly', initCalendly);
  run('analytics', initAnalytics);
  run('cookies', initCookies);
}
window.__growReady = true;
