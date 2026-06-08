// ─────────────────────────────────────────────────────
// NYM / SWEEP — Full-screen minesweeper, hacker style
// Canvas 2D, responsive grid, ~16% mines
// ─────────────────────────────────────────────────────

import { pauseLenis, resumeLenis } from './smooth-scroll.js?v=29';
import { registerExitHandler }    from './overlays.js?v=28';

// ── Config ────────────────────────────────────────
const CELL   = 30;     // px per cell
const MINE_R = 0.155;  // mine ratio

// Number colours — neon palette
const NUM_COL = ['','#00d4ff','#00ff88','#ff4466','#bb88ff','#ff8822','#00ffdd','#ffffff','#888899'];

// ── State ─────────────────────────────────────────
let canvas, ctx;
let cols, rows, total, mineCount;
let cells  = [];       // flat array, row-major
let state  = 'idle';   // idle | playing | won | dead
let firstClick = true;
let revealed = 0;
let flagged  = 0;

let hoverIdx = -1;
let particles = [];    // explosion particles
let flashCells = [];   // {idx, t} reveal flash
let rafId = null;
let active = false;

// ── Cell helpers ───────────────────────────────────
const idx  = (c, r) => r * cols + c;
const col  = (i) => i % cols;
const row  = (i) => Math.floor(i / cols);
const cx   = (i) => col(i) * CELL + CELL / 2;
const cy   = (i) => row(i) * CELL + CELL / 2;

function neighbours(i) {
  const c = col(i), r = row(i), nb = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nc = c + dc, nr = r + dr;
      if (nc >= 0 && nc < cols && nr >= 0 && nr < rows)
        nb.push(idx(nc, nr));
    }
  return nb;
}

// ── Init game ──────────────────────────────────────
function newGame() {
  cols  = Math.max(10, Math.floor(canvas.width  / CELL));
  rows  = Math.max(8,  Math.floor(canvas.height / CELL));
  total = cols * rows;
  mineCount = Math.round(total * MINE_R);
  cells = Array.from({ length: total }, () => ({
    mine: false, revealed: false, flagged: false, number: 0,
  }));
  state      = 'playing';
  firstClick = true;
  revealed   = 0;
  flagged    = 0;
  particles  = [];
  flashCells = [];
  hoverIdx   = -1;
}

function placeMines(safeIdx) {
  // Safe zone: clicked cell + its neighbours
  const safe = new Set([safeIdx, ...neighbours(safeIdx)]);
  let placed = 0;
  while (placed < mineCount) {
    const i = Math.floor(Math.random() * total);
    if (!safe.has(i) && !cells[i].mine) {
      cells[i].mine = true;
      placed++;
    }
  }
  // Compute numbers
  for (let i = 0; i < total; i++) {
    if (cells[i].mine) continue;
    cells[i].number = neighbours(i).filter(n => cells[n].mine).length;
  }
}

// ── Flood reveal ───────────────────────────────────
function reveal(i) {
  if (i < 0 || i >= total) return;
  const c = cells[i];
  if (c.revealed || c.flagged) return;
  c.revealed = true;
  revealed++;
  flashCells.push({ idx: i, t: 1.0 });

  if (!c.mine && c.number === 0) {
    // BFS flood fill
    const q = [i];
    while (q.length) {
      const cur = q.shift();
      for (const nb of neighbours(cur)) {
        if (!cells[nb].revealed && !cells[nb].flagged && !cells[nb].mine) {
          cells[nb].revealed = true;
          revealed++;
          flashCells.push({ idx: nb, t: 1.0 });
          if (cells[nb].number === 0) q.push(nb);
        }
      }
    }
  }
}

function checkWin() {
  if (revealed + mineCount === total) {
    state = 'won';
    spawnWinParticles();
  }
}

// ── Particles ──────────────────────────────────────
function spawnExplosion(i) {
  for (let k = 0; k < 28; k++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 4;
    particles.push({
      x: cx(i), y: cy(i),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.0,
      decay: 0.018 + Math.random() * 0.022,
      size: 2 + Math.random() * 3,
      col: Math.random() > 0.5 ? '#ff2244' : '#ff8800',
    });
  }
}

function spawnWinParticles() {
  for (let k = 0; k < 80; k++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 3,
      vy: -2 - Math.random() * 4,
      life: 1.0,
      decay: 0.008 + Math.random() * 0.012,
      size: 3 + Math.random() * 4,
      col: Math.random() > 0.5 ? '#1E9FE2' : '#00ffdd',
    });
  }
}

// ── Draw ───────────────────────────────────────────
function draw() {
  const W = canvas.width, H = canvas.height;
  ctx.fillStyle = '#010205';
  ctx.fillRect(0, 0, W, H);

  // Update flash + particles
  flashCells = flashCells.filter(f => { f.t -= 0.06; return f.t > 0; });
  particles  = particles.filter(p => {
    p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life -= p.decay;
    return p.life > 0;
  });

  // ── Draw cells ─────────────────────────────────
  for (let i = 0; i < total; i++) {
    const c  = cells[i];
    const x  = col(i) * CELL;
    const y  = row(i) * CELL;
    const cl = CELL - 1;   // cell size minus gap

    const flash   = flashCells.find(f => f.idx === i);
    const isHover = i === hoverIdx && !c.revealed;

    if (c.revealed) {
      if (c.mine && state === 'dead') {
        // Exploded mine cell
        ctx.fillStyle = 'rgba(255,20,40,0.18)';
        ctx.fillRect(x, y, cl, cl);
        // × symbol
        ctx.strokeStyle = '#ff3355';
        ctx.lineWidth   = 2;
        ctx.shadowColor = '#ff3355';
        ctx.shadowBlur  = 8;
        ctx.beginPath();
        ctx.moveTo(x + 7, y + 7); ctx.lineTo(x + cl - 7, y + cl - 7);
        ctx.moveTo(x + cl - 7, y + 7); ctx.lineTo(x + 7, y + cl - 7);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        // Open cell — very dark
        ctx.fillStyle = flash ? `rgba(30,159,226,${flash.t * 0.2})` : 'rgba(0,0,0,0)';
        ctx.fillRect(x, y, cl, cl);

        if (c.number > 0) {
          const glow = NUM_COL[c.number];
          ctx.shadowColor = glow;
          ctx.shadowBlur  = 6;
          ctx.fillStyle   = glow;
          ctx.font        = `bold ${Math.round(CELL * 0.52)}px monospace`;
          ctx.textAlign   = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(c.number, x + CELL / 2, y + CELL / 2);
          ctx.shadowBlur  = 0;
        }
      }
    } else {
      // ── Closed cell — circuit-board style ──────
      const alpha = isHover ? 0.9 : 0.65;

      // Background
      ctx.fillStyle = isHover ? 'rgba(20,25,45,0.95)' : 'rgba(10,10,20,0.9)';
      ctx.fillRect(x, y, cl, cl);

      // Cyan border
      ctx.strokeStyle = `rgba(30,159,226,${alpha})`;
      ctx.lineWidth   = isHover ? 1.2 : 0.7;
      if (isHover) { ctx.shadowColor = '#1E9FE2'; ctx.shadowBlur = 8; }
      ctx.strokeRect(x + 0.5, y + 0.5, cl - 1, cl - 1);
      ctx.shadowBlur = 0;

      // Tech detail: tiny cross / corner marks
      const m = 4, l = 5;
      ctx.strokeStyle = `rgba(30,159,226,${alpha * 0.45})`;
      ctx.lineWidth   = 0.6;
      ctx.beginPath();
      // top-left corner mark
      ctx.moveTo(x + m, y + m + l); ctx.lineTo(x + m, y + m); ctx.lineTo(x + m + l, y + m);
      // bottom-right corner mark
      ctx.moveTo(x + cl - m, y + cl - m - l); ctx.lineTo(x + cl - m, y + cl - m); ctx.lineTo(x + cl - m - l, y + cl - m);
      ctx.stroke();

      // Flash overlay on reveal
      if (flash) {
        ctx.fillStyle = `rgba(30,159,226,${flash.t * 0.55})`;
        ctx.fillRect(x, y, cl, cl);
      }

      // Flag
      if (c.flagged) {
        ctx.fillStyle   = '#ff4466';
        ctx.shadowColor = '#ff4466';
        ctx.shadowBlur  = 10;
        ctx.font        = `${Math.round(CELL * 0.55)}px sans-serif`;
        ctx.textAlign   = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚑', x + CELL / 2, y + CELL / 2);
        ctx.shadowBlur = 0;
      }
    }

    // Show unflagged mines on death
    if (state === 'dead' && c.mine && !c.flagged && !c.revealed) {
      ctx.fillStyle = 'rgba(255,50,50,0.15)';
      ctx.fillRect(x, y, cl, cl);
      ctx.fillStyle   = '#ff3355';
      ctx.font        = `${Math.round(CELL * 0.5)}px monospace`;
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('◉', x + CELL / 2, y + CELL / 2);
    }
  }

  // ── Particles ────────────────────────────────────
  particles.forEach(p => {
    ctx.globalAlpha = p.life;
    ctx.fillStyle   = p.col;
    ctx.shadowColor = p.col;
    ctx.shadowBlur  = 6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  ctx.shadowBlur  = 0;

  // ── HUD: mine counter ─────────────────────────────
  const remaining = mineCount - flagged;
  ctx.fillStyle   = 'rgba(30,159,226,0.7)';
  ctx.font        = '11px monospace';
  ctx.textAlign   = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`◉ ${remaining}  ⚑ ${flagged}`, 10, 8);

  // ── Win / dead overlay ────────────────────────────
  if (state === 'won' || state === 'dead') {
    ctx.fillStyle = 'rgba(1,2,5,0.72)';
    ctx.fillRect(0, 0, W, H);

    const msg    = state === 'won' ? 'ACCESS GRANTED' : 'SYSTEM FAILURE';
    const sub    = state === 'won' ? 'Click to play again' : 'Click to restart';
    const colour = state === 'won' ? '#00ffdd' : '#ff2244';

    ctx.shadowColor = colour;
    ctx.shadowBlur  = 24;
    ctx.fillStyle   = colour;
    ctx.font        = 'bold 42px monospace';
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(msg, W / 2, H / 2 - 24);
    ctx.shadowBlur  = 0;
    ctx.fillStyle   = 'rgba(234,234,234,0.5)';
    ctx.font        = '14px monospace';
    ctx.fillText(sub, W / 2, H / 2 + 20);
  }
}

// ── Game loop ──────────────────────────────────────
function loop() {
  rafId = requestAnimationFrame(loop);
  if (!active) return;
  draw();
}

// ── Input ──────────────────────────────────────────
function cellAt(x, y) {
  const c = Math.floor(x / CELL);
  const r = Math.floor(y / CELL);
  if (c < 0 || c >= cols || r < 0 || r >= rows) return -1;
  return idx(c, r);
}

function onClick(e) {
  if (!active) return;
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const i = cellAt(e.clientX - rect.left, e.clientY - rect.top);

  if (state === 'won' || state === 'dead') { newGame(); return; }
  if (i < 0) return;

  const c = cells[i];
  if (c.flagged) return;

  if (firstClick) { firstClick = false; placeMines(i); }

  if (!c.revealed) {
    reveal(i);
    if (c.mine) {
      state = 'dead';
      spawnExplosion(i);
    } else {
      checkWin();
    }
  }
}

function onRightClick(e) {
  if (!active) return;
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const i = cellAt(e.clientX - rect.left, e.clientY - rect.top);
  if (i < 0 || state !== 'playing') return;
  const c = cells[i];
  if (c.revealed) return;
  c.flagged = !c.flagged;
  flagged += c.flagged ? 1 : -1;
}

function onMouseMove(e) {
  if (!active) return;
  const rect = canvas.getBoundingClientRect();
  hoverIdx = cellAt(e.clientX - rect.left, e.clientY - rect.top);
}

function onResize() {
  if (!canvas) return;
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  newGame();
}

// ── Public API ─────────────────────────────────────
export function initSweep() {
  registerExitHandler(hideSweep);
}

export function showSweep() {
  const pg = document.getElementById('page-sweep');
  if (!pg) return;
  pg.style.display = 'block';
  requestAnimationFrame(() => pg.classList.add('is-visible'));

  canvas = document.getElementById('sweep-canvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  newGame();
  active = true;

  canvas.addEventListener('click',       onClick);
  canvas.addEventListener('contextmenu', onRightClick);
  canvas.addEventListener('mousemove',   onMouseMove);
  window.addEventListener('resize',      onResize);

  if (!rafId) rafId = requestAnimationFrame(loop);
  pauseLenis();
  document.body.dataset.page = 'sweep';
}

export function hideSweep() {
  const pg = document.getElementById('page-sweep');
  if (!pg) return;
  pg.classList.remove('is-visible');
  setTimeout(() => { pg.style.display = 'none'; }, 500);
  active = false;
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  canvas?.removeEventListener('click',       onClick);
  canvas?.removeEventListener('contextmenu', onRightClick);
  canvas?.removeEventListener('mousemove',   onMouseMove);
  window.removeEventListener('resize',       onResize);
  if (document.body.dataset.page === 'sweep') delete document.body.dataset.page;
  resumeLenis();
}
