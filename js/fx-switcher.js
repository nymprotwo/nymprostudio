// ───────────────────────────────────────────────
// FX switcher — reads ?fx=... from URL, sets body[data-fx], and lazily
// loads the matching effect module. Effects override the default
// scroll behaviour from scroll-effects.js.
//
//   ?fx=glitch   → fx-glitch.js   (#2 scramble across all text)
//   ?fx=type     → fx-type.js     (#4B typewriter bio)
//   ?fx=decode   → fx-decode.js   (#6 hex → text decompile)
//   (no param)   → default behaviour (gentle scramble reveal once)
// ───────────────────────────────────────────────

const VALID = new Set(['glitch', 'type', 'decode']);

let currentFx = null;
let progressHook = null; // function(progress) called by scroll-effects on each scroll

export function detectFx() {
  try {
    const sp = new URLSearchParams(window.location.search);
    const v = sp.get('fx');
    if (v && VALID.has(v)) return v;
  } catch (_) {}
  return null;
}

export async function initFx() {
  const fx = detectFx();
  if (!fx) return; // default behaviour stays as-is
  document.body.dataset.fx = fx;
  currentFx = fx;

  // Wait for page-open before lazy-loading the module — they need
  // .page__name-line spans which exist always, but the statement spans
  // exist in HTML directly so loading at body init is fine.
  switch (fx) {
    case 'glitch': {
      const m = await import('./fx-glitch.js?v=33');
      m.startGlitchFx();
      progressHook = m.applyGlitchProgress;
      break;
    }
    case 'type': {
      const m = await import('./fx-type.js?v=34');
      m.startTypeFx();
      progressHook = m.applyTypeProgress;
      break;
    }
    case 'decode': {
      const m = await import('./fx-decode.js?v=35');
      m.startDecodeFx();
      progressHook = m.applyDecodeProgress;
      break;
    }
    default:
      break;
  }
}

// Called by scroll-effects.js on each scroll tick
export function fxOnScrollProgress(progress) {
  if (progressHook) progressHook(progress);
}

export function isFxActive() {
  return !!currentFx;
}
