// initThree(): finds canvas[data-scene], checks WebGL2, picks a quality tier and lazy-loads
// core.js + the scene module. Nothing from three.js is in the main bundle.
//   Tiers: high (fine pointer, >= 6 cores or unknown) -> bloom + grain on the hero
//          mid  (touch, small screens, <= 4 cores)    -> no post, DPR <= 1.5
//          low  (prefers-reduced-motion)              -> still frames only
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

export function pickQuality({ motion = true } = {}) {
  if (!motion) return 'low';
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const cores = navigator.hardwareConcurrency || 0;
  if (!fine || innerWidth < 760 || (cores && cores <= 4)) return 'mid';
  return 'high';
}

function hasWebGL2() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function fallback(canvas) {
  const heroStage = canvas.closest('.hero__stage');
  if (heroStage) return heroStage.remove();
  canvas.parentElement?.classList.add('is-static');
  canvas.remove();
}

export function initThree() {
  const canvases = [...document.querySelectorAll('canvas[data-scene]')];
  if (!canvases.length) return;
  const root = document.documentElement;
  let force = null;
  try { force = new URLSearchParams(location.search).get('gl'); } catch {}
  if (force === 'off' || !hasWebGL2()) { canvases.forEach(fallback); return; }

  const motion = root.classList.contains('motion');
  const quality = ['high', 'mid', 'low'].includes(force) ? force : pickQuality({ motion });
  // On a first visit the preloader covers the page: hold scene time until `grow:ready`.
  const gate = root.classList.contains('is-loading')
    ? new Promise((resolve) => { addEventListener('grow:ready', resolve, { once: true }); setTimeout(resolve, 2500); })
    : null;
  const opts = {
    motion,
    quality,
    finePointer: matchMedia('(hover: hover) and (pointer: fine)').matches,
    autoDrop: !force,
    gate,
  };
  root.dataset.gl = quality;

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
    if (canvas.closest('[data-hero]') || !lazy) load(canvas);
    else lazy.observe(canvas);
  }
}
