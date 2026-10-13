// createStage(canvas, opts): one WebGL renderer + scene + camera + rig for a canvas, with resize,
// visibility (pauses off-screen / hidden tab), pointer and scroll tracking, quality tiers with an
// automatic drop when frames are slow, optional post-processing (bloom + grain, `high` tier) and
// the render loop. Scene modules only build objects (see docs/ARCHITECTURE.md, "Scene module API").
//
// Setup is asynchronous and split into steps that each run in their own idle slot (context,
// environment map, scene build, shader compile, post-processing), so it never holds the main
// thread for the whole setup: the preloader, the hero intro and scrolling keep their frames.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { makePalette, disposeTree, clamp01 } from './util.js';

export const TIERS = {
  high: { dpr: 1.75, post: true },
  mid: { dpr: 1.5, post: false },
  low: { dpr: 1, post: false },
};
const ORDER = ['high', 'mid', 'low'];
const SLOW_MS = 24; // average frame time that triggers a tier drop…
const SLOW_WINDOW = 2; // …when sustained for this many seconds
// Smoothing rates (per second; frame-rate independent): x += (target - x) * damp(rate, dt).
const SCROLL_RATE = 7.5;
const POINTER_RATE = 3;
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

// Resolves in the next idle period (or after `timeout` ms at the latest).
export const idle = (timeout = 400) => new Promise((resolve) => {
  if ('requestIdleCallback' in window) requestIdleCallback(() => resolve(), { timeout });
  else setTimeout(resolve, 32);
});

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} opts
 *   build(ctx) -> { update(time, scroll, pointer, dt), dispose?(), resize?(w, h, ctx), setQuality?(q) }
 *   quality 'high' | 'mid' | 'low'; motion false renders still frames only
 *   layout 'hero' (rig right of the headline on wide screens) | 'center'
 *   track  element whose visibility pauses the loop and whose scroll progress is passed as `scroll`
 *   progress 'leave' (0 at top of page .. 1 when track has scrolled out; hero) | 'through' (enters..leaves)
 *   post   allow bloom/grain on the high tier (opaque black background; hero only)
 *   env, lights, fov, distance, tilt [y, x] (rig rotation from the pointer), stillTime, autoDrop
 *   after  optional Promise: the heavy setup waits for it (the hero waits for `grow:hero-in`)
 *   gate   optional Promise: scene time stays at 0 until it resolves (e.g. the preloader is done),
 *          so intros play when they can be seen
 * @returns {Promise<object|null>} the stage once its first frame is queued (null if the canvas left the page)
 */
export async function createStage(canvas, opts = {}) {
  const {
    build,
    motion = true,
    finePointer = false,
    layout = 'hero',
    track = canvas.closest('[data-hero]') ?? canvas.parentElement ?? canvas,
    progress: progressMode = layout === 'hero' ? 'leave' : 'through',
    post = layout === 'hero',
    env = true,
    lights = true,
    fov = 34,
    distance = 9,
    tilt = layout === 'hero' ? [0.35, 0.18] : [0.12, 0.06],
    stillTime = 2.5,
    autoDrop = true,
    after = null,
    gate = null,
  } = opts;
  let held = !!gate;
  gate?.then(() => { held = false; }, () => { held = false; });
  let tier = TIERS[opts.quality] ? opts.quality : 'mid';

  if (after) await after.catch(() => {});
  await idle();
  if (!canvas.isConnected) return null;

  // ---------- step 1: context ----------
  const context = canvas.getContext('webgl2', {
    alpha: true, antialias: true, depth: true, stencil: false, premultipliedAlpha: true,
    preserveDrawingBuffer: false, powerPreference: 'high-performance',
  });
  if (!context) throw new Error('WebGL2 unavailable'); // three/index.js falls back to the static stage
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const palette = makePalette();
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
  camera.position.set(0, 0, distance);
  const rig = new THREE.Group();
  scene.add(rig);

  const small = innerWidth < 760;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let world = null;
  let postFx = null;
  let disposed = false;
  let listening = false;

  const ctx = {
    THREE, scene, camera, rig, renderer, canvas, small, palette, motion,
    quality: tier,
    invalidate: () => invalidate(),
  };

  // ---------- scroll progress from cached geometry (no layout reads in the loop) ----------
  let tTop = 0;
  let tH = 1;
  const measure = () => {
    const r = track.getBoundingClientRect();
    tTop = r.top + scrollY;
    tH = r.height || 1;
  };
  const targetScroll = () => (progressMode === 'leave'
    ? clamp01((scrollY - tTop) / tH)
    : clamp01((scrollY + innerHeight - tTop) / (innerHeight + tH)));
  let scroll = 0;

  // ---------- size ----------
  let W = 0;
  let H = 0;
  const applyDpr = () => {
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, TIERS[tier].dpr));
    postFx?.setPixelRatio(renderer.getPixelRatio());
  };
  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    W = w;
    H = h;
    renderer.setSize(w, h, false);
    postFx?.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (layout === 'hero') {
      // Keep the object to the right of the headline on wide screens, centred on phones.
      const wide = camera.aspect > 1.1;
      rig.position.x = wide ? Math.min(3, 0.9 + camera.aspect * 0.95) : 0;
      rig.position.y = wide ? -0.15 : 1.2;
      rig.scale.setScalar(wide ? 1 : 0.82);
    }
    world?.resize?.(w, h, ctx);
    measure();
    if (!motion) invalidate();
  };
  applyDpr();

  // ---------- pointer ----------
  const onPointer = (e) => {
    pointer.tx = (e.clientX / innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / innerHeight) * 2 - 1;
  };

  // ---------- frame ----------
  let time = 0;
  const draw = (t, dt) => {
    if (!world || disposed) return;
    const target = targetScroll();
    if (motion) {
      scroll += (target - scroll) * damp(SCROLL_RATE, dt);
      pointer.x += (pointer.tx - pointer.x) * damp(POINTER_RATE, dt);
      pointer.y += (pointer.ty - pointer.y) * damp(POINTER_RATE, dt);
    } else scroll = target;
    rig.rotation.y = pointer.x * tilt[0];
    rig.rotation.x = pointer.y * tilt[1];
    world.update(t, scroll, pointer, dt);
    if (postFx) postFx.render(t, dt);
    else renderer.render(scene, camera);
    if (!canvas.dataset.ready) canvas.dataset.ready = '1'; // three.css fades the canvas in
  };

  // ---------- loop + visibility ----------
  let running = false;
  let visible = true;
  let last = 0;
  let warm = 0;
  let acc = 0;
  let frames = 0;
  const loop = (now) => {
    const dt = last ? Math.min((now - last) / 1000, 0.25) : 1 / 60; // capped so a stall never skips the intro
    last = now;
    if (!held) time += dt;
    if (autoDrop && tier !== 'low') {
      if (warm < 1) warm += dt; // ignore the first frames (late shader work, first layout)
      else {
        acc += dt;
        frames++;
        if (acc >= SLOW_WINDOW) {
          if ((acc / frames) * 1000 > SLOW_MS) setQuality(ORDER[ORDER.indexOf(tier) + 1]);
          acc = 0;
          frames = 0;
        }
      }
    }
    draw(time, dt);
  };
  const start = () => {
    if (running || !motion || disposed || !world) return;
    running = true;
    last = 0;
    renderer.setAnimationLoop(loop);
  };
  const stop = () => {
    if (!running) return;
    running = false;
    renderer.setAnimationLoop(null);
  };
  const sync = () => (visible && !document.hidden ? start() : stop());
  let queued = false;
  function invalidate() {
    if (motion || queued || disposed || !world) return; // the loop already redraws
    queued = true;
    requestAnimationFrame(() => { queued = false; draw(stillTime, 0); });
  }

  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }, { rootMargin: '80px 0px' });
  const onVis = () => sync();
  const ro = new ResizeObserver(() => resize());
  const roBody = new ResizeObserver(() => measure()); // content above may have changed height

  // ---------- quality ----------
  function setQuality(q) {
    if (!TIERS[q] || q === tier) return;
    tier = q;
    ctx.quality = q;
    canvas.dataset.quality = q;
    if (postFx && !TIERS[q].post) {
      postFx.dispose();
      postFx = null;
      renderer.setClearColor(0x000000, 0);
    }
    applyDpr();
    resize();
    world?.setQuality?.(q, ctx);
  }
  canvas.dataset.quality = tier;

  // Bloom + grain arrive after the first plain frames (their shaders compile in an idle slot) and
  // ease in, so the switch never shows as a pop.
  async function enablePost() {
    if (!post || !TIERS[tier].post || !motion) return;
    const { createPost } = await import('./post.js');
    await idle(1000);
    if (disposed || !TIERS[tier].post) return;
    const fx = createPost({ renderer, scene, camera, width: W || canvas.clientWidth || 1, height: H || canvas.clientHeight || 1 });
    if (disposed || !TIERS[tier].post) return fx.dispose();
    renderer.setClearColor(0x000000, 1); // bloom output is opaque; the hero sits on black anyway
    postFx = fx;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    stop();
    io.disconnect();
    ro.disconnect();
    roBody.disconnect();
    if (listening) {
      removeEventListener('pointermove', onPointer);
      removeEventListener('resize', measure);
      document.removeEventListener('visibilitychange', onVis);
    }
    world?.dispose?.();
    postFx?.dispose();
    disposeTree(scene);
    scene.environment?.dispose();
    renderer.dispose();
  }

  const stage = { renderer, scene, camera, rig, ctx, invalidate, setQuality, dispose, get quality() { return tier; } };
  const alive = () => !disposed && canvas.isConnected;

  try {
    // ---------- step 2: lights + environment map (PMREM renders and compiles: its own slot) ----------
    await idle();
    if (!alive()) return dispose(), null;
    if (lights) {
      scene.add(new THREE.AmbientLight(0xffffff, 0.25));
      const key = new THREE.DirectionalLight(0xffffff, 1.6);
      key.position.set(3, 5, 4);
      scene.add(key);
      const rim = new THREE.PointLight(palette.lime, 30, 20);
      rim.position.set(-3, 1, -2);
      scene.add(rim);
    }
    if (env) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      scene.environment = pmrem.fromScene(room, 0.04).texture;
      room.dispose?.();
      pmrem.dispose();
    }

    // ---------- step 3: scene ----------
    await idle();
    if (!alive()) return dispose(), null;
    world = build(ctx) ?? { update() {} };
    resize();
    world.update(0, targetScroll(), pointer, 0); // final positions before compiling

    // ---------- step 4: shaders ----------
    // With KHR_parallel_shader_compile, wait off the main thread until the programs are linked.
    // Without it, still issue the compile now: the GPU process works on it during the next idle
    // slot, and the first frame only waits for whatever is left.
    await idle();
    if (!alive()) return dispose(), null;
    if (renderer.extensions.has('KHR_parallel_shader_compile')) await renderer.compileAsync(scene, camera);
    else renderer.compile(scene, camera);
    await idle();
    if (!alive()) return dispose(), null;
  } catch (e) {
    dispose();
    throw e;
  }

  // ---------- go ----------
  if (finePointer && motion) addEventListener('pointermove', onPointer, { passive: true });
  document.addEventListener('visibilitychange', onVis);
  addEventListener('resize', measure, { passive: true });
  listening = true;
  io.observe(track);
  ro.observe(canvas);
  roBody.observe(document.body);
  measure();
  scroll = targetScroll();
  if (motion) sync();
  else invalidate();
  enablePost().catch(() => {});
  return stage;
}
