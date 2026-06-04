// ───────────────────────────────────────────────
// Lenis smooth-scroll — butter-smooth wheel/touchpad with inertia.
// Loaded via CDN <script> in index.html; this just inits + drives raf.
// ───────────────────────────────────────────────

let lenisInstance = null;

export function initSmoothScroll() {
  if (typeof window === 'undefined' || typeof window.Lenis !== 'function') {
    console.warn('[NYM] Lenis not available — falling back to native scroll');
    return null;
  }

  lenisInstance = new window.Lenis({
    duration: 1.1,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    smoothTouch: false, // keep native touch feel on mobile
    wheelMultiplier: 1,
    touchMultiplier: 1.2,
  });

  function raf(time) {
    lenisInstance.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  return lenisInstance;
}

export function pauseLenis()  { if (lenisInstance) lenisInstance.stop(); }
export function resumeLenis() { if (lenisInstance) lenisInstance.start(); }

export function scrollToTopInstant() {
  if (lenisInstance) {
    lenisInstance.scrollTo(0, { immediate: true });
  } else {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}
