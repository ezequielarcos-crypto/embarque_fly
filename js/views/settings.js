// Ajustes: instalación, almacenamiento local, copias de seguridad y tema.

import { esc, fmtBytes } from '../format.js';
import { db } from '../db.js';
import { exportBackup, importBackup } from '../cards.js';
import { icon, toast, confirmDialog, download, pickFiles } from '../ui.js';

export async function renderSettings(root, ctx) {
  const cards = await db.all();
  const est = await navigator.storage?.estimate?.().catch(() => null);
  const persisted = await navigator.storage?.persisted?.().catch(() => false);
  const theme = ctx.getTheme();

  root.innerHTML = `
    <section class="page-head">
      <p class="eyebrow">Configuración</p>
      <h1 class="page-title">Ajustes</h1>
    </section>

    <div class="settings">
      <section class="panel">
        <h2 class="panel__title">${icon('i-install')}Aplicación</h2>
        ${ctx.isStandalone()
          ? '<p class="hint">Embarque está instalada en este dispositivo.</p>'
          : `<p class="hint">Instálala para abrirla desde la pantalla de inicio, usarla sin conexión y recibir archivos .pkpass compartidos.</p>
             <button type="button" class="btn btn--primary" data-action="install" ${ctx.canInstall() ? '' : 'disabled'}>${icon('i-install')}Instalar app</button>
             ${ctx.canInstall() ? '' : '<p class="hint hint--small">Si el botón no se activa, abre el menú de Chrome (⋮) y pulsa <b>Instalar aplicación</b> o <b>Añadir a pantalla de inicio</b>.</p>'}`}
      </section>

      <section class="panel">
        <h2 class="panel__title">${icon('i-palette')}Apariencia</h2>
        <div class="segmented segmented--small" role="radiogroup" aria-label="Tema">
          ${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([k, l]) =>
            `<button type="button" role="radio" data-theme-opt="${k}" aria-checked="${theme === k}" aria-selected="${theme === k}">${l}</button>`).join('')}
        </div>
      </section>

      <section class="panel">
        <h2 class="panel__title">${icon('i-lock')}Datos locales</h2>
        <dl class="kv kv--inline">
          <div><dt>Tarjetas guardadas</dt><dd>${cards.length}</dd></div>
          ${est ? `<div><dt>Espacio usado</dt><dd>${esc(fmtBytes(est.usage))}</dd></div>` : ''}
          <div><dt>Almacenamiento persistente</dt><dd>${persisted ? 'Activado' : 'No activado'}</dd></div>
        </dl>
        <p class="hint">Todo se guarda únicamente en este dispositivo. Nada se envía a ningún servidor.</p>
        ${persisted ? '' : `<button type="button" class="btn btn--ghost" data-action="persist">${icon('i-lock')}Proteger datos frente a limpiezas</button>`}
      </section>

      <section class="panel">
        <h2 class="panel__title">${icon('i-download')}Copia de seguridad</h2>
        <p class="hint">Exporta tus tarjetas a un archivo para guardarlo o pasarlo a otro teléfono.</p>
        <div class="row-btns">
          <button type="button" class="btn btn--ghost" data-action="export" ${cards.length ? '' : 'disabled'}>${icon('i-download')}Exportar copia</button>
          <button type="button" class="btn btn--ghost" data-action="import">${icon('i-upload')}Importar copia</button>
        </div>
      </section>

      <section class="panel panel--danger">
        <h2 class="panel__title">${icon('i-trash')}Zona peligrosa</h2>
        <p class="hint">Elimina todas las tarjetas y estadísticas de este dispositivo.</p>
        <button type="button" class="btn btn--danger" data-action="wipe" ${cards.length ? '' : 'disabled'}>${icon('i-trash')}Borrar todos los datos</button>
      </section>

      <p class="meta">Embarque · versión ${esc(ctx.version)} · Funciona sin conexión</p>
    </div>
  `;

  root.querySelectorAll('[data-theme-opt]').forEach((b) => b.addEventListener('click', () => {
    ctx.setTheme(b.dataset.themeOpt);
    root.querySelectorAll('[data-theme-opt]').forEach((x) => {
      x.setAttribute('aria-checked', String(x === b));
      x.setAttribute('aria-selected', String(x === b));
    });
  }));

  root.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-action]')?.dataset.action;
    if (a === 'install') ctx.install();
    if (a === 'persist') {
      const ok = await navigator.storage?.persist?.();
      toast(ok ? 'Datos protegidos' : 'El navegador no lo ha permitido. Instalar la app suele ayudar.', { tone: ok ? 'ok' : 'info' });
      ctx.refresh();
    }
    if (a === 'export') {
      const blob = await exportBackup();
      download(blob, `embarque-copia-${new Date().toISOString().slice(0, 10)}.json`);
    }
    if (a === 'import') {
      const [file] = await pickFiles({ multiple: false });
      if (!file) return;
      try {
        const n = await importBackup(file);
        toast(`${n} ${n === 1 ? 'tarjeta restaurada' : 'tarjetas restauradas'}`, { tone: 'ok' });
        ctx.refresh();
      } catch (err) {
        toast(err.message, { tone: 'bad' });
      }
    }
    if (a === 'wipe') {
      const ok = await confirmDialog({
        title: '¿Borrar todos los datos?',
        message: `Se eliminarán ${cards.length} tarjetas de este dispositivo. Exporta una copia antes si quieres conservarlas.`,
        confirm: 'Borrar todo',
        danger: true,
      });
      if (!ok) return;
      await db.clear();
      toast('Datos eliminados');
      ctx.refresh();
    }
  }, { signal: ctx.signal });
}
