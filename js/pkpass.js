// Lectura de archivos .pkpass y extracción de los datos de vuelo.

import { readZip, ZipError } from './zip.js';
import { instant, isIsoDate, formatPassDate, fmtNumber } from './format.js';

export const PASS_STYLES = ['boardingPass', 'eventTicket', 'coupon', 'generic', 'storeCard'];
const IMAGE_NAMES = ['logo', 'icon', 'strip', 'thumbnail', 'footer', 'background'];
const FIELD_GROUPS = ['headerFields', 'primaryFields', 'secondaryFields', 'auxiliaryFields', 'backFields'];

export class PassError extends Error {}

export async function parsePkpass(file) {
  let zip;
  try {
    zip = await readZip(file);
  } catch (e) {
    throw new PassError(e instanceof ZipError ? e.message : 'No se pudo leer el archivo.');
  }

  // pass.json suele estar en la raíz, pero algunos generadores lo meten en una carpeta.
  const passPath = zip.names
    .filter((n) => n === 'pass.json' || n.endsWith('/pass.json'))
    .sort((a, b) => a.length - b.length)[0];
  if (!passPath) throw new PassError('El archivo no contiene pass.json: no es una tarjeta de embarque.');
  const root = passPath.slice(0, -'pass.json'.length);

  const raw = new TextDecoder('utf-8').decode(await zip.get(passPath)).replace(/^\uFEFF/, '');
  let pass;
  try {
    pass = JSON.parse(raw);
  } catch {
    try {
      pass = JSON.parse(raw.replace(/,\s*([}\]])/g, '$1'));
    } catch {
      throw new PassError('El contenido de la tarjeta (pass.json) está dañado.');
    }
  }
  if (!pass || typeof pass !== 'object' || !PASS_STYLES.some((s) => pass[s])) {
    throw new PassError('El archivo no tiene un formato de tarjeta reconocible.');
  }

  const lproj = pickLanguage(zip.names, root);
  const strings = lproj ? await readStrings(zip, `${root}${lproj}/pass.strings`) : {};
  localize(pass, strings);

  const images = {};
  for (const name of IMAGE_NAMES) {
    const candidates = [];
    for (const dir of [lproj ? `${root}${lproj}/` : null, root]) {
      if (dir == null) continue;
      candidates.push(`${dir}${name}@2x.png`, `${dir}${name}@3x.png`, `${dir}${name}.png`);
    }
    const found = candidates.find((c) => zip.names.includes(c));
    if (found) images[name] = new Blob([await zip.get(found)], { type: 'image/png' });
  }

  return { pass, images };
}

function pickLanguage(names, root) {
  const langs = [...new Set(
    names
      .filter((n) => n.startsWith(root))
      .map((n) => n.slice(root.length).match(/^([^/]+)\.lproj\//)?.[1])
      .filter(Boolean),
  )];
  if (!langs.length) return null;
  const wanted = [...(navigator.languages || []), 'es', 'en'].map((l) => l.toLowerCase());
  for (const w of wanted) {
    const exact = langs.find((l) => l.toLowerCase().replace('_', '-') === w);
    if (exact) return `${exact}.lproj`;
    const base = langs.find((l) => l.toLowerCase().split(/[-_]/)[0] === w.split('-')[0]);
    if (base) return `${base}.lproj`;
  }
  return `${langs[0]}.lproj`;
}

async function readStrings(zip, path) {
  const bytes = await zip.get(path);
  if (!bytes) return {};
  let enc = 'utf-8';
  if (bytes[0] === 0xff && bytes[1] === 0xfe) enc = 'utf-16le';
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) enc = 'utf-16be';
  else if (bytes.length > 1 && bytes[1] === 0) enc = 'utf-16le';
  const text = new TextDecoder(enc).decode(bytes).replace(/^\uFEFF/, '');
  const out = {};
  const re = /"((?:[^"\\]|\\.)*)"\s*=\s*"((?:[^"\\]|\\.)*)"\s*;/g;
  const unescape = (s) => s.replace(/\\n/g, '\n').replace(/\\(["\\])/g, '$1');
  let m;
  while ((m = re.exec(text))) out[unescape(m[1])] = unescape(m[2]);
  return out;
}

function localize(pass, strings) {
  if (!Object.keys(strings).length) return;
  const t = (v) => (typeof v === 'string' && strings[v] != null ? strings[v] : v);
  for (const k of ['organizationName', 'description', 'logoText']) pass[k] = t(pass[k]);
  const style = pass[passStyle(pass)];
  for (const g of FIELD_GROUPS) {
    for (const f of style?.[g] || []) {
      f.label = t(f.label);
      f.value = t(f.value);
    }
  }
}

export function passStyle(pass) {
  return PASS_STYLES.find((s) => pass?.[s]) || 'generic';
}

export function passFields(pass) {
  const style = pass?.[passStyle(pass)] || {};
  const out = {};
  for (const g of FIELD_GROUPS) out[g] = Array.isArray(style[g]) ? style[g] : [];
  out.transitType = style.transitType;
  return out;
}

export function passBarcode(pass) {
  const list = Array.isArray(pass?.barcodes) && pass.barcodes.length ? pass.barcodes : pass?.barcode ? [pass.barcode] : [];
  return list.find((b) => b && b.message) || null;
}

export function fieldText(f) {
  if (!f) return '';
  const v = f.value;
  if (v == null) return '';
  if ((f.dateStyle || f.timeStyle) && isIsoDate(v)) return formatPassDate(v, f.dateStyle, f.timeStyle);
  if (typeof v === 'number' || f.currencyCode || f.numberStyle) return fmtNumber(v, f.numberStyle, f.currencyCode);
  return String(v);
}

// Resumen normalizado para listas, estadísticas y búsquedas.
export function summarize(pass) {
  const sem = pass.semantics || {};
  const fields = passFields(pass);
  const all = FIELD_GROUPS.filter((g) => g !== 'backFields').flatMap((g) => fields[g]);
  const back = fields.backFields;
  const find = (re, list = all) => list.find((f) => re.test(`${f.key || ''} ${f.label || ''}`));
  const val = (f) => (f ? fieldText(f) : '');

  const [o, d] = fields.primaryFields;
  const origin = sem.departureAirportCode || (o ? String(o.value ?? '') : '');
  const destination = sem.destinationAirportCode || (d ? String(d.value ?? '') : '');
  const originName = sem.departureLocationDescription || sem.departureAirportName || (o?.label ?? '');
  const destinationName = sem.destinationLocationDescription || sem.destinationAirportName || (d?.label ?? '');

  let flight = sem.flightCode || (sem.airlineCode && sem.flightNumber ? `${sem.airlineCode}${sem.flightNumber}` : '');
  if (!flight) flight = val(find(/fl(igh)?t|vuelo|\bvol\b|flug/i));

  const dateField = all.find((f) => /depart|salida|date|fecha|board|embarque/i.test(`${f.key} ${f.label}`) && isIsoDate(f.value))
    || all.find((f) => isIsoDate(f.value));
  const departure = sem.currentDepartureDate || sem.originalDepartureDate || dateField?.value
    || pass.relevantDate || pass.relevantDates?.[0]?.startDate || pass.relevantDates?.[0]?.date || pass.expirationDate || '';

  let passenger = '';
  if (sem.passengerName) {
    const n = sem.passengerName;
    passenger = [n.givenName, n.familyName].filter(Boolean).join(' ');
  }
  if (!passenger) passenger = val(find(/passenger|pasajer|\bname\b|nombre|traveller|viajero/i) || find(/passenger|pasajer|nombre/i, back));

  return {
    style: passStyle(pass),
    airline: pass.organizationName || sem.airlineName || '',
    description: pass.description || '',
    origin: shortCode(origin),
    originName: originName && originName !== origin ? String(originName) : '',
    destination: shortCode(destination),
    destinationName: destinationName && destinationName !== destination ? String(destinationName) : '',
    flight,
    departure: departure && instant(departure) ? departure : '',
    boarding: sem.originalBoardingDate || sem.currentBoardingDate || val(find(/board.*time|hora.*embar|boarding/i)),
    seat: sem.seats?.[0]?.seatNumber ? `${sem.seats[0].seatRow || ''}${sem.seats[0].seatNumber}` : val(find(/seat|asiento|plaza/i)),
    gate: sem.departureGate || val(find(/gate|puerta/i)),
    terminal: sem.departureTerminal || val(find(/terminal/i)),
    group: val(find(/group|grupo|zone|zona|sequence|secuencia/i)),
    cabin: val(find(/class|clase|cabin|cabina/i)),
    passenger,
    pnr: sem.confirmationNumber || val(find(/pnr|confirm|localizador|reserva|booking|record/i) || find(/pnr|localizador|reserva|booking/i, back)),
    voided: pass.voided === true,
  };
}

function shortCode(v) {
  const s = String(v || '').trim();
  return s.length > 12 ? s.slice(0, 12) : s;
}

// Construye un pass.json equivalente a partir del formulario de creación manual.
export function buildManualPass(d) {
  const iso = d.date ? `${d.date}${d.time ? `T${d.time}` : ''}` : '';
  const f = (key, label, value, extra = {}) => (value ? [{ key, label, value, ...extra }] : []);
  return {
    formatVersion: 1,
    organizationName: d.airline || 'Mi vuelo',
    description: `Tarjeta de embarque ${d.flight || ''}`.trim(),
    logoText: d.airline || '',
    backgroundColor: d.color || 'rgb(21,23,27)',
    foregroundColor: d.fg || 'rgb(255,255,255)',
    labelColor: d.label || 'rgb(255,198,41)',
    relevantDate: iso || undefined,
    boardingPass: {
      transitType: 'PKTransitTypeAir',
      headerFields: f('gate', 'PUERTA', d.gate),
      primaryFields: [
        { key: 'origin', label: d.originName || 'Origen', value: (d.origin || '---').toUpperCase() },
        { key: 'destination', label: d.destinationName || 'Destino', value: (d.destination || '---').toUpperCase() },
      ],
      secondaryFields: [
        ...f('passenger', 'PASAJERO', d.passenger),
        ...f('flight', 'VUELO', d.flight?.toUpperCase()),
      ],
      auxiliaryFields: [
        ...f('departure', 'SALIDA', iso, { dateStyle: 'PKDateStyleMedium', timeStyle: 'PKDateStyleShort' }),
        ...f('boarding', 'EMBARQUE', d.boarding),
        ...f('seat', 'ASIENTO', d.seat?.toUpperCase()),
        ...f('group', 'GRUPO', d.group),
      ],
      backFields: [
        ...f('pnr', 'Localizador', d.pnr?.toUpperCase()),
        ...f('terminal', 'Terminal', d.terminal),
      ],
    },
    ...(d.barcode ? { barcodes: [{ format: d.barcodeFormat || 'PKBarcodeFormatQR', message: d.barcode, messageEncoding: 'iso-8859-1' }] } : {}),
  };
}
