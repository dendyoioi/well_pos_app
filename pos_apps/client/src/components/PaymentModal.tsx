import React, { useState, useEffect } from 'react';
import { X, Banknote, QrCode, Split, CheckCircle, AlertCircle, ArrowRight, Lock, UserCheck, Users } from 'lucide-react';
import type { PaymentPayload, PaymentMethodType } from '../types/order';
import type { Customer } from '../types/customer';
import { usePlan } from '../hooks/usePlan';
import { UpgradeModal } from './UpgradeModal';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  grandTotal: number;
  onCheckout: (payment: PaymentPayload, payments?: PaymentPayload[]) => Promise<void>;
  loading: boolean;
  selectedCustomer?: Customer | null;
  customerName?: string;
  onOpenCustomerPicker?: () => void;
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
}) => {
  const { isFree } = usePlan();
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethodType>('CASH');
  const [amountPaid, setAmountPaid] = useState<number>(grandTotal);
  const [qrisRef, setQrisRef] = useState('');
  const [qrisPaid, setQrisPaid] = useState(false);

  // State khusus Split Payment (Tunai + QRIS)
  const [splitCashPortion, setSplitCashPortion] = useState<number>(Math.round(grandTotal / 2));
  const [splitCashTendered, setSplitCashTendered] = useState<number>(Math.round(grandTotal / 2));
  const [splitQrisPaid, setSplitQrisPaid] = useState(false);
  const [splitQrisRef, setSplitQrisRef] = useState('');

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
    }
  }, [isOpen, grandTotal]);

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
      });
    } else if (method === 'QRIS') {
      onCheckout({
        method: 'QRIS',
        amountPaid: grandTotal,
        qrisReference: qrisRef || `QRIS-${Date.now().toString().slice(-6)}`,
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
          qrisReference: splitQrisRef || `QRIS-SPLIT-${Date.now().toString().slice(-6)}`,
        },
      ];
      onCheckout(payments[0], payments);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
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

        <div className="p-6 space-y-4 overflow-y-auto">
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

          {/* Tab Metode Pembayaran (3 Tab: Tunai, QRIS, Split) */}
          <div className="grid grid-cols-3 p-1 bg-slate-100 border border-slate-200 rounded-2xl gap-1">
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
                if (isFree) {
                  setUpgradeModalOpen(true);
                  return;
                }
                setMethod('SPLIT');
                const half = Math.round(grandTotal / 2);
                setSplitCashPortion(half);
                setSplitCashTendered(half);
              }}
              className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                method === 'SPLIT'
                  ? 'bg-blue-900 text-white shadow-sm'
                  : isFree
                  ? 'text-slate-400 bg-slate-50 border border-dashed border-slate-300 hover:bg-amber-50 hover:text-amber-800'
                  : 'text-slate-600 hover:text-blue-950'
              }`}
            >
              <Split className="w-4 h-4" />
              <span>Split (Campuran)</span>
              {isFree && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">
                  <Lock className="w-2.5 h-2.5" />
                  <span>PRO</span>
                </span>
              )}
            </button>
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
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Uang Tunai Diterima:
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                    Rp
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 text-slate-900 rounded-xl pl-10 pr-4 py-3 text-lg font-black transition-all outline-none"
                  />
                </div>
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
            <div className="space-y-4 text-center">
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center">
                <div className="w-44 h-44 bg-white p-3 border-2 border-slate-300 rounded-2xl shadow-sm flex flex-col items-center justify-center relative overflow-hidden">
                  <div className="grid grid-cols-6 gap-1.5 w-full h-full p-1 opacity-80">
                    {[...Array(36)].map((_, i) => (
                      <div
                        key={i}
                        className={`rounded-xs ${
                          (i % 2 === 0 && i % 3 !== 0) || i < 6 || i > 28
                            ? 'bg-blue-950'
                            : 'bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="px-2 py-1 bg-white border border-slate-300 rounded-md shadow-sm text-[10px] font-black text-blue-950">
                      QRIS POS
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-500 mt-3 font-medium">
                  Scan QR menggunakan BCA, GoPay, OVO, Dana, atau mobile banking lainnya.
                </p>

                <div className="mt-3 w-full">
                  {!qrisPaid ? (
                    <button
                      type="button"
                      onClick={() => setQrisPaid(true)}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Simulasikan Pembayaran QRIS Sukses</span>
                    </button>
                  ) : (
                    <div className="p-2.5 bg-emerald-100 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-800 flex items-center justify-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-700" />
                      <span>Pembayaran QRIS Berhasil Diterima!</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-left">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor Referensi QRIS (Opsional):
                </label>
                <input
                  type="text"
                  value={qrisRef}
                  onChange={(e) => setQrisRef(e.target.value)}
                  placeholder="misal: QRIS-982341"
                  className="w-full bg-white border border-slate-300 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 text-slate-900 rounded-xl px-3.5 py-2.5 text-xs transition-all outline-none"
                />
              </div>
            </div>
          )}

          {/* KONTEN TAB SPLIT PAYMENT */}
          {method === 'SPLIT' && (
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
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      Rp
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={grandTotal}
                      value={splitCashPortion}
                      onChange={(e) => {
                        const val = Math.min(grandTotal, Math.max(0, Number(e.target.value)));
                        setSplitCashPortion(val);
                        setSplitCashTendered(val);
                      }}
                      className="w-full bg-white border border-slate-300 focus:border-blue-900 text-slate-900 rounded-xl pl-8 pr-2 py-2 text-sm font-black outline-none"
                    />
                  </div>
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
                <label className="block text-xs font-bold text-slate-700">
                  Uang Fisik Tunai Diterima Pelanggan:
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                    Rp
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={splitCashTendered}
                    onChange={(e) => setSplitCashTendered(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 focus:border-blue-900 text-slate-900 rounded-xl pl-10 pr-4 py-2.5 text-base font-black outline-none"
                  />
                </div>

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

              {/* QRIS Status Verifikasi */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">
                    Tagihan QRIS: Rp {splitQrisPortion.toLocaleString('id-ID')}
                  </span>
                  {splitQrisPaid ? (
                    <span className="text-emerald-700 font-extrabold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Lunas
                    </span>
                  ) : (
                    <span className="text-amber-700 font-bold">Menunggu Pembayaran</span>
                  )}
                </div>

                {!splitQrisPaid ? (
                  <button
                    type="button"
                    onClick={() => setSplitQrisPaid(true)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Konfirmasi QRIS Sebesar Rp {splitQrisPortion.toLocaleString('id-ID')}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={splitQrisRef}
                      onChange={(e) => setSplitQrisRef(e.target.value)}
                      placeholder="Ref QRIS (opsional, misal: QR-8899)"
                      className="flex-1 bg-white border border-slate-300 text-slate-900 rounded-xl px-3 py-1.5 text-xs outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setSplitQrisPaid(false)}
                      className="px-2.5 py-1.5 text-slate-500 hover:text-rose-600 text-xs font-semibold"
                    >
                      Batal
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-xl border border-slate-300 text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-100 transition-colors"
            >
              Batal (Esc)
            </button>

            <button
              type="button"
              disabled={
                loading ||
                (method === 'CASH' && isCashInsufficient) ||
                (method === 'QRIS' && !qrisPaid) ||
                (method === 'SPLIT' && (isSplitCashInsufficient || !splitQrisPaid))
              }
              onClick={handlePay}
              className="flex-1 py-3 px-5 rounded-xl bg-blue-900 hover:bg-blue-800 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2 tracking-wide"
            >
              {loading ? (
                'Memproses Transaksi...'
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

      {/* Modal Edukasi Upgrade PRO */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        title="Fitur Split Payment Khusus Paket PRO"
        message="Fitur Split Bill (pembayaran gabungan Tunai + QRIS) hanya tersedia pada Paket PRO. Upgrade sekarang untuk mengaktifkan!"
        featureHighlight="Split Payment (Campuran)"
      />
    </div>
  );
};

