// ───────────────────────────────────────────────
// FX #2: Glitch scroll choreography.
// ───────────────────────────────────────────────
// Letters of the hero name, statement and skills list "scramble"
// (cycle random glyphs) as a function of scroll progress.
//   - Hero name (KIRILL STEPANOV):    0 = clean → 1 = fully scrambled
//   - Statement (A creative dev / fueled by code & nightmares): inverse
//   - Skills list items: each resolves as scroll passes
// A standalone rAF loop refreshes glitch glyphs at ~12fps so the text
// keeps "living" even when the user pauses mid-scroll.
// ───────────────────────────────────────────────

const GLITCH_CHARS = '!<>-_\\/[]{}—=+*^?#$%&01010110';
const REFRESH_MS = 90;
const PROTECT = new Set([' ', '\n', '\t']);

const tracked = []; // [{ letters: NodeList | array, mode }]
let lastGlyphRefresh = 0;
let currentProgress = 0;
let rafHandle = 0;
let active = false;

function pickGlitch() {
  return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
}

// Wrap each character of `el` into <span class="fx-letter">. Idempotent.
function ensureSplit(el, extraClass = '') {
  if (el.dataset.fxSplit === '1') return Array.from(el.querySelectorAll('.fx-letter'));
  const text = el.textContent;
  el.dataset.fxFinal = text;
  el.textContent = '';
  const result = [];
  for (const ch of text) {
    const s = document.createElement('span');
    s.className = 'fx-letter' + (extraClass ? ' ' + extraClass : '');
    s.dataset.target = ch;
    s.textContent = ch;
    el.appendChild(s);
    result.push(s);
  }
  el.dataset.fxSplit = '1';
  return result;
}

// Tag pre-existing letter spans (from name-hover.js) so the tick loop
// finds them. Does NOT re-split.
function tagExistingLetters(letters) {
  const result = [];
  letters.forEach((sp) => {
    if (!sp.dataset.target) sp.dataset.target = sp.textContent;
    sp.classList.add('fx-letter');
    result.push(sp);
  });
  return result;
}

function decideLetter(i, N, p, mode, target) {
  if (PROTECT.has(target)) return { clean: true, glyph: target };
  const wave = (i / Math.max(1, N - 1)) * 0.85;
  let clean;
  if (mode === 'resolve') {
    clean = p >= wave + 0.04;
  } else {
    // shatter: stays clean until progress passes its inverse threshold
    clean = p <= (1 - wave) - 0.04;
  }
  return { clean, glyph: clean ? target : null };
}

function tick(now) {
  if (!active) return;
  if (now - lastGlyphRefresh >= REFRESH_MS) {
    lastGlyphRefresh = now;
    for (const t of tracked) {
      const N = t.letters.length;
      for (let i = 0; i < N; i++) {
        const sp = t.letters[i];
        const target = sp.dataset.target;
        const d = decideLetter(i, N, currentProgress, t.mode, target);
        if (d.clean) {
          if (sp.textContent !== target) sp.textContent = target;
        } else {
          sp.textContent = pickGlitch();
        }
      }
    }
  }
  rafHandle = requestAnimationFrame(tick);
}

export function applyGlitchProgress(p) {
  currentProgress = Math.max(0, Math.min(1, p));
}

export function startGlitchFx() {
  if (active) return;

  // 1. Hero name: name-hover.js already split into .page__name-letter
  //    inside .page__name-line > span. Tag those letters for our loop.
  document.querySelectorAll('.page__name-line > span').forEach((wrap) => {
    const letters = wrap.querySelectorAll('.page__name-letter');
    if (letters.length === 0) return;
    const tagged = tagExistingLetters(letters);
    tracked.push({ letters: tagged, mode: 'shatter' });
  });

  // 2. Statement: split each [data-scramble] element ourselves.
  document.querySelectorAll('.page__statement [data-scramble]').forEach((part) => {
    const letters = ensureSplit(part);
    tracked.push({ letters, mode: 'resolve' });
  });

  // 3. Reveal the statement block immediately (no per-letter scramble anim)
  const statement = document.querySelector('.page__statement');
  if (statement) statement.classList.add('is-revealed');

  active = true;
  rafHandle = requestAnimationFrame(tick);
}

export function stopGlitchFx() {
  if (!active) return;
  active = false;
  if (rafHandle) cancelAnimationFrame(rafHandle);
  for (const t of tracked) {
    t.letters.forEach((sp) => {
      const target = sp.dataset.target;
      if (sp.textContent !== target) sp.textContent = target;
    });
  }
}
