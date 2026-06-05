// ─────────────────────────────────────────────────────
// Playground — infinite 2D mosaic grid.
// One tile-unit (UW×UH) repeats seamlessly in all
// directions. Drag or use trackpad two-finger swipe.
// Images cycle with 8×8 block-dissolve shader.
// ─────────────────────────────────────────────────────

import * as THREE from 'three';
import { pauseLenis, resumeLenis } from './smooth-scroll.js?v=29';

// ── Grid config ───────────────────────────────────────
const UW       = 2400;  // repeating tile-unit width  (px)
const UH       = 1800;  // repeating tile-unit height (px)
const N_COLS     = 6;   // regular columns; 3 feature cols (each 2×) → 12 units = 200px/unit
const GAP        = 57;  // gap between tiles (px)  (+10%)
const MIN_TH     = 130; // min tile height (px)
const MAX_TH     = 420; // max tile height (px)
// Feature columns spread evenly at positions 1, 4, 7 among 9 total cols
const WIDE_COL_A = 1;   // mostly large   (35% split)
const WIDE_COL_B = 4;   // balanced chaos (55% split)
const WIDE_COL_C = 7;   // mostly 2-small (75% split)

// Image cycling
const CYCLE_MIN = 3;
const CYCLE_MAX = 9;

const IMAGES = [
  './assets/playground/b3.webp',
  './assets/playground/bird.webp',
  './assets/playground/cat.webp',
  './assets/playground/nikq.webp',
  './assets/playground/cafe.webp',
  './assets/playground/flower.webp',
  './assets/playground/fox.webp',
  './assets/playground/frac.webp',
  './assets/playground/yokocats.webp',
  './assets/playground/house.webp',
  './assets/playground/lamachan.webp',
  './assets/playground/rabbit.webp',
  './assets/playground/room.webp',
  './assets/playground/chara1.webp',
  './assets/playground/lamachan2.webp',
  './assets/playground/kikyu.webp',
  './assets/playground/kuruma.webp',
];

// ── Shaders ───────────────────────────────────────────
const VERT = `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
}`;

const FRAG = `
uniform sampler2D texA;
uniform sampler2D texB;
uniform float     progress;
uniform float     hover;
uniform float     tileAR;   // tile width / height
uniform float     arA;      // texA width / height
uniform float     arB;      // texB width / height
varying vec2      vUv;

float rand(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }

// object-fit: cover — fills tile, crops overflow, no stretching
// tile > tex  →  tile is wider  →  fit width, crop height  →  shrink y range
// tile < tex  →  tile is taller →  fit height, crop width  →  shrink x range
vec2 coverUV(vec2 uv, float tile, float tex) {
  vec2 c = uv - 0.5;
  if (tile > tex) { c.y *= tex / tile; }
  else            { c.x *= tile / tex; }
  return c + 0.5;
}

void main(){
  vec2  bUv = floor(vUv*8.0)/8.0;
  float n   = rand(bUv);
  float t   = clamp((progress*1.4 - n*0.4)/1.0, 0.0, 1.0);
  t = t*t*(3.0-2.0*t);

  vec4 colA = texture2D(texA, coverUV(vUv, tileAR, arA));
  vec4 colB = texture2D(texB, coverUV(vUv, tileAR, arB));
  vec4 col  = mix(colA, colB, t);

  // soft edge (gap illusion)
  vec2 uvc  = abs(vUv-0.5)*2.0;
  col.rgb  *= 1.0 - pow(max(uvc.x,uvc.y),5.0)*0.25;

  col.rgb  += hover*0.18;
  gl_FragColor = col;
}`;

// ── State ─────────────────────────────────────────────
let renderer, scene, camera;
let textures   = [];
let baseTiles  = [];   // {x,y,w,h} layout
let tileGroups = [];   // per base-tile: {mat, copies[9 meshes], userData}

let panX = UW/2, panY = UH/2;  // camera target (unbounded)
let velX = 0, velY = 0;

let isDragging = false;
let prevMouse  = {x:0,y:0};
let prevTouch  = null;

let switchCount = 0;
let startTime   = 0;
let active      = false;
let rafId       = null;

let raycaster, mouseVec, hoveredMat = null;

let elCells, elElapsed, elSwitches, elCanvas, elDebug;

// ── Layout generator ──────────────────────────────────
// 6 regular cols + 3 feature cols (each 2×) = 12 unit-widths → 200px/unit.
// Positions: reg(0), A(1), reg(2), reg(3), B(4), reg(5), reg(6), C(7), reg(8)
function buildLayout() {
  const unitW     = UW / (N_COLS + 6); // 6 + 3×2 = 12 units → 200px
  const featW     = unitW * 2;          // feature = 400px
  const totalCols = N_COLS + 3;         // 6 + 3 = 9 columns

  const SPLIT_P = { [WIDE_COL_A]: 0.35, [WIDE_COL_B]: 0.55, [WIDE_COL_C]: 0.75 };

  const cols = [];
  let x = 0;
  for (let c = 0; c < totalCols; c++) {
    const feat = SPLIT_P[c] !== undefined;
    const w    = feat ? featW : unitW;
    cols.push({ x, w, splitP: SPLIT_P[c] ?? 0 });
    x += w;
  }

  const tiles = [];
  for (const col of cols) {
    // Random vertical offset per column — creates organic stagger effect
    let y = Math.random() * MAX_TH * 0.6;
    while (y < UH - GAP) {
      const h = Math.min(MIN_TH + Math.random() * (MAX_TH - MIN_TH), UH - y);

      if (col.splitP > 0 && Math.random() < col.splitP) {
        const subW = (col.w - GAP * 1.5) / 2;
        tiles.push({ x: col.x + GAP/2,                 y: y + GAP/2, w: subW, h: h - GAP });
        tiles.push({ x: col.x + GAP/2 + subW + GAP/2,  y: y + GAP/2, w: subW, h: h - GAP });
      } else {
        tiles.push({ x: col.x + GAP/2, y: y + GAP/2, w: col.w - GAP, h: h - GAP });
      }
      y += h;
    }
  }
  return tiles;
}

// ── Texture loading ───────────────────────────────────
function loadTextures() {
  const loader = new THREE.TextureLoader();
  return Promise.all(IMAGES.map(src => new Promise(res => {
    // Read natural dimensions first via a plain Image — guaranteed correct
    const probe = new Image();
    probe.onload = () => {
      const ar = probe.naturalWidth / probe.naturalHeight || 1;
      loader.load(src, t => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
        t.userData.ar = ar;
        res(t);
      }, null, () => res(null));
    };
    probe.onerror = () => {
      loader.load(src, t => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.userData.ar = 1;
        res(t);
      }, null, () => res(null));
    };
    probe.src = src;
  }))).then(txs => { textures = txs.filter(Boolean); });
}

// ── Scene build ───────────────────────────────────────
function buildScene() {
  baseTiles  = buildLayout();
  tileGroups = [];

  let imgCursor = Math.floor(Math.random() * textures.length);

  baseTiles.forEach(tile => {
    const idxA = imgCursor % textures.length;
    const idxB = (idxA + 3 + Math.floor(Math.random()*(textures.length-3))) % textures.length;
    imgCursor++;

    const tA = textures[idxA], tB = textures[idxB];
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        texA:     { value: tA },
        texB:     { value: tB },
        progress: { value: 0 },
        hover:    { value: 0 },
        tileAR:   { value: tile.w / tile.h },
        arA:      { value: tA.userData.ar || 1 },
        arB:      { value: tB.userData.ar || 1 },
      },
      vertexShader:   VERT,
      fragmentShader: FRAG,
      side: THREE.DoubleSide,
    });

    const geo = new THREE.PlaneGeometry(tile.w, tile.h);

    // Tile center in grid coordinates (y axis flipped for Three.js)
    const cx = tile.x + tile.w/2;
    const cy = tile.y + tile.h/2;

    // Create 3×3 copies at offsets (ix*UW, iy*UH), ix/iy ∈ {-1,0,1}
    const copies = [];
    for (let iy = -1; iy <= 1; iy++) {
      for (let ix = -1; ix <= 1; ix++) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(cx + ix * UW, -(cy + iy * UH), 0);
        scene.add(mesh);
        copies.push(mesh);
      }
    }

    const ud = {
      mat,
      copies,
      idxA, idxB,
      cycleEvery:  CYCLE_MIN + Math.random()*(CYCLE_MAX-CYCLE_MIN),
      lastSwitch:  Math.random()*CYCLE_MAX,
      transitioning: false,
      progress:    0,
      hoverVal:    0,
    };
    tileGroups.push(ud);
  });

  if (elCells) elCells.textContent = String(baseTiles.length).padStart(3,'0');
}

// ── Render loop ───────────────────────────────────────
function animate(ts) {
  rafId = requestAnimationFrame(animate);
  if (!active || !renderer) return;

  const elapsed = (ts - startTime) / 1000;

  // Apply inertia
  panX += velX;
  panY += velY;
  velX *= 0.94;
  velY *= 0.94;

  // Wrap camera position so it stays within [0, UW) × [0, UH)
  // (seamless because tiles repeat every UW/UH)
  const cx = ((panX % UW) + UW) % UW;
  const cy = ((panY % UH) + UH) % UH;
  camera.position.set(cx, -cy, 1);

  // Elapsed display
  if (elElapsed) {
    const m = Math.floor(elapsed/60).toString().padStart(2,'0');
    const s = Math.floor(elapsed%60).toString().padStart(2,'0');
    elElapsed.textContent = `${m}:${s}`;
  }

  // Tile cycling + hover
  tileGroups.forEach(g => {
    const mat = g.mat;

    if (g.transitioning) {
      g.progress = Math.min(g.progress + 0.016, 1);
      mat.uniforms.progress.value = g.progress;
      if (g.progress >= 1) {
        g.transitioning = false;
        g.progress = 0;
        g.idxA = g.idxB;
        g.idxB = (g.idxA + 1 + Math.floor(Math.random()*(textures.length-1))) % textures.length;
        const tA = textures[g.idxA], tB = textures[g.idxB];
        mat.uniforms.texA.value     = tA;
        mat.uniforms.texB.value     = tB;
        mat.uniforms.arA.value      = tA.userData.ar || 1;
        mat.uniforms.arB.value      = tB.userData.ar || 1;
        mat.uniforms.progress.value = 0;
      }
    } else if (elapsed - g.lastSwitch > g.cycleEvery) {
      g.lastSwitch   = elapsed;
      g.transitioning = true;
      g.progress     = 0;
      switchCount++;
      if (elSwitches) elSwitches.textContent = String(switchCount).padStart(3,'0');
    }

    // Hover glow
    const hovered = g.mat === hoveredMat;
    g.hoverVal += hovered ? 0.1 : -0.1;
    g.hoverVal  = Math.max(0, Math.min(1, g.hoverVal));
    mat.uniforms.hover.value = g.hoverVal;
  });

  renderer.render(scene, camera);
}

// ── Input ─────────────────────────────────────────────
function onPointerDown(e) {
  isDragging = true;
  prevMouse  = { x: e.clientX, y: e.clientY };
  velX = velY = 0;
  elCanvas.style.cursor = 'grabbing';
}

function onPointerMove(e) {
  if (isDragging) {
    const dx = e.clientX - prevMouse.x;
    const dy = e.clientY - prevMouse.y;
    velX = -dx * 0.25;
    velY =  dy * 0.25;
    panX += velX;
    panY += velY;
    prevMouse = { x: e.clientX, y: e.clientY };
    return;
  }

  // Hover raycasting
  mouseVec.x =  (e.clientX / window.innerWidth)  * 2 - 1;
  mouseVec.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouseVec, camera);
  const hits = raycaster.intersectObjects(
    tileGroups.flatMap(g => g.copies)
  );
  hoveredMat = hits.length ? hits[0].object.material : null;
  elCanvas.style.cursor = hoveredMat ? 'pointer' : 'grab';
}

function onPointerUp() {
  isDragging = false;
  elCanvas.style.cursor = hoveredMat ? 'pointer' : 'grab';
}

// Trackpad: two-finger swipe fires wheel events.
// Apply directly to pan (no velocity accumulation) — the OS/browser
// already applies momentum deceleration to the delta stream.
function onWheel(e) {
  e.preventDefault();
  e.stopPropagation();

  const ax = Math.abs(e.deltaX);
  const ay = Math.abs(e.deltaY);

  // macOS natural scroll inverts deltaX ONLY for pure-horizontal gestures.
  // For diagonal / vertical events the sign is standard (left = negative).
  // Detect pure-horizontal when |dX| clearly dominates, then un-invert it.
  let dx;
  if (ax < 2) {
    dx = 0;                    // noise during vertical scroll — ignore
  } else if (ax > ay * 1.5) {
    dx = -e.deltaX;            // pure horizontal: natural scroll gave us flipped sign
  } else {
    dx = e.deltaX;             // diagonal: standard sign
  }

  panX -= dx * 0.5;
  panY += e.deltaY * 0.5;
}

// Touch (mobile)
function onTouchStart(e) {
  if (e.touches.length === 1) {
    prevTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    velX = velY = 0;
  }
}
function onTouchMove(e) {
  if (e.touches.length !== 1 || !prevTouch) return;
  e.preventDefault();
  const dx = e.touches[0].clientX - prevTouch.x;
  const dy = e.touches[0].clientY - prevTouch.y;
  velX = -dx * 0.9;
  velY =  dy * 0.9;
  panX += velX;
  panY += velY;
  prevTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}
function onTouchEnd() { prevTouch = null; }

function onResize() {
  if (!renderer || !camera) return;
  const W = window.innerWidth, H = window.innerHeight;
  renderer.setSize(W, H);
  camera.left   = -W/2;  camera.right  = W/2;
  camera.top    =  H/2;  camera.bottom = -H/2;
  camera.updateProjectionMatrix();
}

// ── Public API ────────────────────────────────────────
export function initPlayground() {
  elCanvas   = document.getElementById('playground-canvas');
  elCells    = document.querySelector('[data-pg-cells]');
  elElapsed  = document.querySelector('[data-pg-elapsed]');
  elSwitches = document.querySelector('[data-pg-switches]');
  elDebug    = document.querySelector('[data-pg-debug]');
  if (!elCanvas) return;

  const W = window.innerWidth, H = window.innerHeight;

  renderer = new THREE.WebGLRenderer({ canvas: elCanvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(W, H);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060509);

  // Orthographic camera: 1 world unit = 1 CSS pixel
  camera = new THREE.OrthographicCamera(-W/2, W/2, H/2, -H/2, 0.1, 100);
  camera.position.set(UW/2, -UH/2, 1);

  raycaster = new THREE.Raycaster();
  mouseVec  = new THREE.Vector2();

  // ── Events ──
  elCanvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove',   onPointerMove);
  window.addEventListener('pointerup',     onPointerUp);
  elCanvas.addEventListener('wheel',       onWheel, { passive: false, capture: true });
  elCanvas.addEventListener('touchstart',  onTouchStart, { passive: true });
  elCanvas.addEventListener('touchmove',   onTouchMove,  { passive: false });
  elCanvas.addEventListener('touchend',    onTouchEnd,   { passive: true });
  window.addEventListener('resize',        onResize);

  loadTextures().then(() => {
    buildScene();
    // Start camera at grid center
    panX = UW/2;
    panY = UH/2;
    startTime = performance.now();
    active    = true;
    rafId     = requestAnimationFrame(animate);
  });
}

export function showPlayground() {
  const pg = document.getElementById('page-playground');
  if (!pg) return;
  pg.style.display = 'block';
  requestAnimationFrame(() => pg.classList.add('is-visible'));
  document.body.dataset.page = 'playground';
  active = true;
  pauseLenis();
}

export function hidePlayground() {
  const pg = document.getElementById('page-playground');
  if (!pg) return;
  pg.classList.remove('is-visible');
  setTimeout(() => {
    pg.style.display = 'none';
    document.body.dataset.page = 'home';
  }, 500);
  active = false;
  resumeLenis();
}
