/**
 * Utilitas Pencetakan Thermal Terisolasi via Iframe
 * Menghindari modal overlay, background gelap, dan terpotongnya kertas saat window.print() dipanggil.
 */

export interface PrintThermalOptions {
  paperWidth?: '58mm' | '80mm';
  title?: string;
  onAfterPrint?: () => void;
}

export const printElementViaThermalIframe = (
  elementId: string,
  options: PrintThermalOptions = {}
): boolean => {
  const { paperWidth = '80mm', title = 'Struk POS', onAfterPrint } = options;
  const targetEl = document.getElementById(elementId);

  if (!targetEl) {
    console.warn(`Elemen cetak dengan id #${elementId} tidak ditemukan, fallback ke window.print`);
    window.print();
    return false;
  }

  // Gunakan atau buat iframe tersembunyi
  let iframe = document.getElementById('thermal-print-iframe') as HTMLIFrameElement | null;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'thermal-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.opacity = '0.01';
    iframe.style.pointerEvents = 'none';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
  }

  const widthMm = paperWidth === '58mm' ? '48mm' : '72mm';
  const sizeMm = paperWidth === '58mm' ? '58mm' : '80mm';
  const fontSize = paperWidth === '58mm' ? '11px' : '12px';

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) {
    window.print();
    return false;
  }

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          @page {
            size: ${sizeMm} auto;
            margin: 0mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          html, body {
            width: ${widthMm};
            max-width: ${widthMm};
            margin: 0 auto;
            padding: 3mm 1mm;
            background: #ffffff;
            color: #000000;
            font-family: 'Courier New', Courier, monospace;
            font-size: ${fontSize};
            line-height: 1.35;
          }
          .no-print { display: none !important; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .font-bold { font-weight: bold; }
          .font-semibold { font-weight: 600; }
          .font-black, .font-extrabold { font-weight: 900; }
          .uppercase { text-transform: uppercase; }
          .italic { font-style: italic; }
          .flex { display: flex; }
          .justify-between { justify-content: space-between; }
          .items-center { align-items: center; }
          .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .border-b { border-bottom: 1px dashed #333; }
          .border-t { border-top: 1px solid #333; }
          .border-dashed { border-style: dashed; }
          .pt-1 { padding-top: 4px; }
          .pb-1 { padding-bottom: 4px; }
          .pb-2 { padding-bottom: 6px; }
          .pb-3 { padding-bottom: 8px; }
          .pt-2 { padding-top: 6px; }
          .mb-1 { margin-bottom: 3px; }
          .mt-2 { margin-top: 6px; }
          .py-1 { padding-top: 3px; padding-bottom: 3px; }
          .space-y-1 > * + * { margin-top: 3px; }
          .space-y-1\\.5 > * + * { margin-top: 5px; }
          .space-y-4 > * + * { margin-top: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: inherit; }
          th, td { padding: 2px 0; }
          th { text-align: left; border-bottom: 1px dashed #333; }
          /* Warna cetak thermal harus hitam pekat */
          .text-slate-900, .text-slate-800, .text-blue-950, .text-blue-900, .text-emerald-700, .text-rose-700, .text-amber-700 {
            color: #000000 !important;
          }
          .text-slate-600, .text-slate-500, .text-slate-400 {
            color: #222222 !important;
          }
          .bg-slate-900, .bg-blue-900, .bg-slate-800 {
            background-color: #000000 !important;
            color: #ffffff !important;
          }
          svg { display: none !important; }
        </style>
      </head>
      <body>
        ${targetEl.innerHTML}
      </body>
    </html>
  `);
  doc.close();

  setTimeout(() => {
    try {
      iframe?.contentWindow?.focus();
      iframe?.contentWindow?.print();
      if (onAfterPrint) onAfterPrint();
    } catch (err) {
      console.error('Iframe print error, fallback to window.print', err);
      window.print();
    }
  }, 250);

  return true;
};
