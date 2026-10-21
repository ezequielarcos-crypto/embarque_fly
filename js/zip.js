// Lector ZIP mínimo (un .pkpass es un ZIP). Usa DecompressionStream nativo,
// disponible en Chrome Android 103+, sin dependencias externas.

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

export class ZipError extends Error {}

export async function readZip(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (buf.length < 22) throw new ZipError('El archivo está vacío o dañado.');

  let eocd = -1;
  const min = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= min; i--) {
    if (dv.getUint32(i, true) === SIG_EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new ZipError('No es un archivo .pkpass válido.');

  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const utf8 = new TextDecoder('utf-8');
  const entries = new Map();

  for (let n = 0; n < count; n++) {
    if (p + 46 > buf.length || dv.getUint32(p, true) !== SIG_CENTRAL) {
      throw new ZipError('El archivo .pkpass está dañado.');
    }
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true);
    const xlen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = utf8.decode(buf.subarray(p + 46, p + 46 + nlen));
    if (!name.endsWith('/') && !name.startsWith('__MACOSX/')) {
      entries.set(name, { method, csize, local });
    }
    p += 46 + nlen + xlen + clen;
  }

  async function get(name) {
    const e = entries.get(name);
    if (!e) return null;
    if (dv.getUint32(e.local, true) !== SIG_LOCAL) throw new ZipError('Entrada ZIP dañada.');
    const start = e.local + 30 + dv.getUint16(e.local + 26, true) + dv.getUint16(e.local + 28, true);
    const data = buf.subarray(start, start + e.csize);
    if (e.method === 0) return data.slice();
    if (e.method === 8) return inflate(data);
    throw new ZipError('Método de compresión no soportado.');
  }

  return { names: [...entries.keys()], get };
}

async function inflate(data) {
  if (typeof DecompressionStream === 'undefined') {
    throw new ZipError('Tu navegador no puede descomprimir archivos. Actualiza Chrome.');
  }
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
