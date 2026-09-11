// Toast — pure DOM APIs, no innerHTML HTML strings, ES6+ arrow functions
export const ensureToastContainer = () => {
  let c = document.querySelector('.toast-container');
  if (!c) {
    c = document.createElement('div');
    c.className = 'toast-container';
    document.body.appendChild(c);
  }
  return c;
};

export const toast = (message, { title = 'Success', type = 'success', timeout = 3000 } = {}) => {
  const c = ensureToastContainer();
  const el = document.createElement('div');
  el.className = `toast ${type}`;

  const content = document.createElement('div');
  content.style.flex = '1';

  const titleEl = document.createElement('div');
  titleEl.className = 'toast-title';
  titleEl.textContent = title;

  const msgEl = document.createElement('div');
  msgEl.className = 'toast-msg';
  msgEl.textContent = message;

  content.append(titleEl, msgEl);

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.border = 'none';
  closeBtn.style.background = 'transparent';
  closeBtn.style.color = '#64748b';
  closeBtn.style.fontSize = '16px';
  closeBtn.style.cursor = 'pointer';
  closeBtn.addEventListener('click', () => el.remove());

  el.append(content, closeBtn);
  c.appendChild(el);

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(10px)';
    setTimeout(() => el.remove(), 300);
  }, timeout);
};

export const notify = {
  success: (msg, title = 'Success') => toast(msg, { title, type: 'success' }),
  error: (msg, title = 'Error') => toast(msg, { title, type: 'error', timeout: 4000 }),
  info: (msg, title = 'Info') => toast(msg, { title, type: 'info' }),
};
