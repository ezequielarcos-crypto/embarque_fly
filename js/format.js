// Utilidades de formato en español.

const LOCALE = 'es-ES';

export function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/;

export function isIsoDate(v) {
  return typeof v === 'string' && ISO_RE.test(v.trim());
}

// Hora "de pared" tal como viene escrita en la tarjeta (hora local del aeropuerto),
// sin convertir a la zona horaria del teléfono.
export function wallClock(v) {
  const m = typeof v === 'string' && v.trim().match(ISO_RE);
  if (!m) return null;
  return {
    date: new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0))),
    hasTime: m[4] != null,
  };
}

// Instante real (para comparar con "ahora").
export function instant(v) {
  if (!v) return null;
  const t = Date.parse(v);
  if (!Number.isNaN(t)) return new Date(t);
  const w = wallClock(v);
  return w ? w.date : null;
}

const STYLE = {
  PKDateStyleShort: 'short',
  PKDateStyleMedium: 'medium',
  PKDateStyleLong: 'long',
  PKDateStyleFull: 'full',
};

export function formatPassDate(v, dateStyle, timeStyle) {
  const w = wallClock(v);
  if (!w) return String(v);
  const opts = { timeZone: 'UTC' };
  const ds = STYLE[dateStyle];
  const ts = STYLE[timeStyle];
  if (ds) opts.dateStyle = ds === 'short' ? 'medium' : ds;
  if (ts && w.hasTime) opts.timeStyle = 'short';
  if (!ds && !ts) {
    opts.dateStyle = 'medium';
    if (w.hasTime) opts.timeStyle = 'short';
  }
  return new Intl.DateTimeFormat(LOCALE, opts).format(w.date);
}

export function fmtDay(v) {
  const w = wallClock(v);
  if (!w) return '';
  return new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })
    .format(w.date).replace(/\./g, '');
}

export function fmtDayLong(v) {
  const w = wallClock(v);
  if (!w) return '';
  return new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .format(w.date);
}

export function fmtTime(v) {
  const w = wallClock(v);
  if (!w || !w.hasTime) return '';
  return new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' }).format(w.date);
}

export function fmtStamp(ms) {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms));
}

export function fmtMonth(year, month) {
  return new Intl.DateTimeFormat(LOCALE, { month: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month, 1))).replace('.', '');
}

export function fmtNumber(v, numberStyle, currencyCode) {
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  if (currencyCode) return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: currencyCode }).format(n);
  if (numberStyle === 'PKNumberStylePercent') return new Intl.NumberFormat(LOCALE, { style: 'percent' }).format(n);
  return new Intl.NumberFormat(LOCALE).format(n);
}

export function countdown(target, now = Date.now()) {
  const diff = target - now;
  if (diff <= 0) return 'Embarcando o en vuelo';
  const min = Math.round(diff / 60000);
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d >= 2) return `Sale en ${d} días`;
  if (d === 1) return `Sale en 1 día y ${h} h`;
  if (h > 0) return `Sale en ${h} h ${m} min`;
  return `Sale en ${m} min`;
}

export function fmtBytes(n) {
  if (!n) return '0 KB';
  const u = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0).replace('.', ',')} ${u[i]}`;
}
