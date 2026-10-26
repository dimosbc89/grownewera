// Creator sign-up form (/creators/, markup: lib/layout.mjs creatorsForm(), fields: lib/creators.mjs).
// Same contract as the contact form (form.js): inline errors from the form's data-err-*
// attributes, a status line, then a POST to the endpoint or, without one, the visitor's email app
// with the profile written out. On top of that:
//   * required chip groups (fieldset[data-required]): at least one checked, the error sits on
//     the fieldset (radios in `single` mode, checkboxes otherwise);
//   * the channel block (fieldset[data-channels]): at least one row with a handle / link and a
//     followers number; message from its data-err-channel; the first channel input gets focus;
//   * the mail body lists every filled field, grouped by section, as readable Greek text
//     (subject: data-subject + " – " + name); the mailto: URL is kept under MAILTO_MAX (older
//     Windows mail handlers cut or drop longer ones), so the full profile also appears on the page
//     in a read-only box with a copy button; `grow:form-mail` on the form carries
//     { subject, body, url, truncated };
//   * a "03 / 06" progress hint ([data-form-step], in the section's sticky heading) while
//     scrolling the form on desktop.
import { statusLine, marker, showProblem } from './form.js';

const EMAIL = /^\S+@\S+\.\S+$/;
const text = (el) => (el?.value ?? '').trim();
// Longest mailto: URL we hand to the email app. Greek encodes to six characters per letter, so a
// full profile easily passes 4,000; classic Outlook / Windows handlers truncate above ~2,000.
const MAILTO_MAX = 1900;

// A channel row counts once it has both a handle (or link) and a followers number.
const rowFilled = (row) => !!text(row.querySelector('[data-handle]')) && /\d/.test(text(row.querySelector('[data-followers]')));
const channelsOk = (fs) => [...fs.querySelectorAll('[data-chrow]')].some(rowFilled);

export function initCreatorsForm(form) {
  if (!form) return;
  form.noValidate = true; // our own messages replace the browser's bubbles (no JS keeps the native checks)
  const { say, clearStatus } = statusLine(form);
  const { mark } = marker(form);

  // What can be wrong with one checkable thing: a control, a chip fieldset or the channel block.
  const problem = (el) => {
    if (el.matches('fieldset[data-channels]')) return channelsOk(el) ? '' : 'channel';
    if (el.matches('fieldset[data-required]')) return el.querySelector('input:checked') ? '' : el.classList.contains('field--single') ? 'choice' : 'choices';
    if (el.type === 'checkbox') return el.checked ? '' : 'consent';
    if (!text(el)) return 'required';
    if (el.type === 'email' && !EMAIL.test(text(el))) return 'email';
    return '';
  };
  const flag = (el, kind) => mark(el, kind, kind === 'channel' ? el.dataset.errChannel : undefined);
  // Required radios are validated through their fieldset (data-required), not one by one.
  const checkable = () => [...form.querySelectorAll('[required]:not([type="radio"]), fieldset[data-required], fieldset[data-channels]')];
  // The thing a control's validity belongs to: its chip group / channel block, else itself.
  const owner = (el) => el.closest('fieldset[data-required], fieldset[data-channels]') ?? el;

  const validate = () => {
    let first = null;
    for (const el of checkable()) {
      const kind = problem(el);
      flag(el, kind);
      if (kind && !first) first = el;
    }
    return first;
  };

  // While correcting: a flagged field (or group) is re-checked as the visitor types / picks, and
  // the summary goes away once nothing is flagged any more.
  const recheck = (e) => {
    const el = e.target;
    if (!(el instanceof HTMLElement)) return;
    const o = owner(el);
    if (o === el && !el.hasAttribute('required')) return;
    if (!o.closest('.is-invalid')) return;
    flag(o, problem(o));
    if (!form.querySelector('.is-invalid')) clearStatus();
  };
  form.addEventListener('input', recheck);
  form.addEventListener('change', recheck);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const first = validate();
    if (first) {
      say('Συμπληρώστε τα πεδία που λείπουν.', false);
      // A group: its first input takes the focus (the channel block: the first handle input).
      const target = first.matches('fieldset') ? first.querySelector('input:not([type="hidden"])') : first;
      target?.focus({ preventScroll: true });
      showProblem(first);
      return;
    }
    clearStatus();
    const data = new FormData(form);
    if (data.get('_gotcha')) return;
    const action = form.getAttribute('action') || '';
    const endpoint = /^https?:|^\//.test(action) ? action : '';

    if (!endpoint) {
      const subject = `${form.dataset.subject || 'Προφίλ creator'} – ${data.get('name')}`;
      const body = composeBody(form);
      const { url, truncated } = mailtoUrl(form, subject, body);
      form.dispatchEvent(new CustomEvent('grow:form-mail', { detail: { subject, body, url, truncated } }));
      showProfile(form, body);
      location.href = url;
      // We can't know whether the email app opened, so don't claim the profile was sent; nothing
      // leaves the page until the visitor presses Send there.
      say(`Ανοίγει η εφαρμογή email σας με το προφίλ έτοιμο. Πατήστε «Αποστολή» για να το λάβουμε. Αν δεν άνοιξε, γράψτε μας στο ${form.dataset.mailto}.${
        truncated ? ' Στο email χώρεσαν μόνο τα βασικά: αντιγράψτε το πλήρες προφίλ από το πεδίο παρακάτω και επικολλήστε το στο μήνυμα.' : ''}`, true);
      return;
    }

    form.classList.add('is-sending');
    try {
      const res = await fetch(endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(res.status);
      form.reset();
      say(form.dataset.success, true);
    } catch {
      say(form.dataset.error, false);
    } finally {
      form.classList.remove('is-sending');
    }
  });

  initProgress(form);
}

// The filled-in profile as entries { group: '01', title, line, long }: one "Label: value" line per
// filled field, channels as "Instagram: @handle — 12.000 followers" ("12.000 followers (χωρίς
// handle)" when only the number is given), chips joined with commas, the extra lines of a textarea
// indented by two spaces so the "Label: value" structure survives. Labels come from data-label
// (the visible ones are [data-scramble] and may be mid-animation); a label's own closing
// punctuation (";", ":", "?") makes way for the colon.
function profileEntries(form) {
  const label = (el) => (el?.dataset.label ?? '').replace(/[;:?]\s*$/, '');
  const entries = [];
  for (const g of form.querySelectorAll('.fgroup[data-group]')) {
    const group = g.dataset.group;
    const title = label(g);
    const push = (line, long = false) => entries.push({ group, title, line, long });
    for (const el of g.querySelectorAll('.form__grid > *')) {
      if (el.matches('[data-channels]')) {
        for (const row of el.querySelectorAll('[data-chrow]')) {
          const handle = text(row.querySelector('[data-handle]'));
          const n = text(row.querySelector('[data-followers]'));
          const nameIn = row.querySelector('.chrow__name-in');
          const name = (nameIn ? text(nameIn) : '') || label(row);
          if (!handle && !n && !(nameIn && text(nameIn))) continue;
          const followers = n ? `${n} followers` : '';
          if (handle) push(`${name}: ${handle}${followers ? ` — ${followers}` : ''}`);
          else push(`${name}: ${followers ? `${followers} (χωρίς handle)` : '–'}`);
        }
      } else if (el.matches('[data-chips]')) {
        const picked = [...el.querySelectorAll('input:checked')].map((i) => i.value);
        if (picked.length) push(`${label(el)}: ${picked.join(', ')}`);
      } else {
        const control = el.querySelector('input, textarea');
        const v = text(control);
        if (v) push(`${label(el)}: ${v.replace(/\r?\n/g, '\n  ')}`, control.tagName === 'TEXTAREA');
      }
    }
  }
  return entries;
}

// Entries -> plain text: "01 / Τα στοιχεία σας", its lines, a blank line per group, an optional
// note, and the consent last.
function renderBody(entries, note = '') {
  const lines = [];
  let cur = '';
  for (const e of entries) {
    if (e.group !== cur) {
      if (cur) lines.push('');
      lines.push(`${e.group} / ${e.title}`);
      cur = e.group;
    }
    lines.push(e.line);
  }
  if (note) lines.push('', note);
  lines.push('', 'Συγκατάθεση: ναι');
  return lines.join('\n');
}

// The complete plain-text profile (the copy box, and the mail body when it fits).
export function composeBody(form) {
  return renderBody(profileEntries(form));
}

// The mailto: URL, kept under MAILTO_MAX when the full profile does not fit: long answers
// (textareas) go first, then the last lines, never the first two groups (who you are, where you
// publish); a note tells the reader the rest follows, pasted from the copy box.
export function mailtoUrl(form, subject, body) {
  const url = (b) => `mailto:${form.dataset.mailto}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(b)}`;
  const full = url(body);
  if (full.length <= MAILTO_MAX) return { url: full, truncated: false };
  const note = 'Το πλήρες προφίλ μου, από κάτω:'; // short: every Greek letter costs six URL characters
  const entries = profileEntries(form);
  let out = url(renderBody(entries, note));
  while (out.length > MAILTO_MAX) {
    const droppable = entries.map((e, i) => i).filter((i) => entries[i].group > '02');
    if (!droppable.length) break;
    const longs = droppable.filter((i) => entries[i].long);
    entries.splice((longs.length ? longs : droppable).at(-1), 1);
    out = url(renderBody(entries, note));
  }
  return { url: out, truncated: true };
}

// The full profile on the page, under the status line: a read-only box with a copy button, so
// nothing is lost when the email app cuts the body or does not open.
function showProfile(form, body) {
  let box = form.querySelector('.form__copy');
  if (!box) {
    box = document.createElement('div');
    box.className = 'form__copy';
    box.innerHTML = `<label class="field__l" for="cf-profile">Το πλήρες προφίλ σας σε κείμενο</label>
      <p>Αν το email δεν άνοιξε ή δεν έχει ολόκληρο το προφίλ, αντιγράψτε το από εδώ και στείλτε το στο ${form.dataset.mailto}.</p>
      <textarea id="cf-profile" rows="12" readonly spellcheck="false"></textarea>
      <div class="form__copy-foot">
        <button class="btn btn--ghost btn--sm" type="button"><span class="btn__label"><span data-text="Αντιγραφή">Αντιγραφή</span></span></button>
        <span class="form__copy-note" role="status" aria-live="polite"></span>
      </div>`;
    form.querySelector('.form__foot').after(box);
    const ta = box.querySelector('textarea');
    const note = box.querySelector('.form__copy-note');
    box.querySelector('button').addEventListener('click', async () => {
      let ok = false;
      try { await navigator.clipboard.writeText(ta.value); ok = true; } catch { /* no clipboard API (http, old browser): select for a manual copy */ }
      if (!ok) { ta.select(); try { ok = document.execCommand('copy'); } catch { /* stays selected */ } }
      note.textContent = ok ? 'Αντιγράφηκε.' : 'Το κείμενο είναι επιλεγμένο: πατήστε Ctrl+C ή ⌘C.';
    });
  }
  box.querySelector('textarea').value = body;
}

// "03 / 06": the group whose top has passed 40% of the viewport (desktop only; the HUD in the
// section's sticky heading is hidden on phones by CSS, so nothing runs there).
function initProgress(form) {
  const step = (form.closest('.sec') ?? document).querySelector('[data-form-step]');
  const groups = [...form.querySelectorAll('.fgroup[data-group]')];
  if (!step || !groups.length || !matchMedia('(min-width: 901px)').matches) return;
  let cur = '';
  const update = () => {
    const line = innerHeight * 0.4;
    let active = groups[0];
    for (const g of groups) if (g.getBoundingClientRect().top <= line) active = g;
    const v = active.dataset.group;
    if (v !== cur) {
      cur = v;
      step.textContent = v;
    }
  };
  let raf = 0;
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); }); }, { passive: true });
  update();
}
