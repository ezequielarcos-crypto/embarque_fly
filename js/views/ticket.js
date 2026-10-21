// Elemento de lista con forma de billete (talón troquelado).

import { esc, fmtDay, fmtTime } from '../format.js';
import { cardState } from '../cards.js';
import { passColors } from '../render-pass.js';
import { icon, stateBadge } from '../ui.js';

export function ticketItem(card) {
  const s = card.summary || {};
  const state = cardState(card);
  const color = passColors(card.pass).bg;
  const route = s.origin || s.destination
    ? `<div class="ticket__route">
        <div class="ticket__city"><b class="code">${esc(s.origin || '—')}</b><small>${esc(s.originName)}</small></div>
        <span class="ticket__path">${icon('i-plane')}</span>
        <div class="ticket__city ticket__city--end"><b class="code">${esc(s.destination || '—')}</b><small>${esc(s.destinationName)}</small></div>
      </div>`
    : `<div class="ticket__route"><b class="ticket__desc">${esc(s.description || 'Tarjeta')}</b></div>`;

  return `<a class="ticket ticket--${state}" href="#/tarjeta/${encodeURIComponent(card.id)}" style="--accent:${color}">
    <div class="ticket__main">
      <div class="ticket__top">
        <span class="ticket__airline">${esc(s.airline || 'Aerolínea')}</span>
        ${s.flight ? `<span class="ticket__flight mono">${esc(s.flight)}</span>` : ''}
      </div>
      ${route}
    </div>
    <div class="ticket__stub">
      <span class="ticket__date">${esc(fmtDay(s.departure) || 'Sin fecha')}</span>
      <span class="ticket__time mono">${esc(fmtTime(s.departure) || '--:--')}</span>
      ${s.seat ? `<span class="ticket__seat">${icon('i-seat')}${esc(s.seat)}</span>` : ''}
      ${stateBadge(state)}
    </div>
  </a>`;
}
