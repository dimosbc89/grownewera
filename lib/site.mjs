// Site-wide settings and navigation. Brand values that are not colours/fonts live here;
// colours and fonts live in src/css/tokens.css.

export const SITE = {
  name: 'GROW Agency',
  legalName: '[ΕΠΩΝΥΜΙΑ]',
  domain: 'https://marketingagencygreece.online',
  internationalSite: 'https://growagency.online',
  tagline: 'Media that matters.',
  phone: '210 9713335',
  tel: '+302109713335',
  email: 'hello@growagency.online',
  street: 'Κολοκοτρώνη 64Α',
  postcode: '173 43',
  city: 'Άγιος Δημήτριος',
  region: 'Αττική',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Κολοκοτρώνη 64Α, 173 43 Άγιος Δημήτριος'),
  // Where the contact form POSTs (e.g. a Formspree / Netlify / own API endpoint).
  // Left empty, the form falls back to opening the visitor's email app with the message filled in.
  formEndpoint: '',
  // While true, [ΣΥΜΠΛΗΡΩΣΤΕ]/[DEMO] slots are highlighted and editorial notes are shown.
  // Set to false for launch (after every slot is filled).
  showDrafts: true,
};

export const SERVICE_GROUPS = [
  { label: 'Διαφήμιση', items: [
    ['Google Ads', '/ypiresies/google-ads/'],
    ['Facebook & Instagram ads', '/ypiresies/facebook-instagram-ads/'],
    ['TikTok ads', '/ypiresies/tiktok-ads/'],
    ['ChatGPT ads', '/ypiresies/chatgpt-ads/'],
  ] },
  { label: 'SEO & Content', items: [
    ['Προώθηση ιστοσελίδων (SEO)', '/ypiresies/proothisi-istoselidon/'],
    ['Content marketing', '/ypiresies/content-marketing/'],
  ] },
  { label: 'Ιστοσελίδες & eshop', items: [
    ['Κατασκευή ιστοσελίδων', '/ypiresies/kataskevi-istoselidon/'],
    ['Κατασκευή eshop', '/ypiresies/kataskevi-eshop/'],
  ] },
  { label: 'Social & Influencers', items: [
    ['Διαχείριση social media', '/ypiresies/diaxeirisi-social-media/'],
    ['Influencer marketing', '/ypiresies/influencer-marketing/'],
  ] },
  { label: 'Εκθέσεις', items: [
    ['Εκθεσιακά περίπτερα', '/ypiresies/ekthesiaka-periptera/'],
  ] },
];

export const SOLUTIONS = [
  ['Για eshop', '/lyseis/eshop/'],
  ['Για τοπικές επιχειρήσεις', '/lyseis/topikes-epixeiriseis/'],
  ['Για B2B', '/lyseis/b2b/'],
];

export const MAIN_NAV = [
  ['Υπηρεσίες', '/ypiresies/', 'services'],
  ['Λύσεις', null, 'solutions'],
  ['Έργα', '/erga/'],
  ['Η εταιρεία', '/etaireia/'],
  ['Blog', '/blog/'],
  ['Επικοινωνία', '/epikoinonia/'],
];

export const CASES = {
  1: '/erga/demo-eshop/',
  2: '/erga/demo-topiki-epixeirisi/',
  3: '/erga/demo-b2b/',
};

// 3D hero scene per page (see src/js/scene.js). Pages not listed get no WebGL scene.
export const SCENES = {
  '/': 'helix',
  '/ypiresies/': 'blocks',
  '/ypiresies/google-ads/': 'bars',
  '/ypiresies/facebook-instagram-ads/': 'orb',
  '/ypiresies/tiktok-ads/': 'orb',
  '/ypiresies/chatgpt-ads/': 'globe',
  '/ypiresies/proothisi-istoselidon/': 'bars',
  '/ypiresies/content-marketing/': 'panels',
  '/ypiresies/kataskevi-istoselidon/': 'panels',
  '/ypiresies/kataskevi-eshop/': 'panels',
  '/ypiresies/diaxeirisi-social-media/': 'orb',
  '/ypiresies/influencer-marketing/': 'orb',
  '/ypiresies/ekthesiaka-periptera/': 'blocks',
  '/lyseis/eshop/': 'bars',
  '/lyseis/topikes-epixeiriseis/': 'globe',
  '/lyseis/b2b/': 'blocks',
  '/erga/': 'bars',
  '/erga/demo-eshop/': 'bars',
  '/erga/demo-topiki-epixeirisi/': 'globe',
  '/erga/demo-b2b/': 'blocks',
  '/etaireia/': 'helix',
  '/etaireia/omada/': 'globe',
  '/epikoinonia/': 'globe',
  '/blog/': 'panels',
};

// Short names for breadcrumbs and cards, keyed by URL.
export const SHORT = {
  '/': 'Αρχική',
  '/ypiresies/': 'Υπηρεσίες',
  '/erga/': 'Έργα',
  '/etaireia/': 'Η εταιρεία',
  '/etaireia/omada/': 'Η ομάδα',
  '/epikoinonia/': 'Επικοινωνία',
  '/blog/': 'Blog',
  '/erga/demo-eshop/': 'Case study: eshop',
  '/erga/demo-topiki-epixeirisi/': 'Case study: τοπική επιχείρηση',
  '/erga/demo-b2b/': 'Case study: B2B',
  '/politiki-aporritou/': 'Πολιτική απορρήτου',
  '/oroi-xrisis/': 'Όροι χρήσης',
  '/cookies/': 'Πολιτική cookies',
};
for (const g of SERVICE_GROUPS) for (const [l, u] of g.items) SHORT[u] = l;
for (const [l, u] of SOLUTIONS) SHORT[u] = l;
