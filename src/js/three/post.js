// Post-processing for the `high` tier: bloom on the brightest (lime/white) parts + fine grain.
// Loaded on demand by core.js; never part of the main bundle.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

const GrainShader = {
  name: 'GrowGrain',
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAmount: { value: 0.05 } },
  vertexShader: /* glsl */ `varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `uniform sampler2D tDiffuse; uniform float uTime; uniform float uAmount; varying vec2 vUv;
    float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float n = hash(gl_FragCoord.xy + fract(uTime * 7.0) * 113.0) - 0.5;
      c.rgb += n * uAmount * (0.25 + c.rgb);
      gl_FragColor = c;
    }`,
};

export function createPost({ renderer, scene, camera, width, height, strength = 0.3, radius = 0.28, threshold = 0.9 }) {
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(width, height);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), strength, radius, threshold);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grain = new ShaderPass(GrainShader);
  composer.addPass(grain);
  const grainAmount = grain.uniforms.uAmount.value;
  let fade = 0; // bloom and grain ease in over ~1.2s after the plain first frames
  bloom.strength = 0;
  grain.uniforms.uAmount.value = 0;
  return {
    composer,
    bloom,
    render(t, dt = 1 / 60) {
      if (fade < 1) {
        fade = Math.min(1, fade + dt / 1.2);
        const k = fade * fade * (3 - 2 * fade);
        bloom.strength = strength * k;
        grain.uniforms.uAmount.value = grainAmount * k;
      }
      grain.uniforms.uTime.value = t;
      composer.render();
    },
    setSize: (w, h) => composer.setSize(w, h),
    setPixelRatio: (r) => composer.setPixelRatio(r),
    dispose() {
      bloom.dispose();
      grain.material.dispose();
      composer.dispose();
    },
  };
}
