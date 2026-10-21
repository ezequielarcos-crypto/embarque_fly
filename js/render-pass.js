// Dibuja la tarjeta con el aspecto definido en su pass.json (colores, logo, campos).

import { esc } from './format.js';
import { passFields, passBarcode, fieldText } from './pkpass.js';
import { blobUrl, icon } from './ui.js';

const COLOR_RE = /^(rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\)|#[0-9a-f]{3,8})$/i;
const safeColor = (c, fallback) => (typeof c === 'string' && COLOR_RE.test(c.trim()) ? c.trim() : fallback);

const TRANSIT = {
  PKTransitTypeAir: 'i-plane',
  PKTransitTypeTrain: 'i-train',
  PKTransitTypeBus: 'i-bus',
  PKTransitTypeBoat: 'i-boat',
};

const ALIGN = {
  PKTextAlignmentLeft: 'left',
  PKTextAlignmentCenter: 'center',
  PKTextAlignmentRight: 'right',
  PKTextAlignmentNatural: 'left',
};

function field(f, cls = '') {
  const align = ALIGN[f.textAlignment] ? ` style="text-align:${ALIGN[f.textAlignment]}"` : '';
  return `<div class="pf ${cls}"${align}>
    <span class="pf__label">${esc(f.label ?? '')}</span>
    <span class="pf__value">${esc(fieldText(f)) || '&nbsp;'}</span>
  </div>`;
}

const row = (list, cls) => (list.length ? `<div class="pass__row ${cls}">${list.map((f) => field(f)).join('')}</div>` : '');

export function passColors(pass) {
  return {
    bg: safeColor(pass.backgroundColor, '#f4f2ec'),
    fg: safeColor(pass.foregroundColor, '#15171b'),
    label: safeColor(pass.labelColor, safeColor(pass.foregroundColor, '#5a5e66')),
  };
}

export function renderPass(card, { barcode = true } = {}) {
  const { pass, images = {} } = card;
  const f = passFields(pass);
  const c = passColors(pass);
  const bc = passBarcode(pass);
  const isBoarding = card.summary?.style === 'boardingPass';
  const bgImg = images.background && !images.strip ? blobUrl(images.background) : '';

  let primary = '';
  if (isBoarding && f.primaryFields.length >= 2) {
    const [o, d, ...rest] = f.primaryFields;
    primary = `<div class="pass__primary pass__primary--route">
      ${field(o, 'pf--big')}
      <span class="pass__transit">${icon(TRANSIT[f.transitType] || 'i-arrow')}</span>
      ${field(d, 'pf--big pf--end')}
      ${rest.map((x) => field(x)).join('')}
    </div>`;
  } else if (f.primaryFields.length) {
    primary = `<div class="pass__primary">
      ${f.primaryFields.map((x) => field(x, 'pf--big')).join('')}
      ${images.thumbnail ? `<img class="pass__thumb" src="${blobUrl(images.thumbnail)}" alt="">` : ''}
    </div>`;
  }

  return `<article class="pass${bgImg ? ' pass--bgimg' : ''}" style="--pass-bg:${c.bg};--pass-fg:${c.fg};--pass-label:${c.label}">
    ${bgImg ? `<div class="pass__bgimg" style="background-image:url('${bgImg}')"></div>` : ''}
    <header class="pass__head">
      <div class="pass__brand">
        ${images.logo ? `<img class="pass__logo" src="${blobUrl(images.logo)}" alt="">` : ''}
        ${pass.logoText ? `<span class="pass__logotext">${esc(pass.logoText)}</span>` : ''}
        ${!images.logo && !pass.logoText ? `<span class="pass__logotext">${esc(pass.organizationName || '')}</span>` : ''}
      </div>
      <div class="pass__header">${f.headerFields.map((x) => field(x, 'pf--end')).join('')}</div>
    </header>
    ${images.strip ? `<img class="pass__strip" src="${blobUrl(images.strip)}" alt="">` : ''}
    ${primary}
    ${row(f.secondaryFields, 'pass__row--secondary')}
    ${row(f.auxiliaryFields, 'pass__row--aux')}
    ${images.footer ? `<img class="pass__footer" src="${blobUrl(images.footer)}" alt="">` : ''}
    ${barcode && bc ? `
      <button type="button" class="pass__barcode" data-action="boarding" aria-label="Mostrar código a pantalla completa">
        <div class="barcode barcode--${esc(bc.format || 'qr')}" data-barcode></div>
        ${bc.altText ? `<span class="pass__alt">${esc(bc.altText)}</span>` : ''}
      </button>` : ''}
    ${card.status === 'cancelada' ? `<div class="pass__void" aria-hidden="true">CANCELADA</div>` : ''}
  </article>`;
}

export function renderBackFields(pass) {
  const back = passFields(pass).backFields.filter((f) => f.value != null && f.value !== '');
  if (!back.length) return '';
  return `<dl class="backfields">${back.map((f) => `
    <div class="backfields__item">
      <dt>${esc(f.label || '')}</dt>
      <dd>${linkify(fieldText(f))}</dd>
    </div>`).join('')}</dl>`;
}

function linkify(text) {
  return esc(text)
    .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\n/g, '<br>');
}
