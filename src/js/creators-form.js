// Creator sign-up form (/creators/, markup: lib/layout.mjs creatorsForm(), fields: lib/creators.mjs).
// Same contract as the contact form (form.js): inline errors from the form's data-err-*
// attributes, a status line, then a POST to the endpoint or, without one, the visitor's email app
// with the profile written out. On top of that:
//   * required chip groups (fieldset[data-required]): at least one checked, the error sits on
//     the fieldset (radios in `single` mode, checkboxes otherwise);
//   * the channel block (fieldset[data-channels]): at least one row with a handle / link and a
//     followers number; message from its data-err-channel; the first channel input gets focus;
//   * the mail body lists every filled field, grouped by section, as readable Greek text
//     (subject: data-subject + " – " + name); `grow:form-mail` on the form carries both;
//   * a sticky "03 / 06" progress hint ([data-form-step]) while scrolling the form on desktop.
import { statusLine, marker, showProblem } from './form.js';

const EMAIL = /^\S+@\S+\.\S+$/;
const text = (el) => (el?.value ?? '').trim();

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
      form.dispatchEvent(new CustomEvent('grow:form-mail', { detail: { subject, body } }));
      location.href = `mailto:${form.dataset.mailto}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      // We can't know whether the email app opened, so don't claim the profile was sent.
      say(`Ανοίγει το email σας με το προφίλ έτοιμο. Αν δεν άνοιξε, γράψτε μας στο ${form.dataset.mailto}.`, true);
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

// The plain-text profile for the email app: "01 / Ποιοι είστε", then "Label: value" per filled
// field; channels as "Instagram: @handle — 12.000 followers"; chips joined with commas. Labels
// come from data-label (the visible ones are [data-scramble] and may be mid-animation).
export function composeBody(form) {
  const label = (el) => el?.dataset.label ?? '';
  const lines = [];
  for (const g of form.querySelectorAll('.fgroup[data-group]')) {
    const out = [];
    for (const el of g.querySelectorAll('.form__grid > *')) {
      if (el.matches('[data-channels]')) {
        for (const row of el.querySelectorAll('[data-chrow]')) {
          const handle = text(row.querySelector('[data-handle]'));
          const n = text(row.querySelector('[data-followers]'));
          const nameIn = row.querySelector('.chrow__name-in');
          const name = (nameIn ? text(nameIn) : '') || label(row);
          if (!handle && !n && !(nameIn && text(nameIn))) continue;
          out.push(`${name}: ${handle || '–'}${n ? ` — ${n} followers` : ''}`);
        }
      } else if (el.matches('[data-chips]')) {
        const picked = [...el.querySelectorAll('input:checked')].map((i) => i.value);
        if (picked.length) out.push(`${label(el)}: ${picked.join(', ')}`);
      } else {
        const v = text(el.querySelector('input, textarea'));
        if (v) out.push(`${label(el)}: ${v}`);
      }
    }
    if (out.length) lines.push(`${g.dataset.group} / ${label(g)}`, ...out, '');
  }
  lines.push('Συγκατάθεση: ναι');
  return lines.join('\n');
}

// "03 / 06": the group whose top has passed 40% of the viewport (desktop only; the pill is hidden
// on phones by CSS, so nothing runs there).
function initProgress(form) {
  const step = form.querySelector('[data-form-step]');
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
