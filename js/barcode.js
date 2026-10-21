// Renderizado de códigos de barras (QR, PDF417, Aztec, Code128) con bwip-js local.
// La librería se carga solo cuando hace falta.

const BCID = {
  PKBarcodeFormatQR: 'qrcode',
  PKBarcodeFormatPDF417: 'pdf417',
  PKBarcodeFormatAztec: 'azteccode',
  PKBarcodeFormatCode128: 'code128',
};

let loading;

function loadLib() {
  if (window.bwipjs) return Promise.resolve(window.bwipjs);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = new URL('../vendor/bwip-js.min.js', import.meta.url).href;
      s.onload = () => resolve(window.bwipjs);
      s.onerror = () => { loading = null; reject(new Error('No se pudo cargar el generador de códigos.')); };
      document.head.append(s);
    });
  }
  return loading;
}

export function barcodeKind(format) {
  return BCID[format] || 'qrcode';
}

export async function barcodeSvg(barcode) {
  const lib = await loadLib();
  const bcid = barcodeKind(barcode.format);
  const opts = { bcid, text: String(barcode.message), scale: 3, paddingwidth: 0, paddingheight: 0 };
  if (bcid === 'pdf417') opts.rowmult = 3;
  if (bcid === 'code128') Object.assign(opts, { height: 18 });
  if (bcid === 'qrcode') opts.eclevel = 'M';
  return lib.toSVG(opts);
}

export async function mountBarcode(el, barcode) {
  if (!el || !barcode) return;
  el.classList.add('is-loading');
  try {
    el.innerHTML = await barcodeSvg(barcode);
    const svg = el.querySelector('svg');
    svg?.removeAttribute('width');
    svg?.removeAttribute('height');
    svg?.setAttribute('role', 'img');
    svg?.setAttribute('aria-label', 'Código de embarque');
  } catch (e) {
    console.error(e);
    el.innerHTML = '<p class="barcode-error">No se pudo dibujar el código</p>';
  } finally {
    el.classList.remove('is-loading');
  }
}
