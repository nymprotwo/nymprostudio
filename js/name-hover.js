// ───────────────────────────────────────────────
// Mouse-driven void effect on KIRILL STEPANOV.
// Cursor acts as a "shark" — creates a dark void around itself,
// letters dissolve near it and fill back as it moves away.
// ───────────────────────────────────────────────

const VOID_RADIUS = 120;   // px — shark zone
const MIN_ALPHA   = 0.04;  // how invisible letters get at center

function splitToLetters(el) {
  if (el.dataset.split === '1') return;
  const text = el.textContent;
  el.textContent = '';
  for (const ch of text) {
    const s = document.createElement('span');
    s.className = 'page__name-letter';
    s.textContent = ch === ' ' ? ' ' : ch;
    el.appendChild(s);
  }
  el.dataset.split = '1';
}

export function initNameHover() {
  document.querySelectorAll('.page__name-line > span').forEach(splitToLetters);

  const nameEl = document.querySelector('.page__name');
  if (!nameEl) return;

  let letters = [];
  let rafId = null;
  let mx = -9999, my = -9999;

  function collect() {
    letters = [...document.querySelectorAll('.page__name-letter')];
  }

  function applyVoid() {
    rafId = null;
    letters.forEach((el) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top  + r.height / 2;
      const dist = Math.hypot(mx - cx, my - cy);
      // t: 1 = cursor is right on the letter, 0 = outside void radius
      const t = Math.max(0, 1 - dist / VOID_RADIUS);
      // smoothstep so edge is soft
      const ease = t * t * (3 - 2 * t);
      const alpha = 1 - ease * (1 - MIN_ALPHA);
      el.style.setProperty('--la', alpha.toFixed(3));
    });
  }

  function onMove(e) {
    mx = e.clientX;
    my = e.clientY;
    if (!rafId) rafId = requestAnimationFrame(applyVoid);
  }

  function onLeave() {
    mx = -9999; my = -9999;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    letters.forEach((el) => el.style.removeProperty('--la'));
  }

  nameEl.addEventListener('mousemove', onMove);
  nameEl.addEventListener('mouseleave', onLeave);

  collect();

  // Re-collect if fx modules re-split letters later
  new MutationObserver(collect).observe(nameEl, { childList: true, subtree: true });
}
