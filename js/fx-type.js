// ───────────────────────────────────────────────
// FX #4B: Typewriter scroll choreography.
// ───────────────────────────────────────────────
// As the user scrolls, the body content (bio, skills, currently)
// types itself character-by-character. Statement fades in early,
// fades out before the typing begins so it doesn't overlap.
// Reverse scroll keeps already-typed text intact (we just rewind
// the visible-chars count). A blinking '|' cursor sits at the
// write head of the currently-typing element.
// ───────────────────────────────────────────────

const TYPE_START = 0.28;   // scroll progress at which typing begins
const TYPE_END   = 0.97;   // and ends
const STMT_FADE_IN_END = 0.08;
const STMT_FADE_OUT_START = 0.22;
const STMT_FADE_OUT_END = 0.30;

const elements = []; // [{ el, finalText, startP, endP, isCursor }]
let active = false;
let currentProgress = 0;
let cursorEl = null;
let lastActiveIndex = -1;

function setupCursor() {
  cursorEl = document.createElement('span');
  cursorEl.className = 'fx-type-cursor';
  cursorEl.textContent = '|';
  return cursorEl;
}

export function applyTypeProgress(p) {
  currentProgress = Math.max(0, Math.min(1, p));
  render();
}

function render() {
  const p = currentProgress;

  // Statement fade
  const statement = document.querySelector('.page__statement');
  if (statement) {
    let op = 0;
    if (p < STMT_FADE_IN_END) op = p / STMT_FADE_IN_END;
    else if (p < STMT_FADE_OUT_START) op = 1;
    else if (p < STMT_FADE_OUT_END) op = 1 - (p - STMT_FADE_OUT_START) / (STMT_FADE_OUT_END - STMT_FADE_OUT_START);
    statement.style.opacity = op.toFixed(3);
    statement.style.transform = `translateY(${(1 - op) * -20}px)`;
    if (op > 0.5) statement.classList.add('is-revealed');
    else statement.classList.remove('is-revealed');
  }

  // Type phase
  if (p <= TYPE_START) {
    // Empty all
    for (const t of elements) t.el.textContent = '';
    if (cursorEl && cursorEl.parentElement) cursorEl.parentElement.removeChild(cursorEl);
    lastActiveIndex = -1;
    return;
  }

  const typeP = (p - TYPE_START) / (TYPE_END - TYPE_START);

  let activeIdx = -1;
  for (let i = 0; i < elements.length; i++) {
    const t = elements[i];
    if (typeP >= t.endP) {
      // Fully typed
      if (t.el.textContent !== t.finalText) t.el.textContent = t.finalText;
    } else if (typeP <= t.startP) {
      // Not yet typing
      if (t.el.textContent !== '') t.el.textContent = '';
    } else {
      // Currently typing
      const localP = (typeP - t.startP) / (t.endP - t.startP);
      const chars = Math.max(1, Math.floor(t.finalText.length * localP));
      const sub = t.finalText.slice(0, chars);
      if (t.el.textContent !== sub) t.el.textContent = sub;
      activeIdx = i;
    }
  }

  // Move cursor to the active element
  if (activeIdx >= 0) {
    if (!cursorEl) setupCursor();
    if (cursorEl.parentElement !== elements[activeIdx].el) {
      if (cursorEl.parentElement) cursorEl.parentElement.removeChild(cursorEl);
      elements[activeIdx].el.appendChild(cursorEl);
    }
    lastActiveIndex = activeIdx;
  } else if (cursorEl && cursorEl.parentElement) {
    cursorEl.parentElement.removeChild(cursorEl);
  }
}

export function startTypeFx() {
  if (active) return;

  // Collect body content elements in document order
  const root = document.querySelector('.page__content');
  if (!root) return;
  const targets = Array.from(root.querySelectorAll(':scope > .page__content-tag, :scope > .page__bio, :scope .skills li'));

  // Snapshot original text, clear, compute proportional ranges by char count
  let total = 0;
  const lengths = [];
  for (const el of targets) {
    const text = el.textContent;
    el.dataset.typeFinal = text;
    el.textContent = '';
    lengths.push(text.length);
    total += text.length;
  }
  if (total === 0) return;

  let cursor = 0;
  for (let i = 0; i < targets.length; i++) {
    const startP = cursor / total;
    cursor += lengths[i];
    const endP = cursor / total;
    elements.push({
      el: targets[i],
      finalText: targets[i].dataset.typeFinal,
      startP, endP,
    });
  }

  setupCursor();
  active = true;
  render();
}

export function stopTypeFx() {
  if (!active) return;
  active = false;
  // Restore all texts
  for (const t of elements) {
    t.el.textContent = t.finalText;
  }
  if (cursorEl && cursorEl.parentElement) cursorEl.parentElement.removeChild(cursorEl);
}
