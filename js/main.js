// ───────────────────────────────────────────────
// NYM Portfolio — entry point
// ───────────────────────────────────────────────

// ?v=28 on every relative import — browser caches by URL, so without
// this main.js?v=N reloads but its imports stay stale across deploys.
import { runSplash } from './splash.js?v=28';
import { initScene } from './scene.js?v=31';
import { startRotator } from './rotator.js?v=28';
import { initOverlays } from './overlays.js?v=28';
import { startClock } from './clock.js?v=38';
import { initShift } from './shift.js?v=28';
import { initMobileInput } from './input-mobile.js?v=28';
import { initCursorStrip } from './cursor-strip.js?v=28';
import { initNameHover } from './name-hover.js?v=37';
import { initSmoothScroll } from './smooth-scroll.js?v=29';
import { initScrollEffects } from './scroll-effects.js?v=36';
import { initFx } from './fx-switcher.js?v=33';
import { initSkillsPreview } from './skills-preview.js?v=7';
import { initContactPopup } from './contact-popup.js?v=2';
import { initPlayground, showPlayground, hidePlayground } from './playground.js?v=52';

const splashEl = document.getElementById('splash');
const barEl = document.getElementById('splash-bar');

let progress = 0;
const setProgress = (v) => {
  progress = Math.max(progress, Math.min(1, v));
  barEl.style.width = (progress * 100) + '%';
};

initOverlays();
initShift();
initCursorStrip();
initNameHover();
initSmoothScroll();
initScrollEffects();
initFx(); // pick up ?fx=... from URL and kick off the chosen effect
initSkillsPreview();
initContactPopup();
startClock();
initPlayground();

// Playground toggle
document.getElementById('playground-toggle')?.addEventListener('click', showPlayground);
document.getElementById('pg-close')?.addEventListener('click', hidePlayground); // start clock immediately — it doesn't need to wait for scene

const splashPromise = runSplash();
const scenePromise = initScene({
  onProgress: (p) => setProgress(p * 0.9),
});

Promise.all([splashPromise, scenePromise])
  .then(() => {
    setProgress(1);
    setTimeout(() => {
      splashEl.classList.add('is-hidden');
      document.body.classList.add('is-ready');
      setTimeout(() => {
        startRotator();
        initMobileInput();
      }, 600);
    }, 300);
  })
  .catch((err) => {
    console.error('[NYM] init failed:', err);
    setTimeout(() => splashEl.classList.add('is-hidden'), 2000);
  });
