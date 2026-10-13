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
src/js/motion/smooth.js     Lenis + ScrollTrigger glue (lenis, scrollTo, refresh helpers)
src/js/motion/split.js      split(el, { mode: 'words' | 'chars' }) -> inner spans
src/js/motion/header.js     sticky header, progress bar, mega menus, mobile menu
src/js/motion/preloader.js  first-visit preloader, fires `grow:ready`
src/js/motion/hero.js       hero intro timeline + layered hero parallax
src/js/motion/reveals.js    reveals, split titles, scrub lead, [data-parallax], section numerals, clip reveals
src/js/motion/pin.js        [data-hscroll], [data-steps], [data-story] progress, [data-stack], pinned statements
src/js/motion/marquee.js    [data-marquee]
src/js/motion/pointer.js    cursor, [data-magnetic], [data-tilt], [data-depth] pointer parallax
src/js/motion/transitions.js page transitions (curtain)
src/js/motion/ui.js         FAQ, filters (+ Flip), counters, legal TOC, [data-scramble], [data-strike]
src/js/three/index.js       initThree(): finds canvases, picks quality tier, lazy-imports the rest
src/js/three/core.js        createStage(canvas, opts): renderer, scene, camera, rig, post-processing, loop
src/js/three/scenes/*.js    one hero scene per file: helix, bars, orb, panels, blocks, globe
src/js/three/story.js       scroll-story morphing particles (canvas[data-scene="story"])
src/js/three/wordmark.js    CTA 3D "GROW." wordmark (canvas[data-scene="wordmark"])
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
    update(time, scroll, pointer) {}, // scroll: 0..1 progress of the hero leaving the viewport
                                      // pointer: { x, y } in -1..1, smoothed
    dispose() {},                     // optional
  };
}
```

## DOM hooks

| Hook | Where (markup) | Consumer | Meaning |
| --- | --- | --- | --- |
| `[data-hero]` | hero `<section>` | motion, three | the hero; scroll progress is measured against it |
| `[data-depth="n"]` | hero layers, `.ill` inner `<g>` layers | motion/pointer, motion/hero | parallax depth, 0 = fixed, 1 = full; used for scroll and pointer parallax |
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

* `grow:ready` (window): preloader finished (or skipped). Hero intro starts on it.
* `grow:story` (on the story canvas): see table.
* `grow:consent` (window): cookie choice.
* `<html>` classes: `js`, `motion` | `no-motion`, `curtain-in`, `has-cursor`, `is-loading`.

## Quality and accessibility rules

* `prefers-reduced-motion: reduce` -> no Lenis, no pins/scrubs/parallax, WebGL renders one still
  frame, everything visible. Without JS everything is visible.
* WebGL tiers: `high` (fine pointer, ≥6 cores or unknown) -> post-processing (bloom, grain);
  `mid` (touch / small screens / ≤4 cores) -> no post, DPR ≤ 1.5; `low` (reduced motion) -> still.
  Drop a tier automatically when frames average > 24ms for 2s. Pause every canvas when off-screen
  or when the tab is hidden.
* Animate transforms and opacity only. No layout thrash in scroll handlers.

## Build

`node build.mjs [--out <dir>] [--watch]`. Agents working in parallel must build into their own
`--out` directory and serve it with `node tools/serve.mjs --dir <dir> --port <n>`.
