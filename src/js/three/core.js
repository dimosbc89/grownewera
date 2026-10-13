// createStage(canvas, opts): one WebGL renderer + scene + camera + rig for a canvas, and its whole
// lifecycle: resize (ResizeObserver + device-pixel-ratio changes), per-tier DPR caps, pausing
// off-screen / in a hidden tab / at zero size, an automatic tier drop when frames are slow, WebGL
// context loss and restore, smoothed pointer + scroll input (with velocities) for the scenes, the
// shared clock, optional post-processing (`high` tier: MSAA, selective bloom, grain; post.js) and
// the render loop. Scene modules only build objects (docs/ARCHITECTURE.md, "Scene module API").
//
// Setup is asynchronous and split into steps that each run in their own idle slot (context,
// environment map, scene build, post-processing, shader compile), so it never holds the main
// thread for the whole setup: the preloader, the hero intro and scrolling keep their frames.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { makePalette, disposeTree, clamp01 } from './util.js';

// DPR caps per tier. `high` renders through post.js's MSAA half-float target, whose cost grows with
// the pixel count, so it is capped like `mid` (the target then uses fewer samples, see post.js).
export const TIERS = {
  high: { dpr: 1.5, post: true },
  mid: { dpr: 1.5, post: false },
  low: { dpr: 1, post: false },
};
const ORDER = ['high', 'mid', 'low'];
const SLOW_MS = 24; // average frame time that triggers a tier drop…
const SLOW_WINDOW = 2; // …when sustained for this many seconds
const LOST_GRACE = 4000; // ms to wait for a lost context to come back before hiding the canvas
// GPUs that start below `high` (unless the tier is forced with ?gl=): software rasterisers and
// integrated graphics (not Intel Arc), read from the context's unmasked renderer string.
const WEAK_GPU = /SwiftShader|llvmpipe|softpipe|Software|Basic Render|Intel(?!.*\bArc\b)/i;
// Smoothing rates (per second; frame-rate independent): x += (target - x) * damp(rate, dt).
const SCROLL_RATE = 7.5;
const POINTER_RATE = 3;
const VELOCITY_RATE = 6;
export const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

// Resolves in the next idle period (or after `timeout` ms at the latest).
export const idle = (timeout = 400) => new Promise((resolve) => {
  if ('requestIdleCallback' in window) requestIdleCallback(() => resolve(), { timeout });
  else setTimeout(resolve, 32);
});

// Shared time base: seconds since `grow:ready` (0 before). three/index.js starts it at boot and
// passes it in `opts.clock`; this fallback covers a stage created without one.
const fallbackClock = { t0: performance.now(), get started() { return true; }, get elapsed() { return (performance.now() - this.t0) / 1000; } };

// The neutral studio environment every lit scene reflects (PMREM: renders and compiles).
function roomEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const texture = pmrem.fromScene(room, 0.04).texture;
  room.dispose?.();
  pmrem.dispose();
  return texture;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} opts
 *   build(ctx) -> { update(time, scroll, pointer, dt), dispose?(), resize?(w, h, ctx), setQuality?(q),
 *                   bloom?: { strength, radius, threshold, white }, render?(ctx), restore?(ctx) }
 *          render replaces renderer.render(scene, camera) on stages without post-processing;
 *          restore runs after a lost WebGL context came back (re-create render-to-texture results)
 *   quality 'high' | 'mid' | 'low'; motion false renders still frames only
 *   layout 'hero' (rig right of the headline on wide screens) | 'center'
 *   track  element whose visibility pauses the loop and whose scroll progress is passed as `scroll`
 *   progress 'leave' (0 at top of page .. 1 when track has scrolled out; hero) | 'through' (enters..leaves)
 *   post   allow post-processing on the high tier (opaque output; hero only)
 *   env    true (neutral room), false, or a function (renderer) -> environment texture (re-run
 *          after a context restore)
 *   lights, fov, distance, tilt [y, x] (rig rotation from the pointer), stillTime, autoDrop
 *   localPointer  also track the pointer relative to this canvas (ctx.input.local)
 *   after  optional Promise: the heavy setup waits for it (every stage waits for `grow:hero-in`)
 *   gate   optional Promise: scene time stays at 0 until it resolves (e.g. the preloader is done),
 *          so intros play when they can be seen
 *   clock  shared clock ({ elapsed, started }) from three/index.js
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
    localPointer = false,
    after = null,
    gate = null,
    clock = fallbackClock,
  } = opts;
  let held = !!gate;
  gate?.then(() => { held = false; }, () => { held = false; });
  let tier = TIERS[opts.quality] ? opts.quality : 'mid';
  // A post-processed stage antialiases in its own MSAA target, so its context needs none.
  const wantPost = post && motion && TIERS[tier].post;
  const postModule = wantPost ? import('./post.js').catch(() => null) : null;

  if (after) await after.catch(() => {});
  await idle();
  if (!canvas.isConnected) return null;

  // ---------- step 1: context ----------
  const context = canvas.getContext('webgl2', {
    alpha: true, antialias: !wantPost, depth: true, stencil: false, premultipliedAlpha: true,
    preserveDrawingBuffer: false, powerPreference: 'high-performance',
  });
  if (!context) throw new Error('WebGL2 unavailable'); // three/index.js falls back to the static stage
  // A weak GPU starts at `mid` (no bloom/grain, MSAA x2 in the post target this context already
  // relies on, since it was created without antialiasing).
  if (tier === 'high' && autoDrop) {
    let gpu = '';
    try {
      const info = context.getExtension('WEBGL_debug_renderer_info');
      gpu = String(context.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : context.RENDERER) || '');
    } catch {}
    if (WEAK_GPU.test(gpu)) tier = 'mid';
  }
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: !wantPost, alpha: true, powerPreference: 'high-performance' });
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
  // Smoothed input for scenes (ctx.input). Velocities: pointer in -1..1 units per second, scroll in
  // viewport heights per second (down > 0); both eased, so they rise and fall without spikes.
  const input = {
    pointer,
    velocity: { x: 0, y: 0, scroll: 0 },
    local: { x: 0, y: 0, tx: 0, ty: 0, inside: false }, // canvas NDC (-1..1, y up), when localPointer
    active: 0, // 0..1: pointer moved recently (fine pointers), decays when it rests
  };
  let world = null;
  let postFx = null;
  let disposed = false;
  let listening = false;
  let lost = false;

  // No `THREE` here: scenes import three themselves (passing the namespace around as a value
  // would keep every export of three in the bundle).
  const ctx = {
    scene, camera, rig, renderer, canvas, small, palette, motion, input, clock,
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

  // ---------- size + pixel ratio ----------
  let W = 0;
  let H = 0;
  const applyDpr = () => {
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, TIERS[tier].dpr));
    postFx?.setPixelRatio(renderer.getPixelRatio());
  };
  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    W = w;
    H = h;
    if (!w || !h) { sync(); return; } // hidden (display: none) or collapsed: pause
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
    sync();
    if (!motion) invalidate();
  };
  // Zoom or a move to another screen changes devicePixelRatio without resizing the canvas.
  let dprQuery = null;
  const watchDpr = () => {
    dprQuery?.removeEventListener('change', onDpr);
    dprQuery = matchMedia(`(resolution: ${devicePixelRatio || 1}dppx)`);
    dprQuery.addEventListener('change', onDpr);
  };
  function onDpr() {
    if (disposed) return;
    applyDpr();
    resize();
    watchDpr();
  }
  applyDpr();

  // ---------- pointer ----------
  let rect = null;
  let rectAt = -1;
  const readRect = (force = false) => {
    // Inside input handlers only (layout is clean there): once per frame for pointer moves, and
    // again on scroll (scroll events come after input events within a frame).
    if (rectAt === frameNo && !force) return;
    rectAt = frameNo;
    rect = canvas.getBoundingClientRect();
  };
  let cx = -1;
  let cy = -1;
  const updateLocal = () => {
    if (!rect || cx < 0 || !rect.width) return;
    const l = input.local;
    l.tx = ((cx - rect.left) / rect.width) * 2 - 1;
    l.ty = 1 - ((cy - rect.top) / rect.height) * 2;
    l.inside = l.tx >= -1 && l.tx <= 1 && l.ty >= -1 && l.ty <= 1;
  };
  let lastMove = -1e9;
  const onPointer = (e) => {
    pointer.tx = (e.clientX / innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / innerHeight) * 2 - 1;
    lastMove = performance.now();
    if (localPointer && running) {
      cx = e.clientX;
      cy = e.clientY;
      readRect();
      updateLocal();
    }
  };
  // The canvas moves under a resting pointer while the page scrolls (sticky stages too).
  const onScroll = () => {
    if (!localPointer || !running || cx < 0) return;
    readRect(true);
    updateLocal();
  };
  const onLeave = () => { input.local.inside = false; cx = -1; };

  // ---------- frame ----------
  let time = 0;
  let frameNo = 0;
  let lastScrollY = scrollY;
  let lastTx = 0;
  let lastTy = 0;
  const draw = (t, dt) => {
    if (!world || disposed || lost || !W || !H) return;
    const target = targetScroll();
    if (motion && dt > 0) {
      scroll += (target - scroll) * damp(SCROLL_RATE, dt);
      pointer.x += (pointer.tx - pointer.x) * damp(POINTER_RATE, dt);
      pointer.y += (pointer.ty - pointer.y) * damp(POINTER_RATE, dt);
      const v = input.velocity;
      const kv = damp(VELOCITY_RATE, dt);
      v.x += (THREE.MathUtils.clamp((pointer.tx - lastTx) / dt, -6, 6) - v.x) * kv;
      v.y += (THREE.MathUtils.clamp((lastTy - pointer.ty) / dt, -6, 6) - v.y) * kv; // y up, like `local`
      lastTx = pointer.tx;
      lastTy = pointer.ty;
      const sy = scrollY;
      v.scroll += (THREE.MathUtils.clamp((sy - lastScrollY) / (innerHeight || 1) / dt, -6, 6) - v.scroll) * kv;
      lastScrollY = sy;
      const l = input.local;
      l.x += (l.tx - l.x) * damp(POINTER_RATE * 2, dt);
      l.y += (l.ty - l.y) * damp(POINTER_RATE * 2, dt);
      const moving = performance.now() - lastMove < 1200 ? 1 : 0;
      input.active += (moving - input.active) * damp(moving ? 4 : 1.2, dt);
    } else scroll = target;
    rig.rotation.y = pointer.x * tilt[0];
    rig.rotation.x = pointer.y * tilt[1];
    world.update(t, scroll, pointer, dt);
    if (postFx) postFx.render(clock.elapsed, dt, world.bloom);
    else if (world.render) world.render(ctx); // the stage draws itself (e.g. story.js: HDR accumulation)
    else {
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
    }
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
    frameNo++;
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
    if (running || !motion || disposed || !world || lost) return;
    running = true;
    last = 0;
    warm = Math.min(warm, 0.5); // resuming: let the first frames settle before judging speed
    acc = 0;
    frames = 0;
    lastScrollY = scrollY;
    renderer.setAnimationLoop(loop);
  };
  const stop = () => {
    if (!running) return;
    running = false;
    renderer.setAnimationLoop(null);
  };
  function sync() {
    if (!listening) return;
    return visible && !document.hidden && W > 0 && H > 0 ? start() : stop();
  }
  let queued = false;
  function invalidate() {
    if (motion || queued || disposed || !world || lost) return; // the loop already redraws
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
    // A post-processed context has no antialiasing of its own: it keeps the post target and tone
    // mapping, and sheds bloom/grain/aberration and then the multisampling (post.js setTier).
    postFx?.setTier(q);
    applyDpr();
    resize();
    world?.setQuality?.(q, ctx);
  }
  canvas.dataset.quality = tier;

  // ---------- environment ----------
  // `fresh`: after a context restore the old texture belongs to the lost context; disposing it
  // would make three.js delete foreign GL objects, so it is only dropped.
  const makeEnv = (fresh = false) => {
    if (!env) return;
    if (!fresh) scene.environment?.dispose();
    scene.environment = typeof env === 'function' ? env(renderer) : roomEnvironment(renderer);
  };

  // ---------- WebGL context loss ----------
  // three.js itself prevents the default (so the browser may restore the context) and re-creates
  // its GL state on restore: geometry, textures and render targets re-upload or re-allocate on the
  // next render. Only results rendered once into a texture are gone, so the environment map is
  // rebuilt here and scenes get `restore(ctx)` for their own. Objects from before the loss are
  // never disposed afterwards (their GL handles belong to the lost context).
  let lostTimer = 0;
  const onLost = (e) => {
    e.preventDefault();
    lost = true;
    stop();
    clearTimeout(lostTimer);
    lostTimer = setTimeout(() => { if (lost) canvas.dataset.lost = '1'; }, LOST_GRACE); // three.css hides it
  };
  const onRestored = () => {
    clearTimeout(lostTimer);
    if (disposed) return;
    lost = false;
    try {
      makeEnv(true);
      world?.restore?.(ctx);
    } catch {}
    delete canvas.dataset.lost;
    applyDpr();
    resize();
    if (motion) sync();
    else invalidate();
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  function dispose() {
    if (disposed) return;
    disposed = true;
    stop();
    io.disconnect();
    ro.disconnect();
    roBody.disconnect();
    clearTimeout(lostTimer);
    dprQuery?.removeEventListener('change', onDpr);
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('webglcontextrestored', onRestored);
    if (listening) {
      removeEventListener('pointermove', onPointer);
      removeEventListener('scroll', onScroll);
      document.documentElement.removeEventListener('pointerleave', onLeave);
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
    makeEnv();

    // ---------- step 3: scene ----------
    await idle();
    if (!alive()) return dispose(), null;
    world = build(ctx) ?? { update() {} };
    resize();
    world.update(0, targetScroll(), pointer, 0); // final positions before compiling

    // ---------- step 4: post-processing (high tier) ----------
    if (postModule) {
      const mod = await postModule;
      await idle();
      if (!alive()) return dispose(), null;
      if (mod?.supportsPost(renderer)) {
        postFx = mod.createPost({ renderer, scene, camera, width: W || 1, height: H || 1, tier });
        applyDpr();
      }
    }

    // ---------- step 5: shaders ----------
    // With KHR_parallel_shader_compile, wait off the main thread until the programs are linked.
    // Without it, still issue the compile now: the GPU process works on it during the next idle
    // slot, and the first frame only waits for whatever is left. (The post passes are small and
    // compile with the first frame.)
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
  if (finePointer && motion) {
    addEventListener('pointermove', onPointer, { passive: true });
    if (localPointer) {
      addEventListener('scroll', onScroll, { passive: true });
      document.documentElement.addEventListener('pointerleave', onLeave);
    }
  }
  document.addEventListener('visibilitychange', onVis);
  addEventListener('resize', measure, { passive: true });
  watchDpr();
  listening = true;
  io.observe(track);
  ro.observe(canvas);
  roBody.observe(document.body);
  measure();
  scroll = targetScroll();
  if (motion) sync();
  else invalidate();
  return stage;
}
