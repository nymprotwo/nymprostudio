// ─────────────────────────────────────────────────────
// Playground — infinite 2D mosaic grid.
// One tile-unit (UW×UH) repeats seamlessly in all
// directions. Drag or use trackpad two-finger swipe.
// Images cycle with 8×8 block-dissolve shader.
// ─────────────────────────────────────────────────────

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass }     from 'three/addons/postprocessing/ShaderPass.js';
import { pauseLenis, resumeLenis } from './smooth-scroll.js?v=29';

// ── Grid config ───────────────────────────────────────
const UW       = 1200;  // repeating tile-unit width  (px)
const UH       = 900;   // repeating tile-unit height (px)
const GAP      = 40;    // gap between tiles (20px each side)

// On 1440px screen: camera sees 1440 world units = 1.2× tile unit = ~6 columns visible.
// On mobile (390px): ZOOM scales so you still see 6 columns.
const ZOOM = Math.max(1.0, 1440 / window.innerWidth);

// Image cycling
const CYCLE_MIN = 2;
const CYCLE_MAX = 8;

// Auto-scroll speed (world units/frame upward)
const AUTO_SCROLL = 0.35;


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
uniform float     tileAR;
uniform float     arA;
uniform float     arB;
uniform int       effectId;
varying vec2      vUv;

float rand(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }

vec2 coverUV(vec2 uv, float tile, float tex) {
  vec2 c = uv - 0.5;
  if (tile > tex) { c.y *= tex / tile; }
  else            { c.x *= tile / tex; }
  return c + 0.5;
}

float ss(float a, float b, float x){ return smoothstep(a, b, x); }

float neonFront(float raw) {
  float front = 1.0 - abs(raw - progress) * 8.0;
  return clamp(front, 0.0, 1.0);
}

void main(){
  vec3 accent = vec3(0.18, 0.58, 1.0);

  float hz  = 1.0 - hover * 0.045;
  vec2  huv = (vUv - 0.5) * hz + 0.5;

  vec4 colA = texture2D(texA, coverUV(huv, tileAR, arA));
  vec4 colB = texture2D(texB, coverUV(huv, tileAR, arB));

  float t    = 0.0;
  float neon = 0.0;
  float midFade = ss(0.05, 0.2, progress) * ss(0.05, 0.2, 1.0 - progress);

  if (effectId == 0) {
    vec2  bUv = floor(vUv*8.0)/8.0;
    float raw = rand(bUv);
    float ft  = clamp(progress*1.4 - raw*0.4, 0.0, 1.0);
    t    = ft*ft*(3.0-2.0*ft);
    neon = neonFront(raw) * midFade;
  } else if (effectId == 1) {
    vec2  bUv = floor(vUv*16.0)/16.0;
    float raw = rand(bUv);
    float ft  = clamp(progress*1.5 - raw*0.5, 0.0, 1.0);
    t    = ft*ft*(3.0-2.0*ft);
    neon = neonFront(raw) * midFade;
  } else if (effectId == 2) {
    float dist = length(vUv - 0.5) * 1.414;
    float noise = rand(floor(vUv*12.0)/12.0) * 0.3;
    float raw   = dist * 0.7 + noise;
    t    = ss(0.0, 1.0, clamp(progress*1.3 - raw, 0.0, 1.0));
    neon = neonFront(raw / 1.3) * midFade;
  } else if (effectId == 3) {
    float n      = rand(floor(vUv*vec2(1.0,20.0))/vec2(1.0,20.0)) * 0.08;
    float glitch = rand(vec2(floor(vUv.y*30.0), progress*50.0)) * 0.07;
    float raw    = vUv.x * 0.85 - n - glitch;
    t    = ss(0.0, 0.12, clamp(progress - raw, 0.0, 1.0));
    neon = (1.0 - abs((progress - raw) * 12.0)) * midFade;
    neon = clamp(neon, 0.0, 1.0);
  } else if (effectId == 4) {
    float diag = (vUv.x + vUv.y) * 0.5;
    float n    = rand(floor(vUv*10.0)/10.0) * 0.15;
    float raw  = (diag - n) / 1.3;
    t    = ss(0.0, 0.18, clamp(progress*1.3 - diag + n, 0.0, 1.0));
    neon = (1.0 - abs((progress - raw) * 10.0)) * midFade;
    neon = clamp(neon, 0.0, 1.0);
  } else if (effectId == 5) {
    vec2  bUv = floor(vUv*4.0)/4.0;
    float raw = rand(bUv + vec2(0.1, progress)) * 0.3 + rand(bUv) * 0.3;
    float ft  = clamp(progress*1.3 - raw, 0.0, 1.0);
    t    = ft*ft*(3.0-2.0*ft);
    neon = neonFront(raw / 1.3) * midFade;
  } else if (effectId == 6) {
    float line   = floor(vUv.y * 24.0) / 24.0;
    float n      = rand(vec2(line, floor(progress*40.0)));
    float strip  = rand(vec2(line, 0.5));
    float glitchX = (n-0.5)*0.08*(1.0-abs(progress-0.5)*2.0);
    vec2  sUv = vUv + vec2(glitchX, 0.0);
    colA = texture2D(texA, coverUV(sUv, tileAR, arA));
    colB = texture2D(texB, coverUV(sUv, tileAR, arB));
    float delay = strip * 0.5;
    t    = ss(delay, delay+0.5, progress);
    neon = (1.0 - abs(progress - (delay+0.25)) * 6.0) * midFade;
    neon = clamp(neon, 0.0, 1.0);
  } else {
    float dist = (1.0 - vUv.x);
    float n    = rand(floor(vUv*vec2(1.0,14.0))/vec2(1.0,14.0)) * 0.25;
    float raw  = dist * 0.7 - n;
    t    = ss(0.0, 0.2, clamp(progress*1.2 - raw, 0.0, 1.0));
    neon = (1.0 - abs((progress - raw / 1.2) * 10.0)) * midFade;
    neon = clamp(neon, 0.0, 1.0);
  }

  vec4 col = mix(colA, colB, clamp(t, 0.0, 1.0));

  col.rgb += accent * neon * 0.18;

  vec2 uvc = abs(vUv-0.5)*2.0;
  col.rgb *= 1.0 - pow(max(uvc.x,uvc.y),5.0)*0.25;

  float bd = max(abs(vUv.x-0.5), abs(vUv.y-0.5)) * 2.0;
  col.rgb += accent * ss(0.6, 0.98, bd) * hover * 0.35;
  col.rgb += accent * ss(0.965, 0.985, bd) * hover * 1.2;

  gl_FragColor = col;
}`;

// ── Post-process: barrel + chromatic aberration on scroll ──
const DistortShader = {
  uniforms: {
    tDiffuse: { value: null },
    distort:  { value: 0.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float     distort;
    varying vec2      vUv;
    void main(){
      vec2 uv = vUv * 2.0 - 1.0;
      float k  = distort * 0.18;
      float r2 = dot(uv, uv);
      uv *= 1.0 + k * r2;
      uv *= 1.0 + distort * 0.05;
      uv = (uv + 1.0) * 0.5;
      float ca   = distort * 0.008;
      vec2  dir  = vUv - 0.5;
      vec4  colR = texture2D(tDiffuse, uv + dir * ca);
      vec4  colG = texture2D(tDiffuse, uv);
      vec4  colB = texture2D(tDiffuse, uv - dir * ca);
      vec4 col;
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        col = vec4(0.024, 0.02, 0.035, 1.0);
      } else {
        col = vec4(colR.r, colG.g, colB.b, 1.0);
      }
      gl_FragColor = col;
    }`,
};

// ── State ─────────────────────────────────────────────
let renderer, scene, camera;
let composer = null;
let distortPass = null;

let textures   = [];
let baseTiles  = [];
let tileGroups = [];

let panX = UW/2, panY = UH/2;
let velX = 0, velY = 0;

let distortVal   = 1.0;
let distortSpd   = 0;
let scrollEnergy = 0;

let isDragging = false;
let prevMouse  = {x:0,y:0};
let prevTouch  = null;

let switchCount = 0;
let startTime   = 0;
let active      = false;
let rafId       = null;

let raycaster, mouseVec, hoveredMat = null;

let elCells, elElapsed, elSwitches, elCanvas, elDebug;

// ── Masonry column layout ─────────────────────────────
// STRONG size hierarchy: narrow(160) vs wide(360) = 2.25× width difference.
// Narrow cols: 4 small tiles (120px net). Wide cols: 3 big tiles (320px net).
// Pattern: narrow–WIDE–narrow–WIDE–narrow (160+360+160+360+160=1200) ✓
// Each column heights sum to UH=900 ✓
function buildLayout() {
  const G = GAP / 2; // 20
  const tiles = [];
  const t = (ox, oy, ow, oh) =>
    tiles.push({ x: ox + G, y: oy + G, w: ow - GAP, h: oh - GAP });

  // Col A — x=0, w=160 (narrow, net 120). SMALL. 4× heights=900 ✓
  t(  0,   0, 160, 200);  // portrait
  t(  0, 200, 160, 240);  // portrait
  t(  0, 440, 160, 220);  // portrait
  t(  0, 660, 160, 240);  // portrait

  // Col B — x=160, w=360 (wide, net 320). BIG. 3× heights=900 ✓
  t(160,   0, 360, 320);  // 320/280=1.14 landscape
  t(160, 320, 360, 280);  // 320/240=1.33 landscape
  t(160, 600, 360, 300);  // 320/260=1.23 landscape

  // Col C — x=520, w=160 (narrow, net 120). SMALL. 4× heights=900 ✓
  t(520,   0, 160, 240);  // portrait
  t(520, 240, 160, 200);  // portrait
  t(520, 440, 160, 260);  // portrait
  t(520, 700, 160, 200);  // portrait

  // Col D — x=680, w=360 (wide, net 320). BIG. 3× heights=900 ✓
  t(680,   0, 360, 290);  // 320/250=1.28 landscape
  t(680, 290, 360, 320);  // 320/280=1.14 landscape
  t(680, 610, 360, 290);  // 320/250=1.28 landscape

  // Col E — x=1040, w=160 (narrow, net 120). SMALL. 4× heights=900 ✓
  t(1040,   0, 160, 220);  // portrait
  t(1040, 220, 160, 240);  // portrait
  t(1040, 460, 160, 210);  // portrait
  t(1040, 670, 160, 230);  // portrait

  return tiles;
}

// ── Texture loading ───────────────────────────────────
function loadTextures() {
  const loader = new THREE.TextureLoader();
  return Promise.all(IMAGES.map(src => new Promise(res => {
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
function makePool(n) {
  const arr = Array.from({length: n}, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildScene() {
  baseTiles  = buildLayout();
  tileGroups = [];

  let poolA = makePool(textures.length);
  let poolB = makePool(textures.length);
  let curA  = 0, curB = 0;
  // Track last 6 assigned texA indices — skip repeats so neighbours never match
  const recentA = [];

  const nextA = () => {
    let attempts = 0;
    while (attempts < textures.length) {
      if (curA >= poolA.length) { poolA = makePool(textures.length); curA = 0; }
      const idx = poolA[curA];
      if (!recentA.includes(idx)) {
        curA++;
        recentA.push(idx);
        if (recentA.length > 6) recentA.shift();
        return idx;
      }
      curA++;
      attempts++;
    }
    if (curA >= poolA.length) { poolA = makePool(textures.length); curA = 0; }
    return poolA[curA++];
  };
  const nextB = () => {
    if (curB >= poolB.length) { poolB = makePool(textures.length); curB = 0; }
    return poolB[curB++];
  };

  baseTiles.forEach(tile => {
    let idxA = nextA();
    let idxB = nextB();
    if (idxB === idxA) idxB = (idxB + 1) % textures.length;

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
        effectId: { value: Math.floor(Math.random() * 8) },
      },
      vertexShader:   VERT,
      fragmentShader: FRAG,
      side: THREE.DoubleSide,
    });

    const geo = new THREE.PlaneGeometry(tile.w, tile.h);
    const cx = tile.x + tile.w/2;
    const cy = tile.y + tile.h/2;
    const tileZ = -tile.y * 0.0001;
    const copies = [];
    for (let iy = -1; iy <= 1; iy++) {
      for (let ix = -1; ix <= 1; ix++) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(cx + ix * UW, -(cy + iy * UH), tileZ);
        scene.add(mesh);
        copies.push(mesh);
      }
    }

    const ud = {
      mat,
      copies,
      idxA, idxB,
      cycleEvery:  CYCLE_MIN + Math.random()*(CYCLE_MAX-CYCLE_MIN),
      lastSwitch:  -Math.random() * CYCLE_MAX,
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

  panY += AUTO_SCROLL;
  panX += velX;
  panY += velY;
  const MAX_VEL = 25;
  velX = Math.max(-MAX_VEL, Math.min(MAX_VEL, velX));
  velY = Math.max(-MAX_VEL, Math.min(MAX_VEL, velY));
  velX *= 0.88;
  velY *= 0.88;

  const cx = ((panX % UW) + UW) % UW;
  const cy = ((panY % UH) + UH) % UH;
  camera.position.set(cx, -cy, 1);

  scrollEnergy *= 0.94;
  const zoomTarget = 1.0 - scrollEnergy * 0.20;
  distortSpd += (zoomTarget - distortVal) * 0.045;
  distortSpd *= 0.88;
  distortVal += distortSpd;
  distortVal  = Math.max(0.78, Math.min(1.0, distortVal));
  camera.zoom = distortVal;
  camera.updateProjectionMatrix();

  if (elElapsed) {
    const m = Math.floor(elapsed/60).toString().padStart(2,'0');
    const s = Math.floor(elapsed%60).toString().padStart(2,'0');
    elElapsed.textContent = `${m}:${s}`;
  }

  tileGroups.forEach(g => {
    const mat = g.mat;

    if (g.transitioning) {
      g.progress = Math.min(g.progress + 0.021, 1);
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
      g.lastSwitch    = elapsed;
      g.cycleEvery    = CYCLE_MIN + Math.random() * (CYCLE_MAX - CYCLE_MIN);
      g.transitioning = true;
      g.progress      = 0;
      mat.uniforms.effectId.value = Math.floor(Math.random() * 8);
      switchCount++;
      if (elSwitches) elSwitches.textContent = String(switchCount).padStart(3,'0');
    }

    const hovered = g.mat === hoveredMat;
    g.hoverVal += hovered ? 0.1 : -0.1;
    g.hoverVal  = Math.max(0, Math.min(1, g.hoverVal));
    mat.uniforms.hover.value = g.hoverVal;
  });

  if (composer) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
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
    const mag = Math.sqrt(dx*dx + dy*dy);
    scrollEnergy = Math.min(scrollEnergy + mag * 0.008, 1.0);
    return;
  }

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

function onWheel(e) {
  e.preventDefault();
  e.stopPropagation();

  const ax = Math.abs(e.deltaX);
  const ay = Math.abs(e.deltaY);

  let dx;
  if (ax < 2) {
    dx = 0;
  } else if (ax > ay * 1.5) {
    dx = -e.deltaX;
  } else {
    dx = e.deltaX;
  }

  velX -= dx * 0.28;
  velY += e.deltaY * 0.28;
  const mag = Math.sqrt(dx*dx + e.deltaY*e.deltaY);
  scrollEnergy = Math.min(scrollEnergy + mag * 0.012, 1.0);
}

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
  camera.left   = -W/2*ZOOM;  camera.right  = W/2*ZOOM;
  camera.top    =  H/2*ZOOM;  camera.bottom = -H/2*ZOOM;
  camera.updateProjectionMatrix();
  if (composer) composer.setSize(W, H);
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

  camera = new THREE.OrthographicCamera(-W/2*ZOOM, W/2*ZOOM, H/2*ZOOM, -H/2*ZOOM, 0.1, 100);
  camera.position.set(UW/2, -UH/2, 1);

  composer    = new EffectComposer(renderer);
  composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  distortPass = new ShaderPass(DistortShader);
  composer.addPass(distortPass);

  raycaster = new THREE.Raycaster();
  mouseVec  = new THREE.Vector2();

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
