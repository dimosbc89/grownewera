// Cookie consent: nothing non-essential runs until the visitor chooses.
// Read the choice anywhere with window.growConsent ({ analytics, marketing }) or listen for
// the 'grow:consent' event to load analytics/ads tags after consent.
const KEY = 'grow-consent';
const MAX_AGE = 1000 * 60 * 60 * 24 * 180; // re-ask after ~6 months

export function initCookies() {
  const box = document.querySelector('[data-cookie]');
  if (!box) return;
  const prefs = box.querySelector('[data-cookie-prefs]');
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY)); } catch {}
  if (saved && Date.now() - saved.at < MAX_AGE) apply(saved);
  else box.hidden = false;

  function apply(choice) {
    window.growConsent = { analytics: !!choice.analytics, marketing: !!choice.marketing };
    window.dispatchEvent(new CustomEvent('grow:consent', { detail: window.growConsent }));
  }
  function save(choice) {
    const value = { ...choice, at: Date.now() };
    try { localStorage.setItem(KEY, JSON.stringify(value)); } catch {}
    apply(value);
    box.hidden = true;
  }

  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-consent]');
    if (!b) return;
    const kind = b.dataset.consent;
    if (kind === 'all') save({ analytics: true, marketing: true });
    else if (kind === 'none') save({ analytics: false, marketing: false });
    else if (prefs.hidden) {
      prefs.hidden = false;
      b.querySelector('[data-text]').textContent = 'Αποθήκευση';
    } else save({ analytics: prefs.analytics.checked, marketing: prefs.marketing.checked });
  });

  document.querySelectorAll('[data-cookie-open]').forEach((b) =>
    b.addEventListener('click', () => {
      prefs.hidden = false;
      const s = window.growConsent ?? {};
      prefs.analytics.checked = !!s.analytics;
      prefs.marketing.checked = !!s.marketing;
      box.hidden = false;
      box.querySelector('[data-consent="prefs"] [data-text]').textContent = 'Αποθήκευση';
    }));
}
