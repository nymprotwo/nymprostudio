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
  { num:'02', title:'NORTH JERSEY DENTAL LAB',year:'2025', tags:'BRANDING / WEB',       grad:'linear-gradient(135deg,#0a0a0a,#1a1a1a,#0d0d0d)', img:'img/njdl-preview.png' },
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

function initGridDistortion(canvas, project) {
  if (gdRaf) { cancelAnimationFrame(gdRaf); gdRaf = null; }
  if (gdCleanup) { gdCleanup(); gdCleanup = null; }

  const COLS = 32;
  const GAP  = 2;   // px gap between tiles
  const HOVER_R   = 170;
  const MAX_DISP  = 60;

  let W, H, tileW, tileH, ROWS;
  let scrollProg  = 0;
  let scrollTgt   = 0;
  let mX = -9999, mY = -9999;
  let tex = null;  // offscreen canvas used as texture

  function resize() {
    W = canvas.parentElement ? canvas.parentElement.offsetWidth : window.innerWidth;
    H = window.innerHeight;
    canvas.width  = W;
    canvas.height = H;
    tileW = W / COLS;
    tileH = tileW; // square tiles
    ROWS  = Math.ceil(H / tileH) + 1;
    // Rebuild texture at new size if needed
    if (project.img) {
      const im = new Image();
      im.onload = () => {
        const oc = document.createElement('canvas');
        oc.width = W; oc.height = H;
        const oc2 = oc.getContext('2d');
        // Cover-fit image
        const scale = Math.max(W / im.naturalWidth, H / im.naturalHeight);
        const sw = im.naturalWidth * scale, sh = im.naturalHeight * scale;
        oc2.drawImage(im, (W - sw) / 2, (H - sh) / 2, sw, sh);
        tex = oc;
      };
      im.src = project.img;
    } else {
      tex = gradToCanvas(project.grad, W, H);
    }
  }
  resize();

  // Wheel on detail view drives progress
  function onWheel(e) {
    e.preventDefault();
    scrollTgt = Math.max(0, Math.min(1, scrollTgt + e.deltaY * 0.0012));
  }
  function onMM(e) {
    const r = canvas.getBoundingClientRect();
    mX = e.clientX - r.left;
    mY = e.clientY - r.top;
  }
  function onML() { mX = -9999; mY = -9999; }

  detailView.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('mousemove', onMM);
  canvas.addEventListener('mouseleave', onML);

  const ctx = canvas.getContext('2d');

  function drawFrameClean() {
    gdRaf = requestAnimationFrame(drawFrameClean);
    scrollProg += (scrollTgt - scrollProg) * 0.07;
    ctx.clearRect(0, 0, W, H);
    if (!tex) return;

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const baseX = col * tileW;
        const baseY = row * tileH;

        // Wave delay by column distance from center
        const norm  = Math.abs(col - (COLS - 1) / 2) / ((COLS - 1) / 2);
        const delay = norm * 0.42;
        const local = Math.max(0, Math.min(1, (scrollProg - delay) / (1 - delay)));
        const ease  = 1 - Math.pow(1 - local, 3);
        const riseY = (1 - ease) * (H + tileH * 2);

        // Lens displacement
        const cx = baseX + tileW / 2, cy = baseY + tileH / 2;
        const dx = cx - mX, dy = cy - mY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let dispX = 0, dispY = 0;
        if (dist < HOVER_R && dist > 0) {
          const str = Math.pow(1 - dist / HOVER_R, 2);
          dispX = (dx / dist) * str * MAX_DISP;
          dispY = (dy / dist) * str * MAX_DISP;
        }

        // Final tile top-left in screen space
        const finalX = baseX + dispX;
        const finalY = baseY + dispY - riseY;
        const tW = tileW - GAP, tH = tileH - GAP;

        ctx.save();
        // Clip to grid cell slot
        ctx.beginPath();
        ctx.rect(baseX + GAP / 2, baseY + GAP / 2, tW, tH);
        ctx.clip();
        // Draw tile: source is fixed (baseX,baseY in texture), dest is displaced
        ctx.drawImage(
          tex,
          baseX, baseY, tileW, tileH,   // source slice matches grid position
          finalX, finalY, tileW, tileH  // destination at displaced location
        );
        ctx.restore();
      }
    }
  }

  // Cancel the first drawFrame and use clean version
  gdRaf = requestAnimationFrame(drawFrameClean);

  gdCleanup = () => {
    if (gdRaf) { cancelAnimationFrame(gdRaf); gdRaf = null; }
    detailView.removeEventListener('wheel', onWheel);
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
  document.body.dataset.page = 'projects-detail'; // no mask on detail
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
    <canvas class="proj-grid-canvas"></canvas>`;
  detailView.classList.add('is-visible');
  listView.classList.add('is-hidden');
  document.getElementById('proj-back').addEventListener('click', closeDetail);
  requestAnimationFrame(() => {
    const canvas = detailView.querySelector('.proj-grid-canvas');
    if (canvas) initGridDistortion(canvas, p);
  });
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
