// ───────────────────────────────────────────────
// Splash — per-line glitch scramble, lines reveal in sequence.
// CSS sets opacity:0 by default so the raw markup never flashes.
// ───────────────────────────────────────────────

const GLITCH = '!<>-_\\/[]{}—=+*^?#________01';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function pickGlitch() {
  return GLITCH[Math.floor(Math.random() * GLITCH.length)];
}

function scramble(el, finalText, durationMs = 750) {
  return new Promise((resolve) => {
    const start = performance.now();
    const queue = [...finalText].map((_, i) => ({
      from: pickGlitch(),
      // staggered end times so chars settle left-to-right with jitter
      startAt: Math.random() * 0.25,
      endAt: 0.25 + (i / finalText.length) * 0.55 + Math.random() * 0.15,
    }));

    function tick(now) {
      const t = (now - start) / durationMs;
      let out = '';
      let done = 0;
      for (let i = 0; i < finalText.length; i++) {
        const target = finalText[i];
        // Preserve structural chars so the prefix stays readable
        if (target === ' ' || target === '>' || target === ':') {
          out += target;
          done++;
          continue;
        }
        const item = queue[i];
        if (t >= item.endAt) {
          out += target;
          done++;
        } else if (t < item.startAt) {
          out += item.from;
        } else {
          if (Math.random() < 0.45) item.from = pickGlitch();
          out += item.from;
        }
      }
      el.textContent = out;
      if (done === finalText.length) resolve();
      else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

export async function runSplash() {
  const lines = document.querySelectorAll('.splash__line');
  // Snapshot intended text (HTML carries it, since CSS hides it from view)
  const texts = Array.from(lines).map((el) => el.textContent.trim());

  // Wipe text + ensure invisible (CSS already opacity:0)
  lines.forEach((el) => {
    el.textContent = '';
    el.style.opacity = '0';
  });

  for (let i = 0; i < lines.length; i++) {
    const el = lines[i];
    el.style.opacity = '1';
    await scramble(el, texts[i], 720);
    await sleep(220);
  }

  await sleep(500);
}
