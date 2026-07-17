import { escapeHtml, qs } from './dom.js';

const ICONS = { info: 'fa-circle-info', success: 'fa-circle-check', warning: 'fa-triangle-exclamation' };
const DURATION = 3000;

function show(message, { kind = 'info' } = {}) {
  const region = qs('#toast-region');
  if (!region) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${kind}`;
  toast.innerHTML = `
    <i class="fa-solid ${ICONS[kind] || ICONS.info}"></i>
    <span>${escapeHtml(message)}</span>
    <button type="button" class="toast-close" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>
  `;

  const remove = () => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 200);
  };

  toast.querySelector('.toast-close').addEventListener('click', remove);
  region.appendChild(toast);
  setTimeout(remove, DURATION);
}

const Toast = { show };

export default Toast;
