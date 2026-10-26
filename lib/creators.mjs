// The creator sign-up form (/creators/): field groups, labels and options. The surrounding copy
// lives in content/creators.md; the markup is built by creatorsForm() in lib/layout.mjs.
// Keys (`name`) are what arrives in the email / endpoint payload, so keep them stable.

export const CREATORS_FORM_ID = 'creators-form';

// Email subject when the form falls back to the visitor's email app (no SITE.formEndpoint).
export const CREATORS_MAIL_SUBJECT = 'Προφίλ creator';

export const CHANNELS = [
  { key: 'instagram', label: 'Instagram', placeholder: '@username ή link' },
  { key: 'tiktok', label: 'TikTok', placeholder: '@username ή link' },
  { key: 'youtube', label: 'YouTube', placeholder: 'link καναλιού' },
  { key: 'facebook', label: 'Facebook', placeholder: 'link σελίδας' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'link προφίλ' },
  { key: 'other', label: 'Άλλο κανάλι', placeholder: 'Twitch, Pinterest, blog, podcast, newsletter…', nameField: true },
];

export const GROUPS = [
  {
    id: 'basics',
    title: 'Ποιοι είστε',
    fields: [
      { name: 'name', label: 'Όνομα και επώνυμο', type: 'text', autocomplete: 'name', required: true },
      { name: 'email', label: 'Email', type: 'email', autocomplete: 'email', required: true },
      { name: 'phone', label: 'Τηλέφωνο', type: 'tel', autocomplete: 'tel', hint: 'Προαιρετικό. Για γρήγορες ερωτήσεις πριν από μια πρόταση.' },
      { name: 'city', label: 'Πόλη', type: 'text', autocomplete: 'address-level2', required: true },
      { name: 'age', label: 'Ηλικία', type: 'chips', single: true, options: ['18–24', '25–34', '35–44', '45+'] },
    ],
  },
  {
    id: 'channels',
    title: 'Πού δημοσιεύετε',
    hint: 'Τουλάχιστον ένα κανάλι, με τον αριθμό των followers όπως τον δείχνει η πλατφόρμα σήμερα.',
    type: 'channels',
    fields: [
      { name: 'primary', label: 'Κύριο κανάλι', type: 'chips', single: true, required: true, options: ['Instagram', 'TikTok', 'YouTube', 'Facebook', 'LinkedIn', 'Άλλο'] },
    ],
  },
  {
    id: 'content',
    title: 'Τι περιεχόμενο κάνετε',
    fields: [
      { name: 'categories', label: 'Κατηγορίες', type: 'chips', required: true, hint: 'Διαλέξτε όσες ισχύουν.',
        options: ['Μόδα', 'Ομορφιά', 'Φαγητό & ποτό', 'Ταξίδι', 'Fitness & υγεία', 'Τεχνολογία', 'Σπίτι & διακόσμηση', 'Γονείς & παιδί', 'Οικονομικά', 'Gaming', 'Επιχειρηματικότητα & B2B', 'Αυτοκίνητο', 'Κατοικίδια', 'Lifestyle', 'Άλλο'] },
      { name: 'formats', label: 'Τι φτιάχνετε', type: 'chips',
        options: ['Reels / short video', 'Stories', 'YouTube video', 'Live', 'Φωτογραφία', 'UGC για διαφημίσεις', 'Podcast / newsletter', 'Παρουσίες σε εκδηλώσεις'] },
      { name: 'languages', label: 'Γλώσσες περιεχομένου', type: 'chips', options: ['Ελληνικά', 'Αγγλικά', 'Άλλη'] },
    ],
  },
  {
    id: 'audience',
    title: 'Ποιοι σας βλέπουν',
    hint: 'Από τα insights της κύριας πλατφόρμας σας. Κατά προσέγγιση αρκεί.',
    fields: [
      { name: 'audience_gr', label: 'Κοινό στην Ελλάδα', type: 'chips', single: true, options: ['Κάτω από 50%', '50–70%', '70–90%', 'Πάνω από 90%'] },
      { name: 'audience_age', label: 'Κύριες ηλικίες κοινού', type: 'chips', options: ['13–17', '18–24', '25–34', '35–44', '45–54', '55+'] },
      { name: 'audience_gender', label: 'Φύλο κοινού', type: 'chips', single: true, options: ['Κυρίως γυναίκες', 'Κυρίως άντρες', 'Μοιρασμένο'] },
      { name: 'reach', label: 'Μέσο reach ανά ανάρτηση', type: 'text', inputmode: 'numeric', placeholder: 'π.χ. 12.000' },
      { name: 'engagement', label: 'Engagement rate', type: 'text', inputmode: 'decimal', placeholder: 'π.χ. 4,5%' },
    ],
  },
  {
    id: 'work',
    title: 'Η δουλειά σας',
    fields: [
      { name: 'portfolio', label: 'Portfolio ή media kit', type: 'url', placeholder: 'https://…', hint: 'Link σε media kit, Google Drive, Notion ή την ιστοσελίδα σας.' },
      { name: 'brands', label: 'Συνεργασίες με brands μέχρι σήμερα', type: 'textarea', rows: 3, placeholder: 'Brand, είδος συνεργασίας, πότε. Αν δεν έχετε ακόμη, γράψτε το.' },
      { name: 'rates', label: 'Ενδεικτική αμοιβή ανά παραδοτέο', type: 'textarea', rows: 2, placeholder: 'π.χ. Reel: 300€ · Story: 80€ · UGC video: 150€', hint: 'Προαιρετικό. Μας βοηθά να σας προτείνουμε σε brief με το σωστό budget.' },
      { name: 'invoicing', label: 'Πώς τιμολογείτε', type: 'chips', single: true, options: ['Τιμολόγιο (επαγγελματίας)', 'Τίτλος κτήσης', 'Δεν ξέρω ακόμη'] },
      { name: 'manager', label: 'Έχετε manager ή agency;', type: 'text', placeholder: 'Όνομα και στοιχεία επικοινωνίας, αν ναι' },
      { name: 'availability', label: 'Διαθεσιμότητα', type: 'chips', single: true, options: ['Άμεσα', 'Σε 1–2 μήνες', 'Μόνο για συγκεκριμένα brands'] },
    ],
  },
  {
    id: 'more',
    title: 'Κάτι ακόμη',
    fields: [
      { name: 'message', label: 'Μήνυμα', type: 'textarea', rows: 4, placeholder: 'Brands με τα οποία θα θέλατε να δουλέψετε, ή που δεν θα δουλεύατε ποτέ. Κάτι που πρέπει να ξέρουμε.' },
    ],
  },
];
