// ─────────────────────────────────────────────────────
// NYM / PROJECTS  v10
// • 6 real items, infinite drum scroll via transform
// • CSS :hover for bar (no sticking)
// • B&W thumbs → color+scale on hover
// ─────────────────────────────────────────────────────

import { pauseLenis, resumeLenis } from './smooth-scroll.js?v=29';
import { registerExitHandler }    from './overlays.js?v=28';

const PROJECTS = [
  { num:'01', title:'NYMPRO STUDIO',   year:'2026', tags:'IDENTITY / WEB',      grad:'linear-gradient(135deg,#0d1b2a,#1e3a5f,#0a2540)' },
  { num:'02', title:'MOTION SYSTEMS',  year:'2025', tags:'UI / FRONTEND',        grad:'linear-gradient(135deg,#1a0a2e,#4a1070,#1a0030)' },
  { num:'03', title:'BRAND IDENTITY',  year:'2025', tags:'BRANDING / STRATEGY',  grad:'linear-gradient(135deg,#0a1a0a,#0d4a1a,#003015)' },
  { num:'04', title:'DIGITAL PRODUCT', year:'2024', tags:'APP / DEVELOPMENT',    grad:'linear-gradient(135deg,#1a1200,#5a3a00,#2a1800)' },
  { num:'05', title:'CREATIVE TOOLS',  year:'2024', tags:'WEB / 3D',             grad:'linear-gradient(135deg,#1a0008,#5a0018,#2a0010)' },
  { num:'06', title:'VISUAL LANGUAGE', year:'2023', tags:'ART DIRECTION',        grad:'linear-gradient(135deg,#001a1a,#00585a,#002828)' },
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

// ── Pixel-tile reveal ─────────────────────────────────
const TILE = 20;
function initTileReveal(canvas, grad) {
  const W = canvas.offsetWidth  || 600;
  const H = canvas.offsetHeight || 380;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = document.createElement('canvas');
  img.width = W; img.height = H;
  const ic = img.getContext('2d');
  ic.fillStyle = grad; ic.fillRect(0,0,W,H);
  for (let y=0;y<H;y+=3){ic.fillStyle=`rgba(255,255,255,${.015+Math.random()*.03})`;ic.fillRect(0,y,W,1);}
  const tiles=[];
  for(let r=0;r*TILE<H;r++) for(let c=0;c*TILE<W;c++) tiles.push([c*TILE,r*TILE]);
  for(let i=tiles.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[tiles[i],tiles[j]]=[tiles[j],tiles[i]];}
  ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);
  let n=0; const BATCH=Math.max(3,Math.ceil(tiles.length/55));
  if(tileRaf){cancelAnimationFrame(tileRaf);tileRaf=null;}
  function step(){
    if(n>=tiles.length)return;
    const end=Math.min(n+BATCH,tiles.length);
    for(;n<end;n++){const[tx,ty]=tiles[n];const tw=Math.min(TILE-1,W-tx),th=Math.min(TILE-1,H-ty);ctx.drawImage(img,tx,ty,tw,th,tx,ty,tw,th);}
    tileRaf=requestAnimationFrame(step);
  }
  tileRaf=requestAnimationFrame(step);
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
    card.style.background = p.grad;
    // Each card gets a unique stack offset via CSS variable
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
  // Find the source item to match its position
  const srcEl = listEl?.querySelector(`.proj-item[data-idx="${idx}"]`);
  if (!srcEl) return;
  const rect = srcEl.getBoundingClientRect();
  portalEl.textContent = p.title;
  portalEl.style.top    = rect.top  + 'px';
  portalEl.style.left   = rect.left + 'px';
  portalEl.style.width  = rect.width + 'px';
  portalEl.style.height = rect.height + 'px';
  portalEl.classList.add('is-visible');
}
function hidePortal() {
  portalEl?.classList.remove('is-visible');
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
    </div>`;
  detailView.classList.add('is-visible');
  listView.classList.add('is-hidden');
  document.getElementById('proj-back').addEventListener('click', closeDetail);
  requestAnimationFrame(() => {
    detailView.querySelectorAll('.proj-tile-wrap').forEach((wrap, wi) => {
      const c = wrap.querySelector('.proj-tile-canvas');
      if (wi === 0) { initTileReveal(c, p.grad); }
      else {
        new IntersectionObserver(ent => {
          if (ent[0].isIntersecting && !c.dataset.done) { c.dataset.done='1'; initTileReveal(c, p.grad); }
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
  if (drumRaf) { cancelAnimationFrame(drumRaf); drumRaf = null; }
  if (tileRaf) { cancelAnimationFrame(tileRaf); tileRaf = null; }
  if (document.body.dataset.page === 'projects') delete document.body.dataset.page;
  hidePortal();
  resumeLenis();
}
