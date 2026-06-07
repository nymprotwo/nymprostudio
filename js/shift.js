// ─────────────────────────────────────────────────────
// NYM / SHIFT — Realistic Racing Scene  v6
// McLaren MP4/5 GLB + red-white barriers + gold sparks
// Mouse = subtle camera sway (like reference)
// ─────────────────────────────────────────────────────

import * as THREE from 'three';
import { GLTFLoader }    from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass }     from 'three/addons/postprocessing/ShaderPass.js';
import { pauseLenis, resumeLenis } from './smooth-scroll.js?v=29';
import { registerExitHandler }    from './overlays.js?v=28';

// ── Config ────────────────────────────────────────
const ROAD_W    = 9.0;
const SEG_N     = 28;
const SEG_STEP  = 4.2;
const SPEED     = 0.24;   // 2× faster
const SPARK_N   = 120;

// ── Radial speed-blur (edges only, subtle) ────────
const SpeedBlur = {
  uniforms: {
    tDiffuse: { value: null },
    amount:   { value: 0.0 },
    center:   { value: new THREE.Vector2(0.5, 0.44) },
  },
  vertexShader:
    `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float     amount;
    uniform vec2      center;
    varying vec2      vUv;
    void main(){
      vec2 dir = vUv - center;
      // Stronger blur at edges, zero at centre (centre stays sharp)
      float edgeMask = smoothstep(0.15, 0.60, length(dir));
      vec4 col = vec4(0.0);
      for(int i=0;i<16;i++){
        float t = float(i)/16.0;
        col += texture2D(tDiffuse, vUv - dir * amount * t * edgeMask * 0.28);
      }
      col /= 16.0;
      gl_FragColor = col;
    }`,
};

// ── State ─────────────────────────────────────────
let renderer, scene, camera, composer, blurPass;
let carGroup = null;
let barrierMeshes = [];
let dashMeshes    = [];
let sparks        = [];

let mouseXT = 0, mouseXS = 0;
let mouseYT = 0, mouseYS = 0;
let tick = 0;
let active = false, rafId = null;
let sceneReady = false;

const rnd  = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;

// ── Load car ──────────────────────────────────────
function loadCar() {
  return new Promise((resolve) => {

    // Bright debug box so we can confirm camera framing before car loads
    const dbg = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.9, 3.8),
      new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true }),
    );
    dbg.position.set(0, 0.45, 0);
    scene.add(dbg);

    new GLTFLoader().load('/assets/car.glb', (gltf) => {
      scene.remove(dbg); // remove debug box once real car loads

      carGroup = new THREE.Group();

      // Center + scale the loaded model
      const box    = new THREE.Box3().setFromObject(gltf.scene);
      const size   = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const s      = 3.8 / maxDim;

      gltf.scene.scale.setScalar(s);
      // Offset so bottom of car sits on y=0
      gltf.scene.position.set(
        -center.x * s,
        -box.min.y * s,
        -center.z * s,
      );

      carGroup.add(gltf.scene);
      // Rotate so rear faces camera (+Z)
      carGroup.rotation.y = Math.PI;
      carGroup.position.set(0, -0.08, 0.4);
      scene.add(carGroup);
      resolve();
    }, undefined, (err) => {
      console.warn('[SHIFT] car.glb load error', err);
      resolve();
    });
  });
}

// ── Red / white barriers ──────────────────────────
function buildBarriers() {
  const matR = new THREE.MeshPhongMaterial({ color: 0xcc1111 });
  const matW = new THREE.MeshPhongMaterial({ color: 0xdddddd });
  const geo  = new THREE.BoxGeometry(0.28, 0.70, 0.28);

  for (let i = 0; i < SEG_N; i++) {
    const z = -i * SEG_STEP;
    for (const side of [-1, 1]) {
      const isRed = i % 2 === 0;
      const mat   = isRed ? matR : matW;
      const m     = new THREE.Mesh(geo, mat);
      m.position.set(side * (ROAD_W / 2 + 0.20), 0.35, z);
      scene.add(m);
      barrierMeshes.push(m);
    }
  }
}

// ── Road & centre dashes ──────────────────────────
function buildRoad() {
  // Asphalt
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROAD_W, 400),
    new THREE.MeshPhongMaterial({ color: 0x080808 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.005, -160);
  scene.add(floor);

  // Centre dashes
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
  const dashGeo = new THREE.BoxGeometry(0.10, 0.003, 1.4);
  const total   = SEG_N + 8;
  for (let i = 0; i < total; i++) {
    const m = new THREE.Mesh(dashGeo, dashMat.clone());
    m.position.set(0, 0.003, -i * 3.8);
    scene.add(m);
    dashMeshes.push(m);
  }
}

// ── Gold spark particles ──────────────────────────
function resetSpark(p) {
  const z0 = rnd(-55, -6);
  p.mesh.position.set(rnd(-0.5, 0.5), rnd(0.1, 0.6), z0);
  p.vx = rnd(-0.04, 0.04);
  p.vy = rnd(-0.01, 0.02);
  p.vz = rnd(0.08, 0.28);
  p.mesh.material.opacity = rnd(0.5, 1.0);
  // Random gold/orange hue
  p.mesh.material.color.setHSL(rnd(0.06, 0.12), 1.0, rnd(0.55, 0.80));
  const s = rnd(0.012, 0.055);
  p.mesh.scale.set(s * rnd(4, 12), s, s); // elongated streak
  p.mesh.rotation.z = Math.atan2(p.vy, p.vz) + Math.random() * 0.3;
}

function buildSparks() {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < SPARK_N; i++) {
    const mat  = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    const p = { mesh, vx: 0, vy: 0, vz: 0 };
    resetSpark(p);
    sparks.push(p);
  }
}


// ── Build scene ───────────────────────────────────
async function buildScene() {
  const W = window.innerWidth, H = window.innerHeight;
  const canvas = document.getElementById('shift-canvas');

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(W, H);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x000000, 0.014);

  camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 250);
  camera.position.set(0, 2.0, 5.8);

  // ── Lighting — strong enough to see dark car ──
  scene.add(new THREE.AmbientLight(0x223355, 2.5));

  // Key from above-front
  const key = new THREE.DirectionalLight(0xffffff, 4.0);
  key.position.set(0, 8, 5);
  scene.add(key);

  // Rim from below-front (signature carbon sheen)
  const rim1 = new THREE.DirectionalLight(0x4499ff, 3.5);
  rim1.position.set(0, -2, -6);
  scene.add(rim1);

  // Side fill lights
  const rimL = new THREE.DirectionalLight(0x3366aa, 2.0);
  rimL.position.set(-6, 3, 0);
  scene.add(rimL);
  const rimR = new THREE.DirectionalLight(0x3366aa, 2.0);
  rimR.position.set( 6, 3, 0);
  scene.add(rimR);

  // Strong point light right on the car
  const spot = new THREE.PointLight(0xffffff, 3.0, 20);
  spot.position.set(0, 4, 4);
  scene.add(spot);

  // ── Post-processing ───────────────────────────
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  blurPass = new ShaderPass(SpeedBlur);
  blurPass.uniforms.amount.value = 0.6;
  blurPass.renderToScreen = true;
  composer.addPass(blurPass);

  buildRoad();
  buildBarriers();
  buildSparks();

  window.addEventListener('mousemove', onMouse);
  window.addEventListener('resize',    onResize);
  sceneReady = true;

  // Start rendering immediately — car loads in background
  active = true;
  rafId  = requestAnimationFrame(animate);

  loadCar(); // fire and forget — car appears when ready
}

function teardown() {
  window.removeEventListener('mousemove', onMouse);
  window.removeEventListener('resize',    onResize);
  if (renderer) { renderer.dispose(); renderer = null; }
  barrierMeshes = []; dashMeshes = []; sparks = [];
  carGroup = null;
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

  // Subtle mouse sway — like reference (small movements, gentle)
  mouseXS = lerp(mouseXS, mouseXT, 0.04);
  mouseYS = lerp(mouseYS, mouseYT, 0.04);

  // Road bump shake
  const shX = Math.sin(tick * 2.1) * 0.003 + Math.sin(tick * 3.7) * 0.0015;
  const shY = Math.cos(tick * 1.3) * 0.0025;

  // Camera: mouse drives the look-at direction (like reference)
  // Large range → strong turn feeling
  const camX = mouseXS * 0.25 + shX;
  const camY = 2.0 + mouseYS * 0.12 + shY;
  camera.position.set(camX, camY, 5.8);
  camera.lookAt(mouseXS * 15.0, 0.5 + mouseYS * 0.5, -60);  // 3× more range

  // Car: front follows mouse — strong steering feel
  if (carGroup) {
    carGroup.rotation.y = lerp(carGroup.rotation.y, Math.PI + mouseXS * 0.45, 0.10);
    carGroup.rotation.z = lerp(carGroup.rotation.z, -mouseXS * 0.12,           0.10);
    carGroup.position.x = lerp(carGroup.position.x,  mouseXS * 1.20,           0.08);
    carGroup.position.y = -0.55 + Math.sin(tick * 1.2) * 0.018;
  }

  // Scroll barriers
  const bLoop = SEG_N * SEG_STEP;
  barrierMeshes.forEach(m => {
    m.position.z += SPEED;
    if (m.position.z > 6) m.position.z -= bLoop;
  });

  // Scroll dashes
  const dLoop = (SEG_N + 8) * 3.8;
  dashMeshes.forEach(m => {
    m.position.z += SPEED;
    if (m.position.z > 6) m.position.z -= dLoop;
  });

  // Sparks
  sparks.forEach(p => {
    const fwd = Math.max(0, (p.mesh.position.z + 55) / 55);
    p.mesh.position.x += p.vx * (1 + fwd * 6);
    p.mesh.position.y += p.vy;
    p.mesh.position.z += p.vz * (1 + fwd);
    p.mesh.material.opacity -= 0.006;
    if (p.mesh.position.z > 5.5 || p.mesh.material.opacity <= 0) resetSpark(p);
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
  if (!sceneReady) {
    buildScene(); // starts render loop internally
  } else {
    active = true;
    if (!rafId) rafId = requestAnimationFrame(animate);
  }
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
