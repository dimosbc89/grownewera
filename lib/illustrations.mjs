// Inline SVG "product shots" in the brand language: black UI panels, thin rules, skeleton text,
// one lime accent. Each shot is a believable product UI (search results, feeds, dashboards …)
// built from 3–4 layers in <g data-depth="…"> (0 = still, 1 = full): motion/pointer.js moves them
// with the pointer and the scroll, so every shot reads as a small 3D diorama. They animate via CSS
// (see the .ill rules in components.css) once their container gets `.is-in`.
// Copy rule: no Greek copy in here. Text is language-neutral (numbers, UI glyphs, the brand name,
// a few universal ad-platform labels); everything else is skeleton bars. KPI values stay `XX`
// placeholders, like the copy, until real numbers exist.

const W = 480;
const H = 360;

// ---------- primitives ----------
const n = (v) => Math.round(v * 10) / 10;
const R = (x, y, w, h, c = 'i-t', extra = '') => `<rect class="${c}" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${extra}/>`;
const T = (x, y, s, c = 'i-mono', extra = '') => `<text class="${c}" x="${n(x)}" y="${n(y)}"${extra}>${s}</text>`;
const Ln = (x1, y1, x2, y2, c = 'i-rule') => `<line class="${c}" x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}"/>`;
const C = (cx, cy, r, c = 'i-t') => `<circle class="${c}" cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}"/>`;
const P = (d, c = 'i-line') => `<path class="${c}" d="${d}"/>`;
// Skeleton text line: k = '' (dim), 'w' (headline white), 'a' (lime)
const tx = (x, y, w, k = '', h = 5) => R(x, y, w, h, k ? `i-t i-t--${k}` : 'i-t');
const lines = (x, y, ws, gap = 11, k = '') => ws.map((w, i) => tx(x, y + i * gap, w, k)).join('');
// Logical layer (pointer + scroll parallax) and staged reveal helpers.
const L = (d, inner) => `<g data-depth="${d}">${inner}</g>`;
const pop = (i, inner, c = 'i-pop') => `<g class="${c}" style="--i:${i}">${inner}</g>`;
// App window: frame, title bar, three square "traffic lights".
const win = (x, y, w, h, bar = 24) => `${R(x, y, w, h, 'i-win')}${Ln(x, y + bar, x + w, y + bar)}${[0, 1, 2].map((i) => R(x + 10 + i * 10, y + bar / 2 - 3, 6, 6, 'i-t')).join('')}`;
// Floating metric chip: mono label + big value.
const chip = (x, y, w, label, value, acc = true, h = 46) => `${R(x, y, w, h, acc ? 'i-chip i-chip--a' : 'i-chip')}${T(x + 10, y + 16, label, 'i-mono i-mono--s')}${T(x + 10, y + 37, value, acc ? 'i-val i-accent-t' : 'i-val')}`;
// Mouse pointer (arrow), tip at x, y.
const ptr = (x, y) => `<path class="i-ptr" d="M${x} ${y} l0 17 l4.6 -4.2 l3.4 7.6 l2.8 -1.2 l-3.3 -7.4 l6.3 -.4 z"/>`;
const heart = (x, y, s = 1, c = 'i-acc') => `<path class="${c}" transform="translate(${x} ${y}) scale(${s})" d="M0 3.2 C0 -1 5.6 -1.6 6.4 2 C7.2 -1.6 12.8 -1 12.8 3.2 C12.8 7.6 6.4 11.4 6.4 11.4 S0 7.6 0 3.2Z"/>`;
const tag = (x, y, s, c = 'i-tag') => `${R(x, y, s.length * 5.6 + 8, 12, c)}${T(x + 4, y + 9, s, c === 'i-tag' ? 'i-mono i-mono--xs i-ink' : 'i-mono i-mono--xs')}`;
const check = (x, y, c = "i-tick") => `<path class="${c}" d="M${x} ${y + 4} l3 3 l6 -7"/>`;

// Isometric projection (metres -> SVG units) around an origin: the booth and the shop's product.
function isoKit(cx, cy, s) {
  const iso = (x, y, z = 0) => [cx + (x - y) * 0.866 * s, cy + (x + y) * 0.5 * s - z * s];
  const poly = (pts, c) => `<polygon class="${c}" points="${pts.map((p) => iso(...p).map(n).join(',')).join(' ')}"/>`;
  const box = (x, y, z, w, d, h, top = 'i-iso-top', left = 'i-iso-l', right = 'i-iso-r') =>
    poly([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]], left) +
    poly([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]], right) +
    poly([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]], top);
  // Text laid on a wall facing +y (runs along x) or +x (runs along y).
  const text = (x, y, z, str, c, axis = 'x') => {
    const [px, py] = iso(x, y, z);
    const m = axis === 'x' ? `matrix(.866 .5 0 1 ${n(px)} ${n(py)})` : `matrix(.866 -.5 0 1 ${n(px)} ${n(py)})`;
    return `<text class="${c}" transform="${m}" x="0" y="0">${str}</text>`;
  };
  return { iso, poly, box, text };
}
const BOOTH = isoKit(214, 132, 31);
const PRODUCT = isoKit(134, 150, 40);
const { iso, poly, box } = BOOTH;
const isoText = BOOTH.text;

// ---------- the shots ----------
const ILL = {
  // Google results page with the GROW ad on top.
  search: () => `
    ${L(0.05, `${win(20, 18, 440, 324)}${R(110, 24, 260, 12, 'i-field')}${T(118, 33, 'google.com/search', 'i-mono i-mono--xs')}`)}
    ${L(0.16, `${R(40, 58, 262, 32, 'i-field i-field--hi')}${C(57, 73, 6, 'i-line')}${Ln(61, 77, 66, 82, 'i-line')}
      ${T(74, 78, 'grow agency<tspan class="i-caret">|</tspan>', 'i-type')}${R(302, 58, 32, 32, 'i-acc')}${C(316, 72, 6, 'i-ink-o')}${Ln(320, 76, 325, 81, 'i-ink-o')}
      ${[0, 1, 2, 3, 4].map((i) => tx(40 + i * 44, 104, 28, i ? '' : 'w', 4)).join('')}${R(40, 113, 28, 2, 'i-acc')}${Ln(32, 118, 448, 118)}`)}
    ${L(0.26, `${pop(3, `${R(40, 250, 10, 10, 'i-t')}${tx(56, 252, 110)}${tx(40, 268, 230, 'w', 7)}${lines(40, 284, [380, 300])}`)}
      ${pop(4, `${R(40, 312, 10, 10, 'i-t')}${tx(56, 314, 90)}${tx(40, 330, 200, 'w', 7)}`)}`)}
    ${L(0.46, pop(1, `${R(32, 128, 416, 106, 'i-card i-card--a')}${tag(46, 141, 'AD')}${T(72, 150, 'growagency.online', 'i-mono i-accent-t')}
      ${T(46, 176, 'GROW Agency — Digital Marketing', 'i-h')}${lines(46, 188, [340, 268])}
      ${[0, 1, 2, 3].map((i) => `${R(46 + i * 98, 210, 90, 14, 'i-field')}${tx(54 + i * 98, 215, 50 + (i % 2) * 18, 'a', 4)}`).join('')}`))}
    ${L(0.85, `${pop(2, chip(350, 54, 98, 'CTR', '+XX%'), 'i-float')}${ptr(318, 172)}`)}`,

  // Facebook / Instagram feed with a sponsored post.
  meta: () => `
    ${L(0.05, `${R(128, 14, 224, 332, 'i-win')}${tx(142, 28, 58, 'w', 7)}${R(318, 25, 10, 10, 'i-line')}${R(334, 25, 10, 10, 'i-line')}
      ${[0, 1, 2, 3, 4].map((i) => C(156 + i * 34, 62, 11, i < 2 ? 'i-ring' : 'i-ring i-ring--dim')).join('')}${Ln(128, 82, 352, 82)}`)}
    ${L(0.22, `${C(152, 100, 9, 'i-acc')}${T(148.5, 103.5, 'G', 'i-ink i-mono--b')}${T(168, 99, 'growagency', 'i-name')}${T(168, 110, 'AD · ●', 'i-mono i-mono--xs')}${T(326, 103, '···', 'i-mono')}
      ${R(140, 118, 200, 150, 'i-media')}${C(240, 186, 38, 'i-acc')}${R(140, 216, 200, 52, 'i-ground')}${Ln(140, 216, 340, 216, 'i-rule-s')}
      ${T(152, 258, 'GROW.', 'i-h i-h--s')}${R(286, 126, 46, 18, 'i-acc')}${T(292, 139.5, '−20%', 'i-val i-val--s')}
      ${R(140, 268, 200, 26, 'i-bar-ui')}${tx(150, 275, 70, 'w', 4)}${tx(150, 284, 50, '', 4)}${R(270, 273, 62, 16, 'i-acc')}${T(277, 284, 'SHOP NOW', 'i-mono i-mono--xs i-ink')}
      ${lines(142, 322, [176, 120], 11)}`)}
    ${L(0.45, pop(1, `${heart(142, 300, 1)}${R(162, 300, 11, 11, 'i-line')}<path class="i-line" d="M184 311 l5 -11 l6 11 z"/>${T(206, 309, '1.2K', 'i-mono i-mono--xs')}${R(327, 300, 9, 11, 'i-line')}`))}
    ${L(0.82, `${pop(2, chip(22, 96, 96, 'ROAS', 'X,X×'), 'i-float')}${pop(3, chip(362, 196, 96, 'CPA', '−XX%', false), 'i-float')}<g class="i-heart">${heart(318, 236, 1.5)}</g>`)}`,

  // TikTok "For You" video with an ad overlay.
  tiktok: () => `
    ${L(0.05, `${R(160, 10, 160, 340, 'i-win')}${R(220, 16, 40, 4, 'i-t')}${C(240, 150, 76, 'i-ring i-ring--dim')}${C(240, 150, 98, 'i-ring i-ring--faint')}`)}
    ${L(0.22, `${R(166, 26, 148, 318, 'i-screen')}${C(236, 150, 44, 'i-acc')}${R(166, 196, 148, 80, 'i-ground')}${Ln(166, 196, 314, 196, 'i-rule-s')}
      ${tx(194, 40, 34, '', 4)}${tx(236, 40, 30, 'w', 4)}${R(244, 47, 14, 2, 'i-acc')}
      ${tag(172, 240, 'AD', 'i-tag')}${T(172, 266, '@growagency', 'i-name')}${lines(172, 274, [100, 78], 9)}${T(172, 302, '♫', 'i-mono')}${tx(184, 297, 64, '', 4)}
      ${Ln(166, 340, 314, 340, 'i-rule-s')}${R(166, 339, 30, 2, 'i-acc i-grow')}`)}
    ${L(0.4, `${C(296, 178, 10, 'i-ring')}${R(292, 188, 8, 8, 'i-acc')}${heart(290, 208, 1)}${T(286, 230, '48K', 'i-mono i-mono--xs')}
      ${R(290, 240, 13, 10, 'i-line')}${T(286, 262, '1.2K', 'i-mono i-mono--xs')}<path class="i-line" d="M290 284 l7 -9 l7 9 z"/>
      ${C(297, 308, 10, 'i-disc')}${C(297, 308, 3, 'i-acc')}`)}
    ${L(0.55, pop(1, `${R(172, 312, 106, 18, 'i-acc')}${T(180, 324.5, 'SHOP NOW', 'i-mono i-mono--xs i-ink')}${T(266, 324.5, '→', 'i-mono i-mono--xs i-ink')}`))}
    ${L(0.86, `${pop(2, chip(36, 68, 104, 'HOOK', '0:02'), 'i-float')}${pop(3, chip(340, 226, 104, 'VTR', 'XX%', false), 'i-float')}
      ${[0, 1, 2].map((i) => `<g class="i-rise" style="--i:${i}">${heart(330 + i * 12, 180 - i * 22, 0.7 + i * 0.1)}</g>`).join('')}`)}`,

  // ChatGPT conversation with a sponsored answer card.
  chat: () => `
    ${L(0.05, `${win(20, 18, 440, 324)}${R(20, 42, 96, 300, 'i-side')}${R(30, 52, 76, 18, 'i-line')}${T(38, 64, '+', 'i-mono')}${tx(50, 59, 40, '', 4)}
      ${[0, 1, 2, 3, 4].map((i) => tx(30, 86 + i * 16, 50 + ((i * 13) % 26), '', 4)).join('')}${R(30, 318, 14, 14, 'i-t')}${tx(50, 323, 40, '', 4)}`)}
    ${L(0.2, `${T(132, 60, 'CHAT ▾', 'i-mono')}${R(262, 74, 184, 30, 'i-bubble')}${T(274, 93, 'marketing agency athens?', 'i-type i-type--s')}
      ${R(132, 118, 14, 14, 'i-line')}<path class="i-acc" d="M139 120 l1.6 4 l4 1.6 l-4 1.6 l-1.6 4 l-1.6 -4 l-4 -1.6 l4 -1.6z"/>${lines(154, 120, [280, 250, 190], 11)}
      ${lines(154, 274, [270, 210], 11)}`)}
    ${L(0.46, pop(1, `${R(154, 156, 290, 104, 'i-card i-card--a')}${tag(166, 168, 'AD')}${T(192, 177, 'growagency.online', 'i-mono i-accent-t')}
      ${T(166, 202, 'GROW Agency · Athens', 'i-h')}${lines(166, 214, [250, 210], 10)}
      ${R(166, 236, 92, 14, 'i-acc')}${T(173, 246, 'VISIT SITE →', 'i-mono i-mono--xs i-ink')}${R(266, 236, 70, 14, 'i-field')}${tx(274, 241, 40, '', 4)}`))}
    ${L(0.3, `${R(130, 302, 316, 30, 'i-field i-field--hi')}${tx(142, 315, 120, '', 4)}${R(418, 307, 20, 20, 'i-acc')}<path class="i-ink-o" d="M428 322 v-10 m-4 4 l4 -4 l4 4"/>`)}
    ${L(0.86, `${ptr(232, 238)}${pop(2, chip(26, 196, 84, 'CTR', '+XX%'), 'i-float')}`)}`,

  // Search Console performance report: clicks climbing, average position #1.
  seo: () => `
    ${L(0.05, `${win(20, 18, 440, 324)}${tx(110, 28, 90, 'w', 6)}
      ${['3M', '6M', '12M'].map((s, i) => `${R(342 + i * 36, 25, 32, 13, i === 1 ? 'i-acc' : 'i-field')}${T(348 + i * 36, 34.5, s, i === 1 ? 'i-mono i-mono--xs i-ink' : 'i-mono i-mono--xs')}`).join('')}
      ${[176, 206, 236, 266, 296].map((y) => Ln(36, y, 444, y, 'i-grid')).join('')}
      ${['01', '02', '03', '04', '05', '06'].map((s, i) => T(36 + i * 80, 318, s, 'i-mono i-mono--xs')).join('')}`)}
    ${L(0.2, [['CLICKS', 'XXK'], ['IMPR.', 'XXK'], ['CTR', 'X,X%'], ['POSITION', '#1']].map(([l, v], i) => pop(i, `${R(36 + i * 104, 54, 96, 58, i ? 'i-tile' : 'i-tile i-tile--a')}${T(46 + i * 104, 72, l, i ? 'i-mono i-mono--xs' : 'i-mono i-mono--xs i-ink')}${T(46 + i * 104, 100, v, i ? 'i-val' : 'i-val i-ink')}`)).join(''))}
    ${L(0.38, `<polyline class="i-path i-path--dim" pathLength="1" points="36,262 116,250 196,256 276,232 356,236 444,214"/>
      <polygon class="i-area" points="36,292 116,286 196,272 276,240 356,206 444,152 444,296 36,296"/>
      <polyline class="i-path" pathLength="1" points="36,292 116,286 196,272 276,240 356,206 444,152"/>
      ${[[116, 286], [196, 272], [276, 240], [356, 206]].map(([x, y], i) => `<circle class="i-dot" style="--i:${i + 2}" cx="${x}" cy="${y}" r="3"/>`).join('')}`)}
    ${L(0.8, pop(5, `${Ln(444, 160, 444, 296, 'i-dash')}${C(444, 152, 6, 'i-acc')}${C(444, 152, 12, 'i-ring')}${R(340, 122, 92, 22, 'i-chip i-chip--a')}${T(350, 137, 'POS. 06 → #1', 'i-mono i-accent-t')}`))}`,

  // Editorial article page + the content calendar behind it.
  content: () => `
    ${L(0.05, `${R(20, 18, 262, 324, 'i-win')}${T(34, 42, 'GROW.', 'i-h i-h--s')}${[0, 1, 2].map((i) => tx(170 + i * 32, 36, 24, '', 4)).join('')}${Ln(20, 52, 282, 52)}
      ${tag(34, 62, 'SEO', 'i-tag-o')}${tx(34, 84, 220, 'w', 10)}${tx(34, 100, 196, 'w', 10)}${tx(34, 116, 120, 'w', 10)}
      ${T(34, 142, '08 MIN', 'i-mono i-mono--xs')}${tx(78, 137, 60, '', 4)}
      ${R(34, 152, 234, 74, 'i-media')}${R(34, 196, 234, 30, 'i-ground')}${C(220, 186, 18, 'i-acc')}
      ${lines(34, 238, [234, 220, 228, 160], 11)}${R(34, 290, 3, 34, 'i-acc')}${lines(44, 292, [190, 170, 120], 11, 'w')}`)}
    ${L(0.28, `${R(238, 58, 222, 252, 'i-win i-win--raised')}${T(250, 78, '10 / 2026', 'i-mono')}${R(420, 68, 28, 14, 'i-acc')}${T(426, 78, '+', 'i-mono i-ink')}
      ${Array.from({ length: 35 }, (_, k) => {
        const c = k % 7; const r = Math.floor(k / 7); const x = 246 + c * 30; const y = 92 + r * 42; const d = k - 2;
        const kind = [3, 8, 10, 15, 17, 22, 24, 29, 31].includes(k) ? (k % 3 === 0 ? 'i-ev i-ev--a' : k % 3 === 1 ? 'i-ev i-ev--w' : 'i-ev') : '';
        return `${R(x, y, 28, 40, 'i-cell')}${d > 0 && d <= 31 ? T(x + 3, y + 9, d, 'i-mono i-mono--xxs') : ''}${kind ? R(x + 3, y + 22, 22, 6, kind) : ''}`;
      }).join('')}`)}
    ${L(0.52, pop(1, `${Ln(321, 168, 321, 196, 'i-dash')}${R(276, 196, 170, 76, 'i-card i-card--a')}${T(288, 212, 'ARTICLE 04 / 12', 'i-mono i-mono--xs i-accent-t')}${lines(288, 222, [140, 110], 10, 'w')}${lines(288, 244, [130], 10)}${check(288, 254)}${T(302, 262, 'LIVE', 'i-mono i-mono--xs i-accent-t')}`))}
    ${L(0.86, pop(2, chip(36, 300, 108, 'READS', 'XXK'), 'i-float'))}`,

  // Website builder: page canvas, layer panel, the hero headline selected.
  web: () => `
    ${L(0.05, `${win(20, 18, 440, 324)}${R(110, 24, 230, 12, 'i-field')}${T(118, 33, 'growagency.online', 'i-mono i-mono--xs')}
      ${R(352, 42, 108, 300, 'i-side')}${T(362, 60, 'LAYERS', 'i-mono i-mono--xs')}
      ${['NAV', 'HERO', 'H1', 'CTA', 'MEDIA', 'GRID', 'FOOTER'].map((s, i) => `${R(358, 68 + i * 20, 96, 16, i === 2 ? 'i-row i-row--a' : 'i-row')}${R(364 + (i > 1 && i < 5 ? 8 : 0), 73 + i * 20, 6, 6, i === 2 ? 'i-ink-f' : 'i-t')}${T(376 + (i > 1 && i < 5 ? 8 : 0), 79 + i * 20, s, i === 2 ? 'i-mono i-mono--xs i-ink' : 'i-mono i-mono--xs')}`).join('')}`)}
    ${L(0.2, `${T(40, 66, 'GROW.', 'i-h i-h--s')}${[0, 1, 2].map((i) => tx(166 + i * 34, 61, 24, '', 4)).join('')}${R(280, 56, 56, 14, 'i-acc')}
      ${tx(44, 92, 196, 'w', 13)}${tx(44, 111, 160, 'w', 13)}${lines(44, 136, [196, 164], 10)}${R(44, 160, 80, 20, 'i-acc i-grow')}${T(52, 173.5, 'START →', 'i-mono i-mono--xs i-ink')}
      ${R(254, 86, 84, 96, 'i-media')}${R(270, 108, 52, 52, 'i-acc-o')}${C(296, 134, 14, 'i-acc')}
      ${[0, 1, 2].map((i) => pop(i + 1, `${R(40 + i * 102, 200, 94, 62, 'i-tile')}${R(50 + i * 102, 210, 12, 12, i ? 'i-t' : 'i-acc')}${lines(50 + i * 102, 232, [62, 44], 10)}`)).join('')}
      ${lines(40, 280, [290, 250, 270], 11)}`)}
    ${L(0.45, pop(4, `${R(38, 84, 210, 46, 'i-select')}${[[38, 84], [248, 84], [38, 130], [248, 130]].map(([x, y]) => R(x - 3, y - 3, 6, 6, 'i-handle')).join('')}${R(38, 70, 70, 12, 'i-acc')}${T(42, 79, 'H1 · 64PX', 'i-mono i-mono--xs i-ink')}`))}
    ${L(0.86, `${ptr(250, 132)}${pop(5, `${R(268, 284, 74, 46, 'i-chip')}${C(290, 307, 14, 'i-ring i-ring--dim')}<circle class="i-score" cx="290" cy="307" r="14" pathLength="100"/>${T(282, 310.5, '100', 'i-mono i-mono--xs i-accent-t')}${T(310, 304, 'PERF', 'i-mono i-mono--xxs')}${T(310, 314, 'SEO', 'i-mono i-mono--xxs')}`, 'i-float')}`)}`,

  // Eshop product page with the cart drawer and an order toast.
  shop: () => `
    ${L(0.05, `${win(20, 18, 440, 324)}${R(110, 24, 230, 12, 'i-field')}${tx(118, 28, 90, '', 4)}`)}
    ${L(0.2, `${R(36, 50, 196, 196, 'i-media')}${PRODUCT.poly([[-0.3, -0.3, 0], [1.9, -0.3, 0], [1.9, 1.9, 0], [-0.3, 1.9, 0]], 'i-shadow')}
      ${PRODUCT.box(0, 0, 0, 1.4, 1.4, 1.4, 'i-iso-top i-iso-top--a', 'i-iso-l i-iso-l--a', 'i-iso-r i-iso-r--a')}${PRODUCT.text(0.18, 1.4, 0.55, 'GROW.', 'i-iso-word i-iso-word--ink')}
      ${[0, 1, 2, 3].map((i) => R(36 + i * 51, 254, 43, 43, i ? 'i-tile' : 'i-tile i-tile--o')).join('')}
      ${lines(248, 54, [70], 10)}${tx(248, 70, 160, 'w', 11)}${tx(248, 86, 112, 'w', 11)}
      ${[0, 1, 2, 3, 4].map((i) => R(248 + i * 12, 108, 9, 9, i < 4 ? 'i-acc' : 'i-line')).join('')}${T(312, 116, '(128)', 'i-mono i-mono--xs')}
      ${T(248, 150, '€49', 'i-big')}${T(312, 150, '€69', 'i-mono i-strike')}
      ${['S', 'M', 'L', 'XL'].map((s, i) => `${R(248 + i * 30, 164, 24, 22, i === 1 ? 'i-acc-o' : 'i-field')}${T(253 + i * 30 + (s.length > 1 ? -2 : 2), 178.5, s, i === 1 ? 'i-mono i-mono--xs i-accent-t' : 'i-mono i-mono--xs')}`).join('')}
      ${R(248, 198, 196, 28, 'i-acc')}${T(304, 215.5, 'ADD TO CART', 'i-mono i-mono--xs i-ink')}${lines(248, 240, [190, 170], 10)}`)}
    ${L(0.46, pop(1, `${R(276, 236, 172, 96, 'i-card')}${T(288, 252, 'CART (1)', 'i-mono i-mono--xs')}${Ln(276, 260, 448, 260)}
      ${R(288, 268, 22, 22, 'i-acc-o')}${tx(318, 270, 70, 'w', 5)}${tx(318, 281, 44, '', 4)}${T(410, 279, '€49', 'i-mono i-mono--xs')}
      ${R(288, 304, 148, 18, 'i-acc')}${T(334, 316, 'CHECKOUT →', 'i-mono i-mono--xs i-ink')}`))}
    ${L(0.86, `${pop(2, `${R(300, 44, 152, 28, 'i-acc')}${check(310, 55, 'i-tick i-tick--ink')}${T(326, 62, 'ORDER #1043', 'i-mono i-mono--xs i-ink')}`, 'i-float')}${ptr(380, 314)}`)}`,

  // Social content calendar: a month of posts, one opened.
  calendar: () => `
    ${L(0.05, `${win(20, 18, 440, 324)}${T(110, 34, '10 / 2026', 'i-mono')}
      ${['W', 'M'].map((s, i) => `${R(404 + i * 24, 23, 20, 14, i ? 'i-acc' : 'i-field')}${T(410 + i * 24, 33.5, s, i ? 'i-mono i-mono--xs i-ink' : 'i-mono i-mono--xs')}`).join('')}
      ${[['i-ev i-ev--a', 'REEL'], ['i-ev i-ev--w', 'POST'], ['i-ev', 'STORY']].map(([c, s], i) => `${R(36 + i * 70, 52, 10, 10, c)}${T(52 + i * 70, 61, s, 'i-mono i-mono--xxs')}`).join('')}`)}
    ${L(0.16, Array.from({ length: 35 }, (_, k) => {
      const c = k % 7; const r = Math.floor(k / 7); const x = 36 + c * 58; const y = 72 + r * 52; const d = k - 2;
      return `${R(x, y, 58, 52, 'i-cell')}${d > 0 && d <= 31 ? T(x + 5, y + 12, d, 'i-mono i-mono--xxs') : ''}`;
    }).join(''))}
    ${L(0.3, [[3, 'a'], [5, 'w'], [8, ''], [9, 'a'], [12, 'w'], [15, 'a'], [16, ''], [19, 'w'], [22, 'a'], [23, 'w'], [26, ''], [29, 'a'], [31, 'w']].map(([k, t], i) => {
      const x = 36 + (k % 7) * 58; const y = 72 + Math.floor(k / 7) * 52;
      return pop(i % 6, `${R(x + 5, y + 18, 24, 24, t === 'a' ? 'i-thumb i-thumb--a' : t === 'w' ? 'i-thumb i-thumb--w' : 'i-thumb')}${t === 'a' ? `<path class="i-ink-f" d="M${x + 14} ${y + 25} l7 5 l-7 5z"/>` : ''}${tx(x + 33, y + 22, 18, '', 3)}${tx(x + 33, y + 29, 12, '', 3)}`);
    }).join(''))}
    ${L(0.55, pop(3, `${Ln(298, 140, 298, 150, 'i-dash')}${R(262, 150, 170, 168, 'i-card i-card--a')}${C(278, 166, 7, 'i-acc')}${tx(290, 161, 64, 'w', 5)}${tx(290, 170, 40, '', 4)}
      ${R(272, 180, 150, 84, 'i-media')}${C(347, 222, 22, 'i-acc')}${R(272, 236, 150, 28, 'i-ground')}
      ${lines(272, 274, [140, 100], 9)}${T(272, 307, '09:00', 'i-mono i-mono--xs')}${check(394, 298)}${T(406, 307, 'OK', 'i-mono i-mono--xs i-accent-t')}`))}
    ${L(0.86, pop(4, chip(48, 268, 108, 'FOLLOWERS', '+XX%'), 'i-float'))}`,

  // Creator profile with a paid partnership post.
  influencer: () => `
    ${L(0.05, `${R(112, 14, 256, 332, 'i-win')}${T(124, 32, '@creator', 'i-name')}${R(184, 24, 9, 9, 'i-acc')}${T(344, 32, '···', 'i-mono')}${Ln(112, 42, 368, 42)}`)}
    ${L(0.2, `${C(160, 86, 34, 'i-ring')}${C(160, 86, 28, 'i-media')}${C(160, 80, 10, 'i-t')}<path class="i-t" d="M142 108 q18 -22 36 0z"/>
      ${[['312', 'POSTS'], ['248K', 'FOLLOWERS'], ['890', 'FOLLOWING']].map(([v, l], i) => `${T(210 + i * 52, 84, v, 'i-num')}${T(210 + i * 52, 96, l, 'i-mono i-mono--xxs')}`).join('')}
      ${lines(126, 132, [180, 140], 10)}${R(126, 156, 112, 20, 'i-acc')}${tx(158, 164, 48, 'k', 4)}${R(244, 156, 112, 20, 'i-field')}${tx(276, 164, 48, '', 4)}
      ${[0, 1, 2, 3, 4].map((i) => C(140 + i * 50, 200, 12, 'i-ring i-ring--dim')).join('')}${Ln(112, 222, 368, 222)}
      ${[0, 1, 2, 3, 4, 5].map((k) => { const x = 116 + (k % 3) * 84; const y = 226 + Math.floor(k / 3) * 60; return `${R(x, y, 80, 56, 'i-media')}${k % 2 ? C(x + 40, y + 28, 12, 'i-t') : R(x + 22, y + 14, 36, 28, 'i-t')}`; }).join('')}`)}
    ${L(0.48, pop(1, `${R(282, 174, 174, 134, 'i-card i-card--a')}${R(292, 184, 154, 84, 'i-media')}${C(369, 222, 24, 'i-acc')}${R(292, 240, 154, 28, 'i-ground')}
      ${tag(292, 276, 'PAID × GROW', 'i-tag')}${heart(392, 278, 0.8)}${T(406, 287, 'XXK', 'i-mono i-mono--xs')}${tx(292, 296, 120, '', 4)}`))}
    ${L(0.86, `${pop(2, chip(20, 120, 88, 'REACH', 'XXK'), 'i-float')}${pop(3, chip(20, 178, 88, 'ER', 'X,X%', false), 'i-float')}
      ${[0, 1, 2].map((i) => `<g class="i-rise" style="--i:${i}">${heart(440 - i * 10, 150 - i * 20, 0.7)}</g>`).join('')}`)}`,

  // Exhibition stand, isometric: platform, L-walls with a lit fascia, screen, counter, rig.
  booth: () => `
    ${L(0.05, `${poly([[0, 0, 0], [6, 0, 0], [6, 4, 0], [0, 4, 0]], 'i-floor')}${poly([[0, 4, 0], [6, 4, 0], [6, 4, -0.22], [0, 4, -0.22]], 'i-iso-l')}${poly([[6, 0, 0], [6, 4, 0], [6, 4, -0.22], [6, 0, -0.22]], 'i-iso-r')}
      ${[1, 2, 3, 4, 5].map((x) => `<line class="i-grid" x1="${iso(x, 0)[0]}" y1="${iso(x, 0)[1]}" x2="${iso(x, 4)[0]}" y2="${iso(x, 4)[1]}"/>`).join('')}
      ${[1, 2, 3].map((y) => `<line class="i-grid" x1="${iso(0, y)[0]}" y1="${iso(0, y)[1]}" x2="${iso(6, y)[0]}" y2="${iso(6, y)[1]}"/>`).join('')}
      ${isoText(0.2, 4.55, 0, '6.00 M', 'i-mono i-mono--xs')}${isoText(6.45, 3.6, 0, '4.00 M', 'i-mono i-mono--xs', 'y')}`)}
    ${L(0.18, `${poly([[0, 0, 0], [6, 0, 0], [6, 0, 3], [0, 0, 3]], 'i-wall')}${poly([[0, 0, 0], [0, 4, 0], [0, 4, 3], [0, 0, 3]], 'i-wall i-wall--side')}
      ${poly([[0, 0, 2.55], [6, 0, 2.55], [6, 0, 3], [0, 0, 3]], 'i-acc')}${isoText(0.3, 0, 2.66, 'GROW.', 'i-iso-word')}
      ${poly([[0.7, 0, 0.6], [2.7, 0, 0.6], [2.7, 0, 2.2], [0.7, 0, 2.2]], 'i-acc-o')}${poly([[1.2, 0, 1.1], [2.2, 0, 1.1], [2.2, 0, 1.9], [1.2, 0, 1.9]], 'i-acc i-glow')}
      ${poly([[3.3, 0, 0.95], [5.4, 0, 0.95], [5.4, 0, 2.15], [3.3, 0, 2.15]], 'i-screen-iso')}
      ${[0, 1, 2].map((i) => poly([[3.5, 0, 1.85 - i * 0.25], [3.5 + 1.5 - i * 0.35, 0, 1.85 - i * 0.25], [3.5 + 1.5 - i * 0.35, 0, 1.75 - i * 0.25], [3.5, 0, 1.75 - i * 0.25]], i ? 'i-t' : 'i-t i-t--w')).join('')}
      ${[0.6, 1.5, 2.4, 3.3].map((y) => poly([[0, y, 0.3], [0, y + 0.6, 0.3], [0, y + 0.6, 2.4], [0, y, 2.4]], 'i-slat')).join('')}`)}
    ${L(0.36, `${box(2.1, 2.5, 0, 2, 0.8, 1.05)}${poly([[2.1, 3.3, 0.7], [4.1, 3.3, 0.7], [4.1, 3.3, 0.9], [2.1, 3.3, 0.9]], 'i-acc')}
      ${box(4.9, 1.2, 0, 0.55, 0.55, 0.95, 'i-iso-top i-iso-top--a')}${box(5.15, 2.6, 0, 0.5, 0.5, 0.7)}
      ${[[1.1, 2.9], [4.6, 3.6], [0.9, 1.4]].map(([x, y], i) => { const [px, py] = iso(x, y); return `<g class="i-person" style="--i:${i}">${R(px - 3.5, py - 34, 7, 26, i === 1 ? 'i-t i-t--w' : 'i-t')}${C(px, py - 40, 5, i === 1 ? 'i-t i-t--w' : 'i-t')}${Ln(px - 2, py - 8, px - 2, py, 'i-line')}${Ln(px + 2, py - 8, px + 2, py, 'i-line')}</g>`; }).join('')}`)}
    ${L(0.7, `${(() => { const [ax, ay] = iso(6.45, 0, 0); const [bx, by] = iso(6.45, 0, 3); return `${Ln(ax, ay, bx, by, 'i-dash')}${Ln(ax - 4, ay - 2, ax + 4, ay + 2, 'i-line')}${Ln(bx - 4, by - 2, bx + 4, by + 2, 'i-line')}${T(bx + 8, (ay + by) / 2, '3.00 M', 'i-mono i-mono--xs i-accent-t')}`; })()}
      ${[1.2, 3, 4.8].map((x) => { const [px, py] = iso(x, 0, 3); return `${Ln(px, py, px + 9, py + 9, 'i-cable')}${R(px + 7, py + 7, 7, 5, 'i-acc')}`; }).join('')}`)}
    ${L(0.88, pop(2, chip(356, 26, 102, 'STAND', '24 M²'), 'i-float'))}`,

  // Athens: street grid, avenues to the coast, the route to the office in Agios Dimitrios.
  map: () => `
    ${L(0.04, `${Array.from({ length: 14 }, (_, i) => Ln(-80 + i * 44, 0, -170 + i * 44, H, i % 4 ? 'i-street' : 'i-street i-street--b')).join('')}
      ${Array.from({ length: 10 }, (_, i) => Ln(0, 6 + i * 40, W, -34 + i * 40 + 40, i % 3 ? 'i-street' : 'i-street i-street--b')).join('')}
      ${[[300, 120, 40, 26], [330, 160, 52, 30], [150, 150, 44, 28], [360, 220, 40, 34], [170, 60, 50, 24], [96, 186, 38, 26]].map(([x, y, w, h]) => R(x, y, w, h, 'i-block')).join('')}`)}
    ${L(0.14, `<path class="i-sea" d="M0 238 C56 226 98 250 134 280 C160 302 180 330 190 360 L0 360Z"/>
      ${[0, 1, 2, 3, 4].map((i) => `<path class="i-wave" d="M${14 + i * 20} ${284 + i * 15} q8 -4 16 0 t16 0"/>`).join('')}
      <path class="i-road" d="M228 96 C210 150 172 214 128 276"/><path class="i-road" d="M240 98 C252 156 264 204 300 360"/>
      <path class="i-road i-road--thin" d="M244 92 C300 76 380 56 480 34"/><path class="i-road i-road--thin" d="M0 128 C90 112 160 100 226 92"/>
      <path class="i-road i-road--thin" d="M0 214 C80 206 120 196 168 194 S260 214 340 244 S440 300 480 320"/>
      <polygon class="i-hill" points="196,108 214,100 226,110 220,124 202,126"/>${T(150, 120, 'ACROPOLIS', 'i-mono i-mono--xxs')}`)}
    ${L(0.3, `<path class="i-metro" d="M236 92 C244 140 252 182 262 222"/>${[[236, 92], [242, 126], [249, 158], [256, 192]].map(([x, y]) => R(x - 3, y - 3, 6, 6, 'i-station')).join('')}
      ${R(206, 146, 22, 12, 'i-field')}${T(210, 155, 'M2', 'i-mono i-mono--xs')}
      <path class="i-route" pathLength="1" d="M240 98 C252 156 258 190 266 226"/>${R(232, 86, 16, 12, 'i-acc-o')}
      ${T(254, 82, 'SYNTAGMA', 'i-mono i-mono--xs')}${T(52, 228, 'PIRAEUS', 'i-mono i-mono--xs')}${T(42, 334, 'SARONIC GULF', 'i-mono i-mono--xxs')}${T(312, 316, 'GLYFADA ↓', 'i-mono i-mono--xxs')}
      ${R(390, 330, 60, 2, 'i-t i-t--w')}${R(390, 326, 1, 10, 'i-t i-t--w')}${R(449, 326, 1, 10, 'i-t i-t--w')}${T(406, 322, '1 KM', 'i-mono i-mono--xxs')}`)}
    ${L(0.62, `<g class="i-pin">${C(266, 226, 30, 'i-pulse')}${C(266, 226, 9, 'i-acc')}${C(266, 226, 3, 'i-ink-f')}</g>
      ${pop(1, `${Ln(275, 232, 290, 246, 'i-dash')}${R(290, 240, 170, 58, 'i-card i-card--a')}${T(302, 260, 'GROW AGENCY', 'i-h i-h--xs')}${T(302, 276, '37.93°N · 23.73°E', 'i-mono i-mono--xs i-accent-t')}${T(302, 289, 'AG. DIMITRIOS · 173 43', 'i-mono i-mono--xxs')}`)}`)}
    ${L(0.86, `${C(436, 48, 16, 'i-ring i-ring--dim')}<path class="i-acc" d="M436 34 l5 14 l-5 -3 l-5 3z"/>${T(432.5, 76, 'N', 'i-mono i-mono--xs')}
      ${pop(2, chip(26, 26, 96, 'METRO', 'LINE 2'), 'i-float')}`)}`,

  // Monthly report dashboard: KPI tiles, trend chart, channel split.
  dashboard: () => `
    ${L(0.05, `${win(20, 18, 440, 324)}${T(110, 34, 'GROW. REPORT', 'i-mono')}${C(398, 30, 3, 'i-acc i-blink')}${T(406, 34, 'LIVE', 'i-mono i-mono--xs i-accent-t')}
      ${R(20, 42, 44, 300, 'i-side')}${[0, 1, 2, 3, 4].map((i) => R(34, 58 + i * 26, 16, 16, i === 1 ? 'i-acc' : 'i-line')).join('')}`)}
    ${L(0.2, [['ROAS', 'X,X'], ['CPA', 'XX€'], ['LEADS', '+XX%'], ['SPEND', 'XXK€']].map(([l, v], i) => pop(i, `${R(76 + i * 94, 54, 88, 56, i === 2 ? 'i-tile i-tile--a' : 'i-tile')}${T(86 + i * 94, 72, l, i === 2 ? 'i-mono i-mono--xs i-ink' : 'i-mono i-mono--xs')}${T(86 + i * 94, 98, v, i === 2 ? 'i-val i-ink' : 'i-val')}`)).join(''))}
    ${L(0.38, `${R(76, 122, 258, 206, 'i-tile')}${T(88, 140, 'CONVERSIONS', 'i-mono i-mono--xs')}
      ${[176, 216, 256, 296].map((y) => Ln(88, y, 322, y, 'i-grid')).join('')}
      ${[34, 48, 40, 62, 56, 80, 72, 98, 92, 118].map((h, i) => `<rect class="i-bar ${i === 9 ? 'i-acc' : 'i-dim'}" style="--i:${i}" x="${92 + i * 23}" y="${310 - h}" width="14" height="${h}"/>`).join('')}
      <polyline class="i-path" pathLength="1" points="99,262 122,254 145,258 168,238 191,240 214,222 237,224 260,200 283,204 306,176"/>
      ${R(344, 122, 106, 206, 'i-tile')}${T(354, 140, 'CHANNELS', 'i-mono i-mono--xs')}
      ${[['GOOGLE', 78, 'i-acc'], ['META', 56, 'i-t i-t--w'], ['TIKTOK', 34, 'i-t'], ['SEO', 46, 'i-t']].map(([l, w, c], i) => `${T(354, 166 + i * 40, l, 'i-mono i-mono--xxs')}${R(354, 172 + i * 40, 86, 6, 'i-track')}${R(354, 172 + i * 40, w, 6, c + ' i-grow')}`).join('')}`)}
    ${L(0.82, pop(5, `${C(306, 176, 5, 'i-acc')}${Ln(306, 182, 306, 310, 'i-dash')}${R(224, 140, 74, 26, 'i-chip i-chip--a')}${T(232, 157, '+XX%', 'i-mono i-accent-t')}`))}`,
};

// Aliases kept for older references.
ILL.ads = ILL.search;
ILL.social = ILL.meta;

const LABELS = {
  search: 'Διαφήμιση στην αναζήτηση της Google', ads: 'Διαφήμιση στην αναζήτηση της Google',
  meta: 'Χορηγούμενη ανάρτηση στο Facebook και στο Instagram', social: 'Χορηγούμενη ανάρτηση στο Facebook και στο Instagram',
  tiktok: 'Διαφήμιση σε βίντεο στο TikTok', chat: 'Διαφήμιση στο ChatGPT',
  seo: 'Άνοδος θέσεων στη Google', content: 'Άρθρο και ημερολόγιο περιεχομένου',
  web: 'Κατασκευή ιστοσελίδας σε browser', shop: 'Σελίδα προϊόντος και καλάθι eshop',
  calendar: 'Ημερολόγιο αναρτήσεων social media', influencer: 'Προφίλ influencer με συνεργασία',
  booth: 'Εκθεσιακό περίπτερο', map: 'Το γραφείο της GROW στον Άγιο Δημήτριο',
  dashboard: 'Μηνιαία αναφορά αποτελεσμάτων',
};

export const ILLUSTRATIONS = Object.keys(LABELS);

export function illustration(name, small = false) {
  const key = ILL[name] ? name : 'dashboard';
  return `<svg class="ill ill--${key}${small ? ' ill--sm' : ''}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${LABELS[key]}" xmlns="http://www.w3.org/2000/svg">
  ${ILL[key]()}
</svg>`;
}
