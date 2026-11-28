import React, { useState, useRef } from 'react';
import {
  Printer,
  Smartphone,
  Monitor,
  X,
  Archive,
  Clock,
  Tag,
  Bluetooth,
  ExternalLink,
  Copy,
  Check,
  QrCode,
  MessageCircle,
} from 'lucide-react';
import type { LaundryQueueOrder } from '../../types/laundry';
import type { Outlet } from '../../types/outlet';
import { useThermalPrinterHub } from '../../hooks/useThermalPrinterHub';
import { printElementViaThermalIframe } from '../../utils/thermalPrinter';
import { buildLaundryProductionTagEscPos, buildReceiptEscPos } from '../../utils/escpos';
import { useDialog } from '../../context/DialogContext';
import { buildWhatsAppUrl } from '../../utils/phone';

interface LaundryReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: LaundryQueueOrder | null;
  outlet?: Outlet | null;
  initialTab?: 'RECEIPT' | 'PRODUCTION_TAG';
}

export const LaundryReceiptModal: React.FC<LaundryReceiptModalProps> = ({
  isOpen,
  onClose,
  order,
  outlet,
  initialTab = 'RECEIPT',
}) => {
  const dialog = useDialog();
  const [paperSize, setPaperSize] = useState<'58mm' | '80mm'>('58mm');
  const [activeTab, setActiveTab] = useState<'RECEIPT' | 'PRODUCTION_TAG'>(initialTab);
  const [printStatusMsg, setPrintStatusMsg] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const receiptPrintRef = useRef<HTMLDivElement>(null);
  const printerHub = useThermalPrinterHub();

  if (!isOpen || !order) return null;

  const trackingUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/track/${encodeURIComponent(order.invoiceNumber)}`
    : `https://wellpos.id/track/${encodeURIComponent(order.invoiceNumber)}`;

  const complaintUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/complaint/${encodeURIComponent(order.invoiceNumber)}`
    : `https://wellpos.id/complaint/${encodeURIComponent(order.invoiceNumber)}`;

  const handleCopyLink = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(trackingUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleDownloadQrCard = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 780;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background kartu putih bersih
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Header Background Deep Navy
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(0, 0, canvas.width, 115);

    // Nama Outlet
    const storeTitle = outlet?.name || (order as any)?.outlet?.name || 'WELL POS LAUNDRY';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(storeTitle.toUpperCase(), canvas.width / 2, 50);

    ctx.fillStyle = '#93c5fd';
    ctx.font = '15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('KARTU PELACAKAN STATUS CUCIAN', canvas.width / 2, 84);

    // Badge Nomor Invoice
    ctx.fillStyle = '#f8fafc';
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(50, 140, 500, 56, 14);
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.fillRect(50, 140, 500, 56);
      ctx.strokeRect(50, 140, 500, 56);
    }

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(order.invoiceNumber, canvas.width / 2, 176);

    // Info Pelanggan
    const custName = order.customerName ? `Pelanggan: ${order.customerName}` : '';
    if (custName) {
      ctx.fillStyle = '#475569';
      ctx.font = '15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(custName, canvas.width / 2, 226);
    }

    // Teks Ajakan Scan
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Scan untuk Lacak Status Cucian', canvas.width / 2, 265);

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(trackingUrl)}`;
    const qrImg = new Image();
    qrImg.crossOrigin = 'anonymous';

    const triggerDownload = () => {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `QR-Tracking-${order.invoiceNumber}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch {
        // Fallback jika canvas CORS security mencegah toDataURL
        const fallbackLink = document.createElement('a');
        fallbackLink.href = qrUrl;
        fallbackLink.download = `QR-Tracking-${order.invoiceNumber}.png`;
        fallbackLink.target = '_blank';
        document.body.appendChild(fallbackLink);
        fallbackLink.click();
        document.body.removeChild(fallbackLink);
      }
    };

    qrImg.onload = () => {
      // Box bingkai putih untuk QR
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(150, 290, 300, 300);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.strokeRect(150, 290, 300, 300);
      ctx.drawImage(qrImg, 160, 300, 280, 280);

      // Teks URL Pelacakan
      ctx.fillStyle = '#64748b';
      ctx.font = '13px monospace';
      ctx.fillText(trackingUrl, canvas.width / 2, 630);

      // Footer
      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('Simpan kartu ini atau scan dengan kamera HP Anda', canvas.width / 2, 675);
      ctx.fillText('Well POS Laundry • Real-time Order Tracking', canvas.width / 2, 700);

      triggerDownload();
    };

    qrImg.onerror = () => {
      triggerDownload();
    };

    qrImg.src = qrUrl;
  };

  const is58mm = paperSize === '58mm';
  const remainingAmount = Math.max(0, order.grandTotal - (order.paidAmount || 0));
  const isPaid = order.paymentStatus === 'PAID' || remainingAmount === 0;

  const handlePrintCustomerReceipt = async () => {
    const tabChanged = activeTab !== 'RECEIPT';
    setActiveTab('RECEIPT');
    if (tabChanged) {
      await new Promise((r) => setTimeout(r, 80));
    }
    setPrintStatusMsg('Memproses pencetakan nota...');
    try {
      const res = await printerHub.printReceipt(
        {
          ...order,
          outlet: outlet || (order as any).outlet,
        },
        { paperSize }
      );
      if (res.mode === 'bluetooth' || res.mode === 'usb') {
        setPrintStatusMsg(`✓ Berhasil dikirim ke printer ${res.mode.toUpperCase()}`);
      } else {
        setPrintStatusMsg('✓ Dialog cetak terbuka');
      }
      setTimeout(() => setPrintStatusMsg(null), 3000);
    } catch {
      printElementViaThermalIframe('thermal-receipt-content', { paperWidth: paperSize });
      setPrintStatusMsg('Fallback ke cetak sistem');
      setTimeout(() => setPrintStatusMsg(null), 3000);
    }
  };

  const handlePrintProductionTag = async () => {
    const tabChanged = activeTab !== 'PRODUCTION_TAG';
    setActiveTab('PRODUCTION_TAG');
    if (tabChanged) {
      await new Promise((r) => setTimeout(r, 80));
    }
    setPrintStatusMsg('Memproses pencetakan tag...');
    try {
      const res = await printerHub.printLaundryProductionTag(
        {
          ...order,
          outlet: outlet || (order as any).outlet,
        },
        { paperSize }
      );
      if (res.mode === 'bluetooth' || res.mode === 'usb') {
        setPrintStatusMsg(`✓ Tag berhasil dikirim ke printer ${res.mode.toUpperCase()}`);
      } else {
        setPrintStatusMsg('✓ Dialog cetak terbuka');
      }
      setTimeout(() => setPrintStatusMsg(null), 3000);
    } catch {
      printElementViaThermalIframe('production-tag-printable', { paperWidth: paperSize });
      setPrintStatusMsg('Fallback ke cetak sistem');
      setTimeout(() => setPrintStatusMsg(null), 3000);
    }
  };

  const handlePrintRawBt = (type: 'RECEIPT' | 'PRODUCTION_TAG') => {
    try {
      const printableOrder = {
        ...order,
        outlet: outlet || (order as any).outlet,
      };
      const rawBytes =
        type === 'PRODUCTION_TAG'
          ? buildLaundryProductionTagEscPos(printableOrder, { paperSize })
          : buildReceiptEscPos(printableOrder, { paperSize });
      printerHub.printViaRawBt(rawBytes);
    } catch {
      window.print();
    }
  };

  const handleShareWhatsApp = () => {
    if (!order.customerPhone) {
      dialog.toast('Nomor WhatsApp pelanggan tidak tercatat', 'error');
      return;
    }

    const itemsSummary = order.items && order.items.length > 0
      ? order.items.map((it) => {
          let line = `• ${it.name} (${it.quantity} ${it.unit}): Rp ${it.subtotal.toLocaleString('id-ID')}`;
          if (it.addons && it.addons.length > 0) {
            const addonText = it.addons.map(a => `  + ${a.name} (+Rp ${a.total.toLocaleString('id-ID')})`).join('\n');
            line += `\n${addonText}`;
          }
          return line;
        }).join('\n')
      : `• ${order.serviceName} (${order.totalWeightKg ? `${order.totalWeightKg} Kg` : `${order.totalPieces} Pcs`})`;

    const dType = (order.deliveryType as string) || '';
    let deliveryModaText = 'Moda: *🧺 Ambil di Toko*\n';
    if (dType === 'PICKUP_ONLY') {
      deliveryModaText = `Moda: *🛵 Jemput Cucian Saja*\nAlamat: ${order.customerAddress || '-'}\n`;
    } else if (dType === 'DELIVERY_ONLY' || dType === 'DELIVERY') {
      deliveryModaText = `Moda: *🛵 Antar ke Alamat Pelanggan*\nAlamat: ${order.customerAddress || '-'}\n`;
    } else if (dType === 'PICKUP_AND_DELIVERY') {
      deliveryModaText = `Moda: *🛵 Antar-Jemput Bolak-Balik*\nAlamat: ${order.customerAddress || '-'}\n`;
    }

    const message = `*TANDA TERIMA LAUNDRY — ${outlet?.name || 'WELL LAUNDRY'}*
No. Nota: *${order.invoiceNumber}*
Pelanggan: ${order.customerName}
${deliveryModaText}Aroma: ${order.perfumeVariant}
${order.rackCode ? `Lokasi Rak: *${order.rackCode}*\n` : ''}Estimasi Selesai: *${order.estimatedReadyAt ? new Date(order.estimatedReadyAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sesuai Jadwal'}*

*Rincian Cucian:*
${itemsSummary}

${order.deliveryFee ? `Biaya Delivery: Rp ${order.deliveryFee.toLocaleString('id-ID')}\n` : ''}Total Biaya: Rp ${order.grandTotal.toLocaleString('id-ID')}
Terbayar: Rp ${(order.paidAmount || 0).toLocaleString('id-ID')}
Status Pembayaran: *${isPaid ? 'LUNAS' : `BELUM LUNAS (Sisa: Rp ${remainingAmount.toLocaleString('id-ID')})`}*

🔍 *Pantau Status Cucian Live:*
${trackingUrl}

🛡️ *Form Keluhan & Garansi (Aktif 1x24 Jam setelah selesai):*
${complaintUrl}

Harap simpan pesan tanda terima ini saat pengambilan cucian. Terima kasih!`;

    window.open(buildWhatsAppUrl(order.customerPhone, message), '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-fadeIn">
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[94dvh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center font-bold">
              {activeTab === 'PRODUCTION_TAG' ? <Tag className="w-5 h-5" /> : <Printer className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-slate-900 text-sm">
                  {activeTab === 'PRODUCTION_TAG' ? 'Tag Keranjang Produksi' : 'Cetak Struk & Tanda Terima'}
                </h3>
                {printerHub.isConnected ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    <Bluetooth className="w-2.5 h-2.5 text-emerald-600" />
                    <span>{printerHub.deviceName || 'Thermal'}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                    <Printer className="w-2.5 h-2.5 text-slate-400" />
                    <span>Cetak Sistem</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">Nota {order.invoiceNumber} — {order.customerName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Ukuran Kertas Selector */}
            <div className="inline-flex items-center gap-1 p-0.5 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setPaperSize('58mm')}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  is58mm ? 'bg-blue-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Smartphone className="w-3 h-3" />
                <span>58mm</span>
              </button>
              <button
                type="button"
                onClick={() => setPaperSize('80mm')}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  !is58mm ? 'bg-blue-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Monitor className="w-3 h-3" />
                <span>80mm</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 ml-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Switcher: Nota Pelanggan vs Tag Produksi */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('RECEIPT')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'RECEIPT'
                ? 'border-blue-900 text-blue-900 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Nota Pelanggan</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PRODUCTION_TAG')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'PRODUCTION_TAG'
                ? 'border-blue-900 text-blue-900 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Tag Produksi (Keranjang)</span>
          </button>
        </div>

        {/* Scrollable Receipt Preview Area */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 bg-slate-100/60 flex justify-center items-start">
          <div
            ref={receiptPrintRef}
            id={activeTab === 'PRODUCTION_TAG' ? 'production-tag-printable' : 'thermal-receipt-content'}
            className={`bg-[#fffdfa] border border-slate-300/80 p-5 shadow-lg text-slate-900 font-mono text-xs leading-snug space-y-3 transition-all rounded-sm print:m-0 print:border-none print:shadow-none ${
              is58mm ? 'w-64 max-w-full text-[10px]' : 'w-80 max-w-full text-[11px]'
            }`}
          >
            {activeTab === 'PRODUCTION_TAG' ? (
              /* ==================================================== */
              /* TAMPILAN TAG PRODUKSI / TANDA KERANJANG (OPERASIONAL) */
              /* ==================================================== */
              <>
                <div className="text-center space-y-0.5">
                  <div className="text-[9px] font-black tracking-widest text-blue-950 uppercase">
                    *** TAG KERANJANG PRODUKSI ***
                  </div>
                  <div className="font-extrabold text-xs uppercase text-slate-900">
                    {outlet?.name || 'WELL POS LAUNDRY'}
                  </div>
                </div>

                <div className="border-b-2 border-dashed border-slate-900 my-2" />

                {/* Box Nomor Nota Besar & QR Code */}
                <div className="border-2 border-slate-900 p-2 text-center rounded bg-slate-50 space-y-2">
                  <div className="text-lg font-black text-slate-900 tracking-wider">
                    {order.invoiceNumber}
                  </div>
                  <div className="flex justify-center py-1">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                        order.invoiceNumber
                      )}`}
                      alt={order.invoiceNumber}
                      className="w-24 h-24 object-contain mx-auto"
                    />
                  </div>
                  <div className="text-[9px] font-bold text-slate-600">
                    Pindai QR di Stasiun Cuci / Pengering
                  </div>
                </div>

                {/* Info Operasional */}
                <div className="space-y-1.5 text-[10px] text-slate-800 pt-1">
                  <div className="flex justify-between border-b border-dotted border-slate-300 pb-1">
                    <span className="text-slate-500 font-bold">Pelanggan:</span>
                    <span className="font-black text-slate-900">{order.customerName}</span>
                  </div>

                  <div className="flex justify-between border-b border-dotted border-slate-300 pb-1">
                    <span className="text-slate-500 font-bold">Layanan:</span>
                    <span className="font-bold text-slate-900 text-right">{order.serviceName}</span>
                  </div>

                  <div className="flex justify-between border-b border-dotted border-slate-300 pb-1">
                    <span className="text-slate-500 font-bold">Bobot &amp; Helai:</span>
                    <span className="font-black text-blue-950">
                      {order.totalWeightKg ? `${order.totalWeightKg} Kg` : '-'} / {order.totalPieces || 0} Pcs
                    </span>
                  </div>

                  <div className="flex justify-between border-b border-dotted border-slate-300 pb-1">
                    <span className="text-slate-500 font-bold">Aroma Parfum:</span>
                    <span className="font-bold text-purple-950">{order.perfumeVariant || 'Reguler'}</span>
                  </div>

                  {order.rackCode && (
                    <div className="flex justify-between border-b border-dotted border-slate-300 pb-1 bg-emerald-50 px-1 py-0.5 rounded">
                      <span className="text-emerald-800 font-black">Lokasi Rak:</span>
                      <span className="font-black text-emerald-950">{order.rackCode}</span>
                    </div>
                  )}

                  {/* Target SLA Deadline */}
                  <div className="p-1.5 rounded bg-amber-50 border border-amber-300 text-center mt-2">
                    <div className="text-[9px] font-black uppercase text-amber-900">
                      TARGET DEADLINE SELESAI (SLA):
                    </div>
                    <div className="text-xs font-black text-amber-950 mt-0.5">
                      {order.estimatedReadyAt
                        ? new Date(order.estimatedReadyAt).toLocaleString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Sesuai Antrean'}
                    </div>
                  </div>

                  {/* Catatan QC & Sortir */}
                  {((Array.isArray(order.defects) && order.defects.length > 0) ||
                    order.defectNotes ||
                    order.customerNotes) && (
                    <div className="p-1.5 rounded bg-rose-50 border border-rose-200 space-y-1 text-[9px] mt-2">
                      <div className="font-black text-rose-900">CATATAN SORTIR / QC KENDALA:</div>
                      {Array.isArray(order.defects) && order.defects.length > 0 && (
                        <div className="text-rose-950 font-bold">
                          Kendala: {order.defects.join(', ')}
                        </div>
                      )}
                      {order.defectNotes && (
                        <div className="italic text-rose-900">"{order.defectNotes}"</div>
                      )}
                      {order.customerNotes && (
                        <div className="text-slate-600">Ket: {order.customerNotes}</div>
                      )}
                    </div>
                  )}
                </div>

                <div className="border-b-2 border-dashed border-slate-900 my-2" />

                <div className="text-center text-[9px] font-bold text-slate-500">
                  * Tempelkan pada keranjang cucian di workshop *
                </div>
              </>
            ) : (
              /* ==================================================== */
              /* TAMPILAN NOTA RESMI PELANGGAN (STRUK NOTA LENGKAP)    */
              /* ==================================================== */
              <>
                {/* Header Toko */}
            <div className="text-center space-y-0.5">
              <div className="font-black text-sm uppercase tracking-wide text-blue-950">
                {outlet?.name || 'WELL POS LAUNDRY'}
              </div>
              <div className="text-[10px] text-slate-600">
                {outlet?.address || 'Layanan Binatu & Dry Clean Profesional'}
              </div>
              {outlet?.phone && (
                <div className="text-[10px] text-slate-600">
                  Telp / WA: {outlet.phone}
                </div>
              )}
            </div>

            <div className="border-b border-dashed border-slate-400 my-2" />

            {/* Kotak Nomor Nota & Status */}
            <div className="border border-slate-900 p-2 text-center rounded bg-slate-50">
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-600">
                TANDA TERIMA CUCIAN
              </div>
              <div className="text-base font-black text-slate-900 tracking-wider">
                {order.invoiceNumber}
              </div>
              {order.rackCode && (
                <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 text-[10px] font-black">
                  <Archive className="w-3 h-3" />
                  <span>RAK: {order.rackCode}</span>
                </div>
              )}
            </div>

            {/* Info Pelanggan & Waktu */}
            <div className="space-y-1 text-[10px] text-slate-700">
              <div className="flex justify-between">
                <span>Pelanggan:</span>
                <span className="font-bold text-slate-900">{order.customerName}</span>
              </div>
              {order.customerPhone && (
                <div className="flex justify-between">
                  <span>No. Telp:</span>
                  <span>{order.customerPhone}</span>
                </div>
              )}
              {order.customerAddress && (
                <div className="flex justify-between items-start text-[9.5px]">
                  <span className="shrink-0">
                    {String(order.deliveryType) === 'PICKUP_ONLY'
                      ? '🛵 Jemput di:'
                      : String(order.deliveryType) === 'PICKUP_AND_DELIVERY'
                      ? '🛵 Antar-Jemput:'
                      : String(order.deliveryType) === 'DELIVERY_ONLY' || String(order.deliveryType) === 'DELIVERY'
                      ? '🛵 Antar ke:'
                      : 'Alamat:'}
                  </span>
                  <span className="font-semibold text-slate-800 text-right pl-2 leading-tight">
                    {order.customerAddress}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Tgl Terima:</span>
                <span>{new Date(order.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex justify-between text-blue-950 font-bold">
                <span>Est. Selesai:</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {order.estimatedReadyAt ? new Date(order.estimatedReadyAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '48 Jam'}
                </span>
              </div>
            </div>

            <div className="border-b border-dashed border-slate-400 my-2" />

            {/* Rincian Pakaian & Treatment */}
            <div className="space-y-2">
              {order.items && order.items.length > 0 ? (
                order.items.map((it, idx) => (
                  <div key={idx} className="space-y-0.5 border-b border-dotted border-slate-200 pb-1.5 last:border-b-0 last:pb-0">
                    <div className="flex justify-between font-bold text-slate-900">
                      <span>{it.name}</span>
                      <span>Rp {it.subtotal.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-600 pl-2">
                      <span>Jumlah / Bobot:</span>
                      <span className="font-bold text-slate-800">
                        {it.quantity} {it.unit}
                      </span>
                    </div>
                    {it.addons && it.addons.length > 0 && (
                      <div className="pl-2 space-y-0.5 pt-0.5">
                        {it.addons.map((ad, adIdx) => (
                          <div key={adIdx} className="flex justify-between text-[9.5px] text-purple-800 font-medium">
                            <span>+ {ad.name}</span>
                            <span>+Rp {ad.total.toLocaleString('id-ID')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {it.notes && (
                      <div className="text-[9px] text-slate-500 italic pl-2">
                        {it.notes}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <>
                  <div className="flex justify-between font-bold text-slate-900">
                    <span>{order.serviceName}</span>
                    <span>Rp {order.grandTotal.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-600 pl-2">
                    <span>Bobot / Helai:</span>
                    <span className="font-bold text-slate-800">
                      {order.totalWeightKg ? `${order.totalWeightKg} Kg` : `${order.totalPieces} Pcs`}
                    </span>
                  </div>
                </>
              )}

              <div className="flex justify-between text-[10px] text-slate-600 pl-2 pt-1 border-t border-slate-100">
                <span>Aroma Parfum:</span>
                <span className="font-bold text-slate-800">{order.perfumeVariant}</span>
              </div>
              {order.customerNotes && (
                <div className="text-[9.5px] text-slate-600 bg-amber-50/70 p-1.5 rounded border border-amber-200/60 mt-1">
                  Catatan: {order.customerNotes}
                </div>
              )}
            </div>

            <div className="border-b border-dashed border-slate-400 my-2" />

            {/* Rekap Finansial (Lunas vs DP) */}
            <div className="space-y-1 text-[10px]">
              {order.deliveryFee !== undefined && order.deliveryFee > 0 && (
                <div className="flex justify-between text-blue-900 font-bold">
                  <span>🛵 Ongkos Antar-Jemput:</span>
                  <span>Rp {order.deliveryFee.toLocaleString('id-ID')}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-700">
                <span>Total Biaya:</span>
                <span className="font-bold text-slate-900">Rp {order.grandTotal.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Terbayar:</span>
                <span>Rp {(order.paidAmount || 0).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between font-black text-xs pt-1 border-t border-slate-300">
                <span>SISA TAGIHAN:</span>
                <span className={isPaid ? 'text-emerald-700' : 'text-rose-600'}>
                  {isPaid ? 'Rp 0 (LUNAS)' : `Rp ${remainingAmount.toLocaleString('id-ID')}`}
                </span>
              </div>
            </div>

            <div className="border-b border-dashed border-slate-400 my-2" />

            {/* Blok QR Code Tracking Live Pelanggan */}
            <div className="border border-slate-900/80 p-2.5 text-center rounded bg-slate-50 space-y-1.5 my-2">
              <div className="text-[9px] font-black uppercase tracking-wider text-blue-950">
                PANTAU STATUS CUCIAN LIVE
              </div>
              <div className="flex justify-center py-0.5">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(
                    trackingUrl
                  )}`}
                  alt="QR Tracking"
                  className="w-24 h-24 object-contain mx-auto border border-slate-200 rounded p-1 bg-white"
                />
              </div>
              <div className="text-[9px] font-bold text-slate-700">
                Pindai QR untuk pantau status cucian live
              </div>
              <div className="text-[8px] font-mono text-slate-500 break-all">
                /track/{order.invoiceNumber}
              </div>
            </div>

            <div className="border-b border-dashed border-slate-400 my-2" />

            {/* Syarat & Ketentuan Laundry & Klausa Garansi */}
            <div className="text-[8.5px] text-slate-500 leading-tight space-y-1 text-left">
              <p className="font-bold text-slate-700">Syarat &amp; Ketentuan:</p>
              {outlet?.receiptConfig?.laundryTerms ? (
                <div className="whitespace-pre-line text-[8px] pl-1 text-slate-600">
                  {outlet.receiptConfig.laundryTerms}
                </div>
              ) : (
                <ol className="list-decimal pl-3 space-y-0.5">
                  <li>Pengambilan pakaian wajib menunjukkan nota / bukti WA ini.</li>
                  <li>Komplain maksimal 1x24 jam setelah cucian diambil dengan membawa nota dan pakaian belum dicuci ulang.</li>
                  <li>Pakaian yang tidak diambil dalam tempo 30 hari di luar tanggung jawab pihak laundry.</li>
                  <li>Ganti rugi maksimal 5x biaya cuci untuk pakaian rusak/hilang sesuai investigasi tim laundry.</li>
                </ol>
              )}
            </div>

            <div className="text-center text-[9px] text-slate-500 pt-2 border-t border-slate-200">
              Terima kasih atas kepercayaan Anda di {outlet?.name || 'Toko Kami'}!
            </div>
          </>
        )}
      </div>
    </div>

    {/* Sticky Action Footer */}
    <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleCopyLink}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          title="Salin tautan pelacakan online ke clipboard"
        >
          {copiedLink ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-700 font-bold">Tersalin!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-slate-500" />
              <span>Salin Link</span>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={handleDownloadQrCard}
          className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          title="Download gambar QR Code untuk dibagikan ke pelanggan"
        >
          <QrCode className="w-3.5 h-3.5 text-blue-900" />
          <span>Unduh QR</span>
        </button>
        {order.customerPhone && (
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            title="Buka WhatsApp Web / App langsung dengan nota siap kirim"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Kirim via WhatsApp</span>
          </button>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 flex-wrap">
        {printStatusMsg && (
          <span className="text-[11px] font-bold text-blue-900 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 animate-fadeIn">
            {printStatusMsg}
          </span>
        )}
        <button
          type="button"
          onClick={() => handlePrintRawBt(activeTab)}
          className="flex px-2.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 rounded-xl transition-colors items-center gap-1 cursor-pointer"
          title="Kirim cetak via aplikasi RawBT Print Bridge (Android)"
        >
          <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
          <span>RawBT</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
        >
          Tutup
        </button>
        <button
          type="button"
          onClick={handlePrintProductionTag}
          className="px-3.5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          title="Cetak Tag Produksi untuk keranjang pakaian"
        >
          <Tag className="w-3.5 h-3.5" />
          <span>Cetak Tag Produksi</span>
        </button>
        <button
          type="button"
          onClick={handlePrintCustomerReceipt}
          className="px-4 py-2 text-xs font-bold bg-blue-900 hover:bg-blue-800 text-white rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          title="Cetak Nota Resmi untuk Pelanggan"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Cetak Nota Pelanggan</span>
        </button>
      </div>
    </div>
      </div>
    </div>
  );
};
