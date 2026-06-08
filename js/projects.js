// ─────────────────────────────────────────────────────
// NYM / PROJECTS — yutaabe-style list + detail  v2
// • Infinite scroll list (seamless loop)
// • Text left, thumbs right
// • White-only color: hover = bright, rest = dimmed
// • Click → detail with pixel-tile canvas reveal
// ─────────────────────────────────────────────────────

import { pauseLenis, resumeLenis } from './smooth-scroll.js?v=29';
import { registerExitHandler }    from './overlays.js?v=28';

// ── Project data ──────────────────────────────────────
const PROJECTS = [
  { num: '01', title: 'NYMPRO STUDIO',   year: '2026', tags: 'IDENTITY / WEB',      grad: 'linear-gradient(135deg,#0d1b2a,#1e3a5f,#0a2540)' },
  { num: '02', title: 'MOTION SYSTEMS',  year: '2025', tags: 'UI / FRONTEND',        grad: 'linear-gradient(135deg,#1a0a2e,#4a1070,#1a0030)' },
  { num: '03', title: 'BRAND IDENTITY',  year: '2025', tags: 'BRANDING / STRATEGY', grad: 'linear-gradient(135deg,#0a1a0a,#0d4a1a,#003015)' },
  { num: '04', title: 'DIGITAL PRODUCT', year: '2024', tags: 'APP / DEVELOPMENT',   grad: 'linear-gradient(135deg,#1a1200,#5a3a00,#2a1800)' },
  { num: '05', title: 'CREATIVE TOOLS',  year: '2024', tags: 'WEB / 3D',             grad: 'linear-gradient(135deg,#1a0008,#5a0018,#2a0010)' },
  { num: '06', title: 'VISUAL LANGUAGE', year: '2023', tags: 'ART DIRECTION',        grad: 'linear-gradient(135deg,#001a1a,#00585a,#002828)' },
];

// ── State ─────────────────────────────────────────────
let pg        = null;
let listView  = null;
let detailView= null;
let scrollEl  = null;   // the scrollable list container
let listEl    = null;   // the <ul> with items
let thumbs    = [];     // thumb divs (one per project)
let loopH     = 0;      // height of one full set of items
let rafLoop   = null;
let tileRaf   = null;
let scrollRaf = null;
let isOpen    = false;

// ── Pixel-tile reveal ─────────────────────────────────
const TILE = 20;

function initTileReveal(canvas, grad) {
  const W = canvas.offsetWidth  || 600;
  const H = canvas.offsetHeight || 380;
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Off-screen "image" canvas filled with the project gradient
  const img = document.createElement('canvas');
  img.width = W; img.height = H;
  const ic  = img.getContext('2d');
  ic.fillStyle = grad;
  ic.fillRect(0, 0, W, H);
  // subtle scan-line texture
  for (let y = 0; y < H; y += 3) {
    ic.fillStyle = `rgba(255,255,255,${0.015 + Math.random() * 0.03})`;
    ic.fillRect(0, y, W, 1);
  }

  // Build shuffled tile list
  const tiles = [];
  for (let r = 0; r * TILE < H; r++) {
    for (let c = 0; c * TILE < W; c++) {
      tiles.push([c * TILE, r * TILE]);
    }
  }
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }

  // Cover everything black
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  let n = 0;
  const BATCH = Math.max(3, Math.ceil(tiles.length / 55));

  if (tileRaf) { cancelAnimationFrame(tileRaf); tileRaf = null; }
  function step() {
    if (n >= tiles.length) return;
    const end = Math.min(n + BATCH, tiles.length);
    for (; n < end; n++) {
      const [tx, ty] = tiles[n];
      const tw = Math.min(TILE - 1, W - tx);
      const th = Math.min(TILE - 1, H - ty);
      ctx.drawImage(img, tx, ty, tw, th, tx, ty, tw, th);
    }
    tileRaf = requestAnimationFrame(step);
  }
  tileRaf = requestAnimationFrame(step);
}

// ── Build list ────────────────────────────────────────
function buildList() {
  listView.innerHTML = '';

  // ── Scrollable area (left side) ──
  scrollEl = document.createElement('div');
  scrollEl.className = 'proj-scroll';

  listEl = document.createElement('ul');
  listEl.className = 'proj-list';

  // Render 3 copies for infinite loop
  for (let copy = 0; copy < 3; copy++) {
    PROJECTS.forEach((p, i) => {
      const li = document.createElement('li');
      li.className = 'proj-item';
      li.dataset.idx = i;
      li.innerHTML = `
        <span class="proj-num">${p.num}</span>
        <span class="proj-name">${p.title}</span>
      `;
      li.addEventListener('mouseenter', () => onHover(i));
      li.addEventListener('mouseleave', onLeave);
      li.addEventListener('click',      () => openDetail(i));
      listEl.appendChild(li);
    });
  }

  scrollEl.appendChild(listEl);
  listView.appendChild(scrollEl);

  // ── Thumbnails (right side) ──
  const thumbCol = document.createElement('div');
  thumbCol.className = 'proj-thumbs';
  thumbs = [];
  PROJECTS.forEach((p, i) => {
    const t = document.createElement('div');
    t.className = 'proj-thumb';
    t.style.background = p.grad;
    thumbs.push(t);
    thumbCol.appendChild(t);
  });
  listView.appendChild(thumbCol);

  // Infinite scroll setup after paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const itemH = listEl.scrollHeight / 3;
      loopH = itemH;
      // Start at the middle copy
      scrollEl.scrollTop = loopH;
      scrollEl.addEventListener('scroll', onScroll, { passive: true });
      // Auto-scroll ticker
      startAutoScroll();
      // Set initial active thumb
      updateActiveThumbnail();
    });
  });
}

// ── Auto-scroll (slow, continuous) ───────────────────
let autoScrollPos = 0;
let autoScrollSpeed = 0.6; // px/frame

function startAutoScroll() {
  if (rafLoop) cancelAnimationFrame(rafLoop);
  function tick() {
    if (!isOpen) return;
    autoScrollPos += autoScrollSpeed;
    scrollEl.scrollTop += autoScrollSpeed;
    checkLoop();
    rafLoop = requestAnimationFrame(tick);
  }
  rafLoop = requestAnimationFrame(tick);
}

function checkLoop() {
  if (!scrollEl || !loopH) return;
  const st = scrollEl.scrollTop;
  if (st >= loopH * 2) {
    scrollEl.scrollTop = st - loopH;
  } else if (st < 1) {
    scrollEl.scrollTop = st + loopH;
  }
}

function onScroll() {
  checkLoop();
  updateActiveThumbnail();
}

// Find which project is closest to viewport center
function updateActiveThumbnail() {
  if (!listEl) return;
  const items = listEl.querySelectorAll('.proj-item');
  const containerRect = scrollEl.getBoundingClientRect();
  const centerY = containerRect.top + containerRect.height / 2;
  let closest = 0, closestDist = Infinity;
  items.forEach((el, i) => {
    const r = el.getBoundingClientRect();
    const mid = r.top + r.height / 2;
    const dist = Math.abs(mid - centerY);
    if (dist < closestDist) { closestDist = dist; closest = i; }
  });
  const idx = closest % PROJECTS.length;
  thumbs.forEach((t, i) => t.classList.toggle('is-active', i === idx));
}

// ── Hover ─────────────────────────────────────────────
function onHover(idx) {
  listEl?.querySelectorAll('.proj-item').forEach(el => {
    const match = parseInt(el.dataset.idx) === idx;
    el.classList.toggle('is-hovered', match);
    el.classList.toggle('is-dimmed',  !match);
  });
  thumbs.forEach((t, i) => t.classList.toggle('is-active', i === idx));
}
function onLeave() {
  listEl?.querySelectorAll('.proj-item').forEach(el => {
    el.classList.remove('is-hovered', 'is-dimmed');
  });
  updateActiveThumbnail();
}

// ── Detail view ───────────────────────────────────────
function openDetail(i) {
  const p = PROJECTS[i];
  if (rafLoop) { cancelAnimationFrame(rafLoop); rafLoop = null; }

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
    <div class="proj-detail-content">
      <div class="proj-tile-wrap"><canvas class="proj-tile-canvas"></canvas></div>
      <div class="proj-tile-wrap"><canvas class="proj-tile-canvas"></canvas></div>
    </div>
  `;

  detailView.classList.add('is-visible');
  listView.classList.add('is-hidden');

  document.getElementById('proj-back').addEventListener('click', closeDetail);

  requestAnimationFrame(() => {
    detailView.querySelectorAll('.proj-tile-wrap').forEach((wrap, wi) => {
      const c = wrap.querySelector('.proj-tile-canvas');
      if (wi === 0) {
        initTileReveal(c, p.grad);
      } else {
        // Second canvas triggers on scroll-into-view
        const obs = new IntersectionObserver(entries => {
          if (entries[0].isIntersecting && !c.dataset.done) {
            c.dataset.done = '1';
            initTileReveal(c, p.grad);
          }
        }, { threshold: 0.15 });
        obs.observe(wrap);
      }
    });
  });
}

function closeDetail() {
  detailView.classList.remove('is-visible');
  listView.classList.remove('is-hidden');
  if (tileRaf) { cancelAnimationFrame(tileRaf); tileRaf = null; }
  startAutoScroll();
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
  isOpen = true;
  pg.style.display = 'block';
  requestAnimationFrame(() => pg.classList.add('is-visible'));
  pauseLenis();
  document.body.dataset.page = 'projects';
  startAutoScroll();
}

export function hideProjects() {
  if (!pg) return;
  isOpen = false;
  pg.classList.remove('is-visible');
  setTimeout(() => { pg.style.display = 'none'; }, 500);
  if (rafLoop) { cancelAnimationFrame(rafLoop); rafLoop = null; }
  if (tileRaf) { cancelAnimationFrame(tileRaf); tileRaf = null; }
  if (document.body.dataset.page === 'projects') delete document.body.dataset.page;
  resumeLenis();
}
