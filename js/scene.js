// ───────────────────────────────────────────────
// Three.js scene — simple dotted mask (no scroll transformation)
// ───────────────────────────────────────────────

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const ACCENT = 0x1E9FE2;
const ACCENT_BRIGHT = 0x5FC7EF;

let renderer, scene, camera, maskGroup;
let baseMesh = null;
let edges = null;

let targetRotX = 0, targetRotY = 0;
let currentRotX = 0, currentRotY = 0;
const startTime = performance.now();
const getTime = () => (performance.now() - startTime) / 1000;

// Reveal animation state: mask spins from back-facing (Y=π) to front (Y=0)
let reveal = null; // { t0, duration }

export function playMaskReveal() {
  if (!maskGroup) return;
  // Snap to back-facing, reset current rotation to match
  currentRotY = Math.PI;
  targetRotX = 0;
  targetRotY = 0;
  currentRotX = 0;
  reveal = { t0: getTime(), duration: 2.2 };
}

// Public setter so input modules (mouse, gyro, touch) can drive rotation
export function setMaskTarget(rx, ry) {
  targetRotX = Math.max(-0.5, Math.min(0.5, rx));
  targetRotY = Math.max(-0.8, Math.min(0.8, ry));
}

// No-op kept for compatibility with scroll-effects.js (which used to drive
// a scroll-based mask transformation). The mask is now static — only the
// hero overlay text fades on scroll.
export function setScrollProgress(_p) {}

export async function initScene({ onProgress } = {}) {
  const container = document.getElementById('stage');
  if (!container) throw new Error('stage container not found');

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    35,
    window.innerWidth / window.innerHeight,
    0.1,
    100,
  );
  camera.position.set(0, 0, 5);

  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const key = new THREE.DirectionalLight(ACCENT, 2.5);
  key.position.set(2, 3, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(ACCENT_BRIGHT, 1.2);
  rim.position.set(-3, 1, -2);
  scene.add(rim);

  await loadMask(onProgress);
  applyDotsMaterial();

  window.addEventListener('resize', onResize);
  window.addEventListener('mousemove', onMouseMove);
  renderer.setAnimationLoop(tick);
}

async function loadMask(onProgress) {
  const loader = new GLTFLoader();

  const gltf = await new Promise((resolve, reject) => {
    loader.load(
      '/assets/mask.glb',
      resolve,
      (e) => {
        if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
      },
      reject,
    );
  });

  maskGroup = new THREE.Group();
  const mask = gltf.scene;

  const box = new THREE.Box3().setFromObject(mask);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  mask.position.sub(center);
  const maxDim = Math.max(size.x, size.y, size.z);
  mask.scale.setScalar(2.0 / maxDim);

  mask.traverse((obj) => {
    if (obj.isMesh && !baseMesh) baseMesh = obj;
  });

  maskGroup.add(mask);
  scene.add(maskGroup);
  positionMaskForViewport();
}

function applyDotsMaterial() {
  if (!baseMesh) return;
  const geo = baseMesh.geometry;

  // Ghost body so back faces don't bleed through
  baseMesh.material = new THREE.MeshBasicMaterial({
    color: 0x000814,
    transparent: true,
    opacity: 0.45,
    side: THREE.FrontSide,
  });

  // Sparse cyan vertex cloud — "made of code"
  const posAttr = geo.attributes.position;
  const stride = 14;
  const pts = [];
  for (let i = 0; i < posAttr.count; i += stride) {
    pts.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
  }
  const ptsGeo = new THREE.BufferGeometry();
  ptsGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const ptsMat = new THREE.PointsMaterial({
    color: ACCENT_BRIGHT,
    size: 0.012,
    transparent: true,
    opacity: 1.0,        // +10pp from 0.9 (brightness bump, no size/density change)
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const points = new THREE.Points(ptsGeo, ptsMat);
  baseMesh.add(points);

  // Subtle silhouette for definition
  const edgeGeo = new THREE.EdgesGeometry(geo, 60);
  const edgeMat = new THREE.LineBasicMaterial({
    color: ACCENT_BRIGHT,
    transparent: true,
    opacity: 0.6,        // +10pp from 0.5
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  edges = new THREE.LineSegments(edgeGeo, edgeMat);
  baseMesh.add(edges);
}

function positionMaskForViewport() {
  if (!maskGroup) return;
  const aspect = window.innerWidth / window.innerHeight;
  maskGroup.position.x = 0;
  maskGroup.position.y = 0.1;
  let scale = 1.2;
  if (aspect < 0.9) scale = 0.95;
  else if (aspect < 1.4) scale = 1.1;
  maskGroup.scale.setScalar(scale);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  positionMaskForViewport();
}

function onMouseMove(e) {
  const nx = (e.clientX / window.innerWidth) * 2 - 1;
  const ny = (e.clientY / window.innerHeight) * 2 - 1;
  setMaskTarget(ny * 0.3, nx * 0.5);
}

// Ease out cubic
function easeOut3(x) { return 1 - Math.pow(1 - x, 3); }

function tick() {
  const t = getTime();

  if (maskGroup) {
    if (reveal) {
      // Reveal: rotate from π → 0 over `duration` seconds, ease-out
      const p = Math.min(1, (t - reveal.t0) / reveal.duration);
      const rotY = Math.PI * (1 - easeOut3(p));
      maskGroup.rotation.x = Math.sin(t * 0.4) * 0.02;
      maskGroup.rotation.y = rotY + Math.sin(t * 0.3) * 0.03 * p; // ambient wobble fades in
      maskGroup.position.y = 0.1 + Math.sin(t * 0.8) * 0.05;
      if (p >= 1) {
        reveal = null;
        currentRotY = 0; // prevent idle lerp from re-rotating
        currentRotX = 0;
      }
    } else {
      currentRotX += (targetRotX - currentRotX) * 0.06;
      currentRotY += (targetRotY - currentRotY) * 0.06;
      maskGroup.rotation.x = currentRotX + Math.sin(t * 0.4) * 0.02;
      maskGroup.rotation.y = currentRotY + Math.sin(t * 0.3) * 0.03;
      maskGroup.position.y = 0.1 + Math.sin(t * 0.8) * 0.05;
    }

    if (edges) {
      edges.material.opacity = 0.45 + Math.sin(t * 1.5) * 0.1;
    }
  }

  renderer.render(scene, camera);
}

