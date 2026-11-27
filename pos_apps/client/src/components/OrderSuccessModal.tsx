import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  Printer,
  PlusCircle,
  Download,
  Mail,
  X,
  MessageCircle,
  Coins,
  RefreshCw,
  Tag,
} from 'lucide-react';
import type { Order } from '../types/order';
import { generateReceiptPdf } from '../utils/receiptPdf';
import { usePlan } from '../hooks/usePlan';
import { api } from '../services/api';
import { useThermalPrinterHub } from '../hooks/useThermalPrinterHub';
import { getCupItemsFromOrder } from '../utils/cupLabel';
import { ReceiptPrintBody } from './pos/ReceiptPrintBody';
import { WhatsAppReceiptView } from './pos/WhatsAppReceiptView';
import { EmailReceiptView } from './pos/EmailReceiptView';
import { useDialog } from '../context/DialogContext';

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
  const dialog = useDialog();
  const { isFree } = usePlan();
  
  const defaultOutletPaperSize = (order?.outlet?.receiptConfig?.paperSize as '58mm' | '80mm') || '58mm';
  const [paperSize, setPaperSize] = useState<'58mm' | '80mm'>(defaultOutletPaperSize);
  const [savedDefaultSize, setSavedDefaultSize] = useState<'58mm' | '80mm'>(defaultOutletPaperSize);
  const [savingDefault, setSavingDefault] = useState(false);
  const [defaultSavedSuccess, setDefaultSavedSuccess] = useState(false);

  useEffect(() => {
    if (order?.outlet?.receiptConfig?.paperSize) {
      const size = order.outlet.receiptConfig.paperSize as '58mm' | '80mm';
      setPaperSize(size);
      setSavedDefaultSize(size);
    }
  }, [order?.id]);

  const [modalView, setModalView] = useState<'RECEIPT' | 'WHATSAPP' | 'EMAIL'>('RECEIPT');
  const [recipientEmail, setRecipientEmail] = useState(order?.customerEmail || '');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{
    type: 'success' | 'error';
    message: string;
    previewUrl?: string;
  } | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const printerHub = useThermalPrinterHub();
  const [autoPrinted, setAutoPrinted] = useState(false);
  const [cupAutoPrinted, setCupAutoPrinted] = useState(false);

  const showWatermark = order?.outlet?.receiptConfig?.showWatermark !== false;
  const waConfig = order?.outlet?.receiptConfig?.whatsappConfig;
  const hasGatewayActive = Boolean(
    waConfig?.enabled &&
    waConfig?.apiKey &&
    waConfig.apiKey.trim().length > 0
  );

  // Cup Label Config
  const rawReceiptConfig = order?.outlet?.receiptConfig || (order?.outlet as any)?.receipt_config;
  const parsedReceiptConfig = useMemo(() => {
    if (!rawReceiptConfig) return null;
    if (typeof rawReceiptConfig === 'string') {
      try {
        return JSON.parse(rawReceiptConfig);
      } catch {
        return null;
      }
    }
    return rawReceiptConfig;
  }, [rawReceiptConfig]);

  const cupLabelConfig = parsedReceiptConfig?.cupLabelConfig;
  const isCupLabelEnabled = Boolean(cupLabelConfig?.enabled);
  const cupItems = useMemo(() => {
    if (!isCupLabelEnabled || !order) return [];
    return getCupItemsFromOrder(order, cupLabelConfig?.onlyBeverages ?? true);
  }, [order, isCupLabelEnabled, cupLabelConfig?.onlyBeverages]);
  const cupCount = cupItems.length;

  const [waRecipientPhone, setWaRecipientPhone] = useState(order?.customerPhone || '');
  const [sendingWa, setSendingWa] = useState(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);

  // Body class toggle for print styles
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('has-receipt-modal');
    } else {
      document.body.classList.remove('has-receipt-modal');
    }
    return () => {
      document.body.classList.remove('has-receipt-modal');
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !order) return;
    setModalView('RECEIPT');
    setWaRecipientPhone(order.customerPhone || '');
    setRecipientEmail(order.customerEmail || '');

    // Virtual cash drawer
    const hasCash = order.payments?.some((p) => (p.method || (p as any).paymentMethod) === 'CASH');
    if (hasCash) {
      setDrawerOpen(true);
      const timer = setTimeout(() => setDrawerOpen(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, order]);

  // Auto-print receipt
  useEffect(() => {
    if (!isOpen || !order || autoPrinted) return;
    if (printerHub.autoPrintEnabled && printerHub.isConnected && !printerHub.isPrinting) {
      printerHub
        .printReceipt(order, {
          paperSize,
          showQueueNumber: order?.outlet?.receiptConfig?.showQueueNumber !== false,
          showWatermark,
          footerText: order?.outlet?.receiptConfig?.footerText,
        })
        .then((res) => {
          if (res.success) setAutoPrinted(true);
        });
    }
  }, [isOpen, order, printerHub.autoPrintEnabled, printerHub.isConnected, autoPrinted, paperSize, showWatermark]);

  // Auto-print Cup Labels
  useEffect(() => {
    if (!isOpen || !order || cupAutoPrinted || !isCupLabelEnabled || cupCount === 0) return;
    const isCupAutoPrintOn = parsedReceiptConfig?.cupLabelConfig?.autoPrintOnCheckout ?? true;
    if (isCupAutoPrintOn && printerHub.isLabelConnected && !printerHub.isPrintingLabel) {
      printerHub
        .printCupLabels(order, {
          onlyBeverages: cupLabelConfig?.onlyBeverages ?? true,
          paperSize: cupLabelConfig?.paperSize || '40x30mm',
        })
        .then((res) => {
          if (res.success) setCupAutoPrinted(true);
        });
    }
  }, [isOpen, order, cupAutoPrinted, isCupLabelEnabled, cupCount, printerHub.isLabelConnected, cupLabelConfig, parsedReceiptConfig]);

  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDirectHardwarePrint = async () => {
    if (!printerHub.isConnected) {
      const reconnected = await printerHub.tryAutoReconnect();
      if (!reconnected) {
        if (printerHub.connectionType === 'usb' && printerHub.isUsbSupported) {
          const ok = await printerHub.connectUsb();
          if (!ok) return;
        } else if (printerHub.isBluetoothSupported) {
          const ok = await printerHub.connectBluetooth();
          if (!ok) return;
        }
      }
    }

    await printerHub.printReceipt(order, {
      paperSize,
      showQueueNumber: order?.outlet?.receiptConfig?.showQueueNumber !== false,
      showWatermark,
      footerText: order?.outlet?.receiptConfig?.footerText,
    });
  };

  const handlePrintCupLabels = async () => {
    if (!order || cupCount === 0) return;
    if (!printerHub.isLabelConnected) {
      const reconnected = await printerHub.tryAutoReconnectLabel();
      if (!reconnected) {
        if (printerHub.labelPrinter.connectionType === 'usb' && printerHub.isUsbSupported) {
          const ok = await printerHub.connectLabelUsb();
          if (!ok) return;
        } else if (printerHub.isBluetoothSupported) {
          const ok = await printerHub.connectLabelBluetooth();
          if (!ok) return;
        }
      }
    }

    await printerHub.printCupLabels(order, {
      onlyBeverages: cupLabelConfig?.onlyBeverages ?? true,
      paperSize: cupLabelConfig?.paperSize || '40x30mm',
    });
  };

  const handleDownloadPdf = async () => {
    await generateReceiptPdf(order, paperSize);
  };

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

  const getWhatsAppText = () => {
    const outletName = order.outlet?.name || 'Well POS Toko';
    const timeStr = new Date(order.createdAt).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    const itemsText = order.orderItems?.map((item) => {
      const disc = Number(item.discountAmount) || 0;
      const discStr = disc > 0 ? ` (Disc: -Rp ${(disc * item.quantity).toLocaleString('id-ID')})` : '';
      return `• ${item.product?.name} x${item.quantity} = Rp ${Number(item.subtotal).toLocaleString('id-ID')}${discStr}`;
    }).join('\n') || '';

    const paymentsText = order.payments?.map((p) => {
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
      `--------------------------------\n` +
      `PEMBAYARAN:\n${paymentsText}\n` +
      `--------------------------------\n` +
      `Terima kasih telah berbelanja di ${outletName}! Simpan struk ini sebagai bukti transaksi resmi.` +
      (isFree ? `\n\n_Powered by Well POS_\n_wellpos.id_` : '');
  };

  const handleOpenWhatsAppReal = () => {
    const text = getWhatsAppText();
    const cleanPhone = (waRecipientPhone || order.customerPhone || '').replace(/\D/g, '');
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
    if (!waRecipientPhone) return;
    setSendingWa(true);
    try {
      const res = await api.sendOrderWhatsApp(order.id, waRecipientPhone);
      if (res.status === 'success') {
        dialog.toast('Struk berhasil dikirim ke nomor WhatsApp pelanggan!', 'success');
      } else {
        dialog.toast(res.message || 'Gagal mengirim WhatsApp via Gateway.', 'error');
      }
    } catch (err: any) {
      dialog.toast(err.message || 'Terjadi kesalahan sistem pengiriman WhatsApp.', 'error');
    } finally {
      setSendingWa(false);
    }
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
            {/* Action Hub Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-950 to-blue-900 text-white text-center flex flex-col items-center justify-center no-print relative shrink-0">
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup Struk"
                className="absolute top-3 right-3 p-2 rounded-full text-white bg-white/20 hover:bg-white/30 active:scale-95 transition-all z-20 cursor-pointer shadow-sm"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mb-2 shadow-sm shrink-0">
                <CheckCircle2 className="w-6 h-6 shrink-0" />
              </div>
              <h3 className="text-lg font-black tracking-tight">Transaksi Berhasil</h3>
              {order.queueNumber !== undefined && order.queueNumber !== null && (
                <div className="mt-2 px-4 py-1 rounded-2xl bg-white/10 border border-white/25 shadow-inner flex flex-col items-center">
                  <span className="text-[10px] font-black tracking-widest text-amber-300 uppercase">
                    Nomor Antrean
                  </span>
                  <span className="text-2xl font-black tracking-wider text-white">
                    #{String(order.queueNumber).padStart(2, '0')}
                  </span>
                </div>
              )}
              <p className="text-xs text-blue-200/80 mt-1">Faktur #{order.invoiceNumber}</p>
            </div>

            {/* Virtual Cash Drawer Simulator Banner */}
            <div className="px-4 py-2 bg-slate-900 text-slate-100 border-b border-slate-800 flex items-center justify-between no-print text-xs">
              <div className="flex items-center gap-2">
                <Coins className={`w-4 h-4 ${drawerOpen ? 'text-amber-400 animate-bounce' : 'text-slate-400'}`} />
                <span className="font-semibold text-[11px]">
                  {drawerOpen ? 'Laci Kas Terbuka' : 'Laci Kasir Standby'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(!drawerOpen)}
                className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                {drawerOpen ? 'Tutup' : 'Buka Laci'}
              </button>
            </div>

            {/* Paper Size Selector (58mm / 80mm) */}
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between no-print text-xs">
              <span className="text-slate-600 font-bold text-[11px]">Lebar Kertas:</span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {(['58mm', '80mm'] as const).map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setPaperSize(sz)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        paperSize === sz
                          ? 'bg-blue-900 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>

                {defaultSavedSuccess ? (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                    ✓ Default
                  </span>
                ) : paperSize !== savedDefaultSize ? (
                  <button
                    type="button"
                    onClick={handleSaveAsDefault}
                    disabled={savingDefault}
                    className="text-[10px] font-bold text-blue-900 bg-blue-100/70 hover:bg-blue-200/80 px-2 py-0.5 rounded-md transition-colors border border-blue-200 cursor-pointer"
                  >
                    Set Default
                  </button>
                ) : null}
              </div>
            </div>

            {/* Scrollable Printable Receipt Content */}
            <ReceiptPrintBody
              order={order}
              paperSize={paperSize}
              showWatermark={isFree}
            />

            {/* Action Hub Sticky Footer */}
            <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-white space-y-2 no-print shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {/* Primary Action Button: Cetak Struk Langsung */}
              <button
                type="button"
                onClick={handleDirectHardwarePrint}
                disabled={printerHub.isPrinting}
                className={`w-full py-2.5 px-4 rounded-xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-[0.99] disabled:opacity-50 ${
                  printerHub.isConnected
                    ? 'bg-blue-900 hover:bg-blue-800 text-white shadow-blue-900/20'
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
              >
                {printerHub.isPrinting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-200" />
                    <span>Mencetak ke Printer Thermal...</span>
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4 text-blue-300" />
                    <span>Cetak Struk Thermal ({paperSize})</span>
                  </>
                )}
              </button>

              {/* Contextual Action: Cetak Stiker Cup Barista (jika ada minuman) */}
              {isCupLabelEnabled && cupCount > 0 && (
                <button
                  type="button"
                  onClick={handlePrintCupLabels}
                  disabled={printerHub.isPrintingLabel}
                  className="w-full py-2 px-3 rounded-xl font-bold text-xs bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Tag className="w-3.5 h-3.5 text-amber-700" />
                  <span>Cetak Stiker Cup Barista ({cupCount} Cup)</span>
                </button>
              )}

              {/* Secondary Actions Grid */}
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="py-2 px-1.5 rounded-xl border border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50/50 text-slate-800 text-[11px] font-bold transition-all flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer"
                  title="Cetak via dialog browser"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-900" />
                  <span>Browser</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="py-2 px-1.5 rounded-xl border border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50/50 text-slate-800 text-[11px] font-bold transition-all flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-blue-900" />
                  <span>PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalView('WHATSAPP')}
                  className="py-2 px-1.5 rounded-xl border border-emerald-200 hover:border-emerald-400 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-[11px] font-bold transition-all flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalView('EMAIL')}
                  className="py-2 px-1.5 rounded-xl border border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50/50 text-slate-800 text-[11px] font-bold transition-all flex flex-col items-center justify-center gap-0.5 shadow-xs cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5 text-blue-900" />
                  <span>Email</span>
                </button>
              </div>

              {/* Final Close / New Order Bar */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Tutup</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-900/20 active:scale-[0.99] cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Transaksi Baru</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {modalView === 'WHATSAPP' && (
          <WhatsAppReceiptView
            order={order}
            onBack={() => setModalView('RECEIPT')}
            onClose={onClose}
            waRecipientPhone={waRecipientPhone}
            setWaRecipientPhone={setWaRecipientPhone}
            hasGatewayActive={hasGatewayActive}
            sendingWa={sendingWa}
            copiedWhatsApp={copiedWhatsApp}
            getWhatsAppText={getWhatsAppText}
            handleSendWhatsAppGateway={handleSendWhatsAppGateway}
            handleOpenWhatsAppReal={handleOpenWhatsAppReal}
            handleCopyWhatsAppText={handleCopyWhatsAppText}
          />
        )}

        {modalView === 'EMAIL' && (
          <EmailReceiptView
            order={order}
            onBack={() => setModalView('RECEIPT')}
            onClose={onClose}
            recipientEmail={recipientEmail}
            setRecipientEmail={setRecipientEmail}
            sendingEmail={sendingEmail}
            emailStatus={emailStatus}
            handleSendEmail={handleSendEmail}
          />
        )}
      </div>
    </div>,
    document.body
  );
};
