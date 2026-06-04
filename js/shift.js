// ───────────────────────────────────────────────
// SHIFT toggler — placeholder. Future hook: trigger mini-game / mode switch.
// Registers an exit handler so the logo "home" button can reset it.
// ───────────────────────────────────────────────

import { registerExitHandler } from './overlays.js?v=28';

let btn = null;

function setPressed(state) {
  if (!btn) return;
  btn.setAttribute('aria-pressed', String(!!state));
}

export function initShift() {
  btn = document.getElementById('shift-toggle');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const pressed = btn.getAttribute('aria-pressed') === 'true';
    setPressed(!pressed);
    // TODO: trigger mode/game transition here
  });

  // When the user hits the home button, reset SHIFT too
  registerExitHandler(() => setPressed(false));
}
