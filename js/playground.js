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
const UW       = 2000;  // repeating tile-unit width  (px)
const UH       = 1500;  // repeating tile-unit height (px)
const GAP      = 72;    // gap between tiles (36px each side)

// On 1440px screen: ZOOM=1, camera sees 1440 of 2000 world units (72%).
// Pattern repeat is much less obvious than with 1200 unit.
const ZOOM = Math.max(1.0, 1700 / window.innerWidth);

// Image cycling — big spread so tiles NEVER fire in sync
const CYCLE_MIN = 4;
const CYCLE_MAX = 18;

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
  } else if (effectId == 8) {
    // Vertical blinds
    float stripe = floor(vUv.x * 12.0) / 12.0;
    float delay  = rand(vec2(stripe, 0.3)) * 0.4;
    t    = ss(delay, delay + 0.6, progress);
    neon = (1.0 - abs(progress - (delay + 0.3)) * 7.0) * midFade;
    neon = clamp(neon, 0.0, 1.0);
  } else if (effectId == 9) {
    // Zoom dissolve
    float dist = length(vUv - 0.5);
    float n    = rand(floor(vUv * 8.0) / 8.0) * 0.2;
    float raw  = dist * 0.8 + n;
    t    = ss(0.0, 0.3, clamp(progress * 1.4 - raw, 0.0, 1.0));
    neon = neonFront(raw / 1.4) * midFade;
  } else if (effectId == 10) {
    // Scanline wipe down
    float n   = rand(vec2(floor(vUv.x * 20.0), 0.7)) * 0.08;
    float raw = vUv.y + n;
    t    = ss(0.0, 0.15, clamp(progress * 1.2 - raw, 0.0, 1.0));
    neon = (1.0 - abs((progress - raw / 1.2) * 9.0)) * midFade;
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

  col.rgb *= 0.88; // slight global matte darkening
  col.rgb += accent * neon * 0.18;

  // Strong vignette: dark tile edges are clearly visible against black background
  float vx = vUv.x * (1.0 - vUv.x) * 4.0;
  float vy = vUv.y * (1.0 - vUv.y) * 4.0;
  float vign = pow(min(vx, vy), 0.2);
  col.rgb *= mix(0.25, 1.0, vign);
  // Border: subtle cyan rim, fades out when tile is dark (dissolve to black hides it)
  float bd = max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)) * 2.0;
  float luma = dot(col.rgb, vec3(0.2126, 0.7152, 0.0722));
  float rimVis = smoothstep(0.0, 0.12, luma);
  col.rgb += accent * ss(0.90, 0.97, bd) * 0.07 * rimVis;
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
      // Inside-sphere: pincushion distortion, only active during scroll
      // At rest: distort=0 → k=0 → flat screen
      // On scroll: distort grows → screen bends inward like inside a ball
      float k  = -(distort * 0.40);
      float r2 = dot(uv, uv);
      uv *= 1.0 + k * r2;
      uv = (uv + 1.0) * 0.5;
      // Chromatic aberration (only on scroll)
      float ca   = distort * 0.007;
      vec2  dir  = vUv - 0.5;
      vec4  colR = texture2D(tDiffuse, uv + dir * ca);
      vec4  colG = texture2D(tDiffuse, uv);
      vec4  colB = texture2D(tDiffuse, uv - dir * ca);
      vec4 col;
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        col = vec4(0.051, 0.047, 0.071, 1.0);
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
let dismissing  = false;
let blackTex    = null;

let raycaster, mouseVec, hoveredMat = null;

let elCells, elElapsed, elSwitches, elCanvas, elDebug;

// ── Chaotic mosaic layout ─────────────────────────────
// UW=2000, UH=1500. 6 columns + 1 cinematic wide tile spanning cols 3+4.
// Col widths: 280+380+260+440+300+340 = 2000 ✓
// All adjacent column seams offset ≥120px → no full-width horizontal lines.
// 24 tiles total. Pattern repeat takes 2000px to complete → hard to spot.
function buildLayout() {
  const G = GAP / 2; // 30
  const tiles = [];
  const t = (ox, oy, ow, oh) =>
    tiles.push({ x: ox + G, y: oy + G, w: ow - GAP, h: oh - GAP });

  // Col 1 — x=0, w=280 (net 220). Seams: 360, 760, 1120.
  t(   0,    0, 280, 360);  // 220×300 = 0.73 portrait
  t(   0,  360, 280, 400);  // 220×340 = 0.65 portrait
  t(   0,  760, 280, 360);  // 220×300 = 0.73 portrait
  t(   0, 1120, 280, 380);  // 220×320 = 0.69 portrait

  // Col 2 — x=280, w=380 (net 320). Seams: 260, 620, 1020.
  // [260] vs Col1[360] = 100 ✓
  t( 280,    0, 380, 260);  // 320×200 = 1.60 landscape
  t( 280,  260, 380, 360);  // 320×300 = 1.07 square — BIG
  t( 280,  620, 380, 400);  // 320×340 = 0.94 square — BIG
  t( 280, 1020, 380, 480);  // 320×420 = 0.76 tall portrait

  // Col 3 top — x=660, w=260 (net 200). y=0→500.
  // [500] vs Col2[260]=240 ✓  [500] vs Col2[620]=120 ✓
  t( 660,    0, 260, 500);  // 200×440 = 0.45 tall portrait

  // ══ WIDE tile spanning Col3+4 — x=660, w=700 (net 640) ══
  // y=500→820, h=320. Cinematic 640×260 panorama. ★
  t( 660,  500, 700, 320);  // 640×260 = 2.46 ultra-wide ★

  // Col 3 bottom — x=660, w=260 (net 200). y=820→1500 = 680.
  t( 660,  820, 260, 400);  // 200×340 = 0.59 portrait
  t( 660, 1220, 260, 280);  // 200×220 = 0.91 squarish

  // Col 4 top — x=920, w=440 (net 380). y=0→500.
  t( 920,    0, 440, 500);  // 380×440 = 0.86 square-ish — BIG

  // Col 4 bottom — x=920, w=440 (net 380). y=820→1500 = 680.
  t( 920,  820, 440, 400);  // 380×340 = 1.12 landscape — BIG
  t( 920, 1220, 440, 280);  // 380×220 = 1.73 wide landscape

  // Col 5 — x=1360, w=300 (net 240). Seams: 400, 720, 1080.
  // [400] vs Col4[500]=100 ✓  [720] vs Col4[820]=100 ✓
  t(1360,    0, 300, 400);  // 240×340 = 0.71 portrait
  t(1360,  400, 300, 320);  // 240×260 = 0.92 squarish
  t(1360,  720, 300, 360);  // 240×300 = 0.80 portrait
  t(1360, 1080, 300, 420);  // 240×360 = 0.67 portrait

  // Col 6 — x=1660, w=340 (net 280). Seams: 280, 600, 940, 1260.
  // [280] vs Col5[400]=120 ✓  [600] vs Col5[720]=120 ✓
  t(1660,    0, 340, 280);  // 280×220 = 1.27 landscape
  t(1660,  280, 340, 320);  // 280×260 = 1.08 landscape
  t(1660,  600, 340, 340);  // 280×280 = 1.00 square
  t(1660,  940, 340, 320);  // 280×260 = 1.08 landscape
  t(1660, 1260, 340, 240);  // 280×180 = 1.56 landscape

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
        effectId: { value: Math.floor(Math.random() * 11) },
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
      lastSwitch:  -(Math.random() * 30), // spread over 30s so tiles never sync
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
  if (distortPass) distortPass.uniforms.distort.value = 1.0 - distortVal;
  camera.updateProjectionMatrix();

  if (elElapsed) {
    const m = Math.floor(elapsed/60).toString().padStart(2,'0');
    const s = Math.floor(elapsed%60).toString().padStart(2,'0');
    elElapsed.textContent = `${m}:${s}`;
  }

  tileGroups.forEach(g => {
    const mat = g.mat;

    if (g.transitioning) {
      // During dismiss: faster dissolve (0.04 vs 0.021)
      const spd = dismissing ? 0.04 : 0.021;
      g.progress = Math.min(g.progress + spd, 1);
      mat.uniforms.progress.value = g.progress;
      if (g.progress >= 1 && !dismissing) {
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
    } else if (!dismissing && elapsed - g.lastSwitch > g.cycleEvery) {
      g.lastSwitch    = elapsed;
      g.cycleEvery    = CYCLE_MIN + Math.random() * (CYCLE_MAX - CYCLE_MIN);
      g.transitioning = true;
      g.progress      = 0;
      mat.uniforms.effectId.value = Math.floor(Math.random() * 11);
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
  hoveredMat = null; // clear hover — dragging should never show highlight
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

  // Don't update hover while scrolling — avoids stale highlight revealing tiling seams
  if (scrollEnergy > 0.05) return;
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
  velX += e.deltaX * 0.20;
  velY += e.deltaY * 0.20;
  const mag = Math.sqrt(e.deltaX*e.deltaX + e.deltaY*e.deltaY);
  scrollEnergy = Math.min(scrollEnergy + mag * 0.01, 1.0);
  hoveredMat = null; // clear hover immediately on scroll — prevents stale highlight revealing tiling
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
  scene.background = new THREE.Color(0x0d0c12);

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

// Called when logo is clicked from playground — dissolve tiles to black, then close
export function dismissPlayground(onDone) {
  if (dismissing) return;
  dismissing = true;
  hoveredMat = null;

  // Lazy-create a 2×2 black texture
  if (!blackTex) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 2;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 2, 2);
    blackTex = new THREE.CanvasTexture(cv);
  }

  // Fire all tiles toward black simultaneously, staggered slightly so it looks like rain
  tileGroups.forEach((g, i) => {
    const delay = i * 18; // ms offset — cascades across tiles
    setTimeout(() => {
      g.mat.uniforms.texB.value  = blackTex;
      g.mat.uniforms.arB.value   = 1;
      g.mat.uniforms.effectId.value = 0; // 8×8 block dissolve
      g.mat.uniforms.progress.value = 0;
      g.transitioning = true;
      g.progress = 0;
    }, delay);
  });

  // After all tiles finish (~1s + stagger), close the playground
  const totalMs = tileGroups.length * 18 + 900;
  setTimeout(() => {
    hidePlayground();
    dismissing = false;
    if (onDone) onDone();
  }, totalMs);
}

// ── Pixel reveal overlay ──────────────────────────────
function playPgReveal() {
  const cv = document.getElementById('pg-reveal-canvas');
  if (!cv) return;
  const W = window.innerWidth, H = window.innerHeight;
  cv.width  = W;
  cv.height = H;
  const ctx = cv.getContext('2d');
  const PX = 18, COLS = Math.ceil(W / PX), ROWS = Math.ceil(H / PX);
  const N = COLS * ROWS;
  // Per-tile scatter noise (0..1) — determines reveal order
  const noise = new Float32Array(N);
  for (let i = 0; i < N; i++) noise[i] = Math.random();
  // Scatter: random per-tile but biased toward bottom-up reveal
  const revealN = new Float32Array(N);
  for (let r = 0; r < ROWS; r++) {
    const rowBias = (ROWS - r) / ROWS; // bottom rows reveal later
    for (let c = 0; c < COLS; c++) {
      const ci = r * COLS + c;
      revealN[ci] = Math.random() * 0.55 + rowBias * 0.45;
    }
  }
  // Normalise to 0..1
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < N; i++) { mn = Math.min(mn, revealN[i]); mx = Math.max(mx, revealN[i]); }
  for (let i = 0; i < N; i++) revealN[i] = (revealN[i] - mn) / (mx - mn);

  const DURATION = 1400; // ms total reveal
  const start = performance.now();

  function frame(now) {
    const t = Math.min(1, (now - start) / DURATION);
    // Ease in-out
    const prog = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    ctx.clearRect(0, 0, W, H);
    let anyLeft = false;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ci = r * COLS + c;
        const tileThresh = revealN[ci];
        if (prog < tileThresh) {
          // Tile still covering — draw dark pixel
          const edge = Math.max(0, (tileThresh - prog) / 0.12); // fade edges
          const alpha = Math.min(1, edge);
          ctx.fillStyle = `rgba(6,5,10,${alpha.toFixed(2)})`;
          ctx.fillRect(c * PX, r * PX, PX - 1, PX - 1);
          anyLeft = true;
        }
      }
    }
    if (anyLeft) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, W, H);
  }
  requestAnimationFrame(frame);
}

export function showPlayground() {
  const pg = document.getElementById('page-playground');
  if (!pg) return;
  pg.style.display = 'block';
  requestAnimationFrame(() => {
    pg.classList.add('is-visible');
    playPgReveal();
  });
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
