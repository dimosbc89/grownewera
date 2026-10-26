// The creator sign-up form (/creators/): field groups, labels and options. The surrounding copy
// lives in content/creators.md; the markup is built by creatorsForm() in lib/layout.mjs.
// Keys (`name`) are what arrives in the email / endpoint payload, so keep them stable.

export const CREATORS_FORM_ID = 'creators-form';

// Email subject when the form falls back to the visitor's email app (no SITE.formEndpoint).
export const CREATORS_MAIL_SUBJECT = 'Προφίλ creator';

export const CHANNELS = [
  { key: 'instagram', label: 'Instagram', placeholder: '@username ή link' },
  { key: 'tiktok', label: 'TikTok', placeholder: '@username ή link' },
  { key: 'youtube', label: 'YouTube', placeholder: 'youtube.com/@username' },
  { key: 'facebook', label: 'Facebook', placeholder: 'facebook.com/onoma-selidas' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'linkedin.com/in/username' },
  { key: 'other', label: 'Άλλο κανάλι', placeholder: 'Twitch, Pinterest, blog, podcast, newsletter…', nameField: true },
];

export const GROUPS = [
  {
    id: 'basics',
    title: 'Τα στοιχεία σας',
    fields: [
      { name: 'name', label: 'Όνομα και επώνυμο', type: 'text', autocomplete: 'name', required: true },
      { name: 'email', label: 'Email', type: 'email', autocomplete: 'email', required: true },
      { name: 'phone', label: 'Τηλέφωνο', type: 'tel', autocomplete: 'tel', hint: 'Προαιρετικό. Για γρήγορες ερωτήσεις πριν από μια πρόταση.' },
      { name: 'city', label: 'Πόλη ή περιοχή', type: 'text', autocomplete: 'address-level2', placeholder: 'π.χ. Θεσσαλονίκη, Γλυφάδα', required: true },
      { name: 'age', label: 'Ηλικία', type: 'chips', single: true, options: ['18–24', '25–34', '35–44', '45+'] },
    ],
  },
  {
    id: 'channels',
    title: 'Πού δημοσιεύετε',
    hint: 'Τουλάχιστον ένα κανάλι, με τον αριθμό των followers ή των συνδρομητών όπως τον δείχνει σήμερα η πλατφόρμα. Για περισσότερα κανάλια, γράψτε τα στο μήνυμα.',
    type: 'channels',
    fields: [
      { name: 'primary', label: 'Κύριο κανάλι', type: 'chips', single: true, required: true, options: ['Instagram', 'TikTok', 'YouTube', 'Facebook', 'LinkedIn', 'Άλλο'] },
    ],
  },
  {
    id: 'content',
    title: 'Τι περιεχόμενο φτιάχνετε',
    fields: [
      { name: 'categories', label: 'Κατηγορίες', type: 'chips', required: true, hint: 'Διαλέξτε όσες ισχύουν.',
        options: ['Μόδα', 'Ομορφιά', 'Φαγητό & ποτό', 'Ταξίδι', 'Fitness & υγεία', 'Τεχνολογία', 'Σπίτι & διακόσμηση', 'Οικογένεια & παιδιά', 'Προσωπικά οικονομικά', 'Gaming', 'Επιχειρηματικότητα & B2B', 'Αυτοκίνητο', 'Κατοικίδια', 'Lifestyle', 'Χιούμορ & entertainment', 'Μουσική & χορός', 'Αθλητισμός', 'Εκπαίδευση & how-to', 'Άλλο'] },
      { name: 'formats', label: 'Μορφές περιεχομένου', type: 'chips',
        options: ['Reels, TikTok, Shorts', 'Stories', 'Μεγάλα βίντεο (YouTube)', 'Live', 'Φωτογραφίες / carousel', 'UGC για διαφημίσεις', 'Podcast / newsletter', 'Posts / άρθρα στο LinkedIn', 'Παρουσία σε εκδηλώσεις'] },
      { name: 'languages', label: 'Γλώσσες περιεχομένου', type: 'chips', options: ['Ελληνικά', 'Αγγλικά', 'Άλλη'] },
    ],
  },
  {
    id: 'audience',
    title: 'Ποιοι σας βλέπουν',
    hint: 'Από τα insights της κύριας πλατφόρμας σας. Κατά προσέγγιση αρκεί. Αν ο λογαριασμός σας δεν έχει insights, προχωρήστε στην επόμενη ενότητα.',
    fields: [
      { name: 'audience_gr', label: 'Ποσοστό κοινού στην Ελλάδα', type: 'chips', single: true, options: ['Κάτω από 50%', '50–69%', '70–89%', '90% και πάνω'] },
      { name: 'audience_age', label: 'Κύριες ηλικίες κοινού', type: 'chips', options: ['13–17', '18–24', '25–34', '35–44', '45–54', '55+'] },
      { name: 'audience_gender', label: 'Φύλο κοινού', type: 'chips', single: true, options: ['Κυρίως γυναίκες', 'Κυρίως άντρες', 'Περίπου μισό-μισό'] },
      { name: 'reach', label: 'Μέσο reach ανά ανάρτηση', type: 'text', inputmode: 'numeric', placeholder: 'π.χ. 12.000', hint: 'Τελευταίες 30 μέρες.' },
      { name: 'engagement', label: 'Engagement rate', type: 'text', inputmode: 'decimal', placeholder: 'π.χ. 4,5%', hint: 'Αν δεν το ξέρετε, αφήστε το κενό.' },
    ],
  },
  {
    id: 'work',
    title: 'Η δουλειά σας',
    fields: [
      { name: 'portfolio', label: 'Portfolio ή media kit', type: 'text', inputmode: 'url', autocomplete: 'url', placeholder: 'https://…', hint: 'Link σε media kit, Google Drive, Notion ή στην ιστοσελίδα σας. Δεν έχετε; Βάλτε link σε μια ανάρτηση που σας αντιπροσωπεύει. Ελέγξτε ότι το link ανοίγει χωρίς αίτημα πρόσβασης.' },
      { name: 'brands', label: 'Συνεργασίες με brands μέχρι σήμερα', type: 'textarea', rows: 3, placeholder: 'π.χ. Καφεκοπτείο στη Θεσσαλονίκη, 1 Reel + 3 Stories, Μάρτιος 2026', hint: 'Αν δεν έχετε κάνει ακόμη, αφήστε το κενό. Δεν σας αποκλείει.' },
      { name: 'rates', label: 'Ενδεικτική αμοιβή ανά παραδοτέο', type: 'textarea', rows: 2, placeholder: 'π.χ. Reel: …€ · Story: …€ · UGC video: …€', hint: 'Προαιρετικό. Τιμές χωρίς ΦΠΑ. Μας βοηθά να σας προτείνουμε σε brief με το σωστό budget.' },
      { name: 'invoicing', label: 'Πώς πληρώνεστε', type: 'chips', single: true, options: ['Με τιμολόγιο (έχω έναρξη επαγγέλματος)', 'Με τίτλο κτήσης (δεν έχω έναρξη)', 'Μέσω εταιρείας ή manager', 'Δεν ξέρω ακόμη'] },
      { name: 'manager', label: 'Manager ή agency (αν έχετε)', type: 'text', placeholder: 'Όνομα και email' },
      { name: 'availability', label: 'Διαθεσιμότητα', type: 'chips', single: true, options: ['Από τώρα', 'Σε 1–2 μήνες', 'Σε 3 μήνες ή αργότερα'] },
    ],
  },
  {
    id: 'more',
    title: 'Κάτι ακόμη',
    fields: [
      { name: 'message', label: 'Μήνυμα', type: 'textarea', rows: 4, placeholder: 'π.χ. Brands που θα θέλατε να δουλέψετε μαζί τους, κλάδους που δεν δέχεστε (αλκοόλ, στοίχημα…), αν σας ενδιαφέρει το talent management.' },
    ],
  },
];
