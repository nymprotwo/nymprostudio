// ─────────────────────────────────────────────────────
// NYM / PROJECTS  v10
// • 6 real items, infinite drum scroll via transform
// • CSS :hover for bar (no sticking)
// • B&W thumbs → color+scale on hover
// ─────────────────────────────────────────────────────

import { pauseLenis, resumeLenis } from './smooth-scroll.js?v=29';
import { registerExitHandler }    from './overlays.js?v=28';

const PROJECTS = [
  { num:'01', title:'NYMPRO STUDIO',          year:'2026', tags:'IDENTITY / WEB',      grad:'linear-gradient(135deg,#0d1b2a,#1e3a5f,#0a2540)' },
  { num:'02', title:'NORTH JERSEY DENTAL LAB',year:'2025', tags:'BRANDING / WEB',       grad:'linear-gradient(135deg,#0a0a0a,#1a1a1a,#0d0d0d)', img:'img/njdl-preview.jpg' },
  { num:'03', title:'MOTION SYSTEMS',         year:'2025', tags:'UI / FRONTEND',        grad:'linear-gradient(135deg,#1a0a2e,#4a1070,#1a0030)' },
  { num:'04', title:'BRAND IDENTITY',         year:'2025', tags:'BRANDING / STRATEGY',  grad:'linear-gradient(135deg,#0a1a0a,#0d4a1a,#003015)' },
  { num:'05', title:'DIGITAL PRODUCT',        year:'2024', tags:'APP / DEVELOPMENT',    grad:'linear-gradient(135deg,#1a1200,#5a3a00,#2a1800)' },
  { num:'06', title:'VISUAL LANGUAGE',        year:'2023', tags:'ART DIRECTION',        grad:'linear-gradient(135deg,#001a1a,#00585a,#002828)' },
];
const N = PROJECTS.length;

// ── State ─────────────────────────────────────────────
let pg         = null;
let listView   = null;
let detailView = null;
let listEl     = null;   // <ul> with exactly N <li> items
let scrollWrap = null;   // the overflow:hidden container
let thumbEls   = [];
let tileRaf    = null;
let portalEl   = null;   // floats above the mask canvas

// Drum scroll state
let itemH       = 0;     // px height of one item
let totalH      = 0;     // itemH * N
let scrollCur   = 0;     // current animated offset
let scrollTgt   = 0;     // target offset (wheel accumulates here)
let drumRaf     = null;
let hoveredIdx  = -1;

// ── Grid distortion effect ────────────────────────────
// Canvas grid of tiles, scroll-driven rise + hover lens displacement

function gradToCanvas(gradStr, w, h) {
  const oc = document.createElement('canvas');
  oc.width = w; oc.height = h;
  const octx = oc.getContext('2d');
  const colors = (gradStr.match(/#[0-9a-fA-F]{3,6}/g) || ['#0d1b2a','#1e3a5f']);
  const grd = octx.createLinearGradient(0, 0, w, h);
  colors.forEach((c, i) => grd.addColorStop(i / Math.max(1, colors.length - 1), c));
  octx.fillStyle = grd;
  octx.fillRect(0, 0, w, h);
  // Subtle scanlines
  for (let y = 0; y < h; y += 4) {
    octx.fillStyle = `rgba(0,0,0,${0.12 + Math.random() * 0.06})`;
    octx.fillRect(0, y, w, 1);
  }
  return oc;
}

let gdRaf = null;   // grid distortion RAF handle
let gdCleanup = null; // cleanup fn stored for closeDetail

function initGridDistortion(canvas, project, _dv) {
  if (gdRaf) { cancelAnimationFrame(gdRaf); gdRaf = null; }
  if (gdCleanup) { gdCleanup(); gdCleanup = null; }

  const COLS      = 52;   // small tiles
  const GAP       = 2;
  const HOVER_R   = 130;
  const MAX_DISP  = 40;
  // Extra texture height multiplier — image is TEX_SCROLL_H × canvas height tall
  // so scrolling through it feels like scrolling the real page
  const TEX_SCROLL_H = 2.2;

  let W, H, tileW, tileH, ROWS;
  let scrollProg = 0;
  let scrollTgt  = 0;
  let mX = -9999, mY = -9999;
  let tex = null;   // offscreen canvas, height = H * TEX_SCROLL_H
  let texH = 0;

  function buildTex(imgEl) {
    W = canvas.offsetWidth  || window.innerWidth;
    H = canvas.offsetHeight || Math.round(window.innerHeight * 0.72);
    canvas.width  = W;
    canvas.height = H;
    tileW = W / COLS;
    tileH = tileW;
    ROWS  = Math.ceil(H / tileH) + 1;

    texH = Math.round(H * TEX_SCROLL_H);
    const oc  = document.createElement('canvas');
    oc.width  = W;
    oc.height = texH;
    const oc2 = oc.getContext('2d');

    if (imgEl) {
      const scale = Math.max(W / imgEl.naturalWidth, texH / imgEl.naturalHeight);
      const sw = imgEl.naturalWidth * scale, sh = imgEl.naturalHeight * scale;
      oc2.filter = 'brightness(1.7)';
      oc2.drawImage(imgEl, (W - sw) / 2, (texH - sh) / 2, sw, sh);
      oc2.filter = 'none';
      // Matte overlay
      oc2.fillStyle = 'rgba(6,5,10,0.45)';
      oc2.fillRect(0, 0, W, texH);
    } else {
      // Gradient fill
      const colors = (project.grad.match(/#[0-9a-fA-F]{3,6}/g) || ['#0d1b2a','#1e3a5f']);
      const grd = oc2.createLinearGradient(0, 0, W, texH);
      colors.forEach((c, i) => grd.addColorStop(i / Math.max(1, colors.length - 1), c));
      oc2.fillStyle = grd;
      oc2.fillRect(0, 0, W, texH);
      // Scanlines
      for (let y = 0; y < texH; y += 4) {
        oc2.fillStyle = `rgba(0,0,0,${0.1 + Math.random() * 0.05})`;
        oc2.fillRect(0, y, W, 1);
      }
    }
    tex = oc;
  }

  // Load image or build gradient texture
  if (project.img) {
    const im = new Image();
    im.onload  = () => buildTex(im);
    im.onerror = () => buildTex(null);
    im.src = project.img;
  } else {
    // Wait one frame so canvas has layout dimensions
    requestAnimationFrame(() => buildTex(null));
  }

  // Scroll drives tile progress based on canvas position in viewport
  function onWheel(e) { /* unused — driven by scroll */ }
  function onMM(e) {
    const r = canvas.getBoundingClientRect();
    mX = e.clientX - r.left;
    mY = e.clientY - r.top;
  }
  function onML() { mX = -9999; mY = -9999; }

  // Drive tile progress from scroll: 0→1 as canvas scrolls into view
  function onScroll() {
    const rect = canvas.getBoundingClientRect();
    // progress 0 when canvas just enters bottom of screen, 1 when fully visible
    const entered = window.innerHeight - rect.top;
    scrollTgt = Math.max(0, Math.min(1, entered / (window.innerHeight * 0.9)));
  }
  detailView.addEventListener('scroll', onScroll, { passive: true });
  canvas.addEventListener('mousemove', onMM);
  canvas.addEventListener('mouseleave', onML);

  const ctx = canvas.getContext('2d');

  function loop() {
    gdRaf = requestAnimationFrame(loop);
    scrollProg += (scrollTgt - scrollProg) * 0.07;
    ctx.clearRect(0, 0, W, H);
    if (!tex) return;

    // How far into the texture we are (parallax scroll of the image inside)
    const parallaxOffset = scrollProg * (texH - H);

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const baseX = col * tileW;
        const baseY = row * tileH;

        // Wave: bottom rows rise first, top rows last (снизу вверх)
        const rowNorm = ROWS > 1 ? row / (ROWS - 1) : 0; // 0=top 1=bottom
        const delay   = (1 - rowNorm) * 0.35; // top rows delayed most
        const local   = Math.max(0, Math.min(1, (scrollProg - delay) / (1 - delay)));
        const ease    = 1 - Math.pow(1 - local, 3);
        const riseY   = (1 - ease) * (H + tileH * 2);

        // Hover lens: push tiles away from cursor
        const cx = baseX + tileW / 2, cy = baseY + tileH / 2;
        const dx = cx - mX, dy = cy - mY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let dispX = 0, dispY = 0;
        if (dist < HOVER_R && dist > 0) {
          const str = Math.pow(1 - dist / HOVER_R, 2);
          dispX = (dx / dist) * str * MAX_DISP;
          dispY = (dy / dist) * str * MAX_DISP;
        }

        const destX = baseX + dispX;
        const destY = baseY + dispY - riseY;

        ctx.save();
        ctx.beginPath();
        ctx.rect(baseX + GAP / 2, baseY + GAP / 2, tileW - GAP, tileH - GAP);
        ctx.clip();
        // Source: tile's position in the texture + parallax offset scrolling the image
        ctx.drawImage(
          tex,
          baseX,                     // src X
          baseY + parallaxOffset,    // src Y — image scrolls inside tiles
          tileW, tileH,
          destX, destY,
          tileW, tileH
        );
        ctx.restore();
      }
    }
  }

  gdRaf = requestAnimationFrame(loop);

  gdCleanup = () => {
    if (gdRaf) { cancelAnimationFrame(gdRaf); gdRaf = null; }
    detailView.removeEventListener('scroll', onScroll);
    canvas.removeEventListener('mousemove', onMM);
    canvas.removeEventListener('mouseleave', onML);
  };
}

// ── Build list ────────────────────────────────────────
function buildList() {
  listView.innerHTML = '';

  // LEFT: drum scroll wrapper
  scrollWrap = document.createElement('div');
  scrollWrap.className = 'proj-scroll';

  listEl = document.createElement('ul');
  listEl.className = 'proj-list proj-list--drum';

  // Only N real items — no clones!
  PROJECTS.forEach((p, i) => {
    const li = document.createElement('li');
    li.className = 'proj-item';
    li.dataset.idx = i;
    li.innerHTML = `<span class="proj-num">${p.num}</span><span class="proj-name">${p.title}</span>`;
    li.addEventListener('mouseenter', () => onHover(i));
    li.addEventListener('mouseleave', onLeave);
    li.addEventListener('click', () => openDetail(i));
    listEl.appendChild(li);
  });

  scrollWrap.appendChild(listEl);
  listView.appendChild(scrollWrap);

  // RIGHT: stacked cards deck
  const deck = document.createElement('div');
  deck.className = 'proj-deck';
  thumbEls = [];

  // Render in reverse so card 0 is on top visually
  [...PROJECTS].reverse().forEach((p, ri) => {
    const i = N - 1 - ri; // real index
    const card = document.createElement('div');
    card.className = 'proj-card';
    card.dataset.idx = i;
    if (p.img) {
      card.style.backgroundImage = `url('${p.img}')`;
      card.style.backgroundSize = 'cover';
      card.style.backgroundPosition = 'center';
    } else {
      card.style.background = p.grad;
    }
    card.style.setProperty('--si', i);
    deck.appendChild(card);
    thumbEls[i] = card;
  });

  listView.appendChild(deck);

  // Init drum after fonts + layout
  document.fonts.ready.then(() => requestAnimationFrame(initDrum));
}

// ── Drum scroll engine ────────────────────────────────
function initDrum() {
  const containerH = scrollWrap.offsetHeight || window.innerHeight;
  // Show ~5 items → itemH = containerH/5
  itemH  = Math.round(containerH / 5);
  totalH = N * itemH;

  // Make list a transform stage (no overflow)
  listEl.style.height = containerH + 'px';

  // Position each item absolutely
  Array.from(listEl.querySelectorAll('.proj-item')).forEach(el => {
    el.style.position = 'absolute';
    el.style.width    = '100%';
    el.style.height   = itemH + 'px';
    el.style.top      = '0';
    el.style.left     = '0';
    el.style.minHeight = 'unset';
  });

  scrollCur = 0;
  scrollTgt = 0;
  applyDrum();

  // Wheel
  scrollWrap.addEventListener('wheel', onWheel, { passive: false });

  // Start RAF
  if (drumRaf) cancelAnimationFrame(drumRaf);
  function tick() {
    drumRaf = requestAnimationFrame(tick);
    const diff = scrollTgt - scrollCur;
    if (Math.abs(diff) < 0.05) return;
    scrollCur += diff * 0.10;
    applyDrum();
  }
  drumRaf = requestAnimationFrame(tick);
}

function onWheel(e) {
  e.preventDefault();
  scrollTgt += e.deltaY * 0.7;
}

function applyDrum() {
  const containerH = scrollWrap.offsetHeight || window.innerHeight;
  const centerY    = containerH / 2 - itemH / 2;
  // Normalize offset into [0, totalH)
  const off = ((scrollCur % totalH) + totalH) % totalH;

  const items = listEl.querySelectorAll('.proj-item');
  let centeredIdx = 0, minDist = Infinity;

  items.forEach(el => {
    const i = parseInt(el.dataset.idx);
    // Distance from offset in circular space
    let y = (i * itemH - off + totalH * 100) % totalH;
    // Fold into [-totalH/2, totalH/2]
    if (y > totalH / 2) y -= totalH;
    // Offset so center item sits at centerY
    el.style.transform = `translateY(${y + centerY}px)`;

    const dist = Math.abs(y);  // 0 = perfectly centered
    if (dist < minDist) { minDist = dist; centeredIdx = i; }
  });

  if (hoveredIdx < 0) setActiveThumb(centeredIdx, false);
  updatePortalPos();
}

// ── Portal — active title floats above the mask canvas ──
function ensurePortal() {
  if (portalEl) return;
  portalEl = document.createElement('div');
  portalEl.className = 'proj-portal';
  document.body.appendChild(portalEl);
}
function showPortal(idx) {
  ensurePortal();
  const p = PROJECTS[idx];
  portalEl.textContent = p.title;
  portalEl.dataset.idx = idx;
  portalEl.classList.add('is-visible');
  updatePortalPos();
  // Hide the source item's text so it doesn't double-render
  const srcEl = listEl?.querySelector(`.proj-item[data-idx="${idx}"]`);
  if (srcEl) srcEl.classList.add('portal-active');
}
function hidePortal() {
  if (!portalEl) return;
  portalEl.classList.remove('is-visible');
  // Restore source item text
  listEl?.querySelectorAll('.proj-item.portal-active')
    .forEach(el => el.classList.remove('portal-active'));
}
function updatePortalPos() {
  if (!portalEl?.classList.contains('is-visible')) return;
  const idx = parseInt(portalEl.dataset.idx);
  if (isNaN(idx)) return;
  const srcEl = listEl?.querySelector(`.proj-item[data-idx="${idx}"]`);
  if (!srcEl) return;
  const rect = srcEl.getBoundingClientRect();
  portalEl.style.top    = rect.top    + 'px';
  portalEl.style.left   = rect.left   + 'px';
  portalEl.style.width  = rect.width  + 'px';
  portalEl.style.height = rect.height + 'px';
}

// ── Hover ─────────────────────────────────────────────
function onHover(idx) {
  hoveredIdx = idx;
  listEl?.classList.add('has-hover');
  listEl?.querySelectorAll('.proj-item').forEach(el => el.classList.remove('is-scroll-active'));
  setActiveThumb(idx, true);
  showPortal(idx);
}
function onLeave() {
  hoveredIdx = -1;
  listEl?.classList.remove('has-hover');
  thumbEls.forEach(t => t.classList.remove('is-colored'));
  hidePortal();
  applyDrum();
}

// ── Thumbnail state ───────────────────────────────────
function setActiveThumb(idx, colored) {
  thumbEls.forEach((t, i) => {
    if (!t) return;
    t.classList.toggle('is-active',  i === idx);
    t.classList.toggle('is-colored', colored && i === idx);
  });
  // Mark scroll-active item for neon bar — only when not hovering
  if (!colored) {
    listEl?.querySelectorAll('.proj-item').forEach(el => {
      el.classList.toggle('is-scroll-active', parseInt(el.dataset.idx) === idx);
    });
  }
}

// ── Detail view ───────────────────────────────────────
function openDetail(i) {
  const p = PROJECTS[i];
  document.body.dataset.page = 'projects-detail';

  detailView.innerHTML = `
    <button class="proj-back" id="proj-back">← BACK</button>
    <div class="proj-detail-hero">
      <h1 class="proj-detail-title">${p.title}</h1>
      <div class="proj-detail-meta">
        <span class="proj-detail-year">${p.year}</span>
        <span class="proj-detail-tags">${p.tags}</span>
      </div>
      <div class="proj-scroll-hint"><span>SCROLL</span><div class="proj-scroll-line"></div></div>
    </div>
    <canvas class="proj-pixel-canvas" id="proj-pixel-canvas"></canvas>`;

  detailView.classList.add('is-visible');
  listView.classList.add('is-hidden');
  document.getElementById('proj-back').addEventListener('click', closeDetail);

  // Wait for layout then start pixel reveal
  setTimeout(() => startPixelReveal(p), 50);
}

// ── Pixel grid reveal (yutaabe-style) ─────────────────
function startPixelReveal(project) {
  if (gdCleanup) { gdCleanup(); gdCleanup = null; }
  if (gdRaf) { cancelAnimationFrame(gdRaf); gdRaf = null; }

  const canvas = document.getElementById('proj-pixel-canvas');
  if (!canvas) return;

  const PX       = 14;
  const GAP      = 1;
  const CELL     = PX - GAP;
  const HOVER_R  = 150;
  const MAX_PUSH = 8;
  const PHASE2_START = 0.0;
  const TEX_MULT = 2.5;
  const EQ_MAX_ROWS = 8; // max equalizer bar height in rows

  const W = canvas.offsetWidth  || window.innerWidth;
  const H = canvas.offsetHeight || window.innerHeight;
  canvas.width  = W;
  canvas.height = H;

  const COLS = Math.floor(W / PX);
  const ROWS = Math.floor(H / PX);
  canvas.width  = COLS * PX; // exact logical pixels — CSS stretches to 90vw
  canvas.height = ROWS * PX;

  // Scale factor: CSS px per logical px (same for both axes since aspect is preserved by CSS)
  const cssScaleX = W / (COLS * PX);
  const cssScaleY = H / (ROWS * PX);
  const eqCssH = Math.round(EQ_MAX_ROWS * PX * cssScaleY); // CSS height of eq canvases

  const canvasRect = canvas.getBoundingClientRect();
  const parentRect = canvas.parentElement.getBoundingClientRect();
  const canvasLeft = canvasRect.left - parentRect.left;
  const canvasTop  = canvasRect.top  - parentRect.top;

  const setupEqCanvas = (id, insertBefore) => {
    let ec = document.getElementById(id);
    if (!ec) { ec = document.createElement('canvas'); ec.id = id; }
    if (insertBefore) canvas.parentNode.insertBefore(ec, canvas);
    else canvas.parentNode.insertBefore(ec, canvas.nextSibling);
    ec.width  = COLS * PX;          // same logical width as main canvas
    ec.height = EQ_MAX_ROWS * PX;
    ec.style.cssText = `
      position:absolute;
      pointer-events:none;
      z-index:20;
      opacity:0;
      transition:opacity 0.3s ease;
      filter:saturate(0.55) brightness(0.8);
      left:${canvasLeft}px;
      width:${W}px;
      height:${eqCssH}px;
    `;
    return ec;
  };

  // Equalizer canvas — above main canvas
  const eqCanvas    = setupEqCanvas('proj-eq-canvas', true);
  eqCanvas.style.top = (canvasTop - eqCssH) + 'px';
  const eqCtx = eqCanvas.getContext('2d');

  // Equalizer canvas — below main canvas
  const eqBotCanvas = setupEqCanvas('proj-eq-bot-canvas', false);
  eqBotCanvas.style.top = (canvasTop + H) + 'px';
  const eqBotCtx = eqBotCanvas.getContext('2d');

  const INNER_ROW0 = 0;
  const INNER_ROW1 = ROWS;

  const cellDX      = new Float32Array(COLS * ROWS);
  const cellDY      = new Float32Array(COLS * ROWS);
  const tileNoise   = new Float32Array(COLS * ROWS);
  const tileAngle   = new Float32Array(COLS * ROWS);
  const tilePhase   = new Float32Array(COLS * ROWS);
  const tileEdgeN   = new Float32Array(COLS * ROWS);
  const tileRevealN = new Float32Array(COLS * ROWS);

  // Edge tear: static jagged top/bottom — fixed per-session, no animation
  // tileEdgeAlpha[ci] = 0..1, only set for row 0 and row ROWS-1
  const tileEdgeAlpha = new Float32Array(COLS * ROWS).fill(1.0);

  for (let i = 0; i < COLS * ROWS; i++) {
    tileNoise[i]   = 0.1 + Math.random() * 1.8;
    tileAngle[i]   = (Math.random() - 0.5) * 1.2;
    tilePhase[i]   = Math.random() * Math.PI * 2;
    tileEdgeN[i]   = Math.random();
    tileRevealN[i] = Math.random();
  }
  // Generate static tear pattern: outer row only
  // letterTiles[ci] = true if this tile overlaps a title letter — set after font load
  const letterTiles = new Uint8Array(COLS * ROWS);

  function applyOrganicShape() {
    const titleEl = document.querySelector('.proj-detail-title');
    if (!titleEl) return;
    const tr = titleEl.getBoundingClientRect();
    const cr = canvas.getBoundingClientRect();
    if (cr.width === 0 || cr.height === 0) { setTimeout(applyOrganicShape, 100); return; }

    // Map title bounding box → tile grid, with 1-tile padding on all sides
    const scX = COLS / cr.width, scY = ROWS / cr.height;
    const PAD = 1;
    const colMin = Math.max(0,    Math.floor((tr.left - cr.left) * scX) - PAD);
    const colMax = Math.min(COLS, Math.ceil ((tr.right - cr.left) * scX) + PAD);
    const rowMin = Math.max(0,    Math.floor((tr.top  - cr.top)  * scY) - PAD);
    const rowMax = Math.min(ROWS, Math.ceil ((tr.bottom - cr.top) * scY) + PAD);

    for (let r = rowMin; r < rowMax; r++)
      for (let c = colMin; c < colMax; c++)
        letterTiles[r * COLS + c] = 1;

    // Organic edge removal — only to non-letter tiles
    for (let col = 0; col < COLS; col++) {
      const depthT = Math.floor(Math.pow(Math.random(), 1.6) * 6) + 1;
      for (let d = 0; d < depthT; d++) {
        const ci = d * COLS + col;
        if (!letterTiles[ci])
          tileEdgeAlpha[ci] = d === depthT - 1 ? (Math.random() < 0.4 ? 0.4 : 0.0) : 0.0;
      }
      const depthB = Math.floor(Math.pow(Math.random(), 1.6) * 6) + 1;
      for (let d = 0; d < depthB; d++) {
        const ci = (ROWS - 1 - d) * COLS + col;
        if (!letterTiles[ci])
          tileEdgeAlpha[ci] = d === depthB - 1 ? (Math.random() < 0.4 ? 0.4 : 0.0) : 0.0;
      }
    }

    // Protect letter tiles from cluster holes
    for (let ci = 0; ci < COLS * ROWS; ci++)
      if (letterTiles[ci]) tileMask[ci] = 1;
  }

  // Double rAF ensures layout is complete before we read getBoundingClientRect
  requestAnimationFrame(() => requestAnimationFrame(applyOrganicShape));

  // Sparse cluster holes: ~1% coverage, small groups (single, row of 3-5, 2×2 square)
  const tileMask = new Uint8Array(COLS * ROWS).fill(1);
  const knock = (r, c) => { if (r >= 0 && r < ROWS && c >= 0 && c < COLS) tileMask[r * COLS + c] = 0; };
  const clusterCount = Math.round(COLS * ROWS * 0.003); // ~0.3% cluster seeds
  for (let k = 0; k < clusterCount; k++) {
    const row = Math.floor(Math.random() * ROWS);
    const col = Math.floor(Math.random() * COLS);
    const type = Math.random();
    if (type < 0.35) {
      knock(row, col); // single dot
    } else if (type < 0.65) {
      const len = 2 + Math.floor(Math.random() * 4); // horizontal run 2-5
      for (let i = 0; i < len; i++) knock(row, col + i);
    } else if (type < 0.85) {
      const len = 2 + Math.floor(Math.random() * 3); // vertical run 2-4
      for (let i = 0; i < len; i++) knock(row + i, col);
    } else {
      knock(row, col); knock(row, col+1); knock(row+1, col); knock(row+1, col+1); // 2×2
    }
  }

  let masterTgt = 0, masterProg = 0;
  let prevMasterProg = 0;
  let scrollTime = 0;
  let smoothScrollVel = 0;
  //
  // EQ SYSTEM:
  //   scroll UP   (revProg): topExt (external above) + botInt (internal bottom)
  //   scroll DOWN (fwdProg): botExt (external below) + topInt (internal top)
  //
  const topExtH = new Float32Array(COLS); const topExtT = new Float32Array(COLS);
  const botExtH = new Float32Array(COLS); const botExtT = new Float32Array(COLS);
  const topIntH = new Float32Array(COLS); const topIntT = new Float32Array(COLS);
  const botIntH = new Float32Array(COLS); const botIntT = new Float32Array(COLS);

  const mkClass = (n) => {
    const a = new Uint8Array(n);
    for (let i = 0; i < n; i++) { const r = Math.random(); a[i] = r < 0.8 ? 0 : r < 0.95 ? 1 : 2; }
    return a;
  };
  const topExtClass = mkClass(COLS * EQ_MAX_ROWS);
  const botExtClass = mkClass(COLS * EQ_MAX_ROWS);
  const topIntClass = mkClass(COLS); // per-col opacity for internal top
  const botIntClass = mkClass(COLS); // per-col opacity for internal bottom

  // Static scatter mask for external eq: 30% of tiles randomly skipped to match reveal style
  const eqScatter = new Uint8Array(COLS * EQ_MAX_ROWS);
  for (let i = 0; i < eqScatter.length; i++) eqScatter[i] = Math.random() < 0.30 ? 1 : 0;

  let fwdProg = 0, revProg = 0;
  let topExtTimer = 0, botExtTimer = 0, topIntTimer = 0, botIntTimer = 0;
  // Raw mouse position, updated on mousemove
  let mX = -9999, mY = -9999;
  // Smoothed position used for lens — lags behind cursor
  let smoothMX = -9999, smoothMY = -9999;
  let tex = null, texNW = 1, texNH = 1;

  function buildTex(img) {
    if (img) {
      tex = img; texNW = img.naturalWidth; texNH = img.naturalHeight;
    } else {
      const texH = Math.round(H * TEX_MULT);
      const oc   = document.createElement('canvas');
      oc.width = W; oc.height = texH;
      const colors = project.grad.match(/#[0-9a-fA-F]{3,6}/g) || ['#0d1b2a','#1e3a5f'];
      const g = oc.getContext('2d').createLinearGradient(0, 0, 0, texH);
      colors.forEach((c, i) => g.addColorStop(i / Math.max(1, colors.length - 1), c));
      oc.getContext('2d').fillStyle = g;
      oc.getContext('2d').fillRect(0, 0, W, texH);
      tex = oc; texNW = W; texNH = texH;
    }
  }

  if (project.img) {
    const im = new Image();
    im.onload  = () => buildTex(im);
    im.onerror = () => buildTex(null);
    im.src = project.img;
  } else {
    buildTex(null);
  }

  function onWheel(e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    const speed = 0.004; // unified speed for reveal and image scroll
    masterTgt = Math.max(0, Math.min(4, masterTgt + e.deltaY * speed));
  }
  window.addEventListener('wheel', onWheel, { passive: false, capture: true });

  function onMM(e) {
    const r = canvas.getBoundingClientRect();
    mX = e.clientX - r.left; mY = e.clientY - r.top;
  }
  function onML() { mX = -9999; mY = -9999; }
  canvas.addEventListener('mousemove', onMM);
  canvas.addEventListener('mouseleave', onML);

  const ctx = canvas.getContext('2d');
  const hoverTiles = [];

  function loop() {
    gdRaf = requestAnimationFrame(loop);
    masterProg += (masterTgt - masterProg) * 0.16;

    const scrollDelta = masterProg - prevMasterProg;
    const scrollVel   = Math.abs(scrollDelta);
    prevMasterProg = masterProg;
    scrollTime += scrollVel * 25;

    smoothScrollVel += (scrollVel - smoothScrollVel) * 0.12;
    const eqScale  = Math.min(1, smoothScrollVel / 0.0018); // 0=slow scroll, 1=fast scroll

    const isRevealed = masterProg > 0.3;
    const goingFwd   = scrollDelta >  0.00008 && isRevealed;
    const goingRev   = scrollDelta < -0.00008 && isRevealed;

    if (goingRev) { fwdProg += (1 - fwdProg) * 0.20; }
    else          { fwdProg = 0; botExtT.fill(0); topIntT.fill(0); }

    if (goingFwd) { revProg += (1 - revProg) * 0.20; }
    else          { revProg = 0; topExtT.fill(0); botIntT.fill(0); }

    const upd = (timer, interval, H2, T, prog, maxR, prob, minR = 1) => {
      if (prog > 0.01) {
        timer += scrollVel;
        if (timer > interval) {
          timer = 0;
          const effectiveMax = Math.max(minR, Math.round(maxR * eqScale));
          for (let c = 0; c < COLS; c++) {
            if (Math.random() < prob) { const r = Math.random(); T[c] = r < 0.3 ? 0 : Math.round(r * effectiveMax); }
          }
        }
      }
      for (let c = 0; c < COLS; c++) H2[c] += (T[c] * prog - H2[c]) * 0.22;
      return timer;
    };
    topExtTimer = upd(topExtTimer, 0.04,  topExtH, topExtT, revProg, 5,           0.35);
    botIntTimer = upd(botIntTimer, 0.055, botIntH, botIntT, revProg, 4,           0.30, 3);
    botExtTimer = upd(botExtTimer, 0.04,  botExtH, botExtT, fwdProg, EQ_MAX_ROWS, 0.35);
    topIntTimer = upd(topIntTimer, 0.055, topIntH, topIntT, fwdProg, 4,           0.30, 3);

    // Smooth mouse position — lens lags behind cursor
    if (mX > 0) {
      if (smoothMX < 0) { smoothMX = mX; smoothMY = mY; } // snap on first enter
      smoothMX += (mX - smoothMX) * 0.10;
      smoothMY += (mY - smoothMY) * 0.10;
    } else {
      smoothMX = -9999; smoothMY = -9999;
    }

    const rp      = Math.min(1, masterProg);
    const p2      = Math.max(0, Math.min(1, (rp - PHASE2_START) / (1 - PHASE2_START)));
    const imgT    = Math.max(0, Math.min(1, (masterProg - 1) / 3));

    // Image coordinate scale
    const sc       = texNW / W;
    const visH     = H * sc;
    const baseYOff = texNH * 0.28;  // start 28% down image so subject appears immediately
    const srcYOff  = baseYOff + imgT * Math.max(0, texNH - baseYOff - visH);

    document.body.classList.toggle('detail-scrolling', masterTgt > 0.02);
    ctx.clearRect(0, 0, COLS * PX, ROWS * PX);
    canvas.classList.toggle('is-revealing', p2 > 0.005);

    if (!tex) return;
    hoverTiles.length = 0;

    // Edge tear is static — no per-frame animation needed

    // ── Draw revealed tiles ──
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const ci = row * COLS + col;

        // Reveal wave: bottom→top with per-tile scatter
        const rowNorm   = row / Math.max(1, ROWS - 1);
        const scatter   = (tileRevealN[ci] - 0.5) * 0.25;
        const revThresh = Math.max(0, Math.min(1, (1 - rowNorm) + scatter));
        if (p2 < revThresh) {
          // Letter tiles stay dark even before the reveal wave reaches them
          if (letterTiles[ci]) {
            ctx.fillStyle = '#06050A';
            ctx.fillRect(col * PX, row * PX, PX, PX);
          }
          cellDX[ci] = 0; cellDY[ci] = 0; continue;
        }

        // Edge tear: only outermost row (0 and ROWS-1) has static sparse alpha
        let alpha = tileEdgeAlpha[ci]; // organic shape: all edge rows have custom alpha
        if (alpha < 0.01) { cellDX[ci] = 0; cellDY[ci] = 0; continue; }

        // Letter silhouette: solid dark tile over letter area (hides title, creates shape)
        if (tileMask[ci] < 0.5) {
          ctx.fillStyle = '#06050A';
          ctx.fillRect(col * PX, row * PX, PX, PX);
          cellDX[ci] = 0; cellDY[ci] = 0;
          continue;
        }

        // Top-row scatter: blend canvas top edge with external eq above (non-letter tiles only)
        if (revProg > 0.01 && row < 3 && !letterTiles[ci]) {
          if (tileEdgeN[ci] < revProg * 0.65) { cellDX[ci] = 0; cellDY[ci] = 0; continue; }
        }

        // Internal eqs: scattered tiles 3-4 rows deep from edges during scroll
        if (masterProg > 0.98 && !letterTiles[ci]) {
          // scroll UP (fwdProg) → bottom internal rows scatter
          if (botIntH[col] > 0.1) {
            const depth = ROWS - 1 - row;
            const depthMax = Math.round(botIntH[col]);
            if (depth < depthMax) {
              if (tileRevealN[ci] < 0.38) { cellDX[ci] = 0; cellDY[ci] = 0; continue; }
              alpha *= 0.45 + 0.55 * (depth / Math.max(1, depthMax));
            }
          }
          // scroll DOWN (revProg) → top internal rows scatter
          if (topIntH[col] > 0.1) {
            const depthMax = Math.round(topIntH[col]);
            if (row < depthMax) {
              if (tileRevealN[ci] < 0.38) { cellDX[ci] = 0; cellDY[ci] = 0; continue; }
              alpha *= 0.45 + 0.55 * (row / Math.max(1, depthMax));
            }
          }
        }

        const baseX = col * PX;
        const baseY = row * PX;
        const cx = baseX + PX / 2, cy = baseY + PX / 2;
        const ddx = smoothMX - cx, ddy = smoothMY - cy;
        const dist = Math.sqrt(ddx * ddx + ddy * ddy);

        let tDX = 0, tDY = 0;
        if (dist < HOVER_R && dist > 0) {
          const norm  = dist / HOVER_R;
          const push  = (1 - norm) * (1 - norm) * MAX_PUSH * tileNoise[ci];
          const angle = Math.atan2(-ddy, -ddx) + tileAngle[ci] * 0.4 * norm;
          tDX = Math.cos(angle) * push;
          tDY = Math.sin(angle) * push;
        }
        cellDX[ci] += (tDX - cellDX[ci]) * 0.20;
        cellDY[ci] += (tDY - cellDY[ci]) * 0.13;

        const dx = cellDX[ci], dy = cellDY[ci];
        const hasDrift = dx * dx + dy * dy > 1;

        const nPX    = PX * sc;
        const nX     = baseX * sc;
        const innerY = (row - INNER_ROW0) * PX;
        const nY     = Math.max(0, Math.min(texNH - nPX, innerY * sc + srcYOff));

        // Fill full PX×PX area with bg color so gaps don't show text underneath
        ctx.fillStyle = '#06050A';
        ctx.fillRect(baseX, baseY, PX, PX);

        if (hasDrift) {
          hoverTiles.push({ baseX, baseY, dx, dy, dist, nX, nY, nPX, alpha });
        } else {
          ctx.globalAlpha = alpha;
          ctx.drawImage(tex, nX, nY, nPX, nPX, baseX + GAP / 2, baseY + GAP / 2, CELL, CELL);
          ctx.globalAlpha = 1;
        }
      }
    }

    // ── Pass 2: displaced tiles, farthest first ──
    hoverTiles.sort((a, b) => b.dist - a.dist);
    const DCELL = CELL - 1;
    for (const { baseX, baseY, dx, dy, nX, nY, nPX, alpha } of hoverTiles) {
      ctx.fillStyle = '#06050A';
      ctx.fillRect(baseX + dx, baseY + dy, PX, PX);
      ctx.globalAlpha = alpha;
      ctx.drawImage(tex, nX, nY, nPX, nPX,
        baseX + dx + 1, baseY + dy + 1, DCELL, DCELL);
    }
    ctx.globalAlpha = 1;

    // ── Equalizer canvases ──
    const fullyRevealed = masterProg > 0.98;
    const showTop = fullyRevealed && tex && revProg > 0.01;
    const showBot = fullyRevealed && tex && fwdProg > 0.01;
    eqCanvas.style.opacity    = showTop ? '1' : '0';
    eqBotCanvas.style.opacity = showBot ? '1' : '0';

    const eqSc  = texNW / W;
    const eqNPX = PX * eqSc;

    // prog → fade multiplier: starts at 0.5, reaches 1.0 as prog→1
    const fadeMult = (prog) => 0.5 + 0.5 * Math.min(1, prog * 2.5);

    const drawEqCanvas = (ctx2, heights, tileClass, getY, growDown, prog) => {
      ctx2.clearRect(0, 0, W, EQ_MAX_ROWS * PX);
      const fade = fadeMult(prog);
      for (let col = 0; col < COLS; col++) {
        const bars = Math.round(heights[col]);
        if (bars < 1) continue;
        const baseX = col * PX;
        const nX    = baseX * eqSc;
        for (let r = 0; r < bars; r++) {
          // Static scatter: skip ~30% of tiles to match reveal wave style
          if (eqScatter[col * EQ_MAX_ROWS + r]) continue;
          const baseY = growDown ? r * PX : (EQ_MAX_ROWS - 1 - r) * PX;
          const nY    = getY(r);
          const tc    = tileClass[col * EQ_MAX_ROWS + r];
          const ta    = (tc === 0 ? 1.0 : tc === 1 ? 0.6 : 0.3) * fade;
          ctx2.fillStyle = '#06050A';
          ctx2.fillRect(baseX, baseY, PX, PX);
          ctx2.globalAlpha = ta;
          ctx2.drawImage(tex, nX, nY, eqNPX, eqNPX, baseX + GAP / 2, baseY + GAP / 2, CELL, CELL);
          ctx2.globalAlpha = 1;
        }
      }
    };

    if (showTop)
      drawEqCanvas(eqCtx,    topExtH, topExtClass,
        r => Math.max(0, srcYOff - (r + 1) * eqSc * PX), false, revProg);
    if (showBot)
      drawEqCanvas(eqBotCtx, botExtH, botExtClass,
        r => Math.min(texNH - eqNPX, srcYOff + visH + r * eqSc * PX), true, fwdProg);
  }

  gdRaf = requestAnimationFrame(loop);

  gdCleanup = () => {
    if (gdRaf) { cancelAnimationFrame(gdRaf); gdRaf = null; }
    window.removeEventListener('wheel', onWheel, { capture: true });
    canvas.removeEventListener('mousemove', onMM);
    canvas.removeEventListener('mouseleave', onML);
    canvas.classList.remove('is-revealing');
    eqCanvas.style.opacity    = '0';
    eqBotCanvas.style.opacity = '0';
    document.body.classList.remove('detail-scrolling');
  };
}
function closeDetail() {
  if (gdCleanup) { gdCleanup(); gdCleanup = null; }
  detailView.classList.remove('is-visible');
  listView.classList.remove('is-hidden');
  if (tileRaf) { cancelAnimationFrame(tileRaf); tileRaf = null; }
  document.body.dataset.page = 'projects'; // restore mask
}

// ── Public API ────────────────────────────────────────
export function initProjects() {
  pg         = document.getElementById('page-projects');
  listView   = pg?.querySelector('.proj-list-view');
  detailView = pg?.querySelector('.proj-detail-view');
  if (!pg) return;
  buildList();
  registerExitHandler(hideProjects);
}

export function showProjects() {
  if (!pg) return;
  pg.style.display = 'block';
  requestAnimationFrame(() => pg.classList.add('is-visible'));
  pauseLenis();
  document.body.dataset.page = 'projects';
}

export function hideProjects() {
  if (!pg) return;
  if (gdCleanup) { gdCleanup(); gdCleanup = null; }
  // Always reset detail → list so next open starts fresh
  if (detailView?.classList.contains('is-visible')) {
    detailView.classList.remove('is-visible');
    listView?.classList.remove('is-hidden');
    if (tileRaf) { cancelAnimationFrame(tileRaf); tileRaf = null; }
  }
  pg.classList.remove('is-visible');
  setTimeout(() => { pg.style.display = 'none'; }, 500);
  if (drumRaf) { cancelAnimationFrame(drumRaf); drumRaf = null; }
  delete document.body.dataset.page;
  hidePortal();
  resumeLenis();
}
