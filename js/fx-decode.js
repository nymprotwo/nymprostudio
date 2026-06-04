// ───────────────────────────────────────────────
// FX #6: Decode scroll choreography.
// ───────────────────────────────────────────────
// The whole page starts as a binary/hex stream. As the user scrolls,
// each letter walks through stages:
//   binary (0/1)  →  hex (0-9 A-F)  →  resolved actual character
//
// Groups & their decode ranges (within 0..1 scroll progress):
//   - Hero name (KIRILL STEPANOV): 0.00 → 0.25  (resolves first)
//   - Statement (A creative dev / fueled by code & nightmares): 0.10 → 0.42
//   - Body content (WHO I AM bio, skills, CURRENTLY): 0.30 → 0.95
//
// Glyph refresh is slow (150ms) so the stream feels readable / controlled
// rather than chaotic.
// ───────────────────────────────────────────────

const BINARY = '01';
const HEX = '0123456789ABCDEF';
const REFRESH_MS = 150;
const PROTECT = new Set([' ', '\n', '\t']);

// Width of the per-letter stage transitions, as fraction of the group's
// scroll range. Smaller = letters snap; larger = each letter takes its
// time going binary → hex → resolved.
const STAGE_WIDTH = 0.18;
const HEX_OFFSET  = 0.06; // hex stage sits this far before resolution

const tracked = []; // [{ letters, startP, endP }]
let currentProgress = 0;
let lastRefresh = 0;
let active = false;
let rafHandle = 0;

function pickBin() { return BINARY[Math.floor(Math.random() * 2)]; }
function pickHex() { return HEX[Math.floor(Math.random() * 16)]; }

// Idempotently wrap each char of `el` into <span class="fx-letter">.
function splitElement(el) {
  if (el.dataset.fxSplit === '1') {
    return Array.from(el.querySelectorAll('.fx-letter'));
  }
  const text = el.textContent;
  el.dataset.fxFinal = text;
  el.textContent = '';
  const list = [];
  for (const ch of text) {
    const s = document.createElement('span');
    s.className = 'fx-letter';
    s.dataset.target = ch;
    s.textContent = ch;
    el.appendChild(s);
    list.push(s);
  }
  el.dataset.fxSplit = '1';
  return list;
}

function tagExisting(letters) {
  const out = [];
  letters.forEach((sp) => {
    if (!sp.dataset.target) sp.dataset.target = sp.textContent;
    sp.classList.add('fx-letter');
    out.push(sp);
  });
  return out;
}

// Decide stage for a letter given the global progress and its threshold.
function stageFor(p, threshold) {
  if (p >= threshold)               return 'resolved';
  if (p >= threshold - HEX_OFFSET)  return 'hex';
  if (p >= threshold - STAGE_WIDTH) return 'binary-late';
  return 'binary';
}

function tick(now) {
  if (!active) return;
  if (now - lastRefresh >= REFRESH_MS) {
    lastRefresh = now;
    for (const t of tracked) {
      const N = t.letters.length;
      const span = t.endP - t.startP;
      for (let i = 0; i < N; i++) {
        const sp = t.letters[i];
        const target = sp.dataset.target;
        if (PROTECT.has(target)) {
          if (sp.textContent !== target) sp.textContent = target;
          continue;
        }
        // Letter's resolve threshold is staggered across the group's range.
        const threshold = t.startP + (i / Math.max(1, N - 1)) * span;
        const st = stageFor(currentProgress, threshold);
        if (st === 'resolved') {
          if (sp.textContent !== target) sp.textContent = target;
        } else if (st === 'hex') {
          sp.textContent = pickHex();
        } else {
          // Both binary stages use 0/1, but late-binary refreshes don't
          // need to be visually different — keep it simple.
          sp.textContent = pickBin();
        }
      }
    }
  }
  rafHandle = requestAnimationFrame(tick);
}

export function applyDecodeProgress(p) {
  currentProgress = Math.max(0, Math.min(1, p));
}

export function startDecodeFx() {
  if (active) return;

  // 1. Hero name: 0.00 → 0.25 (resolves first as user begins scrolling)
  const nameWraps = document.querySelectorAll('.page__name-line > span');
  // All hero name letters concatenated into one tracked group so the
  // wave runs across both KIRILL and STEPANOV continuously.
  const heroLetters = [];
  nameWraps.forEach((w) => {
    const letters = w.querySelectorAll('.page__name-letter');
    const tagged = tagExisting(letters);
    heroLetters.push(...tagged);
  });
  if (heroLetters.length) {
    tracked.push({ letters: heroLetters, startP: 0.00, endP: 0.25 });
  }

  // 2. Statement: 0.10 → 0.42
  const stmtParts = document.querySelectorAll('.page__statement [data-scramble]');
  const stmtLetters = [];
  stmtParts.forEach((p) => {
    const letters = splitElement(p);
    stmtLetters.push(...letters);
  });
  if (stmtLetters.length) {
    tracked.push({ letters: stmtLetters, startP: 0.10, endP: 0.42 });
  }
  const statement = document.querySelector('.page__statement');
  if (statement) statement.classList.add('is-revealed');

  // 3. Body content: 0.30 → 0.95, partitioned by char count
  const root = document.querySelector('.page__content');
  if (root) {
    const bodyEls = Array.from(root.querySelectorAll(
      ':scope > .page__content-tag, :scope > .page__bio, :scope .skills li',
    ));
    let cum = 0;
    const lens = bodyEls.map((el) => {
      const t = el.textContent;
      cum += t.length;
      return t.length;
    });
    const BODY_START = 0.30;
    const BODY_END = 0.95;
    const bodyRange = BODY_END - BODY_START;

    let cursor = 0;
    for (let i = 0; i < bodyEls.length; i++) {
      const el = bodyEls[i];
      // Each element is its own group with its own startP/endP within the
      // body's overall range, proportional to its char count.
      const startP = BODY_START + (cursor / cum) * bodyRange;
      cursor += lens[i];
      const endP = BODY_START + (cursor / cum) * bodyRange;
      const letters = splitElement(el);
      // Don't hide the element — its letters will render binary/hex/text
      // depending on progress.
      tracked.push({ letters, startP, endP });
    }
    // Reveal-on-scroll classes on body blocks would normally hide them
    // until intersection. Force-reveal so they're visible from the start
    // (they'll just be showing binary noise until scroll decodes them).
    root.querySelectorAll('.reveal').forEach((el) => el.classList.add('is-revealed'));
  }

  active = true;
  rafHandle = requestAnimationFrame(tick);
}

export function stopDecodeFx() {
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
