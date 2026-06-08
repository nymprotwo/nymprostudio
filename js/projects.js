// ─────────────────────────────────────────────────────
// NYM / PROJECTS — yutaabe-style list + detail  v3
// • Infinite manual scroll (no auto-move)
// • Text left, fixed thumbs right (B&W → color on hover)
// • Thumbs aligned to viewport height, 1 per project
// ─────────────────────────────────────────────────────

import { pauseLenis, resumeLenis } from './smooth-scroll.js?v=29';
import { registerExitHandler }    from './overlays.js?v=28';

// ── Project data ──────────────────────────────────────
const PROJECTS = [
  { num: '01', title: 'NYMPRO STUDIO',   year: '2026', tags: 'IDENTITY / WEB',      grad: 'linear-gradient(135deg,#0d1b2a,#1e3a5f,#0a2540)' },
  { num: '02', title: 'MOTION SYSTEMS',  year: '2025', tags: 'UI / FRONTEND',        grad: 'linear-gradient(135deg,#1a0a2e,#4a1070,#1a0030)' },
  { num: '03', title: 'BRAND IDENTITY',  year: '2025', tags: 'BRANDING / STRATEGY',  grad: 'linear-gradient(135deg,#0a1a0a,#0d4a1a,#003015)' },
  { num: '04', title: 'DIGITAL PRODUCT', year: '2024', tags: 'APP / DEVELOPMENT',    grad: 'linear-gradient(135deg,#1a1200,#5a3a00,#2a1800)' },
  { num: '05', title: 'CREATIVE TOOLS',  year: '2024', tags: 'WEB / 3D',             grad: 'linear-gradient(135deg,#1a0008,#5a0018,#2a0010)' },
  { num: '06', title: 'VISUAL LANGUAGE', year: '2023', tags: 'ART DIRECTION',        grad: 'linear-gradient(135deg,#001a1a,#00585a,#002828)' },
];

const N = PROJECTS.length;

// ── State ─────────────────────────────────────────────
let pg         = null;
let listView   = null;
let detailView = null;
let scrollEl   = null;   // the scrollable div (left)
let thumbEls   = [];     // one thumb per project (right, fixed)
let loopH      = 0;      // height of one full copy
let tileRaf    = null;
let hoveredIdx = -1;
let indThumb   = null;   // left indicator thumb element
let indNum     = null;   // left indicator number element

// ── Pixel-tile reveal ─────────────────────────────────
const TILE = 20;

function initTileReveal(canvas, grad) {
  const W = canvas.offsetWidth  || 600;
  const H = canvas.offsetHeight || 380;
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const img = document.createElement('canvas');
  img.width = W; img.height = H;
  const ic = img.getContext('2d');
  ic.fillStyle = grad;
  ic.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 3) {
    ic.fillStyle = `rgba(255,255,255,${0.015 + Math.random() * 0.03})`;
    ic.fillRect(0, y, W, 1);
  }

  const tiles = [];
  for (let r = 0; r * TILE < H; r++)
    for (let c = 0; c * TILE < W; c++)
      tiles.push([c * TILE, r * TILE]);
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }

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
      ctx.drawImage(img, tx, ty, Math.min(TILE-1,W-tx), Math.min(TILE-1,H-ty),
                              tx, ty, Math.min(TILE-1,W-tx), Math.min(TILE-1,H-ty));
    }
    tileRaf = requestAnimationFrame(step);
  }
  tileRaf = requestAnimationFrame(step);
}

// ── Build list ────────────────────────────────────────
function buildList() {
  listView.innerHTML = '';

  // ── LEFT: scrollable list ──
  scrollEl = document.createElement('div');
  scrollEl.className = 'proj-scroll';

  const ul = document.createElement('ul');
  ul.className = 'proj-list';

  // 3 copies for seamless loop
  for (let copy = 0; copy < 3; copy++) {
    PROJECTS.forEach((p, i) => {
      const li = document.createElement('li');
      li.className = 'proj-item';
      li.dataset.idx = i;
      li.innerHTML = `<span class="proj-num">${p.num}</span><span class="proj-name">${p.title}</span>`;
      li.addEventListener('mouseenter', () => onHover(i));
      li.addEventListener('mouseleave', onLeave);
      li.addEventListener('click',      () => openDetail(i));
      ul.appendChild(li);
    });
  }

  scrollEl.appendChild(ul);
  listView.appendChild(scrollEl);

  // ── LEFT: scroll indicator ──
  const ind = document.createElement('div');
  ind.className = 'proj-indicator';
  ind.innerHTML = `
    <div class="proj-indicator__track">
      <div class="proj-indicator__thumb" id="proj-ind-thumb"></div>
    </div>
    <span class="proj-indicator__num" id="proj-ind-num">01</span>
  `;
  listView.appendChild(ind);
  indThumb = ind.querySelector('#proj-ind-thumb');
  indNum   = ind.querySelector('#proj-ind-num');

  // ── RIGHT: fixed thumbnail column ──
  const thumbCol = document.createElement('div');
  thumbCol.className = 'proj-thumbs';
  thumbEls = [];

  PROJECTS.forEach((p, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'proj-thumb-wrap';

    const inner = document.createElement('div');
    inner.className = 'proj-thumb';
    inner.style.background = p.grad;
    inner.dataset.idx = i;

    wrap.appendChild(inner);
    thumbCol.appendChild(wrap);
    thumbEls.push(inner);
  });

  listView.appendChild(thumbCol);

  // ── Scroll setup after paint ──
  requestAnimationFrame(() => requestAnimationFrame(() => {
    loopH = scrollEl.scrollHeight / 3;
    scrollEl.scrollTop = loopH; // start at middle copy
    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    updateByScroll();
  }));
}

// ── Scroll → loop + active thumb ─────────────────────
function onScroll() {
  const st = scrollEl.scrollTop;
  if (st >= loopH * 2) scrollEl.scrollTop = st - loopH;
  else if (st <= 0)    scrollEl.scrollTop = st + loopH;

  // Only update active thumb if no item is hovered
  if (hoveredIdx < 0) updateByScroll();
}

// Find which project item is closest to vertical center of the scroll container
function updateByScroll() {
  if (!scrollEl) return;
  const items = scrollEl.querySelectorAll('.proj-item');
  const cRect = scrollEl.getBoundingClientRect();
  const centerY = cRect.top + cRect.height / 2;
  let best = 0, bestD = Infinity;
  items.forEach(el => {
    const r = el.getBoundingClientRect();
    const d = Math.abs(r.top + r.height / 2 - centerY);
    if (d < bestD) { bestD = d; best = parseInt(el.dataset.idx); }
  });
  setActiveThumb(best, false);
}

function setActiveThumb(idx, colored) {
  thumbEls.forEach((t, i) => {
    t.classList.toggle('is-active',  i === idx);
    t.classList.toggle('is-colored', colored && i === idx);
  });
  // Move left indicator
  if (indThumb && indNum) {
    const track = indThumb.parentElement;
    const trackH = track.offsetHeight;
    const pos = (idx / (N - 1)) * (trackH - 28); // 28 = thumb height
    indThumb.style.top = pos + 'px';
    indNum.textContent = PROJECTS[idx].num;
  }
}

// ── Hover ─────────────────────────────────────────────
function onHover(idx) {
  hoveredIdx = idx;
  scrollEl?.querySelectorAll('.proj-item').forEach(el => {
    const match = parseInt(el.dataset.idx) === idx;
    el.classList.toggle('is-hovered', match);
    el.classList.toggle('is-dimmed',  !match);
  });
  // Thumb: highlight + show color
  thumbEls.forEach((t, i) => {
    t.classList.toggle('is-active',  i === idx);
    t.classList.toggle('is-colored', i === idx);
  });
}

function onLeave() {
  hoveredIdx = -1;
  scrollEl?.querySelectorAll('.proj-item').forEach(el => {
    el.classList.remove('is-hovered', 'is-dimmed');
  });
  // Remove color, revert to scroll-based active
  thumbEls.forEach(t => t.classList.remove('is-colored'));
  updateByScroll();
}

// ── Detail view ───────────────────────────────────────
function openDetail(i) {
  const p = PROJECTS[i];
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
        new IntersectionObserver(entries => {
          if (entries[0].isIntersecting && !c.dataset.done) {
            c.dataset.done = '1';
            initTileReveal(c, p.grad);
          }
        }, { threshold: 0.15 }).observe(wrap);
      }
    });
  });
}

function closeDetail() {
  detailView.classList.remove('is-visible');
  listView.classList.remove('is-hidden');
  if (tileRaf) { cancelAnimationFrame(tileRaf); tileRaf = null; }
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
  pg.classList.remove('is-visible');
  setTimeout(() => { pg.style.display = 'none'; }, 500);
  if (tileRaf) { cancelAnimationFrame(tileRaf); tileRaf = null; }
  if (document.body.dataset.page === 'projects') delete document.body.dataset.page;
  resumeLenis();
}
