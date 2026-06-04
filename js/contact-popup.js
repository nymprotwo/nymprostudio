export function initContactPopup() {
  const toggle = document.getElementById('contact-toggle');
  const popup  = document.getElementById('contact-popup');
  if (!toggle || !popup) return;

  let open = false;

  function show() {
    open = true;
    popup.removeAttribute('hidden');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('cpop-open');
  }

  function hide() {
    open = false;
    popup.setAttribute('hidden', '');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('cpop-open');
  }

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    open ? hide() : show();
  });

  document.addEventListener('click', (e) => {
    if (open && !popup.contains(e.target)) hide();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) hide();
  });

  // Copy buttons
  popup.querySelectorAll('.cpop__copy').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy;
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // fallback
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      const orig = btn.textContent;
      btn.textContent = 'COPIED';
      btn.classList.add('cpop__btn--copied');
      setTimeout(() => { btn.textContent = orig; btn.classList.remove('cpop__btn--copied'); }, 1500);
    });
  });
}
