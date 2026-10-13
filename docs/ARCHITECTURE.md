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
src/js/motion/index.js      initMotion(): runs every motion module in order, returns { lenis, scrollTo }
src/js/motion/util.js       shared flags (motion, finePointer) and DOM helpers ($, $$, headerH, pad, clamp)
src/js/motion/smooth.js     Lenis + ScrollTrigger glue (lenis, scrollTo, refresh helpers)
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
src/js/three/post.js        `high` tier pipeline: MSAA target, selective bloom, grain/aberration/vignette (lazy)
src/js/three/util.js        brand palette, materials, dust, easing, simplex noise, disposeTree
src/js/three/scenes/*.js    one hero scene per file: helix, bars, orb, panels, blocks, globe
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
export default function build(ctx) {
  // ctx: { THREE, scene, camera, rig, renderer, small, quality, palette, motion }
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
  half-float MSAA x4 target, then bloom, then one final pass (very subtle edge chromatic
  aberration, vignette, the renderer's tone mapping + sRGB, fine luminance-weighted grain). A tier
  drop keeps the MSAA target and tone mapping and turns the effects off.
* Lifecycle: ResizeObserver on the canvas plus devicePixelRatio changes; the loop pauses off-screen,
  in a hidden tab and at zero size (e.g. `display: none`). On `webglcontextlost` the loop stops;
  after 4s without a restore the canvas gets `data-lost` (three.css hides it); on restore the
  environment map is rebuilt and drawing resumes.
* Story (`story.js`): `data-story` sets are `growth` (default; also any unknown value), `ads`,
  `seo`, `build`, `social`, `booth`, `company`, `contact`, `case` (shapes in story-shapes.js). Step
  i shows shape i of the set; fewer steps than shapes pick evenly spread shapes, more steps cycle,
  and the last step always ends on the set's last shape. A morph (~1.9s, staggered per particle)
  starts when `step` changes; `progress` drives the camera drift.

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
| `[data-cta]` | CTA band | motion, three | CTA reveal; holds the wordmark canvas |
| `[data-footer-word]` | footer wordmark | motion/reveals | rise-in |
| `.preloader` | layout shell | motion/preloader | first-visit loader |
| `.curtain` | layout shell | motion/transitions | page transition |

### Events and classes

* `grow:ready` (window): preloader finished (or skipped). Hero intro starts on it. Fired once,
  asynchronously, so every module has subscribed; inside the motion layer use `onReady(fn)`.
  Nothing heavy may run before it: the WebGL layer only downloads modules until then.
* `grow:hero-in` (window, motion/hero.js -> three): the hero intro copy has landed. Every WebGL
  stage's heavy setup waits for it so the preloader and the intro never stall (fallback: 3s after
  `grow:ready`). Not fired without motion; the WebGL layer then only waits for `grow:ready`.
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

## Quality and accessibility rules

* `prefers-reduced-motion: reduce` -> no Lenis, no pins/scrubs/parallax, WebGL renders one still
  frame, everything visible. Without JS everything is visible.
* WebGL tiers: `high` (fine pointer, ≥6 cores or unknown) -> post-processing (MSAA, bloom, grain);
  `mid` (touch / small screens / ≤4 cores) -> no post, DPR ≤ 1.5; `low` (reduced motion) -> still.
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

`node build.mjs [--out <dir>] [--watch]`. Agents working in parallel must build into their own
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
