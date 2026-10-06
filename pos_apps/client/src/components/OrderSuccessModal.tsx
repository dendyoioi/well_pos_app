import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  Printer,
  PlusCircle,
  Store,
  Download,
  Mail,
  Send,
  ExternalLink,
  X,
  FileText,
  MessageCircle,
  Copy,
  Check,
  Coins,
  Sparkles,
  Bluetooth,
  Zap,
  RefreshCw,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import type { Order } from '../types/order';
import { generateReceiptPdf } from '../utils/receiptPdf';
import { usePlan } from '../hooks/usePlan';
import { api } from '../services/api';
import { useBluetoothPrinter } from '../hooks/useBluetoothPrinter';
import { WhatsAppInput } from './ui/WhatsAppInput';

interface OrderSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
}

export const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({
  isOpen,
  onClose,
  order,
}) => {
  const { isFree } = usePlan();
  
  // Ambil ukuran default dari konfigurasi outlet (atau fallback ke 58mm)
  const defaultOutletPaperSize = (order?.outlet?.receiptConfig?.paperSize as '58mm' | '80mm') || '58mm';
  const [paperSize, setPaperSize] = useState<'58mm' | '80mm'>(defaultOutletPaperSize);
  const [savedDefaultSize, setSavedDefaultSize] = useState<'58mm' | '80mm'>(defaultOutletPaperSize);
  const [savingDefault, setSavingDefault] = useState(false);
  const [defaultSavedSuccess, setDefaultSavedSuccess] = useState(false);

  // Sinkronisasi ukuran jika order berubah
  React.useEffect(() => {
    if (order?.outlet?.receiptConfig?.paperSize) {
      const size = order.outlet.receiptConfig.paperSize as '58mm' | '80mm';
      setPaperSize(size);
      setSavedDefaultSize(size);
    }
  }, [order?.id]);

  const [recipientEmail, setRecipientEmail] = useState(order?.customerEmail || '');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{
    type: 'success' | 'error';
    message: string;
    previewUrl?: string;
  } | null>(null);

  // Virtual Cash Drawer Simulator State
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Bluetooth Thermal Printer Hook & State
  const btPrinter = useBluetoothPrinter();
  const [btPrintSuccess, setBtPrintSuccess] = useState(false);
  const [btPrintError, setBtPrintError] = useState<string | null>(null);

  // Digital Receipt View Modes (Zero Stacked Modals Policy)
  type ReceiptModalView = 'RECEIPT' | 'WHATSAPP' | 'EMAIL';
  const [modalView, setModalView] = useState<ReceiptModalView>('RECEIPT');
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);

  // WhatsApp Gateway Automated Dispatch States
  const [waRecipientPhone, setWaRecipientPhone] = useState(order?.customerPhone || '');
  const [sendingWa, setSendingWa] = useState(false);
  const [waSendResult, setWaSendResult] = useState<{
    type: 'success' | 'error';
    message: string;
    simulated?: boolean;
  } | null>(null);

  const showWatermark = order?.outlet?.receiptConfig?.showWatermark !== false;
  const waConfig = order?.outlet?.receiptConfig?.whatsappConfig;
  const hasGatewayActive = Boolean(
    waConfig?.enabled &&
    waConfig?.apiKey &&
    waConfig.apiKey.trim().length > 0
  );

  React.useEffect(() => {
    if (order?.customerPhone) {
      setWaRecipientPhone(order.customerPhone);
    } else {
      setWaRecipientPhone('');
    }
    setWaSendResult(null);
  }, [order?.id, order?.customerPhone]);

  React.useEffect(() => {
    if (isOpen) {
      setModalView('RECEIPT');
    }
  }, [isOpen, order?.id]);

  // Simulasi & Eksekusi Kick Cash Drawer (Signal ESC/POS 24V)
  const kickDrawer = () => {
    setDrawerOpen(true);

    // Kirim sinyal ESC/POS fisik jika printer Bluetooth terhubung
    if (btPrinter.isConnected) {
      btPrinter.kickDrawer().catch(() => {});
    }

    // Play subtle audio tone using Web Audio API if permitted
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
        osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      }
    } catch {
      // Audio context might be restricted, visual feedback handles it
    }

    // Auto-close visual status after 3.5s
    setTimeout(() => {
      setDrawerOpen(false);
    }, 3500);
  };

  const handleDirectBluetoothPrint = async () => {
    setBtPrintError(null);
    setBtPrintSuccess(false);
    try {
      if (!btPrinter.isConnected) {
        const ok = await btPrinter.connect();
        if (!ok) return;
      }

      await btPrinter.printReceipt(order, {
        paperSize,
        showQueueNumber: order?.outlet?.receiptConfig?.showQueueNumber !== false,
        showWatermark,
        footerText: order?.outlet?.receiptConfig?.footerText,
      });

      // Jika ada pembayaran cash, picu laci kasir
      const hasCash = order?.payments?.some((p: any) => (p.method || (p as any).paymentMethod) === 'CASH');
      if (hasCash) {
        await btPrinter.kickDrawer().catch(() => {});
      }

      setBtPrintSuccess(true);
      setTimeout(() => setBtPrintSuccess(false), 3000);
    } catch (err: any) {
      setBtPrintError(err.message || 'Gagal mencetak ke printer Bluetooth');
      setTimeout(() => setBtPrintError(null), 4000);
    }
  };

  // Auto kick drawer if payment contains CASH
  React.useEffect(() => {
    if (isOpen && order) {
      const hasCash = order.payments?.some((p) => p.method === 'CASH');
      if (hasCash) {
        kickDrawer();
      }
    }
  }, [isOpen, order?.id]);

  const handleSaveAsDefault = async () => {
    if (!order?.outletId) return;
    setSavingDefault(true);
    try {
      await api.updateOutlet(order.outletId, {
        receiptConfig: {
          paperSize,
          footerText: order.outlet?.receiptConfig?.footerText || undefined,
        },
      });
      setSavedDefaultSize(paperSize);
      setDefaultSavedSuccess(true);
      setTimeout(() => setDefaultSavedSuccess(false), 3000);
    } catch (e) {
      console.error('Gagal menyimpan ukuran default toko:', e);
    } finally {
      setSavingDefault(false);
    }
  };

  // Pasang class has-receipt-modal pada body saat modal aktif agar @media print menyembunyikan #root 100%
  React.useEffect(() => {
    if (isOpen) {
      document.body.classList.add('has-receipt-modal');
    } else {
      document.body.classList.remove('has-receipt-modal');
    }
    return () => {
      document.body.classList.remove('has-receipt-modal');
      document.body.classList.remove('printing-receipt');
    };
  }, [isOpen]);

  if (!isOpen || !order) return null;

  const handlePrint = () => {
    const receiptEl = document.getElementById('thermal-receipt-content');
    if (!receiptEl) {
      document.body.classList.add('printing-receipt');
      window.print();
      return;
    }

    // Gunakan iframe tersembunyi agar proses cetak murni dan 100% terisolasi dari halaman utama
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

    const widthMm = paperSize === '58mm' ? '48mm' : '72mm';
    const paperWidth = paperSize === '58mm' ? '58mm' : '80mm';
    const fontSize = paperSize === '58mm' ? '11px' : '12px';

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Struk - ${order.invoiceNumber}</title>
          <style>
            @page {
              size: ${paperWidth} auto;
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
              padding: 2mm 0mm;
              background: #ffffff;
              color: #000000;
              font-family: 'Courier New', Courier, monospace;
              font-size: ${fontSize};
              line-height: 1.35;
            }
            .no-print { display: none !important; }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .font-semibold { font-weight: 600; }
            .font-black { font-weight: 900; }
            .flex { display: flex; }
            .justify-between { justify-content: space-between; }
            .items-center { align-items: center; }
            .space-y-0\\.5 > * + * { margin-top: 2px; }
            .space-y-1 > * + * { margin-top: 4px; }
            .space-y-2 > * + * { margin-top: 8px; }
            .space-y-3\\.5 > * + * { margin-top: 12px; }
            .my-2 { margin-top: 6px; margin-bottom: 6px; }
            .pt-1\\.5 { padding-top: 6px; }
            .border-b { border-bottom: 1px dashed #444; }
            .border-t { border-top: 1px solid #444; }
            .border-l-2 { border-left: 2px solid #666; padding-left: 4px; }
            .text-rose-600 { color: #000; }
            .text-emerald-700 { color: #000; }
            .text-blue-950 { color: #000; }
            .text-slate-500, .text-slate-600 { color: #333; }
            svg { display: none !important; }
          </style>
        </head>
        <body>
          ${receiptEl.innerHTML}
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        iframe?.contentWindow?.focus();
        iframe?.contentWindow?.print();
      } catch (err) {
        console.error('Iframe print error, falling back to window.print', err);
        document.body.classList.add('printing-receipt');
        window.print();
      }
    }, 250);
  };

  const handleDownloadPdf = () => {
    generateReceiptPdf(order, paperSize, isFree, showWatermark);
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientEmail.trim()) return;

    setSendingEmail(true);
    setEmailStatus(null);
    try {
      const res = await api.sendOrderEmail(order.id, recipientEmail.trim());
      if (res.status === 'success') {
        setEmailStatus({
          type: 'success',
          message: res.message || 'Struk berhasil dikirim!',
          previewUrl: res.previewUrl,
        });
      } else {
        setEmailStatus({
          type: 'error',
          message: res.message || 'Gagal mengirim email struk',
        });
      }
    } catch (err: any) {
      setEmailStatus({
        type: 'error',
        message: err.message || 'Terjadi kesalahan sistem saat mengirim email',
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const getWhatsAppText = () => {
    const outletName = order.outlet?.name || 'Well POS Toko';
    const timeStr = new Date(order.createdAt).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const itemsText = order.orderItems?.map(item => {
      const disc = Number(item.discountAmount) || 0;
      const discStr = disc > 0 ? ` (Disc: -Rp ${(disc * item.quantity).toLocaleString('id-ID')})` : '';
      return `• ${item.product?.name} x${item.quantity} = Rp ${Number(item.subtotal).toLocaleString('id-ID')}${discStr}`;
    }).join('\n') || '';

    const paymentsText = order.payments?.map(p => {
      let str = `${p.method}: Rp ${Number(p.amountPaid).toLocaleString('id-ID')}`;
      if (p.method === 'CASH' && Number(p.changeGiven) > 0) {
        str += ` (Kembalian: Rp ${Number(p.changeGiven).toLocaleString('id-ID')})`;
      }
      return str;
    }).join('\n') || '';

    const queueText = (order.queueNumber !== undefined && order.queueNumber !== null)
      ? `*NOMOR ANTRIAN : #${String(order.queueNumber).padStart(2, '0')}*\n`
      : '';

    return `*${outletName.toUpperCase()}*\n` +
      `Bukti Pembayaran Digital (Well POS)\n` +
      `--------------------------------\n` +
      queueText +
      `No. Faktur : #${order.invoiceNumber}\n` +
      `Waktu      : ${timeStr}\n` +
      `Kasir      : ${order.cashier?.name || 'Kasir Toko'}\n` +
      (order.customerName ? `Pelanggan  : ${order.customerName}\n` : '') +
      `--------------------------------\n` +
      `DAFTAR BELANJA:\n${itemsText}\n` +
      `--------------------------------\n` +
      `Subtotal   : Rp ${Number(order.subtotal).toLocaleString('id-ID')}\n` +
      (order.discountAmount > 0 ? `Diskon     : -Rp ${Number(order.discountAmount).toLocaleString('id-ID')}\n` : '') +
      (Number(order.pointsRedeemed || 0) > 0 ? `Tukar Poin : -${order.pointsRedeemed} Poin (-Rp ${Number(order.pointDiscountAmount || (order.pointsRedeemed || 0) * 100).toLocaleString('id-ID')})\n` : '') +
      (order.taxAmount > 0 ? `PPN (11%)  : +Rp ${Number(order.taxAmount).toLocaleString('id-ID')}\n` : '') +
      `TOTAL      : Rp ${Number(order.grandTotal).toLocaleString('id-ID')}\n` +
      (Number(order.pointsEarned || 0) > 0 ? `Poin Didapat: +${order.pointsEarned} Poin Loyalitas\n` : '') +
      `--------------------------------\n` +
      `PEMBAYARAN:\n${paymentsText}\n` +
      `--------------------------------\n` +
      `Terima kasih telah berbelanja di ${outletName}! Simpan struk ini sebagai bukti transaksi resmi.` +
      (showWatermark ? `\n\n_Powered by Well POS_` : '');
  };

  const handleOpenWhatsAppReal = () => {
    const text = getWhatsAppText();
    const cleanPhone = (order.customerPhone || '').replace(/\D/g, '');
    let waUrl = '';
    if (cleanPhone) {
      const formattedPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
      waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`;
    } else {
      waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    }
    window.open(waUrl, '_blank');
  };

  const handleCopyWhatsAppText = () => {
    const text = getWhatsAppText();
    navigator.clipboard.writeText(text);
    setCopiedWhatsApp(true);
    setTimeout(() => setCopiedWhatsApp(false), 2500);
  };

  const handleSendWhatsAppGateway = async () => {
    if (!order) return;
    const phone = waRecipientPhone.trim();
    if (!phone) {
      setWaSendResult({ type: 'error', message: 'Nomor WhatsApp pelanggan belum diisi.' });
      return;
    }

    setSendingWa(true);
    setWaSendResult(null);

    try {
      const res = await api.sendOrderWhatsApp(order.id, phone);
      if (res.status === 'success') {
        setWaSendResult({
          type: 'success',
          message: res.message || 'Struk belanja berhasil dikirim ke WhatsApp!',
          simulated: (res as any).data?.simulated,
        });
      } else {
        setWaSendResult({
          type: 'error',
          message: res.message || 'Gagal mengirim pesan via WhatsApp Gateway.',
        });
      }
    } catch (err: any) {
      setWaSendResult({
        type: 'error',
        message: err.message || 'Terjadi kesalahan saat memproses WhatsApp Gateway.',
      });
    } finally {
      setSendingWa(false);
    }
  };

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn receipt-print-wrapper overflow-hidden"
    >
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[88dvh] sm:h-[92dvh] max-h-[88dvh] sm:max-h-[92dvh] receipt-printable">
        {modalView === 'RECEIPT' && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Banner Sukses (No Print) */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-950 to-blue-900 text-white text-center flex flex-col items-center justify-center no-print relative shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Struk"
            className="absolute top-3 right-3 p-2 rounded-full text-white bg-white/20 hover:bg-white/30 active:scale-95 transition-all z-20 cursor-pointer shadow-sm"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mb-2 shadow-sm">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black tracking-tight">Transaksi Berhasil</h3>
          {order.queueNumber !== undefined && order.queueNumber !== null && (
            <div className="mt-2.5 px-5 py-2 rounded-2xl bg-white/10 border border-white/25 shadow-inner flex flex-col items-center animate-in fade-in zoom-in-95">
              <span className="text-[10px] font-black tracking-widest text-amber-300 uppercase">
                Nomor Antrean
              </span>
              <span className="text-3xl font-black tracking-wider text-white">
                #{String(order.queueNumber).padStart(2, '0')}
              </span>
            </div>
          )}
          <p className="text-xs text-blue-200/80 mt-1">Faktur #{order.invoiceNumber}</p>
          {Number(order.pointsEarned || 0) > 0 && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400 text-slate-950 font-black text-xs shadow-sm animate-in fade-in">
              <Sparkles className="w-3.5 h-3.5 text-slate-950" />
              <span>+{order.pointsEarned} Poin Loyalitas Diperoleh!</span>
            </div>
          )}
        </div>

        {/* Virtual Cash Drawer Simulator Banner (No Print) */}
        <div className="px-4 py-2.5 bg-slate-900 text-slate-100 border-b border-slate-800 flex items-center justify-between no-print">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-xl border transition-all ${
              drawerOpen
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              <Coins className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold">Laci Kasir Virtual</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider ${
                  drawerOpen
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-700 text-slate-300'
                }`}>
                  {drawerOpen ? 'TERBUKA' : 'TERTUTUP'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                {drawerOpen ? '⚡ Signal ESC/POS 24V terkirim (Drawer Kicked)' : 'Perangkat keras virtual siap menerima sinyal'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={kickDrawer}
            className="px-2.5 py-1.5 text-[11px] font-bold rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-amber-300 border border-slate-700 hover:border-amber-400/40 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{drawerOpen ? 'Tendang Lagi' : 'Uji Buka Laci'}</span>
          </button>
        </div>

        {/* Paper Size Selector (No Print) & Default Setting */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 no-print">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-900" />
              <span>Format Struk:</span>
            </span>
            <div className="flex p-0.5 bg-slate-200/80 rounded-xl">
              <button
                type="button"
                onClick={() => setPaperSize('58mm')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  paperSize === '58mm'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-blue-950'
                }`}
              >
                58mm
              </button>
              <button
                type="button"
                onClick={() => setPaperSize('80mm')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                  paperSize === '80mm'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-blue-950'
                }`}
              >
                80mm
              </button>
            </div>
          </div>

          {/* Action to persist/change default store paper size */}
          <div className="flex items-center gap-2">
            {defaultSavedSuccess ? (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md animate-in fade-in">
                ✓ Default Tersimpan
              </span>
            ) : paperSize !== savedDefaultSize ? (
              <button
                type="button"
                onClick={handleSaveAsDefault}
                disabled={savingDefault}
                className="text-[10px] font-bold text-blue-900 hover:text-blue-950 bg-blue-100/70 hover:bg-blue-200/80 px-2.5 py-1 rounded-md transition-colors border border-blue-200 flex items-center gap-1 shadow-2xs"
                title="Jadikan ukuran ini sebagai standar default outlet toko Anda seterusnya"
              >
                <span>⭐ Jadikan Default Toko</span>
              </button>
            ) : (
              <span className="text-[10px] text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded-md">
                Ukuran Default ({savedDefaultSize})
              </span>
            )}
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div
          id="thermal-receipt-content"
          className={`p-4 sm:p-6 overflow-y-auto flex-1 space-y-3.5 font-mono text-slate-800 bg-white mx-auto w-full transition-all overscroll-contain ${
            paperSize === '58mm'
              ? 'max-w-[240px] text-[11px] paper-58mm'
              : 'max-w-[340px] text-xs paper-80mm'
          }`}
        >
          {/* Header Toko */}
          <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-slate-900 font-bold text-sm sm:text-base">
              <Store className="w-4 h-4 no-print text-blue-900" />
              <span>{order.outlet?.name || 'POS Toko Utama'}</span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 leading-tight">
              {order.outlet?.address || 'Menteng, Jakarta Pusat'}
            </p>
            <p className="text-[10px] sm:text-[11px] text-slate-500">
              Telp: {order.outlet?.phone || '081234567890'}
            </p>
          </div>

          <div className="border-b border-dashed border-slate-300 my-2" />

          {/* Nomor Antrean Panggilan (Jika Aktif) */}
          {order.queueNumber !== undefined && order.queueNumber !== null && (
            <div className="border-2 border-dashed border-slate-800 p-2 my-2 rounded text-center">
              <div className="text-[9px] font-black uppercase tracking-widest text-slate-600">
                NOMOR ANTRIAN
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-wider">
                #{String(order.queueNumber).padStart(2, '0')}
              </div>
            </div>
          )}

          {/* VOID Banner jika transaksi dibatalkan */}
          {order.orderStatus === 'VOIDED' && (
            <div className="border-2 border-rose-600 bg-rose-50 text-rose-800 p-2 my-2 rounded text-center">
              <div className="text-[10px] font-black tracking-widest uppercase">
                *** VOID / DIBATALKAN ***
              </div>
              <div className="text-[9px] text-rose-700 font-semibold mt-0.5">
                Transaksi ini telah dibatalkan
              </div>
            </div>
          )}

          {/* Label / Banner Menu Tambahan / Susulan */}
          {(order.notes?.includes('SUSULAN') || order.notes?.includes('TAMBAHAN') || order.customerName?.includes('Susulan')) && (
            <div className="border border-amber-500 bg-amber-50 text-amber-900 p-2 my-2 rounded text-center">
              <div className="text-[10px] font-black tracking-wider uppercase">
                *** MENU TAMBAHAN / SUSULAN ***
              </div>
              {order.notes && (
                <div className="text-[9px] text-amber-800 font-medium mt-0.5">
                  {order.notes}
                </div>
              )}
            </div>
          )}

          {/* Info Invoice */}
          <div className="space-y-1 text-[11px] text-slate-600">
            <div className="flex justify-between">
              <span>No. Faktur:</span>
              <span className="font-bold text-slate-900">{order.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Waktu:</span>
              <span>
                {new Date(order.createdAt).toLocaleString('id-ID', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Kasir:</span>
              <span>{order.cashier?.name || 'Kasir Toko'}</span>
            </div>
            {order.customerName && (
              <div className="flex justify-between">
                <span>Pelanggan:</span>
                <span className="font-semibold text-slate-900">{order.customerName}</span>
              </div>
            )}
          </div>

          <div className="border-b border-dashed border-slate-300 my-2" />

          {/* Line Items */}
          <div className="space-y-2">
            {order.orderItems?.map((item, idx) => {
              const itemDisc = Number(item.discountAmount) || 0;
              return (
                <div key={idx} className="space-y-0.5">
                  <div className="font-bold text-slate-900">{item.product?.name}</div>
                  <div className="flex justify-between text-[10px] sm:text-[11px] text-slate-500">
                    <span>
                      {item.quantity} x Rp {Number(item.unitPrice).toLocaleString('id-ID')}
                      {itemDisc > 0 && (
                        <span className="text-rose-600 ml-1">
                          (Disc: -Rp {(itemDisc * item.quantity).toLocaleString('id-ID')})
                        </span>
                      )}
                    </span>
                    <span className="font-semibold text-slate-900">
                      Rp {Number(item.subtotal).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-b border-dashed border-slate-300 my-2" />

          {/* Kalkulasi Total */}
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>Rp {Number(order.subtotal).toLocaleString('id-ID')}</span>
            </div>
            {order.discountAmount > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Diskon Transaksi:</span>
                <span>- Rp {Number(order.discountAmount).toLocaleString('id-ID')}</span>
              </div>
            )}
            {Number(order.pointsRedeemed || 0) > 0 && (
              <div className="flex justify-between text-amber-800 font-bold">
                <span>Tukar Poin ({order.pointsRedeemed} Poin):</span>
                <span>- Rp {Number(order.pointDiscountAmount || (order.pointsRedeemed || 0) * 100).toLocaleString('id-ID')}</span>
              </div>
            )}
            {order.serviceCharge > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Biaya Layanan:</span>
                <span>+ Rp {Number(order.serviceCharge).toLocaleString('id-ID')}</span>
              </div>
            )}
            {order.taxAmount > 0 && (
              <div className="flex justify-between text-slate-500">
                <span>PPN (11%):</span>
                <span>+ Rp {Number(order.taxAmount).toLocaleString('id-ID')}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-sm sm:text-base text-blue-950 pt-1.5 border-t border-slate-200">
              <span>TOTAL:</span>
              <span>Rp {Number(order.grandTotal).toLocaleString('id-ID')}</span>
            </div>
            {Number(order.pointsEarned || 0) > 0 && (
              <div className="border border-dashed border-amber-300 bg-amber-50/80 p-1.5 rounded text-center my-1">
                <span className="text-[10px] font-bold text-amber-900">
                  ★ Poin Loyalitas Diperoleh: +{order.pointsEarned} Poin
                </span>
              </div>
            )}
          </div>

          <div className="border-b border-dashed border-slate-300 my-2" />

          {/* Pembayaran & Kembalian (Multi-Payment Support) */}
          {order.payments && order.payments.length > 0 && (
            <div className="space-y-1">
              {order.payments.length === 1 ? (
                <>
                  {(() => {
                    const p = order.payments[0];
                    const method = p.method || (p as any).paymentMethod || (p as any).payment_method || 'CASH';
                    const amountPaid = Number(p.amountPaid ?? (p as any).amount ?? (p as any).cashReceived ?? order.grandTotal ?? 0);
                    const changeGiven = Number(p.changeGiven ?? (p as any).cashChange ?? 0);
                    return (
                      <>
                        <div className="flex justify-between">
                          <span>Metode Bayar:</span>
                          <span className="font-bold">{method}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Jumlah Diterima:</span>
                          <span>Rp {amountPaid.toLocaleString('id-ID')}</span>
                        </div>
                        {method === 'CASH' && (
                          <div className="flex justify-between font-bold text-emerald-700">
                            <span>Kembalian:</span>
                            <span>Rp {changeGiven.toLocaleString('id-ID')}</span>
                          </div>
                        )}
                        {p.qrisReference && (
                          <div className="flex justify-between text-[10px] text-slate-500">
                            <span>Ref QRIS:</span>
                            <span>{p.qrisReference}</span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              ) : (
                <>
                  <div className="flex justify-between font-bold text-blue-950">
                    <span>Metode:</span>
                    <span>SPLIT (CAMPURAN)</span>
                  </div>
                  {order.payments.map((p, idx) => {
                    const method = p.method || (p as any).paymentMethod || (p as any).payment_method || 'CASH';
                    const amountPaid = Number(p.amountPaid ?? (p as any).amount ?? (p as any).cashReceived ?? 0);
                    const changeGiven = Number(p.changeGiven ?? (p as any).cashChange ?? 0);
                    return (
                      <div key={idx} className="pl-2 border-l-2 border-slate-200 space-y-0.5 text-[10px]">
                        <div className="flex justify-between">
                          <span className="font-bold text-slate-700">{method}:</span>
                          <span>Rp {amountPaid.toLocaleString('id-ID')}</span>
                        </div>
                        {method === 'CASH' && changeGiven > 0 && (
                          <div className="flex justify-between text-emerald-700 font-bold">
                            <span>Kembalian:</span>
                            <span>Rp {changeGiven.toLocaleString('id-ID')}</span>
                          </div>
                        )}
                        {p.qrisReference && (
                          <div className="flex justify-between text-slate-400">
                            <span>Ref:</span>
                            <span>{p.qrisReference}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          <div className="text-center text-[10px] text-slate-500 pt-2 border-t border-dashed border-slate-300 space-y-0.5">
            <div>Terima kasih telah berbelanja! Bukti pembayaran yang sah.</div>
            {showWatermark && (
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide pt-1">
                Powered by Well POS
              </div>
            )}
          </div>
        </div>



        {/* Footer Actions Grid (Screen only) */}
        <div className="p-4 border-t border-slate-200 bg-white space-y-2.5 no-print">
          {/* Direct Bluetooth 1-Click Print Button */}
          {btPrinter.isSupported && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={handleDirectBluetoothPrint}
                disabled={btPrinter.isPrinting}
                className={`w-full py-2.5 px-4 rounded-xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-[0.99] disabled:opacity-50 ${
                  btPrinter.isConnected
                    ? 'bg-blue-900 hover:bg-blue-800 text-white shadow-blue-900/20'
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
              >
                {btPrinter.isPrinting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-200" />
                    <span>Mencetak ke {btPrinter.deviceName || 'Printer Bluetooth'}...</span>
                  </>
                ) : btPrintSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-300">✓ Struk Berhasil Dicetak Langsung!</span>
                  </>
                ) : btPrinter.isConnected ? (
                  <>
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>⚡ Cetak Langsung Bluetooth ({btPrinter.deviceName || paperSize})</span>
                  </>
                ) : (
                  <>
                    <Bluetooth className="w-4 h-4 text-blue-400" />
                    <span>⚡ Hubungkan &amp; Cetak Langsung (Bluetooth)</span>
                  </>
                )}
              </button>

              {btPrintError && (
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-semibold flex items-center gap-1.5 animate-in fade-in">
                  <X className="w-3.5 h-3.5 shrink-0" />
                  <span>{btPrintError}</span>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-4 gap-1.5">
            {/* Tombol Cetak Thermal Browser */}
            <button
              type="button"
              onClick={handlePrint}
              className="py-2.5 px-2 rounded-xl border border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50/50 text-slate-800 text-[11px] font-bold transition-all flex flex-col items-center justify-center gap-1 shadow-xs"
              title="Cetak struk via dialog browser"
            >
              <Printer className="w-4 h-4 text-blue-900" />
              <span>Browser ({paperSize})</span>
            </button>

            {/* Tombol Unduh PDF */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="py-2.5 px-2 rounded-xl border border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50/50 text-slate-800 text-[11px] font-bold transition-all flex flex-col items-center justify-center gap-1 shadow-xs"
            >
              <Download className="w-4 h-4 text-blue-900" />
              <span>PDF</span>
            </button>

            {/* Tombol Kirim WhatsApp */}
            <button
              type="button"
              onClick={() => setModalView('WHATSAPP')}
              className="py-2.5 px-2 rounded-xl border border-emerald-200 hover:border-emerald-400 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-[11px] font-bold transition-all flex flex-col items-center justify-center gap-1 shadow-xs cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              <span>WhatsApp</span>
            </button>

            {/* Tombol Kirim Email */}
            <button
              type="button"
              onClick={() => setModalView('EMAIL')}
              className="py-2.5 px-2 rounded-xl border border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50/50 text-slate-800 text-[11px] font-bold transition-all flex flex-col items-center justify-center gap-1 shadow-xs cursor-pointer"
            >
              <Mail className="w-4 h-4 text-blue-900" />
              <span>Email</span>
            </button>
          </div>

          {/* Tombol Aksi Akhir: Tutup, Transaksi Baru & Tambah Order Susulan */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-3.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
              <span>Tutup</span>
            </button>


            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-3 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-900/20 active:scale-[0.99] cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Transaksi Baru</span>
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ======================================================= */}
    {/* 2. WHATSAPP DIGITAL RECEIPT VIEW (INLINE ZERO STACKED)  */}
    {/* ======================================================= */}
    {modalView === 'WHATSAPP' && (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-white">
        {/* Header WhatsApp Bar */}
        <div className="shrink-0 px-4 py-3 bg-[#075E54] text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setModalView('RECEIPT')}
              className="p-1.5 -ml-1 rounded-full text-emerald-100 hover:text-white hover:bg-white/10 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
              title="Kembali ke Struk"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#075E54] flex items-center justify-center font-black text-xs shrink-0">
              <Store className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-black tracking-wide truncate">
                {order.outlet?.name || 'Well POS Store'}
              </h4>
              <p className="text-[10px] text-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span className="truncate">Struk Digital WhatsApp</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-emerald-100 hover:text-white hover:bg-white/10 active:scale-95 transition-colors cursor-pointer"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Screen Mockup (Scrollable Area) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 bg-[#E5DDD5] space-y-3">
          <div className="text-center">
            <span className="px-2.5 py-0.5 rounded-full bg-white/80 text-[10px] font-semibold text-slate-600 shadow-2xs">
              HARI INI
            </span>
          </div>

          {/* Chat Bubble Struk */}
          <div className="max-w-[94%] ml-auto bg-[#DCF8C6] border border-[#C2E7A9] rounded-2xl rounded-tr-xs p-3.5 shadow-sm text-slate-800 space-y-2">
            <div className="text-[11px] font-mono whitespace-pre-wrap leading-relaxed select-text">
              {getWhatsAppText()}
            </div>
            <div className="text-[9px] text-slate-400 text-right flex items-center justify-end gap-1">
              <span>{new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="text-blue-500 font-bold">✓✓</span>
            </div>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="shrink-0 p-3.5 sm:p-4 bg-white border-t border-slate-200 space-y-2.5 max-h-[46dvh] overflow-y-auto">
          <WhatsAppInput
            label="Nomor WhatsApp Pelanggan"
            value={waRecipientPhone}
            onChange={setWaRecipientPhone}
            placeholder="81234567890"
          />

          {/* Status Gateway & Tombol Aksi */}
          {hasGatewayActive ? (
            /* Jika Gateway aktif dengan token asli */
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleSendWhatsAppGateway}
                disabled={sendingWa || !waRecipientPhone}
                className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-600/20 active:scale-[0.99]"
              >
                {sendingWa ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-200" />
                    <span>Mengirim Struk via Gateway...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-emerald-100" />
                    <span>Kirim Otomatis via Gateway (Fonnte)</span>
                  </>
                )}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleOpenWhatsAppReal}
                  className="py-2 px-2.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Buka wa.me</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyWhatsAppText}
                  className="py-2 px-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  {copiedWhatsApp ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                  <span>{copiedWhatsApp ? 'Tersalin!' : 'Salin Teks'}</span>
                </button>
              </div>
            </div>
          ) : (
            /* Mode Pengiriman WhatsApp (wa.me) */
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleOpenWhatsAppReal}
                  className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Buka wa.me</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyWhatsAppText}
                  className="py-2.5 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                >
                  {copiedWhatsApp ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
                  <span>{copiedWhatsApp ? 'Tersalin!' : 'Salin Teks'}</span>
                </button>
              </div>
              <p className="text-[11px] text-center text-slate-500">
                Membuka chat WhatsApp langsung ke nomor pelanggan dengan nota belanja otomatis.
              </p>
            </div>
          )}

          {waSendResult && (
            <div
              className={`p-2.5 rounded-xl text-xs font-bold flex items-center justify-between animate-in fade-in ${
                waSendResult.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              <div className="flex items-center gap-1.5">
                {waSendResult.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{waSendResult.message}</span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setModalView('RECEIPT')}
            className="w-full py-2 text-center text-xs font-bold text-slate-500 hover:text-slate-800 border-t border-slate-100 flex items-center justify-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Struk Kasir</span>
          </button>
        </div>
      </div>
    )}

    {/* ======================================================= */}
    {/* 3. EMAIL DIGITAL RECEIPT VIEW (INLINE ZERO STACKED)     */}
    {/* ======================================================= */}
    {modalView === 'EMAIL' && (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-white">
        {/* Header Email Client Mockup */}
        <div className="shrink-0 px-4 py-3 bg-slate-900 text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setModalView('RECEIPT')}
              className="p-1.5 -ml-1 rounded-full text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
              title="Kembali ke Struk"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-400/30 flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold truncate">Struk Digital Email</h4>
              <p className="text-[10px] text-slate-400 truncate">Pratinjau HTML &amp; Pengiriman Email</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 active:scale-95 transition-colors cursor-pointer"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Email Meta Bar */}
        <div className="shrink-0 px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs space-y-1 text-slate-600">
          <div className="flex justify-between">
            <span className="font-semibold text-slate-500">Subjek:</span>
            <span className="font-bold text-blue-950 truncate ml-2">Bukti Transaksi Faktur #{order.invoiceNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-slate-500">Kepada:</span>
            <span className="font-mono text-slate-800 truncate ml-2">{recipientEmail || order.customerEmail || 'pelanggan@email.com'}</span>
          </div>
        </div>

        {/* Rendered HTML Email Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 bg-slate-100">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 max-w-sm mx-auto text-xs text-slate-700">
            <div className="text-center border-b border-slate-100 pb-2.5">
              <h2 className="text-sm font-black text-blue-950 uppercase tracking-tight">
                {order.outlet?.name || 'WELL POS TOKO'}
              </h2>
              <p className="text-[10px] text-slate-500 mt-0.5">Bukti Transaksi Resmi</p>
              <p className="text-[9px] text-slate-400 font-mono mt-0.5">Faktur #{order.invoiceNumber}</p>
            </div>

            <div className="space-y-1 border-b border-slate-100 pb-2.5 font-mono text-[11px]">
              {order.orderItems?.map((it, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{it.product?.name} x{it.quantity}</span>
                  <span className="font-bold">Rp {Number(it.subtotal).toLocaleString('id-ID')}</span>
                </div>
              ))}
            </div>

            <div className="space-y-1 font-mono text-right text-[11px]">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal:</span>
                <span>Rp {Number(order.subtotal).toLocaleString('id-ID')}</span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Diskon Promo:</span>
                  <span>-Rp {Number(order.discountAmount).toLocaleString('id-ID')}</span>
                </div>
              )}
              {order.taxAmount > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>PPN (11%):</span>
                  <span>+Rp {Number(order.taxAmount).toLocaleString('id-ID')}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-xs text-blue-950 pt-1 border-t border-slate-100">
                <span>TOTAL:</span>
                <span>Rp {Number(order.grandTotal).toLocaleString('id-ID')}</span>
              </div>
            </div>

            <div className="text-center pt-2 text-[9px] text-slate-400 border-t border-slate-100">
              Terima kasih telah berbelanja! Email ini dikirim otomatis oleh sistem kasir Well POS.
            </div>
          </div>
        </div>

        {/* Email Actions Bar */}
        <div className="shrink-0 p-3.5 sm:p-4 bg-white border-t border-slate-200 space-y-2.5">
          <form onSubmit={handleSendEmail} className="flex gap-2">
            <input
              type="email"
              required
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="Ketik email penerima asli..."
              className="flex-1 bg-slate-50 border border-slate-300 focus:border-blue-900 rounded-xl px-3 py-2 text-xs font-semibold outline-hidden"
            />
            <button
              type="submit"
              disabled={sendingEmail}
              className="px-4 py-2 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
            >
              {sendingEmail ? (
                <span>Mengirim...</span>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Kirim Email</span>
                </>
              )}
            </button>
          </form>

          {emailStatus && (
            <div
              className={`p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between ${
                emailStatus.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              <span>{emailStatus.message}</span>
              {emailStatus.previewUrl && (
                <a
                  href={emailStatus.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline font-bold text-blue-900 flex items-center gap-1 ml-2 shrink-0"
                >
                  <span>Lihat Web Mail</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setModalView('RECEIPT')}
            className="w-full py-2 text-center text-xs font-bold text-slate-500 hover:text-slate-800 border-t border-slate-100 flex items-center justify-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Struk Kasir</span>
          </button>
        </div>
      </div>
    )}
  </div>
    </div>,
    document.body
  );
};
