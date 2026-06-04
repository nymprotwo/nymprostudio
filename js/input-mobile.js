// ───────────────────────────────────────────────
// Mobile input: device orientation (gyro) + touch drag fallback.
// iOS demands DeviceOrientationEvent.requestPermission() be called
// SYNCHRONOUSLY from a user-gesture handler — no async/await before
// the call, or Safari rejects with no prompt shown.
// ───────────────────────────────────────────────

import { setMaskTarget } from './scene.js?v=28';

const isTouch = (
  'ontouchstart' in window ||
  navigator.maxTouchPoints > 0 ||
  matchMedia('(hover: none)').matches
);

let gyroActive = false;
let permissionRequested = false;

function onGyro(e) {
  const gamma = e.gamma || 0;            // -90..90 (left/right tilt)
  const beta = e.beta || 0;              // -180..180 (front/back)
  const nx = Math.max(-1, Math.min(1, gamma / 35));
  const ny = Math.max(-1, Math.min(1, (beta - 30) / 35));
  setMaskTarget(ny * 0.3, nx * 0.5);
}

function attachGyro() {
  if (gyroActive) return;
  window.addEventListener('deviceorientation', onGyro);
  gyroActive = true;
  console.log('[NYM] gyro attached');
}

// SYNCHRONOUS gesture handler — no async, no await before requestPermission
function onFirstTouch() {
  if (permissionRequested) return;
  permissionRequested = true;
  window.removeEventListener('touchstart', onFirstTouch);

  if (!window.DeviceOrientationEvent) {
    console.log('[NYM] gyro: DeviceOrientationEvent not supported');
    return;
  }

  // iOS 13+ requires explicit permission
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    console.log('[NYM] gyro: requesting iOS permission...');
    DeviceOrientationEvent.requestPermission()
      .then((state) => {
        console.log('[NYM] gyro permission state:', state);
        if (state === 'granted') {
          attachGyro();
        } else {
          // user denied → keep touch drag, hint user
          showHintText('TOUCH TO MOVE');
        }
      })
      .catch((err) => {
        console.warn('[NYM] gyro permission error:', err);
        showHintText('TOUCH TO MOVE');
      });
    return;
  }

  // Android / others — attach directly, no prompt needed
  attachGyro();
}

function onTouchMove(e) {
  const t = e.touches[0];
  if (!t) return;
  const nx = (t.clientX / window.innerWidth) * 2 - 1;
  const ny = (t.clientY / window.innerHeight) * 2 - 1;
  setMaskTarget(ny * 0.3, nx * 0.5);
}

function showHintText(text) {
  const hint = document.getElementById('mobile-hint');
  if (!hint) return;
  hint.textContent = text;
  hint.classList.add('is-visible');
  clearTimeout(showHintText._t);
  showHintText._t = setTimeout(() => hint.classList.remove('is-visible'), 4500);
}

export function initMobileInput() {
  if (!isTouch) return;

  // Touch drag always works (no permission needed)
  window.addEventListener('touchmove', onTouchMove, { passive: true });

  // First tap triggers gyro permission (iOS) or attach (Android)
  window.addEventListener('touchstart', onFirstTouch, { passive: true });

  // Initial hint
  setTimeout(() => showHintText('TILT TO MOVE'), 1200);
}
