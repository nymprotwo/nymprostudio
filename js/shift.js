// ─────────────────────────────────────────────────────
// NYM / SHIFT — Hacker Racing  v5
// F1 wireframe bolide + scrolling code barriers.
// Mouse = gaze (like mask). Snappy + readable.
// ─────────────────────────────────────────────────────

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass }     from 'three/addons/postprocessing/ShaderPass.js';
import { pauseLenis, resumeLenis } from './smooth-scroll.js?v=29';
import { registerExitHandler }    from './overlays.js?v=28';

// ── Config ────────────────────────────────────────
const ACCENT    = 0x1E9FE2;
const CHAR_SET  = '01NYM</>{}#!SHIFT\\|[]10';
const ROAD_W    = 8.0;
const SEG_N     = 22;
const SEG_STEP  = 5.8;
const PART_N    = 90;
const SPEED     = 0.13;

// ── Minimal speed-blur ─────────────────────────────
const SpeedBlur = {
  uniforms: {
    tDiffuse: { value: null },
    speed:    { value: 0.0 },
    center:   { value: new THREE.Vector2(0.5, 0.45) },
  },
  vertexShader:
    `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float     speed;
    uniform vec2      center;
    varying vec2      vUv;
    void main(){
      vec2 dir = vUv - center;
      vec4 col = texture2D(tDiffuse, vUv);
      for(int i=1;i<8;i++){
        float t = float(i)/8.0;
        col += texture2D(tDiffuse, vUv - dir*speed*t*0.1);
      }
      col /= 8.0;
      gl_FragColor = col;
    }`,
};

// ── State ──────────────────────────────────────────
let renderer, scene, camera, composer, speedPass;
let carGroup;
let barrierL = [], barrierR = [];
let dashMeshes = [];
let sparks = [];
let charTexCache = {};

let mouseXT = 0, mouseXS = 0;
let mouseYT = 0, mouseYS = 0;
let tick = 0;
let active = false, rafId = null;
let sceneReady = false;

const rnd  = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;

// ── Char sprite textures (sharp, no blur) ──────────
function getCharTex(ch) {
  if (charTexCache[ch]) return charTexCache[ch];
  const cv  = document.createElement('canvas');
  cv.width  = cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = '#7de8ff';
  ctx.font = 'bold 54px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, 32, 32);
  const t = new THREE.CanvasTexture(cv);
  charTexCache[ch] = t;
  return t;
}

// ── Code wall texture — large, crisp, high contrast ─
function makeCodeTex(seed) {
  const W = 256, H = 512;
  const cv  = document.createElement('canvas');
  cv.width  = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  const FONT_SZ = 18;
  const COLS    = Math.floor(W / (FONT_SZ * 0.62));
  const ROWS    = Math.floor(H / FONT_SZ) + 1;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = CHAR_SET[Math.floor((seed * 31 + r * 7 + c * 13) % CHAR_SET.length)];
      // bright = first column or random highlight
      const bright = (r + c * 3 + seed) % 5 === 0;
      ctx.fillStyle = bright ? '#a0f0ff' : '#1E9FE2';
      ctx.globalAlpha = bright ? 1.0 : rnd(0.55, 0.95);
      ctx.font = `bold ${FONT_SZ}px monospace`;
      ctx.textAlign = 'left';
      ctx.fillText(ch, c * FONT_SZ * 0.62, (r + 1) * FONT_SZ);
    }
  }
  ctx.globalAlpha = 1;
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ── F1 Wireframe Car ──────────────────────────────
// Viewed from behind. Scale ×2 vs reference so it fills screen nicely.
function buildCar() {
  carGroup = new THREE.Group();

  // Two materials: dark occluding fill + bright cyan edge
  const mkFill = () => new THREE.MeshBasicMaterial({
    color: 0x010205,
    side: THREE.FrontSide,
    depthWrite: true,
  });
  const mkWire = () => new THREE.LineBasicMaterial({
    color: ACCENT,
    transparent: true,
    opacity: 1.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  // helper: add a box part at (x,y,z) with dimensions (w,h,d)
  const box = (w, h, d, x, y, z, ry = 0) => {
    const geo  = new THREE.BoxGeometry(w, h, d);
    const fill = new THREE.Mesh(geo, mkFill());
    fill.position.set(x, y, z);
    fill.rotation.y = ry;
    const edges = new THREE.EdgesGeometry(geo);
    const wire  = new THREE.LineSegments(edges, mkWire());
    wire.position.set(x, y, z);
    wire.rotation.y = ry;
    carGroup.add(fill, wire);
  };

  // helper: add a cylinder (wheel) — axis along X
  const cyl = (r, h, x, y, z) => {
    const geo  = new THREE.CylinderGeometry(r, r, h, 14);
    const fill = new THREE.Mesh(geo, mkFill());
    fill.position.set(x, y, z);
    fill.rotation.z = Math.PI / 2;
    const edges = new THREE.EdgesGeometry(geo);
    const wire  = new THREE.LineSegments(edges, mkWire());
    wire.position.set(x, y, z);
    wire.rotation.z = Math.PI / 2;
    carGroup.add(fill, wire);
  };

  // ── Body ──────────────────────────────────────
  // Main floor/underbody
  box(2.20, 0.14, 5.20,   0,    0.07,  0   );
  // Left & right pontoons (sidepods)
  box(0.52, 0.36, 2.80,  -0.90, 0.24,  0.20);
  box(0.52, 0.36, 2.80,   0.90, 0.24,  0.20);
  // Centre spine
  box(0.48, 0.28, 4.60,   0,    0.28,  0   );
  // Cockpit surround
  box(0.62, 0.46, 1.10,   0,    0.54,  0.30);
  // Halo
  box(0.70, 0.08, 0.06,   0,    0.88,  0.10);
  box(0.08, 0.42, 0.06,  -0.28, 0.67,  0.10);
  box(0.08, 0.42, 0.06,   0.28, 0.67,  0.10);
  // Nose cone
  box(0.22, 0.18, 2.00,   0,    0.09, -2.60);
  // ── Front wing ───────────────────────────────
  box(2.60, 0.06, 0.36,   0,    0.06, -3.10);
  box(2.30, 0.05, 0.26,   0,    0.14, -3.00);
  // Front wing endplates
  box(0.06, 0.26, 0.45,  -1.28, 0.13, -3.05);
  box(0.06, 0.26, 0.45,   1.28, 0.13, -3.05);
  // ── Rear wing ────────────────────────────────
  box(2.10, 0.08, 0.34,   0,    1.44,  1.90);
  box(1.90, 0.06, 0.26,   0,    1.28,  1.84);
  // Rear wing struts
  box(0.08, 0.82, 0.14,  -0.70, 0.98,  1.90);
  box(0.08, 0.82, 0.14,   0.70, 0.98,  1.90);
  // Rear wing endplates
  box(0.07, 0.90, 0.50,  -1.05, 1.00,  1.90);
  box(0.07, 0.90, 0.50,   1.05, 1.00,  1.90);
  // ── Diffuser ─────────────────────────────────
  box(1.10, 0.22, 0.56,   0,    0.11,  2.30);
  box(0.32, 0.26, 0.30,  -0.48, 0.13,  2.25);
  box(0.32, 0.26, 0.30,   0.48, 0.13,  2.25);

  // ── Wheels ───────────────────────────────────
  // Rear (bigger, dominant from behind)
  cyl(0.58, 0.42, -1.22, 0.58,  1.50);
  cyl(0.58, 0.42,  1.22, 0.58,  1.50);
  // Rear brake ducts
  box(0.14, 0.40, 0.36,  -0.86, 0.50,  1.50);
  box(0.14, 0.40, 0.36,   0.86, 0.50,  1.50);
  // Front (smaller, partially visible)
  cyl(0.40, 0.32, -1.08, 0.40, -1.80);
  cyl(0.40, 0.32,  1.08, 0.40, -1.80);

  // Position: center of road, slightly ahead of camera, on the ground
  carGroup.position.set(0, 0.0, 0.5);
  scene.add(carGroup);
}

// ── Barriers (irregular panels of code) ───────────
function buildBarriers() {
  for (let i = 0; i < SEG_N; i++) {
    const z = -i * SEG_STEP;
    const mk = (side) => {
      const pw = rnd(2.0, 3.5);
      const ph = rnd(3.5, 7.0);
      const tex = makeCodeTex(i * 7 + side * 31);
      // repeat texture so text stays at readable size
      tex.repeat.set(pw / 3.5, ph / 5.0);

      const geo = new THREE.PlaneGeometry(pw, ph);
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: rnd(0.75, 1.0),
        blending: THREE.NormalBlending,  // normal so text is sharp
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const m = new THREE.Mesh(geo, mat);

      const xBase = (ROAD_W / 2 + rnd(0.2, 1.2)) * side;
      const yOff  = rnd(-0.3, 1.4);
      const zOff  = rnd(-1.0, 1.0);
      m.position.set(xBase, ph / 2 + yOff, z + zOff);
      m.rotation.set(0, side * rnd(0.05, 0.35), rnd(-0.15, 0.15));
      scene.add(m);
      return m;
    };
    barrierL.push(mk(-1));
    barrierR.push(mk( 1));
  }
}

// ── Road centre dashes ─────────────────────────────
function buildDashes() {
  const mat = new THREE.MeshBasicMaterial({ color: 0x1E9FE2, transparent: true, opacity: 0.30 });
  const geo = new THREE.BoxGeometry(0.07, 0.002, 1.1);
  for (let i = 0; i < SEG_N + 6; i++) {
    const m = new THREE.Mesh(geo, mat.clone());
    m.position.set(0, 0.002, -i * 4.0);
    scene.add(m);
    dashMeshes.push(m);
  }
}

// ── Char particles (fly toward camera) ────────────
function resetSpark(p) {
  const z0 = rnd(-60, -10);
  p.sp.position.set(rnd(-1.2, 1.2), rnd(-0.1, 1.0), z0);
  p.vx = rnd(-0.018, 0.018);
  p.vy = rnd(-0.003, 0.010);
  p.vz = rnd(0.07, 0.22);
  p.sp.material.opacity = rnd(0.6, 1.0);
  const ch = CHAR_SET[Math.floor(Math.random() * CHAR_SET.length)];
  p.sp.material.map = getCharTex(ch);
  p.sp.material.needsUpdate = true;
  p.sp.scale.setScalar(rnd(0.10, 0.30));
}

function buildSparks() {
  for (let i = 0; i < PART_N; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getCharTex('0'),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    scene.add(sp);
    const p = { sp, vx: 0, vy: 0, vz: 0 };
    resetSpark(p);
    sparks.push(p);
  }
}

// ── Build everything ───────────────────────────────
function buildScene() {
  const W = window.innerWidth, H = window.innerHeight;
  const canvas = document.getElementById('shift-canvas');

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(W, H);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x010205);
  scene.fog = new THREE.Fog(0x010205, 80, 160);

  camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 220);
  // Position: behind and above the car, looking forward
  camera.position.set(0, 2.6, 6.5);

  // Road floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROAD_W, 320),
    new THREE.MeshBasicMaterial({ color: 0x010205 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.01, -120);
  scene.add(floor);

  // Road edge lines (glowing cyan)
  const edgeMat = new THREE.LineBasicMaterial({
    color: ACCENT, transparent: true, opacity: 0.45,
    blending: THREE.AdditiveBlending,
  });
  for (const x of [-ROAD_W / 2, ROAD_W / 2]) {
    const pts = [new THREE.Vector3(x, 0.01, -200), new THREE.Vector3(x, 0.01, 7)];
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), edgeMat.clone()));
  }

  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  speedPass = new ShaderPass(SpeedBlur);
  speedPass.uniforms.speed.value = 0.3;
  composer.addPass(speedPass);

  buildCar();
  buildBarriers();
  buildDashes();
  buildSparks();

  window.addEventListener('mousemove', onMouse);
  window.addEventListener('resize',    onResize);
  sceneReady = true;
}

function teardown() {
  window.removeEventListener('mousemove', onMouse);
  window.removeEventListener('resize',    onResize);
  if (renderer) { renderer.dispose(); renderer = null; }
  barrierL = []; barrierR = []; dashMeshes = []; sparks = [];
  charTexCache = {};
  sceneReady = false;
}

// ── Input ──────────────────────────────────────────
function onMouse(e) {
  mouseXT = (e.clientX / window.innerWidth) * 2 - 1;
  mouseYT = -((e.clientY / window.innerHeight) * 2 - 1);
}
function onResize() {
  if (!renderer) return;
  const W = window.innerWidth, H = window.innerHeight;
  renderer.setSize(W, H);
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  composer.setSize(W, H);
}

// ── Render loop ────────────────────────────────────
function animate() {
  rafId = requestAnimationFrame(animate);
  if (!active || !renderer) return;

  tick += 0.012;

  // Mouse — fast follow like mask (0.10 lerp factor)
  mouseXS = lerp(mouseXS, mouseXT, 0.10);
  mouseYS = lerp(mouseYS, mouseYT, 0.10);

  // Subtle road-bump shake
  const shX = Math.sin(tick * 1.7) * 0.004 + Math.sin(tick * 3.1) * 0.002;
  const shY = Math.cos(tick * 1.1) * 0.003;

  // Camera gaze: mouse moves the look-at point (like mask tracking)
  const lookX = mouseXS * 4.0 + shX * 6;
  const lookY = 0.6 + mouseYS * 0.5 + shY * 4;
  camera.position.set(shX * 0.5, 2.6 + shY, 6.5);
  camera.lookAt(lookX, lookY, -80);

  // Car leans into direction of gaze
  if (carGroup) {
    carGroup.rotation.z  = lerp(carGroup.rotation.z,  -mouseXS * 0.08, 0.12);
    carGroup.position.x  = lerp(carGroup.position.x,   mouseXS * 0.18, 0.10);
    carGroup.rotation.x  = Math.sin(tick * 0.9)  * 0.008;
    carGroup.position.y  = Math.sin(tick * 1.4)  * 0.025;
  }

  // Scroll barriers
  const bLoop = SEG_N * SEG_STEP;
  barrierL.forEach(m => { m.position.z += SPEED; if (m.position.z > 8) m.position.z -= bLoop; });
  barrierR.forEach(m => { m.position.z += SPEED; if (m.position.z > 8) m.position.z -= bLoop; });

  // Scroll dashes
  const dLoop = (SEG_N + 6) * 4.0;
  dashMeshes.forEach(m => { m.position.z += SPEED; if (m.position.z > 7) m.position.z -= dLoop; });

  // Char sparks spread as they approach camera
  sparks.forEach(p => {
    const fwd = Math.max(0, (p.sp.position.z + 60) / 60);
    p.sp.position.x += p.vx * (1 + fwd * 4);
    p.sp.position.y += p.vy;
    p.sp.position.z += p.vz * (1 + fwd * 0.8);
    p.sp.material.opacity -= 0.005;
    if (p.sp.position.z > 5.5 || p.sp.material.opacity <= 0) resetSpark(p);
  });

  composer.render();
}

// ── Public API ─────────────────────────────────────
export function initShift() {
  registerExitHandler(hideShift);
}

export function showShift() {
  const pg = document.getElementById('page-shift');
  if (!pg) return;
  pg.style.display = 'block';
  requestAnimationFrame(() => pg.classList.add('is-visible'));
  if (!sceneReady) buildScene();
  active = true;
  rafId  = requestAnimationFrame(animate);
  pauseLenis();
  document.body.dataset.page = 'shift';
}

export function hideShift() {
  const pg = document.getElementById('page-shift');
  if (!pg) return;
  pg.classList.remove('is-visible');
  setTimeout(() => { pg.style.display = 'none'; }, 500);
  active = false;
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  if (document.body.dataset.page === 'shift') delete document.body.dataset.page;
  resumeLenis();
}
