// ───────────────────────────────────────────────
// Routing + overlays + global "exit-to-home" controller.
// Two kinds of nav targets coexist:
//   [data-page="X"]     → scroll-revealed page (body becomes scrollable)
//   [data-overlay="X"]  → full-screen overlay panel (no scroll)
// Both kinds reset via [data-home] (NYM logo) and Escape.
// ───────────────────────────────────────────────

let activePanel = null;
let activePage = null;
const exitHandlers = [];

export function registerExitHandler(fn) {
  if (typeof fn === 'function') exitHandlers.push(fn);
}

// ─── Overlay panels ───────────────────────────
function openPanel(name) {
  const panel = document.querySelector(`[data-overlay-panel="${name}"]`);
  if (!panel) return;
  closePage(); // overlay and page are mutually exclusive
  if (activePanel && activePanel !== panel) activePanel.classList.remove('is-open');
  panel.classList.add('is-open');
  activePanel = panel;
}

function closePanel() {
  if (activePanel) {
    activePanel.classList.remove('is-open');
    activePanel = null;
  }
}

// ─── Scroll-revealed pages ────────────────────
export function openPage(name) {
  closePanel(); // overlay and page are mutually exclusive
  document.body.classList.add('is-page-open');
  document.body.dataset.page = name;
  activePage = name;
  window.scrollTo({ top: 0, behavior: 'instant' });
}

export function setActivePage(name) {
  activePage = name;
}

function closePage() {
  document.body.classList.remove('is-page-open');
  delete document.body.dataset.page;
  window.scrollTo({ top: 0, behavior: 'instant' });
  activePage = null;
}

// ─── Global home (logo / Escape) ──────────────
function exitAll() {
  closePanel();
  closePage();
  for (const fn of exitHandlers) {
    try { fn(); } catch (e) { console.warn('[NYM] exit handler failed:', e); }
  }
}

export function initOverlays() {
  // Overlay open buttons (works, contact)
  document.querySelectorAll('[data-overlay]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      openPanel(el.dataset.overlay);
    });
  });

  // Page open buttons (about)
  document.querySelectorAll('[data-page]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      openPage(el.dataset.page);
    });
  });

  // Close buttons inside overlays
  document.querySelectorAll('[data-close-overlay]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      closePanel();
    });
  });

  // Home / logo
  document.querySelectorAll('[data-home]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      exitAll();
    });
  });

  // Escape closes everything
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') exitAll();
  });

  // Click on overlay backdrop closes it
  document.querySelectorAll('.overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closePanel();
    });
  });
}
