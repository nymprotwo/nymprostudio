// ─────────────────────────────────────────────────────
// NYM / SHIFT — Hacker Racing Scene
// Wireframe F1 car + infinite binary-code road.
// Mouse X → camera lean + car lean. No controls needed.
// ─────────────────────────────────────────────────────

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass }     from 'three/addons/postprocessing/ShaderPass.js';
import { pauseLenis, resumeLenis } from './smooth-scroll.js?v=29';
import { registerExitHandler }    from './overlays.js?v=28';

// ── Config ─────────────────────────────────────────
const ACCENT   = 0x1E9FE2;
const CHAR_SET = '010011NYM</>#{}01SHIFT10\\|!';
const ROAD_W   = 7.2;
const SEG_N    = 22;      // barrier panels per side
const SEG_GAP  = 5.2;     // Z gap between panels
const PART_N   = 90;      // char particles
const SPEED    = 0.13;    // world units/frame

// ── Radial speed-blur shader ──────────────────────
const SpeedBlur = {
  uniforms: {
    tDiffuse: { value: null },
    speed:    { value: 0.0 },
    center:   { value: new THREE.Vector2(0.5, 0.46) },
  },
  vertexShader:
    `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float speed;
    uniform vec2  center;
    varying vec2  vUv;
    void main(){
      vec2 dir = vUv - center;
      vec4 col = vec4(0.);
      for(int i=0;i<14;i++){
        float t = float(i)/14.;
        col += texture2D(tDiffuse, vUv - dir*speed*t*0.24);
      }
      col /= 14.;
      float vig = 1.0 - length(dir)*speed*2.2;
      col.rgb *= max(0.12, vig);
      col.rgb += vec3(0.01, 0.05, 0.16)*speed*length(dir);
      gl_FragColor = col;
    }`,
};

// ── Module state ──────────────────────────────────
let renderer, scene, camera, composer, speedPass;
let carGroup;
let barrierL = [], barrierR = [], dashMeshes = [];
let sparks   = [];   // { sp, vx, vy, vz }
let charTexCache = {};

let mouseXT = 0, mouseXS = 0;
let shakePhase = 0;
let active = false, rafId = null;
let sceneReady = false;

// ── Helpers ───────────────────────────────────────
const rnd  = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;

// ── Char sprite textures ──────────────────────────
function getCharTex(ch) {
  if (charTexCache[ch]) return charTexCache[ch];
  const cv  = document.createElement('canvas');
  cv.width  = cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = `rgba(30,159,226,${rnd(0.55, 1.0).toFixed(2)})`;
  ctx.font      = 'bold 50px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, 32, 32);
  const t = new THREE.CanvasTexture(cv);
  charTexCache[ch] = t;
  return t;
}

// ── Car builder ───────────────────────────────────
function buildCar() {
  carGroup = new THREE.Group();

  const wire = new THREE.LineBasicMaterial({
    color: ACCENT,
    transparent: true,
    opacity: 0.88,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  // Dark fill gives the car volume — occlude objects behind
  const mkFill = () => new THREE.MeshBasicMaterial({
    color: 0x010305,
    transparent: true,
    opacity: 0.96,
    side: THREE.FrontSide,
    depthWrite: true,
  });

  // Box part: fill mesh + cyan wireframe edges
  const B = (w, h, d, x, y, z) => {
    const geo  = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mkFill());
    mesh.position.set(x, y, z);
    const eg   = new THREE.EdgesGeometry(geo);
    const ln   = new THREE.LineSegments(eg, wire.clone());
    ln.position.set(x, y, z);
    carGroup.add(mesh, ln);
  };

  // Cylinder part (wheels — rotated on Z)
  const C = (r, h, x, y, z, segs = 10) => {
    const geo  = new THREE.CylinderGeometry(r, r, h, segs);
    const mesh = new THREE.Mesh(geo, mkFill());
    mesh.position.set(x, y, z);
    mesh.rotation.z = Math.PI / 2;
    const eg   = new THREE.EdgesGeometry(geo);
    const ln   = new THREE.LineSegments(eg, wire.clone());
    ln.position.set(x, y, z);
    ln.rotation.z = Math.PI / 2;
    carGroup.add(mesh, ln);
  };

  // ── Body ──────────────────────────────────────
  B(1.10, 0.23, 4.20,    0,    0.115,   0    ); // spine
  B(0.36, 0.25, 2.10,  -0.61,  0.125,   0.18 ); // left sidepod
  B(0.36, 0.25, 2.10,   0.61,  0.125,   0.18 ); // right sidepod
  B(0.50, 0.34, 0.92,   0,     0.41,    0.22 ); // cockpit surround
  B(0.16, 0.12, 1.40,   0,     0.07,   -2.10 ); // nose cone

  // ── Front wing ────────────────────────────────
  B(1.80, 0.048, 0.28,  0,     0.048,  -2.60 ); // main plane
  B(0.05, 0.16,  0.36, -0.90,  0.08,   -2.60 ); // endplate L
  B(0.05, 0.16,  0.36,  0.90,  0.08,   -2.60 ); // endplate R

  // ── Rear wing ─────────────────────────────────
  B(1.42, 0.065, 0.25,  0,     1.08,    1.55 ); // top blade
  B(1.42, 0.050, 0.20,  0,     0.94,    1.50 ); // lower blade (DRS gap)
  B(0.05, 0.60,  0.36, -0.71,  0.77,    1.55 ); // endplate L
  B(0.05, 0.60,  0.36,  0.71,  0.77,    1.55 ); // endplate R
  B(0.065,0.55,  0.08, -0.44,  0.73,    1.55 ); // strut L
  B(0.065,0.55,  0.08,  0.44,  0.73,    1.55 ); // strut R

  // ── Diffuser ──────────────────────────────────
  B(0.78, 0.13, 0.42,   0,     0.045,   1.85 );

  // ── Wheels ────────────────────────────────────
  C(0.39, 0.35, -1.05, 0.39,  1.15); // rear L
  C(0.39, 0.35,  1.05, 0.39,  1.15); // rear R
  C(0.28, 0.27, -1.00, 0.28, -1.62); // front L (mostly hidden from behind)
  C(0.28, 0.27,  1.00, 0.28, -1.62); // front R

  carGroup.position.set(0, -0.28, 0.8);
  scene.add(carGroup);
}

// ── Code barrier panels ───────────────────────────
function makeCodeTex() {
  const W = 128, H = 512;
  const cv  = document.createElement('canvas');
  cv.width  = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.font = '13px monospace';
  const cols = 8, rows = 40;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch    = CHAR_SET[Math.floor(Math.random() * CHAR_SET.length)];
      const alpha = rnd(0.05, 0.80);
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = Math.random() > 0.12 ? '#1E9FE2' : '#c0eaff';
      ctx.fillText(ch, c * 16 + 4, r * 13 + 13);
    }
  }
  ctx.globalAlpha = 1;
  return new THREE.CanvasTexture(cv);
}

function buildBarriers() {
  const PW = 2.2, PH = 5.0;
  const mat = {
    transparent: true,
    opacity: 0.88,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  };
  const geo = new THREE.PlaneGeometry(PW, PH);

  for (let i = 0; i < SEG_N; i++) {
    const z = -i * SEG_GAP;

    const mL = new THREE.MeshBasicMaterial({ ...mat, map: makeCodeTex() });
    const mR = new THREE.MeshBasicMaterial({ ...mat, map: makeCodeTex() });

    const meshL = new THREE.Mesh(geo.clone(), mL);
    meshL.position.set(-ROAD_W / 2 - 0.9, PH / 2 - 0.4, z);
    meshL.rotation.y = 0.20;
    scene.add(meshL);
    barrierL.push(meshL);

    const meshR = new THREE.Mesh(geo.clone(), mR);
    meshR.position.set(ROAD_W / 2 + 0.9, PH / 2 - 0.4, z);
    meshR.rotation.y = -0.20;
    scene.add(meshR);
    barrierR.push(meshR);
  }
}

// ── Road dashes ───────────────────────────────────
function buildDashes() {
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.10,
  });
  const geo = new THREE.BoxGeometry(0.065, 0.003, 1.1);
  const n   = SEG_N + 4;
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geo, mat.clone());
    m.position.set(0, 0.001, -i * (SEG_GAP - 1.6));
    scene.add(m);
    dashMeshes.push(m);
  }
}

// ── Character particle sparks ─────────────────────
function resetSpark(p) {
  const z0 = rnd(-44, -6);
  const spread = (44 + z0) / 44; // 0 at near, 1 at far
  p.sp.position.set(
    rnd(-2.0, 2.0) * (1 - spread * 0.7),
    rnd(-0.4, 1.0) * (1 - spread * 0.5),
    z0,
  );
  p.vx = rnd(-0.020, 0.020);
  p.vy = rnd(-0.005, 0.012);
  p.vz = rnd(0.055, 0.17);
  p.sp.material.opacity = rnd(0.45, 0.95);
  const ch = CHAR_SET[Math.floor(Math.random() * CHAR_SET.length)];
  p.sp.material.map = getCharTex(ch);
  p.sp.material.needsUpdate = true;
  p.sp.scale.setScalar(rnd(0.06, 0.24));
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

// ── Scene setup ───────────────────────────────────
function buildScene() {
  const W = window.innerWidth, H = window.innerHeight;
  const canvas = document.getElementById('shift-canvas');

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(W, H);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030206);
  scene.fog = new THREE.FogExp2(0x030206, 0.018);

  camera = new THREE.PerspectiveCamera(56, W / H, 0.1, 180);
  camera.position.set(0, 2.2, 5.5);
  camera.lookAt(0, 0.4, -80);

  // Road floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROAD_W, 240),
    new THREE.MeshBasicMaterial({ color: 0x040307 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.005, -90);
  scene.add(floor);

  // Road edge lines
  const edgeMat = new THREE.LineBasicMaterial({
    color: ACCENT, transparent: true, opacity: 0.25,
    blending: THREE.AdditiveBlending,
  });
  [-ROAD_W / 2, ROAD_W / 2].forEach(x => {
    const pts = [new THREE.Vector3(x, 0, -180), new THREE.Vector3(x, 0, 8)];
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), edgeMat.clone()));
  });

  composer  = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  speedPass = new ShaderPass(SpeedBlur);
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
  scene = camera = composer = speedPass = carGroup = null;
  barrierL = []; barrierR = []; dashMeshes = []; sparks = [];
  charTexCache = {};
  sceneReady = false;
}

// ── Input ─────────────────────────────────────────
function onMouse(e) {
  mouseXT = (e.clientX / window.innerWidth) * 2 - 1;
}
function onResize() {
  if (!renderer) return;
  const W = window.innerWidth, H = window.innerHeight;
  renderer.setSize(W, H);
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  composer.setSize(W, H);
}

// ── Render loop ───────────────────────────────────
function animate() {
  rafId = requestAnimationFrame(animate);
  if (!active || !renderer) return;

  mouseXS = lerp(mouseXS, mouseXT, 0.055);
  shakePhase += 0.16;

  // Camera: lean + road shake
  const shX = Math.sin(shakePhase * 1.4) * 0.0035 + Math.sin(shakePhase * 2.3) * 0.0018;
  const shY = Math.cos(shakePhase * 0.8) * 0.0025;
  camera.position.x  = mouseXS * 0.38 + shX;
  camera.position.y  = 2.2 + shY;
  camera.rotation.z  = -mouseXS * 0.065;

  // Car: opposite lean
  if (carGroup) {
    carGroup.rotation.z = mouseXS * 0.042;
    carGroup.rotation.x = Math.sin(shakePhase * 0.65) * 0.007;
    carGroup.position.x = mouseXS * 0.10;
  }

  // Scroll barriers toward camera
  const totalL = SEG_N * SEG_GAP;
  barrierL.forEach(m => { m.position.z += SPEED; if (m.position.z > 7) m.position.z -= totalL; });
  barrierR.forEach(m => { m.position.z += SPEED; if (m.position.z > 7) m.position.z -= totalL; });

  // Scroll center dashes
  const dashTotal = (SEG_N + 4) * (SEG_GAP - 1.6);
  dashMeshes.forEach(m => { m.position.z += SPEED; if (m.position.z > 7) m.position.z -= dashTotal; });

  // Animate char sparks — fly from vanishing point toward camera, spread outward
  sparks.forEach(p => {
    const fwd  = Math.max(0, (p.sp.position.z + 44) / 44); // 0=far 1=near
    p.sp.position.x += p.vx * (1 + fwd * 4);
    p.sp.position.y += p.vy;
    p.sp.position.z += p.vz * (1 + fwd * 1.5);
    p.sp.material.opacity -= 0.0045;
    if (p.sp.position.z > 5 || p.sp.material.opacity <= 0) resetSpark(p);
  });

  // Speed blur always-on (driving feel)
  speedPass.uniforms.speed.value = 0.58;

  composer.render();
}

// ── Public API ────────────────────────────────────
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
