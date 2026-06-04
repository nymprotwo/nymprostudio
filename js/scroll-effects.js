// ───────────────────────────────────────────────
// Scroll-driven effects on page mode:
//   1. Hero overlay (name, tag, scroll cue, year) parallax-fades out
//      as the user scrolls past it.
//   2. Three.js mask voxelizes (points grow) then scales-up & fades
//      via setScrollProgress() — driven by the SAME hero progress.
//   3. Each content block reveals (translateY+opacity) when it enters
//      the viewport.
//   4. Random "// SYSTEM" messages flash at scroll milestones.
// ───────────────────────────────────────────────

import { setScrollProgress } from './scene.js?v=28';
import { fxOnScrollProgress, isFxActive } from './fx-switcher.js?v=33';

let heroEl = null;
let yearEl = null;
let cueEl = null;
let idEl = null;
let stripEl = null;
let stageEl = null;
let ticking = false;

function applyParallax(progress) {
  // Soft fade + push up for the hero overlay layers (not the mask).
  const fade = (1 - progress).toFixed(3);
  const lift = (-progress * 80).toFixed(1);

  // Inline transforms override our CSS transitions on .page__id/year/cue.
  // The is-page-open class is what makes them visible in the first place;
  // here we just push them further once the user starts scrolling.
  if (idEl)    { idEl.style.opacity = fade;    idEl.style.transform    = `translateY(${lift}px)`; }
  if (yearEl)  { yearEl.style.opacity = fade;  yearEl.style.transform  = `translateY(${lift}px)`; }
  if (stripEl) { stripEl.style.opacity = fade; }
}

// Mask fade — separate curve, runs over a longer scroll range so the
// mask stays present through the statement and only disappears as the
// reader reaches the body content. Final screen = pure black + text.
function applyMaskFade(progress) {
  if (!stageEl) return;
  // progress maps to 0..1 over [0, vh * 1.4] in onScroll
  // 0..0.4: full visibility
  // 0.4..0.85: fades from 1 → 0
  // 0.85+: invisible
  let op;
  if (progress < 0.4) op = 1;
  else if (progress > 0.85) op = 0;
  else op = 1 - (progress - 0.4) / 0.45;
  stageEl.style.opacity = op.toFixed(3);
}

function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    if (document.body.dataset.page !== 'about') return;
    const y = window.scrollY;
    const vh = window.innerHeight;
    // Hide scroll cue immediately once user starts scrolling
    if (cueEl) {
      if (y > 8) {
        cueEl.style.opacity = '0';
        cueEl.style.pointerEvents = 'none';
      } else {
        cueEl.style.opacity = '';
        cueEl.style.pointerEvents = '';
      }
    }

    const fadeProgress = Math.max(0, Math.min(1, y / (vh * 0.55)));
    applyParallax(fadeProgress);

    // Drive 3D mask voxelization + scale-out on the same progress
    const maskProgress = Math.max(0, Math.min(1, y / (vh * 0.9)));
    setScrollProgress(maskProgress);

    // Independent stage opacity — fades to 0 by ~1.2x viewport scroll
    const fadeStageProgress = Math.max(0, Math.min(1, y / (vh * 1.2)));
    applyMaskFade(fadeStageProgress);

    // Scroll-driven glitch — CSS variable + mid-transition class.
    // Ramps 0..1 across the first viewport-height of scrolling so it's
    // fully gone by the time the statement is on-screen.
    const gp = Math.max(0, Math.min(1, (y - vh * 0.05) / (vh * 0.5)));
    document.body.style.setProperty('--scroll-glitch', gp.toFixed(3));
    const inGlitchBand = gp > 0.05 && gp < 0.9;
    document.body.classList.toggle('is-glitching', inGlitchBand);

    // FX hook (glitch/type/decode) — gets normalized 0..1 across the
    // readable body length. If fx is active, skip the legacy statement
    // reveal (it would conflict).
    if (isFxActive()) {
      const total = Math.max(1, document.documentElement.scrollHeight - vh);
      const fullProgress = Math.max(0, Math.min(1, y / total));
      fxOnScrollProgress(fullProgress);
    } else {
      // Trigger statement scramble when user has scrolled past the mask
      if (!statementRevealed && y > vh * 0.6) {
        revealStatement();
      }
    }
  });
}

function resetParallax() {
  if (idEl)    { idEl.style.opacity = '';    idEl.style.transform = ''; }
  if (yearEl)  { yearEl.style.opacity = '';  yearEl.style.transform = ''; }
  if (cueEl)   { cueEl.style.opacity = '';   cueEl.style.transform = ''; }
  if (stripEl) { stripEl.style.opacity = ''; }
  if (stageEl) { stageEl.style.opacity = ''; stageEl.style.filter = ''; }
  document.body.style.removeProperty('--scroll-glitch');
  document.body.classList.remove('is-glitching');
  // reset mask to its hero look
  setScrollProgress(0);
  // reset statement scramble
  resetStatement();
  triggered.clear();
}

// ─── Scroll-driven statement scramble reveal ──
// When the statement enters the viewport, every [data-scramble] element
// inside it decodes character-by-character from glitch chars to its
// final text. Runs once per page-open.
const GLITCH = '!<>-_\\/[]{}—=+*^?#________01';
const triggered = new Set();
let statementRevealed = false;

function pickGlitch() {
  return GLITCH[Math.floor(Math.random() * GLITCH.length)];
}

function scrambleText(el, finalText, durationMs = 700, delayMs = 0) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const start = performance.now();
      const queue = [...finalText].map((_, i) => ({
        from: pickGlitch(),
        startAt: Math.random() * 0.25,
        endAt: 0.25 + (i / finalText.length) * 0.55 + Math.random() * 0.15,
      }));
      function tick(now) {
        const t = (now - start) / durationMs;
        let out = '';
        let done = 0;
        for (let i = 0; i < finalText.length; i++) {
          const target = finalText[i];
          if (target === ' ' || target === '&' || target === ',') {
            out += target; done++; continue;
          }
          const item = queue[i];
          if (t >= item.endAt) { out += target; done++; }
          else if (t < item.startAt) { out += item.from; }
          else {
            if (Math.random() < 0.45) item.from = pickGlitch();
            out += item.from;
          }
        }
        el.textContent = out;
        if (done === finalText.length) resolve();
        else requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }, delayMs);
  });
}

async function revealStatement() {
  if (statementRevealed) return;
  statementRevealed = true;
  const statement = document.querySelector('.page__statement');
  if (!statement) return;
  statement.classList.add('is-revealed');
  // Stagger scramble per [data-scramble] sub-element
  const parts = statement.querySelectorAll('[data-scramble]');
  parts.forEach((p) => {
    if (!p.dataset.final) p.dataset.final = p.textContent.trim();
    p.textContent = '';
  });
  for (let i = 0; i < parts.length; i++) {
    scrambleText(parts[i], parts[i].dataset.final, 800, i * 220);
  }
}

function resetStatement() {
  statementRevealed = false;
  const statement = document.querySelector('.page__statement');
  if (!statement) return;
  statement.classList.remove('is-revealed');
  statement.querySelectorAll('[data-scramble]').forEach((p) => {
    if (p.dataset.final) p.textContent = p.dataset.final;
  });
}

// Intersection-driven reveal for content blocks
function initReveal() {
  // Statement is handled separately (scramble reveal); content blocks
  // get standard translateY/opacity reveal
  const targets = document.querySelectorAll(
    '.page__content > .page__content-tag, .page__content > .page__bio, .page__content .skills li',
  );
  targets.forEach((el) => el.classList.add('reveal'));

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-revealed');
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.18 },
  );

  targets.forEach((el) => io.observe(el));
}

export function initScrollEffects() {
  heroEl  = document.querySelector('.page__hero');
  idEl    = document.querySelector('.page__id');
  yearEl  = document.querySelector('.page__year');
  cueEl   = document.querySelector('.page__scroll-cue');
  stripEl = document.querySelector('.page__cursor-strip');
  stageEl = document.querySelector('#stage');

  window.addEventListener('scroll', onScroll, { passive: true });
  initReveal();

  // When page closes / opens, reset transforms so re-entry starts clean
  const mo = new MutationObserver(() => {
    if (document.body.dataset.page !== 'about') resetParallax();
  });
  mo.observe(document.body, { attributes: true, attributeFilter: ['data-page'] });
}
