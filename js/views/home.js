// Panel principal: próximo vuelo y resto de tarjetas activas.

import { esc, fmtDayLong, fmtTime, countdown } from '../format.js';
import { listCards, nextFlight, departureTime, cardState } from '../cards.js';
import { icon } from '../ui.js';
import { ticketItem } from './ticket.js';

const flaps = (text, n = 3) => [...String(text || '').padEnd(n, ' ').slice(0, Math.max(n, String(text || '').length))]
  .map((ch, i) => `<span class="flap" style="--i:${i}">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('');

export async function renderHome(root, ctx) {
  const cards = await listCards();
  const next = nextFlight(cards);
  const today = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  root.innerHTML = `
    <section class="page-head">
      <p class="eyebrow">${esc(today)}</p>
      <h1 class="page-title">Panel de vuelos</h1>
    </section>

    ${next ? heroNext(next) : cards.length ? heroIdle() : heroEmpty()}

    ${upcoming(cards, next)}
  `;

  root.querySelector('[data-action="demo"]')?.addEventListener('click', () => ctx.loadDemo());
  root.querySelector('[data-action="browse"]')?.addEventListener('click', () => ctx.browse());
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
