// ───────────────────────────────────────────────
// NYM Portfolio — entry point
// ───────────────────────────────────────────────

// ?v=28 on every relative import — browser caches by URL, so without
// this main.js?v=N reloads but its imports stay stale across deploys.
import { runSplash } from './splash.js?v=29';
import { initScene, playMaskReveal, hideMask } from './scene.js?v=37';
import { startRotator } from './rotator.js?v=28';
import { initOverlays, registerExitHandler } from './overlays.js?v=28';
import { startClock } from './clock.js?v=38';
import { initShift, showShift, hideShift } from './shift.js?v=11';
import { initMobileInput } from './input-mobile.js?v=28';
import { initCursorStrip } from './cursor-strip.js?v=28';
import { initNameHover } from './name-hover.js?v=37';
import { initSmoothScroll } from './smooth-scroll.js?v=29';
import { initScrollEffects } from './scroll-effects.js?v=36';
import { initFx } from './fx-switcher.js?v=33';
import { initSkillsPreview } from './skills-preview.js?v=7';
import { initContactPopup } from './contact-popup.js?v=2';
import { initSweep, showSweep, hideSweep } from './minesweeper.js?v=8';
import { initPlayground, showPlayground, hidePlayground, dismissPlayground } from './playground.js?v=62';
import { initProjects, showProjects, hideProjects } from './projects.js?v=81';

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
initSweep();
startClock();
initPlayground();
initProjects();
// When logo is clicked: if playground is active, animate tiles out then reveal mask
registerExitHandler(() => {
  if (document.body.dataset.page === 'playground') {
    hideMask(); // hide immediately so it's not visible while playground fades
    dismissPlayground(() => setTimeout(playMaskReveal, 500));
  } else {
    hidePlayground();
  }
});

// Playground toggle
document.getElementById('playground-toggle')?.addEventListener('click', showPlayground);
document.getElementById('projects-toggle')?.addEventListener('click', showProjects);
document.getElementById('shift-toggle')?.addEventListener('click', () => {
  if (document.body.dataset.page === 'sweep') hideSweep();
  else showSweep();
});
document.getElementById('sh-close')?.addEventListener('click', hideShift);
document.getElementById('pg-close')?.addEventListener('click', hidePlayground);
document.getElementById('sweep-close')?.addEventListener('click', hideSweep);

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
