// Google Analytics 4 (gtag.js), loaded only after the visitor allows statistics cookies.
// The Measurement ID comes from <meta name="ga-id"> (SITE.gaId in lib/site.mjs). Nothing is
// requested from Google before consent; a later "reject" from the footer's cookie settings
// switches storage off again (Consent Mode v2 update) and clears the _ga cookies.
let loaded = false;

function gtag() { window.dataLayer.push(arguments); }

function consentState(c) {
  return {
    analytics_storage: c.analytics ? 'granted' : 'denied',
    ad_storage: c.marketing ? 'granted' : 'denied',
    ad_user_data: c.marketing ? 'granted' : 'denied',
    ad_personalization: c.marketing ? 'granted' : 'denied',
  };
}

function load(id, c) {
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = gtag;
  gtag('consent', 'default', consentState(c));
  gtag('js', new Date());
  gtag('config', id);
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
}

function clearGaCookies() {
  const host = location.hostname.replace(/^www\./, '');
  for (const name of document.cookie.split(';').map((c) => c.split('=')[0].trim())) {
    if (!/^_ga/.test(name)) continue;
    for (const domain of ['', `; domain=${host}`, `; domain=.${host}`]) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`;
    }
  }
}

export function initAnalytics() {
  const id = document.querySelector('meta[name="ga-id"]')?.content;
  if (!id) return;
  const apply = (c) => {
    if (!c) return;
    if (!loaded) {
      if (c.analytics || c.marketing) load(id, c);
      return;
    }
    gtag('consent', 'update', consentState(c));
    if (!c.analytics) clearGaCookies();
  };
  window.addEventListener('grow:consent', (e) => apply(e.detail));
  // A choice saved on an earlier visit may already have been applied.
  apply(window.growConsent);
}
