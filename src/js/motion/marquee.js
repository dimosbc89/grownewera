// [data-marquee="speed"]: endless loop whose speed and direction follow the scroll velocity.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion, $, $$ } from './util.js';

export function initMarquees() {
  if (!motion) return;
  for (const m of $$('[data-marquee]')) {
    const track = $('.marquee__track', m);
    if (!track) continue;
    const speed = parseFloat(m.dataset.marquee) || 1;
    const tween = gsap.to(track, { xPercent: -50, ease: 'none', duration: 38 / speed, repeat: -1 });
    if (!ScrollTrigger.isInViewport(m)) tween.pause();
    let dir = 1;
    ScrollTrigger.create({
      trigger: m,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => (self.isActive ? tween.resume() : tween.pause()),
      onUpdate: (self) => {
        const v = self.getVelocity();
        if (v) dir = v > 0 ? 1 : -1;
        const boost = Math.min(Math.abs(v) / 300, 6);
        gsap.to(tween, { timeScale: dir * (1 + boost), duration: 0.2, overwrite: true });
        gsap.to(tween, { timeScale: dir, duration: 1, delay: 0.2 });
      },
    });
  }
}
