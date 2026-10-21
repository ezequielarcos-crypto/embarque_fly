// Detalle de una tarjeta: visualización, modo embarque y gestión.

import { esc, fmtStamp, fmtDayLong, fmtTime } from '../format.js';
import { db } from '../db.js';
import { cardState, setStatus, setNotes } from '../cards.js';
import { passBarcode } from '../pkpass.js';
import { renderPass, renderBackFields } from '../render-pass.js';
import { mountBarcode } from '../barcode.js';
import { icon, stateBadge, toast, confirmDialog, download } from '../ui.js';

export async function renderDetail(root, ctx, params, id) {
  const card = await db.get(id);
  if (!card) {
    root.innerHTML = `<div class="empty"><div class="empty__art">${icon('i-ticket')}</div>
      <h2>Tarjeta no encontrada</h2><p>Puede que se haya eliminado.</p>
      <a class="btn btn--primary" href="#/tarjetas">Volver a mis tarjetas</a></div>`;
    return;
  }

  const s = card.summary;
  const state = cardState(card);
  const bc = passBarcode(card.pass);
  const cancelled = card.status === 'cancelada';
  const back = renderBackFields(card.pass);
  const info = [
    ['Pasajero', s.passenger],
    ['Vuelo', s.flight],
    ['Salida', s.departure ? `${fmtDayLong(s.departure)}${fmtTime(s.departure) ? ` · ${fmtTime(s.departure)}` : ''}` : ''],
    ['Localizador', s.pnr],
    ['Terminal', s.terminal],
    ['Puerta', s.gate],
    ['Asiento', s.seat],
    ['Grupo / zona', s.group],
    ['Clase', s.cabin],
  ].filter(([, v]) => v);

  root.innerHTML = `
    <div class="detail-bar">
      <a class="icon-btn" href="#/tarjetas" aria-label="Volver">${icon('i-back')}</a>
      <div class="detail-bar__title">
        <span class="eyebrow">${esc(s.airline || 'Tarjeta')}</span>
        <strong>${esc([s.origin, s.destination].filter(Boolean).join(' → ') || s.description || 'Tarjeta de embarque')}</strong>
      </div>
      ${stateBadge(state)}
    </div>

    <div class="detail">
      <div class="detail__pass">
        ${renderPass(card)}
        ${bc ? `<button type="button" class="btn btn--sign btn--block" data-action="boarding">${icon('i-expand')}Mostrar en la puerta de embarque</button>` : ''}
      </div>

      <div class="detail__side">
        <div class="actions">
          ${cancelled
            ? `<button type="button" class="action" data-action="restore">${icon('i-restore')}<span>Reactivar</span></button>`
            : `<button type="button" class="action" data-action="cancel">${icon('i-ban')}<span>Cancelar</span></button>`}
          ${card.file ? `<button type="button" class="action" data-action="download">${icon('i-download')}<span>Descargar</span></button>` : ''}
          ${card.file && navigator.canShare ? `<button type="button" class="action" data-action="share">${icon('i-share')}<span>Compartir</span></button>` : ''}
          ${card.source === 'manual' ? `<a class="action" href="#/nueva?editar=${encodeURIComponent(card.id)}">${icon('i-edit')}<span>Editar</span></a>` : ''}
          <button type="button" class="action action--danger" data-action="delete">${icon('i-trash')}<span>Eliminar</span></button>
        </div>

        ${info.length ? `<section class="panel">
          <h2 class="panel__title">Resumen del vuelo</h2>
          <dl class="kv">${info.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        </section>` : ''}

        <section class="panel">
          <label class="panel__title" for="notes">Notas</label>
          <textarea id="notes" class="textarea" rows="3" placeholder="Maleta facturada, sala VIP, recordatorios…">${esc(card.notes || '')}</textarea>
          <p class="hint" data-notes-state>Se guardan automáticamente en este dispositivo.</p>
        </section>

        ${back ? `<details class="panel panel--details">
          <summary class="panel__title">Información de la aerolínea ${icon('i-chevron')}</summary>
          ${back}
        </details>` : ''}

        <p class="meta">
          ${card.source === 'manual' ? 'Creada manualmente' : `Importada de <b>${esc(card.fileName || 'archivo .pkpass')}</b>`}
          · ${esc(fmtStamp(card.createdAt))}
          ${card.updatedAt && card.updatedAt !== card.createdAt ? `<br>Última modificación: ${esc(fmtStamp(card.updatedAt))}` : ''}
          ${cancelled && card.cancelledAt ? `<br>Cancelada el ${esc(fmtStamp(card.cancelledAt))}` : ''}
        </p>
      </div>
    </div>
  `;

  mountBarcode(root.querySelector('[data-barcode]'), bc);

  const notes = root.querySelector('#notes');
  const notesState = root.querySelector('[data-notes-state]');
  let t;
  notes.addEventListener('input', () => {
    clearTimeout(t);
    notesState.textContent = 'Guardando…';
    t = setTimeout(async () => {
      await setNotes(card.id, notes.value);
      notesState.textContent = 'Guardado';
    }, 500);
  });

  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const a = btn.dataset.action;
    if (a === 'boarding') openBoarding(card, bc);
    if (a === 'cancel') {
      const ok = await confirmDialog({
        title: '¿Marcar como cancelada?',
        message: 'La tarjeta se conservará en el historial y podrás reactivarla cuando quieras.',
        confirm: 'Marcar cancelada',
        danger: true,
      });
      if (!ok) return;
      await setStatus(card.id, 'cancelada');
      toast('Tarjeta marcada como cancelada', { action: 'Deshacer', onAction: async () => { await setStatus(card.id, 'activa'); ctx.refresh(); } });
      ctx.refresh();
    }
    if (a === 'restore') {
      await setStatus(card.id, 'activa');
      toast('Tarjeta reactivada', { tone: 'ok' });
      ctx.refresh();
    }
    if (a === 'download') download(card.file, safeName(card));
    if (a === 'share') {
      const file = new File([card.file], safeName(card), { type: 'application/vnd.apple.pkpass' });
      const data = { files: [file], title: 'Tarjeta de embarque' };
      try {
        if (navigator.canShare(data)) await navigator.share(data);
        else download(card.file, safeName(card));
      } catch (err) {
        if (err.name !== 'AbortError') toast('No se pudo compartir la tarjeta', { tone: 'bad' });
      }
    }
    if (a === 'delete') {
      const ok = await confirmDialog({
        title: '¿Eliminar esta tarjeta?',
        message: 'Se borrará definitivamente de este dispositivo. Esta acción no se puede deshacer.',
        confirm: 'Eliminar',
        danger: true,
      });
      if (!ok) return;
      await db.remove(card.id);
      toast('Tarjeta eliminada');
      location.hash = '#/tarjetas';
    }
  }, { signal: ctx.signal });
}

function safeName(card) {
  const s = card.summary;
  const base = [s.flight, s.origin, s.destination].filter(Boolean).join('-') || 'tarjeta';
  return `${base.replace(/[^\w-]+/g, '_')}.pkpass`;
}

let wakeLock;
async function openBoarding(card, bc) {
  const dlg = document.getElementById('boarding');
  const s = card.summary;
  dlg.innerHTML = `
    <div class="boarding__inner">
      <button type="button" class="icon-btn boarding__close" aria-label="Cerrar">${icon('i-x')}</button>
      <p class="boarding__airline">${esc(s.airline)}${s.flight ? ` · <b>${esc(s.flight)}</b>` : ''}</p>
      <p class="boarding__route"><b>${esc(s.origin)}</b>${icon('i-plane')}<b>${esc(s.destination)}</b></p>
      <div class="boarding__code barcode" data-barcode></div>
      ${bc.altText ? `<p class="boarding__alt mono">${esc(bc.altText)}</p>` : ''}
      <div class="boarding__facts">
        ${s.passenger ? `<span><small>Pasajero</small>${esc(s.passenger)}</span>` : ''}
        ${s.seat ? `<span><small>Asiento</small>${esc(s.seat)}</span>` : ''}
        ${s.gate ? `<span><small>Puerta</small>${esc(s.gate)}</span>` : ''}
        ${s.group ? `<span><small>Grupo</small>${esc(s.group)}</span>` : ''}
      </div>
      <p class="boarding__hint">Sube el brillo de la pantalla para que el lector lo escanee mejor.</p>
    </div>`;
  dlg.querySelector('.boarding__close').onclick = () => dlg.close();
  dlg.onclose = () => { wakeLock?.release().catch(() => {}); wakeLock = null; };
  dlg.showModal();
  mountBarcode(dlg.querySelector('[data-barcode]'), bc);
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
  } catch { /* sin bloqueo de pantalla: no es crítico */ }
}
