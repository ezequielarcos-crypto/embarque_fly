// Piezas de interfaz compartidas: iconos, avisos, diálogos y URLs de imágenes.

import { esc } from './format.js';
import { STATES } from './cards.js';

export const icon = (id, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;

export function stateBadge(state) {
  const s = STATES[state];
  return `<span class="badge badge--${state}">${icon(s.icon)}${esc(s.label)}</span>`;
}

// URLs de objetos para las imágenes de las tarjetas; se liberan al cambiar de vista.
const urls = new Set();
export function blobUrl(blob) {
  if (!blob) return '';
  const u = URL.createObjectURL(blob);
  urls.add(u);
  return u;
}
export function releaseUrls() {
  for (const u of urls) URL.revokeObjectURL(u);
  urls.clear();
}

let toastTimer;
export function toast(message, { action, onAction, tone = 'info', duration = 4200 } = {}) {
  const el = document.getElementById('toast');
  clearTimeout(toastTimer);
  el.className = `toast toast--${tone}`;
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button type="button" class="toast__action">${esc(action)}</button>` : ''}`;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('is-visible'));
  if (action) el.querySelector('button').onclick = () => { hide(); onAction?.(); };
  function hide() {
    el.classList.remove('is-visible');
    setTimeout(() => { el.hidden = true; }, 250);
  }
  if (duration) toastTimer = setTimeout(hide, duration);
}

export function confirmDialog({ title, message, confirm = 'Aceptar', cancel = 'Cancelar', danger = false }) {
  const dlg = document.getElementById('dialog');
  dlg.innerHTML = `
    <form method="dialog" class="dialog__body">
      <h2 class="dialog__title">${esc(title)}</h2>
      ${message ? `<p class="dialog__text">${esc(message)}</p>` : ''}
      <div class="dialog__actions">
        <button class="btn btn--ghost" value="cancel">${esc(cancel)}</button>
        <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" value="ok">${esc(confirm)}</button>
      </div>
    </form>`;
  return new Promise((resolve) => {
    dlg.onclose = () => resolve(dlg.returnValue === 'ok');
    dlg.returnValue = '';
    dlg.showModal();
  });
}

export function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export function pickFiles({ accept = '', multiple = true } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    // En Android, filtrar por extensión .pkpass puede ocultar archivos sin tipo MIME
    // reconocido, así que no se filtra y se valida después.
    if (accept) input.accept = accept;
    input.multiple = multiple;
    input.style.display = 'none';
    input.onchange = () => { resolve([...input.files]); input.remove(); };
    input.oncancel = () => { resolve([]); input.remove(); };
    document.body.append(input);
    input.click();
  });
}
