// initThree(): finds canvas[data-scene], checks WebGL2, picks a quality tier and lazy-loads
// core.js + the scene module. Nothing from three.js is in the main bundle.
//   Tiers: high (fine pointer, >= 6 cores or unknown, >= 4 GB or unknown) -> MSAA + selective
//               bloom + grain on the hero (core.js may still start a weak GPU at mid)
//          mid  (touch, small screens, <= 4 cores, < 4 GB, a 3G connection) -> no post, DPR <= 1.5
//          low  (prefers-reduced-motion)              -> still frames only
//   Data saver or a 2G connection: no WebGL at all (the static stages), nothing downloaded.
//   Loading: on `high` the hero's modules (and the three.js chunk they import) are preloaded at
//   boot (<meta name="gl-preload">, build.mjs) and imported right away; on `mid` / `low` the hero
//   import waits for `grow:ready`, so phones spend their first second on the page itself.
//   Debug: ?gl=high|mid|low forces the starting tier, ?gl=off disables WebGL.
const SCENES = {
  helix: () => import('./scenes/helix.js'),
  bars: () => import('./scenes/bars.js'),
  orb: () => import('./scenes/orb.js'),
  panels: () => import('./scenes/panels.js'),
  blocks: () => import('./scenes/blocks.js'),
  globe: () => import('./scenes/globe.js'),
};
const MOUNTS = {
  story: () => import('./story.js'),
  wordmark: () => import('./wordmark.js'),
};

const connection = () => navigator.connection ?? {};
// Data saver on, or a 2G-class connection: the scenes are decoration, so they are skipped.
const skipGl = () => !!connection().saveData || /(^|-)2g$/.test(connection().effectiveType || '');

export function pickQuality({ motion = true } = {}) {
  if (!motion) return 'low';
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const cores = navigator.hardwareConcurrency || 0;
  const memory = navigator.deviceMemory || 0;
  if (!fine || innerWidth < 760 || (cores && cores <= 4) || (memory && memory < 4)) return 'mid';
  if (connection().effectiveType === '3g') return 'mid';
  return 'high';
}

// <link rel="modulepreload"> for the hero's module graph (URLs from build.mjs), so the three.js
// chunk downloads alongside core.js instead of after it.
function preload() {
  const urls = document.querySelector('meta[name="gl-preload"]')?.content.split(' ').filter(Boolean) ?? [];
  for (const href of urls) {
    const l = document.createElement('link');
    l.rel = 'modulepreload';
    l.href = href;
    document.head.append(l);
  }
}

// Cheap feature test only: creating a probe context costs as much as a real one (hundreds of ms
// on slow GPUs), so a missing or blocklisted WebGL2 shows up when createStage() asks for its
// context, and that canvas falls back then.
const hasWebGL2 = () => typeof WebGL2RenderingContext !== 'undefined';

function fallback(canvas) {
  const heroStage = canvas.closest('.hero__stage');
  if (heroStage) {
    // The viewfinder frame around the stage (markup's .hero__hud) would frame an empty area.
    heroStage.parentElement?.querySelector(':scope > .hero__hud')?.remove();
    return heroStage.remove();
  }
  canvas.parentElement?.classList.add('is-static');
  canvas.remove();
}

export function initThree() {
  const canvases = [...document.querySelectorAll('canvas[data-scene]')];
  if (!canvases.length) return;
  const root = document.documentElement;
  let force = null;
  try { force = new URLSearchParams(location.search).get('gl'); } catch {}
  if (force === 'off' || !hasWebGL2() || (!force && skipGl())) { canvases.forEach(fallback); return; }

  const motion = root.classList.contains('motion');
  const quality = ['high', 'mid', 'low'].includes(force) ? force : pickQuality({ motion });
  // Shared time base for every stage (ctx.clock.elapsed): seconds since `grow:ready`, so effects
  // that should agree across canvases (grain, light sweeps) share one clock. Started here at boot
  // because the stages load lazily, after the event.
  const clock = {
    t0: -1,
    get started() { return this.t0 >= 0; },
    get elapsed() { return this.t0 < 0 ? 0 : (performance.now() - this.t0) / 1000; },
  };
  const startClock = () => { if (clock.t0 < 0) clock.t0 = performance.now(); };
  addEventListener('grow:ready', startClock, { once: true });
  setTimeout(startClock, 4000); // a failed motion layer never fires it
  // On a first visit the preloader covers the page: hold scene time until `grow:ready`.
  const gate = root.classList.contains('is-loading')
    ? new Promise((resolve) => { addEventListener('grow:ready', resolve, { once: true }); setTimeout(resolve, 2500); })
    : null;
  // Heavy setup (context, environment map, shader compile) waits until the hero intro copy has
  // landed (`grow:hero-in`, motion/hero.js; after `grow:ready`), so it never holds up the
  // preloader or stalls the intro, even when a story or CTA canvas is near the top of a short page.
  // Modules still download right away. Timeouts cover a failed motion layer or a hidden tab.
  const ready = new Promise((resolve) => {
    addEventListener('grow:ready', resolve, { once: true });
    setTimeout(resolve, 4000);
  });
  const settled = motion
    ? new Promise((resolve) => {
      addEventListener('grow:hero-in', resolve, { once: true });
      ready.then(() => setTimeout(resolve, 3000));
      setTimeout(resolve, 8000);
    })
    : ready;
  const opts = {
    motion,
    quality,
    finePointer: matchMedia('(hover: hover) and (pointer: fine)').matches,
    autoDrop: !force,
    gate,
    after: settled,
    clock,
  };
  root.dataset.gl = quality;
  if (quality === 'high') preload();
  // `mid` / `low`: the hero's modules load once the page itself is up.
  const heroLoad = quality === 'high' ? null : ready;

  const lazy = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        lazy.unobserve(e.target);
        load(e.target);
      }
    }, { rootMargin: '100% 0px' })
    : null;

  function load(canvas) {
    const mode = canvas.dataset.scene;
    let job;
    if (SCENES[mode]) {
      job = Promise.all([import('./core.js'), SCENES[mode]()])
        .then(([{ createStage }, { default: build }]) => createStage(canvas, { ...opts, build, layout: 'hero' }));
    } else if (MOUNTS[mode]) {
      job = MOUNTS[mode]().then((m) => m.mount(canvas, opts));
    } else {
      fallback(canvas);
      return;
    }
    job.catch(() => fallback(canvas));
  }

  for (const canvas of canvases) {
    if (canvas.closest('[data-hero]')) heroLoad ? heroLoad.then(() => load(canvas)) : load(canvas);
    else if (!lazy) load(canvas);
    else lazy.observe(canvas);
  }
}
