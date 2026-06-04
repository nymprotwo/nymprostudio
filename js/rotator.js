// ───────────────────────────────────────────────
// Rotating tagline — cycles phrases with glitch scramble
// ───────────────────────────────────────────────

const PHRASES = [
  ['BRAIN IS OFFLINE',        'BE BACK LATER'],
  ['IDENTITY: UNKNOWN',       'PURPOSE: BUILDING'],
  ['HELLO STRANGER',          'WANT TO MAKE STUFF?'],
  ['CODE IS POETRY',          'DESIGN IS WAR'],
  ['CTRL + C IS FOR COWARDS', 'CTRL + Z IS FOR ARTISTS'],
  ['I MAKE WEIRD STUFF',      'AND IT WORKS'],
  ['COFFEE > SLEEP',          'INSPIRATION > BOTH'],
  ['CURRENTLY BUILDING',      'SOMETHING WEIRD'],
];

const GLITCH_CHARS = '!<>-_\\/[]{}—=+*^?#________01';

function scramble(el, finalText, durationMs = 800) {
  return new Promise((resolve) => {
    const start = performance.now();
    const queue = [...finalText].map(() => ({
      from: GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)],
      startAt: Math.random() * 0.5,
      endAt: 0.5 + Math.random() * 0.5,
    }));

    const tick = (now) => {
      const t = (now - start) / durationMs;
      let out = '';
      let done = 0;
      for (let i = 0; i < finalText.length; i++) {
        const item = queue[i];
        const target = finalText[i];
        if (target === ' ') { out += ' '; done++; continue; }
        if (t >= item.endAt) { out += target; done++; }
        else if (t < item.startAt) { out += item.from; }
        else {
          if (Math.random() < 0.3) {
            item.from = GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
          }
          out += item.from;
        }
      }
      el.textContent = out;
      if (done === finalText.length) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function startRotator(rootSelector = '#rotator') {
  const root = document.querySelector(rootSelector);
  if (!root) return;
  const lines = root.querySelectorAll('.hero__rotator-line');
  if (lines.length < 2) return;

  // Show first phrase immediately with scramble
  let idx = 0;
  await Promise.all([
    scramble(lines[0], PHRASES[idx][0], 900),
    scramble(lines[1], PHRASES[idx][1], 900),
  ]);

  while (true) {
    await sleep(3500);
    idx = (idx + 1) % PHRASES.length;
    await Promise.all([
      scramble(lines[0], PHRASES[idx][0], 800),
      scramble(lines[1], PHRASES[idx][1], 800),
    ]);
  }
}
