// Contact form: client-side validation, then POST to SITE.formEndpoint (build-time `action`).
// Without an endpoint the markup's action is a mailto: URL (so the form still works without JS);
// here the visitor's email app opens with the message pre-filled, so no lead is lost.
// Errors: each invalid field gets an inline message (aria-describedby, text from the form's
// data-err-* attributes) and stays red until it is valid; the status line under the button sums up
// and clears itself once everything is fixed.
export function initForm(form) {
  if (!form) return;
  form.noValidate = true; // our own messages replace the browser's bubbles (set here, so no-JS keeps native checks)
  const status = form.querySelector('.form__status');
  const say = (msg, ok) => {
    status.textContent = msg;
    status.className = `form__status ${ok ? 'is-ok' : 'is-err'}`;
  };
  const clearStatus = () => {
    if (!status.classList.contains('is-err')) return;
    status.textContent = '';
    status.className = 'form__status';
  };

  const problem = (el) => {
    if (el.type === 'checkbox') return el.checked ? '' : 'consent';
    if (!el.value.trim()) return 'required';
    if (el.type === 'email' && !/^\S+@\S+\.\S+$/.test(el.value.trim())) return 'email';
    return '';
  };
  const message = (kind) => form.dataset[`err${kind[0].toUpperCase()}${kind.slice(1)}`] || form.dataset.errRequired || '';

  // Marks one field valid / invalid, with its inline message.
  const mark = (el, kind) => {
    const wrap = el.closest('.field, .check');
    if (!wrap) return;
    const id = `${el.name || 'field'}-err`;
    let err = wrap.querySelector('.field__err');
    wrap.classList.toggle('is-invalid', !!kind);
    if (kind) {
      el.setAttribute('aria-invalid', 'true');
      if (!err) {
        err = document.createElement('span');
        err.className = 'field__err';
        err.id = id;
        wrap.append(err);
      }
      err.textContent = message(kind);
      const ids = new Set((el.getAttribute('aria-describedby') || '').split(' ').filter(Boolean));
      ids.add(id);
      el.setAttribute('aria-describedby', [...ids].join(' '));
    } else {
      el.removeAttribute('aria-invalid');
      err?.remove();
      const ids = (el.getAttribute('aria-describedby') || '').split(' ').filter((x) => x && x !== id);
      if (ids.length) el.setAttribute('aria-describedby', ids.join(' '));
      else el.removeAttribute('aria-describedby');
    }
  };

  const required = () => [...form.querySelectorAll('[required]')];
  const validate = () => {
    let first = null;
    for (const el of required()) {
      const kind = problem(el);
      mark(el, kind);
      if (kind && !first) first = el;
    }
    return first;
  };

  // While correcting: a field that was flagged is re-checked as the visitor types, and the summary
  // goes away once nothing is flagged any more.
  const recheck = (e) => {
    const el = e.target;
    if (!(el instanceof HTMLElement) || !el.hasAttribute('required')) return;
    if (!el.closest('.is-invalid')) return;
    mark(el, problem(el));
    if (!form.querySelector('.is-invalid')) clearStatus();
  };
  form.addEventListener('input', recheck);
  form.addEventListener('change', recheck);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const first = validate();
    if (first) {
      say('Συμπληρώστε τα πεδία που λείπουν.', false);
      first.focus({ preventScroll: true });
      // The first problem in view, with room above it for the label (the header is fixed).
      const target = first.closest('.field, .check') ?? first;
      const top = target.getBoundingClientRect().top;
      const header = document.querySelector('[data-header]')?.offsetHeight ?? 72;
      if (top < header + 16 || top > innerHeight * 0.7) {
        window.scrollTo({ top: Math.max(0, scrollY + top - header - 32), behavior: 'auto' });
      }
      return;
    }
    clearStatus();
    const data = new FormData(form);
    if (data.get('_gotcha')) return;
    const services = data.getAll('service').join(', ');
    const action = form.getAttribute('action') || '';
    const endpoint = /^https?:|^\//.test(action) ? action : '';

    if (!endpoint) {
      const body = [
        `Όνομα: ${data.get('name')}`, `Τηλέφωνο: ${data.get('phone')}`, `Email: ${data.get('email')}`,
        `Υπηρεσία: ${services || '-'}`, '', data.get('message'),
      ].join('\n');
      location.href = `mailto:${form.dataset.mailto}?subject=${encodeURIComponent('Αίτημα προσφοράς – ' + data.get('name'))}&body=${encodeURIComponent(body)}`;
      // We can't know whether the email app opened, so don't claim the message was sent.
      say(`Ανοίγει το email σας με το μήνυμα έτοιμο. Αν δεν άνοιξε, γράψτε μας στο ${form.dataset.mailto} ή καλέστε στο 210 9713335.`, true);
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
}
