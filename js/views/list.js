// Listado de tarjetas con búsqueda y filtros por estado.

import { esc } from '../format.js';
import { listCards, cardState, sortKey, stats } from '../cards.js';
import { icon } from '../ui.js';
import { ticketItem } from './ticket.js';

const FILTERS = [
  ['todas', 'Todas'],
  ['activa', 'Activas'],
  ['completada', 'Voladas'],
  ['cancelada', 'Canceladas'],
];

let current = { filter: 'todas', q: '' };

export async function renderList(root, ctx, params) {
  const cards = await listCards();
  const st = stats(cards);
  if (params.get('estado')) current.filter = params.get('estado');

  root.innerHTML = `
    <section class="page-head page-head--row">
      <div>
        <p class="eyebrow">${st.total} ${st.total === 1 ? 'tarjeta guardada' : 'tarjetas guardadas'}</p>
        <h1 class="page-title">Mis tarjetas</h1>
      </div>
      <a class="btn btn--primary hide-mobile" href="#/nueva">${icon('i-plus')}Añadir</a>
    </section>
    ${cards.length ? `
    <div class="toolbar">
      <label class="search">
        ${icon('i-search')}
        <input type="search" placeholder="Buscar vuelo, destino, aerolínea…" value="${esc(current.q)}" aria-label="Buscar tarjetas" autocomplete="off">
      </label>
      <div class="chips" role="tablist" aria-label="Filtrar por estado">
        ${FILTERS.map(([k, l]) => `<button type="button" role="tab" class="filter" data-filter="${k}" aria-selected="${current.filter === k}">
          ${esc(l)}<span class="filter__n">${k === 'todas' ? st.total : st[k]}</span></button>`).join('')}
      </div>
    </div>
    <div class="tickets" data-list></div>` : empty()}
  `;

  if (!cards.length) {
    root.querySelector('[data-action="demo"]')?.addEventListener('click', () => ctx.loadDemo());
    root.querySelector('[data-action="browse"]')?.addEventListener('click', () => ctx.browse());
    return;
  }

  const listEl = root.querySelector('[data-list]');
  const draw = () => {
    const q = current.q.trim().toLowerCase();
    const order = { activa: 0, completada: 1, cancelada: 2 };
    const items = cards
      .map((c) => ({ c, state: cardState(c) }))
      .filter(({ state }) => current.filter === 'todas' || state === current.filter)
      .filter(({ c }) => !q || haystack(c).includes(q))
      // Activas: la más próxima primero. Voladas y canceladas: la más reciente primero.
      .sort((a, b) => order[a.state] - order[b.state] || (a.state === 'activa' ? sortKey(a.c) - sortKey(b.c) : sortKey(b.c) - sortKey(a.c)));
    listEl.innerHTML = items.length
      ? items.map(({ c }) => ticketItem(c)).join('')
      : `<p class="muted-box">${icon('i-search')}No hay tarjetas que coincidan.</p>`;
  };
  draw();

  root.querySelector('input[type="search"]').addEventListener('input', (e) => { current.q = e.target.value; draw(); });
  root.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => {
    current.filter = b.dataset.filter;
    root.querySelectorAll('[data-filter]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    draw();
  }));
}

function haystack(c) {
  const s = c.summary || {};
  return [s.airline, s.flight, s.origin, s.originName, s.destination, s.destinationName, s.passenger, s.pnr, s.description, c.notes]
    .filter(Boolean).join(' ').toLowerCase();
}

function empty() {
  return `<div class="empty">
    <div class="empty__art">${icon('i-ticket')}</div>
    <h2>Aún no tienes tarjetas</h2>
    <p>Busca el archivo <b>.pkpass</b> en la memoria del teléfono (normalmente en <i>Descargas</i>) y añádelo.</p>
    <div class="empty__actions">
      <button type="button" class="btn btn--primary" data-action="browse">${icon('i-folder')}Explorar archivos</button>
      <button type="button" class="btn btn--ghost" data-action="demo">Probar con ejemplos</button>
    </div>
  </div>`;
}
