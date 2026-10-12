// Inline SVG "product shots" in the brand language: black panels, thin lines, lime accent.
// They animate via CSS (see .ill rules in components.css) and replace stock photography
// until real project imagery is available.

const W = 480;
const H = 360;
const frame = (inner, label, small) => `<svg class="ill${small ? ' ill--sm' : ''}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">
  <rect class="i-panel" x="0.5" y="0.5" width="${W - 1}" height="${H - 1}"/>
  ${inner}
</svg>`;

const bar = (x, y, w, h, i, acc) =>
  `<rect class="i-bar${acc ? ' i-acc' : ' i-dim'}" x="${x}" y="${y}" width="${w}" height="${h}" style="--i:${i}"/>`;

const ILL = {
  search: () => `
    <text class="i-mono" x="28" y="44">google.gr</text>
    <rect class="i-line" x="28" y="62" width="424" height="44"/>
    <text class="i-type" x="46" y="90">εταιρεία digital marketing αθήνα<tspan class="i-caret">_</tspan></text>
    <g class="i-pop" style="--i:1"><rect class="i-acc-o" x="28" y="128" width="424" height="78"/>
      <text class="i-mono i-accent-t" x="44" y="152">ΧΟΡΗΓΟΥΜΕΝΟ · growagency.online</text>
      <text class="i-h" x="44" y="180">GROW Agency: Digital marketing</text>
      <rect class="i-dim" x="44" y="190" width="300" height="6"/></g>
    <g class="i-pop" style="--i:2"><rect class="i-dim" x="44" y="232" width="220" height="10"/><rect class="i-dim" x="44" y="250" width="360" height="6"/></g>
    <g class="i-pop" style="--i:3"><rect class="i-dim" x="44" y="284" width="190" height="10"/><rect class="i-dim" x="44" y="302" width="330" height="6"/></g>
    <circle class="i-cursor" cx="300" cy="172" r="7"/>`,
  seo: () => `
    <text class="i-mono" x="28" y="44">ΘΕΣΗ ΣΤΗ GOOGLE</text>
    <text class="i-mono i-accent-t" x="380" y="44">#1</text>
    <polyline class="i-path" points="40,300 110,280 170,286 230,230 290,214 350,150 420,84"/>
    ${[300, 280, 286, 230, 214, 150, 84].map((y, i) => `<circle class="i-dot${i === 6 ? ' i-acc' : ''}" cx="${[40, 110, 170, 230, 290, 350, 420][i]}" cy="${y}" r="${i === 6 ? 8 : 4}" style="--i:${i}"/>`).join('')}
    <line class="i-grid" x1="28" y1="320" x2="452" y2="320"/>
    <text class="i-mono" x="28" y="344">ΜΗΝΑΣ 1</text><text class="i-mono" x="380" y="344">ΜΗΝΑΣ 6</text>`,
  ads: () => ILL.search(),
  dashboard: () => `
    <text class="i-mono" x="28" y="44">ΑΝΑΦΟΡΑ ΜΗΝΑ</text>
    <text class="i-mono i-accent-t" x="330" y="44">● LIVE</text>
    <g><text class="i-mono" x="28" y="84">ROAS</text><text class="i-big" x="28" y="124">X,X</text></g>
    <g><text class="i-mono" x="176" y="84">CPA</text><text class="i-big" x="176" y="124">XX€</text></g>
    <g><text class="i-mono" x="324" y="84">LEADS</text><text class="i-big i-accent-t" x="324" y="124">+XX%</text></g>
    <line class="i-grid" x1="28" y1="150" x2="452" y2="150"/>
    ${[60, 90, 70, 120, 100, 150, 130, 175].map((h, i) => bar(36 + i * 52, 320 - h, 30, h, i, i === 7)).join('')}
    <line class="i-grid" x1="28" y1="320" x2="452" y2="320"/>`,
  social: () => `
    <rect class="i-line" x="150" y="20" width="180" height="320"/>
    <rect class="i-dim" x="200" y="30" width="80" height="6"/>
    <circle class="i-acc-o" cx="178" cy="62" r="12"/><rect class="i-dim" x="198" y="56" width="90" height="8"/>
    <rect class="i-media" x="162" y="84" width="156" height="160"/>
    <path class="i-play" d="M226 146 L262 164 L226 182 Z"/>
    <g class="i-heart"><path class="i-acc" d="M175 262 c0-8 12-10 14-2 c2-8 14-6 14 2 c0 8 -14 16 -14 16 s-14-8-14-16z"/></g>
    <rect class="i-dim" x="214" y="264" width="60" height="8"/>
    <rect class="i-dim" x="162" y="292" width="140" height="6"/><rect class="i-dim" x="162" y="306" width="100" height="6"/>
    ${[0, 1, 2].map((i) => `<g class="i-float" style="--i:${i}"><rect class="i-line" x="${i % 2 ? 350 : 24}" y="${70 + i * 90}" width="104" height="44"/><text class="i-mono" x="${(i % 2 ? 350 : 24) + 12}" y="${98 + i * 90}">${['+XX FOLLOWS', 'XX% VIEW', 'XX LEADS'][i]}</text></g>`).join('')}`,
  web: () => `
    <rect class="i-line" x="28" y="28" width="424" height="304"/>
    <line class="i-grid" x1="28" y1="56" x2="452" y2="56"/>
    ${[0, 1, 2].map((i) => `<circle class="i-dim" cx="${46 + i * 16}" cy="42" r="4"/>`).join('')}
    <rect class="i-dim" x="120" y="36" width="240" height="12"/>
    <rect class="i-acc i-grow" x="52" y="84" width="180" height="22"/>
    <rect class="i-dim" x="52" y="118" width="230" height="10"/><rect class="i-dim" x="52" y="136" width="200" height="10"/>
    <rect class="i-acc-o" x="52" y="166" width="110" height="32"/><text class="i-mono i-accent-t" x="66" y="187">ΑΓΟΡΑ →</text>
    <rect class="i-media" x="300" y="80" width="128" height="128"/>
    ${[0, 1, 2].map((i) => `<g class="i-pop" style="--i:${i + 1}"><rect class="i-line" x="${52 + i * 130}" y="230" width="116" height="80"/><rect class="i-dim" x="${64 + i * 130}" y="290" width="70" height="8"/></g>`).join('')}
    <circle class="i-cursor" cx="140" cy="186" r="7"/>`,
  booth: () => `
    <g class="i-iso">
      <path class="i-line" d="M240 300 L420 210 L240 120 L60 210 Z"/>
      <path class="i-media" d="M60 210 L60 90 L240 0 L240 120 Z"/>
      <path class="i-wall" d="M240 120 L240 0 L420 90 L420 210 Z"/>
      <path class="i-acc i-grow" d="M120 186 L120 120 L190 85 L190 151 Z"/>
      <path class="i-line" d="M200 250 L280 210 L320 230 L240 270 Z"/>
      <path class="i-line" d="M200 250 L200 280 L240 300 L240 270"/><path class="i-line" d="M240 300 L320 260 L320 230"/>
      <text class="i-mono i-accent-t" x="276" y="80">GROW.</text>
    </g>`,
  chat: () => `
    <text class="i-mono" x="28" y="44">CHATGPT</text>
    <g class="i-pop" style="--i:1"><rect class="i-line" x="180" y="64" width="272" height="44"/><text class="i-type" x="196" y="91">ποια εταιρεία marketing στην αθήνα;</text></g>
    <g class="i-pop" style="--i:2"><rect class="i-dim" x="28" y="132" width="320" height="8"/><rect class="i-dim" x="28" y="150" width="290" height="8"/><rect class="i-dim" x="28" y="168" width="240" height="8"/></g>
    <g class="i-pop" style="--i:3"><rect class="i-acc-o" x="28" y="200" width="424" height="96"/>
      <text class="i-mono i-accent-t" x="44" y="226">ΧΟΡΗΓΟΥΜΕΝΟ</text>
      <text class="i-h" x="44" y="256">GROW Agency · Αθήνα</text>
      <rect class="i-dim" x="44" y="270" width="260" height="6"/></g>
    <circle class="i-cursor" cx="410" cy="250" r="7"/>`,
  map: () => `
    ${Array.from({ length: 9 }, (_, i) => `<line class="i-grid" x1="${i * 60}" y1="0" x2="${i * 60 - 120}" y2="${H}"/>`).join('')}
    <path class="i-road" d="M0 250 C120 230 200 160 300 150 S440 90 480 70"/>
    <path class="i-road" d="M120 0 C140 120 200 200 260 360"/>
    <path class="i-road i-road--thin" d="M0 120 L480 210"/>
    <g class="i-pin"><circle class="i-pulse" cx="232" cy="168" r="26"/><circle class="i-acc" cx="232" cy="168" r="9"/></g>
    <rect class="i-label" x="252" y="186" width="200" height="54"/>
    <text class="i-mono i-accent-t" x="266" y="208">GROW AGENCY</text>
    <text class="i-mono" x="266" y="226">ΚΟΛΟΚΟΤΡΩΝΗ 64Α</text>`,
};

export function illustration(name, small = false) {
  const labels = {
    search: 'Διαφήμιση στην αναζήτηση της Google', ads: 'Διαφήμιση στην αναζήτηση της Google',
    seo: 'Άνοδος θέσεων στη Google', dashboard: 'Μηνιαία αναφορά αποτελεσμάτων',
    social: 'Ανάρτηση social media', web: 'Ιστοσελίδα σε browser', booth: 'Εκθεσιακό περίπτερο',
    chat: 'Διαφήμιση στο ChatGPT', map: 'Το γραφείο της GROW στον Άγιο Δημήτριο',
  };
  return frame((ILL[name] ?? ILL.dashboard)(), labels[name] ?? '', small);
}
