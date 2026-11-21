import React, { useState, useRef } from 'react';
import { Printer, Smartphone, Monitor, Share2, X, Archive, Clock, Send, CheckCircle2 } from 'lucide-react';
import type { LaundryQueueOrder } from '../../types/laundry';
import type { Outlet } from '../../types/outlet';
import { api } from '../../services/api';

interface LaundryReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: LaundryQueueOrder | null;
  outlet?: Outlet | null;
}

export const LaundryReceiptModal: React.FC<LaundryReceiptModalProps> = ({
  isOpen,
  onClose,
  order,
  outlet,
}) => {
  const [paperSize, setPaperSize] = useState<'58mm' | '80mm'>('58mm');
  const [sendingGateway, setSendingGateway] = useState(false);
  const [gatewayMessage, setGatewayMessage] = useState<string | null>(null);
  const receiptPrintRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !order) return null;

  const is58mm = paperSize === '58mm';
  const remainingAmount = Math.max(0, order.grandTotal - (order.paidAmount || 0));
  const isPaid = order.paymentStatus === 'PAID' || remainingAmount === 0;

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    if (!order.customerPhone) {
      alert('Nomor WhatsApp pelanggan tidak tercatat');
      return;
    }

    let phone = order.customerPhone.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) phone = '62' + phone.substring(1);

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

    const message = `*TANDA TERIMA LAUNDRY — ${outlet?.name || 'WELL LAUNDRY'}*
No. Nota: *${order.invoiceNumber}*
Pelanggan: ${order.customerName}
${order.deliveryType === 'DELIVERY' ? `Moda: *🛵 Antar-Jemput Kurir (${order.deliveryDistanceKm || 0} km)*\nAlamat Pengantaran: ${order.customerAddress || '-'}\n` : 'Moda: *🧺 Ambil di Toko*\n'}Aroma: ${order.perfumeVariant}
${order.rackCode ? `Lokasi Rak: *${order.rackCode}*\n` : ''}Estimasi Selesai: *${order.estimatedReadyAt ? new Date(order.estimatedReadyAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : 'Sesuai Jadwal'}*

*Rincian Cucian:*
${itemsSummary}

Total Biaya: Rp ${order.grandTotal.toLocaleString('id-ID')}
Terbayar: Rp ${(order.paidAmount || 0).toLocaleString('id-ID')}
Status Pembayaran: *${isPaid ? 'LUNAS' : `BELUM LUNAS (Sisa: Rp ${remainingAmount.toLocaleString('id-ID')})`}*

Harap simpan pesan tanda terima ini saat pengambilan cucian. Terima kasih!`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleSendViaGateway = async () => {
    if (!order.customerPhone) {
      alert('Nomor WhatsApp pelanggan tidak tercatat');
      return;
    }
    try {
      setSendingGateway(true);
      setGatewayMessage(null);
      const res = await api.sendLaundryWhatsApp(order.orderId, {
        type: order.status === 'COMPLETED' ? 'COMPLETED' : 'READY',
      });
      if (res.status === 'success' || res.isMock) {
        setGatewayMessage(res.message || 'Pesan notifikasi berhasil diproses gateway!');
        setTimeout(() => setGatewayMessage(null), 3500);
      } else {
        alert(res.message || 'Gagal mengirim pesan via WhatsApp Gateway');
      }
    } catch {
      alert('Gangguan koneksi ke WhatsApp Gateway');
    } finally {
      setSendingGateway(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-fadeIn">
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[94dvh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center font-bold">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Cetak Struk &amp; Tanda Terima</h3>
              <p className="text-xs text-slate-500">Nota {order.invoiceNumber} — {order.customerName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Ukuran Kertas Selector */}
            <div className="inline-flex items-center gap-1 p-0.5 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setPaperSize('58mm')}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  is58mm ? 'bg-blue-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Smartphone className="w-3 h-3" />
                <span>58mm</span>
              </button>
              <button
                type="button"
                onClick={() => setPaperSize('80mm')}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  !is58mm ? 'bg-blue-900 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Monitor className="w-3 h-3" />
                <span>80mm</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Receipt Preview Area */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 bg-slate-100/60 flex justify-center items-start">
          <div
            ref={receiptPrintRef}
            className={`bg-[#fffdfa] border border-slate-300/80 p-5 shadow-lg text-slate-900 font-mono text-xs leading-snug space-y-3 transition-all rounded-sm print:m-0 print:border-none print:shadow-none ${
              is58mm ? 'w-64 max-w-full text-[10px]' : 'w-80 max-w-full text-[11px]'
            }`}
          >
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
                  <span className="shrink-0">{order.deliveryType === 'DELIVERY' ? '🛵 Antar ke:' : 'Alamat:'}</span>
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

            {/* Syarat & Ketentuan Laundry */}
            <div className="text-[8.5px] text-slate-500 leading-tight space-y-1">
              <p className="font-bold text-slate-700">Syarat &amp; Ketentuan:</p>
              <ol className="list-decimal pl-3 space-y-0.5">
                <li>Pengambilan pakaian wajib menunjukkan nota / bukti WA ini.</li>
                <li>Komplain luntur / rusak maksimal 1x24 jam setelah cucian diambil.</li>
                <li>Cucian yang tidak diambil lebih dari 30 hari di luar tanggung jawab toko.</li>
              </ol>
            </div>

            <div className="text-center text-[9px] text-slate-500 pt-2 border-t border-slate-200">
              Terima kasih atas kepercayaan Anda di {outlet?.name || 'Toko Kami'}!
            </div>
          </div>
        </div>

        {/* Sticky Action Footer */}
        <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {order.customerPhone ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title="Buka WhatsApp Web / App langsung"
              >
                <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Buka wa.me</span>
              </button>
              <button
                type="button"
                onClick={handleSendViaGateway}
                disabled={sendingGateway}
                className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-900 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                title="Kirim pesan langsung via Fonnte Gateway Server"
              >
                <Send className="w-3.5 h-3.5 text-blue-700" />
                <span>{sendingGateway ? 'Mengirim...' : 'Kirim via Gateway'}</span>
              </button>
              {gatewayMessage && (
                <div className="hidden lg:flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{gatewayMessage}</span>
                </div>
              )}
            </div>
          ) : <div />}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 text-xs font-bold bg-blue-900 hover:bg-blue-800 text-white rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Struk</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
