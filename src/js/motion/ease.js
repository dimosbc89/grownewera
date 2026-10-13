// Named eases shared by every motion module (CustomEase), so the whole site moves with one voice.
//   grow.out    long, soft landing (the CSS --ease curve): reveals, copy, cards
//   grow.inOut  heavy start and landing: wipes, curtains, pins
//   grow.wipe   sharper in-out for the lime column wipes (page transition)
//   grow.lift   columns lifting off the page (preloader, arrival curtain): moves early, lands soft
//   grow.in     accelerate out of view
import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';

gsap.registerPlugin(CustomEase);

export const EASE = {
  out: CustomEase.create('grow.out', 'M0,0 C0.22,1 0.36,1 1,1'),
  expo: CustomEase.create('grow.expo', 'M0,0 C0.12,0.86 0.2,1 1,1'),
  inOut: CustomEase.create('grow.inOut', 'M0,0 C0.76,0 0.24,1 1,1'),
  wipe: CustomEase.create('grow.wipe', 'M0,0 C0.86,0 0.14,1 1,1'),
  lift: CustomEase.create('grow.lift', 'M0,0 C0.62,0 0.3,1 1,1'),
  in: CustomEase.create('grow.in', 'M0,0 C0.7,0 0.84,0 1,1'),
};
