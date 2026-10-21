// Panel principal: próximo vuelo y estadísticas.

import { esc, fmtDayLong, fmtTime, fmtMonth, countdown } from '../format.js';
import { listCards, stats, nextFlight, monthly, departureTime, cardState, STATES } from '../cards.js';
import { icon } from '../ui.js';
import { ticketItem } from './ticket.js';

const flaps = (text, n = 3) => [...String(text || '').padEnd(n, ' ').slice(0, Math.max(n, String(text || '').length))]
  .map((ch, i) => `<span class="flap" style="--i:${i}">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('');

export async function renderHome(root, ctx) {
  const cards = await listCards();
  const st = stats(cards);
  const next = nextFlight(cards);
  const today = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  root.innerHTML = `
    <section class="page-head">
      <p class="eyebrow">${esc(today)}</p>
      <h1 class="page-title">Panel de vuelos</h1>
    </section>

    ${next ? heroNext(next) : cards.length ? heroIdle() : heroEmpty()}

    <section class="section" aria-labelledby="h-stats">
      <h2 class="sign" id="h-stats"><span class="sign__pict">${icon('i-chart')}</span>Estadísticas</h2>
      <div class="stats">
        ${tile('total', 'Creadas', st.total, 'tarjetas en el dispositivo', 'i-ticket')}
        ${tile('activa', 'Activas', st.activa, pct(st.activa, st.total), STATES.activa.icon)}
        ${tile('completada', 'Voladas', st.completada, pct(st.completada, st.total), STATES.completada.icon)}
        ${tile('cancelada', 'Canceladas', st.cancelada, pct(st.cancelada, st.total), STATES.cancelada.icon)}
      </div>
      ${st.total ? distribution(st) : ''}
    </section>

    ${st.total ? `
    <section class="section" aria-labelledby="h-months">
      <h2 class="sign" id="h-months"><span class="sign__pict">${icon('i-calendar')}</span>Vuelos por mes</h2>
      ${monthsChart(monthly(cards))}
    </section>` : ''}

    ${upcoming(cards, next)}
  `;

  root.querySelector('[data-action="demo"]')?.addEventListener('click', () => ctx.loadDemo());
  root.querySelector('[data-action="browse"]')?.addEventListener('click', () => ctx.browse());
}

function pct(n, total) {
  if (!total) return 'sin tarjetas aún';
  return `${Math.round((n / total) * 100)} % del total`;
}

function tile(kind, label, value, caption, ic) {
  return `<div class="stat stat--${kind}">
    <div class="stat__head">${icon(ic)}<span>${esc(label)}</span></div>
    <div class="stat__value">${value}</div>
    <div class="stat__caption">${esc(caption)}</div>
  </div>`;
}

function distribution(st) {
  const parts = ['activa', 'completada', 'cancelada'].filter((k) => st[k] > 0);
  return `<div class="dist" role="img" aria-label="${parts.map((k) => `${STATES[k].label}: ${st[k]}`).join(', ')}">
    <div class="dist__bar">
      ${parts.map((k) => `<span class="dist__seg dist__seg--${k}" style="flex-grow:${st[k]}" title="${STATES[k].label}: ${st[k]}"></span>`).join('')}
    </div>
    <ul class="legend">
      ${['activa', 'completada', 'cancelada'].map((k) => `<li><span class="legend__key legend__key--${k}"></span>${STATES[k].label} <b>${st[k]}</b></li>`).join('')}
    </ul>
  </div>`;
}

function monthsChart(months) {
  const max = Math.max(1, ...months.map((m) => m.activa + m.completada + m.cancelada));
  const keys = ['cancelada', 'completada', 'activa'];
  return `<div class="chart">
    <ul class="legend legend--top">
      ${['activa', 'completada', 'cancelada'].map((k) => `<li><span class="legend__key legend__key--${k}"></span>${STATES[k].label}</li>`).join('')}
    </ul>
    <div class="chart__plot" style="--max:${max}">
      <span class="chart__max">${max}</span>
      ${months.map((m) => {
        const total = m.activa + m.completada + m.cancelada;
        const name = fmtMonth(m.year, m.month);
        return `<button type="button" class="chart__col${m.current ? ' is-current' : ''}" aria-label="${esc(name)} ${m.year}: ${total} tarjetas">
          <span class="chart__stack" style="height:${(total / max) * 100}%">
            ${keys.filter((k) => m[k]).map((k) => `<span class="chart__seg chart__seg--${k}" style="flex-grow:${m[k]}"></span>`).join('')}
          </span>
          <span class="chart__label">${esc(name)}</span>
          <span class="chart__tip" role="tooltip">
            <b>${esc(name)} ${m.year}</b>
            ${['activa', 'completada', 'cancelada'].map((k) => `<span><i class="legend__key legend__key--${k}"></i>${STATES[k].label}<b>${m[k]}</b></span>`).join('')}
          </span>
        </button>`;
      }).join('')}
    </div>
    <table class="sr-only">
      <caption>Tarjetas por mes de vuelo</caption>
      <tr><th>Mes</th><th>Activas</th><th>Voladas</th><th>Canceladas</th></tr>
      ${months.map((m) => `<tr><td>${fmtMonth(m.year, m.month)} ${m.year}</td><td>${m.activa}</td><td>${m.completada}</td><td>${m.cancelada}</td></tr>`).join('')}
    </table>
  </div>`;
}

function heroNext(card) {
  const s = card.summary;
  const dep = departureTime(card);
  const chips = [
    s.gate && ['Puerta', s.gate],
    s.seat && ['Asiento', s.seat],
    s.boarding && ['Embarque', fmtTime(s.boarding) || s.boarding],
    s.terminal && ['Terminal', s.terminal],
  ].filter(Boolean);
  return `<section class="board" aria-label="Próximo vuelo">
    <div class="board__top">
      <span class="board__tag">${icon('i-plane')}Próximo vuelo</span>
      <span class="board__count" data-countdown="${dep.at.getTime()}">${esc(countdown(dep.at.getTime()))}</span>
    </div>
    <div class="board__route">
      <div class="board__city"><div class="flaps">${flaps(s.origin)}</div><span>${esc(s.originName)}</span></div>
      <span class="board__arrow">${icon('i-arrow')}</span>
      <div class="board__city board__city--end"><div class="flaps">${flaps(s.destination)}</div><span>${esc(s.destinationName)}</span></div>
    </div>
    <div class="board__meta">
      <span><b>${esc(s.flight || '—')}</b> · ${esc(s.airline)}</span>
      <span>${esc(fmtDayLong(s.departure))}${fmtTime(s.departure) ? ` · <b class="mono">${esc(fmtTime(s.departure))}</b>` : ''}</span>
    </div>
    ${chips.length ? `<div class="board__chips">${chips.map(([l, v]) => `<span class="chip"><small>${esc(l)}</small>${esc(v)}</span>`).join('')}</div>` : ''}
    <a class="btn btn--sign board__cta" href="#/tarjeta/${encodeURIComponent(card.id)}">${icon('i-ticket')}Ver tarjeta de embarque</a>
  </section>`;
}

function heroIdle() {
  return `<section class="board board--idle">
    <div class="board__top"><span class="board__tag">${icon('i-plane')}Sin vuelos próximos</span></div>
    <p class="board__msg">No tienes tarjetas activas con fecha. Añade tu siguiente tarjeta de embarque para verla aquí.</p>
    <a class="btn btn--sign" href="#/nueva">${icon('i-plus')}Añadir tarjeta</a>
  </section>`;
}

function heroEmpty() {
  return `<section class="board board--idle">
    <div class="board__top"><span class="board__tag">${icon('i-plane')}Bienvenido a bordo</span></div>
    <div class="board__route board__route--empty"><div class="flaps">${flaps('HOLA', 4)}</div></div>
    <p class="board__msg">Guarda aquí tus tarjetas de embarque <b>.pkpass</b>. Se quedan solo en este dispositivo y funcionan sin conexión.</p>
    <div class="board__actions">
      <button type="button" class="btn btn--sign" data-action="browse">${icon('i-folder')}Explorar archivos</button>
      <button type="button" class="btn btn--board-ghost" data-action="demo">Probar con ejemplos</button>
    </div>
  </section>`;
}

function upcoming(cards, next) {
  const list = cards.filter((c) => cardState(c) === 'activa' && c !== next).slice(0, 3);
  if (!list.length) return '';
  return `<section class="section" aria-labelledby="h-up">
    <div class="section__head">
      <h2 class="sign" id="h-up"><span class="sign__pict">${icon('i-ticket')}</span>También activas</h2>
      <a class="link" href="#/tarjetas">Ver todas</a>
    </div>
    <div class="tickets">${list.map(ticketItem).join('')}</div>
  </section>`;
}
