// [data-marquee="speed"]: endless loop whose speed and direction follow the scroll velocity, and
// whose type leans into the motion (skewX) while the page moves. Scrolling up reverses the loop
// (and it keeps that direction); a fling speeds it up, then it eases back to its base speed.
// Off-screen marquees are paused.
import { gsap } from 'gsap';
import { motion, touch, $, $$, clamp, damp } from './util.js';
import { velocity } from './velocity.js';

export function initMarquees() {
  if (!motion) return;
  const list = [];
  for (const m of $$('[data-marquee]')) {
    const track = $('.marquee__track', m);
    if (!track || m._growInit) continue;
    m._growInit = true;
    const speed = parseFloat(m.dataset.marquee) || 1;
    const tween = gsap.to(track, { xPercent: -50, ease: 'none', duration: 38 / speed, repeat: -1 });
    // Start deep into the repeats so a reversed loop (negative timeScale) never reaches time 0.
    tween.totalTime(tween.duration() * 500).pause();
    const big = m.matches('.big-marquee');
    list.push({
      m, tween, on: false, dir: 1, ts: 1, sk: 0,
      lean: big ? 7 : 2.5, // max skew (deg)
      setSkew: gsap.quickSetter(track, 'skewX', 'deg'),
    });
  }
  if (!list.length) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const it = list.find((x) => x.m === e.target);
      if (!it) continue;
      it.on = e.isIntersecting;
      if (it.on) it.tween.resume();
      else it.tween.pause();
    }
  });
  list.forEach((it) => io.observe(it.m));
  gsap.ticker.add((time, dtMs) => {
    const dt = Math.min((dtMs || 16.7) / 1000, 0.1);
    const v = velocity();
    for (const it of list) {
      if (!it.on) continue;
      if (Math.abs(v) > 30) it.dir = v > 0 ? 1 : -1;
      const boost = Math.min(Math.abs(v) / 320, 4.5);
      const target = it.dir * (1 + boost);
      it.ts += (target - it.ts) * damp(Math.abs(target) > Math.abs(it.ts) ? 10 : 2.4, dt);
      it.tween.timeScale(Math.abs(it.ts) < 0.05 ? 0.05 * it.dir : it.ts);
      const sk = clamp((-v / 1000) * (touch ? 1.6 : 2.6), -it.lean, it.lean);
      const next = it.sk + (sk - it.sk) * damp(8, dt);
      if (Math.abs(next - it.sk) > 0.005) { it.sk = next; it.setSkew(next); }
    }
  });
}
