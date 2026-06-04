// ───────────────────────────────────────────────
// Cursor strip — invisible bottom band on About page.
// On mousemove inside the band, spawn small cyan squares that
// fade out & shrink. Throttled to avoid spam.
// ───────────────────────────────────────────────

const SPAWN_INTERVAL_MS = 60;  // min ms between squares
const LIFE_MS = 1000;          // matches CSS animation

let lastSpawn = 0;

function spawnSquare(x, y) {
  const s = document.createElement('span');
  s.className = 'cursor-square';
  // small random offset for organic feel
  const dx = (Math.random() - 0.5) * 14;
  const dy = (Math.random() - 0.5) * 14;
  s.style.left = (x + dx) + 'px';
  s.style.top = (y + dy) + 'px';
  // slight size variation
  const size = 6 + Math.random() * 10;
  s.style.width = s.style.height = size + 'px';
  // slight rotation
  document.body.appendChild(s);
  setTimeout(() => s.remove(), LIFE_MS + 50);
}

function onMove(e) {
  const now = performance.now();
  if (now - lastSpawn < SPAWN_INTERVAL_MS) return;
  lastSpawn = now;
  spawnSquare(e.clientX, e.clientY);
}

function onTouch(e) {
  const t = e.touches[0];
  if (!t) return;
  const now = performance.now();
  if (now - lastSpawn < SPAWN_INTERVAL_MS) return;
  lastSpawn = now;
  spawnSquare(t.clientX, t.clientY);
}

export function initCursorStrip() {
  const strip = document.getElementById('cursor-strip');
  if (!strip) return;
  strip.addEventListener('mousemove', onMove, { passive: true });
  strip.addEventListener('touchmove', onTouch, { passive: true });
}
