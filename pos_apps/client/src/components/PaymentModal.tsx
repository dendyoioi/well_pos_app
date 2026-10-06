import React, { useState, useEffect } from 'react';
import { X, Banknote, QrCode, Split, CheckCircle, AlertCircle, ArrowRight, Lock, UserCheck, Users, Calendar, AlertTriangle } from 'lucide-react';
import type { PaymentPayload, PaymentMethodType } from '../types/order';
import type { Customer } from '../types/customer';
import type { Outlet } from '../types/outlet';
import { usePlan } from '../hooks/usePlan';
import { CurrencyInput } from './ui/CurrencyInput';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  grandTotal: number;
  onCheckout: (payment: PaymentPayload, payments?: PaymentPayload[]) => Promise<void>;
  loading: boolean;
  selectedCustomer?: Customer | null;
  customerName?: string;
  onOpenCustomerPicker?: () => void;
  outlet?: Outlet | null;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  grandTotal,
  onCheckout,
  loading,
  selectedCustomer,
  customerName,
  onOpenCustomerPicker,
  outlet,
}) => {
  const { isFree } = usePlan();
  const [method, setMethod] = useState<PaymentMethodType>('CASH');
  const [amountPaid, setAmountPaid] = useState<number>(grandTotal);
  const [qrisRef, setQrisRef] = useState('');
  const [qrisPaid, setQrisPaid] = useState(false);

  // State khusus Split Payment (Tunai + QRIS)
  const [splitCashPortion, setSplitCashPortion] = useState<number>(Math.round(grandTotal / 2));
  const [splitCashTendered, setSplitCashTendered] = useState<number>(Math.round(grandTotal / 2));
  const [splitQrisPaid, setSplitQrisPaid] = useState(false);
  const [splitQrisRef, setSplitQrisRef] = useState('');
  const qrisConfig = outlet?.paymentConfig?.qris;
  const isCreditAllowed = outlet?.paymentConfig?.customerDebt?.allowCredit === true;
  const defaultDueDays = outlet?.paymentConfig?.customerDebt?.defaultDueDays || 7;

  // State Kasbon / Piutang
  const [debtDueDate, setDebtDueDate] = useState<string>('');
  const [debtNotes, setDebtNotes] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setMethod('CASH');
      setAmountPaid(grandTotal);
      setQrisRef('');
      setQrisPaid(false);
      const half = Math.round(grandTotal / 2);
      setSplitCashPortion(half);
      setSplitCashTendered(half);
      setSplitQrisPaid(false);
      setSplitQrisRef('');

      // Inisialisasi tanggal jatuh tempo default
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + defaultDueDays);
      setDebtDueDate(defaultDate.toISOString().slice(0, 10));
      setDebtNotes('');
    }
  }, [isOpen, grandTotal, defaultDueDays]);

  const changeGiven = Math.max(0, amountPaid - grandTotal);
  const isCashInsufficient = method === 'CASH' && amountPaid < grandTotal;

  // Split Payment Calculations
  const splitQrisPortion = Math.max(0, grandTotal - splitCashPortion);
  const splitCashChange = Math.max(0, splitCashTendered - splitCashPortion);
  const isSplitCashInsufficient = splitCashTendered < splitCashPortion;

  // Preset pecahan uang tunai rupiah
  const cashSuggestions = [
    { label: 'Uang Pas', value: grandTotal },
    { label: '10.000', value: 10000 },
    { label: '20.000', value: 20000 },
    { label: '50.000', value: 50000 },
    { label: '100.000', value: 100000 },
    { label: '200.000', value: 200000 },
  ].filter((s) => s.value >= grandTotal || s.label === 'Uang Pas');

  const handlePay = () => {
    if (method === 'CASH') {
      if (amountPaid < grandTotal) return;
      onCheckout({
        method: 'CASH',
        amountPaid: Number(amountPaid),
        changeGiven: changeGiven,
      });
    } else if (method === 'QRIS') {
      if (!qrisPaid) return;
      onCheckout({
        method: 'QRIS',
        amountPaid: grandTotal,
        qrisReference: qrisRef.trim() || undefined,
      });
    } else if (method === 'SPLIT') {
      if (isSplitCashInsufficient || !splitQrisPaid) return;
      const payments: PaymentPayload[] = [
        {
          method: 'CASH',
          amountPaid: Number(splitCashTendered),
          changeGiven: splitCashChange,
        },
        {
          method: 'QRIS',
          amountPaid: Number(splitQrisPortion),
          qrisReference: splitQrisRef.trim() || undefined,
        },
      ];
      onCheckout(payments[0], payments);
    } else if (method === 'DEBT') {
      if (!selectedCustomer) return;
      onCheckout({
        method: 'DEBT',
        amountPaid: grandTotal,
        changeGiven: 0,
        dueDate: debtDueDate || undefined,
        debtNotes: debtNotes.trim() || undefined,
      });
    }
  };

  // Handle hotkeys (Enter to submit, Escape to close)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        if (method === 'CASH' && amountPaid >= grandTotal && !loading) {
          handlePay();
        } else if (method === 'QRIS' && qrisPaid && !loading) {
          handlePay();
        } else if (
          method === 'SPLIT' &&
          splitCashTendered >= splitCashPortion &&
          splitQrisPaid &&
          !loading
        ) {
          handlePay();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, method, amountPaid, grandTotal, qrisPaid, splitCashTendered, splitCashPortion, splitQrisPaid, loading]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[95vh]">
        {/* Header Modal */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div>
            <h3 className="font-extrabold text-blue-950 text-base sm:text-lg">
              Pembayaran Kasir
            </h3>
            <p className="text-xs text-slate-500">
              Pilih metode pembayaran dan selesaikan transaksi
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
          {/* Total Tagihan Banner */}
          <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200/80 text-center">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Tagihan Pembayaran
            </span>
            <div className="text-3xl sm:text-4xl font-black text-blue-950 mt-1">
              Rp {grandTotal.toLocaleString('id-ID')}
            </div>
          </div>

          {/* Customer / Member Info Tag */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-black text-xs ${
                selectedCustomer
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'bg-slate-200 text-slate-600'
              }`}>
                {selectedCustomer ? '★' : <Users className="w-4 h-4" />}
              </div>
              <div className="truncate">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-bold text-slate-900 truncate">
                    {selectedCustomer ? selectedCustomer.name : (customerName || 'Pelanggan Umum (Walk-in)')}
                  </span>
                  {selectedCustomer?.code && (
                    <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-900 font-mono text-[10px] font-bold">
                      {selectedCustomer.code}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 font-medium truncate">
                  {selectedCustomer?.phone ? (
                    <span>WA: {selectedCustomer.phone} • {selectedCustomer.visitCount}x Kunjungan</span>
                  ) : (
                    <span>Transaksi tanpa kartu loyalitas</span>
                  )}
                </div>
              </div>
            </div>

            {onOpenCustomerPicker && (
              <button
                type="button"
                onClick={onOpenCustomerPicker}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 hover:border-slate-300 text-[11px] font-bold text-blue-900 transition-colors shrink-0 ml-2 shadow-2xs cursor-pointer flex items-center gap-1"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>{selectedCustomer ? 'Ganti' : 'Pilih Member'}</span>
              </button>
            )}
          </div>

          {/* Tab Metode Pembayaran (Tunai, QRIS, Split, Kasbon) */}
          <div className={`grid ${isCreditAllowed ? 'grid-cols-4' : 'grid-cols-3'} p-1 bg-slate-100 border border-slate-200 rounded-2xl gap-1`}>
            <button
              type="button"
              onClick={() => setMethod('CASH')}
              className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                method === 'CASH'
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-blue-950'
              }`}
            >
              <Banknote className="w-4 h-4" />
              <span>Tunai</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMethod('QRIS');
                setAmountPaid(grandTotal);
              }}
              className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                method === 'QRIS'
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-blue-950'
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span>QRIS</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMethod('SPLIT');
                const half = Math.round(grandTotal / 2);
                setSplitCashPortion(half);
                setSplitCashTendered(half);
              }}
              className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                method === 'SPLIT'
                  ? 'bg-blue-900 text-white shadow-sm'
                  : isFree
                  ? 'text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100'
                  : 'text-slate-600 hover:text-blue-950'
              }`}
            >
              <Split className="w-4 h-4" />
              <span>Split</span>
              {isFree && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-200/80 text-amber-900 text-[10px] font-black">
                  <Lock className="w-2.5 h-2.5" />
                  <span>PRO</span>
                </span>
              )}
            </button>

            {isCreditAllowed && (
              <button
                type="button"
                onClick={() => {
                  setMethod('DEBT');
                  setAmountPaid(grandTotal);
                }}
                className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  method === 'DEBT'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-amber-800'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Kasbon</span>
              </button>
            )}
          </div>

          {/* KONTEN TAB TUNAI */}
          {method === 'CASH' && (
            <div className="space-y-4">
              {/* Tombol Cepat Pecahan */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">
                  Uang Cepat / Pecahan:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {cashSuggestions.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAmountPaid(item.value)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
                        amountPaid === item.value
                          ? 'bg-blue-900 text-white border-blue-900 shadow-sm'
                          : 'bg-slate-50 hover:bg-blue-50/80 text-slate-800 border-slate-200'
                      }`}
                    >
                      {item.label === 'Uang Pas'
                        ? 'Uang Pas'
                        : `Rp ${item.value.toLocaleString('id-ID')}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Uang Diterima */}
              <div>
                <CurrencyInput
                  label="Uang Tunai Diterima:"
                  value={amountPaid}
                  onChange={(val) => setAmountPaid(val)}
                  inputClassName="py-3 text-lg font-black text-right text-slate-900 focus:border-blue-900"
                  prefixClassName="text-sm font-bold"
                  placeholder="0"
                />
              </div>

              {/* Uang Kembalian Box */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  isCashInsufficient
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">
                    {isCashInsufficient ? 'Uang Masih Kurang' : 'Uang Kembalian Pelanggan'}
                  </span>
                  {isCashInsufficient && <AlertCircle className="w-4 h-4 text-rose-600" />}
                </div>
                <div
                  className={`text-2xl font-black mt-1 ${
                    isCashInsufficient ? 'text-rose-600' : 'text-emerald-700'
                  }`}
                >
                  {isCashInsufficient
                    ? `- Rp ${(grandTotal - amountPaid).toLocaleString('id-ID')}`
                    : `Rp ${changeGiven.toLocaleString('id-ID')}`}
                </div>
              </div>
            </div>
          )}

          {/* KONTEN TAB QRIS */}
          {method === 'QRIS' && (
            <div className="space-y-4">
              {/* QRIS Static Display */}
              <div className="p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center">
                <div className="w-48 sm:w-56 bg-white p-3 border-2 border-slate-300 rounded-2xl shadow-md flex flex-col items-center justify-between">
                  <div className="w-full flex items-center justify-between px-1 border-b border-slate-100 pb-1">
                    <span className="text-[10px] font-black tracking-wider text-rose-700">QRIS</span>
                    <span className="text-[9px] font-mono text-slate-500 font-bold">
                      {qrisConfig?.nmid ? `NMID: ${qrisConfig.nmid}` : ''}
                    </span>
                  </div>

                  <div className="text-center w-full px-1 py-1">
                    <p className="text-[11px] font-black text-slate-900 truncate uppercase">
                      {qrisConfig?.merchantName || outlet?.name || ''}
                    </p>
                    {qrisConfig?.bankName && (
                      <p className="text-[9px] text-slate-400 font-semibold">{qrisConfig.bankName}</p>
                    )}
                  </div>

                  {qrisConfig?.imageUrl ? (
                    <div className="w-36 h-36 sm:w-44 sm:h-44 bg-white p-1 rounded-xl flex items-center justify-center overflow-hidden my-1 border border-slate-100">
                      <img
                        src={qrisConfig.imageUrl}
                        alt="Barcode QRIS Toko"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-36 h-36 sm:w-44 sm:h-44 bg-slate-100 border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center my-1 gap-2">
                      <QrCode className="w-8 h-8 sm:w-10 sm:h-10 text-slate-300" />
                      <p className="text-[10px] text-slate-400 font-semibold text-center px-2">
                        Upload QRIS statis di<br />Pengaturan › Metode Pembayaran
                      </p>
                    </div>
                  )}

                  <div className="w-full bg-blue-50 py-1.5 px-2 rounded-lg border border-blue-100 flex items-center justify-between mt-1">
                    <span className="text-[10px] text-blue-950 font-bold">Total:</span>
                    <span className="text-xs font-black text-blue-950 font-mono">
                      Rp {grandTotal.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] sm:text-xs text-slate-500 mt-2 font-medium text-center">
                  {qrisConfig?.imageUrl
                    ? 'Tunjukkan barcode QRIS di atas kepada konsumen untuk di-scan.'
                    : 'Belum ada QR yang dikonfigurasi. Hubungi pengelola toko.'}
                </p>
              </div>

              {/* Konfirmasi Manual Pembayaran */}
              <div className="space-y-3">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium">
                  Setelah pelanggan menyelesaikan scan QRIS, konfirmasikan pembayaran di bawah ini.
                </div>

                {!qrisPaid ? (
                  <button
                    type="button"
                    onClick={() => setQrisPaid(true)}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Konfirmasi Pembayaran QRIS Diterima</span>
                  </button>
                ) : (
                  <div className="p-3 bg-emerald-100 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-800 flex items-center justify-between gap-2 animate-fadeIn">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>Pembayaran QRIS Telah Dikonfirmasi</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setQrisPaid(false); setQrisRef(''); }}
                      className="text-[10px] text-emerald-600 hover:text-rose-600 font-semibold underline cursor-pointer shrink-0"
                    >
                      Batal
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nomor Referensi Transaksi / RRN (Opsional):
                  </label>
                  <input
                    type="text"
                    value={qrisRef}
                    onChange={(e) => setQrisRef(e.target.value)}
                    placeholder="Contoh: 240924123456 (dari notif bank)"
                    className="w-full bg-white border border-slate-300 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 text-slate-900 rounded-xl px-3.5 py-2.5 text-xs font-mono transition-all outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* KONTEN TAB SPLIT PAYMENT */}
          {method === 'SPLIT' && (
            isFree ? (
              <div className="p-5 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl space-y-3 animate-fadeIn">
                <div className="flex items-center gap-2 text-amber-950 font-extrabold text-sm">
                  <Lock className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>Fitur Split Payment Khusus Paket PRO</span>
                </div>
                <p className="text-xs text-amber-900 leading-relaxed">
                  Fitur pembayaran gabungan <strong>Tunai + QRIS</strong> hanya tersedia pada toko berstatus <strong>Paket PRO</strong>.
                </p>
                <div className="p-3.5 bg-white/90 border border-amber-200/70 rounded-xl text-xs space-y-1.5 text-slate-700">
                  <div className="font-extrabold text-slate-900">Keunggulan Paket PRO (Rp 129.000 / bln):</div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-600">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span>Split payment (campuran Tunai & Non-Tunai dalam 1 nota)</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-600">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span>Fitur Tahan Antrean Kasir (Hold / Resume Orders)</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-600">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span>Multi-outlet & multi-gudang tanpa batas transaksi</span>
                  </div>
                </div>
                <div className="text-[11px] text-amber-800 font-medium">
                  💡 <em>Pilih metode <strong>Tunai</strong> atau <strong>QRIS</strong> di atas untuk menyelesaikan pesanan ini.</em>
                </div>
              </div>
            ) : (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900">
                Kombinasikan pembayaran sebagian <strong>Tunai</strong> dan sisanya <strong>QRIS Non-Tunai</strong>.
              </div>

              {/* Rincian Porsi */}
              <div className="grid grid-cols-2 gap-3">
                {/* Porsi Tunai */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                  <div className="flex items-center gap-1.5 text-slate-700 font-bold text-xs">
                    <Banknote className="w-4 h-4 text-blue-900" />
                    <span>Porsi Tunai</span>
                  </div>
                  <CurrencyInput
                    value={splitCashPortion}
                    max={grandTotal}
                    onChange={(val) => {
                      setSplitCashPortion(val);
                      setSplitCashTendered(val);
                    }}
                    inputClassName="py-1.5 text-sm font-black text-right outline-none"
                    placeholder="0"
                  />
                </div>

                {/* Porsi QRIS (Auto-calculated) */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                  <div className="flex items-center gap-1.5 text-slate-700 font-bold text-xs">
                    <QrCode className="w-4 h-4 text-blue-900" />
                    <span>Porsi QRIS</span>
                  </div>
                  <div className="bg-white border border-slate-200 text-blue-950 rounded-xl px-3 py-2 text-sm font-black">
                    Rp {splitQrisPortion.toLocaleString('id-ID')}
                  </div>
                </div>
              </div>

              {/* Input Uang Tunai Fisik Diterima */}
              <div className="space-y-1.5">
                <CurrencyInput
                  label="Uang Fisik Tunai Diterima Pelanggan:"
                  value={splitCashTendered}
                  onChange={(val) => setSplitCashTendered(val)}
                  inputClassName="py-2.5 text-base font-black text-right"
                  prefixClassName="text-sm font-bold"
                  placeholder="0"
                />

                {/* Kembalian Tunai */}
                <div
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between ${
                    isSplitCashInsufficient
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  }`}
                >
                  <span>{isSplitCashInsufficient ? 'Uang Tunai Kurang' : 'Kembalian Tunai'}</span>
                  <span className="text-sm font-black">
                    {isSplitCashInsufficient
                      ? `- Rp ${(splitCashPortion - splitCashTendered).toLocaleString('id-ID')}`
                      : `Rp ${splitCashChange.toLocaleString('id-ID')}`}
                  </span>
                </div>
              </div>

              {/* Konfirmasi QRIS Porsi Split (Manual) */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">
                    Tagihan QRIS: Rp {splitQrisPortion.toLocaleString('id-ID')}
                  </span>
                  {splitQrisPaid ? (
                    <span className="text-emerald-700 font-extrabold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Dikonfirmasi
                    </span>
                  ) : (
                    <span className="text-amber-700 font-bold">Menunggu Konfirmasi</span>
                  )}
                </div>

                {!splitQrisPaid ? (
                  <button
                    type="button"
                    onClick={() => setSplitQrisPaid(true)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Konfirmasi QRIS Rp {splitQrisPortion.toLocaleString('id-ID')} Diterima</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={splitQrisRef}
                      onChange={(e) => setSplitQrisRef(e.target.value)}
                      placeholder="Ref/RRN QRIS (Opsional)"
                      className="flex-1 bg-white border border-slate-300 text-slate-900 rounded-xl px-3 py-1.5 text-xs font-mono outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setSplitQrisPaid(false)}
                      className="px-2.5 py-1.5 text-slate-500 hover:text-rose-600 text-xs font-semibold cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                )}
              </div>
            </div>
            )
          )}
          {/* KONTEN TAB KASBON / PIUTANG */}
          {method === 'DEBT' && (
            <div className="space-y-4">
              {!selectedCustomer ? (
                <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-900">
                        Wajib Memilih Pelanggan Terdaftar
                      </h4>
                      <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                        Pembayaran kasbon tidak dapat diproses untuk pembeli umum/anonim. Silakan pilih pelanggan terlebih dahulu agar tagihan tercatat di buku piutang.
                      </p>
                    </div>
                  </div>

                  {onOpenCustomerPicker && (
                    <button
                      type="button"
                      onClick={onOpenCustomerPicker}
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                    >
                      <Users className="w-4 h-4" />
                      <span>Pilih Pelanggan Sekarang</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Info Pelanggan Kasbon */}
                  <div className="p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold text-xs">
                        {selectedCustomer.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">{selectedCustomer.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {selectedCustomer.phone || selectedCustomer.code || 'Pelanggan Terdaftar'}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-lg">
                      Kasbon
                    </span>
                  </div>

                  {/* Jatuh Tempo */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700">
                      Batas Jatuh Tempo Pelunasan:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[7, 14, 30].map((days) => {
                        const targetDate = new Date();
                        targetDate.setDate(targetDate.getDate() + days);
                        const dateStr = targetDate.toISOString().slice(0, 10);
                        return (
                          <button
                            key={days}
                            type="button"
                            onClick={() => setDebtDueDate(dateStr)}
                            className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                              debtDueDate === dateStr
                                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                : 'bg-slate-50 hover:bg-amber-50/60 text-slate-700 border-slate-200'
                            }`}
                          >
                            +{days} Hari
                          </button>
                        );
                      })}
                    </div>
                    <div className="relative pt-1">
                      <input
                        type="date"
                        value={debtDueDate}
                        onChange={(e) => setDebtDueDate(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Catatan Kasbon */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Catatan Kasbon (Opsional):
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Janji bayar akhir bulan / setelah gajian"
                      value={debtNotes}
                      onChange={(e) => setDebtNotes(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  {/* Keterangan Operasional */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 leading-relaxed">
                    Stok barang/bahan tetap terpotong otomatis saat transaksi kasbon ini selesai. Saat pelanggan membayar tunai kelak, catat di menu Piutang agar uang fisik laci kasir bertambah.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fixed Sticky Action Footer (Prime Thumb Zone) */}
        <div className="p-3.5 sm:p-5 border-t border-slate-200 bg-white flex items-center justify-between gap-3 shrink-0 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 sm:px-5 py-3 rounded-xl border border-slate-300 text-slate-700 text-xs sm:text-sm font-bold hover:bg-slate-100 transition-colors"
          >
            Batal (Esc)
          </button>

          <button
            type="button"
            disabled={
              loading ||
              (method === 'SPLIT' && isFree) ||
              (method === 'CASH' && isCashInsufficient) ||
              (method === 'QRIS' && !qrisPaid) ||
              (method === 'SPLIT' && (isSplitCashInsufficient || !splitQrisPaid)) ||
              (method === 'DEBT' && !selectedCustomer)
            }
            onClick={handlePay}
            className={`flex-1 py-3 px-4 sm:px-5 rounded-xl active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none text-white text-xs sm:text-sm font-extrabold shadow-lg transition-all flex items-center justify-center gap-2 tracking-wide min-h-[46px] ${
              method === 'DEBT'
                ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                : 'bg-blue-900 hover:bg-blue-800 shadow-blue-900/20'
            }`}
          >
            {loading ? (
              'Memproses Transaksi...'
            ) : method === 'SPLIT' && isFree ? (
              <span>Pilih Tunai / QRIS untuk Lanjut</span>
            ) : method === 'DEBT' ? (
              <>
                <span>Catat Kasbon Pelanggan</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>Selesaikan & Cetak (Enter)</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
