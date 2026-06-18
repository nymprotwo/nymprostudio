// ─────────────────────────────────────────────────────────────────────────────
// NYM / Project Detail — Three.js WebGL renderer
// Ported 1-to-1 from yutaabe.com/projects/psy-clone/ source
// Original: class `ge` in _astro/index.BtmwH3Tn.js
// ─────────────────────────────────────────────────────────────────────────────

import {
  Scene, WebGLRenderer, OrthographicCamera,
  PlaneGeometry, Mesh, ShaderMaterial, InstancedMesh, Object3D,
  Vector2, Vector3, Vector4,
  BufferAttribute, InstancedBufferAttribute, DynamicDrawUsage,
  TextureLoader, CanvasTexture,
} from 'three';

// ── Grid cols (matches yutaabe: 80 desktop, 50 sp) ────
const COLS = window.innerWidth < 768 ? 50 : 80;
const MOUSE_RADIUS = 150;

// ─────────────────────────────────────────────────────────────────────────────
// SHADERS — verbatim from yutaabe source
// ─────────────────────────────────────────────────────────────────────────────

const TITLE_VERT = /* glsl */`
varying vec2 vUv;
varying vec2 vWorldPos;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const TITLE_FRAG = /* glsl */`
#define MAX_IMAGE_RECTS 4
uniform sampler2D uTexture;
uniform float     uReveal;
uniform vec4      uImageRects[MAX_IMAGE_RECTS];
uniform int       uImageCount;
uniform float     uImageBottomY;
varying vec2 vUv;
varying vec2 vWorldPos;
void main() {
  for (int i = 0; i < MAX_IMAGE_RECTS; i++) {
    if (i >= uImageCount) break;
    vec4 r = uImageRects[i];
    if (r.z > 0.0 && r.w > 0.0) {
      vec2 d = abs(vWorldPos - r.xy);
      if (d.x < r.z && d.y < r.w) discard;
    }
  }
  if (uImageBottomY > vWorldPos.y) discard;
  float edge  = 0.04;
  float alpha = 1.0 - smoothstep(uReveal - edge, uReveal, vUv.y);
  if (alpha <= 0.001) discard;
  vec4 tex = texture2D(uTexture, vUv);
  gl_FragColor = vec4(tex.rgb, tex.a * alpha);
}`;

const BLOCK_VERT = /* glsl */`
attribute vec2  aGridPos;
attribute float aBump;
uniform vec2  uGrid;
uniform vec2  uPlaneSize;
uniform vec2  uImageSize;
uniform vec2  uMouseLocal;
uniform float uMouseRadius;
varying vec2  vTexUv;
varying vec2  vBlockUv;
varying vec2  vGridPos;
varying float vBump;
varying float vProximity;
void main() {
  vec2 blockUv = (aGridPos + uv) / uGrid;
  vBlockUv = uv;
  float planeAspect = uPlaneSize.x / uPlaneSize.y;
  float imageAspect = uImageSize.x  / uImageSize.y;
  vec2 scale;
  if (planeAspect > imageAspect)
    scale = vec2(1.0, imageAspect / planeAspect);
  else
    scale = vec2(planeAspect / imageAspect, 1.0);
  vTexUv   = (blockUv - 0.5) * scale + 0.5;
  vGridPos = aGridPos;
  vBump    = aBump;
  float bumpMask  = clamp(aBump * 3.0, 0.0, 1.0);
  vec2  blockCenter = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xy;
  vec2  fromCursor  = blockCenter - uMouseLocal;
  float dist        = length(fromCursor);
  float proximity   = 1.0 - smoothstep(0.0, uMouseRadius, dist);
  float coreHole    = smoothstep(0.0, uMouseRadius * 0.45, dist);
  float effect      = proximity * coreHole;
  vec2  repelDir    = dist > 0.001 ? fromCursor / dist : vec2(0.0, 1.0);
  vProximity        = effect;
  vec4 worldPos     = instanceMatrix * vec4(position, 1.0);
  worldPos.xy      += repelDir * 20.0 * bumpMask * effect;
  gl_Position       = projectionMatrix * modelViewMatrix * worldPos;
}`;

const BLOCK_FRAG = /* glsl */`
uniform sampler2D uTexture;
uniform vec2      uMouseLocal;
uniform vec2      uPlaneSize;
varying vec2  vTexUv;
varying vec2  vBlockUv;
varying vec2  vGridPos;
varying float vBump;
varying float vProximity;
void main() {
  float bumpN = clamp(vBump * 30.0, 0.0, 1.0);
  vec2 cursorParallax = (uMouseLocal / uPlaneSize) * 0.08 * bumpN * vProximity;
  float rowParity = mod(floor(vGridPos.y), 1.0);
  float scanDir   = rowParity * 2.0 - 1.0;
  float scanShift = scanDir * bumpN * 0.0001;
  vec2 baseUv = vTexUv + cursorParallax + vec2(scanShift, 0.0);
  float rgbShift = bumpN * 0.0001 * (1.0 - vProximity * 0.8);
  vec2 uvR = clamp(baseUv + vec2( rgbShift, 0.0), 0.001, 0.999);
  vec2 uvG = clamp(baseUv,                         0.001, 0.999);
  vec2 uvB = clamp(baseUv - vec2( rgbShift, 0.0), 0.001, 0.999);
  float r = texture2D(uTexture, uvR).r;
  float g = texture2D(uTexture, uvG).g;
  float b = texture2D(uTexture, uvB).b;
  vec3 col = vec3(r, g, b);
  vec2  edgeDist = min(vBlockUv, 1.0 - vBlockUv);
  float edgeMin  = min(edgeDist.x, edgeDist.y);
  float gap = pow(1.0 - smoothstep(0.0, 0.10, edgeMin), 3.0);
  col *= smoothstep(0.15, 0.7, bumpN);
  col  = mix(col, col * 0.1, gap * bumpN);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// Returns cleanup() fn — call it when closing detail view
// ─────────────────────────────────────────────────────────────────────────────
export function startDetailGL(canvas, project) {
  let raf = null;

  const W = window.innerWidth;
  const H = window.innerHeight;

  // ── Renderer ────────────────────────────────────────────
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false });
  renderer.setSize(W, H, false);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const scene  = new Scene();
  const camera = new OrthographicCamera(-W/2, W/2, H/2, -H/2, 0.1, 10);
  camera.position.z = 1;

  // ── Mouse ────────────────────────────────────────────────
  const mouseTarget = new Vector2(0, 0);
  const mouseEased  = new Vector2(0, 0);
  const mouseTrail  = new Vector2(0, 0);

  function onMM(e) {
    mouseTarget.x =  e.clientX - W / 2;
    mouseTarget.y = -(e.clientY - H / 2);
  }
  window.addEventListener('mousemove', onMM);

  // ── State ────────────────────────────────────────────────
  let titleMesh      = null;
  let titleCovMap    = null; // { cols, rows, data: Float32Array }
  let titlePadFrac   = 0;
  let revealStart    = null;

  let imageMesh      = null;
  let bumpAttr       = null;
  let bumpCurrents   = null;
  let bumpSeeds      = null;
  let imageCols      = COLS;
  let imageRows      = 1;
  const dummy = new Object3D();

  // ── Title mesh ───────────────────────────────────────────
  // Mirrors yutaabe _initTitle() exactly
  function initTitle() {
    const el = document.querySelector('.proj-detail-title');
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const dpr    = Math.min(devicePixelRatio, 2);
    const maxTex = 4096;
    const padFrac = 0.15;

    const sw = Math.ceil(rect.width  * dpr);
    const sh = Math.ceil(rect.height * dpr);
    const padPx = Math.ceil(sh * padFrac);
    const scale  = Math.min(1, maxTex / Math.max(sw, sh + padPx * 2));

    const cw = Math.ceil(sw    * scale);
    const ch = Math.ceil(sh    * scale);
    const cp = Math.ceil(padPx * scale);
    const totalH = ch + cp * 2;

    titlePadFrac = totalH > 0 ? cp / totalH : 0;

    const oc  = document.createElement('canvas');
    oc.width  = cw;
    oc.height = totalH;
    const ctx2 = oc.getContext('2d');

    const style = window.getComputedStyle(el);
    const fs = parseFloat(style.fontSize) * dpr * scale;
    const fw = style.fontWeight || '900';
    const ff = style.fontFamily;

    ctx2.clearRect(0, 0, cw, totalH);
    ctx2.fillStyle    = '#ffffff';
    ctx2.font         = `${fw} ${fs}px ${ff}`;
    ctx2.textBaseline = 'middle';
    ctx2.textAlign    = 'left';

    // Split into lines (handles multi-line title)
    const rawLines = (el.textContent || '').trim().toUpperCase()
      .replace(/\n+/g, '\n').split('\n').filter(Boolean);
    const lh  = parseFloat(style.lineHeight);
    const lineH = isNaN(lh) ? fs * 0.88 : lh * dpr * scale;

    if (rawLines.length === 1) {
      const tw = ctx2.measureText(rawLines[0]).width;
      if (tw > cw) {
        ctx2.save(); ctx2.translate(0, totalH / 2);
        ctx2.scale(cw / tw, 1); ctx2.fillText(rawLines[0], 0, 0);
        ctx2.restore();
      } else {
        ctx2.fillText(rawLines[0], 0, totalH / 2);
      }
    } else {
      const totalTextH = rawLines.length * lineH;
      const startY     = (totalH - totalTextH) / 2 + lineH / 2;
      rawLines.forEach((line, i) => {
        const tw = ctx2.measureText(line).width;
        if (tw > cw) {
          ctx2.save(); ctx2.translate(0, startY + i * lineH);
          ctx2.scale(cw / tw, 1); ctx2.fillText(line, 0, 0);
          ctx2.restore();
        } else {
          ctx2.fillText(line, 0, startY + i * lineH);
        }
      });
    }

    // Build title coverage map (512×128) for bump effect
    const CMAP_W = 512, CMAP_H = 128;
    const imgData = ctx2.getImageData(0, 0, cw, totalH);
    const covData = new Float32Array(CMAP_W * CMAP_H);
    for (let py = 0; py < CMAP_H; py++) {
      for (let px2 = 0; px2 < CMAP_W; px2++) {
        const x0 = Math.floor(px2 * cw / CMAP_W);
        const x1 = Math.ceil((px2 + 1) * cw / CMAP_W);
        const y0 = Math.floor(py * totalH / CMAP_H);
        const y1 = Math.ceil((py + 1) * totalH / CMAP_H);
        let sum = 0, cnt = 0;
        for (let y = y0; y < y1; y++)
          for (let x = x0; x < x1; x++)
            if (x < cw && y < totalH) { sum += imgData.data[(y * cw + x) * 4 + 3]; cnt++; }
        covData[py * CMAP_W + px2] = cnt > 0 ? sum / (cnt * 255) : 0;
      }
    }
    titleCovMap = { cols: CMAP_W, rows: CMAP_H, data: covData };

    const tex = new CanvasTexture(oc);
    tex.needsUpdate = true;

    const geo = new PlaneGeometry(1, 1);
    const mat = new ShaderMaterial({
      vertexShader:   TITLE_VERT,
      fragmentShader: TITLE_FRAG,
      uniforms: {
        uTexture:      { value: tex },
        uReveal:       { value: 0 },
        uImageRects:   { value: [new Vector4(), new Vector4(), new Vector4(), new Vector4()] },
        uImageCount:   { value: 0 },
        uImageBottomY: { value: -999999 },
      },
      transparent: true,
      depthWrite:  false,
    });

    titleMesh = new Mesh(geo, mat);
    titleMesh.renderOrder = 0;
    titleMesh.scale.set(rect.width, rect.height * totalH / ch, 1);

    syncTitlePos(rect);
    scene.add(titleMesh);

    el.style.opacity = '0';      // hide HTML, Three.js takes over
    revealStart = performance.now();
  }

  function syncTitlePos(rect) {
    if (!titleMesh) return;
    const el = document.querySelector('.proj-detail-title');
    const r  = rect || (el ? el.getBoundingClientRect() : null);
    if (!r) return;
    const tx = r.left + r.width  / 2 - W / 2;
    const ty = -(r.top + r.height / 2 - H / 2);
    titleMesh.position.set(tx, ty, 0);
  }

  // Ease-out approximation of yutaabe's "titleReveal" custom ease
  // M0,0 C0.496,0.004 0,1 1,1 — roughly cubic-ease-out
  function easeReveal(t) { return 1 - Math.pow(1 - t, 3); }

  // ── Image instanced mesh ─────────────────────────────────
  // Mirrors yutaabe _initImage() + _setInstanceMatrices()
  function buildImageMesh(texture, imgW, imgH, pw, ph, worldX, worldY) {
    if (imageMesh) {
      scene.remove(imageMesh);
      imageMesh.geometry.dispose();
      imageMesh.material.dispose();
      imageMesh = null;
    }

    const blockW = pw / COLS;
    const rows   = Math.max(1, Math.round(ph / blockW));
    imageCols = COLS;
    imageRows = rows;
    const count = COLS * rows;

    bumpCurrents = new Float32Array(count);
    bumpSeeds    = new Float32Array(count).map(() => 0.5 + Math.random() * 0.5);

    const geo = new PlaneGeometry(1, 1);

    // Per-instance: grid position
    const gridPos = new Float32Array(count * 2);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < COLS; c++) {
        const idx = r * COLS + c;
        gridPos[idx * 2]     = c;
        gridPos[idx * 2 + 1] = r;
      }
    geo.setAttribute('aGridPos', new InstancedBufferAttribute(gridPos, 2));

    const bumpArr = new Float32Array(count);
    bumpAttr = new InstancedBufferAttribute(bumpArr, 1);
    bumpAttr.setUsage(DynamicDrawUsage);
    geo.setAttribute('aBump', bumpAttr);

    const mat = new ShaderMaterial({
      vertexShader:   BLOCK_VERT,
      fragmentShader: BLOCK_FRAG,
      uniforms: {
        uTexture:    { value: texture },
        uGrid:       { value: new Vector2(COLS, rows) },
        uPlaneSize:  { value: new Vector2(pw, ph) },
        uImageSize:  { value: new Vector2(imgW, imgH) },
        uMouseLocal: { value: new Vector2(0, 0) },
        uMouseRadius: { value: MOUSE_RADIUS },
      },
      transparent: false,
      depthWrite:  false,
    });

    imageMesh = new InstancedMesh(geo, mat, count);
    imageMesh.renderOrder = 1;

    // Set per-instance transforms
    const bw = pw / COLS;
    const bh = ph / rows;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < COLS; c++) {
        const idx = r * COLS + c;
        const x   = (c + 0.5 - COLS / 2) * bw;
        const y   = (r + 0.5 - rows / 2) * bh;
        dummy.position.set(x, y, 0);
        dummy.scale.set(bw, bh, 1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        imageMesh.setMatrixAt(idx, dummy.matrix);
      }
    imageMesh.instanceMatrix.needsUpdate = true;

    // Store for later sync
    imageMesh.userData.pw = pw;
    imageMesh.userData.ph = ph;
    imageMesh.position.set(worldX, worldY, 0);

    scene.add(imageMesh);
  }

  function loadImage() {
    // Image element position — place below title, taking up most of lower half
    const titleEl = document.querySelector('.proj-detail-title');
    const tRect   = titleEl ? titleEl.getBoundingClientRect() : null;
    const topY    = tRect ? tRect.bottom : H * 0.35;
    const ph      = H - topY;
    const pw      = W;
    const worldX  = 0;
    const worldY  = -(topY + ph / 2 - H / 2);

    if (project.img) {
      const loader = new TextureLoader();
      loader.load(
        project.img,
        (tex) => buildImageMesh(tex, tex.image.naturalWidth || tex.image.width, tex.image.naturalHeight || tex.image.height, pw, ph, worldX, worldY),
        undefined,
        () => buildGradient(pw, ph, worldX, worldY)
      );
    } else {
      buildGradient(pw, ph, worldX, worldY);
    }
  }

  function buildGradient(pw, ph, worldX, worldY) {
    const oc = document.createElement('canvas');
    oc.width = 256; oc.height = 256;
    const ctx2   = oc.getContext('2d');
    const colors = (project.grad.match(/#[0-9a-fA-F]{3,6}/g) || ['#0d1b2a', '#1e3a5f']);
    const g      = ctx2.createLinearGradient(0, 0, 256, 256);
    colors.forEach((c, i) => g.addColorStop(i / Math.max(1, colors.length - 1), c));
    ctx2.fillStyle = g;
    ctx2.fillRect(0, 0, 256, 256);
    const tex = new CanvasTexture(oc);
    buildImageMesh(tex, 256, 256, pw, ph, worldX, worldY);
  }

  // ── Title coverage sampling ───────────────────────────────
  // Mirrors yutaabe _sampleTitleCoverage()
  function sampleCoverage(bLeft, bRight, bTop, bBottom, titleRect) {
    if (!titleCovMap || !titleRect) return 0;
    const { cols, rows, data } = titleCovMap;
    const pad  = titlePadFrac;
    const padH = 1 - 2 * pad;

    const cx0 = (bLeft  - titleRect.left) / titleRect.width * cols;
    const cx1 = (bRight - titleRect.left) / titleRect.width * cols;
    const cy0 = (pad + (bTop    - titleRect.top) / titleRect.height * padH) * rows;
    const cy1 = (pad + (bBottom - titleRect.top) / titleRect.height * padH) * rows;

    const c0 = Math.max(0, Math.floor(cx0));
    const c1 = Math.min(cols - 1, Math.ceil(cx1) - 1);
    const r0 = Math.max(0, Math.floor(cy0));
    const r1 = Math.min(rows - 1, Math.ceil(cy1) - 1);

    if (c0 > c1 || r0 > r1) return 0;
    let sum = 0, cnt = 0;
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) { sum += data[r * cols + c]; cnt++; }
    return cnt > 0 ? sum / cnt : 0;
  }

  // ── Per-frame bump update ─────────────────────────────────
  // Mirrors yutaabe _updateBlockEffects()
  function updateBump() {
    if (!imageMesh || !bumpCurrents || !bumpSeeds) return;
    const titleEl   = document.querySelector('.proj-detail-title');
    const titleRect = titleEl ? titleEl.getBoundingClientRect() : null;

    const { pw, ph } = imageMesh.userData;
    const meshScreenX = imageMesh.position.x + W / 2 - pw / 2;
    const meshScreenY = -imageMesh.position.y + H / 2 - ph / 2;

    const bw = pw / imageCols;
    const bh = ph / imageRows;
    const ease = 0.1;
    const strength = 0.5;
    let changed = false;

    const overlaps = titleRect && (
      titleRect.bottom > meshScreenY - 10 &&
      titleRect.top    < meshScreenY + ph + 10 &&
      titleRect.right  > meshScreenX - 10 &&
      titleRect.left   < meshScreenX + pw + 10
    );

    for (let r = 0; r < imageRows; r++) {
      for (let c = 0; c < imageCols; c++) {
        const i   = r * imageCols + c;
        let target = 0;

        if (overlaps && titleRect) {
          // Block screen coords (rows are bottom-to-top in world, top-to-bottom on screen)
          const bLeft   = meshScreenX + c * bw;
          const bRight  = bLeft + bw;
          const bTop    = meshScreenY + (imageRows - 1 - r) * bh;
          const bBottom = bTop + bh;
          const cov = sampleCoverage(bLeft, bRight, bTop, bBottom, titleRect);
          target = bumpSeeds[i] * strength * cov;
        }

        const cur = bumpCurrents[i];
        bumpCurrents[i] += (target - cur) * ease;
        if (Math.abs(bumpCurrents[i] - cur) > 1e-4) changed = true;
      }
    }

    if (changed) {
      bumpAttr.array.set(bumpCurrents);
      bumpAttr.needsUpdate = true;
    }
  }

  // ── Start (async-friendly) ───────────────────────────────
  const initDelay = typeof requestIdleCallback !== 'undefined'
    ? (fn) => requestIdleCallback(fn, { timeout: 800 })
    : (fn) => setTimeout(fn, 400);

  initDelay(initTitle);
  loadImage();
  canvas.classList.add('is-revealing');

  // ── Render loop ───────────────────────────────────────────
  const REVEAL_MS = 1100;

  function loop() {
    raf = requestAnimationFrame(loop);

    // Mouse ease (factors match yutaabe: 0.15, 0.05)
    mouseEased.x += (mouseTarget.x - mouseEased.x) * 0.15;
    mouseEased.y += (mouseTarget.y - mouseEased.y) * 0.15;
    mouseTrail.x += (mouseEased.x  - mouseTrail.x) * 0.05;
    mouseTrail.y += (mouseEased.y  - mouseTrail.y) * 0.05;

    // Title reveal + position sync
    if (titleMesh) {
      syncTitlePos();

      if (revealStart !== null) {
        const t    = Math.min(1, (performance.now() - revealStart) / REVEAL_MS);
        const ease = easeReveal(t);
        titleMesh.material.uniforms.uReveal.value = ease * 1.04;
      }

      // Update image-rect cutout in title shader
      if (imageMesh) {
        const ior = titleMesh.material.uniforms.uImageRects.value;
        const ip  = imageMesh.position;
        const hw  = imageMesh.userData.pw / 2;
        const hh  = imageMesh.userData.ph / 2;
        ior[0].set(ip.x, ip.y, hw, hh);
        titleMesh.material.uniforms.uImageCount.value   = 1;
        titleMesh.material.uniforms.uImageBottomY.value = ip.y - hh;
      }
    }

    // Image mouse uniform (relative to mesh center in world space)
    if (imageMesh) {
      imageMesh.material.uniforms.uMouseLocal.value.set(
        mouseEased.x - imageMesh.position.x,
        mouseEased.y - imageMesh.position.y,
      );
    }

    updateBump();
    renderer.render(scene, camera);
  }

  raf = requestAnimationFrame(loop);

  // ── Cleanup ───────────────────────────────────────────────
  return function cleanup() {
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    window.removeEventListener('mousemove', onMM);

    const titleEl = document.querySelector('.proj-detail-title');
    if (titleEl) titleEl.style.opacity = '';

    canvas.classList.remove('is-revealing');

    if (titleMesh) {
      scene.remove(titleMesh);
      titleMesh.geometry.dispose();
      titleMesh.material.uniforms.uTexture.value?.dispose();
      titleMesh.material.dispose();
      titleMesh = null;
    }
    if (imageMesh) {
      scene.remove(imageMesh);
      imageMesh.geometry.dispose();
      imageMesh.material.uniforms.uTexture.value?.dispose();
      imageMesh.material.dispose();
      imageMesh = null;
    }
    renderer.dispose();
  };
}
