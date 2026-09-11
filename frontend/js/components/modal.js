// Modal — arrow functions, ES6+
export const openModal = (id) => document.getElementById(id)?.classList.add('open');
export const closeModal = (id) => document.getElementById(id)?.classList.remove('open');
export const bindModalClose = (id) => {
  const overlay = document.getElementById(id);
  if (!overlay) return;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(id); });
  overlay.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', () => closeModal(id)));
};
