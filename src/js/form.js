// Contact form: client-side validation, then POST to SITE.formEndpoint (build-time `action`).
// Without an endpoint the visitor's email app opens with the message pre-filled, so no lead is lost.
export function initForm(form) {
  if (!form) return;
  const status = form.querySelector('.form__status');
  const say = (msg, ok) => {
    status.textContent = msg;
    status.className = `form__status ${ok ? 'is-ok' : 'is-err'}`;
  };

  const validate = () => {
    let first = null;
    for (const el of form.querySelectorAll('[required]')) {
      const bad = el.type === 'checkbox' ? !el.checked : !el.value.trim() || (el.type === 'email' && !/^\S+@\S+\.\S+$/.test(el.value));
      el.closest('.field, .check')?.classList.toggle('is-invalid', bad);
      el.setAttribute('aria-invalid', String(bad));
      if (bad && !first) first = el;
    }
    return first;
  };
  form.addEventListener('input', (e) => {
    const wrap = e.target.closest('.is-invalid');
    if (wrap) { wrap.classList.remove('is-invalid'); e.target.removeAttribute('aria-invalid'); }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const first = validate();
    if (first) {
      say('Συμπληρώστε τα πεδία που λείπουν.', false);
      first.focus();
      return;
    }
    const data = new FormData(form);
    if (data.get('_gotcha')) return;
    const services = data.getAll('service').join(', ');
    const endpoint = form.getAttribute('action');

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
