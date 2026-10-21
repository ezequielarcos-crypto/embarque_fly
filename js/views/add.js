// Añadir tarjetas: explorar archivos .pkpass o crear una manualmente.

import { esc } from '../format.js';
import { db } from '../db.js';
import { saveManual } from '../cards.js';
import { icon, pickFiles, toast } from '../ui.js';

const SWATCHES = [
  ['rgb(21,23,27)', 'rgb(255,255,255)', 'rgb(255,198,41)', 'Noche'],
  ['rgb(16,55,107)', 'rgb(255,255,255)', 'rgb(158,197,255)', 'Atlántico'],
  ['rgb(150,28,46)', 'rgb(255,255,255)', 'rgb(255,196,196)', 'Granate'],
  ['rgb(14,98,81)', 'rgb(255,255,255)', 'rgb(170,232,210)', 'Selva'],
  ['rgb(244,242,236)', 'rgb(21,23,27)', 'rgb(110,104,92)', 'Papel'],
];

export async function renderAdd(root, ctx, params) {
  const editId = params.get('editar');
  const editing = editId ? await db.get(editId) : null;
  const tab = editing || params.get('modo') === 'manual' ? 'manual' : 'archivo';

  root.innerHTML = `
    <section class="page-head">
      <p class="eyebrow">${editing ? 'Editar tarjeta' : 'Nueva tarjeta'}</p>
      <h1 class="page-title">${editing ? 'Editar datos del vuelo' : 'Añadir tarjeta de embarque'}</h1>
    </section>

    ${editing ? '' : `<div class="segmented" role="tablist">
      <button type="button" role="tab" data-tab="archivo" aria-selected="${tab === 'archivo'}">${icon('i-folder')}Desde archivo</button>
      <button type="button" role="tab" data-tab="manual" aria-selected="${tab === 'manual'}">${icon('i-edit')}Crear manualmente</button>
    </div>`}

    <div data-panel="archivo" ${tab === 'archivo' ? '' : 'hidden'}>
      <div class="drop" data-drop tabindex="-1">
        <div class="drop__art">${icon('i-upload')}</div>
        <h2 class="drop__title">Selecciona tu archivo <span class="mono">.pkpass</span></h2>
        <p class="drop__text">Explora la memoria del teléfono —normalmente la carpeta <b>Descargas</b>— y elige una o varias tarjetas.</p>
        <button type="button" class="btn btn--primary btn--lg" data-action="browse">${icon('i-folder')}Explorar archivos</button>
        <p class="drop__hint hide-mobile">o arrastra los archivos aquí</p>
      </div>
      <div data-results></div>
      <section class="tips">
        <h2 class="tips__title">${icon('i-info')}Consejos para Android</h2>
        <ul>
          <li>Si recibiste la tarjeta por correo, descárgala primero: quedará en <b>Descargas</b>.</li>
          <li>Con la app instalada, puedes <b>compartir</b> un archivo .pkpass desde tu gestor de archivos o el correo y elegir <b>Embarque</b>.</li>
          <li>Si el archivo se llama distinto o no tiene extensión, selecciónalo igualmente: lo comprobamos por su contenido.</li>
        </ul>
      </section>
    </div>

    <div data-panel="manual" ${tab === 'manual' ? '' : 'hidden'}>
      ${manualForm(editing?.manual || {}, editing)}
    </div>
  `;

  root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    root.querySelectorAll('[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    root.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== b.dataset.tab; });
  }));

  const results = root.querySelector('[data-results]');
  const handle = async (files) => {
    if (!files.length) return;
    const r = await ctx.importFiles(files, { quiet: true });
    results.innerHTML = resultsHtml(r);
  };

  root.querySelector('[data-action="browse"]').addEventListener('click', async () => handle(await pickFiles()));

  const drop = root.querySelector('[data-drop]');
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('is-over')));
  drop.addEventListener('drop', (e) => { e.preventDefault(); handle([...e.dataTransfer.files]); });

  // Archivos que llegan compartidos desde otra app (Android) o abiertos con la app.
  if (ctx.pendingResults) {
    results.innerHTML = resultsHtml(ctx.pendingResults);
    ctx.pendingResults = null;
  }

  const form = root.querySelector('form[data-manual]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const sw = SWATCHES.find((x) => x[0] === data.color) || SWATCHES[0];
    data.fg = sw[1];
    data.label = sw[2];
    for (const k of ['origin', 'destination']) data[k] = data[k].trim().toUpperCase();
    const card = await saveManual(data, editing?.id);
    toast(editing ? 'Cambios guardados' : 'Tarjeta creada', { tone: 'ok' });
    location.hash = `#/tarjeta/${encodeURIComponent(card.id)}`;
  });
}

function resultsHtml(r) {
  const rows = [
    ...r.added.map((c) => ['ok', 'i-check', 'Añadida', c]),
    ...r.updated.map((c) => ['ok', 'i-restore', 'Actualizada', c]),
  ];
  return `<div class="results">
    ${rows.map(([tone, ic, label, c]) => `<a class="result result--${tone}" href="#/tarjeta/${encodeURIComponent(c.id)}">
      ${icon(ic)}<span><b>${esc(label)}:</b> ${esc([c.summary.flight, [c.summary.origin, c.summary.destination].filter(Boolean).join(' → ')].filter(Boolean).join(' · ') || c.fileName)}</span>${icon('i-chevron-r')}
    </a>`).join('')}
    ${r.errors.map((e) => `<div class="result result--bad">${icon('i-alert')}<span><b>${esc(e.name)}:</b> ${esc(e.message)}</span></div>`).join('')}
  </div>`;
}

function manualForm(d, editing) {
  const v = (k) => esc(d[k] ?? '');
  const input = (name, label, attrs = '', cls = '') => `<label class="field ${cls}"><span>${label}</span><input name="${name}" value="${v(name)}" ${attrs}></label>`;
  return `<form class="form" data-manual autocomplete="off">
    <fieldset class="form__group">
      <legend>Ruta</legend>
      <div class="grid grid--route">
        ${input('origin', 'Origen (código)', 'required maxlength="4" placeholder="MAD" class="code-input" autocapitalize="characters"')}
        ${input('originName', 'Ciudad de origen', 'placeholder="Madrid"')}
        ${input('destination', 'Destino (código)', 'required maxlength="4" placeholder="LIM" class="code-input" autocapitalize="characters"')}
        ${input('destinationName', 'Ciudad de destino', 'placeholder="Lima"')}
      </div>
    </fieldset>
    <fieldset class="form__group">
      <legend>Vuelo</legend>
      <div class="grid">
        ${input('airline', 'Aerolínea', 'required placeholder="Nombre de la aerolínea"')}
        ${input('flight', 'Número de vuelo', 'placeholder="XX1234" autocapitalize="characters"')}
        ${input('date', 'Fecha de salida', 'type="date" required')}
        ${input('time', 'Hora de salida', 'type="time"')}
        ${input('boarding', 'Hora de embarque', 'type="time"')}
        ${input('terminal', 'Terminal', 'placeholder="T4"')}
        ${input('gate', 'Puerta', 'placeholder="J52"')}
      </div>
    </fieldset>
    <fieldset class="form__group">
      <legend>Pasajero</legend>
      <div class="grid">
        ${input('passenger', 'Nombre del pasajero', 'placeholder="Nombre Apellido" autocomplete="name"')}
        ${input('seat', 'Asiento', 'placeholder="12A"')}
        ${input('group', 'Grupo / zona', 'placeholder="2"')}
        ${input('pnr', 'Localizador', 'placeholder="ABC123" autocapitalize="characters"')}
      </div>
    </fieldset>
    <fieldset class="form__group">
      <legend>Código y estilo</legend>
      <div class="grid">
        ${input('barcode', 'Contenido del código (opcional)', 'placeholder="Texto del código QR"', 'field--wide')}
        <label class="field"><span>Tipo de código</span>
          <select name="barcodeFormat">
            ${[['PKBarcodeFormatQR', 'QR'], ['PKBarcodeFormatAztec', 'Aztec'], ['PKBarcodeFormatPDF417', 'PDF417']]
              .map(([k, l]) => `<option value="${k}" ${d.barcodeFormat === k ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="swatches" role="radiogroup" aria-label="Color de la tarjeta">
        ${SWATCHES.map(([bg, , , name], i) => `<label class="swatch" title="${name}">
          <input type="radio" name="color" value="${bg}" ${(d.color ? d.color === bg : i === 0) ? 'checked' : ''}>
          <span style="background:${bg}"></span><small>${name}</small>
        </label>`).join('')}
      </div>
    </fieldset>
    <div class="form__actions">
      ${editing ? `<a class="btn btn--ghost" href="#/tarjeta/${encodeURIComponent(editing.id)}">Cancelar</a>` : ''}
      <button class="btn btn--primary btn--lg" type="submit">${icon('i-check')}${editing ? 'Guardar cambios' : 'Crear tarjeta'}</button>
    </div>
  </form>`;
}
