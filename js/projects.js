// ─────────────────────────────────────────────────────
// NYM / PROJECTS — yutaabe-style list + detail page  v1
// • Giant stacked names, hover = image through text
// • Click → detail: huge title + pixel-tile canvas reveal
// ─────────────────────────────────────────────────────

import { pauseLenis, resumeLenis } from './smooth-scroll.js?v=29';
import { registerExitHandler }    from './overlays.js?v=28';

// ── Project data ──────────────────────────────────────
// Replace `grad` with real image URLs when ready: img: '/assets/proj-01.jpg'
const PROJECTS = [
  {
    num: '01', title: 'NYMPRO STUDIO',
    year: '2026', tags: 'IDENTITY / WEB',
    grad: 'linear-gradient(135deg,#0d1b2a 0%,#1e3a5f 40%,#0a2540 100%)',
  },
  {
    num: '02', title: 'MOTION SYSTEMS',
    year: '2025', tags: 'UI / FRONTEND',
    grad: 'linear-gradient(135deg,#1a0a2e 0%,#4a1070 40%,#1a0030 100%)',
  },
  {
    num: '03', title: 'BRAND IDENTITY',
    year: '2025', tags: 'BRANDING / STRATEGY',
    grad: 'linear-gradient(135deg,#0a1a0a 0%,#0d4a1a 40%,#003015 100%)',
  },
  {
    num: '04', title: 'DIGITAL PRODUCT',
    year: '2024', tags: 'APP / DEVELOPMENT',
    grad: 'linear-gradient(135deg,#1a1200 0%,#5a3a00 40%,#2a1800 100%)',
  },
  {
    num: '05', title: 'CREATIVE TOOLS',
    year: '2024', tags: 'WEB / 3D',
    grad: 'linear-gradient(135deg,#1a0008 0%,#5a0018 40%,#2a0010 100%)',
  },
  {
    num: '06', title: 'VISUAL LANGUAGE',
    year: '2023', tags: 'ART DIRECTION',
    grad: 'linear-gradient(135deg,#001a1a 0%,#00585a 40%,#002828 100%)',
  },
];

// ── State ─────────────────────────────────────────────
let pg = null;           // #page-projects element
let listView = null;
let detailView = null;
let activeDetail = -1;   // index of open project
let tileRaf = null;

// ── Pixel tile reveal ─────────────────────────────────
const TILE_SIZE = 20;

function initTileReveal(canvas, grad) {
  const W = canvas.offsetWidth  || canvas.parentElement.offsetWidth;
  const H = canvas.offsetHeight || canvas.parentElement.offsetHeight;
  canvas.width  = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d');

  // Draw the gradient "image" into a helper canvas
  const imgCanvas = document.createElement('canvas');
  imgCanvas.width  = W;
  imgCanvas.height = H;
  const ic = imgCanvas.getContext('2d');
  const grd = ic.createLinearGradient(0, 0, W, H);
  // Parse the grad string's colours into a real gradient
  // (simple approach: just fill with gradient matching our data)
  ic.fillStyle = grad;
  ic.fillRect(0, 0, W, H);
  // Add some texture — lighter horizontal bands
  for (let y = 0; y < H; y += 4) {
    ic.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.04})`;
    ic.fillRect(0, y, W, 1);
  }

  // Build tile list
  const cols = Math.ceil(W / TILE_SIZE);
  const rows = Math.ceil(H / TILE_SIZE);
  let tiles = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tiles.push({ x: c * TILE_SIZE, y: r * TILE_SIZE });
    }
  }
  // Shuffle
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }

  // Initially: draw all tiles as black cover
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  let revealed = 0;
  const BATCH = Math.max(4, Math.floor(tiles.length / 60)); // ~60 frames to full reveal

  if (tileRaf) { cancelAnimationFrame(tileRaf); tileRaf = null; }

  function step() {
    if (revealed >= tiles.length) return;
    const end = Math.min(revealed + BATCH, tiles.length);
    for (let i = revealed; i < end; i++) {
      const t = tiles[i];
      const tw = Math.min(TILE_SIZE - 1, W - t.x); // 1px gap
      const th = Math.min(TILE_SIZE - 1, H - t.y);
      // Draw image tile
      ctx.drawImage(imgCanvas, t.x, t.y, tw, th, t.x, t.y, tw, th);
    }
    revealed = end;
    tileRaf = requestAnimationFrame(step);
  }
  tileRaf = requestAnimationFrame(step);
}

// ── Build list HTML ───────────────────────────────────
function buildList() {
  listView.innerHTML = '';

  // Right thumbnail column
  const thumbCol = document.createElement('div');
  thumbCol.className = 'proj-thumbs';
  PROJECTS.forEach((p, i) => {
    const t = document.createElement('div');
    t.className = 'proj-thumb';
    t.style.background = p.grad;
    t.dataset.idx = i;
    thumbCol.appendChild(t);
  });
  listView.appendChild(thumbCol);

  // Left list
  const list = document.createElement('ul');
  list.className = 'proj-list';

  PROJECTS.forEach((p, i) => {
    const li = document.createElement('li');
    li.className = 'proj-item';
    li.dataset.idx = i;
    li.innerHTML = `
      <span class="proj-num">${p.num}</span>
      <span class="proj-name" style="--pg:${p.grad}">${p.title}</span>
      <span class="proj-tags">${p.tags}</span>
    `;
    li.addEventListener('mouseenter', () => onItemHover(i));
    li.addEventListener('mouseleave', () => onItemLeave());
    li.addEventListener('click',      () => openDetail(i));
    list.appendChild(li);
  });
  listView.appendChild(list);
}

function onItemHover(i) {
  listView.querySelectorAll('.proj-item').forEach((el, j) => {
    el.classList.toggle('is-hovered',  j === i);
    el.classList.toggle('is-dimmed',   j !== i);
  });
  listView.querySelectorAll('.proj-thumb').forEach((el, j) => {
    el.classList.toggle('is-active', j === i);
  });
}
function onItemLeave() {
  listView.querySelectorAll('.proj-item').forEach(el => {
    el.classList.remove('is-hovered', 'is-dimmed');
  });
  listView.querySelectorAll('.proj-thumb').forEach(el => el.classList.remove('is-active'));
}

// ── Detail view ───────────────────────────────────────
function openDetail(i) {
  const p = PROJECTS[i];
  activeDetail = i;

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
      <div class="proj-tile-wrap">
        <canvas class="proj-tile-canvas"></canvas>
      </div>
      <div class="proj-tile-wrap">
        <canvas class="proj-tile-canvas"></canvas>
      </div>
    </div>
  `;

  detailView.classList.add('is-visible');
  listView.classList.add('is-hidden');

  document.getElementById('proj-back').addEventListener('click', closeDetail);

  // Init tile reveals after paint
  requestAnimationFrame(() => {
    const canvases = detailView.querySelectorAll('.proj-tile-canvas');
    canvases.forEach(c => initTileReveal(c, p.grad));
  });

  // Scroll inside detail triggers second canvas
  const content = detailView.querySelector('.proj-detail-content');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const c = e.target.querySelector('.proj-tile-canvas');
        if (c && !c.dataset.triggered) {
          c.dataset.triggered = '1';
          initTileReveal(c, p.grad);
        }
      }
    });
  }, { threshold: 0.1 });

  detailView.querySelectorAll('.proj-tile-wrap').forEach(w => observer.observe(w));
}

function closeDetail() {
  detailView.classList.remove('is-visible');
  listView.classList.remove('is-hidden');
  activeDetail = -1;
  if (tileRaf) { cancelAnimationFrame(tileRaf); tileRaf = null; }
}

// ── Public API ────────────────────────────────────────
export function initProjects() {
  pg       = document.getElementById('page-projects');
  listView = pg?.querySelector('.proj-list-view');
  detailView = pg?.querySelector('.proj-detail-view');
  if (!pg) return;
  buildList();
  registerExitHandler(hideProjects);
}

export function showProjects() {
  if (!pg) return;
  pg.style.display = 'block';
  requestAnimationFrame(() => pg.classList.add('is-visible'));
  if (activeDetail >= 0) closeDetail(); // reset on reopen
  pauseLenis();
  document.body.dataset.page = 'projects';
}

export function hideProjects() {
  if (!pg) return;
  pg.classList.remove('is-visible');
  setTimeout(() => { pg.style.display = 'none'; }, 500);
  if (activeDetail >= 0) closeDetail();
  if (document.body.dataset.page === 'projects') delete document.body.dataset.page;
  resumeLenis();
}
