// ─────────────────────────────────────────────────────
// NYM / SHIFT — Hacker Racing Scene  v3
// Wireframe F1 + binary-code road. Mouse = gaze direction.
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
const ROAD_W   = 7.0;
const SEG_N    = 20;
const SEG_GAP  = 5.5;
const PART_N   = 100;
const SPEED    = 0.14;

// ── Radial speed-blur ─────────────────────────────
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
      for(int i=0;i<12;i++){
        float t = float(i)/12.;
        col += texture2D(tDiffuse, vUv - dir*speed*t*0.18);
      }
      col /= 12.;
      // subtle cyan vignette at edges only
      float edgeDist = length(dir);
      float vig = 1.0 - edgeDist * speed * 1.2;
      col.rgb *= max(0.55, vig);
      col.rgb += vec3(0.01, 0.04, 0.12) * speed * edgeDist * 0.6;
      gl_FragColor = col;
    }`,
};

// ── State ─────────────────────────────────────────
let renderer, scene, camera, composer, speedPass;
let carGroup;
let barrierL = [], barrierR = [], dashMeshes = [];
let sparks   = [];
let charTexCache = {};

let mouseXT = 0, mouseXS = 0;
let mouseYT = 0, mouseYS = 0;
let shakePhase = 0;
let active = false, rafId = null;
let sceneReady = false;

const rnd  = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;

// ── Char textures ─────────────────────────────────
function getCharTex(ch) {
  if (charTexCache[ch]) return charTexCache[ch];
  const cv  = document.createElement('canvas');
  cv.width  = cv.height = 64;
  const ctx = cv.getContext('2d');
  // bright cyan glow
  ctx.shadowColor = '#1E9FE2';
  ctx.shadowBlur  = 14;
  ctx.fillStyle   = '#a0e8ff';
  ctx.font        = 'bold 50px monospace';
  ctx.textAlign   = 'center';
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
    opacity: 1.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mkFill = () => new THREE.MeshBasicMaterial({
    color: 0x000205,
    transparent: false,
    side: THREE.FrontSide,
    depthWrite: true,
  });

  const B = (w, h, d, x, y, z) => {
    const geo  = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mkFill());
    mesh.position.set(x, y, z);
    const eg = new THREE.EdgesGeometry(geo);
    const ln = new THREE.LineSegments(eg, wire.clone());
    ln.position.set(x, y, z);
    carGroup.add(mesh, ln);
  };
  const C = (r, h, x, y, z) => {
    const geo  = new THREE.CylinderGeometry(r, r, h, 12);
    const mesh = new THREE.Mesh(geo, mkFill());
    mesh.position.set(x, y, z);
    mesh.rotation.z = Math.PI / 2;
    const eg = new THREE.EdgesGeometry(geo);
    const ln = new THREE.LineSegments(eg, wire.clone());
    ln.position.set(x, y, z);
    ln.rotation.z = Math.PI / 2;
    carGroup.add(mesh, ln);
  };

  // Body
  B(1.10, 0.23, 4.20,    0,    0.115,   0   );
  B(0.36, 0.25, 2.10,  -0.61,  0.125,   0.18);
  B(0.36, 0.25, 2.10,   0.61,  0.125,   0.18);
  B(0.50, 0.34, 0.92,   0,     0.41,    0.22);
  B(0.16, 0.12, 1.40,   0,     0.07,   -2.10);
  // Front wing
  B(1.80, 0.048, 0.28,  0,     0.048,  -2.60);
  B(0.05, 0.16,  0.36, -0.90,  0.08,   -2.60);
  B(0.05, 0.16,  0.36,  0.90,  0.08,   -2.60);
  // Rear wing
  B(1.42, 0.065, 0.25,  0,     1.08,    1.55);
  B(1.42, 0.050, 0.20,  0,     0.94,    1.50);
  B(0.05, 0.60,  0.36, -0.71,  0.77,    1.55);
  B(0.05, 0.60,  0.36,  0.71,  0.77,    1.55);
  B(0.065,0.55,  0.08, -0.44,  0.73,    1.55);
  B(0.065,0.55,  0.08,  0.44,  0.73,    1.55);
  // Diffuser
  B(0.78, 0.13, 0.42,   0,     0.045,   1.85);
  // Wheels
  C(0.39, 0.35, -1.05, 0.39,  1.15);
  C(0.39, 0.35,  1.05, 0.39,  1.15);
  C(0.28, 0.27, -1.00, 0.28, -1.62);
  C(0.28, 0.27,  1.00, 0.28, -1.62);

  carGroup.position.set(0, -0.3, 0.8);
  scene.add(carGroup);
}

// ── Code barrier texture ──────────────────────────
function makeCodeTex() {
  const W = 128, H = 512;
  const cv  = document.createElement('canvas');
  cv.width  = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.font = '13px monospace';

  // glowing bright text
  ctx.shadowBlur = 8;
  const rows = 40, cols = 8;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch    = CHAR_SET[Math.floor(Math.random() * CHAR_SET.length)];
      const alpha = rnd(0.25, 1.0);
      ctx.globalAlpha  = alpha;
      const bright     = Math.random() > 0.15;
      ctx.fillStyle    = bright ? '#1E9FE2' : '#a0e8ff';
      ctx.shadowColor  = bright ? '#1E9FE2' : '#a0e8ff';
      ctx.fillText(ch, c * 16 + 4, r * 13 + 13);
    }
  }
  ctx.globalAlpha = 1;
  return new THREE.CanvasTexture(cv);
}

// ── Irregular barriers ────────────────────────────
// Panels at varying heights, angles, distances — no flat wall feel
function buildBarriers() {
  const matCfg = {
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  };

  for (let i = 0; i < SEG_N; i++) {
    const z = -i * SEG_GAP;

    // Randomise each panel independently
    const makePanel = (side) => {
      // vary width/height slightly
      const pw = rnd(1.4, 2.8);
      const ph = rnd(2.0, 5.5);
      const geo = new THREE.PlaneGeometry(pw, ph);
      const mat = new THREE.MeshBasicMaterial({
        ...matCfg,
        opacity: rnd(0.55, 1.0),
        map: makeCodeTex(),
      });
      const m = new THREE.Mesh(geo, mat);

      // X: vary how close to road edge (some lean in, some far out)
      const xBase  = (ROAD_W / 2 + rnd(0.3, 1.8)) * side;
      const yOff   = rnd(-0.4, 1.2);   // float at different heights
      const zOff   = rnd(-0.8, 0.8);   // stagger along Z
      m.position.set(xBase, ph / 2 + yOff, z + zOff);

      // Random angle: each panel faces a bit differently
      const tiltY = (rnd(0.05, 0.45)) * side;  // yaw toward road
      const tiltZ = rnd(-0.25, 0.25);           // slight roll
      m.rotation.set(0, tiltY, tiltZ);

      scene.add(m);
      return m;
    };

    barrierL.push(makePanel(-1));
    barrierR.push(makePanel( 1));
  }
}

// ── Road dashes ───────────────────────────────────
function buildDashes() {
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.18,
  });
  const geo = new THREE.BoxGeometry(0.06, 0.003, 1.0);
  const n   = SEG_N + 4;
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geo, mat.clone());
    m.position.set(0, 0.001, -i * (SEG_GAP - 1.5));
    scene.add(m);
    dashMeshes.push(m);
  }
}

// ── Char particles ────────────────────────────────
function resetSpark(p) {
  const z0 = rnd(-50, -8);
  p.sp.position.set(rnd(-1.0, 1.0), rnd(-0.2, 0.8), z0);
  p.vx = rnd(-0.022, 0.022);
  p.vy = rnd(-0.005, 0.014);
  p.vz = rnd(0.06, 0.20);
  p.sp.material.opacity = rnd(0.5, 1.0);
  const ch = CHAR_SET[Math.floor(Math.random() * CHAR_SET.length)];
  p.sp.material.map = getCharTex(ch);
  p.sp.material.needsUpdate = true;
  p.sp.scale.setScalar(rnd(0.08, 0.28));
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
  scene.background = new THREE.Color(0x020104);
  // Light fog — starts far away so near objects are fully visible
  scene.fog = new THREE.Fog(0x020104, 60, 130);

  camera = new THREE.PerspectiveCamera(58, W / H, 0.1, 200);
  camera.position.set(0, 2.2, 5.5);

  // Road floor
  scene.add(Object.assign(
    new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_W, 280),
      new THREE.MeshBasicMaterial({ color: 0x030106 }),
    ),
    { rotation: { x: -Math.PI / 2, y: 0, z: 0 }, position: { x: 0, y: -0.006, z: -100 } },
  ));

  // Road edge lines
  const edgeMat = new THREE.LineBasicMaterial({
    color: ACCENT, transparent: true, opacity: 0.40,
    blending: THREE.AdditiveBlending,
  });
  for (const x of [-ROAD_W / 2, ROAD_W / 2]) {
    const pts = [new THREE.Vector3(x, 0, -200), new THREE.Vector3(x, 0, 8)];
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), edgeMat.clone()));
  }

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
  mouseXT = (e.clientX / window.innerWidth)  * 2 - 1;  // -1 left … +1 right
  mouseYT = -((e.clientY / window.innerHeight) * 2 - 1); // -1 bottom … +1 top
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

  // Smooth mouse — same lazy-follow as the mask
  mouseXS = lerp(mouseXS, mouseXT, 0.055);
  mouseYS = lerp(mouseYS, mouseYT, 0.055);

  shakePhase += 0.15;
  const shX = Math.sin(shakePhase * 1.4) * 0.003 + Math.sin(shakePhase * 2.3) * 0.0015;
  const shY = Math.cos(shakePhase * 0.8) * 0.002;

  // Camera: gaze follows mouse — like mask tracking
  // Mouse right → camera looks right → feels like turning right
  const lookX = mouseXS * 3.5 + shX * 8;
  const lookY = 0.5 + mouseYS * 0.4 + shY * 5;
  camera.position.x = shX;
  camera.position.y = 2.2 + shY;
  camera.lookAt(lookX, lookY, -60);

  // Car: lean into the turn (opposite Z) + subtle bob
  if (carGroup) {
    carGroup.rotation.z = -mouseXS * 0.055;
    carGroup.rotation.x =  Math.sin(shakePhase * 0.65) * 0.007;
    carGroup.position.x =  mouseXS * 0.12;
  }

  // Scroll barriers
  const totalLen = SEG_N * SEG_GAP;
  barrierL.forEach(m => { m.position.z += SPEED; if (m.position.z > 8) m.position.z -= totalLen; });
  barrierR.forEach(m => { m.position.z += SPEED; if (m.position.z > 8) m.position.z -= totalLen; });

  // Scroll dashes
  const dashTotal = (SEG_N + 4) * (SEG_GAP - 1.5);
  dashMeshes.forEach(m => { m.position.z += SPEED; if (m.position.z > 8) m.position.z -= dashTotal; });

  // Char sparks — spread outward as they approach camera
  sparks.forEach(p => {
    const fwd = Math.max(0, (p.sp.position.z + 50) / 50);
    p.sp.position.x += p.vx * (1 + fwd * 5);
    p.sp.position.y += p.vy;
    p.sp.position.z += p.vz * (1 + fwd);
    p.sp.material.opacity -= 0.004;
    if (p.sp.position.z > 5 || p.sp.material.opacity <= 0) resetSpark(p);
  });

  speedPass.uniforms.speed.value = 0.42;

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
