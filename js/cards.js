// Lógica de negocio de las tarjetas: importación, estado y estadísticas.

import { db, uid } from './db.js';
import { parsePkpass, summarize, buildManualPass, PassError } from './pkpass.js';
import { instant, wallClock } from './format.js';

export const STATES = {
  activa: { label: 'Activa', icon: 'i-check' },
  completada: { label: 'Volada', icon: 'i-flag' },
  cancelada: { label: 'Cancelada', icon: 'i-ban' },
};

// Una tarjeta cuenta como "volada" 3 horas después de la salida
// (o al terminar el día si solo hay fecha).
export function departureTime(card) {
  const dep = card.summary?.departure;
  if (!dep) return null;
  const w = wallClock(dep);
  const t = instant(dep);
  if (!t) return null;
  return { at: t, hasTime: w ? w.hasTime : true };
}

export function cardState(card, now = Date.now()) {
  if (card.status === 'cancelada') return 'cancelada';
  const d = departureTime(card);
  if (d) {
    const end = d.hasTime ? d.at.getTime() + 3 * 3600e3 : d.at.getTime() + 24 * 3600e3;
    if (now > end) return 'completada';
  }
  return 'activa';
}

export function sortKey(card) {
  return departureTime(card)?.at.getTime() ?? card.createdAt;
}

export async function listCards() {
  const cards = await db.all();
  return cards.sort((a, b) => sortKey(a) - sortKey(b));
}

export async function importFile(file) {
  const { pass, images } = await parsePkpass(file);
  const summary = summarize(pass);
  const passKey = pass.passTypeIdentifier && pass.serialNumber ? `${pass.passTypeIdentifier}|${pass.serialNumber}` : null;
  const now = Date.now();
  const existing = passKey ? await db.byPassKey(passKey) : null;

  const card = {
    ...(existing || {}),
    id: existing?.id || uid(),
    passKey,
    source: 'pkpass',
    status: existing?.status || (summary.voided ? 'cancelada' : 'activa'),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    notes: existing?.notes || '',
    pass,
    images,
    summary,
    file: new Blob([await file.arrayBuffer()], { type: 'application/vnd.apple.pkpass' }),
    fileName: file.name || 'tarjeta.pkpass',
  };
  if (summary.voided && !existing) card.cancelledAt = now;
  await db.put(card);
  return { card, updated: Boolean(existing) };
}

export async function importFiles(files) {
  const results = { added: [], updated: [], errors: [] };
  for (const file of files) {
    try {
      const r = await importFile(file);
      (r.updated ? results.updated : results.added).push(r.card);
    } catch (e) {
      results.errors.push({ name: file.name || 'archivo', message: e instanceof PassError ? e.message : 'No se pudo importar el archivo.' });
      if (!(e instanceof PassError)) console.error(e);
    }
  }
  return results;
}

export async function saveManual(data, existingId) {
  const pass = buildManualPass(data);
  const existing = existingId ? await db.get(existingId) : null;
  const now = Date.now();
  const card = {
    ...(existing || {}),
    id: existing?.id || uid(),
    passKey: null,
    source: 'manual',
    status: existing?.status || 'activa',
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    notes: existing?.notes || '',
    pass,
    images: {},
    summary: summarize(pass),
    manual: data,
  };
  await db.put(card);
  return card;
}

export async function setStatus(id, status) {
  const card = await db.get(id);
  if (!card) return null;
  card.status = status;
  card.updatedAt = Date.now();
  if (status === 'cancelada') card.cancelledAt = card.updatedAt;
  else delete card.cancelledAt;
  await db.put(card);
  return card;
}

export async function setNotes(id, notes) {
  const card = await db.get(id);
  if (!card) return null;
  card.notes = notes;
  card.updatedAt = Date.now();
  await db.put(card);
  return card;
}

export function stats(cards, now = Date.now()) {
  const s = { total: cards.length, activa: 0, completada: 0, cancelada: 0 };
  for (const c of cards) s[cardState(c, now)]++;
  return s;
}

export function nextFlight(cards, now = Date.now()) {
  return cards
    .filter((c) => cardState(c, now) === 'activa' && departureTime(c))
    .sort((a, b) => sortKey(a) - sortKey(b))[0] || null;
}

// Tarjetas agrupadas por mes de vuelo: 5 meses atrás + mes actual + 6 por delante.
export function monthly(cards, now = new Date()) {
  const months = [];
  for (let i = -5; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth(), current: i === 0, activa: 0, completada: 0, cancelada: 0 });
  }
  for (const c of cards) {
    const w = wallClock(c.summary?.departure) || { date: new Date(c.createdAt) };
    const y = w.date.getUTCFullYear();
    const m = w.date.getUTCMonth();
    const slot = months.find((x) => x.year === y && x.month === m);
    if (slot) slot[cardState(c, now.getTime())]++;
  }
  return months;
}

// Copia de seguridad: los Blobs se convierten a data URL para guardarlos en JSON.
export async function exportBackup() {
  const cards = await db.all();
  const out = [];
  for (const c of cards) {
    const images = {};
    for (const [k, b] of Object.entries(c.images || {})) images[k] = await blobToDataUrl(b);
    out.push({ ...c, images, file: c.file ? await blobToDataUrl(c.file) : null });
  }
  return new Blob([JSON.stringify({ app: 'embarque', version: 1, exportedAt: new Date().toISOString(), cards: out })], { type: 'application/json' });
}

export async function importBackup(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('El archivo no es una copia de seguridad válida.');
  }
  if (data?.app !== 'embarque' || !Array.isArray(data.cards)) throw new Error('El archivo no es una copia de seguridad de Embarque.');
  let n = 0;
  for (const c of data.cards) {
    if (!c?.id || !c.pass) continue;
    const images = {};
    for (const [k, u] of Object.entries(c.images || {})) {
      const b = await dataUrlToBlob(u);
      if (b) images[k] = b;
    }
    await db.put({ ...c, images, file: (await dataUrlToBlob(c.file)) || undefined, summary: summarize(c.pass) });
    n++;
  }
  return n;
}

async function dataUrlToBlob(u) {
  if (typeof u !== 'string' || !u.startsWith('data:')) return null;
  return (await fetch(u)).blob();
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
