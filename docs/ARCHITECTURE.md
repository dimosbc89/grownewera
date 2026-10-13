# Front-end architecture and motion contract

This file is the contract between the markup (lib/*.mjs), the motion layer (src/js/motion/*) and
the WebGL layer (src/js/three/*). Each layer only relies on the hooks listed here. Renaming or
removing a hook is a breaking change: update this file and every consumer in the same commit.

## Brand rules (never break)

* Palette: `--black #000`, `--panel #0a0a0a`, `--white #fff`, `--grey #bababa`, `--lime #ccff00`
  (the single accent), `--red #ff3d2e` (negatives only: ✕ marks, errors). In WebGL use the same
  values. No other hues; tints/shades of these are fine.
* Type: headings Space Grotesk (Greek falls through to Manrope), uppercase, heavy, tight tracking;
  body Inter; labels JetBrains Mono. Zero corner radius everywhere. Thin 1px rules. Numbered cards.
* Copy comes from the Word doc only. Never rewrite, drop or invent Greek copy. `[…]` slots stay.

## Module layout

```
src/js/main.js              boot only: initMotion(), initThree(), initForm(), initCookies()
src/js/motion/index.js      initMotion(): runs every motion module in order (two phases), returns { lenis, scrollTo }
src/js/motion/util.js       shared flags (motion, finePointer) and DOM helpers ($, $$, headerH, pad, clamp)
src/js/motion/ease.js       CustomEase curves shared by every module (`EASE`)
src/js/motion/velocity.js   one smoothed scroll velocity (`velocity()`) and `skew()` for velocity-leaning type
src/js/motion/scramble.js   `scramble(el)`: text-decode effect with exact restore
src/js/motion/smooth.js     Lenis + ScrollTrigger glue (lenis, scrollTo, jumpTo, refresh helpers)
src/js/motion/split.js      split(el, { mode: 'words' | 'chars' }) -> inner spans
src/js/motion/header.js     sticky header, progress bar, mega menus, mobile menu
src/js/motion/preloader.js  first-visit preloader, fires `grow:ready`
src/js/motion/hero.js       hero intro timeline (fires `grow:hero-in`) + layered hero parallax
src/js/motion/reveals.js    reveals, split titles, scrub lead, [data-parallax], section numerals, clip reveals
src/js/motion/pin.js        [data-hscroll], [data-steps], [data-story] progress, [data-stack], pinned statements
src/js/motion/marquee.js    [data-marquee]
src/js/motion/pointer.js    cursor, [data-magnetic], [data-tilt], [data-depth] pointer parallax
src/js/motion/transitions.js page transitions (curtain)
src/js/motion/ui.js         FAQ, filters (+ Flip), counters, legal TOC, [data-scramble], [data-strike]
src/js/three/index.js       initThree(): finds canvases, picks quality tier, lazy-imports the rest
src/js/three/core.js        async createStage(canvas, opts): renderer, scene, camera, rig, post-processing, loop
src/js/three/post.js        post-processed hero: MSAA target, selective bloom, grain/aberration/vignette (lazy)
src/js/three/util.js        brand palette, materials, dust, easing, simplex noise, disposeTree
src/js/three/scenes/*.js    one hero scene per file: helix, bars, orb, panels, blocks, globe
src/js/three/scenes/_shared.js  scene helpers: frame()/shiftFrame() composition, look(), localPointer(), glow/points
src/js/three/scenes/_land.js    land masks for the globe (Natural Earth, public domain)
src/js/three/story.js       scroll-story morphing particles (canvas[data-scene="story"])
src/js/three/story-shapes.js story shape sets ([data-story] value -> shapes) and the step -> shape mapping
src/js/three/wordmark.js    CTA 3D "GROW." wordmark (canvas[data-scene="wordmark"])
src/js/three/wordmark-glyphs.json  "GROW." outlines from Space Grotesk 700 (tools/wordmark-glyphs.mjs)
src/css/motion.css          initial/hidden states and CSS used only by the motion layer
src/css/three.css           canvas/stage styling used only by the WebGL layer
```

Three.js must stay out of the main bundle: `three/index.js` imports `core.js` and scenes with
dynamic `import()` only when a canvas is on the page.

### Scene module API (`src/js/three/scenes/<name>.js`)

```js
import * as THREE from 'three'; // every module imports three itself (never pass the namespace
                                // around as a value: that keeps all of three in the bundle)
export default function build(ctx) {
  // ctx: { scene, camera, rig, renderer, small, quality, palette, motion }
  //   rig      THREE.Group already positioned for the layout (right of headline on desktop)
  //   quality  'high' | 'mid' | 'low'
  //   palette  { lime, white, ink, black, red } as THREE.Color
  return {
    update(time, scroll, pointer, dt) {}, // scroll: 0..1 progress of the hero leaving the viewport
                                          // pointer: { x, y } in -1..1, smoothed
                                          // dt: seconds since the last frame (0 for still frames);
                                          // ease with damp(rate, dt) from core.js, never a fixed
                                          // per-frame factor (that lags at low frame rates)
    dispose() {},                     // optional
    resize(width, height, ctx) {},    // optional, after the camera aspect is updated
    setQuality(quality, ctx) {},      // optional, after an automatic tier drop
  };
}
```

`ctx` also carries `canvas` and `invalidate()` (request one redraw; only needed for still frames).
`time` is seconds of *visible* animation: it stays at 0 while the first-visit preloader covers the
page and does not advance while the canvas is paused, so intros always play on screen.
`createStage()` is async: it builds in steps, each in its own idle slot (context, environment map,
scene build, post-processing targets on the high tier, shader compile with
`KHR_parallel_shader_compile` where available; bloom/grain ease in), so it never blocks the main
thread for the whole setup. It resolves with the stage once the first frame is queued (or `null`
if the canvas left the page); a rejection makes `three/index.js` fall back. No stage starts this
work before `grow:hero-in`.
`story.js` and `wordmark.js` export `mount(canvas, opts)` and build on `createStage` with
`layout: 'center'` (no hero rig offset, no post-processing).

#### Engine additions (three/core.js, post.js)

* `ctx.input`: `pointer` (the object `update()` gets), `velocity { x, y, scroll }` (smoothed;
  pointer in -1..1 units/s, y up; scroll in viewport heights/s, down > 0), `local { x, y, inside }`
  (pointer in the canvas's own NDC, y up; only for stages created with `localPointer: true`) and
  `active` (0..1, the pointer moved recently). Touch devices: pointer values stay 0.
* `ctx.clock`: `{ elapsed, started }`, seconds since `grow:ready`, shared by every stage (started
  by three/index.js at boot). Scene `time` keeps its meaning (visible seconds of this canvas).
* `build(ctx)` may also return:
  `bloom: { strength, radius, threshold, white }` (high tier; read every frame, so it can animate;
  defaults `post.js` `BLOOM` = 0.8 / 0.65 / 0.72 / 0.1). `threshold` is linear HDR brightness (max
  channel); only the excess above it glows, scaled by saturation, so lime and emissive parts glow
  while lit white/grey surfaces stay crisp (`white`, 0..1, is how much they may still glow).
  `render(ctx)`: replaces `renderer.render(scene, camera)` on stages without post-processing.
  `restore(ctx)`: after a lost WebGL context came back (re-render render-to-texture results).
* High tier pipeline: the hero's context is created without antialiasing; the scene renders into a
  half-float MSAA target (x4 below a pixel ratio of 1.5, x2 at 1.5; the tier's DPR is capped at
  1.5), then bloom, then one final pass (very subtle edge chromatic aberration, vignette, the
  renderer's tone mapping + sRGB, fine luminance-weighted grain). A tier drop keeps the target and
  tone mapping, turns the effects off and lowers the samples (`mid` x2, `low` none:
  `postFx.setTier(q)`). A weak GPU (software rasteriser, integrated Intel; read from the context's
  unmasked renderer) starts at `mid` the same way, unless `?gl=` forces the tier.
* `env` (createStage option) is `true`, `false` or a function `(renderer) -> texture`.
* Lifecycle: ResizeObserver on the canvas plus devicePixelRatio changes; the loop pauses off-screen,
  in a hidden tab and at zero size (e.g. `display: none`). On `webglcontextlost` the loop stops;
  after 4s without a restore the canvas gets `data-lost` (three.css hides it); on restore the
  environment map is rebuilt and drawing resumes.
* Story (`story.js`): `data-story` sets are `growth` (default; also any unknown value), `ads`,
  `seo`, `build`, `social`, `booth`, `company`, `contact`, `case` (shapes in story-shapes.js). Step
  i shows shape i of the set; fewer steps than shapes pick evenly spread shapes, more steps cycle,
  and the last step always ends on the set's last shape. A morph (~1.9s, staggered per particle)
  starts when `step` changes; `progress` drives the camera drift.

#### Hero scenes (`scenes/*.js`, helpers in `scenes/_shared.js`, land masks in `scenes/_land.js`)

* Every scene returns `bloom: { strength, radius, threshold }` (see "Engine additions": read each
  frame on the `high` tier, merged over post.js `BLOOM`, so `white` keeps its default). Each scene
  also looks right with the defaults.
* Composition is the scene's job: `frame()` (called from the scene's `resize`) resets the rig to
  the origin, scales it and shifts the projection with `camera.setViewOffset`, so the object sits
  right of the measured hero copy on wide canvases (never under it) and above / behind the
  headline on phones, while the camera is free to orbit. With `hud: k` (the helix) it is fitted
  inside the measured `.hero__hud` viewfinder instead (centred, height k of the frame, never past
  its right edge). `shiftFrame()` moves that anchor per frame
  (scroll choreography). The copy edge is read from the text line boxes on resize only.
* `look()` switches the stage to `THREE.NeutralToneMapping` (ACES turns #ccff00 olive and bleaches
  bright lime to white); `tuneLights()` rebalances the lights `createStage()` adds.
* `localPointer()` gives local interactions the pointer in canvas NDC, presence, velocity and touch
  pulses (window listeners, removed in `dispose()`); core's smoothed pointer still drives the tilt.
* Still frames (`motion: false`) render the finished state (intros complete), never a half intro.

## DOM hooks

| Hook | Where (markup) | Consumer | Meaning |
| --- | --- | --- | --- |
| `[data-hero]` | hero `<section>` | motion, three | the hero; scroll progress is measured against it |
| `[data-depth="n"]` | hero layers (`.hero__stage`, `.hero__grid`, title, `.hero__layer` wrappers), `.ill` inner `<g>` layers | motion/pointer, motion/hero | parallax depth, 0 = fixed, 1 = full; used for scroll and pointer parallax. Never on an element GSAP tweens (see below) |
| `canvas[data-scene="<mode>"]` | `.hero__stage`, story, CTA | three | `helix bars orb panels blocks globe story wordmark` |
| `[data-split]` / `="hero"` / `="chars"` | headings | motion/split | word or char split reveal |
| `[data-reveal]` `[data-stagger]` | blocks / grids | motion/reveals | fade-up reveal; stagger children |
| `[data-clip]` | art, cards | motion/reveals | clip-path wipe reveal |
| `[data-scrub]` | lead paragraph | motion/reveals | word-by-word light-up while scrolling |
| `[data-parallax="k"]` | any | motion/reveals | scroll parallax, k = speed (-1..1) |
| `.sec-bgnum` | every `.sec` | motion/reveals | big outline section numeral, parallax |
| `[data-hscroll]` | home services | motion/pin | pinned horizontal reel |
| `[data-steps]` | ordered step lists | motion/pin | drawn progress line, active step |
| `[data-story="<set>"]` | wrapper around a step list + sticky canvas | motion/pin -> three/story | motion dispatches `grow:story` on the canvas: `detail { progress 0..1, step, steps }` |
| `[data-stack]` | card grids to stack | motion/pin | sticky stacking cards, earlier cards scale/dim |
| `[data-pin-statement]` | statement sections | motion/pin | pinned section, paragraphs advance on scroll |
| `[data-strike]` | negative ✕ points | motion/ui | red strike / cross draws in on scroll |
| `[data-scramble]` | mono labels | motion/ui | text scramble on reveal and hover |
| `[data-filters]` + `[data-filter-list]` | works, blog | motion/ui | filtering with Flip animation |
| `[data-count]` | stat numbers | motion/ui | count-up |
| `[data-marquee="speed"]` | marquees | motion/marquee | loop, velocity reactive |
| `[data-magnetic]` `[data-tilt]` | buttons, cards | motion/pointer | micro-interactions |
| `[data-cta]` | CTA band | motion, three | CTA reveal; holds the wordmark canvas. `.is-open` (motion/reveals.js) once the band has mostly grown out of its square: the wordmark stage only shows from then on (three.css) |
| `[data-footer-word]` | footer wordmark | motion/reveals | rise-in |
| `.preloader` | layout shell | motion/preloader | first-visit loader |
| `.curtain` | layout shell | motion/transitions | page transition |

### Events and classes

* `grow:ready` (window): preloader finished (or skipped). Hero intro starts on it. Fired once,
  asynchronously, so every module has subscribed; inside the motion layer use `onReady(fn)`.
  Nothing heavy may run before it: the WebGL layer only downloads modules until then (on the
  `mid` / `low` tiers the hero's modules are not even requested before it).
* `grow:hero-in` (window, motion/hero.js -> three, motion/index.js): the hero intro copy has
  landed. Every WebGL stage's heavy setup waits for it so the preloader and the intro never stall
  (fallback: 3s after `grow:ready`), and the motion layer's second boot phase starts on it (see
  "Motion boot"). Not fired without motion; the WebGL layer then only waits for `grow:ready`.
* `grow:story` (on the story canvas): see table; `detail` also has `set` (the `data-story` value).
* `grow:story-listen` (on the story canvas, three -> motion): the lazily loaded story module is
  listening; motion/pin.js replays the current `grow:story` state.
* `grow:consent` (window): cookie choice.
* `<html>` classes: `js`, `motion` | `no-motion`, `curtain-in`, `has-cursor`, `is-loading`.
  `<html data-gl="high|mid|low">` is the starting WebGL tier.
* State classes set by motion: `.is-stacked` ([data-stack] grid in stacking mode), `.is-struck`
  ([data-strike] drawn), `.is-statement` (pinned statement active), `.is-active` (step reached).
* Story markup extras: `[data-story-step]` (HUD step counter inside `.story__stage`), and the
  `--story` custom property (0..1) on the `[data-story]` wrapper.
* `[data-depth]` layers move through the CSS `translate` property composed from `--px`/`--py`
  (pointer, motion/pointer.js) and `--sy` (scroll; motion/hero.js for the hero, motion/pointer.js
  inside `.ill`). GSAP (3.12+) folds `translate` into its own transform and writes inline
  `translate: none` on any element it tweens a transform on, which silently kills the depth. So no
  GSAP tween may target a `[data-depth]` element: put the depth on a wrapper (the hero copy uses
  `.hero__layer[data-depth]` around `[data-hero-in]`) and animate the inner element, or use CSS
  (the hero canvas fades/zooms in by CSS transition, never via `.hero__stage`).
* Stacking cards ([data-stack]): a covered card is scaled, shaded (deeper when two or more cards
  sit on it), clipped at the bottom to the settled bottom of the card on top (so a taller card
  never shows below or between later cards) and, at the end of the grid, held (`yPercent`) until
  the card on top leaves. The grid's `[data-stagger]` reveal owns `y` on the cards.
* Canvases get `data-quality` (current tier) and `data-ready` (first frame drawn; three.css fades
  canvases in on it, with motion).
* `.is-static` (on a canvas's parent, three/index.js): WebGL is missing or failed and the canvas
  was removed. `.story__stage.is-static` (and `.no-js .story__stage`) draws the growth story as a
  CSS bar chart driven by `--story`; it is hidden on phones, where the stage is only a backdrop.
* sessionStorage: `grow-preloaded` (preloader shown this session), `grow-curtain` (transition).

### Story sets (`data-story` values, lib/site.mjs `STORIES` / `storySet()`)

| Set | Pages |
| --- | --- |
| `growth` | home, and any page not listed below |
| `ads` | Google Ads, Facebook & Instagram ads, TikTok ads, ChatGPT ads |
| `seo` | Προώθηση ιστοσελίδων (SEO), Content marketing |
| `build` | Κατασκευή ιστοσελίδων, Κατασκευή eshop |
| `social` | Διαχείριση social media, Influencer marketing |
| `booth` | Εκθεσιακά περίπτερα |
| `company` | Η εταιρεία |
| `contact` | Επικοινωνία |
| `case` | case studies (`/erga/<slug>/`) |

three/story.js must accept every set (falling back to `growth` for one it does not draw yet).

### Markup additions (lib/*, styled in src/css; none is required by motion or WebGL)

* Shell order: preloader, skip link, cookie banner (`role=dialog`, reached by Tab right after the
  skip link), header, `#mnav`, `<main id=main>`, footer. Nav links: `aria-current="page"` on the
  link to this page, `"true"` on a parent section's link.
* FAQ answers (`.faq__a`) carry no `[data-reveal]` / `[data-stagger]`: the accordion
  (motion/ui.js) reveals them; motion.css keeps any that slip in visible.
* Contact form: `action` is `SITE.formEndpoint` or `mailto:` (`enctype=text/plain`, so it works
  without JS; form.js sets `noValidate` and handles both). `data-err-required|email|consent` hold
  the inline messages: an invalid field gets `.is-invalid`, `aria-invalid`, a `.field__err`
  (`aria-describedby`) and stays red until it is valid; the status line clears once all are.
* `.draft-note` (drafts only) sets `--note-h` on `<html>` (main.js measures it); the hero below it
  sizes its first screen and viewfinder with it.
* Result cards keep the `[DEMO n]` marker visible (in their tag) while `SITE.showDrafts` is on.

* Hero: `.hero--<kind>` (page kind from build.mjs) sets the title scale. `.hero__top` (running head
  with the breadcrumbs, outside `.hero__inner`), `.hero__foot.hero__data` (aria-hidden mono strip of
  `.hero__cell` > `.hero__k` + `.hero__v`; keeps `.scroll-cue` and `.coords`), and on pages with a
  scene `.hero__hud[data-depth]` (viewfinder corners + `.hero__fig` caption around the 3D stage;
  hidden on phones; with motion it fades in once the canvas has drawn its first frame
  (`data-ready`); three/index.js removes it with the stage when WebGL is off or fails). The hero's
  first screen fits short viewports: the title size is capped by the viewport height (`--hero-cap`)
  under 780px tall and in phone landscape, and the viewfinder is sized against the visible part
  of the hero (`--hero-vis`), never the whole hero. On
  desktop the copy column stays within ~60% of the width, so the right ~40% is free for the rig.
* CTA: `.cta__rail` (aria-hidden mono row along the band's bottom) sits outside `.cta__inner`, which
  holds the copy only (three/wordmark.js measures it). The copy column is ≤ ~13ch / 46ch wide.
* Story stage extras: `.story__set` (set label) and `.story__bar > i` (progress rule,
  `scaleX(var(--story))`) inside `.story__stage`.
* Sections: plain sections alternate `.sec--split` (`.split`, sticky heading) and
  `.sec--offset` (`.offset` with `.sec-head--offset`: index in a left gutter, heading and body
  from the fourth column); wide content always takes the offset layout. FAQ summaries hold
  `.faq__n` (number) + `.faq__q` (question).
* Illustrations (lib/illustrations.mjs): `illustration(name, small)` with `name` in
  `search meta tiktok chat seo content web shop calendar influencer booth map dashboard`
  (`ads`/`social` are aliases). Per-page choice: `ARTS` / `HOME_ARTS` / `PROJECT_ARTS` in
  lib/site.mjs (build.mjs sets `page.art` from `ARTS`). Staged build classes (`.i-pop .i-float
  .i-bar .i-grow .i-path .i-route .i-dot .i-person .i-score`) are hidden only under `.js.motion`
  until `.ill.is-in`.

## Quality and accessibility rules

* `prefers-reduced-motion: reduce` -> no Lenis, no pins/scrubs/parallax, WebGL renders one still
  frame, everything visible. Without JS everything is visible.
* WebGL tiers: `high` (fine pointer, ≥6 cores or unknown, ≥4 GB device memory or unknown) ->
  post-processing (MSAA, bloom, grain); `mid` (touch / small screens / ≤4 cores / <4 GB / a 3G
  connection, or a weak GPU detected by core.js) -> no post, DPR ≤ 1.5; `low` (reduced motion) ->
  still. Data saver on or a 2G connection: no WebGL at all (every canvas falls back, nothing of
  three is downloaded). On `high` the hero's module graph is preloaded at boot
  (`<meta name="gl-preload" content="url …">`, written by build.mjs from the esbuild metafile;
  three/index.js adds the `modulepreload` links).
  Drop a tier automatically when frames average > 24ms for 2s. Pause every canvas when off-screen
  or when the tab is hidden. (A tier reached by dropping keeps animating: `low` then means DPR 1;
  still frames come from `motion: false`, i.e. reduced motion.) Only the hero mounts at load
  (its heavy setup after `grow:hero-in`, like every stage); story and wordmark canvases mount when
  they come within one viewport. Setup always runs in idle-time steps (see `createStage()`); no
  boot-time probe context is created (a missing WebGL2 shows up as a failed `getContext` in
  `createStage()`, and that canvas falls back).
* The CTA wordmark stays clear of the copy (measured on resize): right of it when the band has
  room, otherwise hanging off the top-right corner inside the band's top padding (never behind the
  black-on-lime buttons).
* Animate transforms and opacity only. No layout thrash in scroll handlers.

## Build

`node build.mjs [--out <dir>] [--watch]`. Fonts: `src/css/fonts.css` declares only the Greek +
Latin subsets (6 files); the Greek heading face (Manrope), Space Grotesk Latin and Inter Greek +
Latin are preloaded. The build warns (`[layout] …`) when a page kind loses a block it is expected
to render (result cards, testimonials, people, stats). Agents working in parallel must build into their own
`--out` directory and serve it with `node tools/serve.mjs --dir <dir> --port <n>`.
Sources resolve against the repo, so the build runs from any directory; `--out` resolves against
the working directory (default `<repo>/dist`). The output folder is wiped first, so the build
refuses the filesystem root, the repo or any of its parents, anything inside the repo except
`dist/` and `.builds/<name>/`, files, and non-empty folders that do not hold a previous build
(`assets/` + `404.html`).

`node tools/wordmark-glyphs.mjs` regenerates `src/js/three/wordmark-glyphs.json` from the static
Space Grotesk 700 (devDependencies `opentype.js`, `@fontsource/space-grotesk`). The JSON is
committed; the site build never needs the font parser.

Debugging WebGL: `?gl=high|mid|low` forces the starting tier and disables the automatic drop
(useful in software-GL test browsers, which always drop); `?gl=off` skips WebGL entirely.

## Motion boot (motion/index.js)

`initMotion()` runs in two phases so the first screen never waits for the whole page:

* now: smooth scroll, velocity, transitions, header, preloader, hero (what the first screen needs).
* later: reveals, pins, marquees, pointer, UI and then `settle()`, one module per task (the
  browser paints in between). Starts on `grow:hero-in`, on the first scroll / wheel / touch / key /
  pointer press, right away when the page opens scrolled (a hash, a restored position) or has no
  hero intro (reduced motion), else 2.5s after `grow:ready` at the latest. Below-the-fold content
  stays in its pre-reveal state until then. A module that throws there drops the motion classes
  (`motion-failed`), like a failure in the first phase does in main.js.
* main.js calls `initThree()` before `initMotion()`, so WebGL downloads are not queued behind the
  motion setup. ScrollTrigger's own DOMContentLoaded / load refreshes are off (`autoRefreshEvents:
  'visibilitychange,resize'`); `settle()` refreshes once, then fonts, the load event, images,
  canvases and height changes coalesce into one idle-time refresh.

Other runtime rules added with it:

* `scrollTo(target)` (smooth.js) keeps the header clear once: a target with its own
  `scroll-margin-top` (the form, legal headings) uses that margin, others get the header height +
  16px. `jumpTo(hash)` scrolls and moves the focus to the target (`tabindex="-1"` added when it is
  not focusable): transitions.js uses it for same-page anchors (skip link, `#form`). A second
  click while leaving falls through to native navigation; a bfcache restore resets the leave state.
* `[data-stack]` grids only stack when their tallest card fits under the header
  (`height + header + 24 <= innerHeight`); otherwise they stay a plain list (decided at load and
  when the width changes). Stacking cards get no pointer tilt (pin.js owns their `rotationX`).
* The pinned reel scrolls the page to a card that receives keyboard focus (and resets any
  sideways scroll the browser gave a clipping ancestor).
* While the mobile menu is open, `main`, the footer, the skip link and the cookie banner are
  `inert`; a link in the menu closes it before the click is handled (page transition or jump); `#mnav` and `.cookie` carry `data-lenis-prevent` (their own scroll works while Lenis
  is stopped / running). The header ignores the scroll position ScrollTrigger reports while it
  refreshes (it would read as the top of the page).
* `split()`: punctuation right after an inline `<mark>`/`<a>` unit joins that unit, and a
  one-letter word joins the next word (no-break space), so neither can start / end a line alone.

## Motion layer additions (src/js/motion/*, src/css/motion.css)

New modules: `ease.js` (CustomEase set `grow.out|expo|inOut|wipe|lift|in`, exported as `EASE`),
`velocity.js` (one smoothed scroll velocity, `velocity()` in px/s, and `skew(el, { k, max, axis })`
for velocity-leaning big type; never on a `[data-depth]` element), `scramble.js`
(`scramble(el, { duration, delay })`, text nodes only, exact restore). `util.js` adds `touch`,
`damp(rate, dt)`, `busy` (WeakSet: elements mid-reveal, pointer tilt skips them) and
`gridEdges()` / `makeColumns()` (the four brutalist columns on the hero grid lines, shared by the
preloader and the page transition). `initMotion()` and `main.js` are idempotent (one boot).

Hooks and classes added (all decorative injections are `aria-hidden`):

* `split()` chars mode: when the heading is uppercased by CSS, char units hold the word uppercased
  with the page language (Greek accents drop as for the whole word), the heading gets the original
  copy as `aria-label` and the units are `aria-hidden`. `lines(units)` groups units per line.
  `[data-split].is-in`: revealed, masks lifted. The hero title gets an inner `.hero__title-in`
  wrapper (exit transform; the h1 keeps `[data-depth]`).
* `.trust` gets `data-depth="-0.14"` at runtime when the markup has none (foreground layer).
* `[data-clip]`: `.clip-cover` (lime block, removed after the wipe), `.is-clipped` when done.
* `[data-stack]` grids reveal by opacity only (supersedes "the reveal owns `y`": pin.js owns the
  cards' transforms: scale, `rotationX` tilt-back, `yPercent` hold).
* `[data-steps]`: `.is-active` is measured on the list (step tops crossing 65%), like the story.
  `[data-story]`: `.is-current` on the current step, `.story__progress` rule in the stage.
* `[data-pin-statement]`: each paragraph's first sentence is wrapped in `.stmt-key` (text
  unchanged); paragraphs get `.is-current` / `.is-past`; pinned desktop variant adds `.stmt-hud`
  in the heading. `[data-hscroll]`: `.hscroll__hud` while pinned; `.hscroll.is-swipe` (native
  horizontal swipe) on touch screens ≥761px, where nothing is pinned.
* Legal TOC: `.toc__progress` on its top rule. Filters: list `min-height` held during Flip.
* Preloader: `.preloader__cols` / `.preloader__col`, `.has-cols`, `.is-lifting`, `.pl-c` letters,
  `.preloader__wipe`. `grow:ready` fires as the columns start lifting (~1.3s); CSS failsafe 2.4s.
* Curtain: `.curtain__frame` > `.curtain__cols` (`.curtain__col` ×4) + `.curtain__label`
  (`.curtain__path`, `.curtain__name`), `.has-cols`. sessionStorage `grow-curtain-label`
  (`{ name, path }`, written on leave, read and removed on arrival). Internal pages are
  prefetched (`<link rel=prefetch>`) on hover / click.
* Cursor: `.is-btn`, `.is-glyph` (+ / − / ↗ labels), `.is-dark` (over lime) besides the existing
  `.is-link`, `.is-label`, `.is-text`.
* `<html>.motion-failed` (main.js): the motion layer threw; motion.css drops inline hidden states.
* Touch (`(hover: none)` or `(pointer: coarse)`): no ScrollTrigger pins (reel swipes, statement
  lights up per paragraph), lighter flip-in, drift and skew. Reduced motion: none of the above.
